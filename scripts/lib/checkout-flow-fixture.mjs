// Local frontend acceptance only. Never imported by src or deployed as a payment service.
import {createHash} from 'node:crypto';
import {createPaymentPinFlowFixture} from './payment-pin-flow-fixture.mjs';
import {demoFixture,demoOrderTimedOut,demoTimedOutOrder,paymentWindow} from './prototype-demo-data.mjs';
import {createPurchasePaymentPreviewFixture} from './purchase-payment-preview-fixture.mjs';
import {demoPurchasingAccountId,previewAccountId} from './prototype-demo-identity.mjs';

export function createCheckoutFlowFixture(state, locale = () => 'zh', projectMeOrders) {
  const pin = createPaymentPinFlowFixture();
  pin.state.loggedIn = true;
  const receipts = new Map();
  const orderCreates = new Map();
  const hiddenOrders = new Set();
  const hideCommands = new Map();
  let orderListScene;
  let nextHideFailure;
  const commandKeys = new Intl.Collator("en", {sensitivity:"base"});
  let delayCreate;
  const configureCreateDelay = () => { delayCreate = { scenario: state.scenarioEpoch }; };
  const ok = data => ({status:200,message:'OK',data});
  const external = createPurchasePaymentPreviewFixture(state, locale);
  const tradeinCommands = new Map([
    ['/api/app/trade-in/submit', 'trade-in'],
    ['/api/app/trade-in/capacity-replace', 'capacity-replace'],
  ]);
  const hidePath = /^\/api\/(?:app\/)?orders\/([^/]+)\/hide$/;
  const handles = path => hidePath.test(path) || /^\/api\/(orders(?:\/|$)|promotion-commands\/|app\/(security\/payment-password|payment-commands\/))/.test(path) || tradeinCommands.has(path) || external.handles(path);
  // A reset or scenario change starts a fresh account: replayed receipts and payment command receipts belong to the
  // old one. The PIN's own setup/change commands belong to the credential, which stays.
  let epoch = state.scenarioEpoch;
  function syncScenario() {
    external.sync();
    if (epoch !== state.scenarioEpoch) {
      epoch = state.scenarioEpoch; receipts.clear();
      orderCreates.clear();
      hiddenOrders.clear();
      hideCommands.clear();
      orderListScene = undefined;
      nextHideFailure = undefined;
      for (const key of pin.commands.keys()) if (!key.startsWith('security:')) pin.commands.delete(key);
    }
  }
  const isExpired = order => order.orderStatus === 'EXPIRED' && order.paymentStatus === 'EXPIRED';
  const scopedOrder = (owner, orderNo) => JSON.stringify([owner, orderNo]);
  function orderProjection(url, request, owner) {
    const page = demoFixture(new URL('/api/orders',url.origin),locale(),state,{...request,method:()=>'GET'});
    const meOrders = projectMeOrders?.(owner, page);
    if (meOrders) return meOrders;
    if (owner !== demoPurchasingAccountId(state)) return {...page,orders:[]};
    const sample = page.orders.find(order=>order.orderNo==='DEMO-ORDER-006');
    if (orderListScene === 'only-expired') return {...page,orders:sample ? [sample] : []};
    if (orderListScene === 'expired-first-page' && sample) {
      const orders = Array.from({length:22},(_,index)=>{
        const placedAt = sample.placedAt + index * 60000;
        return {...sample,...demoTimedOutOrder,orderNo:'DEMO-ORDER-'+String(11+index).padStart(3,'0'),placedAt,expiresAt:placedAt+paymentWindow};
      });
      return {...page,orders};
    }
    return page;
  }
  function paginateOrderPage(url, owner, page, defaultPageSize = 50) {
    const pageSize = Number(url.searchParams.get('pageSize') ?? defaultPageSize);
    const cursor = url.searchParams.get('beforeOrderNo')?.trim();
    const ordered = page.orders.sort((left,right)=>right.placedAt-left.placedAt||right.orderNo.localeCompare(left.orderNo));
    const anchor = cursor === undefined ? -1 : ordered.findIndex(order=>order.orderNo===cursor);
    if (!Number.isSafeInteger(pageSize) || pageSize<1 || pageSize>100 || cursor === '' || (cursor?.length??0)>100)
      throw Object.assign(new Error('ORDER_PAGE_INVALID'), {status:422});
    const visible = cursor && anchor<0 ? [] : ordered.slice(anchor+1).filter(order=>!hiddenOrders.has(scopedOrder(owner,order.orderNo))||!isExpired(order));
    const orders = visible.slice(0,pageSize);
    return {...page,orders,nextCursor:visible.length>pageSize ? orders.at(-1).orderNo : null};
  }
  function hideOrder(url, request, orderNo, owner, key) {
    if (!owner) return {status:403,message:'USER_SUBJECT_REQUIRED',data:null};
    if (!key?.trim()) return {status:400,message:'IDEMPOTENCY_KEY_REQUIRED',data:null};
    const order = orderProjection(url, request, owner).orders.find(row=>row.orderNo===orderNo);
    if (!order) return {status:403,message:'ORDER_FORBIDDEN',data:null};
    const command = JSON.stringify([owner, key.trim()]);
    const previous = hideCommands.get(command);
    if (previous) return previous.orderNo === orderNo ? previous.response : {status:409,message:'IDEMPOTENCY_KEY_CONFLICT',data:null};
    const failure = nextHideFailure;
    nextHideFailure = undefined;
    if (failure==='unavailable') return {status:503,message:'ORDER_HIDE_UNAVAILABLE',data:null};
    const response = isExpired(order) ? ok({orderNo,hidden:true,paymentStatus:'EXPIRED',orderStatus:'EXPIRED',
      serverCanonical:true,source:'server',sourceEnvironment:'PRODUCTION',runId:''})
      : {status:409,message:'ORDER_NOT_HIDEABLE',data:null};
    hideCommands.set(command,{orderNo,response});
    if (response.status !== 200) return response;
    hiddenOrders.add(scopedOrder(owner,orderNo));
    // A gateway failure can hide the result even though the order was saved.
    if (failure==='response-lost') return {status:503,message:'ORDER_HIDE_RESPONSE_UNAVAILABLE',data:null};
    return response;
  }
  function recoverPendingSingle(owner, product, quantity, voucherId, now) {
    const ownedReceipts = [...orderCreates.values()].filter(entry => entry.owner === owner && entry.receipt?.idSource === 'server');
    // The fixture inserts newest first. U-21 gives the oldest matching payable order priority.
    for (const order of [...(state.createdOrders ?? [])].reverse()) {
      if (order.orderType !== 'SINGLE' || order.promotionQuoteId || order.productNo !== product.id
          || order.quantity !== quantity || order.subtotalUsdt !== product.price * quantity
          || order.placedAt <= now - 86_400_000 || order.expiresAt <= now
          || order.paymentStatus !== 'PENDING' || order.orderStatus !== 'PENDING_PAYMENT'
          || order.activationStatus !== 'WAITING_PAYMENT') continue;
      const original = ownedReceipts.find(({receipt}) => receipt.orderNo === order.orderNo && receipt.voucherId === voucherId);
      if (original) return original.receipt;
    }
    return null;
  }
  function createFailure(error, operation, key, quoteId) {
    if (!(error.status >= 400 && error.status < 500)) throw error;
    if (quoteId && state.quotes?.[quoteId]) {
      // Returned business envelopes retain the refusal detail. A rolled-back promotion exception only retains FAILED.
      const hasDetail = ['PRODUCT_OUT_OF_STOCK','PRODUCT_NOT_AVAILABLE','PURCHASE_GATE_BLOCKED','PRODUCT_NOT_RELEASED',
        'BUNDLE_PRODUCT_NOT_AVAILABLE','BUNDLE_PRODUCT_NOT_RELEASED','BUNDLE_QUOTE_STALE','BUNDLE_DISCOUNT_POLICY_STALE',
        'CAPACITY_REPLACEMENT_REQUIRED'].includes(error.message);
      state.commands ??= {};
      state.commands[key] = {idempotencyKey:key,operation,targetId:quoteId,status:'FAILED',order:null,
        error:hasDetail?{code:error.status,message:error.message,data:null}:null};
    }
    return {status:error.status,message:error.message,data:null};
  }
  async function handle(url, request) {
    syncScenario();
    const path = url.pathname, method = request.method(), key = request.headers()['idempotency-key'];
    const handlesOrder = path === '/api/orders' || path.startsWith('/api/orders/') || path.startsWith('/api/promotion-commands/');
    const headers = request.headers();
    const hide = path.match(hidePath);
    if (hide && method === 'POST') return hideOrder(url, request, decodeURIComponent(hide[1]).trim(), previewAccountId(state, headers), key);
    const owner = handlesOrder ? previewAccountId(state, headers) : null;
    if (handlesOrder && path !== '/api/orders/commands' && owner !== demoPurchasingAccountId(state)) {
      if (!owner) return {status:403,message:'USER_SUBJECT_REQUIRED',data:null};
      // The selected purchasing account owns this scenario's orders and purchase commands.
      if (path === '/api/orders' && method === 'GET') {
        const projection = demoFixture(url,locale(),state,request);
        return ok({...projection,orders:[],nextCursor:null});
      }
      if (path === '/api/orders' || path === '/api/orders/bundle' || path === '/api/orders/quote')
        return {status:403,message:'PREVIEW_PURCHASE_ACCOUNT_REQUIRED',data:null};
      return {status:404,message:'ORDER_NOT_FOUND',data:null};
    }
    if (path === '/api/orders/commands' || (path === '/api/orders' && method === 'POST')) {
      if (!owner) return {status:403,message:'USER_SUBJECT_REQUIRED',data:null};
      // Java String.trim() removes characters no greater than U+0020.
      const trimmed = typeof key === 'string' ? key.replace(/^[\x00-\x20]+|[\x00-\x20]+$/g,'') : '';
      if (!trimmed) return {status:422,message:'IDEMPOTENCY_KEY_REQUIRED',data:null};
      if (trimmed.length > 128) return {status:422,message:'IDEMPOTENCY_KEY_INVALID',data:null};
      const command = JSON.stringify([owner, trimmed]);
      // Like the write endpoint, the read endpoint looks up the command within the owner's scope.
      const entry = [...orderCreates.values()].find(row => row.owner === owner && commandKeys.compare(row.key, trimmed) === 0);
      if (path === '/api/orders/commands') {
        if (method !== 'GET') return {status:405,message:'METHOD_NOT_ALLOWED',data:null};
        if (!entry) return {status:404,message:'ORDER_CREATE_COMMAND_NOT_FOUND',data:{status:'NOT_FOUND',idempotencyKey:trimmed,canRetrySameKey:true}};
        const data = {commandId:'OQC-'+createHash('sha256').update('APP:ORDER_CREATE:USER:'+owner+':'+trimmed).digest('hex'),
          operation:'ORDER_CREATE',idempotencyKey:trimmed,canRetrySameKey:false,order:null,error:null,
          createdAt:entry.createdAt,updatedAt:entry.updatedAt};
        if (entry.failure) return ok({...data,status:'FAILED',error:{code:entry.failure.status,message:entry.failure.message}});
        if (!entry.receipt) return ok({...data,status:'PROCESSING'});
        const order = state.createdOrders?.find(row => row.orderNo === entry.receipt.orderNo);
        if (!order) return ok({...data,status:'UNKNOWN'});
        const current = demoOrderTimedOut(order,state,Date.now()) ? {...order,...demoTimedOutOrder} : order;
        const {orderNo,canonicalStatus,paymentStatus,orderStatus,activationStatus,amountUsdt,placedAt} = current;
        return ok({...data,status:'SUCCEEDED',order:{orderNo,status:canonicalStatus,canonicalStatus,
          paymentStatus,orderStatus,activationStatus,amountUsdt,placedAt}});
      }
      let input;
      try { input = request.postDataJSON(); } catch { input = null; }
      if (!input || typeof input !== 'object' || Array.isArray(input)
          || ['orderNo', 'productNo', 'voucherId', 'promotionQuoteId'].some(field => input[field] != null && typeof input[field] !== 'string')
          || ['productId', 'quantity'].some(field => input[field] != null && !Number.isSafeInteger(input[field]))) {
        return {status:400,message:'REQUEST_BODY_INVALID',data:null};
      }
      // Hash the fixed order-create fields within the same owner and key scope as U-21.
      const fingerprint = createHash('sha256').update(JSON.stringify([owner, entry?.key ?? trimmed,
        input.orderNo ?? null, input.productId ?? null, input.productNo ?? null,
        input.quantity ?? null, input.voucherId ?? null, input.promotionQuoteId ?? null])).digest('hex');
      if (entry && entry.fingerprint !== fingerprint) return {status:409,message:'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',data:null};
      if (entry?.failure) return entry.failure;
      if (entry) return entry.receipt ? ok(entry.receipt) : {status:409,message:'IDEMPOTENCY_RESULT_UNKNOWN',data:null};
      const originalEpoch = epoch;
      const createdAt = new Date().toISOString();
      const creating = {owner,key:trimmed,fingerprint,receipt:null,createdAt,updatedAt:createdAt};
      orderCreates.set(command, creating);
      try {
        if (delayCreate && delayCreate.scenario === state.scenarioEpoch) {
          delayCreate = undefined;
          await new Promise(resolve=>setTimeout(resolve, 6000));
        }
        if (state.scenarioEpoch !== originalEpoch || owner !== previewAccountId(state, headers)) {
          return {status:409,message:'PREVIEW_CREATE_SCOPE_CHANGED',data:null};
        }
        creating.receipt = demoFixture(url,locale(),state,{...request,postDataJSON:()=>input,tracksOrderCreate:true,
          recoverPendingSingle:(product,quantity,voucherId,now)=>recoverPendingSingle(owner,product,quantity,voucherId,now)});
        creating.updatedAt = new Date().toISOString();
        return ok(creating.receipt);
      } catch (error) {
        creating.failure = createFailure(error, 'createOrder', trimmed, input.promotionQuoteId);
        creating.updatedAt = new Date().toISOString();
        return creating.failure;
      } finally {
        if (!creating.receipt && !creating.failure && orderCreates.get(command) === creating) orderCreates.delete(command);
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
    if (path === '/api/orders' && method === 'GET') return ok(paginateOrderPage(url, owner, orderProjection(url, request, owner)));
    if (path === '/api/orders/quote') return ok(demoFixture(url,locale(),state,request));
    if (path === '/api/orders/bundle' && method === 'POST') {
      if (receipts.has(path+key)) return receipts.get(path+key);
      let response;
      try { response = ok(demoFixture(url,locale(),state,request)); }
      catch (error) { response = createFailure(error, 'createBundle', key, request.postDataJSON().promotionQuoteId); }
      receipts.set(path+key,response);
      return response;
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
  return {handles,handle,pin,syncScenario,paginateOrderPage,delayCreate:configureCreateDelay,seedRemoteOrderPayment:external.seedRemoteOrderPayment,observePayments:external.observePayments,
    expireOrderPayment:external.expireOrderPayment, observeLateOrderPayment:external.observeLateOrderPayment,
    confirmLateOrderPayment:external.confirmLateOrderPayment,
    failNextHide:failure=>{nextHideFailure=['unavailable','response-lost'].includes(failure)?failure:undefined;},
    selectOrderListScene:scene=>{orderListScene=['only-expired','expired-first-page'].includes(scene)?scene:undefined;},
    selectPaymentMode:external.selectPaymentMode};
}
