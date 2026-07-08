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
    q: "Nexion 具体是做什么的?",
    a: "Nexion 会把企业客户的闲置 AI 任务(图像生成、LLM 推理、向量嵌入等)分发到全球消费级设备网络,包括你的手机或 NexionBox。客户按推理付费,平台用 USDT 结算到你的钱包。",
  },
  {
    id: "gs-2",
    category: "getting-started",
    q: "我的手机真的在跑 AI 任务吗?",
    a: "手机的 NPU(Apple Neural Engine、Snapdragon Hexagon 等)会在后台处理轻量推理任务,并且只会在充电、联网、温度安全时接单。更重的任务会分配给 NexionBox 等硬件档位。",
  },
  {
    id: "gs-3",
    category: "getting-started",
    q: "如何激活手机算力?",
    a: "打开引导流程第 3 步,开启 Nexion Compute。Nova 会在约 10 秒内推送第一条任务。",
  },
  // Earnings
  {
    id: "er-1",
    category: "earnings",
    q: "收益是怎么计算的?",
    a: "每个完成的 AI 任务都会按市场设定的 token、图片或任务单价结算。你可以在收据页查看每条 Proof-of-Compute 的毛收益。",
  },
  {
    id: "er-2",
    category: "earnings",
    q: "为什么我的收益比较低?",
    a: "移动 NPU 的收益本来就较低,约 $0.06/天。NexionBox S1、Pro、Rack P1 等硬件档位可承接微调、405B LLM 推理等更重任务,日收益约为手机的 117×-750×。",
  },
  {
    id: "er-3",
    category: "earnings",
    q: "收益什么时候结算?",
    a: "任务完成即结算,每日 00:00 UTC 汇总。USDT 余额达到 $20 且完成 KYC-Express 后,你可以随时提现。",
  },
  // Devices
  {
    id: "dv-1",
    category: "devices",
    q: "可以添加多台设备吗?",
    a: "每个账号最多 6 台设备。你可以组合手机和不同档位的 NexionBox。设备离线超过 24 小时会重置连续在线加成。",
  },
  {
    id: "dv-2",
    category: "devices",
    q: "S1、Pro 和 Rack P1 有什么区别?",
    a: "S1(4× RTX 4090)适合标准图像生成和 7B LLM。Pro(8× RTX 4090)可承接微调任务。Rack P1(8× A100、640GB 显存)可承接 405B LLM 和视频生成任务,约 $45/天。",
  },
  {
    id: "dv-3",
    category: "devices",
    q: "NexionBox 托管在哪里?",
    a: "设备托管在新加坡数据中心(亚太客户)和法兰克福数据中心(EMEA)。你不需要寄送或维护硬件,平台会代为运营。",
  },
  // Payments
  {
    id: "py-1",
    category: "payments",
    q: "为什么 KYC-Express 需要 $1?",
    a: "这是 $1 USDT 微额验证,用于通过加密方式证明钱包归属。根据监管要求(MiCA Art. 22、FATF Travel Rule),每个钱包需完成一次。该 $1 会立即计入你的余额。",
  },
  {
    id: "py-2",
    category: "payments",
    q: "可以通过哪些网络提现?",
    a: "支持 USDT-TRC20(最快,$1 手续费)、USDT-ERC20(手续费随 gas 约 $8-18)、BTC、ETH。最低提现金额为 $20。",
  },
  {
    id: "py-3",
    category: "payments",
    q: "为什么提现还在处理中?",
    a: "流程包括合规审核(≤30 分钟)、批量结算(≤2 小时)、链上广播(≤30 分钟)。端到端 SLA 为 24 小时。ERC20 遇到 mempool 拥堵时可能延长。",
  },
  // Technical
  {
    id: "tc-1",
    category: "technical",
    q: "我的数据安全吗?",
    a: "推理任务在分发前会匿名化。你的设备只会看到模型权重和提示词,不会看到客户身份。所有客户端连接均使用端到端 TLS 1.3。",
  },
  {
    id: "tc-2",
    category: "technical",
    q: "设备在任务中途崩溃怎么办?",
    a: "任务会在 8 秒内自动重新分配到其他节点。未完成的任务不会扣你的收益,客户侧也不会感知切换。",
  },
  {
    id: "tc-3",
    category: "technical",
    q: "Nexion 有 API 吗?",
    a: "企业合作方可通过开发者页申请 API 访问权限。普通用户账号仅使用 H5 应用。",
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
