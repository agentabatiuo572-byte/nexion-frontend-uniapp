// Shared facts for the managed activities in the loopback preview.
const day=86400000;
const accountCreatedAt=Date.now()-42*day;
const localized=(locale,zh,en,vi)=>locale==='zh'?zh:locale==='vi'?vi:en;
const date=ms=>new Date(ms).toISOString();
const reject=(message,status=409)=>{throw Object.assign(new Error(message),{status});};

const rulesByCode={
  upgrade:{promotionActivityId:'demo-promo-0'},
  invite:{targetInvites:5,windowDays:7,giftProductNo:'stellarbox-pro',giftQuantity:1},
  spin:{},
  weekend:{action:'CHECKIN_MULTIPLIER',multiplier:2,timeZone:'UTC',weekdays:[6,7]},
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

export function demoH4Account(state) {
  return {createdAt:accountCreatedAt,rank:state.dataState==='empty'?0:state.ambassadorRank==='v5'?5:state.highestRank?8:2};
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
  const joined=['joined','claimable','claimed'].includes(mode)
    ? ['upgrade','invite','weekend','season'] : mode==='mixed'?['invite']:[];
  const spins=mode==='ended'?[{result:wheelAward(now-2*day,'DAILY'),at:now-2*day}]:[];
  return state.h4Events={at:now,joined,spins,reminders:[],claims:{}};
}

export function demoH4TeamMembers(state,now) {
  if(state.dataState==='empty')return [];
  const members=['Maya','Linh','Sam','Rin','Jo','Noah','Mina','Leo'].map((name,i)=>({
    id:String(100+i),name,avatarUrl:null,vRank:i%4,layer:i<3?1:i<6?2:3,leg:i%2?'A':'B',
    joinedAt:date(accountCreatedAt+(i+2)*day),monthComputePoints:[160,240,320,360,440,480,560,640][i],
    lifetimeComputePoints:[640,960,1280,1440,1760,1920,2240,2560][i],status:i===6?'OFFLINE':i===7?'IDLE':'ACTIVE',region:['SG','VN','JP'][i%3],
  }));
  if(['claimable','claimed'].includes(state.eventState)){
    const {at}=scene(state,now);
    members.push(...['An','Bao','Chi','Dara','Emi'].map((name,i)=>({
      id:String(108+i),name,avatarUrl:null,vRank:0,layer:1,leg:i%2?'A':'B',
      joinedAt:date(at-day+i*3600000),monthComputePoints:0,lifetimeComputePoints:0,status:'ACTIVE',region:['SG','VN','JP'][i%3],
    })));
  }
  return members;
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

function eventWindow(code,state,now) {
  if(code==='upgrade')return demoH4PromotionWindow(state,now);
  const {at}=scene(state,now);
  const startsAt=state.eventState==='upcoming'||state.eventState==='mixed'&&code==='season'?at+day:at-3*day;
  const endsAt=state.eventState==='ended'?at-day:at+7*day;
  return {startsAt,endsAt,state:phase(startsAt,endsAt,now)};
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
  const userStatus=claimed?'CLAIMED':qualified?'CLAIMABLE':spun||record.joined.includes(code)?'JOINED':'AVAILABLE';
  const eligible=qualified||ongoing&&!rules.voucherId&&(kind!=='onboarding'||inWindow);
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

// Fleet reads seed the "already claimed" sample just like the activity view.
// The same slot count also guards the real claim command.
export function demoH4Gift(state,now,freeSlots) {
  if(state.dataState==='empty'||state.eventState==='empty')return undefined;
  const record=scene(state,now);
  if(state.eventState==='claimed'&&!record.claims.invite&&freeSlots>=rulesByCode.invite.giftQuantity
      &&inviteCount(state,eventWindow('invite',state,now),now)>=rulesByCode.invite.targetInvites){
    award(state,'invite',now);
  }
  return record.claims.invite;
}

export function demoH4Credits(state,now) {
  if(state.dataState==='empty'||state.eventState==='empty')return [];
  const {claims,spins}=scene(state,now);
  const welcome=claims.welcome;
  return [
    ...(welcome?[{id:'DEMO-WELCOME',type:'EVENT_REWARD',amount:welcome.result.rewardAmount,at:welcome.at}]:[]),
    ...spins.map(({result,at})=>({id:result.spinId,type:'H4_WHEEL',amount:result.rewardAmount,at})),
  ].sort((a,b)=>a.at-b.at);
}

export function demoH4Savers(state) {
  return state.h4Events?.claims.welcome?.result.receipt.streakSavers??0;
}

export function demoH4EventResponse(url,locale,state,request,now,{fleet,promotion,spinTickets}) {
  const route=url.pathname.match(/^\/api\/events\/([^/]+)\/(detail|join|claim|reminder|spin(?:\/state)?)$/);
  const list=url.pathname==='/api/events';
  if(!list&&!route)return undefined;
  const empty=state.dataState==='empty'||state.eventState==='empty';
  const entry=route&&events.find(([code])=>'demo-'+code===route[1]);
  const action=route?.[2],wheel=entry?.[1]==='wheel';
  if(action?.startsWith('spin')&&(!wheel||empty))reject('WHEEL_EVENT_NOT_OPEN');
  if(!list&&(!entry||empty))reject('EVENT_NOT_FOUND',404);
  if(empty)return {events:[],serverTimeUtc:date(now),source:'nx_event + nx_user_event'};
  if(state.eventState==='claimed')fleet();
  if(list)return {events:events.map(entry=>project(entry,locale,state,now).event),serverTimeUtc:date(now),source:'nx_event + nx_user_event'};

  const {code,rules,event,eligible}=project(entry,locale,state,now);
  const record=scene(state,now),id=event.eventCode,ongoing=event.state==='ongoing';
  const commandKey=request.headers?.()['idempotency-key']||request.headers?.()['Idempotency-Key'];
  const read=action==='detail'||action==='spin/state';
  if(request.method()!==(read?'GET':'POST'))reject('METHOD_NOT_ALLOWED',405);
  if(action==='detail'){
    const promo=ongoing&&rules.promotionActivityId?promotion(rules.promotionActivityId):null;
    const ready=promo?.state==='ACTIVE'&&promo.eligibility==='ESTIMATE_ELIGIBLE';
    let eligibilityReason='IN_PROGRESS';
    if(event.userStatus==='CLAIMABLE')eligibilityReason='READY';
    else if(!ongoing)eligibilityReason=event.state==='upcoming'?'NOT_STARTED':'ENDED';
    else if(rules.voucherId)eligibilityReason='VOUCHER_UNAVAILABLE';
    else if(!eligible)eligibilityReason='NOT_ELIGIBLE';
    else if(event.userStatus==='CLAIMED')eligibilityReason='CLAIMED';
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
