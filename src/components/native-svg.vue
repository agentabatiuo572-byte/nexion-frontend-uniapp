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
// The box defaults live in the class below and the size comes in as variables, so a page rule written for the svg
// (`X > svg` mirrored as `X > .nx-native-svg`) can still hide, place or size this box.
const boxStyle = computed(() => ({
  "--nx-svg-w": dimension(attrs.width) || "auto",
  "--nx-svg-h": dimension(attrs.height) || "auto",
}));
</script>

<style>
.nx-native-svg { display: inline-block; flex-shrink: 0; line-height: 0; vertical-align: middle; width: var(--nx-svg-w); height: var(--nx-svg-h); }
</style>
