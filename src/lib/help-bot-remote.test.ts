import { describe, expect, it } from "vitest";
import type { NovaAiChatResponse } from "@/api/nova-ai-api";
import { buildRemoteHelpRequest, novaHelpSource } from "./help-bot-remote";

describe("remote inline help bot", () => {
  it("keeps the selected locale and bounded transcript when creating Nova input", () => {
    expect(buildRemoteHelpRequest(
      "  How do I check my order?  ",
      [
        { from: "bot", text: "Earlier answer" },
        { from: "user", text: "Previous question" },
      ],
      "zh",
    )).toEqual({
      message: "How do I check my order?",
      language: "zh",
      history: [
        { role: "assistant", content: "Earlier answer" },
        { role: "user", content: "Previous question" },
      ],
    });
  });

  it("makes the authoritative Nova provider and model visible as message source", () => {
    const response: NovaAiChatResponse = {
      reply: "Use My Orders.",
      provider: "OLLAMA_LOCAL",
      model: "gemma4-e4b-ctx32k:latest",
    };

    expect(novaHelpSource(response)).toBe("OLLAMA_LOCAL · gemma4-e4b-ctx32k:latest");
  });
});
