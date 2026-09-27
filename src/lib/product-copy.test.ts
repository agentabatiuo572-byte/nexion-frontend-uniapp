import { describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { vi } from "@/i18n/messages/vi";
import { zh } from "@/i18n/messages/zh";
import type { Product } from "@/mock/products";
import { productCopy } from "./product-copy";

const cloudShare = {
  id: "cloud-share", name: "Cloud Share", tier: "Share", tagline: "云算力份额·低门槛",
  dailyEarn: 0, dailyEarnNEX: 3, price: 19.9, sold: 0, features: [], available: true,
} satisfies Product;

describe("server catalog copy", () => {
  it("localizes the published Cloud Share tagline in all three languages", () => {
    expect(productCopy(zh, cloudShare, true).tagline).toBe("云算力份额·低门槛");
    expect(productCopy(en, cloudShare, true).tagline).toBe("Cloud compute share · low entry barrier");
    expect(productCopy(vi, cloudShare, true).tagline).toBe("Suất điện toán đám mây · dễ tham gia");
  });

  it("preserves later operator edits and other products' server text", () => {
    expect(productCopy(vi, { ...cloudShare, tagline: "New offer" }, true).tagline).toBe("New offer");
    expect(productCopy(vi, { ...cloudShare, id: "another-share" }, true).tagline).toBe(cloudShare.tagline);
  });
});
