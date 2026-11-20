// Secondary presentation snapshots, served only by the loopback demo server.
import { accountDeletionWallet, demoDeletionHistory } from './prototype-demo-account.mjs';
import { demoTeamBusinessDate } from './prototype-demo-events.mjs';
import { demoCommissionEvents, demoCommissionGroups, demoCommissionTotals, demoSettledTasks, demoTeamPeriod, demoTeamWeek, postDemoWalletEntries } from './prototype-demo-wallet.mjs';
const proof={source:'server',sourceEnvironment:'PRODUCTION',runId:'',serverCanonical:true};
const day=86400000;
// Receipt cursors retain the issuance cutoff while ordering by completion.
export function demoReceiptPage(params, receipts) {
  const offset=Number(params.get('offset')??0),limit=Number(params.get('limit')??20);
  const cursor=params.get('cursor')?.trim();
  const invalid=(message)=>{throw Object.assign(new Error(message),{status:422});};
  if(!Number.isInteger(offset)||offset<0||offset>1000000||!Number.isInteger(limit)||limit<1||limit>50)
    invalid('TASK_RECEIPT_PAGE_INVALID');
  const ordering=(a,b)=>b.completedAt-a.completedAt||b.receiptNo.localeCompare(a.receiptNo);
  const issuance=(a,b)=>b.settledAt-a.settledAt||b.receiptNo.localeCompare(a.receiptNo);
  const rows=receipts.slice().sort(ordering);
  let highWater=receipts.slice().sort(issuance)[0],eligible=rows.slice(offset);
  if(cursor){
    let boundary;
    try{
      const ids=JSON.parse(Buffer.from(cursor,'base64url').toString());
      if(Array.isArray(ids)&&ids.length===2){
        boundary=rows.find(row=>row.receiptNo===ids[0]);
        highWater=rows.find(row=>row.receiptNo===ids[1]);
      }
    }catch(error){
      if(!(error instanceof SyntaxError))throw error;
    }
    if(!boundary||!highWater||issuance(boundary,highWater)<0)invalid('TASK_RECEIPT_CURSOR_INVALID');
    eligible=rows.filter(row=>issuance(row,highWater)>=0&&ordering(row,boundary)>0);
  }
  const items=eligible.slice(0,limit),more=eligible.length>limit;
  return {...proof,items,nextOffset:more?offset+limit:null,
    nextCursor:more?Buffer.from(JSON.stringify([items.at(-1).receiptNo,highWater.receiptNo])).toString('base64url'):null};
}

export function demoBatchPage(params, batches) {
  const cursor=params.get('cursor'),limit=Number(params.get('limit')??20);
  if(!Number.isInteger(limit)||limit<1||limit>50)
    throw Object.assign(new Error('COMPUTE_V2_PAGE_INVALID'),{status:422});
  const rows=batches.slice().sort((a,b)=>b.postedAt-a.postedAt||b.batchNo.localeCompare(a.batchNo));
  const boundary=cursor===null?-1:rows.findIndex(row=>row.batchNo===cursor);
  if(cursor!==null&&boundary===-1)
    throw Object.assign(new Error('COMPUTE_V2_CURSOR_INVALID'),{status:422});
  const records=rows.slice(boundary+1,boundary+1+limit);
  return {...proof,records,nextCursor:rows.length>boundary+1+limit?records.at(-1).batchNo:null};
}

function recordDemoBankSettlement(row, { paid, d2Refund, evidenceRef, at, providerProof = !d2Refund }) {
  row.providerState = paid ? 'PAID' : d2Refund ? 'READY' : 'FAILED';
  row.withdrawal.status = paid ? 'CONFIRMED' : d2Refund ? 'REFUNDED' : 'FAILED';
  row.settlementEvidence = { status: paid ? 'paid' : 'refunded', evidenceRef,
    providerOrderId: providerProof ? 'DEMO-PROVIDER-' + row.withdrawalNo : null,
    providerStatus: providerProof ? (paid ? 3 : 5) : null,
    checkedAt: new Date(at).toISOString(), amountUsdt: row.bank.amountUsdt };
}

// Old handoffs saved terminal outcomes separately from the order fields and evidence.
export function restoreDemoBankWithdrawals(state, now) {
  for (const row of Object.values(state.bankDemo?.orders ?? {})) {
    if (row.settlementEvidence) continue;
    if (row.outcome === 'settled') {
      recordDemoBankSettlement(row, { paid: true, evidenceRef: 'DEMO-' + row.withdrawalNo, at: now });
    } else if (row.outcome === 'rejected') {
      const refund = state.walletMovements?.find(entry =>
        entry.bizNo === row.withdrawalNo + ':PAYOUT:USDT:REFUND' && entry.bizType === 'WITHDRAW_PAYOUT_REFUND'
        && entry.asset === 'USDT' && entry.direction === 'IN' && entry.status === 'SUCCESS'
        && entry.amount === row.bank.amountUsdt && Number.isFinite(entry.at));
      // Before the wallet ledger, a refund only restored the balance and set the order outcome.
      recordDemoBankSettlement(row, { paid: false, evidenceRef: refund?.bizNo ?? row.withdrawalNo,
        at: refund?.at ?? now, providerProof: Boolean(refund) });
    } else {
      // Old orders kept PENDING/PROCESSING in storage and projected the panel's live stage on reads.
      if (row.providerState === 'PENDING' && row.withdrawal?.status === 'PROCESSING') {
        if (state.bankState === 'held') {
          row.providerState = 'MANUAL_REVIEW';
          row.withdrawal.status = 'TX_ORPHANED';
        } else if (state.bankState === 'review') {
          row.providerState = 'READY';
          row.withdrawal.status = 'REVIEW_PENDING';
        }
      }
      continue;
    }
    delete row.outcome;
  }
}

// Advance the same order facts for the bank detail, quote recovery, config and tracking reads.
export function updateDemoBankWithdrawals(state, now) {
  for (const row of Object.values(state.bankDemo?.orders ?? {})) {
    if (row.settlementEvidence) continue;
    const ready = row.providerState === 'READY';
    if (state.bankState === 'review') {
      if (ready) row.withdrawal.status = 'REVIEW_PENDING';
      continue;
    }
    const paid = state.bankState === 'settled', refunded = state.bankState === 'rejected';
    if (paid || refunded) {
      const d2Refund = ready && refunded;
      const evidenceRef = d2Refund ? 'D2-REFUND-' + row.withdrawalNo : 'DEMO-' + row.withdrawalNo;
      if (refunded) {
        postDemoWalletEntries(state, {
          bizNo: d2Refund ? evidenceRef : row.withdrawalNo + ':PAYOUT:USDT:REFUND',
          bizType: d2Refund ? 'WITHDRAW_REFUND' : 'WITHDRAW_PAYOUT_REFUND',
          asset: 'USDT', direction: 'IN', amount: row.bank.amountUsdt, at: now, category: 'withdraw',
        });
      }
      recordDemoBankSettlement(row, { paid, d2Refund, evidenceRef, at: now });
    } else if (state.bankState === 'held') {
      row.providerState = 'MANUAL_REVIEW';
      row.withdrawal.status = 'TX_ORPHANED';
    } else if (ready) {
      row.providerState = 'DISPATCHING';
      row.withdrawal.status = 'PROCESSING';
    }
  }
}

// BankWithdrawalService.currentIntent: live quotes and orders without settlement proof share one gate.
export function demoBankWithdrawalIntent(state, now) {
  const demo = state.bankDemo;
  if (!demo) return null;
  const active = Object.values(demo.quotes).filter(row => !row.abandoned && !row.order && Date.parse(row.quote.expiresAt) > now);
  const intents = active.map(({ quote }) => ({ state: 'NOT_SUBMITTED', quoteNo: quote.quoteNo, withdrawalNo: null, expiresAt: quote.expiresAt, providerState: null }));
  intents.push(...Object.values(demo.orders).filter(row => !row.settlementEvidence).map(row => ({
    state: 'COMMITTED', quoteNo: row.bank.quoteNo, withdrawalNo: row.withdrawalNo,
    expiresAt: row.bank.expiresAt, providerState: row.providerState,
  })));
  const single = intents.length === 1 ? intents[0] : null;
  return !intents.length ? null : { state: single?.state ?? 'MULTIPLE', intents,
    quoteNo: single?.quoteNo ?? null, withdrawalNo: single?.withdrawalNo ?? null };
}

export function demoWithdrawals(state, now = Date.now(), user = demoWithdrawalUser(state)) {
  const sampleAt = state.withdrawalSamplesAt ??= now;
  const history = demoDeletionHistory(state);
  // A rejected reserve that was returned is REFUNDED. Keep the original fee and net quote.
  const chainOrders = history?.withdrawals ?? (state.dataState === 'empty' ? [] :
    ['CONFIRMED', 'REFUNDED'].map((status, i) => ({
      withdrawalNo: 'WD-DEMO-' + (i + 1), amount: 100, netReceive: 99, fee: 1, status,
      at: sampleAt - (i + 2) * day, holdUntil: sampleAt - day,
    })));
  const chainRows = chainOrders.map(({ at, holdUntil = at, ...order }) => ({
    ...order, targetAddress: `0x${'1'.repeat(40)}`, chain: 'USDT-BEP20',
    holdUntil: new Date(holdUntil).toISOString(), createdAt: new Date(at).toISOString(),
    networkConfirmUsd: order.fee, networkFee: order.fee, penaltyFee: 0, grossFee: order.fee,
    nexBurned: 0, nexRefunded: 0, nexRefundedAt: null, feeWaived: 0, actualFee: order.fee,
    policyVersion: 'money-policy', useNexFeeOffset: false,
    riskRoute: order.amount <= 100 ? 'fast-pass' : 'manual', idSource: 'server',
  }));
  const bankRows = Object.values(state.bankDemo?.orders ?? {}).map(row => ({
    withdrawalNo: row.withdrawalNo, targetAddress: 'BANK-VND:' + row.beneficiaryNo, amount: row.bank.amountUsdt,
    chain: 'BANK-VND', status: row.withdrawal.status,
    holdUntil: new Date(row.createdAt).toISOString(), createdAt: new Date(row.createdAt).toISOString(),
    networkConfirmUsd: row.bank.feeUsdt, networkFee: row.bank.feeUsdt, penaltyFee: 0, grossFee: row.bank.feeUsdt,
    nexBurned: 0, feeWaived: 0, actualFee: row.bank.feeUsdt, netReceive: row.bank.netUsdt,
    policyVersion: 'money-policy', useNexFeeOffset: false, riskRoute: 'fast-pass', idSource: 'server',
  }));
  return [...Object.values(state.withdrawalOrders?.[user] ?? {}), ...bankRows, ...chainRows];
}

export function demoWithdrawalUser(state, headers) {
  if (headers && (state.sessionState === 'signed-out' || state.authState === 'signed-out'
    || !['Bearer local-demo-token', 'Bearer formal-probe-access-token'].includes(headers.authorization))) return null;
  return state.authUser?.userId ?? 900001;
}

// One rule for every withdrawal read (EarningsReleaseService.withdrawableAmount, AppWithdrawalService.maximumWithdrawable
// and bankCapacity): every earnings bucket is credited to the wallet, so pending and locked amounts sit inside the balance
// and come off it before the ratio. USDT and bank withdrawals are rows of one table, so they share one daily count.
export function demoWithdrawalFacts(state,now=Date.now(),user=demoWithdrawalUser(state)){
  const withdrawals=demoWithdrawals(state,now,user);
  const wallet=accountDeletionWallet(state);
  const empty=state.dataState==='empty',walletUsdt=wallet?.usdtAvailable??(empty?0:state.walletBalance??52800.64),pendingReview=wallet||empty?0:12.5,bonusLocked=wallet||empty?0:50,balanceMaxRatio=1,dailyLimitCount=2;
  const released=Math.max(0,Math.round((walletUsdt-pendingReview-bonusLocked)*1e6)/1e6);
  // WithdrawalDayWindow: Vietnam UTC+7 midnight, with an inclusive start and exclusive end.
  const start=Math.floor((now+7*3600000)/day)*day-7*3600000,dailyCountResetAt=start+day;
  const used=withdrawals.filter(row=>{
    const createdAt=Date.parse(row.createdAt);
    return createdAt>=start&&createdAt<dailyCountResetAt;
  }).length;
  return {withdrawals,walletUsdt,pendingReview,bonusLocked,balanceMaxRatio,released,maxWithdrawableUsdt:Math.round(released*balanceMaxRatio*1e6)/1e6,dailyLimitCount,
    dailyRemainingCount:Math.max(0,dailyLimitCount-used),dailyCountResetAt};
}
export function secondaryDemo(url,state,request,walletBills){
  const p=url.pathname,now=Date.now(),iso=new Date(now).toISOString(),empty=state.dataState==='empty',facts=demoWithdrawalFacts(state,now);
  const page=Number(url.searchParams.get('page')||1),pageSize=Number(url.searchParams.get('pageSize')||20);
  const paginate=items=>({page,pageSize,totalRows:items.length,events:items.slice((page-1)*pageSize,page*pageSize)});
  if(p==='/api/app/profile/nickname-candidates')return {candidates:['Bright Fox K7','Calm Comet 4R','Swift Owl M8','Lunar Wolf 6T','Amber River P3','Silent Harbor 9H']};
  if(p==='/api/payout-addresses')return {...proof,addresses:[],serverNowEpochMs:now,changeCooldownDays:30,effectiveDelayHours:24,inFlightWithdrawalBlocked:true};
  if(p==='/api/me/notification-preferences'){
    state.notificationPreferences??={commission:true,team:true,staking:true,market:true,genesis:true,system:true};
    if(request.method()==='PATCH')Object.assign(state.notificationPreferences,request.postDataJSON(),{system:true});
    return state.notificationPreferences;
  }
  if(p==='/api/withdrawals/bank/config')return {enabled:true,banks:[],bankCodeRequired:false,bindingOtpRequired:!empty,bankSelection:'ACCOUNT_ROUTED',bankRoutingVerified:true,payType:'BANKQR',unresolvedIntent:null,beneficiary:empty?null:{bankCode:'',bankName:'ACCOUNT_ROUTED',maskedAccount:'••••4242',effectiveAt:iso,nextChangeAt:iso,beneficiaryNo:'DEMO-BANK-1',canWithdraw:true,bankRoutingVerified:true},policy:{version:1,minAmountUsd:10,maxAmountUsd:10000,feeRatePct:1,feeMinUsd:1,feeMaxUsd:100},capacity:{maxWithdrawableUsdt:facts.maxWithdrawableUsdt,dailyRemainingCount:facts.dailyRemainingCount,dailyLimitCount:facts.dailyLimitCount,dailyCountResetAt:new Date(facts.dailyCountResetAt).toISOString(),withdrawalEnabled:true}};
  if(p==='/api/payment-methods')return {serverCanonical:true,cards:empty?[]:[{tokenId:'9001',version:1,brand:'visa',last4:'4242',expiry:'12/30',holder:'ALEX DEMO',status:'BOUND',isDefault:true,boundAt:iso,source:'mock',sandbox:true,providerCanonical:false}]};
  if(p.startsWith('/api/goals')){
    state.goals??=[{id:1,targetUsdt:1000,deadlineAt:now+30*day,createdAt:now-10*day,achieved:false,achievedAt:null,progressPct:37.5,lifetimeEarningsUsdt:375},{id:2,targetUsdt:100,deadlineAt:now-day,createdAt:now-40*day,achieved:true,achievedAt:now-2*day,progressPct:100,lifetimeEarningsUsdt:375}];
    if(p==='/api/goals/recommendation'){const targetUsdt=Number(url.searchParams.get('targetUsdt')),days=Math.max(1,Math.ceil((Number(url.searchParams.get('deadlineAt'))-now)/day)),requiredDaily=Math.max(0,(targetUsdt-375)/days);return {...proof,source:'nx_product',purchaseRequired:requiredDaily>0,productNo:requiredDaily>0?'stellarbox-pro':null,productName:requiredDaily>0?'UVELBox Pro':null,dailyEarn:requiredDaily>0?22.4:null,price:requiredDaily>0?4999:null,requiredDaily,targetUsdt,days};}
    if(p==='/api/goals'&&request.method()==='GET')return {serverCanonical:true,source:'nx_earning_goal',lifetimeEarningsUsdt:empty?0:375,goals:empty?[]:state.goals};
    if(p==='/api/goals'){const input=request.postDataJSON(),goal={id:Math.max(0,...state.goals.map(g=>g.id))+1,targetUsdt:input.targetUsdt,deadlineAt:input.deadlineAt,createdAt:now,achieved:false,achievedAt:null,progressPct:Math.min(100,375/input.targetUsdt*100),lifetimeEarningsUsdt:375};state.goals.push(goal);return goal;}
    const id=Number(p.split('/')[3]),goal=state.goals.find(g=>g.id===id);
    if(request.method()==='DELETE'){state.goals=state.goals.filter(g=>g.id!==id);return null;}
    if(p.endsWith('/status')&&goal){goal.achieved=request.postDataJSON().achieved;goal.achievedAt=goal.achieved?now:null;return goal;}
  }
  if(p.startsWith('/api/tasks/receipts')){
    const items=demoSettledTasks(state,state.previewFactsAt??now).map((task,i)=>({...proof,
      receiptNo:task.receiptNo,taskNo:task.taskNo,taskClass:task.taskClass,model:task.model,client:task.client,
      rewardUsdt:task.amount,rewardNex:task.nex,settledAt:task.postedAt,earningStatus:'SETTLED',completedAt:task.completedAt,
      startedAt:task.completedAt-task.durationSec*1000,durationSec:task.durationSec,deviceId:task.deviceId,
      deviceInstanceNo:'REVIEW-S1',deviceName:'UVELBox S1',deviceType:'BOX',deviceGpu:'RTX 4090',vramTotalGb:24,
      taskId:'demo-'+task.taskClass.toLowerCase(),taskName:task.taskName,...task.simulation,
      proofHash:task.simulation?null:String(i+1).repeat(64)}));
    if(p==='/api/tasks/receipts')return demoReceiptPage(url.searchParams,items);
    const receipt=items.find(r=>r.receiptNo===p.split('/').pop());
    if(!receipt)throw Object.assign(new Error('TASK_RECEIPT_NOT_FOUND'),{status:404});
    return receipt;
  }
  if(p==='/api/earnings/release-status'){
    const entries=walletBills().filter(row=>row.status==='SUCCESS'&&row.direction==='IN'
      &&['TEAM_COMMISSION','REFERRAL_REWARD','DAILY_CHECK_IN','DAILY_MILESTONE','EARNING_MILESTONE',
        'EVENT_REWARD','WHEEL_REWARD','GENESIS_EMISSION','TRIAL_BONUS'].includes(row.bizType));
    const released=asset=>Number(entries.filter(row=>row.asset===asset).reduce((sum,row)=>sum+row.amount,0).toFixed(6));
    const assets={USDT:{withdrawable:released('USDT'),pending_review:facts.pendingReview,bonus_locked:facts.bonusLocked},
      UVT:{withdrawable:released('UVT'),pending_review:accountDeletionWallet(state)||empty?0:10,bonus_locked:0}};
    return {serverCanonical:true,buckets:assets.USDT,assets,releaseMode:'manual_only',attestedOnlineSeconds:0,
      requiredAttestationSeconds:0,clusterRestricted:false};
  }
  if(p==='/api/config/market/nex')return {...proof,source:'G3 weekly_curve + nx_price_index sampled history',asset:'UVT',currency:'USDT',currentPrice:.128,costBasis:.1,historyMaxDays:30,sparkline:[.118,.12,.117,.122,.124,.126,.128],history:[.118,.12,.117,.122,.124,.126,.128].map((price,i)=>({price,sampledAt:new Date(now-(6-i)*4*3600000).toISOString(),sampledAtEpochMs:now-(6-i)*4*3600000}))};
  if(p==='/api/app/team/insights/commissions'){
    const kinds=['direct_purchase','direct_device_earning','unilevel','binary','peer','cultivation','leadership','genesis','promotion','other'];
    if(!Number.isInteger(page)||page<1||!Number.isInteger(pageSize)||pageSize<1||pageSize>100){
      throw Object.assign(new Error('TEAM_COMMISSIONS_PAGE_INVALID'),{status:422});
    }
    const window=demoTeamPeriod('all',now,url.searchParams.get('snapshotAt'));
    const events=demoCommissionEvents(state,state.previewFactsAt??now).filter(event=>window.contains(event.ts))
      .map(({sourceRef,...event})=>({...event,...(event.kind.startsWith('direct_')&&{sourceRef})}));
    const total=(rows,asset='amountUSDT')=>rows.reduce((sum,row)=>sum+row[asset],0);
    const today=demoTeamBusinessDate(Date.parse(window.snapshotAt)),month=today.slice(0,7);
    const thisMonth=events.filter(event=>demoTeamBusinessDate(event.ts).slice(0,7)===month);
    const unlocked=events.filter(event=>event.status==='unlocked'),cooling=events.filter(event=>event.status==='cooling');
    const totalUSDT=total(events),directUSDT=total(events.filter(event=>event.layer===1));
    const byKind=Object.fromEntries(kinds.map(kind=>{
      const rows=events.filter(event=>event.kind===kind);
      return [kind,{usdt:total(rows),nex:total(rows,'amountNEX'),count:rows.length}];
    }));
    return {...proof,...paginate(events),generatedAt:iso,snapshotAt:window.snapshotAt,aggregate:{totalUSDT,totalNEX:total(events,'amountNEX'),
      directUSDT,extendedUSDT:totalUSDT-directUSDT,contributorCount:new Set(events.filter(event=>event.layer>0).map(event=>event.sourceUserName)).size,monthUSDT:total(thisMonth),
      monthNEX:total(thisMonth,'amountNEX'),todayUSDT:total(events.filter(event=>demoTeamBusinessDate(event.ts)===today)),
      unlockedUSDT:total(unlocked),unlockedNEX:total(unlocked,'amountNEX'),coolingUSDT:total(cooling),eventCount:events.length,
      nextUnlockAt:cooling[0]?.unlockAt??null,byKind}};
  }
  if(p==='/api/app/team/insights/leaderboard'){
    const period=url.searchParams.get('period')||'month';
    // Independent demo point snapshots, not a relabelled commission amount.
    const points={today:[184,151,97,58,26],week:[1840,1512,970,586,264],month:[18400,15120,9700,5860,2640],all:[94400,78000,55300,27540,13820]}[period];
    const rows=empty?[]:['Maya','Linh','Alex','Sam','Rin'].map((handle,i)=>({rank:i+1,handle,flag:['🇸🇬','🇻🇳','🇯🇵','🇸🇬','🇯🇵'][i],cc:['SG','VN','JP','SG','JP'][i],directs:20-i*3,teamSize:100-i*12,earnedUSDT:[870,1000,480,740,610][i],computePoints:points[i],delta:i-2,vRank:8-i,hasDevice:true}));
    return {...proof,period,rankingMetric:'COMPUTE_POINTS',rows:rows.slice((page-1)*pageSize,page*pageSize),page,pageSize,totalRows:rows.length,myRank:empty?null:3,gapToNext:empty?0:520,gapToNextComputePoints:empty?null:points[1]-points[2],poolUsd:empty?0:5000,topN:10,generatedAt:iso,snapshotAt:iso,snapshotVersion:'d'.repeat(64)};
  }
  if(p==='/api/app/team/insights/unilevel'){
    const filter=url.searchParams.get('filter')?.trim().toLowerCase()??'all';
    const version=Number(url.searchParams.get('schemaVersion')??1);
    const period=url.searchParams.get('period')?.trim().toLowerCase()??'week';
    const invalid=message=>{throw Object.assign(new Error(message),{status:422});};
    if(![1,2].includes(version)||version===1&&filter!=='all')invalid('TEAM_SCHEMA_VERSION_UNSUPPORTED');
    if(!['all','direct','extended'].includes(filter))invalid('TEAM_UNILEVEL_FILTER_INVALID');
    if(!['today','week','month','all'].includes(period))invalid('TEAM_UNILEVEL_PERIOD_INVALID');
    if(!Number.isInteger(page)||page<1||!Number.isInteger(pageSize)||pageSize<1||pageSize>100)invalid('TEAM_UNILEVEL_PAGE_INVALID');
    const window=demoTeamPeriod(period,now,url.searchParams.get('snapshotAt'));
    const seedAt=state.previewFactsAt??now;
    const commissionRows=demoCommissionEvents(state,seedAt).filter(row=>row.kind==='unilevel');
    const purchases=version===2?demoCommissionGroups(state,seedAt)
      .filter(row=>row.kind==='direct_purchase').map(row=>({...row,currency:'DUAL',policyVersion:3,nexUsdtPrice:.128})):[];
    const all=[...commissionRows,...purchases].filter(row=>window.contains(row.ts)).sort((a,b)=>b.ts-a.ts||b.id.localeCompare(a.id))
      .map(row=>({...row,source:'network',sourceRef:row.sourceRef??row.orderId,cycle:demoTeamWeek(row.ts),
        settlementState:'CANONICAL',withdrawable:version===1&&row.status==='unlocked',
        ...(version===2&&{policyVersion:row.policyVersion??null,nexUsdtPrice:row.nexUsdtPrice??null,
          recoveryPendingUSDT:0,recoveryPendingNEX:0,
          ...(row.amountUSDT>0&&{statusUSDT:row.status}),...(row.amountNEX>0&&{statusNEX:row.status})})}));
    const direct=all.filter(row=>row.layer===1),extended=all.filter(row=>row.layer>1);
    const events=filter==='direct'?direct:filter==='extended'?extended:all;
    return {...proof,period,...paginate(events),split:{direct:demoCommissionTotals(direct),extended:demoCommissionTotals(extended)},
      ...(version===2&&{schemaVersion:2,settlementMode:'DIRECT_ONLY_V1',filter,summary:demoCommissionTotals(events)}),
      generatedAt:iso,snapshotAt:window.snapshotAt};
  }
  if(p==='/api/app/team/insights/leadership-pool'){
    const myRank=state.highestRank?8:2,distribution=empty?[]:[2,4,6,8].map(vRank=>({vRank,people:2,votes:vRank})),totalVotes=distribution.reduce((s,r)=>s+r.people*r.votes,0),myVotes=empty?0:myRank,mySharePct=totalVotes?myVotes/totalVotes:0;
    return {...proof,currentWeekPoolUSDT:empty?0:5000,myRank,myVotes,totalVotes,mySharePct,projectedPayoutUSDT:5000*mySharePct,distribution,history:empty?[]:[{weekId:'2026-W42',payoutUSDT:120}],nextPayoutAt:new Date(now+3*day).toISOString(),unlockRank:2,injectRate:.05,topN:100};
  }
  if(p==='/api/events/genesis-raffle') {
    const anchor=state.raffleScenarioAt??(state.raffleScenarioAt=now), mode=state.raffleState;
    const startsAt=mode==='upcoming'?anchor+60000:anchor-2*day;
    const drawAt=mode==='ending'?anchor+60000:mode==='ended'?anchor-1000:anchor+day;
    const prizes=mode==='small-usdt'
      ? ['0.00032','0.00005'].map((amount,i)=>({id:'demo-prize-'+i,nameZh:amount+' USDT 奖励',nameEn:amount+' USDT reward',nameVi:'Thưởng '+amount+' USDT',rewardType:'USDT',amount,quantity:10}))
      : [{id:'demo-prize',nameZh:'100 UVT 奖励',nameEn:'100 UVT reward',nameVi:'Thưởng 100 UVT',rewardType:'UVT',amount:'100',quantity:10}];
    return {availableTickets:empty?0:3-(state.raffleEntries||0),draws:empty||state.eventState==='empty'?[]:['OPEN','PROCESSING','DRAWN'].map((status,i)=>({id:'demo-draw-'+i,titleZh:['成长抽奖','上一期抽奖','已开奖记录'][i],titleEn:['Growth draw','Previous draw','Draw results'][i],titleVi:['Vòng quay tăng trưởng','Kỳ trước','Kết quả'][i],startsAt:new Date(i===0?startsAt:anchor-2*day).toISOString(),drawAt:new Date(i===0?drawAt:anchor-day).toISOString(),status,revision:1,myEntries:i===0?state.raffleEntries||0:2,totalEntries:120+(i===0?state.raffleEntries||0:0),prizes,myResults:i===2?prizes.map(prize=>({prizeId:prize.id,rewardType:prize.rewardType,amount:prize.amount,receiptId:'DEMO-RAFFLE-RECEIPT-'+prize.id,status:'PAID'})):[]}))};
  }
  if(p==='/api/events/genesis-raffle/demo-draw-0/enter'){
    const anchor=state.raffleScenarioAt??now;
    if((state.raffleState==='upcoming'&&now<anchor+60000)||(state.raffleState==='ending'&&now>=anchor+60000)||state.raffleState==='ended')throw new Error('Demo draw is not accepting entries');
    const tickets=request.postDataJSON().tickets;if(!Number.isInteger(tickets)||tickets<1||tickets>3-(state.raffleEntries||0))throw new Error('Invalid demo tickets');
    state.raffleEntries=(state.raffleEntries||0)+tickets;return {drawId:'demo-draw-0',enteredTickets:tickets,availableTickets:3-state.raffleEntries};
  }
}
