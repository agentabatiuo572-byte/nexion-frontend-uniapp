<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useAuthStore } from '@/store/auth'
import { goAfterAuth } from '@/utils/auth-guard'
import {
  LOCALES,
  PRIORITY_LABELS,
  getIntroMessages,
  getLocaleEntry,
  getStoredLocale,
  setStoredLocale,
  type LocaleCode
} from '@/utils/i18n'

const props = defineProps<{
  mode: 'login' | 'register'
}>()

const countries = [
  { code: '+1', name: 'US / Canada' },
  { code: '+44', name: 'United Kingdom' },
  { code: '+49', name: 'Germany' },
  { code: '+33', name: 'France' },
  { code: '+34', name: 'Spain' },
  { code: '+81', name: 'Japan' },
  { code: '+82', name: 'South Korea' },
  { code: '+55', name: 'Brazil' },
  { code: '+62', name: 'Indonesia' },
  { code: '+63', name: 'Philippines' },
  { code: '+66', name: 'Thailand' },
  { code: '+971', name: 'UAE' },
  { code: '+7', name: 'Russia' }
]

const auth = useAuthStore()
const loading = ref(false)
const showCountries = ref(false)
const showPassword = ref(false)
const registerStep = ref<1 | 2 | 3>(1)
const locale = ref<LocaleCode>(getStoredLocale())
const localeOpen = ref(false)
const codeDigits = ref(['', '', '', '', '', ''])
const codeFocusIndex = ref(0)
const resendLeft = ref(60)
const form = reactive({
  countryCode: '+1',
  phone: '',
  password: '',
  confirmPassword: '',
  referralCode: ''
})

const isLogin = computed(() => props.mode === 'login')
const currentLocale = computed(() => getLocaleEntry(locale.value))
const languageSheetCopy = computed(() => getIntroMessages(locale.value))
const groupedLocales = computed(() => {
  return LOCALES.reduce(
    (result, item) => {
      result[item.priority].push(item)
      return result
    },
    { 0: [], 1: [], 2: [], 3: [] } as Record<0 | 1 | 2 | 3, typeof LOCALES>
  )
})
const copy = computed(() => {
  if (locale.value === 'zh') {
    return {
      close: '×',
      back: '‹',
      loginTitle: '欢迎回来',
      loginSubtitle: '使用手机号和密码登录，继续赚取收益。',
      registerTitle: '创建账号',
      registerSubtitleHighlight: '5 美元新人奖励',
      registerSubtitleRest: '连接 GPU 即刻到账。',
      codeTitle: '输入验证码',
      codeSentPrefix: '已发送 6 位验证码至',
      changePhone: '更换手机号',
      resendIn: '60秒后可重发',
      inviteLabel: '邀请码（选填）',
      invitePlaceholder: '输入邀请码（选填）',
      verifyContinue: '验证并继续',
      passwordTitle: '设置登录密码',
      passwordSubtitle: '密码需 8 位以上,且包含字母和数字。',
      phonePlaceholder: '手机号码',
      passwordPlaceholder: '设置密码(8 位以上)',
      confirmPasswordPlaceholder: '再次输入密码',
      referralPlaceholder: '推荐码（可选）',
      sendCode: '发送验证码',
      createAccount: '创建账号',
      signIn: '登录',
      signingIn: '登录中',
      creatingAccount: '创建中',
      invalidPhone: '请输入有效手机号',
      invalidCode: '请输入 6 位验证码',
      wrongCode: '验证码错误，请输入 123456',
      invalidAuth: '请输入有效手机号和密码',
      signedIn: '已登录',
      accountCreated: '账号已创建',
      forgotPassword: '忘记密码？',
      otpLogin: '使用验证码登录',
      bonusStrong: '5 美元新人奖励',
      bonusHint: ' · 连接后自动到账',
      orContinueWith: '或使用其他方式',
      noAccount: '还没有账号？',
      haveAccount: '已有账号？',
      signUp: '注册',
      terms: '创建账号即表示同意服务条款和隐私政策',
      country: '国家/地区'
    }
  }
  return {
    close: '×',
    back: '‹',
    loginTitle: 'Welcome back',
    loginSubtitle: 'Sign in with your phone and password to continue earning.',
      registerTitle: 'Create account',
      registerSubtitleHighlight: '$5 Welcome Bonus',
      registerSubtitleRest: ' credited the moment your GPU connects.',
      codeTitle: 'Enter code',
      codeSentPrefix: '6-digit code sent to',
      changePhone: 'Change phone number',
      resendIn: 'Resend in 60s',
      inviteLabel: 'Invite code (optional)',
      invitePlaceholder: 'Enter invite code (optional)',
      verifyContinue: 'Verify and continue',
      passwordTitle: 'Set login password',
      passwordSubtitle: 'Password must be 8+ characters and include letters and numbers.',
    phonePlaceholder: 'Phone number',
      passwordPlaceholder: 'Set password (8+ characters)',
      confirmPasswordPlaceholder: 'Enter password again',
    referralPlaceholder: 'Referral code (optional)',
    sendCode: 'Send verification code',
    createAccount: 'Create account',
    signIn: 'Sign in',
    signingIn: 'Signing in',
    creatingAccount: 'Creating account',
      invalidPhone: 'Enter a valid phone number',
      invalidCode: 'Enter the 6-digit verification code',
      wrongCode: 'Verification code is incorrect. Use 123456',
      invalidAuth: 'Enter a valid phone and password',
    signedIn: 'Signed in',
    accountCreated: 'Account created',
    forgotPassword: 'Forgot password?',
    otpLogin: 'Use verification code instead',
    bonusStrong: '$5 Welcome Bonus',
    bonusHint: ' · credited automatically after connection',
    orContinueWith: 'or continue with',
    noAccount: 'No account yet?',
    haveAccount: 'Already have an account?',
    signUp: 'Sign up',
    terms: 'By continuing you agree to the Terms and Privacy Policy.',
    country: 'Country'
  }
})
const title = computed(() => {
  if (isLogin.value) return copy.value.loginTitle
  if (registerStep.value === 1) return copy.value.registerTitle
  if (registerStep.value === 2) return copy.value.codeTitle
  return copy.value.passwordTitle
})
const subtitle = computed(() => isLogin.value
  ? copy.value.loginSubtitle
  : registerStep.value === 1
    ? ''
    : registerStep.value === 2
      ? `${copy.value.codeSentPrefix} ${form.countryCode} ${form.phone.trim()}`
      : copy.value.passwordSubtitle
)
const primaryText = computed(() => {
  if (loading.value) return isLogin.value ? copy.value.signingIn : copy.value.creatingAccount
  if (isLogin.value) return copy.value.signIn
  if (registerStep.value === 1) return copy.value.sendCode
  if (registerStep.value === 2) return copy.value.verifyContinue
  return copy.value.createAccount
})
const phoneValid = computed(() => /^\d{6,15}$/.test(form.phone.trim()))
const codeValid = computed(() => codeDigits.value.join('').length === 6)
const passwordValid = computed(() => /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(form.password))
const passwordMatched = computed(() => passwordValid.value && form.confirmPassword === form.password)
const canSubmit = computed(() => {
  if (loading.value) return false
  if (isLogin.value) return phoneValid.value && passwordValid.value
  if (registerStep.value === 1) return phoneValid.value
  if (registerStep.value === 2) return codeValid.value
  return phoneValid.value && passwordMatched.value
})

function cleanPayload() {
  return {
    countryCode: form.countryCode,
    phone: form.phone.trim(),
    password: form.password,
    verificationCode: codeDigits.value.join(''),
    referralCode: form.referralCode.trim() || undefined
  }
}

async function submit() {
  if (!canSubmit.value) {
    uni.showToast({
      title: isLogin.value || registerStep.value === 3
        ? copy.value.invalidAuth
        : registerStep.value === 2
          ? copy.value.invalidCode
          : copy.value.invalidPhone,
      icon: 'none'
    })
    return
  }
  if (!isLogin.value && registerStep.value === 1) {
    registerStep.value = 2
    resendLeft.value = 300
    auth.sendRegisterSmsCode({
        countryCode: form.countryCode,
        phone: form.phone.trim()
      }).then((result) => {
        resendLeft.value = result.expiresInSeconds || 300
      }).catch(() => {
        // Local MVP uses simulated SMS code 123456; backend SMS availability must not block registration UI.
      })
    return
  }
  if (!isLogin.value && registerStep.value === 2) {
    if (codeDigits.value.join('') !== '123456') {
      uni.showToast({ title: copy.value.wrongCode, icon: 'none' })
      return
    }
    registerStep.value = 3
    return
  }
  loading.value = true
  try {
    const payload = cleanPayload()
    if (isLogin.value) {
      await auth.login({
        countryCode: payload.countryCode,
        phone: payload.phone,
        password: payload.password
      })
    } else {
      await auth.register(payload)
    }
    uni.showToast({ title: isLogin.value ? copy.value.signedIn : copy.value.accountCreated, icon: 'success' })
    goAfterAuth()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : 'Request failed', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function switchMode() {
  uni.redirectTo({ url: isLogin.value ? '/pages/auth/register' : '/pages/auth/login' })
}

function closeAuth() {
  uni.reLaunch({ url: '/pages/onboarding/intro/index' })
}

function toggleLocaleSheet() {
  localeOpen.value = !localeOpen.value
}

function closeLocaleSheet() {
  localeOpen.value = false
}

function pickLocale(code: LocaleCode) {
  locale.value = code
  setStoredLocale(code)
  localeOpen.value = false
}

function goBack() {
  if (!isLogin.value && registerStep.value === 3) {
    registerStep.value = 2
    return
  }
  if (!isLogin.value && registerStep.value === 2) {
    registerStep.value = 1
    return
  }
  closeAuth()
}

function selectCountry(code: string) {
  form.countryCode = code
  showCountries.value = false
}

function updateCodeDigit(index: number, event: Event | { detail?: { value?: string } }) {
  const raw = event instanceof Event
    ? (event.target as HTMLInputElement | null)?.value
    : event.detail?.value
  const value = String(raw || '').replace(/\D/g, '').slice(-1)
  codeDigits.value[index] = value
  if (value && index < codeDigits.value.length - 1) {
    codeFocusIndex.value = index + 1
  }
}

function handleCodeBackspace(index: number) {
  if (codeDigits.value[index]) {
    codeDigits.value[index] = ''
    return
  }
  if (index > 0) {
    codeFocusIndex.value = index - 1
    codeDigits.value[index - 1] = ''
  }
}

function showComingSoon(label: string) {
  uni.showToast({ title: `${label} will be connected after backend support`, icon: 'none' })
}
</script>

<template>
  <view class="auth-page">
    <view class="top-bar">
      <button class="icon-button" @click="goBack">
        <image
          class="nav-icon"
          :src="!isLogin && registerStep > 1 ? '/src/static/icons/chevron-left.svg' : '/src/static/icons/x.svg'"
          mode="aspectFit"
        />
      </button>
      <button class="locale-pill" @click="toggleLocaleSheet">
        <image class="locale-icon" src="/src/static/icons/globe.svg" mode="aspectFit" />
        <text>{{ currentLocale.code.toUpperCase() }}</text>
        <image
          class="locale-chevron"
          :class="{ open: localeOpen }"
          src="/src/static/icons/chevron-down.svg"
          mode="aspectFit"
        />
      </button>
    </view>

    <view class="step-dots" :class="{ register: !isLogin }">
      <view class="dot" :class="{ active: isLogin || registerStep === 1, passed: !isLogin && registerStep > 1 }" />
      <view class="dot" :class="{ active: !isLogin && registerStep === 2, passed: !isLogin && registerStep === 3 }" />
      <view v-if="!isLogin" class="dot" :class="{ active: registerStep === 3 }" />
    </view>

    <view class="title">{{ title }}</view>
    <view v-if="!isLogin && registerStep === 1" class="subtitle">
      <text class="subtitle-highlight">{{ copy.registerSubtitleHighlight }}</text>
      <text>{{ copy.registerSubtitleRest }}</text>
    </view>
    <view v-else class="subtitle">{{ subtitle }}</view>

    <view class="form-stack">
      <view v-if="isLogin || registerStep === 1" class="phone-field">
        <button class="country-trigger" @click="showCountries = !showCountries">
          <text>{{ form.countryCode }}</text>
          <image
            class="country-chevron"
            :class="{ open: showCountries }"
            src="/src/static/icons/chevron-down.svg"
            mode="aspectFit"
          />
        </button>
        <input
          v-model="form.phone"
          class="phone-input"
          type="number"
          :maxlength="15"
          :placeholder="copy.phonePlaceholder"
        />
        <view v-if="showCountries" class="country-menu">
          <button
            v-for="item in countries"
            :key="item.code"
            class="country-option"
            :class="{ selected: item.code === form.countryCode }"
            @click="selectCountry(item.code)"
          >
            <text>{{ item.name }}</text>
            <text>{{ item.code }}</text>
          </button>
        </view>
      </view>

      <view v-if="!isLogin && registerStep === 2" class="code-stack">
        <view class="code-grid">
          <input
            v-for="(_, index) in codeDigits"
            :key="index"
            class="code-input"
            :class="{ focused: codeFocusIndex === index }"
            type="number"
            :maxlength="1"
            :focus="codeFocusIndex === index"
            :value="codeDigits[index]"
            @input="updateCodeDigit(index, $event)"
            @keydown.delete="handleCodeBackspace(index)"
          />
        </view>
        <view class="code-actions">
          <button class="inline-button" @click="registerStep = 1">{{ copy.changePhone }}</button>
          <text>{{ copy.resendIn }}</text>
        </view>
        <view class="invite-label">{{ copy.inviteLabel }}</view>
        <view class="password-field">
          <input
            v-model="form.referralCode"
            class="password-input"
            :placeholder="copy.invitePlaceholder"
          />
        </view>
      </view>

      <view v-if="isLogin || registerStep === 3" class="password-field">
        <input
          v-model="form.password"
          class="password-input"
          :password="!showPassword"
          :placeholder="copy.passwordPlaceholder"
        />
        <button class="eye-button" @click="showPassword = !showPassword">
          <image class="eye-icon" src="/src/static/icons/eye.svg" mode="aspectFit" />
        </button>
      </view>

      <view v-if="!isLogin && registerStep === 3" class="password-field">
        <input
          v-model="form.confirmPassword"
          class="password-input"
          :password="!showPassword"
          :placeholder="copy.confirmPasswordPlaceholder"
        />
      </view>

    </view>

    <button v-if="isLogin" class="forgot-button" @click="showComingSoon('Password reset')">
      {{ copy.forgotPassword }}
    </button>

    <view v-if="!isLogin && registerStep === 1" class="bonus-card">
      <text class="spark">✣</text>
      <text><text class="bonus-strong">{{ copy.bonusStrong }}</text>{{ copy.bonusHint }}</text>
    </view>

    <button class="primary-button" :disabled="!canSubmit" :loading="loading" @click="submit">
      {{ primaryText }}
    </button>

    <button v-if="isLogin" class="mode-button" @click="showComingSoon('OTP login')">
      {{ copy.otpLogin }}
    </button>

    <view v-if="isLogin || registerStep === 1" class="divider">
      <view />
      <text>{{ copy.orContinueWith }}</text>
      <view />
    </view>

    <view v-if="isLogin || registerStep === 1" class="social-grid">
      <button class="social-button" @click="showComingSoon('Passkey')">
        <image class="social-icon-image" src="/src/static/icons/key.svg" mode="aspectFit" />
        <text>Passkey</text>
      </button>
      <button class="social-button" @click="showComingSoon('Google')">
        <image class="social-icon-image" src="/src/static/icons/google.svg" mode="aspectFit" />
        <text>Google</text>
      </button>
      <button class="social-button" @click="showComingSoon('Apple')">
        <image class="social-icon-image" src="/src/static/icons/apple.svg" mode="aspectFit" />
        <text>Apple</text>
      </button>
      <button class="social-button" @click="showComingSoon('Telegram')">
        <image class="social-icon-image" src="/src/static/icons/telegram.svg" mode="aspectFit" />
        <text>Telegram</text>
      </button>
    </view>

    <view v-if="isLogin || registerStep === 1" class="footer-copy">
      <text>{{ isLogin ? copy.noAccount : copy.haveAccount }}</text>
      <button class="footer-link" @click="switchMode">
        {{ isLogin ? copy.signUp : copy.signIn }}
      </button>
    </view>

    <view class="terms-copy">
      {{ copy.terms }}
    </view>

    <view v-if="localeOpen" class="locale-backdrop" @click="closeLocaleSheet" />
    <view v-if="localeOpen" class="locale-sheet">
      <view class="sheet-handle" />
      <view class="sheet-header">
        <view>
          <view class="sheet-title">{{ languageSheetCopy.languageTitle }}</view>
          <view class="sheet-subtitle">{{ currentLocale.nativeName }} · {{ currentLocale.region }}</view>
        </view>
        <button class="sheet-close" @click="closeLocaleSheet">{{ languageSheetCopy.close }}</button>
      </view>
      <scroll-view class="locale-list" scroll-y>
        <view v-for="priority in [0, 1, 2, 3]" :key="priority" class="locale-group">
          <view class="priority-label">{{ PRIORITY_LABELS[priority as 0 | 1 | 2 | 3] }}</view>
          <button
            v-for="item in groupedLocales[priority as 0 | 1 | 2 | 3]"
            :key="item.code"
            class="locale-option"
            :class="{ active: item.code === locale }"
            @click="pickLocale(item.code)"
          >
            <text class="flag">{{ item.flag }}</text>
            <view class="locale-copy">
              <view>{{ item.nativeName }}</view>
              <text>{{ item.englishName }} · {{ item.region }}</text>
            </view>
            <text v-if="item.code === locale" class="check">✓</text>
          </button>
        </view>
        <view class="sheet-footnote">{{ languageSheetCopy.languageFootnote }}</view>
      </scroll-view>
    </view>
  </view>
</template>

<style scoped>
.auth-page {
  display: flex;
  min-height: calc(100vh - 104rpx);
  flex-direction: column;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 88rpx;
}

.icon-button,
.locale-pill,
.country-trigger,
.eye-button,
.forgot-button,
.mode-button,
.social-button,
.footer-link,
.country-option,
.sheet-close,
.locale-option {
  padding: 0;
  background: transparent;
  line-height: 1;
}

.icon-button::after,
.locale-pill::after,
.country-trigger::after,
.eye-button::after,
.forgot-button::after,
.mode-button::after,
.social-button::after,
.footer-link::after,
.country-option::after,
.sheet-close::after,
.locale-option::after {
  border: 0;
}

uni-button.icon-button,
uni-button.locale-pill,
uni-button.country-trigger,
uni-button.eye-button,
uni-button.forgot-button,
uni-button.mode-button,
uni-button.social-button,
uni-button.footer-link,
uni-button.country-option,
uni-button.sheet-close,
uni-button.locale-option {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  line-height: 1;
}

.icon-button {
  display: grid;
  width: 88rpx;
  height: 88rpx;
  margin-left: -18rpx;
  place-items: center;
  border-radius: 999rpx;
  color: #c8d0dc;
  font-size: 42rpx;
}

.nav-icon {
  width: 48rpx;
  height: 48rpx;
}

.locale-pill {
  display: flex;
  align-items: center;
  gap: 10rpx;
  height: 56rpx;
  padding: 0;
  border: 0;
  border-radius: 999rpx;
  color: #c8d0dc;
  font-size: 28rpx;
  font-weight: 800;
}

.locale-icon {
  width: 34rpx;
  height: 34rpx;
}

.locale-chevron {
  width: 28rpx;
  height: 28rpx;
  transition: transform 0.18s ease;
}

.locale-chevron.open {
  transform: rotate(180deg);
}

.step-dots {
  display: flex;
  gap: 12rpx;
  margin-top: 56rpx;
}

.step-dots.register {
  margin-top: 42rpx;
}

.dot {
  width: 32rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: #242a35;
}

.dot.active {
  width: 64rpx;
  background: #c6ff3a;
}

.dot.passed {
  background: rgba(198, 255, 58, 0.45);
}

.title {
  margin-top: 24rpx;
  color: #ffffff;
  font-size: 56rpx;
  font-weight: 760;
  letter-spacing: -1rpx;
  line-height: 1.14;
}

.subtitle {
  margin-top: 16rpx;
  color: #99a3b3;
  font-size: 27rpx;
  line-height: 1.5;
}

.subtitle-highlight {
  color: #c6ff3a;
  font-weight: 700;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  margin-top: 58rpx;
}

.phone-field,
.password-field {
  position: relative;
  display: flex;
  height: 112rpx;
  align-items: center;
  border: 1rpx solid #242a35;
  border-radius: 32rpx;
  background: #0f0f0f;
}

.code-stack {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.code-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 20rpx;
}

.code-input {
  width: 100%;
  height: 110rpx;
  border: 1rpx solid #242a35;
  border-radius: 24rpx;
  background: #0f0f0f;
  color: #ffffff;
  font-size: 36rpx;
  font-weight: 760;
  text-align: center;
}

.code-input:focus,
.code-input.focused {
  border-color: rgba(198, 255, 58, 0.65);
}

.code-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #8d96a6;
  font-size: 26rpx;
}

.inline-button {
  margin: 0;
  padding: 0;
  background: transparent;
  color: #99a3b3;
  font-size: 26rpx;
  line-height: 1;
}

.inline-button::after {
  border: 0;
}

uni-button.inline-button {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  line-height: 1;
}

.invite-label {
  margin-bottom: -14rpx;
  padding-left: 8rpx;
  color: #99a3b3;
  font-size: 25rpx;
}

.country-trigger {
  display: flex;
  height: 100%;
  align-items: center;
  gap: 8rpx;
  padding: 0 32rpx;
  border-right: 1rpx solid #242a35;
  color: #ffffff;
  font-size: 28rpx;
}

.country-chevron {
  width: 28rpx;
  height: 28rpx;
  opacity: 0.72;
  transition: transform 0.18s ease;
}

.country-chevron.open {
  transform: rotate(180deg);
}

.phone-input,
.password-input {
  min-width: 0;
  flex: 1;
  height: 100%;
  padding: 0 30rpx;
  color: #ffffff;
  font-size: 28rpx;
}

.phone-input :deep(.uni-input-placeholder),
.password-input :deep(.uni-input-placeholder) {
  color: #8f98a8;
}

.country-menu {
  position: absolute;
  top: 128rpx;
  left: 0;
  z-index: 20;
  width: 520rpx;
  max-height: 600rpx;
  overflow-y: auto;
  border: 1rpx solid #303746;
  border-radius: 32rpx;
  background: #0b0b0b;
  padding: 12rpx;
}

.country-option {
  display: flex;
  width: 100%;
  min-height: 72rpx;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 0 24rpx;
  border-radius: 24rpx;
  color: #c8d0dc;
  font-size: 27rpx;
  text-align: left;
}

.country-option text:first-child {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.country-option text:last-child {
  color: #8f98a8;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.country-option.selected {
  background: rgba(198, 255, 58, 0.08);
  color: #ffffff;
}

.eye-button {
  display: grid;
  width: 112rpx;
  height: 100%;
  place-items: center;
}

.eye-icon {
  width: 44rpx;
  height: 44rpx;
}

.forgot-button {
  align-self: flex-end;
  min-height: 68rpx;
  margin-top: 4rpx;
  color: #99a3b3;
  font-size: 25rpx;
}

.bonus-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 42rpx;
  padding: 24rpx 28rpx;
  border: 1rpx solid rgba(198, 255, 58, 0.42);
  border-radius: 28rpx;
  background: rgba(198, 255, 58, 0.08);
  color: #99a3b3;
  font-size: 25rpx;
  line-height: 1.45;
}

.spark,
.bonus-strong {
  color: #c6ff3a;
  font-weight: 800;
}

.spark {
  font-size: 34rpx;
}

.primary-button {
  display: flex;
  width: 100%;
  height: 112rpx;
  align-items: center;
  justify-content: center;
  margin-top: 42rpx;
  border-radius: 999rpx;
  background: #c6ff3a;
  color: #10140a;
  font-size: 30rpx;
  font-weight: 760;
}

uni-button.primary-button {
  display: flex;
  width: 100%;
  height: 112rpx;
  align-items: center;
  justify-content: center;
  margin-top: 42rpx;
  border-radius: 999rpx;
  background: #c6ff3a;
  color: #10140a;
  font-size: 30rpx;
  font-weight: 760;
}

.primary-button[disabled] {
  background: #242b36;
  color: #737d8c;
}

uni-button.primary-button[disabled] {
  background: #242b36;
  color: #737d8c;
}

.mode-button {
  min-height: 72rpx;
  color: #c6ff3a;
  font-size: 25rpx;
  font-weight: 600;
}

.divider {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin: 28rpx 0;
}

.divider view {
  flex: 1;
  height: 1rpx;
  background: #242a35;
}

.divider text {
  color: #8d96a6;
  font-size: 23rpx;
}

.social-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18rpx;
}

.social-button {
  display: flex;
  min-width: 0;
  height: 128rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  border: 1rpx solid #242a35;
  border-radius: 28rpx;
  background: #10141d;
  color: #99a3b3;
  font-size: 21rpx;
}

uni-button.social-button {
  display: flex;
  min-width: 0;
  height: 128rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  border: 1rpx solid #242a35;
  border-radius: 28rpx;
  background: #10141d;
  color: #99a3b3;
  font-size: 21rpx;
}

.social-icon-image {
  width: 40rpx;
  height: 40rpx;
}

.footer-copy {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8rpx;
  margin-top: 58rpx;
  color: #99a3b3;
  font-size: 25rpx;
}

.footer-link {
  color: #c6ff3a;
  font-size: 25rpx;
  font-weight: 700;
}

.terms-copy {
  margin-top: 14rpx;
  text-align: center;
  color: #5f6877;
  font-size: 22rpx;
  line-height: 1.45;
}

.locale-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(0, 0, 0, 0.54);
}

.locale-sheet {
  position: fixed;
  right: 24rpx;
  bottom: 24rpx;
  left: 24rpx;
  z-index: 90;
  display: flex;
  max-height: 78vh;
  flex-direction: column;
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 40rpx;
  background: #10141d;
  box-shadow: 0 -24rpx 80rpx rgba(0, 0, 0, 0.45);
}

.sheet-handle {
  width: 72rpx;
  height: 8rpx;
  margin: 18rpx auto 8rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.24);
}

.sheet-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  padding: 18rpx 28rpx 20rpx;
}

.sheet-title {
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 760;
}

.sheet-subtitle {
  margin-top: 8rpx;
  color: #99a3b3;
  font-size: 23rpx;
}

.sheet-close {
  min-width: 108rpx;
  height: 56rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.08);
  color: #c8d0dc;
  font-size: 24rpx;
  font-weight: 700;
}

uni-button.sheet-close {
  min-width: 108rpx;
  height: 56rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.08);
  color: #c8d0dc;
  font-size: 24rpx;
  font-weight: 700;
}

.locale-list {
  max-height: 60vh;
  padding: 0 20rpx 22rpx;
  box-sizing: border-box;
}

.locale-group {
  padding-top: 18rpx;
}

.priority-label {
  padding: 0 10rpx 12rpx;
  color: #5f6877;
  font-size: 22rpx;
  font-weight: 700;
  text-transform: uppercase;
}

.locale-option {
  display: flex;
  width: 100%;
  min-height: 92rpx;
  align-items: center;
  gap: 18rpx;
  margin-bottom: 10rpx;
  padding: 0 20rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  border-radius: 28rpx;
  background: #0b0d13;
  color: #ffffff;
  text-align: left;
}

uni-button.locale-option {
  display: flex;
  width: 100%;
  min-height: 92rpx;
  align-items: center;
  gap: 18rpx;
  margin-bottom: 10rpx;
  padding: 0 20rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  border-radius: 28rpx;
  background: #0b0d13;
  color: #ffffff;
  text-align: left;
}

.locale-option.active {
  border-color: rgba(198, 255, 58, 0.72);
  background: rgba(198, 255, 58, 0.08);
}

.flag {
  width: 52rpx;
  font-size: 34rpx;
}

.locale-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}

.locale-copy view {
  color: #ffffff;
  font-size: 27rpx;
  font-weight: 700;
}

.locale-copy text {
  overflow: hidden;
  color: #99a3b3;
  font-size: 22rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.check {
  color: #c6ff3a;
  font-size: 30rpx;
  font-weight: 800;
}

.sheet-footnote {
  padding: 8rpx 12rpx 18rpx;
  color: #6f7886;
  font-size: 22rpx;
  line-height: 1.45;
}
</style>
