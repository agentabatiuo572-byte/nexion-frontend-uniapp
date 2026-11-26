import { demoWalletUsdt, postDemoWalletEntries } from './prototype-demo-wallet.mjs';
// Loopback-only lifecycle fixture. Never imported by src or an App build.
import { createHash, randomUUID } from 'node:crypto';
import { fixture, previewDefaultTrialName, previewDefaultTrialSku, previewTrialProductConfig } from './design-review-fixture.mjs';
// Match BigDecimal DOWN at the boundary; quote arithmetic stays in millionths.
const units=(value,scale=6)=>{
  const decimal=String(value);
  const negative=decimal.startsWith('-');
  const [whole,fraction='']=decimal.replace(/^-/,'').split('.');
  const magnitude=BigInt(whole)*10n**BigInt(scale)+BigInt(fraction.padEnd(scale,'0').slice(0,scale)||'0');
  return negative?-magnitude:magnitude;
};
const number=value=>Number(value)/1e6;
const fixed=value=>`${value/1000000n}.${String(value%1000000n).padStart(6,'0')}`;
const min=(a,b)=>a<b?a:b,max=(a,b)=>a>b?a:b;
const capped=(amount,cap)=>String(cap??'').trim()===''?amount:min(amount,units(cap));
const liveStates=['ACTIVE','GRACE','EXTENDED'];
const day=86400000,proof={sourceEnvironment:'PRODUCTION',runId:'',serverCanonical:true};
const newClaimNo=()=>`TRIAL-${randomUUID().replaceAll('-','').toUpperCase()}`;
const refuse=(message,data,status=409)=>{throw Object.assign(new Error(message),{status,data});};
const originalPaymentReaders=new WeakMap();
export function registerTrialOriginalPayment(state,read){
  originalPaymentReaders.set(state,read);
}
const optionSku=['stellarrack-p1','cloud-share','stellarbox-pro','stellarbox-pro-v2','stellarbox-s1','stellarrack-p2'];
const deviceDiscounts={
  'stellarbox-s1': {discount:{ratePct:'25',capUsdt:'40'},earlyUsdt:'4'},
  'stellarbox-pro': {},
  'stellarbox-pro-v2': {discount:{ratePct:'20',capUsdt:'400'},earlyUsdt:'30'},
  'stellarrack-p1': {earlyUsdt:'0'},
  'cloud-share': {discount:{ratePct:'0.5',capUsdt:'50'}},
};
export const trialPurchaseOptionSku=state=>state.trialPurchaseOptionTarget==='trial-device'
  ? state.trialRow?.claimConfig?.trialProductId??(state.catalogState==='trial-h2-switched'?'stellarbox-pro':previewDefaultTrialSku) : 'stellarrack-p1';
export const trialPurchaseOptionsEnabled=state=>state.trialPurchaseReadState!=='unsupported';
export const trialPurchaseDevice=(product,productName=product.name)=>({
  productNo:product.id,name:productName,productType:product.productType,imageUrl:product.imageUrl??null,
});
export const wireTrialQuote=({trialOffsetCapUSD: _,...quote})=>Object.fromEntries(Object.entries(quote).map(([key,value])=>
  typeof value==='number'&&/(Usdt|Nex)$/.test(key)?[key,value.toFixed(6)]:[key,value]));

export function trialDemo(url,locale,state,request,capacityFull,products,requirePurchase){
  if(!url.pathname.startsWith('/api/trial/'))return undefined;
  const now=Date.now()+(state.trialLifecycleAdvanceDays??0)*day,mode=state.trialState||'follow';
  const data=structuredClone(fixture(new URL('/api/trial/state',url.origin),locale,{offers:true},request));
  const switched=state.catalogState==='trial-h2-switched';
  const originalProduct=products.find(product=>product.id===previewDefaultTrialSku);
  const product=switched?products.find(product=>product.id==='stellarbox-pro'):originalProduct;
  const hasYield=product?.dailyEarn>0&&product.dailyEarnNEX>0;
  const available=hasYield&&product.available&&product.productType==='DEVICE'&&product.inventoryMode==='FINITE'&&product.stock>0;
  const unclaimedConfig=Object.assign(data.config,product&&previewTrialProductConfig(product));
  // A long catalog name for the claim sheet's wrap check; the claim chain itself is unchanged.
  if(state.trialNameState==='long')unclaimedConfig.trialProductName='UVELBox S100 Pro Max Edition 2026';
  if(state.trialStartPhaseClosed)unclaimedConfig.phaseOpen=false;
  if(!hasYield){
    unclaimedConfig.shadowDailyUSD=null;
    unclaimedConfig.shadowDailyNEX=null;
  }
  unclaimedConfig.earlyPurchaseDiscountUSD??=String(state.trialEarlyDiscount??'10');
  // P-59 / backend B13-B14: the trial discount caps at $50; an empty offset cap is JSON null in App responses.
  unclaimedConfig.discountCapUSD='50';unclaimedConfig.trialOffsetCapUSD=null;
  const cooldown=Number(unclaimedConfig.cooldownDays??30)*day;
  const pricing=state.trialQuoteState||'default';
  // BUG-081 samples keep their labelled early prices through a zero offset cap;
  // settled earnings are paid out after purchase and use the same catalog rate as a default claim.
  const precision=['precision','half-cent','sub-half-cent','precision-repriced'].includes(pricing);
  if(!['default','historical-cap'].includes(pricing))Object.assign(unclaimedConfig,{trialDays:'3',discountRate:pricing==='excess-offset'?'0':'0.15',earlyPurchaseDiscountUSD:pricing==='repriced'?'11':'10',trialOffsetCapUSD:pricing==='capped'?'20':precision?'0':null});
  if(pricing==='cloud-share-half-cent')unclaimedConfig.trialOffsetCapUSD='6.34';
  // Repricing a confirmed precision quote changes live promo policy, never the claim's price or rates.
  if(pricing==='precision-repriced')unclaimedConfig.discountCapUSD='49.999999';
  const perDevice=state.trialPurchaseListState==='device-discounts';
  if(perDevice&&state.trialDefaultDiscountState==='repriced')
    Object.assign(unclaimedConfig,{discountRate:'0.175',earlyPurchaseDiscountUSD:'5'});
  const trialTermsVersion=available?createHash('sha256').update(JSON.stringify([
    unclaimedConfig.trialProductId,unclaimedConfig.trialDays,product.monthlyEstimateUsdt??null,
    unclaimedConfig.shadowDailyUSD,unclaimedConfig.shadowDailyNEX,unclaimedConfig.trialOffsetCapUSD,unclaimedConfig.trialPriceUSD,
  ])).digest('hex'):undefined;
  const scenario=!available?'available':mode==='follow'?(state.benefitState==='finished'?'converted':state.benefitState==='grace'?'grace':state.benefitState==='claimed'?'active':'available'):mode;
  if(!state.trialRow){
    const claimConfig={...unclaimedConfig};
    // The H2 switch can open on an account that claimed S1 before its catalog rename.
    if(switched&&originalProduct)Object.assign(claimConfig,previewTrialProductConfig({...originalProduct,name:previewDefaultTrialName}));
    const duration=Number(claimConfig.trialDays)*day,grace=Number(claimConfig.graceDays)*day;
    const ended=['ended','eligible-again'].includes(scenario);
    const redeemed=['converted','refunded'].includes(scenario);
    const activeAge=pricing==='cloud-share-half-cent'?2*day:day;
    const startedAt=now-(scenario==='final-day'?duration-day/2:scenario==='grace'?duration+day
      :scenario==='grace-ending'?duration+grace-45000
      :ended?duration+grace+(scenario==='eligible-again'?cooldown:0)+day:activeAge);
    state.trialRow={state:['active','final-day'].includes(scenario)?'ACTIVE':['grace','grace-ending'].includes(scenario)?'GRACE'
      :ended?'CANCELLED':redeemed?'REDEEMED':'ELIGIBLE',startedAt,version:redeemed?1:0};
    if(ended){
      const finishedAt=startedAt+duration+grace;
      Object.assign(state.trialRow,{endReason:'expired',finishedAt,cooldownUntil:finishedAt+cooldown,version:1});
    }
    // B13: this preset was claimed under the former 50 USDT cap; new claims use today's null cap.
    if(state.trialRow.state!=='ELIGIBLE'){
      if(pricing==='historical-cap'&&['ACTIVE','GRACE','REDEEMED'].includes(state.trialRow.state))claimConfig.trialOffsetCapUSD='50';
      state.trialRow.claimConfig=claimConfig;
    }
  }
  const row=state.trialRow;
  // Saved preview rows predate per-claim identities.
  if(row.state!=='ELIGIBLE')row.claimNo??=newClaimNo();
  // Claim terms determine accrual and the offset cap. The three purchase discounts are live.
  const {discountRate,discountCapUSD,earlyPurchaseDiscountUSD}=unclaimedConfig;
  let cfg={...unclaimedConfig,...row.claimConfig,discountRate,discountCapUSD,earlyPurchaseDiscountUSD};
  let duration=Number(cfg.trialDays)*day,grace=Number(cfg.graceDays)*day;
  const usesOptions=trialPurchaseOptionsEnabled(state);
  const trialProduct=()=>products.find(item=>item.id===cfg.trialProductId);
  const conversionDeadline=()=>row.startedAt+duration+grace;
  const atTrialClock=at=>at+(state.trialPurchaseWindow==='grace'&&liveStates.includes(row.state)
    ? row.startedAt+duration+day-now : 0);
  const originalPurchase=()=>{
    const purchase=request.originalTrialPurchase?.()??originalPaymentReaders.get(state)?.()??state.trialBalancePurchase;
    return purchase?.claimNo===row.claimNo?purchase:null;
  };
  const trialDevice=()=>trialPurchaseDevice(trialProduct()??{
    id:cfg.trialProductId,productType:'DEVICE',imageUrl:null,
  },cfg.trialProductName);
  function accruedAt(at){
    const days=min(BigInt(Math.max(0,Math.floor((at-row.startedAt)/1000)))*100000000n/86400n,BigInt(cfg.trialDays)*100000000n);
    const dailyShadow=units(cfg.shadowDailyUSD??0);
    // The loopback preview can advance accrual between interactions without changing the claim or quote terms.
    const shadow=state.trialPreviewAccruedMicros===undefined ? dailyShadow*days/100000000n
      : min(BigInt(state.trialPreviewAccruedMicros),dailyShadow*BigInt(cfg.trialDays));
    return {shadow:max(0n,shadow-units(state.trialAccrualReductionUsdt??0)),nex:units(cfg.shadowDailyNEX??0)*days/100000000n};
  }
  const snapshot=()=>{
    if(row.state==='ACTIVE'&&now>=row.startedAt+duration)row.state='GRACE';
    // The provider reader projects only still-open intents, including unresolved expiry.
    const externalHold=row.state==='GRACE'&&now>=conversionDeadline()&&originalPurchase()?.kind==='EXTERNAL';
    if(row.state==='GRACE'&&now>=conversionDeadline()&&!externalHold){
      const finishedAt=conversionDeadline();
      Object.assign(row,{state:'CANCELLED',endReason:'expired',finishedAt,cooldownUntil:finishedAt+cooldown,version:(row.version??0)+1});
    }
    const trialNow=atTrialClock(now);
    const reportedState=liveStates.includes(row.state)&&trialNow>=row.startedAt+duration?'GRACE':row.state;
    const claimed=row.state!=='ELIGIBLE',live=liveStates.includes(row.state);
    const conversion=row.state==='REDEEMED'?conversionFacts():null;
    const {shadow,nex}=claimed&&row.state!=='CANCELLED'?accruedAt(row.state==='REDEEMED'?row.settlementAt??row.finishedAt:trialNow):{shadow:0n,nex:0n};
    const eligible=!claimed||(['FAILED','CANCELLED'].includes(row.state)&&row.cooldownUntil!=null&&row.cooldownUntil<=now);
    // capacity-full comes from the fleet facts alone; the capacity-full preset seeds a genuinely full fleet.
    const canStart=eligible&&available&&!capacityFull&&!state.trialStartPhaseClosed;
    const quote=live?quoteFor(shadow,nex,reportedState==='ACTIVE'):undefined;
    const purchase=live&&usesOptions?originalPurchase():null;
    const purchaseSnapshot=purchase?.kind==='EXTERNAL'
      ? {...purchase,deadlineAt:new Date(atTrialClock(Date.parse(purchase.deadlineAt))).toISOString()} : purchase;
    const config=live||row.state==='REDEEMED'?cfg:eligible&&trialTermsVersion?{...unclaimedConfig,trialTermsVersion}:unclaimedConfig;
    return {...data,config,state:reportedState,canStart,eligibilityReason:state.trialStartPhaseClosed?'phase-closed':eligible&&!available?'product-unavailable':eligible&&capacityFull?'capacity-full':!canStart?(row.state==='REDEEMED'?'converted':live?'in-progress':'used'):undefined,
      claimNo:claimed?row.claimNo:null,version:row.version??0,serverNowEpochMs:trialNow,endReason:row.endReason??null,
      claimedAtEpochMs:claimed?row.startedAt:null,expiresAtEpochMs:claimed?row.startedAt+duration:null,
      graceEndsAtEpochMs:live?row.startedAt+duration+grace:null,
      finishedAtEpochMs:['FAILED','CANCELLED','REDEEMED'].includes(row.state)?row.finishedAt||row.startedAt+duration+grace:null,
      cooldownUntilEpochMs:row.cooldownUntil??null,
      shadowUsdt:number(shadow),shadowNex:number(nex),
      offsetUsdt:quote?.offsetUsdt??0,remainderUsdt:quote?.remainderUsdt??0,priceUsdt:Number(cfg.trialPriceUSD),
      ...(quote?{quote}:{}),...(conversion||{}),...(claimed&&usesOptions?{originalPurchase:purchaseSnapshot}: {})};
  };
  function applicableDiscounts(sku){
    const settings=perDevice&&sku!==cfg.trialProductId?deviceDiscounts[sku]:undefined;
    let discount=settings?.discount,earlyUsdt=settings?.earlyUsdt;
    if(settings&&sku==='stellarbox-pro-v2'){
      if(state.trialDeviceDiscountState==='repriced')discount={ratePct:'5',capUsdt:'400'};
      if(state.trialDeviceDiscountState==='discount-follows')discount=undefined;
      if(state.trialDeviceDiscountState==='early-follows')earlyUsdt=undefined;
    }
    // Both inputs become millionths of one percent. The default wire value is a fraction.
    return {
      rate:discount?units(discount.ratePct):units(discountRate,8),
      cap:units(discount?.capUsdt??discountCapUSD),
      early:units(earlyUsdt??earlyPurchaseDiscountUSD)/10000n*10000n,
    };
  }
  function quoteFor(shadow,nex,inTerm,sku=cfg.trialProductId,priceUsdt=cfg.trialPriceUSD){
      const {rate,cap,early:discount}=applicableDiscounts(sku);
      const claim=row.claimConfig;
      const fullTermSnapshot=Number.isFinite(row.startedAt)&&Number(claim?.trialDays)>0
        &&Number(claim?.shadowDailyUSD)>0&&Number(claim?.shadowDailyNEX)>0&&Number(claim?.trialPriceUSD)>0
        &&(claim?.trialOffsetCapUSD===null||Number(claim?.trialOffsetCapUSD)>=0);
      const early=inTerm&&fullTermSnapshot,price=units(priceUsdt);
      const settled=early?max(units(cfg.shadowDailyUSD)*BigInt(cfg.trialDays),shadow):shadow;
      const reward=early?max(units(cfg.shadowDailyNEX)*BigInt(cfg.trialDays),nex):nex;
      const promo=min(price*rate/100000000n,cap);
      // Only real accrual offsets the price after promo; the rest of the settlement is paid out.
      const offset=min(capped(shadow,cfg.trialOffsetCapUSD),max(0n,price-promo)),baseDiscount=min(price,promo+offset);
      const base=max(0n,price-baseDiscount),earlyDiscount=early?min(discount,base):0n,amount=base-earlyDiscount;
      const settlementPolicy=early?'FULL_TERM_ON_CONVERSION':'ACCRUED_ON_CONVERSION';
      const terms=usesOptions
        ? [row.claimNo,sku,fixed(price),fixed(rate),fixed(cap),fixed(discount),cfg.trialOffsetCapUSD]
        : early?['ACCRUED_OFFSET',row.claimNo,...[settled,reward,promo].map(fixed),fixed(discount).slice(0,-4),cfg.trialOffsetCapUSD==null?'null':fixed(units(cfg.trialOffsetCapUSD))]:null;
      const quoteVersion=terms?settlementPolicy+':'+createHash('sha256').update(usesOptions?JSON.stringify(terms):terms.join('|')).digest('hex').slice(0,usesOptions?24:16):settlementPolicy;
      return {settlementPolicy,quoteVersion,earlyPurchase:early,priceUsdt:number(price),accruedUsdt:number(shadow),accruedNex:number(nex),
        settledUsdt:number(settled),rewardNex:number(reward),earlyRewardUsdt:number(settled-shadow),earlyRewardNex:number(reward-nex),
        offsetUsdt:number(offset),remainderUsdt:number(settled-offset),promoDiscountUsdt:number(promo),
        discountRate:fixed(rate),discountCapUsdt:fixed(cap),earlyDiscountConfiguredUsdt:number(discount),earlyDiscountUsdt:number(earlyDiscount),
        discountUsdt:number(baseDiscount+earlyDiscount),amountUsdt:number(amount),earlyEndsAtEpochMs:early?row.startedAt+duration:null,trialOffsetCapUSD:cfg.trialOffsetCapUSD};
  }

  function purchaseOption(item,isTrialProduct,current) {
    const device=isTrialProduct?trialDevice():trialPurchaseDevice(item);
    const priceUsdt=isTrialProduct?cfg.trialPriceUSD:item.price;
    const option={...device,inventoryMode:item?.inventoryMode??'FINITE',originalTrialProduct:isTrialProduct,
      paymentMethods:isTrialProduct?['WALLET','CREGIS_USDT_BSC','HDPAY_BANK']:['WALLET'],
      priceUsdt:fixed(units(priceUsdt)),...(isTrialProduct&&{storePriceUsdt:item?fixed(units(item.price)):null})};
    if(state.trialPurchaseOptionState==='image-missing'&&device.productNo===trialPurchaseOptionSku(state))option.imageUrl=null;
    const simulatedFailure=state.trialPurchaseOptionState==='quote-error'&&device.productNo===trialPurchaseOptionSku(state);
    const missingTerms=cfg.shadowDailyUSD==null||cfg.shadowDailyNEX==null;
    if(simulatedFailure||missingTerms)return {...option,canPurchase:false,unavailableReason:'TRIAL_PRODUCT_QUOTE_UNAVAILABLE'};
    const pricedAt=current.serverNowEpochMs,{shadow,nex}=accruedAt(pricedAt);
    const quote=quoteFor(shadow,nex,current.state==='ACTIVE',device.productNo,priceUsdt);
    let reasonCode=null;
    if(!item||item.status!=='active'||!item.available)reasonCode='PRODUCT_NOT_AVAILABLE';
    else if(state.trialConversionEnabled===false)reasonCode='TRIAL_KILL_SWITCH_DISABLED';
    else {
      try {
        requirePurchase(device.productNo,isTrialProduct);
      } catch(error) {
        if(!error.status)throw error;
        reasonCode=error.message;
      }
    }
    return {...option,canPurchase:!reasonCode,unavailableReason:reasonCode,quoteVersion:quote.quoteVersion,quote};
  }

  function extraProductNos() {
    if(perDevice)return Object.keys(deviceDiscounts).filter(sku=>sku!==cfg.trialProductId);
    const extraCount=state.trialPurchaseListState==='five'?4:state.trialPurchaseListState==='two'?1:0;
    return optionSku.filter(sku=>sku!==cfg.trialProductId).slice(0,extraCount);
  }

  function extraProducts() {
    return extraProductNos()
      .map(sku=>products.find(item=>item.id===sku))
      .filter(item=>item?.available&&item.status==='active'&&item.price>0)
      .sort((a,b)=>a.price-b.price);
  }

  // PR #26 projection: the redeemed trial names its order; a refund of that order ends the purchase and,
  // for full-term settlements, takes the trial rewards back.
  function conversionFacts(){
    let order=(state.createdOrders||[]).find(o=>o.orderNo===state.trialOrderNo);
    if(!order){
      // Panel presets reach REDEEMED without a convert command: quote the real accrual at conversion.
      const at=row.finishedAt||Math.min(row.startedAt+day,now-2*3600000),{shadow,nex}=accruedAt(at),quote=quoteFor(shadow,nex,at<row.startedAt+duration);
      row.finishedAt=at;
      order=conversionOrder('TRC-DEMO'+row.startedAt,at,quote);
      state.createdOrders??=[];state.createdOrders.unshift(order);state.trialOrderNo=order.orderNo;
    }
    if(mode==='refunded'&&order.canonicalStatus!=='refunded')Object.assign(order,{paymentStatus:'REFUNDED',orderStatus:'REFUNDED',activationStatus:'REFUNDED',canonicalStatus:'refunded',
      refundedAt:now-3600000,refundAmountUsdt:order.amountUsdt,refundChannel:'WALLET',refundBillNo:'E4-BILL-'+order.orderNo,refundReasonCode:'USER_REQUEST'});
    const refunded=order.canonicalStatus==='refunded';
    return {remainderUsdt:order.trialSettlement.rewardUsdt,conversionOrderNo:order.orderNo,conversionRefunded:refunded,
      conversionRewardsReversed:refunded&&order.trialSettlement.settlementPolicy==='FULL_TERM_ON_CONVERSION',
      ...(usesOptions&&{purchasedDevice:order.trialPurchasedDevice??trialDevice()})};
  }
  function conversionOrder(orderNo,at,quote,device=trialDevice()){
    const price=quote.priceUsdt,amount=quote.amountUsdt;
    const productIndex=products.findIndex(product=>product.id===device.productNo);
    const {productNo,name:productName,imageUrl}=device;
    const paidTotalUsdt=(Number((units(amount)+5000n)/10000n)/100).toFixed(2);
    // Wallet conversion has no payment record for the order-history method.
    return {orderNo,productId:productIndex+1,productNo,productName,trialClaimedDeviceName:cfg.trialProductName,
      ...(usesOptions&&{trialPurchasedDevice:device}),quantity:1,unitPriceUsdt:price,subtotalUsdt:price,
      discountUsdt:number(units(price)-units(amount)),amountUsdt:amount,paidTotalUsdt,paymentStatus:'PAID',orderStatus:'COMPLETED',activationStatus:'ACTIVATED',canonicalStatus:'activated',paymentMethod:'PENDING',placedAt:at,paidAt:at,activatedAt:at,orderType:'SINGLE',itemCount:1,dataCenter:'Singapore',
      lineItems:[{sku:productNo,name:productName,quantity:1,unitPriceUsdt:price,lineAmountUsdt:price,...(usesOptions&&{imageUrl})}],
      trialSettlement:{settlementPolicy:quote.settlementPolicy,promoDiscountUsdt:quote.promoDiscountUsdt,offsetUsdt:quote.offsetUsdt,earlyDiscountUsdt:quote.earlyDiscountUsdt,rewardUsdt:quote.remainderUsdt,rewardNex:quote.rewardNex}};
  }
  const key=request.headers?.()['idempotency-key']||request.headers?.()['Idempotency-Key'];
  if(url.pathname==='/api/trial/convert'&&request.method()==='POST'&&key&&state.trialCommands?.[key])return structuredClone(state.trialCommands[key]);
  const remember=value=>{if(key){state.trialCommands??={};state.trialCommands[key]=structuredClone(value);}return value;};
  if(url.pathname==='/api/trial/start'){
    if(state.trialStartPhaseClosed)refuse('TRIAL_PHASE_CLOSED');
    const current=snapshot();
    if(!current.canStart){
      if(current.eligibilityReason==='product-unavailable'){
        if(product?.available===false)refuse('TRIAL_PRODUCT_NOT_RELEASED');
        if(product?.stock>0&&!hasYield)refuse('TRIAL_DAILY_YIELD_INVALID');
        refuse('TRIAL_PRODUCT_NOT_AVAILABLE');
      }
      if(current.eligibilityReason==='capacity-full')refuse('TRIAL_CAPACITY_FULL');
      if(current.eligibilityReason==='in-progress')refuse('TRIAL_ALREADY_ACTIVE');
      if(current.eligibilityReason==='converted')refuse('TRIAL_ALREADY_REDEEMED');
      refuse('TRIAL_COOLDOWN_ACTIVE');
    }
    const body=request.postDataJSON();
    const requestedProduct=String(body.trialProductId??'').trim().toLowerCase();
    const matchesProduct=body.trialProductId==null
      ? typeof body.deviceName==='string'&&body.deviceName.trim()===unclaimedConfig.trialProductName
      : (requestedProduct==='device-trial-standard'?previewDefaultTrialSku:requestedProduct)===unclaimedConfig.trialProductId;
    if(!matchesProduct||(body.trialTermsVersion!=null&&body.trialTermsVersion!==trialTermsVersion))refuse('TRIAL_TERMS_CHANGED');
    cfg={...unclaimedConfig};
    duration=Number(cfg.trialDays)*day;grace=Number(cfg.graceDays)*day;
    Object.assign(row,{state:'ACTIVE',claimNo:newClaimNo(),startedAt:now,finishedAt:null,endReason:null,cooldownUntil:null,
      claimConfig:structuredClone(cfg),version:current.claimNo?(row.version??0)+1:0});
    return snapshot();
  }
  if(url.pathname==='/api/trial/cancel'){
    const purchase=originalPurchase();
    if(row.state!=='ACTIVE')refuse('TRIAL_NOT_CANCELLABLE');
    if(purchase?.kind==='EXTERNAL')refuse('TRIAL_EXTERNAL_PAYMENT_IN_PROGRESS',purchase);
    if(purchase?.kind==='BALANCE')refuse('TRIAL_BALANCE_SUBMISSION_IN_PROGRESS',purchase);
    Object.assign(row,{state:'CANCELLED',endReason:'cancelled',finishedAt:now,cooldownUntil:now+cooldown,version:(row.version??0)+1});
    return snapshot();
  }
  if(url.pathname==='/api/trial/purchase-options'){
    if(!usesOptions)refuse('RESOURCE_NOT_FOUND',null,404);
    if(state.trialPurchaseReadState==='error'&&!request.trialPurchaseSample)refuse('TRIAL_PURCHASE_OPTIONS_UNAVAILABLE',null,503);
    const current=snapshot();
    if(!liveStates.includes(current.state)||!current.claimNo||current.serverNowEpochMs>=conversionDeadline())refuse('TRIAL_NOT_CONVERTIBLE');
    const options=[purchaseOption(trialProduct(),true,current),...extraProducts().map(item=>purchaseOption(item,false,current))]
      .map(option=>option.quote?{...option,quote:wireTrialQuote(option.quote)}:option);
    return {claimNo:current.claimNo,serverTime:new Date(current.serverNowEpochMs).toISOString(),options};
  }
  if(url.pathname==='/api/trial/convert'){
    // An external payment settles the quote it was priced on (VerifiedPurchasePayment), with no wallet debit.
    const current=snapshot(),body=request.postDataJSON(),paid=request.verifiedPayment;
    const purchase=originalPurchase();
    if(!paid&&purchase&&!(purchase.kind==='BALANCE'&&purchase.commandKey===key&&request.acceptedTrialSubmissionNo===key))
      refuse(purchase.kind==='BALANCE'?'TRIAL_BALANCE_SUBMISSION_IN_PROGRESS':'TRIAL_EXTERNAL_PAYMENT_IN_PROGRESS',purchase);
    if(!liveStates.includes(current.state))refuse('TRIAL_NOT_CONVERTIBLE');
    const paidAt=paid?atTrialClock(paid.paidAt):current.serverNowEpochMs;
    if((paid&&paid.claimNo!==current.claimNo)||!Number.isFinite(paidAt)||paidAt>=conversionDeadline())refuse('TRIAL_NOT_CONVERTIBLE');
    if(usesOptions&&!paid&&!request.walletAuthorized)refuse('PAYMENT_PASSWORD_REQUIRED',null,422);
    const isTrialProduct=body.productNo===cfg.trialProductId;
    if(!usesOptions&&!isTrialProduct)refuse('TRIAL_PRODUCT_NOT_ELIGIBLE');
    if(!isTrialProduct&&paid)refuse('TRIAL_EXTERNAL_PAYMENT_METHOD_UNSUPPORTED');
    if(!paid&&body.paymentMethod&&body.paymentMethod!=='WALLET')
      refuse('REQUEST_BODY_INVALID',null,400);
    if(body.voucherId||body.promotionQuoteId||body.replacementDeviceId||(body.quantity!=null&&body.quantity!==1))
      refuse('TRIAL_KILL_SWITCH_DISABLED');
    if(usesOptions&&!isTrialProduct&&!extraProductNos().includes(body.productNo))refuse('TRIAL_PRODUCT_NOT_ELIGIBLE');
    const selectedProduct=products.find(item=>item.id===body.productNo);
    if(!isTrialProduct&&!selectedProduct)refuse('PRODUCT_NOT_AVAILABLE');
    const option=usesOptions&&!paid?purchaseOption(selectedProduct,isTrialProduct,current):null;
    if(option&&!option.canPurchase) {
      const reason=option.unavailableReason;
      if(isTrialProduct&&['PRODUCT_NOT_AVAILABLE','PRODUCT_OUT_OF_STOCK','PRODUCT_PRICE_INVALID'].includes(reason))
        refuse('TRIAL_PRODUCT_NOT_AVAILABLE');
      refuse(reason==='TRIAL_PRODUCT_QUOTE_UNAVAILABLE'?'TRIAL_DAILY_YIELD_INVALID':reason);
    }
    const quote=paid?paid.trialQuote:option?.quote??current.quote;
    if(!quote)refuse('TRIAL_NOT_CONVERTIBLE');
    const amount=quote.amountUsdt;
    // convert confirms cents, while the quote, debit and receipt retain six decimals.
    const expected=body.expectedAmountUsdt;
    if(typeof expected!=='number'||!Number.isFinite(expected)||expected<0||expected>1000000
      ||!/^\d+(?:\.\d{1,2})?$/.test(String(expected)))refuse('TRIAL_AMOUNT_INVALID');
    const changed=usesOptions?{claimNo:current.claimNo,productNo:body.productNo,quoteVersion:quote.quoteVersion,quote:wireTrialQuote(quote)}:null;
    if((usesOptions||body.quoteVersion)&&body.quoteVersion!==quote.quoteVersion) refuse('TRIAL_QUOTE_CHANGED',changed);
    if((units(amount)+5000n)/10000n>units(expected,2)) refuse('TRIAL_AMOUNT_MISMATCH',changed);
    const hardwareQuotaUsedAt=requirePurchase(body.productNo,isTrialProduct);
    if(!paid&&amount>0&&units(demoWalletUsdt(state))<units(amount))refuse('TRIAL_WALLET_INSUFFICIENT');
    const device=paid?paid.trialDeviceSnapshot:isTrialProduct?trialDevice():trialPurchaseDevice(selectedProduct);
    state.lastTrialConversion={productNo:body.productNo,expectedAmountUsdt:body.expectedAmountUsdt,quoteVersion:body.quoteVersion,serverQuoteVersion:quote.quoteVersion,amountUsdt:amount};
    const orderNo='TRC-DEMO'+now;
    if(!paid&&amount>0)postDemoWalletEntries(state,{bizNo:orderNo,bizType:'TRIAL_CHARGE',
      asset:'USDT',direction:'OUT',amount,at:now,category:'purchase'});
    if(quote.remainderUsdt>0)postDemoWalletEntries(state,{bizNo:orderNo+':REMAINDER',bizType:'TRIAL_BONUS',
      asset:'USDT',direction:'IN',amount:quote.remainderUsdt,at:now,category:'bonus'});
    if(quote.rewardNex>0)postDemoWalletEntries(state,{bizNo:orderNo+':NEX',bizType:'TRIAL_BONUS',
      asset:'UVT',direction:'IN',amount:quote.rewardNex,at:now,category:'bonus'});
    const order={...conversionOrder(orderNo,now,quote,device),inventoryUsedAt:now,hardwareQuotaUsedAt};
    if(paid)Object.assign(order,{paymentMethod:paid.paymentMethod,paymentNo:paid.intentNo,paidTotalUsdt:paid.totalUsdt,paidAt:paid.paidAt});
    state.createdOrders??=[];state.createdOrders.unshift(order);state.trialOrderNo=orderNo;
    Object.assign(row,{state:'REDEEMED',finishedAt:now,settlementAt:atTrialClock(now),version:(row.version??0)+1});
    delete state.trialBalancePurchase;
    delete state.trialBalanceCanResume;
    state.trialOriginalPurchaseState='none';
    const source='nx_trial_claim + nx_order + nx_order_item';
    const settled={amountUsdt:amount,discountUsdt:quote.discountUsdt,
      remainderUsdt:quote.remainderUsdt,rewardNex:quote.rewardNex,earlyRewardUsdt:quote.earlyRewardUsdt,
      earlyRewardNex:quote.earlyRewardNex,earlyDiscountUsdt:quote.earlyDiscountUsdt};
    return remember({...proof,orderNo,productNo:body.productNo,...settled,paymentStatus:'PAID',orderStatus:'PAID',
      ...(usesOptions&&{claimNo:current.claimNo,quoteVersion:quote.quoteVersion,shadowUsdt:quote.accruedUsdt,shadowNex:quote.accruedNex,
        offsetUsdt:quote.offsetUsdt,discountApplied:quote.promoDiscountUsdt,purchasedDevice:device,settlement:wireTrialQuote(quote),
        deviceId:now}),
      paymentRail:paid?.paymentMethod??'UVEL_USDT_WALLET',...(!paid&&{paidTotalUsdt:order.paidTotalUsdt}),
      settlementPolicy:quote.settlementPolicy,earlyPurchase:quote.earlyPurchase,source,provenance:{...proof,source}});
  }
  if(['/api/trial/state','/api/trial/eligibility'].includes(url.pathname)){
    const read=snapshot();
    if(request.pricingAt===undefined||!read.quote)return read;
    const at=atTrialClock(request.pricingAt),{shadow,nex}=accruedAt(at);
    return {...read,quote:quoteFor(shadow,nex,at<row.startedAt+duration)};
  }
}
