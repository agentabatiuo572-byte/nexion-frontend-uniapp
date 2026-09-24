import { describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { productCopy } from "./product-copy";
import type { Product } from "@/mock/products";

describe("server catalog capability copy", () => {
  it("does not turn a 12GB Pro into a fine-tuning or 405B promise", () => {
    const pro = {
      id: "stellarbox-pro",
      tagline: "Managed device",
      badge: "Pro",
      vram: "12GB",
      ai: { unlocks: "Fine-tune + 405B inference" },
    } as Product;

    expect(productCopy(en, pro, true)).toEqual({ tagline: "Managed device", badge: "Pro", unlocks: "" });
  });
});
