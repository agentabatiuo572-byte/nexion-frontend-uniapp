<template>
  <AppChassis active="me">
    <view class="learning-center">
      <SubPageHeader design back="/pages/me/me" :title="t.learning.centerTitle" />
      <view v-if="loading && !overview" class="learning-state" role="status"><text>{{ t.learning.centerLoading }}</text></view>
      <view v-else-if="error" class="learning-state" role="alert" aria-live="assertive">
        <text class="block">{{ errorText }}</text>
        <NxButton class="learning-retry nx-retry-action" variant="text" :label="t.ui.retry" @click="retryCourses" />
      </view>
      <view v-if="!overview" class="learning-summary">
        <view class="learning-summary__line"><text class="learning-summary__progress">{{ fmt(pageCopy.progress, {done:'—',total:'—'}) }}</text><view class="learning-summary__earned"><text>{{ pageCopy.earned }}</text><text class="learning-reward">— UVT</text></view></view>
        <view class="course-list__heading"><text class="course-list__title">{{ pageCopy.allCourses }}</text><text class="course-list__count">—</text></view>
      </view>
      <view v-if="overview">
        <view class="learning-summary learning-summary--known">
          <GrowthProgress ring :size="64" :stroke="9" :value="overviewProgress" :label="progressLine"><text>{{ overview.completedCourses }}/{{ overview.totalCourses }}</text></GrowthProgress>
          <view class="learning-summary__line">
            <text class="learning-summary__progress">{{ progressLine }}</text>
            <view class="learning-summary__earned"><text>{{ pageCopy.earned }}</text><text class="learning-reward">{{ formatAmount(overview.earnedNex) }} UVT</text></view>
          </view>

        </view>

        <EmptyState v-if="overview.courses.length === 0" kind="empty-list" :title="t.empty.listTitle" :desc="t.empty.listDesc" compact />
        <view v-if="featuredCourse" class="learning-section">
          <view class="course-feature">
            <view class="course-feature__glow" aria-hidden="true" />
            <text class="course-feature__label">{{ featuredCourse.progress > 0 ? recommendationCopy.resume : t.learning.featuredLabel }}</text>
            <text class="course-feature__name">{{ featuredCourse.title }}</text>
            <view class="course-feature__meta"><text>{{ courseMetaLead(featuredCourse) }} · {{ pageCopy.reward }}</text><text class="learning-reward" style="margin-left:3px">{{ formatAmount(featuredCourse.rewardNex) }} UVT</text></view>
            <view class="course-feature__progress">
              <GrowthProgress class="course-progress" :value="featuredCourse.progress" :label="featuredCourse.title" />
            </view>
            <view class="course-feature__actions"><text class="course-progress__label">{{ fmt(auditCopy.progress, { n: featuredCourse.progress }) }}</text>
            <NxButton class="course-feature__cta" variant="brand" size="medium" :label="featuredCourse.progress > 0 ? recommendationCopy.resume : recommendationCopy.start" @click="open(featuredCourse.id)" /></view>
          </view>
        </view>
        <view v-else-if="overview.courses.length" class="course-completed"><text>{{ auditCopy.allCoursesDone }}</text><text>{{ fmt(auditCopy.earned, { n: formatAmount(overview.earnedNex) }) }}</text></view>

        <view v-if="overview.courses.length" class="learning-section">
          <view class="course-list__heading"><text class="course-list__title">{{ pageCopy.allCourses }}</text><text class="course-list__count">{{ fmt(pageCopy.courseCount, { n: overview.totalCourses }) }}</text></view>
          <view class="course-list">
            <view v-for="(course, index) in overview.courses" :key="course.id" class="course-row" :class="{ 'course-row--recommended': course.id === featuredCourse?.id }" role="button" tabindex="0" :aria-label="course.title + ' · ' + courseMeta(course) + ' · ' + courseStatus(course)" @click="open(course.id)">
              <view v-if="course.completed" class="course-status course-status--done" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10" /></svg></view>
              <GrowthProgress v-else ring :size="36" :stroke="9" :value="course.progress" :label="courseStatus(course)"><text class="course-number" :class="{'course-number--active': course.progress > 0}">{{ index + 1 }}</text></GrowthProgress>
              <view class="course-row__body"><text class="course-row__title">{{ course.title }}</text><view class="course-row__meta"><text>{{ courseMetaLead(course) }} · {{ pageCopy.reward }}</text><text class="learning-reward" style="margin-left:3px">{{ formatAmount(course.rewardNex) }} UVT</text><text v-if="!course.completed && course.progress > 0" class="course-row__progress-copy"> · {{ fmt(auditCopy.progress,{n:course.progress}) }}</text></view></view>
              <text v-if="course.completed" class="course-row__done">{{ auditCopy.completed }}</text>
              <text v-else-if="course.id === featuredCourse?.id" class="course-row__tag">{{ pageCopy.recommended }}</text>
              <svg v-else class="course-row__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
            </view>
          </view>
        </view>
      </view>
    </view>
  </AppChassis>
</template>
<script setup lang="ts">
import { formatAmount } from "@/lib/amount-display";
import { navTo } from "@/lib/route";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { onHide, onShow } from "@dcloudio/uni-app";
import { registerActivePageRefresh } from "@/lib/active-page-refresh";
import AppChassis from "@/components/app-chassis.vue";
import { useAuditUiCopy } from "@/i18n/audit-ui";
import GrowthProgress from "@/components/ui/growth-progress.vue";
import NxButton from "@/components/ui/nx-button.vue";
import EmptyState from "@/components/empty-state.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { ApiError } from "@/api/errors";
import { readLearningCourses } from "@/store/published-content";
import { passiveTabReadScope } from "@/lib/passive-tab-read";
import { remoteApiEnabled, apiRuntimeConfig } from "@/api/runtime";
import { fmt } from "@/i18n/format";
import { courseDurationText } from "@/lib/course-duration";
import { learningRecommendationCopy } from '@/i18n/learning-recommendation';
import { selectRecommendedCourse } from "@/lib/learning-recommendation";
import { useT } from "@/i18n/use-t";
import { useLocaleStore } from "@/store/locale";
import { useApp } from "@/store/app";
import { captureRuntimeRevision, subscribeRuntimeRevision } from "@/api/order-api";
import { createLearningPageFenceReader, type LearningPageFence } from "./learning-page-fence";
import { bindPageVisibilityRefresh, createPageVisibilityRefresh } from "@/lib/page-visibility-refresh";
import type { LearningCourse, LearningOverview } from "@/api/learning-api";
// 存 key 而不是译好的串:译文一旦快照进 ref 就不再跟随语言(uni 复用页面实例时,
// 上一次访问用的语言会留在错误提示上 —— 实景走查实测:zh 下重试按钮是中文、正文还是英文)。
type LearningError = "" | "centerOffline" | "centerGeoUnresolved" | "centerUnavailable";
const auditCopy = useAuditUiCopy();
const recommendationCopy = computed(() => learningRecommendationCopy[language.value]);
const t = useT(); const locale = useLocaleStore(); const app = useApp(); const overview = ref<LearningOverview | null>(null); const loading = ref(true); const error = ref<LearningError>("");
const errorText = computed(() => error.value ? t.value.learning[error.value] : "");
const featuredCourse = computed(() => selectRecommendedCourse(overview.value?.courses ?? []));
const language = computed(() => locale.code === "zh" || locale.code === "vi" ? locale.code : "en");
const pageCopy = computed(() => ({
  zh: { progress: "已学完 {done}/{total} 课", earned: "已获", allCourses: "全部课程", courseCount: "{n} 门", recommended: "推荐", questions: "{n} 道小测", reward: "奖励" },
  en: { progress: "{done}/{total} courses completed", earned: "Earned", allCourses: "All courses", courseCount: "{n} courses", recommended: "Suggested", questions: "{n} quiz questions", reward: "Reward" },
  vi: { progress: "Đã học {done}/{total} bài", earned: "Đã nhận", allCourses: "Tất cả bài học", courseCount: "{n} bài", recommended: "Đề xuất", questions: "{n} câu hỏi", reward: "Thưởng" },
}[language.value]));
const progressLine = computed(() => overview.value ? fmt(pageCopy.value.progress, { done: overview.value.completedCourses, total: overview.value.totalCourses }) : "");
const overviewProgress = computed(() => overview.value?.totalCourses ? Math.min(100, Math.max(0, overview.value.completedCourses / overview.value.totalCourses * 100)) : 0);
function courseMetaLead(course: LearningCourse) {
  const duration = courseDurationText(course.duration, t.value.learning.durationMinutes);
  return course.questions.length ? duration + " · " + fmt(pageCopy.value.questions, { n: course.questions.length }) : duration;
}
function courseMeta(course: LearningCourse) {
  const duration = courseDurationText(course.duration, t.value.learning.durationMinutes);
  const meta = course.rewardGranted
    ? duration + " · " + fmt(auditCopy.value.earned, { n: formatAmount(course.rewardNex) })
    : fmt(t.value.learning.courseMeta, { duration, nex: formatAmount(course.rewardNex) });
  return meta;
}
function courseStatus(course: LearningCourse) { return course.completed ? auditCopy.value.completed : course.progress > 0 ? fmt(auditCopy.value.progress, { n: course.progress }) : auditCopy.value.notStarted; }
let accountEpoch = 0;
let generation = 0;
let mounted = false;
let overviewScope = "";
const fenceReader = createLearningPageFenceReader(
  () => String(app.accountKey),
  () => accountEpoch,
  captureRuntimeRevision,
  () => generation,
  () => mounted,
);
function fence(): LearningPageFence { return fenceReader.capture(); }
function current(scope: LearningPageFence): boolean { return fenceReader.isCurrent(scope); }
let environmentInvalidated = false;
watch(() => apiRuntimeConfig?.environment, () => { environmentInvalidated = true; accountEpoch += 1; generation += 1; overview.value = null; error.value = 'centerUnavailable'; }, { flush: 'sync' });
async function load(force = false) {
  if (environmentInvalidated) return;
  const displayScope = passiveTabReadScope(false);
  if (overviewScope !== displayScope) overview.value = null;
  generation += 1;
  const scope = fence();
  loading.value = true;
  error.value = "";
  if (!remoteApiEnabled) {
    if (!current(scope)) return;
    loading.value = false;
    error.value = "centerOffline";
    return;
  }
  try {
    const value = await readLearningCourses(language.value, force);
    if (current(scope)) { overview.value = value; overviewScope = displayScope; }
  } catch (cause) {
    if (current(scope)) {
      if (cause instanceof ApiError && (cause.kind === "auth" || cause.status === 401 || cause.status === 403 || cause.code === 401 || cause.code === 403)) overview.value = null;
      error.value = cause instanceof Error && cause.message.includes("GEO_COUNTRY_UNRESOLVED") ? "centerGeoUnresolved" : "centerUnavailable";
    }
  } finally {
    if (current(scope)) loading.value = false;
  }
}
function retryCourses() { void load(true); }
function open(id: string) { navTo(`/pages/learn/course?id=${encodeURIComponent(id)}`); }
const courseVisibility = createPageVisibilityRefresh((reason) => {
  if (reason === "return") generation += 1;
  void load();
});
let releaseActiveRefresh = () => {};
bindPageVisibilityRefresh(courseVisibility, {
  mounted: (callback) => onMounted(() => {
    mounted = true;
    callback();
  }),
  shown: (callback) => onShow(() => {
    mounted = true;
    releaseActiveRefresh();
    releaseActiveRefresh = registerActivePageRefresh(() => load(true));
    callback();
  }),
  hidden: (callback) => onHide(() => {
    releaseActiveRefresh();
    mounted = false;
    generation += 1;
    callback();
  }),
});
onUnmounted(() => { releaseActiveRefresh(); mounted = false; generation += 1; });
function refreshForScopeChange() {
  accountEpoch += 1;
  generation += 1;
  overview.value = null;
  error.value = "";
  if (mounted) void load();
}
watch(() => String(app.accountKey), refreshForScopeChange, { flush: "sync" });
watch(() => app.accountBindingEpoch, refreshForScopeChange, { flush: "sync" });
watch(() => language.value, refreshForScopeChange, { flush: "sync" });
const stopRuntimeRefresh = subscribeRuntimeRevision(refreshForScopeChange);
onUnmounted(stopRuntimeRefresh);


</script>

<style scoped>
.learning-center {--ui-course-track:color-mix(in srgb,var(--v5-ink) 16%,var(--v5-bg)); --learning-reward: var(--v5-nex); padding-bottom: var(--v5-space-6); color: var(--v5-ink); font-family: var(--font-v5); }
.learning-center :deep(.spv--design) { grid-template-columns: 56px minmax(0, 1fr) 56px; margin: 0; }
.learning-state { padding: var(--v5-space-5) 18px; color: var(--v5-ink-3); text-wrap: pretty; }
.learning-retry { margin-top: var(--v5-space-3); }
.learning-summary { padding: var(--v5-space-5) 18px 0; }
.learning-summary__line { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 6px 12px; }
.learning-summary__progress { font-size: var(--v5-type-h3); font-weight: 600; line-height: 29px; font-variant-numeric: tabular-nums; }
.learning-summary__earned { display: flex; gap: 3px; align-items: baseline; font-size: 12.5px; color: var(--v5-ink-3); }
.learning-summary__earned .learning-reward { font-weight: 600; }
.learning-reward { color: var(--learning-reward); font-variant-numeric: tabular-nums; }
.learning-summary__bar { height: 6px; margin-top: 10px; border-radius: var(--v5-radius-full); background: var(--v5-surface-3); overflow: hidden; }
.learning-summary__bar > view { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--v5-brand-deep), var(--ui-lime-soft)); box-shadow: 0 0 10px color-mix(in srgb, var(--v5-brand) 45%, transparent); }
.learning-section { padding: var(--v5-space-6) var(--v5-space-4) 0; }
.course-feature { position: relative; overflow: hidden; padding: 18px; border: 1px solid var(--v5-border); border-radius: var(--ui-radius-surface); background: radial-gradient(55% 65% at 90% 28%, color-mix(in srgb, var(--v5-brand) 22%, transparent), transparent 65%), linear-gradient(180deg, var(--ui-spotlight-top), var(--ui-ticket-bottom)); }
.course-feature__glow { position: absolute; right: 14px; top: 96px; width: 96px; height: 16px; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--ui-lime-soft) 40%, transparent), transparent); pointer-events: none; }
.course-feature__label { position: relative; display: block; font-size: 12.5px; font-weight: 500; line-height: 18px; color: var(--ui-lime-soft); }
.course-feature__name { position: relative; display: block; max-width: 200px; margin-top: 6px; font-size: 19px; font-weight: 600; line-height: 25px; overflow-wrap: anywhere; }
.course-feature__meta { position: relative; margin-top: 6px; font-size: 12.5px; line-height: 18px; color: var(--v5-ink-3); overflow-wrap: anywhere; }
.course-feature__progress { display: flex; align-items: center; gap: 10px; margin-top: var(--v5-space-3); }
.course-progress { flex: 1; height: 4px; border-radius: var(--v5-radius-full); overflow: hidden; background: var(--ui-course-track); }
.course-progress > view { height: 100%; background: var(--v5-brand); }
.course-progress__label { flex: none; font-size: 12.5px; line-height: 18px; color: var(--v5-ink-3); font-variant-numeric: tabular-nums; }
.learning-center .course-feature__cta { display: flex; box-sizing: border-box; width: 100%; min-height: 44px; margin-top: var(--v5-space-4); padding: 0; font-size: var(--ui-type-button); font-weight: 600; }
.course-feature__cta :deep(.nx-button__surface) { min-height:44px; box-shadow:0 8px 22px color-mix(in srgb,var(--v5-brand) 28%,transparent),inset 0 1px 0 var(--v5-liquid-highlight); }
.course-completed { display: flex; flex-direction: column; gap: var(--v5-space-2); padding: var(--v5-space-6) 18px 0; color: var(--v5-brand); }
.course-list__heading { display: flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 2px; }
.course-list__title { font-size: var(--ui-type-section); font-weight: 600; letter-spacing: -.012em; }
.course-list__count { font-size: var(--ui-type-list-subtitle); font-weight: 500; color: var(--v5-ink-3); }
.course-list { overflow: hidden; border: 1px solid var(--v5-border); border-radius: var(--ui-radius-surface); background: var(--v5-surface); }
.course-row { display: flex; align-items: center; gap: var(--v5-space-3); box-sizing: border-box; min-height: 64px; padding: 10px 16px; border-bottom: 1px solid var(--v5-border); cursor: pointer; }
.course-row:last-child { border-bottom: 0; }
.course-row--recommended { background: color-mix(in srgb, var(--v5-brand) 6%, transparent); }
.course-row:active { opacity: .7; }
.course-row:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: -2px; }
.course-status { display: grid; place-items: center; flex: none; box-sizing: border-box; width: 32px; height: 32px; border-radius: 50%; font-size: var(--v5-type-body-s); font-weight: 600; font-variant-numeric: tabular-nums; }
.course-status--done { color: var(--v5-brand); background: color-mix(in srgb, var(--v5-brand) 14%, transparent); }
.course-status--progress { color: var(--v5-brand); }
.course-status--todo { border: 1.5px solid color-mix(in srgb, var(--v5-ink-3) 35%, var(--v5-surface)); color: var(--v5-ink-3); }
.course-row__body { flex: 1; min-width: 0; }
.course-row__title { display: block; font-size: var(--ui-type-list-title); font-weight: 500; line-height: 20px; overflow-wrap: anywhere; }
.course-row__meta { display: block; margin-top: 2px; font-size: var(--ui-type-list-subtitle); line-height: var(--ui-type-list-subtitle-lh); color: var(--v5-ink-3); overflow-wrap: anywhere; }
.course-row__done { flex: none; max-width: 25%; font-size: 12.5px; line-height: 18px; color: var(--v5-brand); }
.course-row__tag { display: inline-flex; flex: none; align-items: center; min-height: 22px; max-width: 25%; box-sizing: border-box; padding: 0 var(--v5-space-2); border-radius: var(--v5-radius-full); background: color-mix(in srgb, var(--v5-brand) 14%, transparent); color: var(--v5-brand); font-size: var(--v5-type-caption); font-weight: 500; line-height: 18px; }
.course-row__chevron { flex: none; color: var(--v5-ink-4); }
.course-number {font:500 12px/16px var(--font-metric);color:var(--v5-ink-3);}.course-number--active {color:var(--v5-brand);}.course-row__progress-copy {white-space:nowrap;}
.learning-summary { padding: var(--v5-space-1) 20px 0; }.learning-summary--known { display: flex; align-items: center; gap: var(--v5-space-4); }.learning-summary__line { display: block; }
.learning-summary__progress { font: 600 20px/28px var(--font-v5); }.learning-summary__earned { margin-top: var(--v5-space-1); font: 400 12px/16px var(--font-v5); }
.learning-summary :deep(.growth-progress__center) { font: 500 14px/18px var(--font-metric); }.learning-reward { font-family: var(--font-metric); }
.learning-section { padding-top: 20px; }.course-feature { padding: 18px 16px 16px; border: none; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: inset 0 1px 0 var(--v5-brand); }
.course-feature__glow { display: none; }.course-feature__label { font: 400 12px/16px var(--font-v5); color: var(--v5-brand); }.course-feature__name { margin-top: var(--v5-space-1); max-width: none; font: 600 18px/24px var(--font-v5); }
.course-feature__meta { margin-top: var(--v5-space-1); font: 400 12px/16px var(--font-v5); }.course-feature__progress { display: block; margin-top: var(--v5-space-3); }.course-progress { height: 6px; }.course-progress__label { display: block; margin-top: 14px; padding-right: 46%; font: 400 12px/16px var(--font-v5); }
.learning-center .course-feature__cta { width: auto; display: flex; margin: -30px 0 0 auto; max-width: 52%; font-weight: 500; }.course-feature__cta :deep(.nx-button__surface) { box-shadow: var(--ui-glass-edge-shadow); }
.course-list__heading { justify-content: space-between; margin: 0 4px 12px; min-height: 24px; }.course-list { border: none; border-radius: var(--ui-radius-surface); }.course-row { min-height: 68px; }.course-status { width: 36px; height: 36px; font-family: var(--font-metric); }.course-row__meta { font: 400 12px/16px var(--font-v5); transform:translateY(1.5px); }

/* Approved growth board geometry and material. */
 .learning-summary { padding-top:11px; }.learning-section + .learning-section { padding-top:32px; }
.course-feature { padding-top:22px; display:flex; flex-direction:column; box-sizing:border-box; min-height:197.5px; overflow:visible; box-shadow:var(--v5-glass-shadow); }
.course-feature::before { content:''; position:absolute; inset:0; border-radius:inherit; padding:1.5px; background:conic-gradient(from 120deg,transparent 0 50%,color-mix(in srgb,var(--v5-brand) 80%,transparent) 72%,transparent 94%); -webkit-mask:linear-gradient(var(--v5-ink) 0 0) content-box,linear-gradient(var(--v5-ink) 0 0); -webkit-mask-composite:xor; mask-composite:exclude; pointer-events:none; }
.course-feature__actions { box-sizing:border-box; padding:0 16px; display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:64px; margin-top:auto; }.course-feature__actions .course-progress__label { padding:0; margin:0; }
.learning-center .course-feature__cta { margin:0; flex:none; width:92px; max-width:none; }
.course-feature__cta :deep(.nx-button__surface) { padding-inline:16px; --ui-button-ink:var(--v5-ink) !important; }
.learning-reward { font-family:var(--font-v5); }.learning-summary__earned .learning-reward { font-family:var(--font-metric); }


.learning-center .course-feature__cta { min-height:40px; padding:0; position:relative; }
.course-feature__cta :deep(.nx-button__surface) { min-height:40px; }
.course-feature__cta::after { content:""; position:absolute; inset:-2px 0; }
.course-row__tag { min-height:24px; }
.course-list__heading { margin-inline:2px; }

</style>
