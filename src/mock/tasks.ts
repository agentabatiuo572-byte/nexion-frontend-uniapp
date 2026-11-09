// AI workload task templates per design doc §5.2.4 / §7.1 / §7.2.
// Each tick the simulator picks a template, picks a model variant,
// picks a client from the AI roster (§7.5), and assigns to a device.
//
// VRAM gating (P0-3, 2026-05-15): each model variant declares minVRAM.
// pickRandomTask(maxVram) filters templates+models to those that fit.

import type { CurrentTask, TaskCategory } from "../store/types";
import { TASK_CATEGORY_LABEL } from "../store/types";
import { pickClientFor } from "./ai-clients";

interface ModelVariant {
  name: string;
  minVRAM: number; // GB
}

export interface TaskTemplate {
  category: TaskCategory;
  models: ModelVariant[];
  // Duration window in seconds.
  minSec: number;
  maxSec: number;
  // Reward window in USDT for one job.
  // Tuned to match doc §7.1 unit prices × typical batch sizes.
  minReward: number;
  maxReward: number;
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    category: "IG",
    models: [
      { name: "SDXL Turbo 512²", minVRAM: 4 },   // v3.2 mobile
      { name: "SDXL Lightning", minVRAM: 6 },
      { name: "SDXL 1.0 base", minVRAM: 8 },
      { name: "Flux.1 [schnell]", minVRAM: 12 },
      { name: "Pixart-Σ XL", minVRAM: 12 },
      { name: "Flux.1 [dev]", minVRAM: 16 },
    ],
    minSec: 30,
    maxSec: 180,
    minReward: 0.0001,  // mobile tier seed
    maxReward: 0.045,
  },
  {
    category: "VG",
    models: [
      { name: "Luma Dream Machine", minVRAM: 16 },
      { name: "Runway Gen-3 Alpha", minVRAM: 24 },
      { name: "Kling 2.0", minVRAM: 24 },
      { name: "Sora-class", minVRAM: 80 },
    ],
    minSec: 60,
    maxSec: 360,
    minReward: 0.45,
    maxReward: 1.8,
  },
  {
    category: "LL",
    models: [
      { name: "Phi-3-mini", minVRAM: 4 },          // v3.2 mobile
      { name: "Llama 3.2 1B", minVRAM: 4 },        // v3.2 mobile
      { name: "Llama 3.2 3B", minVRAM: 6 },        // v3.2 mobile
      { name: "Llama 3.1 8B", minVRAM: 10 },
      { name: "Mistral Large 2", minVRAM: 24 },
      { name: "Mixtral 8×22B", minVRAM: 48 },
      { name: "Llama 3.1 70B", minVRAM: 48 },
      { name: "Qwen 2.5 72B", minVRAM: 48 },
      { name: "Llama 3.1 405B", minVRAM: 200 },
    ],
    minSec: 30,
    maxSec: 480,
    minReward: 0.00005,  // mobile tier seed
    maxReward: 0.85,
  },
  {
    category: "FT",
    models: [
      { name: "QLoRA · Mistral 7B", minVRAM: 16 },
      { name: "LoRA · SDXL base", minVRAM: 16 },
      { name: "LoRA · Flux.1 [dev]", minVRAM: 24 },
      { name: "LoRA · Llama 3.1 8B", minVRAM: 24 },
      { name: "DPO · Llama 3.1 70B", minVRAM: 80 },
    ],
    minSec: 480,
    maxSec: 1800,
    minReward: 0.06,
    maxReward: 0.42,
  },
  {
    category: "EM",
    models: [
      { name: "MobileBERT", minVRAM: 4 },              // v3.2 mobile
      { name: "nomic-embed-text-mobile", minVRAM: 4 }, // v3.2 mobile
      { name: "nomic-embed-text-v1.5", minVRAM: 4 },
      { name: "bge-large-en-v1.5", minVRAM: 6 },
      { name: "text-embedding-3-large", minVRAM: 8 },
      { name: "jina-embeddings-v3", minVRAM: 8 },
    ],
    minSec: 60,
    maxSec: 900,
    minReward: 0.00001,  // mobile tier seed
    maxReward: 0.09,
  },
  {
    category: "SP",
    models: [
      { name: "Whisper-tiny", minVRAM: 4 },            // v3.2 mobile
      { name: "Whisper-base", minVRAM: 4 },            // v3.2 mobile
      { name: "Whisper-v3 turbo", minVRAM: 4 },
      { name: "Whisper-v3 large", minVRAM: 8 },
      { name: "F5-TTS", minVRAM: 8 },
      { name: "XTTS-v2", minVRAM: 8 },
      { name: "Bark TTS", minVRAM: 12 },
    ],
    minSec: 30,
    maxSec: 240,
    minReward: 0.00005,  // mobile tier seed
    maxReward: 0.072,
  },
];

// Counter is global so all task IDs across the session are monotonically
// increasing — gives the UI a "live job stream" feel.
let taskCounter = 78234;
function nextTaskNumber(): number {
  taskCounter += 1;
  return taskCounter;
}

// Pick a task that fits within maxVram. If maxVram is undefined or 0
// (e.g. cloud-share), no filtering applied (fallback to any task).
export function pickRandomTask(maxVram?: number): CurrentTask {
  const eligible =
    maxVram && maxVram > 0
      ? TASK_TEMPLATES.map((tpl) => ({
          tpl,
          models: tpl.models.filter((m) => m.minVRAM <= maxVram),
        })).filter((e) => e.models.length > 0)
      : TASK_TEMPLATES.map((tpl) => ({ tpl, models: tpl.models }));

  if (eligible.length === 0) {
    // Should never happen: even 4GB GPUs fit Whisper turbo / nomic-embed.
    // Fall back to any task to avoid crashing the device card.
    return buildTask(TASK_TEMPLATES[0], TASK_TEMPLATES[0].models[0]);
  }

  const pick = eligible[Math.floor(Math.random() * eligible.length)];
  const model = pick.models[Math.floor(Math.random() * pick.models.length)];
  return buildTask(pick.tpl, model);
}

function buildTask(tpl: TaskTemplate, model: ModelVariant): CurrentTask {
  const totalSec = tpl.minSec + Math.random() * (tpl.maxSec - tpl.minSec);
  const reward =
    tpl.minReward + Math.random() * (tpl.maxReward - tpl.minReward);
  const client = pickClientFor(tpl.category);
  return {
    id: `${tpl.category}-A${nextTaskNumber()}`,
    category: tpl.category,
    type: TASK_CATEGORY_LABEL[tpl.category],
    model: model.name,
    client: client.name,
    location: `${client.city}, ${client.country}`,
    totalSec: Math.round(totalSec),
    startedAt: Date.now(),
    reward: +reward.toFixed(3),
  };
}
