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
  { id: "basics", label: "入门", color: "#C6FF3A", emoji: "🚀" },
  { id: "earn", label: "赚取", color: "#FFC83D", emoji: "⚡" },
  { id: "team", label: "团队", color: "#7C5CFF", emoji: "🧬" },
  { id: "wealth", label: "财富", color: "#FF6B35", emoji: "💎" },
  { id: "security", label: "安全", color: "#3A8DFF", emoji: "🛡" },
];

export const LESSONS: Lesson[] = [
  {
    id: "l-001",
    category: "basics",
    format: "video",
    title: "什么是 Nexion · 5 分钟速成课",
    subtitle: "普通设备如何支撑全球去中心化 AI 算力网络。",
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
    title: "你的第一台设备 · 手机、NexionBox 和 Rack 怎么选",
    subtitle: "硬件档位解释 · 找到适合目标的方案。",
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
    title: "回本率计算器演示",
    subtitle: "动手估算:60 秒算出 12 个月回报。",
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
    title: "提升每日收益 · 高峰时段 + AI Drop 警报",
    subtitle: "为什么 UTC 14:00–22:00 收益更高 · 如何抓住需求高峰。",
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
    title: "工作负载计价入门 · 从 SDXL 到 LLM 70B",
    subtitle: "按 token、图片、秒计费 · 看懂你的设备怎么赚钱。",
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
    title: "为什么设备有时赚 NEX 而不是 USDT",
    subtitle: "双引擎收益 · 流动性模式与代币模式说明。",
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
    title: "邀请好友 · 网络为什么会持续付你收益",
    subtitle: "直推版税 + 网络收益奖金,随网络增长自动叠加。",
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
    title: "7 分钟看懂平衡匹配",
    subtitle: "A 轨 / B 轨 · 弱侧匹配每日最高 $5K。",
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
    title: "V 级阶梯 · 从 V0 学员到 V12 奇点",
    subtitle: "晋级条件 · 奖励 · 全球领导池投票。",
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
    title: "四档锁仓 · 30 天到 365 天怎么选",
    subtitle: "年化取舍 · 提前赎回罚金 · 空投倍率。",
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
    title: "创世节点深度课 · 1,000 个永久席位",
    subtitle: "节点持有人如何永久分享平台成交额的 0.1%。",
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
    title: "复投加速 · 让 $100 叠出三层奖励",
    subtitle: "35% 年化 + 抽奖券 + 培育奖 1.5×。",
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
    title: "KYC-Express · 为什么触发,如何通过",
    subtitle: "90 秒快速流程 · 解释 $100 终身阈值。",
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
    title: "加固账户 · 2FA、硬件钱包、防钓鱼",
    subtitle: "花 5 分钟设置,以后会省很多麻烦。",
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
    title: "Nexion 如何证明算力 · TEE 证明 + 收据",
    subtitle: "算力证明收据 · 为什么每个任务都可验证。",
    emoji: "📜",
    tint: "#3A8DFF",
    durationMin: 8,
    rewardNEX: 25,
    level: 3,
    progress: 0,
  },
];

export const FORMAT_LABEL: Record<LearnFormat, string> = {
  video: "视频",
  article: "文章",
  interactive: "实操",
};
