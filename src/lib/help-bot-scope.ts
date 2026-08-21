import type { RemoteAccountEpoch, RemoteAccountRequest } from "./remote-account-epoch";

export interface HelpBotMessage {
  from: "user" | "bot";
  text: string;
  meta?: string;
}

export interface HelpBotRequest extends RemoteAccountRequest {
  language: "en" | "zh" | "vi";
}

/** Account/epoch fence and transcript owner for the inline help bot. */
export function createHelpBotScope(account: RemoteAccountEpoch) {
  let bound = account.snapshot();
  let transcript: HelpBotMessage[] = [];

  function sync(): HelpBotMessage[] {
    const current = account.snapshot();
    if (current.accountKey !== bound.accountKey || current.epoch !== bound.epoch) {
      bound = current;
      transcript = [];
      return [];
    }
    return transcript;
  }

  return {
    add(message: HelpBotMessage): void {
      sync();
      transcript = [...transcript, message];
    },
    messages(): HelpBotMessage[] {
      return [...sync()];
    },
    sync,
    capture(language: HelpBotRequest["language"] = "en"): HelpBotRequest {
      sync();
      return { ...account.snapshot(), language };
    },
    isCurrent(request: HelpBotRequest): boolean {
      return account.isCurrent(request);
    },
  };
}
