<!--
  CheckoutPaying — P4 (board CkExt): an external payment for this order is under way on this device. The page says so and
  what not to do; no button, and no pointer to the floating bar (it may be closed or show another payment). The plain and
  the bundle / activity checkout both show it in place of their pay tray. Solid card (01 §1.1.2), warning clock in a 14%
  circle, 小标题 and 辅助说明 roles (10.1), then the order number and the 查看关联订单 text link (03 §3.9).
-->
<template>
  <view class="checkout-paying" role="status" data-testid="checkout-paying">
    <view class="checkout-paying__icon" aria-hidden="true"><NxIcon name="clock" :size="18" /></view>
    <view class="checkout-paying__main">
      <text class="checkout-paying__title">{{ flow.payingTitle }}</text>
      <text class="checkout-paying__body">{{ flow.payingBody }}</text>
      <view class="checkout-paying__foot">
        <view class="checkout-paying__no"><text class="checkout-paying__no-label">{{ t.promotion.orderNo }}</text><NxCodeValue class="checkout-paying__code" :value="orderNo" :label="t.promotion.orderNo" :copyable="false" /></view>
        <view class="checkout-paying__link" role="link" tabindex="0" @click="emit('view')" @keydown.enter.prevent="emit('view')"><text class="nx-after-chevron">{{ t.promotion.viewOrder }}</text></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import NxIcon from "@/components/ui/nx-icon.vue";
import NxCodeValue from "@/components/ui/nx-code-value.vue";
import { useT } from "@/i18n/use-t";
import { checkoutFlowCopy } from "@/lib/checkout-flow-copy";
import { useLocaleStore } from "@/store/locale";

defineProps<{ orderNo: string }>();
const emit = defineEmits<{ (event: "view"): void }>();
const t = useT();
const locale = useLocaleStore();
const flow = computed(() => checkoutFlowCopy(locale.code));
</script>

<style scoped>
.checkout-paying { display:flex; align-items:flex-start; gap:var(--v5-space-3); padding:var(--ui-space-inset); border:1px solid color-mix(in srgb,var(--v5-border) 40%,transparent); border-radius:var(--ui-radius-surface); background:var(--ui-content-surface); }
[data-theme="light"] .checkout-paying { box-shadow:var(--v5-glass-shadow); }
.checkout-paying__icon { display:grid; place-items:center; flex:none; width:36px; height:36px; border-radius:50%; background:var(--v5-warning-soft); color:var(--v5-warning-ink); }
.checkout-paying__main { flex:1; min-width:0; }
.checkout-paying__title { display:block; color:var(--v5-ink); font:var(--ui-type-subheading-weight) var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-v5); }
/* Body text fills the line (design-rules: no balanced or pretty wrapping on notes). */
.checkout-paying__body { display:block; margin-top:var(--v5-space-1); color:var(--v5-ink-3); font:var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.checkout-paying__foot { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:var(--v5-space-1) var(--v5-space-3); margin-top:10px; }
.checkout-paying__no { display:flex; align-items:baseline; gap:var(--v5-space-1); min-width:0; color:var(--v5-ink-3); font:var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.checkout-paying__no-label { flex:none; }
.checkout-paying__code { color:var(--v5-ink-2); font-size:var(--ui-type-meta); line-height:var(--ui-type-meta-lh); }
.checkout-paying__link { position:relative; flex:none; display:inline-flex; align-items:center; color:var(--v5-ink-3); font:var(--ui-type-text-link-weight) var(--ui-type-text-link)/var(--ui-type-text-link-lh) var(--font-v5); white-space:nowrap; cursor:pointer; }
.checkout-paying__link::after { content:""; position:absolute; top:calc(50% - 22px); bottom:calc(50% - 22px); left:-8px; right:-8px; }
.checkout-paying__link:focus-visible { outline:2px solid var(--v5-brand); outline-offset:3px; }
</style>
