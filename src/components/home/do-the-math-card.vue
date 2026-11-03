<!--
  DoTheMathCard — server-authoritative upgrade comparison (design system 04.1 设备对比, P-57).
  The Java Home projection selects the user's highest-yield active device and the next
  purchasable E1 catalog product. "Upgrade stage": both devices stand on pillars whose
  heights are their real estimated daily earnings (target 100px, base in proportion, min 18px);
  a brand arc jumps from the base to the target with the multiplier at its apex.
-->
<template>
  <NxSection v-if="calculator" :title="t.home.doMathTitle" data-home-section="do-the-math">
    <view ref="cardRef" class="dc-card" :class="{ 'dc-card--entered': entered, 'dc-card--paused': !seen || !pageVisible, 'dc-card--masked': visibility.hidden }">
      <view class="dc-stage">
        <svg class="dc-arc" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path :d="arcPath" /></svg>
        <text class="dc-stage__label">{{ t.home.doMathStage }}</text>
        <view class="dc-multiplier" :aria-label="visibility.hidden ? '••' : `${calculator.multiplier}×`"><text>{{ visibility.hidden ? '••' : calculator.multiplier }}</text><text v-if="!visibility.hidden" class="dc-multiplier__sign">×</text></view>
        <view class="dc-col dc-col--base">
          <image v-if="baseArt.imageSrc.value" class="dc-device" :src="baseArt.imageSrc.value" mode="aspectFit" @error="baseArt.imageError" />
          <view v-else class="dc-device dc-device--placeholder" aria-hidden="true"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg></view>
          <view class="dc-pillar" :style="{ height: `${pillarHeights.base}px` }" />
        </view>
        <view class="dc-col dc-col--target">
          <image v-if="targetArt.imageSrc.value" class="dc-device" :src="targetArt.imageSrc.value" mode="aspectFit" @error="targetArt.imageError" />
          <view v-else class="dc-device dc-device--placeholder" aria-hidden="true"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg></view>
          <view class="dc-pillar" :style="{ height: `${pillarHeights.target}px` }"><view v-if="!visibility.hidden" class="dc-pillar__sweep" /></view>
        </view>
        <view class="dc-stage__floor" />
      </view>
      <view class="dc-legend">
        <view><text class="dc-legend__name">{{ baseShort }}</text><text class="dc-legend__rate">{{ visibility.mask(formatAmount(calculator.base.dailyUsdt)) }}<text class="dc-legend__unit">/d</text></text></view>
        <view class="dc-legend--target"><text class="dc-legend__name">{{ calculator.target.name }}</text><text class="dc-legend__rate">{{ formatAmount(calculator.target.dailyUsdt) }}<text class="dc-legend__unit">/d</text></text></view>
      </view>
      <view class="dc-foot">
        <text class="dc-foot__caption">{{ fmt(generalBase ? t.home.doMathVs : t.home.doMathYour, { base: baseShort }) }}</text>
        <NxButton class="dc-foot__action" variant="brand" size="small" :label="`${t.home.doMathSeeCta} →`" @click="goStore" />
      </view>
    </view>
  </NxSection>
</template>

<script setup lang="ts">
import { useDataVisibility } from "@/store/data-visibility";
import { formatAmount } from "@/lib/amount-display";
import { navTo } from "@/lib/route";
import { computed, getCurrentInstance, onUnmounted, ref, watch } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { deviceNameInline } from "@/lib/device-copy";
import { useDeviceProductImage } from "@/composables/use-device-product-image";
import { useScrollGrowProgress } from "@/composables/use-scroll-grow-progress";
import { onShow, onHide } from "@/composables/use-tab-page-lifecycle";
import NxButton from "@/components/ui/nx-button.vue";
import NxSection from "@/components/ui/nx-section.vue";

const visibility = useDataVisibility();
const t = useT();
const app = useApp();

const calculator = computed(() => {
  const value = app.homeTruth?.doTheMath;
  // Lite never compares against a phone (no phone compute on the web); identity is the explicit device kind.
  return value && value.base.kind !== "cloud-share" && value.target.kind !== "cloud-share"
    && value.base.kind !== "phone" && value.target.kind !== "phone" ? value : null;
});
const baseShort = computed(() => calculator.value
  ? deviceNameInline(t.value, calculator.value.base.kind, calculator.value.base.name)
  : "");
// Phone and GPU bases are already named "your phone" / "your computer GPU"; only SKUs take "vs your {base}".
const generalBase = computed(() => calculator.value?.base.kind === "phone" || calculator.value?.base.kind === "pc-gpu");
// The projection names the base device by kind only; the target is an exact catalog product.
const baseArt = useDeviceProductImage(() => ({ kind: calculator.value?.base.kind ?? "cloud-share", productCode: calculator.value?.base.kind ?? "", capacitySource: "server" }));
const targetArt = useDeviceProductImage(() => ({ kind: calculator.value?.target.kind ?? "cloud-share", productCode: calculator.value?.target.productNo ?? "", capacitySource: "server" }));

// Hidden statistics use one neutral placeholder height so the ratio does not leak.
const pillarHeights = computed(() => visibility.hidden || !calculator.value
  ? { base: 56, target: 56 }
  : { base: Math.max(4, 100 * calculator.value.base.dailyUsdt / calculator.value.target.dailyUsdt), target: 100 });
// The arc starts beside the base device (its top sits 112 - pillar px into the 208px stage).
const arcPath = computed(() => `M 36 ${((124 - pillarHeights.value.base) / 208 * 100).toFixed(1)} Q 46 2 60 28 M 60 28 l -0.5 -4.3 M 60 28 l -2.6 -1.5`);

// DS-29 entrance plays once the stage is first seen; the target sweep pauses off-screen and while the page is hidden.
// The card mounts after the overview read, so an unresolved ref must not count as seen. H5 uses the DOM observer;
// the App logic layer has none, so it observes the card through uni.createIntersectionObserver on this instance.
const { elRef: cardRef, inView } = useScrollGrowProgress({ threshold: 0.25, fallbackInView: false });
const domObserver = typeof IntersectionObserver !== "undefined";
const nativeInView = ref(false);
let nativeObserver: UniNamespace.IntersectionObserver | null = null;
const instance = getCurrentInstance();
if (!domObserver) watch(cardRef, (card) => {
  nativeObserver?.disconnect();
  nativeObserver = null;
  nativeInView.value = false;
  if (!card || !instance) return;
  nativeObserver = uni.createIntersectionObserver(instance.proxy, { thresholds: [0.25] }).relativeToViewport();
  nativeObserver.observe(".dc-card", (result) => { nativeInView.value = result.intersectionRatio >= 0.25; });
}, { flush: "post" });
onUnmounted(() => { nativeObserver?.disconnect(); nativeObserver = null; });
const seen = computed(() => domObserver ? inView.value : nativeInView.value);
const entered = ref(false);
watch([seen, cardRef], ([visible, card]) => { entered.value = !!card && (entered.value || visible); }, { immediate: true });
const pageVisible = ref(true);
onShow(() => { pageVisible.value = true; });
onHide(() => { pageVisible.value = false; });

function goStore() {
  const productNo = calculator.value?.target.productNo;
  if (!productNo) return;
  navTo(`/pages/store/detail?id=${encodeURIComponent(productNo)}`);
}
</script>

<style scoped>
.dc-card { position:relative; isolation:isolate; box-sizing:border-box; padding:12px 12px 8px; border-radius:var(--ui-radius-surface); background:var(--v5-surface); border:1px solid var(--v5-border); box-shadow:var(--v5-glass-shadow); overflow:hidden; }
/* Recessed stage with a faint cyan glow behind the target. */
.dc-stage { --dc-well:inset 0 2px 10px rgba(0,0,0,.55); position:relative; height:208px; border-radius:16px; overflow:hidden; background:radial-gradient(55% 65% at 75% 92%,color-mix(in srgb,var(--v5-tech-cyan) 18%,transparent),transparent 72%),var(--v5-surface-2); box-shadow:var(--dc-well); }
:global([data-theme="light"] .dc-stage) { --dc-well:inset 0 1px 4px rgba(20,16,8,.08); }
.dc-stage__label { position:absolute; left:12px; top:10px; font:400 12px/16px var(--font-v5); color:var(--v5-ink-3); }
.dc-stage__floor { position:absolute; left:12px; right:12px; bottom:22px; height:1px; background:var(--v5-border-strong); }
.dc-col { position:absolute; bottom:22px; width:100px; display:flex; flex-direction:column; align-items:center; }
.dc-col--base { left:calc(25% - 50px); }
.dc-col--target { left:calc(75% - 50px); }
.dc-device { position:relative; z-index:1; display:block; width:88px; height:88px; margin-bottom:-14px; animation:dc-device-drop 700ms 450ms cubic-bezier(.2,.9,.3,1.3) both; }
.dc-col--target .dc-device { animation-delay:600ms; }
/* Same neutral placeholder as the catalogue uses for a SKU without an approved image. */
.dc-device--placeholder { display:grid; place-items:center; color:var(--v5-ink-3); }
.dc-pillar { position:relative; width:64px; border-radius:12px 12px 3px 3px; overflow:hidden; transform-origin:50% 100%; background:linear-gradient(180deg,color-mix(in srgb,var(--v5-ink) 18%,transparent),color-mix(in srgb,var(--v5-ink) 6%,transparent)); animation:dc-pillar-rise 1100ms cubic-bezier(.16,1,.3,1) both; }
.dc-col--target .dc-pillar { animation-delay:120ms; background:linear-gradient(180deg,color-mix(in srgb,var(--v5-tech-cyan) 72%,transparent),color-mix(in srgb,var(--v5-aura-sky) 20%,transparent)); box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 14px 30px -10px color-mix(in srgb,var(--v5-tech-cyan) 60%,transparent); }
.dc-card--masked .dc-col--target .dc-pillar { background:linear-gradient(180deg,color-mix(in srgb,var(--v5-ink) 18%,transparent),color-mix(in srgb,var(--v5-ink) 6%,transparent)); box-shadow:none; }
.dc-pillar__sweep { position:absolute; top:-10%; bottom:-10%; left:-70%; width:45%; background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent); transform:skewX(-18deg); animation:dc-sweep 6.8s 1.8s ease-in-out infinite; }
/* The arc is drawn by a left-to-right reveal: dashes cannot follow pathLength under a non-scaling stroke
   (they are laid out in screen space), and the arc runs left to right from 36% to 60%. */
.dc-arc { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; animation:dc-arc-draw 750ms 900ms cubic-bezier(.4,0,.2,1) both; }
.dc-arc path { fill:none; stroke:var(--v5-brand); stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; vector-effect:non-scaling-stroke; }
.dc-multiplier { position:absolute; left:50%; top:10px; padding:0 8px; border-radius:12px; background:var(--v5-surface-2); font:500 36px/40px var(--font-jet-mono); letter-spacing:-.04em; color:var(--v5-brand); font-variant-numeric:tabular-nums; white-space:nowrap; transform:translateX(-50%); animation:dc-multiplier-pop 560ms 1250ms cubic-bezier(.2,.9,.3,1.35) both; }
.dc-multiplier__sign { font-size:22px; margin-left:1px; }
.dc-legend { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); margin-top:10px; text-align:center; animation:dc-fade-up 500ms 1000ms ease-out both; }
.dc-legend__name { display:block; font:400 12px/16px var(--font-v5); color:var(--v5-ink-3); }
.dc-legend__rate { display:block; margin-top:2px; font:500 15px/20px var(--font-jet-mono); color:var(--v5-ink); font-variant-numeric:tabular-nums; }
.dc-legend__unit { font-size:12px; color:var(--v5-ink-3); margin-left:2px; }
.dc-legend--target .dc-legend__name { color:var(--v5-ink); }
.dc-legend--target .dc-legend__rate { color:var(--v5-brand); }
.dc-foot { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:4px; padding-left:4px; }
.dc-foot__caption { min-width:0; font:400 12px/16px var(--font-v5); color:var(--v5-ink-3); }
.dc-card :deep(.dc-foot__action) { flex:none; }
.dc-card :deep(.dc-foot__action .nx-button__surface) { min-height:32px; height:32px; padding:0 14px; }
/* The entrance waits at its first frame until the stage is seen (same contract as v-viz-inview). */
.dc-card:not(.dc-card--entered) .dc-device, .dc-card:not(.dc-card--entered) .dc-pillar, .dc-card:not(.dc-card--entered) .dc-arc,
.dc-card:not(.dc-card--entered) .dc-multiplier, .dc-card:not(.dc-card--entered) .dc-legend, .dc-card--paused .dc-pillar__sweep { animation-play-state:paused; }
@keyframes dc-pillar-rise { from { transform:scaleY(0); } }
@keyframes dc-device-drop { from { opacity:0; transform:translateY(-20px); } }
@keyframes dc-arc-draw { from { clip-path:inset(0 64% 0 0); } to { clip-path:inset(0 39% 0 0); } }
@keyframes dc-multiplier-pop { from { opacity:0; transform:translateX(-50%) scale(.55); } }
@keyframes dc-fade-up { from { opacity:0; transform:translateY(6px); } }
@keyframes dc-sweep { 0% { left:-70%; } 15%,100% { left:130%; } }
@media (max-width:339px) {
  .dc-device { width:74px; height:74px; margin-bottom:-12px; }
  .dc-pillar { width:54px; }
  .dc-multiplier { font-size:30px; line-height:34px; }
}
@media (prefers-reduced-motion:reduce) {
  .dc-device, .dc-pillar, .dc-arc, .dc-multiplier, .dc-legend, .dc-pillar__sweep { animation:none; }
}
</style>
