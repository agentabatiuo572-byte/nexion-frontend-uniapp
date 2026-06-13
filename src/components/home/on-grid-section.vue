<!--
  OnGridSection — ZONE 2 "what the network is computing now" (ported from
  mission-control.tsx OnGridSection). Header (On Nexion grid · now · Map) + 3
  client rows (id badge · model · client·city · GPUs) + live footer. Client list
  is mock data (proper nouns, untranslated).
-->
<template>
  <view>
    <view class="flex items-center justify-between" style="margin: 8px 2px 10px">
      <text style="font-family: var(--font-v5); font-weight: 600; font-size: 15px; color: var(--v5-ink); letter-spacing: -0.012em">{{ t.home.onGridTitle }} <text class="font-mono-tabular" style="font-size: 11.5px; font-weight: 400; color: var(--v5-ink-3)">{{ t.home.onGridNow }}</text></text>
      <text class="font-mono-tabular" style="font-size: 13px; color: var(--v5-brand); font-weight: 500" @click="goGlobe">{{ t.home.onGridMap }} →</text>
    </view>

    <view style="background: var(--v5-surface); border: 1px solid var(--v5-border); border-radius: 16px; overflow: hidden">
      <view
        v-for="(c, i) in GRID_CLIENTS"
        :key="c.id"
        class="grid items-center gap-3 px-4 py-2.5"
        :style="{ gridTemplateColumns: '32px 1fr auto', borderBottom: i < GRID_CLIENTS.length - 1 ? '1px solid var(--v5-border)' : 'none' }"
      >
        <view class="grid place-items-center" style="width: 30px; height: 30px; border-radius: 8px; background: var(--v5-brand-soft)">
          <text :style="{ color: c.color, fontFamily: 'var(--font-v5)', fontWeight: 600, fontSize: '12px' }">{{ c.id }}</text>
        </view>
        <view class="min-w-0">
          <text class="block truncate" style="font-family: var(--font-v5); font-weight: 500; font-size: 13.5px; color: var(--v5-ink); letter-spacing: -0.008em">{{ c.model }}</text>
          <text class="block font-mono-tabular mt-0.5 truncate" style="font-size: 11.5px; color: var(--v5-ink-3)">{{ c.name }} <text style="color: var(--v5-ink-4)">· {{ c.city }}</text></text>
        </view>
        <text class="font-mono-tabular tabular-nums text-right whitespace-nowrap" style="font-size: 12px; color: var(--v5-success); font-weight: 500">{{ gpusText(i) }}</text>
      </view>
      <view class="px-4 py-2 flex items-center justify-between font-mono-tabular" style="border-top: 1px solid var(--v5-border); background: var(--v5-surface-2); font-size: 11px; color: var(--v5-ink-3)">
        <text><text style="color: var(--v5-ink); font-weight: 500">28,432</text> {{ t.home.onGridOnline }}</text>
        <text style="color: var(--v5-success); font-weight: 500">+$215/sec</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";

const t = useT();

const GRID_CLIENTS = [
  { id: "P", name: "Pocket Studios", model: "SDXL Turbo", color: "var(--v5-brand)", city: "Berlin" },
  { id: "H", name: "Helix Labs", model: "Llama 3.2 3B", color: "var(--v5-success)", city: "SF" },
  { id: "E", name: "Echo Earbuds", model: "Whisper tiny", color: "var(--v5-tech-cyan)", city: "Tokyo" },
];

function gpusText(i: number) {
  return fmt(t.value.home.onGridGpus, { n: 30 + i * 27 });
}
function goGlobe() {
  uni.navigateTo({ url: "/pages/globe/globe", fail: () => {} });
}
</script>
