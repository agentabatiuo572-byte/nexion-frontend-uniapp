import type { QuestTaskId } from "@/store/quest";

export interface RemoteQuestClaimPort {
  claimRemote(id: QuestTaskId): Promise<boolean>;
}

/**
 * Profile setup is completed by the explicit server-confirmed save flow. The
 * quest store owns the claim and its authority refresh; this adapter keeps the
 * page from ever reaching for markComplete or a local reward table.
 */
export async function claimSetupProfileQuest(port: RemoteQuestClaimPort): Promise<boolean> {
  return port.claimRemote("setup_profile");
}
