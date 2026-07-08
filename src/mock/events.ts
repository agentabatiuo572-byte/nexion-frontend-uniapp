/**
 * Events Center mock — ported from Nexion-prototype/lib/mock/events.ts.
 *
 * Promotions, contests, lucky-wheels, regional PK. MOCK-ONLY; production:
 * GET /api/events + per-user join/claim overlay. tint hex are the source's
 * literal per-event accent palette (data values used at runtime in color-mix
 * / gradients), never substituting v5 surface/text tokens.
 *
 * `trackable` events (those whose progress is user-driven) opt into the
 * event-quest store's join/claim flow; decorative/auto events keep their
 * hardcoded `joined` flag. The source's separate evaluateEventProgress()
 * evaluator is inlined here as the `trackable` flag + a fixed reward map,
 * keeping the page self-contained without porting the live-progress context.
 */

export type EventKind =
  | "discount"
  | "referral"
  | "wheel"
  | "regional"
  | "boost"
  | "seasonal"
  | "holding"
  | "onboarding";

export type EventStatus = "ongoing" | "upcoming" | "ended";

export interface NexEvent {
  id: string;
  kind: EventKind;
  status: EventStatus;
  title: string;
  subtitle: string;
  ribbon?: string;
  emoji: string;
  tint: string;
  reward: string;
  progress: { current: number; total: number; label: string } | null;
  countdown?: string;
  startsIn?: string;
  /** Hardcoded join flag for decorative/auto events */
  joined: boolean;
  ctaLabel?: string;
  href?: string;
  /** Where "Use it" navigates after the reward is claimed (discount → store, NEX reward → NEX wallet). */
  useHref?: string;
  featured?: boolean;
  /** Opt into the join→claim flow (progress is user-driven). */
  trackable?: boolean;
  /** Whether the trackable goal is met (mock; real: live evaluator). */
  done?: boolean;
  /** NEX reward on claim (trackable events only). */
  rewardNEX?: number;
}

export const EVENTS: NexEvent[] = [
  {
    id: "evt-pro-upgrade-7d",
    kind: "discount",
    status: "ongoing",
    title: "NexionBox Pro · 限时升级",
    subtitle: "7 天内升级到 Pro · 立减 $500 + 创世抽奖券 ×2。",
    ribbon: "限量 · 3 天 12 小时后结束",
    emoji: "📦",
    tint: "#FFC83D",
    reward: "立减 $500 + 抽奖券 ×2",
    progress: { current: 247, total: 500, label: "已领取" },
    countdown: "3d 12h 04m",
    joined: false,
    featured: true,
    ctaLabel: "领取折扣",
    useHref: "/pages/store/store",
  },
  {
    id: "evt-refer-5-get-pro",
    kind: "referral",
    status: "ongoing",
    title: "邀请 5 人 · 赢 Pro",
    subtitle: "7 天内邀请 5 位直推好友 · 免费得 NexionBox Pro($899)。",
    ribbon: "团队挑战",
    emoji: "🎁",
    tint: "#C6FF3A",
    reward: "免费 NexionBox Pro",
    progress: { current: 2, total: 5, label: "已邀请好友" },
    countdown: "6d 02h",
    joined: true,
    ctaLabel: "查看进度",
    trackable: true,
    done: false,
    rewardNEX: 200,
    useHref: "/pages/me/wallet-nex",
  },
  {
    id: "evt-weekend-double-nex",
    kind: "boost",
    status: "ongoing",
    title: "周末双倍 NEX",
    subtitle: "每周六日签到获得 2× NEX · 自动生效。",
    ribbon: "进行中",
    emoji: "💎",
    tint: "#7C5CFF",
    reward: "2× NEX",
    progress: null,
    countdown: "1d 18h",
    joined: true,
    ctaLabel: "去签到",
    href: "/pages/daily/daily",
  },
  {
    id: "evt-regional-pk",
    kind: "regional",
    status: "ongoing",
    title: "区域 PK · 赢 $20K 奖池",
    subtitle: "拉美 vs 东南亚 vs 欧盟 · 每周业绩赛。冠军区域瓜分 $20K。",
    ribbon: "第 21 周",
    emoji: "🌎",
    tint: "#FF6B35",
    reward: "瓜分 $20,000 奖池",
    progress: { current: 4_120_000, total: 8_000_000, label: "你的区域 $" },
    countdown: "2d 09h",
    joined: false,
    ctaLabel: "加入竞赛",
  },
  {
    id: "evt-spring-spin",
    kind: "wheel",
    status: "ongoing",
    title: "春季幸运转盘",
    subtitle: "每天免费抽 1 次 · 赢 NEX、USDT 和设备优惠券。",
    ribbon: "每日 · UTC 00:00 重置",
    emoji: "🎰",
    tint: "#FFC83D",
    reward: "最高 $500 USDT",
    progress: { current: 0, total: 1, label: "今日剩余抽奖" },
    countdown: "08:42:11 后重置",
    joined: false,
    ctaLabel: "立即抽奖",
  },
  {
    id: "evt-reinvest-bonus",
    kind: "boost",
    status: "ongoing",
    title: "复投奖励周",
    subtitle: "复投 $100 = 2 张创世抽奖券(平时 1 张) · 本周全程有效。",
    ribbon: "双倍",
    emoji: "🔄",
    tint: "#9077FF",
    reward: "创世抽奖券 ×2",
    progress: null,
    countdown: "4d 03h",
    joined: false,
    ctaLabel: "立即复投",
  },
  {
    id: "evt-onboarding-7d",
    kind: "onboarding",
    status: "ongoing",
    title: "新飞行员 · 7 天加速",
    subtitle: "加入后 7 天内达到 V2 · 获得 +200 NEX + 1 张连续保护卡。",
    ribbon: "首周",
    emoji: "🚀",
    tint: "#C6FF3A",
    reward: "+200 NEX + 1 张保护卡",
    progress: { current: 1, total: 4, label: "已完成里程碑" },
    countdown: "5d 11h",
    joined: true,
    ctaLabel: "查看清单",
    trackable: true,
    done: false,
    rewardNEX: 200,
    useHref: "/pages/me/wallet-nex",
  },
  {
    id: "evt-black-friday",
    kind: "seasonal",
    status: "upcoming",
    title: "黑五 · 全场 8 折",
    subtitle: "全部硬件立减 $300+ · 优惠码 BF20 可叠加 Pro 限时升级。",
    ribbon: "预热",
    emoji: "🛍",
    tint: "#FF6B35",
    reward: "8 折 + 可叠加优惠码",
    progress: null,
    startsIn: "12 天 04 小时后开始",
    joined: false,
    ctaLabel: "提醒我",
  },
  {
    id: "evt-nex-holders-share",
    kind: "holding",
    status: "ongoing",
    title: "NEX 持有人分红 · $5K 奖池",
    subtitle: "持有 ≥ 1,000 NEX 满 7 天 · 自动瓜分 $5K USDT 奖池。",
    ribbon: "自动加入",
    emoji: "💰",
    tint: "#C6FF3A",
    reward: "瓜分 $5,000 USDT",
    progress: { current: 1240, total: 1000, label: "你的 NEX" },
    countdown: "4d 17h",
    joined: true,
    ctaLabel: "查看详情",
    trackable: true,
    done: true,
    rewardNEX: 120,
    useHref: "/pages/me/wallet-nex",
  },
  {
    id: "evt-anniversary-spin",
    kind: "wheel",
    status: "ended",
    title: "周年超级转盘",
    subtitle: "平台一周年 · 10,000 位中奖者分享 $250K USDT。",
    ribbon: "已结束",
    emoji: "🎉",
    tint: "#5F6A7E",
    reward: "$250,000 已发放",
    progress: null,
    joined: true,
    ctaLabel: "查看结果",
  },
];

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  discount: "限时折扣",
  referral: "邀请赚钱",
  wheel: "幸运转盘",
  regional: "区域 PK",
  boost: "奖励加速",
  seasonal: "季节活动",
  holding: "持有人奖励",
  onboarding: "新手加速",
};
