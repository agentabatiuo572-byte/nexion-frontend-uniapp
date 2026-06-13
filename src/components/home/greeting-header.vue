<!--
  GreetingHeader — ZONE 1 top-of-home greeting (ported from mission-control.tsx
  GreetingHeader). Time-of-day greeting + "Your node earned $X.XX today." with
  the dollar value in success green.
-->
<template>
  <view class="px-1 pt-1 pb-1">
    <text class="block text-[13.5px]" style="color: var(--v5-ink-3); margin-bottom: 4px">{{ greetingLine }}</text>
    <view
      class="font-display tracking-tight leading-tight"
      style="font-size: 26px; font-weight: 600; letter-spacing: -0.022em; color: var(--v5-ink)"
    >
      <text>{{ before }}</text><text style="color: var(--v5-success)">${{ phoneToday.toFixed(2) }}</text><text>{{ after }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { selectPhoneDevice } from "@/store/device-types";
import { useProfile } from "@/store/profile";

const t = useT();
const app = useApp();
const profile = useProfile();

const phone = computed(() => selectPhoneDevice(app.devices));
const phoneToday = computed(() => phone.value?.todayEarnings ?? 0.06);

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

const firstName = computed(() => (profile.displayName || "Stellar").split(" ")[0]);
const greetingLine = computed(() => `${greeting.value}, ${firstName.value}`);

// i18n template "Your node earned {amount} today." — split around {amount} so
// the dollar value can be wrapped in a brand-success span.
const before = computed(() => {
  const tpl = t.value.home.nodeEarnedToday;
  const idx = tpl.indexOf("{amount}");
  return idx >= 0 ? tpl.slice(0, idx) : tpl;
});
const after = computed(() => {
  const tpl = t.value.home.nodeEarnedToday;
  const idx = tpl.indexOf("{amount}");
  return idx >= 0 ? tpl.slice(idx + 8) : "";
});
</script>
