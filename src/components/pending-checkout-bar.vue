<!--
  PendingCheckoutBar — chassis-level floating pill for the one live pending-
  checkout session (the invoice the checkout opened on entering the pay step):
  「待支付 $X · mm:ss · 继续支付」. Tapping returns to THE SAME session (same
  address, continuous countdown) via /pages/store/checkout?resume=<id>.
    · self-hides when there is no live session, when the session expired
      (store prunes it), and while a checkout page is already showing it
      (pending.viewingId) — never a duplicate reminder on the pay screen itself
    · account-scoped by construction (store rows are per account)
    · chrome glass language (--v5-chrome-bg + glass border/shadow + blur), same
      family as the header tiles; sits just under any header variant
    · role/tabindex only — Enter/Space come from lib/a11y-activate (no @keydown)
-->
<template>
  <view v-if="session" class="pcb-outer" :style="{ top: `${top}px` }">
    <view class="pcb-pill pcb-enter active:opacity-80" role="button" tabindex="0" :aria-label="ariaLabel" @click="resume">
      <view class="pcb-dot" aria-hidden="true" />
      <text class="pcb-label">{{ t.store.pendingBarLabel }}</text>
      <text class="pcb-amount tabular-nums">${{ amountText }}</text>
      <text class="pcb-sep" aria-hidden="true">·</text>
      <text class="pcb-countdown font-mono-tabular">{{ countdown }}</text>
      <view class="pcb-cta">
        <text class="pcb-cta-t">{{ t.store.pendingBarResume }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useT } from "@/i18n/use-t";
import { navTo } from "@/lib/route";
import { usePendingCheckout } from "@/store/pending-checkout";
import { formatCountdown } from "@/store/pending-checkout-core";

const props = defineProps<{
  /** px from the chassis top — chassis passes status bar + header clearance. */
  top: number;
  /** current uni route (chassis-resolved), e.g. "pages/store/checkout". */
  route: string;
}>();

const t = useT();
const pending = usePendingCheckout();

const session = computed(() => {
  const s = pending.current;
  if (!s || s.id === pending.viewingId) return null;
  return s;
});
const amountText = computed(() => (session.value ? session.value.amountUsdt.toLocaleString() : ""));
const countdown = computed(() => (session.value ? formatCountdown(pending.secondsLeft(session.value)) : "00:00"));
const ariaLabel = computed(() => `${t.value.store.pendingBarLabel} $${amountText.value} · ${countdown.value} · ${t.value.store.pendingBarResume}`);

function resume() {
  const s = session.value;
  if (!s) return;
  const url = `/pages/store/checkout?product=${encodeURIComponent(s.productId)}&resume=${encodeURIComponent(s.id)}`;
  // Already on a checkout page (for another product / a fresh attempt): replace it
  // instead of stacking a second checkout underneath.
  if (props.route === "pages/store/checkout") {
    uni.redirectTo({ url, fail: () => navTo(url) });
    return;
  }
  navTo(url);
}
</script>

<style scoped>
.pcb-outer {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 95; /* under the fixed headers (100), over sticky sub-page headers (50) + content */
  display: flex;
  justify-content: center;
  padding: 0 16px;
  pointer-events: none;
}
.pcb-pill {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-height: 44px;
  padding: 0 6px 0 14px;
  border-radius: 999px;
  background: var(--v5-chrome-bg);
  border: 1px solid var(--v5-glass-border);
  box-shadow: var(--v5-glass-shadow);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
}
.pcb-enter {
  animation: pcb-in 0.24s var(--ease-out, ease-out) both;
}
@keyframes pcb-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.pcb-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--v5-warning);
  flex-shrink: 0;
  animation: pcb-pulse 1.6s ease-in-out infinite;
}
@keyframes pcb-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
.pcb-label {
  font-size: 12px;
  color: var(--v5-ink-2);
  white-space: nowrap;
}
.pcb-amount {
  font-family: var(--font-v5);
  font-size: 13px;
  font-weight: 600;
  color: var(--v5-ink);
  white-space: nowrap;
}
.pcb-sep {
  font-size: 12px;
  color: var(--v5-ink-4);
}
.pcb-countdown {
  font-size: 12px;
  color: var(--v5-warning-ink);
  white-space: nowrap;
}
.pcb-cta {
  display: inline-flex;
  align-items: center;
  height: 32px;
  margin-left: 4px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--v5-brand-soft);
  flex-shrink: 0;
}
.pcb-cta-t {
  font-family: var(--font-v5);
  font-size: 12px;
  font-weight: 600;
  color: var(--v5-brand);
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  .pcb-enter, .pcb-dot { animation: none; }
}
</style>
