// Isolated loopback financial read models. No real network or financial submissions.
import {demoWithdrawalFacts} from './prototype-demo-secondary.mjs';
const day=86400000;
export function financeDemo(url,state,request){if(request.method()!=='GET'&&url.pathname!=='/api/withdrawals/eligibility')return undefined;const p=url.pathname,now=Date.now(),iso=new Date(now).toISOString(),empty=state.dataState==='empty',walletAmount=empty?0:state.walletBalance??52800.64; const proof={source:"server",serverCanonical:true,sourceEnvironment:"PRODUCTION",runId:""};
const caps = { ...proof, source: "G2/G3 server configuration", asset: "UVT", currency: "USDT", currentPrice: .125, userDailyCapUsdt: 5000, platformDailyCapUsdt: 100000, feePct: .1, feeMinUsdt: .1, minUsdt: .1, minNex: 1, queueMode: "QUEUE", swapEnabled: true };
const repurchaseProof = { ...proof, source: "nx_repurchase_product + nx_config_item + nx_emergency_control_setting" };
  if (p === "/api/config/exchange/caps") return caps;
  if (p === "/api/exchange") return { ...proof, caps, wallet: { usdtAvailable: walletAmount, nexAvailable: 789.000001 }, todayUserUsedUsdt: 50, todayPlatformUsedUsdt: 1000, lifetimeExchangedUsdt: 50.123456, ordersPage: { total: empty ? 0 : 1, pageNum: Number(url.searchParams.get("pageNum") || 1), pageSize: Number(url.searchParams.get("pageSize") || 20) }, orders: empty ? [] : [{ exchangeNo: "EX-DEMO123456", fromAsset: "USDT", toAsset: "UVT", fromAmount: 50.123456, toAmount: 400.987648, rate: .125, status: "COMPLETED", createdAt: iso }] };
  if (p === "/api/config/repurchase") return { ...repurchaseProof, product: "repurchase", asset: "USDT", pointsReward: false, apyPct: 35, lockDays: 90, nurtureMultiplier: 1, h1ReinvestMultiplier: 1, effectiveNurtureMultiplier: 1, ticketPerOrder: 1, presets: [50, 200, 1000], earlyPenaltyPct: 10, minAmountUsdt: 50, enabled: true, disclosureRequired: false, currentNexPriceUsdt: .125, g4LotteryCapacity: 1000, g4TicketsIssuedThisMonth: 1 };
  if (p === "/api/repurchase/orders") return { ...repurchaseProof, walletBalanceUsdt: walletAmount, serverTime: iso, ordersPage: { total: empty ? 0 : 1, pageNum: 1, pageSize: 50 }, orders: empty ? [] : [{ orderNo: "RPS-DEMO123456", amountUsdt: 50.123456, apyPct: 35, earlyPenaltyPct: 10, lockDays: 90, lockedAt: new Date(now - 86400000).toISOString(), unlockAt: new Date(now + 89 * 86400000).toISOString(), estimatedInterestUsdt: 4.325671, status: "ACTIVE" }] };
  const facts=demoWithdrawalFacts(state,now);
  const withdrawals=empty?[]:['CONFIRMED','REVIEW_REJECTED'].map((status,i)=>({withdrawalNo:'WD-DEMO-'+(i+1),targetAddress:`0x${'1'.repeat(40)}`,amount:100,chain:'USDT-BEP20',status,holdUntil:new Date(now-day).toISOString(),createdAt:new Date(now-(i+2)*day).toISOString(),networkConfirmUsd:1,networkFee:1,penaltyFee:0,grossFee:1,nexBurned:0,feeWaived:0,actualFee:1,netReceive:99,policyVersion:'money-policy',useNexFeeOffset:false,riskRoute:'fast-pass',idSource:'server'}));
  // Bank withdrawals are rows of the same withdrawal table.
  withdrawals.unshift(...Object.values(state.bankDemo?.orders??{}).map(row=>({withdrawalNo:row.withdrawalNo,targetAddress:'BANK-VND:'+row.beneficiaryNo,amount:row.bank.amountUsdt,chain:'BANK-VND',status:row.outcome==='settled'?'CONFIRMED':row.outcome==='rejected'?'REFUNDED':'PROCESSING',holdUntil:new Date(row.createdAt).toISOString(),createdAt:new Date(row.createdAt).toISOString(),networkConfirmUsd:row.bank.feeUsdt,networkFee:row.bank.feeUsdt,penaltyFee:0,grossFee:row.bank.feeUsdt,nexBurned:0,feeWaived:0,actualFee:row.bank.feeUsdt,netReceive:row.bank.netUsdt,policyVersion:'money-policy',useNexFeeOffset:false,riskRoute:'fast-pass',idSource:'server'})));
  if(p==='/api/withdrawals')return {source:'nx_withdrawal_order',sourceEnvironment:'PRODUCTION',withdrawals,page:{pageNum:1,pageSize:50,total:withdrawals.length,hasMore:false}};
  if(/^\/api\/withdrawals\/WD-DEMO-?\d+$/.test(p))return {source:'nx_withdrawal_order',sourceEnvironment:'PRODUCTION',withdrawal:withdrawals.find(row=>row.withdrawalNo===p.split('/').pop())};
  // Open USDT payout networks follow the preview option; eligibility refuses a closed one like the server does.
  const withdrawNetworks = { "bep20-erc20": ["USDT-BEP20", "USDT-ERC20"], bep20: ["USDT-BEP20"], erc20: ["USDT-ERC20"], closed: [] }[state.withdrawNetworksState] ?? ["USDT-BEP20", "USDT-ERC20"];
  if (p === "/api/withdrawals/policy") return { minAmount: 50, dailyLimitCount: facts.dailyLimitCount, balanceMaxRatio: facts.balanceMaxRatio, smallAmountThresholdUsd: 100, strongReviewThresholdUsdt: 5000, payoutSlaHours: 24, networkConfirmFeeUsd: { trc20: 1, bep20: 1, erc20: 5 }, nexFeeOffsetRate: .1, policyVersion: "money-policy", cooldownDays: 7, complianceHoldEnabled: false, withdrawalEnabled: true, enabledNetworks: withdrawNetworks, currentPhase: "P1", currentMonth: 1, gateSource: "J1", source: "D5+H1" };
  if (p === "/api/withdrawals/eligibility" && !withdrawNetworks.includes(request.postDataJSON()?.chain)) return { canSubmit: false, maxWithdrawableUsdt: 0, route: "reject", riskReasons: ["network-disabled"], fastLaneApplied: false, waivedGates: [], dailyLimitReached: false, dailyCountResetAt: facts.dailyCountResetAt, configVersion: "money-policy" };
  if (p === "/api/withdrawals/eligibility") return { canSubmit: facts.dailyRemainingCount > 0, maxWithdrawableUsdt: facts.maxWithdrawableUsdt, route: "pass", riskReasons: [], fastLaneApplied: true, waivedGates: [], dailyLimitReached: facts.dailyRemainingCount === 0, dailyCountResetAt: facts.dailyCountResetAt, configVersion: "money-policy" };
  if (p === "/api/payout-addresses") return { ...proof, addresses: empty ? [] : [{ ...proof, network: "USDT-BEP20", address: `0x${"1".repeat(40)}`, status: "ACTIVE", effectiveAt: new Date(now - 86400000).toISOString(), createdAt: new Date(now - 8 * 86400000).toISOString(), nextChangeAllowedAt: iso, changePending: false }], serverNowEpochMs: now, changeCooldownDays: 7, effectiveDelayHours: 24, inFlightWithdrawalBlocked: true };
  if (p === "/api/app/payments/config") return { ...proof, source: "nx_vietqr_config", vietQr: { enabled: true, paymentMode: "manual", dailyCapacityKnown: true, minDepositUsdt: 50, maxDepositUsdt: 5000, todayRemainingDepositUsdt: 5000, todayRemainingVnd: 125000000, toleranceVnd: 1000, graceMinutes: 10, version: 1, feeVnd: 0, feeUsdt: .123456 } };
  if (p === "/api/app/payments/fx-quote") return { ...proof, source: "nx_finance_fx_quote_config", baseRateVndPerUsdt: 25000, buySpreadPct: 0, quoteRateVndPerUsdt: 25000, lockWindowMinutes: 15, version: 1, asOf: iso };
  if (p === "/api/app/deposits/vietqr/intents") {
    // Prototype-only hosted bank order: paying (link created) or credited. The link is never followed in previews.
    const created = now - 28 * 1000, paying = state.topupState === "paying", credited = state.topupState === "credited";
    if (!paying && !credited) return { items: [] };
    return { items: [{ intentNo: "VQR-DEMO-P44", usdtAmount: 500, fxRate: 25000, vndAmount: 12500000, status: credited ? "credited" : "awaiting_payment",
      expiresAt: new Date(created + 15 * 60000).toISOString(), createdAt: new Date(created).toISOString(), creditedUsdt: credited ? 500 : 0, feeVnd: 0, feeUsdt: 0, version: credited ? 3 : 1,
      paymentMode: "hosted", providerStatus: "created", ...(paying ? { paymentUrl: "https://api.hdpayadmin.com/pay/demo-preview-only" } : { matchedAt: new Date(now - 60000).toISOString() }) }] };
  }
  if (p === "/api/app/deposits/vietqr/receipts") return { items: empty ? [] : [{ receiptNo: "DEMO-BANK-RECEIPT", intentNo: "VQR-DEMO123456", viewType: "credit", status: "credited", payableVnd: 1250000, receivedVnd: 1250000, lockedFxRate: 25000, creditedUsdt: 50.123456, createdAt: iso }], nextOffset: null };
  if (p === "/api/deposits/policy" || p === "/api/deposits/address") {
    // Policy and address share the same terms and existing payment availability switches.
    const networks = ['BEP20', 'ERC20'].map(network => {
      const enabled = state.paymentState !== 'usdt-off' && !(state.paymentState === 'erc20-off' && network === 'ERC20');
      const feeUsdt = .123456;
      return { network, enabled, disabledReason: enabled ? null : 'NOT_CONFIGURED', confirmations: 15,
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
