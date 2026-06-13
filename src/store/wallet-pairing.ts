import { defineStore } from "pinia";
import { ref } from "vue";
import type { Withdrawal } from "./types";

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

const STORAGE_KEY = "nexion-wallet-pairing-v1";

// Stable id format mirroring §6.9 receipts: KYC-{YYYY}-A{seq}
let kycSeq = 78234;
function nextComplianceId(): string {
  kycSeq += 1;
  const year = new Date().getFullYear();
  return `KYC-${year}-A${kycSeq}`;
}

function hydrate(): WalletPairingState {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as Partial<WalletPairingState> | "";
    if (s && typeof s === "object" && typeof s.walletPaired === "boolean") {
      return {
        walletPaired: s.walletPaired,
        pairedWalletAddress: s.pairedWalletAddress,
        pairedNetwork: s.pairedNetwork,
        complianceCheckId: s.complianceCheckId,
        pairedAt: s.pairedAt,
      };
    }
  } catch {
    // first run
  }
  return { walletPaired: false };
}

export const useWalletPairing = defineStore("walletPairing", () => {
  const init = hydrate();
  const walletPaired = ref(init.walletPaired);
  const pairedWalletAddress = ref<string | undefined>(init.pairedWalletAddress);
  const pairedNetwork = ref<Withdrawal["network"] | undefined>(init.pairedNetwork);
  const complianceCheckId = ref<string | undefined>(init.complianceCheckId);
  const pairedAt = ref<number | undefined>(init.pairedAt);

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, {
        walletPaired: walletPaired.value,
        pairedWalletAddress: pairedWalletAddress.value,
        pairedNetwork: pairedNetwork.value,
        complianceCheckId: complianceCheckId.value,
        pairedAt: pairedAt.value,
      });
    } catch {
      // storage unavailable
    }
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
