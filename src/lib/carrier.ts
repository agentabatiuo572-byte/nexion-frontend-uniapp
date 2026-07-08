// Front-end carrier (shell) detection — the device 登记载体 record + mock heartbeat source.
//
// The signed APP runs resident (background mining → stamps the device online
// heartbeat); H5 runs in a browser tab and mp-* are likewise non-resident → never
// stamp a heartbeat. The carrier is fixed at build time via uni-app conditional
// compilation, so this is a constant per build target.
//
// SPEC-1 R7: carrier is NO LONGER the earnings/display factor source. The factor
// tier is now driven by isDeviceOnline (a device heartbeat — see lib/hashpower.ts),
// so "用哪个端查看" no longer changes earnings. carrier is retained ONLY as (1) the
// 设备登记载体 record and (2) the mock heartbeat-source gate in store/app.ts settle()
// (App carrier stamps onlineHeartbeatAt; H5 never does). PROD keeps the same shape
// (server doesn't override carrier — it's an intrinsic of the client build).

export type Carrier = "app" | "h5";

export function getCarrier(): Carrier {
  let carrier: Carrier = "h5"; // default: non-resident tier (H5 / mp-*)
  // #ifdef APP-PLUS
  carrier = "app";
  // #endif
  return carrier;
}
