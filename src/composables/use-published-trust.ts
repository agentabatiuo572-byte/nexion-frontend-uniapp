import { computed, ref } from "vue";
import { trustSectionApi } from "@/api/runtime";
import type { PublishedTrustSection, TrustLocale } from "@/api/trust-section-api";
import { subscribeRuntimeRevision } from "@/api/order-api";

const sections = ref<PublishedTrustSection[]>([]);
const hasSnapshot = ref(false);
const status = ref<"idle" | "loading" | "ready" | "error">("idle");
const refreshing = computed(() => hasSnapshot.value && status.value === "loading");
const refreshError = computed(() => hasSnapshot.value && status.value === "error");
let inflight: Promise<boolean> | null = null;
let authorityGeneration = 0;

subscribeRuntimeRevision((_scope, reason) => {
  authorityGeneration += 1;
  inflight = null;
  if (reason === "catalog") {
    if (status.value !== "idle") void refreshPublishedTrust(true);
    return;
  }
  sections.value = [];
  hasSnapshot.value = false;
  status.value = "idle";
});

export function refreshPublishedTrust(force = false): Promise<boolean> {
  if (!force && status.value === "ready") return Promise.resolve(true);
  if (inflight) return inflight;
  status.value = "loading";
  const generation = authorityGeneration;
  inflight = trustSectionApi.current().then((next) => {
    if (generation !== authorityGeneration) return false;
    sections.value = next;
    hasSnapshot.value = true;
    status.value = "ready";
    return true;
  }).catch(() => {
    if (generation !== authorityGeneration) return false;
    // Keep the last validated snapshot on failure within this runtime
    // generation. Successful reads replace it, including absent sections.
    status.value = "error";
    return false;
  });
  const operation = inflight;
  void operation.finally(() => {
    if (inflight === operation) inflight = null;
  });
  return operation;
}

export function recordPublishedTrustViews(sectionKeys: string[], locale: TrustLocale): void {
  void Promise.allSettled(sectionKeys.map((sectionKey) => trustSectionApi.recordView(sectionKey, locale)));
}

export function usePublishedTrust() {
  return { sections, status, hasSnapshot, refreshing, refreshError, refresh: refreshPublishedTrust };
}
