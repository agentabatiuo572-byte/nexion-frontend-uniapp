<template>
  <AppChassis active="team">
    <view class="rank-page" :class="{ 'rank-page--dock': hasDock }">
      <SubPageHeader back="/pages/team/team" :title="t.rank.pageTitle" plain :action-label="copy.rankRules" :action="() => go('/pages/team/rank-how')" />
      <view class="rank-content">
        <template v-if="rankAvailable">
          <!-- 身份区（DESIGN 7.5、第 8 节）：V0–V6 为焦点卡（等级色相整体底色）；V7 为卡外星河舞台＋纯色条件卡；V8 为黑金会员卡。
               隐藏统计时 V7、V8 也回到中性焦点卡（徽章换成 •••• 圆），不从舞台或卡面露出等级。 -->
          <view v-if="identityKind === 'v7'" class="rank-headbg" :class="{ 'is-solid': !stageUnderHeader, 'is-still': motion.still.value }" aria-hidden="true" />
          <RankV7Stage v-if="identityKind === 'v7'" :caption="t.rank.currentRank" :theme="theme.resolved"><view ref="headSentinel" class="rank-headbg__sentinel" aria-hidden="true" /></RankV7Stage>
          <RankV8Card v-else-if="identityKind === 'v8'" :caption="t.rank.currentRank" :top-rank="t.myRank.topRank" />
          <view v-if="identityKind === 'tier' || prog.next" :class="identityKind === 'tier' ? ['rank-focus', 'nx-tint', `rank-focus--${tierSegment}`] : ['rank-card', 'rank-cond-card']" :style="identityKind === 'tier' ? focusVars : undefined">
            <view v-if="identityKind === 'tier'" class="rank-identity" :style="{ paddingTop: identityTop + 'px' }">
              <view class="rank-plate" :style="{ width: canvas + 'px', height: canvas + 'px' }">
                <template v-if="!visibility.hidden">
                  <image v-for="src in patternSrcs" :key="src" class="rank-plate__pattern" :src="src" mode="aspectFit" aria-hidden="true" />
                  <TeamRankEmblem :rank="myRank" :size="canvas" />
                </template>
                <view v-else class="rank-plate__private" aria-hidden="true"><text>••••</text></view>
              </view>
              <text class="rank-identity__caption">{{ t.rank.currentRank }}</text>
              <text class="rank-identity__num">{{ visibility.hidden ? '••••' : `V${myRank}` }}</text>
            </view>
            <RankConditions v-if="prog.next" :key="String(auth.accountId)" :class="{ 'rank-focus__conditions': identityKind === 'tier' }" :badge="identityKind === 'v7' ? prog.next.v : undefined" :heading="fmt(t.myRank.needFor, { r: nextName })" :tag="gapTag" :tag-tone="reviewPending ? 'warning' : 'neutral'" :hint="countsHint" :rows="nextConditions" :prior="priorConditions" :prior-title="fmt(t.myRank.foldTitle, { n: visibility.mask(priorMissing) })" :hidden="visibility.hidden" :sweep="!motion.still.value">
              <!-- V8 的两项文字条件（2.3）：只在 v-ranks 的 V8 带 reviewRequired 时列在「另需」下；中性图标，不画环、不计数。 -->
              <template v-if="textConditions.length">
                <text class="rank-also">{{ t.myRank.condAlso }}</text>
                <view v-for="(item, index) in textConditions" :key="item.key" class="rank-also__row" :class="{ 'rank-also__row--last': index === textConditions.length - 1 }"><view class="rank-also__lead" aria-hidden="true"><NxIcon :name="item.icon" :size="16" /></view><text class="rank-also__name">{{ item.name }}</text></view>
              </template>
              <!-- H7 审核中：卡底文字链接「联系客服 ›」（03 §3.1 P-67），不加流程、不承诺时间。 -->
              <view v-if="reviewPending && !visibility.hidden" class="nx-card-footer rank-cond-card__footer"><view class="nx-card-link" role="link" tabindex="0" @click="contactSupport" @keydown.enter.prevent="contactSupport" @keydown.space.prevent="contactSupport"><text>{{ t.tradein.recoveryContactSupport }}</text><NxIcon class="nx-card-link__chevron" name="chevron-right" :size="16" /></view></view>
            </RankConditions>
          </view>
          <!-- 月薪卡（DESIGN 第 6 节，画板 C、D）：salary 字段存在且 months 不为空时显示；salary 为 null（读取失败）时金额「—」（D9）；没有 salary 字段时按 CA 构图。 -->
          <RankSalaryCard v-if="salary.card" :title="t.myRank.salaryTitle" :view="salary.card" :resend-note="t.myRank.resendNote" :swap="salarySwap && !motion.still.value" :still="motion.still.value || (salaryPhase === 'confirming' && !salaryReceiptInFlight)" />
          <!-- V8 会员页（H0）：月薪卡后是 V8 专享权益（大号）和「你现在的权益」。 -->
          <RankV8Perks v-if="identityKind === 'v8'" size="hero" :title="fmt(t.myRank.perksCap, { r: 'V8' })" :count="fmt(t.myRank.perksCount, { n: v8Perks.length })" :perks="v8Perks" :theme="theme.resolved" />
          <view v-if="identityKind === 'v8' && currentBenefits.length" class="rank-section">
            <view class="rank-section__head"><text class="rank-section__title" role="heading" aria-level="2">{{ t.myRank.myBenefits }}</text></view>
            <view class="rank-card rank-gains">
              <view v-for="gain in currentBenefits" :key="gain.key" class="rank-gain">
                <NxIconTile :tone="gain.tone" size="s"><NxIcon :name="gain.icon" :size="20" /></NxIconTile>
                <view class="rank-gain__name"><text>{{ gain.name }}</text><NxHintBubble v-if="gain.hint" :text="gain.hint" :size="20" /></view>
                <view class="rank-gain__value"><text>{{ gain.value }}</text><text v-if="gain.unit" class="rank-gain__unit" :class="{ 'rank-gain__unit--uvt': gain.unit === 'UVT' }">&#160;{{ gain.unit }}</text></view>
              </view>
            </view>
          </view>
          <view v-if="gains.length" class="rank-section">
            <view class="rank-section__head">
              <TeamRankEmblem v-if="!visibility.hidden" class="rank-section__badge" :rank="prog.next!.v" :size="28" />
              <text class="rank-section__title" role="heading" aria-level="2">{{ fmt(t.myRank.newAt, { r: nextName }) }}</text>
            </view>
            <view class="rank-card rank-gains" :style="{ '--tier-ink': gainArrowInk }">
              <view v-for="gain in gains" :key="gain.key" class="rank-gain">
                <NxIconTile :tone="gain.tone" size="s"><NxIcon :name="gain.icon" :size="20" /></NxIconTile>
                <view class="rank-gain__name"><text>{{ gain.name }}</text><NxHintBubble v-if="gain.hint" :text="gain.hint" :size="20" /></view>
                <view class="rank-gain__value">
                  <template v-if="gain.old"><text class="rank-gain__old">{{ gain.old }}</text><view class="rank-gain__arrow"><NxIcon name="arrow-right" :size="12" /></view></template>
                  <text>{{ gain.value }}</text><text v-if="gain.unit" class="rank-gain__unit" :class="{ 'rank-gain__unit--uvt': gain.unit === 'UVT' }">&#160;{{ gain.unit }}</text>
                </view>
              </view>
            </view>
          </view>
          <!-- V7：「升到 V8 后」之后接小一号的 V8 专享权益（第 1 节第 4 条）。 -->
          <RankV8Perks v-if="identityKind === 'v7'" size="small" :title="fmt(t.myRank.perksCap, { r: 'V8' })" :count="fmt(t.myRank.perksCount, { n: v8Perks.length })" :perks="v8Perks" :theme="theme.resolved" />
          <view v-if="speedUpRows.length" class="rank-section">
            <NxSection :title="t.myRank.speedUp" />
            <view class="rank-speed">
              <NxListRow v-for="row in speedUpRows" :key="row.key" :title="row.title" :subtitle="row.subtitle" @click="go(row.href)"><template #leading><NxIconTile :tone="row.tone" size="s"><NxIcon :name="row.icon" :size="20" /></NxIconTile></template></NxListRow>
            </view>
          </view>
        <view class="rank-ladder-section">
          <NxSection :title="t.myRank.allRanks" :meta="rankDefs.length ? `V${rankDefs[0].v}–V${rankDefs[rankDefs.length-1].v}` : ''" />
          <!-- 全部等级横条（DESIGN 第 4 节阶梯项、10.1、10.3、10.5）：tablist，一块玻璃选中面滑到被选项；被选徽章按等级强度弹起（V3 起光圈，V7／V8 加星点层）。
               隐藏统计时（Ch）不标「当前」「下一级」，徽章下仍写 V0–V8 的名字（等级名是公开信息）。 -->
          <scroll-view class="rank-rail" :class="{ 'rank-rail--smooth': !motion.still.value }" scroll-x :scroll-left="railScroll" :show-scrollbar="false">
            <view class="rank-rail__track" role="tablist" :aria-label="t.myRank.allRanks">
              <view class="rank-rail__ind" :class="{ 'is-on': railInd.on, 'is-still': motion.still.value }" :style="{ width: railInd.w + 'px', height: railInd.h + 'px', transform: `translateX(${railInd.x}px)` }" aria-hidden="true" />
              <view v-for="r in rankDefs" :id="`rank-tab-${r.v}`" :key="r.v" class="rank-rail__item" :class="[`rank-rail__item--${rowStatus(r.v)}`, { 'is-pop': popRank === r.v }]" :data-t="railTier(r.v)" role="tab" tabindex="0" :aria-selected="expandedRank === r.v ? 'true' : 'false'" :aria-controls="`rank-details-${r.v}`" :aria-label="rankLabel(r.v,locale.code,rankDefs)" @click="selectRank(r.v)" @keydown.enter.prevent="selectRank(r.v)" @keydown.space.prevent="selectRank(r.v)">
                <view class="rank-rail__badge" :style="{ '--rail-accent': railAccent(r.v) }">
                  <TeamRankEmblem class="rank-rail__emb" :rank="r.v" :size="40" />
                  <view v-if="popRank === r.v && rankTierStyle(r.v).select.ring" class="rank-rail__ring" aria-hidden="true" />
                  <image v-if="popRank === r.v && rankTierStyle(r.v).select.burst" class="rank-rail__burst" :src="railBurst(r.v)" mode="aspectFit" aria-hidden="true" />
                  <!-- V5 起徽章掠光一次（10.3）：光带平移，带里的亮色副本反向平移，只在点选的这一组里存在。 -->
                  <view v-if="popRank === r.v && rankTierStyle(r.v).select.sheen" class="rank-rail__glint" aria-hidden="true"><view class="rank-rail__glint-band"><view class="rank-rail__glint-copy"><TeamRankEmblem class="rank-rail__emb" :rank="r.v" :size="40" /></view></view></view>
                </view>
                <text class="rank-rail__v" :class="{ 'rank-rail__v--v8': r.v === 8 }">V{{ r.v }}</text>
                <text class="rank-rail__s">{{ railLabel(r.v) }}</text>
              </view>
            </view>
          </scroll-view>
          <!-- 等级详情卡（E、E2）：状态标签、条件行（名称、当前／门槛、达成勾）、V8 的「另需」、权益行。门槛为 0 的条件不列。 -->
          <!-- 详情卡切换（10.1）：旧卡淡出上移 6px 120ms（离场时绝对定位，不占高度），新卡从下 8px 淡入 200ms（延迟 80）；减少动态时直接换。 -->
          <view class="rank-detail-host">
          <Transition name="rank-detail" :css="detailAnim">
          <view v-if="detail" :id="`rank-details-${detail.v}`" :key="detail.v" class="rank-detail" role="tabpanel" :aria-labelledby="`rank-tab-${detail.v}`">
            <view class="rank-detail__head">
              <TeamRankEmblem :rank="detail.v" :size="40" />
              <text class="rank-detail__name" :class="{ 'rank-detail__name--v8': detail.v === 8 }">V{{ detail.v }}</text>
              <NxTag class="rank-detail__tag" :tone="detail.tone">{{ detail.tag }}</NxTag>
            </view>
            <!-- V0 注册即得（画板 A）：没有条件行，写一行达成方式。 -->
            <template v-if="detail.v === 0 && !detail.conditions.length">
              <text class="rank-detail__label">{{ t.rank.conditionsLabel }}</text>
              <view class="rank-detail__kv rank-detail__kv--text"><text class="rank-detail__k">{{ t.myRank.noCond }}</text></view>
            </template>
            <template v-if="detail.conditions.length">
              <view class="rank-detail__label"><text>{{ t.rank.conditionsLabel }}</text><NxHintBubble v-if="detail.prevNote" :text="detail.prevNote" :size="20" /></view>
              <view v-for="row in detail.conditions" :key="row.key" class="rank-detail__kv">
                <text class="rank-detail__k">{{ row.name }}</text>
                <view class="rank-detail__v"><template v-if="row.current !== null"><text class="rank-detail__cur">{{ row.current }}</text><text> / </text></template><text class="rank-detail__tgt" :class="{ 'rank-detail__tgt--only': row.current === null }">{{ row.target }}</text><text v-if="row.unit">&#160;{{ row.unit }}</text>
                  <view v-if="row.state !== 'hidden'" class="rank-detail__st" :class="`rank-detail__st--${row.state}`" aria-hidden="true"><NxIcon v-if="row.state === 'met'" name="check" :size="16" /></view>
                </view>
              </view>
            </template>
            <template v-if="detail.text.length">
              <text class="rank-detail__label">{{ t.myRank.condAlso }}</text>
              <view v-for="item in detail.text" :key="item.key" class="rank-detail__kv rank-detail__kv--text"><view class="rank-also__lead rank-also__lead--s" aria-hidden="true"><NxIcon :name="item.icon" :size="14" /></view><text class="rank-detail__k">{{ item.name }}</text></view>
            </template>
            <text class="rank-detail__label">{{ t.myRank.benefits }}</text>
            <view v-for="gain in detail.benefits" :key="gain.key" class="rank-gain rank-gain--detail">
              <NxIconTile :tone="gain.tone" size="s"><NxIcon :name="gain.icon" :size="20" /></NxIconTile>
              <view class="rank-gain__name"><text>{{ gain.name }}</text><NxHintBubble v-if="gain.hint" :text="gain.hint" :size="20" /></view>
              <view class="rank-gain__value"><text>{{ gain.value }}</text><text v-if="gain.unit" class="rank-gain__unit" :class="{ 'rank-gain__unit--uvt': gain.unit === 'UVT' }">&#160;{{ gain.unit }}</text></view>
            </view>
            <view v-if="detail.def.unilevelDepth > 0" class="rank-scope-link" role="link" tabindex="0" @click="go('/pages/team/rank-how')" @keydown.enter.prevent="go('/pages/team/rank-how')"><text>{{ guideCopy.rewardScope }}</text><NxIcon name="chevron-right" :size="16" /></view>
          </view>
          </Transition>
          </view>
          <!-- 详情卡下方的内容：卡片高度变了时按高度差用 transform 滑到新位置（FLIP，280ms），不跳。 -->
          <view class="rank-ladder-below" :style="{ ...belowStyle, paddingBottom: belowReserve ? belowReserve + 'px' : undefined }">
            <!-- V0–V6 用户选中 V8 时，详情卡下接小一号的 V8 专享权益（E2），同样淡入；V7 页面上方「升到 V8 后」后已经有这一块，不再重复。 -->
            <Transition name="rank-fade" :css="detailAnim">
              <RankV8Perks v-if="detail?.v === 8 && prog.next?.v !== 8 && identityKind !== 'v8' && !visibility.hidden" size="small" :glint-delay="rankTierStyle(8).select.ms" :title="fmt(t.myRank.perksCap, { r: 'V8' })" :count="fmt(t.myRank.perksCount, { n: v8Perks.length })" :perks="v8Perks" :theme="theme.resolved" />
            </Transition>
            <text v-if="!detail" class="rank-ladder-hint">{{ t.myRank.expandRank }}</text>
          </view>
        </view>
        </template>
        <EmptyState v-else-if="vState.remoteError" kind="recoverable-error" page :title="t.rank.loadError" :cta-label="t.ui.reload" @cta="retryRank" />
        <!-- 首次加载（03 §3.4）：焦点卡、月薪卡、横条按各自尺寸的静止占位，不闪烁；读到数据后换成真实内容。 -->
        <view v-else class="rank-loading" role="status" aria-busy="true" :aria-label="t.rank.loading">
          <view class="rank-focus nx-tint rank-loading__focus" aria-hidden="true">
            <view class="rank-loading__badge" />
            <view class="rank-loading__bar rank-loading__bar--caption" />
            <view class="rank-loading__bar rank-loading__bar--num" />
            <view class="rank-loading__conditions">
              <view class="rank-loading__head"><view class="rank-loading__bar rank-loading__bar--title" /><view class="rank-loading__bar rank-loading__bar--tag" /></view>
              <view v-for="n in 4" :key="n" class="rank-loading__row"><view class="rank-loading__ring" /><view class="rank-loading__bar rank-loading__bar--name" /><view class="rank-loading__bar rank-loading__bar--value" /></view>
            </view>
          </view>
          <view class="rank-salary-ph" aria-hidden="true">
            <view class="rank-salary-ph__head"><view class="rank-loading__icon" /><view class="rank-loading__bar rank-loading__bar--title" /><view class="rank-loading__bar rank-loading__bar--tag" /></view>
            <view class="rank-loading__bar rank-loading__bar--caption" />
            <view class="rank-loading__bar rank-loading__bar--amount" />
            <view class="rank-loading__bar rank-loading__bar--note" />
          </view>
          <view class="rank-loading__rail" aria-hidden="true">
            <view v-for="n in 5" :key="n" class="rank-loading__item"><view class="rank-loading__emblem" /><view class="rank-loading__bar rank-loading__bar--name" /></view>
          </view>
        </view>
      </view>
    </view>
    <!-- 底部操作栏（DESIGN 2.1）：有可领月薪时按 salaryDock，否则是补差距最有效的一步（dockAction）。 -->
    <template #pageFixed>
      <!-- 领取（2.1）：悬浮按钮「领取 N USDT」；晋升当天为托盘；领取中为灰色禁用按钮；结果确认中为状态胶囊。 -->
      <view v-if="salaryDock?.kind === 'claim'" class="rank-dock nx-glass-bar"><NxButton variant="primary" @click="claimSalary">{{ salaryDock.label }}</NxButton></view>
      <view v-else-if="salaryDock?.kind === 'tray'" class="rank-dock nx-glass-bar"><text class="nx-tray-copy rank-dock__copy">{{ salaryDock.copy }}</text><view class="nx-tray-text rank-dock__text" role="button" tabindex="0" @click="openSalaryPromo" @keydown.enter.prevent="openSalaryPromo" @keydown.space.prevent="openSalaryPromo"><text>{{ salaryDock.button }}</text></view></view>
      <view v-else-if="salaryDock?.kind === 'resend'" class="rank-dock nx-glass-bar"><NxButton variant="primary" @click="resendSalaryClaim">{{ salaryDock.label }}</NxButton></view>
      <view v-else-if="salaryDock?.kind === 'busy'" class="rank-dock nx-glass-bar"><NxButton variant="primary" disabled><view class="rank-dock__spin" :class="{ 'is-still': motion.still.value }" aria-hidden="true" /><text>{{ salaryDock.label }}</text></NxButton></view>
      <view v-else-if="salaryDock?.kind === 'status'" class="rank-dock nx-glass-bar"><view class="nx-tray-status rank-dock__status" role="status"><view class="rank-dock__spin" :class="{ 'is-still': motion.still.value || !salaryReceiptInFlight }" aria-hidden="true" /><text>{{ salaryDock.label }}</text></view></view>
      <view v-else-if="!salaryDock && dockAction" class="rank-dock nx-glass-bar"><NxButton variant="primary" @click="go(dockAction.href)">{{ dockAction.label }}</NxButton></view>
      <!-- 确认框（03 §3.5 决定级）：D4b／D4d 晋升当天，D10 金额已变化；返回、Esc、点蒙层等同文字按钮。 -->
      <NxNoticeDialog :open="!!salaryDialogView" :title="salaryDialogView?.title ?? ''" :body="salaryDialogView?.body" :primary="salaryDialogView?.primary ?? ''" :secondary="salaryDialogView?.secondary" mask-secondary focus-title @primary="confirmSalaryDialog" @secondary="salaryDialog = null" />
    </template>
  </AppChassis>
</template>

<script setup lang="ts">
import NxIcon, { type NxIconName } from "@/components/ui/nx-icon.vue";
import NxIconTile from "@/components/ui/nx-icon-tile.vue";
import NxHintBubble from "@/components/ui/nx-hint-bubble.vue";
import RankConditions, { type RankConditionRow } from "@/components/team/rank-conditions.vue";
import RankSalaryCard from "@/components/team/rank-salary-card.vue";
import RankV7Stage from "@/components/team/rank-v7-stage.vue";
import RankV8Card from "@/components/team/rank-v8-card.vue";
import RankV8Perks from "@/components/team/rank-v8-perks.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import { CHASSIS_QUERY_SCOPE, useLoopsInView } from "@/composables/use-loops-in-view";
import { advisorChatRoute } from "@/lib/advisor-chat-route";
import { useConversations } from "@/store/conversations";
import NxNoticeDialog from "@/components/ui/nx-notice-dialog.vue";
import { compareSalaryAmounts, displayedSalaryMonth, lastClaimDay, salaryAmountExpiresAt, salaryDates, salaryDay, salaryView } from "@/lib/rank-salary-view";
import { toast } from "@/store/ui";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { useRankFxMotion } from "@/composables/use-rank-fx-guard";
import { rankRequirementStatus, teamRankProgress } from "@/lib/team-rank-progress";
import { navTo } from "@/lib/route";
import { isEntitlementVRankReward } from "@/lib/rank-entitlement-label";
import { RANK_ASSETS, rankAsset, rankTierStyle, rankTierVars, type RankPerk } from "@/lib/rank-tier-style";
import { computed, getCurrentInstance, inject, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import EmptyState from "@/components/empty-state.vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import TeamRankEmblem from '@/components/team/team-rank-emblem.vue';
import NxSection from "@/components/ui/nx-section.vue";
import NxListRow from "@/components/ui/nx-list-row.vue";
import { useAuditUiCopy } from '@/i18n/audit-ui';
import { rankGuideCopy } from '@/i18n/rank-guide-copy';
import NxButton from "@/components/ui/nx-button.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useVRank, type VRank, type VRankDef } from "@/store/v-rank";
import { useCommission } from "@/store/commission";
import { rankLabel } from "@/lib/v-rank-copy";
import { formatHowNumber, formatRankPurchaseRate } from "@/lib/rank-how-content";
import { useLocaleStore } from "@/store/locale";
import { useAuth } from "@/store/auth";
import { useTheme } from "@/store/theme";
import { useDataVisibility } from "@/store/data-visibility";
import { remoteApiEnabled } from "@/api/runtime";
import type { RankSalary, RankSalaryAttempt, RankSalaryClaim } from "@/api/v-rank-api";
import { useRankSalaryClaim } from "@/composables/use-rank-salary-claim";
import { onShow } from "@dcloudio/uni-app";

const t = useT();
const copy = useAuditUiCopy();
const locale = useLocaleStore();
const guideCopy = computed(() => rankGuideCopy(locale.code));
const vState = useVRank();
const commission = useCommission();
const auth = useAuth();
const theme = useTheme();
const visibility = useDataVisibility();
const motion = useRankFxMotion();

const myRank = computed(() => vState.myRank);
const rankDefs = computed(() => vState.ladder);
const rankAvailable = computed(() => !remoteApiEnabled || vState.remoteReady);

// The API supplies exact rank buckets; the engine counts members at or above
// each required rank. This projection is only for the observed progress display.
const previewData = computed(() => ({
  myRank: vState.myRank,
  selfComputePoints: vState.selfComputePoints,
  directRefs: vState.directRefs,
  teamComputePoints: vState.teamComputePoints,
  vDownlineCounts: vState.vDownlineCounts,
}));
const prog = computed(() => teamRankProgress(previewData.value, rankDefs.value));
const expandedRank = ref<VRank | null>(null);
let expandedAccount = auth.accountId;
let expandedHidden = visibility.hidden;
let expansionInitialized = false;
watch(() => [auth.accountId, rankAvailable.value, visibility.hidden, myRank.value, rankDefs.value.map(rank => rank.v).join(',')] as const, ([account, ready, hidden]) => {
  if (account !== expandedAccount || hidden !== expandedHidden) {
    expandedAccount = account;
    expandedHidden = hidden;
    expansionInitialized = false;
    expandedRank.value = null;
  }
  // onShow can hide or clear facts while rereading. Only a complete ladder can
  // invalidate the chosen tier; null after initialization is an intentional fold.
  if (!ready) return;
  if (!expansionInitialized || (expandedRank.value !== null && !rankDefs.value.some(rank => rank.v === expandedRank.value))) {
    // 阶梯默认展开当前等级；V8 会员默认不展开，横条滚到 V8，下面一句「点开查看条件与权益」（11.2 第 6 条）。
    const preferred = hidden || myRank.value === 8 ? null : myRank.value;
    expandedRank.value = preferred !== null && rankDefs.value.some(rank => rank.v === preferred) ? preferred : null;
    expansionInitialized = true;
  }
}, { immediate: true });

// ── 焦点卡身份区（DESIGN 7.2、7.5；隐藏统计时中性取值、徽章换成 •••• 圆）──
// V7 星河舞台、V8 黑金会员卡（第 8 节）；隐藏统计时回到中性焦点卡。
const identityKind = computed<'tier' | 'v7' | 'v8'>(() => visibility.hidden ? 'tier' : myRank.value === 7 ? 'v7' : myRank.value === 8 ? 'v8' : 'tier');
// V7 页头底色（8.1 第 2 条）：舞台底部滚到页头下面时，页头下面一层无模糊的页面底色淡入（200ms）。哨兵在舞台底部往上一个页头高的位置。
const { elRef: headSentinel, running: stageUnderHeader } = useLoopsInView('.rank-headbg__sentinel');
const tierStyle = computed(() => rankTierStyle(myRank.value));
const tierSegment = computed(() => visibility.hidden ? 'hidden' : tierStyle.value.segment);
const focusVars = computed(() => rankTierVars(myRank.value, theme.resolved, visibility.hidden));
const canvas = computed(() => visibility.hidden ? rankTierStyle(0).canvas : tierStyle.value.canvas);
const identityTop = computed(() => visibility.hidden ? rankTierStyle(0).identityTop : tierStyle.value.identityTop);
const patternSrcs = computed(() => {
  const pattern = tierStyle.value.pattern;
  if (pattern === 'rings') return [rankAsset(RANK_ASSETS.patternRings, theme.resolved)];
  if (pattern === 'lattice') return [rankAsset(RANK_ASSETS.patternLattice, theme.resolved)];
  if (pattern === 'lattice-sparkles') return [rankAsset(RANK_ASSETS.patternLattice, theme.resolved), rankAsset(RANK_ASSETS.sparkles, theme.resolved)];
  return [];
});
const nextName = computed(() => visibility.mask(prog.value.next ? `V${prog.value.next.v}` : ''));

// ── 条件区（DESIGN 第 4 节条件行、2.2 计数、2.6 提示）──
const number = (value: number | undefined) => value === undefined ? '—' : formatHowNumber(value, locale.code);
// 门槛为 0 的条件表示该级不要求这一项，不列（rank-rules）；顺序同画板：自购、团队、已购人数、V{n}+ 人数。
const CONDITION_ORDER = ['selfComputePoints', 'teamComputePoints', 'directRefs', 'vDownlines'];
const conditionRows = computed(() => prog.value.rows
  .filter(row => row.required > 0 && (row.tier === prog.value.next?.v || row.status !== 'met'))
  .sort((a, b) => a.tier - b.tier || CONDITION_ORDER.indexOf(a.kind) - CONDITION_ORDER.indexOf(b.kind))
  .map(row => {
    const known = row.status !== 'unknown';
    const name = row.kind === 'selfComputePoints' ? t.value.myRank.self : row.kind === 'teamComputePoints' ? t.value.myRank.team
      : row.kind === 'directRefs' ? t.value.myRank.buyers : fmt(t.value.myRank.leaders, { r: `V${row.vLevel ?? 0}` });
    const people = row.kind === 'directRefs' || row.kind === 'vDownlines';
    const current = visibility.mask(number(row.current));
    const target = number(row.required);
    const unit = people ? t.value.myRank.people : '';
    return {
      tier: row.tier,
      key: row.key,
      name: (row.tier < prog.value.next!.v ? `V${row.tier} · ` : '') + name,
      current, target, unit,
      percent: !known ? undefined : row.required === 0 ? 100 : Math.min(100, Math.max(0, Math.round(row.current! / row.required * 100))),
      met: row.status === 'met',
      spoken: `${current} / ${target}${unit ? ` ${unit}` : ''}`,
    } satisfies RankConditionRow & { tier: number };
  }));
const nextConditions = computed(() => conditionRows.value.filter(row => row.tier === prog.value.next?.v));
const priorConditions = computed(() => conditionRows.value.filter(row => row.tier !== prog.value.next?.v));
const priorMissing = computed(() => prog.value.unmet.filter(row => row.tier !== prog.value.next?.v).length);
const reviewPending = computed(() => !visibility.hidden && prog.value.reviewPending);
const gapTag = computed(() => {
  if (prog.value.reviewPending) return visibility.mask(t.value.myRank.reviewTag);
  if (!prog.value.unmetCount) return '';
  return fmt(t.value.myRank.leftTag, { n: visibility.mask(prog.value.unmetCount) });
});
const countsHint = computed(() => prog.value.rows.some(row => row.tier === prog.value.next?.v && (row.kind === 'directRefs' || row.kind === 'vDownlines'))
  ? [t.value.myRank.countsNote] : []);

// ── 「升到 Vn 后」：只列升级后会变的项（DESIGN 第 5 节；7.2 箭头用目标等级点缀色）──
const percentText = (rate: string | number | undefined) => formatRankPurchaseRate(rate, locale.code);
// 没有公开购买字段时读有效七层配置的第 1、2 层，读不到为未知；有字段且为 0 不回退。
const sharedRate = (layer: 1 | 2) => remoteApiEnabled ? commission.config?.unilevelUsdt[layer] : commission.unilevelRate(layer);
const l1Rate = (rank: VRankDef) => rank.purchaseL1Rate ?? sharedRate(1);
const l2Rate = (rank: VRankDef) => rank.purchaseL2Rate ?? sharedRate(2);
const needsSharedRates = computed(() => remoteApiEnabled && rankAvailable.value
  && rankDefs.value.some(rank => rank.purchaseL1Rate === undefined || rank.purchaseL2Rate === undefined));
watch(needsSharedRates, missing => {
  if (missing) void commission.ensureCanonicalConfig();
}, { immediate: true });
const uvtReward = (rank: VRankDef) => rank.rewards.reduce((sum, reward) => !isEntitlementVRankReward(reward) && reward.type === 'UVT' && Number.isFinite(reward.amount) ? sum + reward.amount : sum, 0);
type Gain = { key: string; icon: NxIconName; tone: 'sky' | 'purple' | 'amber'; name: string; old?: string; value: string; unit?: string; hint?: string[] };
const gains = computed<Gain[]>(() => {
  const next = prog.value.next;
  const current = rankDefs.value.find(rank => rank.v === myRank.value);
  if (!next || !current) return [];
  const rows: Gain[] = [];
  if (l1Rate(current) !== l1Rate(next)) rows.push({ key: 'l1', icon: 'rank-rate-l1', tone: 'sky', name: t.value.myRank.gainF1, old: percentText(l1Rate(current)), value: percentText(l1Rate(next)) });
  if (l2Rate(current) !== l2Rate(next)) rows.push({ key: 'l2', icon: 'rank-rate-l2', tone: 'sky', name: t.value.myRank.gainF2, old: percentText(l2Rate(current)), value: percentText(l2Rate(next)) });
  const uvt = uvtReward(next);
  if (uvt > 0) rows.push({ key: 'uvt', icon: 'rank-uvt', tone: 'purple', name: t.value.myRank.rankUpTo, value: `+${formatHowNumber(uvt, locale.code)}`, unit: 'UVT', hint: [fmt(t.value.myRank.rewardNote, { r: nextName.value })] });
  const salaryFrom = current.monthlySalaryUsdt ?? '0', salaryTo = next.monthlySalaryUsdt;
  if (vState.salary !== undefined && salaryTo && compareSalaryAmounts(salaryTo, '0') > 0 && compareSalaryAmounts(salaryTo, salaryFrom) !== 0) rows.push({ key: 'salary', icon: 'rank-salary', tone: 'amber', name: t.value.myRank.monthly, old: compareSalaryAmounts(salaryFrom, '0') > 0 ? formatHowNumber(salaryFrom, locale.code) : undefined, value: formatHowNumber(salaryTo, locale.code), unit: 'USDT' });
  return rows;
});
const gainArrowInk = computed(() => prog.value.next ? rankTierVars(prog.value.next.v, theme.resolved, visibility.hidden)['--tier-ink'] : '');
// 一级的权益行（详情卡、「你现在的权益」）。
function benefitRows(rank: VRankDef): Gain[] {
  const rows: Gain[] = [
    { key: 'l1', icon: 'rank-rate-l1', tone: 'sky', name: t.value.myRank.gainF1, value: percentText(l1Rate(rank)) },
    { key: 'l2', icon: 'rank-rate-l2', tone: 'sky', name: t.value.myRank.gainF2, value: percentText(l2Rate(rank)) },
  ];
  const uvt = uvtReward(rank);
  if (uvt > 0) rows.push({ key: 'uvt', icon: 'rank-uvt', tone: 'purple', name: t.value.myRank.rankUpTo, value: formatHowNumber(uvt, locale.code), unit: 'UVT', hint: [fmt(t.value.myRank.rewardNote, { r: `V${rank.v}` })] });
  const salaryUsdt = rank.monthlySalaryUsdt;
  if (vState.salary !== undefined && salaryUsdt && compareSalaryAmounts(salaryUsdt, '0') > 0) rows.push({ key: 'salary', icon: 'rank-salary', tone: 'amber', name: t.value.myRank.monthly, value: formatHowNumber(salaryUsdt, locale.code), unit: 'USDT' });
  return rows;
}

// ── 月薪卡与领取（DESIGN 2.1、第 6 节，画板 C、D 组）──
const salarySwap = ref(false);
const salaryDialog = ref<"promo" | "amount" | null>(null);
const promoSalary = ref<RankSalary | null>(null);
const amountChange = ref<RankSalaryAttempt | null>(null);
const reconfirm = ref<RankSalaryClaim | null>(null);
const salaryAccount = () => auth.isAuthenticated && auth.accountId !== "default" ? auth.accountId : null;
const salaryAmountText = (value: string) => visibility.mask(`${formatHowNumber(value, locale.code)}\u00A0USDT`);

const { phase: salaryPhase, pending: salaryAttempt, receiptInFlight: salaryReceiptInFlight, submit: submitClaim, resend: resendClaim } = useRankSalaryClaim({
  account: salaryAccount,
  failed: () => toast.warn(t.value.myRank.toastFailTitle),
  async settled(result, attempt, isVisible) {
    const copy = t.value.myRank;
    const dates = salaryDates(locale.code);
    const { item } = attempt;
    if (result.status === "SUCCEEDED") {
      toast.success(fmt(copy.toastOkTitle, { a: salaryAmountText(result.amountUsdt) }), copy.toastOkDesc);
      await vState.refreshCanonicalVRank();
      return;
    }
    const code = result.status === "REJECTED" ? result.rejectionCode : "";
    if (code === "COVERAGE_BELOW_REDLINE" || code === "COVERAGE_UNAVAILABLE") {
      const deadline = lastClaimDay(attempt.amountExpiresAt ?? item.expiresAt);
      const today = vState.salary?.businessDate ?? attempt.businessDate;
      const upcoming = vState.salary?.upcoming;
      // 今天截止但还有下一档：月中明天起可领，月末只限下月 1 日当天。
      const following = today === deadline && upcoming?.month === item.month && Number(upcoming.amountUsdt) > 0 && compareSalaryAmounts(upcoming.amountUsdt, item.amountUsdt) !== 0 ? upcoming : null;
      const followingDay = following ? salaryDay(following.claimableFrom) : "";
      const desc = following ? dates.sentence(fmt(followingDay.slice(0, 7) === item.month ? copy.toastFailDrop : copy.toastFailEnd, { a: salaryAmountText(item.amountUsdt), b: salaryAmountText(following.amountUsdt), d: dates.day(followingDay) }))
        : today === deadline ? copy.toastFailToday : dates.sentence(fmt(copy.toastFailDesc, { d: dates.day(deadline) }));
      toast.warn(copy.toastFailTitle, desc);
    } else if (code === "SALARY_ALREADY_CLAIMED" || code === "SALARY_NOT_CLAIMABLE" || code === "SALARY_AMOUNT_CHANGED") {
      await vState.refreshCanonicalVRank();
      if (!isVisible()) return;
      if (code === "SALARY_NOT_CLAIMABLE" && vState.salary && !vState.salary.months.some(month => month.month === item.month)) {
        toast.warn(dates.sentence(fmt(copy.expiredToast, { m: dates.month(item.month) })));
      }
      if (result.status === "REJECTED" && code === "SALARY_AMOUNT_CHANGED" && result.amountUsdt !== undefined) {
        reconfirm.value = { month: item.month, amountUsdt: result.amountUsdt };
        openAmountChange();
      }
    } else {
      toast.warn(copy.toastFailTitle);
    }
  },
});

function openAmountChange() {
  const change = reconfirm.value;
  if (!change || !vState.salary) return;
  const current = vState.salary.months.find(month => month.month === change.month);
  reconfirm.value = null;
  if (current?.status !== "CLAIMABLE") return;
  // The rejected receipt carries an amount but no rank. Use the same month's
  // fresh rank, and its amount if the qualification changed again since the receipt.
  const amountUsdt = compareSalaryAmounts(current.amountUsdt, change.amountUsdt) === 0
    ? change.amountUsdt : current.amountUsdt;
  amountChange.value = salaryAttemptFor(vState.salary, { ...current, amountUsdt });
  salaryDialog.value = "amount";
}
watch(() => vState.salary, openAmountChange);
watch(salaryAccount, () => {
  salaryDialog.value = null;
  promoSalary.value = null;
  amountChange.value = null;
  reconfirm.value = null;
});

const salaryViewOptions = computed(() => ({
  hidden: visibility.hidden,
  locale: locale.code,
  copy: t.value.myRank,
  mask: visibility.mask,
}));
const salary = computed(() => salaryView({
  ...salaryViewOptions.value,
  salary: vState.salary,
  phase: salaryPhase.value,
  pending: salaryAttempt.value,
}));
const salaryDock = computed(() => salary.value.dock);
const hasDock = computed(() => !!salaryDock.value || !!dockAction.value);
const salaryDialogView = computed(() => {
  const copy = t.value.myRank, d = salaryDates(locale.code);
  const promo = promoSalary.value && salaryView({ ...salaryViewOptions.value, salary: promoSalary.value, phase: "idle" }).promo;
  if (salaryDialog.value === "promo" && promo) return {
    title: d.sentence(fmt(copy.dlgTitle, { b: promo.now })),
    body: d.sentence(promo.end ? fmt(copy.dlgEndBody, { d: promo.date, a: promo.next, m: promo.month }) : fmt(copy.dlgBody, { a: promo.next })),
    primary: fmt(copy.dlgPrimary, { b: promo.now }),
    secondary: promo.end ? d.sentence(fmt(copy.dlgWaitDate, { d: promo.date })) : copy.dlgSecondary,
  };
  const change = amountChange.value?.item;
  if (salaryDialog.value === "amount" && change) return {
    title: fmt(copy.amtTitle, { a: salaryAmountText(change.amountUsdt) }),
    body: fmt(copy.amtBody, { r: visibility.mask(change.rankCode) }),
    primary: fmt(copy.claimBtn, { a: salaryAmountText(change.amountUsdt) }),
    secondary: copy.amtCancel,
  };
  return null;
});
function submitSalary(attempt: RankSalaryAttempt) {
  salarySwap.value = true;
  submitClaim(attempt);
}
function salaryAttemptFor(source: RankSalary, item: RankSalaryAttempt['item']): RankSalaryAttempt {
  return { item, businessDate: source.businessDate, amountExpiresAt: salaryAmountExpiresAt(source, item) };
}
function claimSalary() {
  const source = vState.salary;
  const item = displayedSalaryMonth(source);
  if (salaryDock.value?.kind === "claim" && source && item) submitSalary(salaryAttemptFor(source, item));
}
function openSalaryPromo() {
  if (salaryDock.value?.kind !== "tray" || !vState.salary) return;
  promoSalary.value = vState.salary;
  salaryDialog.value = "promo";
}
function confirmSalaryDialog() {
  const which = salaryDialog.value, source = promoSalary.value, change = amountChange.value;
  salaryDialog.value = null;
  if (which === "promo" && source) {
    const item = displayedSalaryMonth(source);
    if (item) submitSalary(salaryAttemptFor(source, item));
  }
  if (which === "amount" && change) submitSalary(change);
}
function resendSalaryClaim() {
  salarySwap.value = true;
  resendClaim();
}
// ── 底部操作栏（2.1 非领取状态）与「加快晋级」（2.4：同三个目的地，底部按钮已覆盖的不重复）──
const missingKinds = computed(() => new Set(prog.value.missing.map(row => row.kind)));
const dockAction = computed(() => {
  const kinds = missingKinds.value;
  if (salaryDock.value || !prog.value.next || !kinds.size) return null;
  return [...kinds].every(kind => kind === 'selfComputePoints')
    ? { kind: 'store' as const, label: t.value.earn.selectDevice, href: '/pages/store/store' }
    : { kind: 'invite' as const, label: t.value.myRank.inviteBtn, href: '/pages/team/team?intent=share' };
});
const firstGap = (kind: string) => prog.value.missing.find(row => row.kind === kind && row.tier === prog.value.next?.v) ?? prog.value.missing.find(row => row.kind === kind);
const speedUpRows = computed(() => {
  const rows: { key: string; title: string; subtitle: string; href: string; icon: NxIconName; tone: 'sky' | 'amber' | 'device' }[] = [];
  const gapOf = (kind: string) => { const row = firstGap(kind); return row ? row.required - row.current! : undefined; };
  const buyers = gapOf('directRefs');
  if (buyers !== undefined && dockAction.value?.kind !== 'invite') rows.push({ key: 'invite', title: t.value.myRank.inviteBtn, subtitle: fmt(t.value.myRank.rowInviteSub, { a: visibility.mask(number(buyers)) }), href: '/pages/team/team?intent=share', icon: 'user-plus', tone: 'sky' });
  const leaders = firstGap('vDownlines');
  if (leaders) rows.push({ key: 'friends', title: t.value.myRank.rowFriends, subtitle: fmt(t.value.myRank.rowFriendsSub, { b: visibility.mask(number(leaders.required - leaders.current!)), r: `V${leaders.vLevel}` }), href: '/pages/team/tree', icon: 'users', tone: 'amber' });
  const team = gapOf('teamComputePoints');
  if (team !== undefined) rows.push({ key: 'team', title: t.value.myRank.rowTeam, subtitle: fmt(t.value.myRank.rowTeamSub, { n: visibility.mask(number(team)) }), href: '/pages/team/tree', icon: 'bar-chart', tone: 'sky' });
  const self = gapOf('selfComputePoints');
  if (self !== undefined && dockAction.value?.kind !== 'store') rows.push({ key: 'store', title: t.value.earn.selectDevice, subtitle: fmt(t.value.myRank.rowStoreSub, { n: visibility.mask(number(self)) }), href: '/pages/store/store', icon: 'bag', tone: 'device' });
  return rows;
});

onMounted(() => {
  // Local rank data is not used in remote mode; the ladder and member progress arrive together.
  if (remoteApiEnabled) void vState.ensureCanonicalVRank();
});
onShow(() => {
  if (remoteApiEnabled) void vState.ensureCanonicalVRank();
});

function retryRank() {
  if (remoteApiEnabled) void vState.refreshCanonicalVRank();
}

function rowStatus(v: VRank): "done" | "current" | "next" | "locked" {
  if (visibility.hidden) return "locked";
  return v < vState.myRank ? "done" : v === vState.myRank ? "current" : prog.value.next?.v === v ? "next" : "locked";
}

function go(url: string) {
  navTo(url);
}

// ── 全部等级横条（DESIGN 第 4 节阶梯项、10.1、10.3、10.5）──────────────────────────────
// 状态字：已达成／当前／下一级；隐藏统计时（Ch）一律不写，横条不暴露当前等级。
function railLabel(v: VRank): string {
  if (visibility.hidden) return '';
  const status = rowStatus(v);
  if (status === 'done') return t.value.rank.done;
  if (status === 'current') return t.value.myRank.sCur;
  return status === 'next' ? t.value.myRank.sNext : '';
}
// 点选动画强度档（10.3）：0＝V0–V2，1＝V3–V4，2＝V5–V6，3＝V7–V8。弹起只做在徽章容器上（光圈、掠光和徽章一起缩放），不重复动画每个副本（10.4 P6）。
const railTier = (v: number) => v >= 7 ? 3 : v >= 5 ? 2 : v >= 3 ? 1 : 0;
const railAccent = (v: number) => rankTierStyle(v).accent?.[theme.resolved] ?? 'var(--v5-brand)';
const railBurst = (v: number) => rankAsset(rankTierStyle(v).select.burst === 'gold' ? RANK_ASSETS.burstGold : RANK_ASSETS.burstPlat, theme.resolved);
// 一次性点选动画组（≤320ms）：开始新的一组时上一组的类直接移走，动画随之结束（10.4 P10）。减少动态、省电时不播。
const popRank = ref<VRank | null>(null);
let popTimer: ReturnType<typeof setTimeout> | undefined;
// 详情卡下方内容的 FLIP（10.1）：切换前后各量一次位置，先按差值反向平移，下一帧 280ms 回到原位；只动 transform。
const belowStyle = ref<Record<string, string>>({});
// 卡片变矮时页面不跟着变短：在下方补回差值，否则滚到底时浏览器会在旧卡淡出后把整页往下拽（内容跳一下）。变高时先用掉补的空间。
const belowReserve = ref(0);
let flipTimers: ReturnType<typeof setTimeout>[] = [];
function belowTop(): Promise<{ top: number | null; card: number }> {
  return new Promise(resolve => {
    const query = queryScope ? uni.createSelectorQuery().in(queryScope) : uni.createSelectorQuery();
    query.select('.rank-ladder-below').boundingClientRect();
    query.select('.rank-detail-host').boundingClientRect();
    query.exec((res: (UniApp.NodeInfo | null)[]) => resolve({ top: res[0]?.top ?? null, card: res[1]?.height ?? 0 }));
  });
}
async function selectRank(v: VRank) {
  if (expandedRank.value === v) return;
  if (popTimer) clearTimeout(popTimer);
  flipTimers.forEach(clearTimeout); flipTimers = [];
  popRank.value = null;
  belowStyle.value = {};
  if (motion.still.value) { expandedRank.value = v; return; }
  const before = await belowTop();
  // 换卡前先按旧卡高度临时补足下方空间，新卡再矮页面也不会变短（否则滚到底时浏览器立刻把整页往下拽）；量完再换成实际差值。
  const reserve = belowReserve.value;
  belowReserve.value = reserve + before.card;
  expandedRank.value = v;
  await nextTick();
  popRank.value = v;
  popTimer = setTimeout(() => { popRank.value = null; }, rankTierStyle(v).select.ms + 20);
  const after = await belowTop();
  const dy = before.top !== null && after.top !== null ? Math.round(before.top - after.top) : 0;
  belowReserve.value = Math.max(0, reserve + dy);
  if (!dy) return;
  belowStyle.value = { transform: `translateY(${dy}px)` };
  flipTimers.push(setTimeout(() => { belowStyle.value = { transform: 'translateY(0)', transition: 'transform 280ms cubic-bezier(.2,.8,.2,1)' }; }, 16));
  flipTimers.push(setTimeout(() => { belowStyle.value = {}; }, 320));
}
onUnmounted(() => { if (popTimer) clearTimeout(popTimer); flipTimers.forEach(clearTimeout); });
// 选中面：一块绝对定位的玻璃面按选中项的位置平移（240ms），横条平滑滚到选中项居中。App 逻辑层没有 DOM，用选择器查询量位置。
const queryScope = inject(CHASSIS_QUERY_SCOPE, null) ?? getCurrentInstance()?.proxy ?? null;
const railInd = reactive({ x: 0, w: 0, h: 0, on: false });
const railScroll = ref(0);
const railRank = computed(() => expandedRank.value ?? (!visibility.hidden && myRank.value === 8 ? 8 : null));
function measureRail() {
  const v = railRank.value;
  if (v === null) {
    railInd.on = false;
    railScroll.value = 0;
    return;
  }
  const query = queryScope ? uni.createSelectorQuery().in(queryScope) : uni.createSelectorQuery();
  query.select('.rank-rail__track').boundingClientRect();
  query.select('.rank-rail').boundingClientRect();
  query.select(`#rank-tab-${v}`).boundingClientRect();
  query.exec((res: (UniApp.NodeInfo | null)[]) => {
    if (railRank.value !== v) return;
    const [track, rail, item] = res;
    if (!track || !rail || !item || item.left === undefined || track.left === undefined || rail.width === undefined) return;
    const x = item.left - track.left;
    if (expandedRank.value !== null) Object.assign(railInd, { x, w: item.width ?? 0, h: item.height ?? 0, on: true });
    else railInd.on = false;
    railScroll.value = Math.max(0, Math.round(x - (rail.width - (item.width ?? 0)) / 2));
  });
}
watch(() => [railRank.value, expandedRank.value, rankDefs.value.length, locale.code, rankAvailable.value] as const, () => { void nextTick(measureRail); }, { immediate: true });

// ── 等级详情卡（E、E2；Ch 只遮当前值和状态标签）──
const VRANK_TEXT_ICONS = { letter: 'rank-letter', review: 'rank-review' } as const;
const textConditionsFor = (v: number) => v === 8 && rankDefs.value.find(rank => rank.v === 8)?.reviewRequired === true
  ? [{ key: 'letter', icon: VRANK_TEXT_ICONS.letter as NxIconName, name: fmt(t.value.myRank.condLetter, { r: 'V8' }) }, { key: 'review', icon: VRANK_TEXT_ICONS.review as NxIconName, name: t.value.myRank.condReview }]
  : [];
const textConditions = computed(() => !visibility.hidden && prog.value.next ? textConditionsFor(prog.value.next.v) : []);
const atLeast = (level: number) => Object.entries(vState.vDownlineCounts).reduce((sum, [rank, count]) => Number(rank) >= level ? sum + count : sum, 0);
type DetailRow = { key: string; name: string; current: string | null; target: string; unit: string; state: 'met' | 'missing' | 'unknown' | 'hidden' };
const detail = computed(() => {
  const def = rankDefs.value.find(rank => rank.v === expandedRank.value);
  if (!def) return null;
  // Earlier tiers show their attained thresholds. The current tier can have gaps while being retained.
  const c = def.conditions, rows: DetailRow[] = [];
  const add = (key: string, name: string, current: number | undefined, required: number, people: boolean) => {
    if (!(required > 0)) return; // 门槛为 0 的条件不列（rank-rules）
    const actual = rankRequirementStatus(current, required);
    const state = visibility.hidden ? 'hidden' : def.v < myRank.value ? 'met' : actual;
    const compact = def.v <= myRank.value && state === 'met';
    rows.push({ key, name, current: compact ? null : visibility.mask(number(actual === 'unknown' ? undefined : current)), target: number(required), unit: people ? t.value.myRank.people : '', state });
  };
  add('self', t.value.myRank.self, vState.selfComputePoints, c.selfComputePoints ?? 0, false);
  add('team', t.value.myRank.team, vState.teamComputePoints, c.teamComputePoints ?? 0, false);
  add('buyers', t.value.myRank.buyers, vState.directRefs, c.directRefs ?? 0, true);
  for (const [level, required] of Object.entries(c.vDownlines ?? {})) add(`v${level}`, fmt(t.value.myRank.leaders, { r: `V${level}` }), atLeast(Number(level)), required ?? 0, true);
  const status = rowStatus(def.v);
  const tag = visibility.hidden ? '••••' : status === 'done' ? t.value.rank.done : status === 'current' ? t.value.myRank.isCurrent : t.value.myRank.notMet;
  const tone: 'neutral' | 'brand' | 'success' = visibility.hidden ? 'neutral' : status === 'done' ? 'success' : status === 'current' ? 'brand' : 'neutral';
  return {
    v: def.v, def, tag, tone, conditions: rows,
    prevNote: def.v >= 2 ? fmt(t.value.myRank.prevNote, { a: 'V1', r: `V${def.v - 1}` }) : '',
    text: textConditionsFor(def.v),
    benefits: benefitRows(def),
  };
});
const detailAnim = computed(() => !motion.still.value);

// ── V8 专享权益（五项固定文案和资源，2.3）──
const v8Perks = computed(() => {
  const copy = t.value.myRank;
  const rows: { key: RankPerk; title: string; desc: string }[] = [
    { key: 'promo', title: copy.perkPromoT, desc: copy.perkPromoD },
    { key: 'trip', title: copy.perkTripT, desc: copy.perkTripD },
    { key: 'support', title: copy.perkSupportT, desc: copy.perkSupportD },
    { key: 'transfer', title: copy.perkTransferT, desc: copy.perkTransferD },
    { key: 'market', title: copy.perkMarketT, desc: copy.perkMarketD },
  ];
  return rows;
});
// 「你现在的权益」（H0）：V8 的比例、晋级奖励、月薪；没有 salary 字段时三行（12.0）。
const currentBenefits = computed(() => {
  const current = rankDefs.value.find(rank => rank.v === myRank.value);
  return current ? benefitRows(current) : [];
});

// H7「联系客服」：打开顾问会话（同 agent-application 的去向）。
const conversations = useConversations();
async function contactSupport() {
  go(await advisorChatRoute(conversations));
}
useAutoRecovery({
  failed: () => needsSharedRates.value && commission.configStatus === 'error',
  retry: () => commission.ensureCanonicalConfig(),
});
useAutoRecovery({
  failed: () => remoteApiEnabled && salaryPhase.value === "idle" && (!!vState.remoteError || vState.salary === null),
  retry: () => vState.refreshCanonicalVRank(),
  repeatMs: 30_000,
});
</script>

<style scoped>
.rank-page { color:var(--v5-ink);padding-bottom:28px; }
/* 底部悬浮按钮（04.0）：内容底部留白为 48＋离底＋16，chassis 已给离底＋18。 */
.rank-page--dock { padding-bottom:46px; }
/* 页头 56 加内容上边距 4：焦点卡从 60 开始（DESIGN 7.5），抵掉页头自带的 12 下边距。 */
.rank-content { margin-top:-12px;padding:4px 16px 0; }
.rank-dock { position:fixed;z-index:35;display:flex;align-items:center; }
.rank-dock > .nx-button { flex:1; }
/* 托盘（D4、D4c）：左短状态 13/18（360 12/16）辅助色，浅色 ink-2 保证叠在内容上仍可读；右无底文字按钮，中性墨色、高 48。 */
.rank-dock__copy { flex:1;min-width:0;font:var(--ui-type-list-subtitle-weight,400) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5);color:var(--v5-ink-3);overflow-wrap:break-word; }
.rank-dock__copy:lang(zh) { word-break:keep-all; }
[data-theme="light"] .rank-dock__copy { color:var(--v5-ink-2); }
.rank-dock__text { display:flex;align-items:center;flex:none;height:48px;padding:0 12px;font:var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5);white-space:nowrap;cursor:pointer; }
.rank-dock__text text { white-space:nowrap; }
.rank-dock__text:active { opacity:.6; }
.rank-dock__text:focus-visible { outline:2px solid var(--v5-brand);outline-offset:-2px;border-radius:999px; }
/* 领取中按钮、确认中胶囊：灰色玻璃由共享层给（03 §3.1），这里只排加载指示和文字。 */
.rank-dock__status { display:flex;align-items:center;justify-content:center;gap:8px;flex:1;height:48px;border-radius:999px;color:var(--ui-tray-disabled-ink);font:var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5); }
.rank-dock__spin { flex:none;width:18px;height:18px;box-sizing:border-box;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:rank-dock-spin 800ms linear infinite; }
@keyframes rank-dock-spin { to { transform:rotate(360deg); } }
/* 减少动态、系统省电：加载指示静止（A10）。 */
.rank-dock__spin.is-still { animation:none; }
@media (prefers-reduced-motion: reduce) { .rank-dock__spin { animation:none; } }
/* 焦点卡（DESIGN 第 4 节、7.5）：.nx-tint 取等级色相（rankTierVars 的 --nx-tint），圆角 22、内边距 20；身份区竖排，徽章居中。 */
.rank-focus { position:relative;isolation:isolate;overflow:hidden;padding:20px;border-radius:var(--ui-radius-surface); }
.rank-identity { display:flex;flex-direction:column;align-items:center;text-align:center; }
.rank-plate { position:relative;isolation:isolate;display:grid;place-items:center;flex:none;margin-bottom:12px; }
/* 光晕：等级色相按 --halo 占比的径向渐变，直径为画布的 1.6 倍；纹样为画布的 1.7 倍。都以徽章为中心，静态，不用模糊滤镜。 */
.rank-plate::before { content:"";position:absolute;left:-30%;top:-30%;width:160%;height:160%;z-index:-1;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--tier-hue) var(--halo),transparent),transparent);pointer-events:none; }
.rank-plate__pattern { position:absolute;left:50%;top:50%;z-index:-1;width:170%;height:170%;transform:translate(-50%,-50%);pointer-events:none; }
.rank-plate__private { display:grid;place-items:center;width:100%;height:100%;border-radius:50%;background:var(--v5-surface-3);color:var(--v5-ink-2);font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.rank-identity__caption { font:var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);color:var(--v5-ink-3); }
.rank-identity__num { font:500 var(--ui-type-display-title)/var(--ui-type-display-title-lh) var(--font-metric);letter-spacing:-.02em;color:var(--tier-num-color);background-image:var(--tier-num-fill);-webkit-background-clip:text;background-clip:text; }
.rank-focus__conditions { margin-top:20px;padding-top:16px;border-top:1px solid color-mix(in srgb,var(--v5-ink) 8%,transparent); }
/* 「升到 Vn 后」、「加快晋级」：区块之间 32（小屏 24），区块标题行 44。 */
.rank-section { margin-top:var(--ui-space-section-gap); }
.rank-section__head { display:flex;align-items:center;gap:8px;min-height:44px;padding:0 2px; }
.rank-section__badge { flex:none; }
.rank-section__title { min-width:0;font:var(--ui-type-section-weight) var(--ui-type-section)/var(--ui-type-section-lh) var(--font-v5);letter-spacing:-.01em;overflow-wrap:break-word; }
.rank-section__title:lang(zh) { letter-spacing:0; }
/* 纯色卡（01 §1.1.2）：surface 实底，浅色加轻阴影。 */
.rank-card { padding:4px 16px;border-radius:var(--ui-radius-surface);background:var(--v5-surface);box-shadow:inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .rank-card { box-shadow:inset 0 0 0 1px var(--v5-border),var(--v5-glass-shadow); }
.rank-gain { display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;column-gap:12px;min-height:56px;padding:8px 0;box-sizing:border-box;border-bottom:1px solid color-mix(in srgb,var(--v5-ink) 6%,transparent); }
.rank-gain:last-child { border-bottom:0; }
.rank-gain__name { display:flex;align-items:center;gap:4px;min-width:0;font:400 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5);color:var(--v5-ink); }
.rank-gain__name > text { min-width:0;overflow-wrap:break-word; }
.rank-gain__name > text:lang(zh) { word-break:keep-all; }
.rank-gain__value { display:flex;align-items:baseline;font:var(--ui-type-card-figure-weight) var(--ui-type-card-figure)/var(--ui-type-card-figure-lh) var(--font-metric);color:var(--v5-ink);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums; }
.rank-gain__value text { white-space:pre; }
.rank-gain__old { font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-metric);color:var(--v5-ink-3); }
/* 旧值 → 新值的箭头用目标等级的点缀色（7.2）；隐藏统计时为禁用色。 */
.rank-gain__arrow { display:inline-flex;align-self:center;margin:0 3px;color:var(--tier-ink); }
.rank-gain__unit { font:500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);color:var(--v5-ink-3); }
.rank-gain__unit--uvt { color:var(--v5-nex-ink); }
.rank-speed { border-top:1px solid var(--v5-border); }
.rank-speed :deep(.nx-list-row) { padding-inline:0;border-bottom:1px solid var(--v5-border); }
.rank-scope-link { display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;margin-top:8px;color:var(--v5-brand);font:500 13px/1.5 var(--font-v5);cursor:pointer; }
.rank-scope-link > text { min-width:0;overflow-wrap:break-word; }
.rank-scope-link > svg, .rank-scope-link > .nx-native-svg { flex:none; }
.rank-scope-link:focus-visible { outline:2px solid var(--v5-brand);outline-offset:3px; }
/* 首次加载占位（V06）：焦点卡、月薪卡、横条按真实尺寸画静止灰条，不闪烁（07、design-rules）。 */
.rank-loading__focus { --nx-tint:var(--v5-ink);display:flex;flex-direction:column;align-items:center; }
.rank-loading__bar { height:12px;border-radius:999px;background:color-mix(in srgb,var(--v5-ink) 8%,transparent); }
.rank-loading__badge { width:128px;height:128px;margin:var(--v5-space-6) 0 var(--v5-space-3);border-radius:50%;background:color-mix(in srgb,var(--v5-ink) 8%,transparent); }
.rank-loading__bar--caption { width:56px;margin:2px 0; }
.rank-loading__bar--num { width:48px;height:24px;margin:5px 0; }
.rank-loading__conditions { width:100%;margin-top:var(--v5-space-5);padding-top:16px;border-top:1px solid color-mix(in srgb,var(--v5-ink) 8%,transparent); }
.rank-loading__head { display:flex;align-items:center;justify-content:space-between;min-height:24px;margin-bottom:var(--v5-space-1); }
.rank-loading__bar--title { width:88px; }
.rank-loading__bar--tag { width:56px;height:24px; }
.rank-loading__row { display:flex;align-items:center;gap:10px;min-height:40px;border-bottom:1px solid color-mix(in srgb,var(--v5-ink) 6%,transparent); }
.rank-loading__row:last-child { border-bottom:0; }
.rank-loading__ring { flex:none;width:28px;height:28px;border-radius:50%;background:color-mix(in srgb,var(--v5-ink) 8%,transparent); }
.rank-loading__bar--name { width:96px; }
.rank-loading__row .rank-loading__bar--value { width:72px;margin-left:auto; }
.rank-salary-ph { margin-top:var(--ui-space-card-gap);display:flex;flex-direction:column;align-items:center;gap:var(--v5-space-2);padding:var(--ui-space-inset);border-radius:var(--ui-radius-surface);background:var(--v5-surface);box-shadow:inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .rank-salary-ph { box-shadow:inset 0 0 0 1px var(--v5-border),var(--v5-glass-shadow); }
.rank-salary-ph__head { display:flex;align-items:center;gap:var(--v5-space-3);align-self:stretch;min-height:32px; }
.rank-salary-ph__head .rank-loading__bar--title { flex:0 1 88px; }
.rank-salary-ph__head .rank-loading__bar--tag { margin-left:auto; }
.rank-loading__icon { flex:none;width:32px;height:32px;border-radius:10px;background:color-mix(in srgb,var(--v5-ink) 8%,transparent); }
.rank-loading__bar--amount { width:132px;height:32px;border-radius:12px; }
.rank-loading__bar--note { width:120px;margin-top:var(--v5-space-2); }
.rank-loading__rail { display:flex;gap:6px;margin-top:var(--ui-space-section-gap);padding:var(--v5-space-1) 0; }
.rank-loading__item { display:flex;flex-direction:column;align-items:center;gap:var(--v5-space-1);flex:none;width:64px;padding:6px 0; }
.rank-loading__emblem { width:40px;height:40px;border-radius:12px;background:color-mix(in srgb,var(--v5-ink) 8%,transparent); }
.rank-loading__item .rank-loading__bar--name { width:28px;height:10px; }
/* V7 页头底色（8.1 第 2 条）：页头在星河上透明；舞台底部滚到页头下面后，页头下面一层无模糊的页面底色淡入 200ms linear。 */
/* 高度为 0 的粘性层，底色画在伪元素上：不占流，也不与舞台的负外边距折叠。 */
.rank-headbg { position:sticky;top:0;z-index:49;height:0;margin:0 -16px;pointer-events:none; }
.rank-headbg::before { content:"";position:absolute;left:0;right:0;top:0;height:56px;background:var(--v5-bg);opacity:0;transition:opacity 200ms linear; }
.rank-headbg.is-solid::before { opacity:1; }
.rank-headbg.is-still::before { transition:none; }
.rank-headbg__sentinel { position:absolute;left:0;bottom:84px;width:1px;height:1px;pointer-events:none; }
/* V7 纯色条件卡（.hero--cond）：舞台是本屏区焦点，条件区改为纯色卡。 */
.rank-cond-card { padding:16px 20px; }
.rank-cond-card__footer { margin-top:12px;padding-top:0;min-height:44px;justify-content:flex-end; }
/* 「另需」文字条件（2.3）：12/16 ink-3 小标题；行＝28px 中性圆＋16px 图形｜名称，右侧空。 */
.rank-also { display:block;margin-top:10px;font:var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);color:var(--v5-ink-3); }
.rank-also__row { display:grid;grid-template-columns:28px minmax(0,1fr);align-items:center;column-gap:10px;min-height:40px;padding:6px 0;box-sizing:border-box;border-bottom:1px solid color-mix(in srgb,var(--v5-ink) 6%,transparent); }
.rank-also__row--last { border-bottom:0; }
.rank-also__lead { display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:color-mix(in srgb,var(--v5-ink) 6%,transparent);color:var(--v5-ink-3); }
.rank-also__lead--s { flex:none;width:24px;height:24px; }
.rank-also__name { min-width:0;font:var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5);color:var(--v5-ink);overflow-wrap:break-word; }
/* 全部等级横条（第 4 节阶梯项）：项宽 64（&lt;375 为 58）、间距 6；徽章 40、「V3」12/16 Mono 500（V8 金色）、状态 12/16 500。 */
.rank-ladder-section { margin-top:var(--ui-space-section-gap); }
.rank-rail { margin:0 -16px;width:auto;white-space:nowrap; }
/* 选中项平滑滚到居中用滚动容器自带的平滑滚动：不给滚动内容加 transform 过渡，点选那组动画少一个元素（10.4 P6）。 */
.rank-rail--smooth :deep(.uni-scroll-view) { scroll-behavior:smooth; }
.rank-rail__track { position:relative;display:inline-flex;gap:6px;padding:4px 16px 2px; }
.rank-rail__ind { position:absolute;left:0;top:4px;border-radius:16px;background:color-mix(in srgb,var(--v5-ink) 7%,transparent);box-shadow:var(--ui-glass-edge-shadow);opacity:0;transition:transform 240ms cubic-bezier(.32,.72,0,1);pointer-events:none; }
.rank-rail__ind.is-on { opacity:1; }
.rank-rail__ind.is-still { transition:none; }
.rank-rail__item { position:relative;z-index:0;display:flex;flex-direction:column;align-items:center;gap:4px;flex:none;min-width:64px;box-sizing:border-box;padding:6px;border-radius:16px;cursor:pointer; }
.rank-rail__item + .rank-rail__item::before { content:"";position:absolute;left:-6px;top:26px;width:6px;height:2px;background:var(--v5-surface-3); }
.rank-rail__item--done + .rank-rail__item::before, .rank-rail__item--current::before { background:var(--v5-brand) !important; }
.rank-rail__item:focus-visible { outline:2px solid var(--v5-brand);outline-offset:-2px; }
.rank-rail__badge { position:relative;width:40px;height:40px; }
.rank-rail__item--locked .rank-rail__emb { opacity:.55; }
/* 弹起、选中放大都在徽章容器上：光圈、星点、掠光和徽章一起，掠光里的副本不用再单独动画。 */
.rank-rail__item[aria-selected="true"] .rank-rail__badge { transform:translateY(-2px) scale(1.06); }
.rank-rail__v { font:500 12px/16px var(--font-metric);color:var(--v5-ink); }
.rank-rail__v--v8 { color:#E2BC62; }
[data-theme="light"] .rank-rail__v--v8 { color:#765816; }
.rank-rail__s { min-height:16px;font:500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);color:var(--v5-ink-3);white-space:nowrap; }
.rank-rail__item--current .rank-rail__s { color:var(--v5-brand); }
.rank-rail__item--next .rank-rail__s { color:var(--v5-ink-2); }
/* 点选一次性动画（10.3，整组 ≤320ms，只动 transform／opacity）：徽章按等级强度弹起；V3 起一道点缀色光圈；V7、V8 加星点层。 */
.rank-rail__item.is-pop .rank-rail__badge { animation:rank-pop-0 240ms cubic-bezier(.2,1.4,.4,1); }
.rank-rail__item[data-t="1"].is-pop .rank-rail__badge { animation:rank-pop-1 280ms cubic-bezier(.2,1.4,.4,1); }
.rank-rail__item[data-t="2"].is-pop .rank-rail__badge { animation:rank-pop-2 300ms cubic-bezier(.2,1.4,.4,1); }
.rank-rail__item[data-t="3"].is-pop .rank-rail__badge { animation:rank-pop-3 320ms cubic-bezier(.2,1.4,.4,1); }
@keyframes rank-pop-0 { 0% { transform:none; } 50% { transform:translateY(-2px) scale(1.08); } 100% { transform:translateY(-2px) scale(1.06); } }
@keyframes rank-pop-1 { 0% { transform:none; } 50% { transform:translateY(-3px) scale(1.12); } 100% { transform:translateY(-2px) scale(1.06); } }
@keyframes rank-pop-2 { 0% { transform:none; } 50% { transform:translateY(-3px) scale(1.14); } 100% { transform:translateY(-2px) scale(1.06); } }
@keyframes rank-pop-3 { 0% { transform:none; } 50% { transform:translateY(-3px) scale(1.16); } 100% { transform:translateY(-2px) scale(1.06); } }
.rank-rail__ring { position:absolute;inset:0;border-radius:50%;border:2px solid var(--rail-accent);opacity:0;pointer-events:none;animation:rank-ring 300ms cubic-bezier(.2,.8,.2,1); }
@keyframes rank-ring { 0% { opacity:.75;transform:scale(.7); } 100% { opacity:0;transform:scale(1.55); } }
.rank-rail__burst { position:absolute;left:-20px;top:-20px;width:80px;height:80px;opacity:0;pointer-events:none;animation:rank-burst 320ms cubic-bezier(.2,.8,.2,1); }
@keyframes rank-burst { 0% { opacity:0;transform:scale(.5); } 40% { opacity:1; } 100% { opacity:0;transform:scale(1.15); } }
.rank-ladder-hint { display:block;margin-top:8px;font:400 var(--ui-type-meta)/18px var(--font-v5);color:var(--v5-ink-3); }
/* 等级详情卡（第 4 节）：纯色卡；标题行徽章 40＋等级名（卡片标题）＋状态标签；条件行名称 13/20 ink-3、值主文字、达成勾在行尾；权益行高 48。 */
.rank-detail { margin-top:12px;padding:16px;border-radius:var(--ui-radius-surface);background:var(--v5-surface);box-shadow:inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .rank-detail { box-shadow:inset 0 0 0 1px var(--v5-border),var(--v5-glass-shadow); }
/* 切换时由 FLIP 管下方内容，不让浏览器的滚动锚定再挪整页。 */
.rank-detail-host { position:relative;overflow-anchor:none; }
.rank-ladder-below { overflow-anchor:none; }
.rank-detail-enter-from { opacity:0;transform:translateY(8px); }
.rank-detail-enter-active { transition:opacity 200ms cubic-bezier(.2,.8,.2,1) 80ms,transform 200ms cubic-bezier(.2,.8,.2,1) 80ms; }
.rank-detail-leave-active { position:absolute;left:0;right:0;top:0;transition:opacity 120ms linear,transform 120ms cubic-bezier(.2,.8,.2,1);pointer-events:none; }
.rank-detail-leave-to { opacity:0;transform:translateY(-6px); }
.rank-fade-enter-from { opacity:0;transform:translateY(8px); }
.rank-fade-enter-active { transition:opacity 200ms cubic-bezier(.2,.8,.2,1) 80ms,transform 200ms cubic-bezier(.2,.8,.2,1) 80ms; }
.rank-rail__glint { position:absolute;inset:0;border-radius:50%;overflow:hidden;pointer-events:none; }
.rank-rail__glint-band { position:absolute;top:0;bottom:0;left:0;width:12px;overflow:hidden;transform:translateX(-14px);animation:rank-glint-band 320ms cubic-bezier(.2,.8,.2,1) both; }
.rank-rail__glint-copy { position:absolute;top:0;left:0;width:40px;height:40px;transform:translateX(14px);animation:rank-glint-copy 320ms cubic-bezier(.2,.8,.2,1) both; }
/* 副本上的 brightness 是静态的，只有光带和副本平移（10.4 P2）；弹起做在外层徽章容器上，副本跟着一起动，和原图对齐。 */
.rank-rail__glint-copy .rank-rail__emb { filter:brightness(1.7) saturate(.8); }
@keyframes rank-glint-band { from { transform:translateX(-14px); } to { transform:translateX(42px); } }
@keyframes rank-glint-copy { from { transform:translateX(14px); } to { transform:translateX(-42px); } }
.rank-detail__head { display:flex;align-items:center;flex-wrap:wrap;gap:4px 12px; }
.rank-detail__name { font:var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-metric);color:var(--v5-ink); }
.rank-detail__name--v8 { color:#E2BC62; }
[data-theme="light"] .rank-detail__name--v8 { color:#765816; }
.rank-detail__tag { margin-left:auto; }
.rank-detail__label { display:flex;align-items:center;gap:2px;margin:16px 0 4px;font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);color:var(--v5-ink-3); }
.rank-detail__kv { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px 12px;min-height:40px;padding:8px 0;box-sizing:border-box;border-bottom:1px solid color-mix(in srgb,var(--v5-ink) 8%,transparent); }
.rank-detail__kv--text { justify-content:flex-start;gap:10px; }
.rank-detail__k { min-width:0;font:var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5);color:var(--v5-ink-3);overflow-wrap:break-word; }
.rank-detail__v { display:inline-flex;align-items:center;margin-left:auto;font:var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5);color:var(--v5-ink);white-space:nowrap;font-variant-numeric:tabular-nums; }
.rank-detail__v text { white-space:pre; }
.rank-detail__cur { font-family:var(--font-metric);font-weight:500;color:var(--v5-ink); }
.rank-detail__tgt { font-family:var(--font-metric); }
.rank-detail__tgt--only { font-weight:500;color:var(--v5-ink); }
.rank-detail__st { display:grid;place-items:center;width:16px;height:16px;margin-left:6px;color:var(--v5-success-ink); }
.rank-detail__st--missing, .rank-detail__st--unknown { box-sizing:border-box;width:14px;height:14px;margin:1px 1px 1px 7px;border-radius:50%;border:1.5px solid var(--v5-ink-4); }
.rank-gain--detail { min-height:48px; }
.rank-gain--detail .rank-gain__name { font:var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5);color:var(--v5-ink-3); }
@media (max-width:374px) { .rank-rail__item { min-width:58px; } }
@media (prefers-reduced-motion:reduce) { .rank-rail__ind { transition:none; } .rank-rail__item.is-pop .rank-rail__badge { animation:none; } .rank-rail__glint { display:none; } }
</style>
