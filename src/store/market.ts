import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { marketApi, remoteApiEnabled } from "@/api/runtime";
import type { ExternalMarketQuote } from "@/api/market-api";
import type { ServerSourceEnvironment } from "@/api/runtime-provenance";
import { subscribeCurrentCommerceSandboxRun } from "@/api/order-api";

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
  const externalQuotes = ref<ExternalMarketQuote[]>([]);
  const externalError = ref<string | null>(null);
  const externalReady = ref(isMockMode);
  const externalSourceEnvironment = ref<ServerSourceEnvironment | null>(null);
  const marketRunId = ref<string | null>(null);
  let authorityGeneration = 0;
  let nexGeneration = 0;
  let externalGeneration = 0;
  let syncAllInFlight: Promise<boolean> | null = null;
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

  function clearExternalState() {
    externalQuotes.value = [];
    externalReady.value = false;
    externalSourceEnvironment.value = null;
  }

  function commitNex(snapshot: Awaited<ReturnType<typeof marketApi.fetch>>) {
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
  }

  function sameAuthority(
    left: { sourceEnvironment: ServerSourceEnvironment; runId: string },
    right: { sourceEnvironment: ServerSourceEnvironment; runId: string },
  ): boolean {
    return left.sourceEnvironment === right.sourceEnvironment && left.runId === right.runId;
  }

  // 权威不可达是常态输入,不 reject(resilience 门同族;z6 审计 P0:
  // wallet-nex 的 setInterval 裸发 tickPrice → 原 throw 每 3s 一个 unhandledRejection)。
  async function syncRemote(): Promise<boolean> {
    if (!remoteApiEnabled) return true;
    if (syncAllInFlight) return syncAllInFlight;
    const authority = authorityGeneration;
    const generation = ++nexGeneration;
    try {
      const snapshot = await marketApi.fetch();
      if (authority !== authorityGeneration || generation !== nexGeneration) return false;
      if (marketRunId.value !== null && marketRunId.value !== snapshot.runId) clearExternalState();
      marketRunId.value = snapshot.runId;
      commitNex(snapshot);
      return true;
    } catch {
      if (authority !== authorityGeneration || generation !== nexGeneration) return false;
      clearRemoteState();
      marketRunId.value = null;
      remoteError.value = "G3_REMOTE_AUTHORITY_UNAVAILABLE";
      return false;
    }
  }

  async function syncExternal(): Promise<boolean> {
    if (!remoteApiEnabled) return true;
    if (syncAllInFlight) return syncAllInFlight;
    const authority = authorityGeneration;
    const generation = ++externalGeneration;
    clearExternalState();
    externalError.value = null;
    try {
      const snapshot = await marketApi.external();
      if (authority !== authorityGeneration || generation !== externalGeneration) return false;
      if (marketRunId.value !== null && marketRunId.value !== snapshot.runId) {
        externalError.value = "EXTERNAL_MARKET_AUTHORITY_MISMATCH";
        return false;
      }
      marketRunId.value = snapshot.runId;
      externalSourceEnvironment.value = snapshot.sourceEnvironment;
      if (snapshot.availability !== "AVAILABLE" || snapshot.quotes.length === 0) {
        externalError.value = "EXTERNAL_MARKET_AUTHORITY_UNAVAILABLE";
        return false;
      }
      externalQuotes.value = snapshot.quotes;
      externalReady.value = true;
      return true;
    } catch {
      if (authority !== authorityGeneration || generation !== externalGeneration) return false;
      externalError.value = "EXTERNAL_MARKET_AUTHORITY_UNAVAILABLE";
      return false;
    }
  }

  function syncAll(): Promise<boolean> {
    if (!remoteApiEnabled) return Promise.resolve(true);
    if (syncAllInFlight) return syncAllInFlight;
    const authority = authorityGeneration;
    const nexRequest = ++nexGeneration;
    const externalRequest = ++externalGeneration;
    const operation = (async () => {
      try {
        const [nexResult, externalResult] = await Promise.allSettled([marketApi.fetch(), marketApi.external()]);
        if (authority !== authorityGeneration || nexRequest !== nexGeneration
            || externalRequest !== externalGeneration) return false;
        if (nexResult.status === "rejected" && externalResult.status === "rejected") {
          throw new Error("MARKET_AUTHORITY_UNAVAILABLE");
        }
        if (nexResult.status === "fulfilled" && externalResult.status === "fulfilled"
            && !sameAuthority(nexResult.value, externalResult.value)) {
          throw new Error("MARKET_AUTHORITY_MISMATCH");
        }

        if (nexResult.status === "fulfilled") {
          marketRunId.value = nexResult.value.runId;
          commitNex(nexResult.value);
        } else {
          marketRunId.value = externalResult.status === "fulfilled" ? externalResult.value.runId : null;
          clearRemoteState();
          remoteError.value = "G3_REMOTE_AUTHORITY_UNAVAILABLE";
        }

        clearExternalState();
        externalError.value = null;
        if (externalResult.status === "rejected") {
          externalError.value = "EXTERNAL_MARKET_AUTHORITY_UNAVAILABLE";
          return false;
        }
        externalSourceEnvironment.value = externalResult.value.sourceEnvironment;
        if (externalResult.value.availability === "AVAILABLE" && externalResult.value.quotes.length > 0) {
          externalQuotes.value = externalResult.value.quotes;
          externalReady.value = true;
          return nexResult.status === "fulfilled";
        }
        externalError.value = "EXTERNAL_MARKET_AUTHORITY_UNAVAILABLE";
        return false;
      } catch {
        if (authority !== authorityGeneration || nexRequest !== nexGeneration
            || externalRequest !== externalGeneration) return false;
        marketRunId.value = null;
        clearRemoteState();
        clearExternalState();
        remoteError.value = "G3_REMOTE_AUTHORITY_UNAVAILABLE";
        externalError.value = "EXTERNAL_MARKET_AUTHORITY_UNAVAILABLE";
        return false;
      }
    })();
    syncAllInFlight = operation;
    void operation.finally(() => {
      if (syncAllInFlight === operation) syncAllInFlight = null;
    });
    return operation;
  }

  if (remoteApiEnabled) {
    subscribeCurrentCommerceSandboxRun((scope) => {
      authorityGeneration += 1;
      nexGeneration += 1;
      externalGeneration += 1;
      // Detach the prior Run's shared flight before mounted home cards retry.
      // The old promise still settles, but its generation can no longer commit
      // and its finally block cannot clear a newer flight.
      syncAllInFlight = null;
      marketRunId.value = null;
      remoteError.value = null;
      externalError.value = null;
      clearRemoteState();
      clearExternalState();
      // The catalogue can establish the Sandbox Run while the first market
      // request is still in flight. Start the replacement here so mounted
      // cards cannot remain in an endless loading state waiting for a watch
      // transition that never occurs (marketRunId was still null).
      if (scope.runId !== null) void syncAll();
    });
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
    externalQuotes, externalError, externalReady, externalSourceEnvironment, marketRunId,
    syncRemote, syncExternal, syncAll, tickPrice,
  };
});
