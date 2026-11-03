// Local frontend acceptance only. Never imported by src or deployed as a payment service.
import {createPaymentPinFlowFixture} from './payment-pin-flow-fixture.mjs';
import {demoFixture} from './prototype-demo-data.mjs';
import {createPurchasePaymentPreviewFixture} from './purchase-payment-preview-fixture.mjs';

export function createCheckoutFlowFixture(state, locale = () => 'zh') {
  const pin = createPaymentPinFlowFixture();
  pin.state.loggedIn = true;
  const receipts = new Map();
  const ok = data => ({status:200,message:'OK',data});
  const external = createPurchasePaymentPreviewFixture(state, locale);
  const handles = path => /^\/api\/(orders(?:\/|$)|promotion-commands\/|app\/(security\/payment-password|payment-commands\/))/.test(path) || external.handles(path);
  // A reset or scenario change starts a fresh account: replayed receipts and payment command receipts belong to the
  // old one. The PIN's own setup/change commands belong to the credential, which stays.
  let epoch = state.scenarioEpoch;
  function handle(url, request) {
    if (epoch !== state.scenarioEpoch) {
      epoch = state.scenarioEpoch; receipts.clear();
      for (const key of pin.commands.keys()) if (!key.startsWith('security:')) pin.commands.delete(key);
    }
    const path = url.pathname, method = request.method(), key = request.headers()['idempotency-key'];
    const paymentCommand = path.match(/^\/api\/app\/payment-commands\/(order-pay|trial-convert|trade-in|capacity-replace|capacity-keep)\/(.+)$/);
    if (paymentCommand) {
      const result = external.paymentCommand(paymentCommand[1], decodeURIComponent(paymentCommand[2]));
      if (result) return ok(result);
    }
    if (path.startsWith('/api/app/security/payment-password') || path.startsWith('/api/app/payment-commands/')) return pin.handle(url, request);
    // Model the server's deadline task in this isolated fixture, not in product code.
    for (const order of state.createdOrders ?? []) {
      if (order.paymentStatus === 'PENDING' && order.expiresAt <= Date.now()) {
        Object.assign(order,{canonicalStatus:'expired',paymentStatus:'EXPIRED',orderStatus:'EXPIRED',activationStatus:'WAITING_PAYMENT',closeReasonCode:'PAYMENT_TIMEOUT'});
      }
    }
    if (external.handles(path)) return external.handle(url, request);
    if (path === '/api/orders' && method === 'GET') return ok(demoFixture(url,locale(),state,request));
    if (path === '/api/orders/quote') return ok(demoFixture(url,locale(),state,request));
    if (['/api/orders','/api/orders/bundle'].includes(path) && method === 'POST') {
      if (receipts.has(path+key)) return ok(receipts.get(path+key));
      const result = demoFixture(url,locale(),state,request);
      receipts.set(path+key,result);
      return ok(result);
    }
    const action = path.match(/^\/api\/orders\/([^/]+)\/(pay|cancel)$/);
    if (action && method === 'POST') {
      const orderNo = decodeURIComponent(action[1]);
      let order = state.createdOrders?.find(item => item.orderNo === orderNo);
      const sample = !order;
      if (sample) {
        order = demoFixture(new URL('/api/orders',url.origin),locale(),state,{...request,method:()=> 'GET'}).orders.find(item=>item.orderNo===orderNo);
        if (!order) return {status:404,message:'ORDER_NOT_FOUND',data:null};
      }
      // A sample row is adopted into the writable store only for a pay that commerce settles; a cancellation (settled
      // by the commerce fixture through its order status) or a refused command leaves the account's orders untouched.
      if (action[2] === 'cancel') return ok(demoFixture(url,locale(),state,request));
      // Like AppPaymentPasswordService: a command key answers the outcome recorded for it.
      const command = 'order-pay:' + key, recorded = key && pin.commands.get(command);
      if (recorded) return recorded.status === 'SUCCEEDED' ? ok(recorded.receipt) : {status:recorded.code,message:recorded.message,data:null};
      if (!['PENDING','PAID'].includes(order.paymentStatus)) return {status:409,message:'ORDER_PAYMENT_EXPIRED',data:null};
      // The PIN fixture only verifies the password. The commerce fixture authorizes the funds against the account's
      // one wallet balance and settles stock, capacity, receipt and fleet; the command is recorded only after it.
      const authorization = pin.authorize(request.postDataJSON());
      if (authorization.status !== 200) return authorization;
      if (sample) { state.createdOrders ??= []; state.createdOrders.push(order); }
      let settled;
      try { settled = demoFixture(url,locale(),state,request); }
      catch (error) {
        if (sample) state.createdOrders.splice(state.createdOrders.indexOf(order),1);
        const refusal = {status:error.status??409,message:error.message,data:null};
        if (key) pin.commands.set(command,{kind:'order-pay',commandKey:key,status:'REJECTED',canResumeSameKey:false,code:refusal.status,message:refusal.message,receipt:null});
        return refusal;
      }
      Object.assign(order,{paymentNo:settled.paymentNo,targetDeviceId:order.targetDeviceId??90301,targetDeviceInstanceNo:order.targetDeviceInstanceNo??orderNo+'-0-0'});
      if (key) pin.commands.set(command,{kind:'order-pay',commandKey:key,status:'SUCCEEDED',canResumeSameKey:false,code:0,message:'OK',receipt:settled});
      pin.state.payWrites++;
      return {...ok(settled),drop:pin.state.dropNextPayment?(pin.state.dropNextPayment=false,true):false};
    }
    return ok(demoFixture(url,locale(),state,request));
  }
  return {handles,handle,pin};
}
