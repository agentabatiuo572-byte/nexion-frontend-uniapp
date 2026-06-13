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
    subject: "Withdrawal pending more than 24 hours",
    category: "withdrawal",
    status: "open",
    priority: "high",
    createdAt: NOW - 1.5 * DAY,
    updatedAt: NOW - 4 * HOUR,
    lastReplyAt: NOW - 4 * HOUR,
    unread: 2,
    owner: "Marina K.",
    messages: [
      { ts: NOW - 1.5 * DAY, author: "user", body: "Hi, I requested a $250 USDT withdrawal yesterday at 14:20 UTC and it's still showing 'pending'. Tx hash should be 0xab12... Can you check status?" },
      { ts: NOW - 1.4 * DAY, author: "agent", agentName: "Marina K.", body: "Hi! I've escalated this to our payment desk — they'll verify the on-chain status within 4 hours. Reference #PD-7723." },
      { ts: NOW - 6 * HOUR, author: "agent", agentName: "Marina K.", body: "Update: payment desk found a TRC20 network congestion delay. Your tx is queued behind 4,200 others. ETA 8-12h. You'll get a push notification when it lands." },
      { ts: NOW - 4 * HOUR, author: "agent", agentName: "Marina K.", body: "Quick check — has the USDT arrived in your wallet yet? If not we can issue a manual replay." },
    ],
  },
  {
    id: "TK-1023",
    subject: "KYC documents rejected — what's wrong?",
    category: "kyc",
    status: "pending_user",
    priority: "normal",
    createdAt: NOW - 2 * DAY,
    updatedAt: NOW - 9 * HOUR,
    lastReplyAt: NOW - 9 * HOUR,
    unread: 1,
    owner: "Tomas R.",
    messages: [
      { ts: NOW - 2 * DAY, author: "user", body: "Just got 'KYC rejected' but no reason was shown. My passport is valid through 2031." },
      { ts: NOW - 9 * HOUR, author: "agent", agentName: "Tomas R.", body: "Looked it up — the rejection reason was 'blurry photo, MRZ unreadable'. Please re-upload with better lighting and the bottom 2 lines clearly visible. Sumsub link reset, you have 3 retries left in 24h." },
    ],
  },
  {
    id: "TK-1019",
    subject: "NexionBox Pro disconnected after firmware v3.4",
    category: "hardware",
    status: "in_progress",
    priority: "high",
    createdAt: NOW - 3 * DAY,
    updatedAt: NOW - 1 * DAY,
    lastReplyAt: NOW - 1 * DAY,
    unread: 0,
    owner: "Hiro T.",
    messages: [
      { ts: NOW - 3 * DAY, author: "user", body: "After the v3.4 firmware push my NexionBox Pro went offline and won't reconnect. LEDs flash amber-amber-red repeatedly." },
      { ts: NOW - 2.9 * DAY, author: "agent", agentName: "Hiro T.", body: "Amber-amber-red = WiFi auth failure post-update. Common after 3.4. Quick fix: hold power button 10s to reset, then re-pair via app. If that fails, we'll ship a replacement free of charge." },
      { ts: NOW - 2 * DAY, author: "user", body: "Reset worked but it's only earning 60% of normal rate now." },
      { ts: NOW - 1 * DAY, author: "agent", agentName: "Hiro T.", body: "Detected a thermal throttle — your unit is 12°C above baseline. Could be dust in the intake. We're shipping you a free cleaning kit (ETA 4d). Should restore full rate." },
    ],
  },
  {
    id: "TK-1011",
    subject: "Cannot login from my new phone",
    category: "account",
    status: "resolved",
    priority: "normal",
    createdAt: NOW - 7 * DAY,
    updatedAt: NOW - 5 * DAY,
    lastReplyAt: NOW - 5 * DAY,
    unread: 0,
    owner: "Sara L.",
    messages: [
      { ts: NOW - 7 * DAY, author: "user", body: "Got a new phone, can't login — 2FA codes don't match." },
      { ts: NOW - 6.9 * DAY, author: "agent", agentName: "Sara L.", body: "Phone changes invalidate the old TOTP secret. I've started recovery — check your email for a video verification link. After live face-match we'll reset 2FA in 15 min." },
      { ts: NOW - 5 * DAY, author: "user", body: "All good, recovered. Thanks!" },
    ],
  },
  {
    id: "TK-1007",
    subject: "Genesis Node #4192 not received",
    category: "genesis",
    status: "closed",
    priority: "urgent",
    createdAt: NOW - 12 * DAY,
    updatedAt: NOW - 10 * DAY,
    lastReplyAt: NOW - 10 * DAY,
    unread: 0,
    owner: "Carlos M.",
    messages: [
      { ts: NOW - 12 * DAY, author: "user", body: "Purchased Genesis Node #4192 two days ago, tx confirmed but NFT not in wallet." },
      { ts: NOW - 11.9 * DAY, author: "agent", agentName: "Carlos M.", body: "Confirmed your purchase. Mint queue had a backlog on May 8. I'm bumping yours to priority — should arrive in 6 hours max." },
      { ts: NOW - 10 * DAY, author: "user", body: "Received, all good." },
    ],
  },
  {
    id: "TK-1003",
    subject: "Need invoice for 2025 tax filing",
    category: "account",
    status: "resolved",
    priority: "low",
    createdAt: NOW - 18 * DAY,
    updatedAt: NOW - 16 * DAY,
    lastReplyAt: NOW - 17.9 * DAY,
    unread: 0,
    owner: "Aisha O.",
    messages: [
      { ts: NOW - 18 * DAY, author: "user", body: "Can I get a yearly earnings statement for tax purposes?" },
      { ts: NOW - 17.9 * DAY, author: "agent", agentName: "Aisha O.", body: "Sure — go to /me/wallet/bills and use the year-end PDF export at the top right. I've also DM-ed you a Form 1099-MISC-equivalent for non-US users." },
    ],
  },
  {
    id: "TK-0998",
    subject: "Earnings paused after region change",
    category: "earnings",
    status: "closed",
    priority: "normal",
    createdAt: NOW - 24 * DAY,
    updatedAt: NOW - 22 * DAY,
    lastReplyAt: NOW - 23.9 * DAY,
    unread: 0,
    owner: "Yuki H.",
    messages: [
      { ts: NOW - 24 * DAY, author: "user", body: "Moved from PH to JP — earnings dropped to zero overnight." },
      { ts: NOW - 23.9 * DAY, author: "agent", agentName: "Yuki H.", body: "Region changes pause earnings while we re-verify tax jurisdiction. Took 24-48h normally. Resumed yours now — you'll see backfill in 2h." },
    ],
  },
];

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  account: "Account",
  withdrawal: "Withdrawal",
  deposit: "Deposit",
  kyc: "KYC",
  hardware: "Hardware",
  earnings: "Earnings",
  genesis: "Genesis",
  technical: "Technical",
  other: "Other",
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  pending_user: "Awaiting you",
  resolved: "Resolved",
  closed: "Closed",
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
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};
