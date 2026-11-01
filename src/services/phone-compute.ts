import { reactive, shallowRef } from "vue";
import { apiClient, sessionVault } from "@/api/runtime";
import { createPhoneComputeApi, type PhoneComputeResult, type PhoneComputeTask, type PhoneExitReason } from "@/api/phone-compute-api";
import { collectNativePhoneRuntime, hasNativeAndroidPhoneRuntime } from "@/lib/native-phone-runtime";
import { PHONE_EMBEDDING_MODEL as model } from "@/lib/phone-embedding-model";
import { getDeviceId } from "@/lib/device-id";
import { useApp } from "@/store/app";

type Phase = "CLAIM_INTENT" | "COMPUTE_INTENT" | "RESULT" | "ABORTED" | "EXITING";
interface Journal {
  schemaVersion: 1; accountKey: string; installationId: string; phase: Phase;
  task?: PhoneComputeTask; result?: PhoneComputeResult; sent?: boolean; workerExited?: boolean; exitReason?: PhoneExitReason;
}
export const phoneComputeRuntime = reactive({
  status: "unsupported" as "unsupported" | "paused" | "downloading" | "loading" | "ready" | "waiting" | "running" | "verifying" | "recovering" | "error",
  error: "", modelName: model.modelName, lastDurationMs: null as number | null,
  downloadPercent: 0, downloadedBytes: 0, modelSource: "" as "" | "download" | "cache",
});
export const phoneComputeCommand = shallowRef<Record<string, unknown> | null>(null);
const api = createPhoneComputeApi(apiClient);
let mounted = false, foreground = false, ready = false, loading = false, exited = false, driving = false, heartbeatBusy = false;
let commandId = 0, runId = 0, owner = "", journal: Journal | null = null;
let executionDeadline = 0;
let timer: ReturnType<typeof setInterval> | undefined, heartbeatTimer: ReturnType<typeof setInterval> | undefined;
let stopWaiters: (() => void)[] = [];
const modelCacheKey = `uvel-phone-model-v1:${model.modelRevision}:${model.modelSha256}`;
let modelPath = "";

async function cachedModelPath(): Promise<string> {
  const saved: unknown = uni.getStorageSync(modelCacheKey);
  if (typeof saved === "string" && saved.startsWith("_doc/uniapp_save/")) {
    const size = await new Promise<number>(resolve => uni.getSavedFileInfo({
      filePath: saved, success: file => resolve(file.size), fail: () => resolve(0),
    }));
    if (size === model.modelSizeBytes) {
      phoneComputeRuntime.modelSource = "cache";
      phoneComputeRuntime.downloadPercent = 100;
      return saved;
    }
    uni.removeStorageSync(modelCacheKey);
    if (size) await new Promise<void>((resolve, reject) => uni.removeSavedFile({ filePath: saved, success: () => resolve(), fail: reject }));
  }
  phoneComputeRuntime.status = "downloading";
  phoneComputeRuntime.modelSource = "download";
  phoneComputeRuntime.downloadPercent = 0;
  phoneComputeRuntime.downloadedBytes = 0;
  const downloaded = await new Promise<UniApp.DownloadSuccessData>((resolve, reject) => {
    const task = uni.downloadFile({ url: model.modelUrl, timeout: 300_000, success: resolve,
      fail: () => reject(new Error("PHONE_MODEL_DOWNLOAD_FAILED")) });
    task.onProgressUpdate(progress => {
      phoneComputeRuntime.downloadedBytes = progress.totalBytesWritten;
      phoneComputeRuntime.downloadPercent = Math.min(100, Math.floor(progress.totalBytesWritten / model.modelSizeBytes * 100));
    });
  });
  if (downloaded.statusCode !== 200) throw new Error(`PHONE_MODEL_DOWNLOAD_HTTP_${downloaded.statusCode}`);
  const size = await new Promise<number>((resolve, reject) => uni.getFileInfo({ filePath: downloaded.tempFilePath,
    success: file => resolve(file.size), fail: reject }));
  if (size !== model.modelSizeBytes) throw new Error("PHONE_MODEL_DOWNLOAD_SIZE_INVALID");
  const path = await new Promise<string>((resolve, reject) => uni.saveFile({ tempFilePath: downloaded.tempFilePath,
    success: file => resolve(file.savedFilePath), fail: reject }));
  uni.setStorageSync(modelCacheKey, path);
  phoneComputeRuntime.downloadPercent = 100;
  return path;
}

function key(account = owner) { return `uvel-phone-em-v1:${account}:${getDeviceId()}`; }
function save() { if (journal) uni.setStorageSync(key(journal.accountKey), journal); }
function clearJournal() { uni.removeStorageSync(key()); journal = null; }
function command(action: string, details: Record<string, unknown> = {}) {
  phoneComputeCommand.value = { id: ++commandId, action, ...details };
  return commandId;
}
function stop(reason: PhoneExitReason) {
  ready = false; loading = false;
  command("stop", { reason });
}
function activeAccount() {
  const session = sessionVault.read();
  return session && useApp().accountKey === `user:${session.user.userId}` ? `user:${session.user.userId}` : "";
}
function readJournal(accountKey: string): Journal | null {
  const value = uni.getStorageSync(key(accountKey));
  if (!value) return null;
  if (typeof value !== "object" || value.schemaVersion !== 1 || value.accountKey !== accountKey
    || value.installationId !== getDeviceId() || !["CLAIM_INTENT", "COMPUTE_INTENT", "RESULT", "ABORTED", "EXITING"].includes(value.phase)
    || (value.phase !== "CLAIM_INTENT" && (!value.task || !/^CV2-[0-9A-F]{32}$/.test(value.task.taskNo))))
    throw new Error("PHONE_COMPUTE_JOURNAL_INVALID");
  return value as Journal;
}

export function setNativePhoneComputeForeground(value: boolean) {
  foreground = value;
  if (!value) { void pauseNativePhoneCompute("APP_PAUSED"); return; }
  void drive();
}
export function mountNativePhoneCompute() {
  if (!hasNativeAndroidPhoneRuntime() || mounted) return;
  mounted = true;
  phoneComputeRuntime.status = "paused";
  stop("APP_PAUSED");
  timer = setInterval(() => { void drive(); }, 5_000);
  heartbeatTimer = setInterval(() => {
    if (!foreground || !journal?.task || !["COMPUTE_INTENT", "RESULT"].includes(journal.phase)
      || heartbeatBusy || activeAccount() !== owner) return;
    heartbeatBusy = true;
    void api.heartbeat(journal.task).catch(error => {
      phoneComputeRuntime.error = error instanceof Error ? error.message : "PHONE_HEARTBEAT_FAILED";
    }).finally(() => { heartbeatBusy = false; });
  }, 10_000);
}
export function unmountNativePhoneCompute() {
  void pauseNativePhoneCompute("APP_PAUSED");
  mounted = false;
  if (timer) clearInterval(timer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  timer = undefined; heartbeatTimer = undefined;
}
export async function pauseNativePhoneCompute(reason: PhoneExitReason = "APP_PAUSED") {
  if (!mounted) return;
  phoneComputeRuntime.status = "paused";
  if (journal?.task && !journal.result) {
    journal.phase = "ABORTED"; journal.exitReason = reason; journal.workerExited = exited; save();
  }
  if (exited) return;
  const stopped = new Promise<void>(resolve => { stopWaiters.push(resolve); });
  stop(reason);
  await stopped;
}
export function retryNativePhoneCompute() {
  phoneComputeRuntime.error = "";
  phoneComputeRuntime.status = "paused";
  void drive();
}

export function receiveNativePhoneCompute(value: unknown) {
  if (!value || typeof value !== "object") return;
  const event = value as Record<string, unknown>;
  if (event.state === "EXITED") {
    exited = true; ready = false; loading = false;
    executionDeadline = 0;
    if (journal?.task) {
      if (journal.phase === "COMPUTE_INTENT") { journal.phase = "ABORTED"; journal.exitReason = "APP_PAUSED"; }
      journal.workerExited = true; save();
    }
    for (const resolve of stopWaiters) resolve();
    stopWaiters = [];
    if (foreground) void drive();
  } else if (event.state === "READY") {
    if (event.id !== commandId || event.modelSha256 !== model.modelSha256 || event.modelRevision !== model.modelRevision) return;
    ready = true; loading = false; exited = false;
    phoneComputeRuntime.error = "";
    phoneComputeRuntime.status = "ready";
    if (!foreground) stop("APP_PAUSED"); else void drive();
  } else if (event.state === "RESULT") {
    if (event.id !== runId || journal?.phase !== "COMPUTE_INTENT" || !journal.task
      || typeof event.resultHash !== "string" || !/^[a-f0-9]{64}$/.test(event.resultHash)
      || typeof event.resultArtifactBase64 !== "string" || event.resultArtifactBase64.length > 20_000
      || typeof event.actualDurationMs !== "number") return;
    journal.result = { resultHash: event.resultHash, resultArtifactBase64: event.resultArtifactBase64, actualDurationMs: event.actualDurationMs };
    journal.phase = "RESULT"; journal.sent = false; journal.workerExited = false; save();
    phoneComputeRuntime.lastDurationMs = event.actualDurationMs;
    phoneComputeRuntime.status = "verifying";
    stop("COMPLETED");
  } else if (event.state === "ERROR") {
    phoneComputeRuntime.error = typeof event.error === "string" ? event.error : "PHONE_ENGINE_FAILED";
    phoneComputeRuntime.status = "error";
    if (event.error === "PHONE_MODEL_DIGEST_INVALID" && modelPath) {
      uni.removeStorageSync(modelCacheKey);
      uni.removeSavedFile({ filePath: modelPath, fail: () => { phoneComputeRuntime.error = "PHONE_MODEL_CACHE_REMOVE_FAILED"; } });
      modelPath = "";
    }
    if (journal?.task && !journal.result) { journal.phase = "ABORTED"; journal.exitReason = "WORKER_ERROR"; save(); }
    stop("WORKER_ERROR");
  }
}

async function drive() {
  if (!mounted || !foreground || driving) return;
  driving = true;
  try {
    const account = activeAccount();
    if (!account) { if (!exited) stop("APP_PAUSED"); return; }
    if (owner !== account) {
      stop("APP_PAUSED");
      owner = account;
      journal = readJournal(account);
      // A persisted COMPUTE_INTENT is uncertain work. Reconcile/exit it; never infer it again.
      if (journal?.phase === "COMPUTE_INTENT") { journal.phase = "ABORTED"; journal.exitReason = "APP_PAUSED"; journal.workerExited = false; save(); }
      return;
    }
    const scope = useApp().captureRemoteAccountRequest();
    const current = () => activeAccount() === account && useApp().captureRemoteAccountRequest().epoch === scope.epoch;
    if (journal?.task && journal.phase !== "COMPUTE_INTENT") {
      const pending = journal;
      if (!pending.workerExited) { stop(pending.exitReason ?? "COMPLETED"); return; }
      phoneComputeRuntime.status = "recovering";
      if (pending.result && pending.phase !== "EXITING") {
        if (pending.sent) {
          const receipt = await api.receipt(pending.task!);
          if (!current()) return;
          if (receipt.exitConfirmed) { clearJournal(); return; }
          if (receipt.state === "COMPLETED") {
            if (receipt.resultHash !== pending.result.resultHash) throw new Error("PHONE_COMPUTE_RECEIPT_HASH_CONFLICT");
            pending.phase = "EXITING"; pending.exitReason = "COMPLETED"; save();
          } else if (receipt.state === "FAILED") {
            pending.phase = "EXITING"; pending.exitReason = "WORKER_ERROR"; save();
          }
        }
        if (pending.phase !== "EXITING") {
          pending.sent = true; save();
          phoneComputeRuntime.status = "verifying";
          await api.complete(pending.task!, pending.result);
          if (!current()) return;
          pending.phase = "EXITING"; pending.exitReason = "COMPLETED"; save();
        }
      }
      const result = await api.exited(pending.task!, pending.exitReason ?? "APP_PAUSED");
      if (!current()) return;
      if (result.state !== "EXIT_CONFIRMED") throw new Error("PHONE_COMPUTE_EXIT_UNCONFIRMED");
      clearJournal(); phoneComputeRuntime.status = "paused";
      return;
    }
    const signals = await collectNativePhoneRuntime();
    if (!current() || !foreground) return;
    if (!signals) { phoneComputeRuntime.error = "PHONE_RUNTIME_SIGNALS_UNAVAILABLE"; await pauseNativePhoneCompute("APP_PAUSED"); return; }
    const reason = !signals.networkReachable ? "PHONE_OFFLINE" : signals.batteryLevel < 20 ? "PHONE_LOW_BATTERY" : null;
    if (reason) { await pauseNativePhoneCompute(reason); return; }
    if (journal?.phase === "COMPUTE_INTENT") {
      if (executionDeadline && Date.now() >= executionDeadline) {
        phoneComputeRuntime.error = "PHONE_EXECUTION_TIMEOUT";
        await pauseNativePhoneCompute("WORKER_ERROR");
      }
      return;
    }
    if (!ready) {
      if (!loading && phoneComputeRuntime.status !== "error" && exited) {
        loading = true;
        modelPath = await cachedModelPath();
        if (!current() || !foreground) { loading = false; return; }
        exited = false; phoneComputeRuntime.status = "loading";
        command("init", { modelUrl: plus.io.convertLocalFileSystemURL(modelPath) });
      }
      return;
    }
    if (!useApp().devices.some(device => device.kind === "phone" && device.activatedAt != null)) return;
    journal = { schemaVersion: 1, accountKey: account, installationId: getDeviceId(), phase: "CLAIM_INTENT" }; save();
    const task = await api.next();
    if (!current()) return;
    if (!task) { clearJournal(); phoneComputeRuntime.status = "ready"; return; }
    journal.task = task;
    journal.phase = "COMPUTE_INTENT"; journal.workerExited = false; save();
    if (task.state !== "COMPUTING") { await pauseNativePhoneCompute("APP_PAUSED"); return; }
    if (!foreground) { await pauseNativePhoneCompute("APP_PAUSED"); return; }
    phoneComputeRuntime.status = "running";
    executionDeadline = Date.now() + task.executionTimeoutSec * 1000;
    runId = command("run", { task });
  } catch (error) {
    phoneComputeRuntime.error = error instanceof Error ? error.message : "PHONE_COMPUTE_UNAVAILABLE";
    if (loading || ["downloading", "loading"].includes(phoneComputeRuntime.status)) { loading = false; phoneComputeRuntime.status = "error"; }
    else if (phoneComputeRuntime.status !== "error") phoneComputeRuntime.status = journal?.task ? "recovering" : "waiting";
  } finally { driving = false; }
}
