// Shared facts for the managed activities in the loopback preview.
const day=86400000;
const teamCalendar=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'});
export const demoTeamBusinessDate=at=>teamCalendar.format(at);
const localized=(locale,zh,en,vi)=>locale==='zh'?zh:locale==='vi'?vi:en;
const date=ms=>new Date(ms).toISOString();
const reject=(message,status=409)=>{throw Object.assign(new Error(message),{status});};

const rulesByCode={
  upgrade:{promotionActivityId:'demo-promo-0'},
  invite:{targetInvites:5,windowDays:7,giftProductNo:'stellarbox-pro',giftQuantity:1},
  spin:{},
  weekend:{action:'CHECKIN_MULTIPLIER',multiplier:2,timeZone:'UTC',weekdays:[6,7],budgetNex:100},
  season:{voucherId:'demo-season-voucher'},
  welcome:{windowDays:7,minRank:5,rewardNex:100,streakSavers:1},
};
const events=[
  ['upgrade','discount','设备升级礼','Device upgrade offer','Ưu đãi nâng cấp','/pages/store/store'],
  ['invite','referral','邀请好友挑战','Invitation challenge','Thử thách mời bạn','/pages/team/team'],
  ['spin','wheel','每日幸运转盘','Daily lucky spin','Vòng quay mỗi ngày',''],
  ['weekend','boost','周末签到加成','Weekend check-in boost','Thưởng điểm danh cuối tuần','/pages/daily/daily'],
  ['season','seasonal','秋季算力季','Autumn compute season','Mùa tính toán thu','/pages/events/events'],
  ['welcome','onboarding','新用户成长礼','New member rewards','Quà thành viên mới','/pages/missions/missions'],
];
const wheelSegments=[5,10,20,50,100,200].map((amount,index)=>({tierId:'demo-tier-'+index,rewardType:'UVT',rewardAmount:amount,rewardName:amount+' UVT',realOutflow:false,displayOrder:index}));
const joinedPresetEvents=['upgrade','invite','weekend','season'];

export function demoH4Account(state,now=Date.now(),presetDates=[]) {
  if(state.accountCreatedAt==null){
    const facts=[...presetDates,...(state.fleetSeed??[]).flatMap(device=>[device.purchasedAt,device.activatedAt]),
      ...(state.createdOrders??[]).flatMap(order=>[order.placedAt,order.paidAt,order.activatedAt])];
    // The ordinary team sample joins after registration. A saved invitation
    // sample has its own clock and can be older than the current process.
    if(state.h4Events&&hasInviteSample(state))facts.push(state.h4Events.at-day);
    const dates=facts.map(value=>typeof value==='number'?value:Date.parse(value))
      .filter(at=>Number.isFinite(at)&&at>0&&at<=now);
    state.accountCreatedAt=Math.min(now-42*day,...dates.map(at=>at-1));
  }
  return {createdAt:state.accountCreatedAt,rank:state.dataState==='empty'?0:state.ambassadorRank==='v5'?5:state.highestRank?8:2};
}

function wheelAward(at,sourceType) {
  const {tierId,rewardType,rewardAmount,rewardName}=wheelSegments[2];
  return {spinId:'demo-spin-'+at,eventId:'demo-spin',spinDate:date(at).slice(0,10),sourceType,tierId,rewardType,rewardAmount,rewardName,downgraded:false,downgradeReason:'NONE',source:'server',sourceEnvironment:'PRODUCTION'};
}

function scene(state,now) {
  if(state.h4Events)return state.h4Events;
  const mode=state.eventState;
  // These presets provide prior participation, timed referrals or a completed
  // spin. They never grant onboarding eligibility or set a projected status.
  const candidates=['joined','claimable','claimed'].includes(mode)
    ? joinedPresetEvents : mode==='mixed'?['invite']:[];
  const spins=mode==='ended'?[{result:wheelAward(now-2*day,'DAILY'),at:now-2*day}]:[];
  const record=state.h4Events={at:now,joined:[],spins,reminders:[],claims:{}};
  record.joined=candidates.filter(code=>eventWindow(code,state,now).state!=='upcoming');
  return record;
}

export function setDemoH4Scene(state,now) {
  delete state.h4Events;
  scene(state,now);
}

export function initializeDemoH4State(state,now=Date.now()) {
  // An imported scene uses saved evidence. The panel can still explicitly
  // supply sample spins, referrals and receipts by selecting a new scene.
  const restoreJoinedPreset=!state.h4Events&&state.eventState==='joined';
  const record=state.h4Events??={at:now,joined:
    state.eventState==='mixed'&&!state.eventStatuses?.['demo-invite']?['invite']:[],
    spins:[],reminders:[],claims:{},sampleInvites:false};
  if(record.legacyClaims?.includes('invite')&&!record.claims.invite)record.sampleInvites=false;
  delete record.legacyClaims;
  for(const [code] of events){
    const status=state.eventStatuses?.['demo-'+code];
    const joined=status==='JOINED'||restoreJoinedPreset&&joinedPresetEvents.includes(code);
    if(joined&&eventWindow(code,state,now).state!=='upcoming'&&!record.joined.includes(code))record.joined.push(code);
    if(state.reminders?.includes('demo-'+code)&&!record.reminders.includes(code))record.reminders.push(code);
  }
  // An open legacy scene saved no start time. Its dated spins still anchor
  // that window, but a scheduled wheel has a start and cannot award earlier.
  const scheduledWheelStart=state.eventState==='upcoming'?eventWindow('spin',state,now).startsAt:null;
  for(const {awardedAt,...result} of state.spinHistory??[]){
    // A bare "spun" flag has no day. Only a dated record for this wheel
    // establishes participation or consumes a daily opportunity.
    const spinDay=typeof result.spinDate==='string'&&Date.parse(result.spinDate+'T00:00:00Z');
    if(!Number.isFinite(spinDay)||spinDay>now||result.eventId!=='demo-spin'||!result.spinId
        ||!['DAILY','BONUS'].includes(result.sourceType)||result.rewardType!=='UVT'
        ||!Number.isFinite(result.rewardAmount)||result.rewardAmount<0
        ||record.spins.some(spin=>spin.result.spinId===result.spinId))continue;
    const awardedAtMs=Date.parse(awardedAt),at=Number.isFinite(awardedAtMs)?awardedAtMs:spinDay;
    if(scheduledWheelStart!==null&&at<scheduledWheelStart)continue;
    record.spins.push({result,at,historyOnly:true});
  }
  record.spins.sort((left,right)=>right.at-left.at);
  for(const key of ['eventStatuses','reminders','spun','spinHistory'])delete state[key];
}

const hasInviteSample=state=>['claimable','claimed'].includes(state.eventState)&&state.h4Events?.sampleInvites!==false;

export function demoH4TeamMembers(state,now) {
  if(state.dataState==='empty')return [];
  const {createdAt}=demoH4Account(state);
  const sampleAt=state.previewFactsAt??now;
  const month=demoTeamBusinessDate(now).slice(0,7);
  const members=[];
  const names=['Maya','Linh','Sam','Rin','Jo','Noah','Mina','Leo'];
  if(state.highestRank)names.push('Ari','Binh','Chau','Dan','Eli');
  // A catalog selection changes the offer, not an order already paid by a member.
  const hasCatalogPurchase=!state.walletLegacySeed||state.catalogPresetAt!=null;
  for(const [i,name] of names.entries()){
    const parent=members[[null,null,null,1,0,1,4,5][i]];
    const joinedAt=createdAt+(i+2)*day;
    const points=[160,240,320,360,440,480,560,640][i]??160;
    const paidOrders=[
      {orderNo:`DEMO-TEAM-${name.toUpperCase()}-1`,paidAt:joinedAt,points:3*points,
        amountUsdt:i===0&&!state.walletLegacySeed?100:1299},
      {orderNo:`DEMO-TEAM-${name.toUpperCase()}-2`,paidAt:sampleAt,points,amountUsdt:points},
    ];
    if(hasCatalogPurchase&&i===0)paidOrders.push({orderNo:'DEMO-TEAM-CATALOG-S1',
      paidAt:state.catalogPresetAt??sampleAt,points:state.catalogPresetAt==null?4800:6400,amountUsdt:1299});
    if(state.highestRank&&!parent)paidOrders.push({orderNo:`DEMO-TEAM-${name.toUpperCase()}-V8`,
      paidAt:joinedAt+day,points:400000,amountUsdt:40000});
    members.push({id:String(i<8?100+i:120+i-8),name,avatarUrl:null,vRank:state.highestRank&&!parent?7:i%4,layer:parent?parent.layer+1:1,
      sponsorUserId:parent?.id??'900001',leg:parent?.leg??(i%2?'A':'B'),joinedAt:date(joinedAt),paidOrders,
      monthComputePoints:paidOrders.filter(order=>order.paidAt<=now&&demoTeamBusinessDate(order.paidAt).slice(0,7)===month)
        .reduce((sum,order)=>sum+order.points,0),
      lifetimeComputePoints:paidOrders.filter(order=>order.paidAt<=now).reduce((sum,order)=>sum+order.points,0),
      status:i===6||i===7?'FROZEN':'ACTIVE',region:['SG','VN','JP'][i%3]});
  }
  if(hasInviteSample(state)){
    const {at}=scene(state,now);
    members.push(...['An','Bao','Chi','Dara','Emi'].map((name,i)=>({
      id:String(108+i),name,avatarUrl:null,vRank:0,layer:1,sponsorUserId:'900001',leg:i%2?'A':'B',
      joinedAt:date(at-day+i*3600000),paidOrders:[],monthComputePoints:0,lifetimeComputePoints:0,status:'ACTIVE',region:['SG','VN','JP'][i%3],
    })));
  }
  return members;
}

export function demoTeamNetworkMembers(state,now) {
  const members=[];
  const eligibleSponsors=new Set(['900001']);
  for(const {sponsorUserId,paidOrders,...member} of demoH4TeamMembers(state,now)){
    if(member.status!=='ACTIVE'||!eligibleSponsors.has(sponsorUserId))continue;
    members.push(member);
    eligibleSponsors.add(member.id);
  }
  return members;
}

// F3 whole-leg counts walk valid parent edges from the assigned direct roots.
export function demoBinaryLegMembers(members) {
  const children=new Map();
  for(const member of members){
    if(!children.has(member.sponsorUserId))children.set(member.sponsorUserId,[]);
    children.get(member.sponsorUserId).push(member);
  }
  const direct=children.get('900001')??[];
  const legs={A:[],B:[]};
  for(const leg of ['A','B']){
    const queue=direct.filter(member=>member.leg===leg),seen=new Set(['900001']);
    for(const member of queue){
      if(seen.has(member.id))continue;
      seen.add(member.id);
      legs[leg].push(member);
      queue.push(...(children.get(member.id)??[]));
    }
  }
  return legs;
}

function phase(startsAt,endsAt,now) {
  return now<startsAt?'upcoming':now>=endsAt?'ended':'ongoing';
}

export function demoH4PromotionWindow(state,now) {
  const {at}=scene(state,now);
  let startsAt=at-2*day,endsAt=at+28*day-3600000;
  if(state.eventState==='upcoming')startsAt=at+day;
  if(state.eventState==='ended')endsAt=at-day;
  const boundary=(state.promotionTimingAt??at)+60000;
  if(state.promotionTiming==='starting'){
    startsAt=boundary;
    endsAt=Math.max(endsAt,startsAt+day);
  }else if(state.promotionTiming==='ending'){
    endsAt=boundary;
    startsAt=Math.min(startsAt,endsAt-day);
  }
  return {startsAt,endsAt,state:phase(startsAt,endsAt,now)};
}

export function setDemoH4PromotionTiming(state,now) {
  state.promotionTimingAt=now;
  const record=state.h4Events;
  if(record?.joined.includes('upgrade')&&demoH4PromotionWindow(state,now).state==='upcoming'){
    record.joined=record.joined.filter(code=>code!=='upgrade');
  }
}

function eventWindow(code,state,now) {
  if(code==='upgrade')return demoH4PromotionWindow(state,now);
  const {at,spins}=scene(state,now);
  let startsAt=state.eventState==='upcoming'||state.eventState==='mixed'&&code==='season'?at+day:at-3*day;
  let endsAt=state.eventState==='ended'?at-day:at+7*day;
  if(code==='spin'&&state.eventState!=='upcoming'){
    for(const spin of spins){
      startsAt=Math.min(startsAt,spin.at);
      endsAt=Math.max(endsAt,spin.at+1);
    }
  }
  return {startsAt,endsAt,state:phase(startsAt,endsAt,now)};
}

export function demoH4CheckInBonus(state,now,amount) {
  if(['empty','error'].includes(state.eventState)||eventWindow('weekend',state,now).state!=='ongoing')return 0;
  const {multiplier,timeZone,weekdays,budgetNex}=rulesByCode.weekend;
  const date=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  if(!weekdays.includes(new Date(date).getUTCDay()||7))return 0;
  const spent=(state.walletMovements??[]).filter(row=>row.bizType==='DAILY_CHECK_IN')
    .reduce((sum,row)=>sum+(row.detail.eventBonusNex??0),0);
  const extra=amount*(multiplier-1);
  return spent+extra<=budgetNex?extra:0;
}

function inviteCount(state,window,now) {
  const until=Math.min(now,window.endsAt);
  const dates=demoH4TeamMembers(state,now)
    .filter(member=>member.layer===1&&member.status==='ACTIVE')
    .map(member=>Date.parse(member.joinedAt))
    .filter(at=>at>=window.startsAt&&at<until);
  return Math.max(0,...dates.map(start=>dates.filter(at=>at>=start&&at<start+rulesByCode.invite.windowDays*day).length));
}

function rewards(rules) {
  const result=[];
  if(rules.rewardNex>0)result.push({type:'UVT',amount:rules.rewardNex});
  if(rules.streakSavers>0)result.push({type:'STREAK_SAVER',amount:0,quantity:rules.streakSavers});
  if('giftProductNo' in rules)result.push({type:'DEVICE',amount:0,productNo:rules.giftProductNo,quantity:rules.giftQuantity});
  if(rules.poolUsdt>0)result.push({type:'USDT',amount:rules.poolUsdt,pool:true});
  if(rules.ticketsPerThreshold>0)result.push({type:'GENESIS_TICKET',amount:0,quantity:rules.ticketsPerThreshold});
  if(rules.extraGenesisTickets>0)result.push({type:'GENESIS_TICKET',amount:0,quantity:rules.extraGenesisTickets});
  return result;
}

function rewardSummary(rules,locale) {
  const parts=[];
  if('voucherId' in rules||'promotionActivityId' in rules)parts.push(localized(locale,'促销优惠','Promotional offer','Ưu đãi khuyến mãi'));
  if(rules.multiplier>0)parts.push(localized(locale,'签到奖励','Check-in reward','Thưởng điểm danh')+' × '+rules.multiplier);
  const labels={
    UVT:'UVT',USDT:'USDT '+localized(locale,'总奖池','total pool','tổng quỹ thưởng'),
    DEVICE:localized(locale,'设备','device','thiết bị'),
    STREAK_SAVER:localized(locale,'补签卡','streak saver','thẻ bù điểm danh'),
    GENESIS_TICKET:localized(locale,'创世抽奖券','Genesis raffle tickets','vé quay Genesis'),
  };
  for(const {type,quantity,amount} of rewards(rules))parts.push((quantity??amount)+' '+labels[type]);
  return parts.length?parts.join(' + '):localized(locale,'查看活动规则','View event rules','Xem thể lệ');
}

function project(entry,locale,state,now) {
  const [code,kind,zh,en,vi,href]=entry,record=scene(state,now),rules=rulesByCode[code];
  const window=eventWindow(code,state,now),wheel=kind==='wheel',trackable=['referral','onboarding','regional'].includes(kind);
  const ongoing=window.state==='ongoing',started=window.state!=='upcoming',spun=wheel&&record.spins.length>0;
  const {createdAt,rank}=demoH4Account(state);
  const inWindow=now-createdAt<rules.windowDays*day;
  let progressValue=spun?1:0,targetValue=1,qualified=false;
  if(started&&kind==='referral'){
    progressValue=inviteCount(state,window,now);
    targetValue=rules.targetInvites;
    qualified=progressValue>=targetValue;
  }else if(started&&kind==='onboarding'){
    progressValue=rank;
    targetValue=rules.minRank;
    qualified=ongoing&&inWindow&&rank>=targetValue;
  }
  const claimed=!!record.claims[code];
  const userStatus=claimed?'CLAIMED':qualified?'CLAIMABLE'
    :spun||started&&record.joined.includes(code)?'JOINED':'AVAILABLE';
  const eligible=userStatus==='CLAIMABLE'||ongoing&&!rules.voucherId&&(kind!=='onboarding'||inWindow);
  return {code,rules,eligible,event:{
    eventCode:'demo-'+code,kind,state:window.state,title:localized(locale,zh,en,vi),
    subtitle:localized(locale,'完成活动条件，查看进度并领取奖励。','Complete the activity goals and claim your reward.','Hoàn thành mục tiêu và nhận thưởng.'),
    rewardName:wheel?'UVT':rewardSummary(rules,locale),rewardType:wheel?'UVT':'COMPOSITE',rewardAmount:wheel?50:0,
    featured:code==='upgrade'&&ongoing,trackable,targetValue,progressValue,userStatus,geo:'GLOBAL',href,
    startsAt:date(window.startsAt),endsAt:date(window.endsAt),
  }};
}

function award(state,code,now,key) {
  const rules=rulesByCode[code],record=scene(state,now),deviceIds=[];
  let receipt;
  if(code==='invite'){
    for(let i=0;i<rules.giftQuantity;i++)deviceIds.push(state.deviceSequence=(state.deviceSequence??1000)+1);
    receipt={rewardType:'DEVICE',quantity:rules.giftQuantity,productNo:rules.giftProductNo,
      receiptId:'DEMO-INVITE-GIFT',instances:deviceIds.map(id=>'DEMO-INVITE-DEVICE-'+id)};
  }else{
    receipt={rewardType:'UVT',rewardAmount:rules.rewardNex,streakSavers:rules.streakSavers};
  }
  const result={eventId:'demo-'+code,rewardType:receipt.rewardType,rewardAmount:receipt.rewardAmount??receipt.quantity,receipt,badgeCode:null};
  record.claims[code]={key,at:now,deviceIds,result};
  return result;
}

export function demoH4Gift(state) {
  return state.dataState==='empty'||state.eventState==='empty'?undefined:state.h4Events?.claims.invite;
}

export function demoH4GiftQuantity(state,productNo) {
  const receipt=demoH4Gift(state)?.result.receipt;
  return receipt?.productNo===productNo?receipt.quantity:0;
}

const hasGiftStock=(product,rules)=>product?.inventoryMode==='FINITE'&&product.stock>=rules.giftQuantity;

export function seedDemoH4Gift(state,now,freeSlots,products) {
  const rules=rulesByCode.invite;
  if(!demoH4Gift(state)&&freeSlots>=rules.giftQuantity
      &&hasGiftStock(products.find(product=>product.id===rules.giftProductNo),rules)
      &&inviteCount(state,eventWindow('invite',state,now),now)>=rules.targetInvites){
    award(state,'invite',now);
  }
}

export function demoH4Credits(state,now) {
  if(state.dataState==='empty'||state.eventState==='empty')return [];
  const {claims,spins}=scene(state,now);
  const welcome=claims.welcome;
  return [
    ...(welcome?[{id:'DEMO-WELCOME',type:'EVENT_REWARD',status:'SUCCESS',amount:welcome.result.rewardAmount,at:welcome.at}]:[]),
    ...spins.filter(spin=>!spin.historyOnly).map(({result,at,includedInBalance})=>({id:result.spinId,type:'WHEEL_REWARD',status:'POSTED',amount:result.rewardAmount,at,includedInBalance})),
  ].sort((a,b)=>a.at-b.at);
}

export function demoH4Savers(state) {
  return state.h4Events?.claims.welcome?.result.receipt.streakSavers??0;
}

export function demoH4EventResponse(url,locale,state,request,now,{fleet,promotion,products,spinTickets}) {
  const route=url.pathname.match(/^\/api\/events\/([^/]+)\/(detail|join|claim|reminder|spin(?:\/state)?)$/);
  const list=url.pathname==='/api/events';
  if(!list&&!route)return undefined;
  const empty=state.dataState==='empty'||state.eventState==='empty';
  const entry=route&&events.find(([code])=>'demo-'+code===route[1]);
  const action=route?.[2],wheel=entry?.[1]==='wheel';
  if(action?.startsWith('spin')&&(!wheel||empty))reject('WHEEL_EVENT_NOT_OPEN');
  if(!list&&(!entry||empty))reject('EVENT_NOT_FOUND',404);
  if(empty)return {events:[],serverTimeUtc:date(now),source:'nx_event + nx_user_event'};
  const read=action==='detail'||action==='spin/state';
  if(!list&&request.method()!==(read?'GET':'POST'))reject('METHOD_NOT_ALLOWED',405);
  const commandKey=(request.headers?.()['idempotency-key']||request.headers?.()['Idempotency-Key'])?.trim();
  if(action==='claim'||action==='spin'){
    if(!commandKey)reject('IDEMPOTENCY_KEY_REQUIRED',422);
    if(commandKey.length>128)reject('IDEMPOTENCY_KEY_INVALID',422);
  }
  if(list)return {events:events.map(entry=>project(entry,locale,state,now).event),serverTimeUtc:date(now),source:'nx_event + nx_user_event'};

  const {code,rules,event,eligible}=project(entry,locale,state,now);
  const record=scene(state,now),id=event.eventCode,ongoing=event.state==='ongoing';
  if(action==='detail'){
    const promo=ongoing&&rules.promotionActivityId?promotion(rules.promotionActivityId):null;
    const ready=promo?.state==='ACTIVE'&&promo.eligibility==='ESTIMATE_ELIGIBLE';
    let eligibilityReason='IN_PROGRESS';
    if(event.userStatus==='CLAIMABLE')eligibilityReason='READY';
    else if(event.userStatus==='CLAIMED')eligibilityReason='CLAIMED';
    else if(!ongoing)eligibilityReason=event.state==='upcoming'?'NOT_STARTED':'ENDED';
    else if(rules.voucherId)eligibilityReason='VOUCHER_UNAVAILABLE';
    else if(!eligible)eligibilityReason='NOT_ELIGIBLE';
    else if(ready)eligibilityReason='READY';
    const voucher=ongoing&&rules.voucherId?{voucherId:rules.voucherId,percent:null,applicableSkus:[],grantStatus:'UNCLAIMED',
      claimable:false,usable:false,singleSkuOnly:true,singleUse:true,claimSurface:'store'}:null;
    const claimKeys=event.state!=='upcoming'&&(promo||voucher||code==='invite'&&event.progressValue<rules.targetInvites)?[]:['ONCE'];
    const terms=wheel
      ? localized(locale,'每天可免费抽奖一次。','One free spin per day.','Mỗi ngày được quay miễn phí một lần.')
      : localized(locale,'完成对应活动条件即可领取；每个账号限领一次。','Complete the activity goals. One reward per account.','Hoàn thành mục tiêu. Mỗi tài khoản nhận một lần.');
    return {event,rules:code==='weekend'?rules:{...rules,description:event.subtitle,terms},enabled:true,eligible,eligibilityReason,
      progressValue:event.progressValue,targetValue:event.targetValue,rewards:rewards(rules),results:[],myRewardAmount:null,
      userStatus:event.userStatus,claimKeys,voucher,reminderSubscribed:record.reminders.includes(code)};
  }
  if(action==='join'){
    if(!ongoing)reject('EVENT_NOT_OPEN');
    if(!record.joined.includes(code))record.joined.push(code);
    return {eventId:id,status:'JOINED'};
  }
  if(action==='reminder'){
    if(event.state!=='upcoming')reject('EVENT_REMINDER_NOT_AVAILABLE');
    if(!record.reminders.includes(code))record.reminders.push(code);
    return {eventId:id,status:'SUBSCRIBED'};
  }
  if(action==='claim'){
    const previous=record.claims[code];
    if(commandKey&&previous?.key===commandKey)return previous.result;
    if(event.state==='upcoming')reject('EVENT_NOT_OPEN');
    if(previous)reject('EVENT_ALREADY_CLAIMED');
    if(event.userStatus!=='CLAIMABLE')reject('EVENT_NOT_CLAIMABLE');
    if(code==='invite'){
      const {slotsUsed,slotCap}=fleet();
      if(slotsUsed+rules.giftQuantity>slotCap)reject('H4_EVENT_DEVICE_CAPACITY_UNAVAILABLE');
      if(!hasGiftStock(products.find(product=>product.id===rules.giftProductNo),rules))reject('H4_EVENT_GIFT_STOCK_UNAVAILABLE');
    }
    return award(state,code,now,commandKey);
  }
  const serverDate=date(now).slice(0,10),nextResetAtUtc=date(Date.parse(serverDate)+day);
  const freeAvailable=ongoing&&!record.spins.some(({result})=>result.spinDate===serverDate&&result.sourceType==='DAILY');
  const bonusTickets=ongoing?Math.max(0,spinTickets-record.spins.filter(({result})=>result.sourceType==='BONUS').length):0;
  if(action==='spin/state'){
    if(event.state==='upcoming')reject('WHEEL_EVENT_NOT_OPEN');
    return {eventCode:id,eventId:id,ended:!ongoing,serverDate,nextResetAtUtc,freeAvailable,bonusTickets,
      availableSpins:Number(freeAvailable)+bonusTickets,segments:ongoing?wheelSegments:[],
      history:record.spins.slice(0,20).map(({result,at})=>({...result,awardedAt:date(at)})),
      source:'nx_growth_wheel_tier + nx_growth_spin_ticket + nx_growth_wheel_spin',sourceEnvironment:'PRODUCTION'};
  }
  const previous=commandKey&&record.spins.find(spin=>spin.key===commandKey);
  if(previous){
    if(previous.result.spinDate!==serverDate)reject('IDEMPOTENCY_KEY_CONFLICT');
    return previous.result;
  }
  if(!ongoing)reject('WHEEL_EVENT_NOT_OPEN');
  if(!freeAvailable&&!bonusTickets)reject('WHEEL_DAILY_LIMIT_REACHED');
  const result=wheelAward(now,freeAvailable?'DAILY':'BONUS');
  record.spins.unshift({key:commandKey,result,at:now});
  return result;
}
