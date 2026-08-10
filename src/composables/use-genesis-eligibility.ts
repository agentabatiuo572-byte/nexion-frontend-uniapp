import { computed, type ComputedRef } from "vue";
import type { DeviceKind } from "@/store/types";
import { useApp } from "@/store/app";
import { useVRank } from "@/store/v-rank";
import {
  useGenesis,
  GENESIS_ELIGIBILITY,
  evaluateGenesisEligibility,
  type GenesisGateResult,
} from "@/store/genesis";

/**
 * useGenesisEligibility — 创世节点认购资格门（规格 FEAT-GEN08）。
 *
 * 照 use-device-eligibility 的组合层模式：跨 store 组合只发生在 composable/页面层
 * （stores never import each other，PITFALLS P-031/032）。组合 app / v-rank / genesis
 * 三 store 成 GenesisEligibilityCtx，交给 store 层纯函数 evaluateGenesisEligibility
 * 单源求值 —— 商城尊享卡 / 预售 dock / 购买 sheet / 二级承接四处共用本 composable。
 *
 * ⚠️ MOCK-ONLY：client 侧资格判定是 UI affordance；真后台
 * GET /api/genesis/eligibility 是唯一权威（配置 server-canonical → admin G4）。
 */

/** 旗舰（Flagship tier）设备 kind 集合。与 products.ts tier 口径一致。 */
const FLAGSHIP_KINDS: readonly DeviceKind[] = ["stellarrack-p1", "stellarrack-p2"];

export interface UseGenesisEligibilityResult {
  /** 完整资格求值（eligible / conditions / cap）。 */
  gate: ComputedRef<GenesisGateResult>;
  /** 认购资格（不含 cap 维度）。 */
  eligible: ComputedRef<boolean>;
  /** 资格门是否约束二级承接（appliesTo === "both"）。 */
  gatesSecondary: ComputedRef<boolean>;
}

export function useGenesisEligibility(): UseGenesisEligibilityResult {
  const app = useApp();
  const vRank = useVRank();
  const genesis = useGenesis();

  const gate = computed<GenesisGateResult>(() =>
    evaluateGenesisEligibility(GENESIS_ELIGIBILITY, {
      cumulativeDepositUsdt: app.user.cumulativeDepositUsdt,
      vRank: vRank.myRank,
      // active + inventory 都计（countOwned 语义）。
      flagshipCount: app.visibleDevices.filter((d) => FLAGSHIP_KINDS.includes(d.kind)).length,
      // 🔴 判定 = 「本账号**真持有一个已核销的码**」(规格 FEAT-GEN11 ⑦),不再看格式:
      // 问码表(status=used && redeemedBy=本账号),user 侧字段只是展示凭证不作数。
      // 重算时机:本 computed 同时读了 app.user(上面 cumulativeDepositUsdt),核销成功会整体
      // 替换 user.value → 依赖触发 → UI 立刻解锁,不需要额外订阅码表。
      // The server redemption response is mirrored on the signed-in user only for
      // rendering. Eligibility itself is always re-evaluated by Genesis APIs.
      hasInvite: genesis.hasGenesisInvite,
      myOwned: genesis.myOwned,
    }),
  );

  const eligible = computed(() => gate.value.eligible);
  const gatesSecondary = computed(() => GENESIS_ELIGIBILITY.appliesTo === "both");

  return { gate, eligible, gatesSecondary };
}
