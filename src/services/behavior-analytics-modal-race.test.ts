import { beforeEach, expect, test, vi } from "vitest";

vi.mock("@/api/runtime", () => ({
  behaviorAnalyticsApi: {},
  remoteApiEnabled: true,
}));

const {
  createBehaviorTracker,
  isAcceptanceObservationModalOpen,
  onAcceptanceObservationModalOpened,
  onAcceptanceObservationModalClosed,
} = await import("./behavior-analytics");

const token = "c".repeat(64);

beforeEach(() => {
  (globalThis as { uni?: unknown }).uni = {
    setClipboardData: vi.fn(),
    showModal: vi.fn(() => new Promise(() => undefined)),
  };
});

test("credential modal exposes one close event for voucher arbitration", async () => {
  let resolveModal: (() => void) | undefined;
  let modalOptions: { complete?: () => void } | undefined;
  (globalThis as unknown as { uni: { setClipboardData: () => void; showModal: (options: typeof modalOptions) => Promise<void> } }).uni.showModal = vi.fn((options) => {
    modalOptions = options;
    return new Promise<void>((resolve) => { resolveModal = resolve; });
  });

  const closed = vi.fn();
  const opened = vi.fn();
  const tracker = createBehaviorTracker({
    transport: {
      ingest: async () => ({
        accepted: true,
        duplicate: false,
        eventId: "event-1",
        source: "mock" as const,
        sourceEnvironment: "SANDBOX" as const,
        runId: "h5.20260818",
        observationToken: token,
      }),
    },
    now: () => 1_700_000_000_000,
    sessionId: "s".repeat(32),
    deviceType: () => "H5",
    locale: () => "en-US",
    eventId: () => "e".repeat(32),
    credentialScope: "user:a",
    enabled: () => true,
  });

  tracker.tap({ route: "/pages/index/index", clientX: 1, clientY: 1, viewportWidth: 10, viewportHeight: 10 });
  await tracker.flush();
  expect(isAcceptanceObservationModalOpen()).toBe(true);

  // The App chassis may subscribe after the analytics transport has opened
  // the native modal. Late subscribers must still receive the current modal
  // lifecycle so voucher arbitration cannot lose its one-shot retry.
  const unsubscribeOpened = onAcceptanceObservationModalOpened(opened);
  const unsubscribe = onAcceptanceObservationModalClosed(closed);
  expect(opened).toHaveBeenCalledWith(expect.objectContaining({ scope: "user:a", token: expect.any(Number) }));

  modalOptions?.complete?.();
  resolveModal?.();
  await Promise.resolve();
  expect(closed).toHaveBeenCalledOnce();
  expect(closed).toHaveBeenCalledWith(expect.objectContaining({ scope: "user:a", token: expect.any(Number) }));
  expect(isAcceptanceObservationModalOpen()).toBe(false);
  unsubscribe();
  unsubscribeOpened();
});
