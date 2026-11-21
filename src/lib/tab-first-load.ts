import { computed, nextTick, onScopeDispose, reactive, ref, watch, type Ref } from "vue";
import { apiRuntimeConfig, remoteApiEnabled, sessionVault } from "@/api/runtime";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { useFreeTrial } from "@/store/free-trial";
import { useVoucher } from "@/store/voucher";
import { useEarnConfig } from "@/store/earn-config";
import { productCatalogState, revalidateProductCatalog } from "@/store/product-catalog";
import { refreshServerProductPhase } from "@/store/server-product-phase";
import { readHomePromotions } from "@/store/home-promotions";
import { useCommission } from "@/store/commission";
import { useNetwork } from "@/store/network";
import { useVRank } from "@/store/v-rank";
import { useReferralReward } from "@/store/referral-reward";
import { useProfile } from "@/store/profile";
import { ensureEarningsReleaseStatus } from "@/store/earning-release";
import { useMarket } from "@/store/market";
import { appReadForeground, appReadOnline, documentReadVisible, foregroundReadAllowed } from "./foreground-read";
import { passiveTabReadScope, runPassiveTabRead } from "./passive-tab-read";
import { remoteAccountScope } from "./remote-account-epoch";

// Process lifetime, including H5 Home reLaunch. Stage 0 settles Home; 1/2 are
// the two idle batches. Ordinary refreshes and business writes do not restart it.
const runs = reactive(new Map<string, { stage: number; pending: boolean }>());
// #ifdef H5
let tabPagesPreloaded = false;
// #endif

export function useTabFirstLoad(homeVisible: Ref<boolean>, settleHome: (current: () => boolean) => Promise<unknown>): void {
  const app = useApp(), auth = useAuth(), locale = useLocaleStore();
  const sessionRevision = ref(sessionVault.revision());
  const unsubscribe = sessionVault.subscribe?.(() => { sessionRevision.value = sessionVault.revision(); });
  onScopeDispose(() => unsubscribe?.());
  const scope = computed(() => {
    void sessionRevision.value;
    const session = sessionVault.read(), account = remoteAccountScope.snapshot();
    if (!remoteApiEnabled || !auth.isAuthenticated || !session?.accessToken
      || auth.accountId !== `user:${session.user.userId}` || app.accountKey !== auth.accountId
      || account.accountKey !== app.accountKey) return "";
    return JSON.stringify([app.accountKey, app.accountBindingEpoch, passiveTabReadScope(false),
      session.sessionChainId, session.sessionGroup, session.installationId, session.appSessionVersion,
      locale.code, apiRuntimeConfig.environment, apiRuntimeConfig.baseUrl]);
  });
  const state = computed(() => {
    const key = scope.value;
    if (!key) return null;
    if (!runs.has(key)) runs.set(key, { stage: 0, pending: false });
    return runs.get(key)!;
  });
  watch([scope, homeVisible, appReadForeground, appReadOnline, documentReadVisible,
    () => state.value?.stage, () => state.value?.pending, () => productCatalogState.status],
  (_values, _previous, cleanup) => {
    const key = scope.value, run = state.value;
    const current = () => key === scope.value && homeVisible.value && foregroundReadAllowed();
    if (!key || !run || run.pending || run.stage === 3 || !current()
      || (run.stage > 0 && productCatalogState.status !== "ready")) return;
    const stage = run.stage;
    const dispatch = async () => {
      if (!current()) return;
      run.pending = true;
      try {
        if (stage === 0) {
          await nextTick();
          if (!current()) return;
          await settleHome(current);
        }
        else {
          // #ifdef H5
          // The router imports these same modules. Attempt once per process,
          // after Home settles; failures leave normal page loading in charge.
          if (!tabPagesPreloaded) {
            tabPagesPreloaded = true;
            void Promise.allSettled([
              import("@/pages/earn/earn.vue"), import("@/pages/store/store.vue"),
              import("@/pages/team/team.vue"), import("@/pages/me/me.vue"),
            ]);
          }
          // #endif
          // Same store methods, resource names and query keys as the visible
          // pages. No hidden page, observation, execution or polling lifecycle.
          const reads: (() => Promise<unknown>)[] = stage === 1 ? [
            () => app.ensureHomeTruth(), () => app.ensureRemoteFleet(),
            () => useFreeTrial().refreshVisible(), () => useVoucher().revalidateRemote(),
            () => readHomePromotions(`${app.accountKey}:${app.accountBindingEpoch}:${locale.code}`, true),
            () => revalidateProductCatalog(), () => useEarnConfig().ensure(),
            () => runPassiveTabRead("product-phase", () => refreshServerProductPhase(true)),
          ] : [
            () => useCommission().ensureCanonicalEvents(), () => useNetwork().ensureCanonicalNetwork(),
            () => useVRank().ensureCanonicalVRank(), () => useReferralReward().ensure(),
            () => useProfile().ensureAvatar(), () => ensureEarningsReleaseStatus(),
            () => runPassiveTabRead("market", () => useMarket().syncRemote()),
          ];
          await Promise.allSettled(reads.map(read => current() ? read() : Promise.resolve()));
        }
        run.stage = stage + 1;
      } finally { run.pending = false; }
    };
    if (stage === 0) { void dispatch(); return; }
    // A fresh idle turn between batches lets foreground Home work render first.
    if (typeof requestIdleCallback === "function") {
      const idle = requestIdleCallback(() => { void dispatch(); });
      cleanup(() => cancelIdleCallback(idle));
    } else {
      const timer = setTimeout(() => { void dispatch(); }, 0);
      cleanup(() => clearTimeout(timer));
    }
  }, { immediate: true, flush: "post" });
}
