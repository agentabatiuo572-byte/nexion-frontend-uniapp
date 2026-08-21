import { SPEC_UNAVAILABLE } from "@/api/product-catalog-contract";
import type { PublishedTrustSection, TrustLocale } from "@/api/trust-section-api";
import type { Product } from "@/mock/products";
import { localizedTrustFieldValue } from "./trust-fields";

export interface HomepageProductTrust {
  product: Product;
  gpu: string | null;
  datacenter: string | null;
  warranty: string | null;
}

export interface HomepageTrustSummary {
  chips: string[];
  reserveProof: string | null;
}

function certifiedDisplayValue(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && normalized.toLowerCase() !== SPEC_UNAVAILABLE ? normalized : null;
}

export function selectHomepageProductTrust(products: readonly Product[]): HomepageProductTrust | null {
  const candidates = products.filter((product) => product.available !== false && !product.purchaseBlocked);
  const selected = candidates.map((product, index) => {
    const gpu = certifiedDisplayValue(product.gpu);
    const datacenter = certifiedDisplayValue(product.datacenter);
    const warranty = certifiedDisplayValue(product.warranty);
    return {
      index,
      score: Number(gpu !== null) + Number(datacenter !== null) + Number(warranty !== null),
      value: { product, gpu, datacenter, warranty },
    };
  }).sort((left, right) => right.score - left.score || left.index - right.index)[0];
  return selected?.value ?? null;
}

export function buildHomepageTrustSummary(
  sections: readonly PublishedTrustSection[],
  locale: TrustLocale,
): HomepageTrustSummary {
  const fields = (key: PublishedTrustSection["sectionKey"]) =>
    sections.find((section) => section.sectionKey === key)?.fields ?? [];
  const badges = fields("complianceBadges");
  return {
    chips: Array.from({ length: 7 }, (_, index) =>
      localizedTrustFieldValue(badges, `badge${index + 1}Label`, locale),
    ).filter((value): value is string => value !== null),
    reserveProof: localizedTrustFieldValue(fields("auditsReserves"), "homepageProof", locale),
  };
}
