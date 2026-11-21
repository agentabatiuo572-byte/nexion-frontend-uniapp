import { computed, ref } from "vue";
import { apiClient, apiRuntimeConfig } from "@/api/runtime";
import { readNativeResourceVersion } from "@/lib/app-version";
import { TAB_PATHS } from "@/lib/native-tab-navigation";
import { useAuth } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { serverLanguage, type ServerLanguage } from "@/i18n";
import { updateCopy } from "@/i18n/native-update";

type Platform = "android" | "ios";
type Copy = Record<ServerLanguage, string>;
interface Policy {
  releaseId: string | number;
  versionName: string;
  minBuild: number;
  latestBuild: number;
  updateType: "package" | "resource";
  downloadUrl: string;
  sha256: string;
  notes: Copy;
  reasons: Copy;
}
interface Device { platform: Platform; build: number; name: string; resourceBuild?: number }
interface Current { platform: Platform; decision: "none" | "current" | "optional" | "required"; policy: Policy | null }

export const updateRoute = "/pages/me/app-update";
export const installed = ref<Device | null>(null);
export const current = ref<Current | null>(null);
export const checking = ref(false);
export const checkFailed = ref(false);
export const gateActive = ref(false);
export const noticeKey = ref("");
export const language = computed(() => serverLanguage(useLocaleStore().code));
export const words = computed(() => updateCopy[language.value]);
let lastRead = 0;
let pending: Promise<void> | undefined;
let restored = false;
let lastRedirect = 0;
const cacheKey = (device: Device) => `uvel:required-update:${apiRuntimeConfig.baseUrl}:${device.platform}:${device.build}`;
const safeRoutes = new Set<string>([...Object.values(TAB_PATHS), "/pages/onboarding/intro", "/pages/me/preferences", updateRoute]);

function validCopy(copy: Copy | undefined) {
  return copy && ["zh", "en", "vi"].every(key => typeof copy[key as ServerLanguage] === "string");
}

function validCurrent(value: Current, device: Device) {
  if (!value || value.platform !== device.platform) return false;
  const p = value.policy;
  if (!p) return value.decision === "none" && p === null;
  const build = p.updateType === "package" ? device.build : device.resourceBuild;
  return (p.updateType === "package" || p.updateType === "resource")
    && !!p.releaseId && typeof p.versionName === "string" && Number.isSafeInteger(p.latestBuild)
    && Number.isSafeInteger(p.minBuild) && p.latestBuild >= p.minBuild && p.minBuild >= 0
    && validCopy(p.notes) && validCopy(p.reasons) && build !== undefined
    && value.decision === (build < p.minBuild ? "required" : build < p.latestBuild ? "optional" : "current");
}

async function readCurrent() {
  checking.value = true;
  checkFailed.value = false;
  try {
    const os = plus.os.name;
    const build = Number(plus.runtime.versionCode);
    if ((os !== "Android" && os !== "iOS") || !Number.isSafeInteger(build) || build < 1) throw Error("native version");
    const resource = await new Promise<import("@/lib/app-version").ResourceVersion>(readNativeResourceVersion);
    const resourceBuild = Number(resource.versionCode);
    const device: Device = { platform: os === "Android" ? "android" : "ios", build, name: plus.runtime.version || String(build) };
    if (Number.isSafeInteger(resourceBuild) && resourceBuild > 0) device.resourceBuild = resourceBuild;
    installed.value = device;
    const key = cacheKey(device);
    if (!restored) {
      restored = true;
      const cached = uni.getStorageSync(key);
      if (cached?.decision === "required" && validCurrent(cached, device)) current.value = cached;
    }
    const resourceQuery = device.resourceBuild ? "&resourceBuild=" + device.resourceBuild : "";
    const result = await apiClient.request<Current>({ authenticated: false, timeoutMs: 10000,
      path: `/api/app/updates/current?platform=${device.platform}&build=${device.build}${resourceQuery}` });
    if (!validCurrent(result, device)) throw Error("invalid update response");
    current.value = result;
    if (result.decision === "required") uni.setStorageSync(key, result);
    else {
      gateActive.value = false;
      uni.removeStorageSync(key);
    }
    if (result.decision !== "optional") noticeKey.value = "";
  } catch {
    checkFailed.value = true;
  } finally {
    checking.value = false;
  }
}

export function checkUpdate(immediate = false) {
  if (pending) return pending;
  if (!immediate && Date.now() - lastRead < 5 * 60_000) return Promise.resolve();
  lastRead = Date.now();
  pending = readCurrent().finally(() => { pending = undefined; });
  return pending;
}

export function guardUpdate(route: string): boolean {
  const result = current.value;
  if (!result || !route) return false;
  const path = "/" + route;
  if (result.decision === "required") {
    if (!gateActive.value && !safeRoutes.has(path)) return false;
    gateActive.value = true;
    if (path !== updateRoute && Date.now() - lastRedirect > 800) {
      lastRedirect = Date.now();
      uni.reLaunch({ url: updateRoute });
    }
    return true;
  }
  const auth = useAuth();
  if (result.decision === "optional" && result.policy && auth.isAuthenticated && Object.values(TAB_PATHS).some(tab => tab === path)) {
    const key = `uvel:update-shown:${apiRuntimeConfig.baseUrl}:${auth.accountId}:${result.platform}:${result.policy.releaseId}`;
    if (!uni.getStorageSync(key)) {
      uni.setStorageSync(key, true);
      noticeKey.value = key;
    } else if (noticeKey.value !== key) noticeKey.value = "";
  } else noticeKey.value = "";
  return false;
}

export function installUpdateGuard() {
  for (const method of ["navigateTo", "redirectTo", "reLaunch", "switchTab", "navigateBack"]) {
    uni.addInterceptor(method, { invoke(options: { url?: string }) {
      if (gateActive.value && options?.url !== updateRoute) return false;
    } });
  }
}

export async function openInstaller(onFailure: () => void) {
  const p = current.value?.policy;
  if (!p || p.updateType !== "package") throw Error("unverified resource");
  if (installed.value?.platform === "android") {
    const origin = apiRuntimeConfig.baseUrl.replace(/\/+$/, "");
    if (!/^https:\/\/[^/?#@]+$/.test(origin) || !/^[0-9a-f]{64}$/.test(p.sha256)
        || p.downloadUrl !== origin + "/app-updates/android/" + p.sha256 + ".apk") throw Error("untrusted installer");
    const status = await new Promise<number>((resolve, reject) => uni.request({ url: p.downloadUrl, method: "HEAD",
      timeout: 10000, success: response => resolve(response.statusCode), fail: reject }));
    if (status !== 200) throw Error("installer unavailable");
  } else if (!/^https:\/\/apps\.apple\.com\/(?:[a-z]{2}\/)?app\/(?:[\w%-]+\/)?id[0-9]+$/.test(p.downloadUrl)) {
    throw Error("untrusted store");
  }
  // The OS handles installation and signature validation. Opening the URL gives no installation receipt.
  plus.runtime.openURL(p.downloadUrl, onFailure);
}
