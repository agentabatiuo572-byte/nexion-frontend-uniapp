import { LOCALE_KEY } from '@/utils/storage'

export type LocaleCode = 'en' | 'zh' | 'ja' | 'ko' | 'ru' | 'es' | 'pt' | 'ar' | 'de' | 'fr'

export interface LocaleEntry {
  code: LocaleCode
  nativeName: string
  englishName: string
  region: string
  priority: 0 | 1 | 2 | 3
  isRTL: boolean
  flag: string
}

export interface IntroMessages {
  title1: string
  title2Line1: string
  title2Line2: string
  subtitleLine1: string
  subtitleLine2: string
  statsDevices: string
  statsPaidToday: string
  getStarted: string
  signIn: string
  termsLeft: string
  termsLink: string
  languageTitle: string
  languageFootnote: string
  close: string
}

export const LOCALES: LocaleEntry[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', region: 'Global', priority: 0, isRTL: false, flag: '🌐' },
  { code: 'zh', nativeName: '简体中文', englishName: 'Chinese (Simplified)', region: 'China · Singapore', priority: 1, isRTL: false, flag: '🇨🇳' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese', region: 'Japan', priority: 1, isRTL: false, flag: '🇯🇵' },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean', region: 'South Korea', priority: 1, isRTL: false, flag: '🇰🇷' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian', region: 'CIS', priority: 1, isRTL: false, flag: '🇷🇺' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', region: 'Latin America', priority: 2, isRTL: false, flag: '🇪🇸' },
  { code: 'pt', nativeName: 'Português', englishName: 'Portuguese', region: 'Brazil', priority: 2, isRTL: false, flag: '🇧🇷' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', region: 'Middle East', priority: 2, isRTL: true, flag: '🇸🇦' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', region: 'Germany', priority: 3, isRTL: false, flag: '🇩🇪' },
  { code: 'fr', nativeName: 'Français', englishName: 'French', region: 'France', priority: 3, isRTL: false, flag: '🇫🇷' }
]

export const PRIORITY_LABELS: Record<0 | 1 | 2 | 3, string> = {
  0: 'Recommended',
  1: 'Major markets',
  2: 'Growing regions',
  3: 'Europe'
}

const introEn: IntroMessages = {
  title1: 'Compute is money now.',
  title2Line1: '24/7.',
  title2Line2: 'Working for you.',
  subtitleLine1: 'Plug in. Start taking AI workloads.',
  subtitleLine2: 'More devices · more uptime · more earnings.',
  statsDevices: 'devices',
  statsPaidToday: 'paid today',
  getStarted: 'Get started',
  signIn: 'Sign in',
  termsLeft: 'By continuing you agree to the',
  termsLink: 'Terms',
  languageTitle: 'Region & Language',
  languageFootnote: 'Translations roll out per priority tier · 10 locales total.',
  close: 'Close'
}

const introZh: IntroMessages = {
  title1: 'AI 时代,算力就是钱。',
  title2Line1: '24 小时',
  title2Line2: '替你打工。',
  subtitleLine1: '插上充电,就开始接 AI 任务。',
  subtitleLine2: '越多 · 越久 · 赚得越多。',
  statsDevices: '台设备',
  statsPaidToday: '今日已付',
  getStarted: '立即开始',
  signIn: '登录',
  termsLeft: '继续即表示你同意',
  termsLink: '服务条款',
  languageTitle: '地区与语言',
  languageFootnote: '翻译按优先级分批上线 · 共 10 种语言。',
  close: '关闭'
}

const introMessages: Partial<Record<LocaleCode, IntroMessages>> = {
  en: introEn,
  zh: introZh
}

export function normalizeLocale(value: unknown): LocaleCode {
  if (typeof value !== 'string') return 'en'
  const code = value.toLowerCase().split(/[-_]/)[0] as LocaleCode
  return LOCALES.some((item) => item.code === code) ? code : 'en'
}

export function getStoredLocale(): LocaleCode {
  return normalizeLocale(uni.getStorageSync(LOCALE_KEY) || 'en')
}

export function setStoredLocale(code: LocaleCode) {
  uni.setStorageSync(LOCALE_KEY, code)
}

export function getLocaleEntry(code: LocaleCode) {
  return LOCALES.find((item) => item.code === code) ?? LOCALES[0]
}

export function getIntroMessages(code: LocaleCode) {
  return introMessages[code] ?? introEn
}

