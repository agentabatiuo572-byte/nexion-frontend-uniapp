import { describe, expect, it } from "vitest";
import type { PublishedTrustSection } from "@/api/trust-section-api";
import type { Product } from "@/mock/products";
import {
  buildHomepageTrustSummary,
  selectHomepageProductTrust,
} from "./home-data-presenters";

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "box-1",
  name: "Box 1",
  tier: "Pro",
  tagline: "Managed compute",
  dailyEarn: 1,
  dailyEarnNEX: 1,
  price: 100,
  sold: 1,
  features: [],
  available: true,
  datacenter: "Virginia DC",
  warranty: "24 months",
  gpu: "H100",
  ...overrides,
});

const section = (
  sectionKey: PublishedTrustSection["sectionKey"],
  fields: Array<{ key: string; value: string }>,
): PublishedTrustSection => ({
  sectionKey,
  version: "v1",
  description: sectionKey,
  structure: "fields",
  fields: fields.map((field) => ({ ...field, label: field.key })),
});

describe("homepage real-data presenters", () => {
  it("prefers an available purchasable product with the most server-owned trust fields", () => {
    const selected = selectHomepageProductTrust([
      product({ id: "blocked", purchaseBlocked: true, warranty: "60 months" }),
      product({ id: "thin", warranty: undefined, datacenter: undefined }),
      product({ id: "trusted", warranty: "36 months", datacenter: "Singapore DC" }),
    ]);
    expect(selected?.product.id).toBe("trusted");
    expect(selected).toMatchObject({ datacenter: "Singapore DC", warranty: "36 months", gpu: "H100" });
  });

  it("treats the server unavailable sentinel as missing instead of a trust claim", () => {
    const selected = selectHomepageProductTrust([product({ datacenter: "unavailable", warranty: "unavailable" })]);
    expect(selected).toMatchObject({ datacenter: null, warranty: null, gpu: "H100" });
  });

  it("builds the homepage Trust card only from published I4 badge and reserve-proof fields", () => {
    const summary = buildHomepageTrustSummary([
      section("complianceBadges", [
        { key: "badge1Label", value: "NVIDIA" },
        { key: "badge2Label", value: "Intel" },
        { key: "badge3Label", value: "AMD" },
        { key: "badge4Label", value: "CertiK ✓" },
        { key: "badge5Label", value: "SOC 2" },
        { key: "badge6Label", value: "GDPR" },
        { key: "badge7Label", value: "ISO 27001" },
      ]),
      section("auditsReserves", [
        { key: "homepageProof.zh", value: "储备链上证明 · 102.4% 超额储备 · 信任中心 →" },
        { key: "homepageProof.en", value: "On-chain proof of reserves · 102.4% overcollateralized · Trust Center →" },
      ]),
    ], "zh");

    expect(summary).toEqual({
      chips: ["NVIDIA", "Intel", "AMD", "CertiK ✓", "SOC 2", "GDPR", "ISO 27001"],
      reserveProof: "储备链上证明 · 102.4% 超额储备 · 信任中心 →",
    });
  });

  it("keeps non-localized badges but never borrows a Chinese reserve claim for another locale", () => {
    const summary = buildHomepageTrustSummary([
      section("complianceBadges", [{ key: "badge1Label", value: "NVIDIA" }]),
      section("auditsReserves", [{ key: "homepageProof.zh", value: "储备链上证明" }]),
    ], "vi");

    expect(summary).toEqual({
      chips: ["NVIDIA"],
      reserveProof: null,
    });
  });
});
