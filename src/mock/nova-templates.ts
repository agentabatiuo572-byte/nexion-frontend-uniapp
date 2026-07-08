// Nova reply + push templates — focused port of
// Nexion-prototype/lib/mock/nova-templates.ts (design doc §6.8).
//
// NOT LLM-generated. Each function takes an app-state snapshot and returns a
// pre-formatted message string. Ported subset: the welcome push + the 4
// quick-prompt replies the drawer offers. ctaHref keeps the prototype's
// logical web path; the drawer maps it to a uni route at tap time.

import type { NovaMessage } from "@/store/nova";
import type { Device } from "@/store/types";
import { getLockedTeasers } from "./tasks";

export type QuickPromptKey =
  | "explain-today"
  | "how-to-boost"
  | "whats-hot"
  | "show-top-jobs";

type PushBody = Omit<NovaMessage, "id" | "ts" | "sender">;

// ───── Reply builders (user quick-prompt → Nova reply) ─────

export function replyToQuickPrompt(
  key: QuickPromptKey,
  ctx: { earningsToday: number; devices: Device[]; onlineCount: number },
): PushBody {
  switch (key) {
    case "explain-today": {
      const top = topDevice(ctx.devices);
      const topLine = top
        ? `今日最高收益设备:**${top.name}**(${top.gpu}),今日 $${top.todayEarnings.toFixed(2)}。`
        : "还没有活跃设备,连接一台设备即可开始赚取收益。";
      return {
        kind: "nova-reply",
        text:
          `今天到目前为止,你的 ${ctx.onlineCount} 台活跃设备共赚到 **$${ctx.earningsToday.toFixed(2)}**。\n\n` +
          `${topLine}\n\n` +
          `大部分任务来自图像生成和语音处理池,这符合你当前显存档位的典型分布。` +
          `需要我说明如何解锁 LLM 推理任务吗?`,
      };
    }
    case "how-to-boost": {
      const maxVram = Math.max(0, ...ctx.devices.map((d) => d.vramTotal));
      const teaser = getLockedTeasers(maxVram, 1)[0];
      if (teaser) {
        return {
          kind: "nova-reply",
          text:
            `三个快速提升点:\n\n` +
            `1. 至少保持一台设备整夜在线,LLM 任务池在 UTC 02:00-06:00 达到峰值。\n` +
            `2. 你当前设备上限为 **${maxVram}GB 显存**。升级到 **${teaser.unlockTier}** ` +
            `可解锁 **${teaser.model}**(${teaser.type}),单个任务收益 ${teaser.rewardHint}。\n` +
            `3. 使用团队页的邀请码邀请朋友,你可获得其终身收益的 5%。`,
          ctaLabel: "浏览商店 →",
          ctaHref: "/store",
        };
      }
      return {
        kind: "nova-reply",
        text:
          `你已经在运行最高档位。进一步放大的方式有两个:\n\n` +
          `1. 添加第二台 NexionBox,并行处理微调任务。\n` +
          `2. 通过团队页做邀请,你当前等级可获得每位邀请对象 8% 的终身分成。`,
        ctaLabel: "打开团队 →",
        ctaHref: "/team",
      };
    }
    case "whats-hot": {
      const events = [
        {
          text:
            `🔥 Anthropic Claude 4.6 发布后,**LLM 推理**价格在过去一小时上涨 **+18%**。` +
            `预计今晚需求仍会维持高位。`,
        },
        {
          text:
            `📈 **视频生成**档位当前任务量为平时 2.4×,Atrium AI 今天在跑活动渲染。` +
            `吞吐受限,单价较高。`,
        },
        {
          text:
            `💎 **模型微调**队列深度达到 **812 个任务**(基线 280)。高显存设备优先接单,` +
            `旗舰算力池价格高于标准费率 30%。`,
        },
      ];
      return {
        kind: "nova-reply",
        text: events[Math.floor(Math.random() * events.length)].text,
        ctaLabel: "打开市场 →",
        ctaHref: "/earn",
      };
    }
    case "show-top-jobs": {
      const maxVram = Math.max(0, ...ctx.devices.map((d) => d.vramTotal));
      const lockedTop = getLockedTeasers(maxVram, 3);
      if (lockedTop.length === 0) {
        return {
          kind: "nova-reply",
          text:
            `当前你可接任务池里收益最高的任务:\n\n` +
            `• **Llama 3.1 405B 推理** — 每 1k token $0.62(Helix Labs)\n` +
            `• **Sora-class 视频** — 每 8 秒片段 $1.80(Atrium AI)\n` +
            `• **DPO · Llama 3.1 70B 微调** — 每任务 $0.42(Northwind Research)\n\n` +
            `你的设备都可以运行这些任务,路由会自动处理。`,
        };
      }
      const lines = lockedTop
        .map((t) => `• **${t.model}**(${t.type}) — ${t.rewardHint} · 需要 ${t.unlockTier}`)
        .join("\n");
      return {
        kind: "nova-reply",
        text:
          `高于你当前显存上限(${maxVram}GB)的高收益任务:\n\n${lines}\n\n` +
          `这些任务在升级后即可解锁,准备好时可以进入商店选择设备。`,
        ctaLabel: "浏览商店 →",
        ctaHref: "/store",
      };
    }
  }
}

function topDevice(devices: Device[]): Device | undefined {
  const online = devices.filter((d) => d.status === "online");
  if (online.length === 0) return undefined;
  return online.reduce((best, d) => (d.todayEarnings > best.todayEarnings ? d : best));
}

// ───── Auto-push template (proactive welcome) ─────

export function welcomeMessage(): PushBody {
  return {
    kind: "welcome",
    text:
      `你好,我是 **Nova**,你的算力顾问。我会关注市场变化,在出现更高收益机会时提醒你。\n\n` +
      `可以先试试下面的快捷问题。`,
    ctaLabel: "浏览商店 →",
    ctaHref: "/store",
  };
}
