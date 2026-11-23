import { createHash } from 'node:crypto';
import { previewCapacity } from './design-review-fixture.mjs';

const s1 = 'STELLARBOX-S1', pro = 'STELLARBOX-PRO', rack = 'STELLARRACK-P1';
const minute = 60_000, day = 24 * 60 * minute, storageOffset = 8 * 60 * minute;
const earningSamples = [
  { id: 1001, sku: s1, taskClass: 'SP', minutesAgo: 90, actionMissing: true, read: true },
  { id: 1002, sku: s1, taskClass: 'IG', minutesAgo: 80, receiptStatus: 404 },
  { id: 1003, sku: s1, taskClass: 'FT', minutesAgo: 70, receiptFailures: 2 },
  { id: 1004, sku: s1, taskClass: 'SP', minutesAgo: 53, hideMetadata: true, read: true },
  { id: 1005, sku: s1, taskClass: 'EM', minutesAgo: 48, modelRate: [0.0025, 0.002708], durationSec: 5, read: true },
  { id: 1006, sku: pro, taskClass: 'LL', minutesAgo: 29 },
  { id: 1007, sku: s1, taskClass: 'VG', minutesAgo: 16, modelRate: [1, 1.1], durationSec: 900 },
  { id: 1008, sku: s1, taskClass: 'IG', minutesAgo: 3 },
  { id: 1009, sku: rack, taskClass: 'VG', minutesAgo: 1 },
  { id: 1010, sku: pro, taskClass: 'LL', minutesAgo: 0 },
];
const taskNames = { IG: 'Image Generation', VG: 'Video Generation', LL: 'LLM Inference',
  EM: 'Embedding', SP: 'Speech Processing', FT: 'Fine-tuning' };
const roundReward = amount => Number(amount.toFixed(6));

// Monthly pacing uses purchase anniversaries in the storage zone, with days clamped at month end.
function purchaseCycle(device, completedAt) {
  const anchor = new Date(device.purchasedAt + storageOffset);
  const completed = new Date(completedAt + storageOffset);
  const month = index => {
    const anniversary = new Date(anchor);
    anniversary.setUTCDate(1);
    anniversary.setUTCMonth(anchor.getUTCMonth() + index);
    const days = new Date(Date.UTC(anniversary.getUTCFullYear(), anniversary.getUTCMonth() + 1, 0)).getUTCDate();
    anniversary.setUTCDate(Math.min(anchor.getUTCDate(), days));
    return anniversary.getTime() - storageOffset;
  };
  let index = (completed.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + completed.getUTCMonth() - anchor.getUTCMonth();
  if (month(index) > completedAt) index--;
  return { start: month(index), seconds: (month(index + 1) - month(index)) / 1000 };
}

export function demoEarningReceipts(state) {
  if (state.fleetState !== 'earning-credit' || state.dataState === 'empty' || state.accountDeletionState === 'clear') return [];
  const midnightUtc = Math.floor(state.previewFactsAt / day) * day;
  // Keep the fixture's sequence on one UTC date, even when the preview starts just after midnight.
  const anchor = state.previewFactsAt - midnightUtc < 92 * minute ? midnightUtc - minute : state.previewFactsAt;
  const dailyCredits = new Set();
  return earningSamples.flatMap(({ sku, modelRate, minutesAgo, durationSec = 300, ...sample }) => {
    const device = state.fleetSeed?.find(row => row.productCode === sku);
    if (!device) return [];
    const { dailyUvt, monthlyUsdt, capacitySchedule } = device.earningPurchase;
    const postedAt = anchor - minutesAgo * minute;
    const completedAt = postedAt - (modelRate ? 0 : minute);
    const startedAt = completedAt - durationSec * 1000;
    const capacity = at => previewCapacity(device, capacitySchedule, at).capacityPct / 100;
    const cycle = purchaseCycle(device, completedAt);
    // Frozen preview pacing quote: equal pool base rate per second, effective pace 0.95
    // (day weight × cycle factor × controller correction), with the nominal inside the allocation band.
    const baseUsdt = modelRate
      ? (modelRate[0] + modelRate[1]) / 2 * capacity(startedAt)
      : monthlyUsdt * capacity(cycle.start) * durationSec * 0.95 / cycle.seconds;
    const rewardUsdt = roundReward(baseUsdt);
    const dailyKey = `CLOUD_SHARE_DAILY:${device.id}:${new Date(completedAt).toISOString().slice(0, 10)}`;
    let rewardNex = 0;
    if (!dailyCredits.has(dailyKey)) {
      rewardNex = roundReward(dailyUvt * capacity(completedAt));
      if (rewardNex > 0) dailyCredits.add(dailyKey);
    }
    return [{ ...sample, device, modelReceipt: Boolean(modelRate), receiptNo: `CTR-DEMO-EARN-${sample.id}`,
      taskNo: `${modelRate ? 'CTA' : 'SIM'}-DEMO-EARN-${sample.id}`, dailyKey, startedAt, completedAt, durationSec,
      rewardUsdt, rewardNex, settledAt: rewardUsdt > 0 || rewardNex > 0 ? postedAt : null }];
  });
}

export function demoEarningCredits(state) {
  return demoEarningReceipts(state).filter(sample => sample.settledAt !== null);
}

export function demoEarningBillRefs(state) {
  return demoEarningCredits(state).flatMap(({ taskNo, dailyKey, rewardUsdt, rewardNex, settledAt }) => [
    ...(rewardUsdt > 0 ? [[taskNo, 'USDT', 'IN', rewardUsdt, 'COMPUTE_TASK_REWARD', 'bonus', settledAt]] : []),
    ...(rewardNex > 0 ? [[dailyKey, 'UVT', 'IN', rewardNex, 'COMPUTE_TASK_REWARD', 'bonus', settledAt]] : []),
  ]);
}

// DTO serialization comes after sorting and hashing the preview's internal epoch values.
export function demoReceiptWire(receipt, state) {
  if (state.fleetState !== 'earning-credit') return receipt;
  const date = at => at == null ? null : new Date(at + storageOffset).toISOString().slice(0, 19).replace('T', ' ');
  return { ...receipt, rewardUsdt: Number(receipt.rewardUsdt), rewardNex: Number(receipt.rewardNex),
    completedAt: date(receipt.completedAt), settledAt: date(receipt.settledAt),
    ...('startedAt' in receipt && { startedAt: date(receipt.startedAt) }) };
}

export function demoEarningReceipt(sample, detail = false) {
  const { device, id, taskNo, taskClass, receiptNo, startedAt, completedAt, settledAt, modelReceipt,
    rewardUsdt, rewardNex, durationSec } = sample;
  const hash = createHash('sha256').update(receiptNo).digest('hex');
  return {
    source: 'server', sourceEnvironment: 'PRODUCTION', runId: '', serverCanonical: true,
    receiptNo, displayReceiptNo: `UVEL-RC-${id.toString(36).toUpperCase().padStart(6, '0')}`,
    taskNo, taskClass, taskId: `demo-earn-${id}`, taskName: taskNames[taskClass],
    model: modelReceipt ? (taskClass === 'EM' ? 'BGE-M3' : 'Wan 2.1') : '', client: 'UVEL',
    deviceId: device.id, deviceInstanceNo: device.instanceNo, deviceName: device.name,
    deviceType: device.deviceType ?? 'BOX', deviceGpu: device.gpuModel ?? '', vramTotalGb: device.vramTotalGb,
    rewardUsdt, rewardNex, earningStatus: 'CREDITED', settledAt, postingTimeVerified: settledAt !== null,
    completedAt, startedAt, durationSec,
    executionMode: modelReceipt ? 'MODEL' : 'SIMULATED', proofKind: modelReceipt ? 'MODEL_EXECUTION' : 'TASK_RECEIPT',
    modelExecuted: modelReceipt, proofHash: modelReceipt ? hash : null,
    ...(detail && { receiptHash: modelReceipt ? null : hash }),
  };
}

// Isolated preview records; routes resolve to the same fixture's orders/devices.
export function demoNotifications(locale, state, now, device, order) {
  // Payment text shows two decimals (decimal HALF_UP), like the App's payment copy; the order keeps full precision.
  const usdt = value => {
    const [whole, fraction = ''] = String(value).split('.');
    const cents = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2)) + (fraction[2] >= '5' ? 1n : 0n);
    return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
  };
  const text = (zh, en, vi) => locale === 'zh' ? zh : locale === 'vi' ? vi : en;
  const at = (days, hour = 12) => {
    if (!days) return now;
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    date.setHours(hour, 0, 0, 0);
    return date.getTime();
  };
  let rows = [
    // fleetState=none has no device to announce.
    ...(device ? [{ id: 901, kind: 'device', title: text('设备已开始运行', 'Device is running', 'Thiết bị đang chạy'),
      body: text(`设备 ${device.instanceNo} 已上线，可查看运行状态与收益。`, `Device ${device.instanceNo} is online. View its status and earnings.`, `Thiết bị ${device.instanceNo} đã trực tuyến. Xem trạng thái và thu nhập.`),
      ctaHref: `/pages/earn/device-detail?id=${encodeURIComponent(device.id)}`, createdAt: at(3) }] : []),
    // Only a paid order of this account is announced.
    ...(order ? [{ id: 902, kind: 'order', title: text('订单支付成功', 'Payment successful', 'Thanh toán thành công'),
      body: text(`订单 ${order.orderNo} 已支付 ${usdt(order.amountUsdt)} USDT，可查看开通进度。`, `Order ${order.orderNo}: ${usdt(order.amountUsdt)} USDT paid. View activation progress.`, `Đơn ${order.orderNo}: đã thanh toán ${usdt(order.amountUsdt)} USDT. Xem tiến độ kích hoạt.`),
      ctaHref: `/pages/store/order-detail?id=${encodeURIComponent(order.orderNo)}`, createdAt: at(2) }] : []),
    { id: 903, kind: 'reward', title: text('新手任务进度', 'Newcomer tasks', 'Nhiệm vụ thành viên mới'),
      body: text('查看新手任务进度。', 'View newcomer tasks.', 'Xem nhiệm vụ mới.'), ctaHref: '/pages/missions/missions', createdAt: at(1) },
    { id: 904, kind: 'marketing', title: text('设备升级礼', 'Device upgrade offer', 'Ưu đãi nâng cấp'),
      body: text('升级优惠适用于符合活动条件的设备。购买前请查看适用商品、抵扣金额及完整规则。', 'Upgrade offers apply to eligible devices. Review eligible products, discounts and all conditions before purchase.', 'Ưu đãi nâng cấp dành cho thiết bị đủ điều kiện. Xem sản phẩm, mức giảm và đầy đủ điều kiện trước khi mua.'),
      ctaHref: '/pages/store/store', createdAt: at(1, 14) },
    { id: 905, kind: 'system', title: text('服务维护已完成', 'Maintenance complete', 'Bảo trì hoàn tất'),
      body: text('本次服务维护已完成，消息与订单查询已恢复。\n如页面仍显示维护前的内容，请返回后重新打开；尚未完成的操作请先查看当前状态再继续。', 'Maintenance is complete. Messages and order lookups are available again.\nIf a page still shows earlier information, reopen it. Check the current status of unfinished actions before continuing.', 'Bảo trì đã hoàn tất. Tin nhắn và tra cứu đơn hàng đã hoạt động lại.\nNếu trang vẫn hiển thị nội dung cũ, hãy mở lại. Kiểm tra trạng thái thao tác chưa hoàn tất trước khi tiếp tục.'),
      ctaHref: '', createdAt: at(0) },
  ];
  if (state.fleetState === 'earning-credit') {
    const credits = demoEarningCredits(state).map(sample => ({
      id: sample.id, kind: 'earning_credited', priority: 'low',
      title: text('收益到账', 'Earnings credited', 'Đã nhận thu nhập'),
      body: text('查看这笔收益的凭证。', 'View the receipt for these earnings.', 'Xem biên nhận thu nhập này.'),
      ctaHref: `/pages/me/receipts?receiptNo=${sample.receiptNo}`, createdAt: sample.settledAt,
      readAt: sample.read ? sample.settledAt + 60_000 : null,
      earning: { receiptNo: sample.receiptNo, usdt: sample.rewardUsdt > 0 ? String(sample.rewardUsdt) : null,
        uvt: sample.rewardNex > 0 ? String(sample.rewardNex) : null,
        deviceName: sample.hideMetadata ? null : sample.device.name, taskClass: sample.hideMetadata ? null : sample.taskClass },
    }));
    const summary = {
      id: 999, kind: 'NOVA_DAILYSUMMARY', priority: 'low',
      title: text('今日收益总结', 'Today’s earnings summary', 'Tổng kết thu nhập hôm nay'),
      body: text('查看今天的任务和收益进度', 'View today’s tasks and earnings', 'Xem tiến độ nhiệm vụ và thu nhập hôm nay'),
      ctaHref: '/earn', createdAt: state.previewFactsAt - 86_400_000,
      readAt: state.previewFactsAt,
    };
    rows = [...credits, ...rows.filter(row => row.id === 905), summary];
  }
  // Both paging modes use the same older notices so the failed cursor can be retried.
  if (state.notificationPageState === 'paginated' || state.notificationPageState === 'error') {
    const latest = at(4);
    for (let index = 0; index < 100; index += 1) {
      const createdAt = latest - index * 3_600_000;
      rows.push({
        id: 900 - index, kind: 'system',
        title: text(`历史服务公告 ${index + 1}`, `Past service notice ${index + 1}`, `Thông báo dịch vụ trước đây ${index + 1}`),
        body: text('本次例行服务检查已完成。', 'The scheduled service check is complete.', 'Đã hoàn tất kiểm tra dịch vụ định kỳ.'),
        ctaHref: '', createdAt, readAt: createdAt + 60_000,
      });
    }
  }
  return rows.filter(row => !state.clearedNotificationIds?.includes(row.id)).map(row => ({
    ...row, priority: row.priority ?? (row.id === 903 ? 'high' : 'normal'),
    ctaLabel: row.ctaHref ? text('查看详情', 'View details', 'Xem chi tiết') : '',
    readAt: row.readAt ?? (state.read || state.readIds?.includes(row.id) || row.id === 904 || row.id === 905 ? now : null),
  })).sort((a, b) => b.id - a.id);
}


export function demoNotificationPage(rows, params, { includeActionableUnread }) {
  const rawCursor = params.get('cursor')?.trim();
  const cursor = rawCursor ? Number(rawCursor) : null;
  if (cursor !== null && (!/^\d+$/.test(rawCursor) || !Number.isSafeInteger(cursor) || cursor <= 0)) {
    throw Object.assign(new Error('NOTIFICATION_CURSOR_INVALID'), { status: 400 });
  }
  const rawLimit = params.get('limit')?.trim();
  const requestedLimit = rawLimit ? Number(rawLimit) : 30;
  if (rawLimit && (!/^[+-]?\d+$/.test(rawLimit) || requestedLimit < -2_147_483_648 || requestedLimit > 2_147_483_647)) {
    throw Object.assign(new Error('NOTIFICATION_LIMIT_INVALID'), { status: 400 });
  }
  const limit = Math.max(1, Math.min(requestedLimit, 100));
  const category = params.get('category');
  const categories = { order: 'finance', earning_credited: 'finance', device: 'device', NOVA_DAILYSUMMARY: 'device',
    reward: 'rewards', marketing: 'rewards', system: 'system' };
  const remaining = rows.filter(row => (cursor === null || row.id < cursor)
    && (!category || category === 'all' || categories[row.kind] === category));
  const items = remaining.slice(0, limit);
  const unread = rows.filter(row => row.readAt === null);
  return {
    items,
    nextCursor: remaining.length > limit ? String(items.at(-1).id) : null,
    unread: unread.length,
    ...(includeActionableUnread && {
      actionableUnread: unread.filter(row => row.kind !== 'marketing' && row.kind !== 'earning_credited').length,
    }),
  };
}
