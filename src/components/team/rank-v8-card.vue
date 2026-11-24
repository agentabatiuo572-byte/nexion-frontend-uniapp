<template>
  <!-- V8 黑金会员卡（team-rank DESIGN 8.1 第 1 条、8.2）：拟物卡面，两种主题同一卡面（同 04.4 实体银行卡），卡面颜色只在本组件定义。
       持续循环只有卡面掠光和冠光呼吸两层（10.2），离屏和页面隐藏暂停、减少动态和省电静止、低端降级（useRankFxGuard）。 -->
  <view class="rank-v8-stage">
    <view ref="elRef" class="rank-v8-card" :class="[classes, { 'is-still': still || lite }]" role="group" :aria-label="caption">
      <view class="rank-v8-card__fx" aria-hidden="true">
        <image class="rank-v8-card__layer" :src="RANK_ASSETS.v8Guilloche" mode="aspectFill" />
        <image class="rank-v8-card__layer rank-v8-card__dust" :src="RANK_ASSETS.v8Dust" mode="aspectFill" />
        <view class="rank-v8-card__sheen" />
      </view>
      <view class="rank-v8-card__id">
        <view class="rank-v8-card__crest" aria-hidden="true">
          <image class="rank-v8-card__rays" :src="RANK_ASSETS.v8Rays" mode="aspectFit" />
          <TeamRankEmblem class="rank-v8-card__badge" :rank="8" :size="badgeSize" />
        </view>
        <view class="rank-v8-card__copy">
          <text class="rank-v8-card__caption">{{ caption }}</text>
          <text class="rank-v8-card__num">V8</text>
          <text class="rank-v8-card__tag">{{ topRank }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import TeamRankEmblem from "@/components/team/team-rank-emblem.vue";
import { useRankFxGuard } from "@/composables/use-rank-fx-guard";
import { RANK_ASSETS, rankTierStyle } from "@/lib/rank-tier-style";

defineProps<{ caption: string; topRank: string }>();
const { elRef, classes, still, lite } = useRankFxGuard(".rank-v8-card");
// 卡内徽章 112，360 档 100（8.2）。
const badgeSize = (() => {
  try { return uni.getSystemInfoSync().windowWidth < 375 ? rankTierStyle(8).canvas360 : rankTierStyle(8).canvas; } catch { return rankTierStyle(8).canvas; }
})();
</script>

<style scoped>
.rank-v8-stage { position: relative; margin-top: 4px; }
/* 卡下底光（8.2）：径向渐隐，静态。 */
.rank-v8-stage::before { content: ""; position: absolute; left: 6%; right: 6%; bottom: -34px; height: 86px; border-radius: 50%; background: radial-gradient(closest-side, rgba(240,201,100,.30), rgba(240,201,100,0)); pointer-events: none; }
[data-theme="light"] .rank-v8-stage::before { background: radial-gradient(closest-side, rgba(198,131,22,.20), rgba(198,131,22,0)); }
.rank-v8-card { position: relative; isolation: isolate; overflow: hidden; display: flex; flex-direction: column; justify-content: center; min-height: 208px; box-sizing: border-box; padding: 20px; border-radius: 24px;
  background: radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,.09), rgba(255,255,255,0) 46%), linear-gradient(150deg, #241E14 0%, #100E0A 48%, #18140D 100%);
  box-shadow: inset 0 0 0 1px rgba(226,188,98,.30), inset 0 1px 0 rgba(255,238,196,.28), inset 0 -12px 20px -14px rgba(0,0,0,.8), 0 16px 36px rgba(0,0,0,.42); }
[data-theme="light"] .rank-v8-card { box-shadow: inset 0 0 0 1px rgba(226,188,98,.34), inset 0 1px 0 rgba(255,238,196,.28), inset 0 -12px 20px -14px rgba(0,0,0,.8), 0 2px 4px rgba(15,17,22,.10), 0 18px 32px -14px rgba(15,17,22,.42); }
.rank-v8-card__fx { position: absolute; inset: 0; z-index: -1; pointer-events: none; }
.rank-v8-card__layer { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
.rank-v8-card__dust { opacity: .9; }
.rank-v8-card__sheen { position: absolute; top: -30%; bottom: -30%; left: 0; width: 34%; background: linear-gradient(100deg, rgba(255,240,200,0) 0%, rgba(255,240,200,.04) 30%, rgba(255,240,200,.22) 50%, rgba(255,240,200,.04) 70%, rgba(255,240,200,0) 100%); transform: translateX(-160%) skewX(-14deg); }
.rank-v8-card__id { display: flex; align-items: center; gap: 20px; }
.rank-v8-card__crest { position: relative; display: grid; place-items: center; flex: none; }
.rank-v8-card__rays { position: absolute; left: 50%; top: 50%; width: 236px; height: 236px; transform: translate(-50%, -50%); }
.rank-v8-card__badge { position: relative; }
.rank-v8-card__copy { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0; }
.rank-v8-card__caption { font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: rgba(247,231,184,.70); }
.rank-v8-card__num { font: 500 var(--ui-type-display-title)/var(--ui-type-display-title-lh) var(--font-metric); letter-spacing: -.02em; color: transparent; background-image: linear-gradient(180deg, #FFF3CF 8%, #EBCB7A 52%, #B8913F 100%); -webkit-background-clip: text; background-clip: text; }
/* 卡面标签：卡面专用色（同 04.4 银行卡状态标签的做法），24 高、12/16 500。 */
.rank-v8-card__tag { display: inline-flex; align-items: center; min-height: 24px; margin-top: 6px; padding: 0 8px; box-sizing: border-box; border-radius: 999px; background: rgba(226,188,98,.16); color: #EBCB7A; font: 500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); overflow-wrap: break-word; }
/* 两个持续循环（10.2）：卡面掠光 7.2s（0–17% 扫过，首次延迟 480ms）、冠光呼吸 5.6s；只动 transform／opacity。 */
.rank-v8-card__sheen { animation: rank-v8-sheen 7.2s cubic-bezier(.45,0,.2,1) .48s infinite; }
.rank-v8-card__rays { animation: rank-v8-breathe 5.6s ease-in-out infinite; }
.rank-v8-card.is-paused .rank-v8-card__sheen, .rank-v8-card.is-paused .rank-v8-card__rays { animation-play-state: paused; }
.rank-v8-card.is-looping .rank-v8-card__sheen, .rank-v8-card.is-looping .rank-v8-card__rays { will-change: transform; }
/* 减少动态、省电、低端降级：掠光隐藏，冠光满不透明度、原尺寸。 */
.rank-v8-card.is-still .rank-v8-card__sheen { animation: none; opacity: 0; }
.rank-v8-card.is-still .rank-v8-card__rays { animation: none; opacity: 1; transform: translate(-50%, -50%); }
@keyframes rank-v8-sheen { 0% { transform: translateX(-160%) skewX(-14deg); } 17%, 100% { transform: translateX(330%) skewX(-14deg); } }
@keyframes rank-v8-breathe { 0%, 100% { opacity: .72; transform: translate(-50%, -50%) scale(.96); } 50% { opacity: 1; transform: translate(-50%, -50%) scale(1.04); } }
@media (max-width: 374px) { .rank-v8-card__id { gap: 16px; } }
@media (prefers-reduced-motion: reduce) {
  .rank-v8-card__sheen { animation: none; opacity: 0; }
  .rank-v8-card__rays { animation: none; opacity: 1; transform: translate(-50%, -50%); }
}
/* 减少透明度或高对比：隐藏金粉、掠光，扭索纹降到 50%（8.2）。 */
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .rank-v8-card__dust, .rank-v8-card__sheen { display: none; }
  .rank-v8-card__layer:first-child { opacity: .5; }
}
</style>
