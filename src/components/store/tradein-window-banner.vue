<!--
  TradeinWindowBanner — Sprint 2 finale (ported from store/page.tsx
  TradeinWindowBanner + useTradeinWindowState). Surfaces the trade-in window at
  /store top, gated by platform phase AND ownership of a matching legacy device:
    · P3-P4 + legacy box  → box window ($300 off Pro v2), amber urgency
    · P5+   + legacy rack → rack window ($800 off Rack P2), "final" orange
    · both                → combined ($1,100), final
    · pre-P3 / no legacy  → hidden
  Tapping routes to /me/devices (the trade-in entry).
-->
<template>
  <view v-if="visible && variant" class="mb-3">
    <view class="block relative overflow-hidden" :style="rootStyle" role="button" tabindex="0" :aria-label="t.store.tradeinWindow.cta" @tap.stop="go" @click.stop="go">
      <view class="absolute inset-0 pointer-events-none" :style="radialStyle" />

      <view class="relative flex items-center gap-1.5" :style="labelStyle">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" :stroke="accent" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
        <text>{{ t.store.tradeinWindow.label }}</text>
      </view>

      <text class="block relative mt-2" style="font-size: 18px; font-weight: 600; color: var(--v5-ink); line-height: 1.2">{{ title }}</text>
      <text class="block relative mt-1.5" style="font-size: 12px; color: var(--v5-ink-3); line-height: 1.4">{{ body }}</text>

      <view class="relative mt-3 flex items-center justify-end">
        <view class="inline-flex items-center gap-1.5" :style="ctaStyle">
          <text>{{ t.store.tradeinWindow.cta }}</text>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand-2)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { useProductPhase } from "@/composables/use-product-phase";
import { isPhaseReached } from "@/store/product-phase";
import { navTo } from "@/lib/route";

const t = useT();
const app = useApp();
const phase = useProductPhase();

const LEGACY_BOX_KINDS = new Set(["stellarbox-s1", "stellarbox-pro"]);
const LEGACY_RACK_KINDS = new Set(["stellarrack-p1"]);

const state = computed(() => {
  const boxWindowOpen = isPhaseReached(phase.value, "P3");
  const rackWindowOpen = isPhaseReached(phase.value, "P5");
  const isFinal = isPhaseReached(phase.value, "P5");

  const hasLegacyBox = app.devices.some((d) => LEGACY_BOX_KINDS.has(d.kind));
  const hasLegacyRack = app.devices.some((d) => LEGACY_RACK_KINDS.has(d.kind));

  const showBox = boxWindowOpen && hasLegacyBox;
  const showRack = rackWindowOpen && hasLegacyRack;

  if (!showBox && !showRack) {
    return { visible: false, variant: null as "box" | "rack" | "combined" | null, isFinal };
  }
  if (showBox && showRack) return { visible: true, variant: "combined" as const, isFinal: true };
  if (showRack) return { visible: true, variant: "rack" as const, isFinal: true };
  return { visible: true, variant: "box" as const, isFinal };
});

const visible = computed(() => state.value.visible);
const variant = computed(() => state.value.variant);
const isFinal = computed(() => state.value.isFinal);

const w = computed(() => t.value.store.tradeinWindow);
const title = computed(() =>
  variant.value === "combined" ? w.value.titleCombined :
  variant.value === "rack" ? w.value.titleRack :
  w.value.titleBox,
);
const body = computed(() =>
  variant.value === "combined" ? w.value.bodyCombined :
  variant.value === "rack" ? w.value.bodyRack :
  w.value.bodyBox,
);

// Tone: P3-P4 box window = amber urgency; P5-P6 = orange "final" urgency.
const accent = computed(() => (isFinal.value ? "var(--v5-brand-2)" : "var(--v5-warning)"));
const accentRgba = computed(() => (isFinal.value ? "rgba(255,107,53," : "rgba(255,190,61,"));

const rootStyle = computed<CSSProperties>(() => ({
  borderRadius: "16px",
  padding: "16px",
  border: `1px solid ${accentRgba.value}0.40)`,
  background: `linear-gradient(160deg, ${accentRgba.value}0.14) 0%, var(--v5-surface) 70%)`,
}));

const radialStyle = computed<CSSProperties>(() => ({
  background: `radial-gradient(60% 80% at 95% 0%, ${accentRgba.value}0.20), transparent 70%)`,
}));

const labelStyle = computed<CSSProperties>(() => ({
  fontSize: "11px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontWeight: 500,
  color: accent.value,
}));

const ctaStyle = computed<CSSProperties>(() => ({
  height: "44px",
  padding: "0 16px",
  borderRadius: "999px",
  background: accent.value,
  color: "var(--v5-on-brand-2)",
  fontSize: "12.5px",
  fontWeight: 600,
}));

function go() {
  navTo("/me/devices");
}
</script>
