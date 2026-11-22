import type { AppHomeWorkload } from "@/api/app-home-api";
import type { TaskCategory } from "@/store/types";
import type { Messages } from "@/i18n/messages/en";
import { compactMarketUnit, marketWorkloadCopy } from "@/lib/workload-label";
import { formatUsd } from "@/lib/usd-display";

export type HomeMarketDeltaTone = "positive" | "negative" | "neutral";

export interface HomeMarketDisplayRow {
  tag: string;
  name: string;
  priceText: string;
  unitText: string;
  deltaText: string;
  deltaTone: HomeMarketDeltaTone;
  sparkline: number[] | null;
}

const MARKET_TAGS: Record<TaskCategory, string> = {
  IG: "IMG",
  VG: "VID",
  LL: "LLM",
  FT: "FT",
  EM: "EMB",
  SP: "STT",
};

function formatPrice(price: number | null): string {
  if (price === null) return "—";
  return formatUsd(price, 'detail');
}

export function presentHomeMarketWorkload(row: AppHomeWorkload, t: Messages): HomeMarketDisplayRow {
  // The direction follows the shown one-decimal value: a change that rounds to 0.0 reads as unchanged, without a sign
  // or a trend colour; anything else keeps its sign (−0.04 → 0.0%, −0.06 → −0.1%).
  const shownDelta = row.deltaPct === null ? null : Number(row.deltaPct.toFixed(1));
  const deltaTone: HomeMarketDeltaTone = shownDelta === null || shownDelta === 0
    ? "neutral"
    : shownDelta > 0 ? "positive" : "negative";
  const copy = marketWorkloadCopy(t, row.code, row.name, row.unit);

  return {
    tag: Object.prototype.hasOwnProperty.call(MARKET_TAGS, row.code) ? MARKET_TAGS[row.code] : row.code,
    name: copy.name,
    priceText: formatPrice(row.price),
    unitText: compactMarketUnit(row.code, copy.unit),
    deltaText: shownDelta === null
      ? "—"
      : `${deltaTone === "positive" ? "+" : deltaTone === "negative" ? "−" : ""}${Math.abs(shownDelta).toFixed(1)}%`,
    deltaTone,
    sparkline: row.sparkline,
  };
}
