import { isCurrentCommerceSandboxScope, type CommerceSandboxRunScope } from "@/api/order-api";

export interface LearningPageFence {
  accountKey: string;
  accountEpoch: number;
  runScope: CommerceSandboxRunScope;
  generation: number;
}

export function createLearningPageFenceReader(
  getAccountKey: () => string,
  getAccountEpoch: () => number,
  getRunScope: () => CommerceSandboxRunScope,
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
        && isCurrentCommerceSandboxScope(scope.runScope);
    },
  };
}
