// Isolated loopback financial models. No real network or financial submissions.
import {randomUUID} from 'node:crypto';
import {demoWithdrawalFacts, settleDemoBankWithdrawals} from './prototype-demo-secondary.mjs';
import {demoDepositNetworkDisabledReason} from './prototype-demo-deposit-network.mjs';
const day=86400000;
const minWithdrawal = 20; // AppWithdrawalService.MIN_WITHDRAWAL, shared by policy and eligibility.
// HdPayHostedDepositService / AppVietQrIntentService: hosted capacity is unknown, not a manual bank pool.
const bankConfig={enabled:true,paymentMode:'hosted',dailyCapacityKnown:false,minDepositUsdt:50,maxDepositUsdt:5000,todayRemainingDepositUsdt:0,todayRemainingVnd:0,toleranceVnd:1000,graceMinutes:10,version:1,feeVnd:0,feeUsdt:0};
const bankFx={baseRateVndPerUsdt:25000,buySpreadPct:0,quoteRateVndPerUsdt:25000,lockWindowMinutes:15,version:1};
const refuse=(status,message)=>{throw Object.assign(new Error(message),{status});};
export const demoWithdrawalNetworks = state => ({ "bep20-erc20": ["USDT-BEP20", "USDT-ERC20"], bep20: ["USDT-BEP20"], erc20: ["USDT-ERC20"], closed: [] }[state.withdrawNetworksState] ?? ["USDT-BEP20", "USDT-ERC20"]);
// The list, eligibility and address writes must read the same per-network address book.
export function demoPayoutAddresses(state, now = Date.now()) {
  const defaults = state.dataState === 'empty' ? {} : { 'USDT-BEP20': { source: 'server', serverCanonical: true, sourceEnvironment: 'PRODUCTION', runId: '', network: 'USDT-BEP20', address: `0x${'1'.repeat(40)}`, status: 'ACTIVE', effectiveAt: new Date(now - day).toISOString(), createdAt: new Date(now - 8 * day).toISOString(), nextChangeAllowedAt: new Date(now).toISOString() } };
  return Object.values({ ...defaults, ...state.bankDemo?.addresses }).map(row => ({ ...row, changePending: Date.parse(row.effectiveAt) > now }));
}
// AppPayoutAddressMapper checks all withdrawal networks, including BANK-VND.
export function demoWithdrawals(state, now = Date.now()) {
  settleDemoBankWithdrawals(state);
  const sampleAt = state.withdrawalSamplesAt ??= now;
  // A rejected withdrawal whose full 100 USDT reserve was returned is REFUNDED, not an unsettled REVIEW_REJECTED.
  // Like the backend, retain the submission's fee/net-receive quote; it is not a successful payout or a new UVT refund.
  const withdrawals=state.dataState==='empty'?[]:['CONFIRMED','REFUNDED'].map((status,i)=>({withdrawalNo:'WD-DEMO-'+(i+1),targetAddress:`0x${'1'.repeat(40)}`,amount:100,chain:'USDT-BEP20',status,holdUntil:new Date(sampleAt-day).toISOString(),createdAt:new Date(state.withdrawLimitState==='used'&&i===0?demoWithdrawalFacts(state,now).sampleWithdrawalCreatedAt:sampleAt-(i+2)*day).toISOString(),fee:1,networkConfirmUsd:1,networkFee:1,penaltyFee:0,grossFee:1,nexBurned:0,nexRefunded:0,nexRefundedAt:null,feeWaived:0,actualFee:1,netReceive:99,policyVersion:'money-policy',useNexFeeOffset:false,riskRoute:'fast-pass',idSource:'server'}));
  withdrawals.unshift(...Object.values(state.bankDemo?.orders??{}).map(row=>({withdrawalNo:row.withdrawalNo,targetAddress:'BANK-VND:'+row.beneficiaryNo,amount:row.bank.amountUsdt,chain:'BANK-VND',status:row.outcome==='settled'?'CONFIRMED':row.outcome==='rejected'?'REFUNDED':'PROCESSING',holdUntil:new Date(row.createdAt).toISOString(),createdAt:new Date(row.createdAt).toISOString(),networkConfirmUsd:row.bank.feeUsdt,networkFee:row.bank.feeUsdt,penaltyFee:0,grossFee:row.bank.feeUsdt,nexBurned:0,feeWaived:0,actualFee:row.bank.feeUsdt,netReceive:row.bank.netUsdt,policyVersion:'money-policy',useNexFeeOffset:false,riskRoute:'fast-pass',idSource:'server'})));
  return withdrawals;
}
export function financeDemo(url,state,request){const p=url.pathname,method=request.method(),bankIntent=p.match(/^\/api\/app\/deposits\/vietqr\/intents(?:\/([^/]+)(\/cancel)?)?$/);if(method!=='GET'&&p!=='/api/withdrawals/eligibility'&&!(method==='POST'&&bankIntent))return undefined;const now=Date.now(),iso=new Date(now).toISOString(),empty=state.dataState==='empty',facts=demoWithdrawalFacts(state,now),walletAmount=facts.walletUsdt; const proof={source:"server",serverCanonical:true,sourceEnvironment:"PRODUCTION",runId:""};
const caps = { ...proof, source: "G2/G3 server configuration", asset: "UVT", currency: "USDT", currentPrice: .125, userDailyCapUsdt: 5000, platformDailyCapUsdt: 100000, feePct: .1, feeMinUsdt: .1, minUsdt: .1, minNex: 1, queueMode: "QUEUE", swapEnabled: true };
const repurchaseProof = { ...proof, source: "nx_repurchase_product + nx_config_item + nx_emergency_control_setting" };
  if (p === "/api/config/exchange/caps") return caps;
  if (p === "/api/exchange") return { ...proof, caps, wallet: { usdtAvailable: walletAmount, nexAvailable: 789.000001 }, todayUserUsedUsdt: 50, todayPlatformUsedUsdt: 1000, lifetimeExchangedUsdt: 50.123456, ordersPage: { total: empty ? 0 : 1, pageNum: Number(url.searchParams.get("pageNum") || 1), pageSize: Number(url.searchParams.get("pageSize") || 20) }, orders: empty ? [] : [{ exchangeNo: "EX-DEMO123456", fromAsset: "USDT", toAsset: "UVT", fromAmount: 50.123456, toAmount: 400.987648, rate: .125, status: "COMPLETED", createdAt: iso }] };
  if (p === "/api/config/repurchase") return { ...repurchaseProof, product: "repurchase", asset: "USDT", pointsReward: false, apyPct: 35, lockDays: 90, nurtureMultiplier: 1, h1ReinvestMultiplier: 1, effectiveNurtureMultiplier: 1, ticketPerOrder: 1, presets: [50, 200, 1000], earlyPenaltyPct: 10, minAmountUsdt: 50, enabled: true, disclosureRequired: false, currentNexPriceUsdt: .125, g4LotteryCapacity: 1000, g4TicketsIssuedThisMonth: 1 };
  if (p === "/api/repurchase/orders") return { ...repurchaseProof, walletBalanceUsdt: walletAmount, serverTime: iso, ordersPage: { total: empty ? 0 : 1, pageNum: 1, pageSize: 50 }, orders: empty ? [] : [{ orderNo: "RPS-DEMO123456", amountUsdt: 50.123456, apyPct: 35, earlyPenaltyPct: 10, lockDays: 90, lockedAt: new Date(now - 86400000).toISOString(), unlockAt: new Date(now + 89 * 86400000).toISOString(), estimatedInterestUsdt: 4.325671, status: "ACTIVE" }] };
  const deletionScene=state.accountDeletionState&&state.accountDeletionState!=='follow';
  const withdrawals=deletionScene?(state.accountDeletionState==='withdrawal'?[{...demoWithdrawals({...state,dataState:'normal'},now)[0],status:'PROCESSING'}]:[]):demoWithdrawals(state,now);
  if(p==='/api/withdrawals')return {source:'nx_withdrawal_order',sourceEnvironment:'PRODUCTION',withdrawals,page:{pageNum:1,pageSize:50,total:withdrawals.length,hasMore:false}};
  if(/^\/api\/withdrawals\/WD-DEMO-?\d+$/.test(p))return {source:'nx_withdrawal_order',sourceEnvironment:'PRODUCTION',withdrawal:withdrawals.find(row=>row.withdrawalNo===p.split('/').pop())};
  // Open USDT payout networks follow the preview option; eligibility refuses a closed one like the server does.
  const withdrawNetworks = demoWithdrawalNetworks(state);
  // WithdrawalCompliancePolicy: review on BEP20/ERC20 while H1 hold is on; a hold of cooldownDays above 1000 USDT.
  const complianceHoldEnabled = false;
  const compliance = (chain, amount) => { const review = complianceHoldEnabled && ["USDT-BEP20", "USDT-ERC20"].includes(chain), hold = review && amount > 1000; return { complianceReviewRequired: review, complianceHoldApplies: hold, complianceHoldDays: hold ? 7 : 0 }; };
  if (p === "/api/withdrawals/policy") return { minAmount: minWithdrawal, dailyLimitCount: facts.dailyLimitCount, balanceMaxRatio: facts.balanceMaxRatio, smallAmountThresholdUsd: 100, strongReviewThresholdUsdt: 5000, payoutSlaHours: 24, networkConfirmFeeUsd: { trc20: 1, bep20: 1, erc20: 5 }, nexFeeOffsetRate: .1, policyVersion: "money-policy", cooldownDays: 7, complianceHoldEnabled, complianceReviewThresholdUsdt: 1000, withdrawalEnabled: true, enabledNetworks: withdrawNetworks, currentPhase: "P1", currentMonth: 1, gateSource: "J1", source: "D5+H1" };
  if (p === "/api/withdrawals/eligibility") {
    const input = method === 'GET' ? Object.fromEntries(url.searchParams) : request.postDataJSON();
    const chain = String(input?.chain ?? '').trim().toUpperCase(), address = String(input?.address ?? '').trim(), amount = Number(input?.amount);
    if (!withdrawNetworks.includes(chain)) return { canSubmit: false, maxWithdrawableUsdt: 0, route: "reject", riskReasons: ["network-disabled"], fastLaneApplied: false, complianceReviewRequired: false, complianceHoldApplies: false, complianceHoldDays: 0, waivedGates: [], dailyLimitReached: false, dailyCountResetAt: facts.dailyCountResetAt, configVersion: "money-policy" };
    const payout = demoPayoutAddresses(state, now).find(row => row.network === chain && row.status === 'ACTIVE');
    const riskReasons = [];
    let payoutReady = false;
    const review = compliance(chain, amount);
    const strong = amount >= 5000, fast = amount <= 100 && !strong && !review.complianceReviewRequired;
    if (review.complianceReviewRequired) riskReasons.push('H1_COMPLIANCE_REVIEW_REQUIRED');
    // The fixture models passing K3 / low K4: finalRiskRoute still sends every non-fast amount to manual.
    if (strong) riskReasons.push('A3_STRONG_REVIEW_THRESHOLD');
    if (!payout?.address) riskReasons.push('PAYOUT_ADDRESS_REQUIRED');
    else if (!payout.effectiveAt || Date.parse(payout.effectiveAt) > now) riskReasons.push('PAYOUT_ADDRESS_CHANGE_PENDING');
    // AppWithdrawalService only folds EVM letter case for ERC20 when checking eligibility.
    else if (chain === 'USDT-ERC20' ? address.toLowerCase() !== payout.address.toLowerCase() : address !== payout.address) riskReasons.push('PAYOUT_ADDRESS_MISMATCH');
    else payoutReady = true;
    return { canSubmit: amount >= minWithdrawal && amount <= facts.maxWithdrawableUsdt && facts.dailyRemainingCount > 0 && payoutReady, maxWithdrawableUsdt: facts.maxWithdrawableUsdt, route: fast ? 'pass' : 'manual', riskReasons, fastLaneApplied: fast, ...review, waivedGates: fast ? ['first-withdrawal-review'] : [], dailyLimitReached: facts.dailyRemainingCount === 0, dailyCountResetAt: facts.dailyCountResetAt, configVersion: "money-policy" };
  }
  if (p === "/api/payout-addresses") return { ...proof, addresses: demoPayoutAddresses(state, now), serverNowEpochMs: now, changeCooldownDays: 7, effectiveDelayHours: 24, inFlightWithdrawalBlocked: true };
  if (p === "/api/app/payments/config") return { ...proof, source: "nx_vietqr_config", vietQr: { ...bankConfig, enabled: state.topupChannels !== "bank-off" } };
  if (p === "/api/app/payments/fx-quote") {
    if(url.searchParams.get('fiat')?.toUpperCase()!=='VND'||url.searchParams.get('asset')?.toUpperCase()!=='USDT')refuse(422,'FX_PAIR_NOT_SUPPORTED');
    return { ...proof, source: "nx_finance_fx_quote_config", ...bankFx, asOf: iso };
  }
  if(bankIntent){
    // Seed once per scenario; reloads and polling read the same timestamps, amounts and command results.
    const bank=state.bankTopupDemo??={items:[],commands:{}};
    if(!bank.seeded){
      bank.seeded=true;
      if(!empty&&['paying','credited'].includes(state.topupState)){
        const credited=state.topupState==='credited',created=now-28000;
        bank.items.push({intentNo:'VQR-DEMO-P44',usdtAmount:500,fxRate:bankFx.quoteRateVndPerUsdt,vndAmount:500*bankFx.quoteRateVndPerUsdt,
          status:credited?'credited':'awaiting_payment',expiresAt:new Date(created+bankFx.lockWindowMinutes*60000).toISOString(),createdAt:new Date(created).toISOString(),
          creditedUsdt:credited?500:0,feeVnd:bankConfig.feeVnd,feeUsdt:bankConfig.feeUsdt,version:credited?1:0,paymentMode:'hosted',providerStatus:'created',
          ...(credited?{receivedVnd:500*bankFx.quoteRateVndPerUsdt,matchedAt:new Date(created+14000).toISOString()}:{paymentUrl:'https://api.hdpayadmin.com/pay/demo-preview-only'})});
      }
    }
    // Like get/list: expire awaiting rows once, and remove a hosted URL from terminal reads.
    if(method==='GET')for(const item of bank.items)if(item.status==='awaiting_payment'&&Date.parse(item.expiresAt)<=now){item.status='expired';item.version++;delete item.paymentUrl;}
    const intentNo=bankIntent[1]?.trim();
    if(intentNo){
      if(!/^[A-Za-z0-9:_-]{8,64}$/.test(intentNo))refuse(422,'VIETQR_INTENT_NO_INVALID');
      const item=bank.items.find(row=>row.intentNo===intentNo);
      if(!item)refuse(404,'VIETQR_INTENT_NOT_FOUND');
      // A submitted HDPAY order cannot be cancelled, even when the client sends the current version.
      if(method==='POST'&&bankIntent[2])refuse(409,'HDPAY_PROVIDER_ORDER_NOT_CANCELLABLE');
      if(method==='GET'&&!bankIntent[2])return item;
    }else if(method==='POST'){
      // Lite's unconfigured bank channel fails before recording or replaying a create command.
      if(state.topupChannels==='bank-off')refuse(503,'HDPAY_CONFIGURATION_INCOMPLETE');
      const key=(request.headers()['idempotency-key']??'').trim();
      if(!/^[A-Za-z0-9:_-]{8,128}$/.test(key))refuse(400,'IDEMPOTENCY_KEY_INVALID');
      const amount=request.postDataJSON()?.usdtAmount;
      if(amount===undefined||amount===null)refuse(422,'VIETQR_AMOUNT_REQUIRED');
      // The HTTP boundary accepts JSON numbers (or decimal strings, as Jackson does); new orders use whole USDT.
      const usdtAmount=Number(amount);
      if(!['number','string'].includes(typeof amount)||!Number.isFinite(usdtAmount)||usdtAmount<=0||usdtAmount>10000||Math.abs(usdtAmount*100-Math.round(usdtAmount*100))>1e-8)refuse(422,'VIETQR_AMOUNT_SCALE_INVALID');
      const replay=Object.hasOwn(bank.commands,key)?bank.commands[key]:undefined;
      if(replay){
        if(replay.usdtAmount!==usdtAmount)refuse(409,'IDEMPOTENCY_REQUEST_CONFLICT');
        if(replay.status==='expired')refuse(503,'HDPAY_ORDER_STATE_INVALID');
        return replay;
      }
      if(!Number.isInteger(usdtAmount))refuse(422,'VIETQR_AMOUNT_SCALE_INVALID');
      if(usdtAmount<bankConfig.minDepositUsdt||usdtAmount>bankConfig.maxDepositUsdt)refuse(422,'VIETQR_AMOUNT_OUT_OF_RANGE');
      if(bank.items.filter(row=>row.status==='awaiting_payment'&&Date.parse(row.expiresAt)>now).length>=5)refuse(409,'VIETQR_ACTIVE_INTENT_LIMIT_REACHED');
      const item={intentNo:'VQR-'+randomUUID().replaceAll('-','').slice(0,20).toUpperCase(),usdtAmount,fxRate:bankFx.quoteRateVndPerUsdt,vndAmount:usdtAmount*bankFx.quoteRateVndPerUsdt,
        status:'awaiting_payment',expiresAt:new Date(now+bankFx.lockWindowMinutes*60000).toISOString(),createdAt:iso,creditedUsdt:0,feeVnd:bankConfig.feeVnd,feeUsdt:bankConfig.feeUsdt,
        version:0,paymentMode:'hosted',providerStatus:'created',paymentUrl:'https://api.hdpayadmin.com/pay/demo-preview-only'};
      bank.items.unshift(item);bank.commands[key]=item;state.topupState='paying';
      return item;
    }else if(method==='GET'){
      const limit=Number(url.searchParams.get('limit')??20);
      if(!Number.isInteger(limit)||limit<-2147483648||limit>2147483647)refuse(400,'REQUEST_PARAMETER_INVALID');
      return {items:bank.items.slice(0,Math.max(1,Math.min(50,limit)))};
    }
  }
  // Hosted settlement credits the intent; its INFLIGHT reconciliation is excluded by the receipts endpoint.
  if (p === "/api/app/deposits/vietqr/receipts") return { items: [], nextOffset: null };
  if (p === "/api/deposits/policy" || p === "/api/deposits/address") {
    // Policy and address share the same terms and existing payment availability switches.
    const networks = ['BEP20', 'ERC20'].map(network => {
      const disabledReason = demoDepositNetworkDisabledReason(state, network);
      const feeUsdt = .123456;
      return { network, enabled: disabledReason === null, disabledReason, confirmations: 15,
        feeUsdt, feeUsdtExact: String(feeUsdt), minDepositUsdt: 50, minDepositUsdtExact: '50' };
    });
    if (p === "/api/deposits/policy") return { networks };
    const network = url.searchParams.get('network') || 'BEP20';
    const policy = networks.find(row => row.network === network);
    if (!policy?.enabled) return { enabled: false, creditEnabled: false, network, reason: 'CREGIS_DEPOSIT_PAUSED' };
    return { enabled: true, creditEnabled: true, network, address: `0x${(network === 'ERC20' ? '2' : '1').repeat(40)}`,
      feeUsdt: policy.feeUsdt, feeUsdtExact: policy.feeUsdtExact, minDepositUsdt: policy.minDepositUsdt,
      minDepositUsdtExact: policy.minDepositUsdtExact, confirmations: policy.confirmations };
  }
  if (p === "/api/deposits") return empty ? [] : [{ depositId: "CR-77", network: "BEP20", txHash: `0x${"a".repeat(64)}`, address: `0x${"1".repeat(40)}`, grossAmountUsdt: 50.123456, grossAmountUsdtExact: "50.123456", creditedUsdt: 50, creditedUsdtExact: "50", confirmations: 15, status: "CREDITED", createdAt: now }];
};
