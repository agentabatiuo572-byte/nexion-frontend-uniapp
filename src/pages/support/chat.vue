<!--
  Conversation chat — full-screen thread for one conversation. Bare full-screen
  (own header + ConversationThread), NOT wrapped in AppChassis: a focused chat wants
  no tabbar / nova bubble, and its own flex column (header + scrolling messages +
  pinned input) would fight the chassis scroll container.

  query ?type=ai     → backed by the nova store (Nova): quick chips + handoff pill.
  query ?cid=<id>    → backed by the conversations store (advisor / support).

  A separate route (vs in-page state) means each open gets a fresh onLoad, sidestepping
  the H5 same-page hash-query staleness (P-044/P-049). Bare text in <text> (P-026).
-->
<template>
  <view class="cp-root">
    <!-- Simulated device status bar (preview shell only) — bare page draws its own. -->
    <DeviceStatusBar />

    <!-- Header -->
    <view class="cp-head" :style="{ paddingTop: statusBarHeight + 10 + 'px' }">
      <view class="cp-back active:opacity-60" role="button" tabindex="0" :aria-label="t.conversations.back" @click="goBack">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </view>

      <NovaAvatar v-if="isAi" :size="40" pulse />
      <view v-else class="cp-ava" :style="avaStyle">
        <view v-html="headerIcon" />
      </view>

      <view class="cp-meta">
        <text class="cp-name">{{ headerName }}</text>
        <view class="cp-role">
          <view class="cp-dot" :style="{ background: headerTint }" />
          <text class="cp-role-t">{{ headerRole }}</text>
        </view>
      </view>

      <view v-if="isAi && supportConvId" class="cp-pill active:opacity-80" role="button" tabindex="0" :aria-label="t.nova.liveAgent" @click="toSupport">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><path d="M21 16a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM3 16a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z" /></svg>
        <text class="cp-pill-t">{{ t.nova.liveAgent }}</text>
      </view>
    </view>

    <!-- Thread body (messages + chips + input) -->
    <ConversationThread
      :messages="threadMessages"
      :input-placeholder="inputPlaceholder"
      :quick-chips="quickChips"
      :empty-hint="emptyHint"
      :typing="agentTyping"
      :typing-label="t.conversations.agentTyping"
      :reveal-tick="revealTick"
      @send="onSend"
      @chip="onChip"
      @cta="onCta"
    />

    <!-- Overlay host — this is a bare full-screen page (no AppChassis), so it must
         carry its own GlobalUi or toast/confirm/netError raised here (e.g. the send
         rate-limit warning) would post to the store with nothing rendering them. -->
    <GlobalUi />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, type CSSProperties } from "vue";
import { onLoad, onUnload, onShow, onHide } from "@dcloudio/uni-app";
import NovaAvatar from "@/components/nova/nova-avatar.vue";
import ConversationThread from "@/components/support/conversation-thread.vue";
import GlobalUi from "@/components/global-ui.vue";
import DeviceStatusBar from "@/components/device/device-status-bar.vue";
import type { ThreadMsg, QuickChip } from "@/components/support/thread-types";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { navTo, navBack } from "@/lib/route";
import { createSendLimiter } from "@/lib/send-limiter";
import { h5DevicePreviewStatusBarHeight } from "@/lib/device-preview";
import { useConversations } from "@/store/conversations";
import { useNova } from "@/store/nova";
import { useApp } from "@/store/app";
import { toast } from "@/store/ui";
import { replyToQuickPrompt, type QuickPromptKey } from "@/mock/nova-templates";

const t = useT();
const convStore = useConversations();
const nova = useNova();
const app = useApp();

const cid = ref("");
const isAi = ref(false);

// Bare full-screen page (no AppChassis), so it must reserve the device status-bar
// space itself. Match the chassis source (real device height, else the H5
// device-preview simulated height) — env(safe-area-inset-top) is 0 inside the H5
// shell iframe, which left the header tucked under the simulated status bar.
const statusBarHeight = computed(() => {
  try {
    return uni.getSystemInfoSync().statusBarHeight || h5DevicePreviewStatusBarHeight();
  } catch {
    return h5DevicePreviewStatusBarHeight();
  }
});
// Bumped on every re-reveal so the thread re-pins to the newest message. uni H5
// navigateTo pushes a keep-alive page and hides it with display:none (zeroing the
// inner list's scrollTop); on navigateBack the page is re-shown, not re-mounted,
// so neither onMounted nor the messages/typing watch fires — without this the list
// would sit stuck at the top after any forward-then-back (P1: "messages vanished").
const revealTick = ref(0);

onLoad((q) => {
  if (q?.type === "ai") {
    isAi.value = true;
    return;
  }
  if (typeof q?.cid === "string") {
    cid.value = q.cid;
  }
});

// onShow/onHide track the hidden-but-alive state that onUnload/onUnmounted miss.
// onShow fires on first open AND on navigateBack re-reveal; onHide fires when a
// forward navigateTo hides this page. Managing Nova's open flag here (not only in
// cleanup) fixes the unread-suppression bug: leaving the AI chat forward used to
// leave isOpen=true forever, so every later proactive push silently zeroed unread.
onShow(() => {
  revealTick.value += 1;
  if (isAi.value) nova.open(); // mark Nova as being viewed → clears + tracks unread
  else if (cid.value) convStore.open(cid.value);
});
onHide(() => {
  if (isAi.value) nova.close(); // no longer viewing Nova → later pushes accrue unread
});

const ADVISOR_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4" /><path d="M6 21a6 6 0 0 1 12 0" /></svg>`;
const SUPPORT_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><path d="M21 16a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM3 16a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z" /></svg>`;

const conv = computed(() => (cid.value ? convStore.get(cid.value) : undefined));

const headerName = computed(() => (isAi.value ? t.value.nova.name : conv.value?.agentName ?? ""));
const agentTyping = computed(() =>
  isAi.value ? nova.typing : (cid.value ? convStore.typingIds[cid.value] === true : false),
);
const headerRole = computed(() => {
  if (agentTyping.value) return t.value.conversations.agentTyping;
  if (isAi.value) return t.value.conversations.roleAi;
  return conv.value ? t.value.conversations[conv.value.roleKey] : "";
});
const headerTint = computed(() =>
  isAi.value ? "var(--v5-brand-2)" : conv.value?.avatarTint ?? "var(--v5-tech-cyan)",
);
const headerIcon = computed(() => (conv.value?.type === "advisor" ? ADVISOR_ICON : SUPPORT_ICON));
const avaStyle = computed<CSSProperties>(() => ({
  color: headerTint.value,
  background: `color-mix(in srgb, ${headerTint.value} 14%, transparent)`,
}));

const inputPlaceholder = computed(() =>
  isAi.value ? t.value.nova.inputPlaceholder : t.value.conversations.inputPlaceholder,
);
const emptyHint = computed(() => (isAi.value ? t.value.nova.emptyHint : ""));

const quickChips = computed<QuickChip[]>(() =>
  isAi.value
    ? [
        { key: "explain-today", emoji: "📈", label: t.value.nova.qExplainToday },
        { key: "how-to-boost", emoji: "🎯", label: t.value.nova.qHowToBoost },
        { key: "whats-hot", emoji: "🔥", label: t.value.nova.qWhatsHot },
        { key: "show-top-jobs", emoji: "💎", label: t.value.nova.qShowTopJobs },
      ]
    : [],
);

// Receipt shown on the LAST user-sent message only (iMessage convention — keeps
// the column quiet while still answering "did they see it?").
function receiptFor(status: "sent" | "read" | undefined, isLastUserMsg: boolean): string | undefined {
  if (!status || !isLastUserMsg) return undefined;
  return status === "read" ? t.value.conversations.receiptRead : t.value.conversations.receiptSent;
}

const threadMessages = computed<ThreadMsg[]>(() => {
  if (isAi.value) {
    const msgs = nova.messages;
    const lastUser = msgs.map((m) => m.sender).lastIndexOf("user");
    return msgs.map((m, i) => ({
      id: m.id,
      side: m.sender === "user" ? "right" : "left",
      tone: m.sender === "user" ? "user" : "agent",
      text: m.text,
      receipt: receiptFor(m.status, i === lastUser),
      ctaLabel: m.ctaLabel,
      ctaHref: m.ctaHref,
    }));
  }
  const c = conv.value;
  if (!c) return [];
  const lastUser = c.messages.map((m) => m.sender).lastIndexOf("user");
  return c.messages.map((m, i) => ({
    id: m.id,
    side: m.sender === "user" ? "right" : "left",
    tone: m.sender === "user" ? "user" : "agent",
    text: m.textKey ? fmt(t.value.conversations.seed[m.textKey], { name: c.agentName }) : m.text ?? "",
    receipt: receiptFor(m.status, i === lastUser),
    ctaLabel: m.ctaKey ? t.value.conversations.cta[m.ctaKey] : undefined,
    ctaHref: m.ctaHref,
  }));
});

// Handoff target: first support conversation (Nova "Human support" pill).
const supportConvId = computed(() => convStore.byType("support")[0]?.id ?? "");
function toSupport() {
  navTo(supportConvId.value ? "/pages/support/chat?cid=" + supportConvId.value : "/pages/support/messages");
}

function quickLabel(k: QuickPromptKey): string {
  switch (k) {
    case "explain-today": return t.value.nova.qExplainToday;
    case "how-to-boost": return t.value.nova.qHowToBoost;
    case "whats-hot": return t.value.nova.qWhatsHot;
    case "show-top-jobs": return t.value.nova.qShowTopJobs;
  }
}

// One-shot reply timers — tracked so they can be cancelled if the user leaves the
// chat before the reply lands. Otherwise a ghost reply posts to the singleton store
// after unmount; for AI it would also bump unread once isOpen is reset below.
const pendingTimers: ReturnType<typeof setTimeout>[] = [];
function schedule(fn: () => void, ms: number) {
  pendingTimers.push(setTimeout(fn, ms));
}
function cleanup() {
  pendingTimers.forEach(clearTimeout);
  pendingTimers.length = 0;
  // Cancelled timers would otherwise leave a ghost "typing…" flag on the store
  // (it bleeds into the list preview) — always drop it on the way out.
  if (cid.value) convStore.setTyping(cid.value, false);
  nova.setTyping(false);
  // Reset Nova's open flag (the AI chat page acted as the "open" view). Without this
  // isOpen stays true forever and every future proactive push would silently zero
  // unread → the bubble would never surface Nova news again after one AI visit.
  if (isAi.value) nova.close();
}
onUnload(cleanup);
onUnmounted(cleanup);

// ── send rate limit — anti-spam guard across every channel of this chat
// (advisor / support / AI free text, incl. quick chips). A real backend answers
// 429 + Retry-After with the same policy; the limiter mirrors that contract.
const SEND_MAX = 5; // max sends…
const SEND_WINDOW_MS = 15_000; // …per rolling window
const sendLimiter = createSendLimiter(SEND_MAX, SEND_WINDOW_MS);

function acquireSendSlot(): boolean {
  const verdict = sendLimiter.tryAcquire();
  if (!verdict.ok) {
    toast.warn(
      t.value.conversations.rateLimited,
      fmt(t.value.conversations.rateLimitedRetry, { n: verdict.retryInSec }),
    );
  }
  return verdict.ok;
}

// Reply choreography (ms after send): agent reads → types → answers.
const READ_MS = 500;
const TYPING_ON_MS = 800;
const REPLY_MS = 2000;
const AI_TYPING_ON_MS = 300;
const AI_REPLY_MS = 1100;

function onSend(text: string) {
  if (!acquireSendSlot()) return;
  if (isAi.value) {
    nova.sendUser(text);
    nova.markUserRead(); // Nova reads instantly
    schedule(() => nova.setTyping(true), AI_TYPING_ON_MS);
    schedule(() => {
      nova.setTyping(false);
      nova.push({ kind: "nova-reply", text: t.value.conversations.aiFreeFormReply });
    }, AI_REPLY_MS);
    return;
  }
  const id = cid.value;
  if (!id) return;
  convStore.sendUser(id, text);
  schedule(() => convStore.markUserRead(id), READ_MS);
  schedule(() => convStore.setTyping(id, true), TYPING_ON_MS);
  schedule(() => {
    convStore.setTyping(id, false);
    convStore.pushAgentReply(id);
  }, REPLY_MS);
}

function onChip(key: string) {
  if (!acquireSendSlot()) return;
  const k = key as QuickPromptKey;
  const onlineCount = app.visibleDevices.filter((d) => d.status === "online" && d.activatedAt !== null).length;
  nova.sendUser(quickLabel(k), "user-quick");
  nova.markUserRead();
  schedule(() => nova.setTyping(true), AI_TYPING_ON_MS);
  schedule(() => {
    nova.setTyping(false);
    nova.push(replyToQuickPrompt(k, { earningsToday: app.earnings.today, devices: app.visibleDevices, onlineCount }));
  }, AI_REPLY_MS);
}

function onCta(href: string) {
  navTo(href);
}

function goBack() {
  navBack("/pages/support/messages");
}
</script>

<style scoped>
.cp-root {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--v5-bg);
}
.cp-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px 12px;
  /* top padding is bound inline to the device status-bar height (see cp-head :style) */
  border-bottom: 1px solid var(--v5-border);
}
.cp-back {
  width: 36px;
  height: 36px;
  margin-left: -6px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.cp-ava {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.cp-meta {
  flex: 1;
  min-width: 0;
}
.cp-name {
  display: block;
  font-family: var(--font-v5);
  font-weight: 600;
  font-size: 14px;
  letter-spacing: -0.008em;
  color: var(--v5-ink);
}
.cp-role {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}
.cp-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  animation: mc-pulse 1.6s ease-in-out infinite;
}
.cp-role-t {
  font-size: 11.5px;
  color: var(--v5-ink-3);
}
.cp-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  flex-shrink: 0;
  background: var(--v5-brand-2-soft);
}
.cp-pill-t {
  font-family: var(--font-v5);
  font-weight: 500;
  font-size: 12.5px;
  color: var(--v5-brand-2);
}
</style>
