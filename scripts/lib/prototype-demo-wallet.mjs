// The loopback account's visible ledger and wallet summaries.
import { accountDeletionWallet, demoDeletionHistory } from './prototype-demo-account.mjs';
import { demoH4Credits, demoH4Savers, demoTeamBusinessDate } from './prototype-demo-events.mjs';
import { demoDeletionStake } from './prototype-demo-staking.mjs';

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
  if(state.deviceTaskSampleState==='long') {
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
      return {taskNo:'DEMO-TASK-'+(10+index),receiptNo:'DEMO-RECEIPT-L'+index,batchNo:'DEMO-BATCH-L'+index,
        deviceId:41,taskClass,taskName,amount:Number(rewardAmount),nex:0,completedAt,postedAt:completedAt+60000,
        durationSec:300,client:'Demo Studio',model:'SDXL',simulation:{executionMode:'SIMULATED',proofKind:'TASK_RECEIPT',
          modelExecuted:false,rewardAsset:'USDT',rewardAmount}};
    });
  }
  return [['IG',2.34],['LL',8.5],['VG',5.4]].map(([taskClass,amount],index)=>{
    const completedAt=at-(index+1)*3600000;
    return {taskNo:'DEMO-TASK-'+(index+1),receiptNo:'DEMO-RECEIPT-'+(index+1),
      batchNo:index<2?'DEMO-BATCH-'+(index+1):null,deviceId:41,taskClass,amount,
      nex:0,completedAt,postedAt:completedAt+600000,durationSec:600,
      taskName:['Image generation','Language inference','Video generation'][index],
      client:'Demo Studio',model:['SDXL','Llama 3.1','Video generation'][index]};
  });
}

export function demoCommissionGroups(state,at) {
  if(!demoHasEarningsHistory(state))return [];
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
  return [purchase,device,network,binary].sort((a,b)=>b.ts-a.ts);
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

export function demoWalletBills(state,now,seedAt,tasks=demoSettledTasks(state,seedAt)) {
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
  const deposit=demoCreditedDeposit(state);
  const seeds=!demoHasEarningsHistory(state)?[]:[
    ['COMPUTE_EARNING','UVT','IN',15,'earn',seedAt],
    ...(deposit?[['CHAIN_TOPUP','USDT','IN',deposit.creditedUsdt,'topup',deposit.createdAt,'SUCCESS',deposit.depositId]]:[]),
    ['REFERRAL_REWARD','UVT','IN',10,'bonus',seedAt-day,'SUCCESS',
      state.walletLegacySeed?undefined:'REF-000000000000000000000001:INVITER'],
    ['DEVICE_PURCHASE','USDT','OUT',1299,'purchase',seedAt-2*day],
    ...checkIns.map(({at,streakDays,checkInDate})=>['DAILY_CHECK_IN','UVT','IN',1+(streakDays%7===0?5:0),
      'bonus',at,'SUCCESS','DAILY:900001:'+checkInDate]),
    ['COMPUTE_EARNING','USDT','IN',128.5,'earn',seedAt-4*day],
    ['COMPUTE_EARNING','USDT','IN',.00032,'earn',seedAt-5*day],
    // Saved legacy ledgers keep their original pending row and identity.
    ...(state.walletLegacySeed?[['TEAM_COMMISSION','UVT','IN',cooling.amountNEX,'refer',cooling.ts,'PENDING']]:[]),
    ...tasks.filter(task=>!task.deliveryCycle).map(task=>['COMPUTE_TASK_REWARD','USDT','IN',task.amount,'bonus',task.postedAt,'SUCCESS',task.taskNo,task.batchNo]),
    ...commissions.flatMap(event=>[['USDT',event.amountUSDT],['UVT',event.amountNEX]].filter(([,amount])=>amount>0)
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
  const history=demoDeletionHistory(state);
  const swap=history?.swap;
  const stake=demoDeletionStake(state);
  const deletionEntries=[
    ...(swap?[
      [swap.exchangeNo+'-OUT','UVT','OUT',swap.fromAmount,'EXCHANGE_SWAP','swap',swap.at],
      [swap.exchangeNo+'-IN','USDT','IN',swap.toAmount,'EXCHANGE_SWAP','swap',swap.at],
    ]:[]),
    ...(history?.withdrawals??[]).flatMap(withdrawal=>[
      [withdrawal.withdrawalNo+':USDT:PRINCIPAL','USDT','OUT',withdrawal.netReceive,'WITHDRAW_NET_PRINCIPAL','withdraw',withdrawal.at],
      [withdrawal.withdrawalNo+':USDT:NETWORK_FEE','USDT','OUT',withdrawal.fee,'WITHDRAW_NETWORK_FEE','withdraw',withdrawal.at],
    ]),
    ...(stake?[[stake.positionNo+'-OPEN','USDT','OUT',stake.amountUsdt,'STAKING_OPEN','stake',Date.parse(stake.lockedAt)]]:[]),
  ];
  seeds.push(...deletionEntries.map(([bizNo,asset,direction,amount,bizType,category,at])=>
    ({id:bizNo,bizNo,bizType,asset,direction,amount,category,at,status:'SUCCESS',remark:''})));
  // Layout check: real-form references (36-char order number, its refund, a learning reward source).
  if(state.billRefsState==='long-refs'){
    const orderNo='ORD-7F3A9C2E5B8D41F6A0C3E9B27D5F1A84';
    seeds.push(...[[orderNo,'USDT','OUT',1299,'ORDER_PURCHASE','purchase',seedAt-3*3600000],
      ['E4-REFUND-'+orderNo,'USDT','IN',1299,'ORDER_REFUND','refund',seedAt-2*3600000],
      ['LEARN:1:ai-workload-fundamentals-intermediate:lesson-07','UVT','IN',5,'LEARNING_REWARD','bonus',seedAt-3600000]]
      .map(([bizNo,asset,direction,amount,bizType,category,at])=>({id:bizNo,bizNo,bizType,asset,direction,amount,category,at,status:'SUCCESS',remark:''})));
  }
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
