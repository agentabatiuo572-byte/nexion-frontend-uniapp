// Loopback-only lifecycle fixture. Never imported by src or an App build.
import { createHash } from 'node:crypto';
import { fixture } from './design-review-fixture.mjs';
// Match BigDecimal DOWN at the boundary; quote arithmetic stays in millionths.
const units=(value,scale=6)=>{const [whole,fraction='']=String(value).split('.');return BigInt(whole)*10n**BigInt(scale)+BigInt(fraction.padEnd(scale,'0').slice(0,scale)||'0');};
const number=value=>Number(value)/1e6;
const fixed=value=>`${value/1000000n}.${String(value%1000000n).padStart(6,'0')}`;
const min=(a,b)=>a<b?a:b,max=(a,b)=>a>b?a:b;
const capped=(amount,cap)=>String(cap??'').trim()===''?amount:min(amount,units(cap));
const day=86400000,proof={sourceEnvironment:'PRODUCTION',runId:'',serverCanonical:true};
const refuse=message=>{const error=new Error(message);error.status=409;throw error;};
export function trialDemo(url,locale,state,request,capacityFull,products){
  if(!url.pathname.startsWith('/api/trial/'))return undefined;
  const now=Date.now(),mode=state.trialState||'follow';
  const data=structuredClone(fixture(new URL('/api/trial/state',url.origin),locale,{offers:true},request));
  if(mode==='read-error')refuse('TRIAL_STATE_UNAVAILABLE');
  const cfg=data.config;
  cfg.shadowDailyUSD=String(products.find(product=>product.id===cfg.trialProductId).dailyEarn);
  // FEAT-TRIAL05 mirror of the Java quote: inside the original term the full claimed term is
  // settled and a fixed discount comes off what is left to pay; 0 switches the rule off.
  cfg.earlyPurchaseDiscountUSD??=String(state.trialEarlyDiscount??'10');
  // P-59 / backend B13-B14: the trial discount caps at $50; an empty offset cap is JSON null in App responses.
  cfg.discountCapUSD='50';cfg.trialOffsetCapUSD=null;
  const pricing=state.trialQuoteState||'default';
  // BUG-081 samples keep their labelled early prices through a zero offset cap;
  // settled earnings are paid out after purchase and use the same catalog rate as a default claim.
  const precision=['precision','half-cent','precision-repriced'].includes(pricing);
  if(pricing!=='default')Object.assign(cfg,{trialPriceUSD:pricing==='half-cent'?'402.135':precision?'402.123456':pricing==='excess-offset'?'25':'1000',shadowDailyNEX:'5',trialDays:'3',discountRate:pricing==='excess-offset'?'0':'0.15',earlyPurchaseDiscountUSD:pricing==='repriced'?'11':'10',trialOffsetCapUSD:pricing==='capped'?'20':precision?'0':null});
  // Repricing a confirmed precision quote changes live promo policy, never the claim's price or rates.
  if(pricing==='precision-repriced')cfg.discountCapUSD='49.999999';
  const unclaimedConfig=structuredClone(cfg);
  // Claimed rates, terms and prices are snapshots; only the live promo cap can be repriced.
  if(state.trialRow?.claimConfig)Object.assign(cfg,state.trialRow.claimConfig,{discountCapUSD:unclaimedConfig.discountCapUSD});
  let duration=Number(cfg.trialDays)*day,grace=Number(cfg.graceDays)*day;
  const scenario=mode==='follow'?(state.benefitState==='finished'?'converted':state.benefitState==='grace'?'grace':state.benefitState==='claimed'?'active':'available'):mode;
  if(!state.trialRow){
    const startedAt=now-(scenario==='final-day'?duration-day/2:scenario==='grace'?duration+day:scenario==='ended'?duration+grace+day:day);
    state.trialRow={state:['active','final-day'].includes(scenario)?'ACTIVE':scenario==='grace'?'GRACE':['ended','eligible-again'].includes(scenario)?'FAILED':['converted','refunded'].includes(scenario)?'REDEEMED':'ELIGIBLE',startedAt};
    if(state.trialRow.state!=='ELIGIBLE')state.trialRow.claimConfig=structuredClone(cfg);
  }
  const row=state.trialRow;
  function accruedAt(at){
    const days=min(BigInt(Math.max(0,Math.floor((at-row.startedAt)/1000)))*100000000n/86400n,BigInt(cfg.trialDays)*100000000n);
    return {shadow:units(cfg.shadowDailyUSD)*days/100000000n,nex:units(cfg.shadowDailyNEX)*days/100000000n};
  }
  const snapshot=()=>{
    if(row.state==='ACTIVE'&&now>=row.startedAt+duration)row.state='GRACE';
    if(row.state==='GRACE'&&now>=row.startedAt+duration+grace)row.state='FAILED';
    const claimed=row.state!=='ELIGIBLE',live=['ACTIVE','GRACE'].includes(row.state);
    const conversion=row.state==='REDEEMED'?conversionFacts():null;
    const {shadow,nex}=claimed?accruedAt(row.state==='REDEEMED'?row.finishedAt:now):{shadow:0n,nex:0n};
    const eligible=!claimed||(mode==='eligible-again'&&row.state==='FAILED');
    // capacity-full comes from the fleet facts alone; the capacity-full preset seeds a genuinely full fleet.
    const canStart=eligible&&!capacityFull;
    const quote=live?quoteFor(shadow,nex,row.state==='ACTIVE'&&now<row.startedAt+duration):undefined;
    return {...data,state:row.state,canStart,eligibilityReason:eligible&&capacityFull?'capacity-full':!canStart?(row.state==='REDEEMED'?'converted':live?'in-progress':'used'):undefined,
      claimNo:claimed?'DEMO-TRIAL':null,version:row.version||1,serverNowEpochMs:now,
      claimedAtEpochMs:claimed?row.startedAt:null,expiresAtEpochMs:claimed?row.startedAt+duration:null,graceEndsAtEpochMs:claimed?row.startedAt+duration+grace:null,
      finishedAtEpochMs:['FAILED','CANCELLED','REDEEMED'].includes(row.state)?row.finishedAt||row.startedAt+duration+grace:null,
      shadowUsdt:number(shadow),shadowNex:number(nex),
      offsetUsdt:quote?.offsetUsdt??0,remainderUsdt:quote?.remainderUsdt??0,priceUsdt:Number(cfg.trialPriceUSD),...(quote?{quote}:{}),...(conversion||{})};
  };
  function quoteFor(shadow,nex,inTerm){
      const discount=units(cfg.earlyPurchaseDiscountUSD)/10000n*10000n;
      const early=inTerm&&discount>0n,price=units(cfg.trialPriceUSD);
      const settled=early?max(units(cfg.shadowDailyUSD)*BigInt(cfg.trialDays),shadow):shadow;
      const reward=early?max(units(cfg.shadowDailyNEX)*BigInt(cfg.trialDays),nex):nex;
      const rate=units(cfg.discountRate,8),normalizedRate=rate>100000000n?rate/100n:rate;
      const promo=capped(price*normalizedRate/100000000n,cfg.discountCapUSD);
      // Only real accrual offsets the price after promo; the rest of the settlement is paid out.
      const offset=min(capped(shadow,cfg.trialOffsetCapUSD),max(0n,price-promo)),baseDiscount=min(price,promo+offset);
      const base=max(0n,price-baseDiscount),earlyDiscount=early?min(discount,base):0n,amount=base-earlyDiscount;
      const settlementPolicy=early?'FULL_TERM_ON_CONVERSION':'ACCRUED_ON_CONVERSION';
      const quoteVersion=early?settlementPolicy+':'+createHash('sha256').update(['ACCRUED_OFFSET','DEMO-TRIAL',...[settled,reward,promo].map(fixed),fixed(discount).slice(0,-4),cfg.trialOffsetCapUSD==null?'null':fixed(units(cfg.trialOffsetCapUSD))].join('|')).digest('hex').slice(0,16):settlementPolicy;
      return {settlementPolicy,quoteVersion,earlyPurchase:early,priceUsdt:number(price),accruedUsdt:number(shadow),accruedNex:number(nex),
        settledUsdt:number(settled),rewardNex:number(reward),earlyRewardUsdt:number(settled-shadow),earlyRewardNex:number(reward-nex),
        offsetUsdt:number(offset),remainderUsdt:number(settled-offset),promoDiscountUsdt:number(promo),earlyDiscountConfiguredUsdt:number(discount),earlyDiscountUsdt:number(earlyDiscount),
        discountUsdt:number(baseDiscount+earlyDiscount),amountUsdt:number(amount),earlyEndsAtEpochMs:early?row.startedAt+duration:null,trialOffsetCapUSD:cfg.trialOffsetCapUSD};
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
    return {remainderUsdt:order.trialSettlement.rewardUsdt,conversionOrderNo:order.orderNo,conversionRefunded:refunded,conversionRewardsReversed:refunded&&order.trialSettlement.settlementPolicy==='FULL_TERM_ON_CONVERSION'};
  }
  function conversionOrder(orderNo,at,quote){
    const price=Number(cfg.trialPriceUSD),amount=quote.amountUsdt;
    return {orderNo,productId:1,productNo:cfg.trialProductId,productName:cfg.trialProductName,quantity:1,unitPriceUsdt:price,subtotalUsdt:price,discountUsdt:number(units(price)-units(amount)),amountUsdt:amount,paymentStatus:'PAID',orderStatus:'COMPLETED',activationStatus:'ACTIVATED',canonicalStatus:'activated',paymentMethod:'WALLET',placedAt:at,paidAt:at,activatedAt:at,orderType:'SINGLE',itemCount:1,dataCenter:'Singapore',
      lineItems:[{sku:cfg.trialProductId,name:cfg.trialProductName,quantity:1,unitPriceUsdt:price,lineAmountUsdt:price}],
      trialSettlement:{settlementPolicy:quote.settlementPolicy,promoDiscountUsdt:quote.promoDiscountUsdt,offsetUsdt:quote.offsetUsdt,earlyDiscountUsdt:quote.earlyDiscountUsdt,rewardUsdt:quote.remainderUsdt,rewardNex:quote.rewardNex}};
  }
  const key=request.headers?.()['idempotency-key']||request.headers?.()['Idempotency-Key'];
  if(request.method()==='POST'&&key&&state.trialCommands?.[key])return structuredClone(state.trialCommands[key]);
  const remember=value=>{if(key){state.trialCommands??={};state.trialCommands[key]=structuredClone(value);}return value;};
  if(url.pathname==='/api/trial/start'){
    if(mode==='claim-error'&&!state.trialStartFailed){state.trialStartFailed=true;refuse('TRIAL_SERVICE_UNAVAILABLE');}
    if(snapshot().eligibilityReason==='capacity-full')refuse('TRIAL_CAPACITY_FULL');
    if(snapshot().canStart){
      Object.assign(cfg,unclaimedConfig);
      duration=Number(cfg.trialDays)*day;grace=Number(cfg.graceDays)*day;
      Object.assign(row,{state:'ACTIVE',startedAt:now,claimConfig:structuredClone(cfg),version:(row.version||1)+1});
    }
    return remember(snapshot());
  }
  if(url.pathname==='/api/trial/cancel'){
    if(row.state!=='ACTIVE')refuse('TRIAL_NOT_CANCELLABLE');
    Object.assign(row,{state:'CANCELLED',finishedAt:now,version:(row.version||1)+1});return remember(snapshot());
  }
  if(url.pathname==='/api/trial/convert'){
    // An external payment settles the quote it was priced on (VerifiedPurchasePayment), with no wallet debit.
    const current=snapshot(),body=request.postDataJSON(),paid=request.verifiedPayment;
    if(!['ACTIVE','GRACE'].includes(row.state))refuse('TRIAL_NOT_CONVERTIBLE');
    const pricedAt=paid?.pricingAt??now,{shadow:pricedShadow,nex:pricedNex}=accruedAt(pricedAt);
    const quote=paid?quoteFor(pricedShadow,pricedNex,pricedAt<row.startedAt+duration):current.quote,amount=quote.amountUsdt;
    if(body.productNo!==cfg.trialProductId)refuse('TRIAL_PRODUCT_NOT_ELIGIBLE');
    // convert confirms cents, while the quote, debit and receipt retain six decimals.
    const expected=body.expectedAmountUsdt;
    if(typeof expected!=='number'||!Number.isFinite(expected)||expected<0||expected>1000000
      ||!/^\d+(?:\.\d{1,2})?$/.test(String(expected)))refuse('TRIAL_AMOUNT_INVALID');
    if((units(amount)+5000n)/10000n>units(expected,2))refuse('TRIAL_AMOUNT_MISMATCH');
    if(body.quoteVersion&&body.quoteVersion!==quote.quoteVersion)refuse('TRIAL_QUOTE_CHANGED');
    state.lastTrialConversion={productNo:body.productNo,expectedAmountUsdt:body.expectedAmountUsdt,quoteVersion:body.quoteVersion,serverQuoteVersion:quote.quoteVersion,amountUsdt:amount};
    if(!paid&&(state.walletBalance??52800.64)<amount)refuse('TRIAL_WALLET_INSUFFICIENT');
    const orderNo='TRC-DEMO'+now;
    state.walletBalance=number(units(state.walletBalance??52800.64)-(paid?0n:units(amount))+units(quote.remainderUsdt));
    state.createdOrders??=[];state.createdOrders.unshift({...conversionOrder(orderNo,now,quote),...(paid&&{paymentMethod:paid.paymentMethod,paymentNo:paid.intentNo,paidTotalUsdt:paid.totalUsdt,paidAt:paid.paidAt})});state.trialOrderNo=orderNo;
    Object.assign(row,{state:'REDEEMED',finishedAt:now,version:(row.version||1)+1});
    const source='nx_trial_claim + nx_order + nx_order_item';
    return remember({...proof,orderNo,productNo:cfg.trialProductId,amountUsdt:amount,discountUsdt:number(units(current.priceUsdt)-units(amount)),paymentStatus:'PAID',orderStatus:'PAID',
      settlementPolicy:quote.settlementPolicy,earlyPurchase:quote.earlyPurchase,remainderUsdt:quote.remainderUsdt,rewardNex:quote.rewardNex,
      earlyRewardUsdt:quote.earlyRewardUsdt,earlyRewardNex:quote.earlyRewardNex,earlyDiscountUsdt:quote.earlyDiscountUsdt,source,provenance:{...proof,source}});
  }
  if(['/api/trial/state','/api/trial/eligibility'].includes(url.pathname)){
    const read=snapshot();
    if(request.pricingAt===undefined||!read.quote)return read;
    const {shadow,nex}=accruedAt(request.pricingAt);
    return {...read,quote:quoteFor(shadow,nex,request.pricingAt<row.startedAt+duration)};
  }
}
