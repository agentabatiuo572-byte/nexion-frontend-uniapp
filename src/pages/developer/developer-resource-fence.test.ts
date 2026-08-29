import { describe, expect, it } from "vitest";
import { createDeveloperResourceFenceReader } from "./developer-resource-fence";
import { advanceRuntimeRevision } from "@/api/order-api";

describe("developer resource async fence", () => {
  it("rejects a response after account switch or generation invalidation", () => {
    let account = "account-a";
    let generation = 1;
    advanceRuntimeRevision("catalog-run-20260816");
    const fence = createDeveloperResourceFenceReader(() => account, () => generation);
    const first = fence.capture();

    expect(fence.isCurrent(first)).toBe(true);
    account = "account-b";
    expect(fence.isCurrent(first)).toBe(false);

    account = "account-a";
    generation += 1;
    expect(fence.isCurrent(first)).toBe(false);
    advanceRuntimeRevision("catalog-run-20260817");
    expect(fence.isCurrent(first)).toBe(false);
    advanceRuntimeRevision(null);
  });
});
