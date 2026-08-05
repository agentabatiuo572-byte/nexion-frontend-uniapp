<!--
  NetworkPulseCard — ZONE 2 global-grid live metrics (ported from
  mission-control.tsx NetworkPulseCard). Header + live $/sec (platform anchor ±
  wobble) + 2×2 metric grid (label · value · sub · sparkline). Money/fleet
  values derive from src/lib/platform-stats.ts + store fleet count (single
  anchor); subs are dense mock stat strings.
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
        <!-- 🔴 实时支付流数字已删(FEAT-HOME02 定案):它与「今日支付」是同一笔钱的两种表达
             (每秒值 × 86400 = 日支付额),主人 2026-07-31 拍板两处一并删。
             首页脉搏板块自此不披露任何平台支付规模,只讲用户规模、设备规模与个人位次。
             条头保留左侧「全球算力网 + 脉冲点」作为实时标记,右侧留空不补别的数字。 -->
      </view>

      <view class="grid grid-cols-3">
        <!-- 横向 padding 14 → 12:①《03》§1 8pt grid(14 不在阶梯,12=space-3)
             ②腾出 4px,修 h3 20px 指标值(如 #18,742)撑破容器 2px 的溢出 -->
        <view
          v-for="(m, i) in metrics"
          :key="m.k"
          class="grid items-center gap-2"
          :style="{ gridTemplateColumns: '1fr', padding: '12px', borderRight: i < metrics.length - 1 ? '1px solid var(--v5-border)' : 'none', minWidth: 0 }"
        >
          <view class="min-w-0">
            <text class="block font-mono-tabular" style="font-size: 12px; color: var(--v5-ink-3)">{{ m.k }}</text>
            <text class="block mt-0.5 tabular-nums" :style="{ fontFamily: 'var(--font-v5)', fontWeight: 600, fontSize: '20px', color: m.tone, letterSpacing: '-0.014em', lineHeight: 1.05, whiteSpace: 'nowrap' }">{{ m.v }}</text>
            <text class="block mt-1 font-mono-tabular truncate" style="font-size: 12px; color: var(--v5-ink-4)">{{ m.sub }}</text>
          </view>
          <view style="height: 32px">
            <HomeSparkline :data="m.data" :color="m.color" :height="32" />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import PulseDot from "./pulse-dot.vue";
import HomeSparkline from "./home-sparkline.vue";

const t = useT();
const app = useApp();

// 🔴 「今日支付」格与条头每秒支付流**一并删除**(FEAT-HOME02 定案,主人 2026-07-31 拍板):
//   两者是同一笔钱的两种表达(每秒值 × 86400 = 日支付额)。首页脉搏自此不披露平台支付规模。
//
// 🔴 **平台日支付锚本身不得删** —— 介绍页 / 信任页 / 全球网格 / 分享海报 / 商城种子
//   仍在从它派生;连锚一起删会造成全站数字坍塌。这里只是不再**展示**它。
//   `platform_stats_anchor` 哨兵原本要求本文件必须消费日支付锚那个符号,删展示后判据不再成立 ——
//   已按规格要求**调整判据而非放宽哨兵**(改判见 verify.sh 该门 (3b) 段注释)。
//
// 🔴 **注意:本文件里不许再出现那几个符号名,连注释里也不行** —— 哨兵扫全文,
//   不区分代码与注释。今天已经在三个不同文件上踩到同一个形态(接口路径 / 舰队数字 / 本处),
//   所以这里刻意用中文描述而不写符号名。

const metrics = computed(() => [
  { k: t.value.home.networkMembers, v: "1.42M", sub: "registered · +2.9% /mo", tone: "var(--v5-ink)", data: [1.38, 1.39, 1.4, 1.4, 1.41, 1.41, 1.42, 1.42], color: "var(--v5-brand)" },
  { k: t.value.home.networkDevices, v: app.global.activeDevices.toLocaleString(), sub: "live · 51.2k jobs/hr", tone: "var(--v5-ink)", data: [27.8, 27.9, 28.0, 28.1, 28.1, 28.2, 28.3, 28.4], color: "var(--v5-tech-cyan-ink)" },
  // ⏳ 排名格仍是写死值,**下一增量**接真实派生(lib/network-rank.ts 已就位并有机器门):
  //    myTotalHashrate → 百分位 → 名次;零算力显示「未上榜」。需要新增三语文案键,
  //    而 i18n 文件此刻正被独立验收读取(冻结中),故本增量先不动它。
  { k: t.value.home.networkYourRank, v: "#18,742", sub: "↑ 12 in 24h", tone: "var(--v5-brand)", data: [-19, -19, -19, -18.9, -18.9, -18.85, -18.8, -18.74], color: "var(--v5-brand)" },
]);
</script>
