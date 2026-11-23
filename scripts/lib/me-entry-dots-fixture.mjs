import { demoEarningReceipt } from './prototype-demo-notifications.mjs';
import { demoReceiptPage } from './prototype-demo-secondary.mjs';
import { demoTimedOutOrder, paymentWindow } from './prototype-demo-data.mjs';

const sources = {
  '/api/orders': 'orders',
  '/api/quests/state': 'missions',
  '/api/tasks/receipts': 'receipts',
  '/api/devices/earnings': 'inventory',
};
const day = 86_400_000;
const receiptPrefix = 'CTR-DEMO-ME-DOT-';
const inventoryInstance = index => 'ME-DOT-DEVICE-' + (index + 1);

function specimenDevices(template, fixture) {
  return fixture.waves.map((at, index) => ({
    ...template, id: 7110 + index, instanceNo: inventoryInstance(index),
    status: 'ACTIVE', runtimeStatus: 'ONLINE', activatedAt: at - 420_000, purchasedAt: at - 480_000,
    todayEarningsUsdt: 0.15, todayEarningsNex: 0, cumulativeOutputUsdt: 0.15,
    capacityPct: 100, capacityAgeMonths: 0, capacitySubsidized: false,
    capacitySubsidyRemainingDays: 0, capacitySubsidyEndsAt: null,
  }));
}

function specimenOrders(payload, fixture) {
  const template = payload.orders.find(row => row.canonicalStatus === 'cancelled');
  const delivered = payload.orders.find(row => row.canonicalStatus === 'activated');
  const rows = fixture.waves.map((at, index) => ({
    ...delivered, orderNo: 'DEMO-ME-DOT-' + (index + 1), placedAt: at - 600_000,
    paidAt: at - 480_000, activatedAt: at - 420_000, targetDeviceInstanceNo: inventoryInstance(index),
  }));
  if (fixture.payment !== 'none') {
    const placedAt = fixture.paymentPlacedAt;
    const pending = {
      ...template, orderNo: 'DEMO-ME-DOT-PAY', placedAt, expiresAt: placedAt + paymentWindow,
      paymentStatus: 'PENDING', orderStatus: 'PENDING_PAYMENT', activationStatus: 'WAITING_PAYMENT',
      canonicalStatus: 'placed', closeReasonCode: null,
    };
    if (fixture.payment === 'paid') Object.assign(pending, {
      canonicalStatus: 'paid', paymentStatus: 'PAID', orderStatus: 'PAID',
      activationStatus: 'WAITING_PROVISIONING', paidAt: placedAt + paymentWindow - 1000,
      paymentMethod: 'UVEL_WALLET', paidTotalUsdt: String(pending.amountUsdt),
    });
    else if (fixture.payment === 'expired') Object.assign(pending, demoTimedOutOrder);
    else if (fixture.payment === 'failed') Object.assign(pending, {
      canonicalStatus: 'payment_failed', paymentStatus: 'FAILED', orderStatus: 'PAYMENT_FAILED',
      closeReasonCode: 'PAYMENT_NOT_RECEIVED',
    });
    rows.push(pending);
    for (let index = 0; index < fixture.newerOrders; index++) {
      rows.push({ ...template, orderNo: 'DEMO-ME-DOT-HISTORY-' + index, placedAt: placedAt + 1000 * (index + 1) });
    }
  }
  return rows.sort((left, right) => right.placedAt - left.placedAt);
}

function specimenQuests(payload, fixture) {
  const template = payload.quests.find(row => row.layer === 'WEEKLY_T2' && row.status === 'PENDING');
  const quests = fixture.waves.map((at, index) => ({
    ...template, questCode: 'demo-me-dot-week-' + index, instanceKey: 'WEEK:me-dots',
    eligibleFrom: new Date(at - day).toISOString(), eligibleUntil: new Date(at + 5 * day).toISOString(),
    status: index === 0 ? fixture.weeklyStatus : 'PENDING',
  }));
  const dayOne = fixture.dayOne ? payload.quests.filter(row => row.layer === 'DAY_ONE').map(row => ({
    ...row, status: fixture.dayOne, eligible: true,
  })) : [];
  return {
    ...payload, quests: [...dayOne, ...quests],
    dayOneSnapshotStatus: dayOne.length ? 'SNAPSHOT' : 'EMPTY',
    dayOneRequiredTaskCount: dayOne.length,
  };
}

export function createMeEntryDotsFixture() {
  const accounts = new Map();

  function configure(accountId, update) {
    if (update.reset) accounts.delete(accountId);
    const fixture = accounts.get(accountId) ?? {
      waves: [], payment: 'none', newerOrders: 0, weeklyStatus: 'PENDING', dayOne: null,
      fail: null, delay: null, paymentPlacedAt: Date.now() - paymentWindow - 5000,
    };
    if (update.wave !== undefined) {
      if (![0, 1, 2, 3].includes(update.wave)) throw Object.assign(new Error('ME_DOTS_WAVE_INVALID'), { status: 422 });
      fixture.waves.length = Math.min(fixture.waves.length, update.wave);
      while (fixture.waves.length < update.wave) {
        fixture.waves.push(Math.max(Date.now() - 1000, (fixture.waves.at(-1) ?? 0) + 1));
      }
    }
    if (['none', 'placed', 'paid', 'expired', 'failed'].includes(update.payment)) fixture.payment = update.payment;
    if ([0, 20].includes(update.newerOrders)) fixture.newerOrders = update.newerOrders;
    if (['PENDING', 'COMPLETED', 'CLAIMABLE', 'CLAIMED', 'EXPIRED'].includes(update.weeklyStatus)) {
      fixture.weeklyStatus = update.weeklyStatus;
    }
    if ([null, 'PENDING', 'COMPLETED', 'CLAIMABLE'].includes(update.dayOne)) fixture.dayOne = update.dayOne;
    if (update.fail === null || Object.values(sources).includes(update.fail)) fixture.fail = update.fail;
    if (update.delay === null || [...Object.values(sources), 'receipt-detail'].includes(update.delay)) fixture.delay = update.delay;
    fixture.failStatus = update.failStatus === 403 ? 403 : 503;
    fixture.delayMs = Math.max(0, Math.min(10000, Number(update.delayMs ?? fixture.delayMs ?? 1500)));
    accounts.set(accountId, fixture);
    return fixture;
  }

  async function read(url, accountId, baseRead) {
    const fixture = accounts.get(accountId);
    const path = url.pathname;
    const source = sources[path] ?? (path.startsWith('/api/tasks/receipts/' + receiptPrefix) ? 'receipt-detail' : null);
    if (!fixture || !source) return undefined;
    const failed = fixture.fail === source;
    const status = fixture.failStatus;
    const delay = fixture.delay === source ? fixture.delayMs : 0;
    let data;
    if (!failed) {
      if (source === 'orders') {
        const payload = baseRead(path);
        const rows = specimenOrders(payload, fixture);
        const limit = Number(url.searchParams.get('pageSize') ?? 20);
        const cursor = url.searchParams.get('beforeOrderNo');
        const offset = cursor ? rows.findIndex(row => row.orderNo === cursor) + 1 : 0;
        const orders = rows.slice(offset, offset + limit);
        data = { ...payload, orders, nextCursor: rows.length > offset + limit ? orders.at(-1).orderNo : null };
      } else if (source === 'missions') {
        data = specimenQuests(baseRead(url.pathname + url.search), fixture);
      } else {
        const payload = baseRead('/api/devices/earnings');
        const template = payload.devices.find(row => row.deviceType === 'BOX');
        const devices = specimenDevices(template, fixture);
        if (source === 'inventory') {
          const reservedSlotCount = fixture.payment === 'paid' ? 1 : 0;
          const trialSlotCount = payload.trialSlotCount ?? 0;
          data = { ...payload, devices, slotsUsed: devices.length + reservedSlotCount + trialSlotCount,
            reservedSlotCount, trialSlotCount,
            dailyUsdt: devices.reduce((sum, row) => sum + row.dailyUsdt, 0),
            dailyNex: devices.reduce((sum, row) => sum + row.dailyNex, 0),
            realizedTodayUsdt: devices.length * 0.15, realizedTodayNex: 0 };
        } else {
          const samples = fixture.waves.map((completedAt, index) => ({
            id: 7110 + index, receiptNo: receiptPrefix + (index + 1), taskClass: 'IG', usdt: '0.15',
            modelReceipt: true, device: devices[index], deviceName: devices[index].name, completedAt, settledAt: completedAt,
          }));
          if (source === 'receipts') data = demoReceiptPage(url.searchParams, samples.map(sample => demoEarningReceipt(sample)));
          else {
            const sample = samples.find(row => row.receiptNo === path.split('/').at(-1));
            if (!sample) throw Object.assign(new Error('ME_DOTS_RECEIPT_NOT_FOUND'), { status: 404 });
            data = demoEarningReceipt(sample, true);
          }
        }
      }
    }
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    if (failed) throw Object.assign(new Error('ME_DOTS_' + source.toUpperCase() + '_UNAVAILABLE'), { status });
    return data;
  }

  return { configure, read };
}
