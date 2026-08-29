import { isCurrentRuntimeRevision, type RuntimeRevisionScope } from "@/api/order-api";

export interface LearningPageFence {
  accountKey: string;
  accountEpoch: number;
  runScope: RuntimeRevisionScope;
  generation: number;
}

export function createLearningPageFenceReader(
  getAccountKey: () => string,
  getAccountEpoch: () => number,
  getRunScope: () => RuntimeRevisionScope,
  getGeneration: () => number,
  isMounted: () => boolean,
) {
  return {
    capture(): LearningPageFence {
      return {
        accountKey: getAccountKey(),
        accountEpoch: getAccountEpoch(),
        runScope: getRunScope(),
        generation: getGeneration(),
      };
    },
    isCurrent(scope: LearningPageFence): boolean {
      return isMounted()
        && scope.accountKey === getAccountKey()
        && scope.accountEpoch === getAccountEpoch()
        && scope.generation === getGeneration()
        && isCurrentRuntimeRevision(scope.runScope);
    },
  };
}
