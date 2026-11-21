#!/usr/bin/env node
// SVG 内文字源码门(P-121,2026-08-17;A1 独立审计后加固)—— 守「`<svg>` 里不许出现会被 uni 编译成 HTML 元素的组件标签」。
//
// 为什么要这道门:模板里的 `<text>` 是 uni 的文本组件,写在 `<svg>` 里会编成自定义元素 `<uni-text>`,
// 它不是合法 SVG 子元素,浏览器不排版 —— 不报错、不留痕、i18n 三道门全绿,用户看到的是没有标注的示意图
// (实测 `svg uni-text` 6 个,`getBoundingClientRect()` 全 0×0)。这个缺陷的全部危险性在于**源码看起来完全正常**,
// 所以源码面必须有人守;渲染面另有 `scripts/svg-text-render-probe.mjs`(运行时 bbox > 0 · 可见 · 属性未被劫持)兜第二道。
// 发现谓词(svg 跨度 / SvgText 用法 / 别名 import / foreignObject 岛)在 `scripts/lib/svg-text-predicate.mjs`,两道门共用一份。
//
// 判据(每条带 tag,红测按 tag 计数,不按行号 —— 行号会随编辑漂):
//   [svg-text]          `<svg>…</svg>` 之内(注释已剥;<foreignObject> 岛除外;嵌套 svg 按最外层整段算)出现 `<text` / `<Text`
//                       (大小写不敏感;`<textPath` 不算)→ 红。正确写法 `<SvgText …>…</SvgText>`(src/components/svg-text.ts)。
//   [svg-uni-tag]       同族:svg 内(岛外)出现 uni 的其它内置组件标签(view / image / switch / button / navigator / input …)→ 红。
//                       它们编出来都是 HTML 元素,放进 SVG 一样不画;修一处≠修全部,整族一起守。要在 SVG 里放 HTML 请包
//                       `<foreignObject>`;要 SVG 图片请照 SvgText 的路子先做 SvgImage 并把这里的名单一并改。
//   [svgtext-outside]   `<SvgText` / `<svg-text` / 别名 出现在 `<svg>` 之外 → 红(HTML 里它是未知元素)。把带标注的子图抽成
//                       子组件是合法写法(命名空间由父级 svg 继承),这种文件在该标签**前面的注释里**(同一行或上一行,必须真在注释里,
//                       写进文本 / 属性不算)写 `svg-text-outside-ok: <理由>` 放行,一条注释只放行**紧随其后的一个**标签,豁免会打印出来供 review(A2 P2-1)。
//   [svgtext-import]    模板用了 `<SvgText` / `<svg-text` 却没 import `@/components/svg-text` → 红。没导入时 Vue 只警告一句然后按
//                       元素名建 `<svg-text>`,在 SVG 命名空间下 0×0(A1 P0-1 实测),vue-tsc 不报错。别名 import 也认。
//   [svgtext-unused]    import 了 components/svg-text(任何认得出的形态)却在模板里一个用法都没扫到 → 红:要么是死 import,要么是本门认不出的
//                       新写法整族隐形(A2 P1-2 的防线;`<component :is>` 用法不算未用)。
//   [svg-unclosed]      `<svg` 没闭合 → 红(自闭合 `<svg …/>` 合法,不算)。
//   [attributify]       uno.config.ts 启用了 UnoCSS presetAttributify 且不是 prefixedOnly:true → 红。它把 SVG 呈现属性
//                       (`font-size="9.5"` → 2.375rem 字大 4 倍;`:opacity="0.25"` → 0.0025 全球节点图 669 个点隐形)当工具类;
//                       ignoreAttributes 只挡裸属性、挡不住绑定式(提取器先查表后剥 `:`),所以「加豁免」不算修(A1 P0-2)。
//   [judged-plane]      全仓一个 `<svg>` 块都扫不到 → 判定面塌缩,红。
//
// 边界(如实):只判 .vue 的 <template> 区域;`v-html` 字符串里拼的 `<text>`(lucky-spin 转盘先例)在 script 面,不判 —— 运行时
// 它是真 SVG text;`<component :is="'text'">` 也不判(H5 实测能出真 text)—— 但含这两种写法的 svg 文件同样会被运行时门要求登记路由。
//
// 用法:node scripts/svg-text-source-gate.mjs           扫全仓
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeTemplate, listVueFiles, SVGTEXT_IMPORT_TAIL } from "./lib/svg-text-predicate.mjs";
import { stripComments } from "./lib/sfc-strip-comments.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// uni 内置组件标签(与 @dcloudio/uni-shared BUILT_IN_TAGS 同源,去掉 text —— 它有专门的判据与提示语)。
export const UNI_BUILTIN_TAGS = ["view", "image", "button", "input", "textarea", "navigator", "scroll-view", "swiper", "swiper-item", "icon", "progress", "rich-text", "picker", "picker-view", "picker-view-column", "label", "form", "checkbox", "checkbox-group", "radio", "radio-group", "switch", "slider", "canvas", "video", "map", "web-view", "cover-view", "cover-image", "movable-area", "movable-view", "editor", "live-player", "live-pusher", "ad", "camera", "audio", "match-media", "page-container"];

/** 单文件判据。纯函数,红测直接喂字符串。 */
export function judgeVue(src, relFile = "<mem>") {
  const hits = [];
  const t = analyzeTemplate(src);
  const lineOf = (i) => src.slice(0, i).split(/\r?\n/).length;
  const lineText = (n) => src.split(/\r?\n/)[n - 1] ?? "";
  for (const i of t.unclosed) hits.push({ tag: "svg-unclosed", line: lineOf(i), msg: "<svg 没有闭合" });
  // [svg-text]
  const reText = /<text(?=[\s>\/])/gi;
  let m;
  while ((m = reText.exec(t.tpl))) {
    if (t.judged(m.index)) hits.push({ tag: "svg-text", line: lineOf(m.index), msg: "<svg> 里写了 <text>(会编成 <uni-text>,0×0 不渲染)—— 改用 <SvgText>(src/components/svg-text.ts)" });
  }
  // [svg-uni-tag]
  const reUni = new RegExp(`<(${UNI_BUILTIN_TAGS.join("|")})(?=[\\s>\\/])`, "gi");
  while ((m = reUni.exec(t.tpl))) {
    if (t.judged(m.index)) hits.push({ tag: "svg-uni-tag", line: lineOf(m.index), msg: `<svg> 里写了 uni 内置组件 <${m[1].toLowerCase()}>(编成 HTML 元素,SVG 不画)—— HTML 内容包 <foreignObject>;SVG 图片照 SvgText 的路子做 SvgImage` });
  }
  // [svgtext-outside](注释里的 svg-text-outside-ok: 放行,一条注释只放行紧随其后的一个标签 —— A2 P2-1)
  const exempt = [];
  // 标记必须真在注释里:原文有字而剥注释后是空白的位置 = 注释区(文本 / 属性字符串里写的不算)
  const markers = [];
  const reMark = /svg-text-outside-ok:\s*([^\r\n]*)/g;
  while ((m = reMark.exec(src))) {
    if (t.clean[m.index] === " " && src[m.index] !== " ") markers.push({ index: m.index, why: m[1].replace(/-->.*$/, "").replace(/\*\/.*$/, "").trim(), used: false });
  }
  for (const o of t.svgTextOutside) {
    const ln = lineOf(o.index);
    const mk = markers.find((k) => !k.used && k.index < o.index && lineOf(k.index) >= ln - 1);
    if (mk) { mk.used = true; exempt.push({ line: ln, why: mk.why }); }
    else hits.push({ tag: "svgtext-outside", line: ln, msg: `<${o.tag}> 写在 <svg> 之外(HTML 里它是未知元素,不是 uni 文本组件)—— 用 <text>;确是抽出来的子图组件就在它前面(同行/上一行)的注释里写 svg-text-outside-ok: 理由` });
  }
  // [svgtext-import]
  if (t.svgTextNodes.length + t.svgTextOutside.length > 0 && t.localNames.length === 0) {
    hits.push({ tag: "svgtext-import", line: lineOf(t.svgTextNodes[0]?.index ?? t.svgTextOutside[0].index), msg: `模板用了 <SvgText>/<svg-text> 但没有 import SvgText from "@/${SVGTEXT_IMPORT_TAIL}"(未解析的组件会按元素名建 <svg-text>,SVG 命名空间下 0×0)` });
  }
  // [svgtext-unused]
  if (t.importedButUnused) hits.push({ tag: "svgtext-unused", line: 1, msg: "import 了 components/svg-text 却在模板里一个 <SvgText>/别名 用法都没扫到 —— 要么是死 import,要么是本门认不出的写法(整族会同时逃出两道门);删掉 import 或改回 <SvgText …>" });
  return { hits, exempt, svgSpans: t.spans.length, svgTextNodes: t.svgTextNodes.length, localNames: t.localNames, file: relFile };
}

/** uno.config 判据:attributify 要么不启用、要么 prefixedOnly:true;ignore-list 不算修。 */
export function judgeUnoConfig(rawText) {
  const hits = [];
  const text = stripComments(rawText, false); // 注释里提到 presetAttributify(比如说明为什么摘掉它)不算启用
  if (!/presetAttributify\s*\(/.test(text)) return { hits, mode: "attributify-off" };
  const call = text.slice(text.indexOf("presetAttributify"));
  if (/prefixedOnly\s*:\s*true/.test(call.slice(0, 800))) return { hits, mode: "prefixed-only" };
  hits.push({ tag: "attributify", line: 1, msg: "uno.config.ts 启用了 presetAttributify 且不是 prefixedOnly:true —— 它会把 SVG 呈现属性(font-size / opacity / fill-opacity …)当工具类改写,ignoreAttributes 挡不住绑定式(:opacity)。全仓没有属性式工具类用法,请摘掉这个 preset(P-123)" });
  return { hits, mode: /ignoreAttributes/.test(call) ? "ignore-list(不够)" : "default(不够)" };
}

/** 全仓判决(纯函数;输入 = 文件清单 + uno.config 文本,红测可喂假清单)。 */
export function judgeRepo(files, unoText) {
  const all = [], exempts = [];
  let spans = 0, nodes = 0, sites = 0;
  for (const { rel, src } of files) {
    const r = judgeVue(src, rel);
    spans += r.svgSpans; nodes += r.svgTextNodes; if (r.svgTextNodes) sites++;
    for (const h of r.hits) all.push({ ...h, file: rel });
    for (const e of r.exempt) exempts.push({ ...e, file: rel });
  }
  const uno = judgeUnoConfig(unoText);
  for (const h of uno.hits) all.push({ ...h, file: "uno.config.ts" });
  if (spans === 0) all.push({ tag: "judged-plane", file: "src/**", line: 0, msg: "全仓一个 <svg> 块都没扫到 —— 判定面塌缩(仓内本有几百处内联 SVG)" });
  return { hits: all, exempts, spans, nodes, sites, unoMode: uno.mode };
}

// ── main ─────────────────────────────────────────────────────────────────────
const files = listVueFiles(fs, path, ROOT).map((p) => ({ rel: path.relative(ROOT, p).replace(/\\/g, "/"), src: fs.readFileSync(p, "utf8") }));
const unoText = fs.existsSync(path.join(ROOT, "uno.config.ts")) ? fs.readFileSync(path.join(ROOT, "uno.config.ts"), "utf8") : "";
const r = judgeRepo(files, unoText);
for (const e of r.exempts) console.log(`EXEMPT [svgtext-outside] ${e.file}:${e.line}  ${e.why}`);
if (r.hits.length) {
  for (const h of r.hits) console.log(`FAIL [${h.tag}] ${h.file}:${h.line}  ${h.msg}`);
  console.log(`svg-text-source-gate: ${r.hits.length} 处违规(svg 块 ${r.spans} · SvgText ${r.nodes} 处 / ${r.sites} 文件 · attributify=${r.unoMode})`);
  process.exit(1);
}
console.log(`svg-text-source-gate: 0 违规 —— 扫 ${files.length} 个 .vue,<svg> 块 ${r.spans},SvgText ${r.nodes} 处 / ${r.sites} 文件,attributify=${r.unoMode},svg 外豁免 ${r.exempts.length} 处`);
