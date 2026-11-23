/**
 * Stable per-install device identity — single source for "which device am I".
 *
 * The login device's id is what makes new-device recalibration possible: the
 * server can tell whether this physical device differs from the calibrated
 * device even while multiple account sessions coexist.
 *
 * The App mints and persists an installation ID locally. The authenticated
 * server binds that same ID to a production phone calibration and resolves
 * runtime reports against the active binding. This ID is a lookup key, not
 * cryptographic proof of a physical device.
 */
import { requireCryptoUuid } from "@/lib/secure-command-id";
import { reportNativeSessionStage } from "@/api/native-session-storage";

const STORAGE_KEY = "nexgrid-device-id-v1";
let runtimeIdentity: DeviceIdentity | null = null;

export interface DeviceIdentity {
  /** Stable opaque id for this install/device. */
  deviceId: string;
  /** Human-friendly label shown in "active sessions" lists, e.g. "iPhone · iOS". */
  deviceName: string;
}

interface SysInfo {
  brand?: string;
  model?: string;
  deviceModel?: string;
  platform?: string;
  system?: string;
  osName?: string;
  osVersion?: string;
}

function readSystemInfo(): SysInfo {
  try {
    // uni.getSystemInfoSync is available on every uni target (H5 + app webview).
    return (uni.getSystemInfoSync() as SysInfo) ?? {};
  } catch {
    return {};
  }
}

function deviceModelName(info: SysInfo): string {
  const brand = (info.brand || "").trim();
  const model = (info.model || info.deviceModel || "").trim();
  return brand && model ? `${brand} ${model}` : model;
}

function deriveDeviceName(info: SysInfo): string {
  const platform = (info.platform || "").trim();
  const system = (info.system || info.osName || "").trim();
  return deviceModelName(info)
    || (platform && system ? `${cap(platform)} · ${system}` : cap(platform))
    || "Web device";
}

function nativeLoginDeviceName(info: SysInfo): string | undefined {
  const brand = cap((info.brand || "").trim());
  const device = deviceModelName({ ...info, brand }) || brand;
  const osName = (info.osName || info.platform || "").trim();
  const osVersion = (info.osVersion || "").trim();
  const system = (info.system || "").trim();
  const os = /^ios$/i.test(osName) ? "iOS" : cap(osName);
  const systemLabel = system && system.toLowerCase() !== osName.toLowerCase()
    ? system
    : [os || system, osVersion].filter(Boolean).join(" ");
  return [device, systemLabel].filter(Boolean).join(" · ") || undefined;
}

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Read the label for a new login without reusing a historical installation label. */
export function getLoginDeviceName(native: boolean): string | undefined {
  if (native) return nativeLoginDeviceName(readSystemInfo());
  if (typeof navigator === "undefined") return undefined;
  const ua = navigator.userAgent;
  const browsers = [
    [/Edg(?:A|iOS)?\//, "Edge"],
    [/OPR\//, "Opera"],
    [/SamsungBrowser\//, "Samsung Internet"],
    [/(?:Firefox|FxiOS)\//, "Firefox"],
    [/(?:Chrome|CriOS)\//, "Chrome"],
    [/Chromium\//, "Chromium"],
    [/Version\/.*Safari\//, "Safari"],
  ] as const;
  const systems = [
    [/Android/, "Android"],
    [/iPad|iPhone|iPod/, "iOS"],
    [/CrOS/, "ChromeOS"],
    [/Windows/, "Windows"],
    [/Macintosh|Mac OS X/, "macOS"],
    [/Linux/, "Linux"],
  ] as const;
  const browser = browsers.find(([pattern]) => pattern.test(ua))?.[1];
  const system = systems.find(([pattern]) => pattern.test(ua))?.[1];
  return browser && system ? `${browser} · ${system}` : undefined;
}

/**
 * Returns the stable identity for this device, minting + persisting it on
 * first use. Synchronous (uni storage is sync) so stores can call it at init.
 */
export function getDeviceIdentity(): DeviceIdentity {
  if (runtimeIdentity) return { ...runtimeIdentity };
  try {
    const cached = uni.getStorageSync(STORAGE_KEY) as DeviceIdentity | "";
    if (cached && typeof cached === "object" && typeof cached.deviceId === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(cached.deviceId)) {
      runtimeIdentity = { deviceId: cached.deviceId, deviceName: cached.deviceName || "Web device" };
      reportNativeSessionStage("INSTALLATION_REUSED");
      return { ...runtimeIdentity };
    }
    reportNativeSessionStage(cached === "" || cached === null || cached === undefined ? "INSTALLATION_READ_EMPTY" : "INSTALLATION_READ_INVALID");
  } catch {
    reportNativeSessionStage("INSTALLATION_READ_THREW");
    // first run / storage unavailable
  }
  const identity: DeviceIdentity = {
    deviceId: requireCryptoUuid(),
    deviceName: deriveDeviceName(readSystemInfo()),
  };
  reportNativeSessionStage("INSTALLATION_CREATED");
  try {
    uni.setStorageSync(STORAGE_KEY, identity);
  } catch {
    reportNativeSessionStage("INSTALLATION_WRITE_THREW");
    // storage unavailable — identity is still valid for this session
  }
  runtimeIdentity = identity;
  return { ...identity };
}

/** Convenience accessor for just the id. */
export function getDeviceId(): string {
  return getDeviceIdentity().deviceId;
}

/**
 * ⚠️ DEV/QA-ONLY: forget this device's identity so the NEXT getDeviceIdentity()
 * mints a fresh id. Used by the "simulate logging in on a new device" demo
 * trigger to exercise the recalibration flow without a second physical device.
 * Never called on the production path.
 */
export function _devResetDeviceIdentity(): void {
  runtimeIdentity = null;
  try {
    uni.removeStorageSync(STORAGE_KEY);
  } catch {
    // no-op
  }
}
