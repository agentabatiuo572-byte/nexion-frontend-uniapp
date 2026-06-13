<!--
  Proof — ported from Nexion-prototype/app/(main)/me/proof/page.tsx.
  Proof-of-Contribution share hub: 3 card variants (Earnings / Streak / Network)
  tab-switched → a share card (brand + profile + VBadge + variant hero stat +
  secondary stats + achievement chips + referral code/QR) → native-share CTA →
  6 destination buttons → poster tip. Reads app (user/earnings/devices),
  profile (displayName), v-rank (myRank + V_RANKS), network (totalMembers),
  points (streaks). Reuses team/v-badge.vue. navigator.share → uni.share? +
  setClipboardData fallback (P-028). Gradient literals → token color-mix.
  SetPageHeader → SubPageHeader. SSR mounted-guard dropped. Wrapped in
  <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/me" :title="t.proof.title" />

      <view :style="bodyStyle">
        <!-- Variant tabs -->
        <view>
          <text class="block font-mono-tabular" :style="variantLabelStyle">{{ t.proof.variantLabel }}</text>
          <view class="grid grid-cols-3" :style="variantTabsStyle">
            <view
              v-for="v in VARIANTS"
              :key="v"
              class="grid place-items-center active:scale-[0.97]"
              :style="variantPillStyle(v)"
              role="button"
              tabindex="0"
              :aria-label="t.proof.variants[v]"
              @click="variant = v"
            >
              <text :style="variantPillTextStyle(v)" style="pointer-events: none">{{ t.proof.variants[v] }}</text>
            </view>
          </view>
        </view>

        <!-- Share card -->
        <view class="relative overflow-hidden" :style="shareCardStyle">
          <!-- brand -->
          <view class="flex items-center" style="gap: 8px">
            <view class="grid place-items-center" :style="brandMarkStyle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--v5-on-brand)" stroke="var(--v5-on-brand)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" /></svg>
            </view>
            <text class="font-display" :style="brandNameStyle">Nexion</text>
            <text style="margin-left: auto; font-size: 10px; letter-spacing: 0.18em; color: var(--v5-ink-3)">Proof of contribution</text>
          </view>

          <!-- profile -->
          <view class="flex items-center justify-between" style="margin-top: 16px">
            <view class="min-w-0">
              <text class="block truncate" :style="profileNameStyle">{{ profileName }}</text>
              <text class="block" :style="memberSinceStyle">{{ memberSinceText }}</text>
            </view>
            <view class="shrink-0">
              <VBadge :v="myRank" size="md" />
            </view>
          </view>

          <!-- variant hero stat -->
          <view v-if="variant === 'earnings'" style="margin-top: 16px">
            <text class="block font-mono-tabular" :style="heroKickerStyle('var(--v5-brand)')">{{ t.proof.totalEarned }}</text>
            <text class="block font-display tabular-nums" :style="heroBigStyle">${{ earningsTotal.toFixed(2) }}</text>
            <ProofSparkline />
          </view>
          <view v-else-if="variant === 'streak'" style="margin-top: 16px">
            <text class="block font-mono-tabular" :style="heroKickerStyle('var(--v5-brand-2)')">{{ t.proof.longestStreak }}</text>
            <view class="flex items-baseline" style="margin-top: 4px; gap: 6px">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>
              <text class="font-display tabular-nums" :style="heroBigInlineStyle">{{ longestOrCurrent }}</text>
              <text :style="heroUnitStyle">{{ t.proof.daysShort }}</text>
            </view>
          </view>
          <view v-else style="margin-top: 16px">
            <text class="block font-mono-tabular" :style="heroKickerStyle('var(--v5-brand-2)')">{{ t.proof.teamReach }}</text>
            <view class="flex items-baseline" style="margin-top: 4px; gap: 6px">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              <text class="font-display tabular-nums" :style="heroBigInlineStyle">{{ totalMembers }}</text>
            </view>
          </view>

          <!-- secondary stats -->
          <view class="grid grid-cols-3" style="margin-top: 16px; gap: 8px">
            <view :style="miniStatStyle">
              <text class="block truncate" :style="miniLabelStyle">{{ t.proof.activeDays }}</text>
              <text class="block font-display tabular-nums" :style="miniValueStyle">{{ activeDays }}</text>
            </view>
            <view :style="miniStatStyle">
              <text class="block truncate" :style="miniLabelStyle">{{ t.proof.devices }}</text>
              <text class="block font-display tabular-nums" :style="miniValueStyle">{{ onlineDevices }}</text>
            </view>
            <view :style="miniStatStyle">
              <text class="block truncate" :style="miniLabelStyle">{{ topPctLabel }}</text>
              <text class="block font-display tabular-nums" :style="miniValueSmallStyle">Top {{ topPct }}%</text>
            </view>
          </view>

          <!-- achievement chips -->
          <view style="margin-top: 12px">
            <text class="block font-mono-tabular" :style="chipsLabelStyle">{{ t.proof.achievementsRow }}</text>
            <view class="flex" style="gap: 6px; flex-wrap: wrap">
              <text class="inline-block font-mono-tabular" :style="chipStyle('var(--v5-brand)')">{{ vRankChip }}</text>
              <text v-if="longestOrCurrent > 0" class="inline-block font-mono-tabular" :style="chipStyle('var(--v5-brand-2)')">{{ streakChip }}</text>
              <text v-if="onlineDevices > 0" class="inline-block font-mono-tabular" :style="chipStyle('var(--v5-tech-cyan)')">{{ devicesChip }}</text>
              <text class="inline-block font-mono-tabular" :style="chipStyle('var(--v5-warning)')">{{ daysActiveChip }}</text>
            </view>
          </view>

          <!-- referral block -->
          <view class="flex items-center" :style="refBlockStyle">
            <view class="flex-1 min-w-0">
              <text class="block" :style="refLabelStyle">{{ t.proof.refCodeLabel }}</text>
              <text class="block font-display" :style="refCodeStyle">{{ refCode }}</text>
              <view
                class="inline-flex items-center active:opacity-70 font-mono-tabular"
                :style="refLinkStyle"
                role="button"
                tabindex="0"
                :aria-label="t.proof.shareDestinations.copy"
                @click="copyLink"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                <text style="margin-left: 4px; pointer-events: none">{{ referralLink }}</text>
              </view>
            </view>
            <view class="grid place-items-center shrink-0" :style="qrBoxStyle">
              <view class="grid" :style="qrGridStyle">
                <view v-for="(on, i) in qrCells" :key="i" :style="qrCellStyle(on)" />
              </view>
            </view>
          </view>
        </view>

        <!-- Quick native share -->
        <view style="margin-top: 12px">
          <view
            class="flex items-center justify-center active:scale-[0.98]"
            :style="nativeBtnStyle"
            role="button"
            tabindex="0"
            :aria-label="t.proof.shareNative"
            @click="nativeShare"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" /></svg>
            <text style="margin-left: 8px; pointer-events: none" :style="nativeBtnTextStyle">{{ t.proof.shareNative }}</text>
          </view>
          <text class="block" :style="nativeHintStyle">{{ t.proof.shareNativeHint }}</text>
        </view>

        <!-- Destination grid 6 -->
        <view class="grid grid-cols-3" style="margin-top: 12px; gap: 8px">
          <view
            v-for="d in destinations"
            :key="d.label"
            class="active:scale-[0.97]"
            :style="destBtnStyle"
            role="button"
            tabindex="0"
            :aria-label="d.label"
            @click="d.onClick"
          >
            <view class="grid place-items-center" :style="destIconStyle(d.color)" style="pointer-events: none">
              <view v-html="d.icon" />
            </view>
            <text class="block" :style="destLabelStyle" style="pointer-events: none">{{ d.label }}</text>
          </view>
        </view>

        <!-- Tip -->
        <view class="flex items-start" :style="tipStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 2px; flex-shrink: 0"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
          <view style="margin-left: 8px">
            <text class="block" :style="tipTitleStyle">{{ t.proof.posterHintTitle }}</text>
            <text class="block" :style="tipBodyStyle">{{ t.proof.posterHint }}</text>
          </view>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import VBadge from "@/components/team/v-badge.vue";
import ProofSparkline from "@/components/me/proof-sparkline.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";
import { useApp } from "@/store/app";
import { useProfile } from "@/store/profile";
import { useVRank, V_RANKS } from "@/store/v-rank";
import { useNetwork } from "@/store/network";
import { usePoints } from "@/store/points";

type Variant = "earnings" | "streak" | "network";
const VARIANTS: Variant[] = ["earnings", "streak", "network"];

const t = useT();
const app = useApp();
const profile = useProfile();
const vRank = useVRank();
const network = useNetwork();
const points = usePoints();

const variant = ref<Variant>("earnings");

const earningsTotal = computed(() => app.earnings.total);
const onlineDevices = computed(
  () => app.devices.filter((d) => d.status === "online" && d.activatedAt !== null).length,
);
const profileName = computed(() => profile.displayName);
const myRank = computed(() => vRank.myRank);
const totalMembers = computed(() => network.totalMembers);
const streak = computed(() => points.signInStreak);
const longestStreak = computed(() => points.longestStreak);
const longestOrCurrent = computed(() => longestStreak.value || streak.value || 0);

const joined = computed(() =>
  new Date(app.user.joinedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" }),
);
const activeDays = computed(() => Math.max(1, Math.floor((Date.now() - app.user.joinedAt) / (24 * 3600 * 1000))));

const referralLink = computed(() => `https://nexion.ai/ref/${app.user.referralCode}`);
const refCode = computed(() => app.user.referralCode);

const topPct = computed(() => {
  const total = earningsTotal.value;
  if (total > 1000) return 1;
  if (total > 500) return 3;
  if (total > 100) return 8;
  if (total > 30) return 18;
  return 35;
});

const shareText = computed(() => {
  if (variant.value === "streak")
    return `🔥 ${longestOrCurrent.value}-day streak on Nexion. Daily check-ins = passive points. Join me: ${referralLink.value}`;
  if (variant.value === "network")
    return `🌐 My Nexion network is ${totalMembers.value} strong across 7 layers. Compound earnings from each. Join: ${referralLink.value}`;
  return `💸 Earned $${earningsTotal.value.toFixed(2)} on Nexion in ${activeDays.value} days. Join my network: ${referralLink.value}`;
});

// ── derived labels ──
const memberSinceText = computed(() => fmt(t.value.proof.memberSince, { m: joined.value }));
const topPctLabel = computed(() => t.value.proof.topPct.replace("{n}", String(topPct.value)));
const vRankChip = computed(() => fmt(t.value.proof.badges.vRank, { n: String(myRank.value), title: V_RANKS[myRank.value].title }));
const streakChip = computed(() => fmt(t.value.proof.badges.streak, { n: String(longestOrCurrent.value) }));
const devicesChip = computed(() => fmt(t.value.proof.badges.devices, { n: String(onlineDevices.value) }));
const daysActiveChip = computed(() => fmt(t.value.proof.badges.daysActive, { n: String(activeDays.value) }));

// ── share actions (P-028: uni.share? + setClipboardData fallback) ──
function nativeShare() {
  const share = (uni as { share?: (o: unknown) => void }).share;
  if (typeof share === "function") {
    share({
      provider: "weixin",
      type: 0,
      href: referralLink.value,
      title: "Nexion · Proof of Contribution",
      summary: shareText.value,
      success: () => {},
      fail: () => copyText(shareText.value, t.value.proof.sharedToast),
    });
  } else {
    copyText(shareText.value, t.value.proof.sharedToast);
  }
}
function copyLink() {
  copyText(referralLink.value, t.value.proof.copiedToast);
}
function copyShareText(networkName: string) {
  copyText(shareText.value, t.value.proof.sharedToast, `Open ${networkName} and paste`);
}
function downloadPng() {
  toast.success(t.value.proof.downloadToast, "");
}
function copyText(data: string, title: string, desc = "") {
  uni.setClipboardData({ data, showToast: false, fail: () => {} });
  toast.success(title, desc);
}

// ── QR pattern (deterministic 7×7, visual cue only — not a real QR) ──
const qrCells = computed<boolean[]>(() => {
  const code = refCode.value;
  const arr: boolean[] = [];
  for (let i = 0; i < 49; i++) {
    const c = code.charCodeAt(i % code.length) + i * 7;
    arr.push(c % 2 === 0);
  }
  [0, 6, 42].forEach((idx) => (arr[idx] = true));
  [1, 7, 43, 5, 13, 35].forEach((idx) => (arr[idx] = true));
  return arr;
});

// ── destination icon SVG strings (lucide replacements, stroke=currentColor) ──
const ICON = {
  send: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>',
  msg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
  image: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
  copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  download: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
};
const destinations = computed(() => [
  { label: t.value.proof.shareDestinations.twitter, color: "#3DA9FF", icon: tint(ICON.send, "#3DA9FF"), onClick: () => copyShareText("Twitter") },
  { label: t.value.proof.shareDestinations.telegram, color: "var(--v5-tech-cyan)", icon: tint(ICON.msg, "var(--v5-tech-cyan)"), onClick: () => copyShareText("Telegram") },
  { label: t.value.proof.shareDestinations.whatsapp, color: "#25D366", icon: tint(ICON.msg, "#25D366"), onClick: () => copyShareText("WhatsApp") },
  { label: t.value.proof.shareDestinations.instagram, color: "#E4405F", icon: tint(ICON.image, "#E4405F"), onClick: () => copyShareText("Instagram") },
  { label: t.value.proof.shareDestinations.copy, color: "var(--v5-brand)", icon: tint(ICON.copy, "var(--v5-brand)"), onClick: copyLink },
  { label: t.value.proof.shareDestinations.download, color: "var(--v5-warning)", icon: tint(ICON.download, "var(--v5-warning)"), onClick: downloadPng },
]);
function tint(svg: string, color: string): string {
  return svg.replace('stroke="currentColor"', `stroke="${color}"`);
}

// ── styles ──
const bodyStyle: CSSProperties = { padding: "0 16px 32px" };
const variantLabelStyle: CSSProperties = {
  marginBottom: "6px",
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.06em",
  color: "var(--v5-ink-3)",
};
const variantTabsStyle: CSSProperties = {
  gap: "4px",
  padding: "4px",
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
};
function variantPillStyle(v: Variant): CSSProperties {
  const on = variant.value === v;
  return { height: "44px", borderRadius: "12px", background: on ? "var(--v5-brand)" : "transparent" };
}
function variantPillTextStyle(v: Variant): CSSProperties {
  const on = variant.value === v;
  return { fontSize: "11.5px", fontWeight: 600, color: on ? "var(--v5-on-brand)" : "var(--v5-ink-3)" };
}
const shareCardStyle = computed<CSSProperties>(() => {
  // Gradient literals → token color-mix (lemon brand / tech-cyan / brand-2 /
  // warning over a near-black surface; matches source intent, token-disciplined).
  const map: Record<Variant, { grad: string; border: string }> = {
    earnings: {
      grad: "linear-gradient(135deg, color-mix(in srgb, var(--v5-brand) 18%, transparent) 0%, color-mix(in srgb, var(--v5-on-brand) 95%, transparent) 60%, color-mix(in srgb, var(--v5-tech-cyan) 16%, transparent) 100%)",
      border: "color-mix(in srgb, var(--v5-brand) 35%, transparent)",
    },
    streak: {
      grad: "linear-gradient(135deg, color-mix(in srgb, var(--v5-brand-2) 20%, transparent) 0%, color-mix(in srgb, var(--v5-on-brand) 95%, transparent) 60%, color-mix(in srgb, var(--v5-warning) 18%, transparent) 100%)",
      border: "color-mix(in srgb, var(--v5-brand-2) 35%, transparent)",
    },
    network: {
      grad: "linear-gradient(135deg, color-mix(in srgb, var(--v5-tech-cyan) 20%, transparent) 0%, color-mix(in srgb, var(--v5-on-brand) 95%, transparent) 60%, color-mix(in srgb, var(--v5-brand) 16%, transparent) 100%)",
      border: "color-mix(in srgb, var(--v5-tech-cyan) 35%, transparent)",
    },
  };
  const m = map[variant.value];
  return { marginTop: "12px", borderRadius: "16px", padding: "20px", background: m.grad, border: `1px solid ${m.border}` };
});
const brandMarkStyle: CSSProperties = { width: "28px", height: "28px", borderRadius: "6px", background: "var(--v5-brand)" };
const brandNameStyle: CSSProperties = { fontSize: "18px", fontWeight: 600, letterSpacing: "-0.01em", color: "var(--v5-ink)" };
const profileNameStyle: CSSProperties = { fontSize: "18px", fontWeight: 600, color: "var(--v5-ink)" };
const memberSinceStyle: CSSProperties = { marginTop: "2px", fontSize: "11.5px", color: "var(--v5-ink-3)" };
function heroKickerStyle(color: string): CSSProperties {
  return { fontSize: "10px", letterSpacing: "0.16em", color };
}
const heroBigStyle: CSSProperties = {
  marginTop: "4px",
  fontSize: "30px",
  fontWeight: 600,
  color: "var(--v5-ink)",
  lineHeight: 1,
};
const heroBigInlineStyle: CSSProperties = { fontSize: "30px", fontWeight: 600, color: "var(--v5-ink)", lineHeight: 1 };
const heroUnitStyle: CSSProperties = { fontSize: "14px", fontWeight: 500, color: "var(--v5-ink-3)" };
const miniStatStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--v5-surface-2) 60%, transparent)",
  borderRadius: "8px",
  padding: "8px",
  border: "1px solid var(--v5-border)",
  textAlign: "center",
};
const miniLabelStyle: CSSProperties = { fontSize: "10px", letterSpacing: "0.16em", color: "var(--v5-ink-3)" };
const miniValueStyle: CSSProperties = { marginTop: "2px", fontSize: "15px", fontWeight: 600, color: "var(--v5-ink)" };
const miniValueSmallStyle: CSSProperties = { marginTop: "2px", fontSize: "12px", fontWeight: 600, color: "var(--v5-ink)" };
const chipsLabelStyle: CSSProperties = {
  marginBottom: "6px",
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.06em",
  color: "var(--v5-ink-3)",
};
function chipStyle(tintColor: string): CSSProperties {
  return {
    padding: "2px 8px",
    borderRadius: "6px",
    fontSize: "10px",
    fontWeight: 600,
    background: `color-mix(in srgb, ${tintColor} 22%, transparent)`,
    color: tintColor,
  };
}
const refBlockStyle: CSSProperties = {
  marginTop: "16px",
  padding: "12px",
  borderRadius: "12px",
  gap: "12px",
  background: "color-mix(in srgb, var(--v5-surface-2) 70%, transparent)",
  border: "1px solid var(--v5-border)",
};
const refLabelStyle: CSSProperties = { fontSize: "10px", letterSpacing: "0.18em", color: "var(--v5-brand)" };
const refCodeStyle: CSSProperties = {
  marginTop: "2px",
  fontSize: "20px",
  fontWeight: 600,
  letterSpacing: "0.05em",
  color: "var(--v5-ink)",
};
const refLinkStyle: CSSProperties = {
  marginTop: "4px",
  minHeight: "44px",
  marginLeft: "-4px",
  padding: "0 4px",
  borderRadius: "6px",
  fontSize: "10.5px",
  color: "var(--v5-ink-3)",
};
const qrBoxStyle: CSSProperties = { width: "56px", height: "56px", borderRadius: "8px", background: "#ffffff" };
const qrGridStyle: CSSProperties = { gridTemplateColumns: "repeat(7, 1fr)", gap: "1px", padding: "4px" };
function qrCellStyle(on: boolean): CSSProperties {
  return { width: "4px", height: "4px", background: on ? "var(--v5-on-brand)" : "transparent" };
}
const nativeBtnStyle: CSSProperties = { height: "48px", borderRadius: "999px", background: "var(--v5-brand)" };
const nativeBtnTextStyle: CSSProperties = { fontSize: "14px", fontWeight: 600, color: "var(--v5-on-brand)" };
const nativeHintStyle: CSSProperties = { marginTop: "6px", textAlign: "center", fontSize: "10.5px", color: "var(--v5-ink-3)" };
const destBtnStyle: CSSProperties = {
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  padding: "12px",
  textAlign: "center",
};
function destIconStyle(color: string): CSSProperties {
  return { width: "36px", height: "36px", margin: "0 auto", borderRadius: "8px", background: `color-mix(in srgb, ${color} 12%, transparent)`, color };
}
const destLabelStyle: CSSProperties = { marginTop: "6px", fontSize: "10.5px", color: "var(--v5-ink-2)", lineHeight: 1.3 };
const tipStyle: CSSProperties = {
  margin: "16px 0 8px",
  padding: "12px",
  borderRadius: "12px",
  background: "color-mix(in srgb, var(--v5-warning) 8%, transparent)",
  border: "1px solid color-mix(in srgb, var(--v5-warning) 20%, transparent)",
};
const tipTitleStyle: CSSProperties = { fontSize: "12px", fontWeight: 600, color: "var(--v5-warning)" };
const tipBodyStyle: CSSProperties = {
  marginTop: "2px",
  fontSize: "11.5px",
  color: "color-mix(in srgb, var(--v5-warning) 85%, transparent)",
  lineHeight: 1.6,
};
</script>
