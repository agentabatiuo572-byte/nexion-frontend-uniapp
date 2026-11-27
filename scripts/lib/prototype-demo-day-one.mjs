import { demoH4Account } from './prototype-demo-events.mjs';
import { postDemoWalletEntries } from './prototype-demo-wallet.mjs';

const hour = 3600000;
const day = 24 * hour;
const newAccountModes = new Set([
  'pending', 'complete', 'claimed', 'route-unparseable', 'actionable-long', 'lite-filtered', 'web-complete',
]);
const authority = { sourceEnvironment: 'PRODUCTION', runId: '', serverCanonical: true };
const tasks = [
  ['bind_bank_card', 'wallet', '/pages/me/wallet-cards-new', '绑定银行卡', 'Link a bank card', 'Liên kết thẻ ngân hàng'],
  ['visit_store', 'explore', '/pages/store/store', '浏览商城', 'Visit the store', 'Khám phá cửa hàng'],
  ['visit_earn', 'explore', '/pages/earn/earn', '了解收益', 'Explore earnings', 'Tìm hiểu thu nhập'],
  ['view_product_roi', 'recommend', '/pages/store/detail?id=stellarbox-s1', '查看 S1 回本', 'View S1 ROI', 'Xem ROI của S1'],
  ['setup_profile', 'identity', '/pages/me/profile', '完善账户资料', 'Complete your profile', 'Hoàn tất hồ sơ'],
  ['invite_friend', 'social', '/pages/team/team', '邀请好友', 'Invite a friend', 'Mời bạn bè'],
];
const storeTask = tasks[1];
const connectPhoneTask = ['connect_phone', 'explore', '/pages/onboarding/connect', '连接手机', 'Connect a phone', 'Kết nối điện thoại'];
const webCompleteTasks = [
  ['bind_mobile', 'identity', '/pages/me/profile', '绑定手机号', 'Bind mobile number', 'Liên kết số điện thoại'],
  storeTask,
];
const mixedTasks = [
  ...tasks,
  connectPhoneTask,
  ['activate_phone', 'explore', '/pages/me/devices', '激活手机', 'Activate a phone', 'Kích hoạt điện thoại'],
  ['day_one_staking', 'explore', '/pages/staking/staking', '了解质押', 'Explore staking', 'Tìm hiểu staking'],
];
const localized = (locale, zh, en, vi) => locale === 'zh' ? zh : locale === 'vi' ? vi : en;
const longRoiName = [
  '查看设备详情中的预计每日收益，了解这台算力设备的运行收益及回本周期',
  'Open the device details to see estimated daily earnings and the payback period for this device',
  'Mở chi tiết thiết bị để xem thu nhập ước tính mỗi ngày và thời gian hoàn vốn',
];

export function selectDemoDayOneAccount(state, now) {
  delete state.dayOnePreviewCreatedAt;
  const useSkuTasks = state.taskState === 'pending' && state.catalogState === 'sku-series';
  state.dayOnePreviewSkuTarget = useSkuTasks ? state.dayOneTargetState : null;
  // Open presets use an explicit account scene within a valid 720-hour window.
  // The ordinary account and its existing registration date stay intact.
  if (newAccountModes.has(state.taskState) || (state.taskState === 'account' && state.scopeState === 'mixed')) {
    state.dayOnePreviewCreatedAt = now - 28 * day;
  }
}

function dayOneWindow(state, now) {
  const { createdAt } = demoH4Account(state, now);
  const eligibleUntil = createdAt + (state.dayOnePreviewCreatedAt == null ? 72 : 720) * hour;
  // Match the timestamp-based instance key in the backend's default storage timezone.
  const keyTime = new Date(createdAt + 8 * hour).toISOString().slice(0, 19).replace(/[-:]/g, '');
  return { createdAt, eligibleUntil, instanceKey: 'DAY_ONE:' + keyTime };
}

function windowReward(window, now) {
  if (now >= window.eligibleUntil) return 0;
  return now < window.createdAt + day ? 30 : 10;
}

function claimBizNo(accountId, instanceKey) {
  return 'QUEST:DAY_ONE:' + accountId + ':' + instanceKey;
}

function dayOneClaimEntry(state, accountId, instanceKey) {
  return state.walletMovements?.find(entry => entry.bizNo === claimBizNo(accountId, instanceKey));
}

function postDayOneReward(state, accountId, window, at) {
  postDemoWalletEntries(state, {
    bizNo: claimBizNo(accountId, window.instanceKey), bizType: 'QUEST_REWARD', asset: 'UVT',
    direction: 'IN', amount: windowReward(window, at), at, category: 'achievement',
  });
}

export function seedDemoDayOneClaim(state, accountId, now) {
  if (state.taskState !== 'claimed' || !accountId || state.dataState === 'empty') return;
  const window = dayOneWindow(state, now);
  if (!dayOneClaimEntry(state, accountId, window.instanceKey)) {
    postDayOneReward(state, accountId, window, window.createdAt + 2 * hour);
  }
}

export function demoDayOneSnapshot(state, accountId, now, locale, skuTargets) {
  const mode = state.taskState;
  const empty = mode === 'empty' || state.dataState === 'empty';
  const legacy = !empty && mode === 'legacy';
  const window = empty || legacy ? null : dayOneWindow(state, now);
  const eligible = window !== null && now < window.eligibleUntil;
  const claimed = window !== null && Boolean(dayOneClaimEntry(state, accountId, window.instanceKey));
  const observation = window && state.dayOneObservedRoi?.[accountId]?.[window.instanceKey];

  const members = mode === 'web-complete' ? webCompleteTasks
    : mode === 'lite-filtered' ? [storeTask, connectPhoneTask]
    : state.scopeState === 'mixed' ? mixedTasks : tasks;
  const quests = window ? members.map(([questCode, category, route, zh, en, vi], index) => {
    let name = localized(locale, zh, en, vi);
    let actionRoute = route;
    let completed = mode === 'lite-filtered' ? index === 0 : index < 3;
    if (questCode === 'bind_bank_card' && mode === 'route-unparseable') {
      // This older App route was nonempty and may survive in a frozen instance.
      actionRoute = '/pages/me/wallet-cards';
      completed = false;
    }
    if (questCode === 'view_product_roi') {
      if (skuTargets) actionRoute = '/pages/store/detail?id=' + skuTargets.roi;
      if (mode === 'expired-long' || mode === 'actionable-long') name = localized(locale, ...longRoiName);
      completed = Boolean(observation);
    }
    if (questCode === 'setup_profile' && skuTargets) {
      actionRoute = '/pages/store/detail?id=' + skuTargets.other;
      name = localized(locale, '查看另一件设备', 'View another device', 'Xem thiết bị khác');
    }
    const status = claimed ? 'CLAIMED' : !eligible ? 'EXPIRED'
      : mode === 'complete' || (mode === 'web-complete' && index === 1) ? 'CLAIMABLE'
      : completed ? 'COMPLETED' : 'PENDING';
    return {
      questCode, name, layer: 'DAY_ONE', rewardNex: 0, status, category, actionRoute,
      instanceKey: window.instanceKey, eligibleFrom: new Date(window.createdAt).toISOString(),
      eligibleUntil: new Date(window.eligibleUntil).toISOString(), eligible,
    };
  }) : [];

  return {
    ...authority, quests, dayOneRewardNex: window ? windowReward(window, now) : 0,
    dayOneRequiredTaskCount: legacy ? null : quests.length,
    dayOneSnapshotStatus: legacy ? 'LEGACY_UNVERIFIED' : empty ? 'EMPTY' : 'SNAPSHOT',
    promoBanner: null, questBonusMultiplier: 1, rhythmMonth: 1,
    source: 'nx_mission + nx_user_mission + nx_growth_day_one_instance + nx_growth_day_one_instance_item',
  };
}

function reject(status, reason) {
  throw Object.assign(new Error(reason), { status });
}

export function claimDemoDayOne(state, accountId, now, questCode, instanceKey, idempotencyKey, snapshot) {
  if (!accountId) reject(401, 'AUTH_REQUIRED');
  if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) reject(422, 'QUEST_IDEMPOTENCY_KEY_REQUIRED');
  const window = dayOneWindow(state, now);
  if (instanceKey !== window.instanceKey) reject(409, 'QUEST_INSTANCE_MISMATCH');
  if (!snapshot.quests.some(task => task.questCode === questCode)) reject(409, 'DAY_ONE_SNAPSHOT_MEMBER_NOT_FOUND');
  const previousClaim = dayOneClaimEntry(state, accountId, instanceKey);
  // The preview uses the existing account ledger as the single receipt for the group.
  if (previousClaim?.idempotencyKey === idempotencyKey && previousClaim.questCode === questCode) {
    return { ...authority, questId: questCode, rewardNex: previousClaim.amount, status: 'CLAIMED', instanceKey };
  }
  if (now >= window.eligibleUntil) reject(409, 'QUEST_EXPIRED');
  if (previousClaim || !snapshot.quests.every(task => task.eligible && ['COMPLETED', 'CLAIMABLE'].includes(task.status)))
    reject(409, 'DAY_ONE_GROUP_NOT_CLAIMABLE');
  postDayOneReward(state, accountId, window, now);
  Object.assign(state.walletMovements.at(-1), { idempotencyKey, questCode });
  return { ...authority, questId: questCode, rewardNex: windowReward(window, now), status: 'CLAIMED', instanceKey };
}
