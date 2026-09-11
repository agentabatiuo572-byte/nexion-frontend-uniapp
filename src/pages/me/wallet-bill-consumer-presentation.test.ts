// @ts-expect-error This behavior test reads SFC source in Node.
import { readFileSync } from "node:fs";
import ts from "typescript";
import { computed, reactive, ref } from "vue";
import { describe, expect, it } from "vitest";
import { resolveWalletBillMemo } from "@/lib/wallet-bill-display";
import { en } from "@/i18n/messages/en";
import { zh } from "@/i18n/messages/zh";

function section(file: string, start: string, end: string): string {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  if (first < 0 || last < 0) throw new Error(`Missing display binding in ${file}`);
  return ts.transpile(source.slice(first, last), { target: ts.ScriptTarget.ES2022 });
}
const row = (memoKey = "questReward") => ({ id: "ledger-1", ts: 1, symbol: "NEX", amount: 5,
  status: "posted", type: "achievement", memo: "", memoKey });

function nexView(memoKey?: string) {
  const bills = reactive({ summaryStatus: "ready", summary: { recentNexBills: [row(memoKey)] } });
  const t = ref(en);
  const code = section("./wallet-nex.vue", "const nexLedger = computed", "const pendingNex = computed");
  const view = new Function("computed", "remoteApiEnabled", "bills", "t", "resolveWalletBillMemo",
    `${code}; return nexLedger;`)(computed, true, bills, t, resolveWalletBillMemo);
  return { bills, t, view };
}
function rewardsView(memoKey?: string) {
  const records = ref([row(memoKey)]);
  const t = ref(en);
  const code = section("./rewards-list.vue", "const visibleRecords = computed", "const hasMore = computed");
  const view = new Function("computed", "fundsServerEnabled", "records", "visibleCount", "t", "resolveWalletBillMemo",
    `${code}; return visibleRecords;`)(computed, true, records, ref(10), t, resolveWalletBillMemo);
  return { records, t, view };
}

describe("controlled wallet descriptions on every consumer", () => {
  it("renders and retranslates NEX activity without exposing the internal category", () => {
    const s = nexView();
    expect(s.view.value[0].label).toBe(en.bills.memo.questReward);
    s.t.value = zh;
    expect(s.view.value[0].label).toBe(zh.bills.memo.questReward);
    expect(s.bills.summary.recentNexBills[0].memo).toBe("");
  });
  it("does not display NEX activity from a failed summary", () => {
    const s = nexView(); s.bills.summaryStatus = "error";
    expect(s.view.value).toEqual([]);
  });
  it("renders and retranslates reward rows without mutating ledger records", () => {
    const s = rewardsView();
    expect(s.view.value[0].memo).toBe(en.bills.memo.questReward);
    s.t.value = zh;
    expect(s.view.value[0].memo).toBe(zh.bills.memo.questReward);
    expect(s.records.value[0].memo).toBe("");
  });
  it("keeps unknown NEX and reward descriptions generic", () => {
    expect(nexView("futureCode").view.value[0].label).toBe(en.bills.memo.other);
    expect(rewardsView("futureCode").view.value[0].memo).toBe(en.bills.memo.other);
  });
});
