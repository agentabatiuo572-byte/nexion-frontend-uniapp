import type { CalibrationRequestSignals } from "@/api/onboarding-calibration-api";

/** Raw observations only. The server owns all capability and yield decisions. */
export function collectDeviceSignals(): CalibrationRequestSignals {
  let model = "";
  let brand = "";
  try {
    const info = uni.getSystemInfoSync() as { model?: string; deviceModel?: string; brand?: string; platform?: string };
    const observedModel = info.model || info.deviceModel || info.platform;
    model = typeof observedModel === "string" ? observedModel.slice(0, 128) : "";
    brand = typeof info.brand === "string" ? info.brand.slice(0, 128) : "";
  } catch { /* unavailable observation */ }
  let memGB: number | null = null;
  let cores: number | null = null;
  try {
    const nav = typeof navigator !== "undefined" ? navigator as Navigator & { deviceMemory?: number } : undefined;
    memGB = Number.isFinite(nav?.deviceMemory) && Number(nav?.deviceMemory) > 0 && Number(nav?.deviceMemory) <= 128 ? Number(nav?.deviceMemory) : null;
    cores = Number.isInteger(nav?.hardwareConcurrency) && Number(nav?.hardwareConcurrency) > 0 && Number(nav?.hardwareConcurrency) <= 256 ? Number(nav?.hardwareConcurrency) : null;
  } catch { /* unavailable observation */ }
  let pxDensity: number | null = null;
  try {
    const dpr = typeof window !== "undefined" && Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : null;
    const minDim = typeof window !== "undefined" && window.screen && window.screen.width > 0 && window.screen.height > 0
      ? Math.min(window.screen.width, window.screen.height) : null;
    const observed = dpr !== null && minDim !== null ? dpr * minDim : null;
    pxDensity = observed !== null && observed >= 1 && observed <= 10_000 ? observed : null;
  } catch { /* unavailable observation */ }
  let gpu = "";
  try {
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as unknown as {
        getExtension(name: string): unknown;
        getParameter(parameter: number): unknown;
      } | null;
      const ext = gl?.getExtension("WEBGL_debug_renderer_info") as { UNMASKED_RENDERER_WEBGL: number } | null;
      gpu = gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "").slice(0, 256) : "";
    }
  } catch { /* unavailable observation */ }
  let batteryLevel: number | null = null;
  let charging: boolean | null = null;
  try {
    const info = uni.getSystemInfoSync() as { batteryLevel?: number; isCharging?: boolean; charging?: boolean };
    batteryLevel = Number.isInteger(info.batteryLevel) && Number(info.batteryLevel) >= 0 && Number(info.batteryLevel) <= 100 ? Number(info.batteryLevel) : null;
    charging = typeof info.isCharging === "boolean" ? info.isCharging : typeof info.charging === "boolean" ? info.charging : null;
  } catch { /* unavailable observation */ }
  let networkReachable: boolean | null = null;
  try {
    networkReachable = typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" ? navigator.onLine : null;
  } catch { /* unavailable observation */ }
  return { memGB, cores, model, brand, gpu, pxDensity, pingMs: null, batteryLevel, charging, networkReachable };
}
