import { describe, expect, it, vi } from "vitest";
import { claimSetupProfileQuest } from "./remote-profile-quest";

describe("remote profile quest completion", () => {
  it("claims setup_profile through the quest authority after save", async () => {
    const claimRemote = vi.fn().mockResolvedValue(true);
    await expect(claimSetupProfileQuest({ claimRemote })).resolves.toBe(true);
    expect(claimRemote).toHaveBeenCalledWith("setup_profile");
  });

  it("keeps a failed claim retryable instead of marking it complete locally", async () => {
    const claimRemote = vi.fn().mockResolvedValue(false);
    await expect(claimSetupProfileQuest({ claimRemote })).resolves.toBe(false);
  });
});
