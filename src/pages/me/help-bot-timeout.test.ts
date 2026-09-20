// @ts-expect-error Vitest executes this structural contract in Node; the App tsconfig intentionally omits Node globals.
import { readFileSync } from "node:fs";
import ts from "typescript";
import { computed, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLatestAbortableRequest } from "@/lib/nova-thinking";

/**
 * BUG 175: NexGridBot 提问后无限停留在「正在思考」。
 *
 * 运行的是 help.vue 里**真实的** sendToBot,不是它的再实现。用例覆盖真正的边界:
 * 远端 chat 永不 resolve(传输兜底 120s,UI 不能等它)时,thinking 必须结束、
 * 必须给出明确原因,且迟到的应答不得再污染会话。
 */
const source = readFileSync(new URL("./help.vue", import.meta.url), "utf8");

function sendToBotSource(): string {
  const from = source.indexOf("async function sendToBot");
  const to = source.indexOf("\nfunction goSupport", from);
  if (from < 0 || to < 0) throw new Error("HELP_SEND_TO_BOT_NOT_FOUND");
  return ts.transpileModule(source.slice(from, to), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
}

interface Harness {
  sendToBot: () => Promise<void>;
  botInput: { value: string };
  thinking: { value: boolean };
  botFailure: { value: "timeout" | "error" | null };
  transcript: Array<{ from: string; text: string; meta?: string }>;
}

function harness(chat: () => Promise<unknown>): Harness {
  const botInput = ref("怎么提现?");
  const thinking = ref(false);
  const botFailure = ref<"timeout" | "error" | null>(null);
  const transcript: Harness["transcript"] = [];
  const body = `
    let botDeadline = null;
    function clearBotDeadline() { if (botDeadline) clearTimeout(botDeadline); botDeadline = null; }
    const bot = { value: [] };
    const helpScope = {
      isCurrent: () => true,
      capture: () => ({ language: "zh", conversationId: "CV-TEST" }),
      add: (message) => { transcript.push(message); },
    };
    const w = { value: { botTimeout: "超时", botTimeoutHint: "可以重试", remoteFailed: "服务端失败",
      remoteSource: "来源:{source}", remoteError: "错误:{code}" } };
    const syncBotAccountScope = () => undefined;
    const bumpScroll = () => undefined;
    const fmt = (template, params) => template.replace(/\\{(\\w+)\\}/g, (_, key) => params[key] ?? "{" + key + "}");
    const novaHelpSource = () => "faq";
    const asApiError = (error) => ({ message: String(error?.message ?? error) });
    ${sendToBotSource()}
    return { sendToBot };
  `;
  const build = new Function(
    "ref", "computed", "botInput", "thinking", "botFailure", "transcript", "remoteApiEnabled",
    "locale", "novaAiApi", "buildRemoteHelpRequest", "requireCryptoUuid", "botRequestControl", "BOT_REPLY_TIMEOUT_MS",
    body,
  )(
    ref, computed, botInput, thinking, botFailure, transcript, true,
    { code: "zh" }, { chat }, (q: string, language: string, conversationId: string, turnId: string) => ({ q, language, conversationId, turnId }),
    () => "turn-id", createLatestAbortableRequest(), 25_000,
  );
  return { sendToBot: build.sendToBot, botInput, thinking, botFailure, transcript };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("NexGridBot remote reply deadline", () => {
  it("ends thinking and states the reason when the transport never answers", async () => {
    const h = harness(() => new Promise(() => {}));
    void h.sendToBot();
    expect(h.thinking.value).toBe(true);
    expect(h.botInput.value).toBe("");

    await vi.advanceTimersByTimeAsync(25_000);

    // 用户提问前看到的是「正在思考」;超时后必须回到可交互状态并说明原因。
    // sendToBot 本身仍挂在那个永不 settle 的传输 promise 上(无法取消的传输层
    // 就是这样),但用户可见状态已经恢复 —— 输入框/发送按钮可用、有重试入口。
    expect(h.thinking.value).toBe(false);
    expect(h.botFailure.value).toBe("timeout");
    expect(h.transcript.at(-1)).toEqual({ from: "bot", text: "超时", meta: "可以重试" });
  });

  it("keeps a late answer out of the transcript once the deadline closed the turn", async () => {
    let resolveAnswer!: (value: unknown) => void;
    const answer = new Promise<unknown>((resolve) => { resolveAnswer = resolve; });
    const h = harness(() => answer);
    void h.sendToBot();
    await vi.advanceTimersByTimeAsync(25_000);
    const settled = h.transcript.length;

    resolveAnswer({ reply: "迟到的回答", source: "faq", language: "zh" });
    await Promise.resolve();
    await Promise.resolve();

    expect(h.transcript.length).toBe(settled);
    expect(h.thinking.value).toBe(false);
  });

  it("reports the server reason and closes thinking on a rejected answer", async () => {
    const h = harness(() => Promise.reject(new Error("NOVA_AI_UNAVAILABLE")));
    await h.sendToBot();

    expect(h.thinking.value).toBe(false);
    expect(h.botFailure.value).toBe("error");
    expect(h.transcript.at(-1)).toEqual({ from: "bot", text: "服务端失败", meta: "错误:NOVA_AI_UNAVAILABLE" });
  });
});
