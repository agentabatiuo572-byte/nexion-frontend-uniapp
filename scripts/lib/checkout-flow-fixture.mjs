// Local frontend acceptance only. Never imported by src or deployed as a payment service.
import {createPaymentPinFlowFixture} from './payment-pin-flow-fixture.mjs';
import {demoFixture,demoOrderTimedOut,demoTimedOutOrder} from './prototype-demo-data.mjs';
import {createPurchasePaymentPreviewFixture} from './purchase-payment-preview-fixture.mjs';
import {previewAccountId} from './prototype-demo-identity.mjs';

export function createCheckoutFlowFixture(state, locale = () => 'zh') {
  const pin = createPaymentPinFlowFixture();
  pin.state.loggedIn = true;
  const receipts = new Map();
  const orderCreates = new Map();
  let delayCreate;
  const configureCreateDelay = () => { delayCreate = { scenario: state.scenarioEpoch }; };
  const ok = data => ({status:200,message:'OK',data});
  const external = createPurchasePaymentPreviewFixture(state, locale);
  const tradeinCommands = new Map([
    ['/api/app/trade-in/submit', 'trade-in'],
    ['/api/app/trade-in/capacity-replace', 'capacity-replace'],
  ]);
  const handles = path => /^\/api\/(orders(?:\/|$)|promotion-commands\/|app\/(security\/payment-password|payment-commands\/))/.test(path) || tradeinCommands.has(path) || external.handles(path);
  // A reset or scenario change starts a fresh account: replayed receipts and payment command receipts belong to the
  // old one. The PIN's own setup/change commands belong to the credential, which stays.
  let epoch = state.scenarioEpoch;
  async function handle(url, request) {
    if (epoch !== state.scenarioEpoch) {
      epoch = state.scenarioEpoch; receipts.clear();
      orderCreates.clear();
      for (const key of pin.commands.keys()) if (!key.startsWith('security:')) pin.commands.delete(key);
    }
    const path = url.pathname, method = request.method(), key = request.headers()['idempotency-key'];
    if (path === '/api/orders/create-command' || (path === '/api/orders' && method === 'POST')) {
      const headers = request.headers();
      const owner = previewAccountId(state, headers);
      if (!owner) return {status:403,message:'USER_SUBJECT_REQUIRED',data:null};
      // Java String.trim() removes characters no greater than U+0020.
      const trimmed = typeof key === 'string' ? key.replace(/^[\x00-\x20]+|[\x00-\x20]+$/g,'') : '';
      if (!trimmed) return {status:422,message:'IDEMPOTENCY_KEY_REQUIRED',data:null};
      if (trimmed.length > 128) return {status:422,message:'IDEMPOTENCY_KEY_INVALID',data:null};
      const command = JSON.stringify([owner, trimmed]);
      const entry = orderCreates.get(command);
      if (path === '/api/orders/create-command') {
        if (method !== 'GET') return {status:405,message:'METHOD_NOT_ALLOWED',data:null};
        if (!entry) return {status:404,message:'ORDER_CREATE_COMMAND_NOT_FOUND',data:{status:'NOT_FOUND'}};
        if (entry.receipt) {
          const order = state.createdOrders?.find(row => row.orderNo === entry.receipt.orderNo);
          if (order) {
            const orderStatus = demoOrderTimedOut(order,state,Date.now()) ? demoTimedOutOrder.orderStatus : order.orderStatus;
            return ok({status:'SUCCEEDED',orderNo:order.orderNo,orderStatus});
          }
        }
        return ok({status:'PROCESSING'});
      }
      if (entry) return entry.receipt ? ok(entry.receipt) : {status:409,message:'IDEMPOTENCY_RESULT_UNKNOWN',data:null};
      const originalEpoch = epoch;
      const creating = {receipt:null};
      orderCreates.set(command, creating);
      try {
        if (delayCreate && delayCreate.scenario === state.scenarioEpoch) {
          delayCreate = undefined;
          await new Promise(resolve=>setTimeout(resolve, 6000));
        }
        if (state.scenarioEpoch !== originalEpoch || owner !== previewAccountId(state, headers)) {
          return {status:409,message:'PREVIEW_CREATE_SCOPE_CHANGED',data:null};
        }
        creating.receipt = demoFixture(url,locale(),state,{...request,tracksOrderCreate:true});
        return ok(creating.receipt);
      } finally {
        if (!creating.receipt && orderCreates.get(command) === creating) orderCreates.delete(command);
      }
    }
    const paymentCommand = path.match(/^\/api\/app\/payment-commands\/(order-pay|trial-convert|trade-in|capacity-replace|capacity-keep)\/(.+)$/);
    if (paymentCommand) {
      if (!external.ownsPreviewPayments(request)) return {status:404,message:'PURCHASE_PAYMENT_INTENT_NOT_FOUND',data:null};
      const [,kind,encodedKey] = paymentCommand, commandKey = decodeURIComponent(encodedKey);
      if (state.paymentState === 'read-error' && pin.commands.has(kind+':'+commandKey)) return pin.handle(url, request);
      const result = external.paymentCommand(kind, commandKey);
      if (result) return ok(result);
    }
    if (path.startsWith('/api/app/security/payment-password') || path.startsWith('/api/app/payment-commands/')) return pin.handle(url, request);
    if (method === 'GET' && external.handles(path)) return external.handle(url, request);
    for (const order of state.createdOrders ?? []) if (demoOrderTimedOut(order,state,Date.now())) Object.assign(order,demoTimedOutOrder);
    if (external.handles(path)) return external.handle(url, request);
    const kind = tradeinCommands.get(path);
    if (kind) {
      const fail = (status, message) => ({status,message,data:null});
      if (method !== 'POST') return fail(405,'METHOD_NOT_ALLOWED');
      if (!key) return fail(422,'IDEMPOTENCY_KEY_REQUIRED');
      const command = kind + ':' + key, recorded = pin.commands.get(command);
      if (recorded) return recorded.status === 'SUCCEEDED' ? ok(recorded.receipt) : fail(recorded.code,recorded.message);
      const authorization = pin.authorize(request.postDataJSON());
      if (authorization.status !== 200) return authorization;
      let receipt;
      try { receipt = demoFixture(url,locale(),state,request); }
      catch (error) {
        if (!error.status) throw error;
        pin.commands.set(command,{kind,commandKey:key,status:'REJECTED',canResumeSameKey:false,code:error.status,message:error.message,receipt:null});
        return fail(error.status,error.message);
      }
      pin.state.payWrites++;
      pin.commands.set(command,{kind,commandKey:key,status:'SUCCEEDED',canResumeSameKey:false,code:0,message:'OK',receipt});
      return ok(receipt);
    }
    if (path === '/api/orders' && method === 'GET') return ok(demoFixture(url,locale(),state,request));
    if (path === '/api/orders/quote') return ok(demoFixture(url,locale(),state,request));
    if (path === '/api/orders/bundle' && method === 'POST') {
      if (receipts.has(path+key)) return ok(receipts.get(path+key));
      const result = demoFixture(url,locale(),state,request);
      receipts.set(path+key,result);
      return ok(result);
    }
    const action = path.match(/^\/api\/orders\/([^/]+)\/(pay|cancel)$/);
    if (action && method === 'POST') {
      const orderNo = decodeURIComponent(action[1]);
      let order = state.createdOrders?.find(item => item.orderNo === orderNo);
      if (!order) {
        order = demoFixture(new URL('/api/orders',url.origin),locale(),state,{...request,method:()=> 'GET'}).orders.find(item=>item.orderNo===orderNo);
        if (!order) return {status:404,message:'ORDER_NOT_FOUND',data:null};
      }
      if (external.openOrderPayment(orderNo)) return {status:409,message:'ORDER_EXTERNAL_PAYMENT_IN_PROGRESS',data:null};
      if (action[2] === 'cancel') return ok(demoFixture(url,locale(),state,request));
      // Like AppPaymentPasswordService: a command key answers the outcome recorded for it.
      const command = 'order-pay:' + key, recorded = key && pin.commands.get(command);
      if (recorded) return recorded.status === 'SUCCEEDED' ? ok(recorded.receipt) : {status:recorded.code,message:recorded.message,data:null};
      // Like AppOrderCommandService.pay: once the deadline task has closed the order it is not payable; until then an
      // order past its deadline is refused as expired.
      if (!['PENDING','PAID'].includes(order.paymentStatus)) return {status:409,message:'ORDER_NOT_PAYABLE',data:null};
      if (order.paymentStatus === 'PENDING' && order.expiresAt <= Date.now()) return {status:409,message:'ORDER_PAYMENT_EXPIRED',data:null};
      // The PIN fixture only verifies the password. The commerce fixture authorizes the funds against the account's
      // one wallet balance and settles stock, capacity, receipt and fleet; the command is recorded only after it.
      const authorization = pin.authorize(request.postDataJSON());
      if (authorization.status !== 200) return authorization;
      const firstPayment=order.paymentStatus==='PENDING';
      let settled;
      try { settled = demoFixture(url,locale(),state,request); }
      catch (error) {
        const refusal = {status:error.status??409,message:error.message,data:null};
        if (key) pin.commands.set(command,{kind:'order-pay',commandKey:key,status:'REJECTED',canResumeSameKey:false,code:refusal.status,message:refusal.message,receipt:null});
        return refusal;
      }
      if(firstPayment)pin.state.payWrites++;
      if (key) pin.commands.set(command,{kind:'order-pay',commandKey:key,status:'SUCCEEDED',canResumeSameKey:false,code:0,message:'OK',receipt:settled});
      return {...ok(settled),drop:pin.state.dropNextPayment?(pin.state.dropNextPayment=false,true):false};
    }
    return ok(demoFixture(url,locale(),state,request));
  }
  return {handles,handle,pin,delayCreate:configureCreateDelay,seedRemoteOrderPayment:external.seedRemoteOrderPayment,observePayments:external.observePayments,
    selectPaymentMode:external.selectPaymentMode};
}
