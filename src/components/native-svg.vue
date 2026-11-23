<template>
  <view class="nx-native-svg" :style="boxStyle" v-html="markup()" />
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, useAttrs, useSlots } from "vue";
import { svgMarkup } from "@/lib/native-svg-markup";

defineOptions({ inheritAttrs: false });
const attrs = useAttrs();
const slots = useSlots();
// The scope id of the template that wrote the <svg> (the same one Vue puts on this wrapper).
const scopeId = getCurrentInstance()?.vnode.scopeId;
const markup = () => svgMarkup(attrs, slots.default?.() ?? [], scopeId);
const dimension = (value: unknown) => typeof value === "number" || /^\d+$/.test(String(value)) ? `${value}px` : String(value ?? "");
const boxStyle = computed(() => ({
  display: "inline-block",
  flexShrink: "0",
  lineHeight: "0",
  verticalAlign: "middle",
  width: dimension(attrs.width),
  height: dimension(attrs.height),
}));
</script>
