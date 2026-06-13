<!--
  ChainPaymentInstructions — ported from Nexion-prototype/app/(main)/store/
  checkout/page.tsx (ChainPaymentInstructions + FauxQR). USDT-TRC20 / USDT-ERC20
  / BTC deposit screen: faux-QR + copyable address + 30-min countdown +
  12s auto-detect that fires `complete`. wallet-pairing.ts isn't ported yet, so
  mockExternalAddress is inlined here (mock-only, self-contained).
-->
<template>
  <view class="rounded-2xl border overflow-hidden" :style="cardStyle">
    <!-- Header -->
    <view class="flex items-center border-b" :style="headerStyle">
      <view class="grid place-items-center shrink-0" :style="iconBoxStyle">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
      </view>
      <view class="flex-1 min-w-0">
        <text class="block" :style="headerTitleStyle">{{ sendLabel }}</text>
        <text class="block" style="font-size: 11.5px; color: var(--v5-ink-3); margin-top: 2px">{{ t.store.coNetworkConfirms }}</text>
      </view>
      <view class="flex items-center tabular-nums" style="gap: 4px; font-size: 11.5px; color: var(--v5-warning)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
        <text>{{ mm }}:{{ ss }}</text>
      </view>
    </view>

    <!-- QR + address -->
    <view class="flex flex-col items-center" style="padding: 20px; gap: 12px">
      <view class="rounded-xl grid place-items-center" style="width: 140px; height: 140px; background: #ffffff">
        <!-- Faux-QR: deterministic dot grid (no real encoding — pure visual).
             #fff/#000 are a B/W contrast design asset, NOT theme-tokenized. -->
        <svg viewBox="0 0 120 120" style="width: 120px; height: 120px">
          <rect width="120" height="120" fill="#ffffff" />
          <rect v-for="c in qrCells" :key="c.i" :x="c.x" :y="c.y" :width="cell" :height="cell" fill="#000000" />
        </svg>
      </view>
      <text class="font-mono-tabular" style="font-size: 11px; color: var(--v5-ink-3)">{{ t.store.coOrPaste }}</text>
      <view class="w-full flex items-center rounded-xl border active:opacity-90" :style="addressBtnStyle" role="button" tabindex="0" :aria-label="t.store.coAddressCopied" @tap.stop="copyAddress" @click.stop="copyAddress">
        <text class="flex-1 font-mono" style="text-align: left; font-size: 11.5px; color: var(--v5-ink-2); word-break: break-all" @tap.stop="copyAddress" @click.stop="copyAddress">{{ address }}</text>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
      </view>
    </view>

    <!-- Amount / Network grid -->
    <view class="grid" style="padding: 0 20px 12px; grid-template-columns: 1fr 1fr; gap: 12px">
      <view>
        <text class="block font-mono-tabular" style="font-size: 10.5px; color: var(--v5-ink-3)">{{ t.store.coAmount }}</text>
        <text class="block tabular-nums" :style="gridValStyle">{{ amountLabel }}</text>
      </view>
      <view>
        <text class="block font-mono-tabular" style="font-size: 10.5px; color: var(--v5-ink-3)">{{ t.store.coNetwork }}</text>
        <text class="block" :style="gridValStyle">{{ network }}</text>
      </view>
    </view>

    <!-- Confirm + cancel -->
    <view style="padding: 8px 16px 16px">
      <view class="w-full inline-flex items-center justify-center active:opacity-90" :style="confirmBtnStyle" role="button" tabindex="0" :aria-label="t.store.coCompletedPayment" @tap.stop="emitComplete" @click.stop="emitComplete">
        <text @tap.stop="emitComplete" @click.stop="emitComplete">{{ t.store.coCompletedPayment }}</text>
      </view>
      <view class="w-full grid place-items-center active:opacity-80" :style="cancelBtnStyle" role="button" tabindex="0" :aria-label="t.store.coCancel" @tap.stop="emitCancel" @click.stop="emitCancel">
        <text @tap.stop="emitCancel" @click.stop="emitCancel">{{ t.store.coCancel }}</text>
      </view>
      <text class="block text-center" style="font-size: 10.5px; color: var(--v5-ink-4); padding-top: 4px; line-height: 1.5">{{ sendExactLabel }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";

const props = defineProps<{
  method: "usdt-trc20" | "usdt-erc20" | "btc";
  amount: number;
}>();
const emit = defineEmits<{ complete: []; cancel: [] }>();

const t = useT();

const network = computed(() =>
  props.method === "usdt-trc20"
    ? "USDT-TRC20"
    : props.method === "usdt-erc20"
      ? "USDT-ERC20"
      : "BTC",
);

// Generate a network-appropriate mock address (looks real, fully simulated).
// Inlined from wallet-pairing.ts mockExternalAddress (that store isn't ported).
function mockExternalAddress(net: string): string {
  const hex = (n: number) => {
    const chars = "0123456789abcdef";
    let s = "";
    for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * 16)];
    return s;
  };
  if (net === "USDT-TRC20") return "T" + hex(33).toUpperCase().slice(0, 33);
  if (net === "BTC") return "bc1q" + hex(38);
  return "0x" + hex(40);
}
const address = ref(mockExternalAddress(network.value));

const sendLabel = computed(() => fmt(t.value.store.coSendNetwork, { network: network.value }));
const sendExactLabel = computed(() => fmt(t.value.store.coSendExact, { network: network.value }));
const amountLabel = computed(() =>
  network.value === "BTC"
    ? `${(props.amount / 65000).toFixed(6)} BTC ≈ $${props.amount.toLocaleString()}`
    : `${props.amount.toLocaleString()} USDT`,
);

// ── 30-min countdown ──
const secLeft = ref(30 * 60);
const mm = computed(() => String(Math.floor(secLeft.value / 60)).padStart(2, "0"));
const ss = computed(() => String(secLeft.value % 60).padStart(2, "0"));
let countdownTimer: ReturnType<typeof setInterval> | undefined;
let detectTimer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
  countdownTimer = setInterval(() => {
    secLeft.value = Math.max(0, secLeft.value - 1);
    if (secLeft.value <= 0 && countdownTimer) clearInterval(countdownTimer);
  }, 1000);
  // 12s auto-detect — simulates network seeing the deposit
  detectTimer = setTimeout(() => emit("complete"), 12_000);
});

function cleanup() {
  if (countdownTimer) clearInterval(countdownTimer);
  if (detectTimer) clearTimeout(detectTimer);
}
onUnmounted(() => cleanup());

function copyAddress() {
  uni.setClipboardData({
    data: address.value,
    success: () => toast.success(t.value.store.coAddressCopied, t.value.store.coAddressCopiedSub),
    fail: () => {},
  });
}

function emitComplete() {
  emit("complete");
}

function emitCancel() {
  emit("cancel");
}

// ── Faux-QR cells (deterministic from address seed) ──
const QR_SIZE = 21;
const cell = 120 / QR_SIZE;
const qrCells = computed<{ i: number; x: number; y: number }[]>(() => {
  const seed = address.value;
  const arr: boolean[] = [];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  let s = Math.abs(hash);
  for (let i = 0; i < QR_SIZE * QR_SIZE; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    arr.push((s & 1) === 1);
  }
  // Force the 3 finder squares (TL / TR / BL) — classic QR look
  const setSquare = (cx: number, cy: number) => {
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++) {
        const i = (cy + y) * QR_SIZE + (cx + x);
        const onBorder = y === 0 || y === 6 || x === 0 || x === 6;
        const onInner = y >= 2 && y <= 4 && x >= 2 && x <= 4;
        arr[i] = onBorder || onInner;
      }
  };
  setSquare(0, 0);
  setSquare(QR_SIZE - 7, 0);
  setSquare(0, QR_SIZE - 7);
  const out: { i: number; x: number; y: number }[] = [];
  for (let i = 0; i < arr.length; i++) {
    if (!arr[i]) continue;
    out.push({ i, x: (i % QR_SIZE) * cell, y: Math.floor(i / QR_SIZE) * cell });
  }
  return out;
});

// ─── styles ───
const cardStyle: CSSProperties = { background: "var(--v5-surface)", borderColor: "var(--v5-border)" };
const headerStyle: CSSProperties = { padding: "16px 20px", gap: "12px", borderColor: "var(--v5-border)" };
const iconBoxStyle: CSSProperties = { width: "36px", height: "36px", borderRadius: "8px", background: "var(--v5-brand-soft)" };
const headerTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const addressBtnStyle: CSSProperties = {
  padding: "12px",
  gap: "8px",
  background: "var(--v5-surface-2)",
  borderColor: "var(--v5-border)",
};
const gridValStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--v5-ink)",
  marginTop: "2px",
};
const confirmBtnStyle: CSSProperties = {
  height: "44px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 600,
};
const cancelBtnStyle: CSSProperties = {
  marginTop: "8px",
  height: "40px",
  borderRadius: "12px",
  background: "var(--v5-surface-2)",
  color: "var(--v5-ink-2)",
  fontSize: "12.5px",
};
</script>
