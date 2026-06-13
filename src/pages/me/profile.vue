<!--
  Profile — ported from Nexion-prototype/app/(main)/me/profile/page.tsx.
  Edit display name / bio / region / timezone (profile store) + avatar reroll,
  tier progress bar, wallet-binding link, save bar (disabled until dirty).

  Wrapped in <AppChassis active="me">; SubPageHeader (back chevron) scrolls
  with content. The source MechAvatar is replaced with the initial-letter
  avatar used elsewhere in this me domain (profile-row.vue) — uni has no SVG
  avatar generator and the letter avatar is the established convention here.
  <select> → uni <picker mode="selector"> (cross-end). The first-day quest
  (markComplete) is omitted — no quest store is ported in this batch.
-->
<template>
  <AppChassis active="me">
    <view class="pb-6" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/me" :title="t.profile.title" />

      <!-- Avatar + email -->
      <view class="mx-4" :style="avatarCardStyle">
        <view class="flex items-center" style="gap: 16px">
          <view class="relative">
            <view class="grid place-items-center" :style="avatarStyle">
              <text :style="avatarTextStyle">{{ initial }}</text>
            </view>
            <view class="grid place-items-center active:opacity-80" :style="regenBtnStyle" @click="handleRegen">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>
            </view>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block truncate" :style="nameStyle">{{ displayName }}</text>
            <text class="block truncate" :style="emailStyle">{{ email }}</text>
            <view class="flex items-center" style="gap: 6px; margin-top: 2px">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              <text :style="joinedStyle">{{ t.profile.joinedOn }} {{ joinedDate }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- Editable fields -->
      <view class="mx-4 overflow-hidden" :style="fieldsCardStyle">
        <text class="block" :style="sectionCapStyle">{{ t.profile.sectionPublic }}</text>

        <view :style="fieldBlockStyle">
          <view class="flex items-center" style="gap: 6px; margin-top: 10px">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            <text :style="fieldLabelStyle">{{ t.profile.displayName }}</text>
          </view>
          <input class="w-full" :style="inputStyle" type="text" :value="name" :placeholder="t.profile.namePlaceholder" maxlength="32" @input="onName" />
          <text class="block" :style="fieldHintStyle">{{ t.profile.displayNameHint }}</text>
        </view>

        <view :style="fieldBlockStyle">
          <text class="block" :style="[fieldLabelStyle, { marginTop: '10px' }]">{{ t.profile.bio }}</text>
          <textarea class="w-full" :style="textareaStyle" :value="bio" :placeholder="t.profile.bioPlaceholder" :maxlength="140" auto-height @input="onBio" />
          <view class="flex justify-between" style="margin-top: 4px">
            <text :style="fieldHintStyle">{{ t.profile.bioHint }}</text>
            <text class="font-mono-tabular" :style="fieldHintStyle">{{ bio.length }}/140</text>
          </view>
        </view>

        <view class="grid" :style="[fieldBlockStyle, { gridTemplateColumns: '1fr 1fr', gap: '12px' }]">
          <view>
            <view class="flex items-center" style="gap: 6px; margin-top: 10px">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
              <text :style="fieldLabelStyle">{{ t.profile.region }}</text>
            </view>
            <picker mode="selector" :range="REGIONS" :value="regionIdx" @change="onRegion">
              <text class="block" :style="pickerStyle">{{ region }}</text>
            </picker>
          </view>
          <view>
            <view class="flex items-center" style="gap: 6px; margin-top: 10px">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              <text :style="fieldLabelStyle">{{ t.profile.timezone }}</text>
            </view>
            <picker mode="selector" :range="TIMEZONES" :value="timezoneIdx" @change="onTimezone">
              <text class="block truncate" :style="pickerStyle">{{ timezone }}</text>
            </picker>
          </view>
        </view>
      </view>

      <!-- Tier -->
      <view class="mx-4" :style="tierCardStyle">
        <view class="flex items-center justify-between" style="margin-bottom: 8px">
          <text :style="tierCapStyle">{{ t.profile.tierTitle }}</text>
          <text :style="tierLabelStyle">{{ tierLabel }}</text>
        </view>
        <view :style="tierTrackStyle">
          <view :style="tierFillStyle" />
        </view>
        <text class="block" :style="tierProgressStyle">{{ tierProgressLine }} · 62%</text>
      </view>

      <!-- Wallet binding -->
      <view class="mx-4 flex items-center active:opacity-90" :style="walletCardStyle" @click="goWallet">
        <view class="grid place-items-center shrink-0" :style="walletIconStyle">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></svg>
        </view>
        <view class="flex-1 min-w-0">
          <view class="flex items-center" style="gap: 6px">
            <text :style="walletTitleStyle">{{ t.profile.walletAddress }}</text>
            <svg v-if="paired" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
          </view>
          <text class="block truncate" :style="walletSubStyle">{{ walletSub }}</text>
        </view>
        <text :style="walletActionStyle">{{ paired ? t.profile.walletPaired : t.profile.walletPair }}</text>
      </view>

      <!-- Save bar -->
      <view style="padding: 0 16px; margin-top: 20px">
        <view class="w-full flex items-center justify-center" :class="dirty ? 'active:opacity-90' : ''" :style="saveBtnStyle" role="button" tabindex="0" :aria-label="t.profile.saveChanges" @click="handleSave">
          <text :style="saveLabelStyle">{{ t.profile.saveChanges }}</text>
        </view>
        <text v-if="saveFeedback" class="block text-center" :style="saveFeedbackStyle">{{ saveFeedback }}</text>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import { useProfile } from "@/store/profile";
import { useWalletPairing } from "@/store/wallet-pairing";
import { toast } from "@/store/ui";

const REGIONS = [
  "Singapore",
  "Hong Kong",
  "Tokyo, JP",
  "Seoul, KR",
  "Berlin, DE",
  "London, UK",
  "Dubai, AE",
  "New York, US",
];
const TIMEZONES = [
  "Asia/Singapore (UTC+8)",
  "Asia/Tokyo (UTC+9)",
  "Asia/Hong_Kong (UTC+8)",
  "Europe/Berlin (UTC+1)",
  "Europe/London (UTC+0)",
  "Asia/Dubai (UTC+4)",
  "America/New_York (UTC-5)",
];
const TIERS = ["L0", "L1", "L2", "L3", "L4", "L5"] as const;
type Tier = (typeof TIERS)[number];

const t = useT();
const app = useApp();
const auth = useAuth();
const profile = useProfile();
const pairing = useWalletPairing();

// Local edit buffer (committed on Save), mirroring the source useState.
const name = ref(profile.displayName);
const bio = ref(profile.bio);
const region = ref(profile.region);
const timezone = ref(profile.timezone);
const saveFeedback = ref("");
const isSaving = ref(false);

const displayName = computed(() => profile.displayName);
const email = computed(() => auth.email || app.user.email);
const initial = computed(
  () => (displayName.value || email.value || "S").trim()[0]?.toUpperCase() || "S",
);
const paired = computed(() => pairing.walletPaired);
const walletAddress = computed(() => pairing.pairedWalletAddress);
const walletSub = computed(() =>
  paired.value && walletAddress.value
    ? `${walletAddress.value.slice(0, 8)}…${walletAddress.value.slice(-6)}`
    : t.value.profile.walletEmpty,
);

const userTier = computed<Tier>(() => (app.user.tier as Tier) ?? "L0");
const tierLabel = computed(() => t.value.profile.tierLabels[userTier.value]);
const tierProgressLine = computed(() => {
  const idx = TIERS.indexOf(userTier.value);
  const nextTier: Tier = idx >= 0 && idx < TIERS.length - 1 ? TIERS[idx + 1] : "L5";
  return t.value.profile.tierProgress.replace("{next}", t.value.profile.tierLabels[nextTier]);
});

const joinedDate = computed(() =>
  new Date(app.user.joinedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }),
);

const regionIdx = computed(() => Math.max(0, REGIONS.indexOf(region.value)));
const timezoneIdx = computed(() => Math.max(0, TIMEZONES.indexOf(timezone.value)));

const dirty = computed(
  () =>
    name.value !== profile.displayName ||
    bio.value !== profile.bio ||
    region.value !== profile.region ||
    timezone.value !== profile.timezone,
);

// uni input/picker event → e.detail.value (string for input, index for picker)
function detailVal(e: Event): string {
  return (e as unknown as { detail: { value: string } }).detail.value;
}
function onName(e: Event) {
  name.value = detailVal(e);
}
function onBio(e: Event) {
  bio.value = detailVal(e).slice(0, 140);
}
function onRegion(e: Event) {
  region.value = REGIONS[Number(detailVal(e))] ?? region.value;
}
function onTimezone(e: Event) {
  timezone.value = TIMEZONES[Number(detailVal(e))] ?? timezone.value;
}

function handleSave() {
  if (isSaving.value) return;
  if (!dirty.value) {
    saveFeedback.value = t.value.profile.noChangesToast;
    toast.info(t.value.profile.noChangesToast);
    return;
  }
  isSaving.value = true;
  profile.setDisplayName(name.value.trim() || "Anonymous");
  profile.setBio(bio.value.trim());
  profile.setRegion(region.value);
  profile.setTimezone(timezone.value);
  saveFeedback.value = t.value.profile.savedToast;
  toast.success(t.value.profile.savedToast);
  setTimeout(() => {
    isSaving.value = false;
  }, 0);
}

function handleRegen() {
  profile.regenerateAvatar();
  toast.info(t.value.profile.avatar, t.value.profile.avatarHint);
}

function goWallet() {
  uni.navigateTo({ url: "/pages/me/wallet", fail: () => {} });
}

// ── styles ──
const avatarCardStyle: CSSProperties = {
  marginTop: "8px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  padding: "20px",
};
const avatarStyle: CSSProperties = {
  width: "64px",
  height: "64px",
  borderRadius: "50%",
  background: "var(--v5-brand)",
};
const avatarTextStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "26px",
  color: "var(--v5-on-brand)",
};
const regenBtnStyle: CSSProperties = {
  position: "absolute",
  bottom: "-6px",
  right: "-6px",
  width: "28px",
  height: "28px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
};
const nameStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const emailStyle: CSSProperties = {
  marginTop: "1px",
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
const joinedStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "11px",
  color: "var(--v5-ink-4)",
};
const fieldsCardStyle: CSSProperties = {
  marginTop: "12px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
};
const sectionCapStyle: CSSProperties = {
  padding: "12px 16px 8px",
  fontFamily: "var(--font-v5)",
  fontSize: "11px",
  letterSpacing: "0.18em",
  color: "var(--v5-ink-4)",
};
const fieldBlockStyle: CSSProperties = {
  padding: "0 16px 12px",
  borderTop: "1px solid var(--v5-border)",
};
const fieldLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
const inputStyle: CSSProperties = {
  marginTop: "4px",
  height: "38px",
  background: "var(--v5-surface-2)",
  borderRadius: "8px",
  padding: "0 12px",
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  color: "var(--v5-ink)",
};
const textareaStyle: CSSProperties = {
  marginTop: "4px",
  minHeight: "64px",
  width: "100%",
  background: "var(--v5-surface-2)",
  borderRadius: "8px",
  padding: "8px 12px",
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  color: "var(--v5-ink)",
  boxSizing: "border-box",
};
const pickerStyle: CSSProperties = {
  marginTop: "4px",
  height: "38px",
  lineHeight: "38px",
  background: "var(--v5-surface-2)",
  borderRadius: "8px",
  padding: "0 10px",
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  color: "var(--v5-ink)",
};
const fieldHintStyle: CSSProperties = {
  marginTop: "4px",
  fontFamily: "var(--font-v5)",
  fontSize: "11px",
  color: "var(--v5-ink-4)",
};
const tierCardStyle: CSSProperties = {
  marginTop: "12px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  padding: "16px",
};
const tierCapStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "11.5px",
  letterSpacing: "0.16em",
  color: "var(--v5-ink-3)",
};
const tierLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 600,
  color: "var(--v5-brand)",
};
const tierTrackStyle: CSSProperties = {
  height: "8px",
  borderRadius: "999px",
  background: "var(--v5-surface-2)",
  overflow: "hidden",
};
const tierFillStyle: CSSProperties = {
  height: "100%",
  width: "62%",
  background: "linear-gradient(to right, var(--v5-brand), color-mix(in srgb, var(--v5-brand) 55%, var(--v5-success)))",
};
const tierProgressStyle: CSSProperties = {
  marginTop: "8px",
  fontFamily: "var(--font-v5)",
  fontSize: "11.5px",
  color: "var(--v5-ink-4)",
};
const walletCardStyle: CSSProperties = {
  marginTop: "12px",
  gap: "12px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  padding: "16px",
};
const walletIconStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "12px",
  background: "color-mix(in srgb, var(--v5-brand-2) 15%, transparent)",
};
const walletTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 500,
  color: "var(--v5-ink-2)",
};
const walletSubStyle: CSSProperties = {
  marginTop: "2px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11.5px",
  color: "var(--v5-ink-3)",
};
const walletActionStyle = computed<CSSProperties>(() => ({
  fontFamily: "var(--font-v5)",
  fontSize: "11.5px",
  fontWeight: 500,
  color: paired.value ? "var(--v5-brand-2)" : "var(--v5-brand)",
}));
const saveBtnStyle = computed<CSSProperties>(() => ({
  height: "44px",
  borderRadius: "12px",
  background: dirty.value ? "var(--v5-brand)" : "var(--v5-surface-2)",
}));
const saveLabelStyle = computed<CSSProperties>(() => ({
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 600,
  color: dirty.value ? "var(--v5-on-brand)" : "var(--v5-ink-4)",
}));
const saveFeedbackStyle: CSSProperties = {
  marginTop: "8px",
  fontFamily: "var(--font-v5)",
  fontSize: "11.5px",
  color: "var(--v5-ink-3)",
};
</script>
