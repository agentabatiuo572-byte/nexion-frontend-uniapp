#!/usr/bin/env node
// SVG 内文字源码门(P-121,2026-08-17)—— 守「`<svg>` 里不许出现会被 uni 编译成 `<uni-text>` 的 `<text>`」。
//
// 为什么要这道门:模板里的 `<text>` 是 uni 的文本组件,写在 `<svg>` 里会编成自定义元素 `<uni-text>`,
// 它不是合法 SVG 子元素,浏览器不排版 —— 不报错、不留痕、i18n 三道门全绿,用户看到的是没有标注的示意图
// (实测 `svg uni-text` 6 个,`getBoundingClientRect()` 全 0×0)。这个缺陷的全部危险性在于**源码看起来完全正常**,
// 所以源码面必须有人守;渲染面另有 `scripts/svg-text-render-probe.mjs`(运行时 bbox > 0)兜第二道。
//
// 判据(每条带 tag,红测按 tag 计数,不按行号 —— 行号会随编辑漂):
//   [svg-text]          模板 `<svg>…</svg>` 之内(注释已剥)出现 `<text` / `<Text`(大小写不敏感;`<textPath` 不算)→ 红。
//                       正确写法是 `<SvgText …>…</SvgText>`(src/components/svg-text.ts,渲染函数直出真 SVG text)。
//   [svgtext-outside]   `<SvgText` 出现在 `<svg>` 之外 → 红(它在 HTML 里是个未知元素,不是 uni 文本组件)。
//   [svgtext-import]    模板用了 `<SvgText` 的文件,`<script>` 必须 import `@/components/svg-text` —— 没导入时 Vue 只是
//                       警告一句然后按元素名建 `<SvgText>`,又变回不渲染;vue-tsc 对未知组件不报错。
//   [attributify-exempt] uno.config.ts:UnoCSS presetAttributify 会把 SVG 的 `font-size="9.5"` 扫成
//                       `[font-size~="9.5"]{font-size:2.375rem}`(实测放大 4 倍)。启用了 attributify 就必须
//                       `ignoreAttributes` 含 font-size 与 fill-opacity(或 prefixedOnly:true / 不启用)。
//   [judged-plane]      全仓一个 `<svg>` 块都扫不到、或一个 `<SvgText` 都没有 → 判定面塌缩,红
//                       (仓内实有 4 文件 13 处;0 命中不是「干净」,是门瞎了)。
//
// 边界(如实):只判 .vue 的 <template> 区域;`v-html` 字符串里拼的 `<text>`(lucky-spin 转盘先例)在 script 面,
// 不判 —— 那种写法运行时是真 SVG text,不属本缺陷;`<component :is="'text'">` 也不判(H5 实测能出真 text,
// 但依赖 uni 不注册全局 text 组件,运行时门兜底)。
//
// 用法:node scripts/svg-text-source-gate.mjs           扫全仓
//       node scripts/svg-text-source-gate.mjs --selftest 红测(每条判据单独隔离:阳性必中 + 合法必放行)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments, templateRegion } from "./lib/sfc-strip-comments.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const SVGTEXT_IMPORT = "components/svg-text";

/** 单文件判据。返回 { hits:[{tag,line,msg}], svgSpans, svgTextNodes } —— 纯函数,红测直接喂字符串。 */
export function judgeVue(src, relFile = "<mem>") {
  const hits = [];
  const clean = stripComments(src, true);
  // templateRegion 把 <script>/<style> 顶层块抹成等长空白 —— 与 stripComments 一样不改长度,下标 1:1 对回原文
  const tpl = templateRegion(clean);
  const tFrom = 0;
  const lineOf = (absIdx) => src.slice(0, absIdx).split(/\r?\n/).length;
  // svg 跨度(注释已剥,不会被注释里的 `<svg>` 字样带偏)
  const spans = [];
  let i = 0;
  while (true) {
    const a = tpl.indexOf("<svg", i);
    if (a < 0) break;
    const b = tpl.indexOf("</svg>", a);
    if (b < 0) { hits.push({ tag: "svg-unclosed", line: lineOf(tFrom + a), msg: "<svg 没有闭合" }); break; }
    spans.push([a, b]);
    i = b + 6;
  }
  const inSpan = (idx) => spans.some(([a, b]) => idx >= a && idx < b);
  // [svg-text]
  const reText = /<text(?=[\s/>])/gi;
  let m;
  while ((m = reText.exec(tpl))) {
    if (inSpan(m.index)) hits.push({ tag: "svg-text", line: lineOf(tFrom + m.index), msg: "<svg> 里写了 <text>(会编成 <uni-text>,0×0 不渲染)—— 改用 <SvgText>(src/components/svg-text.ts)" });
  }
  // [svgtext-outside] + 计数
  const reSvgText = /<SvgText(?=[\s/>])/g;
  let svgTextNodes = 0;
  while ((m = reSvgText.exec(tpl))) {
    if (inSpan(m.index)) svgTextNodes++;
    else hits.push({ tag: "svgtext-outside", line: lineOf(tFrom + m.index), msg: "<SvgText> 写在 <svg> 之外(HTML 里它是未知元素,不是 uni 文本组件)—— 用 <text>" });
  }
  // [svgtext-import]
  if (svgTextNodes > 0 && !new RegExp(`import\\s+SvgText\\s+from\\s+["'][^"']*${SVGTEXT_IMPORT}(?:\\.ts)?["']`).test(clean)) {
    hits.push({ tag: "svgtext-import", line: 1, msg: `模板用了 <SvgText> 但没有 import SvgText from "@/${SVGTEXT_IMPORT}"(未解析的组件会按元素名建 <SvgText>,又变回不渲染)` });
  }
  return { hits, svgSpans: spans.length, svgTextNodes, file: relFile };
}

/** uno.config 判据:启用 attributify 就必须豁免 font-size / fill-opacity(或 prefixedOnly:true)。 */
export function judgeUnoConfig(text) {
  const hits = [];
  const uses = /presetAttributify\s*\(/.test(text);
  if (!uses) return { hits, mode: "attributify-off" };
  const call = text.slice(text.indexOf("presetAttributify"));
  if (/prefixedOnly\s*:\s*true/.test(call.slice(0, 600))) return { hits, mode: "prefixed-only" };
  const arr = call.match(/ignoreAttributes\s*:\s*\[([^\]]*)\]/);
  const list = arr ? [...arr[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((x) => x[1]) : [];
  for (const need of ["font-size", "fill-opacity"]) {
    if (!list.includes(need)) hits.push({ tag: "attributify-exempt", line: 1, msg: `uno.config.ts:presetAttributify 的 ignoreAttributes 缺 "${need}"(attributify 会把 SVG 的 ${need}="N" 属性扫成工具类;传了 ignoreAttributes 就整表覆盖,UnoCSS 默认的 placeholder / fill / opacity / stroke-opacity 也要照抄)` });
  }
  return { hits, mode: "ignore-list", list };
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".vue")) acc.push(p);
  }
  return acc;
}

/** 全仓判决(纯函数,输入 = 文件清单 + uno.config 文本,红测可喂假清单)。 */
export function judgeRepo(files, unoText) {
  const all = [];
  let spans = 0, nodes = 0, sites = 0;
  for (const { rel, src } of files) {
    const r = judgeVue(src, rel);
    spans += r.svgSpans; nodes += r.svgTextNodes; if (r.svgTextNodes) sites++;
    for (const h of r.hits) all.push({ ...h, file: rel });
  }
  const uno = judgeUnoConfig(unoText);
  for (const h of uno.hits) all.push({ ...h, file: "uno.config.ts" });
  if (spans === 0) all.push({ tag: "judged-plane", file: "src/**", line: 0, msg: "全仓一个 <svg> 块都没扫到 —— 判定面塌缩(仓内本有几十处内联 SVG)" });
  if (nodes === 0) all.push({ tag: "judged-plane", file: "src/**", line: 0, msg: "全仓一个 <SvgText> 都没有 —— 判定面塌缩(仓内本有 4 文件 13 处 SVG 内文字)" });
  return { hits: all, spans, nodes, sites, unoMode: uno.mode };
}

// ── selftest ─────────────────────────────────────────────────────────────────
function selftest() {
  const IMP = 'import SvgText from "@/components/svg-text";';
  const S = (tpl, script = IMP) => `<template><view>${tpl}</view></template>\n<script setup lang="ts">\n${script}\n</script>\n`;
  const cases = [
    // [name, source, tag, expectedCount]
    ["🔴 svg 里裸 <text>", S('<svg><text x="1">YOU</text></svg>'), "svg-text", 1],
    ["🔴 大写 <Text> 同样拦(XML 大小写敏感,渲染成未知元素)", S("<svg><Text>YOU</Text></svg>"), "svg-text", 1],
    ["🔴 嵌在 <g> 里也拦", S('<svg><g><g><text x="1">A</text></g></g></svg>'), "svg-text", 1],
    ["🔴 跨行开标签(<text\\n x=)也拦", S('<svg><text\n  x="1"\n  y="2">A</text></svg>'), "svg-text", 1],
    ["🔴 一个 svg 里两处各计一次", S("<svg><text>A</text><text>B</text></svg>"), "svg-text", 2],
    ["🔴 第二个 svg 块里的也抓(不只看第一个)", S("<svg><circle /></svg><view><svg><text>Z</text></svg></view>"), "svg-text", 1],
    ["合法:svg 外的 <text> 是 uni 文本组件,不判", S("<text>hello</text><svg><circle /></svg>"), "svg-text", 0],
    ["合法:svg 里注释里提到 <text> 不算(注释已剥)", S("<svg><!-- <text>x</text> --><circle /></svg>"), "svg-text", 0],
    ["合法:<textPath> 是别的 SVG 元素", S("<svg><SvgText><textPath href='#p'>x</textPath></SvgText></svg>"), "svg-text", 0],
    ["合法:script 里拼 v-html 字符串的 <text> 不在判定面(lucky-spin 先例)", S('<svg><g v-html="s" /></svg>', `${IMP}\nconst s = '<text x="1">A</text>';`), "svg-text", 0],
    ["合法:<SvgText> 在 svg 内 + 已 import", S('<svg><SvgText x="1">YOU</SvgText></svg>'), "svg-text", 0],
    ["🔴 <SvgText> 写在 svg 外", S("<SvgText>oops</SvgText><svg><circle /></svg>"), "svgtext-outside", 1],
    ["合法:<SvgText> 在 svg 内不算 outside", S("<svg><SvgText>ok</SvgText></svg>"), "svgtext-outside", 0],
    ["🔴 用了 <SvgText> 却没 import", S("<svg><SvgText>x</SvgText></svg>", "const a = 1;"), "svgtext-import", 1],
    ["合法:相对路径 import 也认", S("<svg><SvgText>x</SvgText></svg>", 'import SvgText from "../../components/svg-text";'), "svgtext-import", 0],
    ["合法:没用 <SvgText> 就不要求 import", S("<svg><circle /></svg>", "const a = 1;"), "svgtext-import", 0],
    ["🔴 <svg 没闭合", S("<svg><SvgText>x</SvgText>"), "svg-unclosed", 1],
  ];
  const unoCases = [
    ["合法:ignoreAttributes 含 font-size + fill-opacity", 'presetAttributify({ ignoreAttributes: ["placeholder", "fill", "opacity", "stroke-opacity", "font-size", "fill-opacity"] })', 0],
    ["🔴 缺 font-size", 'presetAttributify({ ignoreAttributes: ["placeholder", "fill", "fill-opacity"] })', 1],
    ["🔴 缺 fill-opacity", 'presetAttributify({ ignoreAttributes: ["font-size"] })', 1],
    ["🔴 裸 presetAttributify()(UnoCSS 默认表没有 font-size)", "presets: [presetWind3(), presetAttributify()]", 2],
    ["合法:prefixedOnly:true(裸属性一律不当工具类)", "presetAttributify({ prefixedOnly: true })", 0],
    ["合法:根本没启用 attributify", "presets: [presetWind3()]", 0],
  ];
  let pass = 0, fail = 0;
  const say = (ok, name, got, want) => { if (ok) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} —— 期望 ${want} 命中,实得 ${got}`); } };
  for (const [name, src, tag, want] of cases) {
    const got = judgeVue(src).hits.filter((h) => h.tag === tag).length;
    say(got === want, name, got, want);
  }
  for (const [name, text, want] of unoCases) {
    const got = judgeUnoConfig(text).hits.length;
    say(got === want, `uno:${name}`, got, want);
  }
  // 行号钉在被判节点那一行(不是文件头)
  const lineSrc = S("<svg>\n  <circle />\n  <text>L</text>\n</svg>");
  const h = judgeVue(lineSrc).hits.find((x) => x.tag === "svg-text");
  say(h && h.line === 3, "命中行号 = <text> 所在行(第 3 行)", h?.line, 3);
  // 判定面塌缩:空清单 / 没有 SvgText 的清单
  const okUno = 'presetAttributify({ ignoreAttributes: ["placeholder","fill","opacity","stroke-opacity","font-size","fill-opacity"] })';
  const empty = judgeRepo([], okUno).hits.filter((x) => x.tag === "judged-plane").length;
  say(empty === 2, "🔴 判定面塌缩:0 文件 → judged-plane 红(svg 块 0 + SvgText 0)", empty, 2);
  const noSvgText = judgeRepo([{ rel: "a.vue", src: S("<svg><circle /></svg>") }], okUno).hits.filter((x) => x.tag === "judged-plane").length;
  say(noSvgText === 1, "🔴 判定面塌缩:有 svg 但全仓 0 个 SvgText → 红", noSvgText, 1);
  const clean = judgeRepo([{ rel: "a.vue", src: S("<svg><SvgText>x</SvgText></svg>") }], okUno).hits.length;
  say(clean === 0, "合法:有 svg + 有 SvgText + uno 豁免在位 → 0 命中", clean, 0);
  console.log(`svg-text-source-gate selftest: ${pass}/${pass + fail} 格通过`);
  process.exit(fail ? 1 : 0);
}

// ── main ─────────────────────────────────────────────────────────────────────
if (process.argv.includes("--selftest")) selftest();
else {
  const files = walk(SRC).map((p) => ({ rel: path.relative(ROOT, p).replace(/\\/g, "/"), src: fs.readFileSync(p, "utf8") }));
  const unoText = fs.existsSync(path.join(ROOT, "uno.config.ts")) ? fs.readFileSync(path.join(ROOT, "uno.config.ts"), "utf8") : "";
  const r = judgeRepo(files, unoText);
  if (r.hits.length) {
    for (const h of r.hits) console.log(`FAIL [${h.tag}] ${h.file}:${h.line}  ${h.msg}`);
    console.log(`svg-text-source-gate: ${r.hits.length} 处违规(svg 块 ${r.spans} · SvgText ${r.nodes} 处 / ${r.sites} 文件 · attributify=${r.unoMode})`);
    process.exit(1);
  }
  console.log(`svg-text-source-gate: 0 违规 —— 扫 ${files.length} 个 .vue,<svg> 块 ${r.spans},SvgText ${r.nodes} 处 / ${r.sites} 文件,attributify=${r.unoMode}(font-size / fill-opacity 已豁免)`);
}
