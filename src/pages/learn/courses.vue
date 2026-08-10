<template>
  <AppChassis active="me"><view class="px-4" style="padding-bottom:24px"><SubPageHeader back="/pages/me/me" />
    <view v-if="loading">正在加载教程中心…</view>
    <view v-else-if="error"><text>{{ error }}</text><text class="block" style="margin-top:12px;color:var(--v5-brand)" @click="load">重试</text></view>
    <view v-else><text class="block" style="font-size:20px;font-weight:600">教程中心</text><text class="block" style="margin:8px 0;color:var(--v5-ink-3)">已完成 {{ overview?.completedCourses }}/{{ overview?.totalCourses }} · 已获 {{ overview?.earnedNex }} NEX</text>
      <view v-for="course in overview?.courses" :key="course.id" style="margin-top:10px;padding:14px;border-radius:12px;background:var(--v5-surface)" @click="open(course.id)"><text class="block" style="font-weight:600">{{ course.title }}</text><text class="block" style="margin-top:5px;color:var(--v5-ink-3)">{{ course.duration }} · 奖励 {{ course.rewardNex }} NEX</text></view>
    </view>
  </view></AppChassis>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { learningApi } from "@/api/learning-runtime";
import { remoteApiEnabled } from "@/api/runtime";
import { useLocaleStore } from "@/store/locale";
import type { LearningOverview } from "@/api/learning-api";
const locale = useLocaleStore(); const overview = ref<LearningOverview | null>(null); const loading = ref(true); const error = ref("");
const language = computed(() => ["zh", "vi", "en"].includes(locale.code) ? locale.code : "zh");
async function load() { loading.value = true; overview.value = null; error.value = ""; if (!remoteApiEnabled) { loading.value = false; error.value = "教程中心需要连接受信任网络；请连接后重试。"; return; } try { overview.value = await learningApi.courses(language.value); } catch (cause) { error.value = cause instanceof Error && cause.message.includes("GEO_COUNTRY_UNRESOLVED") ? "暂时无法确认您所在地区的适用范围；教程内容不会显示旧缓存，请检查网络后重试。" : "教程中心暂不可用；请稍后重试。"; } finally { loading.value = false; } }
function open(id: string) { uni.navigateTo({ url: `/pages/learn/course?id=${encodeURIComponent(id)}` }); }
onMounted(() => { void load(); });
</script>
