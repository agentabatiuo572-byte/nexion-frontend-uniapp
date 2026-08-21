import type { QuestTaskId } from "@/store/quest";

/** Route visits are not profile completion proof in server-authoritative mode. */
export function shouldClaimQuestOnRoute(remote: boolean, id: QuestTaskId): boolean {
  return !(remote && id === "setup_profile");
}
