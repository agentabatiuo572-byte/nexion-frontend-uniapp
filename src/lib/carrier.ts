// Front-end carrier (shell) detection — single source for SPEC-1 载体分层.
//
// The signed APP runs resident (background mining → online 加成, full live
// factors); H5 runs in a browser tab and mp-* are likewise non-resident →
// 基础托管 baseline (H5_BASE_FACTOR). The carrier is fixed at build time via
// uni-app conditional compilation, so this is a constant per build target.
//
// Drives `carrier` in lib/hashpower.ts and the carrier factor in earnings
// settlement (store/app.ts). PROD keeps the same shape (server doesn't override
// carrier — it's an intrinsic of the client build).

export type Carrier = "app" | "h5";

export function getCarrier(): Carrier {
  let carrier: Carrier = "h5"; // default: non-resident tier (H5 / mp-*)
  // #ifdef APP-PLUS
  carrier = "app";
  // #endif
  return carrier;
}
