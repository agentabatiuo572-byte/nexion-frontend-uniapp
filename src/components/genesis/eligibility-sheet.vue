<!--
  GenesisEligibilitySheet — 创世节点认购资格 sheet（规格 FEAT-GEN08）。

  骨架照 purchase-sheet.vue（backdrop fade + panel slide + v-model:open）。
  四通道条件行（累计入金 / 旗舰设备 / V 等级 / 邀请码）：已达成打钩，未达成
  显示进度 + 补齐入口（去充值 / 看设备 / 去升级）；邀请码行内嵌输码核验。
  达标态顶部横幅 + 「立即认购」CTA（emit subscribe → 父页关本 sheet 开购买 sheet）。

  文案走高端克制线（feedback_highend_sku_copy_restraint）：无吆喝、无贬损。
-->
<template>
  <view v-if="open">
    <transition name="nx-elig-fade">
      <view v-if="open" class="nx-elig-backdrop" role="dialog" aria-modal="true" @click="emitClose" />
    </transition>
    <transition name="nx-elig-slide">
      <view v-if="open" class="nx-elig-panel" :style="panelStyle" @click.stop>
        <!-- Title row -->
        <view class="flex items-start justify-between" style="margin-bottom: 14px">
          <view>
            <text class="block" :style="titleStyle">{{ t.genesisEligibility.title }}</text>
            <text class="block" :style="subtitleStyle">{{ subtitleText }}</text>
          </view>
          <view class="inline-flex items-center justify-center active:opacity-60" :style="closeBtnStyle" @click="emitClose">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </view>
        </view>

        <!-- Unlocked banner -->
        <view v-if="gate.eligible" :style="unlockedBannerStyle">
          <view class="flex items-center" style="gap: 8px">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success-ink)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            <view class="flex-1 min-w-0">
              <text class="block" :style="unlockedTitleStyle">{{ t.genesisEligibility.unlockedTitle }}</text>
              <text class="block" :style="unlockedSubStyle">{{ t.genesisEligibility.unlockedSub }}</text>
            </view>
          </view>
        </view>

        <!-- Condition rows -->
        <view :style="condListStyle">
          <view v-for="c in gate.conditions" :key="c.key" :style="condRowStyle">
            <view class="flex items-center justify-between" style="gap: 10px">
              <text :style="condLabelStyle">{{ condLabel(c) }}</text>
              <view v-if="c.met" class="inline-flex items-center" style="gap: 4px; flex-shrink: 0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success-ink)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                <text :style="metTextStyle">{{ t.genesisEligibility.metBadge }}</text>
              </view>
              <text
                v-else-if="fixNavLabel(c.key)"
                class="active:opacity-70"
                :style="fixLinkStyle"
                @click="goFix(c.key)"
              >{{ fixNavLabel(c.key) }}</text>
            </view>

            <!-- Progress (unmet, non-invite) -->
            <template v-if="!c.met && c.key !== 'invite'">
              <view :style="trackStyle">
                <view :style="fillStyle(c.progressPct)" />
              </view>
              <text class="block tabular-nums" :style="progressTextStyle">{{ progressText(c) }}</text>
            </template>

            <!-- Invite input (unmet invite row) -->
            <template v-if="!c.met && c.key === 'invite'">
              <view class="flex items-center" style="gap: 8px; margin-top: 10px">
                <input
                  v-model="inviteInput"
                  :placeholder="t.genesisEligibility.invitePlaceholder"
                  placeholder-style="color: var(--v5-ink-4)"
                  :style="inviteInputStyle"
                  confirm-type="done"
                  @confirm="verifyInvite"
                />
                <view class="inline-flex items-center justify-center active:opacity-80" :style="verifyBtnStyle" @click="verifyInvite">
                  <text>{{ t.genesisEligibility.inviteVerify }}</text>
                </view>
              </view>
              <text v-if="inviteErrorText" class="block" :style="inviteErrStyle">{{ inviteErrorText }}</text>
            </template>
          </view>
        </view>

        <!-- Cap note -->
        <text v-if="gate.capReached" class="block" :style="capNoteStyle">{{ capNoteText }}</text>

        <!-- Subscribe CTA (unlocked only) -->
        <view
          v-if="gate.eligible && !gate.capReached"
          class="w-full inline-flex items-center justify-center active:opacity-85"
          :style="subscribeStyle"
          @click="emitSubscribe"
        >
          <text>{{ t.genesisEligibility.unlockedCta }}</text>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </view>
      </view>
    </transition>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { GENESIS_ELIGIBILITY, useGenesis, type GenesisGateCondition } from "@/store/genesis";
import type { GenesisInviteRejectReason } from "@/store/genesis-invite";
import { useApp } from "@/store/app";
import { useGenesisEligibility } from "@/composables/use-genesis-eligibility";
import { remoteApiEnabled } from "@/api/runtime";
import { toast } from "@/store/ui";
import { useDialogA11y } from "@/composables/use-dialog-a11y";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ "update:open": [boolean]; subscribe: [] }>();

const t = useT();
const app = useApp();
const genesis = useGenesis();
const { gate } = useGenesisEligibility();

const inviteInput = ref("");
/** 拒绝归因(null = 没出错)。四种拒绝各自文案,且都不透露核销者是谁。 */
const inviteReject = ref<GenesisInviteRejectReason | null>(null);
let inviteRequestGeneration = 0;
let sheetMounted = true;

watch(
  () => props.open,
  (o) => {
    inviteRequestGeneration += 1;
    if (o) {
      inviteInput.value = "";
      inviteReject.value = null;
    }
  },
);

onUnmounted(() => {
  sheetMounted = false;
  inviteRequestGeneration += 1;
});

const inviteErrorText = computed(() => {
  const el = t.value.genesisEligibility;
  switch (inviteReject.value) {
    case "invalid": return el.inviteInvalid;
    case "used": return el.inviteUsed;
    case "void": return el.inviteVoided;
    case "already-held": return el.inviteAlreadyHeld;
    case "failed": return el.inviteFailed;
    default: return "";
  }
});

const subtitleText = computed(() =>
  (remoteApiEnabled ? genesis.remoteEligibility?.mode : GENESIS_ELIGIBILITY.mode) === "all-of"
    ? t.value.genesisEligibility.subtitleAll : t.value.genesisEligibility.subtitleAny,
);
const capNoteText = computed(() => fmt(t.value.genesisEligibility.capReachedNote, {
  n: remoteApiEnabled ? genesis.remoteEligibility?.maxPerUser ?? 0 : GENESIS_ELIGIBILITY.perUserCap,
}));

function condLabel(c: GenesisGateCondition): string {
  const el = t.value.genesisEligibility;
  if (c.key === "deposit") return fmt(el.condDeposit, { n: GENESIS_ELIGIBILITY.minDepositUsdt.toLocaleString() });
  if (c.key === "flagship") return fmt(el.condFlagship, { n: GENESIS_ELIGIBILITY.flagshipMin });
  if (c.key === "vrank") return fmt(el.condVrank, { n: GENESIS_ELIGIBILITY.vRankMin });
  if (c.key === "server") return el.condInvite;
  return el.condInvite;
}

function progressText(c: GenesisGateCondition): string {
  const el = t.value.genesisEligibility;
  if (c.key === "deposit") {
    return fmt(el.progressOf, {
      cur: `$${Math.floor(c.current).toLocaleString()}`,
      target: `$${c.target.toLocaleString()}`,
    });
  }
  if (c.key === "vrank") return fmt(el.progressOf, { cur: `V${c.current}`, target: `V${c.target}` });
  return fmt(el.progressOf, { cur: c.current, target: c.target });
}

function fixNavLabel(key: GenesisGateCondition["key"]): string | null {
  const el = t.value.genesisEligibility;
  if (key === "deposit") return el.goTopup;
  if (key === "flagship") return el.goFlagship;
  if (key === "vrank") return el.goUpgrade;
  return null; // invite 行内嵌输码,无跳转链接
}

function goFix(key: GenesisGateCondition["key"]) {
  const url =
    key === "deposit"
      ? "/pages/me/wallet-topup"
      : key === "flagship"
        ? "/pages/store/detail?id=stellarrack-p1"
        : "/pages/team/team";
  emitClose();
  if (key === "vrank") {
    uni.switchTab({ url, fail: () => uni.navigateTo({ url, fail: () => {} }) });
  } else {
    uni.navigateTo({ url, fail: () => {} });
  }
}

async function verifyInvite() {
  const request = ++inviteRequestGeneration;
  const accountKey = app.accountKey;
  inviteReject.value = null;
  // per-account 核销(随 account-cloud 快照走,切号不继承 — 审计 P1 修复);
  // 查平台码表 + 三态校验,拒绝带归因 → 四种失败各自文案(规格 FEAT-GEN11 ②)。
  const result = await app.setGenesisInviteCode(inviteInput.value);
  if (!sheetMounted || !props.open || request !== inviteRequestGeneration
      || accountKey !== app.accountKey) return;
  if (!result.ok) {
    inviteReject.value = result.reason;
    return;
  }
  await genesis.syncRemote();
  if (!sheetMounted || !props.open || request !== inviteRequestGeneration
      || accountKey !== app.accountKey) return;
  toast.success(t.value.genesisEligibility.inviteApplied, "");
}

function emitClose() {
  inviteRequestGeneration += 1;
  emit("update:open", false);
}
function emitSubscribe() {
  emit("subscribe");
}

// ── styles（V5 token,0 hex）──
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
  textWrap: "pretty" as CSSProperties["textWrap"],
};
const closeBtnStyle: CSSProperties = { width: "40px", height: "40px", borderRadius: "999px", color: "var(--v5-ink-3)" };
const unlockedBannerStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--v5-success) 12%, transparent)",
  borderRadius: "14px",
  padding: "12px 14px",
  marginBottom: "12px",
};
const unlockedTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--v5-ink)",
  lineHeight: 1.25,
};
const unlockedSubStyle: CSSProperties = { marginTop: "2px", fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.4 };
const condListStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: "10px" };
const condRowStyle: CSSProperties = {
  background: "var(--v5-surface-2)",
  borderRadius: "14px",
  padding: "13px 14px",
};
const condLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--v5-ink)",
  lineHeight: 1.3,
};
const metTextStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-success-ink)", whiteSpace: "nowrap" };
const fixLinkStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: "13px",
  color: "var(--v5-brand)",
  fontWeight: 500,
  whiteSpace: "nowrap",
  minHeight: "44px",
  display: "inline-flex",
  alignItems: "center",
};
const trackStyle: CSSProperties = {
  marginTop: "10px",
  height: "4px",
  borderRadius: "999px",
  background: "var(--v5-surface-3, var(--v5-border))",
  overflow: "hidden",
};
function fillStyle(pct: number): CSSProperties {
  return {
    width: `${Math.max(2, pct)}%`,
    height: "100%",
    borderRadius: "999px",
    background: "var(--v5-brand)",
    transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
  };
}
const progressTextStyle: CSSProperties = { marginTop: "6px", fontSize: "12px", color: "var(--v5-ink-4)" };
const inviteInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: "44px",
  padding: "0 14px",
  borderRadius: "12px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  color: "var(--v5-ink)",
  fontSize: "13px",
  fontFamily: "var(--font-v5)",
  textTransform: "uppercase", // 纯视觉规范化(applyInviteCode 已做值层 toUpperCase)
};
const verifyBtnStyle: CSSProperties = {
  flexShrink: 0,
  height: "44px",
  padding: "0 18px",
  borderRadius: "12px",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  fontWeight: 500,
};
const inviteErrStyle: CSSProperties = { marginTop: "6px", fontSize: "12px", color: "var(--v5-danger)" };
const capNoteStyle: CSSProperties = {
  marginTop: "12px",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
  textAlign: "center",
  lineHeight: 1.45,
};
const subscribeStyle: CSSProperties = {
  marginTop: "14px",
  height: "50px",
  padding: "0 28px",
  borderRadius: "999px",
  gap: "6px",
  background: "var(--v5-brand)",
  boxShadow: "var(--v5-spotlight-brand)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "15px",
  letterSpacing: "-0.005em",
};

// 遮罩只拦指针不拦键盘:不接这一层,弹层打开后 Tab 会直接走到背景(那里有花钱的按钮),
// 且没有 Esc、关掉后焦点也回不到触发它的控件。
useDialogA11y(computed(() => props.open), ".nx-elig-backdrop", emitClose);
</script>

<style scoped>
.nx-elig-backdrop {
  position: fixed;
  inset: 0;
  z-index: 790;
  background: var(--v5-bg-color-mask);
  backdrop-filter: blur(8px);
}
.nx-elig-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 800;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
}
.nx-elig-fade-enter-active,
.nx-elig-fade-leave-active {
  transition: opacity 0.24s cubic-bezier(0.32, 0.72, 0, 1);
}
.nx-elig-fade-enter-from,
.nx-elig-fade-leave-to {
  opacity: 0;
}
.nx-elig-slide-enter-active {
  transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
}
.nx-elig-slide-leave-active {
  transition: transform 0.24s cubic-bezier(0.32, 0.72, 0, 1);
}
.nx-elig-slide-enter-from,
.nx-elig-slide-leave-to {
  transform: translateY(100%);
}
</style>
