import { ref, shallowRef, watch } from "vue";
import { parseServerTimestamp } from "@/api/server-time";
import type { SessionSnapshot, SessionVault } from "@/api/session-vault";
import type { AppHomePeriod, AppHomeEarningsLedgerRow } from "@/api/app-home-api";
import type { LocalizedText, PublicPromotion } from "@/api/promotion-contracts";
import type { StoreYieldAuthority, YieldAmount } from "./store-yield-authority";
import { businessDayKey, businessWallClock, type BusinessTrack } from "./business-calendar";
import { readAccountRow, writeAccountRow, removeAccountRow } from "@/store/account-scoped-storage";

export const TAB_FIRST_SCREEN_TABLE = "uvel-tab-first-screen-v1";
export interface PromotionEntrySnapshot {
  displayOnly: true;
  activityId: string; version: number; template: PublicPromotion["template"];
  title: LocalizedText; startsAt: string; endsAt: string; serverTime: string;
  bannerImageUrl: string | null; kind: "gift" | "coupon" | "spark" | "plain";
  benefit: string; href: string;
  slots: Array<{ role: "purchase" | "gift"; sku: string }>;
}
export interface TabSnapshotData {
  home: { earnings: { today: AppHomePeriod; week: AppHomePeriod; month: AppHomePeriod; all: AppHomePeriod }; latest: AppHomeEarningsLedgerRow | null };
  wallet: { usdt: number; nex: number; today: { usdt: number; nex: number } };
  commission: { totalUSDT: number; contributorCount: number; directUSDT: number; extendedUSDT: number;
    monthUSDT: number; monthNEX: number; unlockedUSDT: number; coolingUSDT: number };
  network: { total: number; direct: number };
  rank: { rank: number; next: number | null; missing: number; bars: Array<{ key: string;
    kind: "selfComputePoints" | "directRefs" | "teamComputePoints" | "vDownlines"; vLevel: number | null; percent: number | null }> };
  referral: { enabled: boolean; amount: number; invited: number };
  release: { pending: number; locked: number };
  market: { price: number };
  vouchers: Array<{ id: string; startAt: number; endAt: number; claimableOnStore: boolean;
    type: "fixed" | "percent"; amountUSD: number | null; percent: number | null; maxDiscountUSD: number | null }>;
  promotions: PromotionEntrySnapshot[];
  catalogYield: Pick<StoreYieldAuthority, "entry" | "pro" | "rack" | "ladder">;
  phoneYield: YieldAmount | null;
}
export type TabSnapshotKey = keyof TabSnapshotData;
interface Context {
  accountKey: string; environment: string; baseUrl: string; locale: string;
  sessionChainId: string; sessionGroup: string | null; installationId: string | null; appSessionVersion: number | null;
}
type Blocks = { [K in TabSnapshotKey]?: { generatedAt: string | null; receivedAt: number; data: TabSnapshotData[K] } };
interface Row { schema: 1; context: Context; blocks: Blocks }
export interface TabSnapshotWriteScope { binding: number; revisions: Record<TabSnapshotKey, number> }
const keys: TabSnapshotKey[] = ["home", "wallet", "commission", "network", "rank", "referral", "release", "market", "vouchers", "promotions", "catalogYield", "phoneYield"];
const revisions = Object.fromEntries(keys.map(key => [key, 0])) as Record<TabSnapshotKey, number>;
const displayed = shallowRef<Row | null>(null);
const clock = ref(Date.now());
let context: Context | null = null, accepted = false, binding = 0;
let restored = new Set<TabSnapshotKey>();

// The storage boundary validates this new format once. No migration or whole-store hydration.
type Schema = "number" | "count" | "percent" | "string" | "boolean" | { nullable: Schema } | { list: Schema } | { oneOf: readonly unknown[] } | { fields: Record<string, Schema> };
const n: Schema = "number", c: Schema = "count", pct: Schema = "percent", s: Schema = "string", b: Schema = "boolean";
const nullable = (value: Schema): Schema => ({ nullable: value });
const fields = (value: Record<string, Schema>): Schema => ({ fields: value });
const list = (value: Schema): Schema => ({ list: value });
const amount = nullable(fields({ usd: n, nex: n }));
const period = fields({ usdt: nullable(n), nex: nullable(n), jobCount: nullable(c) });
const localized = fields({ zh: s, en: s, vi: s });
const schemas: Record<TabSnapshotKey, Schema> = {
  home: fields({ earnings: fields({ today: period, week: period, month: period, all: period }), latest: nullable(fields({ id: s, client: s, model: s, rewardUsdt: n, completedAt: s, synthetic: b })) }),
  wallet: fields({ usdt: n, nex: n, today: fields({ usdt: n, nex: n }) }),
  commission: fields({ totalUSDT: n, contributorCount: c, directUSDT: n, extendedUSDT: n, monthUSDT: n, monthNEX: n, unlockedUSDT: n, coolingUSDT: n }),
  network: fields({ total: c, direct: c }),
  rank: fields({ rank: { oneOf: [0, 1, 2, 3, 4, 5, 6, 7, 8] }, next: nullable({ oneOf: [1, 2, 3, 4, 5, 6, 7, 8] }), missing: c, bars: list(fields({ key: s, kind: { oneOf: ["selfComputePoints", "directRefs", "teamComputePoints", "vDownlines"] }, vLevel: nullable(c), percent: nullable(pct) })) }),
  referral: fields({ enabled: b, amount: n, invited: c }),
  release: fields({ pending: n, locked: n }), market: fields({ price: n }),
  vouchers: list(fields({ id: s, startAt: n, endAt: n, claimableOnStore: b, type: { oneOf: ["fixed", "percent"] }, amountUSD: nullable(n), percent: nullable(n), maxDiscountUSD: nullable(n) })),
  promotions: list(fields({ displayOnly: { oneOf: [true] }, activityId: s, version: c,
    template: { oneOf: ["SKU_GIFT", "FIRST_PURCHASE", "DIRECT_REFERRAL", "MULTI_PRODUCT", "REPURCHASE"] }, title: localized,
    startsAt: s, endsAt: s, serverTime: s, bannerImageUrl: nullable(s), kind: { oneOf: ["gift", "coupon", "spark", "plain"] }, benefit: s, href: s,
    slots: list(fields({ role: { oneOf: ["purchase", "gift"] }, sku: s })) })),
  catalogYield: fields({ entry: amount, pro: amount, rack: amount, ladder: list(fields({ id: { oneOf: ["phone", "entry", "pro", "proV2", "rack", "rackP2"] }, amount, widthPct: n })) }),
  phoneYield: amount,
};
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function valid(value: unknown, schema: Schema): boolean {
  if (schema === "number" || schema === "count" || schema === "percent") return typeof value === "number" && Number.isFinite(value) && value >= 0
    && (schema !== "count" || Number.isSafeInteger(value)) && (schema !== "percent" || value <= 100);
  if (typeof schema === "string") return typeof value === schema;
  if ("nullable" in schema) return value === null || valid(value, schema.nullable);
  if ("oneOf" in schema) return schema.oneOf.includes(value);
  if ("list" in schema) return Array.isArray(value) && value.every(item => valid(item, schema.list));
  return record(value) && Object.keys(value).length === Object.keys(schema.fields).length
    && Object.entries(schema.fields).every(([key, child]) => valid(value[key], child));
}
function parseRow(value: unknown): Row | null {
  if (!record(value) || value.schema !== 1 || !valid(value.context, fields({ accountKey: s, environment: s, baseUrl: s, locale: s,
    sessionChainId: s, sessionGroup: nullable(s), installationId: nullable(s), appSessionVersion: nullable(c) })) || !record(value.blocks)) return null;
  for (const [key, block] of Object.entries(value.blocks)) {
    if (!keys.includes(key as TabSnapshotKey) || !record(block) || !valid(block.receivedAt, n)
      || !(block.generatedAt === null || parseServerTimestamp(block.generatedAt) !== null)
      || !valid(block.data, schemas[key as TabSnapshotKey])) return null;
  }
  return value as unknown as Row;
}
function remove(accountKey: string): void {
  if (accountKey !== "default" && !removeAccountRow(TAB_FIRST_SCREEN_TABLE, accountKey)) console.warn("[tab-first-screen] storage removal unavailable");
}
function persist(): void {
  const row = displayed.value;
  if (!row) return;
  if (Object.keys(row.blocks).length === 0) remove(row.context.accountKey);
  else if (!writeAccountRow(TAB_FIRST_SCREEN_TABLE, row.context.accountKey, row)) console.warn("[tab-first-screen] storage write unavailable");
}
export function forgetTabSnapshotAccount(accountKey?: string): void {
  if (accountKey) remove(accountKey);
  if (context && (!accountKey || context.accountKey === accountKey)) {
    remove(context.accountKey); accepted = false; context = null; binding += 1; displayed.value = null; restored.clear();
  }
}
export function revokeAcceptedTabSnapshots(): void { if (accepted) forgetTabSnapshotAccount(); }
export function beginTabSnapshotBinding(accountKey: string, reason: "resume" | "new-login", session: SessionSnapshot,
  service: { environment: string; baseUrl: string; locale: string }): void {
  revokeAcceptedTabSnapshots();
  binding += 1; accepted = false; displayed.value = null; restored.clear();
  if (reason === "new-login") remove(accountKey);
  context = session.sessionChainId ? { accountKey, ...service, baseUrl: service.baseUrl.replace(/\/+$/, ""),
    sessionChainId: session.sessionChainId, sessionGroup: session.sessionGroup ?? null,
    installationId: session.installationId ?? null, appSessionVersion: session.appSessionVersion ?? null } : null;
}
/** Call only after the confirmed vault/auth/app identity has completed binding. */
export function acceptTabSnapshotBinding(resume: boolean): void {
  if (!context) return;
  accepted = true;
  let row: Row | null;
  try { row = parseRow(readAccountRow<unknown>(TAB_FIRST_SCREEN_TABLE, context.accountKey, true)); }
  catch (error) { console.warn("[tab-first-screen] storage read unavailable", error); row = null; }
  if (!resume || !row || JSON.stringify(row.context) !== JSON.stringify(context)) {
    remove(context.accountKey); row = { schema: 1, context, blocks: {} };
  }
  restored = new Set(Object.keys(row.blocks) as TabSnapshotKey[]);
  displayed.value = row;
}
export function installTabSnapshotLifecycle(vault: SessionVault, service: () => { environment: string; baseUrl: string; locale: string }): void {
  // A startup candidate/first cookie restore has continuation=false, before we
  // have accepted an owner. Only an accepted owner can be revoked by this event.
  vault.subscribe?.((_previous, _next, continuation) => { if (!continuation) revokeAcceptedTabSnapshots(); });
  watch(service, next => {
    if (!accepted || !context) return;
    if (next.environment !== context.environment || next.baseUrl.replace(/\/+$/, "") !== context.baseUrl) { forgetTabSnapshotAccount(); return; }
    if (next.locale !== context.locale) {
      remove(context.accountKey); context = { ...context, locale: next.locale }; binding += 1; restored.clear();
      displayed.value = { schema: 1, context, blocks: {} };
    }
  }, { flush: "sync" });
}
export function advanceTabSnapshotClock(now = Date.now()): void { clock.value = now; }
export function captureTabSnapshotWrite(): TabSnapshotWriteScope | null {
  return context ? { binding, revisions: { ...revisions } } : null;
}
export function saveTabSnapshot<K extends TabSnapshotKey>(scope: TabSnapshotWriteScope | null, key: K, data: TabSnapshotData[K], generatedAt: string | null): void {
  if (!accepted || !context || !displayed.value || !scope || scope.binding !== binding || scope.revisions[key] !== revisions[key]) return;
  displayed.value = { ...displayed.value, blocks: { ...displayed.value.blocks, [key]: { data, generatedAt, receivedAt: Date.now() } } };
  persist();
}
export function invalidateTabSnapshots(affected: readonly TabSnapshotKey[] = keys, scope?: TabSnapshotWriteScope | null): void {
  if (!accepted || !displayed.value || (scope !== undefined && (!scope || scope.binding !== binding))) return;
  const blocks = { ...displayed.value.blocks };
  for (const key of affected) { delete blocks[key]; revisions[key] += 1; restored.delete(key); }
  displayed.value = { ...displayed.value, blocks }; persist();
}
export function tabSnapshotPeriodCurrent(key: TabSnapshotKey, period: "today" | "week" | "month", track: BusinessTrack = "LEGACY"): boolean {
  const generatedAt = displayed.value?.blocks[key]?.generatedAt;
  if (!generatedAt) return false;
  const source = parseServerTimestamp(generatedAt)!, now = clock.value;
  if (period === "today") return businessDayKey(track, source) === businessDayKey(track, now);
  const sourceDate = businessWallClock(track, source), currentDate = businessWallClock(track, now);
  if (period === "month") return sourceDate.toISOString().slice(0, 7) === currentDate.toISOString().slice(0, 7);
  const monday = (day: Date) => { day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7); return day.toISOString().slice(0, 10); };
  return monday(sourceDate) === monday(currentDate);
}
export function readTabSnapshot<K extends TabSnapshotKey>(key: K): TabSnapshotData[K] | null {
  const block = displayed.value?.blocks[key];
  if (!accepted || !block) return null;
  if (key === "vouchers") return (block.data as TabSnapshotData["vouchers"]).filter(row => row.startAt <= clock.value && (!row.endAt || row.endAt > clock.value)) as TabSnapshotData[K];
  if (key === "promotions") return (block.data as TabSnapshotData["promotions"]).filter(row => Date.parse(row.startsAt) <= clock.value && Date.parse(row.endsAt) > clock.value) as TabSnapshotData[K];
  return block.data;
}
export function restoredTabSnapshot(key: TabSnapshotKey): boolean { void displayed.value; return accepted && restored.has(key); }
