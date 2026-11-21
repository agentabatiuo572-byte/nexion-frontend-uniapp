// Local presentation data. This module is never imported into src or an App build.
// Monetary amounts, hardware specifications and identities below are illustrative.
import { createHash } from 'node:crypto';
import { derivedRegisteredUsers } from '../../src/lib/platform-stats.ts';
import { fixture as reviewFixture, previewCapacity, previewDefaultTrialName, previewDefaultTrialSku, previewDoTheMath, previewInterfaceLanguages, previewActiveJobsBase, previewHomeDisplay, previewHomeDisplaySample } from './design-review-fixture.mjs';
import { secondaryDemo } from './prototype-demo-secondary.mjs';
import { withDemoShareChannels } from './prototype-demo-share.mjs';
import { demoLongLearningBill, learningDemo } from './prototype-demo-learning.mjs';
import { financeDemo } from './prototype-demo-finance.mjs';
import { withdrawRecoveryOptions } from './prototype-demo-withdraw-recovery.mjs';
import { demoV1SelfComputePoints, rankPolicyDemo } from './prototype-demo-rank-policy.mjs';
import { teamGuidesDemo } from './prototype-demo-team-guides.mjs';
import { auxiliaryDemo } from './prototype-demo-auxiliary.mjs';
import { ambassadorDemo } from './prototype-demo-ambassador.mjs';
import { supportDemo } from './prototype-demo-support.mjs';
import { stakingDemo } from './prototype-demo-staking.mjs';
import { demoNotifications } from './prototype-demo-notifications.mjs';
import { accountDemo, accountDeletionWallet } from './prototype-demo-account.mjs';
import { savedAttemptOptions } from './prototype-demo-auth.mjs';
import { bankDemo } from './prototype-demo-bank.mjs';
import { contentOptions, demoHasLongBillRefs } from './prototype-demo-long-content.mjs';
import { riskDemo } from './prototype-demo-risk.mjs';
import { trialDemo } from './prototype-demo-trial.mjs';
import { demoBinaryLegMembers, demoH4Account, demoH4CheckInBonus, demoH4EventResponse, demoH4Gift, demoH4GiftQuantity, demoH4PromotionWindow, demoH4Savers, demoH4TeamMembers, demoTeamBusinessDate, demoTeamNetworkMembers, wheelVoucherId } from './prototype-demo-events.mjs';
import { demoCommissionGroups, demoStreakMilestones, demoReferralLedger, demoHasOpeningMilestone, demoSettledTasks, demoStreakFacts, demoTaskPeriods, demoWalletBills, demoWalletBillList, demoWalletBillSummary, demoWalletNex, demoWalletUsdt, initializeDemoWalletCheckpoint, postDemoActivityRewards, postDemoWalletEntries } from './prototype-demo-wallet.mjs';

const authority = {sourceEnvironment:'PRODUCTION',runId:'',serverCanonical:true};
const day = 86400000;
const demoStartedAt = Date.now();
const localized = (locale,zh,en,vi) => locale === 'zh' ? zh : locale === 'vi' ? vi : en;
const refuse=message=>{const error=new Error(message);error.status=409;throw error;};
function demoVoucherGrant(state,voucherId,now){
  if(state.dataState==='empty')return null;
  if(voucherId==='V-DESIGN'){
    if(state.voucherUsed||!(state.voucherClaimed||['claimed','grace'].includes(state.benefitState)))return null;
    return {grantId:'DEMO-GRANT',claimedAt:now-day,grantStatus:'AVAILABLE',amountUsd:50,minPurchaseUsd:0,maxDiscountUsd:50};
  }
  if(voucherId!==wheelVoucherId)return null;
  const wins=(state.h4Events?.spins??[]).filter(({result})=>result.rewardType==='COUPON');
  const grants=wins.map(({result,at})=>{
    const usedOrder=state.createdOrders?.find(order=>order.voucherRedemption?.grantId===result.spinId);
    return {grantId:result.spinId,claimedAt:at,grantStatus:usedOrder?'USED':'AVAILABLE',usedOrderNo:usedOrder?.orderNo??null,
      amountUsd:result.rewardAmount,minPurchaseUsd:50,maxDiscountUsd:50};
  });
  return grants.find(grant=>grant.grantStatus==='AVAILABLE')??grants[0]??null;
}

function demoVoucherRedemption(state,voucherId,lines,subtotal,now){
  if(!voucherId)return null;
  if(lines.length!==1)refuse('BUNDLE_VOUCHER_UNSUPPORTED');
  const grant=demoVoucherGrant(state,voucherId,now);
  if(grant?.grantStatus!=='AVAILABLE'||subtotal<grant.minPurchaseUsd)refuse('VOUCHER_NOT_AVAILABLE_OR_NOT_APPLICABLE');
  return {voucherId,grantId:grant.grantId,status:'REDEEMED',discountUsdt:Math.min(subtotal,grant.amountUsd,grant.maxDiscountUsd)};
}
const bundleRate=count=>count>=4?.11:count===3?.07:count===2?.04:0;
const demoMilestoneClaimed=(state,id)=>id===1&&demoHasOpeningMilestone(state)||state.milestoneClaims?.includes(id)
  ||state.milestoneClaimReceipts?.some(({result})=>result?.milestoneId===id)
  ||state.walletMovements?.some(row=>row.bizType==='DAILY_MILESTONE'&&row.bizNo===`DAILY-MS:900001:${id}`);
// Reconciliation can leave an unissued reward in manual review after a refund hold has been released.
export const demoDefaults = {contentState:'normal',interfaceLanguagesState:'all',accountDeletionState:'follow',checkoutState:'ordinary',trialQuoteState:'default',powerUpState:'default',paymentState:'delivered',topupState:'form',withdrawNetworksState:'bep20-erc20',withdrawRecoveryState:'off',trialState:'follow',realtimeState:'online',messageSendState:'normal',messageState:'normal',supportReadbackState:'missing',machineImageState:'normal',catalogState:'available',quotaState:'unconfigured',taskState:'pending',eventState:'mixed',wheelState:'closed',raffleState:'normal',pairingState:'pending',benefitState:'available',dataState:'normal',trustSectionsState:'all',stakingState:'delisted',bankState:'pending',billRefsState:'normal',riskState:'accepted',streakState:'normal',ambassadorState:'none',ambassadorIoState:'normal',ambassadorRank:'follow',promotionEligibility:'eligible',repurchaseState:'follow',promotionTiming:'live',promotionRewardType:'reward',promotionRewardState:'CANCELLED',sessionState:'signed-in',savedAttemptState:'none',jobsBaseState:'published',homeDisplayState:'paused',globeShareState:'nodes',highestRank:false,checkedIn:false,offers:true,messages:true,promotions:true,completed:[],read:false,deviceTaskSampleState:'default'};
export const demoOptions = {
  savedAttemptState: savedAttemptOptions,
  accountDeletionState:[['follow','跟随原场景'],['usdt','注销·USDT 余额'],['nex','注销·UVT 余额'],['locked','注销·锁定金额'],['withdrawal','注销·提现处理中'],['clear','注销·零余额无历史'],['history','注销·有历史（CONFIRMED 提现／CREDITED 充值，完成注销目前被 BUG-409 拦下）'],['blocked-funds','注销受阻·资金或订单未结清'],['blocked-unavailable','注销受阻·当时无法核实财务状态'],['blocked-unknown','注销受阻·未知原因'],['blocked-operator','注销受阻·运营拒绝'],['read-error','注销·余额读取失败'],['withdrawal-error','注销·提现读取失败']],
  checkoutState:[['ordinary','普通结算'],['replace','容量已满·需选择替换']],
  powerUpState:[['default','默认连签增益'],['staking','含质押活动入口（/wallet/staking）']],
  trialQuoteState:[['default','默认报价'],['historical-cap','旧领取单 · 上限 50（配合试用中/宽限期）'],['excess-offset','价款封顶抵扣·无需支付（配合到期·抵扣有效）'],['precision','六位小数报价'],['half-cent','半分报价 · 确认金额保留两位'],['precision-repriced','六位报价变更 · 确认金额仍 342.12']],
  trialState:[['follow','跟随福利场景'],['available','试用未领取'],['active','试用中'],['final-day','试用最后12小时'],['grace','试用到期·抵扣有效'],['ended','试用及抵扣已结束'],['eligible-again','冷却结束·可重新领取'],['converted','已转购'],['refunded','已转购·已退款'],['claim-error','首次激活失败·可重试'],['read-error','试用读取失败'],['capacity-full','队列已满']],
  realtimeState:[['online','客服在线'],['offline','客服离线'],['reconnecting','正在恢复连接']],
  messageSendState:[['normal','正常确认'],['delayed','发送延迟（约 2 秒）'],['failed','确认失败（未发送）'],['unknown','结果待确认（重试原消息）'],['timeout','确认超时（15 秒转待确认）']],
  messageState:[['normal','普通会话 · 1条未读'],['receipts','双向回执样例'],['history','三页历史与图文消息'],['timeline','时间分组 · 24小时间隔'],['incoming','追加客服消息（原页刷新）'],['long-count','长未读计数 · 1298'],['author-photo','客服带本人头像'],['recommendations','商品与链接推荐'],['agent-switch','客服已切换提示（有名字/无名字）'],['welcome-unassigned','刚注册 · 未分配客服 · 欢迎语未读'],['welcome-assigned','刚注册 · 已有专属客服 · 欢迎语未读'],['read','会话全部已读'],['transferred','已转接 · 只读旧会话待核对']],
  supportReadbackState:[['missing','查无原命令（404）'],['sent','原命令已发出'],['cleared','原命令已发出 · 历史已清空'],['rejected','明确没发出（REJECTED）']],
  machineImageState:[['normal','原活动机型'],['banner','后台自定义活动海报'],['missing-main','主购缺图（赠品保持原位）'],['missing','目录未发布图片'],['broken','图片加载失败']],
  quotaState:[['unconfigured','无启用档'],['pending','待审'],['approved','已批准'],['catalog-error','档位商品不可用']],
  catalogState:[['phased','完整目录（含即将上线）'],['available','全部 SKU 可购'],['soldout','S1 售罄'],['restricted','购买条件未满足'],['trial-h2-switched','试用机型已从 S1 切换到 Pro']],
  taskState:[['pending','任务进行中'],['complete','全部完成·待领取'],['claimed','奖励已领取'],['expired','任务已过期'],['empty','暂无任务'],['legacy','任务信息待补全']],
  wheelState:[['closed','未开放'],['open','开放八档奖池']],
  eventState:[['mixed','全部活动状态'],['available','可参与'],['joined','已参与'],['claimable','奖励待领取'],['claimed','奖励已领取'],['upcoming','即将开始'],['ended','已结束'],['empty','暂无活动']],
  raffleState:[['normal','正常开奖'],['small-usdt','微额 USDT 奖励'],['upcoming','1 分钟后开始'],['ending','1 分钟后截止'],['ended','已截止待开奖']],
  pairingState:[['pending','等待连接'],['connected','配对完成'],['expired','配对已过期']],
  benefitState:[['available','福利待领取'],['claimed','券已领取·试用中'],['grace','试用待抵扣'],['finished','福利已使用']],
  dataState:[['normal','正常数据'],['empty','空数据'],['loading','慢速加载（5 秒）'],['error','加载失败']],
  trustSectionsState:[['all','信任资料 · 六个版块'],['missing-narrative','信任资料 · 缺 UVT 说明'],['missing-audits','信任资料 · 缺审计'],['leadership','信任资料 · 仅管理团队'],['none','信任资料 · 无版块']],
  stakingState:[['delisted','功能下架'],['error','质押读取失败（其他正常）']],
  stakingOpenState:[['unmodeled','开仓未配置（演示拒绝）'],['disclosure','开仓拒绝·需风险确认（HTTP 200 / code 409）']],
  topupState:[['form','银行卡充值 · 填写金额'],['paying','银行卡充值 · 付款中'],['credited','银行卡充值 · 已到账']],
  withdrawRecoveryState:withdrawRecoveryOptions,
  withdrawNetworksState:[['bep20-erc20','提现网络 · BEP20 和 ERC20'],['bep20','提现网络 · 仅 BEP20'],['erc20','提现网络 · 仅 ERC20'],['closed','提现网络 · 全部关闭']],
  billRefsState:[['normal','账单 · 默认'],['long-refs','账单 · 真实长单号（订单、退款、学习奖励）']],
  contentState:contentOptions,
  bankState:[['pending','银行提现 · 处理中'],['review','银行提现 · 等待处理'],['held','银行提现 · 核对中'],['settled','银行提现 · 已到账'],['rejected','银行提现 · 已退回']],
  riskState:[['accepted','风险说明 · 已确认'],['unread','风险说明 · 首次阅读']],
  streakState:[['normal','连续签到'],['first','首次签到·连续 0 天'],['broken','断签·可使用复活卡']],
  ambassadorState:[['none','尚未申请'],['draft','进行中 · 待提交材料（M0）'],['review','核验中 · 业务通过、费用待核（M3）'],['partial','核验中 · 已交但缺两项（M1）'],['more-finance','需补材料 · 费用退回、可下调（M6）'],['more-business','需补材料 · 业务退回（M5）'],['passed','两项通过 · 待批准（M7）'],['passed-short','两项通过 · 认可金额不足（M8）'],['passed-precise','两项通过 · 认可金额 2999.999999'],['future','两项通过 · 活动未到（M9）'],['bucket','历史待审缺类别（M10）'],['approved','最近一份已通过（M13）'],['rejected','最近一份未通过（M13）']],
  ambassadorIoState:[['normal','材料读写正常'],['upload-slow','上传慢（每次 4 秒）'],['upload-fail-once','下一次上传失败一次'],['save-reject-once','下一次提交被拒绝一次（422）'],['save-unknown-once','下一次提交结果未知一次（503）'],['save-lands-unknown-once','下一次提交已生效但回复丢失（503）'],['close-on-submit-once','下一次提交时申请已终结（409）'],['late-read-once','下一次材料读取迟到 4 秒（返回旧数据）'],['rereview-finance-once','下一次读取：同版本费用重新通过'],['history-fail-once','下一次申请记录读取失败一次']],
  ambassadorRank:[['follow','跟随“最高等级 V8”开关'],['v5','V5（刚满足资格）']],
  repurchaseState:['follow','inside','boundary','outside'].map(value=>[value,value]),
  promotionEligibility:[['eligible','符合条件'],['sign-in','登录后确认资格'],['ineligible','不符合条件'],['unknown','资格待确认']],
  sessionState:[['signed-in','已登录'],['signed-out','未登录（刷新会话被拒）']],
  promotionTiming:[['live','跟随活动场景'],['starting','切换后 1 分钟开始'],['ending','切换后 1 分钟结束']],
  promotionRewardType:[['reward','首购 / 复购发 UVT'],['discount','首购 / 复购为订单立减'],['gift-discount','购机赠礼为订单立减']],
  promotionRewardState:[['PENDING','待处理'],['READY','待发放'],['ISSUED','已发放'],
    ['RETRYABLE_FAILED','可重试失败'],['CANCELLED','已取消'],['MANUAL_REVIEW','人工审核中']],
  jobsBaseState:[['unpublished','全球作业基数 · 未发布'],['published','全球作业基数 · 已发布 560']],
  homeDisplayState:[['paused','暂停'],['growth','增长']],
  globeShareState:[['nodes','旧格式 · 按节点数分配'],['share','新格式 · 只下发 sharePct'],['invalid','新格式 · 占比合计 90（无效）'],['missing','未下发全球网络展示配置']],
  fleetState:[['normal','默认设备'],['none','暂无设备'],['inventory','含仓库未激活设备'],['decayed','S1 产能递减 · 含未激活 S1 / Share'],['full','槽位已满 6/6'],['reserved','含机位分配中槽位']],
  paymentState:[['delivered','正常到账（15 秒到账，25 秒开通）'],['waiting','一直等待到账'],['read-error','原付款读取失败（503，保留原单）'],['intent-missing','确证没有原付款单（404，结束查询）'],['remote-in-progress','别处发起的进行中付款（本机无记录）'],['urgent','剩余不足 5 分钟'],['expired','超时未到账·订单取消'],['late','宽限结束后到账·订单已取消（示例 001 剩 1 分钟）'],['bank-failed','银行卡付款失败'],['mismatch','金额不符·人工核对'],['delivery-failed','已到账·开通失败'],['bank-off','银行卡未配置'],['erc20-off','后台关闭 ERC20'],['usdt-off','后台关闭 USDT 两个网络'],['low-balance','钱包余额不足（820.64 USDT）'],['reward-clawback-debt','奖励扣回·USDT 欠款（−12.123456）']],
  deviceTaskSampleState:[['default','默认作业样例'],['long','长作业名 · 最近完成 10 条（模拟作业）']],
  interfaceLanguagesState:[['all','9 种全开'],['default','后端默认八种（不含中文）'],['en-only','只开英文']],
};
const skuDefinitions = [
  // Per-unit monthly USDT estimates; daily values are projections of these amounts.
  [previewDefaultTrialSku,previewDefaultTrialName,'Entry',1299,186,3,'4 × RTX 4090','96 GB',1200],
  ['stellarbox-pro','UVELBox Pro','Pro',4999,672,12,'8 × RTX 4090','192 GB',2400],
  ['stellarbox-pro-v2','UVELBox Pro v2','Pro',5999,858,18,'8 × RTX 5090','256 GB',2200],
  ['stellarrack-p1','UVELRack P1','Flagship',12999,1350,30,'8 × A100','640 GB',3200],
  ['stellarrack-p2','UVELRack P2','Flagship',19999,2250,50,'8 × H100','1,024 GB',4000],
  ['cloud-share','Cloud Share','Share',19.9,18,3,'Distributed','—',0],
];
const demoPromotionGift={orderNo:'DEMO-ORDER-004',activityId:'demo-promo-0',obligationId:'demo-reward-3',productNo:'stellarbox-s1',quantity:1};
// The paid order keeps the gift terms of its published version even after the live offer changes.
function promotionDeviceReward(giftName) {
  return {rewardRuleId:'review-gift',beneficiaryRole:'BUYER',type:'DEVICE',giftProductNo:demoPromotionGift.productNo,
    quantity:demoPromotionGift.quantity,disclosure:{
      title:{zh:'设备赠礼',en:'Device gift',vi:'Quà thiết bị'},deviceName:giftName,
      benefitDescription:{zh:'送 '+giftName+' 1 份',en:'Get 1 '+giftName,vi:'Tặng 1 '+giftName},
      terms:{zh:'订单付款完成后，赠品发放到你的设备仓库。',en:'Once the order is paid, the gift is added to your device inventory.',vi:'Sau khi đơn hàng được thanh toán, quà tặng sẽ vào kho thiết bị của bạn.'},
      refundTerms:{zh:'整单退款时，赠品随订单一并撤销。',en:'If the whole order is refunded, the gift is withdrawn with it.',vi:'Khi hoàn tiền toàn bộ đơn hàng, quà tặng sẽ bị thu hồi cùng đơn.'},
      deviceRights:{activationMode:'AUTO',effectiveOn:'ISSUED',durationDays:null,taskEnabled:true,countsAsDeviceHolding:true,
        countsForRank:false,transferable:false,exchangeable:false,revocationMode:'MANUAL_IF_USED'}}};
}
export function demoProducts(state,origin='http://127.0.0.1:5190') {
  return skuDefinitions.map(([id,name,tier,listPrice,monthlyEstimateUsdt,dailyEarnNEX,gpu,vram,watts],index)=>{
    const price=index!==0?listPrice:({ 'half-cent':402.135, precision:402.123456,
      'precision-repriced':402.123456, 'excess-offset':15, capped:1000, repriced:1000 })[state.trialQuoteState]??listPrice;
    const share=tier==='Share', upcoming=state.catalogState==='phased'&&[2,4].includes(index);
    const bought=(state.createdOrders??[]).filter(order=>(order.inventoryUsedAt??order.quotaUsedAt)!=null&&demoPaidPurchase(order))
      .flatMap(order=>order.lineItems).filter(line=>line.sku===id).reduce((sum,line)=>sum+line.quantity,0);
    const dailyEarn=monthlyEstimateUsdt/30,b=.1;
    const stock=share?null:state.catalogState==='soldout'&&index===0?0:
      Math.max(0,60-index*7-demoH4GiftQuantity(state,id)-bought);
    // AppProductCatalogService projects release and stock gates independently.
    // The phased preset models a valid E1 phase id that has not been reached.
    return {id,name:state.catalogState==='trial-h2-switched'&&id===previewDefaultTrialSku?'UVELBox S1 Classic':name,tier,price,dailyEarn,dailyEarnNEX,monthlyEstimateUsdt,computePoints:Math.round(price*10),gpu,
      vram:share?'not_applicable':vram.replace(/[ ,]/g,''),power:watts?watts+' W':'not_applicable',hashRate:null,
      tagline:share?'Cloud-hosted share':tier==='Flagship'?'Fully managed rack':'Fully managed device',badge:index===0?'Recommended':index===1?'Best seller':null,imageUrl:new URL('/static/img/products/uvel-pedestal/'+id+'.webp',origin).href,
      videoUrl:null,specDocumentTitle:null,specDocumentUrl:null,phoneDailyEarn:'unavailable',phoneDailyEarnNEX:'unavailable',
      productType:share?'SHARE':'DEVICE',inventoryMode:share?'UNLIMITED':'FINITE',stock,sold:42+index*13+bought,
      features:[],taskLevels:[],ai:null,datacenter:'',uptime:'99.9%',warranty:share?'unavailable':'36 months',status:'active',available:!upcoming,
      releaseState:upcoming?'E1_PHASE_NOT_REACHED':'AVAILABLE',releasePhaseId:upcoming?'2':null,unlocksAtPhase:null,purchaseGate:null,
      purchaseBlocked:stock===0,purchaseBlockedReason:stock===0?'PRODUCT_OUT_OF_STOCK':null,
      dailyEstimateLowUsdt:share?monthlyEstimateUsdt*(1-b)/30:null,dailyEstimateHighUsdt:share?monthlyEstimateUsdt*(1+b)/30:null,
      shareYieldMin:share?Number((monthlyEstimateUsdt*(1-b)*365/30/price*100).toFixed(4)):null,shareYieldMax:share?Number((monthlyEstimateUsdt*(1+b)*365/30/price*100).toFixed(4)):null,
    };
  }).map(product=>({...product,imageUrl:state.machineImageState==='missing'||(state.machineImageState==='missing-main'&&product.id==='stellarbox-s1')?null:state.machineImageState==='broken'?new URL('/static/demo-missing-'+product.id+'.webp',origin).href:product.imageUrl}));
}

function demoPaidPurchase(order) {
  return ['PAID','CONFIRMED','SUCCESS'].includes(order.paymentStatus)
    &&!['REFUNDED','CHARGEBACK'].includes(order.orderStatus);
}

const approvedQuotaSku='stellarbox-s1';

function demoHardwareQuota(product,state,points,now){
  const monthlyStock=60,month=demoTeamBusinessDate(now).slice(0,7);
  const sameMonth=at=>at<=now&&demoTeamBusinessDate(at).slice(0,7)===month;
  const sampleAt=state.previewFactsAt??demoStartedAt;
  const soldOut=state.catalogState==='soldout'&&product.id==='stellarbox-s1';
  const seeded=sameMonth(sampleAt)?(soldOut?monthlyStock:7):0;
  const used=(state.createdOrders??[]).filter(order=>demoPaidPurchase(order)
    &&order.hardwareQuotaUsedAt!=null&&sameMonth(order.hardwareQuotaUsedAt))
    .flatMap(order=>order.lineItems).filter(line=>line.sku===product.id).reduce((sum,line)=>sum+line.quantity,0);
  return {productId:product.id,quotaCode:product.id.toUpperCase(),name:product.name,price:product.price,
    monthlyStock,soldThisMonth:seeded+used,unlockKind:'ALL',
    // The legacy open preset keeps its original orders and uses a quota without a points requirement.
    conditions:state.walletLegacySeed&&state.catalogState==='available'?[]:
      [{kind:'teamComputePoints',required:state.catalogState==='restricted'?20000:6400,current:points}],
    perks:[],available:product.available};
}

function demoSkuPurchaseRules(state,product,points,now,quantity=1) {
  const e1={policy:'E1',eligible:product.available,decisionCode:product.available?'ELIGIBLE':'PRODUCT_NOT_RELEASED',mode:'ALL',conditions:[]};
  const f4b={policy:'F4B',eligible:true,decisionCode:'F4B_NOT_CONFIGURED',mode:'ALL',conditions:[]};
  if(state.quotaState==='approved'&&product.id===approvedQuotaSku){
    const quota=demoHardwareQuota(product,state,points,now);
    const [condition]=quota.conditions;
    const gap=condition?Math.max(0,condition.required-condition.current):0;
    const remaining=Math.max(0,quota.monthlyStock-quota.soldThisMonth);
    f4b.conditions=[...(condition?[{...condition,gap,met:gap===0}]:[]),
      {kind:'monthlyQuota',required:quota.monthlyStock,current:quota.soldThisMonth,gap:remaining,met:remaining>=quantity}];
    f4b.eligible=gap===0&&remaining>=quantity;
    f4b.decisionCode=remaining<quantity?'F4B_MONTHLY_QUOTA_EXHAUSTED':gap>0?'F4B_REQUIREMENTS_NOT_MET':'ELIGIBLE';
  }
  const stocked=product.stock==null||product.stock>=quantity;
  return {eligible:e1.eligible&&f4b.eligible&&stocked,
    decisionCode:!e1.eligible?e1.decisionCode:!f4b.eligible?f4b.decisionCode:!stocked?'PURCHASE_GATE_SOLD_OUT':'ELIGIBLE',
    policies:[e1,f4b]};
}

export function requireDemoPurchase(state,products,items,now,settlement=false) {
  const points=demoTeamNetworkMembers(state,now).reduce((sum,member)=>sum+member.monthComputePoints,0);
  const quantities=new Map();
  for(const item of items){
    if(!Number.isInteger(item.quantity)||item.quantity<1){
      throw Object.assign(new Error('ORDER_QUANTITY_INVALID'),{status:422});
    }
    quantities.set(item.productNo,(quantities.get(item.productNo)??0)+item.quantity);
  }
  let hardwareQuotaUsedAt=null;
  for(const [sku,quantity] of quantities){
    const product=products.find(item=>item.id===sku);
    if(!product||state.dataState==='empty')throw Object.assign(new Error('PRODUCT_NOT_AVAILABLE'),{status:404});
    const {eligible,decisionCode,policies}=demoSkuPurchaseRules(state,product,points,now,quantity);
    if(eligible){
      if(settlement&&policies[1].decisionCode==='ELIGIBLE')hardwareQuotaUsedAt=now;
      continue;
    }
    if(settlement&&policies[0].eligible){
      if(policies[1].conditions.some(row=>row.kind==='teamComputePoints'&&!row.met))refuse('ORDER_MONTHLY_QUOTA_REQUIREMENTS_NOT_MET');
      if(decisionCode==='F4B_MONTHLY_QUOTA_EXHAUSTED')refuse('ORDER_MONTHLY_QUOTA_EXHAUSTED');
    }
    refuse(decisionCode);
  }
  return hardwareQuotaUsedAt;
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
const repurchaseSampleDays={inside:12,boundary:30,outside:12};
const longBillOrderNo='ORD-7F3A9C2E5B8D41F6A0C3E9B27D5F1A84';
function demoOrders(products,state,now,device41) {
  if (state.accountDeletionState === 'clear') return [];
  const at=state.sampleOrdersAt??=now;
  return Object.entries(orderStates).map(([original],i)=>{
    const longRef=demoHasLongBillRefs(state)&&original==='refunded';
    const orderNo=longRef?longBillOrderNo:'DEMO-ORDER-'+String(i+1).padStart(3,'0');
    const canonicalStatus=state.orderStatuses?.[orderNo]||original;
    const [paymentStatus,orderStatus,activationStatus]=orderStates[canonicalStatus];
    const device=original==='activated'?device41:null;
    const product=device?products.find(item=>item.id===device.productCode.toLowerCase()):products[i%products.length];
    const unitPrice=device?device.actualPaidUsdt:product.price;
    // The ordinary V2 account bought its two paid S1 samples at 640 points each.
    // Rank counts both orders, including the paid order whose delivery failed.
    let computePoints=product.computePoints;
    if(!state.walletLegacySeed&&!state.highestRank&&product.id==='stellarbox-s1'
      &&(original==='activated'||original==='provisioning_failed'))computePoints=640;
    if(device&&state.highestRank)computePoints=64000;
    else if(device&&state.walletLegacySeed)computePoints=1280;
    const repurchaseDays=repurchaseSampleDays[state.repurchaseState];
    const placedAt=original==='provisioning_failed'&&repurchaseDays!==undefined
      ? at-repurchaseDays*day-samplePaidAfter
      : device?device.activatedAt-samplePaidAfter:original==='placed'?at-(samplePlacedAgo[state.paymentState]??0):at-(i+1)*day;
    return {orderNo,productId:products.indexOf(product)+1,productNo:product.id,productName:product.name,quantity:1,computePoints,subtotalUsdt:unitPrice,unitPriceUsdt:unitPrice,discountUsdt:0,amountUsdt:unitPrice,paymentMethod:'WALLET',paymentStatus,orderStatus,activationStatus,canonicalStatus,orderType:'SINGLE',placedAt,expiresAt:['placed','expired'].includes(canonicalStatus)?placedAt+paymentWindow:null,paidAt:['paid','provisioning','activated','provisioning_failed','refunded','chargeback'].includes(canonicalStatus)?placedAt+samplePaidAfter:null,activatedAt:canonicalStatus==='activated'?(device?.activatedAt??at-3600000):null,refundedAt:canonicalStatus==='refunded'?at-3600000:null,refundAmountUsdt:canonicalStatus==='refunded'?product.price:null,refundChannel:canonicalStatus==='refunded'?'WALLET':null,refundBillNo:canonicalStatus==='refunded'?(longRef?'E4-REFUND-'+orderNo:'DEMO-REFUND-1'):null,refundReasonCode:canonicalStatus==='refunded'?'DELIVERY_UNAVAILABLE':null,closeReasonCode:{cancelled:'USER_CANCELLED',expired:'PAYMENT_TIMEOUT',payment_failed:'PAYMENT_NOT_RECEIVED',provisioning_failed:'DELIVERY_UNAVAILABLE',chargeback:'PAYMENT_DISPUTED'}[canonicalStatus]??null,dataCenter:'Singapore',tradeinNo:null,sourceDeviceId:null,targetDeviceId:null,targetDeviceInstanceNo:device?.instanceNo??null,itemCount:1,
      lineItems:[{sku:product.id,name:product.name,quantity:1,unitPriceUsdt:unitPrice,lineAmountUsdt:unitPrice}]};
  }).filter(order=>!accountDeletionWallet(state)||(['COMPLETED','CANCELLED','CLOSED','FAILED','REFUNDED'].includes(order.orderStatus)&&['PAID','FAILED','CANCELLED','REFUNDED','EXPIRED'].includes(order.paymentStatus)));
}

function genesisPublic(now) {
  return {...authority,halted:false,revision:'demo-genesis-1',source:'nx_genesis_series + nx_config_item',
    series:{seriesCode:'genesis-main',name:'Genesis',totalSupply:1000,soldSupply:0,remainingSupply:1000,priceUsdt:9999,royaltyPct:2.5,dailyEmissionRatePct:0},
    sale:{serverCanonical:true,available:false,eligibilityEnabled:true,maxPerUser:2,minAccountAgeDays:0,presaleEnabled:false,showCountdown:false,unitPriceUsdt:9999,open:false,startAt:null,endAt:null},
    market:{enabled:false},emission:{open:false},listings:[],transactions:[],tiers:[{id:'t1',from:0,to:1000,priceUSDT:9999}],tiersVersion:1,marketOpenState:'closed',marketOpenStateVersion:1,showcaseEnabled:true,closedNoticeKey:'default',catalogAvailable:true,tradeAvailable:false,tradeBlockedReason:'SALE_POLICY_UNAVAILABLE',secondaryCommandProtocol:2,
    marketStats:{floorUsdt:null,volume24hUsdt:null,owners:null,floorDeltaPct:null,lastSaleUsdt:null}};
}

// One slot rule for every fixture read and command (PRD §5.6 / §9.11; backend fleet read and trade-in capacity
// quote): occupied = activated formal devices + order and promotion reservations + one effective trial
// (ACTIVE/GRACE) <= cap. demoFleetFacts computes it from the retained state; reads and commands all use it.
const demoTrialSlots=(url,locale,state)=>state.trialState!=='read-error'
  &&['ACTIVE','GRACE','EXTENDED'].includes(trialDemo(new URL('/api/trial/state',url.origin),locale,state,{method:()=>'GET'},false,state.dataState==='empty'?[]:demoProducts(state,url.origin)).state)?1:0;
// Session orders plus the state-sample rows that belong to the scenario. The paid (002) and provisioning (003)
// samples hold slots, so they appear only in fleetState=reserved, where they are its reservations. The activated
// sample (004) is the order of seeded device 41 and is listed only while the seed holds that device, on that device's
// timeline: paid and activated when the device was, placed 3 minutes before. A sample paid
// in this session is adopted into createdOrders by the checkout or payment fixture and listed once. The empty
// account (dataState=empty) has no sample rows, only what this session creates. An unpaid sample the deadline task has
// closed reads as expired, as that task (modelled for session orders by the checkout fixture) leaves it.
function demoScenarioOrders(products,state,now,device41) {
  const own=state.createdOrders||[],ids=new Set(own.map(order=>order.orderNo));
  return [...own,...demoOrders(products,state,now,device41).filter(order=>state.dataState!=='empty'&&!ids.has(order.orderNo)
    &&(state.fleetState==='reserved'||!['DEMO-ORDER-002','DEMO-ORDER-003'].includes(order.orderNo))
    &&(device41||order.orderNo!=='DEMO-ORDER-004'))
    .map(order=>demoOrderTimedOut(order,state,now)?{...order,...demoTimedOutOrder}:order)];
}
const demoOrderDeviceInstance=(orderNo,line=0,unit=0)=>`${orderNo}-${line}-${unit}`;
// The account's one order list, used by the order list, wallet pay, external payments and notifications.
export function demoAccountOrders(url,locale,state,now=Date.now()) {
  if(!state.fleetSeed)demoFleetFacts(url,locale,state);
  return demoScenarioOrders(demoProducts(state,url.origin),state,now,state.fleetSeed.find(device=>device.id===41))
    .map(order=>['activated','inventory'].includes(order.canonicalStatus)?{...order,
      targetDeviceId:['TRADE_IN','CAPACITY_KEEP'].includes(order.orderType)?order.targetDeviceId:null,
      targetDeviceInstanceNo:order.orderNo==='DEMO-ORDER-004'?order.targetDeviceInstanceNo:demoOrderDeviceInstance(order.orderNo),
    }:order);
}
// Like AppOrderCommandService, only paid orders awaiting their device hold slots; an unpaid ("placed") order owns none.
const demoOrderSlots=(orders,orderNo)=>orders
  .filter(order=>(orderNo===undefined||order.orderNo===orderNo)&&['paid','provisioning'].includes(order.canonicalStatus))
  .reduce((total,order)=>total+order.lineItems.reduce((count,line)=>count+line.quantity,0),0);
// Preview design rule. SCENARIO knobs (fleetState, checkoutState, trialState and
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
function decayedS1PurchasedAt() {
  const purchased=new Date(demoStartedAt);
  purchased.setHours(0,0,0,0);
  purchased.setDate(1);
  purchased.setMonth(purchased.getMonth()-3);
  return purchased.getTime();
}
export function initializeDemoPreviewAccount(state,now=Date.now()) {
  state.previewFactsAt??=now;
  initializeDemoWalletCheckpoint(state);
  // The activated sample order is placed three minutes before the seed device.
  const device41=state.fleetSeed?.find(device=>device.id===41);
  const earliestDeviceOrderAt=Math.min(decayedS1PurchasedAt(),device41?.activatedAt??Infinity)-samplePaidAfter;
  const orderDates=state.sampleOrdersAt==null?[]:demoOrders(demoProducts(state),{...state},now).map(order=>order.placedAt);
  demoH4Account(state,now,[earliestDeviceOrderAt,...orderDates]);
}

function demoSeedFleet(state,baseDevice,products,capacitySchedule,cap,occupied,retired) {
  const minimumPurchaseAt=demoH4Account(state).createdAt+samplePaidAfter+1;
  const purchasedAt=Math.max(baseDevice.purchasedAt,minimumPurchaseAt);
  const template={...baseDevice,purchasedAt,activatedAt:Math.max(baseDevice.activatedAt,purchasedAt)};
  const clone=(id,code,name,daily,paid,extra)=>({...template,id,instanceNo:'DEMO-'+id,name,productCode:code,dailyUsdt:daily,
    dailyNex:products.find(product=>product.id.toUpperCase()===code).dailyEarnNEX*previewCapacity({...template,productCode:code,...extra},capacitySchedule,Date.now()).capacityPct/100,
    actualPaidUsdt:paid,todayEarningsUsdt:0,todayEarningsNex:0,cumulativeOutputUsdt:0,...extra});
  const live=device=>!retired.includes(device.id);
  if(state.dataState==='empty')return [];
  let devices=state.fleetState==='none'?[]:[template,{...template,id:42,instanceNo:'DEMO-PRO',name:'UVELBox Pro',productCode:'STELLARBOX-PRO',dailyUsdt:22.4,dailyNex:12,todayEarningsUsdt:13.9,todayEarningsNex:2,actualPaidUsdt:4999}];
  if(state.fleetState==='inventory')devices.push(clone(43,'STELLARRACK-P1','UVELRack P1',45,12999,{status:'INACTIVE',activatedAt:null,runtimeStatus:'OFFLINE'}));
  if(state.fleetState==='decayed'){
    const decayedPurchaseAt=Math.max(decayedS1PurchasedAt(),minimumPurchaseAt);
    const older={purchasedAt:decayedPurchaseAt,activatedAt:decayedPurchaseAt};
    devices=[clone(41,'STELLARBOX-S1','UVELBox S1',6.2,1299,older),
      clone(43,'STELLARBOX-S1','UVELBox S1',6.2,1299,{...older,status:'INACTIVE',activatedAt:null,runtimeStatus:'OFFLINE'}),
      clone(51,'CLOUD-SHARE','Cloud Share',.6,19.9,{deviceType:'SHARE',capacityConfigKey:'capacityApplyToCloudShare',status:'INACTIVE',activatedAt:null,runtimeStatus:'OFFLINE',purchasedAt:Date.now()})];
  }
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
  const now=Date.now(),products=demoProducts(state,url.origin),orders=demoScenarioOrders(products,state,now,false);
  const seed=reviewFixture(new URL('/api/devices/earnings',url.origin),locale,state,{method:()=>'GET'});
  const template={...seed.devices[0],runtimeStatus:'ONLINE'};
  const slotCap=6,retired=state.retiredDeviceIds||[],session=[];
  // DEMO-ORDER-004 is seeded device 41's own order, also once checkout has adopted it: it never adds a device.
  for(const order of orders)if(order.orderNo!=='DEMO-ORDER-004'&&['activated','inventory'].includes(order.canonicalStatus))for(const [i,line]of order.lineItems.entries())for(let unit=0;unit<line.quantity;unit++){
    const product=products.find(p=>p.id===line.sku),instanceNo=demoOrderDeviceInstance(order.orderNo,i,unit);
    state.deviceIds??={};state.deviceIds[instanceNo]??=(state.deviceSequence=(state.deviceSequence||1000)+1);
    if(retired.includes(state.deviceIds[instanceNo]))continue;
    // A session device starts its own purchase history at its paid order.
    // Saved conversions made before the separate snapshot stored the claim name on the order.
    const name=order.trialSettlement?(order.trialClaimedDeviceName??order.productName):product.name;
    session.push({...template,id:state.deviceIds[instanceNo],instanceNo,name,productCode:product.id.toUpperCase(),dailyUsdt:product.dailyEarn,dailyNex:product.dailyEarnNEX,actualPaidUsdt:Number(order.amountUsdt)/order.quantity,
      activatedAt:order.activatedAt,purchasedAt:order.paidAt,todayEarningsUsdt:0,todayEarningsNex:0,cumulativeOutputUsdt:0,
      ...(order.canonicalStatus==='inventory'&&{status:'INACTIVE',activatedAt:null})});
  }
  let reservedSlotCount=demoOrderSlots(orders);
  state.fleetSeed??=demoSeedFleet(state,template,products,seed.capacitySchedule,slotCap,trialSlotCount+reservedSlotCount+session.filter(device=>device.activatedAt!==null).length,retired);
  // Payment committed the DEVICE reservation. Its receipt or cancellation releases that reservation.
  if(!state.promotionGift&&state.promotionRewardState!=='CANCELLED'&&demoAccountOrders(url,locale,state,now)
      .some(order=>order.orderNo===demoPromotionGift.orderNo&&order.paymentStatus==='PAID'))reservedSlotCount+=demoPromotionGift.quantity;
  const roster=[...structuredClone(state.fleetSeed),...session].filter(device=>!retired.includes(device.id));
  const eventGift=demoH4Gift(state);
  const gifts=[eventGift&&{...eventGift.result.receipt,at:eventGift.at,deviceIds:eventGift.deviceIds},state.promotionGift];
  for(const gift of gifts){
    if(!gift)continue;
    const {productNo,instances}=gift;
    const product=products.find(item=>item.id===productNo);
    for(const [index,id] of gift.deviceIds.entries()){
      if(retired.includes(id))continue;
      roster.push({...template,id,instanceNo:instances[index],name:product.name,productCode:productNo.toUpperCase(),
        gpuModel:product.gpu,vramTotalGb:Number.parseInt(product.vram,10),basePowerW:Number.parseInt(product.power,10),location:product.datacenter,
        dailyUsdt:product.dailyEarn,dailyNex:product.dailyEarnNEX,actualPaidUsdt:0,activatedAt:gift.at,purchasedAt:gift.at,
        todayEarningsUsdt:0,todayEarningsNex:0,cumulativeOutputUsdt:0,
        ...(gift===state.promotionGift&&{sourceChannel:'PROMOTION_GIFT',sourceOrderNo:demoPromotionGift.orderNo})});
    }
  }
  const devices=roster.map(seedDevice=>{
    const device={...seedDevice,...state.deviceActivations?.[seedDevice.id]};
    const product=products.find(product=>product.id.toUpperCase()===device.productCode);
    const capacity=previewCapacity(device,seed.capacitySchedule,now);
    return {...device,...capacity,monthlyTargetActive:product.monthlyEstimateUsdt!=null,
      dailyUsdt:Number((product.dailyEarn*capacity.capacityPct/100).toFixed(6))};
  });
  // serverNow is this read's time: the shared review fixture's clock stops at server start.
  return {devices,slotCap,reservedSlotCount,trialSlotCount,serverNow:now,slotsUsed:devices.filter(device=>device.activatedAt!==null).length+reservedSlotCount+trialSlotCount};
}

export function demoCapacityReplacementSource(fleet, products) {
  if (fleet.slotsUsed < fleet.slotCap) return undefined;
  const shareSkus = new Set(products.filter(product => product.productType === 'SHARE').map(product => product.id.toUpperCase()));
  return fleet.devices.filter(device => device.activatedAt != null && device.deactivatedAt == null
    && ['ACTIVE', 'ONLINE'].includes(device.status) && (device.ownershipStatus ?? 'OWNED') === 'OWNED'
    && !device.pendingDeactivate && device.sourceChannel !== 'PROMOTION_GIFT'
    && !['SHARE', 'CLOUD'].includes(device.deviceType) && !shareSkus.has(device.productCode))
    .sort((a, b) => (a.dailyUsdt ?? 0) - (b.dailyUsdt ?? 0) || a.id - b.id)[0];
}

// Apply a selected preview preset once. Reads and saved-state imports never issue a gift.
export function setDemoPromotionReward(url,locale,state,now,selection) {
  const {orderNo,obligationId,productNo}=demoPromotionGift;
  const needsReservation=selection!=='CANCELLED'&&!(selection==='ISSUED'&&state.promotionGift);
  if(needsReservation&&demoAccountOrders(url,locale,state,now).some(row=>row.orderNo===orderNo&&row.paymentStatus==='PAID')){
    // Size the selected paid history before changing the retained order, timestamp or receipt.
    const reserved={...state,promotionRewardState:selection,promotionGift:null};
    const {slotsUsed,slotCap,devices}=demoFleetFacts(url,locale,reserved);
    if(slotsUsed>slotCap){
      // Only a full preset's synthetic filler can give way to the reservation.
      const filler=devices.findLast(device=>[44,45,46,48,49,50].includes(device.id)&&device.activatedAt!==null);
      if(!filler)return false;
      state.fleetSeed=state.fleetSeed.filter(device=>device.id!==filler.id);
    }
    if(selection==='ISSUED'){
      const id=state.deviceSequence=(state.deviceSequence??1000)+1;
      const instanceNo='PG-'+createHash('sha256').update(obligationId+':0').digest('hex').slice(0,48);
      state.promotionGift={productNo,at:now,deviceIds:[id],instances:[instanceNo]};
    }
  }
  if(selection!=='ISSUED')delete state.promotionGift;
  state.promotionRewardState=selection;
  state.promotionRewardAt=now;
  return true;
}

export function demoOrderFitsCapacity(url,locale,state,products,lines,excludeOrderNo) {
  const requested=lines.reduce((count,line)=>count+line.quantity,0);
  const fleet=demoFleetFacts(url,locale,state);
  // Paying an existing order reuses the slots it already holds.
  return fleet.slotsUsed-(excludeOrderNo?demoOrderSlots(demoScenarioOrders(products??demoProducts(state,url.origin),state,Date.now(),false),excludeOrderNo):0)+requested<=fleet.slotCap;
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
export function demoFixture(url,locale,state,request,now=Date.now()) {
  state.previewFactsAt??=demoStartedAt;
  state.walletLegacySeed??=false;
  const iso=new Date(now).toISOString(),pathname=url.pathname;
  const empty=state.dataState==='empty';
  const products=demoProducts(state,url.origin);
  if (pathname === '/api/config/phone-tiers') return { tiers: [1,2,3,4,5].map(tier => ({
    tier, name:`Tier ${tier}`, baseRateUsdt:[.02,.04,.06,.09,.12][tier-1], baseRateNex:tier*.1, effectiveAt:iso,
  })), sources:['Local prototype demo'] };
  if (pathname === '/api/config/home-display') return previewHomeDisplay(state, now);
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
  if(pathname==='/api/app/network/device-rank' && state.deviceRankState==='configured') {
    return reviewFixture(url,locale,state,request,previewHomeDisplaySample(state,now).online);
  }
  if(pathname.startsWith('/api/trial/')) {
    const fleet=demoFleetFacts(url,locale,state);
    return trialDemo(url,locale,state,request,fleet.slotsUsed>=fleet.slotCap,empty?[]:products,
      productNo=>requireDemoPurchase(state,products,[{productNo,quantity:1}],now,true));
  }
  if(pathname==='/api/devices/activate'&&request.method()==='POST'){
    const {deviceId,expectedVersion,clientMaxDevices=null}=request.postDataJSON();
    const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
    if(!Number.isInteger(deviceId)||deviceId<=0)fail(422,'DEVICE_ID_REQUIRED');
    if(!Number.isInteger(expectedVersion)||expectedVersion<0)fail(422,'DEVICE_VERSION_REQUIRED');
    const key=request.headers?.()['idempotency-key']?.trim();
    if(!key)fail(422,'IDEMPOTENCY_KEY_REQUIRED');
    if(key.length>128)fail(422,'IDEMPOTENCY_KEY_INVALID');
    const command=`activate:${key}`;
    const identity=JSON.stringify([deviceId,expectedVersion,clientMaxDevices]);
    const prior=state.deviceActivationReceipts?.[command];
    if(prior){
      if(prior.identity!==identity)refuse('IDEMPOTENCY_KEY_CONFLICT');
      return prior.receipt;
    }
    const fleet=demoFleetFacts(url,locale,state);
    const device=fleet.devices.find(row=>row.id===deviceId);
    if(!device)fail(404,'DEVICE_NOT_FOUND');
    if(device.rowVersion!==expectedVersion)refuse('DEVICE_VERSION_CONFLICT');
    if(['PHONE','MOBILE'].includes(device.deviceType))refuse('PHONE_CALIBRATION_ACTIVATION_REQUIRED');
    const alreadyActive=device.activatedAt!==null;
    if(!alreadyActive){
      if(clientMaxDevices>fleet.slotCap||fleet.slotsUsed>=fleet.slotCap)refuse('DEVICE_SLOT_CAP_EXCEEDED');
      (state.deviceActivations??={})[deviceId]={status:'ACTIVE',activatedAt:now,rowVersion:expectedVersion+1,runtimeStatus:'ONLINE'};
    }
    const receipt={deviceId,instanceNo:device.instanceNo,status:alreadyActive?device.status:'ACTIVE',
      activeCount:fleet.slotsUsed-fleet.reservedSlotCount-fleet.trialSlotCount+Number(!alreadyActive),
      slotCap:fleet.slotCap,rowVersion:expectedVersion+Number(!alreadyActive),alreadyActive};
    (state.deviceActivationReceipts??={})[command]={identity,receipt};
    return receipt;
  }
  const milestoneClaim=pathname.match(/^\/api\/points\/milestones\/(\d+)\/claim$/);
  const commandKey=request.headers?.()['idempotency-key']||request.headers?.()['Idempotency-Key'];
  const remember=(operation,targetId,response,order)=>{
    if(commandKey){state.commands??={};state.commands[commandKey]={idempotencyKey:commandKey,operation,targetId,status:'SUCCEEDED',order:structuredClone(order),response:structuredClone(response)};}
    return response;
  };
  if(pathname.startsWith('/api/promotion-commands/'))return state.commands?.[decodeURIComponent(pathname.split('/').pop())]||{idempotencyKey:decodeURIComponent(pathname.split('/').pop()),operation:url.searchParams.get('operation'),targetId:url.searchParams.get('targetId'),status:'NOT_FOUND',order:null};
  if(!milestoneClaim&&pathname!=='/api/points/sign-in'&&pathname!=='/api/app/trade-in/capacity-replace'&&request.method()==='POST'&&commandKey&&state.commands?.[commandKey])return structuredClone(state.commands[commandKey].response);
  if(pathname==='/api/config/platform'){
    const config=structuredClone(base());
    config.interfaceLanguages=previewInterfaceLanguages(state.interfaceLanguagesState);
    config.featureFlags.stakingVisible=false;
    config.featureFlags.homeWeeklyPromoEnabled=true;
    config.share.baseUrl='https://demo.uvel.example/ref/';
    const sample=previewHomeDisplaySample(state,now);
    Object.assign(config.publicStats,{
      registeredUsersBase:2000,registeredUsersAnchorAt:demoStartedAt,
      registeredUsersTickIntervalSec:300,registeredUsersTickStepMin:0,registeredUsersTickStepMax:2,
      virtualUserCount:0,activeJobsBase:previewActiveJobsBase(state),
    });
    config.publicStats.networkPulse={
      registeredUsers:derivedRegisteredUsers(config.publicStats,now),onlineDevices:sample.online,activeJobs:sample.activeJobs,
    };
    // Globe split and drift; the totals come from the shared home-display batch.
    const globeCenters=[['sg',236000,18,12.5],['jp',253000,22,13],['vn',163000,26,8.5],['uk',249000,16,12],['fr',208000,20,10],['de',217000,14,11],['us-ny',316000,24,17],['us-sj',284000,17,16]];
    // Old shape: nodes as weights plus the retired jitter/ratio fields. B22 shape: sharePct only.
    config.publicStats.globeDisplay=state.globeShareState==='nodes'
      ?{intervalMs:5400,nodeJitterPct:.4,activeJobsMinPct:8,activeJobsMaxPct:14,throughputMin:2.2,throughputMax:3.8,latencyJitterMs:6,centers:globeCenters.map(([id,nodes,latencyMs])=>({id,nodes,latencyMs}))}
      :{intervalMs:5400,throughputMin:2.2,throughputMax:3.8,latencyJitterMs:6,centers:globeCenters.map(([id,,latencyMs,sharePct],i)=>({id,latencyMs,sharePct:state.globeShareState==='invalid'&&i===0?sharePct-10:sharePct}))};
    if(state.globeShareState==='missing')delete config.publicStats.globeDisplay;
    // Verified aggregates feed the trust centre's platform figures; the empty fixture has none.
    const aggregate=(value,kind)=>({value,definition:'Preview figure',kind});
    config.publicStats.verified=empty?null:{activeAccounts:aggregate(8642,'COUNT'),registeredAccounts:aggregate(12480,'COUNT'),installedDevices:aggregate(3315,'COUNT'),onlineDevices:aggregate(2968,'COUNT'),completedPayoutUsdt:aggregate(1284650.5,'SUM'),capturedAt:new Date(demoStartedAt).toISOString()};
    return withDemoShareChannels(config,state);
  }
  // Every new account gets the newcomer gift, so the register subtitle shows it even without a code.
  if(pathname==='/api/config/referral-rewards')return {...base(),welcomeGift:{lockMode:'risk_bucket',usdtAmount:5,nexAmount:20}};
  // Invite preview: one friend code (with a V rank) and one support-advisor code (no V rank); any other code is not found.
  const referralPreview=pathname.match(/^\/api\/public\/referrals\/([^/]+)\/preview$/);
  if(referralPreview){
    const code=decodeURIComponent(referralPreview[1]);
    const gift={status:'PENDING_REVIEW',usdtAmount:5,nexAmount:20};
    if(code==='NX8K2M4Q')return {code,kind:'USER',sourceEnvironment:'PRODUCTION',sponsor:{displayName:'M•••',vRank:'V3'},gift};
    if(code==='CS7K4MPQ')return {code,kind:'ADVISOR',sourceEnvironment:'PRODUCTION',sponsor:{displayName:'L•••',vRank:null},gift};
    const error=new Error('REFERRAL_PREVIEW_NOT_FOUND');error.status=404;throw error;
  }
  const learning=learningDemo(url,state,request);if(learning!==undefined)return learning;
  const account=accountDemo(url,locale,state,request);if(account!==undefined)return account;
  const bank=bankDemo(url,state,request);if(bank!==undefined)return bank;
  const risk=riskDemo(url,locale,state,request);if(risk!==undefined)return risk;
  const settledTasks=()=>demoSettledTasks(state,state.previewFactsAt);
  if(pathname==='/api/app/home/overview') {
    const overview=structuredClone(base());
    const tasks=settledTasks();
    overview.earnings=demoTaskPeriods(tasks,now);
    overview.earningsLedger=tasks.slice().sort((a,b)=>b.completedAt-a.completedAt).slice(0,15)
      .map(task=>({id:task.taskNo,client:task.client,model:task.simulation?task.taskName:task.model,rewardUsdt:task.amount,
        completedAt:new Date(task.completedAt).toISOString(),synthetic:false}));
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
      const devices=demoFleetFacts(url,locale,state).devices;
      const points=demoTeamNetworkMembers(state,now).reduce((sum,member)=>sum+member.monthComputePoints,0);
      overview.doTheMath=previewDoTheMath(devices,products,product=>demoSkuPurchaseRules(state,product,points,now).eligible);
      overview.onGrid={clients:[{id:'demo-grid-1',name:'Demo Studio',model:'SDXL Turbo',city:'Tokyo',gpus:30},{id:'demo-grid-2',name:'Demo Lab',model:'Llama 70B',city:'Singapore',gpus:57}],activeDevices:3206,perSecUsdt:.028};
    }
    overview.onGrid.activeJobs=previewHomeDisplaySample(state,now).activeJobs;
    return overview;
  }
  if(pathname==='/api/store/bundle-discount')return {source:'server',serverCanonical:true,policyVersion:1,tiers:[{minItems:2,rate:.04},{minItems:3,rate:.07},{minItems:4,rate:.11}]};
  const finance=financeDemo(url,state,request);
  if(finance!==undefined){
    if(pathname==='/api/exchange')finance.wallet.nexAvailable=demoWalletNex(state,now);
    return finance;
  }
  const rankPolicy=rankPolicyDemo(url,locale);if(rankPolicy!==undefined)return rankPolicy;
  const teamGuides=teamGuidesDemo(url,locale,request,path=>demoFixture(new URL(path,url.origin),locale,state,request));if(teamGuides!==undefined)return teamGuides;
  const ambassador=ambassadorDemo(url,state,request,locale);if(ambassador!==undefined)return ambassador;
  const read=path=>demoFixture(new URL(path,url.origin),locale,state,{method:()=>'GET',headers:()=>request.headers?.()??{},postDataJSON:()=>({})});
  const walletBills=()=>{
    const order=demoHasLongBillRefs(state)&&!empty&&state.accountDeletionState!=='clear'
      ?demoAccountOrders(url,locale,state,now).find(row=>row.orderNo===longBillOrderNo&&row.canonicalStatus==='refunded'):null;
    const longRefs=order?[
      [order.orderNo,'USDT','OUT',order.amountUsdt,'ORDER_PURCHASE','purchase',order.paidAt],
      [order.refundBillNo,'USDT','IN',order.refundAmountUsdt,'ORDER_REFUND','refund',order.refundedAt],
    ]:[];
    const learningBill=demoLongLearningBill(url,state);
    if(learningBill)longRefs.push(learningBill);
    return demoWalletBills(state,now,state.previewFactsAt,settledTasks(),longRefs);
  };
  const referralFacts=(limit=10)=>{
    const rewards=demoReferralLedger(walletBills(),limit);
    const invitedCount=demoH4TeamMembers(state,now).filter(member=>member.layer===1).length;
    return {referralCode:'UVELDEMO',rewardEnabled:true,inviterRewardNex:10,
      invitedCount,pendingCount:state.accountDeletionState==='clear'?0:Math.max(0,invitedCount-rewards.settledCount),...rewards};
  };
  const auxiliary=auxiliaryDemo(url,locale,state,request,read,walletBills,()=>demoFleetFacts(url,locale,state).devices,referralFacts);if(auxiliary!==undefined)return auxiliary;
  const staking=stakingDemo(url,state,request);if(staking!==undefined)return staking;
  const support=supportDemo(url,locale,state,request);if(support!==undefined)return support;
  const secondary=secondaryDemo(url,state,request,walletBills);
  if(secondary!==undefined)return secondary;
  if(pathname==='/api/config/v-ranks') {
    const data=structuredClone(base());
    const own=[0,demoV1SelfComputePoints,640,2000,4000,8000,16000,32000,64000],team=[0,1280,6400,20000,64000,160000,480000,1280000,3200000];
    data.ranks=data.ranks.map((rank,index)=>({...rank,cultivationBonus:rank.rewards.filter(reward=>reward.type==='UVT').reduce((sum,reward)=>sum+reward.amount,0),selfComputePoints:own[index],teamComputePoints:team[index]}));
    return data;
  }
  if(pathname==='/api/team/rank') {
    const data=structuredClone(base());
    const {rank}=demoH4Account(state);
    const members=demoH4TeamMembers(state,now).filter(member=>member.layer<=7);
    const direct=members.filter(member=>member.layer===1);
    const directRefs=direct.filter(member=>member.lifetimeComputePoints>=demoV1SelfComputePoints).length;
    const vDownlineCounts={};
    for(const member of direct)vDownlineCounts[member.vRank]=(vDownlineCounts[member.vRank]??0)+1;
    const teamComputePoints=members.reduce((sum,member)=>sum+member.lifetimeComputePoints,0);
    const productPoints=new Map(products.map(product=>[product.id,product.computePoints]));
    const selfComputePoints=demoAccountOrders(url,locale,state,now).filter(order=>demoPaidPurchase(order)&&order.paidAt<=now)
      .reduce((sum,order)=>sum+(order.computePoints??order.lineItems.reduce((total,line)=>total+(productPoints.get(line.sku)??0)*line.quantity,0)),0);
    return {...data,rankCode:'V'+rank,progress:{...data.progress,directRefs,vDownlineCounts,selfComputePoints,teamComputePoints}};
  }
  if(pathname==='/api/team/binary'){
    const members=demoH4TeamMembers(state,now);
    const legs=demoBinaryLegMembers(members);
    const direct=members.filter(member=>member.layer===1);
    const trackAMembers=direct.filter(member=>member.leg==='A').length;
    const trackBMembers=direct.filter(member=>member.leg==='B').length;
    const asOfDate=demoTeamBusinessDate(now);
    const monthEnd=new Date(Date.UTC(Number(asOfDate.slice(0,4)),Number(asOfDate.slice(5,7)),0)).getUTCDate();
    const matches=demoCommissionGroups(state,state.previewFactsAt).filter(event=>event.kind==='binary');
    const consumed=matches.reduce((total,match)=>total+match.orderAmountUSD,0);
    const volume=leg=>Math.max(0,legs[leg].flatMap(member=>member.paidOrders)
      .filter(order=>order.paidAt<=now).reduce((sum,order)=>sum+order.amountUsdt,0)-consumed);
    const trackA=volume('A'),trackB=volume('B'),threshold=1000,matchRate=.1,dailyCap=5000;
    const periodCap=dailyCap*monthEnd;
    let blockedReason='';
    if(trackAMembers+trackBMembers!==direct.length||!trackAMembers||!trackBMembers)blockedReason='BINARY_LEG_ASSIGNMENT_INCOMPLETE';
    else if(Math.min(trackA,trackB)<threshold)blockedReason='BINARY_THRESHOLD_NOT_MET';
    else if(Number(asOfDate.slice(8))!==monthEnd)blockedReason='F3_SETTLEMENT_NOT_DUE';
    return {...authority,source:'server',runId:null,asOfDate,trackA,trackB,trackAMembers,trackBMembers,
      trackATotalMembers:legs.A.length,trackBTotalMembers:legs.B.length,autoPlacedMembers:0,
      matchRate,threshold,dailyCap,periodCap,estimatedAmountUsdt:blockedReason?0:Number(Math.min(periodCap,Math.min(trackA,trackB)*matchRate).toFixed(6)),
      settlePeriod:'monthly',residualPolicy:'carryForward',spilloverEnabled:false,gvReset:'monthly',paused:false,blockedReason,
      recentMatches:matches
        .map(event=>({id:event.id,amountUsdt:event.amountUSDT,status:event.status.toUpperCase(),
          createdAt:new Date(event.ts).toISOString(),unlockAt:new Date(event.unlockAt).toISOString()}))};
  }
  if(pathname==='/auth/users/oauth/provider/available')return ['GOOGLE','APPLE','TELEGRAM'];
  if(pathname==='/auth/users/oauth/provider/linked')return ['GOOGLE'];
  if(pathname==='/api/store/catalog') return {...authority,source:'nx_product',revision:null,products:empty?[]:products};
  if(pathname==='/api/product/phase') return {phase:'P2',source:'H1_GROWTH_RHYTHM',devOverrideAllowed:false};
  if(pathname==='/api/store/purchase-eligibility'||pathname==='/api/app/team/quota'){
    const members=demoTeamNetworkMembers(state,now);
    const teamComputePoints=members.reduce((sum,member)=>sum+member.monthComputePoints,0);
    if(pathname==='/api/store/purchase-eligibility'){
      const productNo=url.searchParams.get('productNo');
      const product=products.find(item=>item.id===productNo);
      if(empty||!product)throw Object.assign(new Error('PRODUCT_NOT_AVAILABLE'),{status:404});
      return {...authority,runId:null,productNo,...demoSkuPurchaseRules(state,product,teamComputePoints,now),
        evaluatedAt:now,source:'nx_product + nx_admin_device_sku + nx_user'};
    }
    if(!['approved','catalog-error'].includes(state.quotaState))
      throw Object.assign(new Error('TEAM_QUOTA_NOT_READY'),{status:503});
    const approvedProduct=!empty&&state.quotaState==='approved'&&products.find(product=>product.id===approvedQuotaSku);
    if(!approvedProduct)throw Object.assign(new Error('TEAM_QUOTA_CATALOG_NOT_READY'),{status:503});
    const direct=demoH4TeamMembers(state,now).filter(member=>member.layer===1);
    return {...authority,source:'server',generatedAt:iso,facts:{rank:demoH4Account(state).rank,
      directRefs:direct.filter(member=>member.lifetimeComputePoints>=demoV1SelfComputePoints).length,
      directInvites:direct.length,activeDirect:members.filter(member=>member.layer===1).length,teamComputePoints},
      tiers:[demoHardwareQuota(approvedProduct,state,teamComputePoints,now)]};
  }
  const tradeinCuts=[25,50,75,100],tradeinRates=[75,60,45,30,15];
  if(pathname==='/api/app/trade-in/config')return {enabled:!empty,eligibility:'L4_PLUS',outputRatioCutsPct:tradeinCuts,creditRatesPct:tradeinRates,requireHigherPrice:true,maxDevicesPerOrder:1,earlyAccessEnabled:false,earlyAccessLeadDays:30,source:'server'};
  const tradeinRankAllowed=()=>demoH4Account(state,now).rank>=4;
  // All rows in the preview account's fleet are its own unless ownership says otherwise.
  const isTradeinSource=device=>{
    const sku=products.find(product=>product.id===device.productCode.toLowerCase());
    if(sku?.productType!=='DEVICE'||['SHARE','CLOUD'].includes(device.deviceType)
      ||(device.ownershipStatus??'OWNED')!=='OWNED'||device.pendingDeactivate||device.sourceChannel==='PROMOTION_GIFT')return false;
    if(device.activatedAt!=null)
      return device.deactivatedAt==null&&['ACTIVE','ONLINE','BUSY','RUNNING','OFFLINE'].includes(device.status);
    return ['INACTIVE','INVENTORY','DEACTIVATED','PENDING_ACTIVATION'].includes(device.status);
  };
  const tradeinSourceReason=(device,product)=>{
    if(!(device.actualPaidUsdt>0))return 'SOURCE_PAID_PRICE_UNAVAILABLE';
    if(device.productCode.toLowerCase()===product.id)return 'TARGET_MUST_DIFFER';
    return product.price>device.actualPaidUsdt?'OK':'HIGHER_PRICE_REQUIRED';
  };
  const tradeinTargetReason=product=>{
    if(!product||product.productType!=='DEVICE')return 'TARGET_NOT_ACTIVE';
    if(product.stock<1)return 'TARGET_OUT_OF_STOCK';
    if(!product.available)return 'TARGET_NOT_RELEASED';
    return null;
  };
  if(pathname==='/api/app/trade-in/eligibility'){
    const {targetProductNo}=request.postDataJSON();
    const refused=empty?'TRADEIN_DISABLED':!tradeinRankAllowed()?'TRADEIN_ELIGIBILITY_NOT_MET':null;
    const product=refused?null:products.find(p=>p.id===targetProductNo);
    const targetReason=refused??tradeinTargetReason(product);
    const sources=targetReason?[]:demoFleetFacts(url,locale,state).devices.filter(isTradeinSource).map(device=>{
      const reasonCode=tradeinSourceReason(device,product);
      return {sourceDeviceId:device.id,sourceProductName:device.name,eligible:reasonCode==='OK',reasonCode};
    });
    const eligible=sources.some(source=>source.eligible);
    return {enabled:!empty,eligible,decisionCode:targetReason??(eligible?'ELIGIBLE':'NO_ELIGIBLE_SOURCE'),
      targetProductId:product?products.indexOf(product)+1:null,targetProductNo,targetProductName:product?.name??null,
      targetPriceUsdt:product?.price??null,requireHigherPrice:true,maxDevicesPerOrder:1,sources,decisionSource:'server'};
  }
  const tradeinQuote=(sourceDeviceId,targetProductNo)=>{
    if(empty)refuse('TRADEIN_DISABLED');
    if(!tradeinRankAllowed())refuse('TRADEIN_ELIGIBILITY_NOT_MET');
    const product=products.find(p=>p.id===targetProductNo);
    const targetReason=tradeinTargetReason(product);
    if(targetReason)refuse('TRADEIN_'+targetReason);
    const device=demoFleetFacts(url,locale,state).devices.find(d=>d.id===sourceDeviceId&&isTradeinSource(d));
    if(!device)refuse('TRADEIN_SOURCE_NOT_ACTIVE_OR_NOT_OWNED');
    const reason=tradeinSourceReason(device,product);
    if(reason!=='OK')refuse('TRADEIN_'+reason);
    requireDemoPurchase(state,products,[{productNo:product.id,quantity:1}],now);
    const ratio=Math.min(100,Math.round(device.cumulativeOutputUsdt/device.actualPaidUsdt*10000)/100),band=tradeinCuts.filter(cut=>ratio>=cut).length;
    const discount=Math.min(product.price,Math.round(device.actualPaidUsdt*tradeinRates[band])/100),payable=Math.round((product.price-discount)*100)/100,wallet=state.walletBalance??52800.64;
    return {sourceDeviceId:device.id,sourceRowVersion:device.rowVersion,targetDeviceStatus:device.activatedAt?'ACTIVE':'INACTIVE',sourceProductName:device.name,targetProductId:products.indexOf(product)+1,targetProductNo:product.id,targetProductName:product.name,sourceActualPaidUsdt:device.actualPaidUsdt,cumulativeOutputUsdt:device.cumulativeOutputUsdt,outputRatioPct:ratio,creditRatePct:tradeinRates[band],discountUsdt:discount,targetPriceUsdt:product.price,payableUsdt:payable,walletBalanceUsdt:wallet,walletShortfallUsdt:Math.max(0,payable-wallet),sufficientFunds:wallet>=payable,discountToWallet:false,pricingSource:'server'};
  };
  if(pathname==='/api/app/trade-in/quote'){const input=request.postDataJSON();return tradeinQuote(input.sourceDeviceId,input.targetProductNo);}
  if(pathname==='/api/app/trade-in/submit'||pathname==='/api/app/trade-in/capacity-replace'){
    const replacingCapacity=pathname.endsWith('/capacity-replace');
    const input=request.postDataJSON();
    let quote;
    if(replacingCapacity){
      const capacity=demoFixture(new URL('/api/app/trade-in/capacity-quote',url.origin),locale,state,request,now);
      if(capacity.sourceDeviceId===null||input.sourceDeviceId!==capacity.sourceDeviceId)refuse('CAPACITY_REPLACEMENT_SOURCE_CHANGED');
      if(typeof input.expectedPayableUsdt!=='number'||Math.abs(input.expectedPayableUsdt-capacity.payableUsdt)>0.000001)refuse('CAPACITY_REPLACEMENT_QUOTE_CHANGED');
      quote={...capacity,discountUsdt:0,targetDeviceStatus:'ACTIVE'};
    }else{
      quote=tradeinQuote(input.sourceDeviceId,input.targetProductNo);
      if(input.expectedSourceVersion!==quote.sourceRowVersion||Math.abs(input.expectedPayableUsdt-quote.payableUsdt)>0.000001||Math.abs(input.expectedDiscountUsdt-quote.discountUsdt)>0.000001)throw new Error('Demo trade-in quote changed');
    }
    const product=products.find(p=>p.id===quote.targetProductNo);
    const hardwareQuotaUsedAt=requireDemoPurchase(state,products,[{productNo:product.id,quantity:1}],now,true);
    if(!quote.sufficientFunds)refuse('TRADEIN_INSUFFICIENT_FUNDS');
    if(replacingCapacity){
      const source=demoFleetFacts(url,locale,state).devices.find(device=>device.id===quote.sourceDeviceId);
      (state.deviceActivations??={})[source.id]={status:'INACTIVE',activatedAt:null,runtimeStatus:'OFFLINE',rowVersion:source.rowVersion+1};
    }else (state.retiredDeviceIds||=[]).push(quote.sourceDeviceId);
    const active=quote.targetDeviceStatus==='ACTIVE',sequence=state.nextOrderNo=(state.nextOrderNo??now)+1,orderNo='DEMO-ORDER-'+sequence;
    postDemoWalletEntries(state,{bizNo:orderNo,bizType:'TRADE_IN_PURCHASE',asset:'USDT',direction:'OUT',
      amount:quote.payableUsdt,at:now,category:'purchase',remark:'E3 trade-in upgrade wallet payment'});
    const targetDeviceInstanceNo=demoOrderDeviceInstance(orderNo);
    const targetDeviceId=state.deviceSequence=(state.deviceSequence||1000)+1;
    (state.deviceIds??={})[targetDeviceInstanceNo]=targetDeviceId;
    const canonicalStatus=active?'activated':'inventory';
    const order={...demoOrders(products,state,now)[0],orderNo,productNo:product.id,productName:product.name,quantity:1,computePoints:product.computePoints,subtotalUsdt:product.price,unitPriceUsdt:product.price,discountUsdt:quote.discountUsdt,amountUsdt:quote.payableUsdt,paymentMethod:'WALLET',orderType:'TRADE_IN',itemCount:1,
      lineItems:[{sku:product.id,name:product.name,quantity:1,unitPriceUsdt:product.price,lineAmountUsdt:product.price}],tradeinNo:'DEMO-TRADEIN-'+sequence,sourceDeviceId:quote.sourceDeviceId,targetDeviceId,targetDeviceInstanceNo,
      paymentStatus:'PAID',orderStatus:'COMPLETED',activationStatus:active?'ACTIVATED':'INVENTORY',canonicalStatus,placedAt:now,expiresAt:null,paidAt:now,inventoryUsedAt:now,hardwareQuotaUsedAt,activatedAt:active?now:null};
    (state.createdOrders||=[]).unshift(order);
    const receipt={tradeinNo:order.tradeinNo,orderNo,sourceDeviceId:quote.sourceDeviceId,targetDeviceId,targetDeviceStatus:quote.targetDeviceStatus,applicationStatus:'COMPLETED',orderStatus:'COMPLETED',discountUsdt:quote.discountUsdt,walletDebitUsdt:quote.payableUsdt,walletBalanceAfterUsdt:state.walletBalance};
    return replacingCapacity?receipt:remember('tradeinSubmit',orderNo,receipt,order);
  }
  if(pathname==='/api/app/trade-in/capacity-quote'){
    const {targetProductNo}=request.postDataJSON();
    const product=products.find(item=>item.id===targetProductNo);
    if(empty||!product||product.inventoryMode!=='FINITE'||!(product.price>0))refuse('TRADEIN_TARGET_NOT_ACTIVE');
    const reason=tradeinTargetReason(product);
    if(reason)refuse(reason==='TARGET_NOT_RELEASED'?'TRADEIN_TARGET_NOT_RELEASED':'TRADEIN_TARGET_NOT_ACTIVE');
    const points=demoTeamNetworkMembers(state,now).reduce((sum,member)=>sum+member.monthComputePoints,0);
    const purchase=demoSkuPurchaseRules(state,product,points,now);
    if(!purchase.eligible){
      const code=purchase.decisionCode==='F4B_MONTHLY_QUOTA_EXHAUSTED'?'PURCHASE_GATE_SOLD_OUT':'PURCHASE_GATE_NOT_MET';
      throw Object.assign(new Error(code),{status:403});
    }
    const data=structuredClone(base());
    Object.assign(data,{targetProductId:products.indexOf(product)+1,targetProductNo:product.id,targetProductName:product.name,targetPriceUsdt:product.price});
    const fleet=demoFleetFacts(url,locale,state),active=fleet.devices.filter(device=>device.activatedAt!==null),full=fleet.slotsUsed>=fleet.slotCap;
    const source=demoCapacityReplacementSource(fleet,products);
    Object.assign(data,{decision:full?(source?'REPLACE_REQUIRED':'NO_ACTIVE_DEVICE'):'CAPACITY_AVAILABLE',activeDevices:active.length,maxActiveDevices:fleet.slotCap,
      sourceDeviceId:source?.id??null,sourceDeviceName:source?.name??null,
      payableUsdt:product.price,walletBalanceUsdt:state.walletBalance??52800.64,sufficientFunds:(state.walletBalance??52800.64)>=product.price});
    return data;
  }
  if(pathname==='/api/orders/quote') {
    const input=request.postDataJSON();
    requireDemoPurchase(state,products,input.items,now);
    const items=input.items.map((item,index)=>{
      const product=products.find(p=>p.id===item.productNo);
      if(!product) throw new Error('Unknown demo SKU');
      return {...item,lineId:'demo-line-'+index,unitPriceUsdt:product.price.toFixed(2),subtotalUsdt:(product.price*item.quantity).toFixed(2),discountUsdt:'0.00',payableUsdt:(product.price*item.quantity).toFixed(2)};
    });
    const subtotal=items.reduce((sum,item)=>sum+Number(item.subtotalUsdt),0).toFixed(2);
    const activity=input.activityId
      ? demoFixture(new URL('/api/promotions/'+input.activityId,url.origin),locale,state,request,now)
      : null;
    const repurchase=activity?.template==='REPURCHASE';
    const matches=items.flatMap(line=>{
      const rule=activity?.rewardRules?.find(candidate=>candidate.productNo===line.productNo
        &&(!repurchase||line.quantity>=candidate.minBuyQty));
      return rule?[{line,rule}]:[];
    });
    if(input.activityId&&(!activity?.activityId
        ||(repurchase&&(activity.eligibility!=='ESTIMATE_ELIGIBLE'||!matches.length)))){
      refuse('PROMOTION_NOT_ELIGIBLE_OR_UNAVAILABLE');
    }
    const quote={quoteId:'demo-quote-'+now+'-'+(state.quoteSequence=(state.quoteSequence||0)+1),voucherId:input.voucherId||null,quoteHash:'demo-quote-hash',serverTime:iso,expiresAt:new Date(now+300000).toISOString(),itemCount:items.length,quantity:items.reduce((sum,item)=>sum+item.quantity,0),items,subtotalUsdt:subtotal,discountUsdt:'0.00',amountUsdt:subtotal,bundlePolicyVersion:1,activityId:input.activityId||null,activityVersion:activity?.version??null,eligibility:'ELIGIBLE',expectedRewards:[],warnings:[],reserved:false};
    for(const {line,rule} of matches){
      const {disclosure,...reward}=rule.buyerReward;
      quote.expectedRewards.push({lineId:line.lineId,activityId:activity.activityId,version:activity.version,
        ruleId:rule.ruleId,rewardRuleId:reward.rewardRuleId,beneficiaryRole:reward.beneficiaryRole,
        groups:1,reward,disclosure,eligibility:'ELIGIBLE',message:null});
    }
    const bundleDiscount=Number((Number(subtotal)*bundleRate(items.length)).toFixed(2));
    const voucher=demoVoucherRedemption(state,quote.voucherId,items,Number(subtotal),now);
    let remaining=bundleDiscount+(voucher?.discountUsdt??0);
    quote.discountUsdt=remaining.toFixed(2);quote.amountUsdt=(Number(subtotal)-remaining).toFixed(2);
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
    state.quotes||={};state.quotes[quote.quoteId]={...quote,voucherGrantId:voucher?.grantId};return quote;
  }
  if(pathname==='/api/genesis/state') return url.searchParams.has('history')?{...authority,items:[],nextCursor:null}:genesisPublic(now);
  if(pathname==='/api/genesis/account') return url.searchParams.has('history')?{...authority,items:[],nextCursor:null}:{...authority,series:null,sale:null,eligibility:null,marketEnabled:false,emissionOpen:false,holdings:[],emissions:[],orders:[],walletBalanceUsdt:5280};
  if(pathname==='/api/genesis/eligibility') return {...authority,eligible:false,reasons:['SALE_NOT_OPEN'],ownedCount:0,maxPerUser:2,remainingCap:2,minAccountAgeDays:0,accountAgeDays:Math.floor((now-demoH4Account(state).createdAt)/day),status:'NOT_ELIGIBLE',reservedAllocation:null,reservedAllocationUnit:'UVT',priorityRank:null,priorityTier:'NONE',qualificationReasonCodes:['NO_ACTIVE_HOLDINGS'],policyVersion:null,effectiveAt:null,asOf:iso,serverTime:iso,provenance:{source:'nx_genesis_holding+nx_config_item',environment:'PRODUCTION',runId:''},halted:false};
  if(pathname==='/api/orders'&&(!request?.method||request.method()==='GET')) return {...authority,runId:null,source:'server',orders:demoAccountOrders(url,locale,state,now),nextCursor:null};
  if(['/api/orders','/api/orders/bundle'].includes(pathname)&&request.method()==='POST'){
    const input=request.postDataJSON(),quote=state.quotes?.[input.promotionQuoteId];
    const lines=quote?.items||input.items||input.productNos?.map(productNo=>({productNo,quantity:1}))||[{productNo:input.productNo,quantity:input.quantity}],product=products.find(p=>p.id===lines[0].productNo);
    if(lines.some(line=>!products.some(p=>p.id===line.productNo)||!Number.isInteger(line.quantity)||line.quantity<1))throw new Error('Invalid demo order items');
    requireDemoPurchase(state,products,lines,now);
    if(!demoOrderFitsCapacity(url,locale,state,products,lines))refuse('PROMOTION_CAPACITY_UNAVAILABLE');
    const quantity=lines.reduce((s,l)=>s+l.quantity,0),subtotal=lines.reduce((s,l)=>s+products.find(p=>p.id===l.productNo).price*l.quantity,0),discountRate=bundleRate(lines.length),bundleDiscount=Number((subtotal*discountRate).toFixed(2));
    const voucher=demoVoucherRedemption(state,quote?quote.voucherId:input.voucherId,lines,subtotal,now);
    if(quote&&quote.voucherGrantId!==voucher?.grantId)refuse('VOUCHER_NOT_AVAILABLE_OR_NOT_APPLICABLE');
    const amount=Number(quote?.amountUsdt??(subtotal-bundleDiscount-(voucher?.discountUsdt??0)).toFixed(2));
    if(input.productNos&&(input.policyVersion!==1||Math.abs(input.expectedAmountUsdt-amount)>0.000001))throw new Error('Demo bundle quote changed');
    const order={...demoOrders(products,state,now)[0],orderNo:'DEMO-ORDER-'+(state.nextOrderNo=(state.nextOrderNo??now)+1),productNo:product.id,productName:product.name,quantity,subtotalUsdt:subtotal,unitPriceUsdt:product.price,discountUsdt:Number((subtotal-amount).toFixed(6)),amountUsdt:quote?amount.toFixed(2):amount,placedAt:now,
      computePoints:lines.reduce((total,line)=>total+products.find(p=>p.id===line.productNo).computePoints*line.quantity,0),orderType:lines.length>1?'BUNDLE':'SINGLE',itemCount:lines.length,lineItems:lines.map(l=>({sku:l.productNo,name:products.find(p=>p.id===l.productNo).name,quantity:l.quantity,unitPriceUsdt:products.find(p=>p.id===l.productNo).price,lineAmountUsdt:products.find(p=>p.id===l.productNo).price*l.quantity}))};
    if(quote)Object.assign(order,{promotionQuoteId:quote.quoteId,payBy:new Date(now+paymentWindow).toISOString(),items:quote.items.map(l=>({...l,productName:products.find(p=>p.id===l.productNo).name})),rewards:quote.expectedRewards});
    Object.assign(order,{paymentStatus:'PENDING',orderStatus:'PENDING_PAYMENT',activationStatus:'WAITING_PAYMENT',canonicalStatus:'placed',expiresAt:now+paymentWindow,paidAt:null,activatedAt:null,targetDeviceId:null,targetDeviceInstanceNo:null});
    if(voucher){
      if(voucher.voucherId==='V-DESIGN')state.voucherUsed=true;
      Object.assign(order,{voucherId:voucher.voucherId,voucherRedemption:voucher});
    }
    state.createdOrders||=[];state.createdOrders.unshift(order);
    const response=quote?order:input.productNos?{orderNo:order.orderNo,orderType:'BUNDLE',itemCount:lines.length,productNos:input.productNos,subtotalUsdt:subtotal,discountRate,discountUsdt:Number((subtotal-amount).toFixed(6)),amountUsdt:amount,paymentStatus:'PENDING',orderStatus:'PENDING_PAYMENT',idSource:'server',policyVersion:1}:{orderNo:order.orderNo,subtotalUsdt:subtotal,discountUsdt:Number((subtotal-amount).toFixed(6)),amountUsdt:amount,voucherId:order.voucherId||null,voucherRedemption:order.voucherRedemption??null,paymentStatus:'PENDING',orderStatus:'PENDING_PAYMENT',idSource:'server'};
    return remember(lines.length>1?'createBundle':'createOrder',quote?.quoteId||order.orderNo,response,order);
  }
  const orderAction=pathname.match(/^\/api\/orders\/(DEMO-ORDER-\d+)\/(pay|cancel)$/);
  if(orderAction){
    const [,orderNo,action]=orderAction,order=demoAccountOrders(url,locale,state,now).find(o=>o.orderNo===orderNo);
    if(!order) return {};
    const replay=order.paymentStatus==='PAID',amount=Number(order.amountUsdt);
    if(action==='cancel'){
      if(replay)refuse('ORDER_NOT_CANCELLABLE');
      (state.orderStatuses??={})[orderNo]='cancelled';
      if(state.createdOrders?.includes(order)){
        Object.assign(order,{canonicalStatus:'cancelled',paymentStatus:'CANCELLED',orderStatus:'CANCELLED',
          activationStatus:'WAITING_PAYMENT',paidAt:null,activatedAt:null});
      }
      return remember('cancelOrder',orderNo,{...(order.promotionQuoteId?order:{}),...authority,source:'server',
        orderNo,orderStatus:'CANCELLED',paymentStatus:'CANCELLED',idempotent:false},order);
    }
    const paymentNo='DEMO-PAY-'+orderNo,paymentMethod=amount===0?'VOUCHER':'WALLET';
    if(replay){
      if(order.orderStatus!=='COMPLETED'||order.activationStatus!=='ACTIVATED')refuse('ORDER_NOT_PAYABLE');
      if(order.paymentNo!==paymentNo)refuse('ORDER_PAYMENT_STATE_CONFLICT');
    }else{
      if(order.paymentStatus!=='PENDING')refuse('ORDER_NOT_PAYABLE');
      const lines=order.lineItems.map(line=>({productNo:line.sku,quantity:line.quantity}));
      if(!demoOrderFitsCapacity(url,locale,state,products,lines,orderNo))refuse('PROMOTION_CAPACITY_UNAVAILABLE');
      const hardwareQuotaUsedAt=requireDemoPurchase(state,products,lines,now,true);
      if(amount>0&&amount>demoWalletUsdt(state))refuse('ORDER_WALLET_INSUFFICIENT');
      if(amount>0){
        postDemoWalletEntries(state,{bizNo:orderNo,bizType:'ORDER_PURCHASE',asset:'USDT',direction:'OUT',
          amount,at:now,category:'purchase',remark:'UVEL wallet order settlement'});
      }
      (state.orderStatuses??={})[orderNo]='activated';
      if(state.createdOrders?.includes(order)){
        Object.assign(order,{canonicalStatus:'activated',paymentStatus:'PAID',orderStatus:'COMPLETED',
          activationStatus:'ACTIVATED',inventoryUsedAt:now,hardwareQuotaUsedAt,paidAt:now,activatedAt:now,paymentNo,paymentMethod});
      }
    }
    const balanceAfter=demoWalletUsdt(state);
    const response={...(order.promotionQuoteId?order:{}),...authority,source:'server',orderNo,paymentNo,
      paymentStatus:'PAID',orderStatus:'COMPLETED',activationStatus:'ACTIVATED',canonicalStatus:'activated',
      amountUsdt:order.promotionQuoteId?amount.toFixed(2):amount,paymentMethod,
      walletBalanceAfterUsdt:amount===0?null:balanceAfter,idempotent:replay};
    return remember('payOrder',orderNo,response,order);
  }
  if(pathname==='/api/promotions'||/^\/api\/promotions\/demo-promo-\d+$/.test(pathname)) {
    const sample=base('/api/promotions').items[0];
    const giftName=products.find(product=>product.id===demoPromotionGift.productNo).name;
    const configs=[['SKU_GIFT','买 S1，送 '+giftName,'Buy S1, get '+giftName,'Mua S1, tặng '+giftName,'stellarbox-s1'],['FIRST_PURCHASE','首购成长礼','First purchase reward','Quà mua lần đầu','stellarbox-s1'],['DIRECT_REFERRAL','邀请好友购机礼','Referral purchase reward','Quà giới thiệu','stellarbox-pro'],['MULTI_PRODUCT','算力组合礼','Compute bundle offer','Ưu đãi kết hợp','stellarrack-p1'],['REPURCHASE','老用户加购礼','Returning member offer','Ưu đãi mua thêm','cloud-share']];
    const authenticated=['Bearer local-demo-token','Bearer formal-probe-access-token'].includes(request?.headers?.().authorization);
    const exact=state.repurchaseState==='boundary'||state.repurchaseState==='outside';
    const repurchaseWindow=exact?{minDays:30,maxDays:30}:{minDays:state.repurchaseState==='inside'?7:0,maxDays:90};
    const readsPurchaseHistory=authenticated&&!empty&&state.eventState!=='empty';
    // The initial order snapshot cannot be newer than this projection's server time.
    if(readsPurchaseHistory)state.sampleOrdersAt??=now;
    const latestPaid=readsPurchaseHistory
      ? demoAccountOrders(url,locale,state,now).reduce((latest,order)=>
          order.paymentStatus==='PAID'&&!['REFUNDED','CANCELLED'].includes(order.orderStatus)
            && typeof order.paidAt==='number'&&(latest===null||order.paidAt>latest)?order.paidAt:latest,null)
      : null;
    const items=empty||state.eventState==='empty'?[]:configs.map(([template,zh,en,vi,productNo],i)=>{
      const item=structuredClone(sample);item.activityId='demo-promo-'+i;item.template=template;item.title={zh,en,vi};item.productNos=template==='MULTI_PRODUCT'?['stellarbox-pro','stellarrack-p1','stellarbox-s1']:[productNo];item.placement=[0,1,4].includes(i)?'home.purchase-promotion':null;
      item.rewardRules[0].productNo=productNo;item.rewardRules[0].ruleId='demo-rule-'+i;
      item.serverTime=iso;
      // Landing pages (P-58): eligibility follows the panel switch; first purchase and repurchase end in under six days.
      item.eligibility={eligible:'ESTIMATE_ELIGIBLE','sign-in':'SIGN_IN_REQUIRED',ineligible:'INELIGIBLE',unknown:'UNKNOWN'}[state.promotionEligibility]||'ESTIMATE_ELIGIBLE';
      if(i>0)item.endsAt=new Date(now+6*day-19*60000).toISOString();
      if(i===0){
        const window=demoH4PromotionWindow(state,now);
        Object.assign(item,{state:window.state==='ongoing'?'ACTIVE':window.state==='upcoming'?'SCHEDULED':'ENDED',
          startsAt:new Date(window.startsAt).toISOString(),endsAt:new Date(window.endsAt).toISOString()});
        item.version=2;
        const reward=promotionDeviceReward(giftName);
        item.rewardRules[0].buyerReward=reward;
        if(state.promotionRewardType==='gift-discount')item.rewardRules[0].buyerReward={rewardRuleId:reward.rewardRuleId,beneficiaryRole:'BUYER',type:'DISCOUNT_USDT',calculation:'FIXED',amount:'100',disclosure:orderDiscountDisclosure(100)};
      }
      if(i>0){const d=item.rewardRules[0].buyerReward.disclosure;d.deviceName=null;d.title={zh:'购机奖励',en:'Purchase reward',vi:'Thưởng mua hàng'};d.benefitDescription={zh:'领取 '+(i*50)+' UVT',en:'Receive '+(i*50)+' UVT',vi:'Nhận '+(i*50)+' UVT'};item.rewardRules[0].buyerReward=state.promotionRewardType==='discount'&&orderDiscounts[i]?{rewardRuleId:'demo-reward-'+i,beneficiaryRole:'BUYER',type:'DISCOUNT_USDT',calculation:'FIXED',amount:String(orderDiscounts[i]),disclosure:orderDiscountDisclosure(orderDiscounts[i])}:{rewardRuleId:'demo-reward-'+i,beneficiaryRole:'BUYER',type:'UVT',amount:String(i*50),disclosure:d};}
      if(i>0){
        if(state.eventState==='upcoming'){item.state='SCHEDULED';item.startsAt=new Date(now+day).toISOString();}else if(state.eventState==='ended'){item.state='ENDED';item.endsAt=new Date(now-day).toISOString();}
        // Boundary scenarios flip on the clock, one minute after the switch.
        const edge=(state.promotionTimingAt||now)+60000;
        if(state.promotionTiming==='starting'){item.startsAt=new Date(edge).toISOString();item.state=now<edge?'SCHEDULED':'ACTIVE';}
        else if(state.promotionTiming==='ending'){item.endsAt=new Date(edge).toISOString();item.state=now<edge?'ACTIVE':'ENDED';}
      }
      if(template==='REPURCHASE'){
        item.repurchaseWindow=repurchaseWindow;
        item.lastValidPurchaseAt=latestPaid===null?null:new Date(latestPaid).toISOString();
        const days=latestPaid===null?null:Math.floor((now-latestPaid)/day);
        item.eligibility=!authenticated?'SIGN_IN_REQUIRED'
          :days!==null&&days>=repurchaseWindow.minDays&&days<=repurchaseWindow.maxDays&&state.promotionEligibility!=='ineligible'
            ?'ESTIMATE_ELIGIBLE':'INELIGIBLE';
      }
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
    const exampleFor=code=>localized(code,'原型演示资料，非真实资质或认证。','Prototype sample, not a real credential or certification.','Dữ liệu mẫu, không phải chứng nhận thực tế.');
    // Leadership and service notes follow the company records and the white paper; registrations come from /api/content/trust/documents.
    const mapsFor=(locale)=>({financials:{overview:exampleFor(locale)},
      leadership:{leader1Name:'Jordan Nicholas Parkhurst',leader1Role:localized(locale,'总裁兼首席执行官 · President & CEO','President & Chief Executive Officer','Chủ tịch kiêm Tổng giám đốc điều hành'),leader1Url:'https://apps.dos.ny.gov/publicInquiry/'},
      nexNarrative:{hero:'UVT',subhero:exampleFor(locale),
        hostingContent:localized(locale,'Uvel Node 与 Uvel Rack 部署在专业数据中心，运行环境、网络配置和现场维护统一管理，无需寄送实体设备。购买后在 App 中激活和管理设备，订单与设备记录随时可查。','Uvel Node and Uvel Rack run in professional data centres, where the operating environment, network and on-site maintenance are managed for you; nothing is shipped. Activate and manage devices in the App, with order and device records always available.','Uvel Node và Uvel Rack được đặt tại trung tâm dữ liệu chuyên nghiệp; môi trường vận hành, mạng và bảo trì tại chỗ đều được quản lý tập trung, không cần giao thiết bị vật lý. Bạn kích hoạt và quản lý thiết bị trong App, hồ sơ đơn hàng và thiết bị luôn sẵn sàng tra cứu.'),
        warrantyContent:localized(locale,'设备故障、更换或重新配置、退款均按下单时的服务条款处理。遇到问题时，在 App 内联系专属客服并提供订单号，处理进度全程可查。','Faults, replacements or reconfiguration and refunds follow the service terms agreed when you ordered. Contact your dedicated advisor in the App with the order number and follow progress at every step.','Sự cố thiết bị, thay thế hoặc cấu hình lại và hoàn tiền được xử lý theo điều khoản dịch vụ khi đặt hàng. Khi cần hỗ trợ, hãy liên hệ chuyên viên riêng trong App kèm mã đơn hàng và theo dõi tiến độ xử lý.'),
        securityContent:localized(locale,'参与算力任务无需提供钱包私钥或助记词。登录、修改收款地址、提现等重要操作都需要身份确认并留有操作记录；处理中、锁定与可用资金分开显示。','Taking part in compute tasks never requires your wallet private key or recovery phrase. Sign-in, receiving-address changes and withdrawals all require identity confirmation and are recorded; funds in progress, locked and available are shown separately.','Tham gia tác vụ điện toán không bao giờ yêu cầu khóa riêng tư hay cụm từ khôi phục ví. Đăng nhập, thay đổi địa chỉ nhận và rút tiền đều cần xác minh danh tính và được ghi nhật ký; số tiền đang xử lý, bị khóa và khả dụng được hiển thị riêng.')},
      complianceBadges:{badge1Label:localized(locale,'合规资料示例','Compliance sample','Mẫu tuân thủ'),badge1Body:exampleFor(locale)},
      auditsReserves:{homepageProof:localized(locale,'原型审计资料','Prototype audit sample','Tài liệu kiểm toán mẫu')},
      listings:{overview:exampleFor(locale)}});
    const languages=['zh','vi','en'];
    const maps=languages.map(code=>mapsFor(code));
    const keys=empty||state.trustSectionsState==='none'?[]:Object.keys(maps[0]).filter(key=>
      state.trustSectionsState==='missing-narrative'?key!=='nexNarrative':
      state.trustSectionsState==='missing-audits'?key!=='auditsReserves':
      state.trustSectionsState==='leadership'?key==='leadership':true);
    return {...authority,source:'nx_trust_section_version:published',sections:keys.map(sectionKey=>({
      sectionKey,version:'v1',description:exampleFor(locale),structure:'Published resources',
      fields:Object.keys(maps[0][sectionKey]).flatMap(key=>key.endsWith('Url')?
        [{key,label:key,value:maps[0][sectionKey][key]}]:
        languages.map((code,index)=>({key:`${key}.${code}`,label:key,
          // Production withholds these section claims and audit fields without a safe document1Url.
          value:['financials','complianceBadges','listings','auditsReserves'].includes(sectionKey)?'':maps[index][sectionKey][key]})))
    }))};
  }
  if(pathname==='/api/promotion-rewards'||/^\/api\/promotion-rewards\/demo-reward-\d+$/.test(pathname)){
    // This sample order keeps the original gift even when the live offer is set to an order discount.
    const {orderNo,activityId,obligationId}=demoPromotionGift;
    const order=demoAccountOrders(url,locale,state,now).find(row=>row.orderNo===orderNo);
    const items=[];
    if(!empty&&order){
      const offer=state.promotionGiftVersion??={activityId,version:1,startsAt:new Date(order.placedAt-day).toISOString(),
        endsAt:new Date(order.paidAt+day).toISOString(),ruleId:'demo-rule-0',
        buyerReward:promotionDeviceReward(products.find(product=>product.id===demoPromotionGift.productNo).name)};
      const {ruleId,buyerReward:{disclosure,...reward}}=offer;
      const gift=state.promotionGift;
      const selectedState=state.promotionRewardState??demoDefaults.promotionRewardState;
      const status=gift?'ISSUED':selectedState==='ISSUED'?demoDefaults.promotionRewardState:selectedState;
      const updatedAt=new Date(state.promotionRewardAt??Math.min(order.paidAt+day,now)).toISOString();
      items.push({obligationId,orderNo,activityId,version:offer.version,orderLineId:'demo-line-0',ruleId,rewardRuleId:reward.rewardRuleId,
        unitSeq:0,updatedAt,reward,disclosure,refundHold:false,beneficiaryRole:'BUYER',state:status,refundRequestIds:[],
        assetReceipt:gift?{deviceIds:gift.deviceIds,instanceNos:gift.instances,source:'PROMOTION_GIFT',
          issuedAt:new Date(gift.at).toISOString(),ledgerBizNo:null,earningsEntryNo:null}:null});
    }
    if(pathname!=='/api/promotion-rewards')return items.find(r=>r.obligationId===pathname.split('/').pop())||{};
    return {items:items.filter(r=>['state','activityId','orderNo'].every(key=>!url.searchParams.get(key)||r[key]===url.searchParams.get(key))),nextCursor:null,hasMore:false};
  }
  if(/^\/api\/promotions\/demo-promo-\d+\/referral-progress$/.test(pathname))return {activityId:pathname.split('/')[3],qualifyingOrders:2,ownRewards:[],serverTime:iso};
  if(pathname==='/api/app/security/phone-number')return {windowDays:30,maxChanges:2,usedChanges:0,remainingChanges:2,nextAvailableAt:iso};
  const contentLocale=url.searchParams.get('locale')?.trim().toLowerCase().split('-')[0] || 'en';
  if(pathname==='/api/quests/state') {
    const data=reviewFixture(url,contentLocale,{...state,taskState:state.dayOneClaimed?'claimed':state.taskState},request);
    if(empty) return {...data,quests:[],dayOneRequiredTaskCount:0,dayOneSnapshotStatus:'EMPTY'};
    const routes=['/pages/me/devices','/pages/store/store','/pages/earn/earn','/pages/learn/courses','/pages/me/profile','/pages/team/team'];
    data.quests.forEach((row,i)=>{row.actionRoute=routes[i];row.category=['identity','explore','explore','explore','identity','social'][i];});
    const weekNames=localized(contentLocale,['了解设备收益','完成一门课程','邀请一位好友','查看账户安全'],['Explore device earnings','Complete one course','Invite a friend','Review account security'],['Tìm hiểu thu nhập','Hoàn thành một bài học','Mời một người bạn','Kiểm tra bảo mật']);
    if(state.taskState!=='empty') data.quests.push(...weekNames.map((name,i)=>({questCode:'demo-week-'+i,name,layer:i===0?'WEEKLY_T1':'WEEKLY_T2',rewardNex:100+i*25,status:state.weekClaims?.includes(i)?'CLAIMED':state.taskState==='complete'?'CLAIMABLE':state.taskState==='claimed'?'CLAIMED':state.taskState==='expired'?'EXPIRED':i===1?'CLAIMABLE':'PENDING',category:i===2?'social':'explore',actionRoute:['/pages/earn/earn','/pages/learn/courses','/pages/team/team','/pages/me/profile'][i],instanceKey:'WEEK:demo',eligibleFrom:new Date(now-day).toISOString(),eligibleUntil:new Date(now+(state.taskState==='expired'?-1000:5*day)).toISOString(),eligible:!['claimed','expired'].includes(state.taskState)&&!state.weekClaims?.includes(i)})));
    data.promoBanner={bannerCode:'demo-weekly',baseReward:300,multiplier:1,countdownDays:5,countdownHours:0,targetDevice:'UVELBox Pro',targetDaily:22.4,status:'active'};
    return data;
  }
  const questClaim=pathname.match(/^\/api\/quests\/([^/]+)\/claim$/);
  if(questClaim){const code=decodeURIComponent(questClaim[1]);if(code.startsWith('demo-week-')){state.weekClaims||=[];state.weekClaims.push(Number(code.split('-').pop()));}else state.dayOneClaimed=true;return {...authority,questId:code,rewardNex:code.startsWith('demo-week-')?100+Number(code.split('-').pop())*25:500,status:'CLAIMED',instanceKey:code.startsWith('demo-week-')?'WEEK:demo':'DAY_ONE:design-review'};}
  if(pathname==='/api/events'||pathname.startsWith('/api/events/')){
    const spinTickets=demoStreakMilestones.reduce((count,[,type,amount],index)=>
      count+(type==='SPIN'&&demoMilestoneClaimed(state,index+1)?amount:0),0);
    const cardGrantBefore=state.streakSaverBalance==null?0:demoH4Savers(state);
    const eventResponse=demoH4EventResponse(url,contentLocale,state,request,now,{
      fleet:()=>demoFleetFacts(url,locale,state),
      promotion:id=>demoFixture(new URL('/api/promotions/'+id,url.origin),locale,state,request),
      products,spinTickets,
    });
    if(eventResponse!==undefined){
      if(state.streakSaverBalance!=null)state.streakSaverBalance+=demoH4Savers(state)-cardGrantBefore;
      if(request.method()==='POST'&&/\/(claim|spin)$/.test(pathname))postDemoActivityRewards(state,now);
      return eventResponse;
    }
  }
  if(pathname==='/api/points/state') {
    const data=base();
    data.serverDate=demoTeamBusinessDate(now);
    data.nextResetAtUtc=new Date(Date.parse(data.serverDate)+day-7*3600000).toISOString();
    const {badgeUnlockedAt,...streak}=demoStreakFacts(state,now);
    data.streak=streak;
    const unlocked=state.taskState==='claimed'||state.taskState==='complete';
    // Mirrors the backend seeds (nx_growth_checkin_rule / nx_streak_milestone / nx_streak_power_up); day 3 is already claimed in the 12-day scenario.
    data.rules=[['baseline','1'],['bonus7','5'],['luckyMultiplierMax','2'],['p15','15'],['p2','5'],['broken','48'],['revive','1']].map(([key,value])=>({key,value}));
    data.dailyMilestones=demoStreakMilestones.map(([milestoneDay,rewardType,rewardAmount,badgeCode],i)=>({milestoneId:i+1,milestoneDay,rewardType,rewardAmount,badgeCode,status:demoMilestoneClaimed(state,i+1)?'CLAIMED':data.streak.currentStreak>=milestoneDay?'CLAIMABLE':'LOCKED'}));
    // Growth milestones count posted earning events. Wallet-only credits can still appear on proof.
    const lifetimeEarningsUsdt=Number(settledTasks().filter(task=>task.postedAt<=now)
      .reduce((sum,task)=>sum+task.amount,0).toFixed(6));
    data.earningMilestones=[10,100,1000].map((thresholdUsdt,i)=>{
      const milestoneId='demo-earning-'+i,bizNo='EARNING-MS:900001:'+milestoneId;
      const achieved=state.walletMovements?.find(row=>row.bizNo===bizNo);
      const historical=state.walletLegacySeed&&!empty&&(i===0||i===1&&state.earningClaimed);
      return {milestoneId,thresholdUsdt,rewardNex:thresholdUsdt,lifetimeEarningsUsdt,
        status:achieved||historical?'FIRED':lifetimeEarningsUsdt>=thresholdUsdt?'CLAIMABLE':'LOCKED',
        achievedAt:achieved?new Date(achieved.at).toISOString():historical?new Date(state.previewFactsAt).toISOString():null};
    });
    if(empty)return data;
    const badgeLocale=(url.searchParams.get('locale')||request.headers?.()['x-preview-locale']||locale).trim().toLowerCase().split('-')[0];
    const names=localized(badgeLocale,['首次签到','连续签到一周','第一台设备','学习达人','邀请伙伴','算力新星'],['First check-in','One-week streak','First device','Dedicated learner','Invite a partner','Compute rising star'],['Điểm danh đầu tiên','Chuỗi một tuần','Thiết bị đầu tiên','Người học giỏi','Mời bạn bè','Ngôi sao tính toán']);
    data.badgeAchievements=names.map((name,i)=>{
      const unlockedAt=i<2?badgeUnlockedAt[i]:unlocked?now:null;
      return {achievementCode:'demo-achievement-'+i,name,description:name,category:['STREAK','STREAK','EARNING','LEARNING','SOCIAL','EARNING'][i],
        iconKey:['flame','calendar','cpu','book','users','zap'][i],accentColor:['#9EDC1D','#B47FFF','#FFCB4D'][i%3],
        rewardPoints:50*(i+1),status:unlockedAt===null?'LOCKED':'UNLOCKED',
        unlockedAt:unlockedAt===null?null:new Date(unlockedAt).toISOString()};
    });
    // Route badges keep the seeded Chinese name (the App localizes them); the check-in boost is the B17 multiplier.
    data.powerUps=[[1,'ROYALTY_BOOST','团队成长徽章','/team',7,'ROUTE_BADGE','连续签到 7 天可查看团队成长权益',null],[2,'STREAK_BADGE','连续签到徽章','/me/rewards',14,'ROUTE_BADGE','连续签到 14 天解锁专属徽章',null],[3,'CHECKIN_BOOST',localized(badgeLocale,'签到加成','Check-in boost','Thưởng điểm danh'),'/daily',30,'CHECKIN_MULTIPLIER','1.5',null],[4,'GENESIS_ALLOWLIST','Genesis 资格入口','/market/genesis',60,'ROUTE_BADGE','连续签到 60 天解锁 Genesis 资格入口',true],
      ...(state.powerUpState==='staking'?[[5,'STAKING_APY','质押活动入口','/wallet/staking',21,'ROUTE_BADGE','连续签到 21 天解锁质押活动入口',true]]:[])]
      .map(([powerUpId,powerUpCode,name,targetPath,unlockStreakDays,effectType,effectValue,businessAvailable])=>({powerUpId,powerUpCode,name,unlockStreakDays,targetPath,effectType,effectValue,status:state.powerUps?.includes(powerUpId)?'ACTIVATED':data.streak.currentStreak>=unlockStreakDays?'AVAILABLE':'LOCKED',businessAvailable}));
    data.topStreakers=[{name:'Daniel_K',countryCode:'US',streak:412},{name:'Mei_C',countryCode:'SG',streak:387},{name:'Lukas_F',countryCode:'DE',streak:341},{name:'Carlos_M',countryCode:'BR',streak:298},{name:'Priya_S',countryCode:'IN',streak:256}];
    return data;
  }
  if(milestoneClaim&&request.method()==='POST'){
    const id=Number(milestoneClaim[1]);
    if(id<=0)throw Object.assign(new Error('MILESTONE_ID_REQUIRED'),{status:422});
    const key=commandKey?.trim();
    if(!key)throw Object.assign(new Error('IDEMPOTENCY_KEY_REQUIRED'),{status:422});
    if(key.length>128)throw Object.assign(new Error('IDEMPOTENCY_KEY_INVALID'),{status:422});
    const previous=state.milestoneClaimReceipts?.find(receipt=>receipt.key===key);
    if(previous){
      if((previous.result?.milestoneId??previous.milestoneId)!==id)refuse('IDEMPOTENCY_KEY_CONFLICT');
      if(previous.error)refuse(previous.error);
      return previous.result;
    }
    const milestone=read('/api/points/state').dailyMilestones?.find(row=>row.milestoneId===id);
    if(milestone?.status!=='CLAIMABLE'){
      const error='DAILY_MILESTONE_NOT_CLAIMABLE';
      (state.milestoneClaimReceipts??=[]).push({key,milestoneId:id,error});
      refuse(error);
    }
    const {milestoneDay,rewardType,rewardAmount,badgeCode}=milestone;
    const result={...authority,milestoneId:id,milestoneDay,rewardType,rewardAmount,badgeCode,spinTickets:rewardType==='SPIN'?rewardAmount:0};
    if(['USDT','UVT'].includes(rewardType)){
      postDemoWalletEntries(state,{bizNo:`DAILY-MS:900001:${id}`,bizType:'DAILY_MILESTONE',
        asset:rewardType,direction:'IN',amount:rewardAmount,at:now,category:'achievement',remark:'H5 daily milestone claim'});
    }
    (state.milestoneClaimReceipts??=[]).push({key,at:now,result});
    return result;
  }
  const powerUpActivate=pathname.match(/^\/api\/points\/power-ups\/([1-4])\/activate$/);
  if(powerUpActivate){
    const id=Number(powerUpActivate[1]),powerUp=read('/api/points/state').powerUps?.find(row=>row.powerUpId===id);
    if(!powerUp||powerUp.status==='LOCKED')refuse('DAILY_POWER_UP_NOT_UNLOCKED');
    if(powerUp.status==='AVAILABLE')(state.powerUps??=[]).push(id);
    return {...authority,powerUpId:id,powerUpCode:['ROYALTY_BOOST','STREAK_BADGE','CHECKIN_BOOST','GENESIS_ALLOWLIST'][id-1],badgeCode:null,status:'ACTIVATED'};}
  if(pathname==='/api/points/sign-in'){
    const checkInDate=demoTeamBusinessDate(now),key=commandKey?.trim(),bizNo='DAILY:900001:'+checkInDate;
    if(!key)throw Object.assign(new Error('IDEMPOTENCY_KEY_REQUIRED'),{status:422});
    const previous=state.walletMovements?.find(row=>row.bizType==='DAILY_CHECK_IN'&&row.commandKey===key);
    if(previous){
      if(previous.bizNo!==bizNo)refuse('IDEMPOTENCY_KEY_CONFLICT');
      const {longestStreak,eventBonusNex,...receipt}=previous.detail;
      return receipt;
    }
    const streak=demoStreakFacts(state,now);
    if(streak.checkedInToday||state.walletMovements?.some(row=>row.bizNo===bizNo))refuse('DAILY_ALREADY_CLAIMED');
    const streakDays=streak.currentStreak+1,streakBonusNex=streakDays%7===0?5:0;
    if(streakDays===1&&streak.lastCheckInDate&&state.powerUps)state.powerUps=state.powerUps.filter(id=>id!==3);
    const powerUpMultiplier=state.powerUps?.includes(3)?1.5:1;
    const baseReward=Math.floor((1+streakBonusNex)*powerUpMultiplier);
    const eventBonusNex=demoH4CheckInBonus(state,now,baseReward);
    const result={...authority,checkInDate,baseNex:1,rewardNex:baseReward+eventBonusNex,streakBonusNex,multiplier:1,streakDays};
    postDemoWalletEntries(state,{bizType:'DAILY_CHECK_IN',bizNo,asset:'UVT',direction:'IN',amount:result.rewardNex,
      at:now,category:'bonus',commandKey:key,detail:{...result,eventBonusNex,longestStreak:Math.max(streakDays,streak.longestStreak)}});
    return result;
  }
  if(pathname==='/api/points/streak-saver/use'){
    const streak=demoStreakFacts(state,now);
    if(!streak.streakSavers)refuse('DAILY_STREAK_SAVER_EMPTY');
    if(!streak.lastCheckInDate||streak.currentStreak>0||streak.checkedInToday)refuse('DAILY_STREAK_NOT_BROKEN');
    state.saverUsed=true;state.saverUsedAt=now;
    const result={...authority,restoredStreak:Math.max(1,Math.min(30,streak.longestStreak)),
      streakSavers:streak.streakSavers-1,effectiveLastCheckInDate:demoTeamBusinessDate(now-day)};
    state.saverRestoredStreak=result.restoredStreak;
    if(state.streakSaverBalance!=null)state.streakSaverBalance=result.streakSavers;
    return remember('streakSaver',result.effectiveLastCheckInDate,result,null);
  }
  if(pathname==='/api/earnings/milestones/evaluate'){
    const {milestoneId}=request.postDataJSON();
    const milestone=read('/api/points/state').earningMilestones.find(row=>
      row.status==='CLAIMABLE'&&(!milestoneId||row.milestoneId===milestoneId));
    if(milestoneId&&!milestone)refuse('EARNING_MILESTONE_NOT_CLAIMABLE');
    if(!milestone)return {...authority,fired:[],count:0};
    const {milestoneId:id,rewardNex,thresholdUsdt:thresholdUsd,lifetimeEarningsUsdt:lifetimeEarningsUsd}=milestone;
    postDemoWalletEntries(state,{bizNo:'EARNING-MS:900001:'+id,bizType:'EARNING_MILESTONE',asset:'UVT',
      direction:'IN',amount:rewardNex,at:now,category:'achievement'});
    return remember('earningMilestone',id,{...authority,fired:[{milestoneId:id,thresholdUsd,rewardNex,lifetimeEarningsUsd}],count:1},null);
  }
  if(pathname==='/api/app/security') return {twoFactorEnabled:true,passwordChangedAt:iso,sessions:[{id:'demo-session',deviceName:'iPhone · Safari',ipMasked:'192.0.2.*',lastActiveAt:iso,current:true}],nextCursor:null};
  if(pathname==='/api/app/referral-rewards'){
    if(state.accountDeletionState==='read-error')throw Object.assign(new Error('DEMO_BALANCE_READ_UNAVAILABLE'),{status:503});
    const limit=Math.max(1,Math.min(20,Math.trunc(Number(url.searchParams.get('limit')??10))||10));
    return {...referralFacts(limit),walletNexAvailable:demoWalletNex(state,now),limit,
      source:'ledger',sourceEnvironment:'PRODUCTION',runId:null,
      factSources:['nx_referral_reward_settlement','nx_wallet_ledger','nx_earnings_release_entry','nx_user_wallet'],refreshedAt:iso};
  }
  if(pathname==='/api/app/team/network') {
    const members=demoTeamNetworkMembers(state,now);
    return {...authority,source:'server',generatedAt:iso,totalMembers:members.length,directMembers:members.filter(member=>member.layer===1).length,activeMembers:members.filter(member=>member.status==='ACTIVE').length,monthComputePoints:members.reduce((sum,m)=>sum+m.monthComputePoints,0),lifetimeComputePoints:members.reduce((sum,m)=>sum+m.lifetimeComputePoints,0),members,nextCursor:null};
  }
  if(pathname==='/api/devices/earnings') {
    const facts=demoFleetFacts(url,locale,state);
    const active=facts.devices.filter(device=>device.activatedAt!==null);
    if(state.accountDeletionState==='read-error')throw Object.assign(new Error('DEMO_BALANCE_READ_UNAVAILABLE'),{status:503});
    const data=base();data.walletUsdt=demoWalletUsdt(state);data.walletNex=demoWalletNex(state,now);data.userJoinedAt=demoH4Account(state).createdAt;
    data.dailyUsdt=active.reduce((sum,device)=>sum+device.dailyUsdt,0);data.dailyNex=active.reduce((sum,device)=>sum+device.dailyNex,0);
    data.realizedTodayUsdt=Number(facts.devices.reduce((sum,device)=>sum+(device.todayEarningsUsdt??0),0).toFixed(6));
    data.realizedTodayNex=Number(facts.devices.reduce((sum,device)=>sum+(device.todayEarningsNex??0),0).toFixed(6));
    Object.assign(data,facts);
    return data;
  }
  if(pathname==='/api/app/wallet/bills'||pathname==='/api/app/wallet/bills/summary') {
    const bills=walletBills();
    return pathname.endsWith('/summary')?demoWalletBillSummary(bills,now):demoWalletBillList(bills,url.searchParams);
  }
  if(pathname==='/api/vouchers') {
    const data=structuredClone(reviewFixture(url,locale,{...state,offers:!empty&&!state.voucherUsed&&state.benefitState!=='finished'},request));
    data.vouchers=data.vouchers.map(v=>({...v,voucherName:localized(locale,'设备代金券','Device voucher','Phiếu giảm giá thiết bị')}));
    const designGrant=demoVoucherGrant(state,'V-DESIGN',now);
    if(designGrant)data.vouchers=data.vouchers.map(v=>({...v,...designGrant,claimable:false}));
    const wheelGrant=demoVoucherGrant(state,wheelVoucherId,now);
    if(wheelGrant){
      const template=reviewFixture(url,locale,{offers:true},request).vouchers[0];
      data.vouchers.push({...template,...wheelGrant,voucherId:wheelVoucherId,voucherName:'Lucky Spin $50 Device Coupon',
        claimSurfaces:'[]',claimable:false});
    }
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
