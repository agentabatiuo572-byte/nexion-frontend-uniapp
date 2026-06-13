<!--
  MyTokenCard — owned Genesis Node card with list / cancel flow
  (marketplace/page.tsx MyTokenCard). Reads listing state from the genesis store
  and composes listNode / cancelListing (store actions). Confirm dialogs use the
  global ui confirm/toast.
-->
<template>
  <view class="overflow-hidden" :style="cardStyle">
    <view class="flex items-center justify-center relative" :style="artStyle">
      <view v-if="isListed" class="absolute inline-flex items-center" :style="listedBadgeStyle">
        <view :style="listedBadgeDotStyle" />
        <text>{{ t.marketplace.listedBadge }}</text>
      </view>
      <view class="text-center">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" :stroke="isListed ? 'var(--v5-warning)' : 'var(--v5-brand)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" /><path d="M5 20h14" /></svg>
        <text class="block tabular-nums" :style="tokenIdStyle">#{{ tokenId }}</text>
        <text class="block" :style="yoursStyle">{{ t.marketplace.yoursLabel }}</text>
      </view>
    </view>

    <view style="padding: 12px">
      <!-- Listed state -->
      <template v-if="isListed && existing">
        <text class="block" :style="askLabelStyle">{{ askingChipText }}</text>
        <text class="block tabular-nums" :style="askPriceStyle">${{ existing.askPriceUSDT.toLocaleString() }}</text>
        <text class="block" :style="listedAgoStyle">{{ listedAgoText }}</text>
        <view class="w-full flex items-center justify-center active:scale-[0.97]" :style="cancelBtnStyle" @click="handleCancel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          <text>{{ t.marketplace.cancelBtn }}</text>
        </view>
      </template>

      <!-- Not-listed state -->
      <template v-else>
        <text class="block" :style="listLabelStyle">{{ t.marketplace.listForSale }}</text>
        <view class="flex items-baseline" :style="inputWrapStyle">
          <text :style="dollarStyle">$</text>
          <input class="flex-1 min-w-0 tabular-nums" :style="inputStyle" type="text" inputmode="numeric" :value="String(askPrice)" @input="onAskInput" />
        </view>
        <text class="block" :style="floorHintStyle">{{ floorHintText }}</text>
        <view class="w-full flex items-center justify-center active:scale-[0.97]" :style="listBtnStyle" @click="handleList">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></svg>
          <text>{{ t.marketplace.listCta }}</text>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useGenesis } from "@/store/genesis";
import { toast, confirm } from "@/store/ui";

const FLOOR = 25_000;

const props = defineProps<{ tokenId: number }>();

const t = useT();
const genesis = useGenesis();

const askPrice = ref(FLOOR);

const existing = computed(() => genesis.myListings.find((l) => l.tokenId === props.tokenId));
const isListed = computed(() => !!existing.value);

const askingChipText = computed(() =>
  existing.value ? fmt(t.value.marketplace.askingChip, { amount: existing.value.askPriceUSDT.toLocaleString() }) : "",
);
const listedAgoText = computed(() =>
  existing.value ? fmt(t.value.marketplace.listedAgo, { time: relativeTime(existing.value.listedAt) }) : "",
);
const floorHintText = computed(() => fmt(t.value.marketplace.floorShort, { k: (FLOOR / 1000).toFixed(1) }));

function relativeTime(ts: number): string {
  const ms = Date.now() - ts;
  if (ms < 60_000) return "<1m";
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3600_000)}h`;
  return `${Math.floor(ms / 86_400_000)}d`;
}

function onAskInput(e: Event) {
  const raw = (e as unknown as { detail: { value: string } }).detail.value;
  askPrice.value = Math.max(0, parseInt(raw.replace(/\D/g, "")) || 0);
}

async function handleList() {
  const ok = await confirm({
    title: fmt(t.value.marketplace.confirmListTitle, { id: props.tokenId }),
    message: fmt(t.value.marketplace.confirmListMsg, {
      amount: askPrice.value.toLocaleString(),
      floor: (FLOOR / 1000).toFixed(1),
    }),
    confirmLabel: t.value.marketplace.confirmListCta,
    icon: "info",
  });
  if (!ok) return;
  if (genesis.listNode(props.tokenId, askPrice.value)) {
    toast.success(
      fmt(t.value.marketplace.listedToast, { id: props.tokenId }),
      fmt(t.value.marketplace.listedDesc, { amount: askPrice.value.toLocaleString() }),
    );
  }
}

async function handleCancel() {
  if (!existing.value) return;
  const ok = await confirm({
    title: fmt(t.value.marketplace.confirmCancelTitle, { id: props.tokenId }),
    message: t.value.marketplace.confirmCancelMsg,
    confirmLabel: t.value.marketplace.confirmCancelCta,
    danger: true,
    icon: "warn",
  });
  if (!ok) return;
  if (genesis.cancelListing(props.tokenId)) {
    toast.info(
      fmt(t.value.marketplace.cancelledToast, { id: props.tokenId }),
      t.value.marketplace.cancelledDesc,
    );
  }
}

const cardStyle = computed<CSSProperties>(() => ({
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: isListed.value ? "1px solid rgba(255,200,61,0.35)" : "1px solid var(--v5-border)",
}));
const artStyle = computed<CSSProperties>(() => ({
  aspectRatio: "1 / 1",
  background: isListed.value
    ? "radial-gradient(80% 80% at 50% 30%, rgba(255,200,61,0.18) 0%, transparent 65%), linear-gradient(135deg, #1A1408 0%, var(--v5-on-brand) 100%)"
    : "radial-gradient(80% 80% at 50% 30%, rgba(198,255,58,0.18) 0%, transparent 65%), linear-gradient(135deg, #14160F 0%, var(--v5-on-brand) 100%)",
}));
const listedBadgeStyle: CSSProperties = {
  top: "8px",
  right: "8px",
  gap: "4px",
  padding: "2px 7px",
  borderRadius: "6px",
  background: "rgba(196,131,22,0.22)",
  color: "var(--v5-warning)",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.06em",
};
const listedBadgeDotStyle: CSSProperties = {
  width: "4px",
  height: "4px",
  borderRadius: "999px",
  background: "var(--v5-warning)",
};
const tokenIdStyle: CSSProperties = {
  marginTop: "4px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "18px",
  letterSpacing: "-0.014em",
  color: "var(--v5-ink)",
  lineHeight: 1,
};
const yoursStyle = computed<CSSProperties>(() => ({
  marginTop: "4px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.06em",
  color: isListed.value ? "var(--v5-warning)" : "var(--v5-brand)",
}));
const askLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-warning)",
  letterSpacing: "0.04em",
};
const askPriceStyle: CSSProperties = {
  marginTop: "2px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "18px",
  letterSpacing: "-0.014em",
  color: "var(--v5-warning)",
  lineHeight: 1,
};
const listedAgoStyle: CSSProperties = {
  marginTop: "4px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10.5px",
  color: "var(--v5-ink-3)",
};
const cancelBtnStyle: CSSProperties = {
  marginTop: "10px",
  height: "44px",
  borderRadius: "999px",
  background: "var(--v5-surface-2)",
  border: "1px solid var(--v5-brand-2-border)",
  color: "var(--v5-brand-2)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "13px",
  letterSpacing: "-0.005em",
};
const listLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.04em",
};
const inputWrapStyle: CSSProperties = {
  marginTop: "4px",
  gap: "4px",
  padding: "8px 10px",
  borderRadius: "10px",
  background: "var(--v5-surface-2)",
};
const dollarStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "14px",
  color: "var(--v5-ink-3)",
  flexShrink: 0,
};
const inputStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "15px",
  color: "var(--v5-ink)",
  letterSpacing: "-0.014em",
  background: "transparent",
};
const floorHintStyle: CSSProperties = {
  marginTop: "4px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10.5px",
  color: "var(--v5-ink-3)",
};
const listBtnStyle: CSSProperties = {
  marginTop: "10px",
  height: "44px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  boxShadow: "var(--v5-spotlight-brand)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "13px",
  letterSpacing: "-0.005em",
};
</script>
