import { describe, expect, it } from "vitest";
import type { AppHomeWorkload } from "@/api/app-home-api";
import { presentHomeMarketWorkload } from "./home-market-board";

function workload(overrides: Partial<AppHomeWorkload> = {}): AppHomeWorkload {
  return {
    code: "IG",
    name: "图像生成",
    unit: "image",
    price: 0.045,
    deltaPct: null,
    sparkline: null,
    flagshipDeltaPct: null,
    ...overrides,
  };
}

describe("presentHomeMarketWorkload", () => {
  it.each([
    ["IG", "IMG"],
    ["VG", "VID"],
    ["LL", "LLM"],
    ["FT", "FT"],
    ["EM", "EMB"],
    ["SP", "STT"],
  ] as const)("maps the real %s workload code to the compact market tag", (code, tag) => {
    expect(presentHomeMarketWorkload(workload({ code })).tag).toBe(tag);
  });

  it("formats real price, unit, sparkline and positive movement for the full table", () => {
    expect(presentHomeMarketWorkload(workload({
      name: "SDXL Turbo",
      price: 0.00032,
      deltaPct: 3.2,
      sparkline: [3, 3.1, 3.2],
    }))).toEqual({
      tag: "IMG",
      name: "SDXL Turbo",
      priceText: "$0.00032",
      unitText: "/image",
      deltaText: "+3.2%",
      deltaTone: "positive",
      sparkline: [3, 3.1, 3.2],
    });
  });

  it("keeps unavailable market facts explicit instead of inventing mock values", () => {
    expect(presentHomeMarketWorkload(workload({
      name: null,
      unit: null,
      price: null,
      deltaPct: null,
      sparkline: null,
    }))).toEqual({
      tag: "IMG",
      name: "—",
      priceText: "—",
      unitText: "—",
      deltaText: "—",
      deltaTone: "neutral",
      sparkline: null,
    });
  });

  it("keeps a negative movement readable without relying on color alone", () => {
    const display = presentHomeMarketWorkload(workload({ deltaPct: -1.1 }));
    expect(display.deltaText).toBe("-1.1%");
    expect(display.deltaTone).toBe("negative");
  });

  it("does not duplicate the separator when the PC-configured unit already starts with a slash", () => {
    expect(presentHomeMarketWorkload(workload({ unit: "/job" })).unitText).toBe("/job");
  });
});
