import { defineStore } from "pinia";
import { ref } from "vue";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";
import { normalizeAccountKey } from "./account-cloud";

// Risk disclosure acceptance. Ported from
// Nexion-prototype/lib/store/risk-disclosure.ts (zustand persist → Pinia + uni storage).
//
// Tracks whether the user has read & accepted the platform risk disclosure.
// Required before first withdrawal / first staking lock. Once accepted, no
// re-prompt (persisted across sessions).

// 🔴 按**账号**分行,不是设备级(2026-08-01 审计)。
// 原实现是单键 nexgrid-risk-disclosure-v1,且不在 rebindAccountScopedStores 名单里:
// A 账号接受过披露 → 换成 B 账号,accepted 仍为 true → B 的首次提现**直接跳过强制合规确认**,
// 从未看到那份他必须勾选「我已阅读」的文件。凭证类 per-user 状态一律按账号作用域
// (与 wallet-pairing / security 同档)。旧设备级单键废弃,存量重新走一次披露 —— 合规上这是对的方向。
const ACCOUNTS_KEY = "nexgrid-risk-disclosure-accounts-v1"; // { [accountKey]: {accepted, acceptedAt} }

interface DisclosureState {
  accepted: boolean;
  acceptedAt: number | null;
}

function hydrate(accountKey: string): DisclosureState {
  const row = readAccountRow<Partial<DisclosureState>>(ACCOUNTS_KEY, accountKey);
  if (row && typeof row.accepted === "boolean") {
    return { accepted: row.accepted, acceptedAt: row.acceptedAt ?? null };
  }
  return { accepted: false, acceptedAt: null };
}

export const useRiskDisclosure = defineStore("riskDisclosure", () => {
  // boot 期落 "default";账号确定后由 lib/account-scope 统一重绑(P-031 store 不互 import)。
  let boundKey = "default";
  const init = hydrate(boundKey);
  const accepted = ref(init.accepted);
  const acceptedAt = ref<number | null>(init.acceptedAt);

  function persist() {
    writeAccountRow<DisclosureState>(ACCOUNTS_KEY, boundKey, {
      accepted: accepted.value,
      acceptedAt: acceptedAt.value,
    });
  }

  /** 账号切换重绑:装载该账号自己的披露接受状态(防跨账号继承强制合规确认)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    const next = hydrate(boundKey);
    accepted.value = next.accepted;
    acceptedAt.value = next.acceptedAt;
  }

  function accept() {
    accepted.value = true;
    acceptedAt.value = Date.now();
    persist();
  }

  function reset() {
    accepted.value = false;
    acceptedAt.value = null;
    persist();
  }

  return { accepted, acceptedAt, accept, reset , bindAccount };
});
