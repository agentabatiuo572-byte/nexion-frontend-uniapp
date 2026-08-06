export type ApiMode = "mock" | "remote";

export interface ApiRuntimeConfig {
  mode: ApiMode;
  baseUrl: string;
}

const runtimeEnv: Record<string, unknown> = import.meta.env.DEV
  ? {
    VITE_NEXGRID_API_MODE: import.meta.env.VITE_NEXGRID_API_MODE,
    VITE_NEXGRID_API_BASE_URL: import.meta.env.VITE_NEXGRID_API_BASE_URL,
    VITE_NEXGRID_API_DEV_BASE_URL: import.meta.env.VITE_NEXGRID_API_DEV_BASE_URL,
  }
  : {
    VITE_NEXGRID_API_MODE: import.meta.env.VITE_NEXGRID_API_MODE,
    VITE_NEXGRID_API_BASE_URL: import.meta.env.VITE_NEXGRID_API_BASE_URL,
  };

function currentBrowserOrigin(): string {
  if (typeof window === "undefined") return "";
  const origin = window.location?.origin;
  return typeof origin === "string" ? origin.trim() : "";
}

export function readApiRuntimeConfig(
  env: Record<string, unknown> = runtimeEnv,
  browserOrigin = currentBrowserOrigin(),
): ApiRuntimeConfig {
  const mode = env.VITE_NEXGRID_API_MODE === "mock" ? "mock" : "remote";
  const configured = typeof env.VITE_NEXGRID_API_BASE_URL === "string"
    ? env.VITE_NEXGRID_API_BASE_URL.trim()
    : "";
  // Vite erases this whole branch from production builds. Keeping the local
  // endpoint in a named DEV-only environment variable prevents it becoming a
  // production bundle fallback while retaining an explicit local workflow.
  const developmentFallback = import.meta.env.DEV
    && typeof env.VITE_NEXGRID_API_DEV_BASE_URL === "string"
    ? env.VITE_NEXGRID_API_DEV_BASE_URL.trim()
    : "";
  return {
    mode,
    // A static H5 bundle is normally mounted behind the public API gateway.
    // Use that origin when a separate API origin is not supplied, so a valid
    // remote build never crashes during module initialization before the
    // login/error surface can render. Cross-origin deployments stay explicit.
    baseUrl: mode === "mock" ? "" : configured || developmentFallback || browserOrigin,
  };
}
