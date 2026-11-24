<template>
  <!-- V7 铂金星河舞台（team-rank DESIGN 8.1 第 2 条、8.2）：卡外全宽，向上延伸到页头后面；星河、静态星点在静态层，
       持续循环只有卫星和亮星两层（10.2），离屏和页面隐藏暂停、减少动态和省电静止、低端降级（useRankFxGuard）。 -->
  <view ref="elRef" class="rank-v7-stage" :class="[classes, { 'is-still': still || lite }]">
    <view class="rank-v7-stage__fx" aria-hidden="true">
      <image class="rank-v7-stage__galaxy" :src="rankAsset(RANK_ASSETS.v7Galaxy, theme)" mode="aspectFill" />
      <image class="rank-v7-stage__stars" :src="rankAsset(RANK_ASSETS.v7Stars, theme)" mode="aspectFill" />
    </view>
    <view class="rank-v7-stage__crest" aria-hidden="true">
      <image class="rank-v7-stage__orbit" :src="rankAsset(RANK_ASSETS.v7Orbit, theme)" mode="aspectFit" />
      <view class="rank-v7-stage__orb"><view class="rank-v7-stage__spin"><view class="rank-v7-stage__sat" /><view class="rank-v7-stage__sat rank-v7-stage__sat--2" /></view></view>
      <TeamRankEmblem class="rank-v7-stage__badge" :rank="7" :size="144" />
    </view>
    <text class="rank-v7-stage__caption">{{ caption }}</text>
    <text class="rank-v7-stage__num">V7</text>
    <slot />
  </view>
</template>

<script setup lang="ts">
import TeamRankEmblem from "@/components/team/team-rank-emblem.vue";
import { useRankFxGuard } from "@/composables/use-rank-fx-guard";
import { RANK_ASSETS, rankAsset, type RankTheme } from "@/lib/rank-tier-style";

defineProps<{ caption: string; theme: RankTheme }>();
const { elRef, classes, still, lite } = useRankFxGuard(".rank-v7-stage");
</script>

<style scoped>
/* 舞台：全宽出血（页面左右边距 16），向上拉到页头后面（页头 56＋下边距 12＋内容上边距 4）。 */
.rank-v7-stage { position: relative; isolation: isolate; display: flex; flex-direction: column; align-items: center; margin: -72px -16px 0; padding: 72px 16px 4px; text-align: center; }
.rank-v7-stage__fx { position: absolute; inset: 0; z-index: -1; pointer-events: none; }
.rank-v7-stage__galaxy, .rank-v7-stage__stars { position: absolute; left: 0; top: 0; display: block; width: 100%; height: 360px; }
.rank-v7-stage__crest { position: relative; display: grid; place-items: center; width: 128px; height: 128px; margin: 22px 0 26px; }
/* 徽章光晕：静态径向渐变，不用模糊滤镜（10.4 P4）。 */
.rank-v7-stage__crest::before { content: ""; position: absolute; inset: -46px; border-radius: 50%; background: radial-gradient(closest-side, rgba(220,236,255,.42), rgba(143,184,255,.14) 52%, rgba(143,184,255,0)); pointer-events: none; }
[data-theme="light"] .rank-v7-stage__crest::before { background: radial-gradient(closest-side, rgba(255,255,255,.95), rgba(214,229,250,.55) 55%, rgba(214,229,250,0)); }
.rank-v7-stage__orbit { position: absolute; left: 50%; top: 50%; width: 300px; height: 300px; margin: -150px 0 0 -150px; }
.rank-v7-stage__orb { position: absolute; left: 50%; top: 50%; width: 280px; height: 280px; margin: -140px 0 0 -140px; transform: rotate(-14deg) scaleY(.314); }
.rank-v7-stage__badge { position: relative; z-index: 1; margin: -8px; }
.rank-v7-stage__sat { position: absolute; left: 50%; top: -8px; width: 16px; height: 16px; margin-left: -8px; border-radius: 50%; background: radial-gradient(circle, #FFFFFF 0 28%, rgba(160,200,255,.85) 42%, rgba(160,200,255,0) 70%); }
.rank-v7-stage__sat--2 { top: auto; bottom: -5px; width: 10px; height: 10px; margin-left: -5px; opacity: .75; }
[data-theme="light"] .rank-v7-stage__sat { background: radial-gradient(circle, #1E7BE8 0 26%, rgba(30,123,232,.5) 42%, rgba(30,123,232,0) 70%); }
.rank-v7-stage__caption { position: relative; font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.rank-v7-stage__num { position: relative; font: 500 var(--ui-type-display-title)/var(--ui-type-display-title-lh) var(--font-metric); letter-spacing: -.02em; color: transparent; background-image: linear-gradient(180deg, #FFFFFF 10%, #DCE6F5 50%, #93A3BF 100%); -webkit-background-clip: text; background-clip: text; }
[data-theme="light"] .rank-v7-stage__num { background-image: linear-gradient(180deg, #2B3446 10%, #4A5873 55%, #1D2433 100%); }
/* 两个持续循环（10.2）：亮星整层闪烁 3.8s、卫星容器整体旋转 24s；只动 opacity／transform。
   离屏或页面隐藏时暂停（is-paused）；will-change 只在 is-looping 时有（P6）。 */
.rank-v7-stage__stars { animation: rank-v7-twinkle 3.8s ease-in-out infinite; }
.rank-v7-stage__spin { position: absolute; inset: 0; animation: rank-v7-spin 24s linear infinite; }
.rank-v7-stage.is-paused .rank-v7-stage__stars, .rank-v7-stage.is-paused .rank-v7-stage__spin { animation-play-state: paused; }
.rank-v7-stage.is-looping .rank-v7-stage__spin { will-change: transform; }
.rank-v7-stage.is-looping .rank-v7-stage__stars { will-change: opacity; }
/* 减少动态、省电、低端降级：静止在终帧（亮星满不透明度，卫星停在 38°），光效照常。 */
.rank-v7-stage.is-still .rank-v7-stage__stars { animation: none; opacity: 1; }
.rank-v7-stage.is-still .rank-v7-stage__spin { animation: none; transform: rotate(38deg); }
@keyframes rank-v7-twinkle { 0%, 100% { opacity: .4; } 50% { opacity: 1; } }
@keyframes rank-v7-spin { to { transform: rotate(360deg); } }
@media (max-width: 374px) { .rank-v7-stage__crest { margin: 18px 0 22px; } }
@media (prefers-reduced-motion: reduce) {
  .rank-v7-stage__stars { animation: none; opacity: 1; }
  .rank-v7-stage__spin { animation: none; transform: rotate(38deg); }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) { .rank-v7-stage__stars { display: none; } }
</style>
