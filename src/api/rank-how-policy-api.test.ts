import { describe, expect, it, vi } from "vitest";
import { createRankHowPolicyApi } from "./rank-how-policy-api";

const policy = { status: "PUBLISHED", version: "r3", locale: "en", hero: "Rank policy", sections: [{ id: "qualification", title: "Qualification", body: "Server rules", order: 1 }], source: "server", sourceEnvironment: "PRODUCTION", runId: "" };
describe("rank how policy API", () => {
  it("reads localized published policy from the server", async () => {
    const request = vi.fn().mockResolvedValue(policy);
    const result = await createRankHowPolicyApi({ request } as never).published("en");
    expect(result.sections[0].body).toBe("Server rules");
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: "/api/config/v-rank-policy?locale=en" }));
  });
  it("rejects draft, empty, or malformed policy instead of falling back", async () => {
    const request = vi.fn().mockResolvedValue({ ...policy, status: "DRAFT" });
    await expect(createRankHowPolicyApi({ request } as never).published("en")).rejects.toThrow("RANK_HOW_POLICY_RESPONSE_INVALID");
  });
});
