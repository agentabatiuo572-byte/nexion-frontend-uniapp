// Stella (Nova) reply + push templates — focused port of
// Nexion-prototype/lib/mock/stella-templates.ts (design doc §6.8).
//
// NOT LLM-generated. Each function takes an app-state snapshot and returns a
// pre-formatted message string. Ported subset: the welcome push + the 4
// quick-prompt replies the drawer offers. ctaHref keeps the prototype's
// logical web path; the drawer maps it to a uni route at tap time.

import type { StellaMessage } from "@/store/stella";
import type { Device } from "@/store/types";
import { getLockedTeasers } from "./tasks";

export type QuickPromptKey =
  | "explain-today"
  | "how-to-boost"
  | "whats-hot"
  | "show-top-jobs";

type PushBody = Omit<StellaMessage, "id" | "ts" | "sender">;

// ───── Reply builders (user quick-prompt → Stella reply) ─────

export function replyToQuickPrompt(
  key: QuickPromptKey,
  ctx: { earningsToday: number; devices: Device[]; onlineCount: number },
): PushBody {
  switch (key) {
    case "explain-today": {
      const top = topDevice(ctx.devices);
      const topLine = top
        ? `Top earner: **${top.name}** (${top.gpu}) at $${top.todayEarnings.toFixed(2)} today.`
        : "No active devices yet — connect one to start earning.";
      return {
        kind: "stella-reply",
        text:
          `You've earned **$${ctx.earningsToday.toFixed(2)}** so far today across ` +
          `${ctx.onlineCount} active device${ctx.onlineCount === 1 ? "" : "s"}.\n\n` +
          `${topLine}\n\n` +
          `Most of your jobs ran on the Image Gen + Speech pools — typical for your VRAM tier. ` +
          `Want me to explain how to unlock LLM Inference?`,
      };
    }
    case "how-to-boost": {
      const maxVram = Math.max(0, ...ctx.devices.map((d) => d.vramTotal));
      const teaser = getLockedTeasers(maxVram, 1)[0];
      if (teaser) {
        return {
          kind: "stella-reply",
          text:
            `Three quick wins:\n\n` +
            `1. Keep at least one device online overnight — the LLM pool peaks 02:00-06:00 UTC.\n` +
            `2. Your current rig caps at **${maxVram}GB VRAM**. Upgrading to **${teaser.unlockTier}** ` +
            `unlocks **${teaser.model}** (${teaser.type}) — a single job pays ${teaser.rewardHint}.\n` +
            `3. Refer a friend with the code in /team — you earn 5% of their lifetime payouts.`,
          ctaLabel: "Browse Store →",
          ctaHref: "/store",
        };
      }
      return {
        kind: "stella-reply",
        text:
          `You already run the highest tier — nice. Two ways to scale further:\n\n` +
          `1. Add a second NexionBox to handle parallel fine-tune jobs.\n` +
          `2. Push referrals via /team — your tier earns 8% lifetime split on each referral.`,
        ctaLabel: "Open Team →",
        ctaHref: "/team",
      };
    }
    case "whats-hot": {
      const events = [
        {
          text:
            `🔥 **LLM Inference** prices jumped **+18%** in the last hour after Anthropic's ` +
            `Claude 4.6 launch. Demand surge expected through tonight.`,
        },
        {
          text:
            `📈 **Video Gen** tier seeing 2.4× normal volume — Atrium AI is running a campaign ` +
            `render today. Throughput-bound, well-paying.`,
        },
        {
          text:
            `💎 **Fine-tune** queue depth at **812 jobs** (vs 280 baseline). High-VRAM devices ` +
            `getting first pick. AI Premium pool at +30% of standard rate.`,
        },
      ];
      return {
        kind: "stella-reply",
        text: events[Math.floor(Math.random() * events.length)].text,
        ctaLabel: "Open Market →",
        ctaHref: "/earn",
      };
    }
    case "show-top-jobs": {
      const maxVram = Math.max(0, ...ctx.devices.map((d) => d.vramTotal));
      const lockedTop = getLockedTeasers(maxVram, 3);
      if (lockedTop.length === 0) {
        return {
          kind: "stella-reply",
          text:
            `Right now the highest-paying open jobs in your pool:\n\n` +
            `• **Llama 3.1 405B inference** — $0.62 per 1k tokens (Helix Labs)\n` +
            `• **Sora-class video** — $1.80 per 8s clip (Atrium AI)\n` +
            `• **DPO · Llama 3.1 70B fine-tune** — $0.42 per job (Northwind Research)\n\n` +
            `Your devices can run all of these. Routing handled automatically.`,
        };
      }
      const lines = lockedTop
        .map((t) => `• **${t.model}** (${t.type}) — ${t.rewardHint} · needs ${t.unlockTier}`)
        .join("\n");
      return {
        kind: "stella-reply",
        text:
          `Top jobs above your current VRAM cap (${maxVram}GB):\n\n${lines}\n\n` +
          `Each unlocks once you upgrade — let me know when you're ready.`,
        ctaLabel: "Browse Store →",
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
      `Hey — I'm **Nova**, your compute advisor. I'll watch the market and ping you ` +
      `when there's an opportunity to earn more.\n\nTry the chips below to start.`,
    ctaLabel: "Browse Store →",
    ctaHref: "/store",
  };
}
