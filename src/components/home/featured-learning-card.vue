<template>
  <view v-if="courses.length" class="learning-card active:opacity-70" :class="{'learning-card--mission': missionLayout}" role="link" tabindex="0" @click="open">
    <GrowthProgress v-if="missionLayout" ring :size="48" :radius="41.6667" :stroke="8.3333" :value="featuredCourse?.progress ?? 100" :label="featuredCourse?.title ?? copy.completed"><text>{{ featuredCourse?.progress ?? 100 }}%</text></GrowthProgress>
    <view class="learning-card__body">
    <view class="learning-card__text">
    <text class="block" style="font-size:12px;color:var(--v5-brand)">{{ t.learning.featuredLabel }}</text>
    <template v-if="featuredCourse">
      <text class="block learning-title" style="margin-top:var(--v5-space-2);font-size:15px;font-weight:600">{{ featuredCourse.title }}</text>
      <text class="block learning-meta">{{ courseMeta }}</text>
      <view v-if="featuredCourse.progress > 0" class="learning-progress" role="progressbar" :aria-label="copy.progress.replace('{progress}', String(featuredCourse.progress))" :aria-valuenow="featuredCourse.progress" :aria-valuemin="0" :aria-valuemax="100">
        <view v-viz-inview class="learning-progress-fill nx-viz-grow" :style="{ width: `${featuredCourse.progress}%` }" />
      </view>
    </template>
    <template v-else>
      <text class="block learning-title" style="margin-top:var(--v5-space-2);font-size:15px;font-weight:600">{{ copy.completed }}</text>
      <text class="block learning-meta">{{ copy.completedHint }}</text>
    </template>
    </view>
    <template v-if="featuredCourse">
      <view class="learning-footer">
        <text v-if="featuredCourse.progress > 0" class="learning-progress-label">{{ copy.progress.replace('{progress}', String(featuredCourse.progress)) }}</text>
        <text class="learning-action nx-after-chevron">{{ featuredCourse.progress > 0 ? copy.resume : copy.start }}</text>
      </view>
    </template>
    <template v-else>
      <view class="learning-footer"><text class="learning-action nx-after-chevron">{{ copy.review }}</text></view>
    </template>
    </view>
  </view>
</template>
<script setup lang="ts">
import GrowthProgress from '@/components/ui/growth-progress.vue';
import { uiLocale, serverLanguage } from '@/i18n';
const { missionLayout = false } = defineProps<{missionLayout?: boolean}>();
import { formatAmount } from "@/lib/amount-display";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { onShow, onHide } from "@/composables/use-tab-page-lifecycle";
import { learningApi } from "@/api/learning-runtime";
import { remoteApiEnabled } from "@/api/runtime";
import { captureRuntimeRevision, subscribeRuntimeRevision } from "@/api/order-api";
import type { LearningCourse } from "@/api/learning-api";
import { useApp } from "@/store/app";
import { useLocaleStore } from "@/store/locale";
import { navTo } from "@/lib/route";
import { useT } from "@/i18n/use-t";
import { courseDurationText } from "@/lib/course-duration";
import { selectRecommendedCourse } from "@/lib/learning-recommendation";
import { learningRecommendationCopy } from "@/i18n/learning-recommendation";
import { fmt } from "@/i18n/format";
const t = useT();
const app = useApp();
const locale = useLocaleStore();
const courses = ref<LearningCourse[]>([]);
const featuredCourse = computed(() => selectRecommendedCourse(courses.value));
const language = computed(() => serverLanguage(locale.code));
const copy = computed(() => learningRecommendationCopy[uiLocale(locale.code)]);
const courseMeta = computed(() => featuredCourse.value ? fmt(t.value.learning.courseMeta, {
  duration: courseDurationText(featuredCourse.value.duration, t.value.learning.durationMinutes),
  nex: formatAmount(featuredCourse.value.rewardNex),
}) : "");
let visible = false;
let generation = 0;
async function refresh() {
  const ownGeneration = ++generation;
  courses.value = [];
  if (!remoteApiEnabled || !visible) return;
  const scope = `${app.accountKey}:${app.accountBindingEpoch}:${language.value}:${captureRuntimeRevision().epoch}`;
  try {
    const response = await learningApi.courses(language.value);
    if (visible && ownGeneration === generation && scope === `${app.accountKey}:${app.accountBindingEpoch}:${language.value}:${captureRuntimeRevision().epoch}`) courses.value = response.courses;
  } catch { /* Optional recommendation stays hidden when authority is unavailable. */ }
}
function open() {
  if (!courses.value.length) return;
  navTo(featuredCourse.value ? `/pages/learn/course?id=${encodeURIComponent(featuredCourse.value.id)}&source=missions` : "/pages/learn/courses");
}
function onKeyboardActivate(event: KeyboardEvent) { if (!event.repeat) open(); }
function show() { visible = true; void refresh(); }
function hide() { visible = false; generation += 1; courses.value = []; }
onMounted(show);
onShow(show);
onHide(hide);
const unsubscribeRuntime = subscribeRuntimeRevision(() => { void refresh(); });
onUnmounted(() => { hide(); unsubscribeRuntime(); });
watch(() => [app.accountKey, app.accountBindingEpoch, language.value], () => { void refresh(); });
</script>

<style scoped>
.learning-card { padding: var(--v5-space-5); border-radius: var(--ui-radius-surface); background: var(--v5-surface); color: var(--v5-ink); }
.learning-title, .learning-meta { overflow-wrap:break-word; }
.learning-meta { margin-top:6px; font-size:12px; line-height:1.5; color:var(--v5-ink-3); }
.learning-progress { margin-top:14px; height:4px; border-radius:4px; overflow:hidden; background:var(--v5-brand-soft); }
.learning-progress-fill { height:100%; border-radius:4px; background:var(--v5-brand); }
.learning-footer { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:var(--v5-space-2) 12px; margin-top:var(--v5-space-3); }
.learning-progress-label { margin-right:auto; font-size:12px; color:var(--v5-ink-3); }
.learning-action { font-size:12px; font-weight:600; color:var(--v5-brand); }
.learning-card--mission { box-shadow:var(--v5-glass-shadow); display: flex; align-items: center; gap: 14px; padding: var(--v5-space-4); background: var(--v5-surface); }
.learning-card__body { min-width: 0; flex: 1; }.learning-card--mission :deep(.growth-progress__center) { font: 500 11px/14px var(--font-metric); }
.learning-card--mission .learning-title { margin-top: var(--v5-space-1) !important; font: 600 16px/22px var(--font-v5); }.learning-card--mission .learning-meta { margin-top: 2px; line-height:16.5px; }
.learning-card--mission .learning-progress, .learning-card--mission .learning-progress-label { display: none; }.learning-card--mission .learning-footer { margin-top: var(--v5-space-2); }
/* Text beside the action while it fits in about two lines; when the action would squeeze it narrower than 128px (long
   languages), the text takes the full width and the action drops to the bottom-right corner. */
.learning-card--mission .learning-card__body {display:flex;flex-wrap:wrap;align-items:center;gap:var(--v5-space-2) 12px;}.learning-card--mission .learning-card__text {flex:1 1 128px;min-width:0;}.learning-card--mission .learning-footer {flex:none;margin:0 0 0 auto;}

.learning-card--mission .learning-card__text > text:first-child { transform:translateY(4px); }
.learning-card--mission .learning-action { font-size:13px; }

</style>
