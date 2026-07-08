// Support Tickets mock data. Ported from Nexion-prototype/lib/mock/tickets.ts
// (pure data, zero framework deps, backend-replaceable). Replicates real-platform
// support portals. STATUS_COLOR uses v5 design tokens (theme-aware) instead of the
// source's literal hex so colours invert correctly across light/dark.

export type TicketStatus = "open" | "in_progress" | "pending_user" | "resolved" | "closed";

export type TicketCategory =
  | "account"
  | "withdrawal"
  | "deposit"
  | "kyc"
  | "hardware"
  | "earnings"
  | "genesis"
  | "technical"
  | "other";

export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface TicketMessage {
  ts: number;
  author: "user" | "agent";
  agentName?: string;
  body: string;
}

export interface Ticket {
  id: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: number;
  updatedAt: number;
  lastReplyAt: number;
  unread: number;
  owner: string;
  messages: TicketMessage[];
}

const DAY = 86400_000;
const HOUR = 3600_000;
const NOW = Date.now();

export const TICKETS: Ticket[] = [
  {
    id: "TK-1024",
    subject: "提现超过 24 小时仍在处理中",
    category: "withdrawal",
    status: "open",
    priority: "high",
    createdAt: NOW - 1.5 * DAY,
    updatedAt: NOW - 4 * HOUR,
    lastReplyAt: NOW - 4 * HOUR,
    unread: 2,
    owner: "Marina K.",
    messages: [
      { ts: NOW - 1.5 * DAY, author: "user", body: "你好,我昨天 UTC 14:20 申请了 $250 USDT 提现,现在仍显示「处理中」。交易哈希应该是 0xab12... 能帮我查一下状态吗?" },
      { ts: NOW - 1.4 * DAY, author: "agent", agentName: "Marina K.", body: "你好!我已升级给支付团队处理,他们会在 4 小时内核验链上状态。参考编号 #PD-7723。" },
      { ts: NOW - 6 * HOUR, author: "agent", agentName: "Marina K.", body: "更新:支付团队确认是 TRC20 网络拥堵延迟。你的交易排在约 4,200 笔队列之后,预计 8-12 小时入账。到账时会推送通知。" },
      { ts: NOW - 4 * HOUR, author: "agent", agentName: "Marina K.", body: "快速确认一下:USDT 是否已到你的钱包?如果还没有,我们可以发起手动重放。" },
    ],
  },
  {
    id: "TK-1023",
    subject: "KYC 资料被拒,原因是什么?",
    category: "kyc",
    status: "pending_user",
    priority: "normal",
    createdAt: NOW - 2 * DAY,
    updatedAt: NOW - 9 * HOUR,
    lastReplyAt: NOW - 9 * HOUR,
    unread: 1,
    owner: "Tomas R.",
    messages: [
      { ts: NOW - 2 * DAY, author: "user", body: "刚收到「KYC 被拒」,但没有显示原因。我的护照有效期到 2031 年。" },
      { ts: NOW - 9 * HOUR, author: "agent", agentName: "Tomas R.", body: "我查到了,拒绝原因是「照片模糊,MRZ 机读区不可读」。请在光线更好的环境重新上传,确保证件底部两行清晰可见。Sumsub 链接已重置,24 小时内还有 3 次重试机会。" },
    ],
  },
  {
    id: "TK-1019",
    subject: "NexionBox Pro 升级 v3.4 固件后离线",
    category: "hardware",
    status: "in_progress",
    priority: "high",
    createdAt: NOW - 3 * DAY,
    updatedAt: NOW - 1 * DAY,
    lastReplyAt: NOW - 1 * DAY,
    unread: 0,
    owner: "Hiro T.",
    messages: [
      { ts: NOW - 3 * DAY, author: "user", body: "v3.4 固件推送后,我的 NexionBox Pro 离线且无法重新连接。指示灯一直按黄-黄-红闪烁。" },
      { ts: NOW - 2.9 * DAY, author: "agent", agentName: "Hiro T.", body: "黄-黄-红表示升级后 WiFi 认证失败,3.4 后较常见。快速修复:长按电源键 10 秒重置,再通过 App 重新配对。如果仍失败,我们会免费寄送替换设备。" },
      { ts: NOW - 2 * DAY, author: "user", body: "重置成功了,但现在收益只有正常水平的 60%。" },
      { ts: NOW - 1 * DAY, author: "agent", agentName: "Hiro T.", body: "检测到热降频,你的设备比基线高 12°C。可能是进风口积尘。我们会免费寄一套清洁工具(预计 4 天到),应可恢复满速。" },
    ],
  },
  {
    id: "TK-1011",
    subject: "新手机无法登录",
    category: "account",
    status: "resolved",
    priority: "normal",
    createdAt: NOW - 7 * DAY,
    updatedAt: NOW - 5 * DAY,
    lastReplyAt: NOW - 5 * DAY,
    unread: 0,
    owner: "Sara L.",
    messages: [
      { ts: NOW - 7 * DAY, author: "user", body: "换了新手机后无法登录,2FA 验证码不匹配。" },
      { ts: NOW - 6.9 * DAY, author: "agent", agentName: "Sara L.", body: "更换手机会使旧的 TOTP 密钥失效。我已启动恢复流程,请查看邮箱中的视频验证链接。完成真人面部匹配后,我们会在 15 分钟内重置 2FA。" },
      { ts: NOW - 5 * DAY, author: "user", body: "已经恢复了,谢谢!" },
    ],
  },
  {
    id: "TK-1007",
    subject: "未收到创世节点 #4192",
    category: "genesis",
    status: "closed",
    priority: "urgent",
    createdAt: NOW - 12 * DAY,
    updatedAt: NOW - 10 * DAY,
    lastReplyAt: NOW - 10 * DAY,
    unread: 0,
    owner: "Carlos M.",
    messages: [
      { ts: NOW - 12 * DAY, author: "user", body: "两天前购买了创世节点 #4192,交易已确认,但 NFT 没进钱包。" },
      { ts: NOW - 11.9 * DAY, author: "agent", agentName: "Carlos M.", body: "已确认你的购买。5 月 8 日铸造队列积压,我已把你的订单提升优先级,最迟 6 小时内到账。" },
      { ts: NOW - 10 * DAY, author: "user", body: "已收到,没问题了。" },
    ],
  },
  {
    id: "TK-1003",
    subject: "需要 2025 报税发票",
    category: "account",
    status: "resolved",
    priority: "low",
    createdAt: NOW - 18 * DAY,
    updatedAt: NOW - 16 * DAY,
    lastReplyAt: NOW - 17.9 * DAY,
    unread: 0,
    owner: "Aisha O.",
    messages: [
      { ts: NOW - 18 * DAY, author: "user", body: "我能获取一份年度收益报表用于报税吗?" },
      { ts: NOW - 17.9 * DAY, author: "agent", agentName: "Aisha O.", body: "可以,请进入 /me/wallet/bills,使用右上角的年终 PDF 导出。我也已私信你一份面向非美国用户的 1099-MISC 等效表。" },
    ],
  },
  {
    id: "TK-0998",
    subject: "地区变更后收益暂停",
    category: "earnings",
    status: "closed",
    priority: "normal",
    createdAt: NOW - 24 * DAY,
    updatedAt: NOW - 22 * DAY,
    lastReplyAt: NOW - 23.9 * DAY,
    unread: 0,
    owner: "Yuki H.",
    messages: [
      { ts: NOW - 24 * DAY, author: "user", body: "我从菲律宾搬到日本后,收益一夜之间变成 0。" },
      { ts: NOW - 23.9 * DAY, author: "agent", agentName: "Yuki H.", body: "地区变更会暂停收益,用于重新核验税务辖区。通常需要 24-48 小时。你的收益已恢复,2 小时内会看到补发。" },
    ],
  },
];

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  account: "账户",
  withdrawal: "提现",
  deposit: "充值",
  kyc: "KYC",
  hardware: "硬件",
  earnings: "收益",
  genesis: "创世",
  technical: "技术",
  other: "其他",
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "待处理",
  in_progress: "处理中",
  pending_user: "等待你回复",
  resolved: "已解决",
  closed: "已关闭",
};

// Mapped to v5 design tokens (theme-aware) — source used literal hex.
export const STATUS_COLOR: Record<TicketStatus, string> = {
  open: "var(--v5-warning)",
  in_progress: "var(--v5-tech-cyan)",
  pending_user: "var(--v5-brand-2)",
  resolved: "var(--v5-brand)",
  closed: "var(--v5-ink-4)",
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "低",
  normal: "普通",
  high: "高",
  urgent: "紧急",
};
