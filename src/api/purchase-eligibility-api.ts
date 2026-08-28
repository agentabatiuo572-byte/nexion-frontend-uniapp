import type { ApiClient } from "./api-client";
import type { ApiEnvironment } from "./runtime-config";

export const PURCHASE_ELIGIBILITY_SOURCE = "nx_product + nx_admin_device_sku + nx_user" as const;

export interface PurchaseEligibilitySnapshot {
  productNo: string;
  eligible: boolean;
  decisionCode: string;
  evaluatedAt: number;
  source: typeof PURCHASE_ELIGIBILITY_SOURCE;
  sourceEnvironment: "PRODUCTION";
  runId: string | null;
  serverCanonical: true;
}

function parse(value: unknown, expectedProductNo: string, mode: ApiEnvironment): PurchaseEligibilitySnapshot {
  const row = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
  const trustedProvenance = (mode === "dev" || mode === "prod")
    && row?.sourceEnvironment === "PRODUCTION" && row.runId === null;
  if (!row || row.productNo !== expectedProductNo || typeof row.eligible !== "boolean"
      || typeof row.decisionCode !== "string" || !row.decisionCode
      || typeof row.evaluatedAt !== "number" || !Number.isFinite(row.evaluatedAt)
      || row.source !== PURCHASE_ELIGIBILITY_SOURCE
      || row.serverCanonical !== true || !trustedProvenance) {
    throw new Error("PURCHASE_ELIGIBILITY_RESPONSE_INVALID");
  }
  return row as unknown as PurchaseEligibilitySnapshot;
}

export function createPurchaseEligibilityApi(client: ApiClient, mode: ApiEnvironment = "prod") {
  return {
    get: async (productNo: string) => {
      const normalized = productNo.trim();
      if (!normalized) throw new Error("PURCHASE_ELIGIBILITY_PRODUCT_REQUIRED");
      return parse(await client.request({
        method: "GET",
        path: `/api/store/purchase-eligibility?productNo=${encodeURIComponent(normalized)}`,
      }), normalized, mode);
    },
  };
}
