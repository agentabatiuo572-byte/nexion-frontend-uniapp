import type { ApiClient } from "./api-client";
import { isCurrentCommerceSandboxRun } from "./order-api";
import type { ApiEnvironment } from "./runtime-config";

export interface PurchaseEligibilitySnapshot {
  productNo: string;
  eligible: boolean;
  decisionCode: string;
  evaluatedAt: number;
  source: "nx_admin_device_sku.purchase_gate_json + nx_user";
  sourceEnvironment: "PRODUCTION" | "SANDBOX";
  runId: string | null;
  serverCanonical: true;
}

function parse(value: unknown, expectedProductNo: string, mode: ApiEnvironment): PurchaseEligibilitySnapshot {
  const row = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
  const trustedProvenance = mode === "prod"
    ? row?.sourceEnvironment === "PRODUCTION" && row.runId === null
    : mode === "dev"
      ? row?.sourceEnvironment === "SANDBOX" && isCurrentCommerceSandboxRun(row.runId)
      : false;
  if (!row || row.productNo !== expectedProductNo || typeof row.eligible !== "boolean"
      || typeof row.decisionCode !== "string" || !row.decisionCode
      || typeof row.evaluatedAt !== "number" || !Number.isFinite(row.evaluatedAt)
      || row.source !== "nx_admin_device_sku.purchase_gate_json + nx_user"
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
