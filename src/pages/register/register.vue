<template>
  <StandalonePageShell class="rg-root" @keydown.esc="showCountries = false">
    <view class="rg-wrap" :inert="showCountries || undefined" :aria-hidden="showCountries">
      <!-- Top bar -->
      <view class="rg-top">
        <view v-if="step > 1" class="rg-iconbtn" role="button" tabindex="0" :aria-label="t.register.back" @click="back" @keydown.enter.prevent="back" @keydown.space.prevent="back">
          <view class="rg-iconbtn__face nx-design-glass"><LiquidGlass :radius="20" tone="navigation" :blur="8" /><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></view>
        </view>
        <view v-else class="rg-iconbtn" role="button" tabindex="0" :aria-label="t.register.close" @click="close" @keydown.enter.prevent="close" @keydown.space.prevent="close">
          <view class="rg-iconbtn__face nx-design-glass"><LiquidGlass :radius="20" tone="navigation" :blur="8" /><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></view>
        </view>
        <view class="rg-brand">
          <BrandLockup :height="40" />
        </view>
        <view class="rg-top__sp" />
      </view>

      <!-- Sponsor card (arrived via ?ref) -->
      <view v-if="sponsorPreview" class="rg-sponsor nx-tint">
        <view class="rg-sponsor__av"><text class="rg-sponsor__av-t nx-avatar-letter">{{ displayNickname(sponsorPreview.displayName)[0] }}</text></view>
        <view class="rg-sponsor__body">
          <text class="rg-sponsor__name"><text class="rg-sponsor__name-b">{{ displayNickname(sponsorPreview.displayName) }}</text> {{ sponsorPreview.kind === "ADVISOR" ? t.ref.advisorLabel : t.ref.invitedYou }}</text>
          <text v-if="giftUsdt > 0" class="rg-sponsor__gift">+${{ formatAmount(giftUsdt) }} + {{ formatAmount(giftNex) }} UVT</text>
        </view>
        <NxTag v-if="sponsorPreview.vRank && sponsorPreview.kind !== 'ADVISOR'" tone="brand">{{ sponsorPreview.vRank }}</NxTag>
      </view>

      <!-- Step dots -->
      <view class="rg-dots">
        <view v-for="n in 3" :key="n" class="rg-dot" :class="n === step ? 'rg-dot--active' : (n < step ? 'rg-dot--done' : '')" />
      </view>

      <!-- Title -->
      <text class="rg-title">{{ step === 1 ? t.register.title : step === 2 ? t.register.codeStepTitle : t.register.setPasswordTitle }}</text>
      <NxTag v-if="modeLabel" class="rg-mode-badge" tone="warning" data-testid="auth-runtime-label">{{ modeLabel }}</NxTag>
      <text class="rg-subtitle">
        <!-- 奖励金额护栏(包 zm T1):配置未到位/被中毒清零时金额句整体让位,$0 永不上转化首屏 -->
        <template v-if="step === 1"><template v-if="newcomerSubtitle === 'amount'"><text class="rg-subtitle__hl">{{ fmt(t.register.subtitleHighlight, { reward: giftLabel }) }}</text>{{ t.register.subtitleRest }}</template><template v-else>{{ t.register.subtitleRewardDisabled }}</template></template>
        <template v-else-if="step === 2">{{ t.register.codeSentTo }} <text class="rg-subtitle__ph">{{ country }} {{ phone }}</text></template>
        <template v-else>{{ t.register.setPasswordHint }}</template>
      </text>

      <!-- Body -->
      <view class="rg-body">
        <!-- Step 1: phone。🔴 hint/横幅必须在本容器**内**:插在 v-if 与 v-else-if 之间会断步骤链,
             密码块曾因此在第 1 步恒渲染(独立验收 F1 抓获)。 -->
        <view v-if="step === 1">
          <view class="rg-phone" :class="{ 'rg-phone--err': phone && !phoneOk }">
            <view class="rg-phone__cc" role="button" tabindex="0" :aria-label="t.countryCodes.title" :aria-expanded="showCountries" @click="showCountries = true" @keydown.enter.prevent="showCountries = true" @keydown.space.prevent="showCountries = true">
              <text class="rg-phone__cc-t">{{ country }}</text>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ transform: showCountries ? 'rotate(180deg)' : '' }"><path d="m6 9 6 6 6-6" /></svg>
            </view>
            <input class="rg-phone__in" type="number" inputmode="numeric" maxlength="15" :cursor-spacing="keyboardSpacing.phone" :placeholder="t.register.phonePlaceholder" :aria-label="t.register.phonePlaceholder" :value="phone" :aria-invalid="!!phone && !phoneOk" aria-describedby="register-phone-format" confirm-type="done" @input="onPhone" @confirm="onCta" />
          </view>
          <text id="register-phone-format" data-testid="auth-phone-hint" class="rg-phone-hint" :class="{ 'rg-phone-hint--err': phone && !phoneOk }" role="status" aria-live="polite">{{ phoneFormatMessage }}</text>
          <view class="rg-invite">
            <!-- [FEAT-SHARE4] 链接来源码锁定置灰:不可修改不可删除(主人 2026-07-08 拍板);
                 无码自然进入才渲染可手输框。 -->
            <view v-if="lockedRef">
              <view class="rg-locked">
                <text class="rg-locked__code">{{ lockedRef }}</text>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </view>
              <text class="rg-locked__tag">{{ t.register.inviteLockedTag }}</text>
            </view>
            <input v-else id="rg-invite" class="rg-field" type="text" :cursor-spacing="keyboardSpacing.invite" :placeholder="t.register.invitePlaceholder" :aria-label="t.register.invitePlaceholder" :value="invite" :disabled="verifying" :aria-invalid="inviteInvalid" :aria-describedby="inviteInvalid ? 'register-invite-error' : undefined" confirm-type="done" @input="onInvite" @confirm="onCta" />
            <text v-if="inviteInvalid" id="register-invite-error" class="rg-invite__err" role="alert">{{ t.register.inviteInvalid }}</text>
          </view>
          <!-- 包 zm T3:仅开发构建,Java dev 后端网络级失联时亮工程横幅(生产构建整段剔除)
               i18n-en-ok: 工程话,指名端口与启动方式,受众是开发者不是用户 -->
          <view v-if="devBackendDown" class="rg-devbanner"><text class="rg-devbanner__t">Development backend unavailable · start the Java dev service on port 8110</text></view>
        </view>

        <!-- Step 2: OTP -->
        <view v-else-if="step === 2" class="rg-step2">
          <OtpCodeInput class="rg-otp" :model-value="codeStr" :label="t.authOtp.codeInputLabel" :focus="codeFocus" :cursor-spacing="keyboardSpacing.otp" @update:model-value="onCode" @confirm="onCta" />
          <view v-if="developmentOtpEnabled" class="rg-development-otp" data-testid="development-otp-code" role="status">
            <text class="rg-development-otp__t">{{ fmt(t.authOtp.developmentCodeHint, { code: developmentOtpCode }) }}</text>
          </view>
          <view class="rg-resend">
            <NxButton variant="text" size="small" :label="t.register.changeNumber" @click="back" />
            <text v-if="resendLeft > 0" class="rg-resend__count">{{ resendInText }}</text>
            <NxButton v-else variant="text" size="small" :label="t.register.resend" @click="resend" />
          </view>
        </view>

        <!-- Step 3: password -->
        <view v-else class="rg-step3">
          <view class="rg-field-wrap" :class="{ 'rg-field-wrap--err': password && !pwdOk }">
            <input id="rg-password" class="rg-field rg-field--flex" :cursor-spacing="keyboardSpacing.password" :type="showPwd ? 'text' : 'password'" :placeholder="t.register.passwordPlaceholder" :aria-label="t.register.passwordPlaceholder" :maxlength="PASSWORD_MAX_LENGTH" :value="password" confirm-type="next" @input="onPwd" @confirm="focusPasswordConfirmation" />
            <view class="rg-eye" role="button" tabindex="0" :aria-label="showPwd ? t.register.hidePassword : t.register.showPassword" :aria-pressed="showPwd" @click="showPwd = !showPwd" @keydown.enter.prevent="showPwd = !showPwd" @keydown.space.prevent="showPwd = !showPwd">
              <svg v-if="showPwd" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><path d="m2 2 20 20" /></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
            </view>
          </view>
          <view class="rg-field-wrap" :class="{ 'rg-field-wrap--err': confirmPwd && (!pwdOk || password !== confirmPwd) }">
            <input id="rg-confirm-password" class="rg-field rg-field--flex" :cursor-spacing="keyboardSpacing.confirmPassword" :type="showPwd ? 'text' : 'password'" :placeholder="t.register.confirmPasswordPlaceholder" :aria-label="t.register.confirmPasswordPlaceholder" :maxlength="PASSWORD_MAX_LENGTH" :value="confirmPwd" :focus="confirmPasswordFocused" confirm-type="done" @input="onConfirm" @blur="confirmPasswordFocused = false" @confirm="onCta" />
            <view v-if="pwdMatch" class="rg-check">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>
            </view>
          </view>
        </view>
      </view>

      <view v-if="reviewNotice" class="rg-review">
        <text class="rg-review__title">{{ t.register.rewardReviewTitle }}</text>
        <text class="rg-review__body">{{ reviewNoticeBody }}</text>
      </view>
      <!-- Error -->
      <view v-if="inlineError" id="rg-error" class="rg-error" role="alert" aria-live="assertive">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
        <text class="rg-error__t">{{ inlineError }}</text>
      </view>

      <!-- Status notice: the condition panel right above the CTA it blocks (03 §3.1), so the greyed button's reason and
           its way forward sit next to it. Shared tint, the sentence left and its text action right (03 §3.6.1). -->
      <view v-if="registrationNeedsLogin" class="rg-status nx-tint" role="status">
        <text id="rg-status-reason" class="rg-status__t">{{ t.register.registrationSignInRequired }}</text>
        <NxButton variant="text" size="small" :label="t.register.signIn" @click="goLogin" />
      </view>
      <view v-else-if="registrationResultPending" class="rg-status nx-tint" role="status">
        <text id="rg-status-reason" class="rg-status__t">{{ blockingStatusReason }}</text>
        <NxButton variant="text" size="small" :label="t.login.recoverAttempt" @click="recoverOriginalLogin" />
      </view>
      <!-- Primary CTA -->
      <!-- A greyed CTA still takes the tap, so onCta can put the reason in the error line: no `disabled` prop, only the
           50% look and aria-disabled (03 §3.1). Busy shows NxButton's spinner and takes no taps. -->
      <NxButton
        class="rg-cta"
        :class="{ 'rg-cta--off': !ctaEnabled && !busy }"
        data-system-chrome-primary
        variant="primary"
        :label="ctaLabel"
        :busy="busy"
        :disabled="registrationResultPending"
        :aria-disabled="!ctaEnabled || busy"
        :aria-describedby="ctaDescriptionId"
        @click="onCta"
      />
      <!-- 03 §3.1: a greyed CTA shows its reason in a neutral line below it from the first frame. While the error line
           directly above is showing, that line carries the reason and the button points to it instead. The line keeps its height
           when it has nothing to say, hidden from view and from screen readers, so nothing below jumps. -->
      <text id="rg-cta-reason" class="rg-cta-reason" :class="{ 'rg-cta-reason--off': !showCtaReason }" :aria-hidden="showCtaReason ? undefined : 'true'">{{ ctaDisabledReason }}</text>

      <!-- OAuth (step 1) -->
      <ThirdPartyAuth v-if="remoteApiEnabled && step === 1" :disabled="busy || authApi.pendingLogin()" :sponsor-code="lockedRef || invite" :before-start="manualInviteAccepted" :sponsor-rejected="rejectSponsorCode" @busy="oauthBusy = $event" />
      <view v-if="step === 1 && !remoteApiEnabled" class="rg-oauth">
        <view class="rg-divider"><view class="rg-divider__line" /><text class="rg-divider__t">{{ t.register.orContinueWith }}</text><view class="rg-divider__line" /></view>
        <AuthProviderGrid :busy="busy" :development="apiRuntimeConfig.environment === 'dev'" @select="startOauth" />
      </view>

      <!-- Footer -->
      <view class="rg-footer">
        <text v-if="step === 1" class="rg-footer__acc">{{ t.register.haveAccount }} <text class="rg-footer__link" role="link" tabindex="0" @click="goLogin" @keydown.enter.prevent="goLogin">{{ t.register.signIn }}</text></text>
        <text class="rg-footer__terms">{{ t.register.termsPrefix }}<text class="rg-footer__terms-link active:opacity-70" role="link" tabindex="0" @click="goTerms" @keydown.enter.prevent="goTerms">{{ t.register.termsServiceLink }}</text> · <text class="rg-footer__terms-link active:opacity-70" role="link" tabindex="0" @click="goPrivacy" @keydown.enter.prevent="goPrivacy">{{ t.privacy.title }}</text></text>
      </view>
    </view>
    <!-- #ifdef H5 -->
    <view v-if="keyboardInset" :style="{ height: keyboardInset + 'px' }" />
    <!-- #endif -->

    <CountryCodeSheet :open="showCountries" :model-value="country" @select="pickCountry" @close="showCountries = false" />
    <!-- i18n-en-ok: Server CAPTCHA protocol scene enum, sent only to backend verification and never rendered. -->
    <ServerCaptchaSlider v-if="showCaptcha && remoteApiEnabled" :phone="fullPhone" :scene='"REGISTER"' @success="onCaptchaOk" @close="showCaptcha = false" />
    <CaptchaSlider v-else-if="showCaptcha" :phone="fullPhone" @success="onCaptchaOk" @close="showCaptcha = false" />
    <GlobalUi />
  </StandalonePageShell>
</template>

<script setup lang="ts">
import ThirdPartyAuth from "@/components/third-party-auth.vue";
import { displayNickname } from "@/lib/brand-copy";
import { formatAmount } from "@/lib/amount-display";
import { privacyPolicyHref } from "@/lib/privacy-return";
import ServerCaptchaSlider from "@/components/server-captcha-slider.vue";
import { navReset, navTo, takeNavigationQuery } from "@/lib/route";
import { ref, computed, nextTick, onUnmounted, watch } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import StandalonePageShell from "@/components/device/standalone-page-shell.vue";
import BrandLockup from "@/components/brand-lockup.vue";
import GlobalUi from "@/components/global-ui.vue";
import CaptchaSlider from "@/components/captcha-slider.vue";
import CountryCodeSheet from "@/components/country-code-sheet.vue";
import OtpCodeInput from "@/components/otp-code-input.vue";
import NxButton from "@/components/ui/nx-button.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import LiquidGlass from "@/components/liquid-glass.vue";
import { useHeaderSystemBack } from "@/composables/use-dialog-a11y";
import { useKeyboardPrimaryReach } from "@/composables/use-keyboard-primary-reach";
import { useOtpResend } from "@/composables/use-otp-resend";
import AuthProviderGrid from "@/components/auth-provider-grid.vue";
import { useT } from "@/i18n/use-t";
import { useLocaleStore } from "@/store/locale";
import { geoPolicyUserMessage } from "@/api/geo-policy-error";
import { apiClient, apiRuntimeConfig, authApi, remoteApiEnabled } from "@/api/runtime";
import { apiEnvironmentBadgeLabel } from "@/api/runtime-config";
import type { OAuthProvider, RegistrationRequest } from "@/api/auth-api";
import { createPublicSponsorPreviewApi } from "@/api/public-sponsor-preview-api";
import { registerMockAuthCredential } from "@/api/mock-auth-api";
import { registerAndLogin, requiresOriginalRegistrationRecovery } from "@/auth/registration-auto-login";
import { normalizeRegistrationSponsorCode } from "@/auth/registration-sponsor";
import {
  exchangeVerifiedSignIn,
  finalizeVerifiedRegistration,
  otpSend,
  otpVerify,
  registerVerifiedPhone,
} from "@/store/auth-otp";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import { normalizeRefCode, useSponsorship } from "@/store/sponsorship";
import { rebindAccountScopedStores } from "@/lib/account-scope";
import { useConfig } from "@/store/config";
import { fmt } from "@/i18n/format";
import { evaluateRegistration, commitRegistration, type RegistrationAssessment } from "@/store/risk-cluster";
import { pickSponsor, type SponsorMeta } from "@/mock/sponsors";
import { toast } from "@/store/ui";
import { isPasswordOk, PASSWORD_MAX_LENGTH } from "@/auth/password-rules";
import { completeSignIn } from "@/auth/complete-sign-in";
import { restoreActivatedRegistrationSession } from "@/auth/complete-registration";
import { stageRemoteRegistrationReceipt, clearRemoteRegistrationReceipt } from "@/auth/remote-registration-receipt";
import { dialCodeForLocale, phoneFormatHint, sanitizePhoneInput, validateNationalPhone } from "@/auth/phone-number";
import { newcomerSubtitleKind, visibleReferralGift } from "@/lib/referral-reward-gate";
import { ApiError } from "@/api/errors";

const t = useT();
const app = useApp();
const bills = useBills();
const sponsorship = remoteApiEnabled ? null : useSponsorship();
const cfg = useConfig();
const publicSponsorPreviewApi = createPublicSponsorPreviewApi(apiClient);
// 礼包金额单源派生自 platform config(禁本地常量镜像)；远程模式已合并 /api/config/referral-rewards。
// 新人礼包不再需要邀请人，无邀请码时同样读取。
const localGift = computed(() => visibleReferralGift(cfg.config.rewards));
// H8 闸门关闭或未配置金额时，注册页不承诺新人奖励。
const rewardGateEnabled = computed(() => cfg.config.rewards.enabled);
const newcomerSubtitle = computed(() => newcomerSubtitleKind(rewardGateEnabled.value, giftUsdt.value, giftNex.value));
const giftUsdt = computed(() => localGift.value.usdtAmount);
const giftNex = computed(() => localGift.value.nexAmount);
const giftLabel = computed(() => [
  giftUsdt.value > 0 ? `${formatAmount(giftUsdt.value)}\u00A0USDT` : "",
  giftNex.value > 0 ? `${formatAmount(giftNex.value)}\u00A0UVT` : "",
].filter(Boolean).join(" + "));

type Step = 1 | 2 | 3;

interface RemoteRegistrationAttemptContext {
  version: number;
  phone: string;
  challengeNo: string;
}
let pendingRegistrationRecovery: RegistrationRequest | null = null;
const completedRegistrationIdentity = ref<string | null>(null);
const registrationNeedsLogin = computed(() => completedRegistrationIdentity.value === `${country.value}:${phoneClean.value}`);
const step = ref<Step>(1);
// 包 zm T4:初始国家码随 App 语言(仅初始默认;用户手选后以 pickCountry 为准)。
const country = ref(dialCodeForLocale(useLocaleStore().code));
const showCountries = ref(false);
const phone = ref("");
const code = ref<string[]>(["", "", "", "", "", ""]);
const codeFocus = ref(true);
const invite = ref("");
// The server refused the typed or linked code; shown under the invite field until the user edits it.
const inviteInvalid = ref(false);
const checkingInvite = ref(false);
const password = ref("");
const confirmPwd = ref("");
const showPwd = ref(false);
const confirmPasswordFocused = ref(false);
const error = ref<string | null>(null);
const devBackendDown = ref(false);
const showCaptcha = ref(false);
const registrationRisk = ref<RegistrationAssessment | null>(null);
// OTP + K1 评估进行中(⑤ 加载态): CTA 显示「校验中」,拦重复提交。
const verifying = ref(false);
const completing = ref(false);
const otpRequestId = ref<string | null>(null);
const verifiedToken = ref<string | null>(null);
let verifiedRegistrationCode: string | null = null;
const { resendLeft, refreshResend, startResend, clearResend } = useOtpResend();
let otpFlowVersion = 0;
let mounted = true;
let sponsorPreviewLoadVersion = 0;

// [FEAT-SHARE4] 链接来源码(?ref > pendingRefCode)合法即锁定;非法/缺失视同
// 无码,回到可手输。锁定后无任何解锁入口(防截断归因/换码自荐)。
const lockedRef = ref<string | null>(null);
// kind: a support advisor's code (ADVISOR) is not a friend invitation, so the card says so and shows no V rank.
type SponsorPreview = { displayName: string; vRank: string | null; kind: "USER" | "ADVISOR" };
const sponsorPreview = ref<SponsorPreview | null>(null);

onLoad(async (options) => {
  const forwarded = new URLSearchParams(takeNavigationQuery("/pages/register/register"));
  const raw = options?.ref ?? forwarded.get("ref") ?? undefined;
  privacyHref.value = privacyPolicyHref("/pages/register/register", raw);
  if (remoteApiEnabled) {
    const previewLoadVersion = ++sponsorPreviewLoadVersion;
    lockedRef.value = null;
    sponsorPreview.value = null;
    const norm = normalizeRegistrationSponsorCode(raw, true);
    if (!norm) return;
    // Keep attribution while the display preview loads or fails; registration validates the sponsor.
    lockedRef.value = norm;
    try {
      const preview = await publicSponsorPreviewApi.preview(norm);
      if (!mounted || previewLoadVersion !== sponsorPreviewLoadVersion) return;
      lockedRef.value = preview.code;
      sponsorPreview.value = { ...preview.sponsor, kind: preview.kind };
    } catch (cause) {
      if (!mounted || previewLoadVersion !== sponsorPreviewLoadVersion) return;
      sponsorPreview.value = null;
      if (cause instanceof ApiError && ["REFERRAL_PREVIEW_INVALID", "REFERRAL_PREVIEW_NOT_FOUND"].includes(cause.message))
        lockedRef.value = null;
    }
    return;
  }
  const norm = normalizeRefCode(raw) ?? sponsorship?.pendingCode;
  if (norm) {
    lockedRef.value = norm;
    const mock = pickSponsor(norm);
    sponsorPreview.value = { displayName: mock.name, vRank: `V${mock.vRank}`, kind: "USER" };
  }
});

const phoneClean = computed(() => phone.value.replace(/\s+/g, ""));
// 包 zm T5:主市场国别位数即时校验(不合法禁发送并就地提示);未列国别退回通用 6-15。
const phoneOk = computed(() => validateNationalPhone(country.value, phoneClean.value));
const phoneFormatMessage = computed(() => {
  const params = { example: phoneFormatHint(country.value) };
  return phone.value && !phoneOk.value
    ? fmt(t.value.countryCodes.phoneInvalidHint, params)
    : fmt(t.value.countryCodes.phoneExampleHint, params);
});
const modeLabel = computed(() => apiEnvironmentBadgeLabel(apiRuntimeConfig, t.value.security.developmentModeLabel));
const developmentOtpCode = String(import.meta.env.VITE_NEXGRID_DEV_OTP_CODE || "").trim();
const developmentOtpEnabled = computed(() =>
  apiRuntimeConfig.environment === "dev"
  && /^\d{6}$/.test(developmentOtpCode)
);
const fullPhone = computed(() => `${country.value}${phoneClean.value}`);
const codeStr = computed(() => code.value.join(""));
const codeOk = computed(() => /^\d{6}$/.test(codeStr.value));
const pwdOk = computed(() => isPasswordOk(password.value, { phone: phoneClean.value }));
const pwdMatch = computed(() => password.value === confirmPwd.value && pwdOk.value);
const oauthBusy = ref(false);
const busy = computed(() => verifying.value || completing.value || oauthBusy.value || checkingInvite.value);
// The durable attempt is pending even while its original POST is in flight.
const registrationResultPending = ref(false);
function syncRegistrationResult() {
  registrationResultPending.value = !busy.value && authApi.pendingLogin();
}
onShow(syncRegistrationResult);
watch(busy, syncRegistrationResult, { immediate: true, flush: "sync" });
const resendInText = computed(() => (t.value.register.resendIn || "{s}s").replace("{s}", String(resendLeft.value)));
const waitingToResend = computed(() => step.value === 1 && !otpRequestId.value && resendLeft.value > 0);
const ctaEnabled = computed(() => !registrationNeedsLogin.value && !registrationResultPending.value && !waitingToResend.value
  && (step.value === 1 ? phoneOk.value : step.value === 2 ? codeOk.value : pwdMatch.value));
const ctaLabel = computed(() =>
  step.value === 2 && verifiedToken.value
    ? verifying.value ? t.value.register.signingIn : t.value.register.retrySignIn
    : step.value === 2 && verifying.value
      ? t.value.register.verifying
    : step.value === 3 && completing.value
      ? t.value.register.creating
    : step.value === 1
      ? t.value.register.sendCode
      : step.value === 2
        ? t.value.register.verify
        : t.value.register.finish,
);
const blockingStatusReason = computed(() => {
  if (registrationNeedsLogin.value) return t.value.register.registrationSignInRequired;
  if (registrationResultPending.value) return pendingRegistrationRecovery
    ? t.value.register.registrationOutcomeUnknown : t.value.login.unknownAttempt;
  return "";
});
const ctaDisabledReason = computed(() => {
  if (blockingStatusReason.value) return blockingStatusReason.value;
  if (waitingToResend.value) return resendInText.value;
  if (step.value === 1) return t.value.register.ctaDisabledPhone;
  if (step.value === 2) return t.value.register.ctaDisabledCode;
  return t.value.register.ctaDisabledPassword;
});
const inlineError = computed(() => error.value === blockingStatusReason.value ? null : error.value);
const ctaDescriptionId = computed(() => {
  if (ctaEnabled.value || busy.value) return undefined;
  if (blockingStatusReason.value) return "rg-status-reason";
  return inlineError.value ? "rg-error" : "rg-cta-reason";
});
const showCtaReason = computed(() => ctaDescriptionId.value === "rg-cta-reason");
function showOauthUnavailable(provider: string) {
  toast.info(fmt(t.value.register.oauthUnavailableTitle, { provider }), t.value.register.oauthUnavailableBody);
}

function oauthProvider(label: string): OAuthProvider | null {
  return label === "Google" ? "GOOGLE"
    : label === "Apple" ? "APPLE"
    : label === "Passkey" ? "PASSKEY"
    : label === "Telegram" ? "TELEGRAM"
    : null;
}

function oauthError(cause: unknown, provider: OAuthProvider): string {
  const code = cause instanceof Error ? cause.message : "";
  if (code === "OAUTH_PROVIDER_NOT_CONFIGURED" || code === "OAUTH_PROVIDER_UNAVAILABLE"
      ) {
    return `${fmt(t.value.register.oauthUnavailableTitle, { provider })}: ${t.value.register.oauthUnavailableBody}`;
  }
  return t.value.authOtp.errorServiceUnavailable;
}

async function startOauth(label: string) {
  const provider = oauthProvider(label);
  if (!provider || !remoteApiEnabled) {
    showOauthUnavailable(label);
    return;
  }
  if (busy.value) return;
  const flowVersion = ++otpFlowVersion;
  completing.value = true;
  error.value = null;
  try {
    const result = await authApi.oauthExchange({
      provider,
      displayName: `${provider} User`,
    });
    if (!mounted || flowVersion !== otpFlowVersion) {
      authApi.discardSessionIfCurrent(result.vaultRevision);
      return;
    }
    const completed = completeSignIn({
      identity: `user:${result.user.userId}`,
      onboardingComplete: result.user.onboardingComplete,
      serverProfile: result.user,
      serverSessionRevision: result.vaultRevision,
    });
    if (!completed.ok) {
      completing.value = false;
      error.value = t.value.authOtp.errorServiceUnavailable;
    }
  } catch (cause) {
    if (!mounted || flowVersion !== otpFlowVersion) return;
    completing.value = false;
    error.value = oauthError(cause, provider);
  }
}
const reviewNotice = computed(() => registrationRisk.value !== null && registrationRisk.value.cluster.status !== "clear");
// 分因提示: 同簇重复账号用「设备已有账号活动」口径;裸号/未绑定用「先审核,绑定后释放」口径。
const reviewNoticeBody = computed(() => {
  const c = registrationRisk.value?.cluster;
  if (!c) return "";
  const dup = c.reasons.includes("duplicate-pending-line") || c.reasons.includes("duplicate-freeze-line");
  const bare = c.reasons.includes("bare-identity") || c.reasons.includes("unbound-free-slot");
  return !dup && bare ? t.value.register.rewardReviewBodyUnbound : t.value.register.rewardReviewBody;
});
// Seeds include the reason line's 28px slot below the button.
const { spacing: keyboardSpacing, inset: keyboardInset } = useKeyboardPrimaryReach({
  root: ".rg-root", form: ".rg-wrap", primary: ".rg-cta", primaryDescription: "#rg-cta-reason",
  inputs: {
    phone: { selector: ".rg-phone__in", seed: 209 },
    invite: { selector: "#rg-invite", seed: 108 },
    otp: { selector: ".rg-otp", seed: 144 },
    password: { selector: "#rg-password", seed: 176 },
    confirmPassword: { selector: "#rg-confirm-password", seed: 108 },
  },
  layout: () => [step.value, inlineError.value, blockingStatusReason.value, ctaDisabledReason.value,
    reviewNotice.value && reviewNoticeBody.value, inviteInvalid.value, devBackendDown.value,
    lockedRef.value, !!sponsorPreview.value, phoneFormatMessage.value, developmentOtpEnabled.value],
});

function invalidateOtpFlow() {
  otpFlowVersion += 1;
  pendingRegistrationRecovery = null;
  verifying.value = false;
}

function clearOtpChallenge() {
  otpRequestId.value = null;
  verifiedToken.value = null;
  verifiedRegistrationCode = null;
}

function changeOtpNumber() {
  invalidateOtpFlow();
  clearOtpChallenge();
  clearResend();
}

// uni <input> delivers the value on e.detail.value at runtime; vue-tsc types
// the payload as a DOM Event, so we read detail through a narrow cast helper.
function inputVal(e: Event): string {
  return (e as unknown as { detail: { value: string } }).detail.value;
}
function onPhone(e: Event) {
  const next = sanitizePhoneInput(inputVal(e));
  if (phone.value !== next) changeOtpNumber();
  phone.value = next;
  error.value = null;
  registrationRisk.value = null;
}
function onInvite(e: Event) { invite.value = inputVal(e); inviteInvalid.value = false; error.value = null; registrationRisk.value = null; }
function onCode(value: string) {
  code.value = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
  error.value = null;
  if (codeOk.value) verifyCode();
}
// Puts the keyboard back on the code field after the code is cleared.
function focusCode() {
  codeFocus.value = false;
  void nextTick(() => { codeFocus.value = true; });
}
function onPwd(e: Event) { password.value = inputVal(e); error.value = null; }
function onConfirm(e: Event) { confirmPwd.value = inputVal(e); error.value = null; }
function focusPasswordConfirmation() {
  confirmPasswordFocused.value = false;
  void nextTick(() => { confirmPasswordFocused.value = true; });
}

function pickCountry(c: string) {
  if (country.value !== c) changeOtpNumber();
  country.value = c;
  error.value = null;
  showCountries.value = false;
}

function onCta() {
  if (busy.value) return;
  if (requiresOriginalRegistrationRecovery(authApi, { countryCode: country.value, phone: phoneClean.value })) {
    error.value = t.value.login.unknownAttempt;
    return;
  }
  if (!ctaEnabled.value) {
    // The existing reason line counts down until a fresh send is possible.
    error.value = waitingToResend.value ? null : ctaDisabledReason.value;
    return;
  }
  if (step.value === 1) void goSendCode();
  else if (step.value === 2) verifyCode();
  else void finish();
}
async function goSendCode() {
  error.value = null;
  if (!phoneOk.value) { error.value = t.value.register.errorInvalidPhone; return; }
  const flowVersion = otpFlowVersion;
  if (!(await manualInviteAccepted())) return;
  // The phone or country changed while the code was being checked; the user sends again.
  if (flowVersion !== otpFlowVersion || step.value !== 1 || !phoneOk.value) return;
  void requestCode();
}
// A typed code is checked before an OTP is sent or a third-party sign-up starts,
// because the server consumes the OTP before it rejects the code. A link code
// was already previewed when it was locked. Only an explicit not-found/invalid
// answer blocks; a failed check is no verdict, and registration still validates the code.
async function manualInviteAccepted(): Promise<boolean> {
  const typed = invite.value;
  if (!remoteApiEnabled || lockedRef.value || !typed.trim()) return true;
  const sponsorCode = normalizeRegistrationSponsorCode(typed, true);
  if (!sponsorCode) { inviteInvalid.value = true; return false; }
  checkingInvite.value = true;
  try {
    await publicSponsorPreviewApi.preview(sponsorCode);
  } catch (cause) {
    if (cause instanceof ApiError && ["REFERRAL_PREVIEW_INVALID", "REFERRAL_PREVIEW_NOT_FOUND"].includes(cause.message)) {
      if (mounted && invite.value === typed) inviteInvalid.value = true;
      return false;
    }
  } finally {
    checkingInvite.value = false;
  }
  // The user edited the code while it was being checked; let them submit again.
  return mounted && invite.value === typed;
}
// The server refused the code at submit or third-party sign-up. It refused what was
// sent, so the box is only marked if it still holds that code. A link code can stop
// working after it was locked; reopen the field with it so the user can fix or clear it.
function rejectSponsorCode(sent: string | null) {
  if (normalizeRegistrationSponsorCode(sent, remoteApiEnabled) !== currentSponsorCode()) return;
  if (lockedRef.value) {
    invite.value = lockedRef.value;
    lockedRef.value = null;
    sponsorPreview.value = null;
  }
  inviteInvalid.value = true;
}
// FEAT-AUTH01: 发码统一走闸门(冷却/24h 限频/滑块);倒计时以 server 返回值为准。
async function requestCode(captchaTicket?: string) {
  if (verifying.value) return;
  devBackendDown.value = false;
  if (step.value === 1 && refreshResend() > 0) {
    if (!otpRequestId.value) return;
    focusCode();
    step.value = 2;
    return;
  }
  const phoneAtRequest = fullPhone.value;
  const flowVersion = ++otpFlowVersion;
  verifying.value = true;
  if (remoteApiEnabled) {
    try {
      const res = await authApi.sendRegistrationOtp({
        countryCode: country.value,
        phone: phoneClean.value,
        ...(captchaTicket ? { captchaTicket } : {}),
      });
      if (!mounted || flowVersion !== otpFlowVersion || fullPhone.value !== phoneAtRequest) return;
      verifying.value = false;
      otpRequestId.value = res.challengeNo;
      verifiedToken.value = null;
      verifiedRegistrationCode = null;
      code.value = ["", "", "", "", "", ""];
      focusCode();
      step.value = 2;
      startResend(res.resendAfterSec);
    } catch (cause) {
      if (!mounted || flowVersion !== otpFlowVersion || fullPhone.value !== phoneAtRequest) return;
      verifying.value = false;
      if (cause instanceof Error && ["USER_CAPTCHA_REQUIRED", "USER_CAPTCHA_TICKET_INVALID"].includes(cause.message)) {
        showCaptcha.value = true;
      } else {
        error.value = cause instanceof ApiError && cause.message === "USER_REGISTRATION_DEVICE_LIMIT"
          ? t.value.register.errorDeviceSignupLimited
          : cause instanceof ApiError && cause.message === "USER_REGISTRATION_K1_IP_LIMIT"
            ? t.value.register.errorSignupLimited : geoText(cause) ?? t.value.authOtp.errorOtpSendUnavailable;
      }
      // 开发构建里区分「产品坏了」与「本地后端没起」——网络级失败时亮工程横幅。
      if (import.meta.env.DEV) devBackendDown.value = apiRuntimeConfig.environment === "dev" && cause instanceof ApiError && cause.kind === "network";
    }
    return;
  }
  const res = await otpSend(phoneAtRequest, "register", captchaTicket);
  if (!mounted || flowVersion !== otpFlowVersion || fullPhone.value !== phoneAtRequest) return;
  verifying.value = false;
  if (res.ok) {
    otpRequestId.value = res.requestId;
    verifiedToken.value = null;
    code.value = ["", "", "", "", "", ""];
    focusCode();
    step.value = 2;
    startResend(res.resendAfterSec);
    return;
  }
  if (res.error === "captcha_required") { showCaptcha.value = true; return; }
  if (res.error === "rate_limited") {
    // 规格 ⑤(AUTH01/AUTH03 同口径):冷却中被拒 → Toast 剩余秒数;inline 错误条留给 verify 类错误。
    toast.info(fmt(t.value.authOtp.errorTooFrequent, { s: res.retryAfterSec }));
    if (step.value === 2) startResend(res.retryAfterSec);
  }
}
function onCaptchaOk(ticket: string) {
  showCaptcha.value = false;
  void requestCode(ticket);
}
function resend() {
  if (refreshResend() > 0) return;
  error.value = null;
  void requestCode();
}
function currentSponsorCode(): string | null {
  // 锁定码优先(?ref / pendingRefCode);仅无锁定时才取手输([FEAT-SHARE4] ③)。
  return lockedRef.value || normalizeRegistrationSponsorCode(invite.value, remoteApiEnabled);
}
// A region-policy refusal reaches this page two ways: as a code on an OTP/
// registration result, or as a thrown error out of the registration transaction.
// `geoPolicyUserMessage` reads both shapes. `null` means it wasn't a region
// refusal, and the caller must fall through to its existing mapping — otherwise
// an unrelated failure would be reported to the user as a region block.
function geoText(code: unknown): string | null {
  return geoPolicyUserMessage(code, t.value.geoPolicy);
}

function isCurrentRemoteRegistrationAttempt(context: RemoteRegistrationAttemptContext): boolean {
  return mounted
    && context.version === otpFlowVersion
    && step.value === 3
    && fullPhone.value === context.phone
    && otpRequestId.value === context.challengeNo;
}

function registrationErrorText(cause: unknown): string {
  const code = cause instanceof Error ? cause.message : "";
  if (code === "USER_REGISTRATION_SPONSOR_ENVIRONMENT_MISMATCH") {
    return t.value.register.sponsorEnvironmentMismatch;
  }
  return geoText(cause) ?? t.value.authOtp.errorServiceUnavailable;
}

function recoverRejectedRegistration(cause: unknown, sentSponsorCode: string | null): boolean {
  if (!(cause instanceof ApiError) || cause.kind !== "http") return false;
  const invalidOtp = cause.status === 422 && cause.message === "USER_REGISTRATION_OTP_INVALID";
  const signupLimited = cause.status === 409 && ["USER_REGISTRATION_K1_IP_LIMIT", "USER_REGISTRATION_DEVICE_LIMIT"].includes(cause.message);
  const sponsorRejected = cause.message === "USER_REGISTRATION_SPONSOR_NOT_FOUND" || cause.message === "USER_REGISTRATION_SPONSOR_INVALID";
  if (!invalidOtp && !signupLimited && !sponsorRejected) return false;
  // These refusals leave no new account; the challenge cannot be reused.
  // A user-requested resend must still pass the normal CAPTCHA and rate limits.
  invalidateOtpFlow();
  clearOtpChallenge();
  code.value = ["", "", "", "", "", ""];
  focusCode();
  refreshResend();
  step.value = invalidOtp ? 2 : 1;
  if (sponsorRejected) {
    rejectSponsorCode(sentSponsorCode);
    return true;
  }
  error.value = invalidOtp ? t.value.authOtp.errorOtpInvalidOrExpired
    : cause.message === "USER_REGISTRATION_DEVICE_LIMIT" ? t.value.register.errorDeviceSignupLimited : t.value.register.errorSignupLimited;
  return true;
}

async function verifyCode() {
  if (verifying.value) return;
  error.value = null;
  if (!remoteApiEnabled && verifiedToken.value) {
    verifying.value = true;
    exchangeVerifiedAccount(verifiedToken.value, fullPhone.value, otpFlowVersion);
    return;
  }
  if (!codeOk.value) { error.value = t.value.register.errorInvalidCode; return; }
  // Verify before password setup; registration still atomically rechecks and
  // consumes the code, just like the password-reset flow.
  if (remoteApiEnabled) {
    const requestId = otpRequestId.value;
    if (!requestId) { error.value = t.value.authOtp.errorOtpNotFound; return; }
    const phoneAtVerify = fullPhone.value;
    const codeAtVerify = codeStr.value;
    const flowVersion = otpFlowVersion;
    const isCurrent = () => mounted && flowVersion === otpFlowVersion
      && step.value === 2 && otpRequestId.value === requestId && fullPhone.value === phoneAtVerify;
    verifying.value = true;
    try {
      await authApi.verifyRegistrationOtp({
        countryCode: country.value,
        phone: phoneClean.value,
        challengeNo: requestId,
        code: codeAtVerify,
      });
    } catch (cause) {
      if (!isCurrent()) return;
      verifying.value = false;
      if (codeStr.value !== codeAtVerify) return;
      const invalidOtp = cause instanceof ApiError && cause.message === "USER_REGISTRATION_OTP_INVALID";
      // The API uses the same refusal for wrong digits and an inactive challenge.
      if (invalidOtp && codeAtVerify === verifiedRegistrationCode) clearOtpChallenge();
      error.value = invalidOtp
        ? t.value.authOtp.errorOtpInvalidOrExpired
        : registrationErrorText(cause);
      return;
    }
    if (!isCurrent()) return;
    verifying.value = false;
    if (codeStr.value === codeAtVerify) {
      verifiedRegistrationCode = codeAtVerify;
      step.value = 3;
    }
    return;
  }
  // ⚠️ MOCK-ONLY: PRD 已列的 OTP verify 的 TTL/attempts/一码一与验后账号分流
  // 在 auth-otp mock；K1 注册评估仍在下方 client mock 执行，不能声称由本次 OTP
  // 响应返回。PROD 应由注册事务（endpoint/回执契约 TBD）原子重校验 verifyToken、
  // K1 与唯一性，并只返回服务端结论。
  verifying.value = true;
  const requestId = otpRequestId.value;
  if (!requestId) { verifying.value = false; error.value = t.value.authOtp.errorOtpNotFound; return; }
  const phoneAtVerify = fullPhone.value;
  const flowVersion = otpFlowVersion;
  const res = await otpVerify(phoneAtVerify, "register", requestId, codeStr.value);
  if (
    !mounted
    || flowVersion !== otpFlowVersion
    || step.value !== 2
    || otpRequestId.value !== requestId
    || fullPhone.value !== phoneAtVerify
  ) return;
  if (!res.ok) {
    verifying.value = false;
    const geo = geoText(res.error);
    if (geo) { error.value = geo; return; }
    if (res.error === "otp_invalid") {
      error.value = fmt(t.value.authOtp.errorOtpInvalid, { n: res.attemptsLeft });
    } else if (res.error === "otp_expired") {
      error.value = t.value.authOtp.errorOtpExpired;
    } else if (res.error === "otp_attempts_exceeded") {
      error.value = t.value.authOtp.errorOtpExhausted;
      code.value = ["", "", "", "", "", ""];
      focusCode();
    } else if (res.error === "account_lookup_failed") {
      error.value = t.value.authOtp.errorServiceUnavailable;
    } else {
      error.value = t.value.authOtp.errorOtpNotFound;
    }
    return;
  }
  verifiedToken.value = res.verifyToken;
  if (res.nextAction === "sign_in") {
    exchangeVerifiedAccount(res.verifyToken, phoneAtVerify, flowVersion);
    return;
  }
  if (res.nextAction !== "continue_registration") {
    verifying.value = false;
    verifiedToken.value = null;
    error.value = t.value.authOtp.errorServiceUnavailable;
    return;
  }
  const assessment = evaluateRegistration(prospectiveIdentity(), { sponsorId: currentSponsorCode() });
  registrationRisk.value = assessment;
  verifying.value = false;
  // 只在最终 reserve 时执行 signup gate：验码后的 pending 恢复必须先由
  // 账号目录识别并沿用冻结上下文，不能被此刻变化的页面/K1 临时态拦断。
  step.value = 3;
}
async function exchangeVerifiedAccount(token: string, phoneAtVerify: string, flowVersion: number) {
  if (!mounted || flowVersion !== otpFlowVersion || fullPhone.value !== phoneAtVerify) return;
  const exchange = exchangeVerifiedSignIn(phoneAtVerify, token);
  if (!exchange.ok) {
    verifying.value = false;
    if (exchange.error !== "account_directory_unavailable") verifiedToken.value = null;
    // 第三条同形路径:老号在注册页触发的自动登录。它消费的错误与 login.vue 已接的
    // 是同一个函数、同一个类型 —— 漏接会导致同一种拒绝在两条路上显示不同文案。
    error.value = geoText(exchange.error) ?? (exchange.error === "account_directory_unavailable"
      ? t.value.authOtp.errorServiceUnavailable
      : t.value.authOtp.errorOtpExpired);
    return;
  }
  // 立即进入既有登录完成链，不以人为计时器阻塞；toast 会随目标页面的 GlobalUi
  // 保留“已注册 / 正在登录”的可读反馈。
  toast.info(t.value.register.accountExistsTitle, t.value.register.accountExistsSigningIn);
  await nextTick();
  if (!mounted || flowVersion !== otpFlowVersion || fullPhone.value !== phoneAtVerify) return;
  const completed = completeSignIn({
    identity: exchange.accountId,
    sponsorCode: currentSponsorCode(),
    idempotencyKey: exchange.signInIdempotencyKey,
    onboardingComplete: exchange.onboardingComplete,
  });
  if (!completed.ok) {
    verifying.value = false;
    error.value = geoText(completed.error) ?? (completed.error === "account_pending"
      ? t.value.login.errorRegistrationIncomplete
      : t.value.authOtp.errorServiceUnavailable);
  }
}
async function finish() {
  if (completing.value || registrationNeedsLogin.value) return;
  if (requiresOriginalRegistrationRecovery(authApi, { countryCode: country.value, phone: phoneClean.value })) {
    error.value = t.value.login.unknownAttempt;
    return;
  }
  error.value = null;
  if (!pwdOk.value) { error.value = t.value.register.errorWeakPassword; return; }
  if (!pwdMatch.value) { error.value = t.value.register.passwordMismatch; return; }
  if (remoteApiEnabled) {
    const challengeNo = otpRequestId.value;
    if (!challengeNo) {
      error.value = t.value.authOtp.errorOtpExpired;
      step.value = 2;
      return;
    }
    const registrationAttempt: RemoteRegistrationAttemptContext = {
      version: otpFlowVersion,
      phone: fullPhone.value,
      challengeNo,
    };
    const registrationRequest = pendingRegistrationRecovery ?? {
      countryCode: country.value,
      phone: phoneClean.value,
      challengeNo,
      code: codeStr.value,
      password: password.value,
      sponsorCode: currentSponsorCode(),
      language: useLocaleStore().code,
    };
    completing.value = true;
    const registration = await registerAndLogin(authApi, registrationRequest,
      () => isCurrentRemoteRegistrationAttempt(registrationAttempt), pendingRegistrationRecovery !== null);
    if (registration.kind === "stale" || !isCurrentRemoteRegistrationAttempt(registrationAttempt)) return;
    if (registration.kind === "recovery_required") {
      completing.value = false;
      error.value = t.value.login.unknownAttempt;
      return;
    }
    if (registration.kind === "registration_error") {
      completing.value = false;
      if (!recoverRejectedRegistration(registration.error, registrationRequest.sponsorCode ?? null)) {
        error.value = registrationErrorText(registration.error);
      }
      return;
    }
    if (registration.kind === "login_error") {
      // Keep the submitted identity/password until this flow is cancelled;
      // its next explicit attempt must resolve the result before another POST.
      pendingRegistrationRecovery = registrationRequest;
      completing.value = false;
      error.value = t.value.register.registrationOutcomeUnknown;
      return;
    }
    pendingRegistrationRecovery = registrationRequest;
    const completed = completeSignIn({
      identity: `user:${registration.user.userId}`,
      onboardingComplete: registration.user.onboardingComplete,
      serverProfile: registration.user,
      serverSessionRevision: registration.vaultRevision,
      deferNavigation: true,
      returnTo: registrationCompletionDestination(),
    });
    if (!completed.ok) {
      // Registration succeeded; its login attempt is complete. Require an explicit new sign-in.
      pendingRegistrationRecovery = null;
      completedRegistrationIdentity.value = `${registrationRequest.countryCode}:${registrationRequest.phone}`;
      error.value = t.value.register.registrationSignInRequired;
      completing.value = false;
      clearRemoteRegistrationReceipt();
      return;
    }
    pendingRegistrationRecovery = null;
    stageRemoteRegistrationReceipt(registration.registrationReceipt ?? null, `user:${registration.user.userId}`);
    toast.success(t.value.register.registrationSignedIn);
    launchRegistrationSuccess();
    return;
  }
  const identity = prospectiveIdentity();
  const sponsorCode = currentSponsorCode();
  // 完成时点重评(含最新邀请码): R5 口径下评估随调随算,不留步骤间缓存。
  const assessment = evaluateRegistration(identity, { sponsorId: sponsorCode });
  registrationRisk.value = assessment;
  const token = verifiedToken.value;
  if (!token) {
    error.value = t.value.authOtp.errorOtpExpired;
    step.value = 2;
    code.value = ["", "", "", "", "", ""];
    clearOtpChallenge();
    refreshResend();
    return;
  }
  completing.value = true;
  const accountResult = registerVerifiedPhone(fullPhone.value, token, {
    sponsorCode,
    giftRoute: assessment.giftRoute,
    allowCreate: assessment.gateRoute !== "manual_or_reject",
  });
  if (!accountResult.ok) {
    if (accountResult.error === "account_exists") {
      completing.value = false;
      step.value = 2;
      verifying.value = true;
      exchangeVerifiedAccount(token, fullPhone.value, otpFlowVersion);
      return;
    } else if (accountResult.error === "registration_blocked") {
      error.value = t.value.register.errorSignupLimited;
    } else {
      // 同形第四条:漏接会把地区拒单报成「验证码已过期」,用户重发验证码→再被拒→循环,
      // 那是主动误导,不只是缺文案。
      error.value = geoText(accountResult.error) ?? (accountResult.error === "account_directory_unavailable"
        ? t.value.authOtp.errorServiceUnavailable
        : t.value.authOtp.errorOtpExpired);
    }
    completing.value = false;
    return;
  }
  // 包 zm F2:legacy 目录不存密码 —— 把本次设置的密码登记进 mock authApi 注册表,
  // 否则 mock 档密码登录永远「查无此人」。两个成功分支(已提交/新建)都要走到,故放在这里。
  registerMockAuthCredential(country.value, phoneClean.value, password.value);
  const previousAccountKey = app.accountKey || "default";
  const restorePreviousAccountScope = () => {
    app.bindAccount(previousAccountKey);
    rebindAccountScopedStores(previousAccountKey);
  };
  if (accountResult.alreadyCommitted) {
    completeActivatedRegistration(accountResult.accountId, restorePreviousAccountScope);
    return;
  }
  const createdIdentity = accountResult.accountId;
  const registration = accountResult.registration;
  if (!registration) {
    completing.value = false;
    error.value = t.value.authOtp.errorServiceUnavailable;
    return;
  }
  // ⚠️ MOCK-ONLY CROSS-STORE MUTATION：注册提交依次写账号目录 pending → 当前
  // account-cloud 作用域 → K1 风险身份 → 推荐绑定/礼包领取 → 奖励余额回执 → 两条
  // 账单 → active finalize。任一步失败不把半成品账号留作当前作用域；已落的业务
  // 副作用由冻结 giftRef + 幂等补齐链在同号重试时收敛。PROD 应由服务端单事务完成
  // （注册提交 endpoint TBD; candidate: `POST /api/auth/register`）。
  try {
    app.bindAccount(createdIdentity);
    rebindAccountScopedStores(createdIdentity);
    if (!commitRegistration(createdIdentity, { sponsorId: registration.sponsorCode })) {
      throw new Error("risk_registration_unavailable");
    }
    if (registration.sponsorCode) {
      if (!sponsorship?.bind(registration.sponsorCode)) throw new Error("sponsor_bind_unavailable");
      if (cfg.config.rewards.enabled) {
        const gift = sponsorship.ensureGiftClaim(createdIdentity, {
          usdt: registration.giftUsdt,
          nex: registration.giftNex,
        });
        if (!gift) throw new Error("gift_claim_unavailable");
        const posted = app.creditRewardBucketOnce(registration.giftRef, registration.giftRoute, gift.usdt, gift.nex);
        if (!posted) throw new Error("gift_credit_unavailable");
        const giftRef = registration.giftRef;
        const giftPosted = registration.giftRoute === "withdrawable";
        const giftMemo = giftPosted ? t.value.register.giftBillMemo : t.value.register.giftPendingBillMemo;
        const usdtBill = bills.addOnce({ type: "bonus", symbol: "USDT", amount: gift.usdt, status: giftPosted ? "posted" : "pending", memo: giftMemo, ref: giftRef });
        const nexBill = bills.addOnce({ type: "bonus", symbol: "UVT", amount: gift.nex, status: giftPosted ? "posted" : "pending", memo: giftMemo, ref: giftRef });
        if (!usdtBill || !nexBill) throw new Error("gift_bill_unavailable");
        if (posted && giftPosted) {
          toast.success(
            `+$${formatAmount(gift.usdt)} + ${formatAmount(gift.nex)} UVT`,
            sponsorPreview.value?.kind === "USER"
              ? fmt(t.value.register.giftCreditedToastSubSponsor, { name: displayNickname(sponsorPreview.value.displayName) })
              : t.value.register.giftCreditedToastSub,
          );
        } else {
          toast.info(t.value.register.giftPendingToast, t.value.register.giftPendingToastSub);
        }
      }
    }
  } catch (err) {
    restorePreviousAccountScope();
    completing.value = false;
    error.value = geoText(err) ?? t.value.authOtp.errorServiceUnavailable;
    return;
  }
  const finalized = finalizeVerifiedRegistration(fullPhone.value, token);
  if (!finalized.ok) {
    restorePreviousAccountScope();
    completing.value = false;
    // 同形第五条,理由同上。
    error.value = geoText(finalized.error) ?? (finalized.error === "account_directory_unavailable"
      ? t.value.authOtp.errorServiceUnavailable
      : t.value.authOtp.errorOtpExpired);
    return;
  }
  completeActivatedRegistration(finalized.accountId, restorePreviousAccountScope);
}
function completeActivatedRegistration(accountId: string, restorePreviousAccountScope: (() => void) | null = null) {
  // finalize→auth/session 之间中断时，同一注册结果会再次走这里补齐登录态。
  if (!restoreActivatedRegistrationSession(accountId)) {
    restorePreviousAccountScope?.();
    completing.value = false;
    error.value = t.value.authOtp.errorServiceUnavailable;
    return;
  }
  launchRegistrationSuccess();
}
function registrationCompletionDestination(): string {
  return "/pages/register/success";
}
function launchRegistrationSuccess() {
  navReset({ url: registrationCompletionDestination(), fail: () => {} });
}
function prospectiveIdentity() {
  return `${country.value}${phoneClean.value}@demo.nexgrid.ai`;
}
function back() {
  invalidateOtpFlow();
  error.value = null;
  registrationRisk.value = null;
  verifying.value = false;
  completing.value = false;
  if (!remoteApiEnabled) clearOtpChallenge();
  code.value = ["", "", "", "", "", ""];
  focusCode();
  refreshResend();
  step.value = (step.value === 3 ? 2 : 1) as Step;
}
function close() { navReset({ url: "/pages/onboarding/intro", fail: () => {} }); }
// Alone on the stack, the system back does what the top bar's back or close does (02 §2.7.3).
useHeaderSystemBack(() => step.value > 1 ? back : close);
function goLogin() {
  const sponsorCode = lockedRef.value || invite.value.trim();
  const query = sponsorCode ? `?ref=${encodeURIComponent(sponsorCode)}` : "";
  navReset({ url: `/pages/login/login${query}`, fail: () => {} });
}
function recoverOriginalLogin() { if (!completing.value) navTo("/pages/login/login"); }
function goTerms() { navTo("/pages/onboarding/terms"); }
const privacyHref = ref(privacyPolicyHref("/pages/register/register"));
function goPrivacy() { navTo(privacyHref.value); }

function cleanup() {
  mounted = false;
  sponsorPreviewLoadVersion += 1;
  invalidateOtpFlow();
  clearOtpChallenge();
  clearResend();
}
onUnload(() => cleanup());
onUnmounted(() => cleanup());
</script>

<style scoped>
.rg-root { position: fixed; inset: 0; background: var(--v5-bg); overflow-y: auto; }
.rg-wrap { display: flex; flex-direction: column; padding: 16px 24px 0; min-height: 100%; box-sizing: border-box; }
.rg-top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }
.rg-iconbtn { position: relative; width: 44px; height: 44px; margin-left: -2px; display: grid; place-items: center; justify-self: start; }
/* 03 §3.1 顶部图标动作: its own Liquid Glass round face, as on SubPageHeader and the onboarding back; 40 face, 44 target. */
.rg-iconbtn__face { position: relative; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; transition: transform 100ms cubic-bezier(.2, .8, .2, 1); }
.rg-iconbtn__face > svg, .rg-iconbtn__face > .nx-native-svg { position: relative; z-index: 1; }
[data-theme="light"] .rg-iconbtn__face { --ui-control-shadow: var(--v5-glass-shadow); }
.rg-iconbtn:active .rg-iconbtn__face { transform: scale(.92); }
@media (prefers-reduced-motion: reduce) { .rg-iconbtn__face { transition: none; } .rg-iconbtn:active .rg-iconbtn__face { transform: none; } }
/* 《08》§2 按下反馈(同 login) */
.rg-phone__cc:active { opacity: 0.6; }
.rg-brand { display: flex; align-items: center; gap: 6px; justify-self: center; }
.rg-top__sp { }
.rg-sponsor { --nx-tint: var(--v5-brand); margin-top: 16px; border-radius: var(--ui-radius-surface); padding: var(--ui-space-inset); display: flex; align-items: center; gap: 12px; }
.rg-sponsor__av { width: 40px; height: 40px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: linear-gradient(135deg, var(--v5-brand), var(--v5-tech-cyan)); }
.rg-sponsor__av-t { color: var(--v5-on-brand); font-size: 24px; }
.rg-sponsor__body { flex: 1; min-width: 0; }
.rg-sponsor__name { display: block; font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.rg-sponsor__name-b { font-weight: var(--ui-type-list-title-weight); }
.rg-sponsor__gift { display: block; font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); font-variant-numeric: tabular-nums; color: var(--v5-brand); margin-top: 4px; }
.rg-dots { margin-top: 28px; display: flex; align-items: center; gap: 6px; }
/* Upcoming step: foreground 8%, the step-track tone of 04 (onboarding track), so it reads on both page floors. */
.rg-dot { height: 4px; width: 16px; border-radius: 9999px; background: color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.rg-dot--active { width: 32px; background: var(--v5-brand); }
.rg-dot--done { width: 16px; background: color-mix(in srgb, var(--v5-brand) 40%, transparent); }
.rg-title { display: block; font-family: var(--font-v5); margin-top: 12px; font-size: 34px; font-weight: 600; line-height: 1.15; letter-spacing: -0.025em; color: var(--v5-ink); }
.rg-subtitle { display: block; margin-top: 8px; font-size: var(--ui-type-list-subtitle); line-height: var(--ui-type-list-subtitle-lh); color: var(--v5-ink-3); }
.rg-subtitle__hl { color: var(--v5-brand); font-weight: var(--ui-type-list-title-weight); }
.rg-subtitle__ph { font-family: var(--font-v5); color: var(--v5-ink); font-variant-numeric: tabular-nums; }
.rg-body { margin-top: 28px; }
.rg-phone { position: relative; background: var(--v5-surface); border: 1px solid var(--v5-surface-2); border-radius: 16px; height: 56px; display: flex; align-items: center; }
.rg-phone--err { border-color: color-mix(in srgb, var(--v5-danger) 55%, transparent); }
.rg-phone__cc { height: 100%; padding: 0 16px; display: flex; align-items: center; gap: 4px; border-right: 1px solid var(--v5-surface-2); transition: opacity 0.15s; }
.rg-phone__cc-t { font-size: var(--ui-type-body); color: var(--v5-ink); }
.rg-phone__in { flex: 1; height: 100%; background: transparent; padding: 0 16px; font-size: var(--ui-type-input); line-height: var(--ui-type-input-lh); color: var(--v5-ink); }
.rg-step2 { display: flex; flex-direction: column; gap: 20px; }
.rg-development-otp { padding: 8px 12px; border-radius: 12px; background: var(--v5-warning-soft); }
.rg-development-otp__t { font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-warning-ink); }
/* 更换手机号 / 重新发送 are NxButton text S (13/18, brand, 44px target outside layout); the countdown takes the same line. */
.rg-resend { display: flex; align-items: center; justify-content: space-between; font-size: var(--ui-type-list-subtitle); line-height: var(--ui-type-list-subtitle-lh); }
.rg-resend__count { font-family: var(--font-v5); color: var(--v5-ink-3); font-variant-numeric: tabular-nums; }
.rg-invite { margin-top: 20px; }
/* [FEAT-SHARE4] 链接来源码锁定态:同 rg-field 形制但压暗(落在页面底上,只留边界) + 锁标,无输入交互。 */
.rg-locked { display: flex; align-items: center; gap: 8px; background: var(--v5-bg); border: 1px solid var(--v5-border); border-radius: 16px; height: 56px; padding: 0 16px; }
.rg-locked__code { flex: 1; font-size: var(--ui-type-input); color: var(--v5-ink-3); font-family: var(--font-jet-mono), ui-monospace, monospace; letter-spacing: 0.04em; }
.rg-locked__tag { display: block; margin-top: 8px; padding: 0 4px; font-size: var(--ui-type-note); color: var(--v5-ink-3); }
.rg-invite__err { display: block; margin-top: 8px; padding: 0 4px; font-size: var(--ui-type-note); color: var(--v5-danger); }
.rg-step3 { display: flex; flex-direction: column; gap: 12px; }
/* 《03》§3 零 border:填充容器不描边(2026-08-15 zero-border 门抓获存量);错误态改 soft tint 表达。 */
.rg-field { background: var(--v5-surface); border-radius: 16px; height: 56px; padding: 0 16px; font-size: var(--ui-type-input); line-height: var(--ui-type-input-lh); color: var(--v5-ink); }
.rg-field-wrap { display: flex; align-items: center; background: var(--v5-surface); border-radius: 16px; height: 56px; padding: 0 16px; }
.rg-field-wrap--err { background: color-mix(in srgb, var(--v5-danger) 12%, var(--v5-surface)); }
.rg-field--flex { flex: 1; background: transparent; border: none; height: 100%; padding: 0; }
.rg-eye { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; flex-shrink: 0; }
.rg-eye:active { opacity: 0.7; }
.rg-check { display: flex; }
.rg-review { margin-top: 16px; border-radius: 12px; background: var(--v5-warning-soft); padding: 8px 12px; }
.rg-review__title { display: block; font-size: var(--ui-type-description); line-height: var(--ui-type-description-lh); font-weight: 500; color: var(--v5-warning-ink); }
.rg-review__body { display: block; margin-top: 4px; font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); color: var(--v5-ink-3); }
.rg-error { margin-top: 12px; display: flex; align-items: center; gap: 8px; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-danger); background: var(--v5-danger-soft); border-radius: 12px; padding: 8px 12px; }
.rg-phone-hint { display: block; margin-top: 8px; font-size: var(--ui-type-note); color: var(--v5-ink-3); }
.rg-phone-hint--err { color: var(--v5-danger); }
.rg-devbanner { margin-top: 12px; border-radius: 12px; padding: 8px 12px; background: var(--v5-warning-soft); }
.rg-devbanner__t { font-size: var(--ui-type-note); color: var(--v5-warning-ink); }
.rg-error__t { flex: 1; }
.rg-cta { margin-top: 20px; }
.rg-cta--off { opacity: .5; }
/* 03 §3.1 禁用: the greyed CTA names its reason in one neutral line right under it (description role, ink-3). */
.rg-cta-reason { display: block; min-height: var(--ui-type-description-lh); margin-top: 8px; text-align: center; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
.rg-cta-reason--off { visibility: hidden; }
.rg-oauth { }
.rg-divider { display: flex; align-items: center; margin: 24px 0; }
.rg-divider__line { flex: 1; height: 1px; background: color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.rg-divider__t { padding: 0 12px; font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); color: var(--v5-ink-3); }
.rg-mode-badge { align-self: flex-start; margin-top: 8px; }
/* 01 §1.1.2 整体底色 (as the sign-in notice) + 03 §3.6.1 卡片里文字＋按钮: the action wraps under the sentence, right-aligned. */
.rg-status { --nx-tint: var(--v5-brand); margin-top: 12px; padding: 8px 12px; border-radius: 12px; display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 4px 12px; }
.rg-status__t { flex: 1 1 10em; min-width: 0; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-2); overflow-wrap: break-word; }
.rg-footer { margin-top: auto; padding-top: 32px; text-align: center; }
.rg-footer__acc { display: block; font-size: var(--ui-type-list-subtitle); color: var(--v5-ink-3); }
/* 同 login:inline 目标吃 WCAG 2.5.8 豁免,纵向 padding 扩热区不撑行高 */
/* 水平也补 10px:"Sign in" 只有 25px 宽,纵向撑够了横向还是不够。负 margin 抵消布局,
   多出来的热区落在句子里的空白与标点上 —— 那本来就不可点,重叠反而符合 Fitts 定律。 */
.rg-footer__link { color: var(--v5-brand); font-weight: 500; padding: 14px 10px; margin: 0 -10px; transition: opacity 0.15s; }
.rg-footer__link:active { opacity: 0.6; }
.rg-footer__terms { display: block; margin-top: 8px; font-size: var(--ui-type-note); color: var(--v5-ink-3); }
/* padding 15 而非 14:这行字比 footer__link 小(11.5px),14 只能撑到 43 —— 差 1px 也是差 */
/* Each link stays on one line; when it does not fit it moves to the next line whole. */
.rg-footer__terms-link { color: var(--v5-ink-3); text-decoration: underline; text-underline-offset: 2px; padding: 15px 0; white-space: nowrap; }
</style>
