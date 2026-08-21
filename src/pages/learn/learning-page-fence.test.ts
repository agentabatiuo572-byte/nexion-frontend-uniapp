import { afterEach, describe, expect, it } from "vitest";
import { setCurrentCommerceSandboxRun, captureCommerceSandboxRun } from "@/api/order-api";
import { createLearningPageFenceReader } from "./learning-page-fence";

describe("learning page async fence", () => {
  afterEach(() => setCurrentCommerceSandboxRun(null));

  it("drops late responses after account, run, generation, or mount changes", () => {
    let account = "user-a";
    let epoch = 1;
    let generation = 1;
    let mounted = true;
    setCurrentCommerceSandboxRun("run-20260816");
    const reader = createLearningPageFenceReader(
      () => account,
      () => epoch,
      () => captureCommerceSandboxRun(),
      () => generation,
      () => mounted,
    );
    const scope = reader.capture();
    expect(reader.isCurrent(scope)).toBe(true);
    account = "user-b";
    expect(reader.isCurrent(scope)).toBe(false);
    account = "user-a";
    epoch += 1;
    expect(reader.isCurrent(scope)).toBe(false);
    epoch -= 1;
    generation += 1;
    expect(reader.isCurrent(scope)).toBe(false);
    generation -= 1;
    mounted = false;
    expect(reader.isCurrent(scope)).toBe(false);
    mounted = true;
    setCurrentCommerceSandboxRun("run-20260817");
    expect(reader.isCurrent(scope)).toBe(false);
  });
});
