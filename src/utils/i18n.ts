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

export interface StellaMessages {
  name: string
  role: string
  liveAgent: string
  agentRole: string
  backToAi: string
  emptyHint: string
  inputPlaceholder: string
  agentInputPlaceholder: string
  send: string
  qExplainToday: string
  qHowToBoost: string
  qWhatsHot: string
  qShowTopJobs: string
  sysConnectedHuman: string
  sysBackToAi: string
  demoReply: string
  agentReply: string
  intro1: string
  intro2: string
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
    v5: Record<string, string>
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
    v5: Record<string, string>
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
    v5: Record<string, string>
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
    v5: {
      headline: 'Your node earned {amount} today.',
      upgradeSignal: 'Upgrade signal',
      upgradeSignalBody: 'Your phone is earning. Hardware makes the curve obvious.',
      seeRoi: 'See ROI',
      noHardwareTrial: 'No hardware, no shipping. Start earning from a managed slice of the grid.',
      connectWallet: 'Connect wallet',
      visitEarnTab: 'Visit Earn tab',
      visitStore: 'Visit Store',
      seeProductRoi: 'See product ROI',
      setupProfile: 'Set up profile',
      inviteFriend: 'Invite a friend',
      walletCat: 'Wallet',
      exploreCat: 'Explore',
      convertCat: 'Convert',
      identityCat: 'Identity',
      socialCat: 'Social',
      doneSuffix: 'done',
      earnedSuffix: 'NEX earned',
      activity: 'Activity',
      earningsTab: 'Earnings',
      phoneNodeCompleted: 'phone node completed SDXL batch',
      newInferenceJob: 'new inference job routed',
      rackSlotOpened: 'rack slot opened in Singapore',
      boughtS1: 'Sarah K. bought NexionBox S1',
      bought: 'bought',
      youLabel: 'You',
      gridLabel: 'Grid',
      openLabel: 'open',
      todayJobsStreak: '+5.2% vs yesterday · 142 jobs settled',
      todayEarningsLabel: 'Today\'s earnings',
      streaming: 'streaming',
      peerAvgS1: 'Peer avg (S1 owner)',
      paybackToBox: 'Payback to box',
      seeAll: 'See all',
      phoneNode: 'Phone node',
      phoneNodeDesc: 'On Nexion grid · mobile NPU earning',
      onGrid: 'On Nexion grid',
      gridNow: 'now',
      gridMap: 'Map',
      gridOnline: 'online',
      liveBoxes: 'live boxes',
      medianRoute: 'median route',
      uptimeSla: 'uptime SLA',
      networkPulse: 'Network pulse',
      networkPulseBody: 'Demand is above baseline in 3 regions.',
      globalGridLive: 'Global grid · live',
      pulsePhones: 'Phones',
      pulsePhonesSub: 'online · +2.1% /1h',
      pulsePaidToday: 'Paid today',
      pulsePaidTodaySub: '+8.2% vs yest.',
      pulseHubs: 'Hubs',
      pulseHubsSub: 'live · 4,820 jobs/s',
      pulseRank: 'Your rank',
      pulseRankSub: '↑ 12 in 24h',
      stellaRole: 'AI advisor',
      stellaBody: 'Your yield is in the top {pct}% for phone-only nodes. Want a faster path?',
      openChat: 'Open chat',
      nextRankProgress: 'next rank progress',
      leadershipPool: 'Leadership pool',
      currentMonthlyPool: 'current monthly pool',
      requiredToUnlock: 'required to unlock',
      rankStep: 'step',
      rankNext: 'Next',
      rankMissing: 'Direct volume · Team volume · Active devices',
      rankPrize: 'Starter bonus · unlock at V1',
      poolEndsIn: 'ends in',
      poolVolume: 'this week\'s pool · 5% of platform volume',
      poolUnlock: 'V3+ to unlock',
      doTheMath: 'Do the math',
      mathInteractive: 'interactive',
      mathPhoneNeeds: 'Your phone needs',
      mathDays: 'days',
      mathToEarn: 'to earn',
      mathEarnsIt: 'earns it in',
      mathDaily: 'daily',
      mathPayback: 'payback',
      mathVsPhone: 'vs phone',
      mathSee: 'See the math',
      phone: 'Phone',
      multiplier: 'Multiplier',
      earningsLedger: 'Earnings ledger',
      nexPrice: 'NEX price',
      computeMarket: 'Compute market',
      marketPrices: 'prices',
      marketOpen: 'Open',
      reserveProof: 'Reserve proof on-chain · 102.4% backed · Trust Center',
      weeklyQuestEyebrow: 'This week\'s quest',
      weeklyQuestEndsIn: 'Ends in',
      weeklyQuestActivate: 'Activate NexionBox S1 to claim',
      weeklyQuestYourPhone: '你的手机',
      weeklyQuestPayback: 'payback',
      weeklyQuestCta: 'Claim NexionBox',
      viewTasks: 'View {n} tasks',
      hideTasks: 'Hide tasks',
      liveActivity: 'Activity',
      liveEarnings: 'Earnings',
      liveFeed: 'live',
      feedLock: 'Lock',
      feedPeer: 'Peer',
      feedYou: 'You',
      feedLocked: 'locked',
      feedLockedJob: 'Llama 70B LoRA @ Vector — needs 192GB',
      quickStake: 'Stake',
      quickGenesis: 'Genesis',
      quickGenesisSub: '144 left',
      quickMissions: 'Missions',
      quickMissionsSub: '5 active',
      quickDaily: 'Daily',
      quickDailySub: '8 pts',
      myFleetTitle: 'My fleet',
      manage: 'Manage',
      yourPhoneDevice: 'Your phone',
      earning: 'earning',
      today: 'today',
      left: 'left',
      streak: 'streak',
      addNexionBox: 'Add a NexionBox',
      paysBack34: 'Pays back in ~34 days',
      estPerDay: 'est. /d'
    },
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
    v5: {
      today: 'Today',
      week: 'Week',
      month: 'Month',
      all: 'All',
      computeEarned: 'Compute earned',
      production: 'Production',
      productionSub: 'phone + box jobs',
      aiPremium: 'AI Premium',
      aiPremiumSub: '+NEX bonus',
      missedIncome: 'Missed income',
      missedTitle: '$38.44 left on the table today.',
      missedBody: 'A dedicated NexionBox S1 can unlock the hardware pool while your phone stays in the mobile lane.',
      vsS1Ceiling: 'vs S1 ceiling',
      yourPhone: 'Your phone',
      cumulativeMissed: 'Cumulative missed',
      stopBleeding: 'Stop bleeding',
      compare: 'Compare',
      freeTrialTitle: 'Activate a managed Cloud Share slot.',
      freeTrialBody: 'Start a 24h trial before buying hardware. Earnings and task history stay visible here.',
      startTrial: 'Start trial',
      trialTagline: 'Try hardware yield for 3 days',
      trialEarnLabel: 'EST. 3D',
      trialsLeft: '47 trials left',
      instantActivation: 'Instant activation',
      ghostSlot: 'Trial ghost slot',
      ghostSlotDesc: 'Reserved for your first cloud-share activation.',
      myDevices: 'My devices',
      phoneNode: 'Phone node',
      phoneNodeDesc: 'Mobile NPU · active',
      yourPhoneDevice: '你的手机',
      phoneNpuSpec: '移动端 NPU · ~28 TOPS',
      online: 'online',
      currentTask: 'Current Task',
      reward: 'Reward',
      remaining: 'remaining',
      phoneNetOnline: 'online',
      phoneSettingsTitle: 'Background mode',
      phoneRequirementsHint: 'Charging + network must both stay available before accepting tasks. The scheduler ping-checks before every job.',
      lockedTasksTitle: 'Locked AI tasks',
      lockedTasksBlocked: 'Tasks your phone cannot accept',
      lockedMissedDaily: 'lost daily',
      unlockNMoreTasks: 'Unlock {n} more tasks',
      todayEarnings: 'Today earnings',
      estThisHour: 'Est. this hour',
      cloudShareTrial: 'Cloud Share trial',
      cloudShareTrialDesc: 'Managed slice · ready',
      emptySlots: 'Empty slots',
      emptySlotsTitle: '5 hardware slots open.',
      addDevice: 'Add device',
      fillSlots: 'Fill slots',
      slotsPotential: 'Potential daily yield · if filled',
      slotsUntapped: 'untapped',
      slotsFilled: 'filled',
      networkAvg: 'network avg /d',
      rankIfFilled: 'rank if filled',
      currentFleet: 'current fleet {amount}/d · upgrade to multiply',
      fleetLifecycle: 'Fleet lifecycle',
      lifecycleBody: 'Keep active devices above 95% uptime to avoid yield decay.',
      lifecycleMonthlyLoss: 'monthly loss',
      lifecycleCta: 'Review',
      grace: 'Grace',
      decay: 'Decay',
      recover: 'Recover',
      marketOverview: 'Market Overview',
      liveDemand: 'updated 2m ago',
      priceIndex: 'AI Workload Price Index',
      priceImageGen: 'Image Gen',
      priceLlmInference: 'LLM Inference',
      priceVideoGen: 'Video Gen',
      priceEmbedding: 'Embedding',
      pricePerImage: 'per image',
      pricePerTokens: 'per 1k tok',
      pricePerSecond: 'per sec',
      pricePerJob: 'per job',
      pricePerChunks: 'per 1k chunks',
      pricePerAudioSecond: 'per audio sec',
      deviceRanking: 'Device earnings ranking',
      networkState: 'Network state',
      activeJobs: 'Active jobs',
      llmQueue: 'LLM queue',
      peakHours: 'Peak hours',
      nextDrop: 'Next AI drop',
      imageGen: 'Image gen',
      llmRouting: 'LLM routing',
      speech: 'Speech',
      high: 'High',
      live: 'Live',
      stable: 'Stable',
      premiumLocked: 'High-tier tasks missed this month',
      premiumLockedBody: 'Hardware owners unlock AI Premium, fine-tune, and 405B inference queues.',
      taskLockThisMonth: 'this month',
      taskLockCumulative: 'since signup',
      taskLockCtaUpgrade: 'See premium tiers',
      fineTune: 'Fine-tune',
      videoGen: 'Video gen',
      llm405b: '405B LLM',
      taskCenter: 'Task Center',
      tabCurrent: 'Current',
      tabHistory: 'History',
      currentlyProcessing: 'Currently processing',
      noActive: 'No active tasks',
      completedHint: 'Tasks complete every few minutes — check back soon.',
      deviceLabel: 'Device:',
      upgradeUnlocks: 'Upgrade Unlocks',
      upgradeUnlocksHint: 'Higher-paying jobs above your current VRAM cap',
      upgradeNow: 'Upgrade now',
      requires: 'requires',
      completedToday: 'Completed Today',
      historyHint: 'Last {n} jobs · Tap any row to open its Proof-of-Compute receipt.',
      historyEmpty: 'No completed tasks yet — your first one is on the way.',
      jobsLive: 'jobs live globally',
      readyCount: '3 ready',
      keepOnline: 'Keep phone online for 30 min',
      reviewRoi: 'Review S1 ROI card',
      inviteOperator: 'Invite one qualified operator',
      ready: 'Ready',
      jobs: 'jobs',
      streak: 'streak',
      idle: 'idle'
    },
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
    v5: {
      heroKicker: 'Your place in the network',
      heroTitlePrefix: 'Climb to',
      heroTitleHighlight: '640x',
      heroTitleSuffix: 'daily yield.',
      heroSub: 'Unlocks Llama 70B inference + image-gen at 1080p.',
      networkLadder: 'Network ladder',
      fiveTiers: '5 tiers',
      you: 'you',
      yourPhone: 'your phone',
      phone: 'Phone',
      more640: '640x more',
      tradeWindow: 'Trade-in window',
      tradeWindowBody: 'Legacy owners can retire old hardware into next-gen credit when phases unlock.',
      phaseLive: 'phase live',
      recommended: 'Recommended for you',
      moreTiers: 'More tiers',
      comingSoon: 'Next-gen products',
      nextPhases: 'Production batches ship later in the cycle',
      personalBox: 'Personal AI inference box · fully managed',
      proBox: 'Double the GPUs, double the earning power.',
      rackBox: 'Datacenter-grade A100 rack for serious operators.',
      cloudShareLine: 'No hardware needed — buy a slice of the network.',
      bestSeller: 'Best Seller',
      trending: 'Trending',
      flagship: 'Flagship',
      lowBarrier: 'Low Barrier',
      tierEntry: 'Entry',
      tierPro: 'Pro',
      tierFlagship: 'Flagship',
      tierShare: 'Share',
      youEarn: 'You earn',
      yearRoi: 'Year 1 ROI',
      liveCount: 'Live count',
      operators: 'operators',
      unitsLeft: 'Only {n} units left this week',
      price: 'Price',
      from: 'From',
      annualPayback: '~{annual} annual · payback ~{payback}',
      oneTimeStake: 'one-time stake',
      buyNow: 'Buy now',
      stake: 'Stake',
      bought: 'bought',
      ago: 'ago',
      orders: 'Orders',
      footerNote: 'Fully managed · zero shipping · 99.9% uptime SLA',
      cloudInstant: 'Instant activation',
      cloudDistributed: 'Distributed',
      cloudYield: '8-15% yield',
      cloudRedeem: 'Redeem 30d',
      newSilicon: '8x RTX 5090 · new silicon generation',
      trainingUnlock: '8x H100 · training pool unlock'
    },
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
    v5: {
      headline: '今日节点已赚取 {amount}。',
      upgradeSignal: '升级信号',
      upgradeSignalBody: '你的手机正在产生收益，硬件会让收益曲线更明显。',
      seeRoi: '查看 ROI',
      noHardwareTrial: '无需硬件，无需配送。先从托管算力切片开始产生收益。',
      connectWallet: '连接钱包',
      visitEarnTab: '查看赚取页',
      visitStore: '查看商城',
      seeProductRoi: '查看产品 ROI',
      setupProfile: '完善个人资料',
      inviteFriend: '邀请好友',
      walletCat: '钱包',
      exploreCat: '探索',
      convertCat: '转化',
      identityCat: '身份',
      socialCat: '社交',
      doneSuffix: '已完成',
      earnedSuffix: 'NEX 已获得',
      activity: '动态',
      earningsTab: '收益',
      phoneNodeCompleted: '手机节点完成 SDXL 批次',
      newInferenceJob: '新的推理任务已路由',
      rackSlotOpened: '新加坡机柜槽位开放',
      boughtS1: 'Sarah K. 购买了 NexionBox S1',
      bought: '购买了',
      youLabel: '你',
      gridLabel: '网络',
      openLabel: '开放',
      todayJobsStreak: '较昨日 +5.2% · 142 个任务已结算',
      todayEarningsLabel: '今日收益',
      streaming: '实时入账',
      peerAvgS1: '同类均值（S1 用户）',
      paybackToBox: '设备回本',
      seeAll: '查看全部',
      phoneNode: '手机节点',
      phoneNodeDesc: '接入 Nexion 网络 · 移动端 NPU 赚钱中',
      onGrid: '接入 Nexion 网络',
      gridNow: '实时',
      gridMap: '地图',
      gridOnline: '在线',
      liveBoxes: '在线设备',
      medianRoute: '中位路由',
      uptimeSla: '在线 SLA',
      networkPulse: '网络脉搏',
      networkPulseBody: '3 个地区的需求高于基线。',
      globalGridLive: '全球网络 · 运行中',
      pulsePhones: '手机',
      pulsePhonesSub: '在线 · +2.1% /1h',
      pulsePaidToday: '今日支付',
      pulsePaidTodaySub: '较昨日 +8.2%',
      pulseHubs: '枢纽',
      pulseHubsSub: '运行中 · 4,820 任务/s',
      pulseRank: '你的排名',
      pulseRankSub: '24h 上升 12',
      stellaRole: 'AI 顾问',
      stellaBody: '你的收益处于手机节点前 {pct}%。想走更快路径吗？',
      openChat: '打开对话',
      nextRankProgress: '下一等级进度',
      leadershipPool: '领导力奖池',
      currentMonthlyPool: '当前月度奖池',
      requiredToUnlock: '解锁要求',
      rankStep: '阶段',
      rankNext: '下一档',
      rankMissing: '直推业绩 · 团队业绩 · 活跃设备',
      rankPrize: '新手奖励 · V1 解锁',
      poolEndsIn: '剩余',
      poolVolume: '本周奖池 · 平台流水 5%',
      poolUnlock: 'V3+ 解锁',
      doTheMath: '算一笔账',
      mathInteractive: '可交互',
      mathPhoneNeeds: '你的手机需要',
      mathDays: '天',
      mathToEarn: '才能赚到',
      mathEarnsIt: '只需',
      mathDaily: '日收益',
      mathPayback: '回本',
      mathVsPhone: '对比手机',
      mathSee: '查看计算',
      phone: '手机',
      multiplier: '倍数',
      earningsLedger: '收益账本',
      nexPrice: 'NEX 价格',
      computeMarket: '算力市场',
      marketPrices: '价格',
      marketOpen: '打开',
      reserveProof: '链上储备证明 · 102.4% 足额支持 · 信任中心',
      weeklyQuestEyebrow: '本周任务',
      weeklyQuestEndsIn: '倒计时',
      weeklyQuestActivate: '激活 NexionBox S1 即可领取',
      weeklyQuestYourPhone: '你的手机',
      weeklyQuestPayback: '回本',
      weeklyQuestCta: '获取 NexionBox',
      viewTasks: '查看 {n} 个任务',
      hideTasks: '收起任务',
      liveActivity: '动态',
      liveEarnings: '收益',
      liveFeed: '运行中',
      feedLock: '锁定',
      feedPeer: '伙伴',
      feedYou: '你',
      feedLocked: '已锁定',
      feedLockedJob: 'Llama 70B LoRA @ Vector — 需要 192GB',
      quickStake: '质押',
      quickGenesis: '创世',
      quickGenesisSub: '剩余 144',
      quickMissions: '任务',
      quickMissionsSub: '5 个活跃',
      quickDaily: '每日',
      quickDailySub: '8 分',
      myFleetTitle: '我的设备',
      manage: '管理',
      yourPhoneDevice: '你的手机',
      earning: '收益中',
      today: '今日',
      left: '剩余',
      streak: '连续',
      addNexionBox: '添加 NexionBox',
      paysBack34: '约 34 天回本',
      estPerDay: '预计 /日'
    },
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
    v5: {
      today: '今日',
      week: '本周',
      month: '本月',
      all: '全部',
      computeEarned: '算力收益',
      production: '生产收益',
      productionSub: '手机 + 设备任务',
      aiPremium: 'AI 高级池',
      aiPremiumSub: '+NEX 奖励',
      missedIncome: '错过收益',
      missedTitle: '今天还有 $38.44 没赚到。',
      missedBody: '专属 NexionBox S1 可以解锁硬件池，同时手机继续留在移动端收益通道。',
      vsS1Ceiling: '对比 S1 上限',
      yourPhone: '你的手机',
      cumulativeMissed: '累计错过',
      stopBleeding: '停止损失',
      compare: '对比',
      freeTrialTitle: '激活托管 Cloud Share 槽位。',
      freeTrialBody: '购买硬件前先开始 24 小时试用，收益和任务记录会保留在这里。',
      startTrial: '开始试用',
      trialTagline: '体验 3 天硬件收益',
      trialEarnLabel: '预计 3 天',
      trialsLeft: '剩余 47 个试用名额',
      instantActivation: '即时激活',
      ghostSlot: '试用预留槽',
      ghostSlotDesc: '为你的首个云算力激活预留。',
      myDevices: '我的设备',
      phoneNode: '手机节点',
      phoneNodeDesc: '移动端 NPU · 运行中',
      yourPhoneDevice: '你的手机',
      phoneNpuSpec: '移动端 NPU · ~28 TOPS',
      online: '在线',
      currentTask: '当前任务',
      reward: '奖励',
      remaining: '剩余',
      phoneNetOnline: '在线',
      phoneSettingsTitle: '后台模式',
      phoneRequirementsHint: '充电 + 网络两个条件都必须满足才会接单 — 充电是硬性门槛, 网络在每个任务分发前 ping 检测一次。',
      lockedTasksTitle: '锁定 AI 任务',
      lockedTasksBlocked: '你被锁定无法接的任务',
      lockedMissedDaily: '每天流失',
      unlockNMoreTasks: '解锁另外 {n} 个任务',
      todayEarnings: '今日收益',
      estThisHour: '本小时预计',
      cloudShareTrial: 'Cloud Share 试用',
      cloudShareTrialDesc: '托管切片 · 可用',
      emptySlots: '空槽位',
      emptySlotsTitle: '还有 5 个硬件槽位可用。',
      addDevice: '添加设备',
      fillSlots: '填满槽位',
      slotsPotential: '潜在日收益 · 全部插满',
      slotsUntapped: '未释放',
      slotsFilled: '已占用',
      networkAvg: '全网均值 /d',
      rankIfFilled: '插满排名',
      currentFleet: '当前车队 {amount}/d · 升级翻倍',
      fleetLifecycle: '设备生命周期',
      lifecycleBody: '保持活跃设备在线率高于 95%，避免收益衰减。',
      lifecycleMonthlyLoss: '月度损耗',
      lifecycleCta: '查看',
      grace: '宽限期',
      decay: '衰减',
      recover: '恢复',
      marketOverview: '行情看板',
      liveDemand: '2分钟前更新',
      priceIndex: 'AI 工作负载价格指数',
      priceImageGen: '图像生成',
      priceLlmInference: 'LLM 推理',
      priceVideoGen: '视频生成',
      priceEmbedding: '向量嵌入',
      pricePerImage: '每张图',
      pricePerTokens: '每 1k token',
      pricePerSecond: '每秒',
      pricePerJob: '每任务',
      pricePerChunks: '每 1k 分块',
      pricePerAudioSecond: '每秒音频',
      deviceRanking: '设备日收益排行',
      networkState: '网络状态',
      activeJobs: '活跃任务',
      llmQueue: 'LLM 队列深度',
      peakHours: '高峰时段',
      nextDrop: '下次AI drop',
      imageGen: '图像生成',
      llmRouting: 'LLM 路由',
      speech: '语音',
      high: '高',
      live: '实时',
      stable: '稳定',
      premiumLocked: '本月没接住的高阶任务',
      premiumLockedBody: '硬件持有者可解锁 AI 高级池、微调任务和 405B 推理队列。',
      taskLockThisMonth: '本月',
      taskLockCumulative: '注册以来累计',
      taskLockCtaUpgrade: '查看 Premium 设备',
      fineTune: '微调',
      videoGen: '视频生成',
      llm405b: '405B LLM',
      taskCenter: '任务中心',
      tabCurrent: '当前',
      tabHistory: '历史',
      currentlyProcessing: '处理中',
      noActive: '暂无任务',
      completedHint: '任务每几分钟完成一个,稍后再来看。',
      deviceLabel: '设备:',
      upgradeUnlocks: '升级解锁',
      upgradeUnlocksHint: '超过当前显存上限、单价更高的任务',
      upgradeNow: '升级',
      requires: '需要',
      completedToday: '今日已完成',
      historyHint: '最近 {n} 笔 · 点击任意一条可打开对应的 Proof-of-Compute 收据。',
      historyEmpty: '暂无已完成任务 — 第一笔即将出现。',
      jobsLive: '个全球任务进行中',
      readyCount: '3 个可做',
      keepOnline: '保持手机在线 30 分钟',
      reviewRoi: '查看 S1 ROI 卡片',
      inviteOperator: '邀请一位合格运营者',
      ready: '可做',
      jobs: '个任务',
      streak: '连续',
      idle: '空闲'
    },
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
    v5: {
      heroKicker: '你在网络中的位置',
      heroTitlePrefix: '攀升到',
      heroTitleHighlight: '640x',
      heroTitleSuffix: '日收益。',
      heroSub: '解锁 Llama 70B 推理池和 1080p 图像生成。',
      networkLadder: '网络阶梯',
      fiveTiers: '5 档',
      you: '你',
      yourPhone: '你的手机',
      phone: '手机',
      more640: '多 640 倍',
      tradeWindow: '换购窗口',
      tradeWindowBody: '旧设备持有者可在阶段解锁时，把旧硬件折抵为新一代设备额度。',
      phaseLive: '阶段开放',
      recommended: '为你推荐',
      moreTiers: '更多档位',
      comingSoon: '下一代商品',
      nextPhases: '批量生产将在周期后期出货',
      personalBox: '个人 AI 推理盒 · 全托管',
      proBox: '双倍 GPU，双倍收益能力。',
      rackBox: '数据中心级 A100 机柜，适合专业运营者。',
      cloudShareLine: '无需硬件，购买网络中的一份算力切片。',
      bestSeller: '最畅销',
      trending: '趋势款',
      flagship: '旗舰',
      lowBarrier: '低门槛',
      tierEntry: '入门',
      tierPro: '专业',
      tierFlagship: '旗舰',
      tierShare: '份额',
      youEarn: '预计收益',
      yearRoi: '首年 ROI',
      liveCount: '在线数量',
      operators: '运营者',
      unitsLeft: '本周仅剩 {n} 台',
      price: '价格',
      from: '起',
      annualPayback: '~{annual} 年化 · 约 {payback} 回本',
      oneTimeStake: '一次性认购',
      buyNow: '立即购买',
      stake: '认购',
      bought: '购买了',
      ago: '前',
      orders: '订单',
      footerNote: '全托管 · 免配送 · 99.9% 在线 SLA',
      cloudInstant: '即时激活',
      cloudDistributed: '分布式',
      cloudYield: '8-15% 收益',
      cloudRedeem: '30 天赎回',
      newSilicon: '8x RTX 5090 · 新一代芯片',
      trainingUnlock: '8x H100 · 解锁训练池'
    },
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

const stellaEn: StellaMessages = {
  name: 'Stella',
  role: 'AI advisor · online',
  liveAgent: 'Human support',
  agentRole: 'Tier 2 Compliance Support · online',
  backToAi: 'Back to AI',
  emptyHint: 'Ask about earnings, devices, task routing, or account status.',
  inputPlaceholder: 'Ask Stella...',
  agentInputPlaceholder: 'Message support...',
  send: 'Send',
  qExplainToday: 'Explain today',
  qHowToBoost: 'How to boost',
  qWhatsHot: "What's hot",
  qShowTopJobs: 'Show top jobs',
  sysConnectedHuman: 'Connected to human support',
  sysBackToAi: 'Back with Stella AI',
  demoReply: 'Got it. I am checking your current node, wallet and task context. Try a quick prompt above for the demo flow.',
  agentReply: 'Support has received it. A specialist will follow up after checking your account status.',
  intro1: 'Your phone node is active. I can explain today\'s earnings or show the fastest boost path.',
  intro2: 'New premium jobs are routing through the Singapore edge cluster.'
}

const stellaZh: StellaMessages = {
  name: 'Stella',
  role: 'AI 顾问 · 在线',
  liveAgent: '人工客服',
  agentRole: '二级合规客服 · 在线',
  backToAi: '返回 AI',
  emptyHint: '可以询问收益、设备、任务派发或账户状态。',
  inputPlaceholder: '问问 Stella...',
  agentInputPlaceholder: '发送给客服...',
  send: '发送',
  qExplainToday: '解释今日收益',
  qHowToBoost: '如何提升',
  qWhatsHot: '现在热门',
  qShowTopJobs: '查看高价任务',
  sysConnectedHuman: '已接入人工客服',
  sysBackToAi: '已返回 Stella AI',
  demoReply: '收到。我正在结合你的节点、钱包和任务上下文查看。演示流程里也可以点上面的快捷问题。',
  agentReply: '客服已收到，会在核对账户状态后继续跟进。',
  intro1: '你的手机节点已在线。我可以解释今日收益，或给你最快的提升路径。',
  intro2: '新的高价任务正在通过新加坡边缘集群派发。'
}

const stellaMessages: Partial<Record<LocaleCode, StellaMessages>> = {
  en: stellaEn,
  zh: stellaZh
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

export function getStellaMessages(code: LocaleCode) {
  return stellaMessages[code] ?? stellaEn
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
