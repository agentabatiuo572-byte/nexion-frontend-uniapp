<template>
  <view class="lg-root">
    <view class="lg-wrap">
      <!-- Top bar -->
      <view class="lg-top">
        <view v-if="step > 1 || mode === 'reset'" class="lg-iconbtn" @click="back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8D0DC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </view>
        <view v-else class="lg-iconbtn" @click="close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8D0DC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </view>
        <view class="lg-brand">
          <view class="lg-brand__n"><text class="lg-brand__n-t">N</text></view>
          <text class="lg-brand__name">Nexion</text>
        </view>
        <view class="lg-top__sp" />
      </view>

      <!-- Step indicator (otp: 2, reset: 3) -->
      <view v-if="mode !== 'password'" class="lg-dots">
        <view v-for="n in (mode === 'reset' ? 3 : 2)" :key="n" class="lg-dot" :class="n === step ? 'lg-dot--active' : (n < step ? 'lg-dot--done' : '')" />
      </view>

      <!-- Title -->
      <text class="lg-title">{{ titleText }}</text>
      <text v-if="step === 1 && mode === 'reset'" class="lg-sub">{{ t.login.resetSubtitle }}</text>
      <text v-else-if="step === 2" class="lg-sub">{{ t.login.codeSentTo }} <text class="lg-sub__ph">{{ country }} {{ phone }}</text></text>
      <text v-else-if="step === 3" class="lg-sub">{{ t.login.newPasswordHint }}</text>

      <!-- Body -->
      <view class="lg-body">
        <!-- Step 1: phone (+ password for password mode) -->
        <view v-if="step === 1" class="lg-col">
          <view class="lg-phone">
            <view class="lg-phone__cc" @click="showCountries = !showCountries">
              <text class="lg-phone__cc-t">{{ country }}</text>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ transform: showCountries ? 'rotate(180deg)' : '' }"><path d="m6 9 6 6 6-6" /></svg>
            </view>
            <input class="lg-phone__in" type="number" :placeholder="t.login.phonePlaceholder" :value="phone" @input="onPhone" />
            <view v-if="showCountries" class="lg-cc-list">
              <view v-for="c in COUNTRIES" :key="c.code" class="lg-cc-item" :class="{ 'lg-cc-item--on': c.code === country }" @click="pickCountry(c.code)">
                <text class="lg-cc-item__name">{{ c.name }}</text>
                <text class="lg-cc-item__code">{{ c.code }}</text>
              </view>
            </view>
          </view>
          <template v-if="mode === 'password'">
            <view class="lg-field-wrap" :class="{ 'lg-field-wrap--err': password && !pwdOk }">
              <input class="lg-field--flex" :type="showPwd ? 'text' : 'password'" :placeholder="t.login.passwordPlaceholder" :maxlength="PASSWORD_MAX_LENGTH" :value="password" @input="onPwd" />
              <view class="lg-eye" @click="showPwd = !showPwd">
                <svg v-if="showPwd" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><path d="m2 2 20 20" /></svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
              </view>
            </view>
            <view class="lg-forgot-row">
              <text class="lg-forgot" @click="goReset">{{ t.login.forgotPassword }}</text>
            </view>
          </template>
        </view>

        <!-- Step 2: OTP -->
        <view v-else-if="step === 2" class="lg-col">
          <view class="lg-otp">
            <input v-for="(d, i) in code" :key="i" class="lg-otp__in" :class="{ 'lg-otp__in--filled': d }" type="number" :maxlength="1" :focus="focusIdx === i" :value="d" @input="onCode(i, $event)" />
          </view>
          <view class="lg-resend">
            <text class="lg-resend__change" @click="back">{{ t.login.changeNumber }}</text>
            <text v-if="resendLeft > 0" class="lg-resend__count">{{ resendInText }}</text>
            <text v-else class="lg-resend__btn" @click="resend">{{ t.login.resend }}</text>
          </view>
        </view>

        <!-- Step 3: new password (reset) -->
        <view v-else class="lg-col">
          <view class="lg-field-wrap" :class="{ 'lg-field-wrap--err': newPassword && !newPwdOk }">
            <input class="lg-field--flex" :type="showPwd ? 'text' : 'password'" :placeholder="t.login.newPasswordPlaceholder || t.login.passwordPlaceholder" :maxlength="PASSWORD_MAX_LENGTH" :value="newPassword" @input="onNewPwd" />
            <view class="lg-eye" @click="showPwd = !showPwd">
              <svg v-if="showPwd" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><path d="m2 2 20 20" /></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
            </view>
          </view>
          <view class="lg-field-wrap" :class="{ 'lg-field-wrap--err': confirmPwd && newPassword !== confirmPwd }">
            <input class="lg-field--flex" :type="showPwd ? 'text' : 'password'" :placeholder="t.login.confirmPasswordPlaceholder" :maxlength="PASSWORD_MAX_LENGTH" :value="confirmPwd" @input="onConfirm" />
          </view>
        </view>
      </view>

      <!-- Error -->
      <view v-if="error" class="lg-error">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
        <text class="lg-error__t">{{ error }}</text>
      </view>

      <!-- Primary CTA -->
      <view class="lg-cta" :class="canPrimary ? 'lg-cta--on' : ''" @click="onPrimary">
        <text v-if="loading" class="lg-cta__t lg-cta__t--on">···</text>
        <text v-else class="lg-cta__t" :class="canPrimary ? 'lg-cta__t--on' : ''">{{ primaryText }}</text>
      </view>

      <!-- Mode switch (password ↔ otp), only on step 1 non-reset -->
      <view v-if="step === 1 && mode !== 'reset'" class="lg-switch" @click="toggleMode">
        <text class="lg-switch__t">{{ mode === 'password' ? t.login.useCodeInstead : t.login.usePasswordInstead }}</text>
      </view>

      <!-- OAuth (step 1, not reset) -->
      <view v-if="step === 1 && mode !== 'reset'" class="lg-oauth">
        <view class="lg-divider"><view class="lg-divider__line" /><text class="lg-divider__t">{{ t.login.orContinueWith }}</text><view class="lg-divider__line" /></view>
        <view class="lg-social">
          <view v-for="o in oauth" :key="o.label" class="lg-social__btn">
            <view class="lg-social__ic" v-html="o.svg" />
            <text class="lg-social__lbl">{{ o.label }}</text>
          </view>
        </view>
      </view>

      <!-- Footer -->
      <view class="lg-footer">
        <text v-if="step === 1 && mode !== 'reset'" class="lg-footer__acc">{{ t.login.noAccount }} <text class="lg-footer__link" @click="goRegister">{{ t.login.signUp }}</text></text>
      </view>
    </view>

    <GlobalUi />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import GlobalUi from "@/components/global-ui.vue";
import { useT } from "@/i18n/use-t";
import { useAuth } from "@/store/auth";
import { useSponsorship } from "@/store/sponsorship";
import { toast } from "@/store/ui";
import { isPasswordOk, PASSWORD_MAX_LENGTH } from "@/auth/password-rules";
import { safeReturnTo } from "@/routing/safe-return-to";

const t = useT();
const auth = useAuth();
const sponsorship = useSponsorship();

const COUNTRIES = [
  { code: "+1", name: "US / Canada" }, { code: "+44", name: "United Kingdom" }, { code: "+49", name: "Germany" },
  { code: "+33", name: "France" }, { code: "+34", name: "Spain" }, { code: "+81", name: "Japan" },
  { code: "+82", name: "South Korea" }, { code: "+55", name: "Brazil" }, { code: "+62", name: "Indonesia" },
  { code: "+63", name: "Philippines" }, { code: "+66", name: "Thailand" }, { code: "+971", name: "UAE" }, { code: "+7", name: "Russia" },
];
const RESEND_SECONDS = 60;
const oauth = [
  { label: "Passkey", svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="10" r="5"/><path d="m13 10 7 0M17 10v4M20 10v3"/></svg>' },
  { label: "Google", svg: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-1.5 3.6-5.5 3.6-3.3 0-6-2.7-6-6.1S8.7 5.5 12 5.5c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3 14.6 2 12 2 6.9 2 2.7 6.1 2.7 11.6S6.9 21.3 12 21.3c6.9 0 9.4-4.9 9.4-7.4 0-.5 0-.9-.1-1.3L12 10.2z"/></svg>' },
  { label: "Apple", svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M17.06 12.43c0-2.6 2.13-3.85 2.23-3.91-1.22-1.78-3.11-2.02-3.78-2.04-1.61-.16-3.14.95-3.96.95-.82 0-2.08-.93-3.42-.9-1.76.02-3.38 1.02-4.29 2.6-1.83 3.18-.47 7.88 1.31 10.46.87 1.27 1.91 2.69 3.27 2.64 1.32-.05 1.81-.85 3.41-.85 1.59 0 2.04.85 3.42.82 1.41-.02 2.31-1.29 3.18-2.56 1-1.47 1.41-2.9 1.43-2.97-.03-.02-2.75-1.06-2.79-4.24zM14.5 4.74c.73-.88 1.21-2.11 1.08-3.33-1.04.04-2.31.69-3.06 1.57-.67.77-1.26 2.02-1.1 3.22 1.16.09 2.34-.59 3.08-1.46z"/></svg>' },
  { label: "Telegram", svg: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#229ED9" d="M9.78 16.32 9.45 20c.48 0 .69-.2.94-.45l2.27-2.17 4.7 3.44c.86.48 1.48.23 1.7-.79l3.08-14.43c.3-1.34-.48-1.87-1.32-1.56L1.6 9.5c-1.3.5-1.29 1.24-.22 1.57l4.62 1.44 10.73-6.77c.5-.31.97-.14.59.21L9.78 16.32z"/></svg>' },
];

type Step = 1 | 2 | 3;
type LoginMode = "password" | "otp" | "reset";

const mode = ref<LoginMode>("password");
const step = ref<Step>(1);
const country = ref("+1");
const showCountries = ref(false);
const phone = ref("");
const password = ref("");
const newPassword = ref("");
const confirmPwd = ref("");
const code = ref<string[]>(["", "", "", "", "", ""]);
const focusIdx = ref(0);
const showPwd = ref(false);
const error = ref<string | null>(null);
const resendLeft = ref(0);
const loading = ref(false);
const returnParam = ref<string | null>(null);
const refOnLogin = ref<string | null>(null);

let resendTimer: ReturnType<typeof setInterval> | undefined;
let signInTimer: ReturnType<typeof setTimeout> | undefined;
let mounted = true;

onLoad((options) => {
  const o = (options || {}) as Record<string, string>;
  if (o.return) returnParam.value = o.return;
  if (o.ref) refOnLogin.value = o.ref;
});

const phoneClean = computed(() => phone.value.replace(/\s+/g, ""));
const phoneOk = computed(() => /^\d{6,15}$/.test(phoneClean.value));
const codeOk = computed(() => /^\d{6}$/.test(code.value.join("")));
// Login mode accepts any non-empty password (existing users may have shorter
// passwords from before the strength rule) — mirrors prototype `pwdOk`.
const pwdOk = computed(() => password.value.length > 0);
// Reset mode's new password must pass the full strength check.
const newPwdOk = computed(() => isPasswordOk(newPassword.value, { phone: phoneClean.value }));
const pwdMatch = computed(() => newPassword.value === confirmPwd.value && newPwdOk.value);

const titleText = computed(() => {
  if (step.value === 3) return t.value.login.newPasswordTitle;
  if (step.value === 2) return t.value.login.codeStepTitle;
  if (mode.value === "reset") return t.value.login.resetTitle;
  return t.value.login.title;
});
const primaryText = computed(() => {
  if (step.value === 1) return mode.value === "password" ? t.value.login.signIn : t.value.login.sendCode;
  if (step.value === 2) return t.value.login.verify;
  return t.value.login.finishReset;
});
const canPrimary = computed(() => {
  if (step.value === 1) return mode.value === "password" ? (phoneOk.value && pwdOk.value && !loading.value) : phoneOk.value;
  if (step.value === 2) return codeOk.value && !loading.value;
  return pwdMatch.value && !loading.value;
});
const resendInText = computed(() => (t.value.login.resendIn || "{s}s").replace("{s}", String(resendLeft.value)));

function inputVal(e: Event): string {
  return (e as unknown as { detail: { value: string } }).detail.value;
}
function onPhone(e: Event) { phone.value = inputVal(e); error.value = null; }
function onPwd(e: Event) { password.value = inputVal(e); error.value = null; }
function onNewPwd(e: Event) { newPassword.value = inputVal(e); error.value = null; }
function onConfirm(e: Event) { confirmPwd.value = inputVal(e); error.value = null; }
function onCode(i: number, e: Event) {
  const digits = inputVal(e).replace(/\D/g, "");
  const next = [...code.value];
  next[i] = digits.slice(-1) || "";
  code.value = next;
  error.value = null;
  if (next[i] && i < 5) focusIdx.value = i + 1;
  if (next.every(Boolean)) verifyCode();
}
function pickCountry(c: string) { country.value = c; showCountries.value = false; }

function clearSignIn() {
  if (signInTimer) { clearTimeout(signInTimer); signInTimer = undefined; }
  loading.value = false;
}

function startResend() {
  resendLeft.value = RESEND_SECONDS;
  if (resendTimer) clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    resendLeft.value = Math.max(0, resendLeft.value - 1);
    if (resendLeft.value <= 0 && resendTimer) clearInterval(resendTimer);
  }, 1000);
}
function resend() {
  if (resendLeft.value > 0) return;
  code.value = ["", "", "", "", "", ""];
  focusIdx.value = 0;
  error.value = null;
  startResend();
}

function goSendCode() {
  error.value = null;
  if (!phoneOk.value) { error.value = t.value.login.errorInvalidPhone; return; }
  step.value = 2;
  startResend();
}
function signInWithPassword() {
  if (loading.value || signInTimer) return;
  error.value = null;
  if (!phoneOk.value || !pwdOk.value) { error.value = t.value.login.errorInvalidPassword; return; }
  loading.value = true;
  signInTimer = setTimeout(() => {
    if (!mounted) return;
    const identity = `${country.value}${phoneClean.value}@demo.nexion.ai`;
    auth.signIn(identity);
    if (refOnLogin.value) sponsorship.bind(refOnLogin.value);
    const dest = safeReturnTo(returnParam.value, "/pages/index/index");
    uni.reLaunch({ url: dest, fail: () => uni.reLaunch({ url: "/pages/index/index", fail: () => {} }) });
  }, 700);
}
function verifyCode() {
  if (loading.value || signInTimer) return;
  error.value = null;
  if (!codeOk.value) { error.value = t.value.login.errorInvalidCode; return; }
  if (mode.value === "reset") { step.value = 3; return; }
  loading.value = true;
  signInTimer = setTimeout(() => {
    if (!mounted) return;
    const identity = `${country.value}${phoneClean.value}@demo.nexion.ai`;
    auth.signIn(identity);
    if (refOnLogin.value) sponsorship.bind(refOnLogin.value);
    const dest = safeReturnTo(returnParam.value, "/pages/index/index");
    uni.reLaunch({ url: dest, fail: () => uni.reLaunch({ url: "/pages/index/index", fail: () => {} }) });
  }, 700);
}
function finishReset() {
  if (loading.value || signInTimer) return;
  error.value = null;
  if (!newPwdOk.value) { error.value = t.value.login.errorWeakPassword; return; }
  if (!pwdMatch.value) { error.value = t.value.login.passwordMismatch; return; }
  // MOCK: no real password persistence; treat as success → back to password login.
  toast.success(t.value.login.resetSuccess, "");
  mode.value = "password";
  step.value = 1;
  newPassword.value = "";
  confirmPwd.value = "";
}

function onPrimary() {
  if (step.value === 1) { if (mode.value === "password") signInWithPassword(); else goSendCode(); }
  else if (step.value === 2) verifyCode();
  else finishReset();
}
function toggleMode() {
  clearSignIn();
  error.value = null;
  password.value = ""; newPassword.value = ""; confirmPwd.value = "";
  showPwd.value = false; showCountries.value = false;
  code.value = ["", "", "", "", "", ""];
  resendLeft.value = 0;
  step.value = 1;
  mode.value = mode.value === "password" ? "otp" : "password";
}
function goReset() {
  clearSignIn();
  error.value = null;
  password.value = ""; newPassword.value = ""; confirmPwd.value = "";
  showPwd.value = false; showCountries.value = false;
  code.value = ["", "", "", "", "", ""];
  resendLeft.value = 0;
  step.value = 1;
  mode.value = "reset";
}
function back() {
  clearSignIn();
  error.value = null;
  if (mode.value === "reset" && step.value === 1) {
    code.value = ["", "", "", "", "", ""]; resendLeft.value = 0;
    mode.value = "password"; return;
  }
  if (mode.value === "reset" && step.value === 3) {
    newPassword.value = ""; confirmPwd.value = ""; showPwd.value = false;
    code.value = ["", "", "", "", "", ""]; resendLeft.value = 0;
    step.value = 2; return;
  }
  code.value = ["", "", "", "", "", ""]; resendLeft.value = 0; focusIdx.value = 0;
  step.value = 1;
}
function close() { uni.reLaunch({ url: "/pages/onboarding/intro", fail: () => {} }); }
function goRegister() { uni.reLaunch({ url: "/pages/register/register", fail: () => {} }); }

function cleanup() {
  mounted = false;
  if (resendTimer) clearInterval(resendTimer);
  if (signInTimer) clearTimeout(signInTimer);
}
onUnload(() => cleanup());
onUnmounted(() => cleanup());
</script>

<style scoped>
.lg-root { position: fixed; inset: 0; background: #000; overflow-y: auto; }
.lg-wrap { display: flex; flex-direction: column; padding: 16px 24px 24px; min-height: 100%; box-sizing: border-box; }
.lg-top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }
.lg-iconbtn { width: 44px; height: 44px; margin-left: -8px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; justify-self: start; }
.lg-brand { display: flex; align-items: center; gap: 6px; justify-self: center; }
.lg-brand__n { width: 24px; height: 24px; border-radius: 7px; background: var(--v5-ink); display: flex; align-items: center; justify-content: center; }
.lg-brand__n-t { color: var(--v5-surface); font-family: var(--font-v5); font-weight: 600; font-size: 13px; }
.lg-brand__name { color: var(--v5-ink); font-weight: 600; font-family: var(--font-v5); font-size: 16px; letter-spacing: -0.02em; }
.lg-dots { margin-top: 28px; display: flex; align-items: center; gap: 6px; }
.lg-dot { height: 4px; width: 16px; border-radius: 9999px; background: var(--v5-surface-2); transition: all 0.3s; }
.lg-dot--active { width: 32px; background: var(--v5-brand); }
.lg-dot--done { width: 16px; background: rgba(158,220,29,0.4); }
.lg-title { display: block; font-family: var(--font-v5); margin-top: 12px; font-size: 28px; font-weight: 600; line-height: 1.15; letter-spacing: -0.02em; color: var(--v5-ink); }
.lg-sub { display: block; margin-top: 8px; font-size: 13.5px; color: var(--v5-ink-3); }
.lg-sub__ph { font-family: var(--font-v5); color: #fff; font-variant-numeric: tabular-nums; }
.lg-body { margin-top: 28px; }
.lg-col { display: flex; flex-direction: column; gap: 12px; }
.lg-phone { position: relative; background: #0F0F0F; border: 1px solid var(--v5-surface-2); border-radius: 16px; height: 56px; display: flex; align-items: center; }
.lg-phone__cc { height: 100%; padding: 0 16px; display: flex; align-items: center; gap: 4px; border-right: 1px solid var(--v5-surface-2); }
.lg-phone__cc-t { font-size: 14px; color: #fff; }
.lg-phone__in { flex: 1; height: 100%; background: transparent; padding: 0 16px; font-size: 14px; color: #fff; }
.lg-cc-list { position: absolute; top: 100%; left: 0; margin-top: 8px; width: 260px; max-height: 300px; overflow-y: auto; border-radius: 16px; background: #0B0B0B; border: 1px solid var(--v5-surface-3); padding: 6px; z-index: 20; }
.lg-cc-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 12px; }
.lg-cc-item--on { background: rgba(158,220,29,0.08); }
.lg-cc-item__name { font-size: 13.5px; color: #C8D0DC; }
.lg-cc-item__code { font-family: var(--font-v5); font-variant-numeric: tabular-nums; font-size: 13.5px; color: var(--v5-ink-4); }
.lg-field-wrap { display: flex; align-items: center; background: #0F0F0F; border: 1px solid var(--v5-surface-2); border-radius: 16px; height: 56px; padding: 0 16px; }
.lg-field-wrap--err { border-color: rgba(255,122,61,0.45); }
.lg-field--flex { flex: 1; background: transparent; border: none; height: 100%; font-size: 14px; color: #fff; }
.lg-eye { padding: 4px; }
.lg-forgot-row { display: flex; justify-content: flex-end; }
.lg-forgot { font-size: 12.5px; color: var(--v5-ink-3); min-height: 36px; padding: 0 4px; line-height: 36px; }
.lg-otp { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.lg-otp__in { width: 48px; height: 56px; text-align: center; font-family: var(--font-v5); font-variant-numeric: tabular-nums; font-size: 20px; font-weight: 600; border-radius: 12px; background: #0F0F0F; border: 1px solid var(--v5-surface-2); color: var(--v5-ink-4); }
.lg-otp__in--filled { border-color: rgba(158,220,29,0.45); color: #fff; }
.lg-resend { display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; }
.lg-resend__change { color: var(--v5-ink-3); }
.lg-resend__count { font-family: var(--font-v5); color: var(--v5-ink-4); font-variant-numeric: tabular-nums; }
.lg-resend__btn { color: var(--v5-brand); font-weight: 500; }
.lg-error { margin-top: 12px; display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--v5-brand-2); background: rgba(255,122,61,0.1); border: 1px solid rgba(255,122,61,0.25); border-radius: 8px; padding: 8px 12px; }
.lg-error__t { flex: 1; }
.lg-cta { margin-top: 20px; height: 56px; border-radius: 9999px; background: var(--v5-surface); display: flex; align-items: center; justify-content: center; }
.lg-cta--on { background: var(--v5-brand); }
.lg-cta__t { font-size: 15px; font-weight: 600; color: var(--v5-ink-4); }
.lg-cta__t--on { color: var(--v5-on-brand); }
.lg-switch { margin-top: 16px; display: flex; align-items: center; justify-content: center; }
.lg-switch__t { font-size: 13px; color: var(--v5-brand); font-weight: 500; }
.lg-divider { display: flex; align-items: center; margin: 24px 0; }
.lg-divider__line { flex: 1; height: 1px; background: var(--v5-surface-2); }
.lg-divider__t { padding: 0 12px; font-size: 11.5px; color: var(--v5-ink-3); }
.lg-social { display: flex; align-items: center; gap: 10px; }
.lg-social__btn { flex: 1; min-width: 0; height: 64px; border-radius: 16px; background: var(--v5-surface); border: 1px solid var(--v5-surface-2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
.lg-social__ic { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
.lg-social__lbl { font-size: 11px; font-weight: 500; color: var(--v5-ink-3); }
.lg-footer { margin-top: auto; padding-top: 32px; text-align: center; }
.lg-footer__acc { display: block; font-size: 12.5px; color: var(--v5-ink-3); }
.lg-footer__link { color: var(--v5-brand); font-weight: 500; }
</style>
