<!--
  NetworkPulseCard — ZONE 2 global-grid metrics(规格 FEAT-HOME02)。
  三格:注册用户 / 在线设备 / 你的排名 —— 全部由展示配置与真实派生驱动,零写死值。
-->
<template>
  <view>
    <view class="flex items-center justify-between" style="margin: 8px 2px 10px">
      <text style="font-family: var(--font-v5); font-weight: 600; font-size: 15px; color: var(--v5-ink); letter-spacing: -0.012em">{{ t.home.networkPulseTitle }}</text>
      <text class="font-mono-tabular" style="font-size: 12px; color: var(--v5-tech-cyan-ink)">{{ t.home.networkLive }}</text>
    </view>

    <view style="background: var(--v5-surface); border-radius: 16px; overflow: hidden">
      <view class="px-3.5 py-2.5 flex justify-between items-center font-mono-tabular" style="border-bottom: 1px solid var(--v5-border); background: var(--v5-surface-2); font-size: 12px; color: var(--v5-ink-3)">
        <view class="inline-flex items-center gap-1.5">
          <PulseDot color="var(--v5-tech-cyan)" />
          <text>{{ t.home.networkGlobalGrid }}</text>
        </view>
        <!-- 条头右侧刻意留空:实时支付流数字已删(FEAT-HOME02 定案,与「今日支付」同一笔钱两种表达)。 -->
      </view>

      <view class="grid grid-cols-3">
        <view
          v-for="(m, i) in metrics"
          :key="m.k"
          class="grid items-center gap-2"
          :class="m.tap ? 'active:opacity-70' : ''"
          :style="{ gridTemplateColumns: '1fr', padding: '12px', borderRight: i < metrics.length - 1 ? '1px solid var(--v5-border)' : 'none', minWidth: 0 }"
          v-on="m.tap ? { click: m.tap } : {}"
        >
          <view class="min-w-0">
            <text class="block font-mono-tabular" style="font-size: 12px; color: var(--v5-ink-3)">{{ m.k }}</text>
            <!-- 骨架条:配置重拉中(<300ms 不闪由 store 合成延迟保证,mock 期只在「重试」后可见) -->
            <view v-if="m.skeleton" class="mt-1.5" style="height: 18px; width: 72%; border-radius: 6px; background: var(--v5-surface-3)" />
            <text
              v-else
              class="block mt-0.5 tabular-nums"
              :style="{ fontFamily: 'var(--font-v5)', fontWeight: 600, fontSize: m.vSize ?? '20px', color: m.tone, letterSpacing: '-0.014em', lineHeight: 1.05, whiteSpace: 'nowrap' }"
            >{{ m.v }}</text>
            <!-- 可点副行(未上榜引导 CTA)才挂监听 + active 反馈;纯展示副行零监听 ——
                 无条件挂 handler 会让 tap-feedback 探针把不可点的格也计为 tap 目标(P-059 同轮抓的)。
                 热区:负 margin 抵消的 padding 把可点面拉到 ≥40px,视觉不变。 -->
            <text
              v-if="m.subTap"
              class="block mt-1 font-mono-tabular truncate active:opacity-70"
              :style="{ fontSize: '12px', color: m.subTone ?? 'var(--v5-ink-4)', padding: '14px 0', margin: '-14px 0' }"
              @click.stop="m.subTap()"
            >{{ m.sub }}</text>
            <text
              v-else
              class="block mt-1 font-mono-tabular truncate"
              :style="{ fontSize: '12px', color: m.subTone ?? 'var(--v5-ink-4)' }"
            >{{ m.sub }}</text>
          </view>
          <view style="height: 32px">
            <HomeSparkline v-if="m.data" :data="m.data" :color="m.color" :height="32" />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { useConfig } from "@/store/config";
import { useRankSnapshot } from "@/store/rank-snapshot";
import { computeRank } from "@/lib/network-rank";
import { derivedRegisteredUsers } from "@/lib/platform-stats";
import { toast } from "@/store/ui";
import { navTo } from "@/lib/route";
import PulseDot from "./pulse-dot.vue";
import HomeSparkline from "./home-sparkline.vue";

const t = useT();
const app = useApp();
const cfg = useConfig();
const snap = useRankSnapshot();

// 时间锚:进场取一次,onShow 由首页下拉刷新链路带动重渲(排名禁缓存,但也不该每秒重算 ——
// 分位表与算力在秒级都不变;真正的秒级时钟属于创世倒计时那类,不属于这里)。
const nowTs = ref(Date.now());
onMounted(() => { nowTs.value = Date.now(); });

/** 紧凑缩写(规格异常6):超长数字不撑破 89.3px 值槽,不换行断字。 */
function compact(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 100_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
/** 装饰性走势(确定性,从当前值倒推 8 点缓坡;不声称历史数据,只是视觉纹理)。 */
const ramp = (v: number) => Array.from({ length: 8 }, (_, i) => v * (0.997 + i * 0.0004));

// ── 格 1:注册用户(基数按月增速从锚点推算;派生值同时是排名分母的真实人口)──
const registered = computed(() => derivedRegisteredUsers(cfg.config.publicStats, nowTs.value));
// ── 格 3:名次(每次渲染由当下算力 + 当下配置现算,禁缓存名次)──
const rank = computed(() =>
  computeRank({
    myTotalHashrate: app.myTotalHashrateAt(nowTs.value),
    table: cfg.config.publicStats.hashratePercentileTable,
    realPopulation: registered.value,
    virtualPopulation: cfg.config.publicStats.virtualUserCount,
  }),
);
const rankDelta = computed(() => {
  const r = rank.value;
  return r.kind === "ranked" ? snap.deltaFor(r.rank, nowTs.value) : null;
});

interface Cell {
  k: string;
  v: string;
  vSize?: string;
  tone: string;
  sub: string;
  subTone?: string;
  data?: number[] | null;
  color?: string;
  skeleton: boolean;
  tap?: () => void;
  subTap?: () => void;
}

/** 配置失败的占位格(规格异常2:骨架→「数据更新中」+ 重试;禁回退写死数字)。 */
function placeholderCell(label: string): Cell {
  return {
    k: label,
    v: t.value.home.networkStatUpdating,
    vSize: "12.5px",
    tone: "var(--v5-ink-3)",
    sub: t.value.home.networkStatRetry,
    subTone: "var(--v5-tech-cyan-ink)",
    data: null,
    skeleton: cfg.loading,
    tap: () => { void cfg.load(); },
  };
}

const metrics = computed<Cell[]>(() => {
  const ps = cfg.config.publicStats;
  const failed = cfg.syncFailed;

  // 格 1 注册用户 —— 单项非法只坏本格(规格异常3)
  const membersBad = failed || !Number.isFinite(registered.value) || registered.value < 0;
  const members: Cell = membersBad
    ? placeholderCell(t.value.home.networkMembers)
    : {
        k: t.value.home.networkMembers,
        v: compact(registered.value),
        tone: "var(--v5-ink)",
        sub: fmt(t.value.home.networkMembersSub, { n: ps.registeredUsersMonthlyGrowthPct }),
        data: ramp(registered.value),
        color: "var(--v5-brand)",
        skeleton: cfg.loading,
      };

  // 格 2 在线设备 —— 值来自 store 的呼吸态(基线与带宽都由配置驱动,见 app.ts)
  const devicesBad = failed || !Number.isFinite(ps.fleetDevices) || ps.fleetDevices <= 0;
  const devices: Cell = devicesBad
    ? placeholderCell(t.value.home.networkDevices)
    : {
        k: t.value.home.networkDevices,
        v: compact(app.global.activeDevices),
        tone: "var(--v5-ink)",
        sub: t.value.home.networkDevicesSub,
        data: ramp(app.global.activeDevices),
        color: "var(--v5-tech-cyan-ink)",
        skeleton: cfg.loading,
      };

  // 格 3 你的排名 —— 三态(规格 ⑤/异常1/异常2)
  const r = rank.value;
  let rankCell: Cell;
  if (failed || r.kind === "unavailable") {
    rankCell = placeholderCell(t.value.home.networkYourRank);
  } else if (r.kind === "unranked") {
    rankCell = {
      k: t.value.home.networkYourRank,
      // 未上榜整态降档(槽位契约:vi 全称 20px 放不下,≤12px 才进 89.3px 槽 —— 见 en.ts 注)
      v: t.value.home.networkRankUnranked,
      vSize: "12.5px",
      tone: "var(--v5-ink-2)",
      sub: t.value.home.networkRankUnrankedHint,
      subTone: "var(--v5-brand)",
      data: null,
      skeleton: cfg.loading,
      tap: () => toast.info(t.value.home.networkRankTipUnranked),
      subTap: () => navTo("/store"), // 引导整条即 CTA(规格 ⑥:设备/商城既有入口)
    };
  } else {
    rankCell = {
      k: t.value.home.networkYourRank,
      v: `#${compact(r.rank)}`,
      tone: "var(--v5-brand)",
      sub: rankDelta.value !== null ? fmt(t.value.home.networkRankUp24h, { n: rankDelta.value }) : "",
      // 名次越小越好:走势画成向下缓坡(视觉「在前进」),数据仍是确定性装饰
      data: Array.from({ length: 8 }, (_, i) => -r.rank * (1 + (7 - i) * 0.0004)),
      color: "var(--v5-brand)",
      skeleton: cfg.loading,
      tap: () => toast.info(t.value.home.networkRankTipRanked),
    };
  }

  return [members, devices, rankCell];
});
</script>
