<template>
  <!-- V8 专享权益（team-rank DESIGN 第 4 节「专享权益区块」、11.2 第 9 条）：独立区块，纯色卡里 6 个等宽格（两列三行，第 1 格是标题格），
       格子无底色、细线分格。hero 为 V8 会员页（徽章 72、标题格 56）；small 为 V7 页和全部等级选中 V8 时（48／40，标题格带金色光晕）。 -->
  <view class="rank-v8-perks" :class="`rank-v8-perks--${size}`">
    <text class="rank-v8-perks__title" role="heading" aria-level="2">{{ title }}</text>
    <view class="rank-v8-perks__card">
      <view class="rank-v8-perks__grid">
        <view class="rank-v8-perk rank-v8-perk--head">
          <view class="rank-v8-perk__crest"><TeamRankEmblem :rank="8" :size="size === 'hero' ? 56 : 40" /></view>
          <text class="rank-v8-perk__t rank-v8-perk__t--rank">V8</text>
          <text class="rank-v8-perk__d">{{ count }}</text>
        </view>
        <view v-for="perk in perks" :key="perk.key" class="rank-v8-perk">
          <image class="rank-v8-perk__art" :src="rankAsset(RANK_ASSETS.v8Perks[perk.key], theme)" mode="aspectFit" aria-hidden="true" />
          <text class="rank-v8-perk__t">{{ perk.title }}</text>
          <text class="rank-v8-perk__d">{{ perk.desc }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import TeamRankEmblem from "@/components/team/team-rank-emblem.vue";
import { RANK_ASSETS, rankAsset, type RankPerk, type RankTheme } from "@/lib/rank-tier-style";

defineProps<{ size: "hero" | "small"; title: string; count: string; theme: RankTheme; perks: readonly { key: RankPerk; title: string; desc: string }[] }>();
</script>

<style scoped>
.rank-v8-perks { margin-top: var(--ui-space-section-gap); }
.rank-v8-perks__title { display: flex; align-items: center; min-height: 44px; padding: 0 2px; font: var(--ui-type-section-weight) var(--ui-type-section)/var(--ui-type-section-lh) var(--font-v5); letter-spacing: -.01em; color: var(--v5-ink); }
.rank-v8-perks__title:lang(zh) { letter-spacing: 0; }
/* 纯色卡（01 §1.1.2）：surface 实底，内边距 4/12，浅色加轻阴影。 */
.rank-v8-perks__card { padding: 4px 12px; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .rank-v8-perks__card { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
.rank-v8-perks__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.rank-v8-perk { display: flex; flex-direction: column; align-items: center; min-width: 0; padding: 16px 8px 14px; text-align: center; }
.rank-v8-perk:nth-child(odd) { border-right: 1px solid color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.rank-v8-perk:nth-child(-n+4) { border-bottom: 1px solid color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.rank-v8-perk__art { display: block; width: 48px; height: 48px; margin-bottom: 8px; }
.rank-v8-perk__crest { position: relative; display: grid; place-items: center; margin-bottom: 8px; }
/* 小一号的标题格：V8 徽章后金色光晕（8.2，深 .34、浅 .14），静态径向渐变。 */
.rank-v8-perks--small .rank-v8-perk__crest::before { content: ""; position: absolute; inset: -14px; border-radius: 50%; background: radial-gradient(closest-side, rgba(240,201,100,.34), rgba(240,201,100,0)); pointer-events: none; }
[data-theme="light"] .rank-v8-perks--small .rank-v8-perk__crest::before { background: radial-gradient(closest-side, rgba(198,131,22,.14), rgba(198,131,22,0)); }
.rank-v8-perk__crest :deep(.team-rank-emblem) { position: relative; }
.rank-v8-perk__t { font: 500 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: break-word; }
.rank-v8-perk__t--rank { font-family: var(--font-metric); color: #E2BC62; }
[data-theme="light"] .rank-v8-perk__t--rank { color: #765816; }
.rank-v8-perk__d { margin-top: 2px; font: 400 var(--ui-type-meta)/18px var(--font-v5); color: var(--v5-ink-3); overflow-wrap: break-word; }
.rank-v8-perk__t:lang(zh), .rank-v8-perk__d:lang(zh) { word-break: keep-all; }
.rank-v8-perks--hero .rank-v8-perk { padding: 20px 8px 18px; }
.rank-v8-perks--hero .rank-v8-perk__art { width: 72px; height: 72px; margin-bottom: 10px; }
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) { .rank-v8-perk__crest::before { display: none; } }
</style>
