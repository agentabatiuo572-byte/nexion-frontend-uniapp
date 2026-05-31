import { LOCALE_KEY } from '@/utils/storage'
import { ref } from 'vue'

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

export interface MeMessages {
  title: string
  kycPending: string
  joinedOneDay: string
  walletTitle: string
  pending: string
  topUp: string
  withdraw: string
  exchange: string
  slotsOpen: string
  bills: string
  withdrawalLocked: string
  withdrawalLockedDesc: string
  yourRank: string
  rankDesc: string
  myDevices: string
  fleetStatus: string
  fleetStatusDesc: string
  earnExtras: string
  missions: string
  daily: string
  eventsCenter: string
  liveCount: string
  achievements: string
  account: string
  profile: string
  identitySecurity: string
  no2fa: string
  notifications: string
  preferences: string
  appearance: string
  light: string
  dark: string
  language: string
  help: string
  replayTour: string
  helpFaq: string
  liveSupport: string
  online: string
  signOut: string
  signOutTitle: string
  signOutContent: string
  comingSoon: (label: string) => string
}

export interface ProfileMessages {
  title: string
  avatar: string
  avatarHint: string
  changeAvatar: string
  displayName: string
  displayNameHint: string
  namePlaceholder: string
  bio: string
  bioPlaceholder: string
  bioHint: string
  region: string
  timezone: string
  referralCode: string
  joinedOn: string
  sectionPublic: string
  tierTitle: string
  tierProgress: string
  walletAddress: string
  walletEmpty: string
  walletPair: string
  saveChanges: string
  saved: string
  saving: string
  uploadFailed: string
  back: string
  tierLabels: Record<string, string>
}

export interface TabMessages {
  home: string
  earn: string
  store: string
  team: string
  me: string
}

export interface MainPageMessages {
  common: {
    comingSoon: (label: string) => string
    rankCadet: string
  }
  home: {
    goodDay: string
    headlinePrefix: string
    headlineSuffix: string
    earnings: string
    live: string
    pending: string
    rank: string
    freeTrial: string
    cloudShare: string
    trialDesc: string
    earnUpTo: string
    firstDayReward: string
    endsIn: string
    connectWallet: string
    visitEarn: string
    seeProductRoi: string
    store: string
    devices: string
    wallet: string
    team: string
    myFleet: string
    activeSlots: string
    gridSlots: string
    gridSlotsDesc: string
    yourRank: string
    rankDesc: string
    audited: string
  }
  earn: {
    title: string
    kicker: string
    heroTitle: string
    heroSub: string
    today: string
    uptime: string
    tasks: string
    liveTask: string
    mobileNpu: string
    taskName: string
    taskDesc: string
    upgradeGap: string
    vsPhone: string
    yourPhone: string
  }
  store: {
    title: string
    kicker: string
    heroTitle: string
    heroSub: string
    hardware: string
    cloudShare: string
    genesis: string
    managedDeployment: string
    estimatedDaily: string
    payback: string
    slot: string
    months: string
    starter: string
    popular: string
    scale: string
  }
  team: {
    title: string
    kicker: string
    heroTitle: string
    rankDesc: string
    members: string
    direct: string
    month: string
    networkTools: string
    influence: string
    influenceDesc: string
    binaryMatch: string
    binaryMatchDesc: string
    leadershipPool: string
    leadershipPoolDesc: string
  }
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

export const PRIORITY_LABELS_ZH: Record<0 | 1 | 2 | 3, string> = {
  0: '推荐',
  1: '主要市场',
  2: '增长地区',
  3: '欧洲'
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

const tabEn: TabMessages = {
  home: 'Home',
  earn: 'Earn',
  store: 'Store',
  team: 'Team',
  me: 'Me'
}

const tabZh: TabMessages = {
  home: '首页',
  earn: '赚取',
  store: '商城',
  team: '团队',
  me: '我的'
}

const tabMessages: Partial<Record<LocaleCode, TabMessages>> = {
  en: tabEn,
  zh: tabZh
}

const mainEn: MainPageMessages = {
  common: {
    comingSoon: (label: string) => `${label} will be connected next`,
    rankCadet: 'Cadet'
  },
  home: {
    goodDay: 'Good day',
    headlinePrefix: 'Your node earned',
    headlineSuffix: 'today.',
    earnings: 'Earnings',
    live: 'live',
    pending: 'Pending',
    rank: 'Rank',
    freeTrial: 'FREE TRIAL',
    cloudShare: 'Nexion Cloud Share',
    trialDesc: 'Try a managed node before you buy hardware.',
    earnUpTo: 'Earn up to',
    firstDayReward: 'First day reward',
    endsIn: 'Ends in',
    connectWallet: 'Connect wallet',
    visitEarn: 'Visit earn',
    seeProductRoi: 'See product ROI',
    store: 'Store',
    devices: 'Devices',
    wallet: 'Wallet',
    team: 'Team',
    myFleet: 'My fleet',
    activeSlots: '0 / 6 active',
    gridSlots: 'Nexion grid slots',
    gridSlotsDesc: '6 open slots · add hardware or cloud share',
    yourRank: 'Your rank',
    rankDesc: 'Referral {code} · build volume to unlock higher rewards.',
    audited: 'Independently audited'
  },
  earn: {
    title: 'Earn',
    kicker: 'EARN / FLEET',
    heroTitle: 'Your phone is earning now.',
    heroSub: 'Keep the device online, add hardware when ROI is worth it.',
    today: 'Today',
    uptime: 'Uptime',
    tasks: 'Tasks',
    liveTask: 'Live task',
    mobileNpu: 'Mobile NPU',
    taskName: 'Vision model inference',
    taskDesc: 'Client batch · 72% complete',
    upgradeGap: 'Upgrade gap',
    vsPhone: 'vs phone',
    yourPhone: 'Your phone'
  },
  store: {
    title: 'Store',
    kicker: 'STORE',
    heroTitle: 'Buy compute that pays you back.',
    heroSub: 'Compare ROI, slots and lifecycle before upgrading.',
    hardware: 'Hardware',
    cloudShare: 'Cloud share',
    genesis: 'Genesis',
    managedDeployment: 'managed deployment',
    estimatedDaily: 'Est. daily',
    payback: 'Payback',
    slot: 'Slot',
    months: '8 mo',
    starter: 'Starter',
    popular: 'Popular',
    scale: 'Scale'
  },
  team: {
    title: 'Team',
    kicker: 'TEAM ROYALTY',
    heroTitle: 'Invite compute. Earn network yield.',
    rankDesc: 'Grow direct users and team volume to unlock higher royalty.',
    members: 'Members',
    direct: 'Direct',
    month: 'Month',
    networkTools: 'Network tools',
    influence: 'Influence',
    influenceDesc: 'Direct + extended network',
    binaryMatch: 'Binary match',
    binaryMatchDesc: 'Left/right volume balance',
    leadershipPool: 'Leadership pool',
    leadershipPoolDesc: 'Ranked monthly rewards'
  }
}

const mainZh: MainPageMessages = {
  common: {
    comingSoon: (label: string) => `${label} 后续接入`,
    rankCadet: '学员'
  },
  home: {
    goodDay: '你好',
    headlinePrefix: '你的节点今天已赚取',
    headlineSuffix: '。',
    earnings: '收益',
    live: '运行中',
    pending: '待结算',
    rank: '等级',
    freeTrial: '免费试用',
    cloudShare: 'Nexion 云算力',
    trialDesc: '购买硬件前，先体验托管节点收益。',
    earnUpTo: '最高可赚',
    firstDayReward: '首日奖励',
    endsIn: '剩余时间',
    connectWallet: '连接钱包',
    visitEarn: '查看赚取',
    seeProductRoi: '查看产品 ROI',
    store: '商城',
    devices: '设备',
    wallet: '钱包',
    team: '团队',
    myFleet: '我的设备组',
    activeSlots: '0 / 6 已激活',
    gridSlots: 'Nexion 算力槽位',
    gridSlotsDesc: '6 个槽位可用 · 添加硬件或云算力',
    yourRank: '当前等级',
    rankDesc: '推荐码 {code} · 提升业绩解锁更高奖励。',
    audited: '独立审计'
  },
  earn: {
    title: '赚取',
    kicker: '赚取 / 设备组',
    heroTitle: '你的手机正在产生收益。',
    heroSub: '保持设备在线，在 ROI 合适时添加硬件。',
    today: '今日',
    uptime: '在线率',
    tasks: '任务',
    liveTask: '实时任务',
    mobileNpu: '移动端 NPU',
    taskName: '视觉模型推理',
    taskDesc: '客户批次 · 完成 72%',
    upgradeGap: '升级差距',
    vsPhone: '对比手机',
    yourPhone: '你的手机'
  },
  store: {
    title: '商城',
    kicker: '商城',
    heroTitle: '购买能持续回本的算力。',
    heroSub: '升级前对比 ROI、槽位和生命周期。',
    hardware: '硬件',
    cloudShare: '云算力',
    genesis: 'Genesis',
    managedDeployment: '托管部署',
    estimatedDaily: '预计日收益',
    payback: '回本周期',
    slot: '槽位',
    months: '8 个月',
    starter: '入门',
    popular: '热门',
    scale: '规模化'
  },
  team: {
    title: '团队',
    kicker: '团队版税',
    heroTitle: '邀请算力用户，获得网络收益。',
    rankDesc: '发展直推用户和团队业绩，解锁更高级别版税。',
    members: '成员',
    direct: '直推',
    month: '本月',
    networkTools: '团队工具',
    influence: '影响力',
    influenceDesc: '直推 + 扩展网络',
    binaryMatch: '双区匹配',
    binaryMatchDesc: '左右区业绩平衡',
    leadershipPool: '领导力奖池',
    leadershipPoolDesc: '按月发放的等级奖励'
  }
}

const mainMessages: Partial<Record<LocaleCode, MainPageMessages>> = {
  en: mainEn,
  zh: mainZh
}

const meEn: MeMessages = {
  title: 'Me',
  kycPending: 'KYC pending',
  joinedOneDay: 'Joined 1d',
  walletTitle: 'My wallet',
  pending: 'pending',
  topUp: 'Top up',
  withdraw: 'Withdraw',
  exchange: 'Exchange',
  slotsOpen: 'Slots open',
  bills: 'Bills',
  withdrawalLocked: 'Withdrawal locked',
  withdrawalLockedDesc: 'Reach the minimum balance and complete verification first.',
  yourRank: 'Your rank',
  rankDesc: 'Cadet · invite users to grow team volume.',
  myDevices: 'My devices',
  fleetStatus: 'Fleet status',
  fleetStatusDesc: '0 online · 6 slots open',
  earnExtras: 'Earn extras',
  missions: 'Missions',
  daily: 'Daily',
  eventsCenter: 'Events center',
  liveCount: '9 live',
  achievements: 'Achievements',
  account: 'Account',
  profile: 'Profile',
  identitySecurity: 'Identity & security',
  no2fa: 'No 2FA',
  notifications: 'Notifications',
  preferences: 'Preferences',
  appearance: 'Appearance',
  light: 'Light',
  dark: 'Dark',
  language: 'Language',
  help: 'Help',
  replayTour: 'Replay tour',
  helpFaq: 'Help & FAQ',
  liveSupport: 'Live support',
  online: 'online',
  signOut: 'Sign out',
  signOutTitle: 'Sign out',
  signOutContent: 'Sign out of this device?',
  comingSoon: (label: string) => `${label} will be connected next`
}

const meZh: MeMessages = {
  title: '我的',
  kycPending: 'KYC 待完成',
  joinedOneDay: '已加入 1 天',
  walletTitle: '我的钱包',
  pending: '待处理',
  topUp: '充值',
  withdraw: '提现',
  exchange: '兑换',
  slotsOpen: '可用槽位',
  bills: '账单',
  withdrawalLocked: '提现暂未开放',
  withdrawalLockedDesc: '请先达到最低余额并完成身份验证。',
  yourRank: '当前等级',
  rankDesc: '学员 · 邀请用户提升团队业绩。',
  myDevices: '我的设备',
  fleetStatus: '设备状态',
  fleetStatusDesc: '0 台在线 · 6 个槽位可用',
  earnExtras: '额外收益',
  missions: '任务',
  daily: '每日',
  eventsCenter: '活动中心',
  liveCount: '9 个进行中',
  achievements: '成就',
  account: '账户',
  profile: '个人资料',
  identitySecurity: '身份与安全',
  no2fa: '未开启 2FA',
  notifications: '通知',
  preferences: '偏好设置',
  appearance: '外观',
  light: '浅色',
  dark: '深色',
  language: '语言',
  help: '帮助',
  replayTour: '重看引导',
  helpFaq: '帮助与常见问题',
  liveSupport: '在线客服',
  online: '在线',
  signOut: '退出登录',
  signOutTitle: '退出登录',
  signOutContent: '确认退出当前设备吗？',
  comingSoon: (label: string) => `${label} 后续接入`
}

const meMessages: Partial<Record<LocaleCode, MeMessages>> = {
  en: meEn,
  zh: meZh
}

const profileEn: ProfileMessages = {
  title: 'Profile',
  avatar: 'Avatar',
  avatarHint: 'Tap to upload a new image',
  changeAvatar: 'Change avatar',
  displayName: 'Display name',
  displayNameHint: 'Visible to your team',
  namePlaceholder: 'How should we call you?',
  bio: 'Bio',
  bioPlaceholder: "Tell the community what you're building...",
  bioHint: 'Up to 140 chars',
  region: 'Region',
  timezone: 'Timezone',
  referralCode: 'Referral code',
  joinedOn: 'Joined on',
  sectionPublic: 'Public profile',
  tierTitle: 'Tier',
  tierProgress: 'Progress to {next}',
  walletAddress: 'Wallet address',
  walletEmpty: 'Not paired yet',
  walletPair: 'Pair wallet',
  saveChanges: 'Save Changes',
  saved: 'Profile saved',
  saving: 'Saving...',
  uploadFailed: 'Avatar upload failed',
  back: 'Back',
  tierLabels: {
    L0: 'Visitor',
    L1: 'Newbie',
    L2: 'Active',
    L3: 'Upgrade-ready',
    L4: 'Owner',
    L5: 'Ambassador'
  }
}

const profileZh: ProfileMessages = {
  title: '个人资料',
  avatar: '头像',
  avatarHint: '点击上传新图片',
  changeAvatar: '更换头像',
  displayName: '昵称',
  displayNameHint: '团队成员可见',
  namePlaceholder: '你希望大家怎么称呼你?',
  bio: '简介',
  bioPlaceholder: '告诉社区你在构建什么...',
  bioHint: '最多 140 字',
  region: '所在地区',
  timezone: '时区',
  referralCode: '推荐码',
  joinedOn: '加入时间',
  sectionPublic: '公开资料',
  tierTitle: '等级',
  tierProgress: '距离 {next}',
  walletAddress: '钱包地址',
  walletEmpty: '尚未绑定',
  walletPair: '绑定钱包',
  saveChanges: '保存修改',
  saved: '资料已保存',
  saving: '保存中...',
  uploadFailed: '头像上传失败',
  back: '返回',
  tierLabels: {
    L0: '访客',
    L1: '新手',
    L2: '活跃',
    L3: '升级候选',
    L4: '持有者',
    L5: '推广大使'
  }
}

const profileMessages: Partial<Record<LocaleCode, ProfileMessages>> = {
  en: profileEn,
  zh: profileZh
}

export function normalizeLocale(value: unknown): LocaleCode {
  if (typeof value !== 'string') return 'en'
  const code = value.toLowerCase().split(/[-_]/)[0] as LocaleCode
  return LOCALES.some((item) => item.code === code) ? code : 'en'
}

export function getStoredLocale(): LocaleCode {
  return normalizeLocale(uni.getStorageSync(LOCALE_KEY) || 'en')
}

export const activeLocale = ref<LocaleCode>(getStoredLocale())

export function setStoredLocale(code: LocaleCode) {
  uni.setStorageSync(LOCALE_KEY, code)
  activeLocale.value = code
}

export function useActiveLocale() {
  return activeLocale
}

export function getLocaleEntry(code: LocaleCode) {
  return LOCALES.find((item) => item.code === code) ?? LOCALES[0]
}

export function getIntroMessages(code: LocaleCode) {
  return introMessages[code] ?? introEn
}

export function getMeMessages(code: LocaleCode) {
  return meMessages[code] ?? meEn
}

export function getProfileMessages(code: LocaleCode) {
  return profileMessages[code] ?? profileEn
}

export function getTabMessages(code: LocaleCode) {
  return tabMessages[code] ?? tabEn
}

export function getMainPageMessages(code: LocaleCode) {
  return mainMessages[code] ?? mainEn
}

export function getPriorityLabels(code: LocaleCode) {
  return code === 'zh' ? PRIORITY_LABELS_ZH : PRIORITY_LABELS
}
