// SVG 内文字的**发现谓词**(P-121 两道门共用一份 —— 源码门与运行时门若各写一份,源码门的每个盲区同时就是
// 运行时门的盲区(独立审计 A1 P1-2:两道门不是两层,是同一条谓词的两份拷贝)。所以抽到这里,谁改都得一起改。
//
// 提供:
//   svgSpans(tpl)            带深度的 <svg> 跨度扫描(嵌套 svg 算外层一整段;自闭合 <svg …/> 不开跨度;属性值里的 </svg> 不算)
//   foreignObjectIslands(tpl) <foreignObject> 岛(里面是 HTML 内容,uni 组件在那里是合法的)
//   svgTextLocalNames(src)    import 自 components/svg-text 的**本地名**(别名 import 也算,A1 P1-3)
//   labelCandidateRegex(names) 匹配 <SvgText / <svg-text / 别名 / <text 的开标签(大小写不敏感)
//   analyzeTemplate(src)      一次算齐:spans · islands · svgTextNodes · labelCandidates(svg 内任何可能是文字的写法)
//
// 输入约定:tpl / src 都是**注释已剥、script/style 已抹白**的等长串(见 sfc-strip-comments.mjs),下标 1:1 对回原文。
import { stripComments, templateRegion } from "./sfc-strip-comments.mjs";

export const SVGTEXT_IMPORT_TAIL = "components/svg-text";

/** 带深度的 <svg>…</svg> 跨度。返回 [[start,end)] —— end 指向最外层 </svg> 的起点。 */
export function svgSpans(tpl) {
  const spans = [];
  const unclosed = [];
  // 逐标签扫描(不是全文正则):每遇到一个标签就引号感知地跳到它的 '>',属性值里的 `</svg>` / `<svg` 字样不会被当成标签。
  const reTag = /<\/?[A-Za-z][\w:-]*/g;
  let m, depth = 0, start = -1;
  while ((m = reTag.exec(tpl))) {
    const name = m[0].replace(/^<\/?/, "").toLowerCase();
    const closing = m[0][1] === "/";
    const end = tagEnd(tpl, m.index);
    if (name === "svg") {
      if (closing) {
        if (depth > 0) { depth--; if (depth === 0) { spans.push([start, m.index]); start = -1; } }
      } else if (!(end > 0 && tpl[end - 1] === "/")) { // 自闭合 <svg …/> 不开跨度
        if (depth === 0) start = m.index;
        depth++;
      }
    }
    if (end > 0) reTag.lastIndex = end + 1;
  }
  if (depth > 0 && start >= 0) unclosed.push(start);
  return { spans, unclosed };
}

/** 从 `<` 开始找该开标签的 `>` 下标(引号感知,属性值里的 > / </svg> 不算)。找不到返回 -1。 */
export function tagEnd(s, from) {
  let q = null;
  for (let i = from + 1; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; continue; }
    if (ch === ">") return i;
  }
  return -1;
}

/** <foreignObject> 岛:[[start,end)]。 */
export function foreignObjectIslands(tpl) {
  const out = [];
  const re = /<foreignObject(?=[\s>\/])[\s\S]*?<\/foreignObject\s*>/gi;
  let m;
  while ((m = re.exec(tpl))) out.push([m.index, m.index + m[0].length]);
  return out;
}

/** 本文件里 import 自 components/svg-text 的本地标识符(默认导出的任何别名)。 */
export function svgTextLocalNames(cleanSrc) {
  const names = new Set();
  const re = new RegExp(`import\\s+([A-Za-z_$][\\w$]*)\\s+from\\s+["'][^"']*${SVGTEXT_IMPORT_TAIL}(?:\\.ts)?["']`, "g");
  let m;
  while ((m = re.exec(cleanSrc))) names.add(m[1]);
  return [...names];
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/** 匹配「SvgText 用法」开标签:<SvgText / <svg-text / 别名(Pascal 与 kebab)。大小写不敏感。 */
export function svgTextTagRegex(localNames = []) {
  const alts = new Set(["SvgText", "svg-text"]);
  for (const n of localNames) { alts.add(n); alts.add(kebab(n)); }
  return new RegExp(`<(${[...alts].map(escapeRe).join("|")})(?=[\\s>\\/])`, "gi");
}

/** 一次算齐模板事实。src = 原文;返回下标都对原文。 */
export function analyzeTemplate(src) {
  const clean = stripComments(src, true);           // 注释 → 等长空白
  const tpl = templateRegion(clean);                // script/style → 等长空白
  const { spans, unclosed } = svgSpans(tpl);
  const islands = foreignObjectIslands(tpl);
  const inSpan = (i) => spans.some(([a, b]) => i >= a && i < b);
  const inIsland = (i) => islands.some(([a, b]) => i >= a && i < b);
  const localNames = svgTextLocalNames(clean);
  const svgTextRe = svgTextTagRegex(localNames);
  const svgTextNodes = [], svgTextOutside = [];
  let m;
  while ((m = svgTextRe.exec(tpl))) (inSpan(m.index) ? svgTextNodes : svgTextOutside).push({ index: m.index, tag: m[1] });
  // svg 内「可能是文字」的其它写法(运行时门据此要求登记路由,而不是只认 <SvgText>)
  const otherLabelCandidates = [];
  const reOther = /<text(?=[\s>\/])|<component(?=[\s>\/])|v-html\s*=/gi;
  while ((m = reOther.exec(tpl))) if (inSpan(m.index) && !inIsland(m.index)) otherLabelCandidates.push({ index: m.index, tag: m[0] });
  return { clean, tpl, spans, unclosed, islands, inSpan, inIsland, localNames, svgTextNodes, svgTextOutside, otherLabelCandidates };
}

/** 判定面上的 .vue 文件清单(src/**),供两道门共用 —— 一处改目录两门同变。 */
export function listVueFiles(fs, path, root) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".vue")) out.push(p);
    }
  };
  walk(path.join(root, "src"));
  return out;
}
