<!--
  ProfileRow — ported from me/page.tsx ProfileRow.
  Strict port of styles-v4.css .profile-row: avatar (56 circle, brand solid) +
  name (display 600 18 -0.018) + phone mask (mono 12.5 ink-3) + 2 code-tag chips
  (KYC verified/pending + Joined Nd). Taps through to /me/profile (not yet ported
  → nav fail:()=>{}).
-->
<template>
  <view class="flex items-center active:opacity-90" style="gap: 14px; padding: 4px 0" @click="goProfile">
    <view class="grid place-items-center shrink-0" :style="avatarStyle">
      <text :style="avatarTextStyle">{{ initial }}</text>
    </view>
    <view class="flex-1 min-w-0">
      <text class="block truncate" :style="nameStyle">{{ name }}</text>
      <text class="block truncate" :style="metaStyle">{{ phoneMask }} · US</text>
      <view class="flex items-center" style="gap: 6px; margin-top: 6px">
        <view v-if="kycVerified" class="inline-flex items-center" :style="kycVerifiedChipStyle">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          <text>{{ t.me.profileKycVerifiedChip }}</text>
        </view>
        <view v-else class="inline-flex items-center" :style="kycPendingChipStyle">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></svg>
          <text>{{ t.me.profileKycPendingChip }}</text>
        </view>
        <view class="inline-flex items-center" :style="joinedChipStyle">
          <text>{{ joinedLabel }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { useProfile } from "@/store/profile";
import { useWalletPairing } from "@/store/wallet-pairing";

const ONE_DAY_MS = 86400 * 1000;

const t = useT();
const app = useApp();
const profile = useProfile();
const pairing = useWalletPairing();

const name = computed(() => profile.displayName);
const initial = computed(() => (name.value || app.user.email || "S").trim()[0]?.toUpperCase() || "S");
const phoneMask = "+1 (415) ••• 4892";
const kycVerified = computed(() => pairing.walletPaired);
const daysJoined = computed(() => Math.max(1, Math.floor((Date.now() - app.user.joinedAt) / ONE_DAY_MS)));
const joinedLabel = computed(() => fmt(t.value.me.profileJoinedDay, { n: daysJoined.value }));

function goProfile() {
  uni.navigateTo({ url: "/pages/me/profile", fail: () => {} });
}

const avatarStyle: CSSProperties = {
  width: "56px",
  height: "56px",
  borderRadius: "50%",
  background: "var(--v5-brand)",
};
const avatarTextStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "22px",
  color: "var(--v5-on-brand)",
};
const nameStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "18px",
  fontWeight: 600,
  letterSpacing: "-0.018em",
  color: "var(--v5-ink)",
  whiteSpace: "nowrap",
};
const metaStyle: CSSProperties = {
  marginTop: "2px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12.5px",
  color: "var(--v5-ink-3)",
};
const codeTagBase: CSSProperties = {
  gap: "4px",
  padding: "2px 8px",
  borderRadius: "4px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  lineHeight: 1.5,
};
const kycVerifiedChipStyle: CSSProperties = {
  ...codeTagBase,
  background: "var(--v5-success-soft)",
  border: "1px solid color-mix(in srgb, var(--v5-success) 30%, transparent)",
  color: "var(--v5-success)",
};
const kycPendingChipStyle: CSSProperties = {
  ...codeTagBase,
  background: "var(--v5-brand-2-soft)",
  border: "1px solid var(--v5-brand-2-border)",
  color: "var(--v5-brand-2)",
};
const joinedChipStyle: CSSProperties = {
  ...codeTagBase,
  background: "var(--v5-surface-2)",
  border: "1px solid var(--v5-border)",
  color: "var(--v5-ink-2)",
};
</script>
