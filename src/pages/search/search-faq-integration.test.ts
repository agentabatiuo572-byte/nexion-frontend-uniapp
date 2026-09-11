import { computed, ref } from "vue";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import page from "./search.vue?raw";
import { resolveSearchResultState } from "@/lib/search-source-state";

const start = page.indexOf("const results = computed<Hit[]>");
const end = page.indexOf("// Grouped as", start);
if (start < 0 || end < start) throw new Error("Search result computation is required");
const source = ts.transpileModule(page.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function setup(query: string) {
  const publishedFaqs = ref([{ id: "faq/a?b", question: "页面数据没有更新怎么办？", answer: "请刷新页面后重试。" }]);
  const publishedFaqStatus = ref("ready");
  const names = ["computed", "q", "t", "ROUTES", "FAQ", "staking", "searchStakingRateSummary",
    "remoteApiEnabled", "searchableProducts", "productCopy", "devices", "deviceName", "deviceGpuLabel",
    "members", "publishedFaqs", "publishedFaqStatus", "resolveSearchResultState", "productCatalogState", "network", "app"];
  const result = new Function(...names, `${source}; return {results, searchResultState};`)(
    computed, ref(query), ref({ search: { routes: {}, faqEntries: {}, askNova: "问问 Nova", askNovaWithQuery: "解答{query}" } }),
    [], [], {}, () => "", true, ref([]), () => "", ref([]), () => "", () => "", ref([]),
    publishedFaqs, publishedFaqStatus, resolveSearchResultState, { status: "ready" }, { remoteStatus: "ready" },
    { remoteFleetStatus: "ready", remoteFleetHasSnapshot: true },
  );
  return { ...result, publishedFaqs, publishedFaqStatus };
}

describe("global search uses the published Help Center FAQ corpus", () => {
  it("finds a published question missing from the static guide catalog and binds its exact id", () => {
    const state = setup("页面数据没有更新");
    expect(state.results.value).toContainEqual({ group: "faq", label: "页面数据没有更新怎么办？",
      sublabel: "请刷新页面后重试。", href: "/pages/me/help?faqId=faq%2Fa%3Fb" });
  });

  it("matches the current published answer and removes a question when its projection is replaced", () => {
    const state = setup("刷新页面");
    expect(state.results.value.filter((hit: { group: string }) => hit.group === "faq")).toHaveLength(1);
    state.publishedFaqs.value = [];
    expect(state.results.value).toEqual([]);
  });
});
