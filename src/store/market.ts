import { defineStore } from "pinia";
import { ref, computed } from "vue";

// Ported from Nexion-prototype/lib/v3/market.ts (zustand → Pinia).
// NEX 拉盘 K 线(假币市场) — MOCK-ONLY: price decided client-side; production
// subscribes /api/market/nex via WebSocket (server pushes canonical price).
const HOURLY_SEED = [
  0.142, 0.143, 0.141, 0.144, 0.146, 0.148, 0.151, 0.153, 0.155, 0.158, 0.162, 0.165,
  0.168, 0.171, 0.169, 0.172, 0.175, 0.178, 0.176, 0.174, 0.172, 0.170, 0.169, 0.171,
];
const DAILY_SEED = [
  0.082, 0.085, 0.088, 0.091, 0.094, 0.097, 0.102, 0.108, 0.115, 0.121, 0.118, 0.124, 0.131, 0.128, 0.135,
  0.142, 0.139, 0.146, 0.153, 0.149, 0.155, 0.161, 0.158, 0.164, 0.168, 0.172, 0.169, 0.175, 0.171, 0.171,
];

export const useMarket = defineStore("market", () => {
  const nexPriceUSDT = ref(0.171);
  const open24h = ref(0.142);
  const high24h = ref(0.178);
  const low24h = ref(0.139);
  const change24hPct = ref(20.4);
  const volume24hUSDT = ref(4_247_891);
  const circulating = ref(2_850_000_000);
  const klineHourly = ref<number[]>([...HOURLY_SEED]);
  const klineDaily = ref<number[]>([...DAILY_SEED]);
  const lastTickTs = ref(0);

  // NOTE: was a method marketCap() in zustand; now a computed (mission-control
  // call site uses `market.marketCap` without parens after port).
  const marketCap = computed(() => nexPriceUSDT.value * circulating.value);

  function tickPrice() {
    const t = Date.now();
    if (t - lastTickTs.value < 3000) return;
    const cur = nexPriceUSDT.value;
    const isPump = Math.random() < 0.08;
    const delta = isPump
      ? cur * (Math.random() * 0.06 - 0.03)
      : cur * (Math.random() * 0.012 - 0.006);
    const next = Math.max(0.001, cur + delta);
    nexPriceUSDT.value = next;
    high24h.value = Math.max(high24h.value, next);
    low24h.value = Math.min(low24h.value, next);
    change24hPct.value = ((next - open24h.value) / open24h.value) * 100;
    klineHourly.value = [...klineHourly.value.slice(1), next];
    lastTickTs.value = t;
  }

  return {
    nexPriceUSDT, open24h, high24h, low24h, change24hPct, volume24hUSDT,
    circulating, klineHourly, klineDaily, lastTickTs, marketCap, tickPrice,
  };
});
