<!--
  GenesisPurchaseSheet — Genesis Node reserve/confirm sheet.

  Source: Nexion-prototype/app/components/genesis-sheet-host.tsx (chassis-level
  zustand host). uni has no chassis-level sheet host for sub-pages, so the sheet
  is embedded in genesis.vue and toggled via `v-model:open`. framer-motion
  slide-up → CSS <transition> (backdrop fade + panel slide).

  Purchase is submitted to the canonical Genesis backend transaction. The
  client never pre-debits the wallet or writes a synthetic receipt.
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
        <!-- 🔴 开着的时候运营切了关闭 → **就地转锁定态**(规格 ⑤ 异常4),
             而不是「让他点、扣了钱再冲正、再弹个提示」。按钮同时置灰,连点写不出账单。 -->
        <view v-if="sheetBlocked" class="w-full" :style="blockedNoticeStyle">
          <text class="block" :style="blockedTitleStyle">{{ sheetBlockText }}</text>
          <text class="block" :style="blockedSubStyle">{{ t.genesis.marketClosed.holdingsSafe }}</text>
        </view>
        <view
          v-else
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
      </view>
    </transition>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useGenesis, GENESIS_ELIGIBILITY } from "@/store/genesis";
import { useGenesisEligibility } from "@/composables/use-genesis-eligibility";
import { useGenesisSaleGate } from "@/composables/use-genesis-sale-gate";
import { toast } from "@/store/ui";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ "update:open": [boolean] }>();

const t = useT();
const genesis = useGenesis();
const { gate } = useGenesisEligibility();
// 🔴 半屏必须**自己**接闸(独立验收 P1-7)。此前它完全不知道市场状态:
//   用户已打开半屏、运营此刻切关闭 → 走完扣款才被 store 拒 → 冲正 → 一句 toast,
//   而半屏不关、按钮仍可点,连点 N 次就写 2N 条账单(扣款 + 冲正各一条)。
//   规格 ⑤ 要的是「**就地转为锁定态 + 说明**」,不是弹个提示了事。
const { block, blockText } = useGenesisSaleGate();

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

/** 半屏是否已被阻断(市场关闭 / 熔断 / 配置未知)。**售罄与预售不在此列** ——
 *  半屏只在可购买时才被打开,那两态由调用方拦在门外;这里管的是「开着的时候翻脸」。 */
const sheetBlocked = computed(() => {
  const b = block.value;
  return b === "marketClosed" || b === "halted" || b === "configUnavailable";
});
// 走 blockText 唯一出口(P1-3 收口)。兜底只防 TS null:sheetBlocked 为真时
// block 必是三档阻断之一,blockText 恒非 null。上一版 `default:` 在可购买态也会
// 算出「暂未开放」,靠 sheetBlocked 碰巧挡住 —— 已删。
const sheetBlockText = computed(() => blockText.value ?? t.value.genesis.marketClosed.default);

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

async function handlePurchase() {
  if (purchasing.value) return;
  if (sheetBlocked.value) {
    toast.error(sheetBlockText.value, t.value.genesis.marketClosed.holdingsSafe);
    return;
  }
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
  purchasing.value = true;
  let committed = false;
  try {
    const result = await genesis.purchase(qty.value);
    if (!result.ok) {
      toast.error(
        result.reason === "market-closed" ? sheetBlockText.value : t.value.genesis.purchaseError,
        result.reason === "market-closed" ? t.value.genesis.marketClosed.holdingsSafe : t.value.genesis.reduceQty,
      );
      return;
    }
    toast.success(
      fmt(t.value.genesis.purchaseSuccess, { n: qty.value, s: qty.value > 1 ? "s" : "" }),
      t.value.genesis.purchaseSubtitle,
    );
    committed = true;
    emitClose();
  } finally {
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
// 半屏内的锁定块(替代提交按钮)。soft tint + **零 border**(带 bg 的容器不加边框);
// 用 warning 语义而非 error —— 这是运营节奏,不是故障。
const blockedNoticeStyle: CSSProperties = {
  marginTop: "16px",
  padding: "14px 16px",
  borderRadius: "14px",
  background: "color-mix(in srgb, var(--v5-warning) 10%, transparent)",
};
const blockedTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  fontWeight: 550,
  color: "var(--v5-warning-ink)",
  textWrap: "pretty",
};
const blockedSubStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
  marginTop: "3px",
  lineHeight: 1.5,
  textWrap: "pretty",
};
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
