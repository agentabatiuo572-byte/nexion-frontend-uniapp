<template>
  <view v-if="knownRank" class="team-rank-emblem" aria-hidden="true" :style="sizeStyle"><image class="team-rank-emblem__art" :src="src" mode="aspectFit" /></view>
  <view v-else class="team-rank-emblem team-rank-emblem--unknown" aria-hidden="true" :style="sizeStyle"><text>{{ rank == null ? '—' : `V${rank}` }}</text></view>
</template>

<script setup lang="ts">
// 等级徽章（team-rank DESIGN 7.4、第 9 节）：成品位图，中心罗马数字已在图里。整张画布按显示尺寸放，
// 外框在画布内居中、按等级逐级变宽；40px 及以下用 120 版。只放徽章：光晕、纹样、底色和循环动效属于各页身份区，不进这个共享组件。
import { computed } from 'vue';
import { rankBadgeSrc } from '@/lib/rank-tier-style';
const props = withDefaults(defineProps<{ rank: number | null | undefined; size?: number }>(), { size: 64 });
const knownRank = computed(() => typeof props.rank === 'number' && Number.isInteger(props.rank) && props.rank >= 0 && props.rank <= 8);
const sizeStyle = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }));
const src = computed(() => rankBadgeSrc(props.rank ?? 0, props.size));
</script>

<style scoped>
.team-rank-emblem { display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.team-rank-emblem__art { display: block; width: 100%; height: 100%; }
/* 未知等级：缺失值「—」用辅助色，等级数字按 01.2 统计数值字体（JetBrains Mono 500）。 */
.team-rank-emblem--unknown { display: grid; place-items: center; font: 500 16px/1 var(--font-metric); color: var(--v5-ink-3); }
</style>
