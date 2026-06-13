<!--
  StakeSheet — customize-and-lock staking sheet (ported from
  Nexion-prototype/app/components/staking-sheet-host.tsx). uni has no chassis
  sheet host for sub-pages, so the sheet is embedded in staking.vue and toggled
  via `v-model:open` + a `term` prop. framer slide-up → CSS <transition>.

  Cross-store side-effect (架构铁律): submit composes app.debitBalance() +
  staking.stake() + bills.add() here, not in the store.
-->
<template>
  <view v-if="open && term !== null">
    <transition name="nx-sheet-fade">
      <view v-if="open" class="nx-sheet-backdrop" @click="emitClose" />
    </transition>
    <transition name="nx-sheet-slide">
      <view v-if="open" class="nx-sheet-panel" :style="panelStyle" @click.stop>
        <!-- Title row -->
        <view class="flex items-start justify-between" style="margin-bottom: 16px">
          <view>
            <text class="block" :style="titleStyle">{{ titleText }}</text>
            <text class="block" :style="subtitleStyle">{{ subtitleText }}</text>
          </view>
          <view class="inline-flex items-center justify-center active:opacity-60" :style="closeBtnStyle" @click="emitClose">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </view>
        </view>

        <!-- Amount input + presets -->
        <view :style="amountWrapStyle">
          <text class="block" :style="amountLabelStyle">{{ t.stakingV3.sheet.amount }}</text>
          <view class="flex items-baseline" style="margin-top: 8px; gap: 8px">
            <text class="shrink-0" :style="dollarStyle">$</text>
            <input class="nx-staking-sheet-amount-input flex-1 min-w-0 tabular-nums" :style="inputStyle" type="text" inputmode="decimal" :value="String(amount)" @input="onAmountInput" />
            <text class="shrink-0" :style="usdtStyle">USDT</text>
          </view>
          <!-- Presets -->
          <view class="grid grid-cols-4" style="margin-top: 16px; gap: 8px">
            <view v-for="p in PRESETS" :key="p" class="active:opacity-80" :style="presetStyle(p)" @click="amount = p">
              <text>${{ p.toLocaleString() }}</text>
            </view>
          </view>
          <!-- Balance / Max -->
          <view class="flex items-center justify-between" :style="balanceRowStyle">
            <text class="tabular-nums">
              <text>{{ t.stakingV3.sheet.balance }} </text>
              <text style="color: var(--v5-ink); font-weight: 500">${{ balanceText }}</text>
            </text>
            <text class="nx-staking-sheet-max-cta" :style="maxStyle" @click="setMax">{{ t.stakingV3.sheet.max }}</text>
          </view>
        </view>

        <!-- Projection -->
        <view :style="projectionStyle">
          <view class="flex items-center justify-between">
            <text :style="rowLabelStyle">{{ t.stakingV3.sheet.principal }}</text>
            <text class="tabular-nums" :style="rowValStyle">${{ principalText }}</text>
          </view>
          <view class="flex items-center justify-between">
            <text :style="rowLabelStyle">{{ interestLabel }}</text>
            <text class="tabular-nums" :style="rowValSuccessStyle">+${{ interestText }}</text>
          </view>
          <view class="flex items-center justify-between">
            <text :style="rowLabelStyle">{{ t.stakingV3.sheet.unlockDate }}</text>
            <text class="tabular-nums" :style="rowValStyle">{{ unlockDateText }}</text>
          </view>
          <view :style="dividerStyle" />
          <view class="flex items-center justify-between">
            <text :style="rowLabelStyle">{{ t.stakingV3.sheet.totalOnUnlock }}</text>
            <text class="tabular-nums" :style="rowValBoldStyle">${{ totalText }}</text>
          </view>
        </view>

        <!-- Submit -->
        <view class="nx-staking-sheet-submit-cta w-full inline-flex items-center justify-center active:opacity-85" :style="submitStyle" @click="submit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          <text>{{ ctaText }}</text>
        </view>
        <text class="block text-center" :style="noticeStyle">{{ lockedNoticeText }}</text>
      </view>
    </transition>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import { useStaking, STAKING_APY, STAKING_PENALTY, type StakingTerm } from "@/store/staking";
import { toast } from "@/store/ui";

const PRESETS = [100, 500, 1000, 5000];
const ONE_DAY_MS = 86400 * 1000;
const STAKING_MIN: Record<StakingTerm, number> = { 30: 100, 90: 500, 180: 1000, 365: 5000 };

const props = defineProps<{ open: boolean; term: StakingTerm | null }>();
const emit = defineEmits<{ "update:open": [boolean] }>();

const t = useT();
const app = useApp();
const bills = useBills();
const staking = useStaking();

const amount = ref(0);

// Seed the amount to the term's minimum each time the sheet opens.
watch(
  () => [props.open, props.term] as const,
  ([o, term]) => {
    if (o && term !== null) amount.value = STAKING_MIN[term];
  },
);

const titleText = computed(() => (props.term !== null ? fmt(t.value.stakingV3.sheet.title, { n: props.term }) : ""));
const subtitleText = computed(() =>
  props.term !== null
    ? fmt(t.value.stakingV3.sheet.subtitle, {
        apy: (STAKING_APY[props.term] * 100).toFixed(0),
        penalty: (STAKING_PENALTY[props.term] * 100).toFixed(0),
      })
    : "",
);
const interestLabel = computed(() =>
  props.term !== null ? fmt(t.value.stakingV3.sheet.interest, { n: props.term }) : "",
);
const balanceText = computed(() => app.user.usdtBalance.toFixed(2));
const principalText = computed(() => amount.value.toFixed(2));
const interestText = computed(() =>
  props.term !== null ? (amount.value * STAKING_APY[props.term] * (props.term / 365)).toFixed(2) : "0.00",
);
const unlockDateText = computed(() =>
  props.term !== null ? new Date(Date.now() + props.term * ONE_DAY_MS).toLocaleDateString() : "",
);
const totalText = computed(() =>
  props.term !== null ? (amount.value * (1 + STAKING_APY[props.term] * (props.term / 365))).toFixed(2) : "0.00",
);
const ctaText = computed(() =>
  props.term !== null ? fmt(t.value.stakingV3.sheet.cta, { amount: amount.value.toFixed(2), n: props.term }) : "",
);
const lockedNoticeText = computed(() =>
  props.term !== null
    ? fmt(t.value.stakingV3.sheet.lockedNotice, { penalty: (STAKING_PENALTY[props.term] * 100).toFixed(0) })
    : "",
);

function onAmountInput(e: Event) {
  const raw = (e as unknown as { detail: { value: string } }).detail.value;
  amount.value = parseFloat(raw) || 0;
}
function setMax() {
  amount.value = Math.floor(app.user.usdtBalance);
}
function emitClose() {
  emit("update:open", false);
}

function submit() {
  const term = props.term;
  if (term === null) return;
  const min = STAKING_MIN[term];
  if (amount.value < min) {
    toast.error(t.value.stakingV3.toast.minAmount, fmt(t.value.stakingV3.toast.minAmountTerm, { min, n: term }));
    return;
  }
  if (!app.debitBalance(amount.value)) {
    toast.error(
      t.value.stakingV3.toast.insufficient,
      fmt(t.value.stakingV3.toast.insufficientSubtitle, { amount: app.user.usdtBalance.toFixed(2) }),
    );
    return;
  }
  // ⚠️ MOCK-ONLY CROSS-STORE MUTATION (NON-ATOMIC): debit + stake + bill.
  // PRODUCTION: POST /api/staking/open (PRD §9.11e) is one atomic transaction.
  staking.stake(amount.value, term);
  bills.add({
    type: "stake",
    symbol: "USDT",
    amount: -amount.value,
    status: "posted",
    memo: `Stake open · ${term}d @ ${(STAKING_APY[term] * 100).toFixed(0)}% APY`,
    ref: `STAKE-OPEN-${Date.now().toString(36).toUpperCase()}`,
  });
  toast.success(
    t.value.stakingV3.toast.stakeSuccess,
    fmt(t.value.stakingV3.toast.stakeSubtitle, { amount: amount.value, apy: STAKING_APY[term] * 100, n: term }),
  );
  emitClose();
}

const panelStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderTop: "1px solid var(--v5-border)",
  padding: "18px 16px calc(env(safe-area-inset-bottom) + 38px)",
};
const titleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "20px",
  fontWeight: 600,
  letterSpacing: "-0.018em",
  color: "var(--v5-ink)",
  lineHeight: 1.2,
};
const subtitleStyle: CSSProperties = {
  marginTop: "4px",
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  color: "var(--v5-ink-3)",
};
const closeBtnStyle: CSSProperties = { width: "40px", height: "40px", borderRadius: "999px", color: "var(--v5-ink-3)" };
const amountWrapStyle: CSSProperties = { background: "var(--v5-surface-2)", borderRadius: "16px", padding: "16px" };
const amountLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "12.5px",
  color: "var(--v5-ink-3)",
  fontWeight: 500,
};
const dollarStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "26px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "-0.022em",
};
const inputStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "48px",
  fontWeight: 600,
  letterSpacing: "-0.034em",
  lineHeight: 1,
  color: "var(--v5-ink)",
  background: "transparent",
};
const usdtStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "13.5px",
  color: "var(--v5-ink-3)",
};
function presetStyle(p: number): CSSProperties {
  const active = amount.value === p;
  return {
    height: "40px",
    borderRadius: "999px",
    fontFamily: "var(--font-v5)",
    fontSize: "13.5px",
    fontWeight: 500,
    background: active ? "var(--v5-brand)" : "var(--v5-surface)",
    color: active ? "var(--v5-ink)" : "var(--v5-ink-2)",
    border: active ? "1px solid var(--v5-brand)" : "1px solid var(--v5-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
const balanceRowStyle: CSSProperties = {
  marginTop: "12px",
  fontFamily: "var(--font-v5)",
  fontSize: "12.5px",
  color: "var(--v5-ink-3)",
};
const maxStyle: CSSProperties = { color: "var(--v5-brand)", fontWeight: 600, fontSize: "13px" };
const projectionStyle: CSSProperties = {
  marginTop: "12px",
  background: "var(--v5-surface-2)",
  borderRadius: "14px",
  padding: "16px",
  fontSize: "13.5px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};
const rowLabelStyle: CSSProperties = { color: "var(--v5-ink-3)" };
const rowValStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "13.5px",
  letterSpacing: "-0.005em",
  color: "var(--v5-ink)",
};
const rowValSuccessStyle: CSSProperties = { ...rowValStyle, color: "var(--v5-success)" };
const rowValBoldStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "18px",
  letterSpacing: "-0.014em",
  color: "var(--v5-ink)",
};
const dividerStyle: CSSProperties = { height: "1px", background: "var(--v5-border)" };
const submitStyle: CSSProperties = {
  marginTop: "16px",
  height: "50px",
  padding: "0 28px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  boxShadow: "var(--v5-spotlight-brand)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "15px",
  letterSpacing: "-0.005em",
};
const noticeStyle: CSSProperties = { marginTop: "12px", fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.45 };
</script>

<style scoped>
.nx-sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 79;
  background: rgba(8, 8, 12, 0.45);
  backdrop-filter: blur(8px);
}
.nx-sheet-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 80;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
}
.nx-sheet-fade-enter-active,
.nx-sheet-fade-leave-active {
  transition: opacity 0.24s cubic-bezier(0.32, 0.72, 0, 1);
}
.nx-sheet-fade-enter-from,
.nx-sheet-fade-leave-to {
  opacity: 0;
}
.nx-sheet-slide-enter-active {
  transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
}
.nx-sheet-slide-leave-active {
  transition: transform 0.24s cubic-bezier(0.32, 0.72, 0, 1);
}
.nx-sheet-slide-enter-from,
.nx-sheet-slide-leave-to {
  transform: translateY(100%);
}
</style>
