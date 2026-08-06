<!--
  WalletTopup — 充值页(PAY-规格 [FEAT-PAY01] ⑤ 信息架构,参照 pay-vn-rails.html)。
  顶部 segmented 通道切换 —「USDT 链上」= <DepositUsdtPane>(三网络 chip + 专属地址
  QR + 最近入金);「银行转账」= <DepositBankPane>(VietQR 意向单流,[FEAT-PAY02]);
  「银行卡」= <TopupCardForm> 原样接入。

  2026-08-05 包 E(FEAT-KYC-RM01b):KYC-Express $1 验证流整体删除。
  旧深链 ?kyc=1(历史消息/收藏)兜底:平滑落到充值页正常态 + 一句「该流程已下线」
  轻提示 —— 禁 404/白屏(规格 ② 异常2)。

  Wrapped in <AppChassis active="me">. Header is the shared sticky <SubPageHeader>
  (back=/pages/me/wallet).
-->
<template>
  <AppChassis active="me">
    <view style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/wallet" :title="t.wallet.addFunds" :subtitle="t.wallet.topUp" />

      <!-- 通道 segmented(A4 在 SEGMENTS 中段插「银行转账」+ pane 分支) -->
      <view class="flex" :style="segWrapStyle">
        <view
          v-for="s in SEGMENTS"
          :key="s.id"
          :class="['flex-1 grid place-items-center active:opacity-70', `nx-topup-seg-${s.id}`]"
          :style="segPillStyle(s.id)"
          role="tab"
          :aria-selected="seg === s.id"
          @click="seg = s.id"
        >
          <text :style="segLabelStyle(s.id)">{{ segLabel(s.id) }}</text>
        </view>
      </view>

      <!-- USDT 链上通道段 -->
      <DepositUsdtPane v-if="seg === 'crypto'" />

      <!-- 银行转账段(VietQR,[FEAT-PAY02]) -->
      <DepositBankPane v-else-if="seg === 'bank'" />

      <!-- 银行卡段 — 现有卡表单原样接入(Change → 回 USDT 段) -->
      <TopupCardForm v-else @change-channel="seg = 'crypto'" />
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, type CSSProperties } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import TopupCardForm from "@/components/me/topup-card-form.vue";
import DepositUsdtPane from "@/components/me/deposit-usdt-pane.vue";
import DepositBankPane from "@/components/me/deposit-bank-pane.vue";
import { useT } from "@/i18n/use-t";
import { useDeposits } from "@/store/deposits";
import { toast } from "@/store/ui";

// ── 通道 segmented(USDT 链上 / 银行转账 / 银行卡)──
type Seg = "crypto" | "bank" | "card";
const SEGMENTS: { id: Seg }[] = [{ id: "crypto" }, { id: "bank" }, { id: "card" }];
const seg = ref<Seg>("crypto");
function segLabel(id: Seg): string {
  const tc = t.value.topupChrome;
  if (id === "crypto") return tc.segUsdt;
  if (id === "bank") return t.value.bankPane.segBank;
  return tc.segCard;
}

const t = useT();
const dep = useDeposits();

// ── 旧验证流深链兜底(规格 RM01b ② 异常2:落正常态 + 轻提示,禁 404/白屏)──
const retiredNoticeShown = ref(false);
function hasLegacyKycParam(options?: Record<string, unknown>): boolean {
  if (options?.kyc === "1") return true;
  // H5 can keep the same page instance when only the hash query changes.
  if (typeof window === "undefined") return false;
  const [, query = ""] = window.location.hash.split("?");
  return new URLSearchParams(query).get("kyc") === "1";
}
function noticeIfLegacyRoute(options?: Record<string, unknown>) {
  if (retiredNoticeShown.value || !hasLegacyKycParam(options)) return;
  retiredNoticeShown.value = true;
  toast.info(t.value.topupChrome.flowRetired);
}
let hashRouteListener: (() => void) | undefined;
onLoad((options) => {
  noticeIfLegacyRoute(options as Record<string, unknown> | undefined);
});
onMounted(() => {
  noticeIfLegacyRoute();
  if (typeof window !== "undefined") {
    hashRouteListener = () => noticeIfLegacyRoute();
    window.addEventListener("hashchange", hashRouteListener);
  }
});
onUnmounted(() => {
  if (hashRouteListener && typeof window !== "undefined") window.removeEventListener("hashchange", hashRouteListener);
});

// ── styles ──
// Segmented pill tabs — wallet-bills / SegmentedControl idiom.
const segWrapStyle: CSSProperties = {
  margin: "0 16px 16px",
  // 轨道贴页面底:surface-2 与页面底同色不可辨(亮色 ΔE 2.2),改 L1 surface;选中 pill 是 brand 实底,不撞色
  background: "var(--v5-surface)",
  borderRadius: "16px",
  padding: "4px",
  gap: "2px",
};
function segPillStyle(id: Seg): CSSProperties {
  return {
    height: "44px",
    borderRadius: "10px",
    background: seg.value === id ? "var(--v5-brand)" : "transparent",
    // 收款账户池无可用账户 → 银行转账 chip 置灰([FEAT-PAY02] ⑤;可点进,pane 给维护说明)
    opacity: id === "bank" && !dep.bankRailAvailable ? 0.45 : 1,
  };
}
function segLabelStyle(id: Seg): CSSProperties {
  return {
    fontFamily: "var(--font-v5)",
    fontSize: "13px",
    fontWeight: seg.value === id ? 600 : 500,
    color: seg.value === id ? "var(--v5-on-brand)" : "var(--v5-ink-3)",
  };
}
</script>
