import { expect, test } from "vitest";
import { createSingleFlight } from "./learning-submission";

test("coalesces a double tap into exactly one submit request", async () => {
  let calls = 0;
  const submit = createSingleFlight(async () => {
    calls += 1;
    await Promise.resolve();
    return { completed: true };
  });

  const first = submit();
  const second = submit();

  expect(first).toBe(second);
  await expect(first).resolves.toEqual({ completed: true });
  expect(calls).toBe(1);
});

test("clears the flight after a failed request without replaying it", async () => {
  let calls = 0;
  const submit = createSingleFlight(async () => {
    calls += 1;
    throw new Error("request failed");
  });

  await expect(submit()).rejects.toThrow("request failed");
  expect(calls).toBe(1);
});
