<!--
  On-chain transaction explorer (ported from Nexion-prototype/app/(main)/tx/[hash]/page.tsx).
  Mimics Etherscan/TRONScan for a given tx hash; all values are deterministically
  derived from the hash so the same tx renders identically. Reads `?hash=` (source's
  dynamic [hash] segment). copy → uni.setClipboardData. Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="padding-bottom: 24px">
      <SubPageHeader back="/pages/me/wallet-bills" />

      <!-- Status hero — single-record container (form b: surface fill, no border) -->
      <view class="mx-4" :style="heroStyle">
        <view class="flex items-center" style="gap: 8px; margin-bottom: 8px">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" /></svg>
          <text :style="confirmedStyle">{{ w.confirmed }}</text>
        </view>
        <text class="block" :style="hashStyle">{{ hash }}</text>
        <view class="flex items-center active:opacity-70" :style="copyBtnStyle" role="button" tabindex="0" :aria-label="copyButtonText" @click.stop="copyHash">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
          <text>{{ copyButtonText }}</text>
        </view>
        <view class="grid grid-cols-3 text-center" style="gap: 8px; margin-top: 12px">
          <Stat :label="w.block" :value="`#${blockNumber.toLocaleString()}`" />
          <Stat :label="w.confirmations" :value="String(confirmations)" tint="var(--v5-success)" />
          <Stat :label="w.age" :value="ageLabel" />
        </view>
      </view>

      <!-- Tx details -->
      <view class="mx-4" :style="detailsCardStyle">
        <Row :label="w.from" :value="trunc(fromAddr)" mono />
        <Row :label="w.to" :value="trunc(toAddr)" mono />
        <Row :label="w.contract" :value="trunc(contract)" mono />
        <Row :label="w.value" :value="`${valueUSDT} USDT`" tint="var(--v5-brand)" bold />
        <Row :label="w.gas" :value="`${gasUsedGwei} Gwei`" mono />
        <Row :label="w.network" value="Ethereum Mainnet (chain id 1)" last />
      </view>

      <!-- External link explainer -->
      <view class="mx-4" :style="extCardStyle">
        <view class="flex items-center" style="gap: 8px; margin-bottom: 8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
          <text :style="extTitleStyle">{{ w.externalTitle }}</text>
        </view>
        <text class="block" :style="extBodyStyle">{{ w.externalBody }}</text>
        <view class="grid grid-cols-2" style="gap: 8px; margin-top: 12px">
          <view class="flex items-center justify-center active:opacity-70" :style="extBtnStyle" role="button" tabindex="0" :aria-label="fmt(t.uiChrome.copyHashFor, { target: 'Etherscan' })" @click.stop="copyHash">
            <text>Etherscan</text>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 4px"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
          </view>
          <view class="flex items-center justify-center active:opacity-70" :style="extBtnStyle" role="button" tabindex="0" :aria-label="fmt(t.uiChrome.copyHashFor, { target: 'TRONScan' })" @click.stop="copyHash">
            <text>TRONScan</text>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 4px"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
          </view>
        </view>
      </view>

      <text class="block mx-4 text-center" :style="footerStyle">{{ w.footer }}</text>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, type CSSProperties } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import Stat from "@/components/tx/tx-stat.vue";
import Row from "@/components/tx/tx-row.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";

const t = useT();
const w = computed(() => t.value.tx);
const hash = ref("");
const copyState = ref<"idle" | "copied" | "failed">("idle");
let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

onLoad((options) => {
  hash.value = options?.hash ?? "";
});

function hashSeed(h: string): number {
  let acc = 0x811c9dc5;
  for (let i = 0; i < h.length; i++) {
    acc ^= h.charCodeAt(i);
    acc = Math.imul(acc, 0x01000193);
  }
  return acc >>> 0;
}
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4_294_967_296;
  };
}
function makeAddress(rng: () => number): string {
  const hex = "0123456789abcdef";
  let out = "0x";
  for (let i = 0; i < 40; i++) out += hex[Math.floor(rng() * 16)];
  return out;
}

// Deterministic mock values derived from the hash (recomputed when hash changes).
const derived = computed(() => {
  const rng = makeRng(hashSeed(hash.value));
  return {
    blockNumber: 21_000_000 + Math.floor(rng() * 50_000),
    gasUsedGwei: (10 + rng() * 30).toFixed(2),
    valueUSDT: (50 + rng() * 9_950).toFixed(2),
    fromAddr: makeAddress(rng),
    toAddr: makeAddress(rng),
    contract: makeAddress(rng),
    confirmations: 1 + Math.floor(rng() * 145),
    minutesAgo: 1 + Math.floor(rng() * 1_440),
  };
});

const blockNumber = computed(() => derived.value.blockNumber);
const gasUsedGwei = computed(() => derived.value.gasUsedGwei);
const valueUSDT = computed(() => derived.value.valueUSDT);
const fromAddr = computed(() => derived.value.fromAddr);
const toAddr = computed(() => derived.value.toAddr);
const contract = computed(() => derived.value.contract);
const confirmations = computed(() => derived.value.confirmations);
const ageLabel = computed(() => fmt(w.value.minutesAgo, { n: derived.value.minutesAgo }));
const copyButtonText = computed(() =>
  copyState.value === "copied" ? w.value.hashCopied :
  copyState.value === "failed" ? w.value.hashCopyFailed :
  w.value.copy,
);

function trunc(addr: string): string {
  return `${addr.slice(0, 14)}…${addr.slice(-6)}`;
}
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Try uni fallback below.
  }
  return new Promise((resolve) => {
    try {
      uni.setClipboardData({
        data: text,
        showToast: false,
        success: () => resolve(true),
        fail: () => resolve(false),
      });
    } catch {
      resolve(false);
    }
  });
}

function resetCopyStateSoon() {
  if (copyResetTimer) clearTimeout(copyResetTimer);
  copyResetTimer = setTimeout(() => {
    copyState.value = "idle";
    copyResetTimer = null;
  }, 1800);
}

async function copyHash() {
  const ok = await writeClipboard(hash.value);
  copyState.value = ok ? "copied" : "failed";
  if (ok) toast.success(w.value.hashCopied);
  else toast.error(w.value.hashCopyFailed);
  resetCopyStateSoon();
}

onUnmounted(() => {
  if (copyResetTimer) clearTimeout(copyResetTimer);
});

// De-carded: the page-floor emerald radial glow + green-black gradient + emerald
// border (all hardcoded hex) are dropped — the tx record now sits in a flat
// surface container (form b). "Confirmed" reads from the green check + label +
// success-tinted confirmations stat, no decorative aura needed.
const heroStyle: CSSProperties = {
  borderRadius: "16px",
  padding: "16px",
  background: "var(--v5-surface)",
};
const confirmedStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", letterSpacing: "0.16em", color: "var(--v5-success)" };
const hashStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", color: "var(--v5-ink-3)", wordBreak: "break-all" };
// Nested copy chip — soft surface-2 fill lifts it off the surface hero, no border.
const copyBtnStyle: CSSProperties = {
  marginTop: "8px",
  display: "inline-flex",
  // 《07》tap≥44:原 4px 上下 padding 实测 79×22。padding 归零改用 minHeight + 居中,
  // chip 背景随之长高是预期的 —— 复制是主动作,值得一个正常大小的按钮。
  alignItems: "center",
  minHeight: "44px",
  padding: "0 10px",
  borderRadius: "6px",
  background: "var(--v5-surface-2)",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
// Tx fields — single-record container (form b: surface fill, no border); the
// TxRow hairlines are the internal dividers.
const detailsCardStyle: CSSProperties = { marginTop: "12px", borderRadius: "16px", background: "var(--v5-surface)", overflow: "hidden" };
// External-explorer explainer — de-carded to the page floor (ancillary guidance,
// not part of the receipt); content aligns to the mx-4 gutter, buttons keep their
// surface-2 fill.
const extCardStyle: CSSProperties = { marginTop: "12px" };
const extTitleStyle: CSSProperties = { fontSize: "13px", fontWeight: 600, color: "var(--v5-ink)" };
const extBodyStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.625 };
const extBtnStyle: CSSProperties = {
  height: "44px",
  borderRadius: "8px",
  background: "var(--v5-surface-2)",
  fontSize: "12px",
  color: "var(--v5-ink-2)",
};
const footerStyle: CSSProperties = { marginTop: "16px", fontSize: "12px", color: "var(--v5-ink-4)", lineHeight: 1.625 };
</script>
