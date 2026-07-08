<!--
  Preferences (ported from Nexion-prototype/app/(main)/me/preferences/page.tsx).
  Toggle blocks: theme, sound + haptics, and per-kind notification mute filters.
  State persists via the preferences store. Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="padding-bottom: 24px">
      <SubPageHeader back="/pages/me/me" />

      <!-- Appearance -->
      <view class="mx-4" style="margin-top: 8px">
        <text class="block" :style="headingStyle">{{ w.appearanceHeading }}</text>
        <view :style="cardStyle">
          <ThemeRow last />
        </view>
      </view>

      <!-- Sound + haptics -->
      <view class="mx-4" style="margin-top: 20px">
        <text class="block" :style="headingStyle">{{ w.feedbackHeading }}</text>
        <view :style="cardStyle">
          <ToggleRow :label="w.soundLabel" :hint="w.soundHint" :value="prefs.soundEnabled" @toggle="prefs.toggleSound" />
          <ToggleRow :label="w.hapticsLabel" :hint="w.hapticsHint" :value="prefs.hapticsEnabled" last @toggle="prefs.toggleHaptics" />
        </view>
      </view>

      <!-- Notification kinds -->
      <view class="mx-4" style="margin-top: 20px">
        <text class="block" :style="headingStyle">{{ w.notifHeading }}</text>
        <view :style="cardStyle">
          <ToggleRow
            v-for="(k, i) in notifKinds"
            :key="k"
            :label="w.notifKinds[k]"
            :value="prefs.notifPrefs[k]"
            :last="i === notifKinds.length - 1"
            @toggle="prefs.toggleNotifKind(k)"
          />
        </view>
        <text class="block mx-1" :style="footerStyle">{{ w.notifFooter }}</text>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import ThemeRow from "@/components/me/theme-row.vue";
import ToggleRow from "@/components/me/preference-toggle-row.vue";
import { useT } from "@/i18n/use-t";
import { usePreferences, type NotifKind } from "@/store/preferences";

const t = useT();
const w = computed(() => t.value.preferences);
const prefs = usePreferences();

const notifKinds: NotifKind[] = ["commission", "team", "staking", "market", "genesis", "system"];

const headingStyle: CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.14em",
  color: "var(--v5-ink-3)",
  marginBottom: "8px",
  paddingLeft: "4px",
};
const cardStyle: CSSProperties = {
  borderRadius: "16px",
  background: "var(--v5-surface-bg)",
  border: "1px solid var(--v5-border)",
  overflow: "hidden",
};
const footerStyle: CSSProperties = {
  marginTop: "8px",
  fontSize: "11px",
  color: "var(--v5-ink-4)",
  lineHeight: 1.625,
};
</script>
