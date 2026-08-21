import type { NovaAiChatRequest, NovaAiChatResponse } from "@/api/nova-ai-api";

export interface HelpBotTranscriptMessage {
  from: "user" | "bot";
  text: string;
}

export function buildRemoteHelpRequest(
  message: string,
  transcript: HelpBotTranscriptMessage[],
  language: NovaAiChatRequest["language"],
): NovaAiChatRequest {
  return {
    message: message.trim(),
    language,
    history: transcript.slice(-10).map((item) => ({
      role: item.from === "user" ? "user" : "assistant",
      content: item.text.trim(),
    })),
  };
}

export function novaHelpSource(response: NovaAiChatResponse): string {
  return `${response.provider} · ${response.model}`;
}
