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
export function trialDemo(url,locale,state,request,capacityFull){
  if(!url.pathname.startsWith('/api/trial/'))return undefined;
  const now=Date.now(),mode=state.trialState||'follow';
  const data=structuredClone(fixture(new URL('/api/trial/state',url.origin),locale,{offers:true},request));
  if(mode==='read-error')refuse('TRIAL_STATE_UNAVAILABLE');
  const cfg=data.config;
  // FEAT-TRIAL05 mirror of the Java quote: inside the original term the full claimed term is
  // settled and a fixed discount comes off what is left to pay; 0 switches the rule off.
  cfg.earlyPurchaseDiscountUSD??=String(state.trialEarlyDiscount??'10');
  // P-59 / backend B13-B14: the trial discount caps at $50 and trial earnings offset without a cap (empty = none).
  cfg.discountCapUSD='50';cfg.trialOffsetCapUSD='';
  const pricing=state.trialQuoteState||'default';
  if(pricing!=='default')Object.assign(cfg,{trialPriceUSD:pricing==='precision'?'432.123456':pricing==='half-cent'?'432.135':pricing==='precision-repriced'?'432.123457':pricing==='excess-offset'?'25':'1000',shadowDailyUSD:'10',shadowDailyNEX:'5',trialDays:'3',discountRate:pricing==='excess-offset'?'0':'0.15',earlyPurchaseDiscountUSD:pricing==='repriced'?'11':'10',trialOffsetCapUSD:pricing==='capped'?'20':''});
  const duration=Number(cfg.trialDays)*day,grace=Number(cfg.graceDays)*day;
  const scenario=mode==='follow'?(state.benefitState==='finished'?'converted':state.benefitState==='grace'?'grace':state.benefitState==='claimed'?'active':'available'):mode;
  if(!state.trialRow){
    const startedAt=now-(scenario==='final-day'?duration-day/2:scenario==='grace'?duration+day:scenario==='ended'?duration+grace+day:day);
    state.trialRow={state:['active','final-day'].includes(scenario)?'ACTIVE':scenario==='grace'?'GRACE':['ended','eligible-again'].includes(scenario)?'FAILED':['converted','refunded'].includes(scenario)?'REDEEMED':'ELIGIBLE',startedAt};
  }
  const row=state.trialRow;
  const snapshot=()=>{
    if(row.state==='ACTIVE'&&now>=row.startedAt+duration)row.state='GRACE';
    if(row.state==='GRACE'&&now>=row.startedAt+duration+grace)row.state='FAILED';
    const claimed=row.state!=='ELIGIBLE',live=['ACTIVE','GRACE'].includes(row.state);
    const elapsedDays=min(BigInt(Math.max(0,Math.floor((now-row.startedAt)/1000)))*100000000n/86400n,BigInt(cfg.trialDays)*100000000n);
    const shadow=claimed?number(units(cfg.shadowDailyUSD)*elapsedDays/100000000n):0;
    const nex=claimed?number(units(cfg.shadowDailyNEX)*elapsedDays/100000000n):0;
    const offset=live?number(capped(units(shadow),cfg.trialOffsetCapUSD)):0;
    const eligible=!claimed||(mode==='eligible-again'&&row.state==='FAILED');
    const full=capacityFull||mode==='capacity-full';
    const canStart=eligible&&!full;
    const quote=live?quoteFor(shadow,nex,row.state==='ACTIVE'&&now<row.startedAt+duration):undefined;
    const conversion=row.state==='REDEEMED'?conversionFacts():null;
    return {...data,state:row.state,canStart,eligibilityReason:eligible&&full?'capacity-full':!canStart?(row.state==='REDEEMED'?'converted':live?'in-progress':'used'):undefined,
      claimNo:claimed?'DEMO-TRIAL':null,version:row.version||1,serverNowEpochMs:now,
      claimedAtEpochMs:claimed?row.startedAt:null,expiresAtEpochMs:claimed?row.startedAt+duration:null,graceEndsAtEpochMs:claimed?row.startedAt+duration+grace:null,
      finishedAtEpochMs:['FAILED','CANCELLED','REDEEMED'].includes(row.state)?row.finishedAt||row.startedAt+duration+grace:null,
      shadowUsdt:shadow,shadowNex:nex,
      offsetUsdt:offset,remainderUsdt:live?number(units(shadow)-units(offset)):0,priceUsdt:Number(cfg.trialPriceUSD),...(quote?{quote}:{}),...(conversion||{})};
  };
  function quoteFor(shadow,nex,inTerm){
      const discount=units(cfg.earlyPurchaseDiscountUSD)/10000n*10000n;
      const early=inTerm&&discount>0n,price=units(cfg.trialPriceUSD);
      const settled=early?max(units(cfg.shadowDailyUSD)*BigInt(cfg.trialDays),units(shadow)):units(shadow);
      const reward=early?max(units(cfg.shadowDailyNEX)*BigInt(cfg.trialDays),units(nex)):units(nex);
      const rate=units(cfg.discountRate,8),normalizedRate=rate>100000000n?rate/100n:rate;
      const promo=capped(price*normalizedRate/100000000n,cfg.discountCapUSD);
      // The full settlement offsets the price, subject only to the claim's offset cap.
      // Only the combined purchase discount is capped by price; remainder is settled minus offset.
      const offset=capped(settled,cfg.trialOffsetCapUSD),baseDiscount=min(price,promo+offset);
      const base=max(0n,price-baseDiscount),earlyDiscount=early?min(discount,base):0n,amount=base-earlyDiscount;
      const settlementPolicy=early?'FULL_TERM_ON_CONVERSION':'ACCRUED_ON_CONVERSION';
      const quoteVersion=early?settlementPolicy+':'+createHash('sha256').update(['DEMO-TRIAL',...[settled,reward,promo,earlyDiscount,amount].map(fixed)].join('|')).digest('hex').slice(0,16):settlementPolicy;
      return {settlementPolicy,quoteVersion,earlyPurchase:early,priceUsdt:number(price),accruedUsdt:shadow,accruedNex:nex,
        settledUsdt:number(settled),rewardNex:number(reward),earlyRewardUsdt:number(settled-units(shadow)),earlyRewardNex:number(reward-units(nex)),
        offsetUsdt:number(offset),remainderUsdt:number(settled-offset),promoDiscountUsdt:number(promo),earlyDiscountConfiguredUsdt:number(discount),earlyDiscountUsdt:number(earlyDiscount),
        discountUsdt:number(baseDiscount+earlyDiscount),amountUsdt:number(amount),earlyEndsAtEpochMs:early?row.startedAt+duration:null};
  }

  // PR #26 projection: the redeemed trial names its order; a refund of that order ends the purchase and,
  // for full-term settlements, takes the trial rewards back.
  function conversionFacts(){
    let order=(state.createdOrders||[]).find(o=>o.orderNo===state.trialOrderNo);
    if(!order){
      // Panel presets reach REDEEMED without a convert command: book the early full-term purchase it implies.
      const at=row.finishedAt||Math.min(row.startedAt+day,now-2*3600000),quote=quoteFor(0,0,true);
      order=conversionOrder('TRC-DEMO'+row.startedAt,at,quote);
      state.createdOrders??=[];state.createdOrders.unshift(order);state.trialOrderNo=order.orderNo;
    }
    if(mode==='refunded'&&order.canonicalStatus!=='refunded')Object.assign(order,{paymentStatus:'REFUNDED',orderStatus:'REFUNDED',activationStatus:'REFUNDED',canonicalStatus:'refunded',
      refundedAt:now-3600000,refundAmountUsdt:order.amountUsdt,refundChannel:'WALLET',refundBillNo:'E4-BILL-'+order.orderNo,refundReasonCode:'USER_REQUEST'});
    const refunded=order.canonicalStatus==='refunded';
    return {conversionOrderNo:order.orderNo,conversionRefunded:refunded,conversionRewardsReversed:refunded&&order.trialSettlement.settlementPolicy==='FULL_TERM_ON_CONVERSION'};
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
    if(snapshot().canStart)Object.assign(row,{state:'ACTIVE',startedAt:now,version:(row.version||1)+1});
    return remember(snapshot());
  }
  if(url.pathname==='/api/trial/cancel'){
    if(row.state!=='ACTIVE')refuse('TRIAL_NOT_CANCELLABLE');
    Object.assign(row,{state:'CANCELLED',finishedAt:now,version:(row.version||1)+1});return remember(snapshot());
  }
  if(url.pathname==='/api/trial/convert'){
    const current=snapshot(),body=request.postDataJSON();
    if(!['ACTIVE','GRACE'].includes(row.state))refuse('TRIAL_NOT_CONVERTIBLE');
    const quote=current.quote,amount=quote.amountUsdt;
    if(body.productNo!==cfg.trialProductId)refuse('TRIAL_PRODUCT_NOT_ELIGIBLE');
    // convert confirms cents, while the quote, debit and receipt retain six decimals.
    const expected=body.expectedAmountUsdt;
    if(typeof expected!=='number'||!Number.isFinite(expected)||expected<0||expected>1000000
      ||!/^\d+(?:\.\d{1,2})?$/.test(String(expected)))refuse('TRIAL_AMOUNT_INVALID');
    if((units(amount)+5000n)/10000n>units(expected,2))refuse('TRIAL_AMOUNT_MISMATCH');
    if(body.quoteVersion&&body.quoteVersion!==quote.quoteVersion)refuse('TRIAL_QUOTE_CHANGED');
    state.lastTrialConversion={productNo:body.productNo,expectedAmountUsdt:body.expectedAmountUsdt,quoteVersion:body.quoteVersion,serverQuoteVersion:quote.quoteVersion,amountUsdt:amount};
    if((state.walletBalance??52800.64)<amount)refuse('TRIAL_WALLET_INSUFFICIENT');
    const orderNo='TRC-DEMO'+now;
    state.walletBalance=number(units(state.walletBalance??52800.64)-units(amount)+units(quote.remainderUsdt));
    state.createdOrders??=[];state.createdOrders.unshift(conversionOrder(orderNo,now,quote));state.trialOrderNo=orderNo;
    Object.assign(row,{state:'REDEEMED',finishedAt:now,version:(row.version||1)+1});
    const source='nx_trial_claim + nx_order + nx_order_item';
    return remember({...proof,orderNo,productNo:cfg.trialProductId,amountUsdt:amount,discountUsdt:number(units(current.priceUsdt)-units(amount)),paymentStatus:'PAID',orderStatus:'PAID',
      settlementPolicy:quote.settlementPolicy,earlyPurchase:quote.earlyPurchase,remainderUsdt:quote.remainderUsdt,rewardNex:quote.rewardNex,
      earlyRewardUsdt:quote.earlyRewardUsdt,earlyRewardNex:quote.earlyRewardNex,earlyDiscountUsdt:quote.earlyDiscountUsdt,source,provenance:{...proof,source}});
  }
  if(['/api/trial/state','/api/trial/eligibility'].includes(url.pathname)){
    return snapshot();
  }
}
