<!--
  StellaDrawer — Nova AI advisor chat panel. Ported from
  Nexion-prototype/app/components/stella/stella-drawer.tsx.
    · framer-motion slide-up  → CSS transform/opacity transition (App has no DOM)
    · lucide icons            → inline <svg stroke="currentColor"> (dual-end webview)
    · <input onChange>        → uni <input @input> reading e.detail.value (P-033)
    · **bold** + \n markdown  → split into <text> runs (bare text must be <text>, P-026)
    · auto-scroll to latest   → <scroll-view :scroll-into-view> bottom anchor
  Chassis is position:fixed inset:0 on uni (no desktop bezel), so the drawer uses
  fixed positioning to fill the device viewport.
-->
<template>
  <view v-if="isOpen" class="sd-root">
    <!-- Backdrop -->
    <view class="sd-backdrop" @click="close" />

    <!-- Panel -->
    <view class="sd-panel">
      <!-- Drag handle -->
      <view class="sd-handle-wrap"><view class="sd-handle" /></view>

      <!-- Header -->
      <view class="sd-head">
        <StellaAvatar v-if="mode === 'stella'" :size="40" pulse />
        <view v-else class="sd-agent-ava">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="10" r="3" /><path d="M7 20.7a6 6 0 0 1 10 0" /></svg>
        </view>
        <view class="sd-head-meta">
          <text class="sd-head-name">{{ mode === "stella" ? t.stella.name : (agentName || "Live agent") }}</text>
          <view class="sd-head-role">
            <view class="sd-dot" :style="{ background: mode === 'stella' ? 'var(--v5-success)' : 'var(--v5-brand-2)' }" />
            <text class="sd-head-role-t">{{ mode === "stella" ? t.stella.role : t.stella.agentRole }}</text>
          </view>
        </view>

        <view v-if="mode === 'stella'" class="sd-pill sd-pill--agent" @click="enterLiveAgent">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><path d="M21 16a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM3 16a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z" /></svg>
          <text class="sd-pill-t">{{ t.stella.liveAgent }}</text>
        </view>
        <view v-else class="sd-pill sd-pill--back" @click="exitLiveAgent">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
          <text class="sd-pill-t">{{ t.stella.backToAi }}</text>
        </view>

        <view class="sd-close" @click="close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </view>
      </view>

      <!-- Message list -->
      <scroll-view scroll-y class="sd-list" :scroll-into-view="bottomAnchor" :scroll-with-animation="true">
        <view v-if="messages.length === 0" class="sd-empty">
          <view class="sd-empty-ava"><StellaAvatar :size="56" pulse /></view>
          <text class="sd-empty-t">{{ t.stella.emptyHint }}</text>
        </view>

        <view v-for="m in messages" :key="m.id" class="sd-msg-row">
          <!-- system notice -->
          <view v-if="m.kind === 'agent-system'" class="sd-sys">
            <text class="sd-sys-t">{{ sysLabel(m.text) }}</text>
          </view>
          <!-- chat bubble -->
          <view v-else class="sd-bubble-row" :class="m.sender === 'stella' ? 'sd-left' : 'sd-right'">
            <view class="sd-bubble" :style="bubbleStyle(m)">
              <view class="sd-bubble-body">
                <view v-for="(line, li) in formatLines(m.text)" :key="li" class="sd-line">
                  <text
                    v-for="(seg, si) in line"
                    :key="si"
                    class="sd-seg"
                    :class="{ 'sd-seg--b': seg.bold }"
                    :style="{ color: segColor(m) }"
                  >{{ seg.text }}</text>
                  <text v-if="line.length === 0" class="sd-seg">{{ " " }}</text>
                </view>
              </view>
              <view v-if="m.ctaLabel && m.ctaHref" class="sd-cta-row" @click="onCta(m.ctaHref, m.ctaLabel)">
                <text class="sd-cta-t">{{ m.ctaLabel }}</text>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10" /><path d="M7 17 17 7" /></svg>
              </view>
            </view>
          </view>
        </view>
        <view :id="bottomAnchor" class="sd-bottom-anchor" />
      </scroll-view>

      <!-- Quick reply chips (stella mode only) -->
      <scroll-view v-if="mode === 'stella'" scroll-x class="sd-chips">
        <view class="sd-chips-inner">
          <view v-for="q in quickPrompts" :key="q.key" class="sd-chip" @click="handleQuickPrompt(q.key)">
            <text class="sd-chip-emoji">{{ q.emoji }}</text>
            <text class="sd-chip-t">{{ q.label }}</text>
          </view>
        </view>
      </scroll-view>

      <!-- Input row -->
      <view class="sd-input-row">
        <input
          class="sd-input"
          :value="draft"
          :placeholder="inputPlaceholder"
          placeholder-class="sd-input-ph"
          confirm-type="send"
          @input="onDraft"
          @confirm="handleSend"
        />
        <view class="sd-send" :style="sendStyle" @click="handleSend">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="draft.trim() ? 'var(--v5-on-brand)' : 'var(--v5-ink-4)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></svg>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, type CSSProperties } from "vue";
import { useStella, type StellaMessage, agentReplyForIndex } from "@/store/stella";
import { useApp } from "@/store/app";
import { useT } from "@/i18n/use-t";
import { replyToQuickPrompt, type QuickPromptKey } from "@/mock/stella-templates";
import { navTo } from "@/lib/route";
import StellaAvatar from "./stella-avatar.vue";

const t = useT();
const stella = useStella();
const app = useApp();

const isOpen = computed(() => stella.isOpen);
const messages = computed(() => stella.messages);
const mode = computed(() => stella.mode);
const agentName = computed(() => stella.agentName);

const draft = ref("");
let agentReplyIdx = 0;

function close() {
  stella.close();
}
function enterLiveAgent() {
  stella.enterLiveAgent();
}
function exitLiveAgent() {
  stella.exitLiveAgent();
}

const inputPlaceholder = computed(() =>
  mode.value === "live-agent"
    ? t.value.stella.agentInputPlaceholder.replace("{name}", agentName.value ?? "agent")
    : t.value.stella.inputPlaceholder,
);

const quickPrompts = computed<{ key: QuickPromptKey; emoji: string; label: string }[]>(() => [
  { key: "explain-today", emoji: "📈", label: t.value.stella.qExplainToday },
  { key: "how-to-boost", emoji: "🎯", label: t.value.stella.qHowToBoost },
  { key: "whats-hot", emoji: "🔥", label: t.value.stella.qWhatsHot },
  { key: "show-top-jobs", emoji: "💎", label: t.value.stella.qShowTopJobs },
]);

function onDraft(e: Event) {
  draft.value = (e as unknown as { detail: { value: string } }).detail.value;
}

function handleQuickPrompt(key: QuickPromptKey) {
  const onlineCount = app.devices.filter((d) => d.status === "online" && d.activatedAt !== null).length;
  stella.sendUser(quickLabel(key), "user-quick");
  setTimeout(() => {
    stella.push(
      replyToQuickPrompt(key, { earningsToday: app.earnings.today, devices: app.devices, onlineCount }),
    );
  }, 600);
}

function handleSend() {
  const text = draft.value.trim();
  if (!text) return;
  stella.sendUser(text);
  draft.value = "";
  setTimeout(
    () => {
      if (mode.value === "live-agent") {
        stella.pushAgentReply(agentReplyForIndex(agentReplyIdx));
        agentReplyIdx += 1;
      } else {
        stella.push({
          kind: "stella-reply",
          text:
            `Got it — free-form chat is still rolling out. For now, tap one of the ` +
            `quick prompts ↑ or ask me to "explain today's earnings".`,
        });
      }
    },
    mode.value === "live-agent" ? 1400 : 500,
  );
}

function quickLabel(key: QuickPromptKey): string {
  switch (key) {
    case "explain-today": return t.value.stella.qExplainToday;
    case "how-to-boost": return t.value.stella.qHowToBoost;
    case "whats-hot": return t.value.stella.qWhatsHot;
    case "show-top-jobs": return t.value.stella.qShowTopJobs;
  }
}

// ── auto-scroll: bump a bottom-anchor id whenever the list grows / opens ──
const bottomAnchor = ref("sd-end-0");
watch(
  () => [messages.value.length, isOpen.value],
  () => {
    bottomAnchor.value = `sd-end-${messages.value.length}`;
  },
);

// ── message styling ──
function bubbleStyle(m: StellaMessage): CSSProperties {
  const isStella = m.sender === "stella";
  const isAgent = m.kind === "agent-reply" || m.kind === "agent-system";
  if (!isStella) return { background: "var(--v5-brand)" };
  if (isAgent) return { background: "var(--v5-brand-2-soft)" };
  return { background: "var(--v5-surface-2)" };
}
function segColor(m: StellaMessage): string {
  const isStella = m.sender === "stella";
  const isAgent = m.kind === "agent-reply" || m.kind === "agent-system";
  if (!isStella) return "var(--v5-on-brand)";
  if (isAgent) return "var(--v5-brand-2)";
  return "var(--v5-ink)";
}

// ── **bold** + \n → render segments. Bare text must live in <text> (P-026). ──
function formatLines(text: string): { text: string; bold: boolean }[][] {
  return text.split("\n").map((line) =>
    line
      .split(/(\*\*[^*]+\*\*)/g)
      .filter((p) => p.length > 0)
      .map((p) =>
        p.startsWith("**") && p.endsWith("**")
          ? { text: p.slice(2, -2), bold: true }
          : { text: p, bold: false },
      ),
  );
}

function sysLabel(text: string): string {
  const isEntering = /routing|connecting|human/i.test(text) && !/back|ended|return/i.test(text);
  return isEntering ? t.value.stella.sysConnectedHuman : t.value.stella.sysBackToAi;
}

const sendStyle = computed<CSSProperties>(() => ({
  background: draft.value.trim() ? "var(--v5-brand)" : "var(--v5-surface-2)",
}));

// ── CTA navigation: map the prototype's logical path → uni route (P-046).
// (Was a 3-entry TAB_HREF + naive `/pages${href}` prefix, which broke single-
// segment landings like /genesis → /pages/genesis and nested /me/wallet/exchange.)
function onCta(href: string, _label: string) {
  close();
  navTo(href);
}
</script>

<style scoped>
.sd-root {
  position: fixed;
  inset: 0;
  z-index: 600;
}
.sd-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(8, 8, 12, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: sd-fade 0.18s ease-out;
}
.sd-panel {
  position: absolute;
  left: 0;
  right: 0;
  top: 18%;
  bottom: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--v5-surface);
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.4);
  animation: sd-slide-up 0.34s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes sd-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes sd-slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.sd-handle-wrap {
  padding: 8px 0 4px;
  display: flex;
  justify-content: center;
}
.sd-handle {
  width: 40px;
  height: 4px;
  border-radius: 999px;
  background: var(--v5-border-strong);
}
.sd-head {
  padding: 0 20px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--v5-border);
}
.sd-agent-ava {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: var(--v5-brand-2-soft);
  flex-shrink: 0;
}
.sd-head-meta {
  flex: 1;
  min-width: 0;
}
.sd-head-name {
  display: block;
  font-family: var(--font-v5);
  font-weight: 600;
  font-size: 14px;
  letter-spacing: -0.008em;
  color: var(--v5-ink);
}
.sd-head-role {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}
.sd-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  animation: sd-pulse 1.6s ease-in-out infinite;
}
.sd-head-role-t {
  font-size: 11.5px;
  color: var(--v5-ink-3);
}
@keyframes sd-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.sd-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  flex-shrink: 0;
}
.sd-pill--agent {
  background: var(--v5-brand-2-soft);
  color: var(--v5-brand-2);
}
.sd-pill--back {
  background: var(--v5-surface-2);
  color: var(--v5-ink-2);
}
.sd-pill-t {
  font-family: var(--font-v5);
  font-weight: 500;
  font-size: 12.5px;
  color: inherit;
}
.sd-close {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: var(--v5-surface-2);
  flex-shrink: 0;
}
.sd-list {
  flex: 1;
  min-height: 0; /* allow the scroll area to shrink so the input row is never pushed off-screen */
  padding: 16px;
}
.sd-empty {
  text-align: center;
  padding: 32px 16px;
}
.sd-empty-ava {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}
.sd-empty-t {
  font-size: 12.5px;
  color: var(--v5-ink-3);
  line-height: 1.55;
}
.sd-msg-row {
  margin-bottom: 12px;
}
.sd-sys {
  text-align: center;
  padding: 4px 0;
}
.sd-sys-t {
  font-size: 11px;
  color: var(--v5-ink-4);
}
.sd-bubble-row {
  display: flex;
}
.sd-left {
  justify-content: flex-start;
}
.sd-right {
  justify-content: flex-end;
}
.sd-bubble {
  max-width: 82%;
  border-radius: 18px;
  overflow: hidden;
}
.sd-bubble-body {
  padding: 10px 14px;
}
.sd-line {
  display: block;
  min-height: 1.55em;
}
.sd-seg {
  font-family: var(--font-v5);
  font-size: 12.5px;
  line-height: 1.55;
}
.sd-seg--b {
  font-weight: 600;
}
.sd-cta-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  padding: 0 14px 10px;
}
.sd-cta-t {
  color: var(--v5-brand);
  font-family: var(--font-v5);
  font-weight: 700;
  font-size: 12.5px;
  letter-spacing: -0.005em;
}
.sd-bottom-anchor {
  height: 1px;
}
.sd-chips {
  border-top: 1px solid var(--v5-border);
  white-space: nowrap;
}
.sd-chips-inner {
  display: inline-flex;
  gap: 6px;
  padding: 8px 12px;
}
.sd-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 12px;
  height: 32px;
  border-radius: 999px;
  background: var(--v5-surface-2);
}
.sd-chip-emoji {
  font-size: 12px;
}
.sd-chip-t {
  color: var(--v5-ink-2);
  font-family: var(--font-v5);
  font-weight: 500;
  font-size: 12px;
}
.sd-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  /* lift the input clear of the iOS home indicator: real safe-area inset +
     a comfortable 22px so the field never sits under the system bottom bar. */
  padding-bottom: calc(env(safe-area-inset-bottom) + 22px);
  border-top: 1px solid var(--v5-border);
}
.sd-input {
  flex: 1;
  min-width: 0;
  height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  background: var(--v5-surface-2);
  border: 1px solid var(--v5-border);
  color: var(--v5-ink);
  font-family: var(--font-v5);
  font-size: 13px;
}
.sd-input-ph {
  color: var(--v5-ink-4);
}
.sd-send {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
</style>
