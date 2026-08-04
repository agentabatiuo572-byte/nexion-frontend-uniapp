<!--
  GenesisPurchaseSheet — Genesis Node reserve/confirm sheet.

  Source: Nexion-prototype/app/components/genesis-sheet-host.tsx (chassis-level
  zustand host). uni has no chassis-level sheet host for sub-pages, so the sheet
  is embedded in genesis.vue and toggled via `v-model:open`. framer-motion
  slide-up → CSS <transition> (backdrop fade + panel slide).

  Cross-store side-effect (architecture铁律: stores don't import each other) —
  the purchase handler composes postMoneyBill()(扣款 ⊗ 记账,见 lib/money-receipt.ts)
  + genesis.purchase() here in the component.
-->
<template>
  <view v-if="open">
    <!-- Backdrop -->
    <transition name="nx-sheet-fade">
      <view v-if="open" class="nx-sheet-backdrop" @click="emitClose" />
    </transition>
    <!-- Panel -->
    <transition name="nx-sheet-slide">
      <view v-if="open" class="nx-sheet-panel" :style="panelStyle" @click.stop>
        <!-- Title row -->
        <view class="flex items-start justify-between" style="margin-bottom: 16px">
          <view>
            <text class="block" :style="titleStyle">{{ t.genesis.confirmTitle }}</text>
            <text class="block" :style="subtitleStyle">{{ subtitleText }}</text>
          </view>
          <view class="inline-flex items-center justify-center active:opacity-60" :style="closeBtnStyle" @click="emitClose">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </view>
        </view>

        <!-- Quantity stepper -->
        <view :style="stepperWrapStyle">
          <text class="block" :style="stepperLabelStyle">{{ t.genesis.quantity }}</text>
          <view class="flex items-center" style="margin-top: 8px; gap: 16px">
            <view class="flex items-center justify-center active:opacity-70" :style="minusBtnStyle" @click="dec">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /></svg>
            </view>
            <view class="flex-1 text-center">
              <text class="tabular-nums" :style="qtyStyle">{{ qty }}</text>
            </view>
            <view class="flex items-center justify-center active:opacity-70" :style="plusBtnStyle" @click="inc">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
            </view>
          </view>
        </view>

        <!-- Summary -->
        <view :style="summaryStyle">
          <view class="flex items-center justify-between">
            <text :style="rowLabelStyle">{{ t.genesis.subtotal }}</text>
            <text class="tabular-nums" :style="rowValStyle">${{ subtotalText }}</text>
          </view>
          <view class="flex items-center justify-between">
            <text :style="rowLabelMutedStyle">{{ t.genesis.networkFee }}</text>
            <text class="tabular-nums" :style="rowValStyle">{{ t.genesis.networkFeeFree }}</text>
          </view>
          <view class="flex items-center justify-between">
            <text :style="rowLabelStyle">{{ t.genesis.getRow }}</text>
            <text :style="rowValSuccessStyle">{{ t.genesis.getRowValue }}</text>
          </view>
          <view :style="dividerStyle" />
          <view class="flex items-center justify-between">
            <text :style="rowLabelStyle">{{ t.genesis.totalDue }}</text>
            <text class="tabular-nums" :style="rowValBoldStyle">${{ subtotalText }}</text>
          </view>
        </view>

        <!-- Submit — 成交在途时置灰不可点(《05》§6.1 disabled 派生:文字/图标降 ink-4 +
             填充降 surface 系,不新造灰色);按下反馈也随之撤掉,不给「还能再点一次」的暗示 -->
        <view
          class="w-full inline-flex items-center justify-center"
          :class="{ 'active:opacity-85': !purchasing }"
          role="button"
          :aria-disabled="purchasing ? 'true' : 'false'"
          :style="submitStyle"
          @click="handlePurchase"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          <text>{{ t.genesis.confirmCta }}</text>
        </view>
        <text class="block text-center" :style="kycNoticeStyle">{{ t.genesis.kycNotice }}</text>
      </view>
    </transition>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { postMoneyBill } from "@/lib/money-receipt";
import { useGenesis, GENESIS_ELIGIBILITY } from "@/store/genesis";
import { useGenesisEligibility } from "@/composables/use-genesis-eligibility";
import { toast } from "@/store/ui";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ "update:open": [boolean] }>();

const t = useT();
const app = useApp();
const genesis = useGenesis();
const { gate } = useGenesisEligibility();

const qty = ref(1);
/**
 * 🔴 成交在途守卫。`emitClose()` 只是把 open 传给父级,面板要等下一次渲染才真卸载 ——
 * 移动端快速双击会在这个窗口里第二次进到 handlePurchase,扣两笔钱、铸两份额度。
 *
 * 用 `ref(false)`(**组件实例**级)而不是 checkout.vue 那个模块级 `let confirming`:
 * 模块级变量跨实例共享,而这是个会反复开合的半屏,任一提前 return 忘复位就把后续
 * 所有创世购买永久锁死。复位交给 finally + 下面的 open watcher 兜底。
 */
const purchasing = ref(false);

const price = computed(() => genesis.unitPriceUSDT);
const remaining = computed(() => genesis.totalSlots - genesis.soldSlots);

const subtitleText = computed(() => fmt(t.value.genesis.confirmSubtitle, { price: price.value.toLocaleString() }));
const subtotalText = computed(() => (qty.value * price.value).toLocaleString());

// Reset qty to 1 each time the sheet opens. 守卫一并解锁 —— 成交成功那条路径
// **故意**持锁到面板关闭(解锁 = 给双击留窗口),再次打开时才是新的一次购买。
watch(
  () => props.open,
  (o) => {
    if (o) {
      qty.value = 1;
      purchasing.value = false;
    }
  },
);

function dec() {
  qty.value = Math.max(1, qty.value - 1);
}
function inc() {
  // 步进上限 = min(余量, 单人限购余量),防拨超到确认才报错。
  const maxQty = Math.max(1, Math.min(remaining.value, gate.value.capRemaining));
  qty.value = Math.min(maxQty, qty.value + 1);
}
function emitClose() {
  emit("update:open", false);
}

function handlePurchase() {
  // 🔴 重入守卫排在最前(关闭是异步的,双击会在面板卸载前再进来一次)。
  if (purchasing.value) return;
  // L3 复验(照 checkout F4b:防深链/时序绕过 UI 门)。顺序固定
  // eligibility → cap → balance → mint,资格/限购失败时零资金动作。
  if (!gate.value.eligible) {
    toast.error(t.value.genesisEligibility.toastIneligible, t.value.genesisEligibility.toastIneligibleSub);
    return;
  }
  if (qty.value > gate.value.capRemaining) {
    toast.error(
      t.value.genesisEligibility.toastCapReached,
      fmt(t.value.genesisEligibility.toastCapReachedSub, { n: GENESIS_ELIGIBILITY.perUserCap }),
    );
    return;
  }
  // 上锁点 = 第一次动钱之前。committed 只在真成交那条路径置位。
  purchasing.value = true;
  let committed = false;
  try {
    const cost = qty.value * price.value;
    const billRef = `GENESIS-PRIM-${Date.now().toString(36).toUpperCase()}`;
    // ⚠️ MOCK-ONLY CROSS-STORE MUTATION (NON-ATOMIC): 扣款⊗记账已被 postMoneyBill
    // 收口成一次提交,但「铸席位」仍是**另一次写** —— 整笔仍非原子。
    // PRODUCTION: POST /api/genesis/primary/subscribe 单事务提交,返回
    // {balance, ownedTokenIds, billId}(PRD §10.1.1;二级承接与挂单分别走
    // POST /api/genesis/secondary/fulfill 与 POST /api/genesis/{list,unlist},§10.2.4)。
    //
    // 🔴 顺序 = 扣款⊗记账(原子)→ 铸席位(2026-08-04 R4「钱动了、账没记上」)。原顺序是
    // 「扣款 → 铸席位 → 裸 bills.add」,而 bills.add 写不进去时**返回 null 且不抛异常**、
    // 没人接 —— 于是近 $15k 已扣、席位已铸、弹「购买成功」,账单页却查无此单。收据挪到铸造
    // 之前并与扣款收口成一次提交后,收据落不了盘 = 钱没扣、席位没铸、明确报错,零半执行残迹。
    const before = app.captureMoney();
    const paid = postMoneyBill({
      type: "purchase",
      symbol: "USDT",
      amount: -cost,
      status: "posted",
      memo: `Genesis primary · ${qty.value} slot${qty.value > 1 ? "s" : ""} @ $${price.value}`,
      ref: billRef,
    });
    if (paid === "insufficient") {
      toast.error(
        t.value.genesis.purchaseError,
        fmt(t.value.genesis.purchaseErrorSubtitle, {
          cost: cost.toLocaleString(),
          balance: app.user.usdtBalance.toFixed(2),
        }),
      );
      return;
    }
    if (paid !== "ok") return; // 落盘失败:资金已还原、账上无记录、收口点已提示
    const r = genesis.purchase(qty.value);
    if (!r.ok) {
      // 铸造失败(售罄 / 限购竞态)→ 冲正,不留「扣钱无货」。走**同一个**收口点:
      // ① restoreTo 精确还原扣款前的 withdrawableUsdt —— 原实现的裸 creditBalance 只加总余额、
      //    不还可提额度,一次「扣款→失败→退款」就把用户可提额永久压低($8000 → $1,审计场景);
      // ② 补一条反向分录 —— 原实现退款**一条账单都不写**(同族的另一面:钱动了、账没记上)。
      //    已终态分录靠反向分录冲正、不改写原行(与提现 NEX 退还同规矩)。
      postMoneyBill(
        {
          type: "purchase",
          symbol: "USDT",
          amount: cost,
          status: "posted",
          memo: `Genesis primary reversed · ${qty.value} slot${qty.value > 1 ? "s" : ""} refunded`,
          memoKey: "genesisReversed",
          memoParams: { n: qty.value },
          ref: billRef,
        },
        { restoreTo: before },
      );
      // 按拒绝原因选反馈(售罄竞态 vs 限购,A-1)。
      if (r.reason === "cap") {
        toast.error(
          t.value.genesisEligibility.toastCapReached,
          fmt(t.value.genesisEligibility.toastCapReachedSub, { n: GENESIS_ELIGIBILITY.perUserCap }),
        );
      } else {
        toast.error(fmt(t.value.genesis.onlyNLeft, { n: remaining.value }), t.value.genesis.reduceQty);
      }
      return;
    }
    toast.success(
      fmt(t.value.genesis.purchaseSuccess, { n: qty.value, s: qty.value > 1 ? "s" : "" }),
      t.value.genesis.purchaseSubtitle,
    );
    committed = true;
    emitClose();
  } finally {
    // 只有真成交才继续持锁(面板正在关闭,解锁 = 给双击留窗口;由 open watcher 复位)。
    // 其余任何出口 —— 余额不足、铸造失败、抛异常 —— 立刻解锁,让用户能重试,
    // 也就不会出现「某条提前 return 忘复位 → 后续购买永久锁死」。
    if (!committed) purchasing.value = false;
  }
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
  fontSize: "13px",
  color: "var(--v5-ink-3)",
};
const closeBtnStyle: CSSProperties = { width: "40px", height: "40px", borderRadius: "999px", color: "var(--v5-ink-3)" };
const stepperWrapStyle: CSSProperties = { background: "var(--v5-surface-2)", borderRadius: "16px", padding: "16px" };
const stepperLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  color: "var(--v5-ink-3)",
  fontWeight: 500,
};
const minusBtnStyle = computed<CSSProperties>(() => ({
  width: "44px",
  height: "44px",
  borderRadius: "999px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  color: qty.value <= 1 ? "var(--v5-ink-4)" : "var(--v5-ink)",
}));
const plusBtnStyle: CSSProperties = {
  width: "44px",
  height: "44px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  boxShadow: "var(--v5-spotlight-brand)",
  color: "var(--v5-on-brand)",
};
const qtyStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "56px",
  letterSpacing: "-0.034em",
  color: "var(--v5-ink)",
  lineHeight: 1,
};
const summaryStyle: CSSProperties = {
  marginTop: "12px",
  background: "var(--v5-surface-2)",
  borderRadius: "14px",
  padding: "16px",
  fontSize: "13px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};
const rowLabelStyle: CSSProperties = { color: "var(--v5-ink-3)" };
const rowLabelMutedStyle: CSSProperties = { color: "var(--v5-ink-4)" };
const rowValStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "13px",
  letterSpacing: "-0.005em",
  color: "var(--v5-ink)",
};
const rowValSuccessStyle: CSSProperties = { ...rowValStyle, color: "var(--v5-success)" };
const rowValBoldStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "20px",
  letterSpacing: "-0.014em",
  color: "var(--v5-ink)",
};
const dividerStyle: CSSProperties = { height: "1px", background: "var(--v5-border)", margin: "8px 0" };
// disabled 派生(《05》§6.1):文字/图标降 --v5-ink-4 + 填充降 surface 系 + 撤 glow。
// icon 是 stroke="currentColor"、文案继承 color → 一处改两者同步降。
const submitStyle = computed<CSSProperties>(() => ({
  marginTop: "16px",
  height: "50px",
  padding: "0 28px",
  borderRadius: "999px",
  gap: "8px",
  background: purchasing.value ? "var(--v5-surface-2)" : "var(--v5-brand)",
  boxShadow: purchasing.value ? "none" : "var(--v5-spotlight-brand)",
  color: purchasing.value ? "var(--v5-ink-4)" : "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "15px",
  letterSpacing: "-0.005em",
}));
const kycNoticeStyle: CSSProperties = {
  marginTop: "12px",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.45,
};
</script>

<style scoped>
.nx-sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 79;
  background: var(--v5-bg-color-mask);
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
