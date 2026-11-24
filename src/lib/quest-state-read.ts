import { questApi } from "@/api/runtime";
import { invalidatePassiveTabRead, runPassiveTabRead } from "./passive-tab-read";

const RESOURCE = "canonical-quest-state";

export function readQuestState(locale: string, force = false) {
  if (force) invalidatePassiveTabRead(RESOURCE);
  return runPassiveTabRead(RESOURCE, () => questApi.state(locale), { locale });
}

export function invalidateQuestState(): void {
  invalidatePassiveTabRead(RESOURCE);
}
