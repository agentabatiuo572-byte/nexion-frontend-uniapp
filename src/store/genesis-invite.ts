import { genesisApi } from "@/api/runtime";
import { asApiError } from "@/api/errors";
import { GENESIS_INVITE_PATTERN } from "@/store/genesis";

export type GenesisInviteRejectReason = "invalid" | "used" | "void" | "already-held" | "failed";

export type GenesisInviteRedeemResult =
  | { ok: true; code: string }
  | { ok: false; reason: GenesisInviteRejectReason };

/** Server-only redemption. No local registry, seed code or rollback exists. */
export async function redeemGenesisInviteCode(raw: string): Promise<GenesisInviteRedeemResult> {
  const code = raw.trim().toUpperCase();
  if (!GENESIS_INVITE_PATTERN.test(code)) return { ok: false, reason: "invalid" };
  try {
    return { ok: true, code: (await genesisApi.redeem(code)).code };
  } catch (error) {
    const api = asApiError(error);
    if (api.message === "GENESIS_INVITE_ACCOUNT_ALREADY_REDEEMED") return { ok: false, reason: "already-held" };
    if (api.message === "GENESIS_INVITE_NOT_FOUND" || api.message === "GENESIS_INVITE_CODE_INVALID") {
      return { ok: false, reason: "invalid" };
    }
    if (api.message === "GENESIS_INVITE_STATE_CONFLICT") return { ok: false, reason: "used" };
    if (api.message === "GENESIS_INVITE_VOIDED") return { ok: false, reason: "void" };
    return { ok: false, reason: "failed" };
  }
}
