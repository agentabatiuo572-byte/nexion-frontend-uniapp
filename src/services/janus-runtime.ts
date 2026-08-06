import { JANUS_STATUSES, type JanusStatus } from "@/api/janus-api";

export interface JanusRuntimeState {
  status: JanusStatus;
  revision: number;
  remoteUrlKey?: string;
  remoteTargetVersion?: number;
  remoteTargetCatalogVersion?: number;
  remoteTargetUrl?: string;
  appliedAt: number;
}

export type JanusRemoteNavigator = (url: string) => Promise<void>;

export const JANUS_RUNTIME_KEY = "nexgrid-janus-runtime-v2";
const REMOTE_STATUSES = new Set<JanusStatus>(["HIT", "ACTIVATED", "MANUAL_FORCED"]);
const STATUS_SET = new Set<string>(JANUS_STATUSES);

function normalizeRemoteUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:"
      || parsed.username
      || parsed.password
      || parsed.search
      || parsed.hash
      || parsed.origin === "null"
    ) throw new Error("invalid");
    return parsed.toString();
  } catch {
    throw new Error("JANUS_REMOTE_TARGET_URL_INVALID");
  }
}

async function defaultRemoteNavigator(url: string): Promise<void> {
  const runtime = (globalThis as unknown as {
    plus?: {
      runtime?: {
        openURL?: (
          target: string,
          success: () => void,
          failure: (error: { message?: string }) => void,
        ) => void;
      };
    };
  }).plus?.runtime;
  if (runtime?.openURL) {
    await new Promise<void>((resolve, reject) => {
      runtime.openURL!(
        url,
        resolve,
        (error) => reject(new Error(error.message || "JANUS_REMOTE_APPLY_FAILED")),
      );
    });
    return;
  }
  if (typeof window !== "undefined" && window.location) {
    window.location.assign(url);
    return;
  }
  throw new Error("JANUS_REMOTE_TARGET_UNSUPPORTED");
}

export function readJanusRuntime(): JanusRuntimeState | null {
  const runtime = uni.getStorageSync(JANUS_RUNTIME_KEY) as Partial<JanusRuntimeState> | "";
  if (!runtime || typeof runtime !== "object" || !Number.isSafeInteger(runtime.revision)
      || Number(runtime.revision) <= 0 || typeof runtime.status !== "string"
      || !STATUS_SET.has(runtime.status.toUpperCase())) {
    return null;
  }
  return { ...runtime, status: runtime.status.toUpperCase() as JanusStatus } as JanusRuntimeState;
}

export async function applyJanusRuntime(
  runtime: JanusRuntimeState,
  navigateRemote: JanusRemoteNavigator = defaultRemoteNavigator,
): Promise<void> {
  const next: JanusRuntimeState = {
    ...runtime,
    status: runtime.status.toUpperCase() as JanusStatus,
  };
  if (!STATUS_SET.has(next.status)) throw new Error("JANUS_RUNTIME_STATUS_INVALID");
  if (!Number.isSafeInteger(next.revision) || next.revision <= 0) {
    throw new Error("JANUS_RUNTIME_REVISION_INVALID");
  }
  if (REMOTE_STATUSES.has(next.status)) {
    if (
      !next.remoteUrlKey?.trim()
      || !Number.isSafeInteger(next.remoteTargetVersion)
      || Number(next.remoteTargetVersion) <= 0
      || !Number.isSafeInteger(next.remoteTargetCatalogVersion)
      || Number(next.remoteTargetCatalogVersion) <= 0
      || !next.remoteTargetUrl
    ) throw new Error("JANUS_REMOTE_TARGET_BINDING_INVALID");
    next.remoteUrlKey = next.remoteUrlKey.trim();
    next.remoteTargetUrl = normalizeRemoteUrl(next.remoteTargetUrl);
    await navigateRemote(next.remoteTargetUrl);
  } else {
    delete next.remoteUrlKey;
    delete next.remoteTargetVersion;
    delete next.remoteTargetCatalogVersion;
    delete next.remoteTargetUrl;
  }
  uni.setStorageSync(JANUS_RUNTIME_KEY, next);
}
