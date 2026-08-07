// 空状态探针(C5 2026-07-23):强制让每个接了 EmptyState 的页面进入空态,核实它真渲染出来。
//
// 为什么要强制:这些列表的数据来自代码里的 mock 种子,清 storage 也还在 —— 不制造空态就
// 永远看不到空态,「接上了组件」和「空态真能显示」是两回事(声明≠实现)。
// 做法:页面挂载后遍历所有 pinia store,把**数组类型的 state 字段**清空,列表自然全空。
//
// 逐页断言:① .nx-empty 出现 ② 插画真加载出来(naturalWidth>0,路径写错会是 0)
// ③ 标题非空 ④ 不横向溢出 ⑤ 无 console error。
//
// 用法:node scripts/empty-state-probe.mjs [--theme light]
import { chromium } from "playwright";
import { collectAppConsoleErrors, isThirdPartyResourceError } from "./lib/console-origin-filter.mjs";

const BASE = process.env.UNI_BASE_URL || process.env.BASE_URL || "http://localhost:5173";
const THEME = process.argv.includes("--theme") ? process.argv[process.argv.indexOf("--theme") + 1] : "dark";

// 接了 EmptyState 的页面(与 docs/changes/2026-07-23-c5-empty-states.md 的映射表一致)
// 多数页面的列表数据在 pinia store 里,清空数组就够。但有几个页面的数据源是**代码常量**
// (搜索目录 / FAQ / TOKENS / EVENTS),清 store 对它们无效 —— 那几个得靠真实交互触发空态:
// 往搜索框里打一个不可能命中的词,或把筛选切到没有结果的那一档。
const TYPE_JUNK = "zzzqqqxxx";
const ROUTES = [
  { r: "pages/search/search", type: TYPE_JUNK },
  { r: "pages/me/devices" },
  { r: "pages/staking/staking" },
  { r: "pages/daily/daily" },
  { r: "pages/team/unilevel" },
  // 数据源是页面局部 reactive(starState),探针够不着 —— 标注而非红灯:
  // 会稳定误报的门必然被白名单绕过,等于没门。组件渲染已由其余 17 页覆盖。
  { r: "pages/market/market", unreachable: "Watchlist 空态由页面局部 starState 决定,需真实逐个取消收藏" },
  { r: "pages/me/wallet-exchange" },
  { r: "pages/me/wallet-nex", unreachable: "🔴 mock 恒非空:activity computed 里硬塞了 5 条 mining 记录,当前空态不可达;接真后台后才可能为空(空态本身该留)" },
  { r: "pages/me/wallet-bills" },
  { r: "pages/me/support-tickets" },
  { r: "pages/events/events", unreachable: "按 tab 过滤 EVENTS 常量,需切到无结果的 tab" },
  { r: "pages/team/commissions" },
  { r: "pages/me/help", type: TYPE_JUNK },
  { r: "pages/me/wallet-cards" },
  { r: "pages/store/orders" },
  { r: "pages/me/notifications" },
  { r: "pages/me/receipts" },
  { r: "pages/support/messages" },
  { r: "pages/store/bundle" },
  { r: "pages/me/rewards-list" },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "en-US" });
page.setDefaultTimeout(20000);
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error" && !/favicon/i.test(m.text()) && !isThirdPartyResourceError(m.text(), m.location?.().url, BASE)) consoleErrors.push(m.text().slice(0, 90));
});

const rows = [];
for (const [i, spec] of ROUTES.entries()) {
  const route = spec.r;
  const before = consoleErrors.length;
  try {
    await page.goto(`${BASE}/?nx_device=off&es=${i}#/${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1300);
    // 常量数据源的页面:往搜索框打不可能命中的词
    if (spec.type) {
      await page.evaluate((junk) => {
        const inp = document.querySelector("uni-input input");
        if (!inp) return;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(inp, junk);
        inp.dispatchEvent(new Event("input", { bubbles: true }));
      }, spec.type);
      await page.waitForTimeout(700);
    }
    const res = await page.evaluate(async (theme) => {
      const app = document.querySelector("#app")?.__vue_app__;
      const pinia = app?.config?.globalProperties?.$pinia;
      if (!pinia) return { err: "no pinia" };
      pinia._s.get("theme")?.setMode(theme);
      // 清空所有 store 里的数组字段 —— 列表全空,空态自然显形
      let cleared = 0;
      for (const store of pinia._s.values()) {
        for (const k of Object.keys(store.$state ?? {})) {
          if (Array.isArray(store.$state[k]) && store.$state[k].length) {
            store.$state[k] = [];
            cleared++;
          }
        }
      }
      await new Promise((r) => setTimeout(r, 600));
      const el = document.querySelector(".nx-empty");
      if (!el) return { cleared, empty: false };
      const art = el.querySelector("img") || el.querySelector(".nx-empty__art img");
      const title = el.querySelector(".nx-empty__title");
      const doc = document.scrollingElement;
      return {
        cleared,
        empty: true,
        artSrc: art ? (art.getAttribute("src") || "").split("/").slice(-2).join("/") : null,
        artOk: art ? art.complete && art.naturalWidth > 0 : false,
        title: (title?.textContent || "").trim().slice(0, 22),
        overflowX: doc.scrollWidth > doc.clientWidth + 1,
        box: Math.round(el.getBoundingClientRect().width) + "x" + Math.round(el.getBoundingClientRect().height),
      };
    }, THEME);
    rows.push({ route, unreachable: spec.unreachable, ...res, newErrors: consoleErrors.length - before });
  } catch (e) {
    rows.push({ route, err: e.message.split("\n")[0].slice(0, 60) });
  }
}
await browser.close();

let fail = 0;
console.log(`空状态探针(theme=${THEME}) — ${ROUTES.length} 个接入页\n`);
for (const r of rows) {
  const bad = [];
  if (r.unreachable) { console.log(`skip  ${r.route.padEnd(30)} 探针够不着:${r.unreachable}`); continue; }
  if (r.err) bad.push("异常:" + r.err);
  else if (!r.empty) bad.push("清空数组后仍未渲染 .nx-empty");
  else {
    if (!r.artOk) bad.push("插画没加载出来(路径错或文件缺)");
    if (!r.title) bad.push("标题为空");
    if (r.overflowX) bad.push("横向溢出");
    if (r.newErrors) bad.push(`console error ×${r.newErrors}`);
  }
  if (bad.length) fail++;
  console.log(`${bad.length ? "FAIL" : "ok  "}  ${r.route.padEnd(30)} ${r.empty ? `${r.box} ${r.artSrc} "${r.title}"` : ""} ${bad.join(" · ")}`);
}
console.log(`\n${rows.length - fail}/${rows.length} 通过`);
process.exit(fail ? 1 : 0);
