import { defineStore } from "pinia";
import { ref } from "vue";
import { useApp } from "./app";
import type { DeviceKind } from "./types";

/**
 * Trade-in flow sheet state machine — Batch C (2026-05-27).
 * Ported from Nexion-prototype/lib/store/tradein-sheet.ts (zustand → Pinia).
 *
 * Single discriminated union enforces "only one sheet open at a time" rule
 * from Batch C spec (prevents double-open from rapid taps). Each show* action
 * transitions from any current state, so the natural sheet chain
 * (choice → tradein, replace → block) works without manual close-then-open.
 *
 * No persistence — sheet state is ephemeral UI; closing or reloading
 * dismisses everything.
 *
 * Note: the union lives on ONE `ref` (whole object replaced atomically by each
 * setter), so Vue reactivity is stable — this is NOT a Set/Map membership case
 * (P-027). `state.value.kind` discriminates which sheet renders.
 */
export type TradeinSheetState =
  | { kind: "none" }
  | {
      kind: "choice";
      targetKind: DeviceKind;
      newPrice: number;
      /** Owned device kinds the user could trade in for `targetKind`. */
      tradeInSources: DeviceKind[];
    }
  | {
      kind: "tradein";
      oldDeviceId: string;
      newKind: DeviceKind;
      newPrice: number;
    }
  | {
      kind: "replace";
      newKind: DeviceKind;
      newPrice: number;
      /** Pre-computed lowest-yield active device id, snapshotted at the moment
       *  `showReplace` is called. Sheet uses this id to look up the actual
       *  device — avoiding the previous "recompute lowest per render" bug
       *  (Batch C Round 1 P1 #10), which caused the displayed target device to
       *  drift between sheet open and user tap if `tick()` shifted the active
       *  devices' `todayEarnings` ordering in between. */
      oldDeviceId: string;
    }
  | {
      kind: "block";
      /** Lowest active device blocking the replace because of a running task. */
      oldDeviceId: string;
      oldDeviceName: string;
      newKind: DeviceKind;
      newPrice: number;
    };

export const useTradeinSheet = defineStore("tradeinSheet", () => {
  const state = ref<TradeinSheetState>({ kind: "none" });

  function showChoice(
    targetKind: DeviceKind,
    newPrice: number,
    tradeInSources: DeviceKind[],
  ) {
    state.value = { kind: "choice", targetKind, newPrice, tradeInSources };
  }

  function showTradein(oldDeviceId: string, newKind: DeviceKind, newPrice: number) {
    state.value = { kind: "tradein", oldDeviceId, newKind, newPrice };
  }

  function showReplace(newKind: DeviceKind, newPrice: number) {
    // Snapshot lowest-yield active device id at call time. Prevents the
    // "lowest drifts mid-sheet" Batch C R1 P1 #10 attack — even if tick()
    // re-orders earnings between open + tap, the sheet keeps targeting the
    // device the user expected.
    const devices = useApp().devices;
    const active = devices.filter((d) => d.activatedAt !== null);
    if (active.length === 0) {
      // No active device to replace — caller's slot-full assumption is wrong
      // (active count < MAX_DEVICES). Bail out instead of opening a stuck
      // sheet; checkout's normal payment path will resume.
      state.value = { kind: "none" };
      return;
    }
    const lowest = active.reduce((acc, d) =>
      d.todayEarnings < acc.todayEarnings ? d : acc,
    );
    state.value = { kind: "replace", newKind, newPrice, oldDeviceId: lowest.id };
  }

  function showBlock(
    oldDeviceId: string,
    oldDeviceName: string,
    newKind: DeviceKind,
    newPrice: number,
  ) {
    state.value = { kind: "block", oldDeviceId, oldDeviceName, newKind, newPrice };
  }

  function hide() {
    state.value = { kind: "none" };
  }

  return { state, showChoice, showTradein, showReplace, showBlock, hide };
});
