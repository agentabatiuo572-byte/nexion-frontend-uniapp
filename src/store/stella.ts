import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Ported from Nexion-prototype/lib/store/stella.ts (zustand → Pinia).
 * Stella · in-app AI compute advisor (design doc §6.8). All replies are
 * template-driven — no real LLM. The store holds the chat transcript, an unread
 * counter, and the open/closed state for the drawer. Auto-push triggers (driven
 * from app layer) call `push()` to enqueue proactive Stella messages tied to mock
 * simulator events. Non-persisted (session transcript).
 */

export type StellaSender = "stella" | "user";

export type StellaMessageKind =
  | "welcome"
  | "market-peak"
  | "idle-compute"
  | "market-event"
  | "upgrade-nudge"
  | "risk-alert"
  | "daily-summary"
  | "user-quick"
  | "stella-reply"
  | "user-text"
  | "agent-system"   // "Routing you to a live agent…"
  | "agent-reply";   // human agent's reply

export interface StellaMessage {
  id: string;
  sender: StellaSender;
  kind: StellaMessageKind;
  text: string;        // Pre-formatted (placeholders already substituted)
  ts: number;          // epoch ms
  ctaLabel?: string;
  ctaHref?: string;
}

// Pool of fake human agent identities. One is picked the first time the user
// requests live support, then re-used for the rest of the session.
const AGENT_POOL = [
  "Sarah K.",
  "Marcus L.",
  "Yuki T.",
  "Alex R.",
  "Priya M.",
];

// ─── Live-agent idle timer (3 min auto-revert to Stella) ───
// Module-level so we can manage setTimeout outside the reactive store.
const AGENT_IDLE_TIMEOUT_MS = 3 * 60 * 1000;
let agentIdleTimerId: ReturnType<typeof setTimeout> | null = null;

function clearAgentIdleTimer() {
  if (agentIdleTimerId !== null) {
    clearTimeout(agentIdleTimerId);
    agentIdleTimerId = null;
  }
}

function scheduleAgentIdleTimer(onExpire: () => void) {
  clearAgentIdleTimer();
  agentIdleTimerId = setTimeout(() => {
    agentIdleTimerId = null;
    onExpire();
  }, AGENT_IDLE_TIMEOUT_MS);
}

let counter = 1;
function nextId(): string {
  counter += 1;
  return `m${counter}-${Date.now().toString(36)}`;
}

export const useStella = defineStore("stella", () => {
  const messages = ref<StellaMessage[]>([]);   // chronological (oldest first)
  const unread = ref(0);
  const isOpen = ref(false);
  // "stella" = normal AI advisor flow; "live-agent" = simulated human support.
  const mode = ref<"stella" | "live-agent">("stella");
  const agentName = ref<string | null>(null);
  // throttle keys → last fire timestamp (prevents same auto-push firing too often).
  const cooldowns = ref<Record<string, number>>({});

  function open() {
    isOpen.value = true;
    unread.value = 0;
  }
  function close() {
    isOpen.value = false;
  }

  function enterLiveAgent(): string {
    const name = agentName.value ?? AGENT_POOL[Math.floor(Math.random() * AGENT_POOL.length)];
    const t = Date.now();
    mode.value = "live-agent";
    agentName.value = name;
    messages.value = [
      ...messages.value,
      {
        id: nextId(),
        sender: "stella",
        kind: "agent-system",
        text:
          `📡 **Routing you to a Tier 2 human agent…**\n\n` +
          `Avg wait: ~3 minutes · Available in: English, 中文, العربية`,
        ts: t,
      },
    ];
    // Simulated agent intro after a short delay
    setTimeout(() => {
      messages.value = [
        ...messages.value,
        {
          id: nextId(),
          sender: "stella",
          kind: "agent-reply",
          text:
            `Hi, I'm **${name}** from Nexion Compliance Support. ` +
            `I see you've reached out — what can I help you with today?`,
          ts: Date.now(),
        },
      ];
      unread.value = isOpen.value ? 0 : unread.value + 1;
      // After the intro lands, start the 3-min idle clock.
      scheduleAgentIdleTimer(() => exitLiveAgent());
    }, 2200);
    return name;
  }

  function exitLiveAgent() {
    clearAgentIdleTimer();
    mode.value = "stella";
    messages.value = [
      ...messages.value,
      {
        id: nextId(),
        sender: "stella",
        kind: "agent-system",
        text: `Session ended. Nova is back online — type or tap a chip below to continue.`,
        ts: Date.now(),
      },
    ];
  }

  function push(
    msg: Omit<StellaMessage, "id" | "ts" | "sender">,
    opts?: { cooldownKey?: string; cooldownMs?: number },
  ): boolean {
    // When handed off to a live agent, AI auto-push channels are silenced.
    if (mode.value === "live-agent") return false;
    const t = Date.now();
    if (opts?.cooldownKey) {
      const last = cooldowns.value[opts.cooldownKey] ?? 0;
      const cooldown = opts.cooldownMs ?? 60_000;
      if (t - last < cooldown) return false;
    }
    messages.value = [
      ...messages.value,
      { ...msg, id: nextId(), ts: t, sender: "stella" },
    ];
    unread.value = isOpen.value ? 0 : unread.value + 1;
    if (opts?.cooldownKey) {
      cooldowns.value = { ...cooldowns.value, [opts.cooldownKey]: t };
    }
    return true;
  }

  function pushAgentReply(text: string) {
    // Live-agent reply path — bypasses the push gate, resets idle clock.
    messages.value = [
      ...messages.value,
      { id: nextId(), sender: "stella", kind: "agent-reply", text, ts: Date.now() },
    ];
    unread.value = isOpen.value ? 0 : unread.value + 1;
    scheduleAgentIdleTimer(() => exitLiveAgent());
  }

  function sendUser(text: string, kind: StellaMessageKind = "user-text") {
    const t = Date.now();
    messages.value = [
      ...messages.value,
      { id: nextId(), sender: "user", kind, text, ts: t },
    ];
    // User is active in live-agent mode → reset the 3-min idle timer.
    if (mode.value === "live-agent") {
      scheduleAgentIdleTimer(() => exitLiveAgent());
    }
  }

  function reset() {
    clearAgentIdleTimer();
    messages.value = [];
    unread.value = 0;
    cooldowns.value = {};
    mode.value = "stella";
    agentName.value = null;
  }

  return {
    messages, unread, isOpen, mode, agentName, cooldowns,
    open, close, enterLiveAgent, exitLiveAgent, push, pushAgentReply, sendUser, reset,
  };
});

// ─── Live-agent reply templates ───
// Cycled in order so the conversation has a sense of progression.
const AGENT_REPLIES: string[] = [
  `Thanks for sharing that. I'm pulling up your account now — give me a moment.`,
  `I see your account is on **Tier L2** with KYC-Express verified. For account-specific issues, can you share the transaction ID or the time the issue happened?`,
  `Good question. Based on what you've described, I'd recommend opening a formal ticket via **Settings → Support**. That gets routed to our Tier 3 specialists within 4 business hours.`,
  `I understand the frustration. Our compliance team reviews withdrawal flags within 24h — I can mark your case as **priority** on this conversation. Would that help?`,
  `Marked. Reference **CS-${Date.now().toString(36).slice(-6).toUpperCase()}** — you'll get an email within 12h. Is there anything else you need from me before I close this session?`,
];

export function agentReplyForIndex(i: number): string {
  return AGENT_REPLIES[i % AGENT_REPLIES.length];
}
