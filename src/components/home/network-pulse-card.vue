<!--
  NetworkPulseCard — ZONE 2 global-grid metrics(规格 FEAT-HOME02)。
  Lite 两格:注册用户 / 在线设备(不含按绑定手机算力的个人排名)。
-->
<template>
  <NxSection v-if="compactView" :title="t.home.networkPulseTitle" :action="copy.details" action-icon-only @action="navTo('/pages/globe/globe')" data-home-section="network">
    <NetworkStatStrip :cells="stripCells" />
  </NxSection>
  <view v-else-if="!compactView" data-home-section="network-pulse">
    <view class="flex items-center justify-between" style="margin: 8px 2px 10px">
      <text style="font-family: var(--font-v5); font-weight: var(--ui-type-card-title-weight); font-size: var(--ui-type-card-title); color: var(--v5-ink); letter-spacing: -0.012em">{{ t.home.networkPulseTitle }}</text>
    </view>

    <view class="nx-glass-card" style="background: var(--nx-glass-fill); box-shadow: var(--nx-glass-edge); border-radius: var(--nx-glass-radius); overflow: hidden">

      <view class="grid grid-cols-2">
        <view
          v-for="(m, i) in metrics"
          :key="m.k"
          class="grid items-center gap-2"
          :class="m.tap ? 'active:opacity-70' : ''"
          :role="m.tap ? 'button' : undefined"
          :tabindex="m.tap ? 0 : -1"
          :style="{ gridTemplateColumns: '1fr', padding: '12px', borderRight: i < metrics.length - 1 ? '1px solid var(--v5-border)' : 'none', minWidth: 0 }"
          v-on="m.tap ? { click: m.tap } : {}"

          @keydown.enter.stop.prevent="activate(m.tap)" @keydown.space.stop.prevent="activate(m.tap)"
        >
          <view class="min-w-0">
            <text class="block font-mono-tabular" style="font-size: 12px; line-height: 14px; min-height: 28px; color: var(--v5-ink-3)">{{ m.k }}</text>
            <!-- 骨架条:只属**占位格**(健康格有活数据,刷新期间保持旧值,不糊骨架 ——
                 R2 审计:下拉链 900ms 后 load 600ms,任何纯时长防抖都会被常量击穿,
                 「有值不换骨架」才是真防闪;300ms 防抖只管占位格自己的拉取显示)。 -->
            <view v-if="m.skeleton" class="mt-1.5" style="height: 18px; width: 72%; border-radius: 6px; background: var(--v5-surface-3)" />
            <text
              v-else
              class="block mt-0.5 tabular-nums"
              :style="{ fontFamily: 'var(--font-v5)', fontWeight: 600, fontSize: m.vSize ?? '20px', color: m.tone, letterSpacing: '-0.014em', lineHeight: 1.05, whiteSpace: 'nowrap' }"
            >{{ m.v }}</text>

            <text
              v-if="m.sub"
              class="block mt-1 font-mono-tabular truncate"
              :style="{ fontSize: '12px', color: m.subTone ?? 'var(--v5-ink-4)' }"
            >{{ m.sub }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useLocaleStore } from "@/store/locale";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { computed, onUnmounted, ref, watch } from "vue";
import NxSection from '@/components/ui/nx-section.vue';
import NetworkStatStrip, { type NetworkStatCell } from './network-stat-strip.vue';
import { useAuditUiCopy } from '@/i18n/audit-ui';
const props = defineProps<{compactView?:boolean;estimated?:boolean;registeredDisplay?:number|null}>();
const copy = useAuditUiCopy();
import { useT } from "@/i18n/use-t";
import { useConfig } from "@/store/config";
import { compactNumber as compact, networkPopulationBand } from "@/lib/platform-stats";
import { formatGroupedAmount } from "@/lib/amount-display";
import { navTo } from "@/lib/route";

const t = useT();
const locale = useLocaleStore();
const cfg = useConfig();
useAutoRecovery({ failed: () => cfg.syncFailed && !cfg.loading, retry: () => cfg.load() });

// 🔴 骨架防闪的真机制(R2 审计后改):**有活数据的格永不切骨架**(stale-while-revalidate,
//   下拉链 await 900ms 后 load 600ms,600>300 恒成立,纯时长防抖必被击穿)。
//   本防抖只服务**占位格**自己的「拉取中」显示:>300ms 才亮,免得点重试闪一下(规格 ⑤)。
const showSkeleton = ref(false);
let skeletonTimer: ReturnType<typeof setTimeout> | null = null;
watch(() => cfg.loading, (l) => {
  if (props.compactView) return;
  if (l) {
    skeletonTimer = setTimeout(() => { showSkeleton.value = true; }, 300);
  } else {
    if (skeletonTimer !== null) { clearTimeout(skeletonTimer); skeletonTimer = null; }
    showSkeleton.value = false;
  }
});
onUnmounted(() => { if (skeletonTimer !== null) clearTimeout(skeletonTimer); }); // R3 P2 卫生债

// Lite keeps only the shared network figures, with placeholders while reads recover.

interface Cell {
  k: string;
  v: string;
  vSize?: string;
  tone: string;
  sub: string;
  subTone?: string;
  data?: number[] | null;
  color?: string;
  /** Compact view: a whole count shown with thousands separators and the digit roll. */
  count?: number;
  skeleton?: boolean; // 只属占位格:健康格有活数据,刷新期间保持旧值(stale-while-revalidate),不糊骨架
  tap?: () => void;
}

function activate(action?: () => void) {
  action?.();
}

function placeholderCell(label: string, skeleton = showSkeleton.value): Cell {
  return {
    k: label,
    v: "—",
    vSize: "12.5px",
    tone: "var(--v5-ink-3)",
    sub: "",
    subTone: "var(--v5-tech-cyan-ink)",
    data: null,
    skeleton,
  };
}

const metrics = computed<Cell[]>(() => {
  const failed = cfg.syncFailed;
  const pulse = failed ? null : cfg.config.networkPulse;
  // H9 supplies the published counts and the server supplies the device estimate.
  // Online devices read as the whole number in the compact view (BUG-531); members keep the shared band.
  const displayCell = (label: string, value: number | null | undefined, color: string, whole = false): Cell => {
    if (value === null || value === undefined || !Number.isSafeInteger(value) || value < 0) return placeholderCell(label);
    if (whole && props.compactView) return { k: label, v: formatGroupedAmount(value, "full"), count: value, tone: "var(--v5-ink)", sub: "", data: null, color };
    return { k: label, v: props.compactView ? networkPopulationBand(value, locale.code) : compact(value), tone: "var(--v5-ink)", sub: "", data: null, color };
  };
  const memberValue = props.compactView && props.estimated ? props.registeredDisplay : pulse?.registeredUsers;
  const members = displayCell(t.value.home.networkMembers, memberValue, "var(--v5-brand)");
  const devices = displayCell(t.value.home.networkDevices, pulse?.onlineDevices, "var(--v5-tech-cyan-ink)", true);

  return [members, devices];
});
const stripCells = computed<NetworkStatCell[]>(() => metrics.value.map(m => ({ key: m.k, label: m.k, count: m.count, text: m.v, vSize: m.vSize, tap: m.tap })));


</script>
<style scoped>
</style>
