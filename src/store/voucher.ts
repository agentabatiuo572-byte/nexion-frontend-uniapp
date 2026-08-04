import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { mockServerNow } from "./server-time";
import { createAccountRowCommit } from "./account-scoped-storage";
import {
  listVouchers,
  getVoucher,
  isVoucherValid,
  computeVoucherDiscount,
  voucherAppliesToSku,
  type VoucherDef,
} from "@/mock/vouchers";

/**
 * Voucher wallet — the per-user claim ledger (which vouchers were claimed, and
 * whether each has been redeemed). The voucher CATALOG (operator config) lives
 * in src/mock/vouchers.ts; this store only tracks the user's relationship to it.
 *
 * Persistence: `claimed` survives across sessions (nexgrid-voucher-v1), mirroring
 * cart.ts hydrate→ref→watch→persist. MOCK-ONLY — real backend contract (vouchers
 * are a NEW feature; these endpoints are the canonical proposal, to be added to
 * PRD §9.11 on sync):
 *   claim(id)    → POST /api/vouchers/:id/claim   (server checks audience + validity
 *                  window + idempotency, then persists the claim — authoritative)
 *   markUsed(id) → NOT a separate client call: redemption is server-side. The
 *                  checkout sends `voucherId` in the POST /api/orders body; the
 *                  server validates + marks the voucher redeemed atomically with
 *                  order creation. markUsed() here is the mock's optimistic mirror.
 *   claimed[]    → GET /api/me/vouchers   (self-scoped wallet; an OPERATOR reads a
 *                  specific user's vouchers via GET /api/users/:id/vouchers — same
 *                  resource, different actor scope; see admin user-ops-store).
 *
 * Audience gating ("new" vs "all") is server-canonical: GET /api/vouchers (the
 * catalog) is filtered by the caller's cohort server-side. The mock surfaces all
 * valid + unclaimed vouchers (no cross-store import on app.devices) — the field is
 * carried for the admin + real backend, displayed but not hard-enforced client-side.
 * ⚠️ MOCK risk: claimed/used state is client-only here; the real backend MUST own
 * it (else clearing storage could re-claim/re-use) — the POST endpoints above are
 * that enforcement point.
 */

interface ClaimRecord {
  id: string;
  claimedAt: number;
  usedAt: number | null;
}

// 旧设备级单键 "nexgrid-voucher-v1" 废弃(存量无账号归属,mock 可重建);券包账本按账号分行。
const ACCOUNTS_KEY = "nexgrid-voucher-accounts-v1"; // { [accountKey]: { claimed: ClaimRecord[] } }

interface VoucherRow {
  claimed: ClaimRecord[];
}

/** 磁盘行 → 券包账本。格式不认识 → null(调用方退回空账本 / 内存态)。 */
function parseRow(raw: unknown): VoucherRow | null {
  const row = raw as { claimed?: ClaimRecord[] } | null;
  return row && Array.isArray(row.claimed) ? { claimed: row.claimed } : null;
}

export interface VoucherMatch {
  def: VoucherDef;
  discountUSD: number;
}

export const useVoucher = defineStore("voucher", () => {
  // 账号维度。boot 期落 "default";账号确定后由 lib/account-scope 统一重绑(P-031 store 不互 import)。
  const claimed = ref<ClaimRecord[]>([]);

  // 落盘唯一出口:乐观并发提交器。此前是 `watch(claimed, persist, {deep:true})` —— 纯覆盖式,
  // 两个标签页各领同一张券时后写的把先写的整份账本顶掉,两边都以为自己领到了。
  // 🔴 watch 必须一并删掉:留着它就是一条绕过 CAS 的旁路,这道闸等于没接。
  const rows = createAccountRowCommit<VoucherRow>({
    tableKey: ACCOUNTS_KEY,
    parse: parseRow,
    snapshot: () => ({ claimed: claimed.value }),
    sync: (row) => {
      claimed.value = row.claimed;
    },
  });

  /** 账号切换重绑:装载该账号的券包账本。 */
  function bindAccount(rawAccountKey: string) {
    claimed.value = rows.bind(rawAccountKey)?.claimed ?? [];
  }
  bindAccount("default");

  function record(id: string): ClaimRecord | undefined {
    return claimed.value.find((c) => c.id === id);
  }
  function isClaimed(id: string): boolean {
    return !!record(id);
  }
  function isUsed(id: string): boolean {
    return record(id)?.usedAt != null;
  }

  /**
   * Claim a voucher (idempotent). ok=false if already claimed or invalid.
   * 🔴 「是否已领」复核跑在**磁盘最新**账本上 —— 别的标签页刚领过的券在这里就被挡住,
   * 同一张券绝不会被领第二次(conflict=true 让页面提示「已在别处领取」而不是静默无反应)。
   */
  function claim(id: string): { ok: boolean; conflict?: boolean } {
    const def = getVoucher(id);
    if (!def || !isVoucherValid(def)) return { ok: false, conflict: false }; // 券本身不合格,与并发无关
    const r = rows.commit((cur) => {
      if (cur.claimed.some((c) => c.id === id)) return null;
      return {
        next: { claimed: [{ id, claimedAt: mockServerNow(), usedAt: null }, ...cur.claimed] },
        result: true as const,
      };
    });
    return r.ok ? { ok: true } : { ok: false, conflict: r.conflict };
  }

  /** Mark a claimed voucher as redeemed (called once after an order consumes it).
   *  天然幂等:别处已核销过 → apply 返回 null,终态本就是「已用」,无需回报失败。 */
  function markUsed(id: string): void {
    const now = mockServerNow();
    rows.commit((cur) => {
      if (!cur.claimed.some((c) => c.id === id && c.usedAt == null)) return null;
      return {
        next: { claimed: cur.claimed.map((c) => (c.id === id && c.usedAt == null ? { ...c, usedAt: now } : c)) },
        result: true as const,
      };
    });
  }

  /** Vouchers the user can still CLAIM (active, in-window, not yet claimed). */
  const claimableVouchers = computed<VoucherDef[]>(() =>
    listVouchers().filter((d) => isVoucherValid(d) && !isClaimed(d.id)),
  );

  /** Claimed, unused, still-valid vouchers — the user's redeemable wallet. */
  const claimedUnused = computed<VoucherDef[]>(() => {
    const out: VoucherDef[] = [];
    for (const c of claimed.value) {
      if (c.usedAt != null) continue;
      const def = getVoucher(c.id);
      if (def && isVoucherValid(def)) out.push(def);
    }
    return out;
  });

  /** Claimed, unused, but now past their validity window — shown as expired in
   *  the My Rewards page. */
  const expiredVouchers = computed<VoucherDef[]>(() => {
    const out: VoucherDef[] = [];
    for (const c of claimed.value) {
      if (c.usedAt != null) continue;
      const def = getVoucher(c.id);
      if (def && !isVoucherValid(def)) out.push(def);
    }
    return out;
  });

  /** Whether any claim banner should advertise on `surface` (claimable vouchers
   *  targeting it). */
  function hasClaimableForSurface(surface: VoucherDef["claimSurfaces"][number]): boolean {
    return claimableVouchers.value.some((d) => d.claimSurfaces.includes(surface));
  }

  /**
   * Best redeemable voucher for a SKU at a given subtotal — the claimed-unused,
   * applicable voucher yielding the largest discount (> 0). null = none applies.
   * opts.stackWithTrial (FEAT-TRIAL02 checkout conversion mode): only vouchers
   * whose def.stackWithTrial is true participate — non-stackable ones neither
   * appear nor apply on a trial order (server re-validates the same rule).
   */
  function bestVoucherFor(
    skuId: string,
    subtotalUSD: number,
    opts?: { stackWithTrial?: boolean },
  ): VoucherMatch | null {
    let best: VoucherMatch | null = null;
    for (const def of claimedUnused.value) {
      if (opts?.stackWithTrial && !def.stackWithTrial) continue;
      if (!voucherAppliesToSku(def, skuId)) continue;
      const discountUSD = computeVoucherDiscount(def, subtotalUSD);
      if (discountUSD <= 0) continue;
      if (!best || discountUSD > best.discountUSD) best = { def, discountUSD };
    }
    return best;
  }

  return {
    claimed,
    bindAccount,
    isClaimed,
    isUsed,
    claim,
    markUsed,
    claimableVouchers,
    claimedUnused,
    expiredVouchers,
    hasClaimableForSurface,
    bestVoucherFor,
  };
});
