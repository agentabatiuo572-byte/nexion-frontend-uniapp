<!--
  Device inventory (设备仓库) — ported from
  Nexion-prototype/app/(main)/me/devices/page.tsx.

  Full per-device list with activate/deactivate. Two sections:
    - Active: devices currently contributing to earnings (slot-capped)
    - Inventory: purchased but not yet activated (no slot impact)
  Slot cap (MAX_DEVICES) applies to ACTIVE devices only; a running free trial
  reserves a shadow slot too (composed here — stores don't import each other).
  A device with a running task routes through DeviceDeactivateSheet (wait/force).

  Wrapped in <AppChassis active="me">; SubPageHeader (back chevron) scrolls
  with content (no chassis-level back row in uni — see sub-page-header.vue).

  FEAT-DEV02: each paid eligible device row carries an upgrade trade-in strip
  (「可抵 $X」chip → ladder sheet · 「升级置换」CTA → retire flow via the
  chassis-mounted TradeinSheets). Free devices (paidPriceUsdt=0) show no trace;
  a device with no higher-priced target shows the disabled reason instead.
-->
<template>
  <AppChassis active="me">
    <view class="pb-8" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/me" :title="t.myDevices.inventoryTitle" />

      <view class="mx-4" :style="slotCaptionStyle">
        <text class="block" :style="subtitleStyle">{{ slotMeterLabel }}</text>
      </view>

      <view class="mx-4">
        <!-- Slot meter — de-carded: sits on the page floor. -->
        <view :style="meterBlockStyle">
          <view class="flex items-center justify-between">
            <text :style="meterLabelStyle">{{ t.myDevices.inventorySlotsLabel }}</text>
            <view class="flex items-baseline" style="gap: 4px">
              <text :style="meterCountStyle">{{ slotsUsed }}</text>
              <text :style="meterMaxStyle">/ {{ MAX_DEVICES }}</text>
            </view>
          </view>
          <view class="flex" style="gap: 6px; margin-top: 8px">
            <view v-for="i in MAX_DEVICES" :key="i" :style="segStyle(i - 1)" />
          </view>
        </view>

        <ComputeShareEntry context="devices" />

        <!-- Trial device — NexGridBox S1 on free trial (shadow, not a real device).
             Cancel-trial lives here in device management. -->
        <view v-if="trialActive" class="overflow-hidden" :style="trialCardStyle">
          <view class="flex items-center" style="gap: 12px; padding: 12px 16px">
            <view class="grid place-items-center shrink-0" :style="trialIconBoxStyle">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2" /><rect width="20" height="8" x="2" y="14" rx="2" ry="2" /><line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" /></svg>
            </view>
            <view class="flex-1 min-w-0">
              <view class="flex items-center" style="gap: 6px">
                <text class="truncate" :style="trialNameStyle">NexGridBox S1</text>
                <text :style="trialBadgeStyle">{{ t.trial.ghostBadge }}</text>
              </view>
              <text class="block" :style="trialSubStyle">{{ t.trial.deviceRowSub }}</text>
            </view>
          </view>
          <!-- Spec ④: user cancel exists on the active edge only — grace has
               nothing running to cancel (production already stopped). -->
          <view v-if="trial.status === 'active'" class="w-full flex items-center justify-center active:opacity-80" :style="trialCancelStyle" @click="handleCancelTrial">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></svg>
            <text :style="trialCancelLabelStyle">{{ t.trial.cancelCta }}</text>
          </view>
        </view>

        <!-- Active fleet -->
        <view v-if="activeDevices.length > 0" style="margin-top: 12px">
          <view class="flex items-center justify-between" style="padding: 0 4px; margin-bottom: 8px">
            <text :style="sectionTitleStyle">{{ t.myDevices.inventorySectionActive }}</text>
            <text :style="sectionCountStyle">{{ activeDevices.length }}</text>
          </view>
          <view style="display: flex; flex-direction: column; gap: 8px">
            <DeviceInventoryRow
              v-for="d in activeDevices"
              :key="d.id"
              :device="d"
              :active="true"
              :activate-label="t.myDevices.inventoryRowActivate"
              :deactivate-label="t.myDevices.inventoryRowDeactivate"
              :slots-full-label="t.myDevices.inventoryRowSlotsFull"
              :pending-chip-label="t.myDevices.inventoryPendingDeactivateChip"
              v-bind="tradeinStrip(d)"
              @toggle="handleDeactivate(d)"
              @tradein="handleTradein(d)"
              @ladder="ladderDevice = d"
            />
          </view>
        </view>

        <!-- Inventory (purchased but not activated) -->
        <view v-if="inactiveDevices.length > 0" style="margin-top: 12px">
          <view class="flex items-center justify-between" style="padding: 0 4px; margin-bottom: 8px">
            <text :style="sectionTitleStyle">{{ t.myDevices.inventorySectionInventory }}</text>
            <text :style="sectionCountStyle">{{ inactiveDevices.length }}</text>
          </view>
          <view style="display: flex; flex-direction: column; gap: 8px">
            <DeviceInventoryRow
              v-for="d in inactiveDevices"
              :key="d.id"
              :device="d"
              :active="false"
              :disabled="slotsFull"
              :activate-label="t.myDevices.inventoryRowActivate"
              :deactivate-label="t.myDevices.inventoryRowDeactivate"
              :slots-full-label="t.myDevices.inventoryRowSlotsFull"
              :pending-chip-label="t.myDevices.inventoryPendingDeactivateChip"
              v-bind="tradeinStrip(d)"
              @toggle="handleActivate(d)"
              @tradein="handleTradein(d)"
              @ladder="ladderDevice = d"
            />
          </view>
          <view v-if="slotsFull" class="flex items-center" :style="slotsFullWarnStyle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
            <text>{{ t.myDevices.inventorySlotsFullWarning }}</text>
          </view>
        </view>

        <!-- 空库存 —— 《06》的转化型空态 no-owned-asset:插画 + 引导 + 明确 CTA。
             空态自带 CTA,所以下面那个常驻「去商店」按钮此时收起,不重复两个同义按钮。 -->
        <EmptyState
          v-if="inventoryEmpty"
          kind="no-owned-asset"
          :title="t.empty.devicesTitle"
          :desc="t.empty.devicesDesc"
          :cta-label="t.empty.devicesCta"
          emphasis
          @cta="goStore"
        />

        <!-- Add-device CTA -->
        <view v-else class="flex items-center justify-center active:scale-[0.98]" :style="ctaStyle" style="margin-top: 12px" @click="goStore">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
          <text :style="ctaLabelStyle">{{ t.myDevices.inventoryCtaGoStore }}</text>
        </view>
      </view>
    </view>

    <DeviceDeactivateSheet
      :device="sheetDevice"
      @wait="onSheetWait"
      @force="onSheetForce"
      @dismiss="sheetDevice = null"
    />
    <TradeinLadderSheet :device="ladderDevice" @close="ladderDevice = null" />
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import DeviceInventoryRow from "@/components/me/device-inventory-row.vue";
import EmptyState from "@/components/empty-state.vue";
import DeviceDeactivateSheet from "@/components/me/device-deactivate-sheet.vue";
import TradeinLadderSheet from "@/components/me/tradein-ladder-sheet.vue";
import ComputeShareEntry from "@/components/earn/compute-share-entry.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { useFreeTrial } from "@/store/free-trial";
import { useTradeinSheet } from "@/store/tradein-sheet";
import { MAX_DEVICES } from "@/store/device-types";
import { PRODUCTS } from "@/mock/products";
import { computeTradeInCredit, TRADEIN_LADDER_RULES, DEFAULT_TRADEIN_CONFIG } from "@/mock/tradein-config";
import { isDeviceTaskBlocked } from "@/mock/eligibility";
import { getMonthsSince, isTradeInTargetAvailable } from "@/store/product-phase";
import { useProductPhase } from "@/composables/use-product-phase";
import type { Device } from "@/store/types";
import { confirm as uiConfirm, toast } from "@/store/ui";

const t = useT();
const app = useApp();
const trial = useFreeTrial();

// Typed against TrialStatus so a future enum change fails tsc here instead of
// silently widening to string[] (FEAT-TRIAL02 audit trap).
const trialActive = computed(() => trial.status === "active" || trial.status === "grace");
const activeDevices = computed(() => app.visibleDevices.filter((d) => d.activatedAt !== null));
const inactiveDevices = computed(() => app.visibleDevices.filter((d) => d.activatedAt === null));
const inventoryEmpty = computed(() => activeDevices.value.length === 0 && inactiveDevices.value.length === 0);

// Trial reserves a slot too (shadow device, not in devices[]).
const trialReserved = computed(() => (trialActive.value ? 1 : 0));
const slotsUsed = computed(() => app.activeSlotCount + trialReserved.value);
const slotsFull = computed(() => slotsUsed.value >= MAX_DEVICES);

const slotMeterLabel = computed(() =>
  fmt(t.value.myDevices.inventorySlotMeter, { active: slotsUsed.value, max: MAX_DEVICES }),
);

// Deactivate sheet (running-task branch) — page-driven (no chassis store).
const sheetDevice = ref<Device | null>(null);

// ── FEAT-DEV02 升级置换条 ──────────────────────────────────────────────
// 总开关关 / 免费设备(paidPriceUsdt=0)/不在 applyTo 白名单 → 返回空对象 =
// 行内零痕迹;无合规目标 → 只给禁用原因;其余给「可抵 $X」chip + 置换 CTA。
// 默认规则(promoMult=1)下抵扣额与目标无关,取最低升级价参与计算即为真值;
// promoMult>≈1.47 时 clamp 才可能绑定,届时各面按各自目标价如实显示。
const tradeinSheet = useTradeinSheet();
const ladderDevice = ref<Device | null>(null);
// 上架节奏门(FEAT-DEV02b):未正式上架且不在抢先购窗口的 SKU 不算升级目标。
const phase = useProductPhase();
const monthsSinceJoin = computed(() => getMonthsSince(app.user.joinedAt));

function tradeinStrip(d: Device): {
  tradeinCreditText?: string;
  tradeinCtaLabel?: string;
  tradeinDisabledText?: string;
} {
  if (!DEFAULT_TRADEIN_CONFIG.enabled) return {};
  const paid = d.paidPriceUsdt ?? 0;
  if (paid <= 0 || !TRADEIN_LADDER_RULES.applyTo.includes(d.kind)) return {};
  const targets = PRODUCTS.filter(
    (p) =>
      (!TRADEIN_LADDER_RULES.requireHigherPrice || p.price > paid) &&
      isTradeInTargetAvailable(p.unlocksAtPhase, phase.value, monthsSinceJoin.value),
  );
  if (targets.length === 0) return { tradeinDisabledText: t.value.tradein.stripNoTarget };
  const credit = computeTradeInCredit(
    paid,
    Math.max(0, d.cumulativeEarningsUsdt ?? 0),
    Math.min(...targets.map((p) => p.price)),
  );
  return {
    tradeinCreditText: fmt(t.value.tradein.stripCredit, { credit: credit.toFixed(2) }),
    tradeinCtaLabel: t.value.tradein.stripCta,
  };
}

function handleTradein(d: Device) {
  // 激活中且任务运行:阻断层(完成后可下架,查看任务/知道了),不硬拆(规格
  // DEV02A 异常2)。库存机的出厂任务不在跑,不阻断——判定单源 isDeviceTaskBlocked。
  if (isDeviceTaskBlocked(d)) {
    tradeinSheet.showRetireBlock(d.id, d.name);
    return;
  }
  tradeinSheet.showRetire(d.id);
}

async function handleActivate(d: Device) {
  if (slotsFull.value) {
    toast.warn(fmt(t.value.myDevices.inventoryToastSlotsFull, { max: MAX_DEVICES }));
    return;
  }
  // Pass the trial-reserved slot count so the store's MAX_DEVICES guard stays
  // authoritative without app.ts importing the trial store.
  const ok = app.activateDevice(d.id, trialReserved.value);
  if (ok) {
    toast.success(fmt(t.value.myDevices.inventoryToastActivated, { deviceName: d.name }));
  } else {
    toast.warn(fmt(t.value.myDevices.inventoryToastSlotsFull, { max: MAX_DEVICES }));
  }
}

async function handleDeactivate(d: Device) {
  // Running task → dedicated sheet offering wait / force / cancel.
  if (d.currentTask) {
    sheetDevice.value = d;
    return;
  }
  const ok = await uiConfirm({
    title: fmt(t.value.myDevices.inventoryConfirmDeactivateTitle, { deviceName: d.name }),
    message: t.value.myDevices.inventoryConfirmDeactivateMsg,
    confirmLabel: t.value.myDevices.inventoryConfirmDeactivateOk,
    cancelLabel: t.value.myDevices.inventoryConfirmDeactivateCancel,
  });
  if (ok) {
    app.deactivateDevice(d.id);
    toast.success(fmt(t.value.myDevices.inventoryToastDeactivated, { deviceName: d.name }));
  }
}

function onSheetWait() {
  const d = sheetDevice.value;
  if (!d) return;
  app.scheduleDeactivation(d.id);
  toast.success(fmt(t.value.deactivateSheet.toastScheduled, { name: d.name }));
  sheetDevice.value = null;
}

function onSheetForce() {
  const d = sheetDevice.value;
  if (!d) return;
  app.deactivateDevice(d.id);
  toast.warn(fmt(t.value.deactivateSheet.toastForced, { name: d.name }));
  sheetDevice.value = null;
}

async function handleCancelTrial() {
  const ok = await uiConfirm({
    title: t.value.trial.cancelConfirmTitle,
    message: t.value.trial.cancelConfirmMsg,
    confirmLabel: t.value.trial.cancelConfirmOk,
    cancelLabel: t.value.trial.cancelConfirmKeep,
  });
  if (ok) {
    trial.cancel();
    toast.info(t.value.trial.toastCancelled);
  }
}

function goStore() {
  uni.reLaunch({ url: "/pages/store/store", fail: () => {} });
}

// ── styles ──
function segStyle(i: number): CSSProperties {
  return {
    flex: 1,
    height: "6px",
    borderRadius: "999px",
    background: i < slotsUsed.value ? "var(--v5-brand)" : "var(--v5-surface-3)",
  };
}

// Lead caption sits at the content edge (2px inset); no top margin (global gap).
const slotCaptionStyle: CSSProperties = {
  padding: "0 2px",
  marginBottom: "10px",
};
const subtitleStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
// De-carded: slot meter sits on the page floor (2px optical inset).
const meterBlockStyle: CSSProperties = {
  padding: "0 2px",
};
const meterLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
const meterCountStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const meterMaxStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  color: "var(--v5-ink-3)",
};
// De-carded device card (form b): filled surface, no border.
const trialCardStyle: CSSProperties = {
  marginTop: "12px",
  borderRadius: "16px",
  background: "var(--v5-surface)",
};
const trialIconBoxStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "8px",
  background: "color-mix(in srgb, var(--v5-brand) 15%, transparent)",
};
const trialNameStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const trialBadgeStyle: CSSProperties = {
  padding: "1px 6px",
  borderRadius: "4px",
  background: "color-mix(in oklab, var(--v5-brand-2) 16%, transparent)",
  color: "var(--v5-brand-2)",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};
const trialSubStyle: CSSProperties = {
  marginTop: "2px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
const trialCancelStyle: CSSProperties = {
  gap: "6px",
  height: "44px",
  borderTop: "1px solid var(--v5-border)",
};
const trialCancelLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--v5-brand-2)",
};
const sectionTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const sectionCountStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
const slotsFullWarnStyle: CSSProperties = {
  gap: "6px",
  marginTop: "8px",
  fontSize: "12px",
  color: "var(--v5-warning)",
};
// Empty state (de-card whitelist): dashed outline, no fill.
const emptyCardStyle: CSSProperties = {
  marginTop: "12px",
  borderRadius: "16px",
  border: "1px dashed var(--v5-border-strong)",
  padding: "32px 20px",
  textAlign: "center",
};
const emptyIconStyle: CSSProperties = {
  width: "48px",
  height: "48px",
  margin: "0 auto",
  borderRadius: "999px",
  background: "var(--v5-surface-2)",
};
const emptyTitleStyle: CSSProperties = {
  marginTop: "12px",
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const emptyBodyStyle: CSSProperties = {
  marginTop: "4px",
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.375,
};
const ctaStyle: CSSProperties = {
  gap: "6px",
  height: "48px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
};
const ctaLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--v5-on-brand)",
};
</script>
