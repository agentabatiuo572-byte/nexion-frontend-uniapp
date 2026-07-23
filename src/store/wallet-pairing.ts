import { defineStore } from "pinia";
import { ref } from "vue";
import type { Withdrawal } from "./types";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";

// Wallet pairing state (v3.2 KYC-Express). Ported from
// Nexion-prototype/lib/store/wallet-pairing.ts (zustand persist → Pinia + uni storage).
//
// First-time withdrawals are gated behind a $1 USDT "wallet ownership
// verification" deposit. After the user completes KYC-Express top-up in
// /pages/me/wallet-topup?kyc=1, this store records the pairing so future
// withdraw visits skip the banner. Cross-store coupling: the topup page calls
// both complete() AND useApp.creditBalance($1) so the user's $1 is credited.

export interface WalletPairingState {
  walletPaired: boolean;
  pairedWalletAddress?: string;
  pairedNetwork?: Withdrawal["network"];
  complianceCheckId?: string; // "KYC-2026-A78234" style
  pairedAt?: number; // epoch ms
}

// 旧设备级单键 "nexgrid-wallet-pairing-v1" 废弃(存量无账号归属,mock 可重建);KYC 配对按账号分行。
const ACCOUNTS_KEY = "nexgrid-wallet-pairing-accounts-v1"; // { [accountKey]: WalletPairingState }

// Stable id format mirroring §6.9 receipts: KYC-{YYYY}-A{seq}
let kycSeq = 78234;
function nextComplianceId(): string {
  kycSeq += 1;
  const year = new Date().getFullYear();
  return `KYC-${year}-A${kycSeq}`;
}

function hydrate(accountKey: string): WalletPairingState {
  const row = readAccountRow<Partial<WalletPairingState>>(ACCOUNTS_KEY, accountKey);
  if (row && typeof row.walletPaired === "boolean") {
    return {
      walletPaired: row.walletPaired,
      pairedWalletAddress: row.pairedWalletAddress,
      pairedNetwork: row.pairedNetwork,
      complianceCheckId: row.complianceCheckId,
      pairedAt: row.pairedAt,
    };
  }
  return { walletPaired: false };
}

export const useWalletPairing = defineStore("walletPairing", () => {
  // 账号维度。boot 期落 "default";账号确定后由 lib/account-scope 统一重绑(P-031 store 不互 import)。
  // 🔴 KYC 配对必按账号:否则 wallet-exchange 的 setKycVerified(walletPaired) 镜像会把设备级
  // walletPaired 灌进换后账号的 exchange-v3.kycVerified,绕过 >$100 KYC 闸(P2-8 源头修复)。
  let boundKey = "default";
  const init = hydrate(boundKey);
  const walletPaired = ref(init.walletPaired);
  const pairedWalletAddress = ref<string | undefined>(init.pairedWalletAddress);
  const pairedNetwork = ref<Withdrawal["network"] | undefined>(init.pairedNetwork);
  const complianceCheckId = ref<string | undefined>(init.complianceCheckId);
  const pairedAt = ref<number | undefined>(init.pairedAt);

  function persist() {
    writeAccountRow<WalletPairingState>(ACCOUNTS_KEY, boundKey, {
      walletPaired: walletPaired.value,
      pairedWalletAddress: pairedWalletAddress.value,
      pairedNetwork: pairedNetwork.value,
      complianceCheckId: complianceCheckId.value,
      pairedAt: pairedAt.value,
    });
  }

  /** 账号切换重绑:装载该账号的钱包配对/KYC 状态(防跨账号继承 KYC 资格)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    const next = hydrate(boundKey);
    walletPaired.value = next.walletPaired;
    pairedWalletAddress.value = next.pairedWalletAddress;
    pairedNetwork.value = next.pairedNetwork;
    complianceCheckId.value = next.complianceCheckId;
    pairedAt.value = next.pairedAt;
  }

  function complete(input: { address: string; network: Withdrawal["network"] }) {
    walletPaired.value = true;
    pairedWalletAddress.value = input.address;
    pairedNetwork.value = input.network;
    complianceCheckId.value = nextComplianceId();
    pairedAt.value = Date.now();
    persist();
  }

  function reset() {
    if (import.meta.env.PROD) return; // dev-only KYC reset, store-layer second guard
    walletPaired.value = false;
    pairedWalletAddress.value = undefined;
    pairedNetwork.value = undefined;
    complianceCheckId.value = undefined;
    pairedAt.value = undefined;
    persist();
  }

  return {
    walletPaired,
    pairedWalletAddress,
    pairedNetwork,
    complianceCheckId,
    pairedAt,
    complete,
    reset,
    bindAccount,
  };
});

// Generate a network-appropriate mock address (looks real, fully simulated).
export function mockExternalAddress(network: Withdrawal["network"]): string {
  const hex = (n: number) => {
    const chars = "0123456789abcdef";
    let s = "";
    for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * 16)];
    return s;
  };
  switch (network) {
    case "USDT-TRC20":
      // TRON addresses: T + 33 base58 chars (approximate with mixed case)
      return "T" + hex(33).toUpperCase().slice(0, 33);
    case "USDT-ERC20":
    case "ETH":
      return "0x" + hex(40);
    case "BTC":
      return "bc1q" + hex(38);
  }
}
