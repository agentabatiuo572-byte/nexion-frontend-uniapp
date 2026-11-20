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

/** One small visible-page clock; the only network operation is the minute refresh. */
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
  let active = false;
  let pending: Promise<void> | undefined;
  let nextFetch = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last: ReturnType<typeof homeDisplayAt> = null;
  let lastJobs = 0;
  function paint(serverNow: number) {
    const value = batch && homeDisplayAt(batch, serverNow);
    if (!value) {
      deps.render(null);
      return;
    }
    // A new batch can land behind an already displayed sample, including when growth pauses.
    if (last && (value.online < last.online || value.paid < last.paid
      || value.activeJobs !== null && value.activeJobs < lastJobs)) {
      deps.render({
        ...last,
        paidPerSec: batch?.enabled ? last.paidPerSec : 0,
        activeJobs: value.activeJobs === null ? null : last.activeJobs,
      });
      return;
    }
    last = value;
    if (value.activeJobs !== null) lastJobs = value.activeJobs;
    deps.render(value);
  }
  function refresh(): Promise<void> {
    if (pending) return pending;
    const started = now();
    if (!active || started < nextFetch) return Promise.resolve();
    nextFetch = started + 60_000;
    pending = deps.fetch().then(next => {
      batch = next;
      const received = now();
      offset = next.serverNow + Math.min(10_000, received - started) / 2 - received;
    }).catch(() => {
      // The last published batch remains usable through its own validity window.
    }).finally(() => {
      pending = undefined;
      if (active) tick();
    });
    return pending;
  }
  function tick() {
    clearTimeout(timer);
    const clock = now();
    const serverNow = clock + offset;
    paint(serverNow);
    if (clock >= nextFetch) void refresh();
    const delays = pending ? [] : [nextFetch - clock];
    if (batch && batch.validUntil > serverNow) {
      delays.push(batch.validUntil - serverNow);
      if (batch.enabled) {
        const elapsed = serverNow - batch.startAt;
        delays.push(elapsed < 0 ? -elapsed : 1000 - elapsed % 1000);
      }
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
    },
  };
}
