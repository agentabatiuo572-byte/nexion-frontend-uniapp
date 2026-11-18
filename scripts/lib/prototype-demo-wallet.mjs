// The loopback account's visible ledger and wallet summaries.
import { accountDeletionWallet } from './prototype-demo-account.mjs';
import { demoH4Credits, demoH4Savers, demoTeamBusinessDate } from './prototype-demo-events.mjs';

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
  return [['IG',2.34],['LL',8.5],['VG',5.4]].map(([taskClass,amount],index)=>{
    const completedAt=at-(index+1)*3600000;
    return {taskNo:'DEMO-TASK-'+(index+1),receiptNo:'DEMO-RECEIPT-'+(index+1),
      batchNo:index===0?'DEMO-BATCH-1':null,deviceId:41,taskClass,amount,
      nex:state.walletLegacySeed?0:1,completedAt,postedAt:completedAt+600000,
      client:'Demo Studio',model:['SDXL','Llama 3.1','Video generation'][index]};
  });
}

export function demoCommissionEvents(state,at) {
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
    amountUSDT:legacy?50:3.5,amountNEX:legacy?10:11.71875,status:'cooling',
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

function savedNexBalance(state) {
  return accountDeletionWallet(state)?.nexAvailable??state.walletNexBalance??(state.dataState==='empty'?0:1280);
}

export function demoWalletNex(state,now) {
  const posted=new Set(state.walletMovements?.map(row=>row.bizNo));
  return money(demoH4Credits(state,now).reduce((balance,row)=>
    balance+(row.includedInBalance||posted.has(row.id)?0:row.amount),savedNexBalance(state)));
}

export function postDemoActivityRewards(state,now) {
  const posted=new Set(state.walletMovements?.map(row=>row.bizNo));
  for(const credit of demoH4Credits(state,now)){
    if(credit.includedInBalance||posted.has(credit.id))continue;
    postDemoWalletEntries(state,{bizType:credit.type,bizNo:credit.id,asset:'UVT',direction:'IN',
      amount:credit.amount,at:credit.at,category:'bonus'});
  }
}

export const demoHasOpeningMilestone=state=>demoHasEarningsHistory(state)&&state.streakState==='normal';

export function demoStreakFacts(state,now) {
  const anchor=state.streakSeedAt??state.previewFactsAt??now;
  const today=demoTeamBusinessDate(now),yesterday=demoTeamBusinessDate(now-day);
  const normal=demoHasEarningsHistory(state)&&state.streakState==='normal';
  const broken=demoHasEarningsHistory(state)&&state.streakState==='broken';
  const last=state.walletMovements?.findLast(row=>row.bizType==='DAILY_CHECK_IN'
    &&row.at>=(state.streakSeedAt??0));
  let longestStreak=normal?12:broken?7:0;
  let streakDays=longestStreak;
  let lastCheckInDate=normal?demoTeamBusinessDate(anchor-day):broken?demoTeamBusinessDate(anchor-3*day):null;
  if(state.saverUsed){
    streakDays=state.saverRestoredStreak??7;
    lastCheckInDate=demoTeamBusinessDate((state.saverUsedAt??anchor)-day);
  }
  if(state.checkedIn&&!last&&!state.streakSeedAt){
    streakDays=(normal?12:state.saverUsed?7:0)+1;
    lastCheckInDate=demoTeamBusinessDate(anchor);
  }
  if(last&&(!state.saverUsedAt||last.at>=state.saverUsedAt)){
    streakDays=last.detail.streakDays;
    lastCheckInDate=last.detail.checkInDate;
  }
  longestStreak=Math.max(longestStreak,streakDays,last?.detail.longestStreak??0);
  return {currentStreak:[today,yesterday].includes(lastCheckInDate)?streakDays:0,longestStreak,
    streakSavers:Math.max(0,Number(normal||broken)+demoH4Savers(state)-Number(Boolean(state.saverUsed))),
    lastCheckInDate,checkedInToday:lastCheckInDate===today};
}

export function demoWalletBills(state,now,seedAt,tasks=demoSettledTasks(state,seedAt)) {
  initializeDemoWalletCheckpoint(state);
  const events=demoCommissionEvents(state,seedAt);
  const commissions=events.filter(event=>['unlocked','withdrawn'].includes(event.status));
  const cooling=events.find(event=>event.kind==='direct_device_earning');
  const seeds=!demoHasEarningsHistory(state)?[]:[
    ['COMPUTE_EARNING','UVT','IN',15,'earn',seedAt],
    ['REFERRAL_REWARD','UVT','IN',10,'bonus',seedAt-day,'SUCCESS',
      state.walletLegacySeed?undefined:'REF-000000000000000000000001:INVITER'],
    ['DEVICE_PURCHASE','USDT','OUT',1299,'purchase',seedAt-2*day],
    ['DAILY_CHECK_IN','UVT','IN',5,'bonus',seedAt-3*day],
    ['COMPUTE_EARNING','USDT','IN',128.5,'earn',seedAt-4*day],
    ['COMPUTE_EARNING','USDT','IN',.00032,'earn',seedAt-5*day],
    ['TEAM_COMMISSION','UVT','IN',cooling.amountNEX,'refer',cooling.ts,'PENDING',
      state.walletLegacySeed?undefined:cooling.id+'-UVT-PENDING'],
    ...(demoHasOpeningMilestone(state)&&!state.walletLegacySeed?[['DAILY_MILESTONE','UVT','IN',5,'achievement',
      (state.streakSeedAt??seedAt)-10*day,'SUCCESS','DAILY-MS:900001:1']]:[]),
    ...tasks.filter(task=>!task.deliveryCycle).map(task=>['COMPUTE_TASK_REWARD','USDT','IN',task.amount,'bonus',task.postedAt,'SUCCESS',task.taskNo,task.batchNo]),
    ...commissions.flatMap(event=>[['USDT',event.amountUSDT],['UVT',event.amountNEX]].filter(([,amount])=>amount>0)
      .map(([asset,amount])=>['TEAM_COMMISSION',asset,'IN',amount,'refer',event.unlockAt,'SUCCESS',`${event.id}-${asset}-RELEASE`])),
    ...tasks.filter(task=>task.nex>0&&!task.deliveryCycle).map(task=>
      ['COMPUTE_TASK_REWARD','UVT','IN',task.nex,'bonus',task.postedAt,'SUCCESS',task.taskNo,task.batchNo]),
    ...(!state.walletLegacySeed?[['TEAM_COMMISSION','USDT','IN',cooling.amountUSDT,'refer',cooling.ts,'PENDING',
      cooling.id+'-USDT-PENDING']]:[]),
  ].map(([bizType,asset,direction,amount,category,at,status='SUCCESS',bizNo,batchNo],index)=>({
    id:'demo-bill-'+index,bizNo:bizNo??'DEMO-'+(1000+index),bizType,asset,direction,amount,category,at,status,remark:'',batchNo,
  }));
  const movements=state.walletMovements??[];
  const posted=new Set(movements.map(row=>row.bizNo));
  const credits=demoH4Credits(state,now).filter(row=>!posted.has(row.id)).map(({id,type,amount,at,includedInBalance})=>({
    id,bizNo:id,bizType:type,asset:'UVT',direction:'IN',amount,at,includedInBalance,status:'SUCCESS',remark:'',category:'bonus',
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
  const asOf=demoTeamBusinessDate(now);
  const start=Date.parse(asOf);
  const yesterday=new Date(start-day).toISOString().slice(0,10);
  const weekStart=new Date(start-((new Date(start).getUTCDay()+6)%7)*day).toISOString().slice(0,10);
  const dates=tasks.map(task=>({task,date:demoTeamBusinessDate(task.completedAt)}));
  const periods={today:[],week:[],month:[],all:[],yesterday:[]};
  for(const {task,date} of dates){
    periods.all.push(task);
    if(date>=weekStart)periods.week.push(task);
    if(date.startsWith(asOf.slice(0,7)))periods.month.push(task);
    if(date===asOf)periods.today.push(task);
    if(date===yesterday)periods.yesterday.push(task);
  }
  const totals=rows=>({usdt:money(rows.reduce((sum,task)=>sum+task.amount,0)),
    nex:money(rows.reduce((sum,task)=>sum+(task.nex??0),0)),jobCount:rows.length});
  const {yesterday:previous,...views}=Object.fromEntries(Object.entries(periods).map(([name,rows])=>[name,totals(rows)]));
  const delta=money(views.today.usdt-previous.usdt);
  return {...views,todayVsYesterdayUsdt:delta,todayVsYesterdayPct:previous.usdt?money(delta/previous.usdt*100):0};
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
  const filtered=bills.filter(row=>(!asset||row.asset===asset)&&(!direction||row.direction===direction&&row.amount>0)
    &&(category!=='REWARD'||reward(row)));
  const page=Number(params.get('page')??1),pageSize=Number(params.get('pageSize')??20);
  if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100
    ||(page-1)*pageSize>2147483647){
    throw Object.assign(new Error('WALLET_BILLS_PAGE_INVALID'),{status:400});
  }
  const cursor=params.get('cursor');
  let start=(page-1)*pageSize;
  if(cursor==='start')start=0;
  else if(cursor!==null){
    const boundary=filtered.findIndex(row=>Buffer.from(row.id).toString('base64url')===cursor);
    if(boundary===-1)throw Object.assign(new Error('WALLET_BILLS_CURSOR_INVALID'),{status:400});
    start=boundary+1;
  }
  const pageRows=filtered.slice(start,start+pageSize);
  const more=start+pageSize<filtered.length;
  return {...source,bills:pageRows,page,pageSize,total:filtered.length,nextPage:more?page+1:null,
    nextCursor:cursor!==null&&more?Buffer.from(pageRows.at(-1).id).toString('base64url'):null};
}

export function demoLifetimeEarningsUsdt(bills) {
  // AppProofMapper's posted USDT earning types represented in this preview.
  return money(bills.filter(row=>row.asset==='USDT'&&row.direction==='IN'&&settledBill(row)
    &&['COMPUTE_TASK_REWARD','TEAM_COMMISSION','WHEEL_REWARD','EVENT_REWARD','DAILY_MILESTONE',
      'GENESIS_EMISSION','REFERRAL_REWARD','TRIAL_BONUS'].includes(row.bizType)).reduce((total,row)=>total+row.amount,0));
}
