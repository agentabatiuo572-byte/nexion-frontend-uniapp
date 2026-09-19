import { computed, onMounted, ref } from "vue";
import { exchangeApi, remoteApiEnabled } from "@/api/runtime";
import { useStaking } from "@/store/staking";
import { canOpenStakingPool, type StakingConfigState } from "@/lib/staking-canonical";
import type { QuestTargetAvailability } from "@/lib/quest-business-availability";
import { STAKING_TERMS } from "@/store/staking";

/**
 * 任务目标业务可用性的**唯一读数入口**,喂给 quest-business-availability 的报警器。
 *
 * 🔴 每一档都遵守「不知道就别说」:读取未就绪 / 失败一律算**可用**(false)。
 *   把「还不知道」当成「已经关了」会诬告服务端,并把 console error = 0 那批运行时门打红。
 *
 * 数据来源都是既有权威:
 *   · 质押 —— useStaking 的远程方案快照(与质押页方案行同源,零额外请求);
 *   · 兑换 —— `/api/config/exchange/caps`(公开只读,wallet-exchange 页已在用),
 *             进页面拉一次,失败算「不知道」;
 *   · 创世 —— 由调用方从 useGenesisSaleGate 传入(那里已是唯一派生出口)。
 */
export function useQuestTargetAvailability() {
  const staking = useStaking();
  const exchangeClosed = ref(false);

  // 兑换开关是**公开只读**的 caps 文档(wallet-exchange 页也读它),进页面就拉一次:
  // 任务面本来就要为「有没有兑换任务」决定措辞,少一个"先问再拉"的两段状态,
  // 也避免首帧里兑换任务先按可用渲染、下一 tick 才变灰。
  onMounted(() => {
    if (!remoteApiEnabled) return;
    void exchangeApi.fetchCaps().then((caps) => {
      exchangeClosed.value = caps.swapEnabled === false;
    }).catch(() => {
      // Fail open: an unreadable caps document is "unknown", never "closed".
      exchangeClosed.value = false;
    });
  });

  const stakingClosed = computed(() => {
    const state: StakingConfigState = {
      isMockMode: staking.isMockMode,
      remoteReady: staking.remoteReady,
      pools: staking.pools,
    };
    // Only a ready remote snapshot can prove there is nothing on sale.
    if (!state.remoteReady) return false;
    return !STAKING_TERMS.some((term) => canOpenStakingPool(state, term));
  });

  return computed<QuestTargetAvailability>(() => ({
    // configUnavailable(「还不知道」)已由 genesisBlockIsKnownUnavailable 排除,
    // 调用方传进来的就是「确定不可用」。
    genesisBlocked: false,
    stakingClosed: stakingClosed.value,
    exchangeClosed: exchangeClosed.value,
  }));
}
