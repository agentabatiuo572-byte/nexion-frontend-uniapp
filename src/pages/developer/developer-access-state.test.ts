import { describe, expect, it } from "vitest";
import type { DeveloperAccessReceipt } from "@/api/developer-access-api";
import { developerAccessReviewReasonKey, developerAccessState } from "./developer-access-state";

function receipt(status: DeveloperAccessReceipt["status"], reviewReason?: DeveloperAccessReceipt["reviewReason"]): DeveloperAccessReceipt {
  return { requestNo: "DEV-1", idempotencyKey: "key", status, submittedAt: "2026-08-31T00:00:00Z", source: "server", sourceEnvironment: "PRODUCTION", runId: "", reviewReason };
}

describe("developer access state", () => {
  it.each(["PENDING", "APPROVED"] as const)("does not offer a duplicate application for %s", (status) => {
    expect(developerAccessState(receipt(status))?.canReapply).toBe(false);
  });

  it.each(["REJECTED", "REVOKED", "EXPIRED"] as const)("allows a new server application after %s", (status) => {
    expect(developerAccessState(receipt(status))?.canReapply).toBe(true);
  });

  it("renders only an allowlisted public review reason", () => {
    expect(developerAccessReviewReasonKey(receipt("REVOKED", "ACCESS_REVOKED_BY_POLICY")))
      .toBe("reviewReasonAccessRevokedByPolicy");
    expect(developerAccessReviewReasonKey(receipt("REVOKED"))).toBeNull();
  });
});
