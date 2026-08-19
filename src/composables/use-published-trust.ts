import { ref } from "vue";
import { trustSectionApi } from "@/api/runtime";
import type { PublishedTrustSection, TrustLocale } from "@/api/trust-section-api";
import { subscribeCurrentCommerceSandboxRun } from "@/api/order-api";

const sections = ref<PublishedTrustSection[]>([]);
const status = ref<"idle" | "loading" | "ready" | "error">("idle");
let inflight: Promise<boolean> | null = null;

subscribeCurrentCommerceSandboxRun(() => {
  sections.value = [];
  status.value = "idle";
});

export function refreshPublishedTrust(force = false): Promise<boolean> {
  if (!force && status.value === "ready") return Promise.resolve(true);
  if (inflight) return inflight;
  status.value = "loading";
  inflight = trustSectionApi.current().then((next) => {
    sections.value = next;
    status.value = next.length ? "ready" : "error";
    return status.value === "ready";
  }).catch(() => {
    sections.value = [];
    status.value = "error";
    return false;
  }).finally(() => { inflight = null; });
  return inflight;
}

export function recordPublishedTrustViews(sectionKeys: string[], locale: TrustLocale): void {
  void Promise.allSettled(sectionKeys.map((sectionKey) => trustSectionApi.recordView(sectionKey, locale)));
}

export function usePublishedTrust() {
  return { sections, status, refresh: refreshPublishedTrust };
}
