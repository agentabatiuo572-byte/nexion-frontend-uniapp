import { demoWalletUsdt, postDemoWalletEntries } from './prototype-demo-wallet.mjs';
// Loopback-only lifecycle fixture. Never imported by src or an App build.
import { createHash } from 'node:crypto';
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
const refuse=(message,data,status=409)=>{throw Object.assign(new Error(message),{status,data});};
const rejectPurchase=(reasonCode,details)=>refuse(reasonCode,{reasonCode,...details});
const optionSku=['stellarrack-p1','cloud-share','stellarbox-pro','stellarbox-pro-v2','stellarbox-s1','stellarrack-p2'];
const purchaseLimits={
  PRODUCT_OUT_OF_STOCK:'TRIAL_PRODUCT_SOLD_OUT',
  PURCHASE_GATE_SOLD_OUT:'TRIAL_PRODUCT_QUOTA_EXHAUSTED',
  ORDER_MONTHLY_QUOTA_EXHAUSTED:'TRIAL_PRODUCT_QUOTA_EXHAUSTED',
  PURCHASE_GATE_NOT_MET:'TRIAL_PRODUCT_REQUIREMENTS_NOT_MET',
  ORDER_MONTHLY_QUOTA_REQUIREMENTS_NOT_MET:'TRIAL_PRODUCT_REQUIREMENTS_NOT_MET',
  PRODUCT_NOT_RELEASED:'TRIAL_PRODUCT_REMOVED',
  ORDER_MONTHLY_QUOTA_PAUSED:'TRIAL_PURCHASE_UNAVAILABLE',
};
export const trialPurchaseOptionSku=state=>state.trialPurchaseOptionTarget==='trial-device'
  ? state.trialRow?.claimConfig?.trialProductId??(state.catalogState==='trial-h2-switched'?'stellarbox-pro':previewDefaultTrialSku) : 'stellarrack-p1';
export const trialPurchaseOptionsEnabled=state=>state.trialPurchaseReadState!=='unsupported';
export const trialPurchaseDevice=(product,productName=product.name)=>({
  productNo:product.id,productName,productType:product.productType,imageUrl:product.imageUrl??null,
});
const wireQuote=quote=>Object.fromEntries(Object.entries(quote).map(([key,value])=>
  typeof value==='number'&&/(Usdt|Nex)$/.test(key)?[key,fixed(units(value))]:[key,value]));

export function trialDemo(url,locale,state,request,capacityFull,products,requirePurchase){
  if(!url.pathname.startsWith('/api/trial/'))return undefined;
  const now=Date.now(),mode=state.trialState||'follow';
  const data=structuredClone(fixture(new URL('/api/trial/state',url.origin),locale,{offers:true},request));
  const switched=state.catalogState==='trial-h2-switched';
  const originalProduct=products.find(product=>product.id===previewDefaultTrialSku);
  const product=switched?products.find(product=>product.id==='stellarbox-pro'):originalProduct;
  const hasYield=product?.dailyEarn>0&&product.dailyEarnNEX>0;
  const available=hasYield&&product.available&&product.productType==='DEVICE'&&product.inventoryMode==='FINITE'&&product.stock>0;
  const unclaimedConfig=Object.assign(data.config,product&&previewTrialProductConfig(product));
  if(!hasYield){
    unclaimedConfig.shadowDailyUSD=null;
    unclaimedConfig.shadowDailyNEX=null;
  }
  // FEAT-TRIAL05 mirror of the Java quote: inside the original term the full claimed term is
  // settled and a fixed discount comes off what is left to pay; 0 switches the rule off.
  unclaimedConfig.earlyPurchaseDiscountUSD??=String(state.trialEarlyDiscount??'10');
  // P-59 / backend B13-B14: the trial discount caps at $50; an empty offset cap is JSON null in App responses.
  unclaimedConfig.discountCapUSD='50';unclaimedConfig.trialOffsetCapUSD=null;
  const pricing=state.trialQuoteState||'default';
  // BUG-081 samples keep their labelled early prices through a zero offset cap;
  // settled earnings are paid out after purchase and use the same catalog rate as a default claim.
  const precision=['precision','half-cent','precision-repriced'].includes(pricing);
  if(!['default','historical-cap'].includes(pricing))Object.assign(unclaimedConfig,{trialDays:'3',discountRate:pricing==='excess-offset'?'0':'0.15',earlyPurchaseDiscountUSD:pricing==='repriced'?'11':'10',trialOffsetCapUSD:pricing==='capped'?'20':precision?'0':null});
  // Repricing a confirmed precision quote changes live promo policy, never the claim's price or rates.
  if(pricing==='precision-repriced')unclaimedConfig.discountCapUSD='49.999999';
  const scenario=!available?'available':mode==='follow'?(state.benefitState==='finished'?'converted':state.benefitState==='grace'?'grace':state.benefitState==='claimed'?'active':'available'):mode;
  if(!state.trialRow){
    const claimConfig={...unclaimedConfig};
    // The H2 switch can open on an account that claimed S1 before its catalog rename.
    if(switched&&originalProduct)Object.assign(claimConfig,previewTrialProductConfig({...originalProduct,name:previewDefaultTrialName}));
    const duration=Number(claimConfig.trialDays)*day,grace=Number(claimConfig.graceDays)*day;
    const cooldown=scenario==='eligible-again'?30*day:0;
    const ended=['ended','eligible-again'].includes(scenario);
    const startedAt=now-(scenario==='final-day'?duration-day/2:scenario==='grace'?duration+day:ended?duration+grace+cooldown+day:day);
    state.trialRow={state:['active','final-day'].includes(scenario)?'ACTIVE':scenario==='grace'?'GRACE':ended?'FAILED':['converted','refunded'].includes(scenario)?'REDEEMED':'ELIGIBLE',startedAt};
    if(cooldown)state.trialRow.cooldownUntil=startedAt+duration+grace+cooldown;
    // B13: this preset was claimed under the former 50 USDT cap; new claims use today's null cap.
    if(state.trialRow.state!=='ELIGIBLE'){
      if(pricing==='historical-cap'&&['ACTIVE','GRACE','REDEEMED'].includes(state.trialRow.state))claimConfig.trialOffsetCapUSD='50';
      state.trialRow.claimConfig=claimConfig;
    }
  }
  const row=state.trialRow;
  // Historical terms still determine accrual and lifecycle dates. Only the live promo cap can be repriced.
  let cfg={...unclaimedConfig,...row.claimConfig,discountCapUSD:unclaimedConfig.discountCapUSD};
  let duration=Number(cfg.trialDays)*day,grace=Number(cfg.graceDays)*day;
  const usesOptions=trialPurchaseOptionsEnabled(state);
  const trialProduct=()=>products.find(item=>item.id===cfg.trialProductId);
  const atTrialClock=at=>at+(state.trialPurchaseWindow==='grace'&&liveStates.includes(row.state)
    ? row.startedAt+duration+day-now : 0);
  const originalPurchase=()=>request.originalTrialPurchase?.()??state.trialBalancePurchase;
  const trialDevice=()=>trialPurchaseDevice(trialProduct()??{
    id:cfg.trialProductId,productType:'DEVICE',imageUrl:null,
  },cfg.trialProductName);
  function accruedAt(at){
    const days=min(BigInt(Math.max(0,Math.floor((at-row.startedAt)/1000)))*100000000n/86400n,BigInt(cfg.trialDays)*100000000n);
    return {shadow:units(cfg.shadowDailyUSD)*days/100000000n,nex:units(cfg.shadowDailyNEX)*days/100000000n};
  }
  const snapshot=()=>{
    if(row.state==='ACTIVE'&&now>=row.startedAt+duration)row.state='GRACE';
    if(row.state==='GRACE'&&now>=row.startedAt+duration+grace)row.state='FAILED';
    const trialNow=atTrialClock(now);
    const reportedState=liveStates.includes(row.state)&&trialNow>=row.startedAt+duration?'GRACE':row.state;
    const claimed=row.state!=='ELIGIBLE',live=liveStates.includes(row.state);
    const conversion=row.state==='REDEEMED'?conversionFacts():null;
    const {shadow,nex}=claimed?accruedAt(row.state==='REDEEMED'?row.settlementAt??row.finishedAt:trialNow):{shadow:0n,nex:0n};
    const eligible=!claimed||(row.state==='FAILED'&&row.cooldownUntil!=null&&row.cooldownUntil<=now);
    // capacity-full comes from the fleet facts alone; the capacity-full preset seeds a genuinely full fleet.
    const canStart=eligible&&available&&!capacityFull;
    const quote=live?quoteFor(shadow,nex,reportedState==='ACTIVE'):undefined;
    const purchase=live&&usesOptions?originalPurchase():null;
    const purchaseSnapshot=purchase?.kind==='EXTERNAL'
      ? {...purchase,expiresAt:new Date(atTrialClock(Date.parse(purchase.expiresAt))).toISOString()} : purchase;
    return {...data,config:live||row.state==='REDEEMED'?cfg:unclaimedConfig,state:reportedState,canStart,eligibilityReason:eligible&&!available?'product-unavailable':eligible&&capacityFull?'capacity-full':!canStart?(row.state==='REDEEMED'?'converted':live?'in-progress':'used'):undefined,
      claimNo:claimed?'DEMO-TRIAL':null,version:row.version||1,serverNowEpochMs:trialNow,
      claimedAtEpochMs:claimed?row.startedAt:null,expiresAtEpochMs:claimed?row.startedAt+duration:null,graceEndsAtEpochMs:claimed?row.startedAt+duration+grace:null,
      finishedAtEpochMs:['FAILED','CANCELLED','REDEEMED'].includes(row.state)?row.finishedAt||row.startedAt+duration+grace:null,
      cooldownUntilEpochMs:row.cooldownUntil??null,
      shadowUsdt:number(shadow),shadowNex:number(nex),
      offsetUsdt:quote?.offsetUsdt??0,remainderUsdt:quote?.remainderUsdt??0,priceUsdt:Number(cfg.trialPriceUSD),
      ...(quote?{quote}:{}),...(conversion||{}),...(purchaseSnapshot?{originalPurchase:purchaseSnapshot}:{})};
  };
  function quoteFor(shadow,nex,inTerm,sku=cfg.trialProductId,priceUsdt=cfg.trialPriceUSD){
      const discount=units(cfg.earlyPurchaseDiscountUSD)/10000n*10000n;
      const early=inTerm&&discount>0n,price=units(priceUsdt);
      const settled=early?max(units(cfg.shadowDailyUSD)*BigInt(cfg.trialDays),shadow):shadow;
      const reward=early?max(units(cfg.shadowDailyNEX)*BigInt(cfg.trialDays),nex):nex;
      const rate=units(cfg.discountRate,8),normalizedRate=rate>100000000n?rate/100n:rate;
      const promo=capped(price*normalizedRate/100000000n,cfg.discountCapUSD);
      // Only real accrual offsets the price after promo; the rest of the settlement is paid out.
      const offset=min(capped(shadow,cfg.trialOffsetCapUSD),max(0n,price-promo)),baseDiscount=min(price,promo+offset);
      const base=max(0n,price-baseDiscount),earlyDiscount=early?min(discount,base):0n,amount=base-earlyDiscount;
      const settlementPolicy=early?'FULL_TERM_ON_CONVERSION':'ACCRUED_ON_CONVERSION';
      const terms=usesOptions
        ? [row.startedAt,sku,fixed(price),cfg.discountRate,cfg.discountCapUSD,cfg.earlyPurchaseDiscountUSD,cfg.trialOffsetCapUSD]
        : early?['ACCRUED_OFFSET','DEMO-TRIAL',...[settled,reward,promo].map(fixed),fixed(discount).slice(0,-4),cfg.trialOffsetCapUSD==null?'null':fixed(units(cfg.trialOffsetCapUSD))]:null;
      const quoteVersion=terms?settlementPolicy+':'+createHash('sha256').update(usesOptions?JSON.stringify(terms):terms.join('|')).digest('hex').slice(0,16):settlementPolicy;
      return {settlementPolicy,quoteVersion,earlyPurchase:early,priceUsdt:number(price),accruedUsdt:number(shadow),accruedNex:number(nex),
        settledUsdt:number(settled),rewardNex:number(reward),earlyRewardUsdt:number(settled-shadow),earlyRewardNex:number(reward-nex),
        offsetUsdt:number(offset),remainderUsdt:number(settled-offset),promoDiscountUsdt:number(promo),earlyDiscountConfiguredUsdt:number(discount),earlyDiscountUsdt:number(earlyDiscount),
        discountUsdt:number(baseDiscount+earlyDiscount),amountUsdt:number(amount),earlyEndsAtEpochMs:early?row.startedAt+duration:null,trialOffsetCapUSD:cfg.trialOffsetCapUSD};
  }

  function purchaseOption(item,isTrialProduct,current) {
    const device=isTrialProduct?trialDevice():trialPurchaseDevice(item);
    const priceUsdt=isTrialProduct?cfg.trialPriceUSD:item.price;
    const option={...device,inventoryMode:item?.inventoryMode??'FINITE',visible:true,isTrialProduct,
      priceUsdt:fixed(units(priceUsdt)),...(isTrialProduct&&{marketPriceUsdt:item?fixed(units(item.price)):null})};
    const simulatedFailure=state.trialPurchaseOptionState==='quote-error'&&device.productNo===trialPurchaseOptionSku(state);
    const missingTerms=cfg.shadowDailyUSD==null||cfg.shadowDailyNEX==null;
    if(simulatedFailure||missingTerms)return {...option,canBuy:false,reasonCode:'TRIAL_OPTION_QUOTE_UNAVAILABLE'};
    const pricedAt=current.serverNowEpochMs,{shadow,nex}=accruedAt(pricedAt);
    const quote=quoteFor(shadow,nex,current.state==='ACTIVE',device.productNo,priceUsdt);
    let reasonCode=null;
    if(!item||item.status!=='active'||!item.available)reasonCode='TRIAL_PRODUCT_REMOVED';
    else if(state.trialConversionEnabled===false)reasonCode='TRIAL_PURCHASE_UNAVAILABLE';
    else {
      try {
        requirePurchase(device.productNo,isTrialProduct);
      } catch(error) {
        if(!error.status)throw error;
        reasonCode=purchaseLimits[error.message]??'TRIAL_PURCHASE_UNAVAILABLE';
      }
    }
    return {...option,canBuy:!reasonCode,reasonCode,quote};
  }

  function extraProducts() {
    const extraCount=state.trialPurchaseListState==='five'?4:state.trialPurchaseListState==='two'?1:0;
    return optionSku.filter(sku=>sku!==cfg.trialProductId).slice(0,extraCount)
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
    const {productNo,productName,imageUrl}=device;
    const paidTotalUsdt=(Number((units(amount)+5000n)/10000n)/100).toFixed(2);
    // Wallet conversion has no payment record for the order-history method.
    return {orderNo,productId:productIndex+1,productNo,productName,trialClaimedDeviceName:cfg.trialProductName,
      ...(usesOptions&&{trialPurchasedDevice:device}),quantity:1,unitPriceUsdt:price,subtotalUsdt:price,
      discountUsdt:number(units(price)-units(amount)),amountUsdt:amount,paidTotalUsdt,paymentStatus:'PAID',orderStatus:'COMPLETED',activationStatus:'ACTIVATED',canonicalStatus:'activated',paymentMethod:'PENDING',placedAt:at,paidAt:at,activatedAt:at,orderType:'SINGLE',itemCount:1,dataCenter:'Singapore',
      lineItems:[{sku:productNo,name:productName,quantity:1,unitPriceUsdt:price,lineAmountUsdt:price,...(usesOptions&&{imageUrl})}],
      trialSettlement:{settlementPolicy:quote.settlementPolicy,promoDiscountUsdt:quote.promoDiscountUsdt,offsetUsdt:quote.offsetUsdt,earlyDiscountUsdt:quote.earlyDiscountUsdt,rewardUsdt:quote.remainderUsdt,rewardNex:quote.rewardNex}};
  }
  const key=request.headers?.()['idempotency-key']||request.headers?.()['Idempotency-Key'];
  if(request.method()==='POST'&&key&&state.trialCommands?.[key])return structuredClone(state.trialCommands[key]);
  const remember=value=>{if(key){state.trialCommands??={};state.trialCommands[key]=structuredClone(value);}return value;};
  if(url.pathname==='/api/trial/start'){
    if(mode==='claim-error'&&!state.trialStartFailed){state.trialStartFailed=true;refuse('TRIAL_SERVICE_UNAVAILABLE');}
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
    cfg={...unclaimedConfig};
    duration=Number(cfg.trialDays)*day;grace=Number(cfg.graceDays)*day;
    Object.assign(row,{state:'ACTIVE',startedAt:now,cooldownUntil:null,claimConfig:structuredClone(cfg),version:(row.version||1)+1});
    return remember(snapshot());
  }
  if(url.pathname==='/api/trial/cancel'){
    const purchase=originalPurchase();
    if(row.state!=='ACTIVE')refuse('TRIAL_NOT_CANCELLABLE');
    if(purchase?.kind==='EXTERNAL'||purchase?.status==='PROCESSING')refuse('TRIAL_EXTERNAL_PAYMENT_IN_PROGRESS');
    Object.assign(row,{state:'CANCELLED',finishedAt:now,version:(row.version||1)+1});return remember(snapshot());
  }
  if(url.pathname==='/api/trial/purchase-options'){
    if(!usesOptions)refuse('TRIAL_PURCHASE_OPTIONS_NOT_SUPPORTED',null,404);
    if(state.trialPurchaseReadState==='error'&&!request.trialPurchaseSample)refuse('TRIAL_PURCHASE_OPTIONS_UNAVAILABLE',null,503);
    const current=snapshot();
    if(!liveStates.includes(current.state)||!current.claimNo)rejectPurchase('TRIAL_NOT_CONVERTIBLE');
    const options=[purchaseOption(trialProduct(),true,current),...extraProducts().map(item=>purchaseOption(item,false,current))]
      .map(option=>option.quote?{...option,quote:wireQuote(option.quote)}:option);
    return {claimNo:current.claimNo,serverTime:new Date(current.serverNowEpochMs).toISOString(),options};
  }
  if(url.pathname==='/api/trial/convert'){
    // An external payment settles the quote it was priced on (VerifiedPurchasePayment), with no wallet debit.
    const current=snapshot(),body=request.postDataJSON(),paid=request.verifiedPayment;
    const deny=usesOptions?rejectPurchase:refuse;
    const purchase=originalPurchase();
    if(!paid&&purchase&&!(purchase.kind==='BALANCE'&&purchase.status==='RESUMABLE'&&purchase.submissionNo===key))
      deny('TRIAL_EXISTING_PURCHASE',{originalPurchase:purchase});
    if(!liveStates.includes(current.state))deny('TRIAL_NOT_CONVERTIBLE');
    if(usesOptions&&!paid&&!request.walletAuthorized)refuse('PAYMENT_PASSWORD_REQUIRED',null,422);
    const isTrialProduct=body.productNo===cfg.trialProductId;
    if(!usesOptions&&!isTrialProduct)refuse('TRIAL_PRODUCT_NOT_ELIGIBLE');
    if(!isTrialProduct&&paid)deny('TRIAL_BALANCE_ONLY');
    if(!paid&&body.paymentMethod&&body.paymentMethod!=='UVEL_USDT_WALLET')
      deny(isTrialProduct?'TRIAL_PURCHASE_UNAVAILABLE':'TRIAL_BALANCE_ONLY');
    if(body.voucherId||body.promotionQuoteId||body.replacementDeviceId||(body.quantity!=null&&body.quantity!==1))
      deny('TRIAL_PURCHASE_UNAVAILABLE');
    const selectedProduct=isTrialProduct?trialProduct():extraProducts().find(item=>item.id===body.productNo);
    if(usesOptions&&!isTrialProduct&&!selectedProduct)deny('TRIAL_PRODUCT_REMOVED');
    const option=usesOptions&&!paid?purchaseOption(selectedProduct,isTrialProduct,current):null;
    if(option&&!option.canBuy)deny(option.reasonCode==='TRIAL_OPTION_QUOTE_UNAVAILABLE'?'TRIAL_PURCHASE_UNAVAILABLE':option.reasonCode);
    let quote=option?.quote??current.quote;
    if(paid){
      const pricedAt=atTrialClock(paid.pricingAt);
      const {shadow,nex}=accruedAt(pricedAt);
      quote=quoteFor(shadow,nex,pricedAt<row.startedAt+duration);
    }
    const amount=quote.amountUsdt;
    // convert confirms cents, while the quote, debit and receipt retain six decimals.
    const expected=body.expectedAmountUsdt;
    if(typeof expected!=='number'||!Number.isFinite(expected)||expected<0||expected>1000000
      ||!/^\d+(?:\.\d{1,2})?$/.test(String(expected)))refuse('TRIAL_AMOUNT_INVALID');
    if((usesOptions||body.quoteVersion)&&body.quoteVersion!==quote.quoteVersion)
      deny('TRIAL_QUOTE_CHANGED',{quote:wireQuote(quote)});
    if((units(amount)+5000n)/10000n>units(expected,2)) {
      if(usesOptions)deny('TRIAL_QUOTE_CHANGED',{quote:wireQuote(quote)});
      refuse('TRIAL_AMOUNT_MISMATCH');
    }
    const hardwareQuotaUsedAt=requirePurchase(body.productNo,isTrialProduct);
    if(!paid&&amount>0&&units(demoWalletUsdt(state))<units(amount))deny('TRIAL_WALLET_INSUFFICIENT');
    const device=isTrialProduct?trialDevice():trialPurchaseDevice(selectedProduct);
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
    Object.assign(row,{state:'REDEEMED',finishedAt:now,settlementAt:atTrialClock(now),version:(row.version||1)+1});
    delete state.trialBalancePurchase;
    state.trialOriginalPurchaseState='none';
    const source='nx_trial_claim + nx_order + nx_order_item';
    const settled={amountUsdt:amount,discountUsdt:quote.discountUsdt,
      remainderUsdt:quote.remainderUsdt,rewardNex:quote.rewardNex,earlyRewardUsdt:quote.earlyRewardUsdt,
      earlyRewardNex:quote.earlyRewardNex,earlyDiscountUsdt:quote.earlyDiscountUsdt};
    return remember({...proof,orderNo,productNo:body.productNo,...(usesOptions?wireQuote(settled):settled),paymentStatus:'PAID',orderStatus:'PAID',
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
