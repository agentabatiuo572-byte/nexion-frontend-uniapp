// Isolated loopback financial models. No real network or financial submissions.
import { accountDeletionWallet, demoDeletionHistory } from './prototype-demo-account.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { demoBankWithdrawalIntent, demoWithdrawalFacts, demoWithdrawalUser } from './prototype-demo-secondary.mjs';
import { demoChainDepositDisabledReason } from './prototype-demo-deposit-network.mjs';
import { previewAccountId } from './prototype-demo-identity.mjs';
import { demoChainDepositAddress, demoChainDepositPolicyFee, demoChainDepositMinimum, demoChainDeposits, demoWalletNex, postDemoWalletEntries } from './prototype-demo-wallet.mjs';
const day=86400000;
const money = amount => Number(amount.toFixed(6));
const exchangeDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
});
const minWithdrawal = 3; // D5 launch minimum (B142), shared by policy and eligibility.
// HdPayHostedDepositService / AppVietQrIntentService: hosted capacity is unknown, not a manual bank pool.
const bankConfig={enabled:true,paymentMode:'hosted',dailyCapacityKnown:false,minDepositUsdt:5,maxDepositUsdt:5000,todayRemainingDepositUsdt:0,todayRemainingVnd:0,toleranceVnd:1000,graceMinutes:10,version:1,feeVnd:0,feeUsdt:0};
const bankFx={baseRateVndPerUsdt:25000,buySpreadPct:0,quoteRateVndPerUsdt:25000,lockWindowMinutes:15,version:1};
const demoHostedPaymentUrl = 'https://api.hdpayadmin.com/pay/demo-preview-only';
const refuse=(status,message,data)=>{throw Object.assign(new Error(message),{status,data});};

function creditDemoBankTopup(state, item, now) {
  const credit = state.walletMovements?.find(row => row.bizNo === item.intentNo && row.bizType === 'VIETQR_DEPOSIT');
  if (!credit) postDemoWalletEntries(state, {bizNo:item.intentNo,bizType:'VIETQR_DEPOSIT',asset:'USDT',direction:'IN',category:'topup',at:now,amount:item.usdtAmount});
  Object.assign(item, {status:'credited',providerStatus:'created',version:item.version+1,creditedUsdt:item.usdtAmount,
    receivedVnd:item.vndAmount,matchedAt:new Date(credit?.at??now).toISOString()});
  delete item.paymentUrl;
}

function resolveDemoBankTopupCreate(state, item, result, now) {
  if (result === 'confirming' || item.providerStatus !== 'submit_unknown') return;
  if (result === 'credited') {
    creditDemoBankTopup(state, item, now);
    return;
  }
  item.version++;
  if (result === 'rejected') {
    item.providerStatus = 'rejected';
  } else {
    item.providerStatus = 'created';
    if (result === 'expired') {
      item.status = 'expired';
      item.expiresAt = new Date(now).toISOString();
    } else {
      item.paymentUrl = demoHostedPaymentUrl;
    }
  }
}

export const demoUsdtWithdrawalNetworks = ["USDT-BEP20", "USDT-ERC20"];
export const demoWithdrawalNetworks = state => ({ "bep20-erc20": demoUsdtWithdrawalNetworks, bep20: ["USDT-BEP20"], erc20: ["USDT-ERC20"], closed: [] }[state.withdrawNetworksState] ?? demoUsdtWithdrawalNetworks);
export const demoPayoutAddressDelayHours = 24;
export const demoPayoutAddressCooldownDays = 7;
// The list, eligibility and address writes must read the same per-network address book.
export function demoPayoutAddresses(state, now = Date.now()) {
  const createdAt = (state.previewFactsAt ?? now) - 8 * day;
  const defaults = state.dataState === 'empty' ? {} : {
    'USDT-BEP20': {
      source: 'server', serverCanonical: true, sourceEnvironment: 'PRODUCTION', runId: '',
      network: 'USDT-BEP20', address: '0x' + '1'.repeat(40), status: 'ACTIVE',
      createdAt: new Date(createdAt).toISOString(),
      effectiveAt: new Date(createdAt + demoPayoutAddressDelayHours * 3600000).toISOString(),
      nextChangeAllowedAt: new Date(createdAt + demoPayoutAddressCooldownDays * day).toISOString(),
    },
  };
  return Object.values({ ...defaults, ...state.bankDemo?.addresses }).map(row => ({ ...row, changePending: Date.parse(row.effectiveAt) > now }));
}
export function demoWithdrawalPolicy(state, facts) {
  const policy = {
    minAmount: minWithdrawal, dailyLimitCount: facts.dailyLimitCount, balanceMaxRatio: facts.balanceMaxRatio,
    // The launch config closes the small-amount fast lane (threshold 0): every USDT withdrawal goes to review.
    smallAmountThresholdUsd: state.withdrawReviewState === 'legacy-fast-pass' ? 100 : 0, strongReviewThresholdUsdt: 5000, payoutSlaHours: 24,
    // The withdrawal policy contract requires a fee field for the inactive network.
    networkConfirmFeeUsd: { trc20: 1, bep20: state.withdrawQuoteState === 'net-zero' ? minWithdrawal : 1, erc20: 1 }, nexFeeOffsetRate: .1,
    // 'hold' turns on the compliance review with its 7-day window for amounts above 1 (the policy contract needs a threshold > 0).
    cooldownDays: 7, complianceHoldEnabled: state.withdrawReviewState === 'hold',
    complianceReviewThresholdUsdt: state.withdrawReviewState === 'hold' ? 1 : 1000, withdrawalEnabled: true, enabledNetworks: demoWithdrawalNetworks(state),
    currentPhase: 'P1', currentMonth: 1, gateSource: 'J1', source: 'D5+H1',
  };
  const policyVersion = createHash('sha256').update(JSON.stringify(policy)).digest('hex');
  return { ...policy, policyVersion };
}

// The fixture models passing K3 and low K4. Non-fast orders go to manual review.
function demoWithdrawalRisk(policy, chain, amount) {
  const complianceReviewRequired = policy.complianceHoldEnabled && demoUsdtWithdrawalNetworks.includes(chain);
  const complianceHoldApplies = complianceReviewRequired && policy.cooldownDays > 0 && amount > policy.complianceReviewThresholdUsdt;
  const complianceHoldDays = complianceHoldApplies ? policy.cooldownDays : 0;
  const strongReview = amount >= policy.strongReviewThresholdUsdt;
  const smallAmountEligible = amount <= policy.smallAmountThresholdUsd;
  const fastLaneApplied = smallAmountEligible && !strongReview && !complianceReviewRequired;
  return { complianceReviewRequired, complianceHoldApplies, complianceHoldDays, strongReview, smallAmountEligible, fastLaneApplied };
}

function demoWithdrawalEligibility(state, input, now, facts, policy) {
  const chain = String(input?.chain ?? '').trim().toUpperCase();
  const address = String(input?.address ?? '').trim();
  const amount = Number(input?.amount);
  const base = { dailyCountResetAt: facts.dailyCountResetAt, configVersion: policy.policyVersion };
  if (!policy.enabledNetworks.includes(chain)) {
    return { rejection: 'WITHDRAWAL_NETWORK_DISABLED', view: { ...base,
      canSubmit: false, maxWithdrawableUsdt: 0, route: 'reject', riskReasons: ['network-disabled'],
      fastLaneApplied: false, complianceReviewRequired: false, complianceHoldApplies: false,
      complianceHoldDays: 0, waivedGates: [], dailyLimitReached: false,
    } };
  }

  const payout = demoPayoutAddresses(state, now).find(row => row.network === chain && row.status === 'ACTIVE');
  const { strongReview, fastLaneApplied, complianceReviewRequired, complianceHoldApplies, complianceHoldDays } = demoWithdrawalRisk(policy, chain, amount);
  const riskReasons = [];
  if (complianceReviewRequired) riskReasons.push('H1_COMPLIANCE_REVIEW_REQUIRED');
  if (strongReview) riskReasons.push('A3_STRONG_REVIEW_THRESHOLD');
  let rejection;
  if (!payout?.address) rejection = 'WITHDRAWAL_PAYOUT_ADDRESS_REQUIRED';
  else if (!payout.effectiveAt || Date.parse(payout.effectiveAt) > now) rejection = 'WITHDRAWAL_PAYOUT_ADDRESS_CHANGE_PENDING';
  else if (chain === 'USDT-ERC20' ? address.toLowerCase() !== payout.address.toLowerCase() : address !== payout.address) {
    rejection = 'WITHDRAWAL_PAYOUT_ADDRESS_MISMATCH';
  }
  if (rejection) riskReasons.push(rejection.slice('WITHDRAWAL_'.length));
  const dailyLimitReached = facts.dailyRemainingCount === 0;
  if (!rejection) {
    if (dailyLimitReached) rejection = 'WITHDRAWAL_DAILY_LIMIT_EXCEEDED';
    else if (!(amount >= policy.minAmount)) rejection = 'WITHDRAWAL_MIN_AMOUNT_NOT_MET';
    else if (amount > facts.maxWithdrawableUsdt || amount > facts.walletUsdt) rejection = 'WITHDRAWAL_BALANCE_LIMIT_EXCEEDED';
  }
  const quote = typeof input?.useNexFeeOffset === 'boolean'
    ? wireWithdrawalQuote(withdrawalFeeBreakdown({ amount, network: chain, offset: input.useNexFeeOffset }, policy,
      demoWithdrawalQuoteNex(state, now))) : undefined;
  return { rejection, view: { ...base, complianceReviewRequired, complianceHoldApplies, complianceHoldDays,
    canSubmit: !rejection && (!quote || Number(quote.netReceive) > 0), quote,
    maxWithdrawableUsdt: facts.maxWithdrawableUsdt, route: fastLaneApplied ? 'pass' : 'manual', riskReasons,
    fastLaneApplied, waivedGates: fastLaneApplied ? ['first-withdrawal-review'] : [], dailyLimitReached,
  } };
}

function demoWithdrawalQuoteNex(state, now) {
  const balance = demoWalletNex(state, now);
  // This option simulates a quote read before an external UVT credit is visible to the submit path.
  return state.withdrawQuoteState === 'change-once' && !state.withdrawQuoteChangeConsumed ? Math.min(balance, 1) : balance;
}

function withdrawalFeeBreakdown({ amount, network, offset }, policy, nexAvailable) {
  const feeKey = network.split('-')[1].toLowerCase();
  const networkFee = policy.networkConfirmFeeUsd[feeKey];
  const nexBurned = offset ? Math.min(nexAvailable, Math.ceil(networkFee / policy.nexFeeOffsetRate)) : 0;
  const feeWaived = Math.min(networkFee, Math.floor(Math.round(nexBurned * 1e6) * policy.nexFeeOffsetRate) / 1e6);
  const actualFee = money(networkFee - feeWaived);
  return { networkFee, nexBurned, feeWaived, actualFee, netReceive: money(amount - actualFee) };
}

function wireWithdrawalQuote({ networkFee, nexBurned, netReceive }) {
  return { networkFee: networkFee.toFixed(6), nexBurned: nexBurned.toFixed(6), netReceive: netReceive.toFixed(6) };
}

function createWithdrawalReceipt(frozen, policy, createdAt, fees, withdrawalNo) {
  const { amount, network: chain, policyVersion, offset: useNexFeeOffset } = frozen;
  const { networkFee, nexBurned, feeWaived, actualFee, netReceive } = fees;
  const { fastLaneApplied, strongReview, ...risk } = demoWithdrawalRisk(policy, chain, amount);
  const holdAt = createdAt + risk.complianceHoldDays * day;
  return {
    withdrawalNo, amount, chain,
    status: fastLaneApplied ? 'PENDING_CHAIN' : risk.complianceHoldApplies ? 'EXTENDED_HOLD' : 'REVIEW_PENDING',
    holdUntil: new Date(holdAt).toISOString(),
    payoutDueAt: new Date(holdAt + policy.payoutSlaHours * 3600000).toISOString(),
    networkConfirmUsd: networkFee, networkFee, penaltyFeeRate: 0, penaltyFee: 0, grossFee: networkFee,
    nexBurned, feeWaived, penaltyFeeWaived: 0, networkFeeWaived: feeWaived,
    actualPenaltyFee: 0, actualNetworkFee: actualFee, actualFee, netReceive,
    policyVersion, useNexFeeOffset, ...risk, strongReview, strongReviewRequired: strongReview,
    riskRoute: fastLaneApplied ? 'fast-pass' : strongReview ? 'strong-review' : 'manual',
    k3RiskRoute: 'pass', k4Priority: 'low', riskRuleId: null, idSource: 'server',
  };
}

function recordWithdrawal(state, user, receipt, address, createdAt, confirmedAt = null) {
  const accounts = state.withdrawalOrders ??= {};
  (accounts[user] ??= {})[receipt.withdrawalNo] = {
    ...receipt, targetAddress: address, createdAt: new Date(createdAt).toISOString(), confirmedAt,
    status: confirmedAt ? 'CONFIRMED' : receipt.status,
  };
}

function reserve(state, receipt, at) {
  const { withdrawalNo, netReceive, actualNetworkFee, nexBurned } = receipt;
  const debit = { direction: 'OUT', at, category: 'withdraw' };
  postDemoWalletEntries(state,
    { ...debit, bizNo: withdrawalNo + ':USDT:PRINCIPAL', bizType: 'WITHDRAW_NET_PRINCIPAL', asset: 'USDT', amount: netReceive },
    ...(actualNetworkFee > 0 ? [{ ...debit, bizNo: withdrawalNo + ':USDT:NETWORK_FEE',
      bizType: 'WITHDRAW_NETWORK_FEE', asset: 'USDT', amount: actualNetworkFee }] : []),
    ...(nexBurned > 0 ? [{ ...debit, bizNo: withdrawalNo + ':NEX:OFFSET',
      bizType: 'WITHDRAW_FEE_OFFSET', asset: 'UVT', amount: nexBurned }] : []));
}

export function seedDemoConfirmedWithdrawal(state, user, frozen, policy, now, withdrawalNo) {
  const createdAt = now - 2 * day;
  const receipt = createWithdrawalReceipt(frozen, policy, createdAt, withdrawalFeeBreakdown(frozen, policy, 0), withdrawalNo);
  recordWithdrawal(state, user, receipt, frozen.address, createdAt,
    new Date(Date.parse(receipt.holdUntil) + 3600000).toISOString());
  return receipt;
}

export function submitDemoWithdrawal(state, user, frozen) {
  const now = Date.now();
  const facts = demoWithdrawalFacts(state, now, user);
  const policy = demoWithdrawalPolicy(state, facts);
  const reject = (status, message, data) => ({ status, message, data });
  if (!policy.withdrawalEnabled) return reject(409, 'WITHDRAWAL_KILL_SWITCH_DISABLED');
  // WithdrawalNetworkPolicy throws before submitOnce returns an idempotent business result.
  if (!policy.enabledNetworks.includes(frozen.network)) refuse(409, 'WITHDRAWAL_NETWORK_DISABLED');
  if (frozen.policyVersion !== policy.policyVersion) {
    return reject(409, 'WITHDRAWAL_POLICY_VERSION_CONFLICT', { policyVersion: policy.policyVersion });
  }
  if (demoBankWithdrawalIntent(state, now)) return reject(409, 'BANK_WITHDRAWAL_UNRESOLVED_INTENT');

  const { rejection } = demoWithdrawalEligibility(state, {
    amount: frozen.amount, chain: frozen.network, address: frozen.address,
  }, now, facts, policy);
  if (rejection) return reject(rejection === 'WITHDRAWAL_MIN_AMOUNT_NOT_MET' ? 422 : 409, rejection);

  const fees = withdrawalFeeBreakdown(frozen, policy, demoWalletNex(state, now));
  const quote = wireWithdrawalQuote(fees);
  if (frozen.confirmedQuote && Object.keys(quote).some(field => quote[field] !== frozen.confirmedQuote[field])) {
    if (state.withdrawQuoteState === 'change-once') state.withdrawQuoteChangeConsumed = true;
    return reject(409, 'WITHDRAWAL_QUOTE_CHANGED', { policyVersion: policy.policyVersion, quote });
  }
  if (fees.netReceive <= 0) return reject(422, 'WITHDRAWAL_NET_AMOUNT_INVALID');
  const receipt = createWithdrawalReceipt(frozen, policy, now, fees, 'WD-B34-DEMO-' + randomUUID());
  reserve(state, receipt, now);
  recordWithdrawal(state, user, receipt, frozen.address, now);
  return { status: 200, receipt };
}

// Model the provider's payout steps only for automatic approvals created in this preview.
function advanceDemoFastWithdrawals(state, user, now) {
  const orders = state.withdrawalOrders?.[user] ?? {};
  for (const order of Object.values(orders)) {
    if (order.riskRoute !== 'fast-pass' || !['PENDING_CHAIN', 'PROCESSING', 'CHAIN_SUBMITTED'].includes(order.status)) continue;
    const createdAt = Date.parse(order.createdAt);
    const age = now - createdAt;
    if (age >= 20_000) {
      order.status = 'CONFIRMED';
      order.confirmedAt = new Date(createdAt + 20_000).toISOString();
    } else if (age >= 12_000) order.status = 'CHAIN_SUBMITTED';
    else if (age >= 6_000) order.status = 'PROCESSING';
  }
}

export function financeDemo(url,state,request){const p=url.pathname,method=request.method(),bankIntent=p.match(/^\/api\/app\/deposits\/vietqr\/intents(?:\/([^/]+)(\/cancel)?)?$/);if(method!=='GET'&&p!=='/api/withdrawals/eligibility'&&!(method==='POST'&&bankIntent))return undefined;const now=Date.now(),iso=new Date(now).toISOString(),empty=state.dataState==='empty',user=demoWithdrawalUser(state,request.headers?.());
if(p==='/api/withdrawals'||p.startsWith('/api/withdrawals/'))advanceDemoFastWithdrawals(state,user,now);
const facts=demoWithdrawalFacts(state,now,user),walletAmount=facts.walletUsdt; const proof={source:"server",serverCanonical:true,sourceEnvironment:"PRODUCTION",runId:""};
const caps = { ...proof, source: "G2/G3 server configuration", asset: "UVT", currency: "USDT", currentPrice: .125, userDailyCapUsdt: 5000, platformDailyCapUsdt: 100000, feePct: .1, feeMinUsdt: .1, minUsdt: .1, minNex: 1, queueMode: "QUEUE", swapEnabled: true };
const repurchaseProof = { ...proof, source: "nx_repurchase_product + nx_config_item + nx_emergency_control_setting" };
  if (p === "/api/config/exchange/caps") return caps;
  if(p==='/api/exchange'){
    const history=demoDeletionHistory(state);
    const orders=history?(history.swap?[history.swap]:[]):empty?[]:[{exchangeNo:'EX-DEMO123456',
      fromAsset:'USDT',toAsset:'UVT',fromAmount:50.123456,toAmount:400.987648,rate:.125,
      status:'COMPLETED',at:state.previewFactsAt}];
    const settled=orders.filter(order=>['COMPLETED','SUCCESS'].includes(order.status));
    const sumUsdt=rows=>rows.reduce((sum,order)=>sum+(order.toAsset==='USDT'?order.toAmount:order.fromAmount),0);
    const today=exchangeDay.format(now);
    const requestedPage=Number(url.searchParams.get('pageNum')??1),requestedSize=Number(url.searchParams.get('pageSize')??20);
    if(!Number.isInteger(requestedPage)||!Number.isInteger(requestedSize))
      throw Object.assign(new Error('EXCHANGE_PAGE_INVALID'),{status:400});
    const pageNum=Math.max(1,requestedPage),pageSize=Math.max(1,Math.min(requestedSize,100));
    return {...proof,caps,wallet:{usdtAvailable:walletAmount,nexAvailable:0},
      todayUserUsedUsdt:sumUsdt(settled.filter(order=>exchangeDay.format(order.at)===today)),
      todayPlatformUsedUsdt:1000,lifetimeExchangedUsdt:sumUsdt(settled),
      ordersPage:{total:orders.length,pageNum,pageSize},
      orders:orders.slice((pageNum-1)*pageSize,pageNum*pageSize).map(({at,...order})=>({...order,createdAt:new Date(at).toISOString()}))};
  }
  if (p === "/api/config/repurchase") refuse(503, 'REPURCHASE_CONFIG_INVALID');
  if (p === "/api/repurchase/orders") return { ...repurchaseProof, walletBalanceUsdt: walletAmount, serverTime: iso, ordersPage: { total: 0, pageNum: 1, pageSize: 50 }, orders: [] };
  const { withdrawals } = facts;
  if(state.accountDeletionState==='withdrawal-error'&&p==='/api/withdrawals')refuse(503,'DEMO_WITHDRAWAL_READ_UNAVAILABLE');
  if(p==='/api/withdrawals')return {source:'nx_withdrawal_order',sourceEnvironment:'PRODUCTION',withdrawals,page:{pageNum:1,pageSize:50,total:withdrawals.length,hasMore:false}};
  const order = p.match(/^\/api\/withdrawals\/(WD-(?:B34-DEMO-[^/]*|DEMO-?\d+|[A-F0-9]{32}))$/);
  if (order) {
    const withdrawal = withdrawals.find(row => row.withdrawalNo === order[1]);
    if (!withdrawal) refuse(404, 'WITHDRAWAL_NOT_FOUND');
    return { source: 'nx_withdrawal_order', sourceEnvironment: 'PRODUCTION', withdrawal };
  }
  if (p === "/api/withdrawals/policy") return demoWithdrawalPolicy(state, facts);
  if (p === "/api/withdrawals/eligibility") {
    const input = method === 'GET' ? Object.fromEntries(url.searchParams) : request.postDataJSON();
    const policy = demoWithdrawalPolicy(state, facts);
    if (typeof input?.policyVersion !== 'string' || input.policyVersion.trim() !== policy.policyVersion) {
      refuse(409, 'WITHDRAWAL_POLICY_VERSION_CONFLICT', { policyVersion: policy.policyVersion });
    }
    return demoWithdrawalEligibility(state, input, now, facts, policy).view;
  }
  if (p === "/api/payout-addresses" && method === 'GET') {
    if (state.payoutAddressInitialRead) {
      state.payoutAddressInitialRead = false;
      state.payoutAddressReadFailures = 2;
    } else if (state.payoutAddressReadFailures > 0) {
      state.payoutAddressReadFailures -= 1;
      refuse(503, 'PAYOUT_ADDRESS_READ_UNAVAILABLE');
    }
    return { ...proof, addresses: demoPayoutAddresses(state, now), serverNowEpochMs: now, changeCooldownDays: demoPayoutAddressCooldownDays, effectiveDelayHours: demoPayoutAddressDelayHours, inFlightWithdrawalBlocked: true };
  }
  if (p === "/api/app/payments/config") return { ...proof, source: "nx_vietqr_config", vietQr: { ...bankConfig, enabled: state.topupChannels !== "bank-off" } };
  if (p === "/api/app/payments/fx-quote") {
    if(url.searchParams.get('fiat')?.toUpperCase()!=='VND'||url.searchParams.get('asset')?.toUpperCase()!=='USDT')refuse(422,'FX_PAIR_NOT_SUPPORTED');
    return { ...proof, source: "nx_finance_fx_quote_config", ...bankFx, asOf: iso };
  }
  if(bankIntent){
    // Seed once per scenario; reloads and polling read the same timestamps, amounts and command results.
    const createUnknown = state.topupState === 'create-unknown';
    let bank;
    if (createUnknown) {
      if (user === null) refuse(401, 'USER_AUTH_REQUIRED');
      const accounts = state.bankTopupUnknownByUser ??= {};
      bank = accounts[user] ??= {items:[]};
    } else {
      bank = state.bankTopupDemo ??= {items:[],commands:{}};
    }
    if(!bank.seeded){
      bank.seeded=true;
      const preset = state.topupState;
      if (!empty && ['paying', 'rejected', 'credited', 'expired'].includes(preset)) {
        const settling = preset === 'credited', expiring = preset === 'expired', rejected = preset === 'rejected';
        const lockMs = bankFx.lockWindowMinutes * 60000;
        // The pane adopts a live order and shows expiry when its normal read sees that order expire.
        const expiresAt = expiring ? now + 2000 : now - 28000 + lockMs;
        const vndAmount = 500 * bankFx.quoteRateVndPerUsdt;
        const providerStatus = rejected ? 'rejected' : settling ? 'pending' : 'created';
        bank.items.push({intentNo:'VQR-DEMO-P44',usdtAmount:500,fxRate:bankFx.quoteRateVndPerUsdt,vndAmount,
          status:'awaiting_payment',expiresAt:new Date(expiresAt).toISOString(),createdAt:new Date(expiresAt-lockMs).toISOString(),
          creditedUsdt:0,feeVnd:bankConfig.feeVnd,feeUsdt:bankConfig.feeUsdt,version:0,paymentMode:'hosted',providerStatus,
          ...(providerStatus==='created'?{paymentUrl:demoHostedPaymentUrl}:{})});
        if(settling)bank.settlingPreset=bank.items[0].intentNo;
      }
    }else if(method==='GET'&&bank.settlingPreset){
      // The first list read lets the pane adopt the live payment. Its next read sees settlement of the same intent.
      const item=bank.items.find(row=>row.intentNo===bank.settlingPreset);
      creditDemoBankTopup(state, item, now);
      delete bank.settlingPreset;
    }
    const readback = state.bankTopupReadbackState ?? 'confirming';
    if (createUnknown && method === 'GET' && !bankIntent[1]) {
      // The panel's readback settles the preset's original command only.
      const original = bank.items.find(item => item.createIdempotencyKey === bank.unknownKey);
      if (original) resolveDemoBankTopupCreate(state, original, readback, now);
    }
    // Like get/list: expire awaiting rows once, and remove a hosted URL from terminal reads.
    if(method==='GET')for(const item of bank.items)if(item.status==='awaiting_payment'&&(!createUnknown||item.providerStatus==='created')&&Date.parse(item.expiresAt)<=now){item.status='expired';item.version++;delete item.paymentUrl;}
    const intentNo=bankIntent[1]?.trim();
    if(intentNo){
      if(!/^[A-Za-z0-9:_-]{8,64}$/.test(intentNo))refuse(422,'VIETQR_INTENT_NO_INVALID');
      const item=bank.items.find(row=>row.intentNo===intentNo);
      if(!item)refuse(404,'VIETQR_INTENT_NOT_FOUND');
      if (method === 'POST' && bankIntent[2]) {
        // B28: a retired manual order is refused before anything else (410); a submitted hosted order is never cancellable.
        if (item.paymentMode !== 'hosted') refuse(410, 'VIETQR_MANUAL_TOPUP_RETIRED');
        const key = (request.headers()['idempotency-key'] ?? '').trim();
        if (!/^[A-Za-z0-9:_-]{8,128}$/.test(key)) refuse(400, 'IDEMPOTENCY_KEY_INVALID');
        const expectedVersion = request.postDataJSON()?.expectedVersion;
        if (!Number.isInteger(expectedVersion) || expectedVersion < 0) refuse(422, 'VIETQR_EXPECTED_VERSION_REQUIRED');
        refuse(409, 'HDPAY_PROVIDER_ORDER_NOT_CANCELLABLE');
      }
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
      const replay = createUnknown
        ? bank.items.find(item => item.createIdempotencyKey === key)
        : Object.hasOwn(bank.commands,key) ? bank.commands[key] : undefined;
      if(replay){
        if(replay.usdtAmount!==usdtAmount)refuse(409,'IDEMPOTENCY_REQUEST_CONFLICT');
        if (createUnknown) resolveDemoBankTopupCreate(state, replay, 'created', now);
        else if(replay.status==='expired')refuse(503,'HDPAY_ORDER_STATE_INVALID');
        return replay;
      }
      if(!Number.isInteger(usdtAmount))refuse(422,'VIETQR_AMOUNT_SCALE_INVALID');
      if(usdtAmount<bankConfig.minDepositUsdt||usdtAmount>bankConfig.maxDepositUsdt)refuse(422,'VIETQR_AMOUNT_OUT_OF_RANGE');
      if(bank.items.filter(row=>row.status==='awaiting_payment'&&Date.parse(row.expiresAt)>now).length>=5)refuse(409,'VIETQR_ACTIVE_INTENT_LIMIT_REACHED');
      if(state.topupState==='create-rejected')refuse(422,'HDPAY_ORDER_CREATE_REJECTED');
      // Only the preset's first command has an unknown result; a later command (e.g. 重新生成付款单) is an ordinary new order.
      const unknownResult = createUnknown && !bank.unknownKey;
      const item={intentNo:'VQR-'+randomUUID().replaceAll('-','').slice(0,20).toUpperCase(),usdtAmount,fxRate:bankFx.quoteRateVndPerUsdt,vndAmount:usdtAmount*bankFx.quoteRateVndPerUsdt,
        status:'awaiting_payment',expiresAt:new Date(now+bankFx.lockWindowMinutes*60000).toISOString(),createdAt:iso,creditedUsdt:0,feeVnd:bankConfig.feeVnd,feeUsdt:bankConfig.feeUsdt,
        version:0,paymentMode:'hosted',
        ...(unknownResult ? {providerStatus:'submit_unknown'} : {providerStatus:'created',paymentUrl:demoHostedPaymentUrl}),
        ...(createUnknown ? {createIdempotencyKey:key} : {})};
      bank.items.unshift(item);
      if (unknownResult) {
        bank.unknownKey = key;
        refuse(503, 'HDPAY_ORDER_SUBMISSION_UNKNOWN');
      }
      // The unknown preset keeps its orders in its own per-account store.
      if (!createUnknown) { bank.commands[key]=item; state.topupState='paying'; }
      return item;
    }else if(method==='GET'){
      const limit=Number(url.searchParams.get('limit')??20);
      if(!Number.isInteger(limit)||limit<-2147483648||limit>2147483647)refuse(400,'REQUEST_PARAMETER_INVALID');
      const items = bank.items.slice(0,Math.max(1,Math.min(50,limit)));
      return {items:createUnknown && readback === 'legacy' ? items.map(({createIdempotencyKey: _key, ...item}) => item) : items};
    }
  }
  // Hosted settlement credits the intent; its INFLIGHT reconciliation is excluded by the receipts endpoint.
  if (p === "/api/app/deposits/vietqr/receipts") return { items: [], nextOffset: null };
  if (p === "/api/deposits/policy" || p === "/api/deposits/address") {
    // Policy and address share the same terms and existing payment availability switches.
    const feeExact = demoChainDepositPolicyFee(state);
    const networks = ['BEP20', 'ERC20'].map(network => {
      const disabledReason = demoChainDepositDisabledReason(state, network);
      return { network, enabled: disabledReason === null, disabledReason, confirmations: 15,
        feeUsdt: Number(feeExact), feeUsdtExact: feeExact,
        minDepositUsdt: Number(demoChainDepositMinimum), minDepositUsdtExact: demoChainDepositMinimum };
    });
    if (p === "/api/deposits/policy") return { networks };
    const accountId = previewAccountId(state, request.headers?.() ?? {});
    if (!accountId) refuse(401, 'AUTH_REQUIRED');
    const network = url.searchParams.get('network') || 'BEP20';
    const policy = networks.find(row => row.network === network);
    if (!policy?.enabled) return { enabled: false, creditEnabled: false, network, reason: 'CREGIS_DEPOSIT_PAUSED' };
    return { enabled: true, creditEnabled: true, network, address: demoChainDepositAddress(state, network, true, accountId),
      feeUsdt: policy.feeUsdt, feeUsdtExact: policy.feeUsdtExact, minDepositUsdt: policy.minDepositUsdt,
      minDepositUsdtExact: policy.minDepositUsdtExact, confirmations: policy.confirmations };
  }
  if(p==='/api/deposits') {
    const accountId = previewAccountId(state, request.headers?.() ?? {});
    if (!accountId) refuse(401, 'AUTH_REQUIRED');
    return demoChainDeposits(state, accountId);
  }
};
