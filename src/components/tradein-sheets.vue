<!--
  Trade-in sheet flow — chassis-level bottom sheets. Ported from
  Nexion-prototype/app/components/tradein-sheets.tsx (Batch C, 2026-05-27).

  Five overlapping sheets share ONE `useTradeinSheet` discriminated-union state
  machine so only one is visible at a time (prevents double-open from rapid
  taps). Branch is gated by `state.kind`, not local props:

    1.   choice  — entry fork at checkout when the user owns ≥1 retirable
         device toward the target SKU. Trade in (→ tradein) or pay full price
         (→ replace if slot-full, else dismiss + caller proceeds).
    1.5  retire  — FEAT-DEV02 devices-page entry: pick a higher-priced upgrade
         target for the chosen device (select list, no free input) → tradein.
    2.   tradein — confirm card (lifetime output / ladder band / credit / est.
         payable). Confirm writes the checkout credit context
         (sheet.applyTradein) and routes to checkout — money + device mutation
         happen atomically in checkout's persist block, not here.
    3.   replace — Path B slot-full prompt. Demote the lowest-yield active
         device (or keep all slots + store new device in inventory).
    4.   block   — mid-task gate, split by origin: replace → wait / force
         (forfeits reward); retire → view task / dismiss (no force teardown).

  Port notes:
    · framer slide/fade           → CSS @keyframes (tradein-fade / -slide-up)
    · lucide X/ArrowRightLeft/...  → inline <svg stroke="currentColor"/var()>
    · zustand getState/setState    → Pinia store refs (useApp().devices, etc.)
    · all bare text wrapped in <text> (cross-end, P-026/030)
    · <button> → <view @click> (P-036); uni.navigateTo replaces router.replace

  ⚠️ MOCK-ONLY CROSS-STORE COMPOSERS
  ---
  Touches stores: useApp (devices/balance), useBills, useTradeinSheet.
  Path B (replace/keep-buy/force) composers mutate app.devices + debit here with
  documented rollback ordering. The FEAT-DEV02 trade-in path deliberately does
  NOT mutate here — it defers to checkout's single persist block. Production:
  each flow maps to a single server transaction; the client mirrors the rollback.

  Endpoints (all TBD; candidate names, not yet in PRD §9.11):
    - Trade-in:         POST /api/orders (tradeInDeviceId; server re-computes
                        the ladder credit + retires the device transactionally)
    - Path B replace:   POST /api/devices/deactivate + POST /api/store/checkout
    - Path B keep+buy:  POST /api/store/checkout (new device lands inactive)
-->
<template>
  <view v-if="state.kind !== 'none'" class="tis-root">
    <view class="tis-backdrop" @click="hide" />

    <view class="tis-panel" @click.stop>
      <view class="tis-close" @click="hide">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      </view>

      <!-- ─────────── 1. choice — trade-in or full price ─────────── -->
      <template v-if="state.kind === 'choice'">
        <view class="tis-head">
          <text class="tis-title">{{ t.tradein.choiceTitle }}</text>
        </view>
        <view class="tis-opt-list">
          <view
            v-for="src in choiceSources"
            :key="src.id"
            class="tis-opt"
            @click="onChooseTradein(src.id)"
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

      <!-- ─────────── 1.5 retire — FEAT-DEV02 主动下架:选升级目标 ─────────── -->
      <template v-else-if="state.kind === 'retire' && retireView">
        <view class="tis-head">
          <text class="tis-title">{{ t.tradein.retireTitle }}</text>
          <text class="tis-subtitle">{{ retireView.subtitle }}</text>
        </view>
        <view class="tis-opt-list">
          <view v-for="p in retireView.targets" :key="p.id" class="tis-opt" @click="onPickTarget(p.id)">
            <svg class="tis-opt-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /></svg>
            <text class="tis-opt-text">{{ p.label }}</text>
          </view>
        </view>
        <view class="tis-ghost" @click="hide">
          <text class="tis-ghost-text">{{ t.tradein.sheetCancel }}</text>
        </view>
      </template>

      <!-- ─────────── 2. tradein — 置换确认(去结算) ─────────── -->
      <template v-else-if="state.kind === 'tradein' && tradeinView">
        <view class="tis-head tis-head-mb4">
          <text class="tis-title">{{ tradeinView.title }}</text>
        </view>

        <!-- 旧机 / 累计产出 / 档位 / 抵扣 / 预计应付 — soft surface card, no border -->
        <view class="tis-card">
          <view class="tis-row">
            <text class="tis-row-label">{{ t.tradein.sheetOldDeviceLabel }}</text>
            <text class="tis-row-value">{{ tradeinView.oldDeviceText }}</text>
          </view>
          <view class="tis-row">
            <text class="tis-row-label">{{ t.tradein.sheetEarnedLabel }}</text>
            <text class="tis-row-value tis-num">${{ tradeinView.earned }}</text>
          </view>
          <view class="tis-row">
            <text class="tis-row-label">{{ t.tradein.sheetBandLabel }}</text>
            <text class="tis-row-value">{{ tradeinView.bandText }}</text>
          </view>
          <view class="tis-row">
            <text class="tis-row-label">{{ t.tradein.sheetCreditLabel }}</text>
            <text class="tis-row-value tis-row-brand tis-num">−${{ tradeinView.credit }}</text>
          </view>
          <view class="tis-hr" />
          <view class="tis-row">
            <text class="tis-row-label">{{ t.tradein.sheetNetCostLabel }}</text>
            <text class="tis-row-value tis-row-emph tis-num">${{ tradeinView.estNet }}</text>
          </view>
        </view>

        <text class="tis-disclaimer">{{ t.tradein.sheetDisclaimer }}</text>

        <view class="tis-cta" :style="ctaHalo" @click="onConfirmTradein">
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

      <!-- 空态兜底:kind 已定但对应 view 为 null(设备/目标在弹层开着时消失,
           PR-D 债 #1)。置于全部具体分支之后、block 之前,只接住 view-null 漏网。 -->
      <template v-else-if="state.kind === 'retire' || state.kind === 'tradein' || state.kind === 'replace'">
        <view class="tis-head">
          <text class="tis-title">{{ t.tradein.errReplaceUnavailable }}</text>
          <text class="tis-subtitle">{{ t.tradein.errPleaseRetry }}</text>
        </view>
        <view class="tis-ghost" @click="hide">
          <text class="tis-ghost-text">{{ t.tradein.sheetCancel }}</text>
        </view>
      </template>

      <!-- ─────────── 4. block — pending-task block ─────────── -->
      <template v-else-if="state.kind === 'block'">
        <view class="tis-block-head">
          <svg class="tis-block-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
          <view class="tis-block-meta">
            <text class="tis-title">{{ blockTitle }}</text>
            <text class="tis-block-warn">{{ state.origin === 'retire' ? t.tradein.retireBlockWarning : t.tradein.blockWarning }}</text>
          </view>
        </view>

        <!-- retire 阻断:等任务完成即可下架 → 查看任务 / 知道了(无 force,规格 DEV02A 异常2) -->
        <template v-if="state.origin === 'retire'">
          <view class="tis-cta" @click="onGoTasks">
            <text class="tis-cta-text">{{ t.tradein.retireBlockViewTask }}</text>
          </view>
          <view class="tis-ghost" @click="hide">
            <text class="tis-ghost-text">{{ t.tradein.retireBlockOk }}</text>
          </view>
        </template>
        <template v-else>
          <view class="tis-cta" @click="onWait">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
            <text class="tis-cta-text">{{ t.tradein.blockWaitCta }}</text>
          </view>
          <view class="tis-warn-ghost" @click="onForce">
            <text class="tis-warn-ghost-text">{{ t.tradein.blockForceCta }}</text>
          </view>
          <view class="tis-ghost" @click="hide">
            <text class="tis-ghost-text">{{ t.tradein.blockCancel }}</text>
          </view>
        </template>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useTradeinSheet } from "@/store/tradein-sheet";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import { trialReservesSlotNow } from "@/store/free-trial";
import { toast } from "@/store/ui";
import { getProduct, PRODUCTS } from "@/mock/products";
import {
  MAX_DEVICES,
  DEVICE_SPECS,
  createDevice,
} from "@/store/device-types";
import { computeTradeInCredit, ladderBandFor, TRADEIN_LADDER_RULES } from "@/mock/tradein-config";
import { isDeviceTaskBlocked } from "@/mock/eligibility";
import { getMonthsSince, isPhaseReached, isTradeInTargetAvailable } from "@/store/product-phase";
import { useProductPhase } from "@/composables/use-product-phase";
import { navTo } from "@/lib/route";
import type { DeviceKind, Device } from "@/store/types";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";

const sheet = useTradeinSheet();
const app = useApp();
const bills = useBills();
const t = useT();
// 上架节奏门(FEAT-DEV02b):置换目标必须已正式上架,或处于抢先购窗口(开关默认关)。
const phase = useProductPhase();
const monthsSinceJoin = computed(() => getMonthsSince(app.user.joinedAt));

const state = computed(() => sheet.state);
const reservedSlots = computed(() => (trialReservesSlotNow() ? 1 : 0));

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

/** FEAT-DEV02 预览抵扣(阶梯)。真值 server-authoritative;与结算持久块同一算法。 */
function previewCredit(oldDevice: Device, targetPriceUsdt: number): number {
  return computeTradeInCredit(
    oldDevice.paidPriceUsdt ?? 0,
    Math.max(0, oldDevice.cumulativeEarningsUsdt ?? 0),
    targetPriceUsdt,
  );
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
  return s.tradeInSources
    .map((id) => app.devices.find((d) => d.id === id))
    .filter((d): d is Device => !!d)
    .map((d) => ({
      id: d.id,
      label: fmt(t.value.tradein.choiceTradeInOption, {
        name: d.name,
        credit: previewCredit(d, s.newPrice).toFixed(2),
      }),
    }));
});

function onChooseTradein(deviceId: string) {
  const s = state.value;
  if (s.kind !== "choice") return;
  const oldDevice = app.devices.find((d) => d.id === deviceId) ?? null;
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
  if (app.activeSlotCount + reservedSlots.value >= MAX_DEVICES) {
    sheet.showReplace(s.targetKind, s.newPrice);
  } else {
    hide();
  }
}

// ───────────────────── 1.5 retire — 主动下架:选升级目标 ─────────────────────

const retireView = computed(() => {
  const s = state.value;
  if (s.kind !== "retire") return null;
  const device = app.devices.find((d) => d.id === s.oldDeviceId) ?? null;
  if (!device) return null;
  const paid = device.paidPriceUsdt ?? 0;
  // 目标 = 目录中合规的可购 SKU(select 列表,不手输;规格 DEV02A ⑥)。
  // 「仅限更高价」与「已上架 ∨ 抢先购窗口」均为运营可配规则,消费 flag 不硬编码。
  const targets = PRODUCTS.filter(
    (p) =>
      (!TRADEIN_LADDER_RULES.requireHigherPrice || p.price > paid) &&
      isTradeInTargetAvailable(p.unlocksAtPhase, phase.value, monthsSinceJoin.value),
  ).map((p) => {
    // 抢先购窗口内的未正式上架目标,行尾加「抢先升级」标(默认关闭时零渲染)。
    const early = !!p.unlocksAtPhase && !isPhaseReached(phase.value, p.unlocksAtPhase);
    const base = fmt(t.value.tradein.retireTargetOption, {
      name: p.name,
      price: p.price.toLocaleString(),
      net: Math.max(0, +(p.price - previewCredit(device, p.price)).toFixed(2)).toLocaleString(),
    });
    return { id: p.id, label: early ? `${base} · ${t.value.tradein.retireEarlyTag}` : base };
  });
  return {
    subtitle: fmt(t.value.tradein.retireSubtitle, { name: device.name }),
    targets,
  };
});

function onPickTarget(productId: string) {
  const s = state.value;
  if (s.kind !== "retire") return;
  const device = app.devices.find((d) => d.id === s.oldDeviceId) ?? null;
  const p = getProduct(productId);
  if (!device || !p) {
    hide();
    toast.warn(t.value.tradein.errPleaseRetry);
    return;
  }
  sheet.showTradein(device.id, productId as DeviceKind, p.price);
}

// ───────────────────────── 2. tradein — 置换确认(去结算) ─────────────────────

const tradeinView = computed(() => {
  const s = state.value;
  if (s.kind !== "tradein") return null;
  const oldDevice = app.devices.find((d) => d.id === s.oldDeviceId) ?? null;
  if (!oldDevice) return null; // device vanished (already traded) — render nothing
  const paid = oldDevice.paidPriceUsdt ?? 0;
  const earned = Math.max(0, oldDevice.cumulativeEarningsUsdt ?? 0);
  const credit = previewCredit(oldDevice, s.newPrice);
  const band = ladderBandFor(paid, earned);
  const estNet = Math.max(0, +(s.newPrice - credit).toFixed(2));
  return {
    title: fmt(t.value.tradein.sheetTitle, {
      from: kindLabel(oldDevice.kind),
      to: kindLabel(s.newKind),
    }),
    // 只给设备名——内部 id 是工程标识,禁止渲染(页面文案禁字段名/枚举值)。
    oldDeviceText: oldDevice.name,
    earned: earned.toFixed(2),
    bandText: band
      ? fmt(t.value.tradein.sheetBandText, { band: band.band, pct: band.creditPct })
      : "—",
    credit: credit.toFixed(2),
    estNet: estNet.toFixed(2),
    ctaText: fmt(t.value.tradein.sheetCta, { amount: estNet.toFixed(2) }),
  };
});

function onConfirmTradein() {
  const s = state.value;
  if (s.kind !== "tradein" || confirming.value) return;
  const oldDevice = app.devices.find((d) => d.id === s.oldDeviceId) ?? null;
  if (!oldDevice) {
    hide();
    toast.warn(t.value.tradein.errPleaseRetry);
    return;
  }
  // 入口后任务才开始的竞态:退回阻断提示(规格 DEV02A 异常2)。判定单源
  // isDeviceTaskBlocked——库存机的出厂任务不在跑,不阻断。
  if (isDeviceTaskBlocked(oldDevice)) {
    sheet.showRetireBlock(oldDevice.id, oldDevice.name);
    return;
  }
  confirming.value = true;
  // FEAT-DEV02:确认 = 写入结算抵扣上下文,原子事务(净额扣款 + 移除旧机 + 新机
  // 未激活入库)统一发生在结算页持久块——本弹层不再直接动钱/动设备数组。
  sheet.applyTradein(oldDevice.id, s.newKind);
  const targetId = s.newKind;
  hide();
  const cur = (getCurrentPages().slice(-1)[0] as { route?: string } | undefined)?.route ?? "";
  if (!cur.includes("store/checkout")) {
    // 弹层退场后再路由(与 goDevices 同节奏),choice 路径本就在结算页则原地接管。
    setTimeout(() => {
      navTo(`/pages/store/checkout?product=${targetId}`);
    }, 260);
  }
  confirming.value = false;
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
    lowestText: fmt(t.value.tradein.replaceLowestText, {
      name: lowest.name,
      earn: lowest.todayEarnings.toFixed(2),
    }),
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
  const activated = app.activateDevice(newId, reservedSlots.value);
  if (!activated) {
    app.devices = app.devices.filter((d) => d.id !== newId);
    app.activateDevice(lowest.id, reservedSlots.value);
    toast.warn(t.value.tradein.errReplaceSlotConflict);
    confirming.value = false;
    return;
  }
  const debited = app.debitBalance(s.newPrice);
  if (!debited) {
    app.devices = app.devices.filter((d) => d.id !== newId);
    app.activateDevice(lowest.id, reservedSlots.value);
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
  confirming.value = false;
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
  confirming.value = false;
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

// retire 阻断:查看任务 → earn 页(该设备任务区)。
function onGoTasks() {
  hide();
  setTimeout(() => {
    navTo("/earn");
  }, 260);
}

function onForce() {
  const s = state.value;
  if (s.kind !== "block" || s.origin !== "replace" || confirming.value) return;
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
  const activated = app.activateDevice(newId, reservedSlots.value);
  if (!activated) {
    // Rollback: remove new, restore the snapshotted task, re-activate old.
    app.devices = app.devices
      .filter((d) => d.id !== newId)
      .map((d) => (d.id === lowest.id ? { ...d, currentTask: taskSnapshot } : d));
    app.activateDevice(lowest.id, reservedSlots.value);
    toast.warn(t.value.tradein.errReplaceSlotConflict);
    confirming.value = false;
    return;
  }
  const debited = app.debitBalance(s.newPrice);
  if (!debited) {
    app.devices = app.devices
      .filter((d) => d.id !== newId)
      .map((d) => (d.id === lowest.id ? { ...d, currentTask: taskSnapshot } : d));
    app.activateDevice(lowest.id, reservedSlots.value);
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
  confirming.value = false;
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
  background: var(--v5-bg-color-mask);
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
  top: 8px;
  right: 8px;
  width: 44px; /* 44×44 点按区(移动端最小触控标准;PR-D 债 #4) */
  height: 44px;
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
  font-size: 13px;
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
  font-size: 13px;
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
  font-size: 12px;
  color: var(--v5-ink-3);
}
.tis-card-line {
  display: block;
  font-size: 13px;
  color: var(--v5-ink);
}
.tis-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tis-row-label {
  font-size: 13px;
  color: var(--v5-ink-3);
}
.tis-row-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--v5-ink-2);
}
.tis-num {
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
  font-size: 12px;
  color: var(--v5-ink-3);
  line-height: 1.625;
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
  font-size: 13px;
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
  font-size: 13px;
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
  font-size: 13px;
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
  font-size: 13px;
  color: var(--v5-ink-3);
  margin-top: 4px;
  line-height: 1.625;
}
</style>
