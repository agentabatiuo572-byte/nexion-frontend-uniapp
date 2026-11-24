<!--
  Invite landing (/ref/[code]): the public page a shared invite link opens. Approved design
  nexion-local/invite-landing/board/gen.mjs (2026-11-25); its layout, type and the frosted ticket are this
  page's own (user exemption from the design-system card, button and page patterns). Colours are brand tokens.
  Logic is unchanged: preview loading, code forwarding, the gift gate, published stats and the routes below.
-->
<template>
  <StandalonePageShell class="rf-shell" :reserve-bottom="false">
    <view class="rf">
      <view class="rf-body">
        <view class="rf-top">
          <view class="rf-logo"><BrandLockup :height="28" style="width: 100%; height: 100%" /></view>
          <view v-if="friendShown" class="rf-eyebrow"><view class="rf-eyebrow__dot" /><text>{{ t.ref.eyebrow }}</text></view>
          <view v-else-if="authed && hasCode" class="rf-eyebrow"><text>{{ t.ref.codeLabel }}</text><text class="rf-eyebrow__code">{{ codeUpper }}</text></view>
        </view>
        <text class="rf-h1" role="heading" aria-level="1">{{ t.ref.headline }}</text>
        <text class="rf-sub">{{ t.ref.subline }}</text>

        <!-- Signed in: the gift is for new accounts, so the page says so and only offers "Enter UVEL". -->
        <view v-if="authed" class="rf-note" role="status">
          <svg class="rf-note__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
          <text class="rf-note__t">{{ giftShown ? t.ref.alreadyBar : t.ref.alreadyBarNoReward }}</text>
        </view>
        <view v-if="previewNote" class="rf-note" role="status" :aria-busy="previewNote.busy ? 'true' : undefined">
          <svg class="rf-note__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
          <text class="rf-note__t">{{ previewNote.text }}</text>
        </view>

        <!-- Ticket: inviter (confirmed code, signed out) over the newcomer gift (same gate as the register page). -->
        <view v-if="whoShown || ticketGift" class="rf-stage">
          <view class="rf-aura" aria-hidden="true"><view class="rf-aura__mark" /></view>
          <view class="rf-ticket" :class="{ 'rf-ticket--tear': whoShown && ticketGift }">
            <view v-if="whoShown" class="rf-tk-sec rf-tk-sec--who">
              <view class="rf-tk-row"><text class="rf-label">{{ isAdvisor ? t.ref.advisorLabel : t.ref.invitedBy }}</text><text class="rf-label">{{ t.ref.codeLabel }}</text></view>
              <view class="rf-who">
                <view class="rf-ava" aria-hidden="true"><text class="rf-ava__t nx-avatar-letter">{{ initial }}</text></view>
                <text class="rf-name">{{ sponsor?.name }}</text>
                <text v-if="friendShown && sponsor?.vRank" class="rf-rank">V{{ sponsor.vRank }}</text>
                <text class="rf-who__code">{{ codeUpper }}</text>
              </view>
            </view>
            <view v-if="whoShown && ticketGift" class="rf-tear" aria-hidden="true" />
            <view v-if="ticketGift" class="rf-tk-sec">
              <view class="rf-tk-row rf-tk-row--c"><text class="rf-label">{{ t.ref.welcomeGift }}</text></view>
              <view class="rf-amts" :class="['rf-amts--' + giftTier, { 'rf-amts--one': giftParts.length === 1 }]">
                <template v-for="(part, index) in giftParts" :key="part.key">
                  <svg v-if="index > 0" class="rf-plus" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 3v18" /><path d="M3 12h18" /></svg>
                  <view class="rf-amt" :class="{ 'rf-amt--uvt': part.unit === 'UVT' }" :style="{ animationDelay: (index * 80 + 260) + 'ms' }">
                    <text class="rf-amt__v">{{ part.value }}</text>
                    <text class="rf-label rf-amt__u">{{ part.unit }}</text>
                  </view>
                </template>
              </view>
            </view>
          </view>
        </view>

        <view class="rf-sec">
          <text class="rf-label rf-sec-h" role="heading" aria-level="2">{{ t.ref.whyTitle }}</text>
          <view v-for="(fact, index) in facts" :key="index" class="rf-fact">
            <text class="rf-fact__n" aria-hidden="true">0{{ index + 1 }}</text>
            <view class="rf-fact__c">
              <text class="rf-fact__t">{{ fact.title }}</text>
              <text class="rf-fact__p">{{ fact.body }}</text>
            </view>
          </view>
        </view>

        <!-- Published platform figures (same source as the home card); each one falls back to "—" on its own. -->
        <view class="rf-sec">
          <view class="rf-sec-h rf-sec-h--row">
            <text class="rf-label rf-sec-h__t" role="heading" aria-level="2">{{ t.home.platformStatsTitle }}</text>
            <view class="rf-more" role="link" tabindex="0" :aria-label="t.ref.trustCenter" @click="goTrust"><text class="rf-more__t">{{ t.ref.trustCenter }}</text><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg></view>
          </view>
          <view class="rf-stats">
            <view class="rf-stat"><NxTickNumber class="rf-stat__v" :text="published.registered.value" /><text class="rf-stat__l">{{ t.home.networkMembers }}</text></view>
            <view class="rf-stat"><NxTickNumber class="rf-stat__v" :text="published.online.value" /><text class="rf-stat__l">{{ t.home.networkDevices }}</text></view>
            <view class="rf-stat"><NxTickNumber class="rf-stat__v" :text="published.paidOut.value" /><text class="rf-stat__l">{{ t.home.networkPaidOut }}</text></view>
          </view>
        </view>

        <!-- Legal: Terms and Privacy are real keyboard links (role="link" takes Enter from the shared activation layer). -->
        <view class="rf-legal">
          <text v-if="!authed" class="rf-legal__line">{{ t.ref.legalLine }}</text>
          <text class="rf-legal__a" role="link" tabindex="0" :aria-label="t.ref.terms" @click="goTerms">{{ t.ref.terms }}</text>
          <text class="rf-legal__a" role="link" tabindex="0" :aria-label="t.ref.privacy" @click="goPrivacy">{{ t.ref.privacy }}</text>
        </view>
      </view>

      <!-- Main action, fixed to the bottom over a fade to the page floor. -->
      <view class="rf-bar" :class="{ 'rf-bar--solo': authed }">
        <view class="rf-cta" role="button" tabindex="0" data-system-chrome-primary @click="primaryAction" @keydown.enter.prevent="primaryAction" @keydown.space.prevent="primaryAction">
          <text class="rf-cta__t" :class="{ 'rf-cta__t--long': ctaLabel.length > 26 }">{{ ctaLabel }}</text>
          <view class="rf-cta__i" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg></view>
        </view>
        <view v-if="!authed" class="rf-login">
          <text class="rf-login__q">{{ t.ref.signinInstead }}</text>
          <text
            class="rf-login__a"
            role="button"
            tabindex="0"
            :data-system-chrome-primary="remoteApiEnabled && !remotePreview ? '' : undefined"
            @click="goLogin"
            @keydown.enter.prevent="goLogin" @keydown.space.prevent="goLogin"
          >{{ t.ref.continue }}</text>
        </view>
      </view>
    </view>
    <ToastHost />
  </StandalonePageShell>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import ToastHost from "@/components/toast-host.vue";
import { displayNickname } from "@/lib/brand-copy";
import { formatAmount } from "@/lib/amount-display";
import { privacyPolicyHref } from "@/lib/privacy-return";
import { navReset, navTo, takeNavigationQuery } from "@/lib/route";
import { computed, onUnmounted, ref } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import StandalonePageShell from "@/components/device/standalone-page-shell.vue";
import BrandLockup from "@/components/brand-lockup.vue";
import { useT } from "@/i18n/use-t";
import { useEntryRecoveryCopy } from "@/i18n/entry-recovery";
import { fmt } from "@/i18n/format";
import NxTickNumber from "@/components/ui/nx-tick-number.vue";
import { pickSponsor } from "@/mock/sponsors";
import { apiClient, remoteApiEnabled } from "@/api/runtime";
import { createPublicSponsorPreviewApi, type PublicSponsorPreview } from "@/api/public-sponsor-preview-api";
import { ApiError } from "@/api/errors";
import { normalizeRegistrationSponsorCode } from "@/auth/registration-sponsor";
import { useConfig } from "@/store/config";
import { usePublishedNetworkStats } from "@/composables/use-published-network-stats";
import { useAuth } from "@/store/auth";
import { normalizeRefCode, useSponsorship } from "@/store/sponsorship";
import { newcomerSubtitleKind, visibleReferralGift } from "@/lib/referral-reward-gate";
import { referralCtaMode, resolveReferralAttributionCode, type ReferralPreviewState } from "@/lib/referral-preview-state";

const PARTNER_LOGOS = ["NVIDIA", "Intel", "AMD", "OpenRouter", "OPPO", "TechCrunch"];
const t = useT();
const recoveryCopy = useEntryRecoveryCopy();
const code = ref("");
const requestedCode = ref<string | null>(null);
const cfg = useConfig();
const publicSponsorPreviewApi = createPublicSponsorPreviewApi(apiClient);
const remotePreview = ref<PublicSponsorPreview | null>(null);
const remotePreviewState = ref<ReferralPreviewState>("idle");
// Social proof uses the published figures of the home network snapshot card, never real aggregates.
const published = usePublishedNetworkStats();
const auth = useAuth();
const sponsorship = remoteApiEnabled ? null : useSponsorship();
const rewardEnabled = computed(() => cfg.config.rewards.enabled);
const localGift = computed(() => visibleReferralGift(cfg.config.rewards));
// 新人礼包不再需要邀请人：金额单源派生自已过 H8 闸门的 platform config（远程模式已合并 /api/config/referral-rewards）。
const giftUsdt = computed(() => localGift.value.usdtAmount);
const giftNex = computed(() => localGift.value.nexAmount);
// Same gate as the register page: an open gift with both amounts at 0 promises nothing, so the page treats it as no gift.
const giftShown = computed(() => newcomerSubtitleKind(rewardEnabled.value, giftUsdt.value, giftNex.value) === "amount");
const referralCta = computed(() => remotePreviewState.value === "loading" ? "ordinary" : referralCtaMode(remoteApiEnabled, remotePreviewState.value));
const referralAttribution = computed(() => resolveReferralAttributionCode(
  remoteApiEnabled,
  remotePreviewState.value,
  code.value,
));
let referralLoadVersion = 0;
let referralMounted = true;
const isCurrentReferralLoad = (version: number) => referralMounted && version === referralLoadVersion;

// Show sponsor/rewards only after preview. Forward the requested code while loading;
// registration still validates it before establishing the relationship.
onLoad(async (options) => {
  const forwarded = new URLSearchParams(takeNavigationQuery("/pages/ref/code"));
  const incomingCode = options?.code ?? forwarded.get("code") ?? undefined;
  privacyHref.value = privacyPolicyHref("/pages/ref/code", incomingCode);
  referralMounted = true;
  referralLoadVersion += 1;
  if (remoteApiEnabled) {
    code.value = "";
    remotePreview.value = null;
    remotePreviewState.value = "idle";
    const rawCode = String(incomingCode ?? "").trim();
    const norm = normalizeRegistrationSponsorCode(rawCode, true);
    requestedCode.value = norm;
    if (!norm) {
      remotePreviewState.value = rawCode ? "unavailable" : "idle";
      return;
    }
    await loadRemotePreview();
    return;
  }
  const norm = normalizeRefCode(options?.code ?? "");
  code.value = norm ?? "";
  if (norm) sponsorship?.capturePending(norm);
});
async function loadRemotePreview() {
  if (!remoteApiEnabled || !referralMounted || !requestedCode.value || remotePreviewState.value === "loading") return;
  const loadVersion = ++referralLoadVersion;
  const requested = requestedCode.value;
  remotePreviewState.value = "loading";
  remotePreview.value = null;
  code.value = "";
  try {
    const preview = await publicSponsorPreviewApi.preview(requested);
    if (!isCurrentReferralLoad(loadVersion)) return;
    // A response for another code must not replace this invitation.
    if (preview.code !== requested) throw new Error("REFERRAL_PREVIEW_CODE_MISMATCH");
    remotePreview.value = preview;
    code.value = preview.code;
    remotePreviewState.value = "ready";
  } catch (cause) {
    if (!isCurrentReferralLoad(loadVersion)) return;
    remotePreviewState.value = "unavailable";
    if (cause instanceof ApiError && ["REFERRAL_PREVIEW_INVALID", "REFERRAL_PREVIEW_NOT_FOUND"].includes(cause.message)) requestedCode.value = null;
  }
}
useAutoRecovery({ failed: () => remoteApiEnabled && !!requestedCode.value && remotePreviewState.value === "unavailable", retry: loadRemotePreview });
function cleanupReferralLoad() {
  referralMounted = false;
  referralLoadVersion += 1;
}
onUnload(cleanupReferralLoad);
onUnmounted(cleanupReferralLoad);
const hasCode = computed(() => remoteApiEnabled ? !!remotePreview.value : !!code.value);
const authed = computed(() => auth.isAuthenticated);

const codeUpper = computed(() => code.value.toUpperCase());
const sponsor = computed(() => {
  if (remoteApiEnabled) {
    const value = remotePreview.value?.sponsor;
    return value ? { name: displayNickname(value.displayName), vRank: value.vRank?.replace(/^V/i, "") ?? null } : null;
  }
  return code.value ? pickSponsor(code.value) : null;
});
const initial = computed(() => sponsor.value?.name[0] ?? "N");

// Display-only state for the template (design: nexion-local/invite-landing/board/gen.mjs).
const isAdvisor = computed(() => remotePreview.value?.kind === "ADVISOR");
// The inviter block, like the old sponsor card, shows only for a confirmed code to a signed-out visitor.
const whoShown = computed(() => hasCode.value && !authed.value);
// "Friend invitation", the V rank and "your inviter gets you started" belong to a friend (USER) code only.
const friendShown = computed(() => whoShown.value && remotePreview.value?.kind === "USER");
const ticketGift = computed(() => giftShown.value && !authed.value);
// Gift figures use full precision: whole numbers have no decimal point, others keep their real places (5, 1.5).
const giftParts = computed(() => {
  const parts: { key: string; value: string; unit: string; label: string }[] = [];
  if (!giftShown.value) return parts;
  const usdt = formatAmount(giftUsdt.value, "full"), nex = formatAmount(giftNex.value, "full");
  if (giftUsdt.value > 0) parts.push({ key: "usdt", value: usdt, unit: "USDT", label: "$" + usdt });
  if (giftNex.value > 0) parts.push({ key: "uvt", value: nex, unit: "UVT", label: nex + "\u00A0UVT" });
  return parts;
});
// Longer figures step down a size so two amounts still fit side by side.
const giftTier = computed(() => {
  const longest = Math.max(0, ...giftParts.value.map((part) => part.value.length));
  return longest >= 5 ? "s" : longest >= 4 ? "m" : "l";
});
const ctaLabel = computed(() => {
  if (authed.value) return t.value.ref.enterApp;
  if (referralCta.value !== "referral") return t.value.register.create;
  return giftShown.value ? fmt(t.value.ref.claimCta, { gift: giftParts.value.map((part) => part.label).join(" + ") }) : t.value.ref.joinCta;
});
function primaryAction() {
  if (authed.value) enterApp();
  else goRegister();
}
// Loading, a temporary failure (the requested code is still forwarded) and an unusable code each get one note.
const previewNote = computed(() => {
  if (!remoteApiEnabled) return null;
  if (remotePreviewState.value === "loading") return { busy: true, text: recoveryCopy.value.referralLoading };
  if (remotePreviewState.value !== "unavailable") return null;
  // Signed in, the page offers only "Enter UVEL", so the note reports the state without the sign-up hint.
  if (requestedCode.value) return { busy: false, text: authed.value ? recoveryCopy.value.referralUnavailableShort : recoveryCopy.value.referralUnavailable };
  return { busy: false, text: authed.value ? recoveryCopy.value.referralInvalidShort : recoveryCopy.value.referralInvalid };
});
const facts = computed(() => {
  const f = t.value.ref.facts;
  const rows = [{ title: f.hostedTitle, body: f.hostedBody }, { title: f.rewardsTitle, body: f.rewardsBody }];
  return friendShown.value ? [...rows, { title: f.inviterTitle, body: f.inviterBody }] : rows;
});

function goRegister() {
  const sponsorCode = referralAttribution.value || requestedCode.value;
  const q = sponsorCode ? `?ref=${encodeURIComponent(sponsorCode)}` : "";
  navTo(`/pages/register/register${q}`);
}
function goLogin() {
  const sponsorCode = referralAttribution.value || requestedCode.value;
  const q = sponsorCode ? `?ref=${encodeURIComponent(sponsorCode)}` : "";
  navTo(`/pages/login/login${q}`);
}
function enterApp() {
  navReset({ url: "/pages/index/index", fail: () => {} });
}
function goTrust() {
  navTo("/pages/trust/trust");
}
const privacyHref = ref(privacyPolicyHref("/pages/ref/code"));
function goPrivacy() { navTo(privacyHref.value); }
function goTerms() {
  navTo("/pages/onboarding/terms");
}

</script>

<style scoped>
/* Approved invite-landing design (gen.mjs CSS). Theme values come from brand tokens; the glass whites are
   material highlights, not theme colours. */
.rf {
  --rf-line: color-mix(in srgb, var(--v5-ink) 12%, transparent);
  --rf-tk-line: color-mix(in srgb, var(--v5-ink) 26%, transparent);
  --rf-glass: linear-gradient(140deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.04) 46%, rgba(255, 255, 255, 0.08)), color-mix(in srgb, var(--v5-bg) 36%, transparent);
  --rf-glass-rim: inset 0 1px 0 rgba(255, 255, 255, 0.42), inset 0 0 0 1px rgba(255, 255, 255, 0.14), inset 0 -18px 30px -22px rgba(255, 255, 255, 0.16);
  --rf-grain: 0.26;
  --rf-a1: color-mix(in srgb, var(--v5-brand) 50%, transparent);
  --rf-a2: color-mix(in srgb, var(--v5-tech-cyan) 42%, transparent);
  --rf-a3: color-mix(in srgb, var(--v5-nex) 50%, transparent);
  --rf-safe-bottom: max(12px, var(--nx-safe-bottom, 0px));
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: var(--v5-bg);
  color: var(--v5-ink);
  font-family: var(--font-v5);
  text-align: left;
}
:global(:root[data-theme="light"] .rf) {
  --rf-tk-line: color-mix(in srgb, var(--v5-ink) 20%, transparent);
  --rf-glass: linear-gradient(140deg, rgba(255, 255, 255, 0.74), rgba(255, 255, 255, 0.36) 46%, rgba(255, 255, 255, 0.52));
  --rf-glass-rim: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 0 0 1px rgba(255, 255, 255, 0.6), inset 0 -18px 30px -22px color-mix(in srgb, var(--v5-ink-3) 24%, transparent);
  --rf-grain: 0.24;
  --rf-a1: color-mix(in srgb, var(--v5-brand) 42%, transparent);
  --rf-a3: color-mix(in srgb, var(--v5-nex) 42%, transparent);
}
.rf-body { padding: 0 20px calc(138px + var(--rf-safe-bottom)); }
.rf-label { display: block; font-size: 12px; line-height: 16px; font-weight: 400; white-space: nowrap; }

.rf-top { height: 56px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
/* Compact top-bar logo (11 brand assets: the 144px kit minimum may shrink in an App top bar): 81×28. */
.rf-logo { flex: none; width: 81px; height: 28px; }
.rf-eyebrow { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 12px; line-height: 16px; color: var(--v5-ink-3); white-space: nowrap; }
.rf-eyebrow__dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--v5-brand); }
.rf-eyebrow__code { font-family: var(--font-jet-mono); font-weight: 500; letter-spacing: 0.04em; color: var(--v5-ink-2); }
.rf-h1 { display: block; margin-top: 16px; font-size: 36px; line-height: 40px; font-weight: 600; letter-spacing: -0.03em; overflow-wrap: break-word; }
.rf-h1:lang(zh) { letter-spacing: -0.01em; }
.rf-sub { display: block; margin-top: 12px; font-size: 15px; line-height: 22px; color: var(--v5-ink-2); }

.rf-note { display: flex; align-items: flex-start; gap: 10px; margin-top: 20px; padding: 12px 14px; border: 1px solid var(--rf-line); border-radius: 14px; font-size: 13px; line-height: 19px; color: var(--v5-ink-2); }
.rf-note + .rf-note { margin-top: 8px; }
.rf-note__icon { flex: none; margin-top: 1px; color: var(--v5-warning-ink); }
.rf-note__t { flex: 1; min-width: 0; overflow-wrap: break-word; }

/* Frosted ticket over the brand symbol and three still glows (no blur filter, nothing follows the scroll). */
.rf-stage { position: relative; margin-top: 24px; }
.rf-aura {
  position: absolute; left: -20px; right: -20px; top: -130px; bottom: -130px; pointer-events: none;
  background:
    radial-gradient(130px 120px at 16% 64%, var(--rf-a1), transparent 100%),
    radial-gradient(140px 120px at 90% 36%, var(--rf-a2), transparent 100%),
    radial-gradient(130px 110px at 70% 70%, var(--rf-a3), transparent 100%);
}
.rf-aura__mark { position: absolute; right: -64px; top: 62px; width: 232px; height: 171px; transform: rotate(-10deg); background: url("/static/img/brand/uvel-symbol.png") center / contain no-repeat; }
.rf-ticket {
  --rf-tear-y: 112px;
  position: relative; overflow: hidden; border-radius: 24px;
  background: var(--rf-glass); box-shadow: var(--rf-glass-rim);
  -webkit-backdrop-filter: blur(22px) saturate(165%); backdrop-filter: blur(22px) saturate(165%);
  animation: rf-ticket-in 560ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both;
}
.rf-ticket::before { content: ""; position: absolute; inset: 0; background: url("/static/img/ref/ticket-grain.png") 0 0 / 64px 64px; opacity: var(--rf-grain); mix-blend-mode: overlay; pointer-events: none; }
/* The notches sit on the dashed line: both follow --rf-tear-y, the fixed height of the inviter section. */
.rf-ticket--tear {
  -webkit-mask: radial-gradient(circle 11px at 0 var(--rf-tear-y), transparent 10.5px, #000 11px), radial-gradient(circle 11px at 100% var(--rf-tear-y), transparent 10.5px, #000 11px);
  -webkit-mask-composite: source-in;
  mask: radial-gradient(circle 11px at 0 var(--rf-tear-y), transparent 10.5px, #000 11px), radial-gradient(circle 11px at 100% var(--rf-tear-y), transparent 10.5px, #000 11px);
  mask-composite: intersect;
}
.rf-tk-sec { position: relative; padding: 18px 20px 20px; }
.rf-tk-sec--who { height: var(--rf-tear-y); box-sizing: border-box; }
.rf-tk-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; color: var(--v5-ink-2); }
.rf-tk-row--c { justify-content: center; }
.rf-who { display: flex; align-items: center; gap: 12px; margin-top: 14px; min-height: 44px; }
.rf-ava { flex: none; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: linear-gradient(135deg, var(--v5-brand), var(--v5-tech-cyan)); color: var(--v5-on-brand); }
.rf-ava__t { font-size: 26px; line-height: 1; }
.rf-name { font-size: 22px; line-height: 28px; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; }
.rf-rank { font-family: var(--font-jet-mono); font-size: 11px; line-height: 16px; font-weight: 500; letter-spacing: 0.06em; white-space: nowrap; border: 1px solid var(--rf-tk-line); border-radius: 999px; padding: 3px 9px; color: var(--v5-ink); }
.rf-who__code { margin-left: auto; font-family: var(--font-jet-mono); font-size: 15px; line-height: 22px; font-weight: 500; letter-spacing: 0.06em; white-space: nowrap; }
.rf-tear { position: relative; height: 0; margin: 0 20px; border-top: 1.5px dashed var(--rf-tk-line); }
.rf-amts { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; margin-top: 10px; }
.rf-amts--one { grid-template-columns: minmax(0, 1fr); }
.rf-amt { text-align: center; animation: rf-rise 620ms cubic-bezier(0.16, 1, 0.3, 1) both; }
.rf-amt__v { display: block; padding-top: 6px; font-family: "UVEL Gift", var(--font-v5); font-size: 92px; line-height: 84px; font-weight: 400; letter-spacing: 0.01em; white-space: nowrap; }
.rf-amts--m .rf-amt__v { font-size: 66px; line-height: 64px; }
.rf-amts--s .rf-amt__v { font-size: 54px; line-height: 54px; }
.rf-amt--uvt .rf-amt__v { color: var(--v5-nex-ink); }
.rf-amt__u { margin-top: 2px; color: var(--v5-ink-2); font-weight: 500; letter-spacing: 0.06em; }
.rf-plus { box-sizing: content-box; padding: 0 6px; color: var(--v5-ink-2); }

.rf-sec { margin-top: 40px; }
.rf-sec-h { font-weight: 500; color: var(--v5-ink); padding-bottom: 12px; border-bottom: 1px solid var(--v5-ink); }
.rf-sec-h--row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 0; }
.rf-sec-h__t { font-weight: 500; padding-bottom: 12px; }
.rf-more { display: inline-flex; align-items: center; justify-content: flex-end; gap: 4px; min-width: 44px; min-height: 44px; margin: -16px 0 -4px; font-size: 12px; line-height: 16px; font-weight: 500; color: var(--v5-ink-2); white-space: nowrap; cursor: pointer; }
.rf-more__t { text-decoration: underline; text-underline-offset: 3px; white-space: nowrap; }
.rf-fact { display: grid; grid-template-columns: 44px minmax(0, 1fr); padding: 16px 0; border-bottom: 1px solid var(--rf-line); }
.rf-fact__n { padding-top: 4px; font-family: var(--font-jet-mono); font-size: 12px; line-height: 16px; font-weight: 500; color: var(--v5-ink-3); }
.rf-fact__t { display: block; font-size: 17px; line-height: 24px; font-weight: 600; letter-spacing: -0.01em; overflow-wrap: break-word; }
.rf-fact__p { display: block; margin-top: 2px; font-size: 14px; line-height: 21px; color: var(--v5-ink-2); overflow-wrap: break-word; }
.rf-stats { display: flex; margin-top: 16px; }
.rf-stat { flex: 1 1 auto; padding: 0 12px; border-left: 1px solid var(--rf-line); }
.rf-stat:first-child { padding-left: 0; border-left: 0; }
.rf-stat:last-child { padding-right: 0; }
.rf-stat__v { display: block; font-family: var(--font-jet-mono); font-size: 22px; line-height: 30px; font-weight: 500; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--v5-ink); }
.rf-stat__l { display: block; margin-top: 2px; font-size: 12px; line-height: 16px; color: var(--v5-ink-3); white-space: nowrap; }
.rf-legal { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 0 16px; margin-top: 28px; font-size: 12px; line-height: 18px; color: var(--v5-ink-3); text-align: center; }
.rf-legal__line { flex-basis: 100%; margin-bottom: -8px; }
.rf-legal__a { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; padding: 0 2px; color: var(--v5-ink-2); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }

.rf-bar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
  padding: 28px 20px var(--rf-safe-bottom);
  background: linear-gradient(to bottom, color-mix(in srgb, var(--v5-bg) 0%, transparent), var(--v5-bg) 28px);
  animation: rf-bar-in 520ms cubic-bezier(0.16, 1, 0.3, 1) 160ms both;
}
/* Signed in there is no sign-in row under the button, so it keeps the shared tray gap above the home indicator (02 §2.5). */
.rf-bar--solo { padding-bottom: max(var(--rf-safe-bottom), var(--nx-tray-bottom, 22px)); }
.rf-cta { display: flex; align-items: center; justify-content: space-between; gap: 12px; height: 56px; padding: 0 8px 0 24px; border-radius: 999px; background: var(--v5-brand); color: var(--v5-on-brand); cursor: pointer; transition: transform 120ms ease, opacity 120ms ease; }
.rf-cta:active { transform: scale(0.98); opacity: 0.92; }
.rf-cta__t { min-width: 0; font-size: 16px; line-height: 22px; font-weight: 600; white-space: nowrap; }
.rf-cta__t--long { font-size: 14px; }
.rf-cta__i { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--v5-on-brand); color: var(--v5-brand); }
.rf-login { height: 44px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; line-height: 19px; color: var(--v5-ink-3); }
.rf-login__q { white-space: nowrap; }
.rf-login__a { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; color: var(--v5-ink); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; white-space: nowrap; cursor: pointer; transition: opacity 120ms ease; }
.rf-login__a:active, .rf-legal__a:active, .rf-more:active { opacity: 0.6; }
.rf-cta:focus-visible, .rf-login__a:focus-visible, .rf-legal__a:focus-visible, .rf-more:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 3px; border-radius: 999px; }

@media (max-width: 374px) {
  .rf-h1 { font-size: 32px; line-height: 36px; }
  .rf-who__code { font-size: 14px; }
}
/* One-time entrance: the ticket rises, the gift figures roll up into place, the action bar slides in. */
@keyframes rf-ticket-in { from { opacity: 0; transform: translateY(16px) scale(0.98); } }
@keyframes rf-rise { from { opacity: 0; transform: translateY(40%); } }
@keyframes rf-bar-in { from { opacity: 0; transform: translateY(24px); } }
@media (prefers-reduced-motion: reduce) {
  .rf-ticket, .rf-amt, .rf-bar { animation: none; }
  .rf-cta { transition: none; }
  .rf-cta:active { transform: none; }
}
/* Without transparency the ticket becomes a solid raised surface; text and the notches stay. */
@media (prefers-reduced-transparency: reduce) {
  .rf-ticket { background: var(--v5-surface-2); -webkit-backdrop-filter: none; backdrop-filter: none; }
  .rf-ticket::before { display: none; }
}
</style>
