import { describe, expect, it } from "vitest";
import type { AppHomeEarningsLedgerRow } from "@/api/app-home-api";
import componentSource from "./live-feed-card.vue?raw";
import { buildCanonicalHomeFeed } from "./home-live-feed";

const ledger: AppHomeEarningsLedgerRow[] = [
  {
    id: "receipt-old",
    client: "Pocket Studios",
    model: "SDXL Turbo",
    rewardUsdt: 0.00032,
    completedAt: "2026-08-21T02:00:00Z",
    synthetic: false,
  },
  {
    id: "receipt-new",
    client: "Helix Labs",
    model: "Llama 3.2 3B",
    rewardUsdt: 0.247,
    completedAt: "2026-08-21T03:00:00Z",
    synthetic: false,
  },
];

describe("home canonical live feed", () => {
  it("projects the same settled receipt facts into activity and earnings tabs", () => {
    expect(buildCanonicalHomeFeed(ledger)).toEqual({
      activityRows: [
        {
          id: "receipt-new",
          client: "Helix Labs",
          model: "Llama 3.2 3B",
          rewardUsdt: 0.247,
          completedAt: "2026-08-21T03:00:00Z",
        },
        {
          id: "receipt-old",
          client: "Pocket Studios",
          model: "SDXL Turbo",
          rewardUsdt: 0.00032,
          completedAt: "2026-08-21T02:00:00Z",
        },
      ],
      earningsItems: [
        {
          id: "receipt-new",
          client: "Helix Labs",
          model: "Llama 3.2 3B",
          amountUsdt: 0.247,
          completedAt: "2026-08-21T03:00:00Z",
        },
        {
          id: "receipt-old",
          client: "Pocket Studios",
          model: "SDXL Turbo",
          amountUsdt: 0.00032,
          completedAt: "2026-08-21T02:00:00Z",
        },
      ],
    });
  });

  it("limits both views consistently without mutating the API snapshot", () => {
    const source = ledger.slice().reverse();
    const before = source.map((row) => row.id);

    const result = buildCanonicalHomeFeed(source, 1);

    expect(result.activityRows.map((row) => row.id)).toEqual(["receipt-new"]);
    expect(result.earningsItems.map((row) => row.id)).toEqual(["receipt-new"]);
    expect(source.map((row) => row.id)).toEqual(before);
  });

  it("keeps the real-data empty state empty", () => {
    expect(buildCanonicalHomeFeed([])).toEqual({ activityRows: [], earningsItems: [] });
  });

  it("keeps the formal dual-tab component canonical and isolates prototype mock data", () => {
    expect(componentSource).toContain('data-feed-mode="CANONICAL"');
    expect(componentSource).toContain("app.homeTruth?.earningsLedger ?? []");
    expect(componentSource).toContain('aria-controls="home-live-feed-panel-activity"');
    expect(componentSource).toContain('aria-controls="home-live-feed-panel-earnings"');
    expect(componentSource).not.toContain("remoteApiEnabled");
    expect(componentSource).not.toContain("FEED_POOL");
    expect(componentSource).not.toContain("setInterval");
  });
});
