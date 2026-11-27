// Frontend acceptance fixture only. Never imported by src or shipped in the production bundle.
import { fixture as reviewFixture, previewCapacity, previewDeviceProduct } from './design-review-fixture.mjs';
import { applyDemoPromotionDiscounts, applyDemoQuotePricing, demoBundlePricing, demoOrderDelivery, demoPaymentDeadline, demoPurchasedOrderDevices, demoQuoteDeadline, validateDemoOrderItems } from './prototype-demo-data.mjs';

// Synthetic SMS code for the local harness only; it is never included in an API response or product UI.
export const paymentPinFixtureOtp = '012345';

export function createPaymentPinFlowFixture({ now = Date.now } = {}) {
  const orders = new Map(), quotes = new Map(), commands = new Map(), challenges = new Map(), proofs = new Map();
  const changeAttempts = new Map(), changeProofs = new Map();
  const changeProofTtlMs = Number(process.env.DEMO_PAYMENT_PIN_CHANGE_PROOF_TTL_MS ?? 600_000);
  const attemptNoFormat = /^[A-Za-z0-9:_-]{8,128}$/;
  const invalidChangeProof = 'PAYMENT_PASSWORD_CHANGE_PROOF_INVALID_OR_EXPIRED';
  const state = { loggedIn:false, password:null, version:0, balance:10000, attempts:5, lockedUntil:null, payWrites:0, setupWrites:0, dropNextPayment:false };
  let challengeSequence = 0, proofSequence = 0;
  const proof={serverCanonical:true,sourceEnvironment:'PRODUCTION',runId:''};
  const ok=data=>({status:200,message:'OK',data});
  const fail=(status,message,data=null)=>({status,message,data});
  const pinState=()=>{
    if(state.lockedUntil!==null&&Date.parse(state.lockedUntil)<=now()){state.lockedUntil=null;state.attempts=5;}
    return {configured:state.password!==null,credentialVersion:state.version,lockedUntil:state.lockedUntil,remainingAttempts:state.attempts,serverTime:new Date(now()).toISOString()};
  };
  const wrongPassword=()=>{
    state.attempts=Math.max(0,state.attempts-1);
    // A short lock keeps the local preview testable; this is not a production lock policy.
    if(state.attempts===0)state.lockedUntil=new Date(now()+30000).toISOString();
    return state.lockedUntil===null?'PAYMENT_PASSWORD_INCORRECT':'PAYMENT_PASSWORD_LOCKED';
  };
  // Verifies a payment password for one payment; the caller settles the payment and records its command.
  const authorize=body=>{
    const current=pinState();
    if(!current.configured)return fail(409,'PAYMENT_PASSWORD_NOT_CONFIGURED',current);
    if(current.lockedUntil!==null)return fail(423,'PAYMENT_PASSWORD_LOCKED',current);
    if(body.credentialVersion!==state.version)return fail(409,'PAYMENT_PASSWORD_VERSION_CONFLICT',current);
    if(body.paymentPassword!==state.password)return fail(422,wrongPassword(),pinState());
    state.attempts=5;
    return ok(current);
  };
  const session=()=>({accessToken:'payment-flow-fixture',refreshToken:null,tokenType:'Bearer',user:{userId:90211,countryCode:'+86',phone:'13800138001',nickname:'Frontend acceptance',onboardingComplete:true}});
  function readFleet(url, request) {
    const fleet = reviewFixture(new URL('/api/devices/earnings', url.origin), 'zh', {}, request);
    const { products } = reviewFixture(new URL('/api/store/catalog', url.origin), 'zh', {}, request);
    const template = { ...fleet.devices[0], runtimeStatus: 'ONLINE' };
    const purchased = demoPurchasedOrderDevices(state, orders.values(), products, template);
    const serverNow = now();
    const seedDevices = fleet.devices.map(device => ({ ...device, ...previewCapacity(device, fleet.capacitySchedule, serverNow) }));
    const purchasedDevices = purchased.map(device => {
      const product = previewDeviceProduct(products, device.productCode);
      const capacity = previewCapacity(device, fleet.capacitySchedule, serverNow);
      return { ...device, ...capacity, imageUrl: new URL(new URL(product.imageUrl).pathname, url.origin).href,
        gpuModel: product.gpu, vramTotalGb: Number.parseInt(product.vram, 10), basePowerW: Number.parseInt(product.power, 10),
        dailyUsdt: Number((product.dailyEarn * capacity.capacityPct / 100).toFixed(6)) };
    });
    const devices = [...seedDevices, ...purchasedDevices];
    const active = devices.filter(device => device.activatedAt !== null);
    return { ...fleet, devices, serverNow, slotsUsed: active.length, walletUsdt: state.balance,
      dailyUsdt: active.reduce((sum, device) => sum + device.dailyUsdt, 0),
      dailyNex: active.reduce((sum, device) => sum + device.dailyNex, 0) };
  }
  function handle(url, request) {
    const method=request.method(), body=request.postDataJSON?.()??{}, path=url.pathname;
    const { 'idempotency-key': key, authorization: sessionId } = request.headers();
    if(path==='/auth/users/login'){state.loggedIn=true;return ok(session());}
    if(path==='/auth/users/refresh')return state.loggedIn?ok(session()):fail(401,'USER_REFRESH_TOKEN_REQUIRED');
    if(path==='/api/legal/terms/current')return ok({source:'server',sourceEnvironment:'PRODUCTION',runId:'',requestedLocale:url.searchParams.get('locale')||'zh-CN',resolvedLocale:'zh-CN',requestedJurisdiction:'GLOBAL',resolvedJurisdiction:'GLOBAL',provenance:'frontend-acceptance',version:'v1',effectiveAt:'2026-09-02T00:00:00Z',title:'Terms',summary:'Accepted',sections:[{key:'main',title:'Terms',body:'Accepted',sortOrder:0}],acknowledged:true,acknowledgedAt:'2026-09-02T00:00:00Z'});
    const pin='/api/app/security/payment-password';
    if(path===pin)return ok(pinState());
    if(path===pin+'/change/verify'){
      if(method!=='POST')return fail(405,'METHOD_NOT_ALLOWED');
      const current=pinState();
      if(typeof body.currentPassword!=='string'||!/^[0-9]{6}$/.test(body.currentPassword)||typeof body.attemptNo!=='string'||!attemptNoFormat.test(body.attemptNo))
        return fail(422,'PAYMENT_PASSWORD_INVALID',current);
      if(!current.configured)return fail(409,'PAYMENT_PASSWORD_NOT_CONFIGURED',current);
      if(body.expectedCredentialVersion!==current.credentialVersion)return fail(409,'PAYMENT_PASSWORD_VERSION_CONFLICT',current);
      const binding=JSON.stringify([sessionId,current.credentialVersion]);
      const prior=changeAttempts.get(body.attemptNo);
      if(prior){
        if(prior.binding!==binding)return fail(409,'PAYMENT_PASSWORD_ATTEMPT_CONFLICT',current);
        return prior.rejection??fail(409,'PAYMENT_PASSWORD_ATTEMPT_ALREADY_USED',current);
      }
      if(current.lockedUntil!==null)return fail(429,'PAYMENT_PASSWORD_LOCKED',current);
      if(body.currentPassword!==state.password){
        const message=wrongPassword();
        const rejection=fail(state.lockedUntil===null?422:429,message,pinState());
        changeAttempts.set(body.attemptNo,{binding,rejection});
        return rejection;
      }
      state.attempts=5;
      changeAttempts.set(body.attemptNo,{binding});
      const changeProof='pin-fixture-change-proof-'+(++proofSequence), expiresAt=now()+changeProofTtlMs;
      changeProofs.set(sessionId,{changeProof,expiresAt,version:current.credentialVersion});
      return ok({changeProof,expiresAt:new Date(expiresAt).toISOString()});
    }
    if([pin+'/setup',pin+'/change',pin+'/reset'].includes(path)){
      if(method!=='POST')return fail(405,'METHOD_NOT_ALLOWED');
      if(typeof key!=='string'||!key)return fail(422,'IDEMPOTENCY_KEY_REQUIRED');
      const prior=commands.get('security:'+key);
      if(prior)return prior.status==='REJECTED'?fail(prior.code,prior.message,prior.state):ok(prior);
      const reject=(status,message)=>{
        const current=pinState();
        commands.set('security:'+key,{commandKey:key,status:'REJECTED',state:current,code:status,message,canResumeSameKey:false});
        return fail(status,message,current);
      };
      const operation=path.split('/').at(-1), current=pinState();
      if(operation==='setup'&&current.configured)return reject(409,'PAYMENT_PASSWORD_ALREADY_CONFIGURED');
      if(operation==='reset'&&!current.configured)return reject(409,'PAYMENT_PASSWORD_NOT_CONFIGURED');
      if(operation==='reset'&&body.expectedCredentialVersion!==state.version)return reject(409,'PAYMENT_PASSWORD_VERSION_CONFLICT');
      const resetProof=operation==='reset'?proofs.get(body.resetProof):null;
      if(operation==='reset'&&(!resetProof||resetProof.expiresAt<=now()||resetProof.version!==state.version))return reject(422,'PAYMENT_PASSWORD_PROOF_EXPIRED');
      if(typeof body.newPassword!=='string'||!/^[0-9]{6}$/.test(body.newPassword)||body.newPassword!==body.confirmPassword)return reject(422,'PAYMENT_PASSWORD_CONFIRM_MISMATCH');
      if(/^(.)\1{5}$/.test(body.newPassword)||'0123456789012345'.includes(body.newPassword)||'9876543210987654'.includes(body.newPassword))return reject(422,'PAYMENT_PASSWORD_TOO_SIMPLE');
      if(operation==='change'){
        const issued=changeProofs.get(sessionId);
        if(body.currentPassword!==undefined||!issued||issued.changeProof!==body.changeProof||issued.expiresAt<=now()
          ||issued.version!==current.credentialVersion||body.expectedCredentialVersion!==current.credentialVersion)return reject(422,invalidChangeProof);
        if(typeof body.attemptNo!=='string'||!attemptNoFormat.test(body.attemptNo))return reject(422,'PAYMENT_PASSWORD_INVALID');
        if(current.lockedUntil!==null)return reject(429,'PAYMENT_PASSWORD_LOCKED');
      }
      if(operation!=='setup'&&body.newPassword===state.password)return reject(422,'PAYMENT_PASSWORD_NEW_MUST_DIFFER');
      if(operation==='reset')proofs.delete(body.resetProof);
      if(operation==='change')changeProofs.delete(sessionId);
      state.password=body.newPassword;state.version++;state.attempts=5;state.lockedUntil=null;
      if(operation==='setup')state.setupWrites++;
      const receipt={commandKey:key,status:'SUCCEEDED',state:pinState(),canResumeSameKey:false};commands.set('security:'+key,receipt);return ok(receipt);
    }
    if(path===pin+'/reset/challenge'){
      if(method!=='POST')return fail(405,'METHOD_NOT_ALLOWED');
      if(!pinState().configured)return fail(409,'PAYMENT_PASSWORD_NOT_CONFIGURED');
      if(Object.keys(body).length!==0)return fail(422,'PAYMENT_PASSWORD_CHALLENGE_INVALID');
      const challengeNo='pin-fixture-challenge-'+(++challengeSequence), expiresAt=now()+600000;
      challenges.clear();challenges.set(challengeNo,{expiresAt,version:state.version});
      return ok({phoneMasked:'+86 *** 8001',challengeNo,resendAfterSec:60,expiresAt:new Date(expiresAt).toISOString()});
    }
    if(path===pin+'/reset/verify'){
      if(method!=='POST')return fail(405,'METHOD_NOT_ALLOWED');
      const challenge=challenges.get(body.challengeNo);
      if(!challenge||challenge.expiresAt<=now()||challenge.version!==state.version)return fail(422,'PAYMENT_PASSWORD_CHALLENGE_EXPIRED');
      if(body.code!==paymentPinFixtureOtp)return fail(422,'PAYMENT_PASSWORD_CODE_INVALID');
      challenges.delete(body.challengeNo);
      const resetProof='pin-fixture-proof-'+(++proofSequence), expiresAt=now()+600000;
      proofs.set(resetProof,{expiresAt,version:state.version});
      return ok({resetProof,expiresAt:new Date(expiresAt).toISOString()});
    }
    if(path.startsWith(pin+'/commands/')){
      const commandKey=decodeURIComponent(path.split('/').at(-1));
      return ok(commands.get('security:'+commandKey)??{commandKey,status:'NOT_SEEN',canResumeSameKey:true});
    }
    if(path==='/api/orders/quote'){
      const quotedAt=now();
      try { validateDemoOrderItems(body.items); }
      catch (error) { if (error.status !== 422) throw error; return fail(error.status,error.message); }
      const quote=reviewFixture(url,'zh',{},request);
      const pricing=demoBundlePricing(quote.items.map(line=>Number(line.subtotalUsdt)));
      applyDemoQuotePricing(quote,pricing.discountUsdt);
      let activityEndsAt=Infinity;
      if(body.activityId){
        const {items:offers}=reviewFixture(new URL('/api/promotions',url.origin),'zh',{promotions:true},request);
        const activity=offers.find(offer=>offer.activityId===body.activityId);
        activityEndsAt=Date.parse(activity?.endsAt);
        if(!activity||activity.state!=='ACTIVE'||Date.parse(activity.startsAt)>quotedAt||!(activityEndsAt>quotedAt))
          return fail(409,'PROMOTION_NOT_ELIGIBLE_OR_UNAVAILABLE');
        for(const item of quote.items){
          const rule=activity.rewardRules.find(rule=>rule.productNo===item.productNo&&item.quantity>=rule.minBuyQty);
          if(!rule)continue;
          const {disclosure,...reward}=rule.buyerReward;
          quote.expectedRewards.push({lineId:item.lineId,activityId:activity.activityId,version:activity.version,
            ruleId:rule.ruleId,rewardRuleId:reward.rewardRuleId,beneficiaryRole:reward.beneficiaryRole,
            groups:1,reward,disclosure,eligibility:'ELIGIBLE',message:null});
        }
        if(!quote.expectedRewards.length)return fail(409,'PROMOTION_NOT_ELIGIBLE_OR_UNAVAILABLE');
        quote.activityId=activity.activityId;quote.activityVersion=activity.version;
      }
      try { applyDemoPromotionDiscounts(quote); }
      catch (error) { if (error.status !== 409) throw error; return fail(error.status,error.message); }
      quote.quoteId='pin-quote-'+(quotes.size+1);quote.quoteHash=quote.quoteId;
      quote.serverTime=new Date(quotedAt).toISOString();
      quote.expiresAt=new Date(demoQuoteDeadline(quotedAt,activityEndsAt)).toISOString();
      quotes.set(quote.quoteId,{quote,activityEndsAt});return ok(quote);
    }
    if((path==='/api/orders'||path==='/api/orders/bundle')&&method==='POST'){
      const entry=quotes.get(body.promotionQuoteId);if(!entry)return fail(422,'QUOTE_REQUIRED');
      const {quote,activityEndsAt}=entry,placedAt=now();
      if(placedAt>=Date.parse(quote.expiresAt))return fail(409,'PROMOTION_QUOTE_EXPIRED');
      if((path==='/api/orders/bundle')!==(quote.items.length>1))return fail(409,'PROMOTION_QUOTE_INPUT_CHANGED');
      const expiresAt=demoPaymentDeadline(placedAt,activityEndsAt);
      const {products}=reviewFixture(new URL('/api/store/catalog',url.origin),'zh',{},request);
      const items=quote.items.map(item=>({...item,productName:products.find(product=>product.id===item.productNo).name}));
      const lineItems=items.map(({productNo,productName,quantity,unitPriceUsdt,subtotalUsdt})=>({
        sku:productNo,name:productName,quantity,unitPriceUsdt:Number(unitPriceUsdt),lineAmountUsdt:Number(subtotalUsdt),
      }));
      const [first]=lineItems,orderNo='PIN-FLOW-'+(orders.size+1);
      const order={orderNo,productId:products.findIndex(product=>product.id===first.sku)+1,
        productNo:first.sku,productName:first.name,quantity:quote.quantity,subtotalUsdt:Number(quote.subtotalUsdt),
        unitPriceUsdt:first.unitPriceUsdt,discountUsdt:Number(quote.discountUsdt),amountUsdt:quote.amountUsdt,
        promotionQuoteId:quote.quoteId,promotionDiscountUsdt:quote.promotionDiscountUsdt,paymentMethod:'PENDING',paidTotalUsdt:null,paymentStatus:'PENDING',
        orderStatus:'PENDING_PAYMENT',activationStatus:'WAITING_PAYMENT',canonicalStatus:'placed',
        orderType:items.length>1?'BUNDLE':'SINGLE',placedAt,expiresAt,paidAt:null,activatedAt:null,
        refundedAt:null,refundAmountUsdt:null,refundChannel:null,refundBillNo:null,dataCenter:null,
        tradeinNo:null,sourceDeviceId:null,targetDeviceId:null,targetDeviceInstanceNo:null,
        itemCount:items.length,payBy:new Date(expiresAt).toISOString(),rewards:quote.expectedRewards,items,lineItems};
      orders.set(orderNo,order);return ok({...order,paymentMethod:null});
    }
    const pay=path.match(/^\/api\/orders\/([^/]+)\/pay$/);
    if(pay&&method==='POST'){
      const order=orders.get(decodeURIComponent(pay[1]));if(!order)return fail(404,'ORDER_NOT_FOUND');
      if(order.paymentStatus==='PAID')return ok(order);
      if(order.expiresAt<=now())return fail(409,'ORDER_PAYMENT_EXPIRED');
      const authorization=authorize(body);
      if(authorization.status!==200)return authorization;
      const amount=Number(order.amountUsdt);
      if(amount>state.balance)return fail(409,'ORDER_WALLET_INSUFFICIENT');
      const fleet=readFleet(url,request);
      const assignableSlots=Math.max(0,fleet.slotCap-fleet.slotsUsed);
      const paidAt=now();
      const delivery=demoOrderDelivery(state,order,paidAt,assignableSlots);
      state.payWrites++;state.balance-=amount;
      Object.assign(order,delivery,{paymentMethod:amount===0?'VOUCHER':'UVEL_WALLET',paidTotalUsdt:amount.toFixed(2),paymentStatus:'PAID',orderStatus:'COMPLETED',paidAt,inventoryUsedAt:paidAt,paymentNo:'PAY-'+order.orderNo});
      if(order.quantity===1)Object.assign(order,{targetDeviceId:delivery.activatedDeviceIds[0]??delivery.inventoryDeviceIds[0],targetDeviceInstanceNo:order.orderNo+'-0-0'});
      commands.set('order-pay:'+key,{kind:'order-pay',commandKey:key,status:'SUCCEEDED',canResumeSameKey:false,receipt:order});
      return {...ok(order),drop:state.dropNextPayment?(state.dropNextPayment=false,true):false};
    }
    if(path==='/api/orders')return ok({...proof,runId:null,source:'server',orders:[...orders.values()],nextCursor:null});
    if(path.startsWith('/api/app/payment-commands/')){
      const [,kind,commandKey]=path.match(/^\/api\/app\/payment-commands\/([^/]+)\/(.+)$/)??[];
      return ok(commands.get(kind+':'+decodeURIComponent(commandKey))??{kind,commandKey:decodeURIComponent(commandKey),status:'NOT_SEEN',canResumeSameKey:true});
    }
    if(path.startsWith('/api/promotion-commands/')){
      const commandKey=decodeURIComponent(path.split('/').at(-1)), original=commands.get('order-pay:'+commandKey);
      return ok({commandId:commandKey,operation:url.searchParams.get('operation'),targetId:url.searchParams.get('targetId'),idempotencyKey:commandKey,status:original?'SUCCEEDED':'NOT_FOUND',resource:null,order:original?.receipt??null,error:null});
    }
    if(path==='/api/devices/earnings')return ok(readFleet(url,request));
    const data=reviewFixture(url,'zh',{offers:false,promotions:false},request);
    if(path==='/api/store/catalog')return ok({...data,products:data.products.map(product=>({...product,imageUrl:new URL(new URL(product.imageUrl).pathname,url.origin).href}))});
    if(path==='/api/app/trade-in/capacity-quote')return ok({...data,walletBalanceUsdt:state.balance,sufficientFunds:true});
    if(path==='/api/trial/state'||path==='/api/trial/eligibility')return ok({...data,canStart:false,reason:'used',state:'ELIGIBLE',version:1});
    return ok(data??{});
  }
  return {handle,authorize,state,orders,commands};
}
