export type JanusExecutorMode = "sandbox" | "remote";

export type JanusExecutorCommand = {
  subject: string;
  targetKey: string;
  targetUrl: string;
  targetVersion: number;
  targetCatalogVersion: number;
  commandVersion: number;
};

export type JanusExecutorEvidence = {
  handoffReceipt: string;
  proofMode: "SANDBOX";
  executorId: "sandbox";
  proofNonce: string;
  proofTimestamp: number;
  proofSignature: string;
};

type Options = {
  mode: JanusExecutorMode;
  production: boolean;
  allowedSubjects: readonly string[];
  allowedTargetKeys: readonly string[];
  now: () => number;
  sandboxToken?: string;
};

async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

/** Explicit QA executor. It is impossible to instantiate as a production fallback. */
export function createJanusExecutor(options: Options) {
  const subjects = new Set(options.allowedSubjects.map((item) => item.trim()).filter(Boolean));
  const targets = new Set(options.allowedTargetKeys.map((item) => item.trim()).filter(Boolean));
  const receipts = new Map<string, Promise<JanusExecutorEvidence>>();

  async function apply(command: JanusExecutorCommand): Promise<JanusExecutorEvidence> {
    if (options.production || options.mode !== "sandbox") throw new Error("JANUS_REMOTE_EXECUTOR_REQUIRED");
    if (!subjects.has(command.subject)) throw new Error("JANUS_SANDBOX_ACCOUNT_FORBIDDEN");
    if (!targets.has(command.targetKey)) throw new Error("JANUS_SANDBOX_TARGET_FORBIDDEN");
    const parsed = new URL(command.targetUrl);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error("JANUS_SANDBOX_TARGET_URL_INVALID");
    }
    const key = JSON.stringify(command);
    const existing = receipts.get(key);
    if (existing) return existing;
    const evidence = (async () => {
      const proofHash = await digest(key);
      return {
        handoffReceipt: `sandbox:v1:${proofHash}`,
        proofMode: "SANDBOX" as const,
        executorId: "sandbox" as const,
        proofNonce: proofHash,
        proofTimestamp: options.now(),
        proofSignature: options.sandboxToken ?? "",
      };
    })();
    receipts.set(key, evidence);
    return evidence;
  }

  return { apply };
}
