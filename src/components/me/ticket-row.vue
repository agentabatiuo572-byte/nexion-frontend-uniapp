<!--
  TicketRow — a ticket card in the support tickets list (status/category/id meta,
  unread chip, subject, updated-time + message count). Ported from the inline
  TicketRow in Nexion-prototype me/support/tickets/page.tsx. Emits `open` on tap.
-->
<template>
  <view class="w-full active:scale-[0.99]" :style="cardStyle" role="button" tabindex="0" :aria-label="openLabel" @click="emit('open')">
    <view class="flex items-start" style="gap: 12px">
      <view class="grid place-items-center shrink-0" :style="iconBoxStyle">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="statusColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>
      </view>
      <view class="min-w-0" style="flex: 1">
        <view class="flex items-center" style="gap: 6px">
          <text :style="statusStyle">{{ statusLabel }}</text>
          <text :style="sepStyle">·</text>
          <text :style="metaStyle">{{ categoryLabel }}</text>
          <text :style="sepStyle">·</text>
          <text :style="idStyle">{{ tk.id }}</text>
          <text v-if="tk.unread > 0" :style="unreadChipStyle">{{ unreadLabel }}</text>
        </view>
        <text class="block" :style="subjectStyle">{{ tk.subject }}</text>
        <text class="block" :style="timeStyle">{{ relWhen(tk.updatedAt) }} · {{ tk.messages.length }} messages</text>
      </view>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 4px"><path d="m9 18 6-6-6-6" /></svg>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { CATEGORY_LABEL, STATUS_LABEL, STATUS_COLOR, type Ticket } from "@/mock/tickets";

const props = defineProps<{ tk: Ticket }>();
const emit = defineEmits<{ open: [] }>();
const t = useT();

const statusColor = computed(() => STATUS_COLOR[props.tk.status]);
const statusLabel = computed(() => STATUS_LABEL[props.tk.status]);
const categoryLabel = computed(() => CATEGORY_LABEL[props.tk.category]);
const unreadLabel = computed(() => fmt(t.value.tickets.unreadChip, { n: props.tk.unread }));
const openLabel = computed(() => `Open ${props.tk.id} · ${props.tk.subject}`);

function relWhen(ts: number): string {
  const ms = Date.now() - ts;
  if (ms < 60_000) return "just now";
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

const cardStyle: CSSProperties = { borderRadius: "16px", background: "var(--v5-surface)", border: "1px solid var(--v5-border)", padding: "14px" };
const iconBoxStyle = computed<CSSProperties>(() => ({
  width: "36px",
  height: "36px",
  borderRadius: "8px",
  background: `color-mix(in srgb, ${statusColor.value} 20%, transparent)`,
}));
const statusStyle = computed<CSSProperties>(() => ({
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10px",
  letterSpacing: "0.06em",
  fontWeight: 600,
  color: statusColor.value,
}));
const sepStyle: CSSProperties = { color: "var(--v5-ink-4)", fontSize: "10px" };
const metaStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "10px", color: "var(--v5-ink-3)" };
const idStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "10px", color: "var(--v5-ink-3)" };
const unreadChipStyle: CSSProperties = {
  marginLeft: "auto",
  padding: "2px 6px",
  borderRadius: "999px",
  fontSize: "10px",
  fontWeight: 600,
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
};
const subjectStyle: CSSProperties = { marginTop: "4px", fontSize: "13.5px", fontWeight: 600, color: "var(--v5-ink)", lineHeight: 1.4 };
const timeStyle: CSSProperties = { marginTop: "4px", fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "10.5px", color: "var(--v5-ink-3)" };
</script>
