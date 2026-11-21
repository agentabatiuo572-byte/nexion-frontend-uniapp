<!--
  SpecTable — key/value hardware spec rows on the
  product detail page. Ported from store/[productId]/_client.tsx SpecTable.
-->
<template>
  <view class="nx-glass-card mx-4 rounded-2xl overflow-hidden" :style="rootStyle">
    <view
      v-for="(r, i) in rows"
      :key="r.k"
      class="flex items-center justify-between"
      :style="rowStyle(i)"
    >
      <text style="font-size: var(--ui-type-list-subtitle); color: var(--v5-ink-3)">{{ r.k }}</text>
      <text class="tabular-nums" :style="valueStyle">{{ r.v }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { CSSProperties } from "vue";

const props = defineProps<{ rows: { k: string; v: string }[] }>();

const rootStyle: CSSProperties = { borderRadius: "var(--nx-glass-radius)", boxShadow: "var(--nx-glass-edge)",
  background: "var(--nx-glass-fill)",
  padding: "0 16px",
};
function rowStyle(i: number): CSSProperties {
  return {
    padding: "12px 0",
    borderBottom: i < props.rows.length - 1 ? "1px solid var(--v5-border)" : "none",
  };
}
const valueStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--v5-ink)",
};


</script>
