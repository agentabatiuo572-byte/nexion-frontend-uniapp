import { defineStore } from "pinia";
import { normalizeAccountKey } from "@/store/account-cloud";
import { useConfig } from "@/store/config";
import type { Withdrawal } from "@/store/types";
import type { WithdrawalRiskRoute } from "@/store/config-types";

const STORAGE_KEY = "nexion-withdrawal-risk-v1";

export interface WithdrawalEligibility {
  canSubmit: boolean;
  maxWithdrawableUsdt: number;
  route: WithdrawalRiskRoute;
  riskReasons: string[];
  configVersion: string;
}

interface WithdrawalRiskTable {
  schema: 1;
  byAddress: Record<string, string[]>;
}

function readTable(): WithdrawalRiskTable {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY) as WithdrawalRiskTable | "";
    if (raw && typeof raw === "object" && raw.schema === 1) return raw;
  } catch {
    // storage unavailable
  }
  return { schema: 1, byAddress: {} };
}

function writeTable(table: WithdrawalRiskTable): void {
  try {
    uni.setStorageSync(STORAGE_KEY, table);
  } catch {
    // storage unavailable
  }
}

function addressKey(network: Withdrawal["network"], address: string): string {
  return `${network}:${address.trim().toLowerCase()}`;
}

export const useWithdrawalRisk = defineStore("withdrawalRisk", () => {
  function evaluateWithdrawal(
    rawAccountKey: string,
    network: Withdrawal["network"],
    address: string,
    withdrawableUsdt: number,
  ): WithdrawalEligibility {
    const cfg = useConfig().config.withdrawRules;
    const accountKey = normalizeAccountKey(rawAccountKey);
    const table = readTable();
    const accounts = table.byAddress[addressKey(network, address)] ?? [];
    const reusedByOtherAccount = accounts.some((key) => key !== accountKey);
    const route: WithdrawalRiskRoute = reusedByOtherAccount ? cfg.sameAddressRoute : "pass";
    return {
      canSubmit: route !== "reject" && withdrawableUsdt >= cfg.minWithdrawableUsdt,
      maxWithdrawableUsdt: withdrawableUsdt,
      route,
      riskReasons: reusedByOtherAccount ? ["Address already linked to another account"] : [],
      configVersion: `withdrawRules:${cfg.minWithdrawableUsdt}/${cfg.sameAddressRoute}`,
    };
  }

  function commitWithdrawal(rawAccountKey: string, network: Withdrawal["network"], address: string): void {
    const accountKey = normalizeAccountKey(rawAccountKey);
    const table = readTable();
    const key = addressKey(network, address);
    const accounts = table.byAddress[key] ?? [];
    if (!accounts.includes(accountKey)) {
      table.byAddress[key] = [...accounts, accountKey];
      writeTable(table);
    }
  }

  return { evaluateWithdrawal, commitWithdrawal };
});
