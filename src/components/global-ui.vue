<template>
  <ToastHost v-if="showBusinessOverlays" />

  <!-- Confirm dialog (renders top of queue) -->
  <!-- 🔴 这个确认框被约 15 处资金操作复用(提现 / 充值 / 兑换 / 注销账户 / 解绑卡…)。
       此前两个按钮是裸 <view @click>:读屏不知道那是按钮、Tab 停不上去,于是键盘用户
       既确认不了也取消不了,而 confirm() 返回的 Promise 会永久悬空 —— 钱的流程卡死在这里。 -->
  <view
    v-if="topConfirm"
    class="nx-mask nx-mask--confirm nx-sheet-fade-in"
    role="dialog"
    aria-modal="true"
    :aria-label="topConfirm.title"
    @click="cancelConfirm"
  >
    <view class="nx-glass-sheet nx-modal nx-dialog-pop-in" :class="{ 'nx-modal--detail': topConfirm.rows?.length, 'nx-modal--rules': topConfirm.rules }" @click.stop>
      <view v-if="topConfirm.rows?.length && topConfirm.glyph" class="nx-modal__glyph" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg></view>
      <view v-else-if="topConfirm.icon" class="nx-modal__glyph" :class="`nx-modal__glyph--${topConfirm.icon}`" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <template v-if="topConfirm.icon === 'success'"><circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" /></template>
          <template v-else-if="topConfirm.icon === 'info'"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></template>
          <template v-else><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></template>
        </svg>
      </view>
      <text class="nx-modal__title">{{ topConfirm.title }}</text>
      <text v-if="topConfirm.message" class="nx-modal__msg">{{ topConfirm.message }}</text>
      <!-- Device decision (03 §3.5): the device block replaces the sentence; the consequence is one line under it (10.2). -->
      <view v-if="topConfirm.devices?.length" class="nx-modal__devices">
        <view v-for="(device, i) in topConfirm.devices" :key="i" class="nx-modal__device">
          <DeviceArt class="nx-modal__device-art" :src="device.image" />
          <view class="nx-modal__device-meta">
            <text class="nx-modal__device-name">{{ device.name }}</text>
            <view class="nx-modal__device-sub"><NxCodeValue v-if="device.code" class="nx-modal__device-code" :value="device.code" :label="device.name" :copyable="false" /><text class="nx-modal__device-fate">{{ device.code ? '· ' : '' }}{{ device.fate }}</text></view>
          </view>
        </view>
      </view>
      <view v-if="topConfirm.note" class="nx-modal__hint">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
        <text class="nx-modal__hint-t">{{ topConfirm.note }}</text>
      </view>
      <!-- Detail layout (e.g. withdrawal): a recessed list of what will happen, the last row the amount received. With rules,
           rows and rules share one scrolling region; without them the wrapper adds nothing. -->
      <!-- With rules the scrolling body is also a keyboard stop (03 §3.5), so arrows and PageDown read it to the end. -->
      <view v-if="topConfirm.rows?.length || topConfirm.rules" :class="{ 'nx-modal__scroll': topConfirm.rules }"
        :role="topConfirm.rules ? 'region' : undefined" :tabindex="topConfirm.rules ? 0 : undefined"
        :aria-label="topConfirm.rules ? fmt(t.ui.scrollRegion, { title: topConfirm.rules.title }) : undefined">
      <view v-if="topConfirm.rows?.length" class="nx-modal__rows">
        <view v-for="row in topConfirm.rows" :key="row.label" class="nx-modal__row" :class="{ 'nx-modal__row--amount': row.amount, 'nx-modal__row--code': row.code }">
          <text class="nx-modal__k">{{ row.label }}</text>
          <NxCodeValue v-if="row.code" class="nx-modal__code" :value="row.value" :label="row.label" full :copyable="false" />
          <text v-else-if="row.amount" class="nx-modal__v"><text class="nx-modal__cur">{{ amountAnatomy(row.value)[0] }}</text>{{ amountAnatomy(row.value)[1] }}<text class="nx-modal__dec">{{ amountAnatomy(row.value)[2] }}</text></text>
          <text v-else class="nx-modal__v">{{ row.value }}</text>
        </view>
      </view>
      <view v-if="topConfirm.rules" class="nx-modal__rules">
        <text class="nx-modal__rules-title" role="heading" aria-level="3">{{ topConfirm.rules.title }}</text>
        <NxRulesList :items="topConfirm.rules.items" />
      </view>
      </view>
      <view class="nx-modal__actions">
        <view
          v-if="!topConfirm.hideCancel"
          class="nx-btn nx-btn--ghost active:opacity-70"
          role="button"
          tabindex="0"
          @click="cancelConfirm"
        >
          <text class="nx-btn__label nx-btn__label--ghost">{{ topConfirm.cancelLabel || t.ui.cancel }}</text>
        </view>
        <view
          class="nx-btn nx-btn--primary active:opacity-85"
          role="button"
          tabindex="0"
          @click="ui.resolveConfirm(topConfirm.id, true)"
        >
          <text class="nx-btn__label">{{ topConfirm.confirmLabel || t.ui.confirm }}</text>
        </view>
      </view>
    </view>
  </view>

  <!-- Network-error overlay -->
  <view v-if="ui.netError.visible" class="nx-mask nx-mask--neterr nx-sheet-fade-in" role="dialog" aria-modal="true" :aria-label="ui.netError.title">
    <view class="nx-glass-sheet nx-modal nx-dialog-pop-in">
      <text class="nx-modal__title">{{ ui.netError.title }}</text>
      <text class="nx-modal__msg">{{ ui.netError.message }}</text>
      <view class="nx-modal__actions">
        <!-- 断网遮罩没有关闭出口,「重试」是唯一的路;键盘按不到它就等于被锁死在这一屏。 -->
        <view class="nx-btn nx-btn--primary active:opacity-85" role="button" tabindex="0" @click="onRetry">
          <text class="nx-btn__label">{{ t.ui.retry }}</text>
        </view>
      </view>
    </view>
  </view>

  <!-- Earnings milestone celebration (driven by useMilestones().active; App.vue
       polls + fires via store.show()) -->
  <MilestoneCelebration v-if="showBusinessOverlays" />
  <PaymentPasswordDialog v-if="showBusinessOverlays" />
  <PurchasePaymentDialog v-if="showBusinessOverlays" :show-resume="showPaymentResume" />
</template>

<script setup lang="ts">
import { useVisiblePageRoute } from "@/composables/use-visible-page-route";
import { computed } from "vue";
import ToastHost from "@/components/toast-host.vue";
import DeviceArt from "@/components/device-art.vue";
import NxCodeValue from "@/components/ui/nx-code-value.vue";
import NxRulesList from "@/components/ui/nx-rules-list.vue";
import { useUI } from "@/store/ui";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import MilestoneCelebration from "@/components/milestone-celebration.vue";
import PaymentPasswordDialog from "@/components/payment-password-dialog.vue";
import PurchasePaymentDialog from "@/components/purchase-payment-dialog.vue";
import { isStaticReviewRoute } from "@/lib/static-review-routes";
import { useDialogA11y } from "@/composables/use-dialog-a11y";

const ui = useUI();
const t = useT();
// Last enqueued confirm renders on top (LIFO), matching the original.
// "$999.00" → ["$", "999", ".00"] so the currency sign and cents can sit in ink-3 (amount anatomy).
function amountAnatomy(value: string): [string, string, string] {
  const match = /^(\$?)(.*?)(\.\d+)?$/.exec(value);
  return match ? [match[1], match[2], match[3] ?? ""] : ["", value, ""];
}
const topConfirm = computed(() => ui.confirmQueue[ui.confirmQueue.length - 1] || null);
const PAYMENT_RESUME_ENTRY_ROUTES: Record<string, true> = {
  "pages/login/login": true,
  "pages/register/register": true,
  "pages/register/success": true,
  "pages/ref/code": true,
  "pages/session/kicked": true,
};
const { route } = useVisiblePageRoute();
const showBusinessOverlays = computed(() => !!route.value && !isStaticReviewRoute(route.value));
const showPaymentResume = computed(() => {
  const current = route.value;
  return PAYMENT_RESUME_ENTRY_ROUTES[current] !== true
    && !current.startsWith("pages/onboarding/")
    && !current.includes("store/order-detail")
    && !current.includes("store/orders");
});

function onRetry() {
  const cb = ui.netError.onRetry;
  ui.hideNetError();
  cb?.();
}

function cancelConfirm() {
  if (topConfirm.value && !topConfirm.value.hideCancel) ui.resolveConfirm(topConfirm.value.id, false);
}

// 确认框:Esc = 取消(与点遮罩同义),Tab 只在框内循环,关掉后焦点回到触发它的按钮。
// Opening focus stays on the first action (cancel, else the primary) even when the scrolling body before it is a Tab stop.
useDialogA11y(
  computed(() => topConfirm.value !== null),
  ".nx-mask--confirm",
  cancelConfirm,
  true, 10,
  () => document.querySelector(".nx-mask--confirm .nx-modal__actions [role=\"button\"]"),
);
// 断网遮罩:**不传 close** —— 它只有「重试」一条路,没有取消语义。
// 给它接 Esc 会凭空造出一个"看起来关掉了、其实什么都没做"的出口。
// Both global masks use z-index 9100; the network mask renders last, above confirmation.
useDialogA11y(computed(() => ui.netError.visible), ".nx-mask--neterr", undefined, true, 11);


</script>

<style scoped>
/* ───── Modal (confirm + netError): same anatomy as NxNoticeDialog ───── */
.nx-mask {
  position: fixed;
  inset: 0;
  z-index: 9100;
  background: var(--v5-bg-color-mask);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: max(24px, var(--nx-overlay-top)) 23px var(--nx-overlay-bottom);
}
.nx-modal {
  box-sizing: border-box;
  width: 100%;
  max-width: 344px;
  max-height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 28px 24px 12px;
  border-radius: var(--v5-radius-2xl);
  text-align: center;
}
.nx-modal > * { flex-shrink: 0; }
.nx-modal__title { font: 600 20px/28px var(--font-v5); color: var(--v5-ink); }
.nx-modal__msg {
  margin-top: 8px;
  font: var(--ui-type-body-weight, 400) var(--ui-type-body)/var(--ui-type-body-lh) var(--font-v5);
  color: var(--v5-ink-2);
  white-space: pre-line;
  overflow-wrap: break-word;
}
/* Primary on top, quiet cancel below. Cancel stays first in the DOM, so a money confirm still opens with focus on it. */
.nx-modal__actions {
  display: flex;
  flex-direction: column-reverse;
  gap: 4px;
  margin-top: 24px;
}
.nx-btn {
  box-sizing: border-box;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 10px 14px;
  border-radius: var(--v5-radius-full);
}
/* The confirm's main action is always the solid primary type (03 §3.1, §3.5); a destructive confirm says so in its
   title and copy, not with a red fill outside the four button types. `danger` stays in the confirm API for callers. */
.nx-btn--primary { background: var(--v5-brand); }
.nx-btn--ghost { min-height: 44px; background: transparent; }
/* Detail confirm (P-45): the same centred dialog with a badge and recessed rows. */
.nx-modal--detail { padding: 24px 20px 12px; }
.nx-modal__cur { margin-right: 2px; color: var(--v5-ink-3); font-size: .55em; letter-spacing: 0; }
.nx-modal__dec { color: var(--v5-ink-3); }
.nx-modal__glyph { display: grid; place-items: center; width: 56px; height: 56px; margin: 0 auto; border-radius: 50%; background: var(--v5-brand-soft); color: var(--v5-brand); }
.nx-modal__glyph--warn { background: color-mix(in srgb, var(--v5-warning) 14%, transparent); color: var(--v5-warning); }
.nx-modal__glyph--danger { background: color-mix(in srgb, var(--v5-danger) 14%, transparent); color: var(--v5-danger); }
.nx-modal__glyph--success { background: color-mix(in srgb, var(--v5-success) 14%, transparent); color: var(--v5-success); }
.nx-modal__glyph + .nx-modal__title { margin-top: 16px; }
.nx-modal__rows { margin-top: 16px; padding: 4px 14px; border-radius: 16px; text-align: left; background: color-mix(in srgb, var(--v5-ink) 4%, transparent); box-shadow: inset 0 2px 8px rgba(0,0,0,.45), inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .nx-modal__rows { box-shadow: inset 0 1px 4px rgba(20,16,8,.10), inset 0 0 0 1px var(--v5-border); }
.nx-modal__row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; min-height: 40px; padding: 8px 0; box-sizing: border-box; }
.nx-modal__row + .nx-modal__row { border-top: 1px solid var(--v5-border); }
.nx-modal__k { min-width: 0; max-width: 55%; overflow-wrap: break-word; color: var(--v5-ink-3); font: 400 12px/16px var(--font-v5); }
.nx-modal__v { min-width: 0; overflow-wrap: break-word; color: var(--v5-ink); font: 500 14px/20px var(--font-metric); text-align: right; font-variant-numeric: tabular-nums; }
/* A code row (payout address): the whole string on its own line under the label, mono, wrapping evenly (03 §3.6.1). */
.nx-modal__row--code { flex-direction: column; align-items: stretch; gap: 4px; }
.nx-modal__row--code .nx-modal__k { max-width: none; }
.nx-modal__code { color: var(--v5-ink); font: var(--ui-type-inline-figure-weight) var(--ui-type-inline-figure)/var(--ui-type-inline-figure-lh) var(--font-metric); }
.nx-modal__row--amount .nx-modal__v { color: var(--v5-success-ink); font: 500 20px/26px var(--font-amount); letter-spacing: -.02em; }
.nx-modal--detail .nx-modal__actions { margin-top: 20px; }
/* Rules under the rows: the dialog stops scrolling as a whole; the rows and rules scroll between a fixed head and actions. */
.nx-modal--rules { overflow: hidden; }
.nx-modal > .nx-modal__scroll { flex-shrink: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
/* The scrolling body takes keyboard focus: the shared focus ring for keyboard use, none for a tap. */
.nx-modal__scroll:focus { outline: none; }
.nx-modal__scroll:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.nx-modal__rules { margin-top: 20px; text-align: left; }
.nx-modal__rules-title { display: block; margin-bottom: 12px; color: var(--v5-ink); font: var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); }
/* Device block (03 §3.5): one surface-2 block, a row per device (art, name, number · where it goes), as the devices page. */
.nx-modal__devices { margin-top: 16px; padding: 4px 0; border-radius: var(--v5-radius-m); background: var(--v5-surface-2); text-align: left; }
.nx-modal__device { display: flex; align-items: center; gap: 10px; padding: 8px 12px 8px 6px; }
.nx-modal__device + .nx-modal__device { border-top: 1px solid color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.nx-modal__device-art { flex: none; width: 48px; height: 48px; margin: -4px 0; }
.nx-modal__device-meta { flex: 1 1 auto; min-width: 0; }
.nx-modal__device-name { display: block; overflow-wrap: break-word; color: var(--v5-ink); font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); }
.nx-modal__device-sub { display: flex; align-items: baseline; column-gap: 6px; margin-top: 2px; color: var(--v5-ink-3); font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); }
.nx-modal__device-code { flex: 0 1 auto; min-width: 0; color: var(--v5-ink-3); font: var(--ui-type-inline-figure-weight) var(--ui-type-meta)/var(--ui-type-list-subtitle-lh) var(--font-metric); letter-spacing: 0; }
.nx-modal__device-fate { flex: 0 0 auto; max-width: calc(100% - 11ch - 6px); overflow-wrap: break-word; }
/* 10.2 提示行: 16px warning icon, ink text at the 辅助说明 size, left-aligned under the block. */
.nx-modal__hint { display: flex; align-items: flex-start; gap: 8px; margin-top: 16px; text-align: left; }
.nx-modal__hint > svg, .nx-modal__hint > .nx-native-svg { flex: none; margin-top: calc((var(--ui-type-description-lh) - 16px) / 2); color: var(--v5-warning); }
.nx-modal__hint-t { min-width: 0; overflow-wrap: break-word; color: var(--v5-ink); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.nx-btn__label {
  min-width: 0;
  font: var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5);
  text-align: center;
  white-space: normal;
  overflow-wrap: break-word;
  color: var(--v5-on-brand);
}
/* The secondary exit is a text button under the primary: brand text, no container (03 §3.1, §3.5 居中确认框). */
.nx-btn__label--ghost { color: var(--v5-brand); }
</style>
