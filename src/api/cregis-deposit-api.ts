import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import { isTronAddressValid } from "@/lib/tron-address";

export type CregisNetwork = "BEP20" | "ERC20" | "TRC20";
const NETWORKS: CregisNetwork[] = ["BEP20", "ERC20", "TRC20"];
const validAddress = (network: CregisNetwork | undefined, address: string) => network === "TRC20"
  ? isTronAddressValid(address) : /^0x[0-9a-f]{40}$/i.test(address);
export interface CregisNetworkPolicy {
  network: CregisNetwork;
  enabled: boolean;
  disabledReason: string | null;
  confirmations: number;
  feeUsdt: number;
  feeUsdtExact: string;
  minDepositUsdt: number;
  minDepositUsdtExact: string;
}
export interface CregisAddress {
  enabled: boolean;
  creditEnabled?: boolean;
  reason?: string;
  network: CregisNetwork;
  address?: string;
  confirmations?: number;
  feeUsdt?: number;
  feeUsdtExact?: string;
  minDepositUsdt?: number;
  minDepositUsdtExact?: string;
}

export interface CregisDeposit {
  network?: CregisNetwork;
  depositId: string;
  txHash: string;
  address: string;
  grossAmountUsdt: number;
  grossAmountUsdtExact?: string;
  creditedUsdt: number;
  creditedUsdtExact?: string;
  confirmations: number;
  requiredConfirmations?: number | null;
  status: "CONFIRMING" | "CREDITED" | "DUST_HOLD" | "REVIEW_HOLD"
    | "REORG_INVESTIGATING" | "PROVIDER_CONFLICT_HOLD" | "REFUNDED" | "REORG_REVERSED";
  createdAt: number;
  creditedAt?: number | null;
}

export function exactDepositAmount(value: number, exact?: string): string | null {
  if (exact !== undefined) return typeof exact === "string" && /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(exact) ? exact : null;
  return Number.isFinite(value) && value >= 0 && value < 2 ** 32 && Number(value.toFixed(6)) === value ? String(value) : null;
}

export function createCregisDepositApi(client: ApiClient) {
  return {
    async policy(): Promise<CregisNetworkPolicy[]> {
      const value = await client.request<{ networks?: unknown }>({ method: "GET", path: "/api/deposits/policy" });
      const networks = value?.networks;
      // Two-network legacy servers omit TRC20; omission never enables a channel.
      if (!Array.isArray(networks) || networks.length < 2 || networks.length > 3
          || new Set(networks.map((row) => row?.network)).size !== networks.length
          || !["BEP20", "ERC20"].every((network) => networks.some((row) => row?.network === network))
          || networks.some((row) => !row || typeof row !== "object"
            || !NETWORKS.includes(row.network)
            || typeof row.enabled !== "boolean"
            || (row.disabledReason !== null && typeof row.disabledReason !== "string")
            || !Number.isSafeInteger(row.confirmations) || row.confirmations < 15
            || typeof row.feeUsdt !== "number" || !Number.isFinite(row.feeUsdt) || row.feeUsdt < 0
            || typeof row.feeUsdtExact !== "string" || exactDepositAmount(row.feeUsdt, row.feeUsdtExact) === null
            || Number(row.feeUsdtExact) !== row.feeUsdt
            || typeof row.minDepositUsdt !== "number" || !Number.isFinite(row.minDepositUsdt) || row.minDepositUsdt <= 0
            || typeof row.minDepositUsdtExact !== "string" || exactDepositAmount(row.minDepositUsdt, row.minDepositUsdtExact) === null
            || Number(row.minDepositUsdtExact) !== row.minDepositUsdt)) {
        throw new ApiError({ kind: "protocol", message: "CREGIS_DEPOSIT_POLICY_INVALID" });
      }
      return networks as CregisNetworkPolicy[];
    },
    async address(network: CregisNetwork = "BEP20"): Promise<CregisAddress> {
      if (!NETWORKS.includes(network)) throw new ApiError({ kind: "protocol", message: "CREGIS_NETWORK_INVALID" });
      const value = await client.request<CregisAddress>({
        method: "GET", path: `/api/deposits/address?network=${network}`,
      });
      if (!value || value.network !== network || typeof value.enabled !== "boolean"
          || (value.creditEnabled !== undefined && typeof value.creditEnabled !== "boolean")
          || (value.reason !== undefined && typeof value.reason !== "string")
          || (value.enabled && (typeof value.address !== "string"
              || !validAddress(network, value.address)
              || typeof value.confirmations !== "number"
              || !Number.isInteger(value.confirmations) || value.confirmations < 15
              || typeof value.feeUsdt !== "number" || !Number.isFinite(value.feeUsdt) || value.feeUsdt < 0
              || (value.feeUsdtExact !== undefined && exactDepositAmount(value.feeUsdt, value.feeUsdtExact) === null)
              || typeof value.minDepositUsdt !== "number" || !Number.isFinite(value.minDepositUsdt) || value.minDepositUsdt <= 0
              || (value.minDepositUsdtExact !== undefined && (exactDepositAmount(value.minDepositUsdt, value.minDepositUsdtExact) === null || Number(value.minDepositUsdtExact) <= 0))))) {
        throw new ApiError({ kind: "protocol", message: "CREGIS_ADDRESS_INVALID" });
      }
      return value;
    },
    async list(): Promise<CregisDeposit[]> {
      const rows = await client.request<unknown>({ method: "GET", path: "/api/deposits" });
      if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object"
          || (row.network !== undefined && !NETWORKS.includes(row.network))
          || typeof row.depositId !== "string" || !/^CR-[0-9]+$/.test(row.depositId)
          || typeof row.txHash !== "string" || !(row.network === "TRC20" ? /^[0-9a-f]{64}$/i : /^0x[0-9a-f]{64}$/i).test(row.txHash)
          || typeof row.address !== "string" || !validAddress(row.network, row.address)
          || typeof row.grossAmountUsdt !== "number" || !Number.isFinite(row.grossAmountUsdt) || row.grossAmountUsdt <= 0
          || (row.grossAmountUsdtExact !== undefined && (exactDepositAmount(row.grossAmountUsdt, row.grossAmountUsdtExact) === null || Number(row.grossAmountUsdtExact) <= 0))
          || typeof row.creditedUsdt !== "number" || !Number.isFinite(row.creditedUsdt) || row.creditedUsdt < 0
          || (row.creditedUsdtExact !== undefined && exactDepositAmount(row.creditedUsdt, row.creditedUsdtExact) === null)
          || !Number.isInteger(row.confirmations) || row.confirmations < 0
          || (row.requiredConfirmations != null && (!Number.isSafeInteger(row.requiredConfirmations) || row.requiredConfirmations < 15))
          || typeof row.createdAt !== "number" || !Number.isFinite(row.createdAt)
          || typeof row.status !== "string" || !["CONFIRMING", "CREDITED", "DUST_HOLD", "REVIEW_HOLD",
            "REORG_INVESTIGATING", "PROVIDER_CONFLICT_HOLD", "REFUNDED", "REORG_REVERSED"].includes(row.status))) {
        throw new ApiError({ kind: "protocol", message: "CREGIS_DEPOSITS_INVALID" });
      }
      return rows as CregisDeposit[];
    },
  };
}
