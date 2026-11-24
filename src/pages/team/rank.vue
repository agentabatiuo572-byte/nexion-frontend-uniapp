<template>
  <AppChassis active="team">
    <view class="rank-page" :class="{ 'rank-page--dock': hasDock }">
      <SubPageHeader back="/pages/team/team" :title="t.rank.pageTitle" plain design :action-label="copy.rankRules" :action="() => go('/pages/team/rank-how')" />
      <view class="rank-content">
        <template v-if="rankAvailable">
          <!-- 焦点卡（DESIGN 7.5）。V7/V8 项：myRank 为 7 时换成卡外星河舞台＋纯色条件卡，为 8 时换成黑金会员卡；条件区复用 RankConditions。在那之前 V7、V8 也按这张卡显示，信息不丢。 -->
          <view class="rank-focus nx-tint" :class="`rank-focus--${tierSegment}`" :style="focusVars">
            <view class="rank-identity" :style="{ paddingTop: identityTop + 'px' }">
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
            <RankConditions v-if="prog.next" :key="String(auth.accountId)" class="rank-focus__conditions" :heading="fmt(t.myRank.needFor, { r: nextName })" :tag="gapTag" :tag-tone="reviewPending ? 'warning' : 'neutral'" :hint="countsHint" :rows="nextConditions" :prior="priorConditions" :prior-title="fmt(t.myRank.foldTitle, { n: visibility.mask(priorMissing) })" :hidden="visibility.hidden" :sweep="!motion.still.value" />
          </view>
          <!-- 月薪卡（DESIGN 第 6 节，画板 C、D）：salary 字段存在且 months 不为空时显示；salary 为 null（读取失败）时金额「—」（D9）；没有 salary 字段时按 CA 构图。 -->
          <RankSalaryCard v-if="salary.card" :title="t.myRank.salaryTitle" :view="salary.card" :resend-note="t.myRank.resendNote" :swap="salarySwap" />
          <view v-if="gains.length" class="rank-section">
            <view class="rank-section__head">
              <TeamRankEmblem v-if="!visibility.hidden" class="rank-section__badge" :rank="prog.next!.v" :size="28" />
              <text class="rank-section__title" role="heading" aria-level="2">{{ fmt(t.myRank.newAt, { r: nextName }) }}</text>
            </view>
            <view class="rank-card rank-gains" :style="{ '--tier-ink': gainArrowInk }">
              <view v-for="gain in gains" :key="gain.key" class="rank-gain">
                <NxIconTile :tone="gain.tone" size="s"><NxIcon :name="gain.icon" :size="20" /></NxIconTile>
                <view class="rank-gain__name"><text>{{ gain.name }}</text><NxHintTip v-if="gain.hint" :lines="gain.hint" /></view>
                <view class="rank-gain__value">
                  <template v-if="gain.old"><text class="rank-gain__old">{{ gain.old }}</text><view class="rank-gain__arrow"><NxIcon name="arrow-right" :size="12" /></view></template>
                  <text>{{ gain.value }}</text><text v-if="gain.unit" class="rank-gain__unit" :class="{ 'rank-gain__unit--uvt': gain.unit === 'UVT' }">&#160;{{ gain.unit }}</text>
                </view>
              </view>
            </view>
          </view>
          <view v-if="speedUpRows.length" class="rank-section">
            <NxSection :title="t.myRank.speedUp" />
            <view class="rank-speed">
              <NxListRow v-for="row in speedUpRows" :key="row.key" :title="row.title" :subtitle="row.subtitle" @click="go(row.href)"><template #leading><NxIconTile :tone="row.tone" size="s"><NxIcon :name="row.icon" :size="20" /></NxIconTile></template></NxListRow>
            </view>
          </view>
        <view class="rank-ladder-section">
          <NxSection :title="copy.allRanks" :meta="rankDefs.length ? `V${rankDefs[0].v}–V${rankDefs[rankDefs.length-1].v} · ${copy.expandRank}` : ''" />
          <view class="rank-ladder">
            <view v-for="r in rankDefs" :key="r.v" class="rank-ladder-row" :data-status="rowStatus(r.v)">
              <view class="rank-row-heading" role="button" tabindex="0" :aria-label="rankLabel(r.v,locale.code,rankDefs)" :aria-expanded="expandedRank === r.v" :aria-controls="`rank-details-${r.v}`" @click="toggleRank(r.v)" @keydown.enter.prevent="toggleRank(r.v)" @keydown.space.prevent="toggleRank(r.v)">
                <TeamRankEmblem :rank="r.v" :size="40" /><text class="rank-row-title">V{{ r.v }}</text><text class="rank-row-sub" :class="{'rank-row-sub--active':rowStatus(r.v)!=='locked'}">{{ rowStatus(r.v)==='done' ? t.rank.done : rowStatus(r.v)==='current' ? t.rank.currentRank : prog.next?.v === r.v ? nextRankLabel : '' }}</text>
              </view>
            </view>
          </view>
          <template v-for="r in rankDefs" :key="`details-${r.v}`">
              <view v-if="expandedRank === r.v" :id="`rank-details-${r.v}`" class="rank-details">
                <text class="rank-detail-label">{{ t.rank.conditionsLabel }}</text><view v-for="condition in conditionItems(r)" :key="condition" class="rank-condition-copy"><view class="rank-condition-dot" aria-hidden="true" /><text>{{ condition }}</text></view><text v-if="r.v>1" class="rank-detail-hint">{{ t.rank.previousConditions }}</text>
                <text class="rank-detail-label rank-detail-label--spaced">{{ t.rank.benefitsLabel }}</text><view class="rank-perk-grid"><view v-for="perk in benefitItems(r)" :key="perk.label" class="rank-perk"><text class="rank-caption">{{ perk.label }}</text><text class="rank-perk-value">{{ perk.value }}</text></view></view><view v-if="r.unilevelDepth > 0" class="rank-scope-link" role="link" tabindex="0" @click="go('/pages/team/rank-how')" @keydown.enter.prevent="go('/pages/team/rank-how')"><text>{{ guideCopy.rewardScope }}</text><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></view>
                <text class="rank-detail-label rank-detail-label--spaced">{{ t.rank.rewardsLabel }}</text><view v-for="(reward,rewardIndex) in r.rewards" :key="rewardIndex" class="rank-reward-item nx-tint"><template v-if="cultivationReward(reward)"><view class="rank-reward-summary"><text class="rank-reward-title">{{ cultivationCopy.title }}</text><text class="rank-reward-amount">{{ rewardText(reward) }}</text></view><text class="rank-reward-description">{{ fmt(cultivationCopy.trigger, { n: r.v, amount: rewardText(reward) }) }}</text><text class="rank-reward-note">{{ cultivationCopy.recipient }}</text></template><text v-else class="rank-reward">{{ rewardText(reward) }}</text></view><text v-if="!r.rewards.length" class="rank-reward-note">{{ t.rank.noRewards }}</text>
              </view>
          </template>
        </view>
        </template>
        <EmptyState v-else-if="vState.remoteError" kind="recoverable-error" page :title="t.rank.loadError" :cta-label="t.ui.reload" @cta="retryRank" />
        <view v-else class="rank-state" role="status" aria-live="polite" aria-busy="true"><text>{{ t.rank.loading }}</text></view>
      </view>
    </view>
    <!-- 底部操作栏（DESIGN 2.1）的非领取状态：补差距最有效的一步。领取月薪的按钮、托盘和确认框由月薪项接在 dockAction 的 claim 分支。 -->
    <template #pageFixed>
      <!-- 领取（2.1）：悬浮按钮「领取 N USDT」；晋升当天为托盘；领取中为灰色禁用按钮；结果确认中为状态胶囊。 -->
      <view v-if="salaryDock?.kind === 'claim'" class="rank-dock nx-glass-bar"><NxButton variant="primary" @click="claimSalary">{{ salaryDock.label }}</NxButton></view>
      <view v-else-if="salaryDock?.kind === 'tray'" class="rank-dock nx-glass-bar"><text class="nx-tray-copy rank-dock__copy">{{ salaryDock.copy }}</text><view class="nx-tray-text rank-dock__text" role="button" tabindex="0" @click="salaryDialog = 'promo'" @keydown.enter.prevent="salaryDialog = 'promo'" @keydown.space.prevent="salaryDialog = 'promo'"><text>{{ salaryDock.button }}</text></view></view>
      <view v-else-if="salaryDock?.kind === 'resend'" class="rank-dock nx-glass-bar"><NxButton variant="primary" @click="resendSalaryClaim">{{ salaryDock.label }}</NxButton></view>
      <view v-else-if="salaryDock?.kind === 'busy'" class="rank-dock nx-glass-bar"><NxButton variant="primary" disabled><view class="rank-dock__spin" aria-hidden="true" /><text>{{ salaryDock.label }}</text></NxButton></view>
      <view v-else-if="salaryDock?.kind === 'status'" class="rank-dock nx-glass-bar"><view class="nx-tray-status rank-dock__status" role="status"><view class="rank-dock__spin" aria-hidden="true" /><text>{{ salaryDock.label }}</text></view></view>
      <view v-else-if="!salaryDock && dockAction" class="rank-dock nx-glass-bar"><NxButton variant="primary" @click="go(dockAction.href)">{{ dockAction.label }}</NxButton></view>
      <!-- 确认框（03 §3.5 决定级）：D4b／D4d 晋升当天，D10 金额已变化；返回、Esc、点蒙层等同文字按钮。 -->
      <NxNoticeDialog :open="!!salaryDialogView" :title="salaryDialogView?.title ?? ''" :body="salaryDialogView?.body" :primary="salaryDialogView?.primary ?? ''" :secondary="salaryDialogView?.secondary" mask-secondary focus-title @primary="confirmSalaryDialog" @secondary="salaryDialog = null" />
    </template>
  </AppChassis>
</template>

<script setup lang="ts">
import NxIcon, { type NxIconName } from "@/components/ui/nx-icon.vue";
import NxIconTile from "@/components/ui/nx-icon-tile.vue";
import NxHintTip from "@/components/ui/nx-hint-tip.vue";
import RankConditions, { type RankConditionRow } from "@/components/team/rank-conditions.vue";
import RankSalaryCard from "@/components/team/rank-salary-card.vue";
import NxNoticeDialog from "@/components/ui/nx-notice-dialog.vue";
import { lastClaimDay, salaryDates, salaryView, type RankSalary, type SalaryClaimPhase } from "@/lib/rank-salary-view";
import { toast } from "@/store/ui";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { useRankFxMotion } from "@/composables/use-rank-fx-guard";
import { teamRankProgress } from "@/lib/team-rank-progress";
import { formatAmount } from "@/lib/amount-display";
import { navTo } from "@/lib/route";
import { platformDisplayText } from "@/lib/brand-copy";
import { isEntitlementVRankReward, rankEntitlementLabel } from "@/lib/rank-entitlement-label";
import { RANK_ASSETS, rankAsset, rankTierStyle, rankTierVars } from "@/lib/rank-tier-style";
import { computed, onMounted, reactive, ref, watch } from "vue";
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
import { useVRank, type VRank, type VRankDef, type VRankReward, type VRankConditions } from "@/store/v-rank";
import { rankConditionsText, rankCultivationCopy, rankLabel } from "@/lib/v-rank-copy";
import { formatHowNumber } from "@/lib/rank-how-content";
import { useLocaleStore } from "@/store/locale";
import { useAuth } from "@/store/auth";
import { useTheme } from "@/store/theme";
import { useDataVisibility } from "@/store/data-visibility";
import { remoteApiEnabled } from "@/api/runtime";
import { onShow } from "@dcloudio/uni-app";
import { uiLocale } from '@/i18n';

const t = useT();
const copy = useAuditUiCopy();
const locale = useLocaleStore();
const guideCopy = computed(() => rankGuideCopy(locale.code));
const cultivationCopy = computed(() => rankCultivationCopy(locale.code));
const vState = useVRank();
const auth = useAuth();
const theme = useTheme();
const visibility = useDataVisibility();
const motion = useRankFxMotion();

const myRank = computed(() => vState.myRank);
const rankDefs = computed(() => vState.ladder);
const rankAvailable = computed(() => !remoteApiEnabled || vState.remoteReady);

// ── 逻辑项接入点（DESIGN 第 5、6、12.0 节）──────────────────────────────────────────────
// 接口读取（src/api/v-rank-api.ts rankRow、rank state → src/store/v-rank.ts）还没带下面这些字段，界面先按「没有」显示，
// 逻辑项把字段接进 VRankDef／store 后替换这里即可，各区块只看自己依赖的那一项：
// - purchaseL2Rate：「升到 Vn 后」的「好友的好友购买奖励」行（旧 → 新，不同才列）。
// - monthlySalaryUsdt：「每月月薪」行；只在 salaryPresent 时列（当前为 0 时只写新值）。
// - v8ReviewRequired：/api/config/v-ranks 的 V8 带 reviewRequired；V7 数值条件（含前序）全满足时焦点卡标签换成「审核中」。
const rankPending = {
  purchaseL2Rate: (_rank: VRankDef): number | undefined => undefined,
  monthlySalaryUsdt: (_rank: VRankDef): number | undefined => undefined,
  v8ReviewRequired: false,
};

// The API supplies exact L1 rank buckets; the engine counts members at or above
// each required rank. This projection is only for the observed progress display.
const previewData = computed(() => ({
  myRank: vState.myRank,
  selfComputePoints: vState.selfComputePoints,
  directRefs: vState.directRefs,
  teamComputePoints: vState.teamComputePoints,
  vDownlineCounts: vState.vDownlineCounts,
}));
const prog = computed(() => teamRankProgress(previewData.value, rankDefs.value));
const nextRankLabel = computed(() => ({ zh: "下一级", en: "Next", vi: "Hạng kế", id: "Berikutnya", ms: "Seterusnya", fil: "Susunod", ru: "Далее", kk: "Келесі", uz: "Keyingi" })[uiLocale(locale.code)]);
function toggleRank(v: VRank) { expandedRank.value = expandedRank.value === v ? null : v; }
const expandedRank = ref<VRank | null>(null);
let expandedAccount = auth.accountId;
let expansionInitialized = false;
watch(() => [auth.accountId, rankAvailable.value, myRank.value, rankDefs.value.map(rank => rank.v).join(',')] as const, ([account, ready]) => {
  if (account !== expandedAccount) {
    expandedAccount = account;
    expansionInitialized = false;
    expandedRank.value = null;
  }
  // onShow can hide or clear facts while rereading. Only a complete ladder can
  // invalidate the chosen tier; null after initialization is an intentional fold.
  if (!ready) return;
  if (!expansionInitialized || (expandedRank.value !== null && !rankDefs.value.some(rank => rank.v === expandedRank.value))) {
    const preferred = prog.value.next?.v ?? myRank.value;
    expandedRank.value = rankDefs.value.some(rank => rank.v === preferred) ? preferred : null;
    expansionInitialized = true;
  }
}, { immediate: true });

// ── 焦点卡身份区（DESIGN 7.2、7.5；隐藏统计时中性取值、徽章换成 •••• 圆）──
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
// 「还差 N 项」：下一级未满足的条件数＋前序未满足的条件数，三处共用一个口径（2.2）。统一计数函数由逻辑项接（src/lib/team-rank-progress.ts），这里先用现有的 missing。
const priorMissing = computed(() => prog.value.missing.filter(row => row.tier !== prog.value.next?.v).length);
const reviewPending = computed(() => rankPending.v8ReviewRequired && myRank.value === 7 && prog.value.next?.v === 8
  && prog.value.missing.length === 0 && prog.value.unknown.length === 0);
const gapTag = computed(() => {
  if (reviewPending.value) return t.value.myRank.reviewTag;
  if (prog.value.unknown.length || !prog.value.missing.length) return '';
  return fmt(t.value.myRank.leftTag, { n: visibility.mask(prog.value.missing.length) });
});
const countsHint = computed(() => prog.value.rows.some(row => row.tier === prog.value.next?.v && (row.kind === 'directRefs' || row.kind === 'vDownlines'))
  ? [t.value.myRank.countsNote] : []);

// ── 「升到 Vn 后」：只列升级后会变的项（DESIGN 第 5 节；7.2 箭头用目标等级点缀色）──
const percentText = (rate: number) => `${formatHowNumber(Math.round(rate * 10000) / 100, locale.code)}%`;
const uvtReward = (rank: VRankDef) => rank.rewards.reduce((sum, reward) => !isEntitlementVRankReward(reward) && reward.type === 'UVT' && Number.isFinite(reward.amount) ? sum + reward.amount : sum, 0);
type Gain = { key: string; icon: NxIconName; tone: 'sky' | 'purple' | 'amber'; name: string; old?: string; value: string; unit?: string; hint?: string[] };
const gains = computed<Gain[]>(() => {
  const next = prog.value.next;
  const current = rankDefs.value.find(rank => rank.v === myRank.value);
  if (!next || !current) return [];
  const rows: Gain[] = [];
  if (current.directBonus !== next.directBonus) rows.push({ key: 'l1', icon: 'rank-rate-l1', tone: 'sky', name: t.value.myRank.gainF1, old: percentText(current.directBonus), value: percentText(next.directBonus) });
  const l2From = rankPending.purchaseL2Rate(current), l2To = rankPending.purchaseL2Rate(next);
  if (l2To !== undefined && l2To !== l2From) rows.push({ key: 'l2', icon: 'rank-rate-l2', tone: 'sky', name: t.value.myRank.gainF2, old: l2From === undefined ? undefined : percentText(l2From), value: percentText(l2To) });
  const uvt = uvtReward(next);
  if (uvt > 0) rows.push({ key: 'uvt', icon: 'rank-uvt', tone: 'purple', name: t.value.myRank.rankUpTo, value: `+${formatHowNumber(uvt, locale.code)}`, unit: 'UVT', hint: [fmt(t.value.myRank.rewardNote, { r: nextName.value })] });
  const salaryFrom = rankPending.monthlySalaryUsdt(current) ?? 0, salaryTo = rankPending.monthlySalaryUsdt(next) ?? 0;
  if (salaryPending.salary !== undefined && salaryTo > 0 && salaryTo !== salaryFrom) rows.push({ key: 'salary', icon: 'rank-salary', tone: 'amber', name: t.value.myRank.monthly, old: salaryFrom > 0 ? formatHowNumber(salaryFrom, locale.code) : undefined, value: formatHowNumber(salaryTo, locale.code), unit: 'USDT' });
  return rows;
});
const gainArrowInk = computed(() => prog.value.next ? rankTierVars(prog.value.next.v, theme.resolved, visibility.hidden)['--tier-ink'] : '');

// ── 月薪卡与领取（DESIGN 2.1、第 6 节，画板 C、D 组）· 逻辑项接入点 ──────────────────────────────
// salary：/api/team/rank 的 salary（6.1）。undefined＝响应里没有这个字段（CA：不显示月薪卡和月薪行）；
//   null＝读取失败（salary null＋salaryUnavailable，D9：金额「—」，按 useAutoRecovery 自动重读，不提示）。
// phase：领取过程（idle／claiming D5／confirming D6／resend D6 NOT_FOUND）。
// submit(month, amountUsdt)：点「领取」或确认框主按钮后发 POST /api/team/rank/salary/claim（新幂等键，6.3）；
// resend()：回执 NOT_FOUND 后用户点底部「重新提交领取」，同一幂等键、同一月份、原金额重发（6.4，用户发起）。
// 请求或回执有结果后调 showSalaryResult（下方），由它切换卡片、底部、确认框和 toast；成功、已领、不可领后逻辑项重读 /api/team/rank。
// 离开页面再回来、本地还留着未结的键时，逻辑项先把 phase 设为 confirming 再查回执。
const salaryPending = reactive<{ salary: RankSalary | null | undefined; phase: SalaryClaimPhase; submit: (month: string, amountUsdt: string) => void; resend: () => void }>({
  salary: undefined,
  phase: "idle",
  submit: () => {},
  resend: () => {},
});
const salaryCopy = computed(() => t.value.myRank as unknown as Record<string, string>);
const salary = computed(() => salaryPending.salary === undefined
  ? { card: null, dock: null, promo: null }
  : salaryView({ salary: salaryPending.salary, phase: salaryPending.phase, hidden: visibility.hidden, locale: locale.code, copy: salaryCopy.value, mask: visibility.mask }));
const salaryDock = computed(() => salary.value.dock);
const hasDock = computed(() => !!salaryDock.value || !!dockAction.value);
// 卡片主体只在领取过程里交叉淡入（10.1 领取），首屏随页面入场。
const salarySwap = ref(false);
// 确认框：promo＝晋升当天（D4b，月末 D4d）；amount＝金额已变化（D10）。
const salaryDialog = ref<"promo" | "amount" | null>(null);
const amountChange = ref<{ month: string; amountUsdt: string; rankCode: string } | null>(null);
const salaryDialogView = computed(() => {
  const copy = t.value.myRank, d = salaryDates(locale.code), usdt = (value: string) => `${formatHowNumber(value, locale.code)}\u00A0USDT`;
  const promo = salary.value.promo;
  if (salaryDialog.value === "promo" && promo) return {
    title: d.sentence(fmt(copy.dlgTitle, { b: promo.now })),
    body: d.sentence(promo.end ? fmt(copy.dlgEndBody, { d: promo.date, a: promo.next, m: promo.month }) : fmt(copy.dlgBody, { a: promo.next })),
    primary: fmt(copy.dlgPrimary, { b: promo.now }),
    secondary: promo.end ? d.sentence(fmt(copy.dlgWaitDate, { d: promo.date })) : copy.dlgSecondary,
  };
  const change = amountChange.value;
  if (salaryDialog.value === "amount" && change) return {
    title: fmt(copy.amtTitle, { a: usdt(change.amountUsdt) }),
    body: fmt(copy.amtBody, { r: change.rankCode }),
    primary: fmt(copy.claimBtn, { a: usdt(change.amountUsdt) }),
    secondary: copy.amtCancel,
  };
  return null;
});
function submitSalary(month: string, amountUsdt: string) {
  salarySwap.value = true;
  salaryPending.phase = "claiming";
  salaryPending.submit(month, amountUsdt);
}
function claimSalary() {
  const dock = salaryDock.value;
  if (dock?.kind === "claim") submitSalary(dock.month, dock.amountUsdt);
}
function confirmSalaryDialog() {
  const which = salaryDialog.value, item = salaryPending.salary?.months[0], change = amountChange.value;
  salaryDialog.value = null;
  if (which === "promo" && item) submitSalary(item.month, item.amountUsdt);
  if (which === "amount" && change) submitSalary(change.month, change.amountUsdt);
}
function resendSalaryClaim() {
  salarySwap.value = true;
  salaryPending.phase = "claiming";
  salaryPending.resend();
}
/** 领取结果（6.3、6.4）→ 界面。逻辑项在 POST 或回执有结果时调用。 */
type SalaryResult =
  | { kind: "ok"; amountUsdt: string } // 200／回执 SUCCEEDED：D7
  | { kind: "amountChanged"; month: string; amountUsdt: string; rankCode: string } // 409 SALARY_AMOUNT_CHANGED：D10
  | { kind: "coverage"; expiresAt: string; lastDay: boolean } // 422／503：D8，截止日是今天 D8b
  | { kind: "alreadyClaimed" } // 409 SALARY_ALREADY_CLAIMED：不提示，重读后显示已领
  | { kind: "notClaimable"; month: string; gone: boolean } // 409 SALARY_NOT_CLAIMABLE：该月已不在 months 里时 toast
  | { kind: "unknown" } // 超时、断开、回执 PROCESSING 或回执读不到：D6 确认中，只读
  | { kind: "notFound" }; // 回执 NOT_FOUND：D6 给「重新提交」
function showSalaryResult(result: SalaryResult) {
  const copy = t.value.myRank, d = salaryDates(locale.code), usdt = (value: string) => `${formatHowNumber(value, locale.code)}\u00A0USDT`;
  salaryPending.phase = result.kind === "unknown" ? "confirming" : result.kind === "notFound" ? "resend" : "idle";
  if (result.kind === "ok") toast.success(fmt(copy.toastOkTitle, { a: usdt(result.amountUsdt) }), copy.toastOkDesc);
  if (result.kind === "amountChanged") { amountChange.value = result; salaryDialog.value = "amount"; }
  if (result.kind === "coverage") toast.warn(copy.toastFailTitle, result.lastDay ? copy.toastFailToday : d.sentence(fmt(copy.toastFailDesc, { d: d.day(lastClaimDay(result.expiresAt)) })));
  if (result.kind === "notClaimable" && result.gone) toast.warn(d.sentence(fmt(copy.expiredToast, { m: d.month(result.month) })));
}
void showSalaryResult; // 逻辑项接入前没有调用方

// ── 底部操作栏（2.1 非领取状态）与「加快晋级」（2.4：同三个目的地，底部按钮已覆盖的不重复）──
const missingKinds = computed(() => new Set(prog.value.missing.map(row => row.kind)));
const dockAction = computed(() => {
  // 月薪项：有可领月薪时这里先返回领取（悬浮按钮或托盘），再落到下面补差距的一步。
  const kinds = missingKinds.value;
  if (!prog.value.next || !kinds.size) return null;
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
  if (remoteApiEnabled) void vState.refreshCanonicalVRank();
});
onShow(() => {
  if (remoteApiEnabled) void vState.refreshCanonicalVRank();
});

function retryRank() {
  if (remoteApiEnabled) void vState.refreshCanonicalVRank();
}

function rowStatus(v: VRank): "done" | "current" | "locked" {
  if (visibility.hidden) return "locked";
  return v < vState.myRank ? "done" : v === vState.myRank ? "current" : "locked";
}

// Mirrors VRankRewardDispatcher.dispatchNexReward/hasSelfMarker: only positive
// NEX without a self/direct marker follows the sponsor-with-self-fallback rule.
// cultivationBonus aggregates all NEX and cannot classify an individual reward.
function cultivationReward(reward: VRankReward): boolean {
  return !isEntitlementVRankReward(reward) && reward.type === 'UVT'
    && Number.isFinite(reward.amount) && reward.amount > 0
    && !/self|direct/i.test(reward.customLabel ?? '');
}
function rewardText(reward: VRankReward): string {
  if (isEntitlementVRankReward(reward)) return platformDisplayText(rankEntitlementLabel(reward, t.value.rank.rewardUnavailable));
  const amount = `${formatAmount(reward.amount)}\u00A0${reward.type === "UVT" ? "UVT" : reward.type}`;
  return amount;
}

// 三语:词典里 rank.cond.* 五条早就有(此前是死键,这里原本拼英文)
function conditionItems(r: VRankDef): string[] {
  const c = r.conditions, items: VRankConditions[] = [];
  if (c.selfComputePoints !== undefined) items.push({selfComputePoints:c.selfComputePoints});
  if (c.directRefs) items.push({directRefs:c.directRefs});
  if (c.teamComputePoints !== undefined) items.push({teamComputePoints:c.teamComputePoints});
  for (const [v,n] of Object.entries(c.vDownlines ?? {})) if(n) items.push({vDownlines:{[v]:n}});
  return (items.length ? items : [{}]).map(item=>rankConditionsText(t.value,item,locale.code));
}

function go(url: string) {
  navTo(url);
}

// chips.votes holds the plural forms a language needs, "one|few|many" (ru) or "one|other" (en); others have one word.
function voteWord(n: number) {
  const forms = t.value.rank.chips.votes.split('|');
  if (forms.length === 1) return forms[0];
  const form = new Intl.PluralRules(locale.code).select(n);
  return forms.length === 2 ? forms[form === 'one' ? 0 : 1] : forms[form === 'one' ? 0 : form === 'many' ? 2 : 1];
}
function benefitItems(r: VRankDef): {label:string;value:string}[] {
  const items: {label:string;value:string}[]=[{label:t.value.rank.chips.direct,value:formatHowNumber(r.directBonus*100,locale.code)+'%'}];
  if(r.peerBonus>0) items.push({label:t.value.rank.chips.peer,value:vState.capabilities.peer ? formatHowNumber(r.peerBonus*100,locale.code)+'%' : fmt(t.value.rank.chips.peerNotDispatched,{n:formatHowNumber(r.peerBonus*100,locale.code)})});
  if(r.leadershipVotes>0) items.push({label:t.value.rank.chips.pool,value:`${r.leadershipVotes}\u00A0${voteWord(r.leadershipVotes)}`});
  return items;
}
useAutoRecovery({ failed: () => remoteApiEnabled && !!vState.remoteError, retry: () => vState.refreshCanonicalVRank() });
</script>

<style scoped>
.rank-page { color:var(--v5-ink);padding-bottom:28px; }
/* 底部悬浮按钮（04.0）：内容底部留白为 48＋离底＋16，chassis 已给离底＋18。 */
.rank-page--dock { padding-bottom:46px; }
.rank-content { padding:4px 16px 0; }
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
@media (prefers-reduced-motion: reduce) { .rank-dock__spin { animation-duration:2.4s; } }
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
.rank-caption { display:block;font:var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5);color:var(--v5-ink-3);overflow-wrap:break-word; }
.rank-ladder-section { margin-top:var(--ui-space-section-gap); }
.rank-ladder { overflow:hidden;border:1px solid var(--v5-border);border-radius:22px;background:var(--v5-surface); }
.rank-ladder-row { position:relative; }
.rank-ladder-row::before { content:'';position:absolute;left:33px;top:0;bottom:0;width:2px;background:var(--v5-border-strong);pointer-events:none; }
.rank-ladder-row:first-child::before { top:32px; }
.rank-ladder-row:last-child::before { bottom:calc(100% - 32px); }
.rank-ladder-row[data-status="done"]::before { background:color-mix(in srgb,var(--v5-brand) 55%,var(--v5-surface)); }
.rank-ladder-row[data-status="current"] { background:color-mix(in srgb,var(--v5-brand) 6%,transparent); }
.rank-row-heading { position:relative;display:flex;align-items:center;gap:12px;min-height:64px;box-sizing:border-box;padding:10px 16px;cursor:pointer; }
.rank-row-heading :deep(.team-rank-emblem) { background:var(--v5-surface);border-radius:12px; }
.rank-ladder-row[data-status="current"] .rank-row-heading :deep(.team-rank-emblem) { box-shadow:0 0 0 4px color-mix(in srgb,var(--v5-brand) 14%,transparent),0 6px 18px color-mix(in srgb,var(--v5-brand) 25%,transparent); }
.rank-row-heading:focus-visible { outline:2px solid var(--v5-brand);outline-offset:3px; }
.rank-row-heading:focus-visible { outline-offset:-3px; }
.rank-row-copy { flex:1;min-width:0; }
.rank-row-title { display:block;font:500 var(--ui-type-list-title)/20px var(--font-v5);overflow-wrap:break-word; }
.rank-row-sub { display:block;margin-top:2px;font:400 var(--ui-type-list-subtitle)/18px var(--font-v5);color:var(--v5-ink-3);overflow-wrap:break-word; }
.rank-row-sub--active { color:var(--v5-brand); }
.rank-row-chevron { flex:none;color:var(--v5-ink-3);transition:transform 180ms; }.rank-row-chevron--open { transform:rotate(180deg); }
.rank-details { position:relative;padding:2px 16px 18px 64px; }
.rank-detail-label { display:block;font:500 var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5);color:var(--v5-ink-2);margin-bottom:6px; }
.rank-detail-label--spaced { margin-top:14px; }
.rank-condition-copy { display:flex;gap:8px;align-items:baseline;margin:0;font:var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5);color:var(--v5-ink-2);overflow-wrap:break-word; }
.rank-condition-dot { width:5px;height:5px;border-radius:50%;background:var(--v5-ink-3);flex:none;transform:translateY(-2px); }
.rank-detail-hint,.rank-reward-note { display:block;margin-top:8px;font:400 12px/1.6 var(--font-v5);color:var(--v5-ink-3);overflow-wrap:break-word; }
.rank-perk-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px; }
.rank-perk { display:flex;flex-direction:column;gap:2px;min-width:0;padding:8px 10px;border:1px solid var(--v5-border);border-radius:12px;background:var(--ui-perk); }
.rank-perk-value { font:500 14px/20px var(--font-v5);font-variant-numeric:tabular-nums;overflow-wrap:break-word; }
.rank-reward-item + .rank-reward-item { margin-top:12px; }
.rank-reward-summary { display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 8px;color:var(--v5-nex); }
.rank-reward-title { display:block;font:600 var(--ui-type-section)/22px var(--font-v5); }
.rank-reward-amount { display:block;font:500 15px/22px var(--font-v5);font-variant-numeric:tabular-nums;overflow-wrap:break-word; }
.rank-reward-description { display:block;margin-top:2px;font:var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5);color:var(--v5-ink-3);overflow-wrap:break-word; }
.rank-reward { display:block;margin-top:2px;font:500 15px/22px var(--font-v5);font-variant-numeric:tabular-nums;color:var(--v5-nex);overflow-wrap:break-word; }
.rank-state { padding:32px 0;color:var(--v5-ink-2); }.rank-state text { display:block;margin-top:var(--ui-space-row-y); }
@media(max-width:350px) { .rank-details { padding-left:48px; }.rank-perk { padding-inline:8px; } }
@media(prefers-reduced-motion:reduce) { .rank-row-chevron { transition:none; } }
.rank-ladder { display:flex;gap:6px;overflow-x:auto;padding:4px 2px 2px;border:0;border-radius:0;background:transparent;scrollbar-width:none; }
.rank-ladder::-webkit-scrollbar { display:none; }
.rank-ladder-row { flex:none;background:none !important; }
.rank-ladder-row::before { display:none; }
/* A rank can be wider than 56px when its status word is long (fil, id, kk, ms); the track scrolls sideways, so the item grows instead of its label running into the next one. */
.rank-row-heading { flex-direction:column;align-items:center;gap:4px;min-width:56px;width:auto;min-height:88px;padding:6px 6px;border-radius:16px; }
.rank-row-heading[aria-expanded="true"] { background:color-mix(in srgb,var(--v5-ink) 6%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--v5-ink) 12%,transparent); }
.rank-row-title { font:500 12px/16px var(--font-metric);text-align:center; }
.rank-row-sub { margin-top:0;font:500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);text-align:center;white-space:nowrap; }
.rank-ladder-row[data-status="locked"] .rank-row-heading :deep(.team-rank-emblem) { opacity:.55; }
.rank-details { margin-top:12px;padding:20px;border-radius:28px;background:var(--v5-surface);box-shadow:inset 0 0 0 1px var(--v5-border); }
/* P-42 round 2 */
.rank-ladder-row + .rank-ladder-row::after { content:"";position:absolute;left:-6px;top:26px;width:6px;height:2px;background:var(--v5-surface-3); }
.rank-ladder-row[data-status="done"] + .rank-ladder-row::after,.rank-ladder-row[data-status="current"]::after { background:var(--v5-brand); }
.rank-ladder-row[data-status="done"] .rank-row-sub { color:var(--v5-ink-3); }
.rank-perk-value { font:500 22px/26px var(--font-metric);color:var(--v5-brand); }
.rank-perk + .rank-perk .rank-perk-value { color:var(--v5-nex); }
.rank-reward-item { --nx-tint:var(--v5-warning);padding:14px;border-radius:16px; }
.rank-reward-summary { justify-content:space-between; }
.rank-reward-title { font:500 13px/18px var(--font-v5);color:var(--v5-ink); }
.rank-reward-amount { font:500 16px/20px var(--font-metric);color:var(--v5-nex-ink); }
</style>
