import { defineStore } from "pinia";
import { ref } from "vue";
import { remoteApiEnabled, riskDisclosureApi } from "@/api/runtime";
import type { RiskDisclosureCurrent } from "@/api/risk-disclosure-api";

/** The server disclosure/version is the only compliance fact; never persist an acknowledgement locally. */
export const useRiskDisclosure = defineStore("riskDisclosure", () => {
  const current = ref<RiskDisclosureCurrent | null>(null);
  const accepted = ref(false);
  const acceptedAt = ref<number | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  function apply(snapshot: RiskDisclosureCurrent | null) {
    current.value = snapshot;
    accepted.value = snapshot?.acknowledged ?? false;
    acceptedAt.value = snapshot?.acknowledgedAt ? Date.parse(snapshot.acknowledgedAt) || null : null;
  }
  async function refresh() {
    apply(null);
    error.value = null;
    if (!remoteApiEnabled) { error.value = "RISK_DISCLOSURE_REMOTE_REQUIRED"; return; }
    loading.value = true;
    try {
      const snapshot = await riskDisclosureApi.current();
      current.value = snapshot;
      accepted.value = snapshot.acknowledged;
      acceptedAt.value = snapshot.acknowledgedAt ? Date.parse(snapshot.acknowledgedAt) || null : null;
    } catch (cause) {
      apply(null);
      error.value = cause instanceof Error ? cause.message : "RISK_DISCLOSURE_UNAVAILABLE";
    } finally { loading.value = false; }
  }
  async function accept() {
    if (!current.value || accepted.value) return false;
    loading.value = true;
    error.value = null;
    try { apply(await riskDisclosureApi.acknowledge(current.value)); return accepted.value; }
    catch (cause) { apply(null); error.value = cause instanceof Error ? cause.message : "RISK_DISCLOSURE_ACKNOWLEDGEMENT_FAILED"; return false; }
    finally { loading.value = false; }
  }
  function bindAccount() { apply(null); void refresh(); }
  function reset() { apply(null); void refresh(); }
  return { current, accepted, acceptedAt, loading, error, refresh, accept, reset, bindAccount };
});
