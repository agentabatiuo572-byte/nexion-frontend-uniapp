<template>
  <!-- 月薪卡（DESIGN 第 4 节「月薪卡」、画板 C、D 组）：纯色卡；标题行琥珀图标块＋卡片标题＋右上状态标签；
       月份等级、金额居中，提示图标在金额右侧；一行底注（上方 1px 分隔）。 -->
  <view class="rank-salary" role="group" :aria-label="title">
    <view class="rank-salary__head">
      <NxIconTile tone="amber" size="s"><NxIcon name="rank-salary" :size="20" /></NxIconTile>
      <text class="rank-salary__title" role="heading" aria-level="2">{{ title }}</text>
      <NxTag v-if="view.tag" class="rank-salary__tag" :tone="view.tag.tone"><text v-if="view.tag.busy" class="rank-salary__spin" aria-hidden="true" /><text>{{ view.tag.label }}</text></NxTag>
    </view>
    <view :key="view.statusKey" class="rank-salary__body" :class="{ 'rank-salary__body--swap': swap }">
      <text v-if="view.caption" class="rank-salary__caption">{{ view.caption }}</text>
      <view class="rank-salary__amount-row">
        <text class="rank-salary__amount nx-num-amount">{{ view.amount }}<text class="rank-salary__unit">&#160;USDT</text></text>
        <NxHintTip v-if="view.tip" class="rank-salary__tip" :tone="view.tip.tone" :lines="view.tip.lines" />
      </view>
    </view>
    <text v-if="view.note" class="rank-salary__note">{{ view.note }}</text>
    <!-- 回执 NOT_FOUND（D6）：原因在左，就地的文字按钮在右（03 §3.5.2、§3.1；10.2 重试 13/18 500）。 -->
    <view v-else-if="view.resend" class="rank-salary__resend">
      <view class="rank-salary__resend-why"><NxIcon name="hint-warn" :size="16" /><text>{{ resendNote }}</text></view>
      <view class="rank-salary__resend-btn" role="button" tabindex="0" @click="$emit('resend')" @keydown.enter.prevent="$emit('resend')" @keydown.space.prevent="$emit('resend')"><text>{{ resendLabel }}</text></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import NxIcon from "@/components/ui/nx-icon.vue";
import NxIconTile from "@/components/ui/nx-icon-tile.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import NxHintTip from "@/components/ui/nx-hint-tip.vue";
import type { SalaryCardView } from "@/lib/rank-salary-view";

defineProps<{ title: string; view: SalaryCardView; resendNote: string; resendLabel: string; /** 状态变化时主体交叉淡入（10.1 领取），首屏不播 */ swap: boolean }>();
defineEmits<{ (event: "resend"): void }>();
</script>

<style scoped>
.rank-salary { margin-top:var(--ui-space-card-gap);padding:var(--ui-space-inset);border-radius:var(--ui-radius-surface);background:var(--v5-surface);box-shadow:inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .rank-salary { box-shadow:inset 0 0 0 1px var(--v5-border),var(--v5-glass-shadow); }
/* 标题行放不下标签时，标签整颗换到下一行靠右（11.1 第 13 条）。 */
.rank-salary__head { display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;min-width:0; }
.rank-salary__title { min-width:0;font:var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5);color:var(--v5-ink);overflow-wrap:break-word; }
.rank-salary__tag { margin-left:auto;gap:4px; }
.rank-salary__spin { display:inline-block;flex:none;vertical-align:-1px;margin-right:4px;width:12px;height:12px;box-sizing:border-box;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:rank-salary-spin 800ms linear infinite; }
@keyframes rank-salary-spin { to { transform:rotate(360deg); } }
.rank-salary__body { display:flex;flex-direction:column;align-items:center;gap:2px;margin-top:4px;text-align:center; }
.rank-salary__caption { font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);color:var(--v5-ink-3); }
.rank-salary__amount-row { position:relative;display:inline-flex;align-items:center; }
/* 主金额 Montserrat 30/36 500（DESIGN 第 4 节，10.2 待登记），单位 12/16 500 辅助色。 */
.rank-salary__amount { font:500 30px/36px var(--font-amount);letter-spacing:-.02em;color:var(--v5-ink);font-variant-numeric:tabular-nums;white-space:nowrap; }
.rank-salary__unit { font:500 12px/16px var(--font-v5);letter-spacing:0;color:var(--v5-ink-3); }
/* 提示图标贴在金额右侧，不把金额推离中线。不用 transform：它会成为气泡（position: fixed）的定位容器，把气泡挪走。 */
.rank-salary__tip { position:absolute;left:100%;top:50%;margin:-10px 0 0 6px; }
.rank-salary__note { display:block;margin-top:10px;padding-top:10px;border-top:1px solid color-mix(in srgb,var(--v5-ink) 8%,transparent);font:400 12px/18px var(--font-v5);color:var(--v5-ink-3);text-align:center;overflow-wrap:break-word; }
/* 03 §3.6.1：文字在左、按钮在右；放不下时按钮整体换到下一行靠右。 */
.rank-salary__resend { display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0 12px;margin-top:10px;padding-top:2px;border-top:1px solid color-mix(in srgb,var(--v5-ink) 8%,transparent); }
.rank-salary__resend-why { display:flex;align-items:center;gap:6px;flex:1 1 160px;min-width:0;padding:8px 0;color:var(--v5-warning-ink);font:400 12px/18px var(--font-v5);overflow-wrap:break-word; }
.rank-salary__resend-why > :first-child { flex:none; }
.rank-salary__resend-btn { display:flex;align-items:center;flex:none;min-height:44px;margin-left:auto;padding:0 2px;color:var(--v5-brand);font:500 var(--ui-type-text-link)/var(--ui-type-text-link-lh) var(--font-v5);white-space:nowrap;cursor:pointer; }
.rank-salary__resend-btn text { white-space:nowrap; }
.rank-salary__resend-btn:active { opacity:.6; }
.rank-salary__resend-btn:focus-visible { outline:2px solid var(--v5-brand);outline-offset:2px;border-radius:8px; }
/* 10.1 领取：状态变化时新内容从下 8px 淡入 200ms（延迟 80），只动 transform、opacity。 */
.rank-salary__body--swap { animation:rank-salary-in 200ms 80ms cubic-bezier(.2,.8,.2,1) backwards; }
@keyframes rank-salary-in { from { opacity:0;transform:translateY(8px); } }
@media (prefers-reduced-motion: reduce) { .rank-salary__body--swap { animation:none; } .rank-salary__spin { animation-duration:2.4s; } }
:global(html.fx-still) .rank-salary__body--swap { animation:none; }
</style>
