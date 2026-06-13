<!--
  Staking Vault — 4-tier APY lock pool (ported from
  Nexion-prototype/app/(main)/staking/page.tsx).

  tech-money-card hero (aurora + grid + big $ + delta + 2-col) → vault picker
  (4 rows, sheet on tap) → CompoundCalculator → my positions → variable-APY
  notice. Wrapped in <AppChassis active="me"> (reached from /me/wallet). The
  source's chassis-level StakingSheetHost is folded into <StakeSheet
  v-model:open :term>. claim / early-withdraw compose staking + app.creditBalance
  + bills.add in the page handlers.
-->
<template>
  <AppChassis active="me">
    <CardStagger style="padding-bottom: 24px">
      <SubPageHeader back="/pages/me/wallet" />

      <!-- Top-right "How it works →" pill -->
      <view class="px-4 flex items-center justify-end" style="padding-top: 8px; padding-bottom: 8px">
        <view class="inline-flex items-center active:opacity-80" :style="howPillStyle" @click="goHowItWorks">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
          <text style="margin: 0 6px">{{ t.stakingV3.howItWorksEntry }}</text>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </view>
      </view>

      <view class="px-4" style="display: flex; flex-direction: column; gap: 12px">
        <!-- Hero: tech-money-card -->
        <view class="relative overflow-hidden" :style="heroStyle">
          <view aria-hidden class="gen-anim" :style="auroraStyle" />
          <view aria-hidden :style="gridStyle" />

          <view class="relative">
            <!-- meta-row -->
            <view class="flex items-center justify-between" style="margin-bottom: 8px">
              <text :style="metaLabelStyle">{{ t.stakingV3.totalLocked }}</text>
              <text v-if="activePositions.length > 0" :style="earningChipStyle">earning</text>
            </view>

            <!-- big -->
            <view class="flex items-baseline" style="gap: 8px">
              <text class="tabular-nums" :style="bigDollarStyle">$</text>
              <text class="tabular-nums" :style="bigNumStyle">{{ totalLockedText }}</text>
            </view>

            <!-- delta -->
            <view class="tabular-nums" :style="deltaStyle">
              <text>+${{ todayAccruedText }} today</text>
              <text style="color: var(--v5-ink-4)"> · {{ activePositions.length }} active</text>
              <text v-if="maturedCount > 0" style="color: var(--v5-ink-4)"> · </text>
              <text v-if="maturedCount > 0" style="color: var(--v5-brand-2); font-weight: 500">{{ maturedCount }} matured</text>
            </view>

            <!-- 2-col -->
            <view class="grid grid-cols-2" :style="belowGridStyle">
              <view>
                <text class="block" :style="statKStyle">{{ t.stakingV3.accrued }}</text>
                <text class="block tabular-nums" :style="statVStyle('var(--v5-success)')">${{ totalAccruedText }}</text>
              </view>
              <view>
                <text class="block" :style="statKStyle">{{ t.stakingV3.avgApy }}</text>
                <text class="block tabular-nums" :style="statVStyle(totalLocked > 0 ? 'var(--v5-success)' : 'var(--v5-ink-3)')">{{ avgApyText }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- Section: vault picker -->
        <view class="flex items-center" :style="secHeaderStyle">
          <text :style="secTitleStyle">{{ t.stakingV3.stakePlans }}</text>
        </view>
        <view :style="vaultCardStyle">
          <VaultRow
            v-for="(term, i) in TERMS"
            :key="term"
            :term="term"
            :apy="STAKING_APY[term]"
            :penalty="STAKING_PENALTY[term]"
            :min="STAKING_MIN[term]"
            :blurb="t.stakingV3.blurb[term]"
            :penalty-suffix="t.stakingV3.penaltySuffix"
            :ribbon="RIBBONS[term]"
            :is-last="i === TERMS.length - 1"
            @open="openSheet(term)"
          />
        </view>

        <!-- CompoundCalculator -->
        <CompoundCalculator />

        <!-- My positions -->
        <view class="flex items-center" :style="secHeaderStyle">
          <text :style="secTitleStyle">{{ t.stakingV3.positions }}<text :style="countStyle"> {{ positions.length }}</text></text>
        </view>
        <view style="display: flex; flex-direction: column; gap: 10px">
          <text v-if="positions.length === 0" class="block text-center" :style="emptyStyle">{{ t.stakingV3.noPositions }}</text>
          <StakePositionRow
            v-for="p in positions"
            v-else
            :key="p.id"
            :p="p"
            :now="nowTs"
            @claim="handleClaim(p)"
            @early-withdraw="handleEarlyWithdraw(p)"
          />
        </view>

        <!-- Variable-APY notice -->
        <text class="block" :style="noticeStyle">⚠️ {{ t.stakingV3.apyVariableNotice }}</text>
      </view>
    </CardStagger>

    <!-- Sheet (folds StakingSheetHost) -->
    <StakeSheet v-model:open="sheetOpen" :term="sheetTerm" />
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import CardStagger from "@/components/card-stagger.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import VaultRow from "@/components/staking/vault-row.vue";
import StakePositionRow from "@/components/staking/position-row.vue";
import CompoundCalculator from "@/components/staking/compound-calculator.vue";
import StakeSheet from "@/components/staking/stake-sheet.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import {
  useStaking,
  STAKING_APY,
  STAKING_PENALTY,
  type StakingTerm,
  type StakingPosition,
} from "@/store/staking";
import { confirm as uiConfirm, toast } from "@/store/ui";

const ONE_DAY_MS = 86400 * 1000;
const TERMS: StakingTerm[] = [30, 90, 180, 365];
const STAKING_MIN: Record<StakingTerm, number> = { 30: 100, 90: 500, 180: 1000, 365: 5000 };
const RIBBONS: Partial<Record<StakingTerm, { label: string; tone: "cyan" | "gold" }>> = {
  180: { label: "Most popular", tone: "cyan" },
  365: { label: "Highest yield", tone: "gold" },
};

const t = useT();
const app = useApp();
const bills = useBills();
const staking = useStaking();

const sheetOpen = ref(false);
const sheetTerm = ref<StakingTerm | null>(null);

// Tick every 4s: re-mature positions + refresh accrual/progress.
const nowTs = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  staking.markMatured();
  timer = setInterval(() => {
    staking.markMatured();
    nowTs.value = Date.now();
  }, 4000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const positions = computed(() => staking.positions);
const activePositions = computed(() => positions.value.filter((p) => p.status === "active"));
const maturedCount = computed(() => positions.value.filter((p) => p.status === "matured").length);
const totalLocked = computed(() => activePositions.value.reduce((s, p) => s + p.amountUSDT, 0));

const totalAccrued = computed(() => {
  void nowTs.value;
  const now = Date.now();
  return positions.value
    .filter((p) => p.status === "active" || p.status === "matured")
    .reduce((s, p) => {
      const elapsed = Math.min(now, p.unlockTs) - p.startTs;
      const yrs = elapsed / (365 * ONE_DAY_MS);
      return s + p.amountUSDT * p.apy * yrs;
    }, 0);
});
const todayAccrued = computed(() => activePositions.value.reduce((s, p) => s + (p.amountUSDT * p.apy) / 365, 0));
const avgAPY = computed(() => {
  if (totalLocked.value === 0) return 0;
  const w = activePositions.value.reduce((s, p) => s + p.amountUSDT * p.apy, 0);
  return w / totalLocked.value;
});

const totalLockedText = computed(() => totalLocked.value.toFixed(2));
const todayAccruedText = computed(() => todayAccrued.value.toFixed(2));
const totalAccruedText = computed(() => totalAccrued.value.toFixed(2));
const avgApyText = computed(() => (totalLocked.value > 0 ? `${(avgAPY.value * 100).toFixed(1)}%` : "—"));

function openSheet(term: StakingTerm) {
  sheetTerm.value = term;
  sheetOpen.value = true;
}
function goHowItWorks() {
  uni.navigateTo({ url: "/pages/staking/how-it-works", fail: () => {} });
}

async function handleEarlyWithdraw(p: StakingPosition) {
  const penaltyRate = STAKING_PENALTY[p.termDays];
  const penalty = (p.amountUSDT * penaltyRate).toFixed(2);
  const refund = (p.amountUSDT * (1 - penaltyRate)).toFixed(2);
  const ok = await uiConfirm({
    title: t.value.stakingV3.toast.earlyConfirmTitle,
    message: fmt(t.value.stakingV3.toast.earlyConfirmMessage, {
      penaltyPct: (penaltyRate * 100).toFixed(0),
      penalty,
      refund,
    }),
    danger: true,
    confirmLabel: t.value.stakingV3.toast.earlyConfirmCta,
  });
  if (!ok) return;
  // ⚠️ MOCK-ONLY CROSS-STORE MUTATION (NON-ATOMIC): unstake + credit + bill.
  const r = staking.earlyWithdraw(p.id);
  if (r.ok) {
    app.creditBalance(r.refund);
    bills.add({
      type: "unstake",
      symbol: "USDT",
      amount: r.refund,
      status: "posted",
      memo: `Stake early withdraw · ${p.id} (penalty $${r.penalty.toFixed(2)})`,
      ref: `STAKE-EW-${p.id}`,
    });
    toast.warn(
      t.value.stakingV3.toast.earlyDoneTitle,
      fmt(t.value.stakingV3.toast.earlyDoneSubtitle, {
        refund: r.refund.toFixed(2),
        penalty: r.penalty.toFixed(2),
      }),
    );
  }
}

function handleClaim(p: StakingPosition) {
  // ⚠️ MOCK-ONLY CROSS-STORE MUTATION (NON-ATOMIC): claim + credit + bill.
  const r = staking.claim(p.id);
  if (r.ok) {
    app.creditBalance(r.principal + r.interest);
    bills.add({
      type: "unstake",
      symbol: "USDT",
      amount: r.principal + r.interest,
      status: "posted",
      memo: `Stake claim · ${p.id} (interest $${r.interest.toFixed(2)})`,
      ref: `STAKE-CLAIM-${p.id}`,
    });
    toast.success(
      t.value.stakingV3.toast.claimedTitle,
      fmt(t.value.stakingV3.toast.claimedSubtitle, {
        total: (r.principal + r.interest).toFixed(2),
        interest: r.interest.toFixed(2),
      }),
    );
  }
}

// ── styles ──
const howPillStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 14px",
  borderRadius: "999px",
  background: "var(--v5-brand-soft)",
  fontFamily: "var(--font-v5)",
  fontSize: "12.5px",
  fontWeight: 500,
  color: "var(--v5-brand)",
  letterSpacing: "-0.005em",
  whiteSpace: "nowrap",
};
const heroStyle: CSSProperties = {
  padding: "18px",
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  boxShadow: "var(--v5-card-shadow-lift-strong)",
};
const auroraStyle: CSSProperties = {
  position: "absolute",
  inset: "-20%",
  background:
    "radial-gradient(40% 50% at 80% 20%, var(--v5-tech-cyan-soft) 0%, transparent 60%)," +
    "radial-gradient(40% 50% at 10% 80%, var(--v5-brand-soft) 0%, transparent 60%)," +
    "radial-gradient(35% 45% at 70% 90%, rgba(255,203,148,0.25) 0%, transparent 60%)",
  filter: "blur(8px)",
  pointerEvents: "none",
  opacity: 0.85,
  animation: "v5-aurora-drift 14s ease-in-out infinite",
};
const gridStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "linear-gradient(to right, rgba(19,20,26,0.04) 1px, transparent 1px)," +
    "linear-gradient(to bottom, rgba(19,20,26,0.04) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  pointerEvents: "none",
};
const metaLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  color: "var(--v5-ink-4)",
  letterSpacing: "0.02em",
};
const earningChipStyle: CSSProperties = {
  padding: "2px 8px",
  borderRadius: "999px",
  background: "var(--v5-tech-cyan-soft)",
  color: "var(--v5-tech-cyan)",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
};
const bigDollarStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "22px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
};
const bigNumStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "48px",
  fontWeight: 600,
  letterSpacing: "-0.034em",
  lineHeight: 1,
  color: "var(--v5-ink)",
  whiteSpace: "nowrap",
};
const deltaStyle: CSSProperties = {
  marginTop: "6px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  color: "var(--v5-success)",
};
const belowGridStyle: CSSProperties = {
  marginTop: "10px",
  paddingTop: "14px",
  borderTop: "1px dashed var(--v5-border-strong)",
  gap: "14px",
};
const statKStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  color: "var(--v5-ink-4)",
};
function statVStyle(tint: string): CSSProperties {
  return {
    fontFamily: "var(--font-v5)",
    fontWeight: 500,
    fontSize: "18px",
    letterSpacing: "-0.014em",
    color: tint,
    marginTop: "3px",
  };
}
const secHeaderStyle: CSSProperties = { margin: "10px 2px 0" };
const secTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  fontWeight: 600,
  letterSpacing: "-0.014em",
  color: "var(--v5-ink)",
};
const countStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
};
const vaultCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  padding: "0 16px",
};
const emptyStyle: CSSProperties = {
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  padding: "24px 16px",
  fontSize: "12.5px",
  color: "var(--v5-ink-3)",
};
const noticeStyle: CSSProperties = {
  marginTop: "2px",
  padding: "12px",
  background: "var(--v5-warning-soft)",
  borderRadius: "10px",
  fontSize: "12px",
  color: "var(--v5-ink-2)",
  lineHeight: 1.45,
};
</script>
