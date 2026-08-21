<template>
  <AppChassis active="me"><view class="px-4" style="padding-bottom:24px"><SubPageHeader back="/pages/learn/courses" />
    <view v-if="loading"><text>{{ t.learning.courseLoading }}</text></view><view v-else-if="error"><text class="block" style="text-wrap:pretty">{{ errorText }}</text><text class="block active:opacity-70" style="margin-top:12px;color:var(--v5-brand)" @click="load">{{ t.ui.retry }}</text></view>
    <view v-else-if="course"><text class="block" style="font-size:20px;font-weight:600">{{ course.title }}</text><text class="block" style="margin-top:10px;color:var(--v5-ink-2);text-wrap:pretty">{{ course.body }}</text><text class="block" style="margin-top:8px;color:var(--v5-ink-3)">{{ versionLine }}</text>
      <view v-for="(question, index) in course.questions" :key="question.questionId" style="margin-top:16px"><text>{{ question.question }}</text><view v-for="(option, optionIndex) in question.options" :key="option" class="active:opacity-70" style="margin-top:8px" @click="answers[index] = optionIndex"><text>{{ answers[index] === optionIndex ? '●' : '○' }} {{ option }}</text></view></view>
      <text class="block" :class="canSubmit ? 'active:opacity-70' : ''" :style="{ marginTop: '20px', color: canSubmit ? 'var(--v5-brand)' : 'var(--v5-ink-4)' }" @click="finish">{{ course.questions.length ? t.learning.submitQuiz : t.learning.completeCourse }}</text><text v-if="course.questions.length && !allAnswered && !result" class="block" style="margin-top:6px;font-size:12px;color:var(--v5-ink-3)">{{ t.learning.answerAllFirst }}</text><text v-if="result" class="block" style="margin-top:12px">{{ result.passed ? t.learning.resultPassed : t.learning.resultFailed }}<template v-if="result.rewardGranted">{{ rewardGrantedLine }}</template></text><text v-else-if="serverCompleted" class="block" style="margin-top:12px">{{ t.learning.resultPassed }}</text>
    </view>
  </view></AppChassis>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { learningApi } from "@/api/learning-runtime";
import { remoteApiEnabled } from "@/api/runtime";
import { fmt } from "@/i18n/format";
import { useT } from "@/i18n/use-t";
import { useLocaleStore } from "@/store/locale";
import { useApp } from "@/store/app";
import { captureCommerceSandboxRun } from "@/api/order-api";
import { createLearningPageFenceReader, type LearningPageFence } from "./learning-page-fence";
import type { LearningCourse, LearningResult } from "@/api/learning-api";
// 存 key 不存译文:译好的串快照进 ref 后不再跟随语言(见 courses.vue 同处注释)。
type CourseError = "" | "courseOffline" | "courseUnavailable" | "submitUnconfirmed";
const t = useT(); const locale = useLocaleStore(); const app = useApp(); const courseId = ref(""); const course = ref<LearningCourse | null>(null); const result = ref<LearningResult | null>(null); const answers = ref<number[]>([]); const loading = ref(true); const error = ref<CourseError>(""); const quizKey = ref("");
const errorText = computed(() => error.value ? t.value.learning[error.value] : "");
const allAnswered = computed(() => !!course.value && answers.value.length === course.value.questions.length && answers.value.every((a) => a >= 0));
// 服务端说这门课已完成 —— 这是唯一可回读的权威位,拿它渲染「已完成」,不据此推断分数与是否通过。
const serverCompleted = computed(() => !!course.value?.completed);
// 已判过卷 / 服务端已记完成,就不再放行重复提交。
const canSubmit = computed(() => !!course.value && !loading.value && !result.value && !serverCompleted.value && (!course.value.questions.length || allAnswered.value));
const language = computed(() => ["zh", "vi", "en"].includes(locale.code) ? locale.code : "zh");
const versionLine = computed(() => course.value ? fmt(t.value.learning.courseVersionMeta, { version: course.value.version, nex: course.value.rewardNex }) : "");
const rewardGrantedLine = computed(() => result.value ? fmt(t.value.learning.rewardGranted, { nex: result.value.rewardNex }) : "");
let accountEpoch = 0;
let generation = 0;
let mounted = false;
const fenceReader = createLearningPageFenceReader(
  () => String(app.accountKey),
  () => accountEpoch,
  captureCommerceSandboxRun,
  () => generation,
  () => mounted,
);
function fence(): LearningPageFence { return fenceReader.capture(); }
function current(scope: LearningPageFence): boolean { return fenceReader.isCurrent(scope); }
async function load() {
  const scope = fence();
  const requestedCourseId = courseId.value;
  loading.value = true;
  error.value = "";
  course.value = null;
  result.value = null;
  if (!remoteApiEnabled || !requestedCourseId) {
    if (!current(scope)) return;
    loading.value = false;
    error.value = "courseOffline";
    return;
  }
  try {
    const loaded = await learningApi.course(requestedCourseId, language.value);
    if (!current(scope)) return;
    course.value = loaded;
    answers.value = Array(loaded.questions.length).fill(-1);
    await learningApi.start(loaded.id, language.value, loaded.version);
    if (!current(scope)) return;
  } catch {
    if (current(scope)) error.value = "courseUnavailable";
  } finally {
    if (current(scope)) loading.value = false;
  }
}
// 🔴 只回读、不伪造:判卷结果(score/passed/attempts)在当前契约下**没有任何接口能取回**
// (LearningCourse 里根本没有这几个字段),原写法在「本次结果未知」这条分支上硬填
// score:100 / passed:true / attempts:0,等于向用户断言「你通过了」——而且 attempts:0
// 连服务端校验器 learning-api.ts 的 min=1 都过不去,是个服务端永远不会返回的值。
// 现在只采信服务端真给的那一位:course.completed;通过与否交给下一次真判卷。
async function recoverAuthoritative(scope: LearningPageFence, expectedCourse: LearningCourse): Promise<boolean> {
  const fresh = await learningApi.course(expectedCourse.id, language.value);
  if (!current(scope)) return false;
  course.value = fresh;
  return fresh.completed;
}
// 🔴 幂等键按**一次提交动作**生成,不按课程版本 —— 键只含 courseId+version 时,
// 它跨「重新作答」恒定不变:第一次误交的空卷会被服务端按幂等契约永久重放,
// 用户之后怎么答都拿不到成绩和奖励(独立审计判为 P0)。同仓写法见
// wallet-exchange.vue:419 `G2-SWAP-…-${Date.now().toString(36)}`。
// 键在**进入 try 之前**取一次,catch 里的那次重放才是「同一动作的重试」而非新单。
// expectedVersion = 本次作答所依据的课程版本(course/start 回来的那份),服务端据它拒收过期卷。
// ⚠️ complete 的第 2 参是**版本不是幂等键**(新契约里 complete 根本没有幂等键),别再塞 quizKey —— 两个都是 string,tsc 抓不到。
async function finish() {
  if (!course.value || loading.value || !canSubmit.value) return;
  const scope = fence();
  const submittedCourse = course.value;
  const submittedAnswers = [...answers.value];
  loading.value = true;
  error.value = "";
  quizKey.value = `learning-quiz:${submittedCourse.id}:${submittedCourse.version}:${Date.now().toString(36)}`;
  try {
    const submitted = submittedCourse.questions.length
      ? await learningApi.submitQuiz(submittedCourse.id, submittedCourse.version, submittedAnswers, quizKey.value)
      : await learningApi.complete(submittedCourse.id, submittedCourse.version);
    if (current(scope)) result.value = submitted;
  } catch {
    if (!current(scope)) return;
    try {
      if (submittedCourse.questions.length) {
        const replay = await learningApi.submitQuiz(submittedCourse.id, submittedCourse.version, submittedAnswers, quizKey.value);
        if (current(scope)) result.value = replay;
        return;
      }
      if (await recoverAuthoritative(scope, submittedCourse)) return;
    } catch {
      try {
        if (await recoverAuthoritative(scope, submittedCourse)) return;
      } catch { /* stale or unavailable; the guarded error below is the only visible outcome */ }
    }
    if (current(scope)) error.value = "submitUnconfirmed";
  } finally {
    if (current(scope)) loading.value = false;
  }
}
onLoad((options) => { courseId.value = typeof options?.id === "string" ? options.id : ""; });
onMounted(() => { mounted = true; void load(); });
onUnmounted(() => { mounted = false; generation += 1; });
watch(() => String(app.accountKey), () => {
  accountEpoch += 1;
  generation += 1;
  course.value = null;
  result.value = null;
  answers.value = [];
  error.value = "";
  if (mounted) void load();
});
</script>
