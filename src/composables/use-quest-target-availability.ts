import { computed, onMounted, ref, watch } from "vue";
import { exchangeApi, remoteApiEnabled, stakingApi } from "@/api/runtime";
import type { StakingPool } from "@/api/staking-api";
import { useStaking } from "@/store/staking";
import { canOpenStakingPool, type StakingConfigState } from "@/lib/staking-canonical";
import { isWeeklyQuestTargetClosed, type QuestTargetAvailability } from "@/lib/quest-business-availability";
import { genesisBlockIsKnownUnavailable } from "@/store/genesis-config";
import { useGenesisSaleBlocks } from "./use-genesis-sale-gate";
import type { CanonicalQuest } from "@/api/quest-api";
import { STAKING_TERMS } from "@/store/staking";
import { questProductNo } from "@/lib/quest-presentation";
import { getProduct } from "@/mock/products";
import { productCatalogPresentation, productCatalogState, refreshProductCatalog, revalidateProductCatalog } from "@/store/product-catalog";
import { onShow } from "./use-tab-page-lifecycle";
import { useAutoRecovery } from "./use-auto-recovery";
import { isProductAvailable } from "@/store/product-availability";
import { resolveActivePhase } from "@/store/product-phase";
import { useApp } from "@/store/app";

export function questActionRouteUnavailable(route: string): boolean {
  if (!route) return true;
  const productNo = questProductNo(route);
  if (!productNo) return false;
  if (!remoteApiEnabled) {
    const product = getProduct(productNo);
    return !product || !isProductAvailable(product, resolveActivePhase(useApp().user.joinedAt));
  }
  return productCatalogState.status === "ready"
    && !productCatalogPresentation.value?.products.some(product => product.id === productNo && product.releaseState === "AVAILABLE");
}

export function useQuestCatalogRead(needed: () => boolean) {
  const read = () => {
    if (needed()) void revalidateProductCatalog();
  };
  watch(needed, read, { immediate: true });
  onShow(read);
  useAutoRecovery({
    active: needed,
    failed: () => productCatalogState.status === "error",
    retry: () => refreshProductCatalog(),
  });
}

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
const exchangeClosed = ref(false);
const remotePools = ref<StakingPool[] | null>(null);

export function useQuestTargetAvailability(readOnMount = true) {
  const staking = useStaking();

  /**
   * 🔴 任务面自己读「现在还有没有档位可售」(zentao #127/#155)。
   *
   * 判据原本挂在 `staking.remoteReady` 上,而那个标志由 `syncRemote` 置位 —— 它同时还要
   * 拉**用户自己的持仓**。任务页既不调 syncRemote,就算调了,持仓那一半读失败也会把
   * remoteReady 留在 false,于是 `stakingClosed` 恒为 false:**闸门在任务面上永远是开的**,
   * 质押四档全部「暂停售卖」时周任务卡照样渲染「去完成」。
   *
   * 「有没有档位可售」本来就只需要那份**公开只读**的方案目录
   * (`GET /api/config/staking/pools`,与质押页方案行同源),不需要用户持仓。
   * 与兑换那一路(caps)同形:进页面拉一次,失败算「不知道」(fail open)。
   */
  onMounted(() => {
    if (!readOnMount || !remoteApiEnabled) return;
    void stakingApi.fetchStakingPools().then((pools) => {
      remotePools.value = pools;
    }).catch(() => {
      // Fail open: 读不到方案目录是「不知道」,不是「已停售」。
      remotePools.value = null;
    });
  });

  // 兑换开关是**公开只读**的 caps 文档(wallet-exchange 页也读它),进页面就拉一次:
  // 任务面本来就要为「有没有兑换任务」决定措辞,少一个"先问再拉"的两段状态,
  // 也避免首帧里兑换任务先按不可用渲染、下一 tick 才变灰。
  onMounted(() => {
    if (!readOnMount || !remoteApiEnabled) return;
    void exchangeApi.fetchCaps().then((caps) => {
      exchangeClosed.value = caps.swapEnabled === false;
    }).catch(() => {
      // Fail open: an unreadable caps document is "unknown", never "closed".
      exchangeClosed.value = false;
    });
  });

  const stakingClosed = computed(() => {
    // 本地 mock 模式仍按既有读数判(没有远程目录可读)。
    const pools = remoteApiEnabled ? remotePools.value ?? (staking.remoteReady ? staking.pools : null) : staking.pools;
    // Only a successfully read catalogue can prove there is nothing on sale.
    if (!pools) return false;
    const state: StakingConfigState = {
      isMockMode: staking.isMockMode,
      remoteReady: true,
      pools,
    };
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

/** Me and Missions compare the same gates as the cards using already-read data. */
export function useWeeklyQuestTargetClosed(now: () => number) {
  const availability = useQuestTargetAvailability(false);
  const { block, secondaryBlock } = useGenesisSaleBlocks(now);
  return (quest: Pick<CanonicalQuest, "layer" | "actionRoute">): boolean => questActionRouteUnavailable(quest.actionRoute) || isWeeklyQuestTargetClosed(
    quest,
    { ...availability.value, genesisBlocked: genesisBlockIsKnownUnavailable(block.value) },
    secondaryBlock.value !== null,
  );
}
