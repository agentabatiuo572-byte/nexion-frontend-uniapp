import { describe, expect, it } from "vitest";
import { getOrderProductMedia, getProductMedia } from "./product-media";

describe("order machine art from SKU snapshots", () => {
  it.each(["stellarbox-s1", "stellarbox-pro-v2", "stellarbox-pro", "stellarrack-p1", "stellarrack-p2", "cloud-share"])("keeps %s history and quantity snapshots on the correct art", sku => {
    expect(getOrderProductMedia(sku)).toBe(getProductMedia(sku));
    expect(getOrderProductMedia(`${sku}×1`)).toBe(getProductMedia(sku));
    expect(getOrderProductMedia(`${sku}×12`)).toBe(getProductMedia(sku));
  });
  it("uses the first structured bundle line instead of guessing an aggregate name", () => {
    expect(getOrderProductMedia("aggregate", [{ sku: "stellarbox-pro" }, { sku: "stellarbox-s1" }])).toBe(getProductMedia("stellarbox-pro"));
  });
  it.each(["unknown×1", "stellarbox-s1×0", "stellarbox-s1x1", "stellarbox-s1×-1", "UVELBox S1", "stellarbox-s1×1 + cloud-share×1"])("keeps an unrecognized identity unknown: %s", sku => {
    expect(getOrderProductMedia(sku)).toBeNull();
  });
});
