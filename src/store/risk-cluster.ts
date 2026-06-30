import { defineStore } from "pinia";
import { getDeviceId } from "@/lib/device-id";
import { normalizeAccountKey } from "@/store/account-cloud";
import { useConfig } from "@/store/config";
import type { EarningBucketRoute } from "@/store/types";

const STORAGE_KEY = "nexion-risk-cluster-v1";

export type RegistrationRiskStatus = "clear" | "watch" | "flagged";

export interface RegistrationRiskSummary {
  accountKey: string;
  deviceId: string;
  clusterId: string;
  status: RegistrationRiskStatus;
  bucketRoute: EarningBucketRoute;
  slotIndexInCluster: number;
  configVersion: string;
}

interface RiskClusterTable {
  schema: 1;
  byDevice: Record<string, string[]>;
}

function readTable(): RiskClusterTable {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY) as RiskClusterTable | "";
    if (raw && typeof raw === "object" && raw.schema === 1) return raw;
  } catch {
    // storage unavailable
  }
  return { schema: 1, byDevice: {} };
}

function writeTable(table: RiskClusterTable): void {
  try {
    uni.setStorageSync(STORAGE_KEY, table);
  } catch {
    // storage unavailable
  }
}

function clusterIdFor(deviceId: string): string {
  return `CL-${deviceId.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase() || "LOCAL"}`;
}

export const useRiskCluster = defineStore("riskCluster", () => {
  function evaluateRegistration(rawAccountKey: string): RegistrationRiskSummary {
    const accountKey = normalizeAccountKey(rawAccountKey);
    const deviceId = getDeviceId();
    const table = readTable();
    const accounts = table.byDevice[deviceId] ?? [];
    const existingIndex = accounts.indexOf(accountKey);
    const slotIndexInCluster = existingIndex >= 0 ? existingIndex + 1 : accounts.length + 1;
    const cfg = useConfig().config.riskCluster;
    const status: RegistrationRiskStatus =
      slotIndexInCluster >= cfg.duplicateAccountFreezeFrom
        ? "flagged"
        : slotIndexInCluster >= cfg.duplicateAccountPendingFrom
          ? "watch"
          : "clear";

    return {
      accountKey,
      deviceId,
      clusterId: clusterIdFor(deviceId),
      status,
      bucketRoute: status === "clear" ? "withdrawable" : "bonus_locked",
      slotIndexInCluster,
      configVersion: `riskCluster:${cfg.freePhoneSlotsPerCluster}/${cfg.duplicateAccountPendingFrom}/${cfg.duplicateAccountFreezeFrom}`,
    };
  }

  function commitRegistration(summary: RegistrationRiskSummary): void {
    const table = readTable();
    const accounts = table.byDevice[summary.deviceId] ?? [];
    if (!accounts.includes(summary.accountKey)) {
      table.byDevice[summary.deviceId] = [...accounts, summary.accountKey];
      writeTable(table);
    }
  }

  function evaluateSettlement(rawAccountKey: string): RegistrationRiskSummary {
    const summary = evaluateRegistration(rawAccountKey);
    return {
      ...summary,
      bucketRoute:
        summary.status === "clear"
          ? "withdrawable"
          : summary.status === "watch"
            ? "pending_review"
            : "bonus_locked",
    };
  }

  return { evaluateRegistration, evaluateSettlement, commitRegistration };
});
