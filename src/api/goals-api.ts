import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import type { ApiEnvironment } from "./runtime-config";
import { isCurrentCommerceSandboxRun } from "./order-api";

export interface Goal {
  id: number;
  targetUsdt: number;
  deadlineAt: number;
  createdAt: number;
  achieved: boolean;
  achievedAt?: number | null;
  progressPct: number;
  lifetimeEarningsUsdt: number;
}

export interface GoalList {
  serverCanonical: true;
  source: "nx_earning_goal";
  lifetimeEarningsUsdt: number;
  goals: Goal[];
}

export interface GoalRecommendation {
  serverCanonical: true;
  source: string;
  sourceEnvironment: "PRODUCTION" | "SANDBOX";
  runId: string;
  productNo: string;
  productName: string;
  dailyEarn: number;
  price: number;
  requiredDaily: number;
  targetUsdt: number;
  days: number;
}

export interface GoalsApi {
  list(): Promise<GoalList>;
  create(input: { targetUsdt: number; deadlineAt: number }): Promise<Goal>;
  setStatus(goalId: number, achieved: boolean): Promise<Goal>;
  remove(goalId: number): Promise<void>;
  recommendation(targetUsdt: number, deadlineAt: number): Promise<GoalRecommendation>;
}

function invalid(): never {
  throw new ApiError({ kind: "protocol", message: "GOALS_RESPONSE_INVALID" });
}

function number(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validGoal(value: unknown): value is Goal {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<Goal>;
  return Number.isInteger(row.id) && row.id! > 0 && number(row.targetUsdt) && row.targetUsdt! >= 100
    && number(row.deadlineAt) && number(row.createdAt) && typeof row.achieved === "boolean"
    && number(row.progressPct) && row.progressPct! >= 0 && row.progressPct! <= 100
    && number(row.lifetimeEarningsUsdt);
}

function validList(value: unknown): value is GoalList {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<GoalList>;
  return row.serverCanonical === true && row.source === "nx_earning_goal"
    && number(row.lifetimeEarningsUsdt) && Array.isArray(row.goals) && row.goals.every(validGoal);
}

function validScope(row: Partial<GoalRecommendation>, mode: ApiEnvironment): boolean {
  if (mode === "dev") return row.sourceEnvironment === "SANDBOX"
    && typeof row.runId === "string" && isCurrentCommerceSandboxRun(row.runId);
  return mode === "prod" && row.sourceEnvironment === "PRODUCTION" && row.runId === "";
}

function validRecommendation(value: unknown, mode: ApiEnvironment): value is GoalRecommendation {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<GoalRecommendation>;
  return row.serverCanonical === true && typeof row.source === "string" && validScope(row, mode)
    && typeof row.productNo === "string" && row.productNo.length > 0
    && typeof row.productName === "string" && row.productName.length > 0
    && number(row.dailyEarn) && row.dailyEarn! > 0 && number(row.price) && row.price! > 0
    && number(row.requiredDaily) && number(row.targetUsdt) && number(row.days) && row.days! > 0;
}

function path(goalId: number): string {
  return `/api/goals/${encodeURIComponent(String(goalId))}`;
}

export function createGoalsApi(client: ApiClient, mode: ApiEnvironment = "prod"): GoalsApi {
  return {
    async list() {
      const value = await client.request<unknown>({ method: "GET", path: "/api/goals" });
      return validList(value) ? value : invalid();
    },
    async create(input) {
      const value = await client.request<unknown>({ method: "POST", path: "/api/goals", body: input });
      return validGoal(value) ? value : invalid();
    },
    async setStatus(goalId, achieved) {
      const value = await client.request<unknown>({ method: "POST", path: `${path(goalId)}/status`, body: { achieved } });
      return validGoal(value) ? value : invalid();
    },
    async remove(goalId) {
      await client.request<unknown>({ method: "DELETE", path: path(goalId) });
    },
    async recommendation(targetUsdt, deadlineAt) {
      const query = `?targetUsdt=${encodeURIComponent(String(targetUsdt))}&deadlineAt=${encodeURIComponent(String(deadlineAt))}`;
      const value = await client.request<unknown>({ method: "GET", path: `/api/goals/recommendation${query}` });
      return validRecommendation(value, mode) ? value : invalid();
    },
  };
}
