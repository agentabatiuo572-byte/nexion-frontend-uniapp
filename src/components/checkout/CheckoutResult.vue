<template>
  <view ref="rootView" class="checkout-result" :class="['checkout-result--' + state, 'is-' + phase]" :style="{ '--checkout-result-status-bar': statusBar + 'px', '--checkout-result-tray': trayHeight + 'px' }">
    <!-- Shared result head (03 §3.6.1); the energy base below is the result's body: the device stands on a floor ring
         that is the activation progress (approved board A). -->
    <view class="checkout-result__status"><NxResultHead :tone="headTone" :title="title" :description="description" /></view>
    <view class="checkout-result__stage">
      <view class="checkout-result__art">
        <view class="checkout-result__floor" aria-hidden="true" />
        <view v-if="haloShown" :key="phase" class="checkout-result__halo" :class="{ 'is-flash': phase === 'confirmed', 'is-bloom': phase === 'complete' && popped }" aria-hidden="true" />
        <!-- The ring passes behind the device on its far half and in front of it on its near half: one ring, two clips. -->
        <!-- Each ring SVG remounts whole when the state or phase changes (key): uni's H5 runtime loses the SVG namespace when it
             patches inside an existing <svg> (inserted nodes come out as HTML, a changed class throws), as NxResultHead's
             keyed icon also avoids. Nodes inside carry static classes; state styling hangs off the root's classes. -->
        <svg v-for="half in halves" :key="half + state + phase" class="checkout-result__ring" :data-half="half" viewBox="0 0 380 330" aria-hidden="true">
          <defs>
            <clipPath :id="uid + half"><rect :y="half === 'back' ? -40 : RING.cy" x="-40" width="460" :height="half === 'back' ? RING.cy + 40 : 120" /></clipPath>
            <linearGradient v-if="spinning" :id="uid + half + 'comet'" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="currentColor" stop-opacity="0" /><stop offset="1" stop-color="currentColor" stop-opacity=".7" /></linearGradient>
          </defs>
          <g :clip-path="'url(#' + uid + half + ')'">
            <template v-if="half === 'back' && phase === 'activating'">
              <ellipse v-for="ripple in 2" :key="ripple" class="checkout-result__ripple" :style="{ animationDelay: (ripple - 1) * 1000 + 'ms' }" :cx="RING.cx" :cy="RING.cy" :rx="RING.rx + 14" :ry="RING.ry + 4" />
            </template>
            <ellipse class="checkout-result__track" :cx="RING.cx" :cy="RING.cy" :rx="RING.rx" :ry="RING.ry" />
            <template v-if="phase === 'activating'">
              <path v-for="band in FILL_BANDS" :key="band.start" class="checkout-result__fill" :d="RING_PATH" pathLength="100" :style="{ '--band': 1 - band.start, strokeOpacity: band.opacity }" />
              <!-- The head rides the same path by distance (SMIL, as onboarding's orbit), so it stays on the fill's end. -->
              <g><animateMotion :path="RING_PATH" dur="3s" fill="freeze" calcMode="linear" keyPoints="0;1" keyTimes="0;1" /><circle class="checkout-result__head-pulse" r="11" /><circle class="checkout-result__head" r="4" /></g>
            </template>
            <g v-if="spinning" :transform="'translate(' + RING.cx + ' ' + RING.cy + ') scale(1 ' + RING.ry / RING.rx + ')'">
              <!-- Strokes keep their screen width under the squash (non-scaling-stroke); the zero-length round caps draw the head dot and its halo. -->
              <g class="checkout-result__spinner"><path :d="COMET_PATH" :stroke="'url(#' + uid + half + 'comet)'" vector-effect="non-scaling-stroke" /><path class="checkout-result__spinner-halo" :d="COMET_HEAD" vector-effect="non-scaling-stroke" /><path class="checkout-result__spinner-head" :d="COMET_HEAD" vector-effect="non-scaling-stroke" /></g>
            </g>
          </g>
        </svg>
        <!-- A bundle stands its models on the one base (up to three), the first in front; the name line under the stage says them. -->
        <template v-if="groupImages.length > 1">
          <image v-for="shot in groupImages" :key="shot.src" class="checkout-result__image checkout-result__image--group" :class="'checkout-result__image--' + shot.slot" :src="shot.src" alt="" mode="aspectFit" @error="failedImages.push(shot.src)" />
        </template>
        <image v-else-if="productImage && !imageFailed" class="checkout-result__image" :src="productImage" :alt="productName || copy.device" mode="aspectFit" @error="imageFailed = true" />
        <view v-else class="checkout-result__fallback" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2"><rect x="16" y="8" width="32" height="44" rx="4"/><path d="M24 18h16M24 26h16M24 34h16M20 56h24"/><circle cx="32" cy="43" r="2"/></svg></view>
        <view v-if="celebrating && phase === 'confirmed'" class="checkout-result__confetti" aria-hidden="true"><view v-for="spark in sparks" :key="spark.index" class="checkout-result__spark" :style="spark.style" /></view>
        <view v-if="(state === 'activated' || state === 'inventory') && phase === 'complete'" class="checkout-result__check" :class="{ 'is-pop': popped }" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></view>
      </view>
    </view>
    <view v-if="productLine || showPaidAmount || saved !== undefined" class="checkout-result__summary">
      <!-- completeLine (the trial purchase's 「… 已在 … 开始运行」) takes the product line's place once the head reaches
           its final state, so the name is said once (PRD 59). -->
      <text v-if="productLine" class="checkout-result__product">{{ productLine }}</text>
      <view v-if="showPaidAmount || saved !== undefined" class="checkout-result__stats">
        <view v-if="showPaidAmount" class="checkout-result__stat"><text class="checkout-result__label">{{ copy.paidAmount }}</text><CheckoutAmount class="checkout-result__amount" :value="amount" :currency="currency ?? 'USDT'" :precision="amountPrecision" :below-cent="amountBelowCent" /></view>
        <view v-if="saved !== undefined" class="checkout-result__stat"><text class="checkout-result__label">{{ trialCopy.resultSaved }}</text><CheckoutAmount class="checkout-result__amount" :value="saved" :currency="currency ?? 'USDT'" /></view>
      </view>
    </view>
    <!-- Host content under the summary (the trial reward card). The page's exits are not here: they sit in the host's
         bottom bar (04 §4.0), read from exits/done below, and wait for the presentation (PRD purchase payment, line 49).
         A delivery to inventory shows no host content: its two exits are the whole next step. -->
    <slot v-if="state !== 'inventory'" :done="phase === 'complete'" />
  </view>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onHide, onShow } from '@/composables/use-tab-page-lifecycle';
import { readAccountRow, writeAccountRow } from '@/store/account-scoped-storage';
import { useApp } from '@/store/app';
import { useLocaleStore } from '@/store/locale';
import { checkoutFlowCopy } from '@/lib/checkout-flow-copy';
import NxResultHead from '@/components/ui/nx-result-head.vue';
import { fmt } from '@/i18n/format';
import { navReset } from '@/lib/route';
import type { OrderDeviceDelivery } from '@/api/order-api';
import { purchasePaymentCopy } from '@/lib/purchase-payment-copy';
import { useTrialPurchaseCopy } from '@/i18n/trial-purchase';
import { h5DevicePreviewStatusBarHeight } from '@/lib/device-preview';
import CheckoutAmount from './CheckoutAmount.vue';
// 'failed' is a server-confirmed provisioning failure (order PAID + PROVISIONING_FAILED); 'error' is only a read-back that has not succeeded yet.
const props = defineProps<{ orderNo: string | null; state: 'activated' | 'inventory' | 'processing' | 'error' | 'failed'; paymentConfirmed: boolean; productName?: string; productImage?: string; productImages?: string[]; amount?: string | number | null; delivery?: OrderDeviceDelivery; inventoryFallbackDeviceId?: string; currency?: 'USD' | 'USDT'; error?: string; completeLine?: string; saved?: string | number; amountPrecision?: 'full'; amountBelowCent?: boolean }>();
// order: 查看订单 on a provisioning failure (PRD purchase payment, line 72). A host without an order view leaves it unwired.
const emit = defineEmits<{ (event: 'devices'): void; (event: 'support'): void; (event: 'order'): void }>();
const app = useApp();
const locale = useLocaleStore();
const copy = computed(() => checkoutFlowCopy(locale.code));
const paymentCopy = computed(() => purchasePaymentCopy(locale.code));
const trialCopy = useTrialPurchaseCopy();
const showPaidAmount = computed(() => props.paymentConfirmed && props.amount !== undefined);
const inventoryDescription = computed(() => {
  const delivery = props.delivery;
  if (!delivery) return copy.value.inventoryHint;
  if (delivery.activatedQuantity > 0 && delivery.inventoryQuantity > 0) return fmt(copy.value.inventoryPartialHint, {
    activated: delivery.activatedQuantity, inventory: delivery.inventoryQuantity,
  });
  return delivery.inventoryQuantity > 1 ? fmt(copy.value.inventoryCountHint, { inventory: delivery.inventoryQuantity })
    : copy.value.inventoryHint;
});
function startReplacement() {
  const device = props.delivery?.inventoryDeviceIds?.[0] ?? props.inventoryFallbackDeviceId;
  void navReset(device === undefined ? '/pages/me/devices' : '/pages/me/devices?replaceDeviceId=' + device);
}
function finishPurchase() { void navReset('/pages/store/orders'); }
// The chassis offsets the page by the status bar it reads this way (the H5 device preview simulates one, which uni's
// --status-bar-height does not carry); the full-height layout below subtracts the same height.
const statusBar = (() => { try { return uni.getSystemInfoSync().statusBarHeight || h5DevicePreviewStatusBarHeight(); } catch { return h5DevicePreviewStatusBarHeight(); } })();
const phase = ref<'confirmed' | 'activating' | 'complete'>('complete');
// Confetti for the purchase itself; a check pop and halo bloom when the presentation completes.
const celebrating = ref(false);
const popped = ref(false);
const imageFailed = ref(false);
const failedImages = ref<string[]>([]);
// Bundle stage: two models stand side by side (board RsAct: the second larger behind on the right, the first in front on
// the left); a third takes the middle behind them. Back images come first so the front ones paint over them.
const GROUP_SLOTS: Record<number, string[]> = { 2: ['front-left', 'back-right'], 3: ['trio-left', 'back-middle', 'trio-right'] };
const groupImages = computed(() => {
  const sources = (props.productImages ?? []).filter(src => src && !failedImages.value.includes(src)).slice(0, 3);
  const slots = GROUP_SLOTS[sources.length];
  if (!slots) return [];
  return sources.map((src, index) => ({ src, slot: slots[index] })).sort((a, b) => Number(b.slot.startsWith('back')) - Number(a.slot.startsWith('back')));
});
const reduced = ref(false);
// Phase timing matches the CSS below. Timers, not animationend, drive the phases
// so the replay also advances where the native renderer drops animation events.
const CONFIRMED_MS = 2000, ACTIVATING_MS = 3000;
const PRESENTED_RESULTS_KEY = 'nexgrid-checkout-presented-results-accounts-v1';
let mounted = false, visible = true;
let presentedKey: string | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let preference: MediaQueryList | undefined;
const presentable = computed(() => props.state === 'activated' || props.state === 'inventory');

const title = computed(() => phase.value === 'confirmed' ? copy.value.paid
  : props.state === 'activated' ? phase.value === 'activating' ? copy.value.activating
    : (props.delivery?.activatedQuantity ?? 0) > 1 ? fmt(copy.value.activatedCount, { n: props.delivery!.activatedQuantity }) : copy.value.activated
  : props.state === 'inventory' ? copy.value.inventory : props.state === 'processing' ? copy.value.processing
  : props.state === 'failed' ? paymentCopy.value.deliveryTitle : copy.value.resultError);
const description = computed(() => phase.value === 'confirmed' ? props.state === 'activated' ? copy.value.paidHint : copy.value.paidInventoryHint
  : props.state === 'activated' ? phase.value === 'activating' ? copy.value.activatingHint : copy.value.activatedHint
  : props.state === 'inventory' ? inventoryDescription.value : props.state === 'processing' ? copy.value.processingHint
  : props.state === 'failed' ? paymentCopy.value.delivery : props.error || copy.value.resultErrorHint);
// Head tone follows the status map (03 §3.8): paid and done are success; activating, processing and a paid order whose
// read-back has not succeeded yet are in progress (03 §3.5.2: no failure before the server confirms one); only the
// server-confirmed provisioning failure is danger.
const headTone = computed(() => props.state === 'failed' ? 'danger' : phase.value === 'confirmed' ? 'success'
  : props.state === 'processing' || props.state === 'error' || phase.value === 'activating' ? 'warning' : 'success');
const productLine = computed(() => phase.value === 'complete' && props.completeLine ? props.completeLine : props.productName);

// The page's exits for this state; 查看设备 is the one primary. A delivery to inventory (full slots) offers 替换一台在线设备
// as the primary and 稍后再说 beside it, and the host adds none of its own. The host lays its bottom bar out with them from
// the start, hidden and untouchable until done (PRD purchase payment, line 49: no exit before the presentation completes;
// a provisioning failure is done at once, line 72), so the stage keeps one height from ① to ③.
type ResultExit = { key: string; label: string; primary: boolean; run: () => void };
const exits = computed<ResultExit[]>(() => props.state === 'failed'
  ? [{ key: 'order', label: paymentCopy.value.viewOrder, primary: false, run: () => emit('order') }, { key: 'support', label: paymentCopy.value.support, primary: true, run: () => emit('support') }]
  : props.state === 'inventory' ? [{ key: 'later', label: copy.value.replaceLater, primary: false, run: finishPurchase }, { key: 'replace', label: copy.value.replaceOnlineDevice, primary: true, run: startReplacement }]
  : presentable.value ? [{ key: 'devices', label: copy.value.devices, primary: true, run: () => emit('devices') }]
  : [{ key: 'inventory', label: copy.value.deviceInventory, primary: false, run: () => emit('devices') }]);
const done = computed(() => phase.value === 'complete');
// The host's bar (class checkout-result-tray) wraps to two rows where a long language cannot fit both exits on one;
// the foot then keeps the tray's real height clear (04 §4.0: a multi-row tray clears its height + 38), so the stage
// gives up the room and the summary stays above the tray. The bar is laid out (hidden) from ①, so this is its final height.
const rootView = ref<unknown>(null);
const trayHeight = ref(64);
let trayObserver: ResizeObserver | undefined;
function measureTray() {
  trayObserver?.disconnect(); trayObserver = undefined;
  const apply = (height?: number) => { trayHeight.value = Math.max(64, Math.round(height ?? 0)); };
  const root = (rootView.value as { $el?: HTMLElement } | null)?.$el ?? rootView.value as HTMLElement | null;
  if (root?.closest) {
    const tray = root.closest('uni-page')?.querySelector('.checkout-result-tray');
    apply(tray?.getBoundingClientRect().height);
    if (tray && typeof ResizeObserver !== 'undefined') {
      trayObserver = new ResizeObserver(() => apply(tray.getBoundingClientRect().height));
      trayObserver.observe(tray);
    }
    return;
  }
  // The App's logic layer has no DOM: ask the page whenever the exits change.
  if (typeof uni === 'undefined' || !uni.createSelectorQuery) { apply(); return; }
  uni.createSelectorQuery().select('.checkout-result-tray').boundingClientRect(rect => apply((rect as UniApp.NodeInfo | null)?.height)).exec();
}
watch([done, () => exits.value.map(exit => exit.label).join('|')], async () => { await nextTick(); measureTray(); }, { immediate: true, flush: 'post' });
defineExpose({ done, exits });

// Stage geometry, in the art box's own units (380 × 330; the device image is 380 square, 22 above the box).
const RING = { cx: 190, cy: 248, rx: 162, ry: 37 };
// The fill runs once round the base from the near centre, rightwards first; pathLength 100 matches --nx-viz-ring.
const RING_PATH = `M ${RING.cx} ${RING.cy + RING.ry} A ${RING.rx} ${RING.ry} 0 0 0 ${RING.cx} ${RING.cy - RING.ry} A ${RING.rx} ${RING.ry} 0 0 0 ${RING.cx} ${RING.cy + RING.ry}`;
// Stacked bands that all end at the head draw the 12% → 70% fade toward it (04.2 gauge colours) on a closed ring,
// where a linear gradient cannot follow the path.
const FILL_BANDS = [{ start: 0, opacity: .16 }, { start: .2, opacity: .13 }, { start: .4, opacity: .16 }, { start: .6, opacity: .2 }, { start: .8, opacity: .26 }];
// Processing / error: one soft tail of about 80° (board AProc), drawn on the circle the ring is squashed from, turns round
// the base head first; it fades from nothing to 70% at the head.
const COMET_PATH = `M ${RING.rx} 0 A ${RING.rx} ${RING.rx} 0 0 1 ${(RING.rx * Math.cos(80 * Math.PI / 180)).toFixed(2)} ${(RING.rx * Math.sin(80 * Math.PI / 180)).toFixed(2)}`;
const COMET_HEAD = `M ${RING.rx} 0 l 0 .01`;
const halves = ['back', 'front'] as const;
const uid = 'checkout-ring-' + Math.random().toString(36).slice(2, 8) + '-';
const spinning = computed(() => props.state === 'processing' || props.state === 'error');
const haloShown = computed(() => phase.value === 'confirmed' ? celebrating.value : phase.value === 'complete' && presentable.value);
const sparks = Array.from({ length: 26 }, (_, index) => ({ index, style: {
  '--x': `${34 + (index * 29) % 33}%`, '--dx': `${(index * 73) % 221 - 110}px`,
  '--dy': `${120 + (index * 37) % 110}px`, '--spin': `${180 + (index * 67) % 360}deg`,
  '--delay': `${(index * 43) % 240}ms`, '--duration': `${1200 + (index * 71) % 400}ms`,
} }));

function clearTimer() { if (timer !== undefined) { clearTimeout(timer); timer = undefined; } }
function skipPresentation() { clearTimer(); phase.value = 'complete'; celebrating.value = false; popped.value = false; }
function markPresented(): boolean {
  const { orderNo } = props;
  if (!orderNo) return false;
  const accountKey = app.accountKey;
  const key = JSON.stringify([accountKey, orderNo]);
  if (presentedKey === key) return true;
  presentedKey = key;
  // Record the start so leaving midway or skipping for reduced motion also counts as a visit.
  const storedOrderNos = readAccountRow<{ orderNos: string[] }>(PRESENTED_RESULTS_KEY, accountKey)?.orderNos;
  const orderNos = Array.isArray(storedOrderNos) ? storedOrderNos : [];
  if (orderNos.includes(orderNo)) return true;
  writeAccountRow(PRESENTED_RESULTS_KEY, accountKey, { orderNos: [...orderNos, orderNo] });
  return false;
}
function startPresentation() {
  if (!presentable.value) return;
  clearTimer(); celebrating.value = false; popped.value = false;
  if (markPresented() || reduced.value || !visible || (typeof document !== 'undefined' && document.hidden)) {
    phase.value = 'complete'; return;
  }
  phase.value = 'confirmed'; celebrating.value = true;
  timer = setTimeout(() => {
    // Inventory has no activation step and nothing activated to celebrate (PRD 算力激活队列与六槽, 2026-11-23): ③ shows
    // the check and halo still, without the pop or bloom (board A 入仓 ③).
    if (props.state !== 'activated') { phase.value = 'complete'; timer = undefined; return; }
    phase.value = 'activating';
    timer = setTimeout(() => { timer = undefined; phase.value = 'complete'; celebrating.value = false; popped.value = true; }, ACTIVATING_MS);
  }, CONFIRMED_MS);
}
// Without a media query (native renderer) motion stays on unless the user asked for less.
function updatePreference() { reduced.value = preference?.matches === true; if (reduced.value) skipPresentation(); }
function visibilityChanged() { if (document.hidden) skipPresentation(); }
watch([() => props.state, () => props.orderNo, () => app.accountKey], () => {
  skipPresentation();
  if (mounted) startPresentation();
});
watch(() => props.productImage, () => { imageFailed.value = false; });
watch(() => props.productImages?.join('|'), () => { failedImages.value = []; });
onHide(() => { visible = false; skipPresentation(); });
onShow(() => { visible = true; });
onMounted(() => {
  mounted = true;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    preference = window.matchMedia('(prefers-reduced-motion: reduce)'); updatePreference();
    if (preference.addEventListener) preference.addEventListener('change', updatePreference);
    else preference.addListener(updatePreference);
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibilityChanged);
  startPresentation();
});
onBeforeUnmount(() => {
  mounted = false; clearTimer(); trayObserver?.disconnect();
  if (preference?.removeEventListener) preference.removeEventListener('change', updatePreference);
  else preference?.removeListener(updatePreference);
  if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibilityChanged);
});
</script>
<style scoped>
/* One column on the page floor (no card): head, stage, summary, host content. The bottom keeps the tray's clearance
   (04 §4.0) so the last line clears the host's bar; the stage takes the height that is left, up to the board size. */
/* Hosts place the root 8 under the nav (status bar + 44); the chassis already pads a sub page's foot by the tray's
   offset + 18, so the root fills the screen down to that pad and keeps the rest of the tray clearance (04 §4.0) itself:
   the last line ends 16 above the tray (--checkout-result-tray: its measured height, 64 for one row) and the page does
   not scroll when everything fits. */
.checkout-result { box-sizing: border-box; display: flex; flex-direction: column; min-height: calc(100dvh - var(--checkout-result-status-bar, 0px) - 52px - var(--nx-tray-bottom) - 18px); padding: 0 var(--ui-space-inset) calc(var(--checkout-result-tray) + 16px - 18px); color: var(--v5-ink); }
/* Room for the head with a two-line description, so the stage does not jump as the phases change. */
.checkout-result__status { flex: none; min-height: calc(var(--v5-space-2) + 56px + var(--v5-space-4) + var(--ui-type-page-title-lh) + var(--v5-space-1) + var(--ui-type-description-lh) * 2); }
/* The stage fills the free height between the head and the summary, between 200 and the board's 330 (or 0.868 of the
   width on narrow screens); 10 §10.1: short screens shrink the decoration, never the page. */
/* The head keeps room for a two-line description; the 24 gap to the stage is counted from a one-line description, and
   a second line takes the device image's clear top instead (board A: stage 24 under the head). */
.checkout-result__stage { position: relative; flex: 1 1 0; min-height: 200px; max-height: min(330px, 84.6vw); margin: calc(var(--v5-space-6) - var(--ui-type-description-lh)) calc(-1 * var(--ui-space-inset)) 0; }
.checkout-result__art { position: absolute; top: 0; bottom: 0; left: 50%; aspect-ratio: 380 / 330; transform: translateX(-50%); }
.checkout-result__art > * { position: absolute; pointer-events: none; }
.checkout-result__image, .checkout-result__fallback { z-index: 2; left: 0; top: -6.667%; width: 100%; height: 115.15%; }
.checkout-result.is-confirmed .checkout-result__image, .checkout-result.is-confirmed .checkout-result__fallback { animation: checkout-device-rise 600ms cubic-bezier(.16, 1, .3, 1) both; }
.checkout-result__fallback { display: grid; place-items: center; color: var(--v5-brand); }
/* Group slots, in the art box's 380 × 330 units (board RsAct on the 390 stage). */
.checkout-result__image--front-left { left: 2.63%; top: 25.06%; width: 60.53%; height: 69.7%; }
.checkout-result__image--back-right { left: 34.74%; top: 19.55%; width: 65.79%; height: 75.76%; }
/* Three models (no board): the second behind in the middle, the first and third in front at either side. */
.checkout-result__image--back-middle { left: 21.05%; top: 8%; width: 57.89%; height: 66.67%; }
.checkout-result__image--trio-left { left: 0; top: 30.3%; width: 52.63%; height: 60.61%; }
.checkout-result__image--trio-right { left: 47.37%; top: 30.3%; width: 52.63%; height: 60.61%; }
.checkout-result__fallback svg { width: 80px; height: 80px; }
/* Page effects (01 §1.1.2): floor light and halo in the device hues, teal + sky; light theme lowers the strength. */
.checkout-result__floor { z-index: 0; left: 5.26%; top: 62.1%; width: 89.47%; height: 27.3%; border-radius: 50%; background: radial-gradient(ellipse at 50% 50%, color-mix(in srgb, var(--v5-tech-cyan) 34%, transparent) 0, color-mix(in srgb, var(--v5-aura-sky) 12%, transparent) 45%, transparent 72%); }
.checkout-result__halo { z-index: 0; left: 10.53%; top: 7.58%; width: 78.95%; height: 90.9%; border-radius: 50%; opacity: .85; background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--v5-tech-cyan) 24%, transparent) 0, color-mix(in srgb, var(--v5-aura-sky) 11%, transparent) 40%, transparent 70%); }
[data-theme="light"] .checkout-result__floor { background: radial-gradient(ellipse at 50% 50%, color-mix(in srgb, var(--v5-tech-cyan) 26%, transparent) 0, color-mix(in srgb, var(--v5-aura-sky) 9%, transparent) 45%, transparent 72%); }
[data-theme="light"] .checkout-result__halo { background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--v5-tech-cyan) 16%, transparent) 0, color-mix(in srgb, var(--v5-aura-sky) 7%, transparent) 40%, transparent 70%); }
.checkout-result__halo.is-flash { opacity: 1; animation: checkout-halo-flash 1200ms cubic-bezier(.16, 1, .3, 1) both; }
.checkout-result__halo.is-bloom { animation: checkout-halo-bloom 1200ms cubic-bezier(.16, 1, .3, 1) both; }
.checkout-result__ring { z-index: 1; inset: 0; width: 100%; height: 100%; overflow: visible; color: var(--v5-brand); }
.checkout-result__ring[data-half="front"] { z-index: 3; }
.checkout-result__track { fill: none; stroke: color-mix(in srgb, var(--v5-ink) 8%, transparent); stroke-width: 4; }
.checkout-result--activated.is-complete .checkout-result__track { stroke: var(--v5-brand); }
/* Activation fill (07 §7.1.1 ring sweep): every band sweeps the registered --nx-viz-ring 0 → 100 in the 3s phase and
   draws [value × (1 − band), value] of the ring, so all of them end at the head. */
.checkout-result__fill { --nx-viz-ring: 100; fill: none; stroke: currentColor; stroke-width: 4; stroke-dasharray: calc(var(--nx-viz-ring) * var(--band)) 200; stroke-dashoffset: calc(var(--nx-viz-ring) * (var(--band) - 1)); animation: nx-viz-sweep 3000ms linear both; }
.checkout-result__head, .checkout-result__head-pulse { fill: currentColor; transform-box: fill-box; transform-origin: center; }
.checkout-result__head-pulse { fill-opacity: .16; animation: checkout-head-pulse 2400ms ease-out infinite; }
.checkout-result__ripple { fill: none; stroke: currentColor; stroke-width: 1.5; stroke-opacity: .24; transform-box: fill-box; transform-origin: center; animation: checkout-ripple 2000ms ease-out infinite both; }
.checkout-result__spinner { transform-origin: 0 0; animation: checkout-ring-spin 2400ms linear infinite; }
.checkout-result__spinner path { fill: none; stroke-width: 4; stroke-linecap: round; }
.checkout-result__spinner .checkout-result__spinner-head { stroke: currentColor; stroke-width: 8; }
.checkout-result__spinner .checkout-result__spinner-halo { stroke: currentColor; stroke-opacity: .12; stroke-width: 16; }
/* Loops run only while the page shows (design-rules Motion). */
.nx-chassis[data-page-visible="false"] .checkout-result__ripple, .nx-chassis[data-page-visible="false"] .checkout-result__head-pulse, .nx-chassis[data-page-visible="false"] .checkout-result__spinner,
.nx-chassis[data-scrolling="true"] .checkout-result__ripple, .nx-chassis[data-scrolling="true"] .checkout-result__head-pulse, .nx-chassis[data-scrolling="true"] .checkout-result__spinner { animation-play-state: paused; }
/* The check lands on the ring's near point (190, 285 of 380 × 330). */
.checkout-result__check { z-index: 4; left: calc(50% - 16px); top: calc(86.36% - 16px); display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: var(--v5-brand); color: var(--v5-on-brand); box-shadow: 0 0 0 6px color-mix(in srgb, var(--v5-brand) 18%, transparent); }
.checkout-result__check.is-pop { animation: checkout-check-pop 420ms cubic-bezier(.2, 1.4, .4, 1) both; }
.checkout-result__confetti { z-index: 5; inset: 0; }
.checkout-result__spark { position: absolute; left: var(--x); top: 66%; width: 9px; height: 4px; border-radius: calc(var(--v5-space-1) / 4); background: var(--v5-brand); opacity: 0; animation: checkout-spark-burst var(--duration) cubic-bezier(.2, .7, .3, 1) var(--delay) both; }
.checkout-result__spark:nth-child(3n + 2) { background: var(--v5-tech-cyan); }
.checkout-result__spark:nth-child(4n) { width: 5px; height: 9px; }
.checkout-result__spark:nth-child(5n) { width: 6px; height: 6px; border-radius: 50%; }
.checkout-result__summary { flex: none; display: flex; flex-direction: column; align-items: center; gap: var(--v5-space-3); margin-top: var(--v5-space-3); text-align: center; }
.checkout-result__product { display: block; max-width: 100%; color: var(--v5-ink); font: var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); text-wrap: balance; overflow-wrap: break-word; }
.checkout-result__stats { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); width: 100%; }
.checkout-result__stat { display: flex; flex-direction: column; align-items: center; gap: var(--v5-space-1); min-width: 0; }
.checkout-result__stat + .checkout-result__stat { box-shadow: inset 1px 0 color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.checkout-result__label { display: block; color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); white-space: nowrap; }
.checkout-result__amount { color: var(--v5-ink); font-size: var(--ui-type-page-title); line-height: var(--ui-type-page-title-lh); letter-spacing: -.02em; }
@keyframes checkout-device-rise { from { opacity: .4; transform: translateY(12px) scale(.94); } }
@keyframes checkout-halo-flash { from { opacity: 0; transform: scale(.7); } }
@keyframes checkout-halo-bloom { from { opacity: 0; transform: scale(.7); } 40% { opacity: 1; transform: scale(1.06); } }
@keyframes checkout-head-pulse { from { opacity: 1; transform: scale(.6); } to { opacity: 0; transform: scale(1.8); } }
@keyframes checkout-ripple { from { opacity: 1; transform: scale(.94); } to { opacity: 0; transform: scale(1.1); } }
@keyframes checkout-ring-spin { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
@keyframes checkout-check-pop { from { opacity: 0; transform: scale(.4); } 70% { opacity: 1; transform: scale(1.12); } }
@keyframes checkout-spark-burst { 0% { opacity: 0; transform: translate3d(0, 0, 0) rotate(0) scale(.6); } 12% { opacity: 1; } 55% { opacity: 1; transform: translate3d(calc(var(--dx) * .8), calc(-1 * var(--dy)), 0) rotate(calc(var(--spin) * .6)) scale(1); } 100% { opacity: 0; transform: translate3d(var(--dx), calc(var(--dy) * -.62), 0) rotate(var(--spin)) scale(.8); } }
@media (prefers-reduced-motion: reduce) {
  .checkout-result *, .checkout-result *::before, .checkout-result *::after { animation: none !important; transition: none !important; }
  .checkout-result__confetti, .checkout-result__ripple, .checkout-result__head-pulse { display: none !important; }
}
</style>
