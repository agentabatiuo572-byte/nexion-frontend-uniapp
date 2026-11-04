// Local presentation data. This module is never imported into src or an App build.
// Monetary amounts, hardware specifications and identities below are illustrative.
import { fixture as reviewFixture } from './design-review-fixture.mjs';
import { secondaryDemo } from './prototype-demo-secondary.mjs';
import { withDemoShareChannels } from './prototype-demo-share.mjs';
import { learningDemo } from './prototype-demo-learning.mjs';
import { financeDemo } from './prototype-demo-finance.mjs';
import { rankPolicyDemo } from './prototype-demo-rank-policy.mjs';
import { teamGuidesDemo } from './prototype-demo-team-guides.mjs';
import { auxiliaryDemo } from './prototype-demo-auxiliary.mjs';
import { ambassadorDemo } from './prototype-demo-ambassador.mjs';
import { supportDemo } from './prototype-demo-support.mjs';
import { stakingDemo } from './prototype-demo-staking.mjs';
import { demoNotifications } from './prototype-demo-notifications.mjs';
import { accountDemo } from './prototype-demo-account.mjs';
import { bankDemo } from './prototype-demo-bank.mjs';
import { riskDemo } from './prototype-demo-risk.mjs';
import { trialDemo } from './prototype-demo-trial.mjs';

const authority = {sourceEnvironment:'PRODUCTION',runId:'',serverCanonical:true};
const day = 86400000;
const demoStartedAt = Date.now();
const localized = (locale,zh,en,vi) => locale === 'zh' ? zh : locale === 'vi' ? vi : en;
const refuse=message=>{const error=new Error(message);error.status=409;throw error;};
const voucherDiscount=(state,id,total)=>id==='V-DESIGN'&&!state.voucherUsed&&(state.voucherClaimed||['claimed','grace'].includes(state.benefitState))?Math.min(50,total):0;
const bundleRate=count=>count>=4?.11:count===3?.07:count===2?.04:0;
const demoStreakMilestones=[[3,'UVT',5,null],[7,'UVT',15,null],[14,'USDT',1,null],[21,'UVT',100,null],[30,'SPIN',1,null],[60,'USDT',10,null],[100,'BADGE',0,'STREAK_MASTER']];
export const demoDefaults = {checkoutState:'ordinary',trialQuoteState:'default',powerUpState:'default',paymentState:'delivered',topupState:'form',trialState:'follow',realtimeState:'online',messageSendState:'normal',messageState:'normal',machineImageState:'normal',catalogState:'available',taskState:'pending',eventState:'mixed',raffleState:'normal',pairingState:'pending',benefitState:'available',dataState:'normal',stakingState:'enabled',bankState:'pending',riskState:'accepted',streakState:'normal',ambassadorState:'none',promotionEligibility:'eligible',promotionTiming:'live',promotionRewardType:'reward',sessionState:'signed-in',jobsBaseState:'unpublished',globeShareState:'nodes',highestRank:false,checkedIn:false,offers:true,messages:true,promotions:true,completed:[],read:false};
export const demoOptions = {
  checkoutState:[['ordinary','普通结算'],['replace','容量已满·需选择替换']],
  powerUpState:[['default','默认连签增益'],['staking','含质押活动入口（/wallet/staking）']],
  trialQuoteState:[['default','默认报价'],['precision','六位报价 · 342.123456'],['half-cent','半分报价 · 342.135 → 342.14'],['precision-repriced','六位报价变更 · 确认金额仍 342.12']],
  trialState:[['follow','跟随福利场景'],['available','试用未领取'],['active','试用中'],['final-day','试用最后12小时'],['grace','试用到期·抵扣有效'],['ended','试用及抵扣已结束'],['eligible-again','冷却结束·可重新领取'],['converted','已转购'],['refunded','已转购·已退款'],['claim-error','首次激活失败·可重试'],['read-error','试用读取失败'],['capacity-full','队列已满']],
  realtimeState:[['online','客服在线'],['offline','客服离线'],['reconnecting','正在恢复连接']],
  messageSendState:[['normal','正常确认'],['delayed','发送延迟（约 2 秒）'],['failed','确认失败（未发送）'],['unknown','结果待确认（重试原消息）'],['timeout','确认超时（15 秒转待确认）']],
  messageState:[['normal','普通会话 · 1条未读'],['receipts','双向回执样例'],['history','三页历史与图文消息'],['timeline','时间分组 · 24小时间隔'],['incoming','追加客服消息（原页刷新）'],['long-count','长未读计数 · 1298'],['author-photo','客服带本人头像'],['recommendations','商品与链接推荐'],['agent-switch','客服已切换提示（有名字/无名字）'],['welcome-unassigned','刚注册 · 未分配客服 · 欢迎语未读'],['welcome-assigned','刚注册 · 已有专属客服 · 欢迎语未读'],['read','会话全部已读']],
  machineImageState:[['normal','原活动机型'],['banner','后台自定义活动海报'],['missing-main','主购缺图（赠品保持原位）'],['missing','目录未发布图片'],['broken','图片加载失败']],
  catalogState:[['phased','完整目录（含即将上线）'],['available','全部 SKU 可购'],['soldout','S1 售罄'],['restricted','购买条件未满足']],
  taskState:[['pending','任务进行中'],['complete','全部完成·待领取'],['claimed','奖励已领取'],['expired','任务已过期'],['empty','暂无任务'],['legacy','任务信息待补全']],
  eventState:[['mixed','全部活动状态'],['available','可参与'],['joined','已参与'],['claimable','奖励待领取'],['claimed','奖励已领取'],['upcoming','即将开始'],['ended','已结束'],['empty','暂无活动']],
  raffleState:[['normal','正常开奖'],['small-usdt','微额 USDT 奖励'],['upcoming','1 分钟后开始'],['ending','1 分钟后截止'],['ended','已截止待开奖']],
  pairingState:[['pending','等待连接'],['connected','配对完成'],['expired','配对已过期']],
  benefitState:[['available','福利待领取'],['claimed','券已领取·试用中'],['grace','试用待抵扣'],['finished','福利已使用']],
  dataState:[['normal','正常数据'],['empty','空数据'],['loading','慢速加载（5 秒）'],['error','加载失败']],
  stakingState:[['enabled','正常开放'],['delisted','功能下架'],['error','质押读取失败（其他正常）']],
  stakingOpenState:[['unmodeled','开仓未配置（演示拒绝）'],['disclosure','开仓拒绝·需风险确认（HTTP 200 / code 409）']],
  topupState:[['form','银行卡充值 · 填写金额'],['paying','银行卡充值 · 付款中'],['credited','银行卡充值 · 已到账']],
  bankState:[['pending','银行提现 · 处理中'],['settled','银行提现 · 已到账'],['rejected','银行提现 · 已退回']],
  riskState:[['accepted','风险说明 · 已确认'],['unread','风险说明 · 首次阅读']],
  streakState:[['normal','连续签到'],['first','首次签到·连续 0 天'],['broken','断签·可使用复活卡']],
  ambassadorState:[['none','尚未申请'],['pending','申请审核中'],['approved','申请已通过'],['rejected','申请未通过']],
  promotionEligibility:[['eligible','符合条件'],['sign-in','登录后确认资格'],['ineligible','不符合条件'],['unknown','资格待确认']],
  sessionState:[['signed-in','已登录'],['signed-out','未登录（刷新会话被拒）']],
  promotionTiming:[['live','跟随活动场景'],['starting','切换后 1 分钟开始'],['ending','切换后 1 分钟结束']],
  promotionRewardType:[['reward','首购 / 复购发 UVT'],['discount','首购 / 复购为订单立减'],['gift-discount','购机赠礼为订单立减']],
  jobsBaseState:[['unpublished','全球作业基数 · 未发布'],['published','全球作业基数 · 已发布 1,000']],
  globeShareState:[['nodes','旧格式 · 按节点数分配'],['share','新格式 · 只下发 sharePct'],['invalid','新格式 · 占比合计 90（无效）'],['missing','未下发全球网络展示配置']],
  fleetState:[['normal','默认设备'],['none','暂无设备'],['inventory','含仓库未激活设备'],['full','槽位已满 6/6'],['reserved','含机位分配中槽位']],
  paymentState:[['delivered','正常到账（15 秒到账，25 秒开通）'],['waiting','一直等待到账'],['read-error','原付款结果读取失败'],['urgent','剩余不足 5 分钟'],['expired','超时未到账·订单取消'],['late','宽限结束后到账·订单已取消（示例 001 剩 1 分钟）'],['bank-failed','银行卡付款失败'],['mismatch','金额不符·人工核对'],['delivery-failed','已到账·开通失败'],['bank-off','银行卡未配置'],['erc20-off','ERC20 未开通'],['usdt-off','USDT 两个网络都未开通'],['low-balance','钱包余额不足（820.64 USDT）']],
};
const skuDefinitions = [
  ['stellarbox-s1','UVELBox S1','Entry',1299,6.2,3,'4 × RTX 4090','96 GB',1200],
  ['stellarbox-pro','UVELBox Pro','Pro',4999,22.4,12,'8 × RTX 4090','192 GB',2400],
  ['stellarbox-pro-v2','UVELBox Pro v2','Pro',5999,28.6,18,'8 × RTX 5090','256 GB',2200],
  ['stellarrack-p1','UVELRack P1','Flagship',12999,45,30,'8 × A100','640 GB',3200],
  ['stellarrack-p2','UVELRack P2','Flagship',19999,75,50,'8 × H100','1,024 GB',4000],
  ['cloud-share','Cloud Share','Share',19.9,0,0,'Distributed','—',0],
];
export function demoProducts(state,origin='http://127.0.0.1:5190',locale='zh') {
  return skuDefinitions.map(([id,name,tier,price,dailyEarn,dailyEarnNEX,gpu,vram,watts],index)=>{
    const share=tier==='Share', upcoming=state.catalogState==='phased'&&[2,4].includes(index);
    return {id,name,tier,price,dailyEarn,dailyEarnNEX,computePoints:Math.round(price*10),gpu:share?localized(locale,'分布式','Distributed','Phân tán'):gpu,vram,power:watts?watts+' W':null,hashRate:null,
      tagline:localized(locale,['入门款 · 70B 大模型推理','旗舰款 · 训练与 405B 推理','进阶款 · 高性能推理','机架款 · 多任务并行','旗舰机架 · 大型算力作业','云算力 · 灵活参与'][index],['Starter · 70B model inference','Flagship · Training & 405B inference','Advanced · High-performance inference','Rack · Parallel workloads','Flagship rack · Large compute jobs','Cloud compute · Flexible access'][index],['Cơ bản · Suy luận mô hình 70B','Cao cấp · Huấn luyện và suy luận 405B','Nâng cao · Suy luận hiệu năng cao','Máy chủ · Tác vụ song song','Máy chủ cao cấp · Tác vụ tính toán lớn','Điện toán đám mây · Tham gia linh hoạt'][index]),badge:index===0?localized(locale,'推荐','Recommended','Đề xuất'):index===1?localized(locale,'热销','Best seller','Bán chạy'):null,imageUrl:new URL('/static/img/products/uvel-pedestal/'+id+'.webp',origin).href,
      productType:share?'SHARE':'DEVICE',inventoryMode:share?'UNLIMITED':'FINITE',stock:share?null:state.catalogState==='soldout'&&index===0?0:60-index*7,sold:42+index*13,
      features:[],ai:null,datacenter:localized(locale,'新加坡','Singapore','Singapore'),uptime:'99.9%',warranty:share?undefined:localized(locale,'36 个月','36 months','36 tháng'),status:'active',available:!upcoming,
      releaseState:upcoming?'LOCKED':'RELEASED',releasePhaseId:upcoming?'phase-next':'phase-current',unlocksAtPhase:null,purchaseGate:null,
      ...(share?{shareYieldMin:8,shareYieldMax:12}:{}),
    };
  }).map(product=>({...product,imageUrl:state.machineImageState==='missing'||(state.machineImageState==='missing-main'&&product.id==='stellarbox-s1')?undefined:state.machineImageState==='broken'?new URL('/static/demo-missing-'+product.id+'.webp',origin).href:product.imageUrl}));
}

// The disclosure PromotionPublicService projects for an order discount: it comes off the order at checkout, so nothing
// is issued later and a refund follows the amount paid.
// Each amount fits its campaign's product: promo 1 is the S1, promo 4 the 19.90 Cloud Share.
const orderDiscounts={1:10,4:5};
const orderDiscountDisclosure=amount=>({deviceName:null,deviceRights:null,title:{zh:'订单立减',en:'Order discount',vi:'Giảm giá đơn hàng'},
  benefitDescription:{zh:'下单立减，不另发钱包奖励；退款按实际支付金额。',en:'Deducted at checkout, with no wallet reward. Refunds use the amount paid.',vi:'Giảm trực tiếp khi đặt hàng, không thưởng thêm vào ví. Hoàn tiền theo số tiền thực trả.'},
  terms:{zh:'下单时直接减 '+amount+' USDT。',en:amount+' USDT comes off when you order.',vi:'Giảm trực tiếp '+amount+' USDT khi đặt hàng.'},
  refundTerms:{zh:'退款按实际支付金额处理。',en:'Refunds use the amount paid.',vi:'Hoàn tiền theo số tiền thực trả.'}});
const orderStates={placed:['PENDING','PENDING_PAYMENT','WAITING_PAYMENT'],paid:['PAID','PAID','WAITING_PROVISIONING'],provisioning:['PAID','PROCESSING','PROVISIONING'],activated:['PAID','COMPLETED','ACTIVATED'],payment_failed:['FAILED','PAYMENT_FAILED','WAITING_PAYMENT'],expired:['EXPIRED','EXPIRED','WAITING_PAYMENT'],provisioning_failed:['PAID','PROVISIONING_FAILED','PROVISIONING_FAILED'],refunded:['REFUNDED','REFUNDED','REFUNDED'],chargeback:['CHARGEBACK','CHARGEBACK','DEACTIVATED'],cancelled:['CANCELLED','CANCELLED','WAITING_PAYMENT']};
// Sample times are facts of the scenario: fixed when it is seeded, not regenerated per read. Like the backend's
// pending-order TTL, an unpaid order (a sample or one placed in this session) may be paid for 30 minutes after it is
// placed. The placed sample (001) is placed as the scenario starts, or earlier for paymentState=urgent and late, so it
// and its payment share one deadline 4 min 50 s or 1 min away. A paid sample was paid 3 minutes after it was placed, and
// its later events follow in order.
export const paymentWindow=30*60000;
const samplePlacedAgo={urgent:paymentWindow-(4*60000+50000),late:paymentWindow-60000},samplePaidAfter=3*60000;
// Like AppOrderExpiryScheduler, a task running every 60 s closes an unpaid order past its deadline, and never one with a
// payment intent: that order stays open until its payment concludes. Until the task runs, paying is refused as expired.
const deadlineTaskDelay=60000;
export const demoTimedOutOrder={canonicalStatus:'expired',paymentStatus:'EXPIRED',orderStatus:'EXPIRED',activationStatus:'WAITING_PAYMENT',closeReasonCode:'PAYMENT_TIMEOUT'};
export const demoOrderTimedOut=(order,state,now)=>order.canonicalStatus==='placed'&&order.expiresAt+deadlineTaskDelay<=now&&!state.intentOrders?.[order.orderNo];
function demoOrders(products,state,now) {
  const at=state.sampleOrdersAt??=now;
  return Object.entries(orderStates).map(([original,statuses],i)=>{
    const orderNo='DEMO-ORDER-'+String(i+1).padStart(3,'0'),canonicalStatus=state.orderStatuses?.[orderNo]||original;
    const [paymentStatus,orderStatus,activationStatus]=orderStates[canonicalStatus],product=products[i%products.length];
    const placedAt=original==='placed'?at-(samplePlacedAgo[state.paymentState]??0):at-(i+1)*day;
    return {orderNo,productId:i%products.length+1,productNo:product.id,productName:product.name,quantity:1,subtotalUsdt:product.price,unitPriceUsdt:product.price,discountUsdt:0,amountUsdt:product.price,paymentMethod:'WALLET',paymentStatus,orderStatus,activationStatus,canonicalStatus,orderType:'SINGLE',placedAt,expiresAt:['placed','expired'].includes(canonicalStatus)?placedAt+paymentWindow:null,paidAt:['paid','provisioning','activated','provisioning_failed','refunded','chargeback'].includes(canonicalStatus)?placedAt+samplePaidAfter:null,activatedAt:canonicalStatus==='activated'?at-3600000:null,refundedAt:canonicalStatus==='refunded'?at-3600000:null,refundAmountUsdt:canonicalStatus==='refunded'?product.price:null,refundChannel:canonicalStatus==='refunded'?'WALLET':null,refundBillNo:canonicalStatus==='refunded'?'DEMO-REFUND-1':null,refundReasonCode:canonicalStatus==='refunded'?'DELIVERY_UNAVAILABLE':null,closeReasonCode:{cancelled:'USER_CANCELLED',expired:'PAYMENT_TIMEOUT',payment_failed:'PAYMENT_NOT_RECEIVED',provisioning_failed:'DELIVERY_UNAVAILABLE',chargeback:'PAYMENT_DISPUTED'}[canonicalStatus]??null,dataCenter:'Singapore',tradeinNo:null,sourceDeviceId:null,targetDeviceId:original==='activated'?41:null,targetDeviceInstanceNo:original==='activated'?'REVIEW-S1':null,itemCount:1,
      lineItems:[{sku:product.id,name:product.name,quantity:1,unitPriceUsdt:product.price,lineAmountUsdt:product.price}]};
  });
}

function demoEvents(locale,state,now) {
  if(state.dataState==='empty'||state.eventState==='empty') return [];
  const entries=[
    ['upgrade','discount','设备升级礼','Device upgrade offer','Ưu đãi nâng cấp','AVAILABLE','ongoing',500,'/pages/store/store'],
    ['invite','referral','邀请好友挑战','Invitation challenge','Thử thách mời bạn','JOINED','ongoing',200,'/pages/team/team'],
    ['spin','wheel','每日幸运转盘','Daily lucky spin','Vòng quay mỗi ngày','AVAILABLE','ongoing',50,''],
    ['weekend','boost','周末签到加成','Weekend check-in boost','Thưởng điểm danh cuối tuần','CLAIMABLE','ongoing',20,'/pages/daily/daily'],
    ['season','seasonal','秋季算力季','Autumn compute season','Mùa tính toán thu','AVAILABLE','upcoming',800,'/pages/events/events'],
    ['welcome','onboarding','新用户成长礼','New member rewards','Quà thành viên mới','CLAIMABLE','ongoing',100,'/pages/missions/missions'],
  ];
  return entries.map(([code,kind,zh,en,vi,baseStatus,baseState,rewardAmount,href],i)=>{
    const mode=state.eventState, eventCode='demo-'+code;
    const eventState=['upcoming','ended'].includes(mode)?mode:mode==='mixed'?baseState:'ongoing';
    const userStatus=state.eventStatuses?.[eventCode] || (['available','joined','claimable','claimed'].includes(mode)?mode.toUpperCase():baseStatus);
    return {eventCode,kind,state:eventState,title:localized(locale,zh,en,vi),subtitle:localized(locale,'完成活动条件，查看进度并领取奖励。','Complete the activity goals and claim your reward.','Hoàn thành mục tiêu và nhận thưởng.'),rewardName:'UVT',rewardType:'UVT',rewardAmount,featured:i===0&&eventState==='ongoing',trackable:!['wheel','discount'].includes(kind),targetValue:5,progressValue:['CLAIMABLE','CLAIMED'].includes(userStatus)?5:userStatus==='JOINED'?2:0,userStatus,geo:'GLOBAL',href,startsAt:new Date(eventState==='upcoming'?now+day:now-3*day).toISOString(),endsAt:new Date(eventState==='ended'?now-day:now+7*day).toISOString()};
  });
}

function genesisPublic(now) {
  return {...authority,halted:false,revision:'demo-genesis-1',source:'nx_genesis_series + nx_config_item',
    series:{seriesCode:'genesis-main',name:'Genesis',totalSupply:1000,soldSupply:0,remainingSupply:1000,priceUsdt:9999,royaltyPct:2.5,dailyEmissionRatePct:0},
    sale:{serverCanonical:true,available:false,eligibilityEnabled:true,maxPerUser:2,minAccountAgeDays:0,presaleEnabled:false,showCountdown:false,unitPriceUsdt:9999,open:false,startAt:null,endAt:null},
    market:{enabled:false},emission:{open:false},listings:[],transactions:[],tiers:[{id:'t1',from:0,to:1000,priceUSDT:9999}],tiersVersion:1,marketOpenState:'closed',marketOpenStateVersion:1,showcaseEnabled:true,closedNoticeKey:'default',catalogAvailable:true,tradeAvailable:false,tradeBlockedReason:'SALE_POLICY_UNAVAILABLE',secondaryCommandProtocol:2,
    marketStats:{floorUsdt:null,volume24hUsdt:null,owners:null,floorDeltaPct:null,lastSaleUsdt:null}};
}

// One slot rule for every fixture read and command (PRD §5.6 / §9.11; backend fleet read and trade-in capacity
// quote): occupied = activated formal devices + slots held by paid orders awaiting a device + one effective trial
// (ACTIVE/GRACE) <= cap. demoFleetFacts computes it from the retained state; reads and commands all use it.
const demoTrialSlots=(url,locale,state)=>state.trialState!=='read-error'
  &&['ACTIVE','GRACE'].includes(trialDemo(new URL('/api/trial/state',url.origin),locale,state,{method:()=>'GET'},false).state)?1:0;
// Session orders plus the state-sample rows that belong to the scenario. The paid (002) and provisioning (003)
// samples hold slots, so they appear only in fleetState=reserved, where they are its reservations; replace's
// two-slot cap keeps one of them (002), leaving a slot for a device, the trial or its conversion. The activated
// sample (004) is the order of seeded device 41 and is listed only while the seed holds that device, on that device's
// timeline: paid and activated when the device was, placed 3 minutes before. A sample paid
// in this session is adopted into createdOrders by the checkout or payment fixture and listed once. The empty
// account (dataState=empty) has no sample rows, only what this session creates. An unpaid sample the deadline task has
// closed reads as expired, as that task (modelled for session orders by the checkout fixture) leaves it.
function demoScenarioOrders(products,state,now,device41) {
  const own=state.createdOrders||[],ids=new Set(own.map(order=>order.orderNo));
  return [...own,...demoOrders(products,state,now).filter(order=>state.dataState!=='empty'&&!ids.has(order.orderNo)
    &&(state.fleetState==='reserved'||!['DEMO-ORDER-002','DEMO-ORDER-003'].includes(order.orderNo))
    &&(state.checkoutState!=='replace'||order.orderNo!=='DEMO-ORDER-003')
    &&(device41||order.orderNo!=='DEMO-ORDER-004'))
    .map(order=>order.orderNo==='DEMO-ORDER-004'?{...order,placedAt:device41.activatedAt-samplePaidAfter,paidAt:device41.activatedAt,activatedAt:device41.activatedAt}:order)
    .map(order=>demoOrderTimedOut(order,state,now)?{...order,...demoTimedOutOrder}:order)];
}
// The account's one order list, used by the order list, wallet pay, external payments and notifications.
export function demoAccountOrders(url,locale,state,now=Date.now()) {
  if(!state.fleetSeed)demoFleetFacts(url,locale,state);
  return demoScenarioOrders(demoProducts(state,url.origin,locale),state,now,state.fleetSeed.find(device=>device.id===41));
}
// Like AppOrderCommandService, only paid orders awaiting their device hold slots; an unpaid ("placed") order owns none.
const demoOrderSlots=(orders,orderNo)=>orders
  .filter(order=>(orderNo===undefined||order.orderNo===orderNo)&&['paid','provisioning'].includes(order.canonicalStatus))
  .reduce((total,order)=>total+order.lineItems.reduce((count,line)=>count+line.quantity,0),0);
// Preview design rule. SCENARIO knobs (fleetState, checkoutState with its two-slot replace cap, trialState and
// benefitState presets, entering or leaving dataState=empty or paymentState=low-balance) start a fresh, coherent
// scenario: the preview server clears every record the old scenario owns (session orders, purchases, trade-ins, trial,
// command receipts and payment intents on the server, the App's order/payment recovery rows in the browser), and the
// next read seeds the devices here. A write is applied only in the scenario it started in, and only from a page of that
// scenario. dataState=empty is the empty account the empty pages are reviewed with: no devices, no sample orders and an
// empty wallet (balance 0, so wallet payments are refused for funds), the trial as its own knobs say.
// paymentState=low-balance is an account whose wallet holds 820.64 USDT; paymentState=urgent and late seed the unpaid
// sample close to its deadline. PRESENTATION knobs (machineImageState: artwork only; dataState loading/error; the other
// external payment results) only change what a read shows or how a payment proceeds; they never change a fact.
// After seeding, only lifecycle events change the fleet: purchases and deliveries, conversions, trade-ins and the
// trial's own lifecycle, so a freed slot stays free. full, the capacity-full trial preset and replace seed exactly
// full: formal devices fill what the trial, paid orders and session devices leave; retired devices never count.
// Nothing ever exceeds the cap and the cap is never raised.
function demoSeedFleet(state,template,cap,occupied,retired) {
  const clone=(id,code,name,daily,paid,extra)=>({...template,id,instanceNo:'DEMO-'+id,name,productCode:code,dailyUsdt:daily,actualPaidUsdt:paid,todayEarningsUsdt:0,cumulativeOutputUsdt:0,...extra});
  const live=device=>!retired.includes(device.id);
  if(state.dataState==='empty')return [];
  let devices=state.fleetState==='none'?[]:[template,{...template,id:42,instanceNo:'DEMO-PRO',name:'UVELBox Pro',productCode:'STELLARBOX-PRO',dailyUsdt:22.4,dailyNex:12,todayEarningsUsdt:13.9,todayEarningsNex:2,actualPaidUsdt:4999}];
  if(state.fleetState==='inventory')devices.push(clone(43,'STELLARRACK-P1','UVELRack P1',45,12999,{status:'INACTIVE',activatedAt:null,runtimeStatus:'OFFLINE'}));
  devices=devices.filter(live);
  if(state.fleetState==='full'||state.trialState==='capacity-full'||state.checkoutState==='replace'){
    const fillers=[clone(44,'STELLARBOX-PRO-V2','UVELBox Pro v2',28.6,5999,{todayEarningsUsdt:8.1}),clone(45,'STELLARRACK-P1','UVELRack P1',45,12999,{todayEarningsUsdt:20.4}),
      clone(46,'CLOUD-SHARE','Cloud Share',0.6,19.9,{todayEarningsUsdt:.2}),clone(48,'STELLARBOX-S1','UVELBox S1',6.2,1299,{todayEarningsUsdt:2.3}),
      clone(49,'STELLARBOX-PRO','UVELBox Pro',22.4,4999,{todayEarningsUsdt:7.6}),clone(50,'STELLARBOX-S1','UVELBox S1',6.2,1299,{todayEarningsUsdt:2.1})].filter(live);
    const active=[...devices.filter(device=>device.activatedAt!==null),...fillers].slice(0,Math.max(0,cap-occupied));
    devices=[...active,...devices.filter(device=>device.activatedAt===null)];
    if(state.fleetState==='full')devices.push(clone(47,'STELLARBOX-PRO','UVELBox Pro',22.4,4999,{status:'INACTIVE',activatedAt:null,runtimeStatus:'OFFLINE'}));
  }
  return devices;
}
// The authoritative fleet from the retained state, independent of presentation knobs.
export function demoFleetFacts(url,locale,state) {
  // Read the trial first: a converted trial books its order, which then lists as a device below.
  const trialSlotCount=demoTrialSlots(url,locale,state);
  const now=Date.now(),products=demoProducts(state,url.origin,locale),orders=demoScenarioOrders(products,state,now,false);
  const template={...reviewFixture(new URL('/api/devices/earnings',url.origin),locale,state,{method:()=>'GET'}).devices[0],runtimeStatus:'ONLINE'};
  const slotCap=state.checkoutState==='replace'?2:6,retired=state.retiredDeviceIds||[],session=[];
  // DEMO-ORDER-004 is seeded device 41's own order, also once checkout has adopted it: it never adds a device.
  for(const order of orders)if(order.orderNo!=='DEMO-ORDER-004'&&['activated','inventory'].includes(order.canonicalStatus))for(const [i,line]of order.lineItems.entries())for(let unit=0;unit<line.quantity;unit++){
    const product=products.find(p=>p.id===line.sku),instanceNo=order.orderNo+'-'+i+'-'+unit,tradein=order.orderType==='TRADE_IN';
    state.deviceIds??={};state.deviceIds[instanceNo]??=(state.deviceSequence=(state.deviceSequence||1000)+1);
    if(retired.includes(state.deviceIds[instanceNo]))continue;
    // A session device starts its own history at its order, not the seeded device's. Its capacity subsidy runs from
    // activation, and the days left follow from that end, as the App's fleet read requires.
    const subsidyEndsAt=(order.activatedAt??now)+template.capacitySubsidyDays*day,subsidyDaysLeft=Math.max(0,Math.ceil((subsidyEndsAt-now)/day));
    session.push({...template,id:state.deviceIds[instanceNo],instanceNo,name:product.name,productCode:product.id.toUpperCase(),dailyUsdt:product.dailyEarn,dailyNex:product.dailyEarnNEX,actualPaidUsdt:tradein?Number(order.amountUsdt):product.price,
      activatedAt:order.activatedAt,purchasedAt:order.paidAt,todayEarningsUsdt:0,todayEarningsNex:0,cumulativeOutputUsdt:0,capacityAgeMonths:0,capacitySubsidized:subsidyDaysLeft>0,capacitySubsidyRemainingDays:subsidyDaysLeft,capacitySubsidyEndsAt:subsidyEndsAt,
      ...(order.canonicalStatus==='inventory'&&{status:'INACTIVE',activatedAt:null})});
  }
  const reservedSlotCount=demoOrderSlots(orders);
  state.fleetSeed??=demoSeedFleet(state,template,slotCap,trialSlotCount+reservedSlotCount+session.filter(device=>device.activatedAt!==null).length,retired);
  const devices=[...structuredClone(state.fleetSeed),...session].filter(device=>!retired.includes(device.id));
  // serverNow is this read's time: the shared review fixture's clock stops at server start.
  return {devices,slotCap,reservedSlotCount,trialSlotCount,serverNow:now,slotsUsed:devices.filter(device=>device.activatedAt!==null).length+reservedSlotCount+trialSlotCount};
}

export function demoOrderFitsCapacity(url,locale,state,products,lines,excludeOrderNo) {
  const requested=lines.reduce((count,line)=>count+line.quantity,0);
  const fleet=demoFleetFacts(url,locale,state);
  // Paying an existing order reuses the slots it already holds.
  return fleet.slotsUsed-(excludeOrderNo?demoOrderSlots(demoScenarioOrders(products??demoProducts(state,url.origin,locale),state,Date.now(),false),excludeOrderNo):0)+requested<=fleet.slotCap;
}

// Detail-page live activity (PRD §7.2.2; the backend follows the same rule, uvel-docs B24). Derived from
// product + clock, so every poll and tab agrees. Sales come from a sparse per-minute purchase stream of
// about 1.2 × √cumulative a day, so the 24h / 30m counts change only when a sale enters or leaves its
// window. Viewers never drop below 200: each product's floor is 200 plus a sales-scaled and a per-product
// part, and the count drifts smoothly up to 25% above that floor, a few people per 4-second poll.
const demoNoise=(...parts)=>{let h=0x811c9dc5;for(const c of parts.join(':')){h^=c.charCodeAt(0);h=Math.imul(h,0x01000193);}
  h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return (h>>>0)/4294967296;};
function demoLiveActivity(product,now) {
  const daily=1.2*Math.sqrt(product.sold), minute=Math.floor(now/60000);
  let sales24h=0,sales30m=0;
  for(let m=minute-1439;m<=minute;m++) if(demoNoise(product.id,'sale',m)<daily/1440){sales24h++;if(m>minute-30)sales30m++;}
  sales24h=Math.min(sales24h,product.sold);
  const curve=(period,low,high)=>{const x=now/period,k=Math.floor(x),f=x-k,ease=f*f*(3-2*f),at=i=>low+demoNoise(product.id,period,i)*(high-low);return at(k)+(at(k+1)-at(k))*ease;};
  const floor=200+Math.round(daily*.8)+Math.round(demoNoise(product.id,'viewers')*20);
  return {viewers:Math.max(200,Math.round(floor+curve(150_000,0,floor*.25)+curve(15_000,-1.5,1.5))),sales24h,sales30m:Math.min(sales24h,Math.max(1,sales30m))};
}

/** Mutable state belongs only to the loopback demonstration server. */
export function demoFixture(url,locale,state,request) {
  const now=Date.now(),iso=new Date(now).toISOString(),pathname=url.pathname;
  const empty=state.dataState==='empty';
  const products=demoProducts(state,url.origin,locale);
  if (pathname === '/api/config/phone-tiers') return { tiers: [1,2,3,4,5].map(tier => ({
    tier, name:`Tier ${tier}`, baseRateUsdt:[.02,.04,.06,.09,.12][tier-1], baseRateNex:tier*.1, effectiveAt:iso,
  })), sources:['Local prototype demo'] };
  // Published home display feed (intro stats, home on-grid, trust card): one sample per second for two minutes.
  if (pathname === '/api/config/home-display' && !empty) {
    const startAt=Math.floor(now/1000)*1000, elapsed=Math.max(0,Math.floor((startAt-demoStartedAt)/1000));
    const at=offset=>elapsed+offset, seconds=Array.from({length:121},(_,offset)=>at(offset));
    return { enabled:true, startAt, serverNow:now, validUntil:startAt+120_000, sequence:elapsed,
      online:seconds.map(t=>2968+Math.floor(t/45)), paidCents:seconds.map(t=>128465050+t*160+Math.floor(t/3)*29) };
  }
  const socialProduct = pathname.match(/^\/api\/storefront\/products\/([^/]+)\/social-proof$/);
  if (socialProduct) {
    const product = products.find(item => item.id === decodeURIComponent(socialProduct[1]));
    if (!product) return undefined;
    const sold = empty ? 0 : product.sold;
    return { ...authority, source:'nx_product/nx_order/nx_order_item', productName:product.name,
      cumulativeSales:sold, windowDays:Number(url.searchParams.get('windowDays') || 30),
      windowSales:Math.floor(sold / 3), liveActivity:demoLiveActivity({id:product.id,sold},now) };
  }
  const base=(pathnameOverride=pathname)=>reviewFixture(new URL(pathnameOverride,url.origin),locale,state,request);
  if(pathname.startsWith('/api/trial/')) {
    const fleet=demoFleetFacts(url,locale,state);
    return trialDemo(url,locale,state,request,fleet.slotsUsed>=fleet.slotCap);
  }
  const commandKey=request.headers?.()['idempotency-key']||request.headers?.()['Idempotency-Key'];
  const remember=(operation,targetId,response,order)=>{
    if(commandKey){state.commands??={};state.commands[commandKey]={idempotencyKey:commandKey,operation,targetId,status:'SUCCEEDED',order:structuredClone(order),response:structuredClone(response)};}
    return response;
  };
  if(pathname.startsWith('/api/promotion-commands/'))return state.commands?.[decodeURIComponent(pathname.split('/').pop())]||{idempotencyKey:decodeURIComponent(pathname.split('/').pop()),operation:url.searchParams.get('operation'),targetId:url.searchParams.get('targetId'),status:'NOT_FOUND',order:null};
  if(request.method()==='POST'&&commandKey&&state.commands?.[commandKey])return structuredClone(state.commands[commandKey].response);
  if(pathname==='/api/config/platform'){
    const config=structuredClone(base());
    config.featureFlags.stakingVisible=state.stakingState!=='delisted';
    config.featureFlags.homeWeeklyPromoEnabled=true;
    config.share.baseUrl='https://demo.uvel.example/ref/';
    Object.assign(config.publicStats,{registeredUsersBase:12480,registeredUsersAnchorAt:demoStartedAt,registeredUsersTickIntervalSec:60,registeredUsersTickStepMin:3,registeredUsersTickStepMax:10,virtualUserCount:0,activeJobsBase:state.jobsBaseState==='published'?1000:null});
    // Globe split and drift; totals come from networkPulse.onlineDevices and the task-centre job count.
    const globeCenters=[['sg',236000,18,12.5],['jp',253000,22,13],['vn',163000,26,8.5],['uk',249000,16,12],['fr',208000,20,10],['de',217000,14,11],['us-ny',316000,24,17],['us-sj',284000,17,16]];
    // Old shape: nodes as weights plus the retired jitter/ratio fields. B22 shape: sharePct only.
    config.publicStats.globeDisplay=state.globeShareState==='nodes'
      ?{intervalMs:5400,nodeJitterPct:.4,activeJobsMinPct:8,activeJobsMaxPct:14,throughputMin:2.2,throughputMax:3.8,latencyJitterMs:6,centers:globeCenters.map(([id,nodes,latencyMs])=>({id,nodes,latencyMs}))}
      :{intervalMs:5400,throughputMin:2.2,throughputMax:3.8,latencyJitterMs:6,centers:globeCenters.map(([id,,latencyMs,sharePct],i)=>({id,latencyMs,sharePct:state.globeShareState==='invalid'&&i===0?sharePct-10:sharePct}))};
    if(state.globeShareState==='missing')delete config.publicStats.globeDisplay;
    // Verified aggregates feed the trust centre's platform figures; the empty fixture has none.
    const aggregate=(value,kind)=>({value,definition:'Preview figure',kind});
    config.publicStats.verified=empty?null:{activeAccounts:aggregate(8642,'COUNT'),registeredAccounts:aggregate(12480,'COUNT'),installedDevices:aggregate(3315,'COUNT'),onlineDevices:aggregate(2968,'COUNT'),completedPayoutUsdt:aggregate(1284650.5,'SUM'),capturedAt:new Date(demoStartedAt).toISOString()};
    if(empty){delete config.publicStats.registeredUsersBase;config.publicStats.networkPulse=null;}
    return withDemoShareChannels(config,state);
  }
  // Every new account gets the newcomer gift, so the register subtitle shows it even without a code.
  if(pathname==='/api/config/referral-rewards')return {...base(),welcomeGift:{lockMode:'risk_bucket',usdtAmount:5,nexAmount:20}};
  // Invite preview: one friend code (with a V rank) and one support-advisor code (no V rank); any other code is not found.
  const referralPreview=pathname.match(/^\/api\/public\/referrals\/([^/]+)\/preview$/);
  if(referralPreview){
    const code=decodeURIComponent(referralPreview[1]);
    const gift={status:'POSTED',usdtAmount:5,nexAmount:20};
    if(code==='NX8K2M4Q')return {code,kind:'USER',sourceEnvironment:'PRODUCTION',sponsor:{displayName:'M•••',vRank:'V3'},gift};
    if(code==='CS7K4MPQ')return {code,kind:'ADVISOR',sourceEnvironment:'PRODUCTION',sponsor:{displayName:'L•••',vRank:null},gift};
    const error=new Error('REFERRAL_PREVIEW_NOT_FOUND');error.status=404;throw error;
  }
  const learning=learningDemo(url,locale,state,request);if(learning!==undefined)return learning;
  const account=accountDemo(url,locale,state,request);if(account!==undefined)return account;
  const bank=bankDemo(url,state,request);if(bank!==undefined)return bank;
  const risk=riskDemo(url,locale,state,request);if(risk!==undefined)return risk;
  if(pathname==='/api/app/home/overview') {
    const overview=structuredClone(base());
    // A settlement lands every 20s, so each Home refresh brings new rows for the live feed to reveal.
    const settlementPool=[['Pocket Studios','SDXL Turbo',.0031],['Helix Labs','Llama 70B',.0024],['Echo Earbuds','Whisper tiny',.00009],['Mosaic','Flux dev',.0042],['Vector Foundry','MobileBERT',.00007],['Atrium AI','Qwen 7B',.0018]],settlementSlot=Math.floor(now/20000);
    const recentSettlements=Array.from({length:12},(_,i)=>{const slot=settlementSlot-i,[client,model,rewardUsdt]=settlementPool[slot%settlementPool.length];return {id:'DEMO-SETTLE-'+slot,client,model,rewardUsdt,completedAt:new Date(slot*20000).toISOString(),synthetic:false};});
    overview.earningsLedger=empty?[]:[...recentSettlements,...[['DEMO-EARNING-1','Demo Studio','SDXL',2.34],['DEMO-EARNING-2','Demo Lab','Llama',.00032],['DEMO-EARNING-3','Demo Lab','Whisper',.00005]].map(([id,client,model,rewardUsdt],index)=>({id,client,model,rewardUsdt,completedAt:new Date(now-(index+1)*600000).toISOString(),synthetic:false}))];
    if(!empty){
      overview.marketBoard={workloads:[
        {code:'IG',name:'SDXL Turbo',unit:null,price:.003,deltaPct:4.2,sparkline:[.4,.5,.42,.55,.6,.7,.72],flagshipDeltaPct:null},
        {code:'LL',name:'Llama 70B',unit:null,price:.0024,deltaPct:18.7,sparkline:[.3,.35,.4,.42,.6,.78,.88],flagshipDeltaPct:32.1},
        {code:'VG',name:'Video generation',unit:null,price:.1,deltaPct:-1.2,sparkline:[.8,.75,.78,.72,.7,.72,.69],flagshipDeltaPct:null},
      ],deviceRankings:[
        {rank:1,kind:'stellarbox-pro',name:'UVELBox Pro',dailyUsdt:22.4,bestFor:null},
        {rank:2,kind:'stellarbox-s1',name:'UVELBox S1',dailyUsdt:6.2,bestFor:null},
        {rank:3,kind:'phone',name:null,dailyUsdt:.06,bestFor:null},
      ]};
      overview.doTheMath={basis:'OWNED_DEVICE_TO_NEXT_CATALOG_PRODUCT',base:{kind:'stellarbox-s1',name:'UVELBox S1',dailyUsdt:6.2},target:{kind:'stellarbox-pro',productNo:'stellarbox-pro',name:'UVELBox Pro',dailyUsdt:22.4,priceUsdt:4999},multiplier:4,paybackDays:223};
      overview.onGrid={clients:[{id:'demo-grid-1',name:'Demo Studio',model:'SDXL Turbo',city:'Tokyo',gpus:30},{id:'demo-grid-2',name:'Demo Lab',model:'Llama 70B',city:'Singapore',gpus:57}],activeDevices:3206,activeJobs:128,perSecUsdt:.028};
    }
    return overview;
  }
  if(pathname==='/api/store/bundle-discount')return {source:'server',serverCanonical:true,policyVersion:1,tiers:[{minItems:2,rate:.04},{minItems:3,rate:.07},{minItems:4,rate:.11}]};
  const finance=financeDemo(url,state,request);if(finance!==undefined)return finance;
  const rankPolicy=rankPolicyDemo(url,locale);if(rankPolicy!==undefined)return rankPolicy;
  const teamGuides=teamGuidesDemo(url,locale,request,path=>demoFixture(new URL(path,url.origin),locale,state,request));if(teamGuides!==undefined)return teamGuides;
  const ambassador=ambassadorDemo(url,state,request);if(ambassador!==undefined)return ambassador;
  const auxiliary=auxiliaryDemo(url,locale,state,request);if(auxiliary!==undefined)return auxiliary;
  const staking=stakingDemo(url,state,request);if(staking!==undefined)return staking;
  const support=supportDemo(url,locale,state,request);if(support!==undefined)return support;
  const secondary=secondaryDemo(url,state,request);if(secondary!==undefined)return secondary;
  if(pathname==='/api/config/v-ranks') {
    const data=structuredClone(base());
    const own=[0,320,640,2000,4000,8000,16000,32000,64000],team=[0,1280,6400,20000,64000,160000,480000,1280000,3200000];
    data.ranks=data.ranks.map((rank,index)=>({...rank,cultivationBonus:rank.rewards.filter(reward=>reward.type==='UVT').reduce((sum,reward)=>sum+reward.amount,0),selfComputePoints:own[index],teamComputePoints:team[index]}));
    return data;
  }
  if(pathname==='/api/team/rank') {
    const data=structuredClone(base());
    return {...data,progress:{...data.progress,selfComputePoints:empty?0:state.highestRank?64000:1280,teamComputePoints:empty?0:state.highestRank?3200000:12800}};
  }
  if(pathname==='/api/team/binary')return {...authority,source:'server',runId:null,asOfDate:iso.slice(0,10),trackA:empty?0:2800,trackB:empty?0:2400,trackAMembers:empty?0:4,trackBMembers:empty?0:4,autoPlacedMembers:0,matchRate:.1,threshold:1000,dailyCap:5000,periodCap:150000,estimatedAmountUsdt:empty?0:240,settlePeriod:'monthly',residualPolicy:'carryForward',spilloverEnabled:false,gvReset:'monthly',paused:false,blockedReason:empty?'BOTH_TRACKS_BELOW_THRESHOLD':'',recentMatches:empty?[]:[{id:'DEMO-MATCH-1',amountUsdt:120,status:'unlocked',createdAt:new Date(now-day).toISOString(),unlockAt:new Date(now-day).toISOString()}]};
  if(pathname==='/auth/users/oauth/provider/available')return ['GOOGLE','APPLE','TELEGRAM'];
  if(pathname==='/auth/users/oauth/provider/linked')return ['GOOGLE'];
  if(pathname==='/api/store/catalog') return {...authority,source:'nx_product',revision:null,products:empty?[]:products};
  if(pathname==='/api/product/phase') return {phase:'P2',source:'H1_GROWTH_RHYTHM',devOverrideAllowed:false};
  if(pathname==='/api/store/purchase-eligibility') return {...authority,runId:null,productNo:url.searchParams.get('productNo'),eligible:state.catalogState!=='restricted',decisionCode:state.catalogState==='restricted'?'PURCHASE_GATE_NOT_MET':'ELIGIBLE',policies:[{policy:'E1',eligible:state.catalogState!=='restricted',decisionCode:state.catalogState==='restricted'?'PURCHASE_GATE_NOT_MET':'ELIGIBLE',mode:'ALL',conditions:state.catalogState==='restricted'?[{kind:'rank',required:3,current:2,gap:1,met:false}]:[]},{policy:'F4B',eligible:true,decisionCode:'F4B_NOT_CONFIGURED',mode:'ALL',conditions:[]}],evaluatedAt:now,source:'nx_product + nx_admin_device_sku + nx_user'};
  if(pathname==='/api/app/team/quota')return {...authority,source:'server',generatedAt:iso,facts:{rank:state.highestRank?8:2,directRefs:3,directInvites:3,activeDirect:2,teamComputePoints:12800},tiers:products.filter(p=>p.productType==='DEVICE').map(p=>({productId:p.id,quotaCode:p.id.toUpperCase(),name:p.name,price:p.price,monthlyStock:60,soldThisMonth:p.sold,unlockKind:'ALL',conditions:[{kind:'teamComputePoints',required:state.catalogState==='restricted'?20000:6400,current:empty?0:12800},...(state.catalogState==='restricted'?[{kind:'rank',required:3,current:2}]:[])],perks:[],available:p.available&&state.catalogState!=='restricted'}))};
  const tradeinCuts=[25,50,75,100],tradeinRates=[75,60,45,30,15];
  if(pathname==='/api/app/trade-in/config')return {enabled:!empty,eligibility:'OPEN',outputRatioCutsPct:tradeinCuts,creditRatesPct:tradeinRates,requireHigherPrice:true,maxDevicesPerOrder:1,earlyAccessEnabled:false,earlyAccessLeadDays:7,source:'server'};
  if(pathname==='/api/app/trade-in/eligibility'){
    // Paid devices may trade up to any higher-priced device SKU (PRD §7.5.1).
    const input=request.postDataJSON(),product=products.find(p=>p.id===input.targetProductNo)||products[0];
    const devices=empty||product.productType!=='DEVICE'?[]:demoFixture(new URL('/api/devices/earnings',url.origin),locale,state,request).devices;
    const sources=devices.filter(d=>d.actualPaidUsdt>0).map(d=>{
      const reasonCode=d.productCode.toLowerCase()===product.id?'TARGET_MUST_DIFFER':product.price>d.actualPaidUsdt?'OK':'HIGHER_PRICE_REQUIRED';
      return {sourceDeviceId:d.id,sourceProductName:d.name,eligible:reasonCode==='OK',reasonCode};
    });
    const eligible=sources.some(source=>source.eligible);
    return {enabled:!empty,eligible,decisionCode:eligible?'ELIGIBLE':'NO_ELIGIBLE_SOURCE',targetProductId:products.indexOf(product)+1,targetProductNo:product.id,targetProductName:product.name,targetPriceUsdt:product.price,requireHigherPrice:true,maxDevicesPerOrder:1,sources,decisionSource:'server'};
  }
  const tradeinQuote=(sourceDeviceId,targetProductNo)=>{
    const product=products.find(p=>p.id===targetProductNo)||products[0];
    const device=demoFixture(new URL('/api/devices/earnings',url.origin),locale,state,request).devices.find(d=>d.id===sourceDeviceId);
    if(!device)throw new Error('Unknown demo trade-in source');
    const ratio=Math.min(100,Math.round(device.cumulativeOutputUsdt/device.actualPaidUsdt*10000)/100),band=tradeinCuts.filter(cut=>ratio>=cut).length;
    const discount=Math.min(product.price,Math.round(device.actualPaidUsdt*tradeinRates[band])/100),payable=Math.round((product.price-discount)*100)/100,wallet=state.walletBalance??52800.64;
    return {sourceDeviceId:device.id,sourceRowVersion:device.rowVersion,targetDeviceStatus:device.activatedAt?'ACTIVE':'INACTIVE',sourceProductName:device.name,targetProductId:products.indexOf(product)+1,targetProductNo:product.id,targetProductName:product.name,sourceActualPaidUsdt:device.actualPaidUsdt,cumulativeOutputUsdt:device.cumulativeOutputUsdt,outputRatioPct:ratio,creditRatePct:tradeinRates[band],discountUsdt:discount,targetPriceUsdt:product.price,payableUsdt:payable,walletBalanceUsdt:wallet,walletShortfallUsdt:Math.max(0,payable-wallet),sufficientFunds:wallet>=payable,discountToWallet:false,pricingSource:'server'};
  };
  if(pathname==='/api/app/trade-in/quote'){const input=request.postDataJSON();return tradeinQuote(input.sourceDeviceId,input.targetProductNo);}
  if(pathname==='/api/app/trade-in/submit'){
    // Settles like the server: debit the payable, retire the old device, and put the new one in its place.
    const input=request.postDataJSON(),quote=tradeinQuote(input.sourceDeviceId,input.targetProductNo),product=products.find(p=>p.id===quote.targetProductNo);
    if(input.expectedSourceVersion!==quote.sourceRowVersion||Math.abs(input.expectedPayableUsdt-quote.payableUsdt)>0.000001||Math.abs(input.expectedDiscountUsdt-quote.discountUsdt)>0.000001)throw new Error('Demo trade-in quote changed');
    if(!quote.sufficientFunds)refuse('TRADEIN_INSUFFICIENT_FUNDS');
    state.walletBalance=Math.round((quote.walletBalanceUsdt-quote.payableUsdt)*100)/100;
    (state.retiredDeviceIds||=[]).push(quote.sourceDeviceId);
    const active=quote.targetDeviceStatus==='ACTIVE',sequence=state.nextOrderNo=(state.nextOrderNo??now)+1,orderNo='DEMO-ORDER-'+sequence;
    const targetDeviceId=state.deviceSequence=(state.deviceSequence||1000)+1;(state.deviceIds??={})[orderNo+'-0-0']=targetDeviceId;
    const canonicalStatus=active?'activated':'inventory';
    const order={...demoOrders(products,state,now)[0],orderNo,productNo:product.id,productName:product.name,quantity:1,subtotalUsdt:product.price,unitPriceUsdt:product.price,discountUsdt:quote.discountUsdt,amountUsdt:quote.payableUsdt,paymentMethod:'WALLET',orderType:'TRADE_IN',itemCount:1,
      lineItems:[{sku:product.id,name:product.name,quantity:1,unitPriceUsdt:product.price,lineAmountUsdt:product.price}],tradeinNo:'DEMO-TRADEIN-'+sequence,sourceDeviceId:quote.sourceDeviceId,targetDeviceId,targetDeviceInstanceNo:orderNo+'-0-0',
      paymentStatus:'PAID',orderStatus:'COMPLETED',activationStatus:active?'ACTIVATED':'INVENTORY',canonicalStatus,placedAt:now,expiresAt:null,paidAt:now,activatedAt:active?now:null};
    (state.createdOrders||=[]).unshift(order);
    return remember('tradeinSubmit',orderNo,{tradeinNo:order.tradeinNo,orderNo,sourceDeviceId:quote.sourceDeviceId,targetDeviceId,targetDeviceStatus:quote.targetDeviceStatus,applicationStatus:'COMPLETED',orderStatus:'COMPLETED',discountUsdt:quote.discountUsdt,walletDebitUsdt:quote.payableUsdt,walletBalanceAfterUsdt:state.walletBalance},order);
  }
  if(pathname==='/api/app/trade-in/capacity-quote'){
    const input=request.postDataJSON(),product=products.find(p=>p.id===input.targetProductNo)||products[0],data=structuredClone(base());
    Object.assign(data,{targetProductId:products.indexOf(product)+1,targetProductNo:product.id,targetProductName:product.name,targetPriceUsdt:product.price});
    const fleet=demoFleetFacts(url,locale,state),active=fleet.devices.filter(device=>device.activatedAt!==null),full=fleet.slotsUsed>=fleet.slotCap;
    Object.assign(data,{decision:full?(active.length?'REPLACE_REQUIRED':'NO_ACTIVE_DEVICE'):'CAPACITY_AVAILABLE',activeDevices:active.length,maxActiveDevices:fleet.slotCap,
      sourceDeviceId:full?active[0]?.id??null:null,sourceDeviceName:full?active[0]?.name??null:null,
      payableUsdt:product.price,walletBalanceUsdt:state.walletBalance??52800.64,sufficientFunds:(state.walletBalance??52800.64)>=product.price});
    return data;
  }
  if(pathname==='/api/orders/quote') {
    const input=request.postDataJSON();
    const items=input.items.map((item,index)=>{
      const product=products.find(p=>p.id===item.productNo);
      if(!product) throw new Error('Unknown demo SKU');
      return {...item,lineId:'demo-line-'+index,unitPriceUsdt:product.price.toFixed(2),subtotalUsdt:(product.price*item.quantity).toFixed(2),discountUsdt:'0.00',payableUsdt:(product.price*item.quantity).toFixed(2)};
    });
    const subtotal=items.reduce((sum,item)=>sum+Number(item.subtotalUsdt),0).toFixed(2);
    const quote={quoteId:'demo-quote-'+now+'-'+(state.quoteSequence=(state.quoteSequence||0)+1),voucherId:input.voucherId||null,quoteHash:'demo-quote-hash',serverTime:iso,expiresAt:new Date(now+300000).toISOString(),itemCount:items.length,quantity:items.reduce((sum,item)=>sum+item.quantity,0),items,subtotalUsdt:subtotal,discountUsdt:'0.00',amountUsdt:subtotal,bundlePolicyVersion:1,activityId:input.activityId||null,activityVersion:input.activityId?1:null,eligibility:'ELIGIBLE',expectedRewards:[],warnings:[],reserved:false};
    if(input.activityId){const activity=demoFixture(new URL('/api/promotions/'+input.activityId,url.origin),locale,state,request);for(const line of items){const rule=activity.rewardRules?.find(r=>r.productNo===line.productNo);if(rule){const {disclosure,...reward}=rule.buyerReward;quote.expectedRewards.push({lineId:line.lineId,activityId:activity.activityId,version:activity.version,ruleId:rule.ruleId,rewardRuleId:reward.rewardRuleId,beneficiaryRole:reward.beneficiaryRole,groups:1,reward,disclosure,eligibility:'ELIGIBLE',message:null});}}}
    const bundleDiscount=Number((Number(subtotal)*bundleRate(items.length)).toFixed(2));
    let remaining=bundleDiscount+voucherDiscount(state,input.voucherId,Number(subtotal)-bundleDiscount);quote.discountUsdt=remaining.toFixed(2);quote.amountUsdt=(Number(subtotal)-remaining).toFixed(2);
    for(const line of items){const discount=Math.min(remaining,Number(line.subtotalUsdt));line.discountUsdt=discount.toFixed(2);line.payableUsdt=(Number(line.subtotalUsdt)-discount).toFixed(2);remaining-=discount;}
    // PromotionQuoteService.applyDiscounts: an order discount stays in its purchase line, never exceeds what that line
    // still owes, leaves something to pay, and never becomes a wallet reward.
    for(const entry of quote.expectedRewards.filter(row=>row.reward.type==='DISCOUNT_USDT')){
      const line=items.find(row=>row.lineId===entry.lineId),discount=Number(entry.reward.amount);
      if(discount>Number(line.payableUsdt))refuse('PROMOTION_DISCOUNT_EXCEEDS_LINE_AMOUNT');
      Object.assign(line,{promotionDiscountUsdt:discount.toFixed(2),discountUsdt:(Number(line.discountUsdt)+discount).toFixed(2),payableUsdt:(Number(line.payableUsdt)-discount).toFixed(2)});
      Object.assign(quote,{promotionDiscountUsdt:(Number(quote.promotionDiscountUsdt??0)+discount).toFixed(2),discountUsdt:(Number(quote.discountUsdt)+discount).toFixed(2),amountUsdt:(Number(quote.amountUsdt)-discount).toFixed(2)});
    }
    if(quote.promotionDiscountUsdt&&Number(quote.amountUsdt)<=0)refuse('PROMOTION_DISCOUNT_REQUIRES_PAYMENT');
    if(!demoOrderFitsCapacity(url,locale,state,products,items)){
      quote.eligibility='INELIGIBLE';
      quote.warnings.push({zh:'设备槽不足，请先在设备管理中腾出位置或减少购买数量。',en:'Not enough device slots. Free up a slot in device management or reduce the quantity.',vi:'Không đủ vị trí thiết bị. Hãy giải phóng vị trí trong phần quản lý thiết bị hoặc giảm số lượng mua.'});
    }
    state.quotes||={};state.quotes[quote.quoteId]=quote;return quote;
  }
  if(pathname==='/api/genesis/state') return url.searchParams.has('history')?{...authority,items:[],nextCursor:null}:genesisPublic(now);
  if(pathname==='/api/genesis/account') return url.searchParams.has('history')?{...authority,items:[],nextCursor:null}:{...authority,series:null,sale:null,eligibility:null,marketEnabled:false,emissionOpen:false,holdings:[],emissions:[],orders:[],walletBalanceUsdt:5280};
  if(pathname==='/api/genesis/eligibility') return {...authority,eligible:false,reasons:['SALE_NOT_OPEN'],ownedCount:0,maxPerUser:2,remainingCap:2,minAccountAgeDays:0,accountAgeDays:42,status:'NOT_ELIGIBLE',reservedAllocation:null,reservedAllocationUnit:'UVT',priorityRank:null,priorityTier:'NONE',qualificationReasonCodes:['NO_ACTIVE_HOLDINGS'],policyVersion:null,effectiveAt:null,asOf:iso,serverTime:iso,provenance:{source:'nx_genesis_holding+nx_config_item',environment:'PRODUCTION',runId:''},halted:false};
  if(pathname==='/api/orders'&&(!request?.method||request.method()==='GET')) return {...authority,runId:null,source:'server',orders:demoAccountOrders(url,locale,state,now),nextCursor:null};
  if(['/api/orders','/api/orders/bundle'].includes(pathname)&&request.method()==='POST'){
    const input=request.postDataJSON(),quote=state.quotes?.[input.promotionQuoteId];
    const lines=quote?.items||input.items||input.productNos?.map(productNo=>({productNo,quantity:1}))||[{productNo:input.productNo,quantity:input.quantity}],product=products.find(p=>p.id===lines[0].productNo);
    if(lines.some(line=>!products.some(p=>p.id===line.productNo)||!Number.isInteger(line.quantity)||line.quantity<1))throw new Error('Invalid demo order items');
    if(!demoOrderFitsCapacity(url,locale,state,products,lines))refuse('PROMOTION_CAPACITY_UNAVAILABLE');
    const quantity=lines.reduce((s,l)=>s+l.quantity,0),subtotal=lines.reduce((s,l)=>s+products.find(p=>p.id===l.productNo).price*l.quantity,0),discountRate=bundleRate(lines.length),bundleDiscount=Number((subtotal*discountRate).toFixed(2)),voucherAmount=voucherDiscount(state,input.voucherId??quote?.voucherId,subtotal-bundleDiscount),amount=Number(quote?.amountUsdt??(subtotal-bundleDiscount-voucherAmount).toFixed(2));
    if(input.productNos&&(input.policyVersion!==1||Math.abs(input.expectedAmountUsdt-amount)>0.000001))throw new Error('Demo bundle quote changed');
    const order={...demoOrders(products,state,now)[0],orderNo:'DEMO-ORDER-'+(state.nextOrderNo=(state.nextOrderNo??now)+1),productNo:product.id,productName:product.name,quantity,subtotalUsdt:subtotal,unitPriceUsdt:product.price,discountUsdt:Number((subtotal-amount).toFixed(6)),amountUsdt:quote?amount.toFixed(2):amount,placedAt:now,orderType:lines.length>1?'BUNDLE':'SINGLE',itemCount:lines.length,lineItems:lines.map(l=>({sku:l.productNo,name:products.find(p=>p.id===l.productNo).name,quantity:l.quantity,unitPriceUsdt:products.find(p=>p.id===l.productNo).price,lineAmountUsdt:products.find(p=>p.id===l.productNo).price*l.quantity}))};
    if(quote)Object.assign(order,{promotionQuoteId:quote.quoteId,payBy:new Date(now+paymentWindow).toISOString(),items:quote.items.map(l=>({...l,productName:products.find(p=>p.id===l.productNo).name})),rewards:quote.expectedRewards});
    Object.assign(order,{paymentStatus:'PENDING',orderStatus:'PENDING_PAYMENT',activationStatus:'WAITING_PAYMENT',canonicalStatus:'placed',expiresAt:now+paymentWindow,paidAt:null,activatedAt:null,targetDeviceId:null,targetDeviceInstanceNo:null});
    if(voucherAmount>0){state.voucherUsed=true;order.voucherId='V-DESIGN';}
    state.createdOrders||=[];state.createdOrders.unshift(order);
    const response=quote?order:input.productNos?{orderNo:order.orderNo,orderType:'BUNDLE',itemCount:lines.length,productNos:input.productNos,subtotalUsdt:subtotal,discountRate,discountUsdt:Number((subtotal-amount).toFixed(6)),amountUsdt:amount,paymentStatus:'PENDING',orderStatus:'PENDING_PAYMENT',idSource:'server',policyVersion:1}:{orderNo:order.orderNo,subtotalUsdt:subtotal,discountUsdt:Number((subtotal-amount).toFixed(6)),amountUsdt:amount,voucherId:order.voucherId||null,voucherRedemption:order.voucherId?{voucherId:order.voucherId,grantId:'DEMO-GRANT',status:'REDEEMED',discountUsdt:voucherAmount}:null,paymentStatus:'PENDING',orderStatus:'PENDING_PAYMENT',idSource:'server'};
    return remember(lines.length>1?'createBundle':'createOrder',quote?.quoteId||order.orderNo,response,order);
  }
  const orderAction=pathname.match(/^\/api\/orders\/(DEMO-ORDER-\d+)\/(pay|cancel)$/);
  if(orderAction){
    const [,orderNo,action]=orderAction,order=demoAccountOrders(url,locale,state,now).find(o=>o.orderNo===orderNo);
    if(!order) return {};
    const replay=order.paymentStatus==='PAID';
    if(action==='pay'&&!['PENDING','PAID'].includes(order.paymentStatus)||action==='cancel'&&order.paymentStatus==='PAID')throw new Error('Demo order action unavailable');
    if(action==='pay'&&!replay&&!demoOrderFitsCapacity(url,locale,state,products,order.lineItems.map(line=>({productNo:line.sku,quantity:line.quantity})),orderNo))refuse('PROMOTION_CAPACITY_UNAVAILABLE');
    if(action==='pay'&&!replay){if(Number(order.amountUsdt)>(state.walletBalance??52800.64))refuse('ORDER_WALLET_INSUFFICIENT');state.walletBalance=(state.walletBalance??52800.64)-Number(order.amountUsdt);}
    state.orderStatuses||={};state.orderStatuses[orderNo]=action==='pay'?'activated':'cancelled';
    const canonicalStatus=state.orderStatuses[orderNo],[paymentStatus,orderStatus,activationStatus]=orderStates[canonicalStatus];
    if(state.createdOrders?.includes(order))Object.assign(order,{canonicalStatus,paymentStatus,orderStatus,activationStatus,paymentMethod:Number(order.amountUsdt)===0?'VOUCHER':'WALLET',paidAt:action==='pay'?now:null,activatedAt:action==='pay'?now:null});
    if(action==='cancel')return remember('cancelOrder',orderNo,{...(order.promotionQuoteId?order:{}),...authority,source:'server',orderNo,orderStatus:'CANCELLED',paymentStatus:'CANCELLED',idempotent:false},order);
    const response={...(order.promotionQuoteId?order:{}),...authority,source:'server',orderNo,paymentNo:'DEMO-PAY-'+orderNo,paymentStatus:'PAID',orderStatus:'COMPLETED',activationStatus:'ACTIVATED',canonicalStatus:'activated',amountUsdt:order.promotionQuoteId?Number(order.amountUsdt).toFixed(2):Number(order.amountUsdt),paymentMethod:Number(order.amountUsdt)===0?'VOUCHER':'WALLET',walletBalanceAfterUsdt:Number(order.amountUsdt)===0?null:state.walletBalance??52800.64,idempotent:replay};
    return remember('payOrder',orderNo,response,order);
  }
  if(pathname==='/api/promotions'||/^\/api\/promotions\/demo-promo-\d+$/.test(pathname)) {
    const sample=base('/api/promotions').items[0];
    const configs=[['SKU_GIFT','买 S1，送 Cloud Share','Buy S1, get Cloud Share','Mua S1, tặng Cloud Share','stellarbox-s1'],['FIRST_PURCHASE','首购成长礼','First purchase reward','Quà mua lần đầu','stellarbox-s1'],['DIRECT_REFERRAL','邀请好友购机礼','Referral purchase reward','Quà giới thiệu','stellarbox-pro'],['MULTI_PRODUCT','算力组合礼','Compute bundle offer','Ưu đãi kết hợp','stellarrack-p1'],['REPURCHASE','老用户加购礼','Returning member offer','Ưu đãi mua thêm','cloud-share']];
    const items=empty||state.eventState==='empty'?[]:configs.map(([template,zh,en,vi,productNo],i)=>{
      const item=structuredClone(sample);item.activityId='demo-promo-'+i;item.template=template;item.title={zh,en,vi};item.productNos=template==='MULTI_PRODUCT'?['stellarbox-pro','stellarrack-p1','stellarbox-s1']:[productNo];item.placement=[0,1,4].includes(i)?'home.purchase-promotion':null;
      item.rewardRules[0].productNo=productNo;item.rewardRules[0].ruleId='demo-rule-'+i;
      item.serverTime=iso;
      // Landing pages (P-58): eligibility follows the panel switch; first purchase and repurchase end in under six days.
      item.eligibility={eligible:'ESTIMATE_ELIGIBLE','sign-in':'SIGN_IN_REQUIRED',ineligible:'INELIGIBLE',unknown:'UNKNOWN'}[state.promotionEligibility]||'ESTIMATE_ELIGIBLE';
      if(i>0)item.endsAt=new Date(now+6*day-19*60000).toISOString();
      if(i===0){
        item.startsAt=new Date(now-2*day).toISOString();item.endsAt=new Date(now+28*day-60*60000).toISOString();
        const giftName='Cloud Share';
        const reward=item.rewardRules[0].buyerReward;reward.giftProductNo='cloud-share';reward.quantity=1;
        reward.disclosure.deviceName=giftName;
        reward.disclosure.benefitDescription={zh:'送 '+giftName+' 1 份',en:'Get 1 '+giftName,vi:'Tặng 1 '+giftName};
        reward.disclosure.terms={zh:'订单付款完成后，赠品发放到你的设备仓库。',en:'Once the order is paid, the gift is added to your device inventory.',vi:'Sau khi đơn hàng được thanh toán, quà tặng sẽ vào kho thiết bị của bạn.'};
        reward.disclosure.refundTerms={zh:'整单退款时，赠品随订单一并撤销。',en:'If the whole order is refunded, the gift is withdrawn with it.',vi:'Khi hoàn tiền toàn bộ đơn hàng, quà tặng sẽ bị thu hồi cùng đơn.'};
        reward.disclosure.deviceRights={activationMode:'AUTO',effectiveOn:'ISSUED',durationDays:365,taskEnabled:true,countsAsDeviceHolding:true,countsForRank:false,transferable:false,exchangeable:false,revocationMode:'REVOKE_IF_UNUSED'};
        if(state.promotionRewardType==='gift-discount')item.rewardRules[0].buyerReward={rewardRuleId:reward.rewardRuleId,beneficiaryRole:'BUYER',type:'DISCOUNT_USDT',calculation:'FIXED',amount:'100',disclosure:orderDiscountDisclosure(100)};
      }
      if(i>0){const d=item.rewardRules[0].buyerReward.disclosure;d.deviceName=null;d.title={zh:'购机奖励',en:'Purchase reward',vi:'Thưởng mua hàng'};d.benefitDescription={zh:'领取 '+(i*50)+' UVT',en:'Receive '+(i*50)+' UVT',vi:'Nhận '+(i*50)+' UVT'};item.rewardRules[0].buyerReward=state.promotionRewardType==='discount'&&orderDiscounts[i]?{rewardRuleId:'demo-reward-'+i,beneficiaryRole:'BUYER',type:'DISCOUNT_USDT',calculation:'FIXED',amount:String(orderDiscounts[i]),disclosure:orderDiscountDisclosure(orderDiscounts[i])}:{rewardRuleId:'demo-reward-'+i,beneficiaryRole:'BUYER',type:'UVT',amount:String(i*50),disclosure:d};}
      if(state.eventState==='upcoming'){item.state='SCHEDULED';item.startsAt=new Date(now+day).toISOString();}else if(state.eventState==='ended'){item.state='ENDED';item.endsAt=new Date(now-day).toISOString();}
      // Boundary scenarios flip on the clock, one minute after the switch.
      const edge=(state.promotionTimingAt||now)+60000;
      if(state.promotionTiming==='starting'){item.startsAt=new Date(edge).toISOString();item.state=now<edge?'SCHEDULED':'ACTIVE';}
      else if(state.promotionTiming==='ending'){item.endsAt=new Date(edge).toISOString();item.state=now<edge?'ACTIVE':'ENDED';}
      // Like PromotionPublicService, an offer that is not running is never eligible.
      if(item.state!=='ACTIVE')item.eligibility='INELIGIBLE';
      if(state.machineImageState==='banner'&&item.state==='ACTIVE')item.bannerImageUrl=`/api/promotions/${item.activityId}/banner/${item.version}`;
      return item;
    });
    if(pathname!=='/api/promotions') return items.find(item=>item.activityId===pathname.split('/').pop())||{};
    const activityId=url.searchParams.get('activityId'),placement=url.searchParams.get('placement');
    return {items:items.filter(item=>(!activityId||item.activityId===activityId)&&(!placement||item.placement===placement)),hasMore:false,nextCursor:null};
  }
  if(pathname==='/api/content/trust/documents') {
    // Mirrors the backend defaults (resources/trust-documents); the preview server reads the PDFs and pre-rendered pages/<slot>/<n>.jpg from DEMO_TRUST_DOCUMENTS_DIR.
    const doc=(slot,fileName,sizeBytes,pageCount,sha256,extra)=>({slot,source:'DEFAULT',version:null,language:'English',referenceNo:null,verifyUrl:null,fileName,sizeBytes,pageCount,sha256,fileUrl:slot==='whitepaper'?null:`/api/content/trust/documents/${slot}/file?v=${sha256.slice(0,12)}`,updatedBy:null,updatedAt:null,...extra});
    return {profile:{legalName:'UVEL AI LTD.',jurisdiction:'New York, USA',registeredAddress:'New York, NY 10065',nyDosId:'8040896',nyFilingNumber:'261008000079',authorizedCapitalUsd:'50000000'},documents:[
      doc('whitepaper','uvel-whitepaper-v1.3-en.pdf',524389,21,'4640565490b7f057fc8a6b0ff3ed77e72b4e9f0289a4eada0b85d461d9905d20',{version:'v1.3'}),
      doc('incorporation','uvel-ai-ltd-certificate-of-incorporation.pdf',436231,3,'e10c9338ccf13c56a19ace427b2fcec4aa4033bafc20d312b48d772d3cb83932',{referenceNo:'8040896',verifyUrl:'https://apps.dos.ny.gov/publicInquiry/'}),
      doc('msb','uvel-ai-ltd-fincen-msb-registration.pdf',29958,1,'ab505be01d126b6bd526e32f78f2defba53a3996300da91c5f5d0c8fd7f29482',{referenceNo:'31000342955895',verifyUrl:'https://www.fincen.gov/msb-state-selector'}),
      doc('ein','uvel-ai-ltd-irs-ein-notice.pdf',10316,1,'8a629967dcf8333faefa21f3935bdbdd388acc4923bdd826435fa4d1d978f5b7',{referenceNo:'43-2288822'}),
    ]};
  }
  if(pathname==='/api/content/trust/sections/current') {
    const example=localized(locale,'原型演示资料，非真实资质或认证。','Prototype sample, not a real credential or certification.','Dữ liệu mẫu, không phải chứng nhận thực tế.');
    // Leadership and service notes follow the company records and the white paper; registrations come from /api/content/trust/documents.
    const maps={financials:{overview:example},
      leadership:{leader1Name:'Jordan Nicholas Parkhurst',leader1Role:localized(locale,'总裁兼首席执行官 · President & CEO','President & Chief Executive Officer','Chủ tịch kiêm Tổng giám đốc điều hành'),leader1Url:'https://apps.dos.ny.gov/publicInquiry/'},
      nexNarrative:{hero:'UVT',subhero:example,
        hostingContent:localized(locale,'Uvel Node 与 Uvel Rack 部署在专业数据中心，运行环境、网络配置和现场维护统一管理，无需寄送实体设备。购买后在 App 中激活和管理设备，订单与设备记录随时可查。','Uvel Node and Uvel Rack run in professional data centres, where the operating environment, network and on-site maintenance are managed for you; nothing is shipped. Activate and manage devices in the App, with order and device records always available.','Uvel Node và Uvel Rack được đặt tại trung tâm dữ liệu chuyên nghiệp; môi trường vận hành, mạng và bảo trì tại chỗ đều được quản lý tập trung, không cần giao thiết bị vật lý. Bạn kích hoạt và quản lý thiết bị trong App, hồ sơ đơn hàng và thiết bị luôn sẵn sàng tra cứu.'),
        warrantyContent:localized(locale,'设备故障、更换或重新配置、退款均按下单时的服务条款处理。遇到问题时，在 App 内联系专属客服并提供订单号，处理进度全程可查。','Faults, replacements or reconfiguration and refunds follow the service terms agreed when you ordered. Contact your dedicated advisor in the App with the order number and follow progress at every step.','Sự cố thiết bị, thay thế hoặc cấu hình lại và hoàn tiền được xử lý theo điều khoản dịch vụ khi đặt hàng. Khi cần hỗ trợ, hãy liên hệ chuyên viên riêng trong App kèm mã đơn hàng và theo dõi tiến độ xử lý.'),
        securityContent:localized(locale,'参与算力任务无需提供钱包私钥或助记词。登录、修改收款地址、提现等重要操作都需要身份确认并留有操作记录；处理中、锁定与可用资金分开显示。','Taking part in compute tasks never requires your wallet private key or recovery phrase. Sign-in, receiving-address changes and withdrawals all require identity confirmation and are recorded; funds in progress, locked and available are shown separately.','Tham gia tác vụ điện toán không bao giờ yêu cầu khóa riêng tư hay cụm từ khôi phục ví. Đăng nhập, thay đổi địa chỉ nhận và rút tiền đều cần xác minh danh tính và được ghi nhật ký; số tiền đang xử lý, bị khóa và khả dụng được hiển thị riêng.')},
      complianceBadges:{badge1Label:localized(locale,'合规资料示例','Compliance sample','Mẫu tuân thủ'),badge1Body:example},
      auditsReserves:{homepageProof:''},
      listings:{overview:example}};
    return {...authority,source:'nx_trust_section_version:published',sections:Object.entries(maps).map(([sectionKey,values])=>({sectionKey,version:'v1',description:example,structure:'Published resources',fields:Object.entries(values).map(([key,value])=>({key,label:key,value:empty?'':value}))}))};
  }
  if(pathname==='/api/promotion-rewards'||/^\/api\/promotion-rewards\/demo-reward-\d+$/.test(pathname)){
    // A discount lives on the quote and the order: it creates no reward obligation, and history keeps its gift.
    const offer=demoFixture(new URL('/api/promotions/demo-promo-0',url.origin),locale,{...state,eventState:'mixed',dataState:'normal',promotionRewardType:'reward'},request),spec=offer.rewardRules[0].buyerReward,{disclosure,...reward}=spec;
    // The rows belong to sample order 004 and share its timeline; without that order there are none.
    const order=demoAccountOrders(url,locale,state,now).find(row=>row.orderNo==='DEMO-ORDER-004'),issuedAt=order&&new Date(order.activatedAt).toISOString();
    const items=empty||!order?[]:['PENDING','READY','PROCESSING','ISSUED','RETRYABLE_FAILED','OUTCOME_UNKNOWN','CANCELLED','REVERSAL_PENDING','REVERSED','MANUAL_REVIEW'].map((status,i)=>({obligationId:'demo-reward-'+i,orderNo:'DEMO-ORDER-004',activityId:'demo-promo-0',orderLineId:'demo-line-0',updatedAt:issuedAt,reward,disclosure,refundHold:status==='REVERSAL_PENDING',beneficiaryRole:'BUYER',state:status,refundRequestIds:[],assetReceipt:status==='ISSUED'?{deviceIds:[41],instanceNos:['REVIEW-S1'],source:'PROMOTION_GIFT',issuedAt,ledgerBizNo:null,earningsEntryNo:null}:null}));
    if(pathname!=='/api/promotion-rewards')return items.find(r=>r.obligationId===pathname.split('/').pop())||{};
    return {items:items.filter(r=>['state','activityId','orderNo'].every(key=>!url.searchParams.get(key)||r[key]===url.searchParams.get(key))),nextCursor:null,hasMore:false};
  }
  if(/^\/api\/promotions\/demo-promo-\d+\/referral-progress$/.test(pathname))return {activityId:pathname.split('/')[3],qualifyingOrders:2,ownRewards:[],serverTime:iso};
  if(pathname==='/api/app/security/account-deletion')return {status:'NONE'};
  if(pathname==='/api/app/security/phone-number')return {windowDays:30,maxChanges:2,usedChanges:0,remainingChanges:2,nextAvailableAt:iso};
  if(pathname==='/api/quests/state') {
    const data=reviewFixture(url,locale,{...state,taskState:state.dayOneClaimed?'claimed':state.taskState},request);
    if(empty) return {...data,quests:[],dayOneRequiredTaskCount:0,dayOneSnapshotStatus:'EMPTY'};
    const routes=['/pages/me/devices','/pages/store/store','/pages/earn/earn','/pages/learn/courses','/pages/me/profile','/pages/team/team'];
    data.quests.forEach((row,i)=>{row.actionRoute=routes[i];row.category=['identity','explore','explore','explore','identity','social'][i];});
    const weekNames=locale==='zh'?['了解设备收益','完成一门课程','邀请一位好友','查看账户安全']:locale==='vi'?['Tìm hiểu thu nhập','Hoàn thành một bài học','Mời một người bạn','Kiểm tra bảo mật']:['Explore device earnings','Complete one course','Invite a friend','Review account security'];
    if(state.taskState!=='empty') data.quests.push(...weekNames.map((name,i)=>({questCode:'demo-week-'+i,name,layer:i===0?'WEEKLY_T1':'WEEKLY_T2',rewardNex:100+i*25,status:state.weekClaims?.includes(i)?'CLAIMED':state.taskState==='complete'?'CLAIMABLE':state.taskState==='claimed'?'CLAIMED':state.taskState==='expired'?'EXPIRED':i===1?'CLAIMABLE':'PENDING',category:i===2?'social':'explore',actionRoute:['/pages/earn/earn','/pages/learn/courses','/pages/team/team','/pages/me/profile'][i],instanceKey:'WEEK:demo',eligibleFrom:new Date(now-day).toISOString(),eligibleUntil:new Date(now+(state.taskState==='expired'?-1000:5*day)).toISOString(),eligible:!['claimed','expired'].includes(state.taskState)&&!state.weekClaims?.includes(i)})));
    data.promoBanner={bannerCode:'demo-weekly',baseReward:300,multiplier:1,countdownDays:5,countdownHours:0,targetDevice:'UVELBox Pro',targetDaily:22.4,status:'active'};
    return data;
  }
  if(pathname==='/api/content/learning/courses'&&empty)return {...authority,courses:[],completedCourses:0,totalCourses:0,earnedNex:0,rewardTitles:{}};
  const questClaim=pathname.match(/^\/api\/quests\/([^/]+)\/claim$/);
  if(questClaim){const code=decodeURIComponent(questClaim[1]);if(code.startsWith('demo-week-')){state.weekClaims||=[];state.weekClaims.push(Number(code.split('-').pop()));}else state.dayOneClaimed=true;return {...authority,questId:code,rewardNex:code.startsWith('demo-week-')?100+Number(code.split('-').pop())*25:500,status:'CLAIMED',instanceKey:code.startsWith('demo-week-')?'WEEK:demo':'DAY_ONE:design-review'};}
  const events=demoEvents(locale,state,now);
  if(pathname==='/api/events') return {events,serverTimeUtc:iso,source:'nx_event + nx_user_event'};
  const eventRoute=pathname.match(/^\/api\/events\/(demo-[^/]+)\/(detail|join|claim|reminder|spin(?:\/state)?)$/);
  if(eventRoute) {
    const [,id,action]=eventRoute,event=events.find(item=>item.eventCode===id);
    if(!event) return {};
    if(action==='detail') return {event,rules:{description:event.subtitle,terms:localized(locale,'完成对应活动条件即可领取；每个账号限领一次。','Complete the activity goals. One reward per account.','Hoàn thành mục tiêu. Mỗi tài khoản nhận một lần.')},enabled:event.state!=='ended',eligible:event.state==='ongoing',eligibilityReason:event.state==='upcoming'?'NOT_STARTED':event.state==='ended'?'ENDED':event.userStatus==='CLAIMED'?'CLAIMED':event.userStatus==='CLAIMABLE'?'READY':'IN_PROGRESS',progressValue:event.progressValue,targetValue:event.targetValue,rewards:[{type:'UVT',amount:event.rewardAmount}],results:[],userStatus:event.userStatus,claimKeys:[],reminderSubscribed:!!state.reminders?.includes(id)};
    if(action==='join'){state.eventStatuses||={};state.eventStatuses[id]='JOINED';return {eventId:id,status:'JOINED'};}
    if(action==='claim'){state.eventStatuses||={};state.eventStatuses[id]='CLAIMED';return {eventId:id,rewardType:'UVT',rewardAmount:event.rewardAmount,badgeCode:null};}
    if(action==='reminder'){state.reminders||=[];state.reminders.push(id);return {eventId:id,status:'SUBSCRIBED'};}
    const segments=[5,10,20,50,100,200].map((amount,index)=>({tierId:'demo-tier-'+index,rewardType:'UVT',rewardAmount:amount,rewardName:amount+' UVT',realOutflow:false,displayOrder:index}));
    if(action==='spin/state') return {eventCode:id,eventId:id,serverDate:iso.slice(0,10),nextResetAtUtc:new Date(now+day).toISOString(),freeAvailable:!state.spun,bonusTickets:0,availableSpins:state.spun?0:1,segments,history:state.spinHistory||[],source:'nx_event_spin'};
    state.spun=true;const result={spinId:'demo-spin-'+now,eventId:id,spinDate:iso.slice(0,10),sourceType:'DAILY',...segments[2],downgraded:false,downgradeReason:'NONE'};state.spinHistory=[{...result,awardedAt:iso}];return result;
  }
  if(pathname==='/api/points/state') {
    const data=base();
    if(empty) return data;
    const unlocked=state.taskState==='claimed'||state.taskState==='complete';
    // Like the design boards: a 12-day streak (13 once checked in today), one saver in hand.
    const dayOf=t=>new Date(t).toISOString().slice(0,10);
    if(state.streakState==='normal')data.streak={...data.streak,currentStreak:state.checkedIn?13:12,longestStreak:state.checkedIn?13:12,streakSavers:1,lastCheckInDate:dayOf(state.checkedIn?now:now-day),checkedInToday:!!state.checkedIn};
    if(state.streakState==='first')data.streak={...data.streak,currentStreak:state.checkedIn?1:0,longestStreak:state.checkedIn?1:0,streakSavers:0,lastCheckInDate:state.checkedIn?dayOf(now):null,checkedInToday:!!state.checkedIn};
    if(state.streakState==='broken'&&!state.saverUsed)data.streak={...data.streak,currentStreak:state.checkedIn?1:0,longestStreak:7,streakSavers:state.checkedIn?0:1,lastCheckInDate:new Date(state.checkedIn?now:now-3*day).toISOString().slice(0,10),checkedInToday:!!state.checkedIn};
    if(state.saverUsed)data.streak={...data.streak,currentStreak:state.checkedIn?8:7,longestStreak:state.checkedIn?8:7,streakSavers:0,lastCheckInDate:new Date(state.checkedIn?now:now-day).toISOString().slice(0,10),checkedInToday:!!state.checkedIn};
    // Mirrors the backend seeds (nx_growth_checkin_rule / nx_streak_milestone / nx_streak_power_up); day 3 is already claimed in the 12-day scenario.
    data.rules=[['baseline','1'],['bonus7','5'],['luckyMultiplierMax','2'],['p15','15'],['p2','5'],['broken','48'],['revive','1']].map(([key,value])=>({key,value}));
    data.dailyMilestones=demoStreakMilestones.map(([milestoneDay,rewardType,rewardAmount,badgeCode],i)=>({milestoneId:i+1,milestoneDay,rewardType,rewardAmount,badgeCode,status:state.milestoneClaims?.includes(i+1)||state.streakState==='normal'&&milestoneDay===3?'CLAIMED':data.streak.currentStreak>=milestoneDay?'CLAIMABLE':'LOCKED'}));
    data.earningMilestones=[10,100,1000].map((amount,i)=>({milestoneId:'demo-earning-'+i,thresholdUsdt:amount,rewardNex:amount,lifetimeEarningsUsdt:128.5,status:i===0||i===1&&state.earningClaimed?'FIRED':i===1?'CLAIMABLE':'LOCKED',achievedAt:i===0||i===1&&state.earningClaimed?iso:null}));
    const names=locale==='zh'?['首次签到','连续签到一周','第一台设备','学习达人','邀请伙伴','算力新星']:locale==='vi'?['Điểm danh đầu tiên','Chuỗi một tuần','Thiết bị đầu tiên','Người học giỏi','Mời bạn bè','Ngôi sao tính toán']:['First check-in','One-week streak','First device','Dedicated learner','Invite a partner','Compute rising star'];
    data.badgeAchievements=names.map((name,i)=>({achievementCode:'demo-achievement-'+i,name,description:name,category:['STREAK','STREAK','EARNING','LEARNING','SOCIAL','EARNING'][i],iconKey:['flame','calendar','cpu','book','users','zap'][i],accentColor:['#9EDC1D','#B47FFF','#FFCB4D'][i%3],rewardPoints:50*(i+1),status:i<2||unlocked?'UNLOCKED':'LOCKED',unlockedAt:i<2||unlocked?iso:null}));
    // Route badges keep the seeded Chinese name (the App localizes them); the check-in boost is the B17 multiplier.
    data.powerUps=[[1,'ROYALTY_BOOST','团队成长徽章','/team',7,'ROUTE_BADGE','连续签到 7 天可查看团队成长权益',null],[2,'STREAK_BADGE','连续签到徽章','/me/rewards',14,'ROUTE_BADGE','连续签到 14 天解锁专属徽章',null],[3,'CHECKIN_BOOST',localized(locale,'签到加成','Check-in boost','Thưởng điểm danh'),'/daily',30,'CHECKIN_MULTIPLIER','1.5',null],[4,'GENESIS_ALLOWLIST','Genesis 资格入口','/market/genesis',60,'ROUTE_BADGE','连续签到 60 天解锁 Genesis 资格入口',true],
      ...(state.powerUpState==='staking'?[[5,'STAKING_APY','质押活动入口','/wallet/staking',21,'ROUTE_BADGE','连续签到 21 天解锁质押活动入口',true]]:[])]
      .map(([powerUpId,powerUpCode,name,targetPath,unlockStreakDays,effectType,effectValue,businessAvailable])=>({powerUpId,powerUpCode,name,unlockStreakDays,targetPath,effectType,effectValue,status:state.powerUps?.includes(powerUpId)?'ACTIVATED':data.streak.currentStreak>=unlockStreakDays?'AVAILABLE':'LOCKED',businessAvailable}));
    data.topStreakers=[{name:'Daniel_K',countryCode:'US',streak:412},{name:'Mei_C',countryCode:'SG',streak:387},{name:'Lukas_F',countryCode:'DE',streak:341},{name:'Carlos_M',countryCode:'BR',streak:298},{name:'Priya_S',countryCode:'IN',streak:256}];
    return data;
  }
  const milestoneClaim=pathname.match(/^\/api\/points\/milestones\/(\d+)\/claim$/);
  if(milestoneClaim){const id=Number(milestoneClaim[1]),[milestoneDay,rewardType,rewardAmount,badgeCode]=demoStreakMilestones[id-1];state.milestoneClaims||=[];state.milestoneClaims.push(id);return {...authority,milestoneId:id,milestoneDay,rewardType,rewardAmount,badgeCode,spinTickets:rewardType==='SPIN'?rewardAmount:0};}
  const powerUpActivate=pathname.match(/^\/api\/points\/power-ups\/([1-4])\/activate$/);
  if(powerUpActivate){const id=Number(powerUpActivate[1]);state.powerUps||=[];state.powerUps.push(id);return {...authority,powerUpId:id,powerUpCode:['ROYALTY_BOOST','STREAK_BADGE','CHECKIN_BOOST','GENESIS_ALLOWLIST'][id-1],badgeCode:null,status:'ACTIVATED'};}
  if(pathname==='/api/points/sign-in'&&(state.saverUsed||state.streakState!=='normal')){state.checkedIn=true;return {...authority,checkInDate:iso.slice(0,10),baseNex:1,rewardNex:1,streakBonusNex:0,multiplier:1,streakDays:state.saverUsed?8:1};}
  if(pathname==='/api/points/sign-in'){state.checkedIn=true;return {...authority,checkInDate:iso.slice(0,10),baseNex:1,rewardNex:1,streakBonusNex:0,multiplier:1,streakDays:13};}
  if(pathname==='/api/points/streak-saver/use'){if(state.streakState!=='broken'||state.saverUsed||state.checkedIn)throw new Error('No interrupted streak to restore');state.saverUsed=true;return {...authority,restoredStreak:7,streakSavers:0,effectiveLastCheckInDate:new Date(now-day).toISOString().slice(0,10)};}
  if(pathname==='/api/earnings/milestones/evaluate'){const fired=state.earningClaimed?[]:[{milestoneId:'demo-earning-1',thresholdUsd:100,rewardNex:100,lifetimeEarningsUsd:128.5}];state.earningClaimed=true;return {...authority,fired,count:fired.length};}
  if(pathname==='/api/app/security') return {twoFactorEnabled:true,passwordChangedAt:iso,sessions:[{id:'demo-session',deviceName:'iPhone · Safari',ipMasked:'192.0.2.*',lastActiveAt:iso,current:true}],nextCursor:null};
  if(pathname==='/api/app/referral-rewards') return {referralCode:'UVELDEMO',rewardEnabled:true,inviterRewardNex:10,invitedCount:12,pendingCount:2,settledCount:10,lifetimeInviterNex:100,walletNexAvailable:1280,limit:10,source:'ledger',sourceEnvironment:'PRODUCTION',runId:null,factSources:['nx_referral_reward_settlement','nx_wallet_ledger','nx_earnings_release_entry','nx_user_wallet'],refreshedAt:iso,recentRewards:empty?[]:[{settlementNo:'DEMO-REF-1',amountNex:10,ledgerStatus:'SUCCESS',balanceAfter:1280,releaseBucket:'withdrawable',sourceEnvironment:'PRODUCTION',settledAt:iso}]};
  if(pathname==='/api/app/team/network') {
    const members=empty?[]:['Maya','Linh','Sam','Rin','Jo','Noah','Mina','Leo'].map((name,i)=>({id:String(100+i),name,avatarUrl:null,vRank:i%4,layer:i<3?1:i<6?2:3,leg:i%2?'A':'B',joinedAt:new Date(now-(40-i)*day).toISOString(),monthComputePoints:[160,240,320,360,440,480,560,640][i],lifetimeComputePoints:[640,960,1280,1440,1760,1920,2240,2560][i],status:i===6?'OFFLINE':i===7?'IDLE':'ACTIVE',region:['SG','VN','JP'][i%3]}));
    return {...authority,source:'server',generatedAt:iso,totalMembers:members.length,directMembers:empty?0:3,activeMembers:empty?0:6,monthComputePoints:members.reduce((sum,m)=>sum+m.monthComputePoints,0),lifetimeComputePoints:members.reduce((sum,m)=>sum+m.lifetimeComputePoints,0),members,nextCursor:null};
  }
  if(pathname==='/api/devices/earnings') {
    const facts=demoFleetFacts(url,locale,state);
    const data=base();data.walletUsdt=state.walletBalance??52800.64;data.walletNex=empty?0:1280;data.dailyUsdt=empty?0:28.6;data.dailyNex=empty?0:15;
    Object.assign(data,facts);
    return data;
  }
  if(pathname==='/api/app/wallet/bills'||pathname==='/api/app/wallet/bills/summary') {
    const bills=empty?[]:[['COMPUTE_EARNING','UVT','IN',15,'earn'],['REFERRAL_REWARD','UVT','IN',10,'refer'],['DEVICE_PURCHASE','USDT','OUT',1299,'purchase'],['CHECK_IN','UVT','IN',5,'bonus'],['COMPUTE_EARNING','USDT','IN',128.5,'earn'],['COMPUTE_EARNING','USDT','IN',0.00032,'earn']].map(([bizType,asset,direction,amount,category],i)=>({id:'demo-bill-'+i,bizNo:'DEMO-'+(1000+i),bizType,asset,direction,amount,balanceAfter:asset==='UVT'?1280:5280.64,status:'SUCCESS',remark:'',createdAt:new Date(now-i*day).toISOString(),category}));
    if(pathname.endsWith('/summary')) return {source:'server',sourceEnvironment:'PRODUCTION',timeZone:'UTC',asOf:iso,rewardsUsdt:empty?0:128.5,rewardsNex:empty?0:150,settledRewardsNex:empty?0:140,withdrawalOffsetNexSpent:empty?0:10,latestRewardAt:empty?null:iso,todayNexEarn:empty?0:15,pendingNex:empty?0:10,monthBillCount:bills.length,recentNexBills:bills.filter(b=>b.asset==='UVT')};
    const filtered=bills.filter(bill=>['asset','direction'].every(key=>!url.searchParams.get(key)||url.searchParams.get(key)===bill[key])&&(url.searchParams.get('category')!=='REWARD'||bill.direction==='IN'));
    return {source:'server',sourceEnvironment:'PRODUCTION',bills:filtered,page:1,pageSize:20,total:filtered.length,nextPage:null,nextCursor:null};
  }
  if(pathname==='/api/vouchers') {
    const data=structuredClone(reviewFixture(url,locale,{...state,offers:!empty&&!state.voucherUsed&&state.benefitState!=='finished'},request));
    data.vouchers=data.vouchers.map(v=>({...v,voucherName:localized(locale,'设备代金券','Device voucher','Phiếu giảm giá thiết bị')}));
    if(['claimed','grace'].includes(state.benefitState)||state.voucherClaimed) data.vouchers=data.vouchers.map(v=>({...v,grantId:'DEMO-GRANT',grantStatus:'AVAILABLE',claimable:false,claimedAt:now-day}));
    return data;
  }
  if(pathname==='/api/vouchers/V-DESIGN/claim'){state.voucherClaimed=true;return {...authority,voucherId:'V-DESIGN',grantId:'DEMO-GRANT',status:'AVAILABLE',replay:false,source:'nx_growth_voucher_grant'};}
  if(pathname==='/api/notifications') {
    if(empty) return {items:[],nextCursor:null,unread:0,actionableUnread:0};
    const device=demoFixture(new URL('/api/devices/earnings',url.origin),locale,state,request).devices[0];
    const orders=demoAccountOrders(url,locale,state,now),order=orders.find(item=>item.orderNo==='DEMO-ORDER-002')??orders.find(item=>item.paymentStatus==='PAID');
    const visibleItems=demoNotifications(locale,state,now,device,order);
    return {items:visibleItems,nextCursor:null,unread:visibleItems.filter(item=>item.readAt===null).length,actionableUnread:visibleItems.filter(item=>item.readAt===null&&item.kind!=='marketing').length};
  }
  if(/^\/api\/notifications\/\d+\/read$/.test(pathname)){state.readIds||=[];state.readIds.push(Number(pathname.split('/')[3]));return null;}
  if(pathname==='/api/notifications/read-all'){const count=demoFixture(new URL('/api/notifications',url.origin),locale,state,request).unread;state.read=true;return count;}
  if(pathname==='/api/notifications/read'){const items=demoFixture(new URL('/api/notifications',url.origin),locale,state,request).items.filter(item=>item.readAt!==null);state.clearedNotificationIds=[...(state.clearedNotificationIds||[]),...items.map(item=>item.id)];return items.length;}
  if(/^\/api\/notifications\/\d+\/actions$/.test(pathname)){
    const id=Number(pathname.split('/')[3]);
    const item=demoFixture(new URL('/api/notifications',url.origin),locale,state,request).items.find(row=>row.id===id);
    if(!item?.ctaHref)throw new Error('DEMO_NOTIFICATION_ACTION_UNAVAILABLE');
    return {notificationId:id,action:request.postDataJSON()?.action||'cta',route:item.ctaHref,recorded:true};
  }
  return base(pathname+url.search);
}
