import { computed, ref } from "vue";
import { parse } from "@vue/compiler-sfc";
import { expect, it, vi } from "vitest";
import ts from "typescript";
import source from "./tradein-sheets.vue?raw";
import { zh } from "@/i18n/messages/zh";

const script = parse(source).descriptor.scriptSetup!.content;
const ast = ts.createSourceFile("tradein.ts", script, ts.ScriptTarget.Latest, true);
const handler = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "onKeepBuy")!;
const code = ts.transpileModule(handler.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

it.each(["REPLACE_REQUIRED", "CAPACITY_AVAILABLE"])("keeps the remote KEEP command bound to %s capacity", decision => {
  const quote = { decision, targetProductNo: "stellarbox-s1", decisionSource: "server" };
  const state = ref({ kind: "replace", newKind: "stellarbox-s1", canonicalCapacityQuote: quote });
  const confirming = ref(false), submitCanonicalKeepBuy = vi.fn(), toast = { warn: vi.fn() };
  const deps = { state, confirming, remoteApiEnabled: true, replaceView: ref({ insufficient: false }),
    t: ref(zh), submitCanonicalKeepBuy, toast };
  new Function(...Object.keys(deps), `${code}; onKeepBuy();`)(...Object.values(deps));
  expect(confirming.value).toBe(decision === "CAPACITY_AVAILABLE");
  expect(submitCanonicalKeepBuy).toHaveBeenCalledTimes(decision === "CAPACITY_AVAILABLE" ? 1 : 0);
  if (decision === "REPLACE_REQUIRED") expect(toast.warn).toHaveBeenCalledWith(zh.tradein.errReplaceSlotConflict);
});

it("hides remote KEEP in the full-capacity replacement surface", () => {
  const condition = source.match(/v-if="([^"]+)"\s+class="tis-secondary"/)![1];
  const renderAction = new Function("remoteApiEnabled", "state", `return ${condition};`);
  expect(renderAction(true, { kind: "replace", canonicalCapacityQuote: { decision: "REPLACE_REQUIRED" } })).toBe(false);
  expect(renderAction(true, { kind: "replace", canonicalCapacityQuote: { decision: "CAPACITY_AVAILABLE" } })).toBe(true);
  expect(renderAction(false, { kind: "replace" })).toBe(true);
});
