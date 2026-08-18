#!/usr/bin/env node
// SVG 内文字运行时门(P-121,2026-08-17)—— 源码门只能证明「没写错的写法」,这道门证明「字真的排出来了」。
//
// 为什么源码门不够:P-121 的全部危险性在于源码看起来完全正常 —— `<text>` 编成 `<uni-text>` 后 0×0、不报错;
// UnoCSS attributify 把 `font-size="9.5"` 劫持成 2.375rem 后字大 4 倍、也不报错。两件事都只有在浏览器里
// 量 `getBoundingClientRect()` / `getComputedStyle()` 才看得见。所以逐路由真渲染、真测量。
//
// 判据(每条带 tag;红测按 tag 计数):
//   [count]        路由上 `svg text` 数量 ≥ 期望(期望 = 该文件模板里 `<SvgText` 的静态个数,v-for 只会更多;
//                  个别页面可用 ROUTE_MAP.min 覆盖并写理由)。
//   [rendered]     每个 `svg text` 的 bbox 宽高 > 0(0×0 = 没排版 / display:none / 空)。
//   [empty]        textContent 非空(占位空标签不算「显示了」)。
//   [inside]       文字 bbox 落在所属 <svg> 视口内(容差 2px)—— 画到视口外 = 被裁 = 用户看不见。
//   [uni-text-in-svg] 页面里 `svg uni-text` 必须为 0(P-121 原形回归)。
//   [font-size-hijacked] 带 `font-size` 属性的文字,计算字号必须等于属性值(attributify / 任何 CSS 劫持都在这里现形)。
//   [unregistered]  🔴 完整性轴:仓内所有含 `<SvgText` 的文件都必须在 ROUTE_MAP 登记到一条路由。
//                  名单型的门对没入册的页面天然隐形(P-118),所以这里反过来:新写了 SVG 文字却没登记 → 红,不是静默跳过。
//   [console]      路由上 console error = 0(与其它探针同口径,第三方资源错误按 lib 过滤)。
//
// 用法:UNI_BASE_URL=http://localhost:5231 node scripts/svg-text-render-probe.mjs      (默认 en;--lang zh|vi 换语言)
//       node scripts/svg-text-render-probe.mjs --selftest   红测:合成页面逐条隔离(阳性必中 + 合法必放行),不需要 server
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { isThirdPartyResourceError } from "./lib/console-origin-filter.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.UNI_BASE_URL || process.env.BASE_URL || "http://localhost:5173";
const argv = process.argv.slice(2);
const LANG = argv.includes("--lang") ? argv[argv.indexOf("--lang") + 1] : "en";
const TOL = 2;

/** 含 <SvgText> 的源文件 → 承载它的路由(组件写它被用到的页面 + 参数)。min 只在静态计数不适用时覆盖,必带理由。 */
export const ROUTE_MAP = {
  "src/pages/team/network.vue": { route: "pages/team/network" },
  "src/pages/team/binary-how.vue": { route: "pages/team/binary-how" },
  "src/pages/globe/globe.vue": { route: "pages/globe/globe" },
  // 组件:商品详情 Cloud Share 档才走抽象云图(硬件档是照片 + HTML 叠字)
  "src/components/store/product-render.vue": { route: "pages/store/detail?id=cloud-share" },
};

/** 仓内哪些文件的模板里有 <SvgText>(与源码门同一判定面:注释剥掉后的 <template> 区)。 */
export async function svgTextFiles(root = ROOT) {
  const { stripComments, templateRegion } = await import("./lib/sfc-strip-comments.mjs");
  const out = {};
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".vue")) {
        const tpl = templateRegion(stripComments(fs.readFileSync(p, "utf8"), true));
        const n = (tpl.match(/<SvgText(?=[\s/>])/g) || []).length;
        if (n) out[path.relative(root, p).replace(/\\/g, "/")] = n;
      }
    }
  };
  walk(path.join(root, "src"));
  return out;
}

/** 完整性:每个含 SvgText 的文件都登记了路由。纯函数,红测喂假清单。 */
export function judgeRegistry(files, routeMap = ROUTE_MAP) {
  const hits = [];
  for (const f of Object.keys(files)) if (!routeMap[f]) hits.push({ tag: "unregistered", msg: `${f} 的模板里有 <SvgText>,但 svg-text-render-probe.mjs 的 ROUTE_MAP 没登记它该在哪条路由上被验 —— 加一条,别让新示意图逃出运行时门` });
  return hits;
}

/** 页内测量:在页面上下文里跑,返回可序列化快照。 */
export function snapshotScript() {
  return () => {
    const texts = [...document.querySelectorAll("svg text")].map((t) => {
      const b = t.getBoundingClientRect();
      const svg = t.closest("svg");
      const s = svg ? svg.getBoundingClientRect() : null;
      const cs = getComputedStyle(t);
      return {
        text: (t.textContent || "").trim(),
        w: b.width, h: b.height,
        left: b.left, right: b.right, top: b.top, bottom: b.bottom,
        svg: s ? { left: s.left, right: s.right, top: s.top, bottom: s.bottom } : null,
        fontSizeAttr: t.getAttribute("font-size"),
        fontSizeComputed: cs.fontSize,
      };
    });
    return { texts, uniTextInSvg: document.querySelectorAll("svg uni-text").length };
  };
}

/** 对一份快照下判决(纯函数;红测用合成页面产快照)。 */
export function judgeSnapshot(snap, min, tol = TOL) {
  const hits = [];
  if (snap.texts.length < min) hits.push({ tag: "count", msg: `svg text 只有 ${snap.texts.length} 个,期望 ≥ ${min}` });
  if (snap.uniTextInSvg > 0) hits.push({ tag: "uni-text-in-svg", msg: `页面里有 ${snap.uniTextInSvg} 个 <svg> 内的 <uni-text>(P-121 原形:0×0 不渲染)` });
  snap.texts.forEach((t, i) => {
    const label = `#${i + 1}[${t.text.slice(0, 24)}]`;
    if (!t.text) hits.push({ tag: "empty", msg: `${label} 文本为空` });
    if (!(t.w > 0 && t.h > 0)) hits.push({ tag: "rendered", msg: `${label} bbox ${t.w.toFixed(1)}×${t.h.toFixed(1)} —— 没排版出来` });
    if (t.svg && t.w > 0 && (t.left < t.svg.left - tol || t.right > t.svg.right + tol || t.top < t.svg.top - tol || t.bottom > t.svg.bottom + tol)) {
      hits.push({ tag: "inside", msg: `${label} 画到了所属 svg 视口之外(会被裁掉)` });
    }
    if (t.fontSizeAttr != null && /^[0-9.]+(px)?$/.test(t.fontSizeAttr.trim())) {
      const want = parseFloat(t.fontSizeAttr), got = parseFloat(t.fontSizeComputed);
      if (!(Math.abs(want - got) < 0.01)) hits.push({ tag: "font-size-hijacked", msg: `${label} font-size 属性 ${t.fontSizeAttr} 但计算值 ${t.fontSizeComputed}(有 CSS 规则劫持了它 —— attributify?)` });
    }
  });
  return hits;
}

// ── selftest(合成页面,不需要 dev server)─────────────────────────────────────
async function selftest() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
  const html = (body, head = "") => `<!doctype html><html><head><meta charset="utf-8">${head}</head><body style="margin:0;background:#111">${body}</body></html>`;
  const SVG = (inner, attrs = 'viewBox="0 0 200 60" width="200" height="60"') => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`;
  const T = (inner, attrs = 'x="100" y="35" text-anchor="middle" font-size="18" fill="#c6ff3a"') => `<text ${attrs}>${inner}</text>`;
  const cases = [
    // [name, html, min, tag, expectedHits]
    ["合法:真 SVG text 渲染", html(SVG(T("YOU"))), 1, "*", 0],
    ["🔴 <uni-text> 塞在 svg 里(P-121 原形):uni-text-in-svg 红", html(SVG('<uni-text x="1" y="2">YOU</uni-text>')), 0, "uni-text-in-svg", 1],
    ["🔴 同上也算 count 不足(它不是 svg text)", html(SVG('<uni-text x="1" y="2">YOU</uni-text>')), 1, "count", 1],
    ["🔴 字号被 CSS 劫持([font-size~=\"18\"]{font-size:72px}):font-size-hijacked 红", html(SVG(T("BIG")), '<style>[font-size~="18"]{font-size:72px}</style>'), 1, "font-size-hijacked", 1],
    ["合法:字号没被劫持 → 0", html(SVG(T("OK"))), 1, "font-size-hijacked", 0],
    ["合法:字号写在 style 里(没有属性)不判劫持", html(SVG(T("OK", 'x="100" y="35" style="font-size:18px" fill="#c6ff3a"'))), 1, "font-size-hijacked", 0],
    ["🔴 空文本:empty 红", html(SVG(T(""))), 1, "empty", 1],
    ["🔴 空文本同时 rendered 红(0×0)", html(SVG(T(""))), 1, "rendered", 1],
    ["🔴 svg display:none:rendered 红(结构在、没排版)", html(SVG(T("HID"), 'viewBox="0 0 200 60" width="200" height="60" style="display:none"')), 1, "rendered", 1],
    ["🔴 文字画到视口外(x=-500):inside 红", html(SVG(T("OUT", 'x="-500" y="35" font-size="18" fill="#c6ff3a"'))), 1, "inside", 1],
    ["合法:文字贴边但在视口内 → inside 0", html(SVG(T("EDGE", 'x="4" y="40" font-size="12" fill="#c6ff3a"'))), 1, "inside", 0],
    ["🔴 数量不足(1 < 3):count 红", html(SVG(T("ONE"))), 3, "count", 1],
    ["合法:v-for 式多于期望(3 ≥ 1)不算错", html(SVG(T("A") + T("B", 'x="50" y="35" font-size="18"') + T("C", 'x="150" y="35" font-size="18"'))), 1, "count", 0],
    ["🔴 两个 svg,第二个里的 text 0×0(font-size 0):rendered 红 1", html(SVG(T("A")) + SVG(T("Z", 'x="100" y="35" font-size="0"'))), 2, "rendered", 1],
  ];
  let pass = 0, fail = 0;
  const say = (ok, name, got, want) => { if (ok) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} —— 期望 ${want} 命中,实得 ${got}`); } };
  for (const [name, doc, min, tag, want] of cases) {
    await page.setContent(doc, { waitUntil: "load" });
    const snap = await page.evaluate(snapshotScript());
    const hits = judgeSnapshot(snap, min);
    const got = tag === "*" ? hits.length : hits.filter((h) => h.tag === tag).length;
    say(got === want, name, got, want);
  }
  // 完整性轴(纯函数)
  const reg1 = judgeRegistry({ "src/pages/x/new-diagram.vue": 2 }, ROUTE_MAP);
  say(reg1.length === 1 && reg1[0].tag === "unregistered", "🔴 新文件有 <SvgText> 但 ROUTE_MAP 没登记 → unregistered 红", reg1.length, 1);
  const reg2 = judgeRegistry({ "src/pages/team/network.vue": 4 }, ROUTE_MAP);
  say(reg2.length === 0, "合法:已登记文件 → 0", reg2.length, 0);
  // 判定面自证:真仓里含 SvgText 的文件 ≥ 1 且全部登记(0 文件 = 判定面塌缩)
  const files = await svgTextFiles();
  say(Object.keys(files).length >= 1, "判定面:仓内至少 1 个含 <SvgText> 的文件(0 = 门瞎了)", Object.keys(files).length, "≥1");
  say(judgeRegistry(files).length === 0, "判定面:仓内含 <SvgText> 的文件全部已登记路由", judgeRegistry(files).length, 0);
  await browser.close();
  console.log(`svg-text-render-probe selftest: ${pass}/${pass + fail} 格通过`);
  process.exit(fail ? 1 : 0);
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const files = await svgTextFiles();
  const regHits = judgeRegistry(files);
  let fail = 0;
  for (const h of regHits) { fail++; console.log(`FAIL [${h.tag}] ${h.msg}`); }
  if (Object.keys(files).length === 0) { console.log("FAIL [judged-plane] 仓内一个含 <SvgText> 的文件都没有 —— 判定面塌缩(本有 4 文件)"); process.exit(1); }
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 414, height: 896 }, locale: "en-US" });
  // 语言在 app 启动前注入(uni 存储壳格式;写完再换 hash 是 no-op,store 只 hydrate 一次)
  await context.addInitScript((code) => {
    try { localStorage.setItem("nexgrid-locale-v1", JSON.stringify({ type: "object", data: { code, userSet: true } })); } catch {}
  }, LANG);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/favicon/i.test(m.text()) && !isThirdPartyResourceError(m.text(), m.location?.().url, BASE)) consoleErrors.push(m.text().slice(0, 100)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror ${String(e).slice(0, 100)}`));
  let routes = 0, texts = 0;
  for (const [file, cfg] of Object.entries(ROUTE_MAP)) {
    if (!files[file]) { console.log(`WARN ${file} 已不含 <SvgText>(ROUTE_MAP 里的登记可以删了)`); continue; }
    const min = cfg.min ?? files[file];
    const [p, q] = cfg.route.split("?");
    consoleErrors.length = 0;
    await page.goto(`${BASE}/?nx_device=off#/${p}${q ? "?" + q : ""}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2200);
    const snap = await page.evaluate(snapshotScript());
    const hits = judgeSnapshot(snap, min);
    if (consoleErrors.length) hits.push({ tag: "console", msg: `console error ${consoleErrors.length}:${consoleErrors[0]}` });
    routes++; texts += snap.texts.length;
    if (hits.length) { fail += hits.length; console.log(`FAIL ${cfg.route}(${file})`); for (const h of hits) console.log(`  [${h.tag}] ${h.msg}`); }
    else console.log(`PASS ${cfg.route}  svg text ${snap.texts.length}(≥${min})· 全部 bbox>0 · 字号未被劫持 · uni-text 0 · console 0 —— ${snap.texts.map((t) => t.text).join(" / ")}`);
  }
  await browser.close();
  if (fail) { console.log(`svg-text-render-probe: ${fail} 条不通过(lang=${LANG})`); process.exit(1); }
  console.log(`svg-text-render-probe: ${routes} 路由 ${texts} 个 SVG 文字全部真渲染(lang=${LANG};bbox>0 · 视口内 · 字号=属性 · svg 内 uni-text 0 · console 0)`);
}

if (argv.includes("--selftest")) selftest();
else main();
