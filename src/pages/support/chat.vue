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
    <!-- Header -->
    <view class="cp-head">
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
      @send="onSend"
      @chip="onChip"
      @cta="onCta"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, type CSSProperties } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import NovaAvatar from "@/components/nova/nova-avatar.vue";
import ConversationThread from "@/components/support/conversation-thread.vue";
import type { ThreadMsg, QuickChip } from "@/components/support/thread-types";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { navTo, navBack } from "@/lib/route";
import { useConversations } from "@/store/conversations";
import { useNova } from "@/store/nova";
import { useApp } from "@/store/app";
import { replyToQuickPrompt, type QuickPromptKey } from "@/mock/nova-templates";

const t = useT();
const convStore = useConversations();
const nova = useNova();
const app = useApp();

const cid = ref("");
const isAi = ref(false);

onLoad((q) => {
  if (q?.type === "ai") {
    isAi.value = true;
    nova.open(); // clears Nova unread
    return;
  }
  if (typeof q?.cid === "string") {
    cid.value = q.cid;
    convStore.open(q.cid); // clears this conversation's unread
  }
});

const ADVISOR_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4" /><path d="M6 21a6 6 0 0 1 12 0" /></svg>`;
const SUPPORT_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><path d="M21 16a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM3 16a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z" /></svg>`;

const conv = computed(() => (cid.value ? convStore.get(cid.value) : undefined));

const headerName = computed(() => (isAi.value ? t.value.nova.name : conv.value?.agentName ?? ""));
const headerRole = computed(() => {
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

const threadMessages = computed<ThreadMsg[]>(() => {
  if (isAi.value) {
    return nova.messages.map((m) => ({
      id: m.id,
      side: m.sender === "user" ? "right" : "left",
      tone: m.sender === "user" ? "user" : "agent",
      text: m.text,
      ctaLabel: m.ctaLabel,
      ctaHref: m.ctaHref,
    }));
  }
  const c = conv.value;
  if (!c) return [];
  return c.messages.map((m) => ({
    id: m.id,
    side: m.sender === "user" ? "right" : "left",
    tone: m.sender === "user" ? "user" : "agent",
    text: m.textKey ? fmt(t.value.conversations.seed[m.textKey], { name: c.agentName }) : m.text ?? "",
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
  // Reset Nova's open flag (the AI chat page acted as the "open" view). Without this
  // isOpen stays true forever and every future proactive push would silently zero
  // unread → the bubble would never surface Nova news again after one AI visit.
  if (isAi.value) nova.close();
}
onUnload(cleanup);
onUnmounted(cleanup);

function onSend(text: string) {
  if (isAi.value) {
    nova.sendUser(text);
    schedule(() => {
      nova.push({ kind: "nova-reply", text: t.value.conversations.aiFreeFormReply });
    }, 500);
    return;
  }
  const id = cid.value;
  if (!id) return;
  convStore.sendUser(id, text);
  schedule(() => convStore.pushAgentReply(id), 1400);
}

function onChip(key: string) {
  const k = key as QuickPromptKey;
  const onlineCount = app.visibleDevices.filter((d) => d.status === "online" && d.activatedAt !== null).length;
  nova.sendUser(quickLabel(k), "user-quick");
  schedule(() => {
    nova.push(replyToQuickPrompt(k, { earningsToday: app.earnings.today, devices: app.visibleDevices, onlineCount }));
  }, 600);
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
  padding-top: calc(env(safe-area-inset-top) + 10px);
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
