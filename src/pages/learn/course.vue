<template>
  <AppChassis active="me">
    <view class="px-4" style="padding-bottom: 24px">
      <SubPageHeader back="/pages/learn/courses" />
      <view v-if="loading"><text>{{ t.learning.courseLoading }}</text></view>
      <view v-else-if="error" role="alert" aria-live="assertive">
        <text class="block" style="text-wrap: pretty">{{ errorText }}</text>
        <text class="block active:opacity-70" style="margin-top: 12px; color: var(--v5-brand)" role="button" tabindex="0" :aria-label="t.learning.courseUnavailable" @click="load" @keydown.enter.prevent="onKeyboardActivate($event, load)" @keydown.space.prevent="onKeyboardActivate($event, load)">{{ t.ui.retry }}</text>
      </view>
      <view v-else-if="course">
        <text class="block" style="font-size: 20px; font-weight: 600">{{ course.title }}</text>
        <text class="block" style="margin-top: 10px; color: var(--v5-ink-2); text-wrap: pretty">{{ course.body }}</text>
        <text class="block" style="margin-top: 8px; color: var(--v5-ink-3)">{{ versionLine }}</text>

        <view v-for="(question, index) in course.questions" :key="question.questionId" style="margin-top: 16px">
          <text>{{ question.question }}</text>
          <view v-for="(option, optionIndex) in question.options" :key="option" :class="pendingAttempt ? '' : 'active:opacity-70'" style="margin-top: 8px" role="button" :tabindex="pendingAttempt ? -1 : 0" :aria-label="option" :aria-pressed="answers[index] === optionIndex" :aria-disabled="!!pendingAttempt" @click="selectAnswer(index, optionIndex)" @keydown.enter.prevent="onKeyboardActivate($event, () => selectAnswer(index, optionIndex))" @keydown.space.prevent="onKeyboardActivate($event, () => selectAnswer(index, optionIndex))">
            <text>{{ answers[index] === optionIndex ? "●" : "○" }} {{ option }}</text>
          </view>
        </view>

        <text
          class="block"
          :class="canSubmit ? 'active:opacity-70' : ''"
          :style="{ marginTop: '20px', color: canSubmit ? 'var(--v5-brand)' : 'var(--v5-ink-4)' }"
          role="button"
          :tabindex="canSubmit ? 0 : -1"
          :aria-label="course.questions.length ? t.learning.submitQuiz : t.learning.completeCourse"
          :aria-disabled="canSubmit ? 'false' : 'true'"
          @click="finish"
          @keydown.enter.prevent="onKeyboardActivate($event, finish)"
          @keydown.space.prevent="onKeyboardActivate($event, finish)"
        >{{ course.questions.length ? t.learning.submitQuiz : t.learning.completeCourse }}</text>
        <text v-if="course.questions.length && !pendingAttempt && !allAnswered && !serverCompleted" class="block" style="margin-top: 6px; font-size: 12px; color: var(--v5-ink-3)">{{ t.learning.answerAllFirst }}</text>
        <text v-if="pendingAttempt" class="block active:opacity-70" style="margin-top: 6px; font-size: 12px; color: var(--v5-ink-3); text-wrap: pretty" role="button" tabindex="0" :aria-label="pendingStatusText" @click="load" @keydown.enter.prevent="onKeyboardActivate($event, load)" @keydown.space.prevent="onKeyboardActivate($event, load)">{{ pendingStatusText }}</text>
        <text v-if="resultDetails" data-testid="learning-result-details" class="block tabular-nums" style="margin-top: 12px; color: var(--v5-ink-2); text-wrap: pretty">{{ resultDetails.passed ? t.learning.resultPassed : t.learning.resultFailed }} · {{ scoreLine }} · {{ attemptsLine }} · {{ rewardStatusLine }}</text>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import {
  currentPendingLearningAttempt,
  finishPendingLearningAttempt,
  pendingLearningAttempt,
  type LearningAttemptIdentity,
  type LearningPendingAttempt,
} from "@/api/learning-attempt-key";
import { learningApi } from "@/api/learning-runtime";
import { remoteApiEnabled } from "@/api/runtime";
import { captureRuntimeRevision } from "@/api/order-api";
import type { LearningCourse, LearningQuizReceiptStatus, LearningResult } from "@/api/learning-api";
import { ApiError } from "@/api/errors";
import { fmt } from "@/i18n/format";
import { useT } from "@/i18n/use-t";
import { useLocaleStore } from "@/store/locale";
import { useApp } from "@/store/app";
import { createLearningPageFenceReader, type LearningPageFence } from "./learning-page-fence";
import { learningAttemptRecoveryAction, learningResultDetails, matchingCourseResult, matchingReceiptResult, validAnswersForCourse } from "./learning-result-details";

// 存 key 不存译文：译好的串快照进 ref 后不再跟随语言（见 courses.vue 同处注释）。
type CourseError = "" | "courseOffline" | "courseUnavailable" | "courseUpdated" | "submitUnconfirmed";

const t = useT();
const locale = useLocaleStore();
const app = useApp();
const courseId = ref("");
const course = ref<LearningCourse | null>(null);
const result = ref<LearningResult | null>(null);
const answers = ref<number[]>([]);
const pendingAttempt = ref<LearningPendingAttempt | null>(null);
const pendingReceiptStatus = ref<LearningQuizReceiptStatus | null>(null);
const loading = ref(true);
const error = ref<CourseError>("");

const errorText = computed(() => error.value ? t.value.learning[error.value] : "");
const allAnswered = computed(() => !!course.value
  && answers.value.length === course.value.questions.length
  && answers.value.every((answer) => answer >= 0));
const resultDetails = computed(() => learningResultDetails(course.value, result.value));
const serverCompleted = computed(() => !!course.value?.completed || !!result.value?.completed);
const pendingAnswersValid = computed(() => !!course.value
  && !!pendingAttempt.value
  && validAnswersForCourse(course.value, pendingAttempt.value.answers));
// 失败结果允许重新作答；已通过的服务端结果才禁止重复提交。
const canSubmit = computed(() => !!course.value
  && !loading.value
  && !serverCompleted.value
  && (!course.value.questions.length || (pendingAttempt.value
    ? pendingAnswersValid.value && ["ABSENT", "FAILED"].includes(String(pendingReceiptStatus.value))
    : allAnswered.value)));
const language = computed(() => ["zh", "vi", "en"].includes(locale.code) ? locale.code : "zh");
const versionLine = computed(() => course.value
  ? fmt(t.value.learning.courseVersionMeta, { version: course.value.version, nex: course.value.rewardNex })
  : "");
const scoreLine = computed(() => resultDetails.value
  ? fmt(t.value.learning.resultScore, { score: resultDetails.value.score })
  : "");
const attemptsLine = computed(() => resultDetails.value
  ? fmt(t.value.learning.resultAttempts, { attempts: resultDetails.value.attempts })
  : "");
const rewardStatusLine = computed(() => {
  const details = resultDetails.value;
  if (!details) return "";
  if (details.rewardGranted) return fmt(t.value.learning.rewardGranted, { nex: details.rewardNex });
  return Number(details.rewardNex) > 0 ? t.value.learning.rewardNotGranted : t.value.learning.rewardNone;
});
const pendingStatusText = computed(() => pendingReceiptStatus.value === "UNKNOWN"
  ? t.value.learning.submissionResultUnknown
  : t.value.learning.pendingSubmission);

let accountEpoch = 0;
let generation = 0;
let mounted = false;
const fenceReader = createLearningPageFenceReader(
  () => String(app.accountKey),
  () => accountEpoch,
  captureRuntimeRevision,
  () => generation,
  () => mounted,
);

function fence(): LearningPageFence { return fenceReader.capture(); }
function current(scope: LearningPageFence): boolean { return fenceReader.isCurrent(scope); }
function onKeyboardActivate(event: KeyboardEvent, action: () => void) { if (!event.repeat) action(); }
function attemptIdentity(expectedCourse: LearningCourse): LearningAttemptIdentity | null {
  const accountKey = String(app.accountKey).trim();
  if (!accountKey) return null;
  return { accountKey, courseId: expectedCourse.id, version: expectedCourse.version };
}
function selectAnswer(questionIndex: number, optionIndex: number) {
  if (loading.value || pendingAttempt.value) return;
  answers.value[questionIndex] = optionIndex;
}
function isCourseVersionConflict(cause: unknown): boolean {
  return cause instanceof ApiError && cause.message === "LEARNING_COURSE_VERSION_CONFLICT";
}
function retireAttempt(identity: LearningAttemptIdentity | null, attemptKey: string) {
  if (identity) finishPendingLearningAttempt(identity, attemptKey);
  pendingAttempt.value = null;
  pendingReceiptStatus.value = null;
}

async function recoverPendingReceipt(scope: LearningPageFence, expectedCourse: LearningCourse): Promise<boolean> {
  const identity = attemptIdentity(expectedCourse);
  if (!identity) return false;
  const pending = currentPendingLearningAttempt(identity);
  if (!pending) return false;
  pendingAttempt.value = pending;
  if (validAnswersForCourse(expectedCourse, pending.answers)) answers.value = [...pending.answers!];
  try {
    const receipt = await learningApi.quizReceipt(expectedCourse.id, expectedCourse.version, pending.key);
    if (!current(scope)) return false;
    pendingReceiptStatus.value = receipt.status;
    const action = learningAttemptRecoveryAction(pending, receipt.status);
    const recovered = matchingReceiptResult(expectedCourse, receipt);
    if (action === "RESTORE") {
      if (!recovered) {
        pendingReceiptStatus.value = "UNKNOWN";
        return false;
      }
      result.value = recovered;
      retireAttempt(identity, pending.key);
      return true;
    }
    if (action === "RETIRE" || (action === "REPLAY" && !validAnswersForCourse(expectedCourse, pending.answers))) {
      retireAttempt(identity, pending.key);
    }
    return false;
  } catch {
    // Older backend versions cannot distinguish an absent receipt from an
    // in-flight request. Hold the original key until a later refresh resolves it.
    pendingReceiptStatus.value = "UNKNOWN";
    return false;
  }
}

async function load() {
  const scope = fence();
  const requestedCourseId = courseId.value;
  loading.value = true;
  error.value = "";
  course.value = null;
  result.value = null;
  pendingAttempt.value = null;
  pendingReceiptStatus.value = null;
  if (!remoteApiEnabled || !requestedCourseId) {
    if (!current(scope)) return;
    loading.value = false;
    error.value = "courseOffline";
    return;
  }
  try {
    const loaded = await learningApi.course(requestedCourseId, language.value);
    if (!current(scope)) return;
    const started = await learningApi.start(loaded.id, language.value, loaded.version);
    if (!current(scope)) return;
    course.value = started;
    answers.value = Array(started.questions.length).fill(-1);
    await recoverPendingReceipt(scope, started);
  } catch {
    if (current(scope)) error.value = "courseUnavailable";
  } finally {
    if (current(scope)) loading.value = false;
  }
}

// 回读服务端课程快照。completed、lastScore、attempts、rewardGranted 都是当前
// API 契约中的权威字段；不再把刷新后的结果降级成笼统的“已完成”。
async function recoverAuthoritative(scope: LearningPageFence, expectedCourse: LearningCourse): Promise<boolean> {
  const fresh = await learningApi.course(expectedCourse.id, language.value);
  if (!current(scope)) return false;
  course.value = fresh;
  return fresh.completed || fresh.attempts > expectedCourse.attempts;
}

function acceptResult(
  scope: LearningPageFence,
  expectedCourse: LearningCourse,
  identity: LearningAttemptIdentity | null,
  attemptKey: string,
  submitted: LearningResult,
): boolean {
  if (!current(scope)) return false;
  const accepted = matchingCourseResult(expectedCourse, submitted);
  if (!accepted) return false;
  result.value = accepted;
  retireAttempt(identity, attemptKey);
  return true;
}

async function finish() {
  if (!course.value || loading.value || !canSubmit.value) return;
  const scope = fence();
  const submittedCourse = course.value;
  let submittedAnswers = [...answers.value];
  const identity = attemptIdentity(submittedCourse);
  let attemptKey = `learning-quiz:${submittedCourse.id}:${submittedCourse.version}:${Date.now().toString(36)}`;
  if (submittedCourse.questions.length && identity) {
    const pending = pendingAttempt.value ?? pendingLearningAttempt(identity, submittedAnswers);
    if (!pending.answers) {
      pendingReceiptStatus.value = "UNKNOWN";
      return;
    }
    pendingAttempt.value = pending;
    pendingReceiptStatus.value = pendingReceiptStatus.value ?? "ABSENT";
    attemptKey = pending.key;
    submittedAnswers = [...pending.answers];
  }
  loading.value = true;
  error.value = "";
  try {
    const submitted = submittedCourse.questions.length
      ? await learningApi.submitQuiz(submittedCourse.id, submittedCourse.version, submittedAnswers, attemptKey)
      : await learningApi.complete(submittedCourse.id, submittedCourse.version);
    if (!acceptResult(scope, submittedCourse, identity, attemptKey, submitted)) throw new Error("LEARNING_RESULT_SCOPE_MISMATCH");
  } catch (cause) {
    if (!current(scope)) return;
    if (isCourseVersionConflict(cause)) {
      retireAttempt(identity, attemptKey);
      error.value = "courseUpdated";
      return;
    }
    if (submittedCourse.questions.length) {
      try {
        const receipt = await learningApi.quizReceipt(submittedCourse.id, submittedCourse.version, attemptKey);
        if (!current(scope)) return;
        pendingReceiptStatus.value = receipt.status;
        const recovered = matchingReceiptResult(submittedCourse, receipt);
        if (recovered && acceptResult(scope, submittedCourse, identity, attemptKey, recovered)) return;
        const action = learningAttemptRecoveryAction(
          pendingAttempt.value ?? { key: attemptKey, answers: submittedAnswers },
          receipt.status,
        );
        if (action === "HOLD" || action === "RESTORE") return;
        if (action === "RETIRE") {
          retireAttempt(identity, attemptKey);
          return;
        }

        // ABSENT/FAILED proves there is no committed in-flight result. Replaying
        // the immutable body with the same key cannot create a second attempt.
        const replay = await learningApi.submitQuiz(submittedCourse.id, submittedCourse.version, submittedAnswers, attemptKey);
        if (acceptResult(scope, submittedCourse, identity, attemptKey, replay)) return;
        throw new Error("LEARNING_RESULT_SCOPE_MISMATCH");
      } catch (recoveryCause) {
        if (isCourseVersionConflict(recoveryCause)) {
          retireAttempt(identity, attemptKey);
          error.value = "courseUpdated";
          return;
        }
        try {
          if (await recoverAuthoritative(scope, submittedCourse)) {
            retireAttempt(identity, attemptKey);
            return;
          }
        } catch { /* Preserve the unresolved attempt below. */ }
        pendingReceiptStatus.value = "UNKNOWN";
        return;
      }
    }
    try {
      if (await recoverAuthoritative(scope, submittedCourse)) return;
    } catch {
      if (current(scope)) error.value = "submitUnconfirmed";
    }
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
  pendingAttempt.value = null;
  pendingReceiptStatus.value = null;
  error.value = "";
  if (mounted) void load();
});
</script>
