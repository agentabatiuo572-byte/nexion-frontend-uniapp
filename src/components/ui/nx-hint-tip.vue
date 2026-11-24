<template>
  <view ref="rootRef" class="nx-hint-tip" :class="`nx-hint-tip--${tone}`">
    <view :id="buttonId" class="nx-hint-tip__button" role="button" tabindex="0" :aria-label="label || t.myRank.tipLabel" :aria-expanded="open ? 'true' : 'false'" @click.stop="toggle" @keydown.esc="close">
      <NxIcon :name="tone === 'warning' ? 'hint-warn' : 'hint-info'" :size="20" />
    </view>
    <!-- 读屏：气泡插进这个常驻的播报区，打开时读出全文。 -->
    <view class="nx-hint-tip__live" aria-live="polite">
      <view v-if="open" :id="bubbleId" class="nx-hint-tip__bubble" :class="{ 'nx-hint-tip__bubble--above': place.above, 'nx-hint-tip__bubble--measuring': !place.ready }" :style="bubbleStyle" @click.stop>
        <text v-for="(line, index) in shownLines" :key="index" class="nx-hint-tip__line">{{ line }}</text>
      </view>
    </view>
    <!-- #ifndef H5 -->
    <!-- App 逻辑层没有 document：用一层透明接触面接住气泡外的点按和滑动。 -->
    <view v-if="open" class="nx-hint-tip__catcher" @touchstart="close" @tap="close" />
    <!-- #endif -->
  </view>
</template>

<script setup lang="ts">
// 提示气泡（design-system 03 §3.5.1；team-rank DESIGN 2.6）：放在它解释的那一项旁边的提示图标，点按出气泡。
// 警示色（需要注意）和中性色（普通说明）两种；图标 20px、触区 44px。气泡最宽 280，材质同 toast 的深色半透明面，
// 13/18，每段一句、最多三句，只放说明不放按钮。点图标、点气泡外或滚动时关闭，同一时刻全站只开一个。
// 气泡有 backdrop-filter，开合直接替换，不做位移或缩放动画（DESIGN 10.1）。
import { computed, getCurrentInstance, onUnmounted, reactive, ref, watch } from "vue";
import NxIcon from "@/components/ui/nx-icon.vue";
import { useT } from "@/i18n/use-t";

const props = withDefaults(defineProps<{
  /** 每段一句，最多三句（多余的不显示）。 */
  lines: readonly string[];
  tone?: "neutral" | "warning";
  /** 图标的读屏名，默认「查看说明」（myRank.tipLabel）。 */
  label?: string;
}>(), { tone: "neutral", label: "" });

const t = useT();
const instance = getCurrentInstance();
const uid = instance?.uid ?? Math.floor(Math.random() * 1e6);
const buttonId = `nx-hint-tip-${uid}`;
const bubbleId = `nx-hint-tip-bubble-${uid}`;
const rootRef = ref<unknown>(null);
const shownLines = computed(() => props.lines.slice(0, 3));
const open = computed(() => openTip.value === uid);
const place = reactive({ ready: false, above: false, left: 0, top: 0, bottom: 0, arrow: 0 });
const bubbleStyle = computed(() => place.above
  ? { left: `${place.left}px`, bottom: `${place.bottom}px`, "--nx-hint-arrow": `${place.arrow}px` }
  : { left: `${place.left}px`, top: `${place.top}px`, "--nx-hint-arrow": `${place.arrow}px` });

function toggle() {
  if (open.value) close();
  else openTip.value = uid;
}
function close() {
  if (open.value) openTip.value = null;
}

type Rect = { left: number; top: number; width: number; height: number; bottom: number };
function rectOf(selector: string): Promise<Rect | null> {
  return new Promise((resolve) => {
    if (!instance?.proxy) return resolve(null);
    uni.createSelectorQuery().in(instance.proxy).select(selector).boundingClientRect((rect) => {
      resolve(rect && !Array.isArray(rect) ? rect as Rect : null);
    }).exec();
  });
}

// 气泡贴着图标、箭头指向图标；放不下时翻到图标上方，左右离屏幕边至少 12px。滚动即关闭，所以用视口坐标定位，
// 也不会被焦点卡的 overflow: hidden 裁掉。
async function measure() {
  place.ready = false;
  const [button, bubble] = await Promise.all([rectOf(`#${buttonId}`), rectOf(`#${bubbleId}`)]);
  if (!open.value || !button || !bubble) return;
  const { windowWidth, windowHeight } = uni.getSystemInfoSync();
  const centerX = button.left + button.width / 2;
  const left = Math.min(Math.max(12, centerX - bubble.width / 2), Math.max(12, windowWidth - 12 - bubble.width));
  const iconBottom = button.top + button.height / 2 + 10;
  const iconTop = button.top + button.height / 2 - 10;
  const above = iconBottom + 8 + bubble.height > windowHeight - 12 && iconTop - 8 - bubble.height >= 12;
  Object.assign(place, { above, left, top: iconBottom + 8, bottom: windowHeight - iconTop + 8, arrow: centerX - left, ready: true });
}

// #ifdef H5
let detach: (() => void) | undefined;
function rootElement(): Element | null {
  const raw = rootRef.value as { $el?: unknown } | Element | null;
  if (typeof Element === "undefined" || !raw) return null;
  return raw instanceof Element ? raw : raw.$el instanceof Element ? raw.$el : null;
}
function attachOutsideClose() {
  const onDown = (event: Event) => {
    const root = rootElement();
    if (root && event.target instanceof Node && root.contains(event.target)) return;
    close();
  };
  // 捕获阶段的 scroll 也能收到页面里各个滚动容器的滚动。
  const onScroll = () => close();
  document.addEventListener("pointerdown", onDown, true);
  document.addEventListener("scroll", onScroll, true);
  detach = () => {
    document.removeEventListener("pointerdown", onDown, true);
    document.removeEventListener("scroll", onScroll, true);
    detach = undefined;
  };
}
// #endif

watch(open, (isOpen) => {
  // #ifdef H5
  detach?.();
  if (isOpen) attachOutsideClose();
  // #endif
  if (isOpen) setTimeout(() => { void measure(); }, 0);
});
onUnmounted(() => {
  close();
  // #ifdef H5
  detach?.();
  // #endif
});
</script>

<script lang="ts">
import { ref as sharedRef } from "vue";
/** 全站同一时刻只开一个气泡：打开新的即关闭旧的。 */
const openTip = sharedRef<number | null>(null);
</script>

<style scoped>
.nx-hint-tip { position: relative; display: inline-flex; flex: none; vertical-align: middle; }
/* 20px 图形、44px 触区：外层点击区用内距补足，负外距不占旁边的位置。 */
.nx-hint-tip__button { display: grid; place-items: center; width: 20px; height: 20px; padding: 12px; margin: -12px; box-sizing: content-box; border-radius: 999px; color: var(--v5-ink-3); cursor: pointer; }
.nx-hint-tip--warning .nx-hint-tip__button { color: var(--v5-warning-ink); }
.nx-hint-tip__button:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: -10px; }
.nx-hint-tip__bubble {
  position: fixed;
  z-index: 9500;
  box-sizing: border-box;
  width: max-content;
  max-width: min(280px, calc(100vw - 24px));
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--v5-toast-bg);
  -webkit-backdrop-filter: blur(12px) saturate(125%);
  backdrop-filter: blur(12px) saturate(125%);
  box-shadow: var(--v5-toast-shadow);
  color: var(--v5-toast-ink);
  font: 400 var(--ui-type-text-link)/var(--ui-type-text-link-lh) var(--font-v5);
  text-align: left;
  overflow-wrap: break-word;
  cursor: default;
}
.nx-hint-tip__bubble--measuring { visibility: hidden; }
/* 箭头指向图标。 */
.nx-hint-tip__bubble::before { content: ""; position: absolute; top: -6px; left: calc(var(--nx-hint-arrow, 50%) - 6px); width: 12px; height: 12px; background: inherit; transform: rotate(45deg); border-radius: 2px; }
.nx-hint-tip__bubble--above::before { top: auto; bottom: -6px; }
.nx-hint-tip__line { display: block; white-space: normal; }
.nx-hint-tip__line + .nx-hint-tip__line { margin-top: 4px; }
.nx-hint-tip__catcher { position: fixed; inset: 0; z-index: 9499; }
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .nx-hint-tip__bubble { -webkit-backdrop-filter: none; backdrop-filter: none; background: var(--v5-toast-solid); }
}
@media (forced-colors: active) {
  .nx-hint-tip__bubble { border: 1px solid CanvasText; background: Canvas; color: CanvasText; }
}
</style>
