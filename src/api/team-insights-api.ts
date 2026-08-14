import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import type { CommissionEvent } from "@/store/commission";
import type { LeaderEntry, LeaderPeriod } from "@/mock/leaderboard";

export interface TeamProvenance { source: "server"; sourceEnvironment: "PRODUCTION" | "SANDBOX"; runId: string }
export interface TeamLeaderboardSnapshot extends TeamProvenance {
  period: LeaderPeriod; rows: LeaderEntry[]; myRank: number | null; gapToNext: number;
  poolUsd: number; topN: number; generatedAt: string;
}
export interface TeamCommissionSnapshot extends TeamProvenance { events: CommissionEvent[]; generatedAt: string }
export interface TeamPoolDistribution { vRank: number; people: number; votes: number }
export interface TeamLeadershipHistory { weekId: string; payoutUSDT: number }
export interface TeamLeadershipPoolSnapshot extends TeamProvenance {
  currentWeekPoolUSDT: number; myRank: number; myVotes: number; totalVotes: number;
  mySharePct: number; projectedPayoutUSDT: number; distribution: TeamPoolDistribution[];
  history: TeamLeadershipHistory[]; nextPayoutAt: string;
}
export interface TeamInsightsApi {
  leaderboard(period: LeaderPeriod): Promise<TeamLeaderboardSnapshot>;
  commissions(): Promise<TeamCommissionSnapshot>;
  leadershipPool(): Promise<TeamLeadershipPoolSnapshot>;
}

function invalid(): never { throw new ApiError({ kind: "protocol", message: "TEAM_INSIGHTS_RESPONSE_INVALID" }); }
function row(value: unknown): Record<string, unknown> { if(!value||typeof value!=="object"||Array.isArray(value)) return invalid(); return value as Record<string,unknown>; }
function num(value: unknown, integer=false): number { if(typeof value!=="number"||!Number.isFinite(value)||value<0||(integer&&!Number.isSafeInteger(value))) return invalid(); return value; }
function text(value: unknown): string { if(typeof value!=="string"||!value.trim()) return invalid(); return value.trim(); }
function provenance(source: Record<string,unknown>): TeamProvenance { const environment=source.sourceEnvironment;if(source.source!=="server"||(environment!=="PRODUCTION"&&environment!=="SANDBOX")||typeof source.runId!=="string"||(environment==="SANDBOX"&&!source.runId.trim())||(environment==="PRODUCTION"&&source.runId!=="")) return invalid();return {source:"server",sourceEnvironment:environment,runId:source.runId}; }

function leaderboard(value: unknown): TeamLeaderboardSnapshot {
  const source=row(value); const proof=provenance(source); const period=source.period;
  if((period!=="today"&&period!=="week"&&period!=="month"&&period!=="all")||!Array.isArray(source.rows)) return invalid();
  const rows=source.rows.map((item):LeaderEntry=>{const v=row(item);const rank=num(v.rank,true);const vRank=num(v.vRank,true);if(rank<1||vRank>12||typeof v.handle!=="string"||typeof v.flag!=="string"||typeof v.cc!=="string"||typeof v.hasDevice!=="boolean") return invalid();return {rank,handle:v.handle,flag:v.flag,cc:v.cc,directs:num(v.directs,true),teamSize:num(v.teamSize,true),earnedUSDT:num(v.earnedUSDT),delta:typeof v.delta==="number"&&Number.isSafeInteger(v.delta)?v.delta:invalid(),vRank,hasDevice:v.hasDevice};});
  const generatedAt=text(source.generatedAt);if(!Number.isFinite(Date.parse(generatedAt))) return invalid();
  const myRank=source.myRank===null?null:num(source.myRank,true);return {...proof,period,rows,myRank,gapToNext:num(source.gapToNext),poolUsd:num(source.poolUsd),topN:num(source.topN,true),generatedAt};
}

const KINDS=new Set(["unilevel","binary","peer","cultivation","leadership","genesis"]);
const STATUSES=new Set(["cooling","unlocked","withdrawn"]);
function commissions(value: unknown): TeamCommissionSnapshot { const source=row(value);const proof=provenance(source);if(!Array.isArray(source.events)) return invalid();const events=source.events.map((item):CommissionEvent=>{const v=row(item);if(!KINDS.has(String(v.kind))||!STATUSES.has(String(v.status))) return invalid();const ts=num(v.ts,true),unlockAt=num(v.unlockAt,true);return {id:text(v.id),kind:v.kind as CommissionEvent["kind"],sourceUserId:text(v.sourceUserId),sourceUserName:text(v.sourceUserName),layer:v.layer===null||v.layer===undefined?undefined:num(v.layer,true),orderId:v.orderId===null||v.orderId===undefined?undefined:text(v.orderId),orderAmountUSD:v.orderAmountUSD===null||v.orderAmountUSD===undefined?undefined:num(v.orderAmountUSD),amountUSDT:num(v.amountUSDT),amountNEX:num(v.amountNEX),ts,unlockAt,status:v.status as CommissionEvent["status"]};});const generatedAt=text(source.generatedAt);if(!Number.isFinite(Date.parse(generatedAt)))return invalid();return {...proof,events,generatedAt}; }

function pool(value: unknown): TeamLeadershipPoolSnapshot {const source=row(value);const proof=provenance(source);if(!Array.isArray(source.distribution)||!Array.isArray(source.history))return invalid();const distribution=source.distribution.map(item=>{const v=row(item);const vRank=num(v.vRank,true);if(vRank>12)return invalid();return {vRank,people:num(v.people,true),votes:num(v.votes,true)};});const history=source.history.map(item=>{const v=row(item);return {weekId:text(v.weekId),payoutUSDT:num(v.payoutUSDT)};});const nextPayoutAt=text(source.nextPayoutAt);if(!Number.isFinite(Date.parse(nextPayoutAt)))return invalid();return {...proof,currentWeekPoolUSDT:num(source.currentWeekPoolUSDT),myRank:num(source.myRank,true),myVotes:num(source.myVotes,true),totalVotes:num(source.totalVotes,true),mySharePct:num(source.mySharePct),projectedPayoutUSDT:num(source.projectedPayoutUSDT),distribution,history,nextPayoutAt};}

export function createTeamInsightsApi(client: ApiClient): TeamInsightsApi {const root="/api/app/team/insights";return {leaderboard:async period=>leaderboard(await client.request<unknown>({path:`${root}/leaderboard?period=${encodeURIComponent(period)}`})),commissions:async()=>commissions(await client.request<unknown>({path:`${root}/commissions`})),leadershipPool:async()=>pool(await client.request<unknown>({path:`${root}/leadership-pool`}))};}
