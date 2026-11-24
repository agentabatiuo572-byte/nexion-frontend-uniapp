<!--
  On-chain transaction explorer (ported from Nexion-prototype/app/(main)/tx/[hash]/page.tsx).
  Mimics Etherscan/TRONScan for a given tx hash; all values are deterministically
  derived from the hash so the same tx renders identically. Reads `?hash=` (source's
  dynamic [hash] segment). copy → uni.setClipboardData. Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="padding-bottom: 24px">
      <SubPageHeader back="/pages/me/wallet-bills" :title="depositMode ? w.depositTitle : undefined" />

      <!-- A USDT top-up opened from Bills (plan C.4): the original deposit's network, hash and amounts; without the original
           record one line says the details are unavailable, never the ledger number in place of a hash. -->
      <view v-if="depositMode" class="tx-dep">
        <NxResultHead v-if="deposit" tone="success" :title="t.topupChrome.depositCredited" :live="false">
          <text class="tx-dep__amt">+{{ depositAmount(deposit.creditedUsdt) }}<text class="tx-dep__unit">{{ "\u00A0USDT" }}</text></text>
        </NxResultHead>
        <view class="tx-dep__card">
          <template v-if="deposit">
            <view class="tx-dep__row"><text class="tx-dep__k">{{ w.network }}</text><text class="tx-dep__v">{{ deposit.network === "ERC20" ? payCopy.erc20 : payCopy.bep20 }}</text></view>
            <view class="tx-dep__row"><text class="tx-dep__k">{{ w.grossAmount }}</text><text class="tx-dep__v tx-dep__num">{{ depositAmount(deposit.grossAmountUsdt) }}<text class="tx-dep__unit">{{ "\u00A0USDT" }}</text></text></view>
            <view class="tx-dep__row"><text class="tx-dep__k">{{ w.depositFee }}</text><text class="tx-dep__v tx-dep__num">{{ depositAmount(deposit.feeUsdt) }}<text class="tx-dep__unit">{{ "\u00A0USDT" }}</text></text></view>
            <view class="tx-dep__row"><text class="tx-dep__k">{{ w.creditedAmount }}</text><text class="tx-dep__v tx-dep__num">{{ depositAmount(deposit.creditedUsdt) }}<text class="tx-dep__unit">{{ "\u00A0USDT" }}</text></text></view>
            <view class="tx-dep__hash">
              <text class="tx-dep__k">{{ recoveryCopy.txHashLabel }}</text>
              <NxCodeValue class="tx-dep__code" :value="hash" :label="recoveryCopy.txHashLabel" full :copyable="false" />
              <view class="tx-hash-copy"><NxButton variant="text" size="small" :label="copyButtonText" @click="copyHash" /></view>
            </view>
          </template>
          <text v-else class="tx-dep__na">{{ w.detailUnavailableTitle }}</text>
        </view>
      </view>

      <view v-else-if="remoteApiEnabled" class="nx-glass-card mx-4" data-testid="tx-detail-hold" :style="holdStyle">
        <text class="block" :style="holdTitleStyle">{{ hash ? w.detailUnavailableTitle : hashProvided ? recoveryCopy.txInvalidTitle : recoveryCopy.txMissingTitle }}</text>
        <text class="block" :style="holdBodyStyle">{{ hash ? w.detailUnavailableBody : hashProvided ? recoveryCopy.txInvalidBody : recoveryCopy.txMissingBody }}</text>
        <view v-if="hash" style="margin-top: 16px">
          <text class="block" :style="holdBodyStyle">{{ recoveryCopy.txHashLabel }}</text>
          <NxCodeValue class="tx-retained-hash" :value="hash" :label="recoveryCopy.txHashLabel" full :copyable="false" />
          <view class="tx-hash-copy"><NxButton variant="text" size="small" :label="copyButtonText" @click="copyHash" /></view>
        </view>
        <view class="nx-card-footer tx-bills-footer"><view class="nx-card-action" role="link" tabindex="0" @click="viewBills" @keydown.enter.prevent="viewBills" @keydown.space.prevent="viewBills"><text class="nx-after-arrow">{{ recoveryCopy.viewBills }}</text></view></view>
      </view>

      <template v-else>

      <!-- Status hero — single-record container (form b: surface fill, no border) -->
      <view class="nx-glass-card mx-4" :style="heroStyle">
        <view class="flex items-center" style="gap: 8px; margin-bottom: 8px">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" /></svg>
          <text :style="confirmedStyle">{{ w.confirmed }}</text>
        </view>
        <NxCodeValue class="tx-hero-hash" :value="hash" :label="recoveryCopy.txHashLabel" full :copyable="false" />
        <view class="tx-hash-copy"><NxButton variant="text" size="small" :label="copyButtonText" @click="copyHash" /></view>
        <view class="grid grid-cols-3 text-center" style="gap: 8px; margin-top: 12px">
          <Stat :label="w.block" :value="`#${blockNumber.toLocaleString()}`" />
          <Stat :label="w.confirmations" :value="String(confirmations)" tint="var(--v5-success)" />
          <Stat :label="w.age" :value="ageLabel" />
        </view>
      </view>

      <!-- Tx details -->
      <view class="nx-glass-card mx-4" :style="detailsCardStyle">
        <Row :label="w.from" :value="trunc(fromAddr)" mono />
        <Row :label="w.to" :value="trunc(toAddr)" mono />
        <Row :label="w.contract" :value="trunc(contract)" mono />
        <Row :label="w.value" :value="`${valueUSDT} USDT`" tint="var(--v5-brand)" bold />
        <Row :label="w.gas" :value="gasLine" mono />
        <Row :label="w.network" :value="networkLine" last />
      </view>

      <!-- External link explainer -->
      <view class="mx-4" :style="extCardStyle">
        <view class="flex items-center" style="gap: 8px; margin-bottom: 8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
          <text :style="extTitleStyle">{{ w.externalTitle }}</text>
        </view>
        <text class="block" :style="extBodyStyle">{{ w.externalBody }}</text>
        <view style="margin-top: 12px">
          <view class="flex items-center justify-center active:opacity-70" :style="extBtnStyle" role="button" tabindex="0" :aria-label="fmt(t.uiChrome.copyHashFor, { target: explorerName })" @click.stop="copyHash">
            <text>{{ explorerName }}</text>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 4px"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
          </view>
        </view>
      </view>

      </template>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { formatAmount } from "@/lib/amount-display";
import { computed, onUnmounted, ref, type CSSProperties } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import NxCodeValue from "@/components/ui/nx-code-value.vue";
import NxButton from "@/components/ui/nx-button.vue";
import Stat from "@/components/tx/tx-stat.vue";
import Row from "@/components/tx/tx-row.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";
import { fundsServerEnabled, remoteApiEnabled, sessionVault } from "@/api/runtime";
import { useBills } from "@/store/bills";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import { binarySessionReady } from "@/lib/binary-session-ready";
import { navTo, takeNavigationQuery } from "@/lib/route";
import { validatedTransactionHash } from "@/lib/transaction-hash-input";
import { useEntryRecoveryCopy } from "@/i18n/entry-recovery";
import NxResultHead from "@/components/ui/nx-result-head.vue";
import { formatGroupedAmount } from "@/lib/amount-display";
import { purchasePaymentCopy } from "@/lib/purchase-payment-copy";
import { useLocaleStore } from "@/store/locale";

const t = useT();
const recoveryCopy = useEntryRecoveryCopy();
const w = computed(() => t.value.tx);
const queryHash = ref("");
const hashProvided = ref(false);
const copyBusy = ref(false);
let copyVersion = 0;
const copyState = ref<"idle" | "copied" | "failed">("idle");
let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

// 调用方可带真实交易参数(充值记录行 → 金额/网络/确认数/收款地址/时间);
// query 不可信,逐项校验后才用,无参/非法回退 hash 派生种子(既有行为)。
const NET_LINES: Record<string, string> = {
  TRC20: "Tron Network (TRC20)",
  BEP20: "BNB Smart Chain (BEP20)",
  ERC20: "Ethereum Mainnet (ERC20)",
};
const qAmount = ref<string | null>(null);
const qConfs = ref<number | null>(null);
const qNet = ref<string | null>(null);
const qTo = ref<string | null>(null);
const qAgeMin = ref<number | null>(null);
const app = useApp();
const auth = useAuth();
const bills = useBills();
const depositMode = ref(false);
const billId = ref("");
const billAccountKey = ref("");
const billAccountEpoch = ref(-1);
const depositBill = computed(() => {
  if (!depositMode.value || app.accountKey !== billAccountKey.value || app.accountBindingEpoch !== billAccountEpoch.value
      || !binarySessionReady({ remote: fundsServerEnabled, authenticated: auth.isAuthenticated, accountId: auth.accountId,
        appAccountKey: app.accountKey, sessionUserId: sessionVault.read()?.user.userId ?? null })) return;
  return bills.findChainTopup(billAccountKey.value, billId.value);
});
const deposit = computed(() => depositBill.value?.deposit ?? null);
const hash = computed(() => depositMode.value ? deposit.value?.txHash ?? "" : queryHash.value);
const locale = useLocaleStore();
const payCopy = computed(() => purchasePaymentCopy(locale.code));
const depositAmount = (value: string) => formatGroupedAmount(value, "full");

onLoad((options) => {
  copyVersion += 1;
  copyState.value = "idle";
  copyBusy.value = false;
  if (copyResetTimer) clearTimeout(copyResetTimer);
  const pending = new URLSearchParams(takeNavigationQuery("/pages/tx/hash"));
  depositMode.value = (options?.src ?? pending.get("src")) === "deposit";
  if (depositMode.value) {
    billAccountKey.value = app.accountKey;
    billAccountEpoch.value = app.accountBindingEpoch;
    billId.value = options?.billId ?? pending.get("billId") ?? "";
    return;
  }
  hashProvided.value = typeof options?.hash === "string" && !!options.hash.trim();
  queryHash.value = validatedTransactionHash(options?.hash);
  const amt = String(options?.amount ?? "");
  qAmount.value = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(amt) && Number(amt) > 0 ? amt : null;
  const confs = parseInt(String(options?.confs ?? ""), 10);
  qConfs.value = Number.isFinite(confs) && confs >= 0 && confs <= 10_000 ? confs : null;
  qNet.value = typeof options?.net === "string" && options.net in NET_LINES ? options.net : null;
  qTo.value = typeof options?.to === "string" && options.to.length >= 10 ? options.to : null;
  const age = parseInt(String(options?.age ?? ""), 10);
  qAgeMin.value = Number.isFinite(age) && age >= 0 ? Math.max(1, age) : null;

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
function makeAddress(rng: () => number, tron: boolean): string {
  const hex = "0123456789abcdef";
  if (tron) {
    // TRON 地址形态:T + 33 位(与充值专属地址同款近似 base58 大写)。
    let s = "T";
    for (let i = 0; i < 33; i++) s += hex[Math.floor(rng() * 16)].toUpperCase();
    return s;
  }
  let out = "0x";
  for (let i = 0; i < 40; i++) out += hex[Math.floor(rng() * 16)];
  return out;
}

// Deterministic mock values derived from the hash (recomputed when hash changes);
// real params passed by the caller (deposit rows) take precedence per field.
const derived = computed(() => {
  const rng = makeRng(hashSeed(hash.value));
  const tron = qNet.value === "TRC20";
  return {
    blockNumber: 21_000_000 + Math.floor(rng() * 50_000),
    gasUsedGwei: (10 + rng() * 30).toFixed(2),
    valueUSDT: (50 + rng() * 9_950).toFixed(2),
    fromAddr: makeAddress(rng, tron),
    toAddr: makeAddress(rng, tron),
    contract: makeAddress(rng, tron),
    confirmations: 1 + Math.floor(rng() * 145),
    minutesAgo: 1 + Math.floor(rng() * 1_440),
  };
});

const blockNumber = computed(() => derived.value.blockNumber);
const gasUsedGwei = computed(() => derived.value.gasUsedGwei);
const valueUSDT = computed(() => formatAmount(qAmount.value ?? derived.value.valueUSDT, 6));
const fromAddr = computed(() => derived.value.fromAddr);
const toAddr = computed(() => qTo.value ?? derived.value.toAddr);
const contract = computed(() => derived.value.contract);
const confirmations = computed(() => qConfs.value ?? derived.value.confirmations);
const networkLine = computed(() => (qNet.value ? NET_LINES[qNet.value] : "Ethereum Mainnet (chain id 1)"));
// 浏览器与费用单位随网络(TRC20=TRONScan/Energy · BEP20=BscScan/Gwei · ERC20/无参=Etherscan/Gwei)。
const explorerName = computed(() => (qNet.value === "TRC20" ? "TRONScan" : qNet.value === "BEP20" ? "BscScan" : "Etherscan"));
const gasLine = computed(() =>
  qNet.value === "TRC20" ? `${Math.round(parseFloat(gasUsedGwei.value) * 950)} Energy` : `${gasUsedGwei.value} Gwei`,
);
const ageLabel = computed(() => fmt(w.value.minutesAgo, { n: qAgeMin.value ?? derived.value.minutesAgo }));
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
  if (!hash.value || copyBusy.value) return;
  const version = copyVersion;
  copyBusy.value = true;
  const ok = await writeClipboard(hash.value);
  if (version !== copyVersion) return;
  copyBusy.value = false;
  copyState.value = ok ? "copied" : "failed";
  if (ok) toast.success(w.value.hashCopied);
  else toast.error(w.value.hashCopyFailed);
  resetCopyStateSoon();
}

function viewBills() { navTo("/pages/me/wallet-bills"); }

onUnmounted(() => {
  copyVersion += 1;
  if (copyResetTimer) clearTimeout(copyResetTimer);
});

// De-carded: the page-floor emerald radial glow + green-black gradient + emerald
// border (all hardcoded hex) are dropped — the tx record now sits in a flat
// surface container (form b). "Confirmed" reads from the green check + label +
// success-tinted confirmations stat, no decorative aura needed.
const heroStyle: CSSProperties = { boxShadow: "var(--nx-glass-edge)",
  borderRadius: "var(--nx-glass-radius)",
  padding: "16px",
  background: "var(--nx-glass-fill)",
};
const confirmedStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", letterSpacing: "0.16em", color: "var(--v5-success-ink)" };
// Tx fields — single-record container (form b: surface fill, no border); the
// TxRow hairlines are the internal dividers.
const detailsCardStyle: CSSProperties = { boxShadow: "var(--nx-glass-edge)", marginTop: "12px", borderRadius: "var(--nx-glass-radius)", background: "var(--nx-glass-fill)", overflow: "hidden" };
// External-explorer explainer — de-carded to the page floor (ancillary guidance,
// not part of the receipt); content aligns to the mx-4 gutter, buttons take the
// surface fill (L1 = the layer that sits on the page floor).
const extCardStyle: CSSProperties = { marginTop: "12px" };
const extTitleStyle: CSSProperties = { fontSize: "13px", fontWeight: 600, color: "var(--v5-ink)" };
const extBodyStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.625 };
const extBtnStyle: CSSProperties = {
  height: "44px",
  borderRadius: "8px",
  // 外链按钮所在的 extCard 已去壳(无背景)→ 按钮直接贴页面底,用 L1 surface;surface-2 在亮色下与页面底几乎同色
  background: "var(--v5-surface)",
  fontSize: "12px",
  color: "var(--v5-ink-2)",
};
const holdStyle: CSSProperties = { boxShadow: "var(--nx-glass-edge)", padding: "16px", borderRadius: "var(--nx-glass-radius)", background: "var(--nx-glass-fill)" };
const holdTitleStyle: CSSProperties = { fontSize: "var(--ui-type-card-title)", fontWeight: 600, color: "var(--v5-ink)" };
const holdBodyStyle: CSSProperties = { marginTop: "6px", fontSize: "var(--ui-type-list-subtitle)", lineHeight: "19px", color: "var(--v5-ink-3)" };


</script>

<style scoped>
/* The retained hash stays fully visible: its own full-width monospace block, wrapping evenly (NxCodeValue full); the copy button below copies it. */
.tx-retained-hash, .tx-hero-hash { margin-top: 6px; font-size: 12px; line-height: 18px; color: var(--v5-ink-3); user-select: text; }
/* Copy is an in-place action: a text button under the hash, at its right end (03 §3.1). */
.tx-hash-copy { display: flex; justify-content: flex-end; margin-top: 4px; }
/* The way on from this card is its footer action into the next page (03 §3.1 P-67), not a private chip. */
.tx-bills-footer { margin-top: 12px; }
/* Top-up detail: result head (03 §3.6.1) with the credited amount, then one solid facts card (1.1.2). */
.tx-dep { padding: var(--v5-space-2) var(--v5-space-4) 0; }
.tx-dep__amt { display: block; margin-top: var(--v5-space-3); color: var(--v5-success-ink); font: 500 var(--ui-type-display-title)/var(--ui-type-display-title-lh) var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tx-dep__unit { color: var(--v5-ink-3); font: 500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); letter-spacing: 0; }
.tx-dep__card { margin-top: var(--v5-space-6); padding: var(--v5-space-1) var(--v5-space-4); border-radius: var(--ui-radius-surface); background: var(--v5-surface); }
[data-theme="light"] .tx-dep__card { box-shadow: var(--v5-glass-shadow); }
.tx-dep__row { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--v5-space-1) var(--v5-space-3); padding: var(--v5-space-3) 0; }
.tx-dep__row + .tx-dep__row, .tx-dep__na + .tx-dep__row, .tx-dep__row + .tx-dep__hash { border-top: 1px solid var(--v5-border); }
.tx-dep__k { display: block; color: var(--v5-ink-3); font: var(--ui-type-list-subtitle-weight, 400) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); }
.tx-dep__v { margin-left: auto; color: var(--v5-ink); font: 500 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); white-space: nowrap; }
.tx-dep__num { font-family: var(--font-amount); font-variant-numeric: tabular-nums; }
.tx-dep__na { display: block; padding: var(--v5-space-3) 0; color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.tx-dep__hash { padding: var(--v5-space-3) 0 var(--v5-space-1); }
.tx-dep__code { margin-top: var(--v5-space-1); color: var(--v5-ink); font-size: var(--ui-type-list-subtitle); line-height: var(--ui-type-list-subtitle-lh); user-select: text; }
[role="button"][aria-disabled="true"] { opacity: 0.5; }
[tabindex="0"]:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
</style>
