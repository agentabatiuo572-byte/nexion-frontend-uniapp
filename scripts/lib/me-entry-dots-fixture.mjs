import { demoEarningReceipt, demoReceiptWire } from './prototype-demo-notifications.mjs';
import { demoReceiptPage, demoReceiptSummary } from './prototype-demo-secondary.mjs';
import { demoTeamWeek } from './prototype-demo-wallet.mjs';
import { demoTimedOutOrder, paymentWindow } from './prototype-demo-data.mjs';

const sources = {
  '/api/orders': 'orders',
  '/api/quests/state': 'missions',
  '/api/tasks/receipts': 'receipts',
  '/api/devices/earnings': 'inventory',
};
const day = 86_400_000;
const weekLength = 7 * day;
const vietnamOffset = 7 * 60 * 60 * 1000;
const weeklyQuestCode = 'demo-me-dot-week-0';
const weeklyRewardNex = 150;
const weeklyProgress = ['PENDING', 'COMPLETED', 'CLAIMABLE', 'CLAIMED'];
const modelTaskSuffixPrefix = '0000000000004000800000000000';
const receiptPrefix = 'CTR-' + modelTaskSuffixPrefix;

function weekStart(now) {
  const localMidnight = Math.floor((now + vietnamOffset) / day) * day;
  const weekday = (new Date(localMidnight).getUTCDay() + 6) % 7;
  return localMidnight - weekday * day - vietnamOffset;
}

function specimenReceipt(completedAt, index, device) {
  const id = 7110 + index;
  const taskNo = 'CTA-' + modelTaskSuffixPrefix + id.toString(16).toUpperCase().padStart(4, '0');
  const durationSec = 300;
  return {
    id, taskNo, receiptNo: 'CTR-' + taskNo.slice(-32), taskClass: 'IG',
    rewardUsdt: 0.15, rewardNex: 0, modelReceipt: true,
    device, deviceName: device.name, startedAt: completedAt - durationSec * 1000,
    durationSec, completedAt, settledAt: completedAt,
  };
}
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
      ...template, orderNo: 'DEMO-ME-DOT-PAY', placedAt,
      expiresAt: fixture.payment === 'placed' ? placedAt + paymentWindow : null,
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

function newWeek(start) {
  return {
    instanceKey: 'WEEK:' + demoTeamWeek(start),
    eligibleFrom: new Date(start).toISOString(),
    eligibleUntil: new Date(start + weekLength).toISOString(),
    status: 'PENDING',
    claimKey: null,
  };
}

// Only progress can change on an existing published definition.
function advanceWeek(week, status) {
  if (week && weeklyProgress.indexOf(status) > weeklyProgress.indexOf(week.status)) week.status = status;
}

function specimenQuests(payload, fixture) {
  const week = fixture.weeks[fixture.weekState];
  const quests = week ? [{
    questCode: weeklyQuestCode,
    name: payload.quests.find(row => row.questCode === 'demo-week-2')?.name ?? 'Invite a friend',
    layer: 'WEEKLY_T2', rewardNex: weeklyRewardNex, category: 'social', actionRoute: '/pages/team/team',
    instanceKey: week.instanceKey, eligibleFrom: week.eligibleFrom, eligibleUntil: week.eligibleUntil,
    eligible: true, status: week.status,
  }] : [];
  const dayOne = fixture.dayOne ? payload.quests.filter(row => row.layer === 'DAY_ONE').map(row => ({
    ...row, status: fixture.dayOne, eligible: true,
  })) : [];
  return {
    ...payload, quests: [...dayOne, ...quests],
    questBonusMultiplier: 1,
    dayOneSnapshotStatus: dayOne.length ? 'SNAPSHOT' : 'EMPTY',
    dayOneRequiredTaskCount: dayOne.length,
  };
}

export function createMeEntryDotsFixture(previewState) {
  const accounts = new Map();

  function configure(accountId, update) {
    if (update.reset) accounts.delete(accountId);
    let fixture = accounts.get(accountId);
    if (!fixture) {
      const start = weekStart(Date.now());
      fixture = {
        waves: [], phone: null, payment: 'none', newerOrders: 0, dayOne: null,
        weeks: { current: newWeek(start), next: newWeek(start + weekLength) }, weekState: 'current',
        fail: null, delay: null, paymentPlacedAt: Date.now() - paymentWindow - 5000,
      };
    }
    if (['current', 'closed', 'next'].includes(update.weekState)) fixture.weekState = update.weekState;
    const week = fixture.weeks[fixture.weekState];
    const addsWave = update.wave > fixture.waves.length;
    if (update.wave !== undefined) {
      if (![0, 1, 2, 3].includes(update.wave)) throw Object.assign(new Error('ME_DOTS_WAVE_INVALID'), { status: 422 });
      fixture.waves.length = Math.min(fixture.waves.length, update.wave);
      while (fixture.waves.length < update.wave) {
        fixture.waves.push(Math.max(Date.now() - 1000, (fixture.waves.at(-1) ?? 0) + 1));
      }
    }
    if (['COMPLETED', 'CLAIMABLE'].includes(update.weeklyStatus)) advanceWeek(week, update.weeklyStatus);
    else if (addsWave) advanceWeek(week, 'CLAIMABLE');
    if (update.phone === true && fixture.phone === null) fixture.phone = Date.now() - 480_000;
    if (update.phone === false) fixture.phone = null;
    if (['none', 'placed', 'paid', 'expired', 'failed'].includes(update.payment)) fixture.payment = update.payment;
    if ([0, 20].includes(update.newerOrders)) fixture.newerOrders = update.newerOrders;
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
          if (fixture.phone !== null) devices.push({
            ...template, id: 7199, instanceNo: 'ME-DOT-PHONE', name: 'Demo phone',
            productCode: 'PHONE', deviceType: 'PHONE', capacityConfigKey: 'capacityApplyToPhone',
            status: 'ACTIVE', runtimeStatus: 'ONLINE', activatedAt: fixture.phone + 60_000,
            purchasedAt: fixture.phone, actualPaidUsdt: 0,
            dailyUsdt: 0, dailyNex: 0, todayEarningsUsdt: 0, todayEarningsNex: 0, cumulativeOutputUsdt: 0,
          });
          const reservedSlotCount = fixture.payment === 'paid' ? 1 : 0;
          const trialSlotCount = payload.trialSlotCount ?? 0;
          data = { ...payload, devices, slotsUsed: devices.length + reservedSlotCount + trialSlotCount,
            reservedSlotCount, trialSlotCount,
            dailyUsdt: devices.reduce((sum, row) => sum + row.dailyUsdt, 0),
            dailyNex: devices.reduce((sum, row) => sum + row.dailyNex, 0),
            realizedTodayUsdt: fixture.waves.length * 0.15, realizedTodayNex: 0 };
        } else {
          const samples = fixture.waves.map((completedAt, index) => specimenReceipt(completedAt, index, devices[index]));
          if (source === 'receipts') {
            const summaries = samples.map(sample => demoReceiptSummary(demoEarningReceipt(sample)));
            data = demoReceiptPage(url.searchParams, summaries, previewState);
          } else {
            const sample = samples.find(row => row.receiptNo === path.split('/').at(-1));
            if (!sample) throw Object.assign(new Error('ME_DOTS_RECEIPT_NOT_FOUND'), { status: 404 });
            data = demoReceiptWire(demoEarningReceipt(sample, true), previewState);
          }
        }
      }
    }
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    if (failed) throw Object.assign(new Error('ME_DOTS_' + source.toUpperCase() + '_UNAVAILABLE'), { status });
    return data;
  }

  function handlesClaim(path) {
    return path === '/api/quests/' + weeklyQuestCode + '/claim';
  }

  function claim(accountId, body, commandKey) {
    const instanceKey = body?.instanceKey;
    const reject = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
    if (!accountId) reject('AUTH_REQUIRED', 401);
    if (typeof commandKey !== 'string' || !commandKey.trim()) reject('QUEST_IDEMPOTENCY_KEY_REQUIRED', 422);
    if (typeof instanceKey !== 'string' || !instanceKey.trim()) reject('QUEST_INSTANCE_KEY_REQUIRED', 422);
    const fixture = accounts.get(accountId);
    if (!fixture) reject('QUEST_INSTANCE_NOT_FOUND');
    const requested = Object.values(fixture.weeks).find(week => week.instanceKey === instanceKey);
    if (!requested) reject('QUEST_INSTANCE_NOT_FOUND');
    if (requested.claimKey !== commandKey) {
      if (requested !== fixture.weeks[fixture.weekState]) reject('QUEST_EXPIRED');
      if (requested.status === 'CLAIMED') reject('QUEST_ALREADY_CLAIMED');
      if (!['COMPLETED', 'CLAIMABLE'].includes(requested.status)) reject('QUEST_NOT_COMPLETED');
      requested.status = 'CLAIMED';
      requested.claimKey = commandKey;
    }
    return {
      questId: weeklyQuestCode, rewardNex: weeklyRewardNex, status: 'CLAIMED', instanceKey,
      serverCanonical: true, sourceEnvironment: 'PRODUCTION', runId: '',
    };
  }

  return { configure, read, handlesClaim, claim };
}
