// @ts-expect-error Vitest executes this structural contract in Node; the App tsconfig intentionally omits Node globals.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./chat.vue", import.meta.url), "utf8");
const threadSource = readFileSync(new URL("../../components/support/conversation-thread.vue", import.meta.url), "utf8");

describe("Nova new-conversation control", () => {
  it("exposes an AI-only action that rotates the conversation UUID", () => {
    expect(source).toContain('v-if="isAi && remoteApiEnabled"');
    expect(source).toContain('@click="onStartNewConversation"');
    expect(source).toContain("nova.startNewConversation()");
    expect(source).toContain('@keydown.enter.prevent="onStartNewConversation"');
    expect(source).toContain('@keydown.space.prevent="onStartNewConversation"');
  });
});

describe("Nova visible thinking cadence", () => {
  it("waits only for the remaining minimum duration before committing a fast reply", () => {
    expect(source).toContain("remainingNovaThinkingMs(requestStartedAt, novaThinkingNow())");
    expect(source).toContain("await waitForNovaThinkingDelay");
    expect(source.indexOf("await waitForNovaThinkingDelay"))
      .toBeLessThan(source.indexOf('nova.completeRemote(item.turnId, result.reply)'));
  });

  it("shows honest user-facing stages instead of exposing hidden model reasoning", () => {
    expect(source).toContain(':typing-label="thinkingLabel"');
    expect(source).toContain("t.value.nova.thinkingUnderstanding");
    expect(source).toContain("t.value.nova.thinkingChecking");
    expect(source).toContain("t.value.nova.thinkingComposing");
    expect(threadSource).toContain("{{ typingLabel }}");
  });

  it("makes the delay cancellable when the page or conversation is discarded", () => {
    expect(source).toContain("cancelNovaThinking()");
    expect(source).toContain("pendingNovaThinkingWait.resolve(false)");
    expect(source).toMatch(/onHide\(\(\) => \{[\s\S]*cancelNovaThinking\(\)/);
    expect(source).toContain("}, request.signal)");
    expect(source).toContain("novaRequestControl.isCurrent(request.epoch)");
  });
});
