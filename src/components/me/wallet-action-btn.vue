<!--
  WalletActionBtn — ported from me/page.tsx WalletActionBtn.
  iOS-Wallet 3-up action: round 44px icon chip + label + currency sub-label.
  Primary (Top-up) earns emphasis via brand-filled icon + spotlight glow (the
  one allowed conversion-CTA halo per feedback_no_icon_halo_glow). Icon passed
  via default slot (inline SVG using stroke="currentColor"). Navigates to `href`
  (uni route) with fail:()=>{} for not-yet-ported targets.
-->
<template>
  <view class="flex flex-col items-center text-center active:opacity-90" style="gap: 6px; padding: 6px 2px; min-height: 44px" @click="go">
    <view class="grid place-items-center shrink-0" :style="iconStyle">
      <slot />
    </view>
    <text :style="labelStyle">{{ label }}</text>
    <text v-if="sub" :style="subStyle">{{ sub }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";

const props = defineProps<{
  href: string;
  label: string;
  sub?: string;
  primary?: boolean;
}>();

function go() {
  uni.navigateTo({ url: props.href, fail: () => {} });
}

const iconStyle = computed<CSSProperties>(() => ({
  width: "44px",
  height: "44px",
  borderRadius: "999px",
  background: props.primary ? "var(--v5-brand)" : "var(--v5-surface-2)",
  border: props.primary ? "none" : "1px solid var(--v5-border)",
  color: props.primary ? "var(--v5-bg)" : "var(--v5-brand)",
  boxShadow: props.primary ? "var(--v5-spotlight-brand)" : "none",
}));
const labelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "12.5px",
  color: "var(--v5-ink)",
  letterSpacing: "-0.005em",
  whiteSpace: "nowrap",
  lineHeight: 1.1,
};
const subStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10.5px",
  fontWeight: 500,
  letterSpacing: "0.04em",
  color: "var(--v5-ink-4)",
  lineHeight: 1.1,
  whiteSpace: "nowrap",
};
</script>
