import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";

export type NotificationPreferenceKey = "commission" | "team" | "staking" | "market" | "genesis" | "system";
export type EarningPush = "DAILY" | "HALF_HOURLY" | "OFF";
export type NotificationPreferences = Record<NotificationPreferenceKey, boolean> & { earningPush?: EarningPush };
export type NotificationPreferencesPatch = Partial<NotificationPreferences>;

export interface NotificationPreferencesApi {
  get(): Promise<NotificationPreferences>;
  patch(value: NotificationPreferencesPatch): Promise<NotificationPreferences>;
}

const KEYS: NotificationPreferenceKey[] = ["commission", "team", "staking", "market", "genesis", "system"];

function isEarningPush(value: unknown): value is EarningPush {
  return value === "DAILY" || value === "HALF_HOURLY" || value === "OFF";
}

function parse(value: unknown): NotificationPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError({ kind: "protocol", message: "NOTIFICATION_PREFERENCES_RESPONSE_INVALID" });
  }
  const row = value as Record<string, unknown>;
  if (KEYS.some((key) => typeof row[key] !== "boolean")
      || ("earningPush" in row && !isEarningPush(row.earningPush))) {
    throw new ApiError({ kind: "protocol", message: "NOTIFICATION_PREFERENCES_RESPONSE_INVALID" });
  }
  const preferences = Object.fromEntries(KEYS.map((key) => [key, row[key]])) as NotificationPreferences;
  if (isEarningPush(row.earningPush)) preferences.earningPush = row.earningPush;
  return preferences;
}

function patchBody(value: NotificationPreferencesPatch): NotificationPreferencesPatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError({ kind: "protocol", message: "NOTIFICATION_PREFERENCES_PATCH_INVALID" });
  }
  const keys = Object.keys(value);
  if (keys.length === 0) {
    throw new ApiError({ kind: "protocol", message: "NOTIFICATION_PREFERENCES_PATCH_EMPTY" });
  }
  if (keys.some((key) => key === "earningPush"
    ? !isEarningPush(value.earningPush)
    : !KEYS.includes(key as NotificationPreferenceKey) || typeof value[key as NotificationPreferenceKey] !== "boolean")) {
    throw new ApiError({ kind: "protocol", message: "NOTIFICATION_PREFERENCES_PATCH_INVALID" });
  }
  return { ...value };
}

export function createNotificationPreferencesApi(client: ApiClient): NotificationPreferencesApi {
  return {
    async get() {
      return parse(await client.request({ method: "GET", path: "/api/me/notification-preferences" }));
    },
    async patch(value) {
      return parse(await client.request({
        method: "PATCH", path: "/api/me/notification-preferences", body: patchBody(value),
      }));
    },
  };
}
