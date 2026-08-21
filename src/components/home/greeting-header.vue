<!--
  GreetingHeader — ZONE 1 top-of-home greeting (ported from mission-control.tsx
  GreetingHeader). Time-of-day greeting line only ("早上好, Alex").
-->
<template>
  <view class="px-1">
    <text class="block" style="font-family: var(--font-v5); font-size: 20px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.15; color: var(--v5-ink)">{{ greetingLine }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useT } from "@/i18n/use-t";
import { useProfile } from "@/store/profile";
import { homeGreetingName } from "./home-greeting";

const t = useT();
const profile = useProfile();

// Time-of-day greeting depends on the client's local hour → compute on mount
// (SPA, no SSR hydration concern; mirrors the source's mount-effect).
const greeting = ref("");
onMounted(() => {
  const h = new Date().getHours();
  greeting.value =
    h < 5
      ? t.value.home.greetingLateNight
      : h < 12
        ? t.value.home.greetingMorning
        : h < 18
          ? t.value.home.greetingAfternoon
          : t.value.home.greetingEvening;
});

// 登录响应 /api/app/profile 投影的是服务端完整昵称；首页不得擅自按空格截断。
const nickname = computed(() => homeGreetingName(profile.displayName, "NexGrid"));
const greetingLine = computed(() => `${greeting.value}, ${nickname.value}`);
</script>
