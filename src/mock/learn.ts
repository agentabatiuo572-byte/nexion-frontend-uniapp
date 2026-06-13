/**
 * Learn / Academy mock — ported from Nexion-prototype/lib/mock/learn.ts.
 *
 * Courses, lessons, learn-to-earn NEX rewards. MOCK-ONLY; production:
 * GET /api/learn/lessons + per-user progress overlay.
 *
 * Category tint hex below are the source's literal lesson-tint palette
 * (per-lesson accent, used in color-mix / linear-gradient at runtime). They
 * are data values (not theme tokens) and never substitute the v5 tokens used
 * for surfaces/text. Kept verbatim so the lesson accents match the prototype.
 */

export type LearnCategory = "basics" | "earn" | "team" | "wealth" | "security";

export type LearnFormat = "video" | "article" | "interactive";

export interface Lesson {
  id: string;
  category: LearnCategory;
  format: LearnFormat;
  title: string;
  subtitle: string;
  emoji: string;
  tint: string;
  /** Estimated time in minutes */
  durationMin: number;
  /** Learn-to-earn reward (NEX) */
  rewardNEX: number;
  /** Difficulty 1-3 */
  level: 1 | 2 | 3;
  /** Progress percentage 0..100; 100 means completed */
  progress: number;
  /** Is featured / pinned on Hero */
  featured?: boolean;
  href?: string;
}

export const CATEGORIES: Array<{ id: LearnCategory; label: string; color: string; emoji: string }> = [
  { id: "basics", label: "Basics", color: "#C6FF3A", emoji: "🚀" },
  { id: "earn", label: "Earn", color: "#FFC83D", emoji: "⚡" },
  { id: "team", label: "Team", color: "#7C5CFF", emoji: "🧬" },
  { id: "wealth", label: "Wealth", color: "#FF6B35", emoji: "💎" },
  { id: "security", label: "Security", color: "#3A8DFF", emoji: "🛡" },
];

export const LESSONS: Lesson[] = [
  {
    id: "l-001",
    category: "basics",
    format: "video",
    title: "What is Nexion · The 5-minute crash course",
    subtitle: "How everyday devices power the largest decentralized AI compute network.",
    emoji: "🚀",
    tint: "#C6FF3A",
    durationMin: 5,
    rewardNEX: 20,
    level: 1,
    progress: 100,
    featured: true,
  },
  {
    id: "l-002",
    category: "basics",
    format: "article",
    title: "Your first device · Phone vs NexionBox vs Rack",
    subtitle: "Hardware tiers explained · which one fits your goals.",
    emoji: "📱",
    tint: "#C6FF3A",
    durationMin: 7,
    rewardNEX: 15,
    level: 1,
    progress: 45,
  },
  {
    id: "l-003",
    category: "basics",
    format: "interactive",
    title: "ROI Calculator walkthrough",
    subtitle: "Hands-on: estimate your 12-month return in 60 seconds.",
    emoji: "🧮",
    tint: "#C6FF3A",
    durationMin: 4,
    rewardNEX: 10,
    level: 1,
    progress: 0,
  },
  {
    id: "l-101",
    category: "earn",
    format: "article",
    title: "Maximize daily yield · Peak hours + AI Drop alerts",
    subtitle: "Why 14:00–22:00 UTC pays more · how to surf demand spikes.",
    emoji: "⚡",
    tint: "#FFC83D",
    durationMin: 6,
    rewardNEX: 15,
    level: 2,
    progress: 0,
  },
  {
    id: "l-102",
    category: "earn",
    format: "video",
    title: "Workload pricing 101 · From SDXL to LLM 70B",
    subtitle: "Per-token, per-image, per-second — what your fleet earns.",
    emoji: "💵",
    tint: "#FFC83D",
    durationMin: 8,
    rewardNEX: 25,
    level: 2,
    progress: 0,
  },
  {
    id: "l-103",
    category: "earn",
    format: "article",
    title: "Why your fleet sometimes earns NEX instead of USDT",
    subtitle: "Dual-engine yield · liquidity mode vs token mode explained.",
    emoji: "🔀",
    tint: "#FFC83D",
    durationMin: 5,
    rewardNEX: 15,
    level: 2,
    progress: 0,
  },
  {
    id: "l-201",
    category: "team",
    format: "article",
    title: "Inviting friends · How your network keeps paying you",
    subtitle: "Direct Royalty on your invites + Network Yield Bonus as your network grows.",
    emoji: "🌐",
    tint: "#7C5CFF",
    durationMin: 6,
    rewardNEX: 20,
    level: 2,
    progress: 100,
  },
  {
    id: "l-202",
    category: "team",
    format: "video",
    title: "Balance Match explained in 7 minutes",
    subtitle: "Track A / Track B · balanced-side match capped at $5K/day.",
    emoji: "🪞",
    tint: "#7C5CFF",
    durationMin: 7,
    rewardNEX: 30,
    level: 3,
    progress: 30,
  },
  {
    id: "l-203",
    category: "team",
    format: "article",
    title: "V-Rank ladder · From V0 Cadet to V12 Singularity",
    subtitle: "Promotion criteria · prizes · global leadership pool votes.",
    emoji: "🎖",
    tint: "#7C5CFF",
    durationMin: 9,
    rewardNEX: 35,
    level: 3,
    progress: 0,
  },
  {
    id: "l-301",
    category: "wealth",
    format: "article",
    title: "Staking 4-tier · 30d to 365d, when to lock?",
    subtitle: "APY tradeoffs · early-withdraw penalties · airdrop multipliers.",
    emoji: "🔒",
    tint: "#FF6B35",
    durationMin: 7,
    rewardNEX: 25,
    level: 2,
    progress: 0,
  },
  {
    id: "l-302",
    category: "wealth",
    format: "interactive",
    title: "Genesis Node deep-dive · the 1,000-seat permanent share",
    subtitle: "How node holders collect 0.1% of platform volume forever.",
    emoji: "👑",
    tint: "#FF6B35",
    durationMin: 10,
    rewardNEX: 50,
    level: 3,
    progress: 0,
  },
  {
    id: "l-303",
    category: "wealth",
    format: "article",
    title: "Re-invest Boost · turn $100 into 4 layered rewards",
    subtitle: "35% APY + points + raffle + cultivation 1.5×.",
    emoji: "🔄",
    tint: "#FF6B35",
    durationMin: 6,
    rewardNEX: 20,
    level: 2,
    progress: 0,
  },
  {
    id: "l-401",
    category: "security",
    format: "article",
    title: "KYC-Express · why it triggers and how to clear it",
    subtitle: "Quick 90-second flow · $100 lifetime threshold explained.",
    emoji: "🪪",
    tint: "#3A8DFF",
    durationMin: 4,
    rewardNEX: 10,
    level: 1,
    progress: 0,
  },
  {
    id: "l-402",
    category: "security",
    format: "video",
    title: "Lock down your account · 2FA, hardware wallet, anti-phishing",
    subtitle: "5 minutes you'll thank yourself for later.",
    emoji: "🛡",
    tint: "#3A8DFF",
    durationMin: 6,
    rewardNEX: 20,
    level: 1,
    progress: 0,
  },
  {
    id: "l-403",
    category: "security",
    format: "article",
    title: "How Nexion proves compute · TEE attestations + receipts",
    subtitle: "Proof-of-Compute receipts · why every job is verifiable.",
    emoji: "📜",
    tint: "#3A8DFF",
    durationMin: 8,
    rewardNEX: 25,
    level: 3,
    progress: 0,
  },
];

export const FORMAT_LABEL: Record<LearnFormat, string> = {
  video: "Video",
  article: "Article",
  interactive: "Hands-on",
};
