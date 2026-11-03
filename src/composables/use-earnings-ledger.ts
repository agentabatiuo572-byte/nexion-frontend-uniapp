import { computed } from "vue";
import { remoteApiEnabled } from "@/api/runtime";
import { parseServerTimestamp } from "@/api/server-time";
import { useT } from "@/i18n/use-t";
import { formatUsd } from "@/lib/usd-display";
import { useApp } from "@/store/app";

// Local demo rows only; remote rows come from the Home canonical projection.
const DEMO_ROWS = [
  { id: 1, who: "Pocket Studios", model: "SDXL Turbo", amt: formatUsd(0.00032, "detail", true) },
  { id: 2, who: "Echo Earbuds", model: "Whisper tiny", amt: formatUsd(0.00005, "detail", true) },
  { id: 3, who: "Helix Labs", model: "Llama 3.2 3B", amt: formatUsd(0.00021, "detail", true) },
  { id: 4, who: "Mosaic Studios", model: "Flux Schnell", amt: formatUsd(0.00048, "detail", true) },
  { id: 5, who: "Vector Foundry", model: "MobileBERT", amt: formatUsd(0.00009, "detail", true) },
];

/** Latest five settled micro-earnings, newest first: the Earn ledger card and the bento's latest settlement. */
export function useEarningsLedger() {
  const app = useApp();
  const t = useT();
  const remoteRows = computed(() => (app.homeTruth?.earningsLedger ?? [])
    .slice()
    .sort((a, b) => (parseServerTimestamp(b.completedAt) ?? 0) - (parseServerTimestamp(a.completedAt) ?? 0))
    .slice(0, 5)
    .map((entry) => ({
      id: entry.id,
      who: entry.client,
      model: entry.model,
      amt: formatUsd(entry.rewardUsdt, "detail", !entry.synthetic),
    })));
  const rows = computed(() => remoteApiEnabled ? remoteRows.value : DEMO_ROWS);
  const statusText = computed(() => {
    if (app.homeTruthStatus === "loading" || app.homeTruthStatus === "idle") return t.value.home.networkStatUpdating;
    if (app.homeTruthStatus === "error") return t.value.uiChrome.unavailable;
    return t.value.home.ledgerEmpty;
  });
  return { rows, statusText };
}
