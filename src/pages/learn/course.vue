<template>
  <AppChassis active="me"><view class="px-4" style="padding-bottom:24px"><SubPageHeader back="/pages/learn/courses" />
    <view v-if="loading">正在加载课程…</view><view v-else-if="error"><text>{{ error }}</text><text class="block" style="margin-top:12px;color:var(--v5-brand)" @click="load">重试</text></view>
    <view v-else-if="course"><text class="block" style="font-size:20px;font-weight:600">{{ course.title }}</text><text class="block" style="margin-top:10px;color:var(--v5-ink-2)">{{ course.body }}</text><text class="block" style="margin-top:8px;color:var(--v5-ink-3)">版本 {{ course.version }} · 奖励 {{ course.rewardNex }} NEX</text>
      <view v-for="(question, index) in course.questions" :key="question.questionId" style="margin-top:16px"><text>{{ question.question }}</text><view v-for="(option, optionIndex) in question.options" :key="option" style="margin-top:8px" @click="answers[index] = optionIndex"><text>{{ answers[index] === optionIndex ? '●' : '○' }} {{ option }}</text></view></view>
      <text class="block" style="margin-top:20px;color:var(--v5-brand)" @click="finish">{{ course.questions.length ? '提交测验' : '完成课程' }}</text><text v-if="result" class="block" style="margin-top:12px">{{ result.passed ? '已完成' : '未通过' }}<template v-if="result.rewardGranted"> · 已发放 {{ result.rewardNex }} NEX</template></text>
    </view>
  </view></AppChassis>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { learningApi } from "@/api/learning-runtime";
import { remoteApiEnabled } from "@/api/runtime";
import { useLocaleStore } from "@/store/locale";
import type { LearningCourse, LearningResult } from "@/api/learning-api";
const locale = useLocaleStore(); const courseId = ref(""); const course = ref<LearningCourse | null>(null); const result = ref<LearningResult | null>(null); const answers = ref<number[]>([]); const loading = ref(true); const error = ref(""); const quizKey = ref("");
const language = computed(() => ["zh", "vi", "en"].includes(locale.code) ? locale.code : "zh");
async function load() { loading.value = true; error.value = ""; course.value = null; if (!remoteApiEnabled || !courseId.value) { loading.value = false; error.value = "课程需要在受信任网络中获取；请返回教程中心后重试。"; return; } try { course.value = await learningApi.course(courseId.value, language.value); answers.value = Array(course.value.questions.length).fill(-1); quizKey.value = `learning-quiz:${course.value.id}:${course.value.version}`; await learningApi.start(course.value.id, language.value); } catch { error.value = "课程暂不可用；请重试。"; } finally { loading.value = false; } }
async function recoverAuthoritative() { if (!course.value) return false; const fresh = await learningApi.course(course.value.id, language.value); course.value = fresh; if (!fresh.completed) return false; result.value = { courseId: fresh.id, version: fresh.version, score: 100, passed: true, completed: true, rewardGranted: false, rewardNex: fresh.rewardNex, attempts: 0 }; return true; }
async function finish() { if (!course.value || loading.value) return; loading.value = true; error.value = ""; try { result.value = course.value.questions.length ? await learningApi.submitQuiz(course.value.id, answers.value, quizKey.value) : await learningApi.complete(course.value.id); } catch { try { if (course.value.questions.length) { result.value = await learningApi.submitQuiz(course.value.id, answers.value, quizKey.value); return; } if (await recoverAuthoritative()) return; } catch { try { if (await recoverAuthoritative()) return; } catch {} } error.value = "提交结果尚未确认；已重新读取课程进度，奖励不会按本地状态显示。"; } finally { loading.value = false; } }
onLoad((options) => { courseId.value = typeof options?.id === "string" ? options.id : ""; void load(); });
</script>
