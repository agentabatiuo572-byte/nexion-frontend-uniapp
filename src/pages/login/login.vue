<template>
  <StandalonePageShell class="lg-root" @keydown.esc="showCountries = false">
    <view class="lg-wrap" :inert="showCountries || undefined" :aria-hidden="showCountries">
      <!-- Top bar -->
      <view class="lg-top">
        <view v-if="!loginRecoveryPending && (step > 1 || mode === 'reset')" class="lg-iconbtn" role="button" tabindex="0" :aria-label="t.login.back" @click="back" @keydown.enter.prevent="back" @keydown.space.prevent="back">
          <view class="lg-iconbtn__face nx-design-glass"><LiquidGlass :radius="20" tone="navigation" :blur="8" /><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></view>
        </view>
        <view v-else class="lg-iconbtn" role="button" tabindex="0" :aria-label="t.login.close" @click="close" @keydown.enter.prevent="close" @keydown.space.prevent="close">
          <view class="lg-iconbtn__face nx-design-glass"><LiquidGlass :radius="20" tone="navigation" :blur="8" /><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></view>
        </view>
        <view class="lg-brand">
          <BrandLockup :height="40" />
        </view>
        <view class="lg-top__sp" />
      </view>

      <!-- Step indicator (otp: 2, reset: 3) -->
      <view v-if="!loginRecoveryPending && mode !== 'password'" class="lg-dots">
        <view v-for="n in (mode === 'reset' ? 3 : 2)" :key="n" class="lg-dot" :class="n === step ? 'lg-dot--active' : (n < step ? 'lg-dot--done' : '')" />
      </view>

      <!-- Title -->
      <text class="lg-title">{{ titleText }}</text>
      <NxTag v-if="modeLabel" class="lg-mode-badge" tone="warning" data-testid="auth-runtime-label">{{ modeLabel }}</NxTag>
      <view v-if="sessionEndNotice" class="lg-recovery-notice nx-tint" role="status" data-qa="server-session-reload-notice">
        <text class="lg-recovery-notice__t">{{ sessionEndNotice }}</text>
      </view>
      <!-- #ifdef H5 -->
      <view v-if="browserUnsupportedNotice" class="lg-recovery-notice nx-tint" role="status" data-qa="secure-browser-unsupported-notice">
        <text class="lg-recovery-notice__t">{{ t.session.secureBrowserUnsupported }}</text>
      </view>
      <!-- #endif -->
      <template v-if="!loginRecoveryPending">
        <text v-if="step === 1 && mode === 'reset'" class="lg-sub">{{ t.login.resetSubtitle }}</text>
        <text v-else-if="step === 1 && remoteApiEnabled" class="lg-sub">{{ t.login.takeoverHint }}</text>
        <text v-else-if="step === 2 && otpChallengeMissing" class="lg-sub">{{ t.authOtp.codeExpiredSubtitle }}</text>
        <text v-else-if="step === 2" class="lg-sub">{{ t.login.codeSentTo }} <text class="lg-sub__ph">{{ country }} {{ phone }}</text></text>
        <text v-else-if="step === 3" class="lg-sub">{{ t.login.newPasswordHint }}</text>
      </template>

      <!-- Body -->
      <view v-if="loginRecoveryPending" class="lg-body lg-col" data-testid="login-recovery">
        <text class="lg-sub" role="status" aria-live="polite">{{ loading ? t.login.signingIn : loginResultUnknown ? t.login.unknownAttempt : t.login.verificationPending }}</text>
        <text v-if="retryContext?.context.phone" class="lg-phone lg-recovery__account">{{ retryContext?.context.countryCode }} {{ retryContext?.context.phone }}</text>
        <input id="lg-retry-password" class="lg-recovery__input" v-if="retryNeedsPassword" v-model="retryPassword" :cursor-spacing="keyboardSpacing.retryPassword" type="password" :maxlength="PASSWORD_MAX_LENGTH" confirm-type="done" @confirm="retryOriginalLogin()" :placeholder="t.login.passwordPlaceholder" :aria-label="t.login.passwordPlaceholder" />
        <input id="lg-retry-code" class="lg-recovery__input" v-if="retryNeedsCode" v-model="retryCode" :cursor-spacing="keyboardSpacing.retryCode" type="number" confirm-type="done" @confirm="retryOriginalLogin()" :maxlength="6" :placeholder="t.login.retryCode" :aria-label="t.login.retryCode" />
        <view class="lg-recovery__cta">
          <NxButton class="lg-cta lg-recovery__action" data-system-chrome-primary variant="primary" :label="t.login.retryOriginal" :busy="loading" :busy-label="t.login.signingIn" :disabled="!canRetryOriginal" :aria-describedby="!canRetryOriginal && !loading ? 'lg-retry-reason' : undefined" @click="retryOriginalLogin()" />
          <!-- 03 §3.1: the credential still missing, in the same reserved line under the button as the form's reason line. -->
          <text v-if="retryNeedsPassword || retryNeedsCode" id="lg-retry-reason" class="lg-cta-reason" :class="{ 'lg-cta-reason--off': canRetryOriginal || loading }" :aria-hidden="canRetryOriginal || loading ? 'true' : undefined">{{ retryDisabledReason }}</text>
        </view>
        <view v-if="!loginResultUnknown" class="lg-recovery__secondary" role="button" :tabindex="loading ? -1 : 0" :aria-disabled="loading" @click="cancelLoginVerification" @keydown.enter.prevent="cancelLoginVerification" @keydown.space.prevent="cancelLoginVerification"><text>{{ t.ui.cancel }}</text></view>
      </view>
      <view v-if="!loginRecoveryPending" class="lg-body">
        <!-- Step 1: phone (+ password for password mode) -->
        <view v-if="step === 1" class="lg-col">
          <view class="lg-phone" :class="{ 'lg-phone--err': phone && !phoneOk }">
            <view class="lg-phone__cc" role="button" tabindex="0" :aria-label="t.countryCodes.title" :aria-expanded="showCountries" @click="showCountries = true" @keydown.enter.prevent="showCountries = true" @keydown.space.prevent="showCountries = true">
              <text class="lg-phone__cc-t">{{ country }}</text>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ transform: showCountries ? 'rotate(180deg)' : '' }"><path d="m6 9 6 6 6-6" /></svg>
            </view>
            <input class="lg-phone__in" type="number" inputmode="numeric" maxlength="15" :cursor-spacing="keyboardSpacing.phone" :placeholder="t.login.phonePlaceholder" :aria-label="t.login.phonePlaceholder" :value="phone" :aria-invalid="!!phone && !phoneOk" aria-describedby="login-phone-format" :confirm-type="mode === 'password' ? 'next' : 'done'" @input="onPhone" @confirm="onPhoneConfirm" />
          </view>
          <text id="login-phone-format" data-testid="auth-phone-hint" class="lg-phone-hint" :class="{ 'lg-phone-hint--err': phone && !phoneOk }" role="status" aria-live="polite">{{ phoneFormatMessage }}</text>
          <template v-if="mode === 'password'">
            <view class="lg-field-wrap" :class="{ 'lg-field-wrap--err': password && !pwdOk }">
              <input id="lg-password" class="lg-field--flex" :type="showPwd ? 'text' : 'password'" :placeholder="t.login.passwordPlaceholder" :aria-label="t.login.passwordPlaceholder" :maxlength="PASSWORD_MAX_LENGTH" :value="password" :cursor-spacing="keyboardSpacing.password" :focus="passwordFocused" confirm-type="done" @input="onPwd" @blur="passwordFocused = false" @confirm="onPrimary" />
              <view class="lg-eye" role="button" tabindex="0" :aria-label="showPwd ? t.login.hidePassword : t.login.showPassword" @click="showPwd = !showPwd" @keydown.enter.prevent="showPwd = !showPwd" @keydown.space.prevent="showPwd = !showPwd">
                <svg v-if="showPwd" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><path d="m2 2 20 20" /></svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
              </view>
            </view>
            <view class="lg-forgot-row">
              <text class="lg-forgot" role="link" tabindex="0" @click="goReset" @keydown.enter.prevent="goReset">{{ t.login.forgotPassword }}</text>
            </view>
          </template>
        </view>

        <!-- Step 2: OTP -->
        <view v-else-if="step === 2" class="lg-col">
          <OtpCodeInput class="lg-otp" :model-value="code.join('')" :label="t.authOtp.codeInputLabel" :focus="codeFocus" :cursor-spacing="keyboardSpacing.otp" @update:model-value="onCode" @confirm="onPrimary" />
          <view v-if="developmentOtpEnabled" class="lg-development-otp" data-testid="development-otp-code" role="status">
            <text class="lg-development-otp__t">{{ fmt(t.authOtp.developmentCodeHint, { code: developmentOtpCode }) }}</text>
          </view>
          <view class="lg-resend">
            <NxButton variant="text" size="small" :label="t.login.changeNumber" @click="back" />
            <text v-if="!remoteTwoFactorChallenge && resendLeft > 0" class="lg-resend__count">{{ resendInText }}</text>
            <NxButton v-else-if="!remoteTwoFactorChallenge" variant="text" size="small" :label="t.login.resend" @click="resend" />
          </view>
        </view>

        <!-- Step 3: new password (reset) -->
        <view v-else class="lg-col">
          <view class="lg-field-wrap" :class="{ 'lg-field-wrap--err': newPassword && !newPwdOk }">
            <input id="lg-new-password" class="lg-field--flex" :cursor-spacing="keyboardSpacing.newPassword" :type="showPwd ? 'text' : 'password'" :placeholder="t.login.newPasswordPlaceholder || t.login.passwordPlaceholder" :aria-label="t.login.newPasswordPlaceholder || t.login.passwordPlaceholder" :maxlength="PASSWORD_MAX_LENGTH" :value="newPassword" confirm-type="next" @input="onNewPwd" @confirm="focusResetConfirmation" />
            <view class="lg-eye" role="button" tabindex="0" :aria-label="showPwd ? t.login.hidePassword : t.login.showPassword" @click="showPwd = !showPwd" @keydown.enter.prevent="showPwd = !showPwd" @keydown.space.prevent="showPwd = !showPwd">
              <svg v-if="showPwd" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><path d="m2 2 20 20" /></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
            </view>
          </view>
          <view class="lg-field-wrap" :class="{ 'lg-field-wrap--err': confirmPwd && newPassword !== confirmPwd }">
            <input id="lg-confirm-password" class="lg-field--flex" :cursor-spacing="keyboardSpacing.confirmPassword" :type="showPwd ? 'text' : 'password'" :placeholder="t.login.confirmPasswordPlaceholder" :aria-label="t.login.confirmPasswordPlaceholder" :maxlength="PASSWORD_MAX_LENGTH" :value="confirmPwd" :focus="confirmPasswordFocused" confirm-type="done" @input="onConfirm" @blur="confirmPasswordFocused = false" @confirm="onPrimary" />
          </view>
        </view>
      </view>

      <!-- Error -->
      <view v-if="error && !(loginRecoveryPending && error === t.login.unknownAttempt)" id="lg-error" class="lg-error" role="alert" aria-live="assertive">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
        <text class="lg-error__t">{{ error }}</text>
      </view>

      <!-- Primary CTA -->
      <!-- Incomplete fields still allow a tap to show their reason. A missing challenge disables the CTA.
           Busy shows NxButton's spinner and takes no taps. While the third-party panel is open the CTA is disabled, not
           busy: the panel's confirm is the only primary in view (03 §3.1), and the panel's copy describes the button. -->
      <NxButton v-if="!loginRecoveryPending" class="lg-cta" :class="{ 'lg-cta--off': !canPrimary && !localLoading }" data-system-chrome-primary variant="primary" :label="primaryText" :busy="localLoading" :disabled="otpChallengeMissing || oauthBusy" :aria-disabled="!canPrimary || loading" :aria-describedby="oauthBusy ? 'oauth-panel-copy' : !canPrimary && !loading ? (error ? 'lg-error' : 'lg-cta-reason') : undefined" @click="onPrimary" />
      <!-- 03 §3.1: a greyed CTA shows its reason in a neutral line below it from the first frame. While the error line
           directly above is showing, that line carries the reason and the button points to it instead. The recovery view
           has the same line under its own button (lg-retry-reason). The line keeps its height when it has
           nothing to say, hidden from view and from screen readers, so nothing below jumps. -->
      <text v-if="!loginRecoveryPending" id="lg-cta-reason" class="lg-cta-reason" :class="{ 'lg-cta-reason--off': canPrimary || loading || !!error }" :aria-hidden="canPrimary || loading || error ? 'true' : undefined">{{ primaryDisabledReason }}</text>

      <!-- Mode switch (password ↔ otp), only on step 1 non-reset -->
      <view v-if="!loginRecoveryPending && step === 1 && mode !== 'reset'" class="lg-switch" role="button" tabindex="0" @click="toggleMode" @keydown.enter.prevent="toggleMode" @keydown.space.prevent="toggleMode">
        <text class="lg-switch__t">{{ mode === 'password' ? t.login.useCodeInstead : t.login.usePasswordInstead }}</text>
      </view>

      <ThirdPartyAuth v-if="!loginRecoveryPending && remoteApiEnabled && step === 1 && mode !== 'reset'" :disabled="loading || loginRecoveryPending" :return-to="returnParam" :sponsor-code="refOnLogin" @busy="onOauthBusy" />
      <!-- OAuth (step 1, not reset) -->
      <view v-if="!loginRecoveryPending && step === 1 && mode !== 'reset' && !remoteApiEnabled" class="lg-oauth">
        <view class="lg-divider"><view class="lg-divider__line" /><text class="lg-divider__t">{{ t.login.orContinueWith }}</text><view class="lg-divider__line" /></view>
        <AuthProviderGrid :busy="loading" :development="apiRuntimeConfig.environment === 'dev'" @select="startOauth" />
      </view>

      <!-- Footer -->
      <view class="lg-footer">
        <text v-if="!loginRecoveryPending && step === 1 && mode !== 'reset'" class="lg-footer__acc">{{ t.login.noAccount }} <text class="lg-footer__link" role="link" tabindex="0" @click="goRegister" @keydown.enter.prevent="goRegister">{{ t.login.signUp }}</text></text>
      </view>
    </view>
    <!-- #ifdef H5 -->
    <view v-if="keyboardInset" :style="{ height: keyboardInset + 'px' }" />
    <!-- #endif -->

    <CountryCodeSheet :open="showCountries" :model-value="country" @select="pickCountry" @close="showCountries = false" />
    <!-- i18n-en-ok: Server CAPTCHA protocol scene enum, sent only to backend verification and never rendered. -->
    <ServerCaptchaSlider v-if="showCaptcha && remoteApiEnabled" :phone="captchaPurpose === 'replay' ? `${retryContext?.context.countryCode ?? ''}${retryContext?.context.phone ?? ''}` : fullPhone" :scene='(captchaPurpose === "password" || captchaPurpose === "replay" ? "LOGIN" : otpScene === "reset" ? "RESET" : "LOGIN")' @success="onCaptchaOk" @close="showCaptcha = false" />
    <CaptchaSlider v-else-if="showCaptcha" :phone="fullPhone" @success="onCaptchaOk" @close="showCaptcha = false" />
    <GlobalUi />
  </StandalonePageShell>
</template>

<script setup lang="ts">
import ThirdPartyAuth from "@/components/third-party-auth.vue";
import ServerCaptchaSlider from "@/components/server-captcha-slider.vue";
import { sessionEndReason } from "@/auth/session-end";
import { navReset, takeNavigationQuery } from "@/lib/route";
import { ref, computed, nextTick, watch, onUnmounted } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
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
import { fmt } from "@/i18n/format";
import { geoPolicyUserMessage } from "@/api/geo-policy-error";
import { otpSend, otpVerify, type OtpScene } from "@/store/auth-otp";
import { authAccountKeyForPhone } from "@/store/auth-account";
import { normalizeRegistrationSponsorCode } from "@/auth/registration-sponsor";
import { toast } from "@/store/ui";
import { isResetPasswordOk, PASSWORD_MAX_LENGTH } from "@/auth/password-rules";
import { completeSignIn } from "@/auth/complete-sign-in";
import { stageRemoteRegistrationReceipt } from "@/auth/remote-registration-receipt";
import { exchangeVerifiedLogin } from "@/store/auth-otp";
import { apiRuntimeConfig, authApi, h5RefreshCookieEnabled, remoteApiEnabled } from "@/api/runtime";
import { apiEnvironmentBadgeLabel } from "@/api/runtime-config";
import type { OAuthProvider } from "@/api/auth-api";
import { ApiError } from "@/api/errors";
import type { RegistrationReceipt, UserSession } from "@/api/contracts";
import { dialCodeForLocale, isSelectablePhoneDialCode, phoneFormatHint, sanitizePhoneInput, validateNationalPhone } from "@/auth/phone-number";
import { resolveRemoteLoginErrorKind } from "@/lib/remote-login-error";

const t = useT();

type Step = 1 | 2 | 3;
type LoginMode = "password" | "otp" | "reset";

interface OtpFlowContext {
  version: number;
  phone: string;
  scene: OtpScene;
  requestId: string;
}

interface PasswordAttemptContext {
  version: number;
  phone: string;
  password: string;
}

interface RemoteTwoFactorAttemptContext {
  version: number;
  phone: string;
  challengeNo: string;
}

interface PasswordResetAttemptContext {
  version: number;
  phone: string;
  requestId: string;
}

const mode = ref<LoginMode>("password");
const step = ref<Step>(1);
const country = ref(dialCodeForLocale(useLocaleStore().code));
const showCountries = ref(false);
const phone = ref("");
const password = ref("");
const newPassword = ref("");
const confirmPwd = ref("");
const code = ref<string[]>(["", "", "", "", "", ""]);
const codeFocus = ref(true);
const showPwd = ref(false);
const error = ref<string | null>(null);
const { resendLeft, refreshResend, startResend, clearResend } = useOtpResend();
const oauthBusy = ref(false);
const localLoading = ref(false);
const loading = computed({ get: () => localLoading.value || oauthBusy.value, set: (value: boolean) => { localLoading.value = value; } });
const loginRecoveryPending = ref(false);
const loginResultUnknown = ref(false);
const replayAvailable = ref(false);
const retryContext = ref<ReturnType<typeof authApi.pendingLoginContext>>(null);
const retryPassword = ref("");
const retryCode = ref("");
const retryNeedsPassword = computed(() => ["PASSWORD", "TWO_FACTOR", "REGISTRATION"].includes(retryContext.value?.authMethod ?? ""));
const retryNeedsCode = computed(() => ["OTP", "TWO_FACTOR", "REGISTRATION"].includes(retryContext.value?.authMethod ?? "")
  || !!retryContext.value?.context.challengeNo);
const canRetryOriginal = computed(() => !loading.value && (!retryContext.value || (replayAvailable.value
  && (!retryNeedsPassword.value || !!retryPassword.value)
  && (!retryNeedsCode.value || /^\d{6}$/.test(retryCode.value)))));
// The first credential still missing, in field order.
const retryDisabledReason = computed(() => {
  if (retryNeedsPassword.value && !retryPassword.value) return t.value.login.errorInvalidPassword;
  if (retryNeedsCode.value && !/^\d{6}$/.test(retryCode.value)) return t.value.login.errorInvalidCode;
  return "";
});
function syncLoginRecovery() {
  retryContext.value = authApi.pendingLoginContext();
  loginResultUnknown.value = authApi.pendingLogin();
  // While this page owns the password challenge, only an unknown result needs recovery.
  loginRecoveryPending.value = loginResultUnknown.value || (!!retryContext.value && !remoteTwoFactorChallenge.value);
  replayAvailable.value = !!retryContext.value;
}
function onOauthBusy(busy: boolean) {
  if (oauthBusy.value === busy) return;
  oauthBusy.value = busy;
  if (!busy) syncLoginRecovery();
}
// One read when an unresolved attempt first reaches this page. Further reads
// belong to an explicit retry; a failed read must never start a polling loop.
watch(loginResultUnknown, (pending) => { if (pending) void recoverLoginResult(); }, { flush: "post" });
function cancelLoginVerification() {
  if (loading.value || authApi.pendingLogin()) return;
  authApi.cancelLoginChallenge();
  error.value = null;
  retryPassword.value = ""; retryCode.value = ""; showCaptcha.value = false;
  remoteTwoFactorChallenge.value = null; step.value = 1;
  syncLoginRecovery();
}
async function retryOriginalLogin(captchaTicket?: string) {
  if (loading.value) return;
  if (!retryContext.value) { await recoverLoginResult(); return; }
  if (!replayAvailable.value) return;
  if ((retryNeedsPassword.value && !retryPassword.value) || (retryNeedsCode.value && !/^\d{6}$/.test(retryCode.value))) return;
  const flowVersion = otpFlowVersion;
  const originalContext = retryContext.value;
  error.value = null;
  try {
    // A normal Retry first consumes any session already issued by this attempt.
    // CAPTCHA is a continuation of that same click, with its original proof.
    if (authApi.pendingLogin() && typeof captchaTicket !== "string") {
      await recoverLoginResult();
      if (!mounted || flowVersion !== otpFlowVersion || !authApi.pendingLogin()) return;
    }
    loading.value = true;
    const result = await authApi.retryLogin({ password: retryPassword.value || undefined, code: retryCode.value || undefined,
      ...(typeof captchaTicket === "string" ? { captchaTicket } : {}) });
    if (!mounted || flowVersion !== otpFlowVersion) {
      if (result.kind === "authenticated") authApi.discardSessionIfCurrent(result.vaultRevision);
      return;
    }
    syncLoginRecovery();
    if (result.kind === "challenge") {
      replayAvailable.value = true; retryCode.value = "";
    } else finishSignIn({ accountId: authenticatedAccountId(result.user), onboardingComplete: result.user.onboardingComplete,
      serverProfile: result.user, serverSessionRevision: result.vaultRevision,
      recoveredRegistration: originalContext?.authMethod === "REGISTRATION" || !!result.registrationReceipt,
      registrationReceipt: result.registrationReceipt, originalAuthMethod: originalContext?.authMethod });
  } catch (cause) { if (mounted && flowVersion === otpFlowVersion) {
    syncLoginRecovery();
    if (cause instanceof ApiError && cause.message === "USER_CAPTCHA_REQUIRED") { captchaPurpose.value = "replay"; showCaptcha.value = true; }
    else error.value = loginReceiptError(cause);
  } }
  finally { if (!showCaptcha.value || captchaPurpose.value !== "replay") { retryPassword.value = ""; retryCode.value = ""; } if (mounted && flowVersion === otpFlowVersion) loading.value = false; }
}
async function recoverLoginResult() {
  if (loading.value || !authApi.pendingLogin()) return;
  const flowVersion = otpFlowVersion;
  const originalContext = retryContext.value;
  error.value = null;
  loading.value = true;
  try {
    const result = await authApi.recoverLogin();
    if (!mounted || flowVersion !== otpFlowVersion) {
      if (result.kind === "authenticated") authApi.discardSessionIfCurrent(result.vaultRevision);
      return;
    }
    syncLoginRecovery();
    if (result.kind === "authenticated") finishSignIn({ accountId: authenticatedAccountId(result.user),
      onboardingComplete: result.user.onboardingComplete, serverProfile: result.user, serverSessionRevision: result.vaultRevision,
      recoveredRegistration: originalContext?.authMethod === "REGISTRATION" || !!result.registrationReceipt,
      registrationReceipt: result.registrationReceipt, originalAuthMethod: originalContext?.authMethod });
  } catch (cause) {
    if (!mounted || flowVersion !== otpFlowVersion) return;
    syncLoginRecovery(); replayAvailable.value = !!retryContext.value;
    error.value = loginReceiptError(cause);
  } finally { if (mounted && flowVersion === otpFlowVersion) loading.value = false; }
}
const returnParam = ref<string | null>(null);
const refOnLogin = ref<string | null>(null);
const otpRequestId = ref<string | null>(null);
const otpVerifyToken = ref<string | null>(null);
let verifiedResetCode: string | null = null;
const remoteTwoFactorChallenge = ref<string | null>(null);
const serverSessionReloadNotice = ref(false);
const sessionEndNotice = computed(() => sessionEndReason.value === "APP_REPLACED" ? t.value.login.sessionReplacedNotice
  : !serverSessionReloadNotice.value ? ""
    : h5RefreshCookieEnabled ? t.value.login.serverSessionReloadNotice : t.value.login.nativeSessionReloadNotice);
// #ifdef H5
const browserUnsupportedNotice = ref(false);
// #endif
const passwordFocused = ref(false);
const confirmPasswordFocused = ref(false);

let signInTimer: ReturnType<typeof setTimeout> | undefined;
let otpFlowVersion = 0;
let mounted = true;

onLoad((options) => {
  syncLoginRecovery();
  const o = (options || {}) as Record<string, string>;
  const forwarded = new URLSearchParams(takeNavigationQuery("/pages/login/login"));
  if (forwarded.get("return") || o.return) returnParam.value = forwarded.get("return") || o.return;
  serverSessionReloadNotice.value = o.notice === "server-session-reload";
  // #ifdef H5
  browserUnsupportedNotice.value = o.notice === "secure-browser-unsupported";
  // #endif
  // [FEAT-SHARE4] 与注册页同一 client 预检:非法码不入绑定链(服务端权威校验另行)。
  refOnLogin.value = normalizeRegistrationSponsorCode(o.ref ?? forwarded.get("ref"), remoteApiEnabled);
});

const showCaptcha = ref(false);
const captchaPurpose = ref<"otp" | "password" | "replay">("otp");

const phoneClean = computed(() => sanitizePhoneInput(phone.value));
const phoneOk = computed(() => validateNationalPhone(country.value, phoneClean.value));
const invalidPhoneMessage = computed(() => fmt(t.value.countryCodes.phoneInvalidHint, { example: phoneFormatHint(country.value) }));
const phoneFormatMessage = computed(() => {
  const params = { example: phoneFormatHint(country.value) };
  return phone.value && !phoneOk.value
    ? fmt(t.value.countryCodes.phoneInvalidHint, params)
    : fmt(t.value.countryCodes.phoneExampleHint, params);
});
const fullPhone = computed(() => `${country.value}${phoneClean.value}`);
const otpScene = computed<OtpScene>(() => (mode.value === "reset" ? "reset" : "login"));
const codeOk = computed(() => /^\d{6}$/.test(code.value.join("")));
const otpChallengeMissing = computed(() => step.value === 2 && !otpRequestId.value && !remoteTwoFactorChallenge.value);
// Login mode accepts any non-empty password (existing users may have shorter
// passwords from before the strength rule) — mirrors prototype `pwdOk`.
const pwdOk = computed(() => password.value.length > 0);

function authenticatedAccountId(user: UserSession): string {
  if (remoteApiEnabled) return `user:${user.userId}`;
  // Mock password auth shares the same account scope as the legacy OTP and
  // registration directory, so one phone never opens two local wallets.
  return authAccountKeyForPhone(`${user.countryCode}${user.phone}`) ?? `user:${user.userId}`;
}
// Reset mode's new password must pass the full strength check.
const newPwdOk = computed(() => isResetPasswordOk(newPassword.value, { phone: phoneClean.value }));
const pwdMatch = computed(() => newPassword.value === confirmPwd.value && newPwdOk.value);

const titleText = computed(() => {
  if (loginRecoveryPending.value) return t.value.login.title;
  if (step.value === 3) return t.value.login.newPasswordTitle;
  if (step.value === 2) return t.value.login.codeStepTitle;
  if (mode.value === "reset") return t.value.login.resetTitle;
  return t.value.login.title;
});
const modeLabel = computed(() => apiEnvironmentBadgeLabel(apiRuntimeConfig, t.value.security.developmentModeLabel));
const developmentOtpCode = String(import.meta.env.VITE_NEXGRID_DEV_OTP_CODE || "").trim();
const developmentOtpEnabled = computed(() =>
  apiRuntimeConfig.environment === "dev"
  && /^\d{6}$/.test(developmentOtpCode)
);
const primaryText = computed(() => {
  if (step.value === 1) return mode.value === "password" ? t.value.login.signIn : t.value.login.sendCode;
  if (step.value === 2) return t.value.login.verify;
  return t.value.login.finishReset;
});
const canPrimary = computed(() => {
  if (step.value === 1) return mode.value === "password" ? (phoneOk.value && pwdOk.value && !loading.value) : (phoneOk.value && !loading.value);
  if (step.value === 2) return !otpChallengeMissing.value && codeOk.value && !loading.value;
  return pwdMatch.value && !loading.value;
});
const primaryDisabledReason = computed(() => {
  if (step.value === 1) {
    // Shown from the first frame, so it reads as a next step, not a format error (the hint under the field says that).
    if (!phoneOk.value) return t.value.register.ctaDisabledPhone;
    if (mode.value === "password" && !pwdOk.value) return t.value.login.errorInvalidPassword;
  }
  if (step.value === 2) {
    if (otpChallengeMissing.value) return resendLeft.value > 0 ? resendInText.value : t.value.authOtp.errorOtpExpired;
    if (!codeOk.value) return t.value.login.errorInvalidCode;
  }
  if (step.value === 3) {
    if (!newPwdOk.value) return t.value.login.errorWeakPassword;
    if (!confirmPwd.value) return t.value.login.confirmPasswordPlaceholder;
    if (!pwdMatch.value) return t.value.login.passwordMismatch;
  }
  return "";
});
// Seeds include the reason line's 28px slot below the button, on the form and in recovery (one of the two is rendered).
const { spacing: keyboardSpacing, inset: keyboardInset } = useKeyboardPrimaryReach({
  root: ".lg-root", form: ".lg-wrap", primary: ".lg-cta", primaryDescription: ".lg-cta-reason",
  inputs: {
    phone: { selector: ".lg-phone__in", seed: 263 },
    password: { selector: "#lg-password", seed: 169 },
    otp: { selector: ".lg-otp", seed: 144 },
    newPassword: { selector: "#lg-new-password", seed: 181 },
    confirmPassword: { selector: "#lg-confirm-password", seed: 113 },
    retryPassword: { selector: "#lg-retry-password", seed: 192 },
    retryCode: { selector: "#lg-retry-code", seed: 124 },
  },
  layout: () => [step.value, mode.value, loginRecoveryPending.value, retryNeedsPassword.value, retryNeedsCode.value,
    error.value, primaryDisabledReason.value, phoneFormatMessage.value, developmentOtpEnabled.value],
});
const resendInText = computed(() => (t.value.login.resendIn || "{s}s").replace("{s}", String(resendLeft.value)));
function showOauthUnavailable(provider: string) {
  toast.info(fmt(t.value.login.oauthUnavailableTitle, { provider }), t.value.login.oauthUnavailableBody);
}

function oauthProvider(label: string): OAuthProvider | null {
  return label === "Google" ? "GOOGLE"
    : label === "Apple" ? "APPLE"
    : label === "Passkey" ? "PASSKEY"
    : label === "Telegram" ? "TELEGRAM"
    : null;
}

function oauthError(cause: unknown, provider: OAuthProvider): string {
  const code = cause instanceof ApiError ? cause.message : "";
  if (code === "OAUTH_PROVIDER_NOT_CONFIGURED" || code === "OAUTH_PROVIDER_UNAVAILABLE"
      ) {
    return `${fmt(t.value.login.oauthUnavailableTitle, { provider })}: ${t.value.login.oauthUnavailableBody}`;
  }
  return remoteLoginError(cause);
}

async function startOauth(label: string) {
  const provider = oauthProvider(label);
  if (!provider || !remoteApiEnabled) {
    showOauthUnavailable(label);
    return;
  }
  if (loading.value) return;
  const flowVersion = ++otpFlowVersion;
  loading.value = true;
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
      identity: authenticatedAccountId(result.user),
      returnTo: returnParam.value,
      onboardingComplete: result.user.onboardingComplete,
      serverProfile: result.user,
      serverSessionRevision: result.vaultRevision,
    });
    if (!completed.ok) {
      loading.value = false;
      error.value = t.value.authOtp.errorServiceUnavailable;
    }
  } catch (cause) {
    if (!mounted || flowVersion !== otpFlowVersion) return;
    loading.value = false;
    error.value = oauthError(cause, provider);
  }
}

function inputVal(e: Event): string {
  return (e as unknown as { detail: { value: string } }).detail.value;
}
function onPhone(e: Event) {
  const next = sanitizePhoneInput(inputVal(e));
  if (phone.value !== next) invalidateOtpFlow();
  phone.value = next;
  error.value = null;
}
function focusPassword() {
  passwordFocused.value = false;
  void nextTick(() => { passwordFocused.value = true; });
}
function focusResetConfirmation() {
  confirmPasswordFocused.value = false;
  void nextTick(() => { confirmPasswordFocused.value = true; });
}
function onPhoneConfirm() {
  if (mode.value === "password") {
    focusPassword();
    return;
  }
  onPrimary();
}
function onPwd(e: Event) { password.value = inputVal(e); error.value = null; }
function onNewPwd(e: Event) { newPassword.value = inputVal(e); error.value = null; }
function onConfirm(e: Event) { confirmPwd.value = inputVal(e); error.value = null; }
function onCode(value: string) {
  code.value = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
  if (otpChallengeMissing.value) return;
  error.value = null;
  if (codeOk.value) verifyCode();
}
// Puts the keyboard back on the code field after the code is cleared.
function focusCode() {
  codeFocus.value = false;
  void nextTick(() => { codeFocus.value = true; });
}
function pickCountry(c: string) {
  if (!isSelectablePhoneDialCode(c)) return;
  if (country.value !== c) invalidateOtpFlow();
  country.value = c;
  error.value = null;
  showCountries.value = false;
}

function clearSignIn() {
  if (signInTimer) { clearTimeout(signInTimer); signInTimer = undefined; }
  loading.value = false;
}

function clearSmsChallenge() {
  otpRequestId.value = null;
  otpVerifyToken.value = null;
  verifiedResetCode = null;
}

/** 换号、返回或切换认证方式后，旧发码/验码/登录回包不得写回当前页面。 */
function invalidateOtpFlow(preserveSmsChallenge = false) {
  otpFlowVersion += 1;
  clearSignIn();
  if (!preserveSmsChallenge) {
    clearSmsChallenge();
    clearResend();
  }
  remoteTwoFactorChallenge.value = null;
}

function isCurrentOtpFlow(context: OtpFlowContext): boolean {
  return (
    mounted
    && context.version === otpFlowVersion
    && fullPhone.value === context.phone
    && otpScene.value === context.scene
    && step.value === 2
    && otpRequestId.value === context.requestId
  );
}

function isCurrentPasswordFlow(context: PasswordAttemptContext): boolean {
  return mounted
    && context.version === otpFlowVersion
    && mode.value === "password"
    && step.value === 1
    && fullPhone.value === context.phone;
}

function isCurrentPasswordAttempt(context: PasswordAttemptContext): boolean {
  return isCurrentPasswordFlow(context) && password.value === context.password;
}

function isCurrentRemoteTwoFactorAttempt(context: RemoteTwoFactorAttemptContext): boolean {
  return mounted
    && context.version === otpFlowVersion
    && mode.value === "password"
    && step.value === 2
    && fullPhone.value === context.phone
    && remoteTwoFactorChallenge.value === context.challengeNo;
}

function isCurrentPasswordResetAttempt(context: PasswordResetAttemptContext): boolean {
  return mounted
    && context.version === otpFlowVersion
    && mode.value === "reset"
    && step.value === 3
    && fullPhone.value === context.phone
    && otpRequestId.value === context.requestId;
}

// A region-policy refusal arrives as a code on the same result objects as every
// other sign-in failure. Translate it first; `null` means it wasn't one, and the
// caller must fall through to its existing mapping — otherwise an unrelated
// failure would be reported to the user as a region block.
function geoText(code: unknown): string | null {
  return geoPolicyUserMessage(code, t.value.geoPolicy);
}

// Sign-in completion (shared by password + OTP). Binds the account-cloud
// snapshot, claims this carrier's session, then enters only a safe business
// return target or Home. Registration and device setup own their own routes.
function finishSignIn(
  session: { accountId: string; signInIdempotencyKey?: string; onboardingComplete: boolean; serverProfile?: UserSession; serverSessionRevision?: number;
    recoveredRegistration?: boolean; registrationReceipt?: RegistrationReceipt | null; originalAuthMethod?: string },
  context: OtpFlowContext | null = null,
) {
  signInTimer = undefined;
  if (!mounted || (context && !isCurrentOtpFlow(context))) return;
  const registrationDestination = "/pages/register/success";
  const result = completeSignIn({
    identity: session.accountId,
    returnTo: session.recoveredRegistration ? registrationDestination : returnParam.value,
    sponsorCode: refOnLogin.value,
    idempotencyKey: session.signInIdempotencyKey,
    onboardingComplete: session.onboardingComplete,
    serverProfile: session.serverProfile,
    serverSessionRevision: session.serverSessionRevision,
    deferNavigation: session.recoveredRegistration,
    initialOAuthLocale: session.originalAuthMethod === "OAUTH" && session.registrationReceipt
      ? useLocaleStore().code : undefined,
  });
  if (result.ok && session.recoveredRegistration) {
    stageRemoteRegistrationReceipt(session.registrationReceipt, session.accountId);
    navReset({ url: registrationDestination, fail: () => {} });
  } else if (!result.ok) {
    loading.value = false;
    error.value = geoText(result.error)
      ?? (result.error === "account_pending"
        ? t.value.login.errorRegistrationIncomplete
        : result.error === "account_not_found"
          ? t.value.login.errorAccountNotRegistered
        : t.value.authOtp.errorServiceUnavailable);
  }
}

function finishVerifiedOtpSignIn(verifyToken: string, context: OtpFlowContext) {
  if (!isCurrentOtpFlow(context)) return;
  const exchange = exchangeVerifiedLogin(context.phone, verifyToken);
  if (!exchange.ok) {
    if (!isCurrentOtpFlow(context)) return;
    loading.value = false;
    error.value = geoText(exchange.error)
      ?? (exchange.error === "verify_token_invalid"
        ? t.value.authOtp.errorOtpExpired
        : t.value.authOtp.errorServiceUnavailable);
    return;
  }
  finishSignIn(exchange, context);
}

// FEAT-AUTH01: 发码统一走闸门(冷却/24h 限频/滑块)。倒计时以 server 返回的
// resendAfterSec 为准,client 不再持有 60s 业务常量。
async function requestCode(captchaTicket?: string) {
  if (loading.value) return;
  if (step.value === 1 && refreshResend() > 0) {
    if (!otpRequestId.value) {
      toast.info(fmt(t.value.authOtp.errorTooFrequent, { s: resendLeft.value }));
      return;
    }
    focusCode();
    step.value = 2;
    return;
  }
  const phoneAtRequest = fullPhone.value;
  const sceneAtRequest = otpScene.value;
  const stepAtRequest = step.value;
  const flowVersion = ++otpFlowVersion;
  loading.value = true;
  if (remoteApiEnabled) {
    try {
      const res = sceneAtRequest === "reset"
        ? await authApi.sendPasswordResetOtp({ countryCode: country.value, phone: phoneClean.value, ...(captchaTicket ? { captchaTicket } : {}) })
        : await authApi.sendLoginOtp({ countryCode: country.value, phone: phoneClean.value, ...(captchaTicket ? { captchaTicket } : {}) });
      if (!mounted || flowVersion !== otpFlowVersion || fullPhone.value !== phoneAtRequest || step.value !== stepAtRequest) return;
      loading.value = false;
      otpRequestId.value = res.challengeNo;
      otpVerifyToken.value = null;
      verifiedResetCode = null;
      code.value = ["", "", "", "", "", ""];
      focusCode();
      step.value = 2;
      startResend(res.resendAfterSec);
    } catch (cause) {
      if (!mounted || flowVersion !== otpFlowVersion || fullPhone.value !== phoneAtRequest) return;
      loading.value = false;
      if (cause instanceof Error && cause.message === "USER_CAPTCHA_REQUIRED") {
        captchaPurpose.value = "otp";
        showCaptcha.value = true;
      } else {
        error.value = remoteLoginError(cause);
      }
    }
    return;
  }
  const res = await otpSend(phoneAtRequest, sceneAtRequest, captchaTicket);
  if (
    !mounted
    || flowVersion !== otpFlowVersion
    || fullPhone.value !== phoneAtRequest
    || otpScene.value !== sceneAtRequest
    || step.value !== stepAtRequest
  ) return;
  loading.value = false;
  if (res.ok) {
    otpRequestId.value = res.requestId;
    otpVerifyToken.value = null;
    code.value = ["", "", "", "", "", ""];
    focusCode();
    step.value = 2;
    startResend(res.resendAfterSec);
    return;
  }
  if (res.error === "captcha_required") {
    captchaPurpose.value = "otp";
    showCaptcha.value = true;
    return;
  }
  if (res.error === "rate_limited") {
    // 规格 ⑤(AUTH01):`rate_limited` → Toast 剩余秒数;inline 错误条留给 verify 类错误。
    toast.info(fmt(t.value.authOtp.errorTooFrequent, { s: res.retryAfterSec }));
    if (step.value === 2) startResend(res.retryAfterSec);
  }
}
function onCaptchaOk(ticket: string) {
  showCaptcha.value = false;
  if (captchaPurpose.value === "replay") { void retryOriginalLogin(ticket); return; }
  if (captchaPurpose.value === "password") {
    void signInWithPassword(ticket);
    return;
  }
  void requestCode(ticket);
}
function resend() {
  if (refreshResend() > 0) return;
  error.value = null;
  void requestCode();
}

function goSendCode() {
  error.value = null;
  if (!phoneOk.value) { error.value = invalidPhoneMessage.value; return; }
  void requestCode();
}
/**
 * The original attempt's session was issued and has since ended. A takeover is explained by the notice at the
 * top, like any other ended session; other endings ask for a new sign-in. Anything else keeps its own message.
 */
function loginReceiptError(cause: unknown): string | null {
  const reason = cause instanceof ApiError && cause.kind === "auth" ? cause.message : "";
  if (["APP_REPLACED"].includes(reason)) { sessionEndReason.value = reason; return null; }
  if (["CURRENT_LOGOUT", "SECURITY_REVOKED", "SESSION_EXPIRED", "REAUTH_REQUIRED", "SESSION_REPLACED"].includes(reason)) return t.value.login.sessionReplaced;
  return remoteLoginError(cause);
}
function remoteLoginError(error: unknown): string {
  syncLoginRecovery();
  const code = error instanceof ApiError ? error.message : "";
  // #ifdef H5
  if (code === "COOKIE_LOCK_UNAVAILABLE") return t.value.session.secureBrowserUnsupported;
  // #endif
  if (code === "OAUTH_LOGIN_EXPIRED") return t.value.thirdParty.restartExpired;
  const geoMessage = geoText(code);
  if (geoMessage) return geoMessage;
  switch (resolveRemoteLoginErrorKind(code)) {
    case "invalidCredentials": return t.value.login.errorInvalidCredentials;
    case "invalidPhone": return invalidPhoneMessage.value;
    case "otpInvalid": return t.value.login.errorRemoteOtpInvalid;
    case "twoFactorInvalid": return t.value.security.twoFactorCodeInvalid;
    case "temporarilyLocked": return t.value.login.errorTemporarilyLocked;
    case "accountBlocked": return t.value.login.errorAccountBlocked;
    case "passwordResetRequired": return t.value.login.errorPasswordResetRequired;
    case "signInStateChanged": return t.value.login.errorSignInStateChanged;
    default: return loginResultUnknown.value ? t.value.login.unknownAttempt : t.value.authOtp.errorServiceUnavailable;
  }
}

async function signInWithPassword(captchaTicket?: string) {
  if (loading.value || signInTimer) return;
  error.value = null;
  if (!phoneOk.value) { error.value = invalidPhoneMessage.value; return; }
  if (!pwdOk.value) { error.value = t.value.login.errorInvalidPassword; return; }
  const phoneAtSignIn = fullPhone.value;
  const flowVersion = ++otpFlowVersion;
  const passwordAttempt: PasswordAttemptContext = {
    version: flowVersion,
    phone: phoneAtSignIn,
    password: password.value,
  };
  loading.value = true;
  try {
    const result = await authApi.login({
      countryCode: country.value,
      phone: phoneClean.value,
      password: password.value,
      ...(captchaTicket ? { captchaTicket } : {}),
    });
    if (!isCurrentPasswordAttempt(passwordAttempt)) {
      if (result.kind === "authenticated") authApi.discardSessionIfCurrent(result.vaultRevision);
      if (isCurrentPasswordFlow(passwordAttempt)) loading.value = false;
      return;
    }
    if (result.kind === "challenge") {
      remoteTwoFactorChallenge.value = result.challengeNo;
      code.value = ["", "", "", "", "", ""];
      focusCode();
      loading.value = false;
      step.value = 2;
      return;
    }
    finishSignIn({ accountId: authenticatedAccountId(result.user), onboardingComplete: result.user.onboardingComplete, serverProfile: result.user, serverSessionRevision: result.vaultRevision });
  } catch (loginError) {
    if (!isCurrentPasswordAttempt(passwordAttempt)) {
      if (isCurrentPasswordFlow(passwordAttempt)) loading.value = false;
      return;
    }
    loading.value = false;
    if (loginError instanceof Error && loginError.message === "USER_CAPTCHA_REQUIRED") {
      captchaPurpose.value = "password";
      showCaptcha.value = true;
      return;
    }
    error.value = remoteLoginError(loginError);
  }
}

async function verifyRemoteTwoFactor() {
  const challengeNo = remoteTwoFactorChallenge.value;
  if (!challengeNo) return;
  const codeAtVerify = code.value.join("");
  const twoFactorAttempt: RemoteTwoFactorAttemptContext = {
    version: otpFlowVersion,
    phone: fullPhone.value,
    challengeNo,
  };
  loading.value = true;
  try {
    const result = await authApi.completeTwoFactor({
      countryCode: country.value,
      phone: phoneClean.value,
      password: password.value,
      challengeNo,
      code: codeAtVerify,
    });
    if (result.kind !== "authenticated") throw new Error("TWO_FACTOR_SESSION_MISSING");
    if (!isCurrentRemoteTwoFactorAttempt(twoFactorAttempt)) {
      authApi.discardSessionIfCurrent(result.vaultRevision);
      return;
    }
    if (code.value.join("") !== codeAtVerify) {
      authApi.discardSessionIfCurrent(result.vaultRevision);
      loading.value = false;
      return;
    }
    finishSignIn({ accountId: authenticatedAccountId(result.user), onboardingComplete: result.user.onboardingComplete, serverProfile: result.user, serverSessionRevision: result.vaultRevision });
  } catch (loginError) {
    if (!isCurrentRemoteTwoFactorAttempt(twoFactorAttempt)) return;
    loading.value = false;
    if (code.value.join("") !== codeAtVerify) return;
    error.value = remoteLoginError(loginError);
  }
}
async function verifyCode() {
  if (loading.value || signInTimer || otpChallengeMissing.value) return;
  error.value = null;
  if (!codeOk.value) { error.value = t.value.login.errorInvalidCode; return; }
  if (remoteTwoFactorChallenge.value) { await verifyRemoteTwoFactor(); return; }
  const requestId = otpRequestId.value;
  if (!requestId) { loading.value = false; error.value = t.value.authOtp.errorOtpNotFound; return; }
  const codeAtVerify = code.value.join("");
  const context: OtpFlowContext = {
    version: otpFlowVersion,
    phone: fullPhone.value,
    scene: otpScene.value,
    requestId,
  };
  loading.value = true;
  if (remoteApiEnabled) {
    if (mode.value === "reset") {
      try {
        await authApi.verifyPasswordResetOtp({
          countryCode: country.value,
          phone: phoneClean.value,
          challengeNo: requestId,
          code: codeAtVerify,
        });
        if (!isCurrentOtpFlow(context)) return;
        loading.value = false;
        if (code.value.join("") !== codeAtVerify) return;
        verifiedResetCode = codeAtVerify;
        step.value = 3;
      } catch (cause) {
        if (!isCurrentOtpFlow(context)) return;
        loading.value = false;
        if (code.value.join("") !== codeAtVerify) return;
        const message = cause instanceof ApiError ? cause.message : "";
        const invalidOtp = message === "USER_PASSWORD_RESET_CHALLENGE_INVALID" || message === "OTP_CODE_INVALID";
        // The API uses the same refusal for wrong digits and an inactive challenge.
        if (invalidOtp && codeAtVerify === verifiedResetCode) clearSmsChallenge();
        error.value = invalidOtp
          ? t.value.authOtp.errorOtpInvalidOrExpired
          : t.value.authOtp.errorServiceUnavailable;
      }
      return;
    }
    try {
      const result = await authApi.completeOtpLogin({
        countryCode: country.value,
        phone: phoneClean.value,
        challengeNo: requestId,
        code: codeAtVerify,
      });
      if (result.kind !== "authenticated") throw new Error("LOGIN_OTP_SESSION_MISSING");
      if (!isCurrentOtpFlow(context)) {
        authApi.discardSessionIfCurrent(result.vaultRevision);
        return;
      }
      if (code.value.join("") !== codeAtVerify) {
        authApi.discardSessionIfCurrent(result.vaultRevision);
        loading.value = false;
        return;
      }
      finishSignIn({
        accountId: authenticatedAccountId(result.user),
        onboardingComplete: result.user.onboardingComplete,
        serverProfile: result.user,
        serverSessionRevision: result.vaultRevision,
      }, context);
    } catch (cause) {
      if (!isCurrentOtpFlow(context)) return;
      loading.value = false;
      if (code.value.join("") !== codeAtVerify) return;
      error.value = remoteLoginError(cause);
    }
    return;
  }
  if (mode.value !== "reset" && otpVerifyToken.value) {
    finishVerifiedOtpSignIn(otpVerifyToken.value, context);
    return;
  }
  // FEAT-AUTH01: server 同构校验(TTL/attemptsLeft/一码一)。PROD: 用返回的
  // verifyToken 换 session；mock 同样必须由本地 exchange 消费该凭证。
  const res = await otpVerify(context.phone, context.scene, context.requestId, codeAtVerify);
  if (!isCurrentOtpFlow(context)) return;
  if (code.value.join("") !== codeAtVerify) { loading.value = false; return; }
  if (!res.ok) {
    loading.value = false;
    // 与 register.vue 的同名分支消费同一个 otpVerify 结果类型 —— 两边必须一起接,
    // 否则同一种拒绝在登录页和注册页显示不同文案。
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
    } else {
      error.value = t.value.authOtp.errorOtpNotFound;
    }
    return;
  }
  if (mode.value === "reset") { loading.value = false; step.value = 3; return; }
  otpVerifyToken.value = res.verifyToken;
  finishVerifiedOtpSignIn(res.verifyToken, context);
}
async function finishReset() {
  if (loading.value || signInTimer) return;
  error.value = null;
  if (!pwdMatch.value) { error.value = primaryDisabledReason.value; return; }
  const challengeNo = otpRequestId.value;
  if (!challengeNo) { error.value = t.value.authOtp.errorOtpNotFound; return; }
  const resetAttempt: PasswordResetAttemptContext = {
    version: otpFlowVersion,
    phone: fullPhone.value,
    requestId: challengeNo,
  };
  loading.value = true;
  try {
    await authApi.completePasswordReset({
      countryCode: country.value,
      phone: phoneClean.value,
      challengeNo,
      code: code.value.join(""),
      newPassword: newPassword.value,
    });
    if (!isCurrentPasswordResetAttempt(resetAttempt)) return;
  } catch (cause) {
    if (!isCurrentPasswordResetAttempt(resetAttempt)) return;
    loading.value = false;
    const message = cause instanceof ApiError ? cause.message : "";
    const invalidOtp = message === "USER_PASSWORD_RESET_CHALLENGE_INVALID" || message === "OTP_CODE_INVALID";
    if (invalidOtp) {
      clearSmsChallenge();
      code.value = ["", "", "", "", "", ""];
      refreshResend();
      step.value = 2;
      focusCode();
      return;
    }
    error.value = message === "USER_NEW_PASSWORD_MUST_DIFFER"
      ? t.value.login.errorPasswordUnchanged
      : t.value.authOtp.errorServiceUnavailable;
    return;
  }
  loading.value = false;
  toast.success(t.value.login.resetSuccess, "");
  invalidateOtpFlow();
  mode.value = "password";
  step.value = 1;
  password.value = "";
  newPassword.value = "";
  confirmPwd.value = "";
}

function onPrimary() {
  if (authApi.pendingLogin()) { loginRecoveryPending.value = true; void recoverLoginResult(); return; }
  if (step.value === 1 && !phoneOk.value) {
    error.value = primaryDisabledReason.value;
    return;
  }
  if (step.value === 1) { if (mode.value === "password") signInWithPassword(); else goSendCode(); }
  else if (step.value === 2) verifyCode();
  else finishReset();
}
function toggleMode() {
  invalidateOtpFlow();
  error.value = null;
  password.value = ""; newPassword.value = ""; confirmPwd.value = "";
  showPwd.value = false; showCountries.value = false;
  code.value = ["", "", "", "", "", ""];
  step.value = 1;
  mode.value = mode.value === "password" ? "otp" : "password";
}
function goReset() {
  invalidateOtpFlow();
  error.value = null;
  password.value = ""; newPassword.value = ""; confirmPwd.value = "";
  showPwd.value = false; showCountries.value = false;
  code.value = ["", "", "", "", "", ""];
  step.value = 1;
  mode.value = "reset";
}
function cancelOwnedPasswordChallenge() {
  if (!remoteTwoFactorChallenge.value) return;
  const attempt = authApi.pendingLoginContext();
  if (attempt && !attempt.pending && attempt.context.challengeNo === remoteTwoFactorChallenge.value) {
    authApi.cancelLoginChallenge();
  }
}
function back() {
  cancelOwnedPasswordChallenge();
  const preserveSmsChallenge = mode.value !== "password" && step.value > 1;
  invalidateOtpFlow(preserveSmsChallenge);
  error.value = null;
  code.value = ["", "", "", "", "", ""];
  if (mode.value === "reset" && step.value === 1) {
    mode.value = "password"; return;
  }
  if (mode.value === "reset" && step.value === 3) {
    newPassword.value = ""; confirmPwd.value = ""; showPwd.value = false;
    if (!remoteApiEnabled) clearSmsChallenge();
    refreshResend();
    step.value = 2; return;
  }
  focusCode();
  step.value = 1;
}
function close() {
  invalidateOtpFlow();
  navReset({ url: "/pages/onboarding/intro", fail: () => {} });
}
// Alone on the stack (sign-in redirects here), the system back does what the top bar's back or close does (02 §2.7.3).
useHeaderSystemBack(() => !loginRecoveryPending.value && (step.value > 1 || mode.value === "reset") ? back : close);
function goRegister() {
  invalidateOtpFlow();
  const query = refOnLogin.value ? `?ref=${encodeURIComponent(refOnLogin.value)}` : "";
  navReset({ url: `/pages/register/register${query}`, fail: () => {} });
}

function cleanup() {
  cancelOwnedPasswordChallenge();
  mounted = false;
  invalidateOtpFlow();
}
onUnload(() => cleanup());
onUnmounted(() => cleanup());
</script>

<style scoped>
.lg-root { position: fixed; inset: 0; background: var(--v5-bg); overflow-y: auto; }
.lg-wrap { display: flex; flex-direction: column; padding: 16px 24px 0; min-height: 100%; box-sizing: border-box; }
.lg-top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }
.lg-iconbtn { position: relative; width: 44px; height: 44px; margin-left: -2px; display: grid; place-items: center; justify-self: start; }
/* 03 §3.1 顶部图标动作: its own Liquid Glass round face, as on SubPageHeader and the onboarding back; 40 face, 44 target. */
.lg-iconbtn__face { position: relative; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; transition: transform 100ms cubic-bezier(.2, .8, .2, 1); }
.lg-iconbtn__face > svg, .lg-iconbtn__face > .nx-native-svg { position: relative; z-index: 1; }
[data-theme="light"] .lg-iconbtn__face { --ui-control-shadow: var(--v5-glass-shadow); }
.lg-iconbtn:active .lg-iconbtn__face { transform: scale(.92); }
@media (prefers-reduced-motion: reduce) { .lg-iconbtn__face { transition: none; } .lg-iconbtn:active .lg-iconbtn__face { transform: none; } }
/* 《08》§2 按下反馈 —— 本页六个可点控件原先按下去零视觉变化(CDP forcePseudoState 实测) */
.lg-phone__cc:active, .lg-eye:active, .lg-forgot:active, .lg-switch:active { opacity: 0.6; }
.lg-brand { display: flex; align-items: center; gap: 6px; justify-self: center; }
.lg-dots { margin-top: 28px; display: flex; align-items: center; gap: 6px; }
/* Upcoming step: foreground 8%, the step-track tone of 04 (onboarding track), so it reads on both page floors. */
.lg-dot { height: 4px; width: 16px; border-radius: 9999px; background: color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.lg-dot--active { width: 32px; background: var(--v5-brand); }
.lg-dot--done { width: 16px; background: color-mix(in srgb, var(--v5-brand) 40%, transparent); }
.lg-title { display: block; font-family: var(--font-v5); margin-top: 12px; font-size: 34px; font-weight: 600; line-height: 1.15; letter-spacing: -0.025em; color: var(--v5-ink); }
.lg-mode-badge { align-self: flex-start; margin-top: 8px; }
/* 01 §1.1.2 整体底色: the shared .nx-tint (brand hue over surface, soft inner rim), no hard stroke. */
.lg-recovery-notice { --nx-tint: var(--v5-brand); margin-top: 12px; padding: 8px 12px; border-radius: 12px; }
.lg-recovery__account { box-sizing: border-box; padding: 0 16px; font-size: var(--ui-type-input); color: var(--v5-ink); }
.lg-recovery__input { box-sizing: border-box; height: 56px; padding: 0 16px; border-radius: 16px; background: var(--v5-surface); color: var(--v5-ink); font-size: var(--ui-type-input); line-height: var(--ui-type-input-lh); }
.lg-recovery__cta { display: flex; flex-direction: column; }
.lg-recovery__action { margin-top: 12px; }
.lg-recovery__secondary { min-height: 44px; display: flex; align-items: center; justify-content: center; font: var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5); color: var(--v5-brand); }
.lg-recovery__secondary[aria-disabled="true"] { opacity: .5; }
.lg-recovery-notice__t { display: block; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-2); }
.lg-sub { display: block; margin-top: 8px; font-size: var(--ui-type-list-subtitle); color: var(--v5-ink-3); }
.lg-sub__ph { font-family: var(--font-v5); color: var(--v5-ink); font-variant-numeric: tabular-nums; }
.lg-body { margin-top: 28px; }
.lg-col { display: flex; flex-direction: column; gap: 12px; }
.lg-phone { position: relative; background: var(--v5-surface); border: 1px solid var(--v5-surface-2); border-radius: 16px; height: 56px; display: flex; align-items: center; }
.lg-phone--err { border-color: color-mix(in srgb, var(--v5-danger) 55%, transparent); }
.lg-phone__cc { height: 100%; padding: 0 16px; display: flex; align-items: center; gap: 4px; border-right: 1px solid var(--v5-surface-2); transition: opacity 0.15s; }
.lg-phone__cc-t { font-size: var(--ui-type-body); color: var(--v5-ink); }
.lg-phone__in { flex: 1; height: 100%; background: transparent; padding: 0 16px; font-size: var(--ui-type-input); line-height: var(--ui-type-input-lh); color: var(--v5-ink); }
.lg-phone-hint { display: block; margin-top: -4px; padding: 0 4px; font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); color: var(--v5-ink-3); }
.lg-phone-hint--err { color: var(--v5-danger); }
.lg-field-wrap { display: flex; align-items: center; background: var(--v5-surface); border: 1px solid var(--v5-surface-2); border-radius: 16px; height: 56px; padding: 0 16px; }
.lg-field-wrap--err { border-color: color-mix(in srgb, var(--v5-danger) 45%, transparent); }
.lg-field--flex { flex: 1; background: transparent; border: none; height: 100%; font-size: var(--ui-type-input); line-height: var(--ui-type-input-lh); color: var(--v5-ink); }
/* 《07》tap≥44:三处热区实测 24×30 / 65×36 / 342×18。热区靠 min-* 撑开,
   图标与文字靠 flex 居中 + 负 margin 抵消,视觉位置与原先一致(只有热区变大)。 */
.lg-eye { min-width: 44px; min-height: 44px; margin-right: -10px; display: flex; align-items: center; justify-content: center; }
.lg-forgot-row { display: flex; justify-content: flex-end; }
.lg-forgot { font-size: var(--ui-type-list-subtitle); color: var(--v5-ink-3); min-height: 44px; padding: 0 4px; line-height: 44px; }
.lg-development-otp { padding: 8px 12px; border-radius: 12px; background: var(--v5-warning-soft); }
.lg-development-otp__t { font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-warning-ink); }
/* 更换手机号 / 重新发送 are NxButton text S (13/18, brand) whose 44px target reaches 13px past the row: 4px more than the
   column gap keeps that target off the code field above. */
.lg-resend { margin-top: 4px; display: flex; align-items: center; justify-content: space-between; font-size: var(--ui-type-list-subtitle); line-height: var(--ui-type-list-subtitle-lh); }
.lg-resend__count { font-family: var(--font-v5); color: var(--v5-ink-3); font-variant-numeric: tabular-nums; }
.lg-error { margin-top: 12px; display: flex; align-items: center; gap: 8px; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-danger); background: var(--v5-danger-soft); border-radius: 12px; padding: 8px 12px; }
.lg-error__t { flex: 1; }
.lg-cta { margin-top: 24px; }
.lg-cta--off { opacity: .5; }
/* 03 §3.1 禁用: the greyed CTA names its reason in one neutral line right under it (description role, ink-3). */
.lg-cta-reason { display: block; min-height: var(--ui-type-description-lh); margin-top: 8px; text-align: center; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
.lg-cta-reason--off { visibility: hidden; }
/* min-height 18→44 会多占 26px,margin-top 12→4 抵消一半,视觉间距 12→17px 基本不变 */
.lg-switch { margin-top: 4px; min-height: 44px; display: flex; align-items: center; justify-content: center; }
.lg-switch__t { font-size: var(--ui-type-list-subtitle); color: var(--v5-brand); font-weight: 500; }
.lg-divider { display: flex; align-items: center; margin: 24px 0; }
.lg-divider__line { flex: 1; height: 1px; background: color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.lg-divider__t { padding: 0 12px; font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); color: var(--v5-ink-3); }
.lg-footer { margin-top: auto; padding-top: 32px; text-align: center; }
.lg-footer__acc { display: block; font-size: var(--ui-type-list-subtitle); color: var(--v5-ink-3); }
/* 句中行内链接:WCAG 2.5.8 对 inline 目标豁免 44pt(强撑高会拆掉整句行高),
   但纵向 padding 对 inline 元素不撑行盒、只扩热区 —— 17px 高的热区就此变 45px,零布局代价。 */
.lg-footer__link { color: var(--v5-brand); font-weight: 500; padding: 14px 10px; margin: 0 -10px; transition: opacity 0.15s; }
.lg-footer__link:active { opacity: 0.6; }
</style>
