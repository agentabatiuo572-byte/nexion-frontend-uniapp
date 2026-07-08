// 15 fictitious AI clients per design doc §7.5.
// Used as task source / receipt signer / hub label across the prototype.
// Each client has a fixed mock 0x address (will be displayed on Proof-of-Compute
// receipts in §6.9, P0-4).

import type { TaskCategory } from "../store/types";

export interface AIClient {
  id: string;
  name: string;
  tagline: string;
  city: string;
  country: string; // ISO code for flag display
  workloads: TaskCategory[];
  // Mock EVM-style address — for Proof-of-Compute receipt display only.
  // Not real, no private key, no on-chain footprint.
  address: string;
}

export const AI_CLIENTS: AIClient[] = [
  {
    id: "mosaic",
    name: "Mosaic Studios",
    tagline: "面向独立创作者的生成式图像",
    city: "柏林",
    country: "DE",
    workloads: ["IG"],
    address: "0x4f7a2c8e9b1d3f5a6c8e0b2d4f6a8c0e2b4d6f8a",
  },
  {
    id: "atrium",
    name: "Atrium AI",
    tagline: "按需生成电影级 AI 视频",
    city: "洛杉矶",
    country: "US",
    workloads: ["VG"],
    address: "0x2b9f4e6a8c1d3f5b7e9a2c4d6f8b0e2a4c6d8f0b",
  },
  {
    id: "helix",
    name: "Helix Labs",
    tagline: "开源 LLM 推理服务",
    city: "旧金山",
    country: "US",
    workloads: ["LL"],
    address: "0x7c2b9a4e8f3c1d6e0a5b8d2f4c7e1a3b5d7f9c1e",
  },
  {
    id: "conduit",
    name: "Conduit AI",
    tagline: "基础模型 API 网关",
    city: "首尔",
    country: "KR",
    workloads: ["LL"],
    address: "0x1a3c5e7f9b2d4a6c8e0f2b4d6a8c0e2f4b6d8a0c",
  },
  {
    id: "northwind",
    name: "Northwind Research",
    tagline: "开放研究与公开权重",
    city: "多伦多",
    country: "CA",
    workloads: ["FT", "LL"],
    address: "0x9e1d7c5b3a8f6e4d2c1b0a9f8e7d6c5b4a3f2e1d",
  },
  {
    id: "tuneforge",
    name: "TuneForge",
    tagline: "24 小时定制微调",
    city: "特拉维夫",
    country: "IL",
    workloads: ["FT"],
    address: "0x6b8d0a2c4e6f8b1d3a5c7e9f2b4d6a8c0e2f4b6d",
  },
  {
    id: "vector",
    name: "Vector Foundry",
    tagline: "RAG 向量嵌入基础设施",
    city: "新加坡",
    country: "SG",
    workloads: ["EM"],
    address: "0x3f5b7d9a1c3e5f7b9d2a4c6e8f1b3d5a7c9e1f3b",
  },
  {
    id: "soundgrid",
    name: "Soundgrid",
    tagline: "大规模语音转文本",
    city: "斯德哥尔摩",
    country: "SE",
    workloads: ["SP"],
    address: "0x8c0e2a4f6b8d1c3e5a7f9b2d4c6e8a1f3b5d7c9e",
  },
  {
    id: "voxlane",
    name: "VoxLane",
    tagline: "产品内实时语音能力",
    city: "东京",
    country: "JP",
    workloads: ["SP"],
    address: "0x5d7f9b1a3c5e7f9b2d4a6c8e0f2b4d6a8c1e3f5b",
  },
  {
    id: "framecraft",
    name: "FrameCraft",
    tagline: "电影 AI 辅助后期制作",
    city: "温哥华",
    country: "CA",
    workloads: ["VG", "IG"],
    address: "0x0a2c4e6f8b1d3a5c7e9f2b4d6a8c0e2f4b6d8a0c",
  },
  {
    id: "vertex",
    name: "Vertex Vision",
    tagline: "面向零售的计算机视觉 API",
    city: "阿姆斯特丹",
    country: "NL",
    workloads: ["IG", "EM"],
    address: "0x4e6f8b0a2c4d6e8f1b3a5c7d9e2f4a6c8b0d2e4f",
  },
  {
    id: "pinnacle",
    name: "Pinnacle ML",
    tagline: "企业 ML 模型托管",
    city: "伦敦",
    country: "GB",
    workloads: ["LL"],
    address: "0xa1c3e5f7b9d2a4c6e8f1b3d5a7c9e1f3b5d7a9c1",
  },
  {
    id: "loom",
    name: "Loom Intelligence",
    tagline: "文档理解智能体",
    city: "班加罗尔",
    country: "IN",
    workloads: ["EM", "LL"],
    address: "0xb3d5a7c9e1f3b5d7a9c1e3f5b7d9a1c3e5f7b9d2",
  },
  {
    id: "glasswing",
    name: "Glasswing AI",
    tagline: "面向无障碍场景的多模态智能体",
    city: "都柏林",
    country: "IE",
    workloads: ["LL", "SP", "IG"],
    address: "0xc5e7f9b1d3a5c7e9f2b4d6a8c0e2f4b6d8a0c2e4",
  },
  {
    id: "cobalt",
    name: "Cobalt Compute",
    tagline: "面向 AI 初创公司的算力聚合",
    city: "苏黎世",
    country: "CH",
    // Cobalt is the meta-aggregator client — accepts any workload (§7.5)
    workloads: ["IG", "VG", "LL", "FT", "EM", "SP"],
    address: "0xd7a9c1e3f5b7d9a1c3e5f7b9d2a4c6e8f1b3d5a7",
  },
  // ───── v3.2 mobile AI clients ─────
  {
    id: "pocket-studios",
    name: "Pocket Studios",
    tagline: "面向移动优先应用的端侧 AI",
    city: "柏林",
    country: "DE",
    workloads: ["IG"],
    address: "0xe9f1b3d5a7c9e1f3b5d7a9c1e3f5b7d9a2c4e6f8",
  },
  {
    id: "echo-earbuds",
    name: "Echo Earbuds",
    tagline: "无线音频实时翻译",
    city: "深圳",
    country: "CN",
    workloads: ["SP"],
    address: "0xf1b3d5a7c9e1f3b5d7a9c1e3f5b7d9a2c4e6f8b0",
  },
];

// Pick a client whose workloads include the given task category.
// Falls back to Cobalt (the universal aggregator) if no specialist matches.
export function pickClientFor(category: TaskCategory): AIClient {
  const candidates = AI_CLIENTS.filter((c) => c.workloads.includes(category));
  if (candidates.length === 0) {
    return AI_CLIENTS.find((c) => c.id === "cobalt")!;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function getClientById(id: string): AIClient | undefined {
  return AI_CLIENTS.find((c) => c.id === id);
}
