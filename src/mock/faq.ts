// FAQ corpus used by /me/help. Ported from Nexion-prototype/lib/mock/faq.ts
// (pure data, zero framework deps, backend-replaceable).

export type FaqCategory = "getting-started" | "earnings" | "devices" | "payments" | "technical";

export interface FaqItem {
  id: string;
  category: FaqCategory;
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  // Getting started
  {
    id: "gs-1",
    category: "getting-started",
    q: "What exactly does Nexion do?",
    a: "Nexion routes idle AI workloads (image gen, LLM inference, embedding, etc.) from enterprise clients to a global mesh of consumer devices — your phone or a NexionBox. Clients pay per inference; we settle to your wallet in USDT.",
  },
  {
    id: "gs-2",
    category: "getting-started",
    q: "Is my phone really doing AI work?",
    a: "Your phone's NPU (Apple Neural Engine, Snapdragon Hexagon, etc.) handles small inference jobs in the background — only when charging, on Wi-Fi, and above your battery threshold. Heavier jobs stream to NexionBox tiers.",
  },
  {
    id: "gs-3",
    category: "getting-started",
    q: "How do I activate my phone?",
    a: "Open Onboarding · Step 3 and toggle Activate Nexion Compute. Nova will push your first job within ~10 seconds.",
  },
  // Earnings
  {
    id: "er-1",
    category: "earnings",
    q: "How are earnings calculated?",
    a: "Each completed AI job pays a per-token / per-image rate set by the marketplace. You see the gross payout on every Proof-of-Compute receipt in /me/receipts.",
  },
  {
    id: "er-2",
    category: "earnings",
    q: "Why are my earnings so low?",
    a: "Mobile NPU yields are intentionally modest (~$0.06/day). Hardware tiers (NexionBox S1, Pro, Rack P1) yield 640×–2,300× more per day because they can take heavier workloads like fine-tunes and 405B LLM inference.",
  },
  {
    id: "er-3",
    category: "earnings",
    q: "When do earnings settle?",
    a: "Settled every job; consolidated daily at 00:00 UTC. You can withdraw any time once your USDT balance ≥ $20 and KYC-Express is complete.",
  },
  // Devices
  {
    id: "dv-1",
    category: "devices",
    q: "Can I add multiple devices?",
    a: "Up to 6 devices per account. Mix and match phone + NexionBox tiers. Devices that go offline 24h+ reset their streak bonus.",
  },
  {
    id: "dv-2",
    category: "devices",
    q: "What's the difference between S1, Pro, and Rack P1?",
    a: "S1 (4× RTX 4090) handles standard image gen and 7B LLM. Pro (8× RTX 4090) adds fine-tunes. Rack P1 (8× A100, 640GB VRAM) takes premium 405B LLM and video-gen jobs at $142/day.",
  },
  {
    id: "dv-3",
    category: "devices",
    q: "Where are NexionBox units hosted?",
    a: "Singapore Data Center (Asia/PAC clients), Frankfurt DC (EMEA). You don't ship them anywhere — we operate them for you.",
  },
  // Payments
  {
    id: "py-1",
    category: "payments",
    q: "Why $1 KYC-Express?",
    a: "It's a $1 USDT micro-deposit that cryptographically proves wallet ownership. Required once per wallet, per regulator request (MiCA Art. 22, FATF Travel Rule). The $1 is credited to your balance immediately.",
  },
  {
    id: "py-2",
    category: "payments",
    q: "What networks can I withdraw on?",
    a: "USDT-TRC20 (fastest, $1 fee), USDT-ERC20 ($8–18 fee depending on gas), BTC, ETH. Min withdrawal: $20.",
  },
  {
    id: "py-3",
    category: "payments",
    q: "Why is my withdrawal still 'Processing'?",
    a: "Compliance review (≤30 min) → batch settlement (≤2h) → on-chain broadcast (≤30 min). End-to-end SLA: 24 hours. Mempool congestion may extend this for ERC20.",
  },
  // Technical
  {
    id: "tc-1",
    category: "technical",
    q: "Is my data private?",
    a: "Inference jobs are anonymised before dispatch. Your device sees model weights + prompts but never client identity. End-to-end TLS 1.3 to all clients.",
  },
  {
    id: "tc-2",
    category: "technical",
    q: "What if my device crashes mid-job?",
    a: "Job is auto-reassigned to another node within 8 seconds. You don't pay for incomplete work; clients don't notice the failover.",
  },
  {
    id: "tc-3",
    category: "technical",
    q: "Does Nexion have an API?",
    a: "Enterprise partners can request API access via /developer. Consumer accounts use the H5 app only.",
  },
];

// Canned bot replies — keyword → matching FAQ item.
export function botReply(query: string): FaqItem | null {
  const q = query.toLowerCase();
  for (const item of FAQ_ITEMS) {
    if (item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)) {
      return item;
    }
  }
  if (/withdraw|提现/.test(q)) return FAQ_ITEMS.find((f) => f.id === "py-3") ?? null;
  if (/kyc|实名/.test(q)) return FAQ_ITEMS.find((f) => f.id === "py-1") ?? null;
  if (/earn|收益|赚/.test(q)) return FAQ_ITEMS.find((f) => f.id === "er-1") ?? null;
  if (/phone|手机|npu/.test(q)) return FAQ_ITEMS.find((f) => f.id === "gs-2") ?? null;
  return null;
}
