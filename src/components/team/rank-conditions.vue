<template>
  <view class="rank-conditions">
    <view class="rank-conditions__head">
      <view class="rank-conditions__lead"><TeamRankEmblem v-if="badge !== undefined" class="rank-conditions__badge" :rank="badge" :size="28" /><text class="rank-conditions__title">{{ heading }}</text><NxHintBubble v-if="hint.length" :text="hint" :size="20" /></view>
      <NxTag v-if="tag" :tone="tagTone">{{ tag }}</NxTag>
    </view>
    <view class="rank-conditions__rows">
      <view v-for="row in rows" :key="row.key" class="rank-condition-row">
        <view class="rank-condition-row__ring" :class="{ 'nx-viz-sweep': sweep && !hidden, 'rank-condition-row__ring--met': row.met && !hidden }" role="progressbar" :aria-label="row.name" :aria-valuemin="0" :aria-valuemax="100" :aria-valuenow="hidden ? undefined : row.percent" :aria-valuetext="row.spoken" :style="{ '--nx-viz-ring': hidden ? 0 : (row.percent ?? 0) }"><NxIcon v-if="row.met && !hidden" name="check" :size="16" /></view>
        <text class="rank-condition-row__name">{{ row.name }}</text>
        <view class="rank-condition-row__value" aria-hidden="true"><text class="rank-condition-row__current">{{ row.current }}</text><text> / </text><text class="rank-condition-row__target">{{ row.target }}</text><text v-if="row.unit">&#160;{{ row.unit }}</text></view>
      </view>
    </view>
    <view v-if="prior.length" class="rank-conditions__fold">
      <view class="rank-conditions__fold-head" role="button" tabindex="0" :aria-expanded="priorOpen ? 'true' : 'false'" :aria-controls="foldId" @click="priorOpen = !priorOpen" @keydown.enter.prevent="priorOpen = !priorOpen" @keydown.space.prevent="priorOpen = !priorOpen"><text>{{ priorTitle }}</text><NxIcon :name="priorOpen ? 'minus' : 'plus'" :size="16" /></view>
      <view v-if="priorOpen" :id="foldId" class="rank-conditions__rows">
        <view v-for="row in prior" :key="row.key" class="rank-condition-row">
          <view class="rank-condition-row__ring" :class="{ 'nx-viz-sweep': sweep && !hidden, 'rank-condition-row__ring--met': row.met && !hidden }" role="progressbar" :aria-label="row.name" :aria-valuemin="0" :aria-valuemax="100" :aria-valuenow="hidden ? undefined : row.percent" :aria-valuetext="row.spoken" :style="{ '--nx-viz-ring': hidden ? 0 : (row.percent ?? 0) }"><NxIcon v-if="row.met && !hidden" name="check" :size="16" /></view>
          <text class="rank-condition-row__name">{{ row.name }}</text>
          <view class="rank-condition-row__value" aria-hidden="true"><text class="rank-condition-row__current">{{ row.current }}</text><text> / </text><text class="rank-condition-row__target">{{ row.target }}</text><text v-if="row.unit">&#160;{{ row.unit }}</text></view>
        </view>
      </view>
    </view>
    <slot />
  </view>
</template>

<script setup lang="ts">
// 我的等级「升到 Vn 需要」条件区（team-rank DESIGN 第 4 节「升到 Vn 需要」行、条件行、前序条件折叠；2.2、2.6）。
// V0–V6 放在焦点卡分隔线下；V7 的纯色条件卡、V8 的「另需」文字条件由 V7/V8 项复用这里（文字条件放进默认插槽）。
// 只管显示：行的取值、遮罩和计数由页面算好传进来。
import { getCurrentInstance, ref } from "vue";
import NxHintBubble from "@/components/ui/nx-hint-bubble.vue";
import NxIcon from "@/components/ui/nx-icon.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import TeamRankEmblem from "@/components/team/team-rank-emblem.vue";

export interface RankConditionRow {
  key: string;
  /** 条件名称；前序条件带「V2 · 」前缀。 */
  name: string;
  /** 当前值（隐藏统计时为 ••••，未知为 —）、门槛、单位（只有中文的「人」）。 */
  current: string;
  target: string;
  unit: string;
  /** 环的进度 0–100；未知时 undefined，环只留轨道。 */
  percent: number | undefined;
  met: boolean;
  /** 读屏读的「当前 / 门槛」。 */
  spoken: string;
}

withDefaults(defineProps<{
  heading: string;
  /** 右侧标签：「还差 N 项」或「审核中」；空字符串时不显示。 */
  tag: string;
  tagTone?: "neutral" | "warning";
  /** 标题旁提示气泡的句子；空数组时不放图标（没有人数类条件时）。 */
  hint: readonly string[];
  rows: readonly RankConditionRow[];
  prior: readonly RankConditionRow[];
  /** 折叠头写结论「前序条件 · N 项未满足」（04.0）。 */
  priorTitle: string;
  hidden: boolean;
  /** 标题前的目标等级小徽章 28px（V7 的纯色条件卡里放金色 V8，DESIGN 7.2）。 */
  badge?: number;
  /** 条件环从 0 扫到当前值（07 §7.1.1）；减少动态或省电时为 false，直接显示终值。 */
  sweep: boolean;
}>(), { tagTone: "neutral" });

const foldId = `rank-prior-${getCurrentInstance()?.uid ?? 0}`;
const priorOpen = ref(false);
</script>

<style scoped>
.rank-conditions__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 24px; margin-bottom: 4px; }
.rank-conditions__lead { display: inline-flex; align-items: center; gap: 2px; min-width: 0; }
.rank-conditions__title { min-width: 0; font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); overflow-wrap: break-word; }
.rank-conditions__lead :deep(.nx-hint) { margin-left: 4px; }
.rank-conditions__badge { margin-right: 6px; }
.rank-conditions__rows { display: flex; flex-direction: column; }
.rank-condition-row { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; align-items: center; column-gap: 10px; min-height: 40px; padding: 6px 0; box-sizing: border-box; border-bottom: 1px solid color-mix(in srgb, var(--v5-ink) 6%, transparent); }
.rank-condition-row:last-child { border-bottom: 0; }
/* 28px 小圆环：环宽 3.5，轨道前景色 8%，填充品牌色；达成满环加 16px 勾。只在入场时扫一次（--nx-viz-ring）。 */
.rank-condition-row__ring { position: relative; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; color: var(--v5-brand); }
/* --nx-viz-ring 注册为不继承，伪元素要显式继承环上的值（含扫描动画中的值）。 */
.rank-condition-row__ring::before { content: ""; position: absolute; inset: 0; --nx-viz-ring: inherit; border-radius: 50%; background: conic-gradient(var(--v5-brand) calc(var(--nx-viz-ring) * 1%), color-mix(in srgb, var(--v5-ink) 8%, transparent) 0); -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px)); mask: radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px)); }
.rank-condition-row__ring :deep(.nx-icon) { position: relative; }
.rank-condition-row__name { min-width: 0; font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: break-word; }
.rank-condition-row__value { display: flex; align-items: baseline; font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.rank-condition-row__value text { white-space: pre; }
.rank-condition-row__current { font-family: var(--font-metric); font-weight: 500; color: var(--v5-ink); }
.rank-condition-row__target { font-family: var(--font-metric); }
.rank-conditions__fold { margin-top: 8px; border-top: 1px solid color-mix(in srgb, var(--v5-ink) 6%, transparent); }
.rank-conditions__fold-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; font: 500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-2); cursor: pointer; }
.rank-conditions__fold-head:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; border-radius: 8px; }
.rank-conditions__fold-head :deep(.nx-icon) { flex: none; color: var(--v5-ink-3); }
</style>
