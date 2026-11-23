import { createHash } from 'node:crypto';

const earningSamples = [
  { id: 1008, deviceId: 41, taskClass: 'IG', usdt: '0.15', minutesAgo: 3 },
  { id: 1007, deviceId: 43, taskClass: 'VG', usdt: '1.05', uvt: '0.75', minutesAgo: 16 },
  { id: 1006, deviceId: 42, taskClass: 'LL', uvt: '0.5', minutesAgo: 29 },
  { id: 1005, deviceId: 41, taskClass: 'EM', usdt: '0.0025', minutesAgo: 48, read: true },
  { id: 1004, deviceId: 42, taskClass: 'SP', usdt: '0.12', minutesAgo: 60, hideMetadata: true, read: true },
  { id: 1003, deviceId: 43, taskClass: 'FT', usdt: '0.42', minutesAgo: 70, receiptStatus: 503 },
  { id: 1002, deviceId: 41, taskClass: 'IG', usdt: '0.15', minutesAgo: 80, receiptStatus: 404 },
  { id: 1001, deviceId: 42, taskClass: 'SP', usdt: '0.12', minutesAgo: 90, actionMissing: true, read: true },
];

const taskNames = { IG: 'Image Generation', VG: 'Video Generation', LL: 'LLM Inference',
  EM: 'Embedding', SP: 'Speech Processing', FT: 'Fine-tuning' };

export function demoEarningCredits(state) {
  if (state.fleetState !== 'earning-credit' || state.dataState === 'empty') return [];
  return earningSamples.flatMap(sample => {
    const device = state.fleetSeed?.find(row => row.id === sample.deviceId);
    if (!device) return [];
    return [{ ...sample, device, receiptNo: `CTR-DEMO-EARN-${sample.id}`,
      settledAt: state.previewFactsAt - sample.minutesAgo * 60_000 }];
  });
}

export function demoEarningReceipt(sample) {
  const { device, id, taskClass, receiptNo, settledAt } = sample;
  const completedAt = settledAt - 60_000;
  return {
    source: 'server', sourceEnvironment: 'PRODUCTION', runId: '', serverCanonical: true,
    receiptNo, taskNo: `DEMO-EARN-TASK-${id}`, taskClass, taskId: `demo-earn-${id}`,
    taskName: taskNames[taskClass], model: taskNames[taskClass], client: 'UVEL',
    deviceId: device.id, deviceInstanceNo: device.instanceNo, deviceName: device.name,
    deviceType: device.deviceType ?? 'BOX', deviceGpu: device.gpuModel ?? '', vramTotalGb: device.vramTotalGb,
    rewardUsdt: sample.usdt ?? '0', rewardNex: sample.uvt ?? '0',
    earningStatus: 'SETTLED', settledAt, completedAt, startedAt: completedAt - 300_000, durationSec: 300,
    proofHash: createHash('sha256').update(receiptNo).digest('hex'),
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
      earning: { receiptNo: sample.receiptNo, usdt: sample.usdt ?? null, uvt: sample.uvt ?? null,
        deviceName: sample.hideMetadata ? null : sample.device.name, taskClass: sample.hideMetadata ? null : sample.taskClass },
    }));
    const summaries = [999, 998].map((id, index) => ({
      id, kind: 'NOVA_DAILYSUMMARY', priority: 'low',
      title: text('今日收益总结', 'Today’s earnings summary', 'Tổng kết thu nhập hôm nay'),
      body: text('查看今天的任务和收益进度', 'View today’s tasks and earnings', 'Xem tiến độ nhiệm vụ và thu nhập hôm nay'),
      ctaHref: '/earn', createdAt: state.previewFactsAt - (index + 1) * 86_400_000,
      readAt: state.previewFactsAt,
    }));
    rows = [...credits, ...rows.filter(row => row.id === 905), ...summaries];
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


export function demoNotificationPage(rows, params) {
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
    actionableUnread: unread.filter(row => row.kind !== 'marketing' && row.kind !== 'earning_credited').length,
  };
}
