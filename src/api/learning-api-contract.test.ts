import { expect, test } from "vitest";
import { createLearningApi } from "./learning-api";
import type { ApiError } from "./errors";
import { setCurrentCommerceSandboxRun } from "./order-api";

const RUN = "run-20260816";

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
      serverCanonical: true,
      sourceEnvironment: "SANDBOX",
      runId: RUN,
    }),
  } as never);

  await expect(api.submitQuiz("h3-live-20260722", "v1", [0], "learning-quiz:h3-live-20260722:v1"))
    .rejects.toMatchObject({
      kind: "protocol",
      message: "LEARNING_RESPONSE_INVALID",
    } satisfies Partial<ApiError>);
});

test("sends the stable quiz key outside the request body and binds the answer to the displayed version", async () => {
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
        serverCanonical: true,
        sourceEnvironment: "SANDBOX",
        runId: RUN,
      };
    },
  } as never, "dev");

  setCurrentCommerceSandboxRun(RUN);

  await api.submitQuiz("h3-live-20260722", "v1", [0], "learning-quiz:h3-live-20260722:v1");

  expect(request).toEqual({
    method: "POST",
    path: "/api/content/learning/courses/h3-live-20260722/quiz",
    idempotencyKey: "learning-quiz:h3-live-20260722:v1",
    body: { answers: [0], expectedVersion: "v1" },
  });
});

test("binds start and content-only completion to the displayed version", async () => {
  const requests: unknown[] = [];
  const course = {
    id: "h3-live-20260722", title: "Course", body: "Body", category: "Basics", format: "Article", level: "Beginner",
    duration: "5 min", rewardNex: "20.000000", featured: true, version: "v1", progress: 1, completed: false,
    attempts: 0, lastScore: 0, rewardGranted: false, serverCanonical: true, source: "mock", sourceEnvironment: "SANDBOX", runId: RUN, permanentLabel: "ACCEPTANCE SANDBOX • NON-PRODUCTION", questions: [],
  };
  const result = {
    courseId: "h3-live-20260722", version: "v1", score: 100, passed: true, completed: true,
    rewardGranted: true, rewardNex: "20.000000", attempts: 1, serverCanonical: true, sourceEnvironment: "SANDBOX", runId: RUN,
  };
  const api = createLearningApi({ request: async (request: unknown) => {
    requests.push(request);
    return requests.length === 1 ? course : result;
  } } as never, "dev");

  setCurrentCommerceSandboxRun(RUN);

  await api.start("h3-live-20260722", "vi", "v1");
  await api.complete("h3-live-20260722", "v1");

  expect(requests).toEqual([
    { method: "POST", path: "/api/content/learning/courses/h3-live-20260722/start?language=vi&version=v1" },
    { method: "POST", path: "/api/content/learning/courses/h3-live-20260722/complete?version=v1" },
  ]);
});

test.each([
  { source: "provider", sourceEnvironment: "SANDBOX", runId: "run-1", permanentLabel: "ACCEPTANCE SANDBOX • NON-PRODUCTION" },
  { source: "mock", sourceEnvironment: "SANDBOX", runId: "run!", permanentLabel: "ACCEPTANCE SANDBOX • NON-PRODUCTION" },
  { source: "mock", sourceEnvironment: "SANDBOX", runId: "run-1", permanentLabel: "Sandbox" },
])("rejects an unproven learning sandbox projection: %o", async (provenance) => {
  const api = createLearningApi({ request: async () => ({
    id: "course-1", title: "Course", body: "Body", category: "Basics", format: "Article", level: "Beginner",
    duration: "5 min", rewardNex: "1.0", featured: false, version: "v1", progress: 0, completed: false,
    attempts: 0, lastScore: 0, rewardGranted: false, serverCanonical: true, questions: [], ...provenance,
  }) } as never, "dev");

  await expect(api.course("course-1", "en")).rejects.toMatchObject({
    kind: "protocol",
    message: "LEARNING_RESPONSE_INVALID",
  } satisfies Partial<ApiError>);
});

test("rejects a sandbox learning response from a stale commerce run", async () => {
  setCurrentCommerceSandboxRun(RUN);
  const api = createLearningApi({ request: async () => ({
    id: "course-1", title: "Course", body: "Body", category: "Basics", format: "Article", level: "Beginner",
    duration: "5 min", rewardNex: "1.0", featured: false, version: "v1", progress: 0, completed: false,
    attempts: 0, lastScore: 0, rewardGranted: false, serverCanonical: true, source: "mock",
    sourceEnvironment: "SANDBOX", runId: RUN, permanentLabel: "ACCEPTANCE SANDBOX • NON-PRODUCTION", questions: [],
  }) } as never, "dev");
  setCurrentCommerceSandboxRun("run-20260817");
  await expect(api.course("course-1", "en")).rejects.toMatchObject({ message: "LEARNING_RESPONSE_INVALID" } satisfies Partial<ApiError>);
  setCurrentCommerceSandboxRun(null);
});
