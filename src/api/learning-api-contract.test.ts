import { expect, test } from "vitest";
import { createLearningApi } from "./learning-api";
import type { ApiError } from "./errors";

test("fails closed when a quiz response contains a malformed reward amount", async () => {
  const api = createLearningApi({
    request: async () => ({
      courseId: "h3-live-20260722",
      version: "v1",
      score: 100,
      passed: true,
      completed: true,
      rewardGranted: true,
      rewardNex: { amount: 20 },
      attempts: 1,
    }),
  } as never);

  await expect(api.submitQuiz("h3-live-20260722", [0], "learning-quiz:h3-live-20260722:v1"))
    .rejects.toMatchObject({
      kind: "protocol",
      message: "LEARNING_RESPONSE_INVALID",
    } satisfies Partial<ApiError>);
});

test("sends the stable H3 idempotency key outside the request body", async () => {
  let request: unknown;
  const api = createLearningApi({
    request: async (value: unknown) => {
      request = value;
      return {
        courseId: "h3-live-20260722",
        version: "v1",
        score: 100,
        passed: true,
        completed: true,
        rewardGranted: true,
        rewardNex: "20.000000",
        attempts: 1,
      };
    },
  } as never);

  await api.submitQuiz("h3-live-20260722", [0], "learning-quiz:h3-live-20260722:v1");

  expect(request).toEqual({
    method: "POST",
    path: "/api/content/learning/courses/h3-live-20260722/quiz",
    idempotencyKey: "learning-quiz:h3-live-20260722:v1",
    body: { answers: [0] },
  });
});
