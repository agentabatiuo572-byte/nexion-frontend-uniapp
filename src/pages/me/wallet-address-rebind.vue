<!--
  WalletAddressRebind — 提现地址换绑(PAY-规格 [FEAT-PAY04] ②阳光2+异常1-4 / ④⑤⑥)。
  step1 新地址 + 网络 + 安全提示 → 「开始验证」建换绑单(verifying,30min 倒计时)→
  step2 $1 验证视图(平台验证地址 + QR + 三步指示,复用 KYC-Express 动画语汇)→
  服务端侦测到账(__nxDev.rebindVerified)→ 原子换绑成功态;异常:来源不符红字可重试 /
  超时 expired 可重新发起 / 7 天频控与在途提现单在 store 拦截。
  状态 server-canonical:页面只建单/取消/轮询,生效由 mock server 引擎(store _dev*)推进。
  壳与 wallet 子页同款:<AppChassis active="me"> + <SubPageHeader>。
-->
<template>
  <AppChassis active="me">
    <view style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/wallet-withdraw" :title="t.addrRebind.title" :subtitle="t.addrRebind.subtitle" />

      <!-- ── 未 KYC 空状态:无绑定可换 → 引导先完成钱包验证(⑤ 不白屏)── -->
      <view v-if="view === 'kyc'" class="mx-4" :style="kycGateStyle">
        <view class="flex items-start" style="gap: 10px">
          <view class="shrink-0 grid place-items-center" :style="kycGateIconStyle">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block" style="font-size: 13px; font-weight: 600; color: var(--v5-ink)">{{ t.walletV3.complianceHeroTitle }}</text>
            <text class="block" style="font-size: 12px; color: var(--v5-ink-3); margin-top: 4px; line-height: 1.4">{{ t.wallet.complianceGateBody }}</text>
          </view>
        </view>
        <view class="nx-rebind-kyc-cta mt-3 w-full grid place-items-center active:opacity-85" :style="kycGateCtaStyle" role="button" @click="goKyc">
          <text style="font-family: var(--font-v5); font-size: 13px; font-weight: 600">{{ t.walletV3.kycCta }}</text>
        </view>
      </view>

      <!-- ── step1:新地址 + 网络 + 安全提示 ── -->
      <view v-else-if="view === 'form'" class="mx-4" style="padding: 0 2px">
        <view><text class="font-mono-tabular" :style="metaLabelStyle">{{ t.addrRebind.newAddressLabel }}</text></view>
        <input
          class="nx-rebind-address-input mt-2 w-full font-mono"
          :style="addressInputStyle"
          type="text"
          :value="newAddress"
          :placeholder="addressPlaceholder"
          @input="onAddressInput"
        />
        <view v-if="addrError"><text class="block" :style="errorTextStyle">{{ t.addrRebind.invalidAddress }}</text></view>

        <view style="margin-top: 18px"><text class="font-mono-tabular" :style="metaLabelStyle">{{ t.addrRebind.networkLabel }}</text></view>
        <view class="flex" style="gap: 8px; margin-top: 8px">
          <view
            v-for="nw in NETWORKS"
            :key="nw.id"
            :class="['flex-1 flex flex-col items-center justify-center active:opacity-85', `nx-rebind-net-${nw.label.toLowerCase()}`]"
            :style="netChipStyle(nw.id)"
            role="button"
            :aria-selected="network === nw.id"
            @click="network = nw.id"
          >
            <text :style="netChipLabelStyle(nw.id)">{{ nw.label }}</text>
            <text v-if="nw.id === 'usdt-trc20'" :style="netChipTagStyle">{{ t.topupChrome.netRecommended }}</text>
          </view>
        </view>

        <!-- 安全提示(冻结 24h + 每 7 天一次;规格 ⑤ 默认态) -->
        <view class="flex" :style="warnlineStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" style="margin-top: 1px"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>
          <view class="flex-1 min-w-0"><text :style="warnTextStyle">{{ safetyNoteText }}</text></view>
        </view>

        <view
          class="nx-rebind-start-cta w-full grid place-items-center"
          :class="{ 'active:opacity-90 transition-opacity': canStart }"
          role="button"
          :aria-disabled="canStart ? 'false' : 'true'"
          :style="startCtaStyle"
          @click="startVerify"
        >
          <text :style="startCtaTextStyle">{{ t.addrRebind.startVerifyCta }}</text>
        </view>
        <view class="nx-rebind-cancel-link w-full grid place-items-center active:opacity-70" :style="ghostBtnStyle" role="button" @click="leave">
          <text :style="ghostTextStyle">{{ t.addrRebind.cancelCta }}</text>
        </view>
      </view>

      <!-- ── step2:$1 验证视图(verifying + 30min 倒计时)── -->
      <view v-else-if="view === 'verify'" class="mx-4 nx-step-in" style="padding: 0 2px">
        <view><text class="block text-center" :style="verifyTitleStyle">{{ t.addrRebind.verifyTitle }}</text></view>
        <view><text class="block text-center tabular-nums" :style="verifyAmtStyle">${{ REBIND_VERIFY_AMOUNT_USDT }}</text></view>
        <view class="flex items-center justify-center" style="margin-top: 6px; gap: 6px">
          <text :style="verifyRuleStyle">{{ t.addrRebind.verifyRule }}</text>
          <text class="tabular-nums" :style="countdownStyle">{{ countdownText }}</text>
        </view>

        <!-- 异常2:来源不符红字,可重试(窗口不中断) -->
        <view v-if="wrongSource" class="flex" :style="wrongSourceBoxStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" style="margin-top: 1px"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
          <view class="flex-1 min-w-0"><text :style="wrongSourceTextStyle">{{ t.addrRebind.wrongSource }}</text></view>
        </view>

        <!-- 平台验证地址 + QR(确定性点阵,seed = 平台验证地址;同 deposit pane 先例) -->
        <view :style="qrBoxStyle">
          <view :style="qrGridStyle" aria-hidden>
            <view v-for="(d, i) in qrCells" :key="i" :style="d ? qrDarkCellStyle : undefined" />
          </view>
        </view>
        <view style="margin-top: 10px">
          <text class="block text-center" :style="platformAddrLabelStyle">{{ t.addrRebind.platformAddrLabel }}</text>
          <text class="block text-center font-mono" :style="platformAddrStyle">{{ platformAddress }}</text>
        </view>

        <!-- 三步指示(复用 KYC-Express VerifyRow 语汇) -->
        <view style="margin-top: 18px" class="space-y-3">
          <VerifyRow :step="1" :label="t.addrRebind.stepSend" :done="true" />
          <VerifyRow :step="2" :label="t.addrRebind.stepDetect" :done="step2Done" />
          <VerifyRow :step="3" :label="t.addrRebind.stepEffective" :done="step3Done" :enabled="step2Done" />
        </view>

        <view class="nx-rebind-cancel-cta w-full grid place-items-center active:opacity-70" :style="ghostBtnStyle" role="button" @click="askCancel">
          <text :style="ghostTextStyle">{{ t.addrRebind.cancelCta }}</text>
        </view>
      </view>

      <!-- ── 超时 expired:可重新发起 ── -->
      <view v-else-if="view === 'expired'" class="mx-4 nx-step-in" style="padding: 0 2px">
        <view class="flex flex-col items-center" style="padding: 32px 0 0">
          <view class="grid place-items-center" :style="stateIconBoxStyle">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          </view>
          <view><text class="block text-center" :style="stateTitleStyle">{{ t.addrRebind.expiredTitle }}</text></view>
          <view><text class="block text-center" :style="stateBodyStyle">{{ t.addrRebind.expiredBody }}</text></view>
        </view>
        <view class="nx-rebind-restart-cta w-full grid place-items-center active:opacity-90" :style="primaryCtaStyle" role="button" @click="restart">
          <text :style="startCtaTextStyle">{{ t.addrRebind.restartCta }}</text>
        </view>
      </view>

      <!-- ── 成功态:新地址生效 + 旧地址失效 + 冻结说明 ── -->
      <view v-else class="mx-4 nx-step-in" style="padding: 0 2px">
        <view class="flex flex-col items-center" style="padding: 32px 0 0">
          <view class="grid place-items-center" :style="successIconBoxStyle">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" /></svg>
          </view>
          <view><text class="block text-center" :style="stateTitleStyle">{{ t.addrRebind.successTitle }}</text></view>
          <view><text class="block text-center" :style="stateBodyStyle">{{ t.addrRebind.successBody }}</text></view>
          <view style="margin-top: 14px" class="w-full">
            <view class="flex items-center justify-between" :style="successRowStyle">
              <text :style="successRowLabelStyle">{{ t.addrRebind.successNewAddr }}</text>
              <text class="font-mono tabular-nums" :style="successRowValStyle">{{ activatedAddressShort }}</text>
            </view>
          </view>
        </view>
        <view class="nx-rebind-done-cta w-full grid place-items-center active:opacity-90" :style="primaryCtaStyle" role="button" @click="finish">
          <text :style="startCtaTextStyle">{{ t.addrRebind.successCta }}</text>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, type CSSProperties } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import VerifyRow from "@/components/me/verify-row.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { navBack } from "@/lib/route";
import { confirm as uiConfirm, toast } from "@/store/ui";
import { useConfig } from "@/store/config";
import { useDeposits } from "@/store/deposits";
import { useWalletPairing } from "@/store/wallet-pairing";
import { mockServerNow } from "@/store/server-time";
import { fnv1a, mulberry32 } from "@/store/deposits-core";
import { formatClock, REBIND_VERIFY_AMOUNT_USDT } from "@/store/wallet-pairing-core";
import type { ChainDepositChannel } from "@/store/types";

const t = useT();
const pairing = useWalletPairing();
const dep = useDeposits();
const cfg = useConfig();

// ── 网络选择(标签为链名专有名词,非文案)──
const NETWORKS: { id: ChainDepositChannel; label: string }[] = [
  { id: "usdt-trc20", label: "TRC20" },
  { id: "usdt-bep20", label: "BEP20" },
  { id: "usdt-erc20", label: "ERC20" },
];

const newAddress = ref("");
const network = ref<ChainDepositChannel>("usdt-trc20");
const addrError = ref(false);
const addressPlaceholder = computed(() => (network.value === "usdt-trc20" ? "TR7NHq..." : "0x..."));
const canStart = computed(() => newAddress.value.trim().length > 0);
const safetyNoteText = computed(() =>
  fmt(t.value.addrRebind.safetyNote, { days: cfg.config.withdrawRules.rebindCooldownDays }),
);

function detailVal(e: Event): string {
  return (e as unknown as { detail: { value: string } }).detail.value;
}
function onAddressInput(e: Event) {
  newAddress.value = detailVal(e);
  addrError.value = false;
}

// ── 视图状态机(store 换绑单派生;成功态由生效动画收口)──
const order = computed(() => pairing.rebindOrder);
const localSuccess = ref(false);
const dismissedTerminal = ref(false);
const step2Done = ref(false);
const step3Done = ref(false);
const view = computed<"kyc" | "form" | "verify" | "expired" | "success">(() => {
  if (!pairing.walletPaired) return "kyc"; // 未 KYC 无绑定可换 → 引导态(不白屏不跳走)
  if (localSuccess.value) return "success";
  const o = order.value;
  if (o?.status === "verifying") return "verify";
  if (o?.status === "expired" && !dismissedTerminal.value) return "expired";
  return "form";
});
const wrongSource = computed(() => order.value?.lastError === "wrong-source");
/** 生效地址(成功态展示;order 已 active 时 = 新绑定地址)。 */
const activatedAddressShort = computed(() => {
  const a = pairing.activeBinding?.address ?? order.value?.address ?? "";
  return a.length > 20 ? `${a.slice(0, 10)}…${a.slice(-6)}` : a;
});

// 服务端生效(order verifying → active)→ 三步动画走完 → 成功态。
let stageTimers: ReturnType<typeof setTimeout>[] = [];
watch(
  () => order.value?.status,
  (s, prev) => {
    if (s === "active" && prev === "verifying") {
      step2Done.value = true;
      stageTimers.push(setTimeout(() => (step3Done.value = true), 700));
      stageTimers.push(setTimeout(() => (localSuccess.value = true), 1300));
    }
  },
);

// ── 30min 倒计时(server 时钟;归零后轮询收敛 expired)──
const nowTick = ref(mockServerNow());
let tickTimer: ReturnType<typeof setInterval> | undefined;
const countdownText = computed(() => {
  const o = order.value;
  if (!o) return "";
  return formatClock(o.expiresAt - nowTick.value);
});
onMounted(() => {
  tickTimer = setInterval(() => {
    nowTick.value = mockServerNow();
    const o = order.value;
    if (o?.status === "verifying" && nowTick.value > o.expiresAt) pairing.pollRebindOrder();
  }, 1000);
});
onUnmounted(() => {
  if (tickTimer) clearInterval(tickTimer);
  stageTimers.forEach((x) => clearTimeout(x));
  stageTimers = [];
});

onLoad(() => {
  pairing.pollRebindOrder(); // 冷开收敛陈旧 verifying(server-canonical 轮询形态)
});

// ── 动作 ──
function goKyc() {
  uni.navigateTo({ url: "/pages/me/wallet-topup?kyc=1", fail: () => {} });
}
function startVerify() {
  if (!canStart.value) return;
  const res = pairing.startRebind(newAddress.value, network.value);
  if (res.ok) {
    step2Done.value = false;
    step3Done.value = false;
    dismissedTerminal.value = false;
    return;
  }
  if (res.reason === "invalid-address") {
    addrError.value = true;
    return;
  }
  if (res.reason === "cooldown") {
    toast.error(fmt(t.value.addrRebind.cooldownBlocked, { days: cfg.config.withdrawRules.rebindCooldownDays }));
    return;
  }
  if (res.reason === "withdrawal-in-flight") {
    toast.error(t.value.addrRebind.inFlightBlocked);
    return;
  }
  // order-in-progress / 持久化写失败等其余分支:通用失败提示,不静默。
  toast.error(t.value.addrRebind.startFailed);
}

async function askCancel() {
  const ok = await uiConfirm({
    title: t.value.addrRebind.cancelConfirmTitle,
    message: t.value.addrRebind.cancelConfirmBody,
    icon: "warn",
    confirmLabel: t.value.addrRebind.cancelConfirmYes,
  });
  if (ok && pairing.cancelRebind()) {
    dismissedTerminal.value = true; // cancelled 终态 → 回表单
  }
}

function restart() {
  dismissedTerminal.value = true; // expired 单留存(终态禁再处置),表单重新发起新单
}

function leave() {
  navBack("/pages/me/wallet-withdraw");
}

function finish() {
  navBack("/pages/me/wallet-withdraw");
}

// ── 平台验证地址 + QR 点阵(同 deposit-usdt-pane 先例:确定性伪随机 + 定位角)──
// 验证收款地址复用账号专属充值地址(同账号同网络恒定;PROD server 派发)。
const platformAddress = computed(() => {
  const nw = order.value?.network ?? network.value;
  return dep.depositAddress(nw);
});
const QR_N = 21;
function finderDark(dx: number, dy: number): boolean {
  const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
  return ring === 3 || ring <= 1;
}
const qrCells = computed<boolean[]>(() => {
  const rnd = mulberry32(fnv1a(platformAddress.value || "nexgrid"));
  const cells: boolean[] = [];
  for (let cy = 0; cy < QR_N; cy++) {
    for (let cx = 0; cx < QR_N; cx++) {
      const inTL = cx < 7 && cy < 7;
      const inTR = cx >= QR_N - 7 && cy < 7;
      const inBL = cx < 7 && cy >= QR_N - 7;
      if (inTL) cells.push(finderDark(cx, cy));
      else if (inTR) cells.push(finderDark(cx - (QR_N - 7), cy));
      else if (inBL) cells.push(finderDark(cx, cy - (QR_N - 7)));
      else cells.push(rnd() > 0.52);
    }
  }
  return cells;
});

// ── styles ──
// 未 KYC 引导态(withdraw 页 KYC gate 同款语汇)。
const kycGateStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--v5-brand-2) 10%, transparent)",
  borderRadius: "16px",
  padding: "16px",
};
const kycGateIconStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "12px",
  background: "color-mix(in srgb, var(--v5-brand-2) 20%, transparent)",
};
const kycGateCtaStyle: CSSProperties = {
  height: "48px",
  borderRadius: "999px",
  background: "var(--v5-brand-2)",
  color: "var(--v5-ink)",
};
const metaLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
};
// Recessed input idiom(de-card 白名单:surface-3 填充零描边)。
const addressInputStyle: CSSProperties = {
  width: "100%",
  minHeight: "48px",
  background: "var(--v5-surface-3)",
  borderRadius: "12px",
  padding: "12px",
  boxSizing: "border-box",
  fontSize: "13px",
  color: "var(--v5-ink)",
};
const errorTextStyle: CSSProperties = {
  marginTop: "6px",
  fontSize: "12px",
  color: "var(--v5-danger)",
  lineHeight: 1.4,
};
function netChipStyle(id: ChainDepositChannel): CSSProperties {
  const on = network.value === id;
  return {
    minHeight: "56px",
    borderRadius: "16px",
    gap: "2px",
    padding: "8px 6px",
    background: on ? "var(--v5-brand-soft)" : "var(--v5-surface)",
  };
}
function netChipLabelStyle(id: ChainDepositChannel): CSSProperties {
  return {
    fontSize: "13px",
    fontWeight: 600,
    color: network.value === id ? "var(--v5-brand)" : "var(--v5-ink-2)",
  };
}
const netChipTagStyle: CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--v5-brand)",
  textAlign: "center",
  lineHeight: 1.3,
};
const warnlineStyle: CSSProperties = {
  marginTop: "16px",
  padding: "12px",
  borderRadius: "12px",
  background: "color-mix(in srgb, var(--v5-warning) 8%, transparent)",
  gap: "8px",
};
const warnTextStyle: CSSProperties = {
  fontSize: "12px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.5,
};
const startCtaStyle = computed<CSSProperties>(() => ({
  marginTop: "20px",
  height: "48px",
  borderRadius: "999px",
  background: canStart.value ? "var(--v5-brand)" : "var(--v5-surface-2)",
  color: canStart.value ? "var(--v5-ink)" : "var(--v5-ink-4)",
}));
const startCtaTextStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  fontWeight: 600,
};
const primaryCtaStyle: CSSProperties = {
  marginTop: "24px",
  height: "48px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  color: "var(--v5-ink)",
};
const ghostBtnStyle: CSSProperties = {
  marginTop: "10px",
  minHeight: "44px",
  borderRadius: "999px",
};
const ghostTextStyle: CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
};
const verifyTitleStyle: CSSProperties = {
  marginTop: "10px",
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const verifyAmtStyle: CSSProperties = {
  marginTop: "6px",
  fontFamily: "var(--font-v5)",
  fontSize: "34px",
  fontWeight: 600,
  color: "var(--v5-brand)",
  lineHeight: 1.1,
};
const verifyRuleStyle: CSSProperties = {
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
const countdownStyle: CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--v5-warning)",
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
};
const wrongSourceBoxStyle: CSSProperties = {
  marginTop: "12px",
  padding: "10px 12px",
  borderRadius: "12px",
  background: "color-mix(in srgb, var(--v5-danger) 8%, transparent)",
  gap: "8px",
};
const wrongSourceTextStyle: CSSProperties = {
  fontSize: "12px",
  color: "var(--v5-danger)",
  lineHeight: 1.5,
};
const qrBoxStyle: CSSProperties = {
  width: "148px",
  height: "148px",
  margin: "16px auto 0",
  borderRadius: "16px",
  background: "#ffffff",
  padding: "8px",
  display: "grid",
  placeItems: "center",
};
const qrGridStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  gridTemplateColumns: `repeat(${QR_N}, 1fr)`,
  gridTemplateRows: `repeat(${QR_N}, 1fr)`,
};
const qrDarkCellStyle: CSSProperties = {
  background: "rgba(0,0,0,0.85)", // QR 物理黑,白卡内固定色(同 deposit pane 点阵先例)
  borderRadius: "1px",
};
const platformAddrLabelStyle: CSSProperties = {
  fontSize: "12px",
  color: "var(--v5-ink-4)",
};
const platformAddrStyle: CSSProperties = {
  marginTop: "4px",
  fontSize: "12px",
  color: "color-mix(in srgb, var(--v5-ink) 90%, transparent)",
  wordBreak: "break-all",
  lineHeight: 1.5,
  padding: "0 12px",
};
const stateIconBoxStyle: CSSProperties = {
  width: "44px",
  height: "44px",
  borderRadius: "16px",
  background: "var(--v5-surface-2)",
};
const successIconBoxStyle: CSSProperties = {
  width: "52px",
  height: "52px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-success) 14%, transparent)",
};
const stateTitleStyle: CSSProperties = {
  marginTop: "14px",
  fontSize: "20px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const stateBodyStyle: CSSProperties = {
  marginTop: "8px",
  fontSize: "13px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.55,
  maxWidth: "300px",
};
const successRowStyle: CSSProperties = {
  padding: "12px",
  borderRadius: "12px",
  background: "var(--v5-surface)",
  gap: "8px",
};
const successRowLabelStyle: CSSProperties = {
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
const successRowValStyle: CSSProperties = {
  fontSize: "13px",
  color: "var(--v5-ink)",
};
</script>

<style scoped>
:deep(.nx-rebind-address-input .uni-input-input) {
  min-height: 22px;
  height: 22px;
  line-height: 22px;
}
</style>
