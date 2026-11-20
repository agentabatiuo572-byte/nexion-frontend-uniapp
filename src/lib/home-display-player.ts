export interface HomeDisplayBatch {
  enabled: boolean;
  startAt: number;
  serverNow: number;
  validUntil: number;
  sequence: number;
  online: number[];
  paidCents: number[];
  activeJobs: (number | null)[];
}

export function parseHomeDisplayBatch(value: unknown): HomeDisplayBatch {
  const v = value as HomeDisplayBatch;
  if (!v || typeof v.enabled !== "boolean" || !Number.isSafeInteger(v.startAt) || v.startAt <= 0
    || !Number.isSafeInteger(v.validUntil) || v.validUntil <= 0
    || !Number.isSafeInteger(v.serverNow) || v.serverNow <= 0 || !Number.isSafeInteger(v.sequence) || v.sequence < 0
    || !Array.isArray(v.online) || !Array.isArray(v.paidCents) || !v.online.length
    || !Array.isArray(v.activeJobs) || v.activeJobs.length !== v.online.length
    || v.online.length !== v.paidCents.length || v.online.length > 121
    || (v.enabled ? v.online.length < 61 : v.online.length !== 1)) throw new Error("HOME_DISPLAY_INVALID");
  for (const rows of [v.online, v.paidCents]) {
    if (rows.some((n, i) => !Number.isSafeInteger(n) || n < 0 || i > 0 && n < rows[i - 1]))
      throw new Error("HOME_DISPLAY_INVALID");
  }
  let lastJobs = 0;
  for (const jobs of v.activeJobs) {
    if (jobs === null) continue;
    if (!Number.isSafeInteger(jobs) || jobs < lastJobs) throw new Error("HOME_DISPLAY_INVALID");
    lastJobs = jobs;
  }
  return v;
}

export function homeDisplayAt(batch: HomeDisplayBatch, serverNow: number) {
  if (!Number.isFinite(serverNow) || serverNow >= batch.validUntil) return null;
  const i = batch.enabled ? Math.max(0, Math.floor((serverNow - batch.startAt) / 1000)) : 0;
  if (i >= batch.online.length) return null;
  // The first second uses the next published sample; later seconds use the preceding one.
  const paidPerSec = !batch.enabled ? 0 : i === 0
    ? (batch.paidCents[1] - batch.paidCents[0]) / 100
    : (batch.paidCents[i] - batch.paidCents[i - 1]) / 100;
  return { online: batch.online[i], paid: batch.paidCents[i] / 100, paidPerSec, activeJobs: batch.activeJobs[i] };
}

const REFRESH_LEAD_MS = 3_000;
const MIN_REFRESH_INTERVAL_MS = 1_000;
const REFRESH_WINDOW_MS = 60_000;
const RETRY_MS = 5_000;
const EXPIRY_GRACE_MS = 10_000;

function batchEnd(batch: HomeDisplayBatch) {
  return batch.enabled ? Math.min(batch.validUntil, batch.startAt + batch.online.length * 1000) : batch.validUntil;
}

/** One visible-page clock refreshes before the current batch expires. */
export function createHomeDisplayPlayer(deps: {
  fetch(): Promise<HomeDisplayBatch>;
  now(): number;
  render(value: ReturnType<typeof homeDisplayAt>): void;
}) {
  let lastClock = deps.now();
  let elapsed = 0;
  const now = () => {
    const current = deps.now();
    elapsed += Math.max(0, current - lastClock);
    lastClock = current;
    return elapsed;
  };
  let batch: HomeDisplayBatch | null = null;
  let offset = 0;
  let lastRenderedAt = -Infinity;
  let active = false;
  let pending: Promise<void> | undefined;
  let lastFetchStartedAt = -Infinity;
  let nextFetch = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fetchFailed = false;
  let staleSince: number | undefined;
  function refresh(): Promise<void> {
    if (pending) return pending;
    const started = now();
    if (!active || started < nextFetch) return Promise.resolve();
    const previousStartedAt = lastFetchStartedAt;
    lastFetchStartedAt = started;
    pending = deps.fetch().then(next => {
      const received = now();
      const nextOffset = next.serverNow + Math.min(10_000, received - started) / 2 - received;
      const end = batchEnd(next);
      const previousEnd = batch ? batchEnd(batch) : 0;
      if (end <= received + nextOffset) {
        nextFetch = received + MIN_REFRESH_INTERVAL_MS;
        return;
      }
      batch = next;
      offset = nextOffset;
      fetchFailed = false;
      // Base the renewal on the time in the response, allowing it to reach the server after expiry.
      const boundary = received + end - next.serverNow;
      // Keep a request available at the boundary if prefetch still sees this lease.
      const canPrefetch = end !== previousEnd && boundary >= started + REFRESH_WINDOW_MS;
      const renewAt = canPrefetch ? boundary - REFRESH_LEAD_MS : boundary;
      nextFetch = Math.max(received + MIN_REFRESH_INTERVAL_MS, previousStartedAt + REFRESH_WINDOW_MS, renewAt);
    }).catch(() => {
      fetchFailed = true;
      nextFetch = now() + RETRY_MS;
    }).finally(() => {
      pending = undefined;
      if (active) tick();
    });
    return pending;
  }
  function tick() {
    clearTimeout(timer);
    const clock = now();
    const estimatedNow = clock + offset;
    const serverNow = Math.max(estimatedNow, lastRenderedAt);
    const end = batch ? batchEnd(batch) : 0;
    const value = batch && homeDisplayAt(batch, serverNow);
    if (value) {
      lastRenderedAt = serverNow;
      staleSince = undefined;
      deps.render(value);
    } else {
      staleSince ??= clock;
      if (!batch || fetchFailed || clock >= staleSince + EXPIRY_GRACE_MS) deps.render(null);
    }
    if (clock >= nextFetch) void refresh();
    const delays = pending ? [] : [nextFetch - clock];
    if (batch && end > serverNow) {
      delays.push(end - estimatedNow);
      if (batch.enabled) {
        const elapsed = serverNow - batch.startAt;
        const nextSecond = elapsed < 0 ? batch.startAt : serverNow + 1000 - elapsed % 1000;
        delays.push(nextSecond - estimatedNow);
      }
    } else if (batch && !fetchFailed && staleSince !== undefined && staleSince + EXPIRY_GRACE_MS > clock) {
      delays.push(staleSince + EXPIRY_GRACE_MS - clock);
    }
    if (delays.length) timer = setTimeout(tick, Math.max(1, Math.ceil(Math.min(...delays))));
  }
  return {
    refresh,
    start() {
      if (active) return;
      active = true;
      tick();
    },
    stop() {
      active = false;
      clearTimeout(timer);
      timer = undefined;
      staleSince = undefined;
    },
  };
}
