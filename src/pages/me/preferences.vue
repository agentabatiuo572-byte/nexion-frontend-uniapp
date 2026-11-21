<!--
  Preferences (ported from Nexion-prototype/app/(main)/me/preferences/page.tsx).
  Two toggle blocks: interface sound, and per-kind notification mute filters.
  State persists via the preferences store. Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view class="message-family" style="padding-bottom: 24px">
      <SubPageHeader back="/pages/me/me" plain />
      <!-- Sound -->
      <view class="mx-4">
        <text class="block" :style="headingStyle">{{ w.feedbackHeading }}</text>
        <view class="nx-glass-card" :style="cardStyle">
          <ToggleRow :label="w.soundLabel" :hint="w.soundHint" :value="prefs.soundEnabled" last @toggle="prefs.toggleSound">
            <template #icon>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" /><path d="M16 9a5 5 0 0 1 0 6" /><path d="M19.364 18.364a9 9 0 0 0 0-12.728" /></svg>
            </template>
          </ToggleRow>
        </view>
      </view>

      <!-- Notification kinds -->
      <view class="mx-4" style="margin-top: 20px">
        <text class="block" :style="headingStyle">{{ w.notifHeading }}</text>
        <text v-if="!prefs.remoteReady" class="block" role="status" aria-live="polite">{{ prefs.readFailedWithoutData ? w.notifUnavailable : w.loading }}</text>
        <view class="nx-glass-card" :style="cardStyle">
          <ToggleRow
            v-for="(k, i) in notifKinds"
            :key="k"
            :label="w.notifKinds[k]"
            :value="prefs.remoteReady ? prefs.notifPrefs[k] : null"
            :unknown-label="t.uiChrome.unavailable"
            :last="i === notifKinds.length - 1"
            @toggle="saveNotificationPreference(k)"
          >
            <template #icon>
              <view :style="dotStyle(k)" />
            </template>
          </ToggleRow>
        </view>
        <text class="block mx-1" :style="footerStyle">{{ w.notifFooter }}</text>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, onUnmounted, type CSSProperties } from "vue";
import { onHide, onShow } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import ToggleRow from "@/components/me/preference-toggle-row.vue";
import { useT } from "@/i18n/use-t";
import { remoteApiEnabled } from "@/api/runtime";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { remoteAccountScope } from "@/lib/remote-account-epoch";
import { registerActivePageRefresh } from "@/lib/active-page-refresh";
import { isMandatoryNotifKind, usePreferences, type NotifKind } from "@/store/preferences";
import { toast } from "@/store/ui";

const t = useT();
const w = computed(() => t.value.preferences);
const prefs = usePreferences();
useAutoRecovery({
  failed: () => remoteApiEnabled && !!prefs.readError,
  retry: () => prefs.refreshRemote(),
});
function refreshHealthyPreferences() {
  if (remoteApiEnabled && !prefs.readError && !prefs.loading) return prefs.refreshRemote();
}
let pageVisit = 0;
let pageVisible = false;
let releaseActiveRefresh = () => {};
onShow(() => {
  pageVisible = true;
  releaseActiveRefresh();
  releaseActiveRefresh = registerActivePageRefresh(refreshHealthyPreferences, "pages/me/preferences");
  void refreshHealthyPreferences();
});
function leavePreferences() {
  pageVisible = false;
  pageVisit++;
  releaseActiveRefresh();
}
onHide(leavePreferences);
onUnmounted(leavePreferences);

async function saveNotificationPreference(kind: NotifKind) {
  if (!pageVisible || !prefs.remoteReady) return;
  const visit = pageVisit;
  const account = remoteAccountScope.snapshot();
  const result = await prefs.toggleNotifKind(kind);
  if (result === "failed" && pageVisible && visit === pageVisit && remoteAccountScope.isCurrent(account)) {
    toast.error(t.value.preferences.updateFailed);
  }
}

// Mandatory kinds cannot be switched off, so they are not listed.
const notifKinds = (["commission", "team", "market", "genesis", "system"] as NotifKind[]).filter(k => !isMandatoryNotifKind(k));
const NOTIF_COLOR: Record<NotifKind, string> = {
  commission: "var(--v5-brand)",
  team: "var(--v5-tech-cyan)",
  staking: "var(--v5-brand)",
  market: "var(--v5-warning)",
  genesis: "var(--v5-brand-2)",
  system: "var(--v5-tech-cyan)",
};

function dotStyle(k: NotifKind): CSSProperties {
  return { width: "8px", height: "8px", borderRadius: "999px", background: NOTIF_COLOR[k] };
}

// Section label (de-card spec): 15/600/ink, sentence-case, sits above the group.
const headingStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "var(--ui-type-section)",
  fontWeight: 600,
  letterSpacing: "-0.012em",
  color: "var(--v5-ink)",
  marginBottom: "12px",
  paddingLeft: "2px",
};
// Settings group (form b): single surface container, no border — the toggle rows
// carry their own internal hairline dividers (PreferenceToggleRow `last` prop).
const cardStyle: CSSProperties = { boxShadow: "var(--nx-glass-edge)",
  borderRadius: "var(--nx-glass-radius)",
  background: "var(--nx-glass-fill)",
  overflow: "hidden",
};
const footerStyle: CSSProperties = {
  marginTop: "8px",
  fontSize: "12px",
  color: "var(--v5-ink-4)",
  lineHeight: 1.625,
};


</script>

<style src="@/styles/message-family.css"></style>

<style scoped>
</style>
