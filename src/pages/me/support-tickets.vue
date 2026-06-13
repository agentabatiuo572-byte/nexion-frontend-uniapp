<!--
  Support tickets (ported from Nexion-prototype/app/(main)/me/support/tickets/page.tsx).
  Three local view modes: list (stats + tabs + ticket cards), create (category/subject/
  description form), detail (message thread + reply). Tickets are backed by a
  Pinia store so create/reply/close persist across refresh. Wrapped in
  <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="padding-bottom: 32px">
      <SubPageHeader back="/pages/me/support" />
      <view v-if="mode.kind !== 'list'" class="px-4" style="padding-bottom: 8px">
        <view class="flex items-center active:opacity-50" :style="backRowStyle" role="button" tabindex="0" :aria-label="t.tickets.backToTickets" @click="mode = { kind: 'list' }">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          <text style="margin-left: 4px">{{ t.tickets.backToTickets }}</text>
        </view>
      </view>

      <!-- LIST MODE -->
      <view v-if="mode.kind === 'list'" class="px-4" style="display: flex; flex-direction: column; gap: 12px">
        <view class="grid grid-cols-3" style="gap: 8px">
          <StatBox tint="var(--v5-warning)" :label="t.tickets.statsOpen" :value="stats.open" :icon="alertIcon" @select="selectTab('open')" />
          <StatBox tint="var(--v5-brand-2)" :label="t.tickets.statsAwaiting" :value="stats.awaiting" :icon="clockIcon" @select="selectTab('open')" />
          <StatBox tint="var(--v5-brand)" :label="t.tickets.statsResolved" :value="stats.resolved" :icon="checkIcon" @select="selectTab('resolved')" />
        </view>

        <view class="w-full flex items-center justify-center active:scale-[0.98]" :style="newBtnStyle" role="button" tabindex="0" :aria-label="t.tickets.newTicketCta" @click="mode = { kind: 'create' }">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
          <text style="margin-left: 8px">{{ t.tickets.newTicketCta }}</text>
        </view>

        <view class="flex items-center" :style="avgRowStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          <text :style="avgLabelStyle">{{ t.tickets.avgResponseLabel }}</text>
          <text :style="avgValueStyle">{{ t.tickets.avgResponseValue }}</text>
        </view>

        <view class="grid grid-cols-4" :style="tabsStyle">
          <view v-for="id in tabs" :key="id" :style="tabStyle(tab === id)" role="button" tabindex="0" :aria-label="tabLabel(id)" @click="selectTab(id)">
            <text>{{ tabLabel(id) }}</text>
          </view>
        </view>
        <text v-if="filterFeedback" class="block text-center" :style="filterFeedbackStyle">{{ filterFeedback }}</text>

        <view v-if="filtered.length === 0" :style="emptyStyle">
          <text :style="emptyTextStyle">{{ t.tickets.emptyList }}</text>
        </view>
        <view v-else style="display: flex; flex-direction: column; gap: 8px">
          <TicketRow v-for="tk in filtered" :key="tk.id" :tk="tk" @open="mode = { kind: 'detail', id: tk.id }" />
        </view>

        <text class="block text-center" :style="noteStyle">{{ t.tickets.note }}</text>
      </view>

      <!-- CREATE MODE -->
      <view v-else-if="mode.kind === 'create'" class="px-4" style="display: flex; flex-direction: column; gap: 16px">
        <view>
          <text class="block" :style="formLabelStyle">{{ t.tickets.create.catLabel }}</text>
          <view class="flex" style="flex-wrap: wrap; gap: 6px">
            <view v-for="c in categoriesForNew" :key="c" :style="catChipStyle(newCat === c)" role="button" tabindex="0" :aria-label="catLabel(c)" @click="newCat = c">
              <text>{{ catLabel(c) }}</text>
            </view>
          </view>
        </view>
        <view>
          <text class="block" :style="formLabelStyle">{{ t.tickets.create.subjectLabel }}</text>
          <input :value="subject" :placeholder="t.tickets.create.subjectPlaceholder" placeholder-class="ph" :style="inputStyle" @input="onSubject" />
        </view>
        <view>
          <text class="block" :style="formLabelStyle">{{ t.tickets.create.descLabel }}</text>
          <textarea :value="desc" :placeholder="t.tickets.create.descPlaceholder" placeholder-class="ph" :style="textareaStyle" @input="onDesc" />
        </view>
        <view class="grid grid-cols-2" style="gap: 8px">
          <view class="flex items-center justify-center active:scale-[0.98]" :style="cancelBtnStyle" role="button" tabindex="0" :aria-label="t.tickets.create.cancel" @click="mode = { kind: 'list' }">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            <text style="margin-left: 6px">{{ t.tickets.create.cancel }}</text>
          </view>
          <view class="flex items-center justify-center active:scale-[0.98]" :style="submitBtnStyle" role="button" tabindex="0" :aria-label="t.tickets.create.submit" @click="submitCreate">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" /></svg>
            <text style="margin-left: 6px">{{ t.tickets.create.submit }}</text>
          </view>
        </view>
      </view>

      <!-- DETAIL MODE -->
      <view v-else-if="detailTicket" class="px-4" style="display: flex; flex-direction: column; gap: 12px">
        <view :style="detailMetaStyle">
          <view class="flex items-center" style="gap: 6px">
            <text :style="statusTextStyle(detailTicket.status)">{{ statusLabel(detailTicket.status) }}</text>
            <text :style="dotSepStyle">·</text>
            <text :style="catTextStyle">{{ catLabel(detailTicket.category) }}</text>
          </view>
          <text class="block" :style="detailSubjectStyle">{{ detailTicket.subject }}</text>
          <view class="flex items-center justify-between" :style="detailTimesStyle">
            <text>{{ createdLabel }}</text>
            <text>{{ updatedLabel }}</text>
          </view>
        </view>

        <text class="block" :style="messagesLabelStyle">{{ t.tickets.detail.messagesLabel }}</text>
        <view style="display: flex; flex-direction: column; gap: 8px">
          <view v-for="(m, i) in detailTicket.messages" :key="i" :style="msgBubbleStyle(m.author === 'user')">
            <view class="flex items-center" :style="msgHeadStyle">
              <text :style="msgAuthorStyle(m.author === 'user')">{{ m.author === "user" ? t.tickets.detail.youLabel : (m.agentName ?? "Agent") }}</text>
              <text :style="dotSepStyle" style="margin: 0 4px">·</text>
              <text :style="msgTimeStyle">{{ relWhen(m.ts) }}</text>
            </view>
            <text class="block" :style="msgBodyStyle">{{ m.body }}</text>
          </view>
        </view>

        <view v-if="canClose(detailTicket)" :style="replyCardStyle">
          <textarea :value="reply" :placeholder="t.tickets.detail.replyPlaceholder" placeholder-class="ph" :style="replyTextareaStyle" @input="onReply" />
          <view class="grid grid-cols-2" style="gap: 8px; margin-top: 8px">
            <view class="flex items-center justify-center active:scale-[0.98]" :style="closeBtnStyle" role="button" tabindex="0" :aria-label="t.tickets.detail.closeBtn" @click="closeTicket">
              <text>{{ t.tickets.detail.closeBtn }}</text>
            </view>
            <view class="flex items-center justify-center active:scale-[0.98]" :style="sendReplyStyle(!!reply.trim())" role="button" tabindex="0" :aria-label="t.tickets.detail.sendBtn" @click="sendReply">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" :stroke="reply.trim() ? 'var(--v5-on-brand)' : 'var(--v5-ink-4)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" /></svg>
              <text style="margin-left: 6px">{{ t.tickets.detail.sendBtn }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import StatBox from "@/components/me/ticket-stat-box.vue";
import TicketRow from "@/components/me/ticket-row.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";
import { useTickets } from "@/store/tickets";
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  STATUS_COLOR,
  type Ticket,
  type TicketCategory,
  type TicketStatus,
} from "@/mock/tickets";

type Mode = { kind: "list" } | { kind: "create" } | { kind: "detail"; id: string };
type Tab = "all" | "open" | "resolved" | "closed";

const t = useT();
const ticketsStore = useTickets();
const mode = ref<Mode>({ kind: "list" });
const tab = ref<Tab>("all");
const tabs: Tab[] = ["all", "open", "resolved", "closed"];

const categoriesForNew: TicketCategory[] = ["withdrawal", "deposit", "kyc", "hardware", "account", "earnings", "technical", "other"];
const newCat = ref<TicketCategory>("withdrawal");
const subject = ref("");
const desc = ref("");
const reply = ref("");
const filterFeedback = ref("");

onLoad((query) => {
  if (query?.mode === "create") mode.value = { kind: "create" };
  if (typeof query?.ticket === "string") mode.value = { kind: "detail", id: query.ticket };
});

const alertIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>`;
const clockIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>`;
const checkIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" /></svg>`;

const stats = computed(() => ({
  open: ticketsStore.tickets.filter((x) => x.status === "open" || x.status === "in_progress").length,
  awaiting: ticketsStore.tickets.filter((x) => x.status === "pending_user").length,
  resolved: ticketsStore.tickets.filter((x) => x.status === "resolved" || x.status === "closed").length,
}));

const filtered = computed(() => {
  const sorted = [...ticketsStore.tickets].sort((a, b) => b.updatedAt - a.updatedAt);
  switch (tab.value) {
    case "open":
      return sorted.filter((x) => x.status === "open" || x.status === "in_progress" || x.status === "pending_user");
    case "resolved":
      return sorted.filter((x) => x.status === "resolved");
    case "closed":
      return sorted.filter((x) => x.status === "closed");
    default:
      return sorted;
  }
});

const detailTicket = computed(() => {
  const m = mode.value;
  return m.kind === "detail" ? ticketsStore.tickets.find((x) => x.id === m.id) ?? null : null;
});
const createdLabel = computed(() => (detailTicket.value ? fmt(t.value.tickets.detail.created, { when: relWhen(detailTicket.value.createdAt) }) : ""));
const updatedLabel = computed(() => (detailTicket.value ? fmt(t.value.tickets.detail.lastUpdate, { when: relWhen(detailTicket.value.updatedAt) }) : ""));

function catLabel(c: TicketCategory): string {
  return CATEGORY_LABEL[c];
}
function statusLabel(s: TicketStatus): string {
  return STATUS_LABEL[s];
}
function tabLabel(id: Tab): string {
  const key = id === "all" ? "tabAll" : id === "open" ? "tabOpen" : id === "resolved" ? "tabResolved" : "tabClosed";
  return (t.value.tickets as unknown as Record<string, string>)[key];
}
function selectTab(id: Tab) {
  if (tab.value === id) {
    filterFeedback.value = fmt(t.value.tickets.filterAlreadyShown, { tab: tabLabel(id) });
    return;
  }
  tab.value = id;
  filterFeedback.value = "";
}
function canClose(tk: Ticket): boolean {
  return tk.status !== "closed" && tk.status !== "resolved";
}
function relWhen(ts: number): string {
  const ms = Date.now() - ts;
  if (ms < 60_000) return "just now";
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function detailVal(e: Event): string {
  return (e as unknown as { detail: { value: string } }).detail.value;
}
function onSubject(e: Event) {
  subject.value = detailVal(e);
}
function onDesc(e: Event) {
  desc.value = detailVal(e);
}
function onReply(e: Event) {
  reply.value = detailVal(e);
}

function submitCreate() {
  if (!subject.value.trim() || !desc.value.trim()) {
    toast.info(t.value.tickets.create.missingFields, "");
    return;
  }
  const id = ticketsStore.createTicket({ category: newCat.value, subject: subject.value, body: desc.value });
  toast.success(t.value.tickets.create.submittedToast, "");
  subject.value = "";
  desc.value = "";
  mode.value = { kind: "detail", id };
}
function sendReply() {
  const current = detailTicket.value;
  if (!current || !reply.value.trim()) return;
  ticketsStore.reply(current.id, reply.value);
  reply.value = "";
  toast.success(t.value.tickets.detail.sentToast, "");
}
function closeTicket() {
  const current = detailTicket.value;
  if (current) ticketsStore.close(current.id);
  toast.success(t.value.tickets.detail.closedToast, "");
  mode.value = { kind: "list" };
}

const backRowStyle: CSSProperties = { minHeight: "44px", marginLeft: "-8px", padding: "0 8px", fontSize: "12.5px", color: "var(--v5-brand)" };
const newBtnStyle: CSSProperties = { width: "100%", height: "48px", borderRadius: "16px", background: "var(--v5-brand)", color: "var(--v5-on-brand)", fontWeight: 600, fontSize: "14px" };
const avgRowStyle: CSSProperties = {
  gap: "8px",
  padding: "8px 12px",
  borderRadius: "12px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  fontSize: "11.5px",
};
const avgLabelStyle: CSSProperties = { color: "var(--v5-ink-3)" };
const avgValueStyle: CSSProperties = { marginLeft: "auto", fontFamily: "var(--font-jet-mono), ui-monospace, monospace", color: "var(--v5-brand-2)", fontWeight: 600 };
const tabsStyle: CSSProperties = { gap: "4px", padding: "4px", borderRadius: "16px", background: "var(--v5-surface)", border: "1px solid var(--v5-border)" };
function tabStyle(active: boolean): CSSProperties {
  return {
    height: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "12px",
    fontSize: "11.5px",
    fontWeight: 600,
    background: active ? "var(--v5-brand)" : "transparent",
    color: active ? "var(--v5-on-brand)" : "var(--v5-ink-3)",
  };
}
const emptyStyle: CSSProperties = { borderRadius: "16px", background: "var(--v5-surface)", border: "1px solid var(--v5-border)", padding: "32px", textAlign: "center" };
const emptyTextStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)" };
const noteStyle: CSSProperties = { fontSize: "10.5px", color: "var(--v5-ink-3)", lineHeight: 1.6, paddingTop: "4px" };
const filterFeedbackStyle: CSSProperties = { marginTop: "-4px", fontSize: "10.5px", color: "var(--v5-ink-3)" };
const formLabelStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "11px", color: "var(--v5-ink-3)", marginBottom: "8px" };
function catChipStyle(active: boolean): CSSProperties {
  return {
    height: "44px",
    display: "inline-flex",
    alignItems: "center",
    padding: "0 16px",
    borderRadius: "999px",
    fontSize: "11.5px",
    fontWeight: 600,
    background: active ? "var(--v5-brand)" : "var(--v5-surface)",
    color: active ? "var(--v5-on-brand)" : "var(--v5-ink-3)",
    border: active ? "none" : "1px solid var(--v5-border)",
  };
}
const inputStyle: CSSProperties = {
  width: "100%",
  height: "44px",
  borderRadius: "12px",
  background: "var(--v5-surface-2)",
  border: "1px solid var(--v5-border)",
  padding: "0 12px",
  fontSize: "14px",
  color: "var(--v5-ink)",
};
const textareaStyle: CSSProperties = {
  width: "100%",
  height: "140px",
  borderRadius: "12px",
  background: "var(--v5-surface-2)",
  border: "1px solid var(--v5-border)",
  padding: "10px 12px",
  fontSize: "13.5px",
  color: "var(--v5-ink)",
  lineHeight: 1.6,
};
const cancelBtnStyle: CSSProperties = { height: "48px", borderRadius: "12px", background: "var(--v5-surface-2)", color: "var(--v5-ink)", fontWeight: 600, fontSize: "14px" };
const submitBtnStyle: CSSProperties = { height: "48px", borderRadius: "12px", background: "var(--v5-brand)", color: "var(--v5-on-brand)", fontWeight: 600, fontSize: "14px" };
const detailMetaStyle: CSSProperties = { borderRadius: "16px", background: "var(--v5-surface)", border: "1px solid var(--v5-border)", padding: "16px" };
function statusTextStyle(s: TicketStatus): CSSProperties {
  return { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "10px", letterSpacing: "0.06em", fontWeight: 600, color: STATUS_COLOR[s] };
}
const dotSepStyle: CSSProperties = { color: "var(--v5-ink-4)", fontSize: "10px" };
const catTextStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "10px", color: "var(--v5-ink-3)" };
const detailSubjectStyle: CSSProperties = { marginTop: "6px", fontSize: "15px", fontWeight: 600, color: "var(--v5-ink)", lineHeight: 1.4 };
const detailTimesStyle: CSSProperties = { marginTop: "8px", fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "10.5px", color: "var(--v5-ink-3)" };
const messagesLabelStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "10px", letterSpacing: "0.06em", color: "var(--v5-ink-3)" };
function msgBubbleStyle(isUser: boolean): CSSProperties {
  return {
    borderRadius: "16px",
    padding: "14px",
    background: isUser ? "color-mix(in srgb, var(--v5-brand) 8%, transparent)" : "var(--v5-surface)",
    border: isUser ? "1px solid color-mix(in srgb, var(--v5-brand) 25%, transparent)" : "1px solid var(--v5-border)",
    marginLeft: isUser ? "24px" : "0",
    marginRight: isUser ? "0" : "24px",
  };
}
const msgHeadStyle: CSSProperties = { marginBottom: "4px" };
function msgAuthorStyle(isUser: boolean): CSSProperties {
  return { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "10px", letterSpacing: "0.06em", fontWeight: 600, color: isUser ? "var(--v5-brand)" : "var(--v5-brand-2)" };
}
const msgTimeStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "10px", color: "var(--v5-ink-3)" };
const msgBodyStyle: CSSProperties = { fontSize: "12.5px", color: "color-mix(in srgb, var(--v5-ink) 90%, transparent)", lineHeight: 1.6 };
const replyCardStyle: CSSProperties = { borderRadius: "16px", background: "var(--v5-surface)", border: "1px solid var(--v5-border)", padding: "12px" };
const replyTextareaStyle: CSSProperties = {
  width: "100%",
  height: "84px",
  borderRadius: "8px",
  background: "var(--v5-surface-2)",
  border: "1px solid var(--v5-border)",
  padding: "8px 12px",
  fontSize: "13.5px",
  color: "var(--v5-ink)",
  lineHeight: 1.6,
};
const closeBtnStyle: CSSProperties = { height: "40px", borderRadius: "8px", background: "var(--v5-surface-2)", color: "var(--v5-ink-2)", fontWeight: 600, fontSize: "12.5px" };
function sendReplyStyle(active: boolean): CSSProperties {
  return {
    height: "40px",
    borderRadius: "8px",
    background: active ? "var(--v5-brand)" : "color-mix(in srgb, var(--v5-surface-2) 50%, transparent)",
    color: active ? "var(--v5-on-brand)" : "var(--v5-ink-4)",
    fontWeight: 600,
    fontSize: "12.5px",
  };
}
</script>
