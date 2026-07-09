<template>
  <view class="rg-root">
    <view class="rg-wrap">
      <!-- Top bar -->
      <view class="rg-top">
        <view v-if="step > 1" class="rg-iconbtn" @click="back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8D0DC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </view>
        <view v-else class="rg-iconbtn" @click="close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8D0DC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </view>
        <view class="rg-brand">
          <view class="rg-brand__n"><text class="rg-brand__n-t">N</text></view>
          <text class="rg-brand__name">Nexion</text>
        </view>
        <view class="rg-top__sp" />
      </view>

      <!-- Sponsor card (arrived via ?ref) -->
      <view v-if="sponsorPreview" class="rg-sponsor">
        <view class="rg-sponsor__av"><text class="rg-sponsor__av-t">{{ sponsorPreview.name[0] }}</text></view>
        <view class="rg-sponsor__body">
          <text class="rg-sponsor__name"><text class="rg-sponsor__name-b">{{ sponsorPreview.name }}</text> invited you</text>
          <text class="rg-sponsor__gift">+${{ giftUsdt }} + {{ giftNex }} NEX</text>
        </view>
        <text class="rg-sponsor__v">V{{ sponsorPreview.vRank }}</text>
      </view>

      <!-- Step dots -->
      <view class="rg-dots">
        <view v-for="n in 3" :key="n" class="rg-dot" :class="n === step ? 'rg-dot--active' : (n < step ? 'rg-dot--done' : '')" />
      </view>

      <!-- Title -->
      <text class="rg-title">{{ step === 1 ? t.register.title : step === 2 ? t.register.codeStepTitle : t.register.setPasswordTitle }}</text>
      <text class="rg-subtitle">
        <template v-if="step === 1"><text class="rg-subtitle__hl">{{ fmt(t.register.subtitleHighlight, { usd: giftUsdt }) }}</text>{{ t.register.subtitleRest }}</template>
        <template v-else-if="step === 2">{{ t.register.codeSentTo }} <text class="rg-subtitle__ph">{{ country }} {{ phone }}</text></template>
        <template v-else>{{ t.register.setPasswordHint }}</template>
      </text>

      <!-- Body -->
      <view class="rg-body">
        <!-- Step 1: phone -->
        <view v-if="step === 1" class="rg-phone">
          <view class="rg-phone__cc" @click="showCountries = !showCountries">
            <text class="rg-phone__cc-t">{{ country }}</text>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ transform: showCountries ? 'rotate(180deg)' : '' }"><path d="m6 9 6 6 6-6" /></svg>
          </view>
          <input class="rg-phone__in" type="number" :placeholder="t.register.phonePlaceholder" :value="phone" @input="onPhone" />
          <view v-if="showCountries" class="rg-cc-list">
            <view v-for="c in COUNTRIES" :key="c.code" class="rg-cc-item" :class="{ 'rg-cc-item--on': c.code === country }" @click="pickCountry(c.code)">
              <text class="rg-cc-item__name">{{ c.name }}</text>
              <text class="rg-cc-item__code">{{ c.code }}</text>
            </view>
          </view>
        </view>

        <!-- Step 2: OTP + invite -->
        <view v-else-if="step === 2" class="rg-step2">
          <view class="rg-otp">
            <input v-for="(d, i) in code" :key="i" class="rg-otp__in" :class="{ 'rg-otp__in--filled': d }" type="number" :maxlength="1" :focus="focusIdx === i" :value="d" @input="onCode(i, $event)" />
          </view>
          <view class="rg-resend">
            <text class="rg-resend__change" @click="back">{{ t.register.changeNumber }}</text>
            <text v-if="resendLeft > 0" class="rg-resend__count">{{ resendInText }}</text>
            <text v-else class="rg-resend__btn" @click="resend">{{ t.register.resend }}</text>
          </view>
          <view class="rg-invite">
            <text class="rg-invite__lbl">{{ t.register.inviteLabel }} <text class="rg-invite__opt">{{ lockedRef ? t.register.inviteLockedLabel : t.register.inviteOptional }}</text></text>
            <!-- [FEAT-SHARE4] 链接来源码锁定置灰:不可修改不可删除(主人 2026-07-08 拍板);
                 无码自然进入才渲染可手输框。 -->
            <view v-if="lockedRef">
              <view class="rg-locked">
                <text class="rg-locked__code">{{ lockedRef }}</text>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </view>
              <text class="rg-locked__tag">{{ t.register.inviteLockedTag }}</text>
            </view>
            <input v-else class="rg-field" type="text" :placeholder="t.register.invitePlaceholder" :value="invite" @input="onInvite" />
          </view>
        </view>

        <!-- Step 3: password -->
        <view v-else class="rg-step3">
          <view class="rg-field-wrap" :class="{ 'rg-field-wrap--err': password && !pwdOk }">
            <input class="rg-field rg-field--flex" :type="showPwd ? 'text' : 'password'" :placeholder="t.register.passwordPlaceholder" :maxlength="PASSWORD_MAX_LENGTH" :value="password" @input="onPwd" />
            <view class="rg-eye" @click="showPwd = !showPwd">
              <svg v-if="showPwd" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><path d="m2 2 20 20" /></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
            </view>
          </view>
          <view class="rg-field-wrap" :class="{ 'rg-field-wrap--err': confirmPwd && (!pwdOk || password !== confirmPwd) }">
            <input class="rg-field rg-field--flex" :type="showPwd ? 'text' : 'password'" :placeholder="t.register.confirmPasswordPlaceholder" :maxlength="PASSWORD_MAX_LENGTH" :value="confirmPwd" @input="onConfirm" />
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

      <!-- Welcome bonus chip (step 1) -->
      <view v-if="step === 1" class="rg-bonus">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" /></svg>
        <text class="rg-bonus__t"><text class="rg-bonus__b">{{ fmt(t.register.bonusTitle, { usd: giftUsdt }) }}</text>{{ t.register.bonusHint }}</text>
      </view>

      <!-- Error -->
      <view v-if="error" class="rg-error">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
        <text class="rg-error__t">{{ error }}</text>
      </view>

      <!-- Primary CTA -->
      <view class="rg-cta" :class="[ctaEnabled && !verifying ? 'rg-cta--on' : '', verifying ? 'rg-cta--busy' : '']" @click="onCta">
        <text class="rg-cta__t" :class="ctaEnabled && !verifying ? 'rg-cta__t--on' : ''">{{ ctaLabel }}</text>
      </view>

      <!-- OAuth (step 1) -->
      <view v-if="step === 1" class="rg-oauth">
        <view class="rg-divider"><view class="rg-divider__line" /><text class="rg-divider__t">{{ t.register.orContinueWith }}</text><view class="rg-divider__line" /></view>
        <view class="rg-social">
          <view v-for="o in oauth" :key="o.label" class="rg-social__btn">
            <view class="rg-social__ic" v-html="o.svg" />
            <text class="rg-social__lbl">{{ o.label }}</text>
          </view>
        </view>
      </view>

      <!-- Footer -->
      <view class="rg-footer">
        <text v-if="step === 1" class="rg-footer__acc">{{ t.register.haveAccount }} <text class="rg-footer__link" @click="goLogin">{{ t.register.signIn }}</text></text>
        <text class="rg-footer__terms">{{ t.register.termsPrefix }}<text class="rg-footer__terms-link active:opacity-70" @click="goTerms">{{ t.register.termsServiceLink }}</text>{{ t.register.termsAndPrivacy }}</text>
      </view>
    </view>

    <CaptchaSlider v-if="showCaptcha" :phone="fullPhone" @success="onCaptchaOk" @close="showCaptcha = false" />
    <GlobalUi />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import GlobalUi from "@/components/global-ui.vue";
import CaptchaSlider from "@/components/captcha-slider.vue";
import { useT } from "@/i18n/use-t";
import { otpSend, otpVerify } from "@/store/auth-otp";
import { useAuth } from "@/store/auth";
import { useSession } from "@/store/session";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import { normalizeRefCode, useSponsorship } from "@/store/sponsorship";
import { useConfig } from "@/store/config";
import { fmt } from "@/i18n/format";
import { evaluateRegistration, commitRegistration, type RegistrationAssessment } from "@/store/risk-cluster";
import { pickSponsor, type SponsorMeta } from "@/mock/sponsors";
import { toast } from "@/store/ui";
import { isPasswordOk, PASSWORD_MAX_LENGTH } from "@/auth/password-rules";

const t = useT();
const auth = useAuth();
const session = useSession();
const app = useApp();
const bills = useBills();
const sponsorship = useSponsorship();
const cfg = useConfig();
// 礼包金额单源派生自 platform config(禁本地常量镜像)。
const giftUsdt = computed(() => cfg.config.rewards.welcomeGift.usdtAmount);
const giftNex = computed(() => cfg.config.rewards.welcomeGift.nexAmount);

const COUNTRIES = [
  { code: "+1", name: "US / Canada" }, { code: "+44", name: "United Kingdom" }, { code: "+49", name: "Germany" },
  { code: "+33", name: "France" }, { code: "+34", name: "Spain" }, { code: "+81", name: "Japan" },
  { code: "+82", name: "South Korea" }, { code: "+55", name: "Brazil" }, { code: "+62", name: "Indonesia" },
  { code: "+63", name: "Philippines" }, { code: "+66", name: "Thailand" }, { code: "+971", name: "UAE" }, { code: "+7", name: "Russia" },
];

const oauth = [
  { label: "Passkey", svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="10" r="5"/><path d="m13 10 7 0M17 10v4M20 10v3"/></svg>' },
  { label: "Google", svg: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-1.5 3.6-5.5 3.6-3.3 0-6-2.7-6-6.1S8.7 5.5 12 5.5c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3 14.6 2 12 2 6.9 2 2.7 6.1 2.7 11.6S6.9 21.3 12 21.3c6.9 0 9.4-4.9 9.4-7.4 0-.5 0-.9-.1-1.3L12 10.2z"/></svg>' },
  { label: "Apple", svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M17.06 12.43c0-2.6 2.13-3.85 2.23-3.91-1.22-1.78-3.11-2.02-3.78-2.04-1.61-.16-3.14.95-3.96.95-.82 0-2.08-.93-3.42-.9-1.76.02-3.38 1.02-4.29 2.6-1.83 3.18-.47 7.88 1.31 10.46.87 1.27 1.91 2.69 3.27 2.64 1.32-.05 1.81-.85 3.41-.85 1.59 0 2.04.85 3.42.82 1.41-.02 2.31-1.29 3.18-2.56 1-1.47 1.41-2.9 1.43-2.97-.03-.02-2.75-1.06-2.79-4.24zM14.5 4.74c.73-.88 1.21-2.11 1.08-3.33-1.04.04-2.31.69-3.06 1.57-.67.77-1.26 2.02-1.1 3.22 1.16.09 2.34-.59 3.08-1.46z"/></svg>' },
  { label: "Telegram", svg: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#229ED9" d="M9.78 16.32 9.45 20c.48 0 .69-.2.94-.45l2.27-2.17 4.7 3.44c.86.48 1.48.23 1.7-.79l3.08-14.43c.3-1.34-.48-1.87-1.32-1.56L1.6 9.5c-1.3.5-1.29 1.24-.22 1.57l4.62 1.44 10.73-6.77c.5-.31.97-.14.59.21L9.78 16.32z"/></svg>' },
];

type Step = 1 | 2 | 3;
const step = ref<Step>(1);
const country = ref("+1");
const showCountries = ref(false);
const phone = ref("");
const code = ref<string[]>(["", "", "", "", "", ""]);
const focusIdx = ref(0);
const invite = ref("");
const password = ref("");
const confirmPwd = ref("");
const showPwd = ref(false);
const error = ref<string | null>(null);
const showCaptcha = ref(false);
const registrationRisk = ref<RegistrationAssessment | null>(null);
// OTP + K1 评估进行中(⑤ 加载态): CTA 显示「校验中」,拦重复提交。
const verifying = ref(false);
const resendLeft = ref(0);
let resendTimer: ReturnType<typeof setInterval> | undefined;
let mounted = true;

// [FEAT-SHARE4] 链接来源码(?ref > pendingRefCode)合法即锁定;非法/缺失视同
// 无码,回到可手输。锁定后无任何解锁入口(防截断归因/换码自荐)。
const lockedRef = ref<string | null>(null);
const sponsorPreview = ref<SponsorMeta | null>(null);

onLoad((options) => {
  const raw = options && (options as Record<string, string>).ref;
  const norm = normalizeRefCode(raw) ?? sponsorship.pendingCode;
  if (norm) {
    lockedRef.value = norm;
    sponsorPreview.value = pickSponsor(norm);
  }
});

const phoneClean = computed(() => phone.value.replace(/\s+/g, ""));
const phoneOk = computed(() => /^\d{6,15}$/.test(phoneClean.value));
const fullPhone = computed(() => `${country.value}${phoneClean.value}`);
const codeStr = computed(() => code.value.join(""));
const codeOk = computed(() => /^\d{6}$/.test(codeStr.value));
const pwdOk = computed(() => isPasswordOk(password.value, { phone: phoneClean.value }));
const pwdMatch = computed(() => password.value === confirmPwd.value && pwdOk.value);
const ctaEnabled = computed(() => (step.value === 1 ? phoneOk.value : step.value === 2 ? codeOk.value : pwdMatch.value));
const ctaLabel = computed(() =>
  step.value === 2 && verifying.value
    ? t.value.register.verifying
    : step.value === 1
      ? t.value.register.sendCode
      : step.value === 2
        ? t.value.register.verify
        : t.value.register.finish,
);
const resendInText = computed(() => (t.value.register.resendIn || "{s}s").replace("{s}", String(resendLeft.value)));
const reviewNotice = computed(() => registrationRisk.value !== null && registrationRisk.value.cluster.status !== "clear");
// 分因提示: 同簇重复账号用「设备已有账号活动」口径;裸号/未绑定用「先审核,绑定后释放」口径。
const reviewNoticeBody = computed(() => {
  const c = registrationRisk.value?.cluster;
  if (!c) return "";
  const dup = c.reasons.includes("duplicate-pending-line") || c.reasons.includes("duplicate-freeze-line");
  const bare = c.reasons.includes("bare-identity") || c.reasons.includes("unbound-free-slot");
  return !dup && bare ? t.value.register.rewardReviewBodyUnbound : t.value.register.rewardReviewBody;
});

// uni <input> delivers the value on e.detail.value at runtime; vue-tsc types
// the payload as a DOM Event, so we read detail through a narrow cast helper.
function inputVal(e: Event): string {
  return (e as unknown as { detail: { value: string } }).detail.value;
}
function onPhone(e: Event) { phone.value = inputVal(e); error.value = null; registrationRisk.value = null; }
function onInvite(e: Event) { invite.value = inputVal(e); registrationRisk.value = null; }
function onCode(i: number, e: Event) {
  const digits = inputVal(e).replace(/\D/g, "");
  const next = [...code.value];
  next[i] = digits.slice(-1) || "";
  code.value = next;
  error.value = null;
  if (next[i] && i < 5) focusIdx.value = i + 1;
  if (next.every(Boolean)) verifyCode();
}
function onPwd(e: Event) { password.value = inputVal(e); error.value = null; }
function onConfirm(e: Event) { confirmPwd.value = inputVal(e); error.value = null; }

function pickCountry(c: string) { country.value = c; showCountries.value = false; }

function onCta() {
  if (verifying.value) return;
  if (step.value === 1) goSendCode();
  else if (step.value === 2) verifyCode();
  else finish();
}
function goSendCode() {
  error.value = null;
  if (!phoneOk.value) { error.value = t.value.register.errorInvalidPhone; return; }
  void requestCode();
}
// FEAT-AUTH01: 发码统一走闸门(冷却/24h 限频/滑块);倒计时以 server 返回值为准。
async function requestCode(captchaTicket?: string) {
  if (verifying.value) return;
  verifying.value = true;
  const res = await otpSend(fullPhone.value, "register", captchaTicket);
  if (!mounted) return;
  verifying.value = false;
  if (res.ok) {
    code.value = ["", "", "", "", "", ""];
    focusIdx.value = 0;
    step.value = 2;
    startResend(res.resendAfterSec);
    return;
  }
  if (res.error === "captcha_required") { showCaptcha.value = true; return; }
  if (res.error === "rate_limited") {
    error.value = fmt(t.value.authOtp.errorTooFrequent, { s: res.retryAfterSec });
    if (step.value === 2) startResend(res.retryAfterSec);
  }
}
function onCaptchaOk(ticket: string) {
  showCaptcha.value = false;
  void requestCode(ticket);
}
function startResend(sec: number) {
  resendLeft.value = sec;
  if (resendTimer) clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    resendLeft.value = Math.max(0, resendLeft.value - 1);
    if (resendLeft.value <= 0 && resendTimer) clearInterval(resendTimer);
  }, 1000);
}
function resend() {
  if (resendLeft.value > 0) return;
  error.value = null;
  void requestCode();
}
function currentSponsorCode(): string | null {
  // 锁定码优先(?ref / pendingRefCode);仅无锁定时才取手输([FEAT-SHARE4] ③)。
  return lockedRef.value || invite.value.trim() || null;
}
async function verifyCode() {
  if (verifying.value) return;
  error.value = null;
  if (!codeOk.value) { error.value = t.value.register.errorInvalidCode; return; }
  // ⚠️ MOCK-ONLY: server 同构 OTP 校验(FEAT-AUTH01,TTL/attemptsLeft/一码一)
  // + K1 注册前评估的接口形态。PROD: POST /api/auth/otp/verify → 服务端验码 +
  // K1 评估,返回 { gateRoute, cluster, giftRoute } 同构结论;client 只消费,
  // 不本地判定。返回的 verifyToken 在 PROD 必须由后续注册提交端点
  // (POST /api/auth/register)重新出示校验;mock 下通过即视为凭证有效。
  verifying.value = true;
  const res = await otpVerify(fullPhone.value, "register", codeStr.value);
  if (!mounted) return;
  if (!res.ok) {
    verifying.value = false;
    if (res.error === "otp_invalid") {
      error.value = fmt(t.value.authOtp.errorOtpInvalid, { n: res.attemptsLeft });
    } else if (res.error === "otp_expired") {
      error.value = t.value.authOtp.errorOtpExpired;
    } else if (res.error === "otp_attempts_exceeded") {
      error.value = t.value.authOtp.errorOtpExhausted;
      code.value = ["", "", "", "", "", ""];
      focusIdx.value = 0;
    } else {
      error.value = t.value.authOtp.errorOtpNotFound;
    }
    return;
  }
  const assessment = evaluateRegistration(prospectiveIdentity(), { sponsorId: currentSponsorCode() });
  registrationRisk.value = assessment;
  verifying.value = false;
  // FEAT-RISK01 异常2: IP 24h 超限 → 停留注册页,可重试,不创建本地账号。
  if (assessment.gateRoute === "manual_or_reject") {
    error.value = t.value.register.errorSignupLimited;
    return;
  }
  step.value = 3;
}
function finish() {
  error.value = null;
  if (!pwdOk.value) { error.value = t.value.register.errorWeakPassword; return; }
  if (!pwdMatch.value) { error.value = t.value.register.passwordMismatch; return; }
  const identity = prospectiveIdentity();
  const sponsorCode = currentSponsorCode();
  // 完成时点重评(含最新邀请码): R5 口径下评估随调随算,不留步骤间缓存。
  const assessment = evaluateRegistration(identity, { sponsorId: sponsorCode });
  registrationRisk.value = assessment;
  if (assessment.gateRoute === "manual_or_reject") {
    error.value = t.value.register.errorSignupLimited;
    return;
  }
  auth.signUp(identity);
  app.bindAccount(identity);
  commitRegistration(identity, { sponsorId: sponsorCode });
  // New account claims this carrier's session; first-time calibration runs as
  // part of onboarding (connect.vue) which then marks this device calibrated.
  session.claim(identity);
  let giftParam: "posted" | "pending" | "none" = "none";
  if (sponsorCode) {
    sponsorship.bind(sponsorCode);
    const gift = sponsorship.claimGift(identity);
    if (gift) {
      const posted = app.creditRewardBucket(assessment.giftRoute, gift.usdt, gift.nex);
      const giftRef = `GIFT-${Date.now().toString(36).toUpperCase()}`;
      const giftPosted = assessment.giftRoute === "withdrawable";
      giftParam = giftPosted ? "posted" : "pending";
      const giftMemo = giftPosted ? t.value.register.giftBillMemo : t.value.register.giftPendingBillMemo;
      bills.add({ type: "bonus", symbol: "USDT", amount: gift.usdt, status: giftPosted ? "posted" : "pending", memo: giftMemo, ref: giftRef });
      bills.add({ type: "bonus", symbol: "NEX", amount: gift.nex, status: giftPosted ? "posted" : "pending", memo: giftMemo, ref: giftRef });
      if (posted && giftPosted) {
        toast.success(`+$${gift.usdt} + ${gift.nex} NEX`, sponsorPreview.value ? `Sponsored by ${sponsorPreview.value.name}` : t.value.register.giftCreditedToastSub);
      } else {
        toast.info(t.value.register.giftPendingToast, t.value.register.giftPendingToastSub);
      }
    }
  }
  // [FEAT-SHARE5] H5 注册完成 → 成功页(礼包确认 + 引导下载 APP);
  // APP 壳内注册装 APP 引导无意义,直进 onboarding(异常2)。
  // #ifdef H5
  uni.reLaunch({
    url: `/pages/register/success?gift=${giftParam}`,
    fail: () => uni.reLaunch({ url: "/pages/onboarding/estimator", fail: () => {} }),
  });
  // #endif
  // #ifndef H5
  uni.reLaunch({ url: "/pages/onboarding/estimator", fail: () => {} });
  // #endif
}
function prospectiveIdentity() {
  return `${country.value}${phoneClean.value}@demo.nexion.ai`;
}
function back() {
  error.value = null;
  registrationRisk.value = null;
  code.value = ["", "", "", "", "", ""];
  focusIdx.value = 0;
  if (resendTimer) clearInterval(resendTimer);
  resendLeft.value = 0;
  step.value = (step.value === 3 ? 2 : 1) as Step;
}
function close() { uni.reLaunch({ url: "/pages/onboarding/intro", fail: () => {} }); }
function goLogin() { uni.reLaunch({ url: "/pages/login/login", fail: () => {} }); }
function goTerms() { uni.navigateTo({ url: "/pages/onboarding/terms", fail: () => {} }); }

function cleanup() {
  mounted = false;
  if (resendTimer) clearInterval(resendTimer);
}
onUnload(() => cleanup());
onUnmounted(() => cleanup());
</script>

<style scoped>
.rg-root { position: fixed; inset: 0; background: #000; overflow-y: auto; }
.rg-wrap { display: flex; flex-direction: column; padding: 16px 24px 24px; min-height: 100%; box-sizing: border-box; }
.rg-top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }
.rg-iconbtn { width: 44px; height: 44px; margin-left: -8px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; justify-self: start; }
.rg-brand { display: flex; align-items: center; gap: 6px; justify-self: center; }
.rg-brand__n { width: 24px; height: 24px; border-radius: 7px; background: var(--v5-ink); display: flex; align-items: center; justify-content: center; }
.rg-brand__n-t { color: var(--v5-surface); font-family: var(--font-v5); font-weight: 600; font-size: 13px; }
.rg-brand__name { color: var(--v5-ink); font-weight: 600; font-family: var(--font-v5); font-size: 16px; letter-spacing: -0.02em; }
.rg-top__sp { }
.rg-sponsor { margin-top: 16px; border-radius: 16px; padding: 12px; display: flex; align-items: center; gap: 12px; background: radial-gradient(80% 60% at 0% 0%, rgba(198,255,58,0.12) 0%, transparent 65%), #0F0F0F; border: 1px solid rgba(198,255,58,0.30); }
.rg-sponsor__av { width: 40px; height: 40px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: linear-gradient(135deg, var(--v5-brand), var(--v5-tech-cyan)); }
.rg-sponsor__av-t { color: var(--v5-on-brand); font-family: var(--font-v5); font-weight: 600; font-size: 18px; }
.rg-sponsor__body { flex: 1; min-width: 0; }
.rg-sponsor__name { display: block; font-size: 12.5px; color: #fff; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.rg-sponsor__name-b { font-weight: 600; }
.rg-sponsor__gift { display: block; font-variant-numeric: tabular-nums; font-size: 10.5px; color: var(--v5-brand); margin-top: 2px; }
.rg-sponsor__v { font-variant-numeric: tabular-nums; font-size: 10px; color: var(--v5-brand); background: color-mix(in srgb, var(--v5-brand) 15%, transparent); padding: 2px 6px; border-radius: 4px; flex-shrink: 0; }
.rg-dots { margin-top: 28px; display: flex; align-items: center; gap: 6px; }
.rg-dot { height: 4px; width: 16px; border-radius: 9999px; background: var(--v5-surface-2); transition: all 0.3s; }
.rg-dot--active { width: 32px; background: var(--v5-brand); }
.rg-dot--done { width: 16px; background: color-mix(in srgb, var(--v5-brand) 40%, transparent); }
.rg-title { display: block; font-family: var(--font-v5); margin-top: 12px; font-size: 28px; font-weight: 600; line-height: 1.15; letter-spacing: -0.025em; color: var(--v5-ink); }
.rg-subtitle { display: block; margin-top: 8px; font-size: 13.5px; color: var(--v5-ink-3); }
.rg-subtitle__hl { color: var(--v5-brand); font-weight: 600; }
.rg-subtitle__ph { font-family: var(--font-v5); color: #fff; font-variant-numeric: tabular-nums; }
.rg-body { margin-top: 28px; }
.rg-phone { position: relative; background: #0F0F0F; border: 1px solid var(--v5-surface-2); border-radius: 16px; height: 56px; display: flex; align-items: center; }
.rg-phone__cc { height: 100%; padding: 0 16px; display: flex; align-items: center; gap: 4px; border-right: 1px solid var(--v5-surface-2); }
.rg-phone__cc-t { font-size: 14px; color: #fff; }
.rg-phone__in { flex: 1; height: 100%; background: transparent; padding: 0 16px; font-size: 14px; color: #fff; }
.rg-cc-list { position: absolute; top: 100%; left: 0; margin-top: 8px; width: 260px; max-height: 300px; overflow-y: auto; border-radius: 16px; background: #0B0B0B; border: 1px solid var(--v5-surface-3); padding: 6px; z-index: 20; }
.rg-cc-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 12px; }
.rg-cc-item--on { background: color-mix(in srgb, var(--v5-brand) 8%, transparent); }
.rg-cc-item__name { font-size: 13.5px; color: #C8D0DC; }
.rg-cc-item__code { font-family: var(--font-v5); font-variant-numeric: tabular-nums; font-size: 13.5px; color: var(--v5-ink-4); }
.rg-step2 { display: flex; flex-direction: column; gap: 20px; }
.rg-otp { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rg-otp__in { width: 48px; height: 56px; text-align: center; font-family: var(--font-v5); font-variant-numeric: tabular-nums; font-size: 20px; font-weight: 600; border-radius: 12px; background: #0F0F0F; border: 1px solid var(--v5-surface-2); color: var(--v5-ink-4); }
.rg-otp__in--filled { border-color: color-mix(in srgb, var(--v5-brand) 45%, transparent); color: #fff; }
.rg-resend { display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; }
.rg-resend__change { color: var(--v5-ink-3); }
.rg-resend__count { font-family: var(--font-v5); color: var(--v5-ink-4); font-variant-numeric: tabular-nums; }
.rg-resend__btn { color: var(--v5-brand); font-weight: 500; }
.rg-invite__lbl { display: block; font-size: 11.5px; color: var(--v5-ink-3); margin-bottom: 6px; padding: 0 4px; }
.rg-invite__opt { color: var(--v5-ink-4); }
/* [FEAT-SHARE4] 链接来源码锁定态:同 rg-field 形制但压暗 + 锁标,无输入交互。 */
.rg-locked { display: flex; align-items: center; gap: 8px; background: #0A0A0A; border: 1px solid var(--v5-surface-2); border-radius: 16px; height: 56px; padding: 0 16px; opacity: 0.9; }
.rg-locked__code { flex: 1; font-size: 14px; color: var(--text-muted); font-family: var(--font-jet-mono), ui-monospace, monospace; letter-spacing: 0.04em; }
.rg-locked__tag { display: block; margin-top: 8px; padding: 0 4px; font-size: 11px; color: var(--v5-brand); }
.rg-step3 { display: flex; flex-direction: column; gap: 12px; }
.rg-field { background: #0F0F0F; border: 1px solid var(--v5-surface-2); border-radius: 16px; height: 56px; padding: 0 16px; font-size: 14px; color: #fff; }
.rg-field-wrap { display: flex; align-items: center; background: #0F0F0F; border: 1px solid var(--v5-surface-2); border-radius: 16px; height: 56px; padding: 0 16px; }
.rg-field-wrap--err { border-color: color-mix(in srgb, var(--v5-brand-2) 45%, transparent); }
.rg-field--flex { flex: 1; background: transparent; border: none; height: 100%; padding: 0; }
.rg-eye { padding: 4px; }
.rg-check { display: flex; }
.rg-bonus { margin-top: 24px; background: color-mix(in srgb, var(--v5-brand) 10%, transparent); border: 1px solid color-mix(in srgb, var(--v5-brand) 30%, transparent); border-radius: 12px; padding: 10px 12px; display: flex; align-items: center; gap: 8px; }
.rg-bonus__t { flex: 1; font-size: 12.5px; }
.rg-bonus__b { color: var(--v5-brand); font-weight: 600; }
.rg-review { margin-top: 16px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--v5-warning) 30%, transparent); background: color-mix(in srgb, var(--v5-warning) 10%, transparent); padding: 10px 12px; }
.rg-review__title { display: block; font-size: 12.5px; font-weight: 600; color: var(--v5-warning); }
.rg-review__body { display: block; margin-top: 4px; font-size: 12px; line-height: 1.45; color: var(--v5-ink-3); }
.rg-error { margin-top: 12px; display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--v5-brand-2); background: color-mix(in srgb, var(--v5-brand-2) 10%, transparent); border: 1px solid color-mix(in srgb, var(--v5-brand-2) 25%, transparent); border-radius: 8px; padding: 8px 12px; }
.rg-error__t { flex: 1; }
.rg-cta { margin-top: 20px; height: 56px; border-radius: 9999px; background: var(--v5-surface); display: flex; align-items: center; justify-content: center; }
.rg-cta--on { background: var(--v5-brand); }
.rg-cta--busy { opacity: 0.7; }
.rg-cta__t { font-size: 15px; font-weight: 600; color: var(--v5-ink-4); }
.rg-cta__t--on { color: var(--v5-on-brand); }
.rg-oauth { }
.rg-divider { display: flex; align-items: center; margin: 24px 0; }
.rg-divider__line { flex: 1; height: 1px; background: var(--v5-surface-2); }
.rg-divider__t { padding: 0 12px; font-size: 11.5px; color: var(--v5-ink-3); }
.rg-social { display: flex; align-items: center; gap: 10px; }
.rg-social__btn { flex: 1; min-width: 0; height: 64px; border-radius: 16px; background: var(--v5-surface); border: 1px solid var(--v5-surface-2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; transition: transform 0.15s, opacity 0.15s; }
.rg-social__btn:active { transform: scale(0.98); opacity: 0.8; }
.rg-social__ic { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
.rg-social__lbl { font-size: 11px; font-weight: 500; color: var(--v5-ink-3); }
.rg-footer { margin-top: auto; padding-top: 32px; text-align: center; }
.rg-footer__acc { display: block; font-size: 12.5px; color: var(--v5-ink-3); }
.rg-footer__link { color: var(--v5-brand); font-weight: 500; }
.rg-footer__terms { display: block; margin-top: 8px; font-size: 11.5px; color: var(--v5-ink-4); }
.rg-footer__terms-link { color: var(--v5-ink-3); text-decoration: underline; text-underline-offset: 2px; }
</style>
