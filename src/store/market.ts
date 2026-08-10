import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { marketApi, remoteApiEnabled } from "@/api/runtime";

// Local curves are deliberately available only when VITE_API_MODE=mock. Remote
// mode starts empty: an unavailable authority must never be rendered as a quote.
const HOURLY_SEED = [
  0.142, 0.143, 0.141, 0.144, 0.146, 0.148, 0.151, 0.153, 0.155, 0.158, 0.162, 0.165,
  0.168, 0.171, 0.169, 0.172, 0.175, 0.178, 0.176, 0.174, 0.172, 0.170, 0.169, 0.171,
];
const DAILY_SEED = [
  0.082, 0.085, 0.088, 0.091, 0.094, 0.097, 0.102, 0.108, 0.115, 0.121, 0.118, 0.124, 0.131, 0.128, 0.135,
  0.142, 0.139, 0.146, 0.153, 0.149, 0.155, 0.161, 0.158, 0.164, 0.168, 0.172, 0.169, 0.175, 0.171, 0.171,
];

export const useMarket = defineStore("market", () => {
  const isMockMode = !remoteApiEnabled;
  const nexPriceUSDT = ref(isMockMode ? 0.171 : 0);
  const open24h = ref(isMockMode ? 0.142 : 0);
  const high24h = ref(isMockMode ? 0.178 : 0);
  const low24h = ref(isMockMode ? 0.139 : 0);
  const change24hPct = ref(isMockMode ? 20.4 : 0);
  // The G3 endpoint does not authorise volume/supply. Zero means unavailable,
  // not a client estimate.
  const volume24hUSDT = ref(0);
  const circulating = ref(0);
  const costBasis = ref(isMockMode ? 0.085 : 0);
  const klineHourly = ref<number[]>(isMockMode ? [...HOURLY_SEED] : []);
  const klineDaily = ref<number[]>(isMockMode ? [...DAILY_SEED] : []);
  const lastTickTs = ref(0);
  const remoteError = ref<string | null>(null);
  const remoteReady = ref(isMockMode);
  const marketCap = computed(() => nexPriceUSDT.value * circulating.value);

  function clearRemoteState() {
    nexPriceUSDT.value = 0;
    open24h.value = 0;
    high24h.value = 0;
    low24h.value = 0;
    change24hPct.value = 0;
    volume24hUSDT.value = 0;
    circulating.value = 0;
    costBasis.value = 0;
    klineHourly.value = [];
    klineDaily.value = [];
    lastTickTs.value = 0;
    remoteReady.value = false;
  }

  async function syncRemote() {
    if (!remoteApiEnabled) return;
    try {
      const snapshot = await marketApi.fetch();
      const history = snapshot.history24h.map((point) => point.price);
      const series = history.length ? history : snapshot.sparkline;
      const open = series[0] ?? snapshot.currentPrice;
      nexPriceUSDT.value = snapshot.currentPrice;
      costBasis.value = snapshot.costBasis;
      open24h.value = open;
      high24h.value = Math.max(...series, snapshot.currentPrice);
      low24h.value = Math.min(...series, snapshot.currentPrice);
      change24hPct.value = ((snapshot.currentPrice - open) / open) * 100;
      klineHourly.value = series;
      klineDaily.value = snapshot.sparkline;
      lastTickTs.value = Date.now();
      remoteError.value = null;
      remoteReady.value = true;
    } catch {
      clearRemoteState();
      remoteError.value = "G3_REMOTE_AUTHORITY_UNAVAILABLE";
      throw new Error(remoteError.value);
    }
  }

  function tickPrice() {
    if (remoteApiEnabled) return syncRemote();
    const t = Date.now();
    if (t - lastTickTs.value < 3000) return;
    const cur = nexPriceUSDT.value;
    const delta = (Math.random() < 0.08 ? 0.06 : 0.012) * (Math.random() - 0.5);
    const next = Math.max(0.001, cur + cur * delta);
    nexPriceUSDT.value = next;
    high24h.value = Math.max(high24h.value, next);
    low24h.value = Math.min(low24h.value, next);
    change24hPct.value = ((next - open24h.value) / open24h.value) * 100;
    klineHourly.value = [...klineHourly.value.slice(1), next];
    lastTickTs.value = t;
  }

  return {
    isMockMode, nexPriceUSDT, open24h, high24h, low24h, change24hPct, volume24hUSDT,
    circulating, costBasis, klineHourly, klineDaily, lastTickTs, marketCap, remoteError, remoteReady,
    syncRemote, tickPrice,
  };
});
