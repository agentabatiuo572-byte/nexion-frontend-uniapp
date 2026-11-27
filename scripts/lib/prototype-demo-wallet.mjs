// The loopback account's visible ledger and wallet summaries.
import { accountDeletionWallet, demoDeletionHistory } from './prototype-demo-account.mjs';
import { demoH4Credits, demoH4Savers, demoH4TeamMembers, demoTeamBusinessDate } from './prototype-demo-events.mjs';
import { demoDeletionStake } from './prototype-demo-staking.mjs';
import { demoHasLongTasks } from './prototype-demo-long-content.mjs';
import {
  demoPurchaseBudgetPolicy, demoPurchaseNexPerUsdt, demoPurchasePolicy, demoRewardNexUsdtPrice, RANK_RULES,
  rankDevicePolicies, rankPresetTeamMembers, rankSalaryPaidFacts, usesRankPreset,
} from './prototype-demo-rank-presets.mjs';

const day=86400000;
const timeZone='Asia/Shanghai';
const businessDate=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
const source={source:'server',sourceEnvironment:'PRODUCTION'};
const money=value=>Number(value.toFixed(6));
const signed=row=>row.direction==='IN'?row.amount:-row.amount;
const settledBill=row=>row.status==='SUCCESS';
const reward=row=>row.direction==='IN'&&row.amount>0&&!(row.bizType==='TEAM_COMMISSION'&&row.status==='CANCELLED')&&['bonus','refer','achievement'].includes(row.category);

export function demoSettledTasks(state,at) {
  if(!demoHasEarningsHistory(state))return [];
  const completedReplacements=Object.values(state.slotReplacementTasks??{}).filter(task=>task.completedAt!=null);
  if(demoHasLongTasks(state)) {
    return [
      ['LL','language inference - structured knowledge extraction','0.029745'],
      ['IG','image gen - watercolor garden concept','0.029234'],
      ['EM','embedding - digital passage retrieval','0.018296'],
      ['VG','video gen - digital weather animation','0.024993'],
      ['SP','speech processing - cinematic interview notes','0.025376'],
      ['EM','embedding - digital passage retrieval','0.019308'],
      ['FT','fine tuning - compact summary adaptation','0.007892'],
      ['VG','video gen - digital weather animation','0.025009'],
      ['VG','video gen - digital weather animation','0.024729'],
      ['SP','speech processing - cinematic interview notes','123.011586'],
    ].map(([taskClass,taskName,rewardAmount],index)=>{
      const completedAt=at-(index+1)*420000;
      return {taskNo:'DEMO-TASK-'+(10+index),receiptNo:'DEMO-RECEIPT-L'+index,receiptId:index+1,configVersion:'1',batchNo:null,
        deviceId:41,taskClass,taskName,amount:Number(rewardAmount),nex:0,completedAt,postedAt:completedAt+60000,
        durationSec:300,client:'UVEL',model:'',simulation:{executionMode:'SIMULATED',proofKind:'TASK_RECEIPT',
          modelExecuted:false,rewardAsset:'USDT',rewardAmount}};
    }).concat(completedReplacements);
  }
  return [['IG',2.34],['LL',8.5],['VG',5.4]].map(([taskClass,amount],index)=>{
    const completedAt=at-(index+1)*3600000;
    return {taskNo:'DEMO-TASK-'+(index+1),receiptNo:'DEMO-RECEIPT-'+(index+1),
      batchNo:index<2?'DEMO-BATCH-'+(index+1):null,deviceId:41,taskClass,amount,
      nex:0,completedAt,postedAt:completedAt+600000,durationSec:600,
      taskName:['Image generation','Language inference','Video generation'][index],
      client:'Demo Studio',model:['SDXL','Llama 3.1','Video generation'][index]};
  }).concat(completedReplacements);
}

function splitPurchaseBudget(budget, share) {
  const micros = Math.round(budget * 1e6);
  return {
    amountUSDT: Math.floor(micros * share / 100) / 1e6,
    amountNEX: Math.floor(micros * (100 - share) * 10_000 / Math.round(demoRewardNexUsdtPrice * 1e6)) / 1e6,
  };
}

function deviceRewardAmounts(basis, layer, policy) {
  const reward = basis * (layer === 1 ? policy.totalRatePct : policy.level2RatePct) / 100;
  return {
    amountUSDT: money(reward * policy.usdtSharePct / 100),
    amountNEX: money(reward * (100 - policy.usdtSharePct) / 100 / demoRewardNexUsdtPrice),
  };
}

export function demoCommissionGroups(state,at) {
  if(!demoHasEarningsHistory(state))return [];
  // The legacy balance match has no corresponding paid orders in a rank preset.
  if(usesRankPreset(state))return demoRankPresetRewardRows(state,at).sort((a,b)=>b.ts-a.ts);
  const [year,month]=demoTeamBusinessDate(at).split('-').map(Number);
  const matchedAt=Date.UTC(year,month-1,1)-7*3600000-1;
  const legacy=state.walletLegacySeed;
  const purchase={
    id:'demo-commission-0',kind:'direct_purchase',sourceUserName:'Maya',layer:1,
    orderId:'DEMO-TEAM-MAYA-1',sourceRef:'DEMO-TEAM-MAYA-1',orderAmountUSD:legacy?1299:100,
    amountUSDT:legacy?25:6,amountNEX:legacy?10:31.25,status:'unlocked',
    ts:legacy?at:at-8*day,unlockAt:legacy?at:at-day,
  };
  const device={
    id:'demo-commission-1',kind:'direct_device_earning',sourceUserName:'Linh',layer:1,
    sourceRef:'DEMO-TEAM-EARNING-1',sourceDeviceId:'DEMO-LINH-S1',orderAmountUSD:100,
    amountUSDT:legacy?50:3.5,amountNEX:legacy?10:11.71875,status:legacy?'cooling':'unlocked',
    ts:at-day,unlockAt:legacy?at+day:at-day,
  };
  const network={
    id:'demo-commission-2',kind:'unilevel',sourceUserName:'Rin',layer:2,
    orderId:'DEMO-TEAM-RIN-1',sourceRef:'DEMO-TEAM-RIN-1',orderAmountUSD:1299,
    amountUSDT:75,amountNEX:10,status:'withdrawn',ts:at-2*day,unlockAt:at-2*day,
  };
  const binary={
    id:'demo-commission-3',kind:'binary',sourceUserName:'System',layer:0,
    orderId:'DEMO-BIN-'+demoTeamBusinessDate(matchedAt),orderAmountUSD:legacy?1000:1200,
    amountUSDT:legacy?100:120,amountNEX:0,status:legacy?'frozen':'unlocked',
    ts:matchedAt,unlockAt:Math.min(at,matchedAt+7*day),
  };
  const { current, previous } = rankDevicePolicies(state, at);
  if (state.rankCoolingState === 'zero') {
    const order = demoH4TeamMembers(state, at).find(member => member.name === 'Maya').paidOrders[1];
    const { usdtSharePct } = demoPurchasePolicy(state);
    Object.assign(purchase, splitPurchaseBudget(money(order.amountUsdt * .1), usdtSharePct), {
      orderId: order.orderNo, sourceRef: order.orderNo, orderAmountUSD: order.amountUsdt,
      ts: order.paidAt, unlockAt: order.paidAt, status: 'unlocked', policyVersion: current.policyVersion,
    });
  }
  if (state.rankDeviceLevel2State === 'disabled') {
    const ts = current.effectiveAt - day;
    Object.assign(device, deviceRewardAmounts(device.orderAmountUSD, device.layer, previous), {
      ts, unlockAt: ts + previous.coolingDays * day, status: 'unlocked', policyVersion: previous.policyVersion,
    });
  }
  return [purchase,device,network,binary].sort((a,b)=>b.ts-a.ts);
}

// Team-reward rows for the my-rank boards F2 / F2b / F3 and the monthly-reward row (DESIGN F2, 5, 6):
// friends' purchases (layer 1), friends-of-friends' purchases (layer 2), device earnings on both layers, and
// credited monthly rewards from the same facts as the rank page. Only used with a rank preset.
function demoRankPresetRewardRows(state,at) {
  const hour=3600000;
  const {current,previous}=rankDevicePolicies(state,at);
  const purchasePolicy = demoPurchasePolicy(state);
  const [, , , , , , l1Rate, l2Rate] = RANK_RULES[Number(state.rankPreset.slice(1))];
  const members = rankPresetTeamMembers(state, at);
  const membersById = new Map(members.map(member => [member.id, member]));
  const paidOrders = members.flatMap(member => member.paidOrders);
  const { influenceClampMin, influenceClampMax, promoMultiplier, exitCapRate } = demoPurchaseBudgetPolicy;
  const row = (id, kind, name, layer, basis, ts, unlockAt, amounts, policyVersion) => ({
    id: 'demo-rank-' + id, kind, sourceUserName: name, layer, orderId: 'DEMO-RANK-' + id,
    sourceRef: 'DEMO-RANK-' + id, orderAmountUSD: basis, ...amounts,
    ts, unlockAt, status: unlockAt <= at ? 'unlocked' : 'cooling', policyVersion,
  });
  const purchases = members.flatMap(member => member.paidOrders.filter(order => order.rewardId).map(order => {
    const { name, layer, sponsorUserId } = member;
    const { amountUsdt: basis, paidAt } = order;
    const cap = money(basis * exitCapRate);
    let budget = Math.min(cap, money(money(basis * l1Rate) * promoMultiplier));
    if (layer === 2) {
      const month = demoTeamBusinessDate(paidAt).slice(0, 7);
      const volume = paidOrders.filter(order => order.paidAt <= paidAt && demoTeamBusinessDate(order.paidAt).startsWith(month))
        .reduce((sum, order) => sum + order.amountUsdt, 0);
      const influence = money(Math.max(influenceClampMin, Math.min(influenceClampMax, 1 + Math.log10(Math.max(volume, 1) / 100))));
      const sponsor = membersById.get(sponsorUserId);
      const firstLayerBudget = Math.min(cap, money(money(basis * RANK_RULES[sponsor.vRank][6]) * promoMultiplier));
      const secondLayerBudget = money(money(money(basis * l2Rate) * influence) * promoMultiplier);
      budget = Math.min(money(cap - firstLayerBudget), secondLayerBudget);
    }
    const amounts = layer === 1 ? splitPurchaseBudget(budget, purchasePolicy.usdtSharePct)
      : { amountUSDT: budget, amountNEX: money(budget * demoPurchaseNexPerUsdt[layer - 1]) };
    return row(order.rewardId, layer === 1 ? 'direct_purchase' : 'unilevel', name, layer, basis,
      paidAt, paidAt + purchasePolicy.coolingDays * day, amounts, current.policyVersion);
  }));
  const secondLayerEnabled = current.enabled && current.level2RatePct > 0;
  const devices = [
    ['d1', 'Lina', 100, current.enabled ? at - hour : current.effectiveAt - day - hour],
    ['d2', 'Minh Anh', 80, secondLayerEnabled ? at - 2 * hour : current.effectiveAt - day - 2 * hour],
    ['d3', 'Kai', 40, current.enabled ? current.effectiveAt + hour : current.effectiveAt - 2 * day],
    ['d4', 'Rustam Abdullayev', 25, current.effectiveAt - 2 * day - hour],
  ].flatMap(([id, name, basis, scheduledAt]) => {
    const member = members.find(member => member.name === name);
    const sourceOrder = member?.paidOrders.find(order => order.sourceDeviceId);
    if (!sourceOrder) return [];
    const { layer, joinedAt } = member;
    const ts = Math.max(scheduledAt, Math.max(Date.parse(joinedAt), sourceOrder.paidAt, sourceOrder.activatedAt) + hour);
    const policy = ts >= current.effectiveAt ? current : previous;
    const unlockAt = ts + policy.coolingDays * day;
    return [{ ...row(id, 'direct_device_earning', name, layer, basis, ts, unlockAt,
      deviceRewardAmounts(basis, layer, policy), policy.policyVersion), sourceDeviceId: sourceOrder.sourceDeviceId }];
  });
  return [
    ...purchases,
    ...devices,
    ...rankSalaryPaidFacts(state,Date.now()).map(item=>({
      id:item.claimNo, kind:'vrank_salary', sourceUserName:'System', layer:0,
      ...(!item.legacyProjection && {salaryMonth:item.month, salaryRank:item.rankCode}),
      amountUSDT:Number(item.amountUsdt), amountNEX:0, status:'unlocked',
      ts:Date.parse(item.claimedAt), unlockAt:Date.parse(item.claimedAt),
    })),
  ];
}

export function demoCommissionEvents(state,at) {
  return demoCommissionGroups(state,at).flatMap(group=>
    [['USDT',group.amountUSDT],['NEX',group.amountNEX]].filter(([,amount])=>amount>0).map(([currency,amount])=>({
      ...group,id:`CM-${group.id}-${currency}`,currency,
      amountUSDT:currency==='USDT'?amount:0,amountNEX:currency==='NEX'?amount:0,
      settlementState:'CANONICAL',withdrawable:group.status==='unlocked',
    })));
}

export function demoTeamWeek(at) {
  const thursday=new Date(demoTeamBusinessDate(at));
  thursday.setUTCDate(thursday.getUTCDate()+3-(thursday.getUTCDay()+6)%7);
  const year=thursday.getUTCFullYear(),week=Math.floor((thursday-Date.UTC(year,0,1))/(7*day))+1;
  return `${year}-W${String(week).padStart(2,'0')}`;
}

export const demoCreditedDeposit=state=>demoHasEarningsHistory(state)
  ?{depositId:'CR-77',grossAmountUsdt:50.123456,creditedUsdt:50,createdAt:state.previewFactsAt}:null;

export const demoChainDepositFee = '0';
export const demoChainDepositMinimum = '5';

export function demoChainDepositAddress(state, network, allocate = false) {
  const existing = state.chainDepositAddresses?.[network]
    ?? state.chainDepositEvents?.find(row => row.network === network)?.address;
  if (existing) return existing;
  if (!allocate && !demoCreditedDeposits(state).some(row => row.deposit?.network === network)) return null;
  const addresses = state.chainDepositAddresses ??= {};
  return addresses[network] = '0x' + (network === 'ERC20' ? '2' : '1').repeat(40);
}

function demoCreditedDeposits(state) {
  const original = demoCreditedDeposit(state);
  if (!original) return [];
  const deposit = (network, marker, grossAmountUsdt, creditedUsdt) => ({ network, txHash: '0x' + marker.repeat(64),
    grossAmountUsdt, feeUsdt: demoChainDepositFee, creditedUsdt });
  const history = [{ ...original, deposit: deposit('BEP20', 'a', '50.123456', '50') }];
  if (state.billRefsState !== 'b84-deposit') return history;
  return [
    ...history,
    { depositId: 'CR-80', createdAt: original.createdAt - 500, deposit: deposit('BEP20', 'c', '50.234567', '50.111111'), creditedUsdt: 50.111111 },
    { depositId: 'CR-78', createdAt: original.createdAt - 1000, deposit: deposit('ERC20', 'b', '62.345678', '62.222222'), creditedUsdt: 62.222222 },
    { depositId: 'CR-79', createdAt: original.createdAt - 2000, deposit: null, creditedUsdt: 73.333333 },
    { depositId: 'CR-81', createdAt: original.createdAt - 3000, creditedUsdt: 84.444444 },
  ];
}

export function demoChainDeposits(state) {
  const history = demoCreditedDeposits(state).filter(row => row.deposit).map(({ depositId, createdAt, deposit }) => ({
    depositId, createdAt, creditedAt: createdAt, network: deposit.network, txHash: deposit.txHash,
    address: demoChainDepositAddress(state, deposit.network, true), confirmations: 15, requiredConfirmations: 15, status: 'CREDITED',
    grossAmountUsdt: Number(deposit.grossAmountUsdt), grossAmountUsdtExact: deposit.grossAmountUsdt,
    creditedUsdt: Number(deposit.creditedUsdt), creditedUsdtExact: deposit.creditedUsdt,
  }));
  return [...(state.chainDepositEvents ?? [])].reverse().concat(history);
}

export function recordDemoChainDeposit(state, { network, grossAmountUsdt, creditedUsdt, createdAt }) {
  const events = state.chainDepositEvents ??= [];
  const sequence = events.length + 1, depositId = 'CR-' + (1000 + sequence);
  const txHash = '0x' + sequence.toString(16).padStart(64, '0');
  const credited = Number(creditedUsdt) > 0;
  const event = {
    depositId, network, txHash, address: demoChainDepositAddress(state, network, true), createdAt,
    grossAmountUsdt: Number(grossAmountUsdt), grossAmountUsdtExact: grossAmountUsdt,
    creditedUsdt: Number(creditedUsdt), creditedUsdtExact: creditedUsdt,
    confirmations: 15, requiredConfirmations: 15, status: credited ? 'CREDITED' : 'DUST_HOLD',
    creditedAt: credited ? createdAt : null,
  };
  events.push(event);
  if (!credited) return event;
  postDemoWalletEntries(state, {
    bizNo: depositId, bizType: 'CHAIN_TOPUP', asset: 'USDT', direction: 'IN', category: 'topup', at: createdAt,
    amount: Number(creditedUsdt), amountExact: creditedUsdt, network,
    deposit: { network, txHash, grossAmountUsdt, feeUsdt: demoChainDepositFee, creditedUsdt },
  });
  return event;
}

export function demoTeamPeriod(period,now,snapshotAt) {
  const end=snapshotAt?.trim()?Date.parse(snapshotAt):now;
  if(!Number.isFinite(end)||end>now+5000){
    throw Object.assign(new Error('TEAM_SNAPSHOT_INVALID'),{status:422});
  }
  const date=demoTeamBusinessDate(end),base=Date.parse(date);
  const start=period==='all'?'':period==='month'?date.slice(0,7)+'-01':period==='today'?date
    :new Date(base-((new Date(base).getUTCDay()+6)%7)*day).toISOString().slice(0,10);
  return {period,snapshotAt:snapshotAt?.trim()?snapshotAt:new Date(end).toISOString(),contains:at=>at<=end&&demoTeamBusinessDate(at)>=start};
}

export function demoCommissionTotals(rows) {
  return rows.reduce((s,row)=>{
    const credited=['unlocked','withdrawn'].includes(row.status);
    s.count++;
    s.amountUSDT+=row.amountUSDT;s.amountNEX+=row.amountNEX;
    if(credited){s.creditedUSDT+=row.amountUSDT;s.creditedNEX+=row.amountNEX;}
    else{s.pendingUSDT+=row.amountUSDT;s.pendingNEX+=row.amountNEX;}
    return s;
  },{amountUSDT:0,amountNEX:0,creditedUSDT:0,creditedNEX:0,pendingUSDT:0,pendingNEX:0,count:0});
}

export function demoReferralLedger(bills,limit) {
  const settled=bills.filter(row=>row.bizType==='REFERRAL_REWARD'&&row.asset==='UVT'
    &&row.direction==='IN'&&settledBill(row));
  return {settledCount:settled.length,lifetimeInviterNex:settled.reduce((sum,row)=>sum+row.amount,0),
    recentRewards:settled.slice(0,limit).map(row=>({settlementNo:row.bizNo.replace(/:INVITER$/,''),
      amountNex:row.amount,ledgerStatus:row.status,balanceAfter:row.balanceAfter,releaseBucket:'withdrawable',
      sourceEnvironment:'PRODUCTION',settledAt:row.createdAt}))};
}

export function demoWalletUsdt(state) {
  return accountDeletionWallet(state)?.usdtAvailable??state.walletBalance??(state.dataState==='empty'?0:52800.64);
}

export const demoHasEarningsHistory=state=>state.dataState!=='empty'
  &&state.accountDeletionState!=='clear';

export function initializeDemoWalletCheckpoint(state) {
  // An imported wallet already includes its old orders and any saved milestone credits.
  state.walletUsdtCheckpoint??=money(demoWalletUsdt(state)-(state.milestoneClaimReceipts??[])
    .filter(({result})=>result?.rewardType==='USDT').reduce((total,{result})=>total+result.rewardAmount,0));
}

// Store the resulting balance at the write, including movements earlier in the same millisecond.
export function postDemoWalletEntries(state,...entries) {
  initializeDemoWalletCheckpoint(state);
  state.walletNexCheckpoint??=savedNexBalance(state);
  const balances={USDT:demoWalletUsdt(state),UVT:savedNexBalance(state)};
  for(const entry of entries)balances[entry.asset]=money(balances[entry.asset]+signed(entry));
  if(entries.some(entry=>entry.asset==='USDT'))state.walletBalance=balances.USDT;
  if(entries.some(entry=>entry.asset==='UVT'))state.walletNexBalance=balances.UVT;
  const rows=entries.map(entry=>({id:entry.bizNo,status:'SUCCESS',remark:'',...entry,balanceAfter:balances[entry.asset]}));
  (state.walletMovements??=[]).push(...rows);
  if(entries.some(entry=>entry.asset==='UVT')){
    const uvt=demoWalletNex(state,entries[0].at);
    for(const row of rows)if(row.asset==='UVT')row.balanceAfter=uvt;
  }
  return balances;
}

export function seedDemoRewardClawback(state, at) {
  // Leave the earlier demo ledger funded before the clawback crosses zero.
  state.walletBalance=160;
  postDemoWalletEntries(state, {
    id:'WL-515',bizNo:'F1-VRANKREWARD-REVERSE-PAYOUT-1-456',bizType:'VRANK_REWARD_PAYOUT_REVERSED',
    asset:'USDT',direction:'OUT',amount:172.123456,amountExact:'172.123456',
    category:'clawback',presentationCode:'rewardClawback',publicReference:null,
    remark:'F1 V-Rank voucher clawback | rank=V1',at,
  });
  state.walletMovements.at(-1).balanceAfterExact=state.walletBalance.toFixed(6);
}

function savedNexBalance(state) {
  return accountDeletionWallet(state)?.nexAvailable??state.walletNexBalance??(state.dataState==='empty'?0:1280);
}

export function demoWalletNex(state,now) {
  const posted=new Set(state.walletMovements?.map(row=>row.bizNo));
  return money(demoH4Credits(state,now).reduce((balance,row)=>
    balance+(row.asset==='USDT'||row.includedInBalance||posted.has(row.id)?0:row.amount),savedNexBalance(state)));
}

export function postDemoActivityRewards(state,now) {
  const posted=new Set(state.walletMovements?.map(row=>row.bizNo));
  for(const credit of demoH4Credits(state,now)){
    if(credit.includedInBalance||posted.has(credit.id))continue;
    postDemoWalletEntries(state,{bizType:credit.type,bizNo:credit.id,asset:credit.asset??'UVT',direction:'IN',
      amount:credit.amount,at:credit.at,category:'bonus'});
  }
}

export const demoStreakMilestones=[[3,'UVT',5,null],[7,'UVT',15,null],[14,'USDT',1,null],[21,'UVT',100,null],
  [30,'SPIN',1,null],[60,'USDT',10,null],[100,'BADGE',0,'STREAK_MASTER']];

export function initializeDemoWalletHistory(state,accountAt) {
  state.walletLegacySeed??=false;
  const days=demoHasEarningsHistory(state)?({normal:12,broken:7}[state.streakState]??0):0;
  const anchor=days===12&&state.walletOpeningMilestoneAt!=null?state.walletOpeningMilestoneAt+10*day:
    state.streakSeedAt??accountAt;
  state.walletOpeningStreak??={days,lastAt:days?anchor-(days===12?1:3)*day:null,
    checkedInAt:state.checkedIn&&demoHasEarningsHistory(state)?anchor:null};
  // Preserve the opening milestone's position before any recorded outflow.
  if(state.walletOpeningMilestoneAt===undefined){
    state.walletOpeningMilestoneAt=days===12?state.walletOpeningStreak.lastAt-9*day:null;
  }
}

export const demoHasOpeningMilestone=state=>state.walletOpeningMilestoneAt!=null;

export function initializeLegacyStreakSavers(state) {
  if(!state.walletLegacySeed||state.streakSaverBalance!=null)return;
  const starter=!state.saverUsed&&(state.streakState==='normal'
    ||state.streakState==='broken'&&!state.checkedIn);
  state.streakSaverBalance=demoHasEarningsHistory(state)?Number(starter)+demoH4Savers(state):0;
}

function openingCheckIns(state) {
  const {days,lastAt,checkedInAt}=state.walletOpeningStreak;
  const rows=Array.from({length:days},(_,index)=>({at:lastAt-(days-1-index)*day,streakDays:index+1}));
  if(checkedInAt!==null)rows.push({at:checkedInAt,streakDays:days===12?13:state.saverUsed?8:1});
  return rows.map(row=>({...row,checkInDate:demoTeamBusinessDate(row.at)}));
}

export function demoStreakFacts(state,now) {
  const today=demoTeamBusinessDate(now),yesterday=demoTeamBusinessDate(now-day);
  const checkIns=[...openingCheckIns(state),...(state.walletMovements??[]).filter(row=>row.bizType==='DAILY_CHECK_IN')
    .map(row=>({...row.detail,at:row.at}))];
  const last=checkIns.at(-1);
  let lastCheckInDate=last?.checkInDate??null,streakDays=last?.streakDays??0;
  if(state.saverUsed&&(!last||last.at<=(state.saverUsedAt??state.previewFactsAt))){
    streakDays=state.saverRestoredStreak??7;
    lastCheckInDate=demoTeamBusinessDate((state.saverUsedAt??state.previewFactsAt)-day);
  }
  const longestStreak=Math.max(streakDays,...checkIns.map(row=>row.longestStreak??row.streakDays));
  const badgeUnlockedAt=[1,7].map(days=>checkIns.find(row=>row.streakDays>=days)?.at??null);
  return {currentStreak:[today,yesterday].includes(lastCheckInDate)?streakDays:0,longestStreak,badgeUnlockedAt,
    streakSavers:state.streakSaverBalance??Math.max(0,Number(state.walletOpeningStreak.days>0)+demoH4Savers(state)-Number(Boolean(state.saverUsed))),
    lastCheckInDate,checkedInToday:lastCheckInDate===today};
}

export function demoPayoutDateOrders(state, now) {
  if (state.withdrawReviewState !== 'payout-dates' || state.dataState === 'empty') return [];
  // Use earlier Vietnam business dates so the historical withdrawals do not count against today's quota.
  const sampleAt = state.withdrawalSamplesAt ??= now;
  const yesterday = new Date(Date.parse(demoTeamBusinessDate(sampleAt)) - day);
  const vietnamMidnight = yesterday.getTime() - 7 * 3600000;
  return [
    { withdrawalNo: 'WD-' + '3'.repeat(32), weekday: 5, minute: 15, amount: 60 },
    { withdrawalNo: 'WD-' + '4'.repeat(32), weekday: 2, minute: 23 * 60 + 45, amount: 70 },
  ].map(({ withdrawalNo, weekday, minute, amount }) => {
    const daysBack = (yesterday.getUTCDay() - weekday + 7) % 7;
    const at = vietnamMidnight - daysBack * day + minute * 60000;
    return { withdrawalNo, amount, netReceive: amount - 1, fee: 1, status: 'PROCESSING', at, riskRoute: 'manual' };
  });
}

export function demoWalletBills(state,now,seedAt,tasks,longRefs) {
  initializeDemoWalletCheckpoint(state);
  const events=demoCommissionGroups(state,seedAt);
  const commissions=events.filter(event=>['unlocked','withdrawn'].includes(event.status));
  const cooling=events.find(event=>event.kind==='direct_device_earning');
  const movements=state.walletMovements??[];
  const posted=new Set(movements.map(row=>row.bizNo));
  const openingMilestones=new Set(state.milestoneClaims??[]);
  if(demoHasOpeningMilestone(state))openingMilestones.add(1);
  for(const {result} of state.milestoneClaimReceipts??[])if(result)openingMilestones.delete(result.milestoneId);
  const checkIns=openingCheckIns(state).filter(row=>!posted.has('DAILY:900001:'+row.checkInDate));
  const chainDeposits=demoCreditedDeposits(state);
  const seeds=!demoHasEarningsHistory(state)?[]:[
    ['COMPUTE_EARNING','UVT','IN',15,'earn',seedAt],
    ...chainDeposits.map(deposit=>['CHAIN_TOPUP','USDT','IN',deposit.creditedUsdt,'topup',deposit.createdAt,'SUCCESS',deposit.depositId]),
    ['REFERRAL_REWARD','UVT','IN',10,'bonus',seedAt-day,'SUCCESS',
      state.walletLegacySeed?undefined:'REF-000000000000000000000001:INVITER'],
    ['DEVICE_PURCHASE','USDT','OUT',1299,'purchase',seedAt-2*day],
    ...checkIns.map(({at,streakDays,checkInDate})=>['DAILY_CHECK_IN','UVT','IN',1+(streakDays%7===0?5:0),
      'bonus',at,'SUCCESS','DAILY:900001:'+checkInDate]),
    ['COMPUTE_EARNING','USDT','IN',128.5,'earn',seedAt-4*day],
    ['COMPUTE_EARNING','USDT','IN',.00032,'earn',seedAt-5*day],
    // Saved legacy ledgers keep their original pending row and identity.
    ...(state.walletLegacySeed&&cooling?[['TEAM_COMMISSION','UVT','IN',cooling.amountNEX,'refer',cooling.ts,'PENDING']]:[]),
    ...tasks.filter(task=>!task.deliveryCycle&&!posted.has(task.taskNo))
      .map(task=>['COMPUTE_TASK_REWARD','USDT','IN',task.amount,'bonus',task.postedAt,'SUCCESS',task.taskNo,task.batchNo]),
    ...commissions.filter(event=>event.kind!=='vrank_salary'||!posted.has(`${event.id}-RELEASE`))
      .flatMap(event=>[['USDT',event.amountUSDT],['UVT',event.amountNEX]].filter(([,amount])=>amount>0)
      .map(([asset,amount])=>['TEAM_COMMISSION',asset,'IN',amount,'refer',event.unlockAt,'SUCCESS',`${event.id}-RELEASE`])),
    ...demoStreakMilestones.flatMap(([milestoneDay,asset,amount],index)=>{
      const id=index+1,bizNo='DAILY-MS:900001:'+id;
      if(!openingMilestones.has(id)||posted.has(bizNo)||!['USDT','UVT'].includes(asset))return [];
      const at=(id===1?state.walletOpeningMilestoneAt:null)??checkIns.find(row=>row.streakDays===milestoneDay)?.at??seedAt;
      return [['DAILY_MILESTONE',asset,'IN',amount,'achievement',at,'SUCCESS',bizNo]];
    }),
    ...(state.walletLegacySeed?[10,...(state.earningClaimed?[100]:[])].flatMap((amount,index)=>{
      const bizNo='EARNING-MS:900001:demo-earning-'+index;
      return posted.has(bizNo)?[]:[['EARNING_MILESTONE','UVT','IN',amount,'achievement',seedAt,'SUCCESS',bizNo]];
    }):[]),
  ].map(([bizType,asset,direction,amount,category,at,status='SUCCESS',bizNo,batchNo])=>({
    id:`seed:${asset}:${bizNo??`${bizType}:${direction}:${amount}`}`,bizNo:bizNo??`DEMO-${bizType}-${amount}`,bizType,asset,direction,amount,category,at,status,remark:'',batchNo,
  }));
  for (const row of seeds.filter(row => row.bizType === 'CHAIN_TOPUP')) {
    const original = chainDeposits.find(entry => entry.depositId === row.bizNo);
    row.deposit = original.deposit;
    row.amountExact = original.deposit?.creditedUsdt ?? String(original.creditedUsdt);
    if (original.deposit) row.network = original.deposit.network;
  }
  const history=demoDeletionHistory(state);
  const swap=history?.swap;
  const stake=demoDeletionStake(state);
  const historicalEntries=[
    ...(swap?[
      [swap.exchangeNo+'-OUT','UVT','OUT',swap.fromAmount,'EXCHANGE_SWAP','swap',swap.at],
      [swap.exchangeNo+'-IN','USDT','IN',swap.toAmount,'EXCHANGE_SWAP','swap',swap.at],
    ]:[]),
    ...(history?.withdrawals??demoPayoutDateOrders(state,now)).flatMap(withdrawal=>[
      [withdrawal.withdrawalNo+':USDT:PRINCIPAL','USDT','OUT',withdrawal.netReceive,'WITHDRAW_NET_PRINCIPAL','withdraw',withdrawal.at],
      [withdrawal.withdrawalNo+':USDT:NETWORK_FEE','USDT','OUT',withdrawal.fee,'WITHDRAW_NETWORK_FEE','withdraw',withdrawal.at],
    ]),
    ...(stake?[[stake.positionNo+'-OPEN','USDT','OUT',stake.amountUsdt,'STAKING_OPEN','stake',Date.parse(stake.lockedAt)]]:[]),
  ];
  seeds.push(...historicalEntries.map(([bizNo,asset,direction,amount,bizType,category,at])=>
    ({id:bizNo,bizNo,bizType,asset,direction,amount,category,at,status:'SUCCESS',remark:''})));
  seeds.push(...longRefs.map(([bizNo,asset,direction,amount,bizType,category,at])=>
    ({id:bizNo,bizNo,bizType,asset,direction,amount,category,at,status:'SUCCESS',remark:''})));
  const credits=demoH4Credits(state,now).filter(row=>!posted.has(row.id)).map(({id,type,amount,at,includedInBalance,asset='UVT'})=>({
    id,bizNo:id,bizType:type,asset,direction:'IN',amount,at,includedInBalance,status:'SUCCESS',remark:'',category:'bonus',
  }));
  for(const {at,result} of state.milestoneClaimReceipts??[]){
    if(!result)continue;
    const {milestoneId,rewardType:asset,rewardAmount:amount}=result;
    if(asset!=='UVT'&&asset!=='USDT')continue;
    const bizNo=`DAILY-MS:900001:${milestoneId}`;
    if(posted.has(bizNo))continue;
    credits.push({id:bizNo,bizNo,bizType:'DAILY_MILESTONE',asset,direction:'IN',amount,at,
      includedInBalance:asset==='UVT',status:'SUCCESS',remark:'H5 daily milestone claim',category:'achievement',presentationCode:'achievement'});
  }
  const debits=(state.walletPurchaseDebits??[]).map(({orderNo,amount,at})=>({
    id:orderNo,bizNo:orderNo,bizType:'ORDER_PURCHASE',asset:'USDT',direction:'OUT',amount,at,
    status:'SUCCESS',category:'purchase',remark:'UVEL wallet order settlement',
  }));
  const deliveries=tasks.filter(task=>task.deliveryCycle&&!posted.has(task.taskNo)).map(({taskNo,amount,postedAt,batchNo})=>({
    id:taskNo,bizNo:taskNo,bizType:'COMPUTE_TASK_REWARD',asset:'USDT',direction:'IN',amount,at:postedAt,
    status:'SUCCESS',category:'bonus',remark:'',batchNo,
  }));
  // The USDT checkpoint predates newly modeled movements. Historic seed credits
  // were already included. UVT still uses the saved balance and import markers.
  const balances={USDT:state.walletUsdtCheckpoint,UVT:state.walletNexCheckpoint??savedNexBalance(state)};
  for(const row of [...seeds.filter(settledBill),...credits.filter(row=>row.includedInBalance)])balances[row.asset]-=signed(row);
  const rows=[...seeds,...credits,...debits,...deliveries,...movements].sort((left,right)=>left.at-right.at);
  const batchTotals=new Map(),batchBalances=new Map();
  for(const row of rows)if(row.batchNo&&settledBill(row)){
    const key=`${row.batchNo}:${row.asset}`;
    batchTotals.set(key,(batchTotals.get(key)??0)+signed(row));
  }
  return rows.map(({at,includedInBalance,batchNo,detail,commandKey,...row})=>{
    const key=batchNo&&`${batchNo}:${row.asset}`;
    if(row.balanceAfter!==undefined)balances[row.asset]=row.balanceAfter;
    else if(settledBill(row)&&(!key||!batchBalances.has(key))){
      balances[row.asset]=money(balances[row.asset]+(key?batchTotals.get(key):signed(row)));
      if(key)batchBalances.set(key,balances[row.asset]);
    }
    return {...row,balanceAfter:money(batchBalances.get(key)??balances[row.asset]),createdAt:new Date(at).toISOString()};
  }).reverse();
}

export function demoTaskPeriods(tasks,now) {
  // Home and wallet task summaries use the legacy Shanghai business calendar.
  const date=businessDate.format(now);
  const dayStart=Date.parse(date)-8*3600000;
  const weekStart=dayStart-((new Date(Date.parse(date)).getUTCDay()+6)%7)*day;
  const monthStart=Date.parse(date.slice(0,7)+'-01')-8*3600000;
  const periods={today:[],week:[],month:[],all:[],yesterday:[]};
  for(const task of tasks){
    const at=task.completedAt;
    if(at>=now)continue;
    periods.all.push(task);
    if(at>=weekStart)periods.week.push(task);
    if(at>=monthStart)periods.month.push(task);
    if(at>=dayStart)periods.today.push(task);
    if(at>=dayStart-day&&at<now-day)periods.yesterday.push(task);
  }
  const totals=rows=>({usdt:money(rows.reduce((sum,task)=>sum+task.amount,0)),
    nex:money(rows.reduce((sum,task)=>sum+(task.nex??0),0)),jobCount:rows.length});
  const {yesterday:previous,...views}=Object.fromEntries(Object.entries(periods).map(([name,rows])=>[name,totals(rows)]));
  const delta=money(views.today.usdt-previous.usdt);
  return {...views,todayVsYesterdayUsdt:delta,todayVsYesterdayPct:views.today.jobCount&&previous.usdt>0?Number((delta/previous.usdt*100).toFixed(2)):null};
}

export function demoWalletBillSummary(bills,now) {
  const today=businessDate.format(now),month=today.slice(0,7);
  const rewards=bills.filter(reward);
  const nex=bills.filter(row=>row.asset==='UVT');
  const sum=(rows,amount=row=>row.amount)=>money(rows.reduce((total,row)=>total+amount(row),0));
  return {...source,timeZone,asOf:new Date(now).toISOString(),
    rewardsUsdt:sum(rewards.filter(row=>row.asset==='USDT')),
    rewardsNex:sum(rewards.filter(row=>row.asset==='UVT')),
    latestRewardAt:rewards[0]?.createdAt??null,
    settledRewardsNex:sum(rewards.filter(row=>row.asset==='UVT'&&settledBill(row))),
    pendingNex:sum(nex.filter(row=>row.status==='PENDING')),
    todayNexEarn:sum(nex.filter(row=>businessDate.format(new Date(row.createdAt))===today),signed),
    monthBillCount:bills.filter(row=>businessDate.format(new Date(row.createdAt)).slice(0,7)===month).length,
    withdrawalOffsetNexSpent:0,recentNexBills:nex.slice(0,10)};
}

export function demoWalletBillList(bills,params) {
  const asset=params.get('asset')?.trim().toUpperCase();
  const direction=params.get('direction')?.trim().toUpperCase();
  const category=params.get('category')?.trim().toUpperCase();
  if((params.has('asset')&&!['USDT','UVT'].includes(asset))
    ||(params.has('direction')&&!['IN','OUT'].includes(direction))
    ||(params.has('category')&&category!=='REWARD')){
    throw Object.assign(new Error('WALLET_BILLS_FILTER_INVALID'),{status:400});
  }
  const matches=row=>(!asset||row.asset===asset)&&(!direction||row.direction===direction&&row.amount>0)
    &&(category!=='REWARD'||reward(row));
  const filtered=bills.filter(matches);
  const page=Number(params.get('page')??1),pageSize=Number(params.get('pageSize')??20);
  if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100
    ||(page-1)*pageSize>2147483647){
    throw Object.assign(new Error('WALLET_BILLS_PAGE_INVALID'),{status:400});
  }
  const cursor=params.get('cursor');
  const token=row=>Buffer.from(JSON.stringify([row.createdAt,row.id])).toString('base64url');
  let eligible=filtered.slice((page-1)*pageSize);
  if(cursor==='start')eligible=filtered;
  else if(cursor!==null){
    const boundary=bills.findIndex(row=>token(row)===cursor);
    if(boundary>=0)eligible=bills.slice(boundary+1).filter(matches);
    else {
      let decoded;
      try{decoded=JSON.parse(Buffer.from(cursor,'base64url').toString());}
      catch(error){if(!(error instanceof SyntaxError))throw error;}
      if(!Array.isArray(decoded)||decoded.length!==2||!Number.isFinite(Date.parse(decoded[0]))||typeof decoded[1]!=='string')
        throw Object.assign(new Error('WALLET_BILLS_CURSOR_INVALID'),{status:400});
      eligible=filtered.filter(row=>row.createdAt<decoded[0]);
    }
  }
  const pageRows=eligible.slice(0,pageSize),more=eligible.length>pageSize;
  return {...source,bills:pageRows,page,pageSize,total:filtered.length,nextPage:more?page+1:null,
    nextCursor:cursor!==null&&more?token(pageRows.at(-1)):null};
}

export function demoLifetimeEarningsUsdt(bills) {
  // AppProofMapper's posted USDT earning types represented in this preview.
  return money(bills.filter(row=>row.asset==='USDT'&&row.direction==='IN'&&settledBill(row)
    &&['COMPUTE_TASK_REWARD','TEAM_COMMISSION','WHEEL_REWARD','EVENT_REWARD','DAILY_MILESTONE',
      'GENESIS_EMISSION','REFERRAL_REWARD','TRIAL_BONUS'].includes(row.bizType)).reduce((total,row)=>total+row.amount,0));
}
