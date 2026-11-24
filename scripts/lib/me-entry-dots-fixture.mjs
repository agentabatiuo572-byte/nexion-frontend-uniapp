import { demoEarningReceipt, demoReceiptWire } from './prototype-demo-notifications.mjs';
import { demoReceiptPage, demoReceiptSummary } from './prototype-demo-secondary.mjs';
import { demoTeamWeek } from './prototype-demo-wallet.mjs';
import { demoOrderTimedOut, demoTimedOutOrder, paymentWindow } from './prototype-demo-data.mjs';

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
const dayOneQuestCode = 'demo-me-dot-day-one';
const dayOneRewardNex = 500;
const orderPrefix = 'DEMO-ME-DOT-';
const paymentOrderNo = orderPrefix + 'PAY';
const paymentLookupPath = '/api/app/purchase-payment-intents/by-order/' + paymentOrderNo;
const canonical = { serverCanonical: true, sourceEnvironment: 'PRODUCTION', runId: '' };
const refuse = (status, message) => { throw Object.assign(new Error(message), { status }); };
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
    ...delivered, orderNo: orderPrefix + (index + 1), placedAt: at - 600_000,
    paidAt: at - 480_000, activatedAt: at - 420_000, targetDeviceInstanceNo: inventoryInstance(index),
  }));
  if (fixture.payment !== 'none') {
    const placedAt = fixture.paymentPlacedAt;
    const pending = {
      ...template, orderNo: paymentOrderNo, placedAt,
      expiresAt: fixture.payment === 'placed' ? placedAt + paymentWindow : null,
      paymentStatus: 'PENDING', orderStatus: 'PENDING_PAYMENT', activationStatus: 'WAITING_PAYMENT',
      canonicalStatus: 'placed', closeReasonCode: null,
    };
    if (fixture.payment === 'paid') Object.assign(pending, {
      canonicalStatus: 'paid', paymentStatus: 'PAID', orderStatus: 'PAID',
      activationStatus: 'WAITING_PROVISIONING', paidAt: placedAt + paymentWindow - 1000,
      paymentMethod: 'UVEL_WALLET', paidTotalUsdt: String(pending.amountUsdt),
    });
    else if (fixture.payment === 'cancelled') Object.assign(pending, {
      canonicalStatus: 'cancelled', paymentStatus: 'CANCELLED', orderStatus: 'CANCELLED',
      // The list retains the fulfilment status of an order that never paid.
      activationStatus: 'WAITING_PAYMENT', closeReasonCode: 'USER_CANCELLED',
    });
    else if (fixture.payment === 'expired') Object.assign(pending, demoTimedOutOrder);
    else if (fixture.payment === 'failed') Object.assign(pending, {
      canonicalStatus: 'payment_failed', paymentStatus: 'FAILED', orderStatus: 'PAYMENT_FAILED',
      closeReasonCode: 'PAYMENT_NOT_RECEIVED',
    });
    rows.push(pending);
    for (let index = 0; index < fixture.newerOrders; index++) {
      rows.push({ ...template, orderNo: orderPrefix + 'HISTORY-' + index, placedAt: placedAt + 1000 * (index + 1) });
    }
  }
  return rows.sort((left, right) => right.placedAt - left.placedAt);
}

function newWeek(start, target) {
  return {
    instanceKey: 'WEEK:' + demoTeamWeek(start),
    eligibleFrom: new Date(start).toISOString(),
    eligibleUntil: new Date(start + weekLength).toISOString(),
    target,
    status: 'PENDING',
    claimKey: null,
  };
}

function currentWeek(fixture, now) {
  const start = weekStart(now);
  let week = fixture.weeks[start];
  if (!week) {
    const target = fixture.weekTarget === 'genesis' && fixture.genesisMarket !== 'open' ? null : fixture.weekTarget;
    fixture.weeks[start] = week = newWeek(start, target);
  }
  return week;
}

function advanceProgress(instance, status) {
  if (instance && weeklyProgress.indexOf(status) > weeklyProgress.indexOf(instance.status)) instance.status = status;
}

function newDayOne(accountId, now, status) {
  if (!['PENDING', 'COMPLETED', 'CLAIMABLE'].includes(status)) return null;
  return {
    instanceKey: 'DAY_ONE:me-dots-' + accountId,
    eligibleFrom: new Date(now).toISOString(),
    eligibleUntil: new Date(now + day).toISOString(),
    status,
    claimKey: null,
  };
}

function instanceStatus(instance, now) {
  if (!instance) return null;
  if (instance.status === 'CLAIMED') return 'CLAIMED';
  return now >= Date.parse(instance.eligibleUntil) ? 'EXPIRED' : instance.status;
}

function specimenQuests(payload, fixture, now, locale) {
  const week = currentWeek(fixture, now);
  const genesis = week.target === 'genesis';
  const quests = week.target ? [{
    questCode: weeklyQuestCode,
    name: genesis ? (locale === 'zh' ? '了解创世节点' : 'Explore Genesis')
      : payload.quests.find(row => row.questCode === 'demo-week-2')?.name ?? 'Invite a friend',
    layer: 'WEEKLY_T2', rewardNex: weeklyRewardNex, category: genesis ? 'explore' : 'social',
    actionRoute: genesis ? '/pages/genesis/genesis' : '/pages/team/team',
    instanceKey: week.instanceKey, eligibleFrom: week.eligibleFrom, eligibleUntil: week.eligibleUntil,
    eligible: week.status !== 'CLAIMED', status: week.status,
  }] : [];
  const group = fixture.dayOne;
  const status = instanceStatus(group, now);
  if (group) quests.push({
    questCode: dayOneQuestCode, name: locale === 'zh' ? '浏览商城' : 'Visit the store',
    layer: 'DAY_ONE', rewardNex: 0, category: 'explore', actionRoute: '/pages/store/store',
    instanceKey: group.instanceKey, eligibleFrom: group.eligibleFrom, eligibleUntil: group.eligibleUntil,
    eligible: status !== 'EXPIRED' && status !== 'CLAIMED', status,
  });
  return {
    ...payload, quests, serverTime: new Date(now).toISOString(),
    questBonusMultiplier: 1,
    dayOneRewardNex: group && status !== 'EXPIRED' ? dayOneRewardNex : 0,
    dayOneSnapshotStatus: group ? 'SNAPSHOT' : 'EMPTY',
    dayOneRequiredTaskCount: group ? 1 : 0,
  };
}

export function createMeEntryDotsFixture(previewState) {
  const accounts = new Map();

  const serverNow = fixture => Date.now() + fixture.clockOffset;

  function paymentAt(fixture, now) {
    if (fixture?.payment !== 'placed') return fixture?.payment ?? 'none';
    const order = {
      orderNo: paymentOrderNo,
      canonicalStatus: 'placed',
      expiresAt: fixture.paymentPlacedAt + paymentWindow,
    };
    return demoOrderTimedOut(order, previewState, now) ? 'expired' : 'placed';
  }

  function configure(accountId, update, resetOrderHides) {
    let fixture = update.reset ? undefined : accounts.get(accountId);
    if (update.weekState !== undefined) refuse(422, 'ME_DOTS_USE_SERVER_TIME');
    if (fixture && (update.week !== undefined || update.weekTarget !== undefined)) refuse(409, 'ME_DOTS_WEEK_ALREADY_PUBLISHED');
    if (update.week !== undefined && !['open', 'empty'].includes(update.week)) refuse(422, 'ME_DOTS_WEEK_INVALID');
    if (update.weekTarget !== undefined && !['invite', 'genesis'].includes(update.weekTarget)) refuse(422, 'ME_DOTS_WEEK_TARGET_INVALID');
    if (update.dayOne !== undefined && ![null, 'PENDING', 'COMPLETED', 'CLAIMABLE'].includes(update.dayOne)) {
      refuse(422, 'ME_DOTS_DAY_ONE_STATUS_INVALID');
    }
    if (fixture && update.dayOne !== undefined && Boolean(fixture.dayOne) !== Boolean(update.dayOne)) {
      refuse(409, 'ME_DOTS_DAY_ONE_MEMBERS_FROZEN');
    }
    if (update.wave !== undefined && (![0, 1, 2, 3].includes(update.wave) || update.wave < (fixture?.waves.length ?? 0))) {
      refuse(422, 'ME_DOTS_WAVE_INVALID');
    }
    if (update.genesisMarket !== undefined && !['open', 'closed'].includes(update.genesisMarket)) {
      refuse(422, 'ME_DOTS_GENESIS_MARKET_INVALID');
    }
    const wallNow = Date.now();
    const requestedNow = update.advanceServerTo === undefined ? null : Date.parse(update.advanceServerTo);
    if (requestedNow !== null && (!Number.isFinite(requestedNow) || requestedNow < wallNow + (fixture?.clockOffset ?? 0))) {
      refuse(422, 'ME_DOTS_SERVER_CLOCK_MUST_ADVANCE');
    }
    const now = requestedNow ?? wallNow + (fixture?.clockOffset ?? 0);
    const currentPayment = paymentAt(fixture, now);
    const placedStates = ['placed', 'paid', 'expired', 'failed'];
    if (update.payment !== undefined) {
      if (!['none', ...placedStates].includes(update.payment)) refuse(422, 'ME_DOTS_PAYMENT_INVALID');
      if (update.payment !== currentPayment && !(currentPayment === 'none' || (currentPayment === 'placed' && placedStates.includes(update.payment)))) {
        refuse(409, 'ME_DOTS_PAYMENT_ALREADY_SETTLED');
      }
    }

    if (!fixture) {
      fixture = {
        clockOffset: 0, waves: [], payment: 'none', newerOrders: 0,
        dayOne: newDayOne(accountId, now, update.dayOne),
        weekTarget: update.weekTarget ?? 'invite', weeks: {},
        genesisMarket: null, fail: null, delay: null, paymentPlacedAt: null,
      };
      if (update.week === 'empty') {
        const start = weekStart(now);
        fixture.weeks[start] = newWeek(start, null);
      }
    }
    if (requestedNow !== null) fixture.clockOffset = now - wallNow;
    if (update.genesisMarket !== undefined) fixture.genesisMarket = update.genesisMarket;
    const week = currentWeek(fixture, now);
    const addsWave = update.wave > fixture.waves.length;
    while (update.wave > fixture.waves.length) {
      fixture.waves.push(Math.max(now - 1000, (fixture.waves.at(-1) ?? 0) + 1));
    }
    if (week.target) {
      if (['COMPLETED', 'CLAIMABLE'].includes(update.weeklyStatus)) advanceProgress(week, update.weeklyStatus);
      else if (addsWave) advanceProgress(week, 'CLAIMABLE');
    }
    if (['PENDING', 'COMPLETED', 'CLAIMABLE'].includes(instanceStatus(fixture.dayOne, now))) {
      advanceProgress(fixture.dayOne, update.dayOne);
    }
    fixture.payment = currentPayment;
    if (update.payment !== undefined) {
      if (fixture.payment === 'none' && update.payment !== 'none') fixture.paymentPlacedAt = now - paymentWindow - 5000;
      fixture.payment = update.payment;
    }
    if ([0, 20].includes(update.newerOrders)) fixture.newerOrders = update.newerOrders;
    if (update.fail === null || Object.values(sources).includes(update.fail)) fixture.fail = update.fail;
    if (update.delay === null || [...Object.values(sources), 'receipt-detail'].includes(update.delay)) fixture.delay = update.delay;
    fixture.failStatus = update.failStatus === 403 ? 403 : 503;
    fixture.delayMs = Math.max(0, Math.min(10000, Number(update.delayMs ?? fixture.delayMs ?? 1500)));
    if (update.reset) resetOrderHides?.(accountId, orderNo => orderNo.startsWith(orderPrefix));
    accounts.set(accountId, fixture);
    return { ...fixture, serverNow: now, currentWeek: week };
  }

  function orderProjection(accountId, payload) {
    const fixture = accounts.get(accountId);
    if (!fixture) return undefined;
    fixture.payment = paymentAt(fixture, serverNow(fixture));
    return { ...payload, orders: specimenOrders(payload, fixture) };
  }

  async function read(url, accountId, baseRead, paginateOrderPage) {
    const fixture = accounts.get(accountId);
    const path = url.pathname;
    if (!fixture) return undefined;
    if (path === paymentLookupPath) {
      if (fixture.payment === 'none') refuse(404, 'ORDER_NOT_FOUND');
      return { orderNo: paymentOrderNo, state: 'NONE', intentNo: null };
    }
    if (path === '/api/genesis/state' && !url.searchParams.has('history') && fixture.genesisMarket !== null) {
      const state = baseRead(path);
      const open = fixture.genesisMarket === 'open';
      return { ...state, marketOpenState: fixture.genesisMarket, sale: { ...state.sale, available: open, open } };
    }
    const source = sources[path] ?? (path.startsWith('/api/tasks/receipts/' + receiptPrefix) ? 'receipt-detail' : null);
    if (!source) return undefined;
    const failed = fixture.fail === source;
    const status = fixture.failStatus;
    const delay = fixture.delay === source ? fixture.delayMs : 0;
    let data;
    if (!failed) {
      if (source === 'orders') {
        const payload = orderProjection(accountId, baseRead(path));
        if (paginateOrderPage) data = paginateOrderPage(url, accountId, payload, 20);
        else {
          const limit = Number(url.searchParams.get('pageSize') ?? 20);
          const cursor = url.searchParams.get('beforeOrderNo');
          const offset = cursor ? payload.orders.findIndex(row => row.orderNo === cursor) + 1 : 0;
          const orders = payload.orders.slice(offset, offset + limit);
          data = { ...payload, orders, nextCursor: payload.orders.length > offset + limit ? orders.at(-1).orderNo : null };
        }
      } else if (source === 'missions') {
        data = specimenQuests(baseRead(url.pathname + url.search), fixture, serverNow(fixture), url.searchParams.get('locale'));
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
    return [weeklyQuestCode, dayOneQuestCode].some(code => path === '/api/quests/' + code + '/claim');
  }

  function claim(path, accountId, body, commandKey) {
    const instanceKey = body?.instanceKey;
    if (!accountId) refuse(401, 'AUTH_REQUIRED');
    if (typeof commandKey !== 'string' || !commandKey.trim()) refuse(422, 'QUEST_IDEMPOTENCY_KEY_REQUIRED');
    if (typeof instanceKey !== 'string' || !instanceKey.trim()) refuse(422, 'QUEST_INSTANCE_KEY_REQUIRED');
    const fixture = accounts.get(accountId);
    if (!fixture) refuse(409, 'QUEST_INSTANCE_NOT_FOUND');
    const dayOne = path === '/api/quests/' + dayOneQuestCode + '/claim';
    const now = serverNow(fixture);
    const active = dayOne ? fixture.dayOne : currentWeek(fixture, now);
    const instance = dayOne ? active : Object.values(fixture.weeks).find(week => week.instanceKey === instanceKey);
    if (!instance || instance.instanceKey !== instanceKey || (!dayOne && !instance.target)) {
      refuse(409, 'QUEST_INSTANCE_NOT_FOUND');
    }
    if (instance.claimKey !== commandKey) {
      if (instance !== active || now < Date.parse(instance.eligibleFrom) || now >= Date.parse(instance.eligibleUntil)) {
        refuse(409, 'QUEST_EXPIRED');
      }
      if (instance.status === 'CLAIMED') refuse(409, 'QUEST_ALREADY_CLAIMED');
      if (!['COMPLETED', 'CLAIMABLE'].includes(instance.status)) refuse(409, 'QUEST_NOT_COMPLETED');
      instance.status = 'CLAIMED';
      instance.claimKey = commandKey;
    }
    return {
      questId: dayOne ? dayOneQuestCode : weeklyQuestCode,
      rewardNex: dayOne ? dayOneRewardNex : weeklyRewardNex,
      status: 'CLAIMED', instanceKey, ...canonical,
      ...(dayOne && { rewardTierBasis: 'CLAIM_TIME' }),
    };
  }

  function handlesCancel(path) {
    return path === '/api/orders/' + paymentOrderNo + '/cancel';
  }

  function cancelOrder(accountId, commandKey) {
    const fixture = accounts.get(accountId);
    if (!fixture || fixture.payment === 'none') refuse(403, 'ORDER_FORBIDDEN');
    if (typeof commandKey !== 'string' || !commandKey.trim()) refuse(422, 'IDEMPOTENCY_KEY_REQUIRED');
    fixture.payment = paymentAt(fixture, serverNow(fixture));
    const idempotent = fixture.payment === 'cancelled';
    if (!idempotent && fixture.payment !== 'placed') refuse(409, 'ORDER_NOT_CANCELLABLE');
    fixture.payment = 'cancelled';
    return {
      orderNo: paymentOrderNo, orderStatus: 'CANCELLED', paymentStatus: 'CANCELLED', activationStatus: 'CANCELLED',
      canonicalStatus: 'cancelled', paidTotalUsdt: null, idempotent, source: 'server', ...canonical,
    };
  }

  return { configure, read, orderProjection, handlesClaim, claim, handlesCancel, cancelOrder };
}
