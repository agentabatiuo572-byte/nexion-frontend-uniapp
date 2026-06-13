<!--
  Trade-in sheet flow — chassis-level bottom sheets. Ported from
  Nexion-prototype/app/components/tradein-sheets.tsx (Batch C, 2026-05-27).

  Four overlapping sheets share ONE `useTradeinSheet` discriminated-union state
  machine so only one is visible at a time (prevents double-open from rapid
  taps). Branch is gated by `state.kind`, not local props:

    1. choice  — TradeInOrFullChoiceSheet: entry fork at checkout when the user
       owns a device tradeable for the target kind. Trade in (→ tradein) or pay
       full price (→ replace if slot-full, else dismiss + caller proceeds).
    2. tradein — Path A explicit trade-in. Salvage credit preview + net cost +
       atomic confirm. Composer rolls back if debit fails after the swap.
    3. replace — Path B slot-full prompt. Demote the lowest-yield active device
       (or keep all slots + store new device in inventory).
    4. block   — Path B sub-flow when the demote target is mid-task; user waits
       or force-replaces (forfeits the running reward).

  Port notes:
    · framer slide/fade           → CSS @keyframes (tradein-fade / -slide-up)
    · lucide X/ArrowRightLeft/...  → inline <svg stroke="currentColor"/var()>
    · zustand getState/setState    → Pinia store refs (useApp().devices, etc.)
    · all bare text wrapped in <text> (cross-end, P-026/030)
    · <button> → <view @click> (P-036); uni.navigateTo replaces router.replace

  ⚠️ MOCK-ONLY CROSS-STORE COMPOSERS
  ---
  Touches stores: useApp (devices/balance), useBills, useTradeinSheet.
  Each composer's ordering matters; rollback rules documented inline. uni's
  app store exposes no atomic replaceDevice/moveToInventory, so the device-array
  swap is composed here over app.devices (page/composer layer owns cross-store
  orchestration; the store keeps its slot-cap authority). Production: each flow
  maps to a single server transaction; the client mirrors the rollback.

  Endpoints (all TBD; candidate names, not yet in PRD §9.11):
    - Path A trade-in:  POST /api/devices/replace
    - Path B replace:   POST /api/devices/deactivate + POST /api/store/checkout
    - Path B keep+buy:  POST /api/store/checkout (new device lands inactive)
-->
<template>
  <view v-if="state.kind !== 'none'" class="tis-root">
    <view class="tis-backdrop" @click="hide" />

    <view class="tis-panel" @click.stop>
      <view class="tis-close" @click="hide">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      </view>

      <!-- ─────────── 1. choice — trade-in or full price ─────────── -->
      <template v-if="state.kind === 'choice'">
        <view class="tis-head">
          <text class="tis-title">{{ t.tradein.choiceTitle }}</text>
        </view>
        <view class="tis-opt-list">
          <view
            v-for="src in choiceSources"
            :key="src.fromKind"
            class="tis-opt"
            @click="onChooseTradein(src.fromKind)"
          >
            <svg class="tis-opt-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 4 4-4 4" /><path d="M20 7H4" /><path d="m8 21-4-4 4-4" /><path d="M4 17h16" /></svg>
            <text class="tis-opt-text">{{ src.label }}</text>
          </view>
          <view class="tis-opt" @click="onChooseFullPrice">
            <svg class="tis-opt-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18 8 4A2 2 0 0 1 22 8v8a2 2 0 0 1-1.17 1.82l-8 4a2 2 0 0 1-1.66 0l-8-4A2 2 0 0 1 2 16V8a2 2 0 0 1 1.17-1.82l8-4a2 2 0 0 1 1.66 0z" /><path d="m7 4.5 10 5" /></svg>
            <text class="tis-opt-text">{{ t.tradein.choiceFullPriceOption }}</text>
          </view>
        </view>
      </template>

      <!-- ─────────── 2. tradein — Path A explicit trade-in ─────────── -->
      <template v-else-if="state.kind === 'tradein' && tradeinView">
        <view class="tis-head tis-head-mb4">
          <text class="tis-title">{{ tradeinView.title }}</text>
        </view>

        <!-- surrender / salvage / net cost — soft surface card, no border -->
        <view class="tis-card">
          <view class="tis-row">
            <text class="tis-row-label">{{ t.tradein.sheetOldDeviceLabel }}</text>
            <text class="tis-row-value">{{ tradeinView.oldDeviceText }}</text>
          </view>
          <view class="tis-row">
            <text class="tis-row-label">{{ t.tradein.sheetSalvageLabel }}</text>
            <text class="tis-row-value tis-row-brand tis-num">${{ tradeinView.salvage }}</text>
          </view>
          <view class="tis-hr" />
          <view class="tis-row">
            <text class="tis-row-label">{{ t.tradein.sheetNetCostLabel }}</text>
            <text class="tis-row-value tis-row-emph tis-num">${{ tradeinView.netCost }}</text>
          </view>
        </view>

        <text class="tis-disclaimer">{{ t.tradein.sheetDisclaimer }}</text>

        <view
          class="tis-cta"
          :class="{ 'tis-cta-disabled': tradeinView.insufficient }"
          :style="tradeinView.insufficient ? undefined : ctaHalo"
          @click="onConfirmTradein"
        >
          <text class="tis-cta-text">{{ tradeinView.ctaText }}</text>
        </view>
        <view class="tis-ghost" @click="hide">
          <text class="tis-ghost-text">{{ t.tradein.sheetCancel }}</text>
        </view>
      </template>

      <!-- ─────────── 3. replace — Path B slot-full ─────────── -->
      <template v-else-if="state.kind === 'replace' && replaceView">
        <view class="tis-head">
          <text class="tis-title">{{ t.tradein.replaceTitle }}</text>
          <text class="tis-subtitle">{{ replaceView.warning }}</text>
        </view>

        <view class="tis-card tis-card-mb4">
          <text class="tis-card-cap">{{ t.tradein.replaceLowestDeviceLabel }}</text>
          <text class="tis-card-line">{{ replaceView.lowestText }}</text>
        </view>

        <view
          class="tis-cta"
          :class="{ 'tis-cta-disabled': replaceView.insufficient }"
          @click="onReplace"
        >
          <text class="tis-cta-text">{{ replaceView.replaceCta }}</text>
        </view>
        <view
          class="tis-secondary"
          :class="{ 'tis-cta-disabled': replaceView.insufficient }"
          @click="onKeepBuy"
        >
          <text class="tis-secondary-text">{{ replaceView.keepCta }}</text>
        </view>
        <view class="tis-ghost" @click="hide">
          <text class="tis-ghost-text">{{ t.tradein.replaceCancel }}</text>
        </view>
      </template>

      <!-- ─────────── 4. block — pending-task block ─────────── -->
      <template v-else-if="state.kind === 'block'">
        <view class="tis-block-head">
          <svg class="tis-block-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
          <view class="tis-block-meta">
            <text class="tis-title">{{ blockTitle }}</text>
            <text class="tis-block-warn">{{ t.tradein.blockWarning }}</text>
          </view>
        </view>

        <view class="tis-cta" @click="onWait">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
          <text class="tis-cta-text">{{ t.tradein.blockWaitCta }}</text>
        </view>
        <view class="tis-warn-ghost" @click="onForce">
          <text class="tis-warn-ghost-text">{{ t.tradein.blockForceCta }}</text>
        </view>
        <view class="tis-ghost" @click="hide">
          <text class="tis-ghost-text">{{ t.tradein.blockCancel }}</text>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useTradeinSheet } from "@/store/tradein-sheet";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import { toast } from "@/store/ui";
import { getProduct } from "@/mock/products";
import { getLifecycleSummary } from "@/store/device-lifecycle";
import {
  MAX_DEVICES,
  DEVICE_PRICE_USDT,
  DEVICE_SPECS,
  createDevice,
} from "@/store/device-types";
import { computeSalvageCredit, DEFAULT_TRADEIN_CONFIG } from "@/mock/tradein-config";
import type { DeviceKind, Device } from "@/store/types";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";

const sheet = useTradeinSheet();
const app = useApp();
const bills = useBills();
const t = useT();

const state = computed(() => sheet.state);

// Double-tap guard shared across composers — handlers run synchronously; flips
// at entry and resets on early returns / before navigation. Without this, two
// rapid taps on a slow device could fire a composer twice before the device
// array mutation propagates → double-bill / double-debit (Batch C R1 P0 #5).
const confirming = ref(false);

// ───────────────────────── helpers ─────────────────────────

/** Product catalog label for any DeviceKind. `phone` isn't in the store catalog
 *  (user-owned hardware), so fall back to the device spec name, then the raw
 *  kind — never a bare literal, never a missing i18n key. */
function kindLabel(kind: DeviceKind): string {
  return getProduct(kind)?.name ?? DEVICE_SPECS[kind]?.name ?? kind;
}

/** Preview-only salvage credit. Real value is server-authoritative; what we
 *  compute here mirrors the swap composer below. */
function previewSalvage(oldDevice: Device): number {
  const lifecycle = getLifecycleSummary(oldDevice);
  const price = DEVICE_PRICE_USDT[oldDevice.kind] ?? 0;
  return +computeSalvageCredit(price, lifecycle.monthsOwned, DEFAULT_TRADEIN_CONFIG).toFixed(2);
}

/** Pick the highest-tier owned active device matching `fromKind`. If multiple
 *  owned of the same kind, pick the one with most-decayed salvage (oldest,
 *  lowest credit) so the user trades the device closest to EOL. */
function chooseOldDevice(fromKind: DeviceKind): Device | null {
  const candidates = app.devices.filter(
    (d) => d.kind === fromKind && d.activatedAt !== null,
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((acc, d) => (previewSalvage(d) < previewSalvage(acc) ? d : acc));
}

const ctaHalo = computed(() => ({
  boxShadow: "0 0 24px color-mix(in oklab, var(--v5-brand) 35%, transparent)",
}));

function hide() {
  sheet.hide();
}

// ── deferred route past the sheet's exit so it doesn't flash on /me/devices ──
function goDevices() {
  setTimeout(() => {
    uni.reLaunch({ url: "/pages/me/devices", fail: () => {} });
  }, 260);
}

// ───────────────────────── 1. choice ─────────────────────────

const choiceSources = computed(() => {
  const s = state.value;
  if (s.kind !== "choice") return [];
  return s.tradeInSources.map((fromKind) => {
    const oldDevice = chooseOldDevice(fromKind);
    const credit = oldDevice ? previewSalvage(oldDevice) : 0;
    return {
      fromKind,
      label: fmt(t.value.tradein.choiceTradeInOption, {
        fromKind: kindLabel(fromKind),
        credit: credit.toFixed(2),
      }),
    };
  });
});

function onChooseTradein(fromKind: DeviceKind) {
  const s = state.value;
  if (s.kind !== "choice") return;
  const oldDevice = chooseOldDevice(fromKind);
  if (!oldDevice) {
    // Race: device disappeared between hint computation and click. Bail out
    // gracefully — user can retry from the product page.
    hide();
    toast.warn(t.value.tradein.errPleaseRetry);
    return;
  }
  sheet.showTradein(oldDevice.id, s.targetKind, s.newPrice);
}

function onChooseFullPrice() {
  const s = state.value;
  if (s.kind !== "choice") return;
  // If slot full, hand off to the replace sheet; else just dismiss (caller's
  // checkout flow proceeds normally to payment).
  const activeCount = app.devices.filter((d) => d.activatedAt !== null).length;
  if (activeCount >= MAX_DEVICES) {
    sheet.showReplace(s.targetKind, s.newPrice);
  } else {
    hide();
  }
}

// ───────────────────────── 2. tradein (Path A) ─────────────────────────

const tradeinView = computed(() => {
  const s = state.value;
  if (s.kind !== "tradein") return null;
  const oldDevice = app.devices.find((d) => d.id === s.oldDeviceId) ?? null;
  if (!oldDevice) return null; // device vanished (already traded) — render nothing
  const salvage = previewSalvage(oldDevice);
  const netCost = Math.max(0, +(s.newPrice - salvage).toFixed(2));
  const insufficient = netCost > app.user.usdtBalance;
  const shortfall = insufficient ? +(netCost - app.user.usdtBalance).toFixed(2) : 0;
  return {
    title: fmt(t.value.tradein.sheetTitle, {
      from: kindLabel(oldDevice.kind),
      to: kindLabel(s.newKind),
    }),
    oldDeviceText: `${oldDevice.name} · ${oldDevice.id}`,
    salvage: salvage.toFixed(2),
    netCost: netCost.toFixed(2),
    insufficient,
    ctaText: insufficient
      ? fmt(t.value.tradein.sheetInsufficient, { shortfall: shortfall.toFixed(2) })
      : fmt(t.value.tradein.sheetCta, { amount: netCost.toFixed(2) }),
  };
});

function onConfirmTradein() {
  const s = state.value;
  if (s.kind !== "tradein" || confirming.value) return;
  const oldDevice = app.devices.find((d) => d.id === s.oldDeviceId) ?? null;
  if (!oldDevice || oldDevice.activatedAt === null) {
    toast.warn(t.value.tradein.errReplaceUnavailable);
    return;
  }
  // Slot-cap defense-in-depth: replace is same-slot, but refuse if the result
  // would exceed MAX_DEVICES (the store keeps this authority for direct calls).
  const postActiveCount =
    app.devices.filter((d) => d.id !== oldDevice.id && d.activatedAt !== null).length + 1;
  if (postActiveCount > MAX_DEVICES) {
    toast.warn(t.value.tradein.errReplaceUnavailable);
    return;
  }
  confirming.value = true;

  // ⚠️ MOCK-ONLY CROSS-STORE COMPOSER — Path A trade-in.
  // Order: snapshot old → atomic swap (remove old + add active new) → compute
  // netCost → debit → on fail re-insert removedDevice snapshot + remove new →
  // on success write bill + toast + route.
  const salvage = previewSalvage(oldDevice);
  const newId = `${s.newKind}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
  const newDevice: Device = {
    ...createDevice(s.newKind, newId),
    activatedAt: Date.now(),
    // Lineage: each trade-in bumps generation (gen 1 → 2, 2 → 3 on repeats).
    generation: (oldDevice.generation ?? 1) + 1,
  };
  // removedDevice snapshot is the ONLY safe rollback source (array already
  // mutated, can't re-query) — Batch B audit Round 1 P0 #4.
  const removedDevice = oldDevice;
  app.devices = [...app.devices.filter((d) => d.id !== oldDevice.id), newDevice];

  const actualNetCost = Math.max(0, +(s.newPrice - salvage).toFixed(2));
  const debited = app.debitBalance(actualNetCost);
  if (!debited) {
    // Rollback: re-insert removedDevice snapshot, remove the new device.
    app.devices = [...app.devices.filter((d) => d.id !== newId), removedDevice];
    const shortfall = +(actualNetCost - app.user.usdtBalance).toFixed(2);
    toast.warn(fmt(t.value.tradein.sheetInsufficient, { shortfall: shortfall.toFixed(2) }));
    confirming.value = false;
    return;
  }
  bills.add({
    type: "purchase",
    symbol: "USDT",
    amount: -actualNetCost,
    status: "posted",
    memo: fmt(t.value.tradein.sheetBillMemo, {
      from: kindLabel(removedDevice.kind),
      to: kindLabel(s.newKind),
      credit: salvage.toFixed(2),
    }),
  });
  toast.success(fmt(t.value.tradein.sheetSuccessToast, { to: kindLabel(s.newKind) }));
  hide();
  goDevices();
}

// ───────────────────────── 3. replace (Path B) ─────────────────────────

const replaceView = computed(() => {
  const s = state.value;
  if (s.kind !== "replace") return null;
  const lowest = app.devices.find((d) => d.id === s.oldDeviceId) ?? null;
  if (!lowest) return null; // snapshot device vanished — render nothing
  const insufficient = s.newPrice > app.user.usdtBalance;
  return {
    warning: fmt(t.value.tradein.replaceWarning, { newKind: kindLabel(s.newKind) }),
    lowestText: `${lowest.name} · $${lowest.todayEarnings.toFixed(2)}/d`,
    insufficient,
    replaceCta: fmt(t.value.tradein.replaceReplaceCta, { newKind: kindLabel(s.newKind) }),
    keepCta: fmt(t.value.tradein.replaceKeepCta, { newKind: kindLabel(s.newKind) }),
  };
});

function onReplace() {
  const s = state.value;
  if (s.kind !== "replace" || confirming.value) return;
  const lowest = app.devices.find((d) => d.id === s.oldDeviceId) ?? null;
  if (!lowest) return;
  confirming.value = true;
  // ⚠️ MOCK-ONLY CROSS-STORE COMPOSER — Path B "Replace" branch.
  // Order: pending-task gate → moveToInventory(lowest) → addDevice(new) →
  //        activateDevice(new) → debit(newPrice) → bill / rollback.
  // Pending-task gate: refuse if a task is in-flight; user must choose
  // Force/Wait in the block sheet before reaching this path.
  if (lowest.currentTask !== null) {
    sheet.showBlock(lowest.id, lowest.name, s.newKind, s.newPrice);
    confirming.value = false;
    return;
  }
  if (lowest.activatedAt === null) {
    toast.warn(t.value.tradein.errDeviceAlreadyInactive);
    confirming.value = false;
    return;
  }
  app.deactivateDevice(lowest.id); // move old → inventory (frees slot)
  const newId = app.addDevice(s.newKind);
  const activated = app.activateDevice(newId);
  if (!activated) {
    app.devices = app.devices.filter((d) => d.id !== newId);
    app.activateDevice(lowest.id);
    toast.warn(t.value.tradein.errReplaceSlotConflict);
    confirming.value = false;
    return;
  }
  const debited = app.debitBalance(s.newPrice);
  if (!debited) {
    app.devices = app.devices.filter((d) => d.id !== newId);
    app.activateDevice(lowest.id);
    toast.warn(fmt(t.value.errors.insufficientBalanceMsg, { amt: s.newPrice.toFixed(2) }));
    confirming.value = false;
    return;
  }
  bills.add({
    type: "purchase",
    symbol: "USDT",
    amount: -s.newPrice,
    status: "posted",
    memo: fmt(t.value.tradein.replaceBillMemo, {
      newKind: kindLabel(s.newKind),
      oldKind: kindLabel(lowest.kind),
    }),
  });
  toast.success(
    fmt(t.value.tradein.replaceSuccessToast, {
      newKind: kindLabel(s.newKind),
      oldKind: kindLabel(lowest.kind),
    }),
  );
  hide();
  goDevices();
}

function onKeepBuy() {
  const s = state.value;
  if (s.kind !== "replace" || confirming.value) return;
  confirming.value = true;
  // ⚠️ MOCK-ONLY CROSS-STORE COMPOSER — Path B "Keep & buy" branch.
  // Order: addDevice (default inactive) → debit → bill / rollback. No demotion.
  const newId = app.addDevice(s.newKind);
  const debited = app.debitBalance(s.newPrice);
  if (!debited) {
    app.devices = app.devices.filter((d) => d.id !== newId);
    toast.warn(fmt(t.value.errors.insufficientBalanceMsg, { amt: s.newPrice.toFixed(2) }));
    confirming.value = false;
    return;
  }
  bills.add({
    type: "purchase",
    symbol: "USDT",
    amount: -s.newPrice,
    status: "posted",
    memo: fmt(t.value.tradein.keepBuyBillMemo, { newKind: kindLabel(s.newKind) }),
  });
  toast.success(fmt(t.value.tradein.keepBuySuccessToast, { newKind: kindLabel(s.newKind) }));
  hide();
  goDevices();
}

// ───────────────────────── 4. block (pending task) ─────────────────────────

const blockTitle = computed(() => {
  const s = state.value;
  if (s.kind !== "block") return "";
  return fmt(t.value.tradein.blockTitle, { deviceName: s.oldDeviceName });
});

function onWait() {
  // Cancel the replace flow — user retries once the task is done.
  hide();
}

function onForce() {
  const s = state.value;
  if (s.kind !== "block" || confirming.value) return;
  const lowest = app.devices.find((d) => d.id === s.oldDeviceId);
  if (!lowest) {
    hide();
    return;
  }
  confirming.value = true;
  // ⚠️ MOCK-ONLY CROSS-STORE COMPOSER — Path B "Force replace" branch.
  //
  // Task-forfeit safety (Batch C R2 P0): deactivateDevice wipes `currentTask`
  // as a side effect, so we snapshot the task BEFORE moving to inventory, then
  // restore both activatedAt AND currentTask via direct device-array writes on
  // any rollback. Success path skips the restore (task stays forfeit — the
  // whole point).
  //
  // Order: snapshot task → addDevice(new) → deactivate(old, clears task) →
  //   activate(new) → debit → bill. Each failure restores the old device's task.
  const taskSnapshot = lowest.currentTask;
  const newId = app.addDevice(s.newKind);
  app.deactivateDevice(lowest.id); // frees slot + wipes currentTask
  const activated = app.activateDevice(newId);
  if (!activated) {
    // Rollback: remove new, restore the snapshotted task, re-activate old.
    app.devices = app.devices
      .filter((d) => d.id !== newId)
      .map((d) => (d.id === lowest.id ? { ...d, currentTask: taskSnapshot } : d));
    app.activateDevice(lowest.id);
    toast.warn(t.value.tradein.errReplaceSlotConflict);
    confirming.value = false;
    return;
  }
  const debited = app.debitBalance(s.newPrice);
  if (!debited) {
    app.devices = app.devices
      .filter((d) => d.id !== newId)
      .map((d) => (d.id === lowest.id ? { ...d, currentTask: taskSnapshot } : d));
    app.activateDevice(lowest.id);
    toast.warn(fmt(t.value.errors.insufficientBalanceMsg, { amt: s.newPrice.toFixed(2) }));
    confirming.value = false;
    return;
  }
  // Success: task stays forfeit (deactivate already wiped it). PRODUCTION:
  // server atomically refunds/keeps the partial task reward + recycles slot +
  // writes ledger in one tx with idempotency key {userId}-{oldId}-{newKind}-{nonce}.
  bills.add({
    type: "purchase",
    symbol: "USDT",
    amount: -s.newPrice,
    status: "posted",
    memo: fmt(t.value.tradein.forceReplaceBillMemo, {
      newKind: kindLabel(s.newKind),
      oldKind: kindLabel(lowest.kind),
    }),
  });
  toast.success(
    fmt(t.value.tradein.replaceSuccessToast, {
      newKind: kindLabel(s.newKind),
      oldKind: kindLabel(lowest.kind),
    }),
  );
  hide();
  goDevices();
}
</script>

<style scoped>
.tis-root {
  position: fixed;
  inset: 0;
  z-index: 790;
}
.tis-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(8, 8, 12, 0.45);
  backdrop-filter: blur(8px) saturate(150%);
  -webkit-backdrop-filter: blur(8px) saturate(150%);
  animation: tradein-fade 0.24s ease-out;
}
.tis-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 800;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  background: var(--v5-surface);
  border-top: 1px solid var(--v5-border);
  padding: 18px 16px;
  padding-bottom: calc(env(safe-area-inset-bottom) + 38px);
  animation: tradein-slide-up 0.36s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes tradein-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes tradein-slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.tis-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: var(--v5-surface-2);
  display: grid;
  place-items: center;
  z-index: 2;
}
.tis-head {
  margin-bottom: 12px;
  padding-right: 40px;
}
.tis-head-mb4 {
  margin-bottom: 16px;
}
.tis-title {
  display: block;
  font-family: var(--font-v5);
  font-size: 15px;
  font-weight: 600;
  color: var(--v5-ink);
  line-height: 1.3;
}
.tis-subtitle {
  display: block;
  font-size: 12.5px;
  color: var(--v5-ink-3);
  margin-top: 4px;
  line-height: 1.5;
}
/* option list (choice sheet) */
.tis-opt-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tis-opt {
  width: 100%;
  min-height: 56px;
  border-radius: 12px;
  background: var(--v5-surface-2);
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.tis-opt:active {
  background: var(--v5-surface-3);
}
.tis-opt-ico {
  flex-shrink: 0;
}
.tis-opt-text {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  color: var(--v5-ink);
  line-height: 1.4;
}
/* detail card (tradein / replace sheets) */
.tis-card {
  border-radius: 12px;
  background: var(--v5-surface-2);
  padding: 12px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tis-card-mb4 {
  margin-bottom: 16px;
  gap: 4px;
}
.tis-card-cap {
  display: block;
  font-size: 11.5px;
  color: var(--v5-ink-3);
}
.tis-card-line {
  display: block;
  font-size: 13.5px;
  color: var(--v5-ink);
}
.tis-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tis-row-label {
  font-size: 12.5px;
  color: var(--v5-ink-3);
}
.tis-row-value {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--v5-ink-2);
}
.tis-num {
  font-family: var(--font-jet-mono), monospace;
  font-variant-numeric: tabular-nums;
}
.tis-row-brand {
  color: var(--v5-brand);
}
.tis-row-emph {
  font-size: 15px;
  font-weight: 600;
  color: var(--v5-ink);
}
.tis-hr {
  height: 1px;
  background: var(--v5-border);
}
.tis-disclaimer {
  display: block;
  font-size: 11.5px;
  color: var(--v5-ink-3);
  line-height: 1.6;
  margin-bottom: 16px;
}
/* CTAs */
.tis-cta {
  width: 100%;
  min-height: 48px;
  border-radius: 999px;
  background: var(--v5-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.tis-cta:active {
  transform: scale(0.98);
}
.tis-cta-disabled {
  opacity: 0.5;
}
.tis-cta-text {
  font-family: var(--font-v5);
  font-size: 15px;
  font-weight: 600;
  color: var(--v5-on-brand);
}
.tis-secondary {
  width: 100%;
  min-height: 44px;
  margin-top: 8px;
  border-radius: 999px;
  background: var(--v5-surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.tis-secondary:active {
  opacity: 0.7;
}
.tis-secondary-text {
  font-size: 13.5px;
  color: var(--v5-ink-2);
}
.tis-ghost {
  width: 100%;
  min-height: 44px;
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tis-ghost:active {
  opacity: 0.7;
}
.tis-ghost-text {
  font-size: 13.5px;
  font-weight: 400;
  color: var(--v5-ink-3);
}
.tis-warn-ghost {
  width: 100%;
  min-height: 44px;
  margin-top: 8px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tis-warn-ghost:active {
  opacity: 0.7;
}
.tis-warn-ghost-text {
  font-size: 13.5px;
  font-weight: 400;
  color: var(--v5-warning);
}
/* block sheet header */
.tis-block-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
  padding-right: 40px;
}
.tis-block-ico {
  flex-shrink: 0;
  margin-top: 2px;
}
.tis-block-meta {
  min-width: 0;
}
.tis-block-warn {
  display: block;
  font-size: 12.5px;
  color: var(--v5-ink-3);
  margin-top: 4px;
  line-height: 1.6;
}
</style>
