import { captureRuntimeRevision, isCurrentRuntimeRevision, type RuntimeRevisionScope } from "@/api/order-api";

export interface DeveloperResourceFence {
  accountKey: string;
  generation: number;
  runScope: RuntimeRevisionScope;
}

export interface DeveloperResourceFenceReader {
  capture(): DeveloperResourceFence;
  isCurrent(fence: DeveloperResourceFence): boolean;
}

/**
 * Binds an async developer-resource operation to the account and mounted
 * resource-generation that created it.  The page owns generation changes;
 * this small dependency-free helper keeps the stale-response rule testable.
 */
export function createDeveloperResourceFenceReader(
  getAccountKey: () => string,
  getGeneration: () => number,
  getRunScope: () => RuntimeRevisionScope = captureRuntimeRevision,
): DeveloperResourceFenceReader {
  return {
    capture: () => ({ accountKey: getAccountKey(), generation: getGeneration(), runScope: getRunScope() }),
    isCurrent: (fence) => fence.accountKey === getAccountKey()
      && fence.generation === getGeneration()
      && isCurrentRuntimeRevision(fence.runScope),
  };
}
