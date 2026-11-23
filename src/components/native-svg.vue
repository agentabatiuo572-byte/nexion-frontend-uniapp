<template>
  <view class="nx-native-svg" :style="boxStyle" v-html="markup()" />
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, useAttrs, useSlots } from "vue";
import { svgMarkup } from "@/lib/native-svg-markup";

defineOptions({ inheritAttrs: false });
const attrs = useAttrs();
const slots = useSlots();
const instance = getCurrentInstance()!;
// The scope ids Vue would give the <svg> as a template root: the template that wrote it, plus each parent component's
// while this box is that component's root (as for NxIcon), so a parent's scoped class rule reaches the svg too.
function rootScopeIds(): string[] {
  const ids: string[] = [];
  if (instance.vnode.scopeId) ids.push(instance.vnode.scopeId);
  let child = instance;
  let parent = instance.parent;
  while (parent && parent.subTree === child.vnode) {
    if (parent.vnode.scopeId) ids.push(parent.vnode.scopeId);
    child = parent;
    parent = parent.parent;
  }
  return ids;
}
const markup = () => svgMarkup(attrs, slots.default?.() ?? [], rootScopeIds());
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
