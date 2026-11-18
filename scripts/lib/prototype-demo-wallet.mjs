// The loopback account's visible ledger and wallet summaries.
import { accountDeletionWallet } from './prototype-demo-account.mjs';
import { demoH4Credits } from './prototype-demo-events.mjs';

const day=86400000;
const timeZone='Asia/Shanghai';
const businessDate=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
const source={source:'server',sourceEnvironment:'PRODUCTION'};
const money=value=>Number(value.toFixed(6));
const signed=row=>row.direction==='IN'?row.amount:-row.amount;
const settled=row=>row.status==='SUCCESS';
const reward=row=>row.direction==='IN'&&row.amount>0&&['bonus','refer','achievement'].includes(row.category);

export function demoSettledTasks(at) {
  return [['IG',2.34],['LL',8.5],['VG',5.4]].map(([taskClass,amount],index)=>{
    const completedAt=at-(index+1)*3600000;
    return {taskNo:'DEMO-TASK-'+(index+1),receiptNo:'DEMO-RECEIPT-'+(index+1),
      batchNo:index===0?'DEMO-BATCH-1':null,taskClass,amount,completedAt,postedAt:completedAt+600000};
  });
}

export function demoCommissionEvents(at) {
  return [
    ['direct_purchase','Maya','unlocked'],['direct_device_earning','Linh','cooling'],
    ['unilevel','Sam','withdrawn'],['binary','Rin','frozen'],
  ].map(([kind,sourceUserName,status],index)=>({id:'demo-commission-'+index,kind,sourceUserName,
    layer:index===0?1:2,orderId:'DEMO-ORDER-004',orderAmountUSD:1299,amountUSDT:25*(index+1),amountNEX:10,
    ts:at-index*day,unlockAt:status==='cooling'?at+day:at-index*day,status}));
}

export function demoWalletUsdt(state) {
  return accountDeletionWallet(state)?.usdtAvailable??state.walletBalance??(state.dataState==='empty'?0:52800.64);
}

export const demoHasEarningsHistory=state=>state.dataState!=='empty'
  &&(!state.accountDeletionState||state.accountDeletionState==='follow');

export function initializeDemoWalletCheckpoint(state) {
  // An imported wallet already includes its old orders and any saved milestone credits.
  state.walletUsdtCheckpoint??=money(demoWalletUsdt(state)-(state.milestoneClaimReceipts??[])
    .filter(({result})=>result?.rewardType==='USDT').reduce((total,{result})=>total+result.rewardAmount,0));
}

export function postDemoWalletUsdt(state,amount) {
  initializeDemoWalletCheckpoint(state);
  state.walletBalance=money(demoWalletUsdt(state)+amount);
}

function savedNexBalance(state) {
  return accountDeletionWallet(state)?.nexAvailable??state.walletNexBalance??(state.dataState==='empty'?0:1280);
}

export function demoWalletNex(state,now) {
  return money(demoH4Credits(state,now).reduce((balance,row)=>balance+(row.includedInBalance?0:row.amount),savedNexBalance(state)));
}

export function creditDemoDailyMilestone(state,asset,amount) {
  if(asset==='UVT')state.walletNexBalance=money(savedNexBalance(state)+amount);
  if(asset==='USDT')postDemoWalletUsdt(state,amount);
}

export function demoWalletBills(state,now,seedAt,tasks=demoSettledTasks(seedAt)) {
  initializeDemoWalletCheckpoint(state);
  const commissions=demoCommissionEvents(seedAt).filter(event=>['unlocked','withdrawn'].includes(event.status));
  const seeds=!demoHasEarningsHistory(state)?[]:[
    ['COMPUTE_EARNING','UVT','IN',15,'earn',seedAt],
    ['REFERRAL_REWARD','UVT','IN',10,'bonus',seedAt-day],
    ['DEVICE_PURCHASE','USDT','OUT',1299,'purchase',seedAt-2*day],
    ['DAILY_CHECK_IN','UVT','IN',5,'bonus',seedAt-3*day],
    ['COMPUTE_EARNING','USDT','IN',128.5,'earn',seedAt-4*day],
    ['COMPUTE_EARNING','USDT','IN',.00032,'earn',seedAt-5*day],
    ['TEAM_COMMISSION','UVT','IN',10,'refer',seedAt-day,'PENDING'],
    ...tasks.filter(task=>!task.deliveryCycle).map(task=>['COMPUTE_TASK_REWARD','USDT','IN',task.amount,'bonus',task.postedAt,'SUCCESS',task.taskNo,task.batchNo]),
    ...commissions.flatMap(event=>[['USDT',event.amountUSDT],['UVT',event.amountNEX]].map(([asset,amount])=>
      ['TEAM_COMMISSION',asset,'IN',amount,'refer',event.unlockAt,'SUCCESS',`${event.id}-${asset}-RELEASE`])),
  ].map(([bizType,asset,direction,amount,category,at,status='SUCCESS',bizNo,batchNo],index)=>({
    id:'demo-bill-'+index,bizNo:bizNo??'DEMO-'+(1000+index),bizType,asset,direction,amount,category,at,status,remark:'',batchNo,
  }));
  const credits=demoH4Credits(state,now).map(({id,type,amount,at,includedInBalance})=>({
    id,bizNo:id,bizType:type,asset:'UVT',direction:'IN',amount,at,includedInBalance,status:'SUCCESS',remark:'',category:'bonus',
  }));
  for(const {at,result} of state.milestoneClaimReceipts??[]){
    if(!result)continue;
    const {milestoneId,rewardType:asset,rewardAmount:amount}=result;
    if(asset!=='UVT'&&asset!=='USDT')continue;
    const bizNo=`DAILY-MS:900001:${milestoneId}`;
    credits.push({id:bizNo,bizNo,bizType:'DAILY_MILESTONE',asset,direction:'IN',amount,at,
      includedInBalance:asset==='UVT',status:'SUCCESS',remark:'H5 daily milestone claim',category:'achievement',presentationCode:'achievement'});
  }
  const debits=(state.walletPurchaseDebits??[]).map(({orderNo,amount,at})=>({
    id:orderNo,bizNo:orderNo,bizType:'ORDER_PURCHASE',asset:'USDT',direction:'OUT',amount,at,
    status:'SUCCESS',category:'purchase',remark:'UVEL wallet order settlement',
  }));
  const deliveries=tasks.filter(task=>task.deliveryCycle).map(({taskNo,amount,postedAt,batchNo})=>({
    id:taskNo,bizNo:taskNo,bizType:'COMPUTE_TASK_REWARD',asset:'USDT',direction:'IN',amount,at:postedAt,
    status:'SUCCESS',category:'bonus',remark:'',batchNo,
  }));
  // The USDT checkpoint predates newly modeled movements. Historic seed credits
  // were already included. UVT still uses the saved balance and import markers.
  const balances={USDT:state.walletUsdtCheckpoint,UVT:savedNexBalance(state)};
  for(const row of [...seeds.filter(settled),...credits.filter(row=>row.includedInBalance)])balances[row.asset]-=signed(row);
  const rows=[...seeds,...credits,...debits,...deliveries].sort((left,right)=>left.at-right.at);
  const batchTotals=new Map(),batchBalances=new Map();
  for(const row of rows)if(row.batchNo&&settled(row)){
    const key=`${row.batchNo}:${row.asset}`;
    batchTotals.set(key,(batchTotals.get(key)??0)+signed(row));
  }
  return rows.map(({at,includedInBalance,batchNo,...row})=>{
    const key=batchNo&&`${batchNo}:${row.asset}`;
    if(settled(row)&&(!key||!batchBalances.has(key))){
      balances[row.asset]=money(balances[row.asset]+(key?batchTotals.get(key):signed(row)));
      if(key)batchBalances.set(key,balances[row.asset]);
    }
    return {...row,balanceAfter:money(batchBalances.get(key)??balances[row.asset]),createdAt:new Date(at).toISOString()};
  }).reverse();
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
    settledRewardsNex:sum(rewards.filter(row=>row.asset==='UVT'&&settled(row))),
    pendingNex:sum(nex.filter(row=>row.status==='PENDING')),
    todayNexEarn:sum(nex.filter(row=>businessDate.format(new Date(row.createdAt))===today),signed),
    monthBillCount:bills.filter(row=>businessDate.format(new Date(row.createdAt)).slice(0,7)===month).length,
    withdrawalOffsetNexSpent:0,recentNexBills:nex.slice(0,10)};
}

export function demoWalletBillList(bills,params) {
  const asset=params.get('asset')?.trim().toUpperCase();
  const direction=params.get('direction')?.trim().toUpperCase();
  const category=params.get('category')?.trim().toUpperCase();
  const filtered=bills.filter(row=>(!asset||row.asset===asset)&&(!direction||row.direction===direction&&row.amount>0)
    &&(category!=='REWARD'||reward(row)));
  const page=Number(params.get('page')??1),pageSize=Number(params.get('pageSize')??20);
  return {...source,bills:filtered.slice((page-1)*pageSize,page*pageSize),page,pageSize,total:filtered.length,
    nextPage:filtered.length>page*pageSize?page+1:null,nextCursor:null};
}

export function demoLifetimeEarningsUsdt(bills) {
  // AppProofMapper's posted USDT earning types represented in this preview.
  return money(bills.filter(row=>row.asset==='USDT'&&row.direction==='IN'&&settled(row)
    &&['COMPUTE_TASK_REWARD','TEAM_COMMISSION','WHEEL_REWARD','EVENT_REWARD','DAILY_MILESTONE',
      'GENESIS_EMISSION','REFERRAL_REWARD','TRIAL_BONUS'].includes(row.bizType)).reduce((total,row)=>total+row.amount,0));
}
