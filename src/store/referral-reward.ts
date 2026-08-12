import { ref } from "vue";
import { defineStore } from "pinia";
import { referralRewardApi, remoteApiEnabled } from "@/api/runtime";
import type { ReferralRewardSnapshot } from "@/api/referral-reward-api";

export const useReferralReward = defineStore("referralReward", () => {
  const snapshot = ref<ReferralRewardSnapshot | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let accountEpoch = 0;

  async function refresh(limit = 10): Promise<boolean> {
    if (!remoteApiEnabled) {
      snapshot.value = null;
      error.value = "REFERRAL_REWARD_SERVER_REQUIRED";
      return false;
    }
    const epoch = accountEpoch;
    loading.value = true;
    error.value = null;
    try {
      const next = await referralRewardApi.snapshot(limit);
      if (epoch !== accountEpoch) return false;
      snapshot.value = next;
      return true;
    } catch (cause) {
      if (epoch === accountEpoch) {
        snapshot.value = null;
        error.value = cause instanceof Error ? cause.message : "REFERRAL_REWARD_LOAD_FAILED";
      }
      return false;
    } finally {
      if (epoch === accountEpoch) loading.value = false;
    }
  }

  function bindAccount(_accountKey: string) {
    accountEpoch += 1;
    snapshot.value = null;
    error.value = null;
    void refresh();
  }
  return { snapshot, loading, error, refresh, bindAccount };
});
