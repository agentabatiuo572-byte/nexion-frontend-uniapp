import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { ComputeShareContent, FeatureFlagKey, PlatformConfig } from "./config-types";
import { DEFAULT_PLATFORM_CONFIG } from "@/mock/platform-config";
import { isNetworkFeeConfigUsable } from "@/store/nex-faucet";
import { completePlatformConfigSeed } from "@/lib/platform-config-compat";
import { platformConfigApi, remoteApiEnabled } from "@/api/runtime";

const IS_PRODUCTION = import.meta.env.PROD;

// Platform config / feature-flag store. Single source for client-side feature
// flags + tunable platform config across all carriers (signed APP / H5 /
// janus-loaded real-disc).
//
// MOCK-ONLY: seeded from mock/platform-config.ts. Future PROD wiring replaces
// the seed with `GET /api/config/platform` on app boot; the client treats the
// fetched response as READ-ONLY (no current admin push channel in this repo).
export const useConfig = defineStore("config", () => {
  // PROD: hydrate from GET /api/config/platform instead of the mock seed.
  const config = ref<PlatformConfig>(completePlatformConfigSeed(DEFAULT_PLATFORM_CONFIG));

  // SPEC-7 FEAT-RISK02 异常3: 配置拉取失败态。true = 结算暂停、钱包显示
  // 「收益结算稍后同步」;禁止回退到前端写死默认值继续结算。
  // PROD: GET /api/config/platform 失败/超时时由请求层置位。
  // 配置重拉的合成延迟(mock)。对齐 refresh.ts 的 REFRESH_LATENCY_MS 量级 ——
  // 必须 > 0 且够长到能画出一帧骨架,否则加载态是死 UI。
  const CONFIG_LOAD_LATENCY_MS = 600;

  const syncFailed = ref(true);

  /**
   * 🔴 提现费率配置是否合法 —— **在信任边界校验,不在消费点校验**。
   *
   * 为什么放这儿(2026-07-31 第 5 轮复验结论):原先是页面自己拿 withdrawRules 现判,
   * 属于「消费点校验」—— 任何人在页面读到值**之前**动手脚(例如给它套一层
   * 防御性默认值)就能让校验器永远看不到坏值,失败态永不触发、按写死值收费,
   * 而所有文本哨兵全绿。补文本断言补了三次、每次都被「保留被 pin 的串、改掉喂给它的数据」绕过。
   *
   * 挪到这里后,「在页面塞默认值」这个动作本身失去意义:裁决在上游已经做出,
   * 页面只消费结论。这也正是本项目 coding-style 的原话:
   * 「Validate at system boundaries / never trust external data (API responses)」。
   *
   * PROD:同一个判据用在 GET /api/config/platform 的响应上,不合法即置 syncFailed。
   */
  const feeConfigValid = computed(() =>
    isNetworkFeeConfigUsable(config.value.withdrawRules.networkConfirmFeeUsd),
  );

  function isEnabled(flag: FeatureFlagKey): boolean {
    return config.value.featureFlags[flag] === true;
  }

  /**
   * 重拉平台配置(失败态的重试出口)。
   * MOCK:清 syncFailed 即恢复(种子本就在内存)。
   * PROD:GET /api/config/platform → 成功覆盖 config 并清 syncFailed;失败保持置位。
   * 🔴 失败时**不得**把 config 重置成前端种子 —— 那等于回退写死值(FEAT-RISK02 异常3)。
   */
  const loading = ref(false);
  async function load(): Promise<void> {
    if (loading.value) return;
    loading.value = true;
    try {
      if (!remoteApiEnabled) {
        await new Promise<void>((resolve) => setTimeout(resolve, CONFIG_LOAD_LATENCY_MS));
        syncFailed.value = false;
        return;
      }
      const remote = await platformConfigApi.platformConfig();
      config.value = {
        ...config.value,
        featureFlags: { ...config.value.featureFlags, ...remote.featureFlags },
        onlineBonus: remote.onlineBonus,
        rewards: remote.rewards,
        computeShare: remote.computeShare,
      };
      syncFailed.value = false;
    } catch {
      syncFailed.value = true;
    } finally {
      loading.value = false;
    }
  }

  // ⚠️ DEV/DEMO-ONLY: 模拟配置拉取失败,演 FEAT-RISK02 异常3。
  function _devSetConfigSyncFailed(value: boolean) {
    if (IS_PRODUCTION) return;
    syncFailed.value = value;
  }

  // ⚠️ MOCK-ONLY demo helper: lets reviewers flip a flag locally to preview a
  // gated entry without an admin round-trip (front/back are not wired in the
  // prototype, DR-7). PROD: flags come from the server only; client never
  // mutates — remove this when wiring the real endpoint.
  function _devSetFlag(flag: FeatureFlagKey, value: boolean) {
    if (IS_PRODUCTION) return;
    config.value = {
      ...config.value,
      featureFlags: { ...config.value.featureFlags, [flag]: value },
    };
  }

  function _devSetComputeShareContent(content: Partial<ComputeShareContent>) {
    if (IS_PRODUCTION) return;
    config.value = {
      ...config.value,
      computeShare: {
        ...config.value.computeShare,
        content: { ...config.value.computeShare.content, ...content },
      },
    };
  }

  return { config, syncFailed, loading, load, feeConfigValid, isEnabled, _devSetFlag, _devSetComputeShareContent, _devSetConfigSyncFailed };
});

// currentNetworkConfirmFeeUsd(权威网络费跨 store 纯函数)已随 c37e642 的 D5 policy
// 权威化成为零调用死码,z1 判决包删除 —— 费用快照第 5 参权威源现为页面层
// withdrawalPolicy.networkConfirmFeeUsd(服务端 /api/withdrawals/policy),留着死函数
// 会诱使未来哨兵钉上它假绿。
