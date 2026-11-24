import { computed, ref, shallowRef, watch } from "vue";
import { defineStore } from "pinia";
import { invalidateQuestState } from "@/lib/quest-state-read";
import { questApi, remoteApiEnabled } from "@/api/runtime";
import { isAmbiguousEnvelopeOutcome, isApiRefusal } from "@/api/errors";
import type { CanonicalQuest, QuestSnapshot } from "@/api/quest-api";
import {
  acquireWeeklyQuestCommandKey,
  finishWeeklyQuestCommand,
} from "@/lib/weekly-quest-command-key";
import { isCurrentQuest } from "@/lib/actionable-quest";
import { questClaimNoticeFor, type QuestClaimNotice } from "@/lib/quest-claim-notice";

const UNKNOWN_IDEMPOTENCY_RESULTS = new Set([
  "IDEMPOTENCY_RESULT_UNKNOWN",
  "IDEMPOTENCY_REQUEST_IN_PROGRESS",
]);

type ClaimRecovery = "claimed" | "not_claimed" | "unavailable";

interface SharedQuestRead {
  readonly remoteSnapshot: QuestSnapshot | null;
  readonly remoteLoading: boolean;
  ensureRemote(): Promise<boolean>;
  readRemoteSnapshot(): Promise<QuestSnapshot | null>;
}

/** Weekly quests are a read-through projection of the server mission and reward ledger. */
export const useWeeklyQuest = defineStore("weeklyQuest", () => {
  const questRead = shallowRef<SharedQuestRead | null>(null);
  const snapshot = computed(() => questRead.value?.remoteSnapshot ?? null);
  const loading = computed(() => questRead.value?.remoteLoading ?? false);
  const error = ref<string | null>(null);
  const claimErrorQuestCode = ref<string | null>(null);
  const claimNotice = ref<QuestClaimNotice | null>(null);
  const claiming = ref<string | null>(null);
  let accountKeyValue = "default";
  let accountEpoch = 0;
  let refreshSequence = 0;
  let claimSequence = 0;

  const tier1Quests = computed(() => snapshot.value?.quests.filter((q) => q.layer === "WEEKLY_T1" && isCurrentQuest(q)) ?? []);
  const tier2Quests = computed(() => snapshot.value?.quests.filter((q) => q.layer === "WEEKLY_T2" && isCurrentQuest(q)) ?? []);
  const multiplier = computed(() => snapshot.value?.questBonusMultiplier ?? 1);

  function retireClaimedCommands(next: QuestSnapshot): void {
    for (const quest of next.quests) {
      if (quest.status === "CLAIMED") {
        finishWeeklyQuestCommand(accountKeyValue, quest.questCode, quest.instanceKey);
      }
    }
  }

  function claimOutcomeAmbiguous(cause: unknown): boolean {
    return UNKNOWN_IDEMPOTENCY_RESULTS.has(cause instanceof Error ? cause.message : "")
      || isAmbiguousEnvelopeOutcome(cause);
  }

  async function recoverClaim(
    quest: CanonicalQuest,
    isCurrentRequest: () => boolean,
  ): Promise<ClaimRecovery> {
    try {
      const readBack = await questRead.value?.readRemoteSnapshot();
      if (!readBack || !isCurrentRequest()) return "unavailable";
      const authoritative = readBack.quests.find((row) =>
        row.questCode === quest.questCode && row.instanceKey === quest.instanceKey);
      if (!authoritative) return "unavailable";
      if (authoritative.status === "CLAIMED") {
        finishWeeklyQuestCommand(accountKeyValue, quest.questCode, quest.instanceKey);
        return "claimed";
      }
      return authoritative.eligible
          && ["COMPLETED", "CLAIMABLE"].includes(authoritative.status)
        ? "not_claimed" : "unavailable";
    } catch {
      return "unavailable";
    }
  }

  async function refresh(fromSettledClaim = false): Promise<boolean> {
    if (!remoteApiEnabled) {
      error.value = "WEEKLY_QUEST_SERVER_REQUIRED";
      claimErrorQuestCode.value = null;
      return false;
    }
    const epoch = accountEpoch;
    const requestSequence = ++refreshSequence;
    const startedClaimSequence = claimSequence;
    if (claiming.value && !fromSettledClaim) return false;
    if (!claimErrorQuestCode.value) error.value = null;
    claimNotice.value = null;
    try {
      const source = questRead.value;
      const success = fromSettledClaim
        ? Boolean(await source?.readRemoteSnapshot())
        : await source?.ensureRemote();
      if (epoch !== accountEpoch || requestSequence !== refreshSequence || startedClaimSequence !== claimSequence) return false;
      if (!success) {
        if (!claimErrorQuestCode.value) error.value = "WEEKLY_QUEST_LOAD_FAILED";
        return false;
      }
      if (error.value !== "WEEKLY_QUEST_COMMAND_STORAGE_UNAVAILABLE") error.value = null;
      claimErrorQuestCode.value = null;
      return true;
    } catch (cause) {
      if (epoch === accountEpoch && requestSequence === refreshSequence
        && startedClaimSequence === claimSequence && !claimErrorQuestCode.value) {
        error.value = cause instanceof Error ? cause.message : "WEEKLY_QUEST_LOAD_FAILED";
      }
      return false;
    }
  }

  // Tier 1, Tier 2 and bonus rows share one canonical server command:
  // POST /api/quests/{questCode}/claim. The quest code selects the row; the
  // idempotency key and authoritative state readback make the claim atomic.
  async function claim(quest: CanonicalQuest): Promise<boolean> {
    if (!remoteApiEnabled || !quest.eligible || Date.parse(quest.eligibleUntil) <= Date.now()
        || !["COMPLETED", "CLAIMABLE"].includes(quest.status) || claiming.value) return false;
    const epoch = accountEpoch;
    const requestSequence = ++claimSequence;
    const isCurrentRequest = () => epoch === accountEpoch && requestSequence === claimSequence;
    claiming.value = quest.questCode;
    error.value = null;
    claimErrorQuestCode.value = null;
    claimNotice.value = null;
    try {
      const key = acquireWeeklyQuestCommandKey(accountKeyValue, quest.questCode, quest.instanceKey);
      const claimResult = await questApi.claim(quest.questCode, key, quest.instanceKey);
      invalidateQuestState();
      if (!isCurrentRequest()) return false;
      if (claimResult.questId !== quest.questCode || claimResult.instanceKey !== quest.instanceKey) {
        throw new Error("WEEKLY_QUEST_CLAIM_MISMATCH");
      }
      const readBack = await questRead.value?.readRemoteSnapshot();
      if (!isCurrentRequest()) return false;
      const authoritative = readBack?.quests.find((row) =>
        row.questCode === quest.questCode && row.instanceKey === quest.instanceKey);
      if (!authoritative || authoritative.status !== "CLAIMED") {
        throw new Error("WEEKLY_QUEST_CLAIM_NOT_CONFIRMED");
      }
      finishWeeklyQuestCommand(accountKeyValue, quest.questCode, quest.instanceKey);
      return true;
    } catch (cause) {
      if (!isCurrentRequest()) return false;
      claimErrorQuestCode.value = quest.questCode;
      const message = cause instanceof Error ? cause.message : "WEEKLY_QUEST_CLAIM_FAILED";
      if (message.startsWith("WEEKLY_QUEST_COMMAND_")) {
        error.value = message;
        return false;
      }
      const notice = questClaimNoticeFor(cause);
      if (!notice && claimOutcomeAmbiguous(cause)) {
        const recovery = await recoverClaim(quest, isCurrentRequest);
        if (!isCurrentRequest()) return false;
        if (recovery === "claimed") return true;
        if (isApiRefusal(cause, 409, "IDEMPOTENCY_RESULT_UNKNOWN") && recovery === "not_claimed") {
          try {
            finishWeeklyQuestCommand(accountKeyValue, quest.questCode, quest.instanceKey);
          } catch (storageCause) {
            error.value = storageCause instanceof Error
              ? storageCause.message : "WEEKLY_QUEST_COMMAND_STORAGE_UNAVAILABLE";
            return false;
          }
          error.value = "WEEKLY_QUEST_CLAIM_RETRY_REQUIRED";
          return false;
        }
        error.value = "WEEKLY_QUEST_CLAIM_OUTCOME_UNKNOWN";
        return false;
      }
      try {
        finishWeeklyQuestCommand(accountKeyValue, quest.questCode, quest.instanceKey);
      } catch (storageCause) {
        error.value = storageCause instanceof Error
          ? storageCause.message : "WEEKLY_QUEST_COMMAND_STORAGE_UNAVAILABLE";
        return false;
      }
      if (notice) {
        await refresh(true);
        if (!isCurrentRequest()) return false;
        // This is a confirmed terminal reply, never a new reward. Read back
        // server state before allowing the UI to explain the changed status.
        claimNotice.value = notice;
        return false;
      }
      error.value = message;
      return false;
    } finally {
      if (isCurrentRequest()) claiming.value = null;
    }
  }

  function bindAccount(accountKey: string, source: SharedQuestRead) {
    accountEpoch += 1;
    refreshSequence += 1;
    claimSequence += 1;
    error.value = null;
    claimErrorQuestCode.value = null;
    claimNotice.value = null;
    claiming.value = null;
    accountKeyValue = accountKey.trim().toLowerCase() || "default";
    questRead.value = source;
  }

  watch(snapshot, (next) => {
    if (!next || claiming.value) return;
    try {
      retireClaimedCommands(next);
    } catch {
      error.value = "WEEKLY_QUEST_COMMAND_STORAGE_UNAVAILABLE";
    }
  });

  return { snapshot, loading, error, claimErrorQuestCode, claimNotice, claiming, tier1Quests, tier2Quests, multiplier, refresh, claim, bindAccount };
});
