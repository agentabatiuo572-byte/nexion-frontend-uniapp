<!--
  DeviceDeactivateSheet — ported from Nexion-prototype/app/components/
  deactivate-sheet.tsx. Bottom sheet shown when the user deactivates a device
  that has a running task; forces an explicit wait / force / cancel choice.

  The source mounts this once at chassis level driven by a zustand store. uni
  has no root layout, so /me/devices renders it inline and drives it with a
  `device` prop (null = hidden). framer-motion enter/exit → CSS keyframes in
  tokens.css (nx-sheet-fade-in / nx-sheet-slide-up). The wait/force actions are
  composed by the page (emit), keeping the app-store mutation in the page handler.
-->
<template>
  <view v-if="device" class="nx-device-deactivate-root" role="dialog" aria-modal="true" :aria-label="t.deactivateSheet.title">
    <view class="nx-sheet-fade-in" :style="scrimStyle" @click="emit('dismiss')" />
    <view class="nx-glass-sheet nx-sheet-slide-up" :style="sheetStyle">
      <view class="flex items-start justify-between" style="gap: 12px">
        <view class="min-w-0">
          <text class="block" :style="titleStyle">{{ t.deactivateSheet.title }}</text>
          <text class="nx-deactivate-desc">{{ descLine }}</text>
        </view>
        <!-- The shared sheet close (same as NxSheet): neutral glass M with the close icon, 03 §3.1／§3.5. -->
        <NxButton class="nx-deactivate-close" :label="t.ui.close" size="medium" @click="emit('dismiss')"><NxIcon name="close" :size="18" /></NxButton>
      </view>

      <!-- Task progress preview -->
      <view v-if="task" :style="taskCardStyle">
        <view class="flex items-center justify-between" style="gap: 8px">
          <view class="min-w-0 flex-1">
            <text class="nx-deactivate-task">{{ task.type }}</text>
            <text class="nx-deactivate-meta">{{ taskRewardLine }}</text>
          </view>
          <view class="text-right shrink-0">
            <text class="nx-deactivate-pct">{{ progressPct }}%</text>
            <text class="nx-deactivate-meta">{{ etaLine }}</text>
          </view>
        </view>
        <view class="nx-deactivate-progress nx-progress" aria-hidden="true" :aria-valuenow="progressPct">
          <view class="nx-progress__fill" :style="{ width: `${progressPct}%` }" />
        </view>
      </view>

      <!-- Actions -->
      <!-- 03 §3.1 types: waiting is the one primary L; forcing is this choice's last, destructive step, so it is a neutral
           glass L whose text alone turns to the error colour; 返回 is a text button (关闭／取消：中性玻璃或文字). -->
      <view class="nx-deactivate-actions">
        <NxButton class="nx-deactivate-action" variant="primary" size="large" :label="t.deactivateSheet.waitCta" @click="emit('wait')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          <text>{{ t.deactivateSheet.waitCta }}</text>
        </NxButton>
        <NxButton class="nx-deactivate-action nx-deactivate-action--danger" variant="secondary" size="large" :label="forceLabel" @click="emit('force')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.77.04" /></svg>
          <text>{{ forceLabel }}</text>
        </NxButton>
        <NxButton class="nx-deactivate-back" variant="text" size="large" :label="t.deactivateSheet.backCta" @click="emit('dismiss')" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { formatAmount } from "@/lib/amount-display";
import { formatTaskReward } from "@/lib/task-reward-display";
import { taskProgressPercent } from "@/lib/task-progress";
import { projectServerNow, readMonotonicNowMs } from "@/lib/server-deadline-clock";
import { useVisibleInterval } from "@/composables/use-tab-page-lifecycle";
import { computed, ref, type CSSProperties } from "vue";
import { useDialogA11y } from "@/composables/use-dialog-a11y";
import type { Device } from "@/store/types";
import { useT } from "@/i18n/use-t";
import { useComputeV2Copy } from "@/i18n/compute-v2";
import { deviceName } from "@/lib/device-copy";
import { fmt } from "@/i18n/format";
import NxButton from "@/components/ui/nx-button.vue";
import NxIcon from "@/components/ui/nx-icon.vue";

const props = defineProps<{ device: Device | null }>();
const emit = defineEmits<{ (e: "wait"): void; (e: "force"): void; (e: "dismiss"): void }>();

const t = useT();
const computeCopy = useComputeV2Copy();
useDialogA11y(computed(() => props.device !== null), ".nx-device-deactivate-root", () => emit("dismiss"));

// Re-read both clocks whenever this visible sheet opens; never accumulate hidden ticks.
const nowMs = ref(Date.now());
const monotonicNow = ref(readMonotonicNowMs());
useVisibleInterval(() => {
  nowMs.value = Date.now();
  monotonicNow.value = readMonotonicNowMs();
}, 1000, () => props.device !== null);

const task = computed(() => props.device?.currentTask ?? null);
const taskNow = computed(() => props.device?.taskServerNow != null && props.device.taskServerNowReceivedAt != null
  ? projectServerNow(props.device.taskServerNow, props.device.taskServerNowReceivedAt, monotonicNow.value) : nowMs.value);
const descLine = computed(() =>
  props.device ? fmt(task.value?.executionMode === "SIMULATED" ? computeCopy.value.stopDescription : t.value.deactivateSheet.desc,
    { name: deviceName(t.value, props.device) }) : "",
);
const progressPct = computed(() => {
  const tk = task.value;
  if (!tk) return 0;
  return taskProgressPercent(tk, taskNow.value, props.device?.interruptedAt,
    props.device?.kind === "phone" ? props.device.phoneValidUntil : null) ?? 0;
});
const etaSec = computed(() => {
  const tk = task.value;
  if (!tk) return 0;
  return tk.startedAt === null || tk.status === "QUEUED" ? tk.totalSec : Math.max(0, Math.round(tk.totalSec - (taskNow.value - tk.startedAt) / 1000));
});
const etaLabel = computed(() =>
  etaSec.value >= 60 ? `~${Math.ceil(etaSec.value / 60)}m` : `~${etaSec.value}s`,
);
const forceLabel = computed(() => task.value?.executionMode === "SIMULATED" ? computeCopy.value.stopNow : t.value.deactivateSheet.forceCta);
const etaLine = computed(() => fmt(t.value.deactivateSheet.etaRemaining, { eta: etaLabel.value }));
const taskRewardLine = computed(() => {
  const tk = task.value;
  if (!tk) return "";
  if (tk.executionMode === "SIMULATED") return formatTaskReward(tk, true);
  return fmt(t.value.deactivateSheet.taskRewardLine, {
    client: tk.client,
    amount: formatAmount(tk.reward, 6),
  });
});

// 🔴 790/800 = 业务半屏带(秩序表单源见 captcha-slider.vue)。原值 79/80 是「比 790/800
// 少一位数」那个老笔误的同族残留:低于里程碑庆祝(780),半屏开着时被庆祝盖住并吞点击。
// 同族前三张付款半屏 2026-08-16 已归位,这三处(本文件 / fx-rate-line / wallet-withdraw)
// 因为写成 JS 样式对象、机器门只扫 <style> 块与内联 style,当时没被扫到,2026-08-17 补齐。
const scrimStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 790,
  background: "rgba(8,8,12,0.45)",
  backdropFilter: "blur(8px) saturate(150%)",
};
const sheetStyle: CSSProperties = { borderRadius: "var(--nx-glass-radius) var(--nx-glass-radius) 0 0", boxShadow: "var(--nx-glass-edge)",
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 800,
  background: "var(--nx-glass-fill)",
  borderTop: "none",
  boxSizing: "border-box",
  maxHeight: "calc(100vh - var(--nx-overlay-top))",
  overflowY: "auto",
  overscrollBehavior: "contain",
  padding: "18px 16px var(--nx-overlay-bottom)",
};
const titleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "var(--ui-type-hero-title)",
  fontWeight: "var(--ui-type-hero-title-weight)",
  color: "var(--v5-ink)",
};
const taskCardStyle: CSSProperties = {
  marginTop: "12px",
  borderRadius: "12px",
  background: "var(--v5-surface-2)",
  padding: "12px",
};


</script>
<style scoped>
/* Sheet copy and task preview on the 10 §10.1 roles; the preview bar is the shared .nx-progress (03 §3.6). */
.nx-deactivate-desc { display: block; margin-top: 4px; color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.nx-deactivate-task { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--v5-ink); font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); }
.nx-deactivate-meta { display: block; margin-top: 2px; color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.nx-deactivate-pct { display: block; color: var(--v5-brand); font: var(--ui-type-inline-figure-weight) var(--ui-type-inline-figure)/var(--ui-type-inline-figure-lh) var(--font-metric); font-variant-numeric: tabular-nums; }
.nx-deactivate-progress { margin-top: 8px; }
.nx-deactivate-progress .nx-progress__fill { transition: width 500ms ease; }
.nx-deactivate-actions { display: flex; flex-direction: column; align-items: stretch; gap: 8px; margin-top: 16px; }
.nx-deactivate-action { width: 100%; }
.nx-deactivate-action--danger { --ui-button-ink: var(--v5-danger); color: var(--v5-danger); }
.nx-deactivate-back { align-self: center; }
.nx-deactivate-close { flex: none; }
@media (prefers-reduced-motion: reduce) { .nx-deactivate-progress .nx-progress__fill { transition: none; } }
</style>
