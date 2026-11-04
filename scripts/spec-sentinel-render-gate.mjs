#!/usr/bin/env node
// 规格哨兵渲染门 —— 服务端的 "no certified value" 哨兵值绝不能被当成 client fallback,
// 也绝不能原样渲染给用户。
//
// 为什么要这道门(2026-08-16,P-109):`product-catalog-contract.ts` 早就写了一句
// 「"unavailable" is a deliberate server truth, never a client fallback」,但那只是**注释**。
// 4c32a50 做服务端权威化改造时,把 detail.vue 的规格兜底从 locale-neutral 的 "—"
// 改成了 `?? "unavailable"` 五处,直接推翻 4111322 那轮 i18n 硬编码清理的成果。
// 中文态实测渲染出「你的手机 unavailable」「质保 unavailable」等 4 处中英混排,
// 半个多月没有任何一道门响 —— 因为既有 i18n 门整条轴是反的:
//   · i18n-hardcoded-cjk-sentinel —— 判「页面里不许出现**中文**」,英文字面量天然免检;
//   · i18n-key-mirror —— 只保证已进词典的 key 三语齐,压根没进词典的字符串无感;
//   · product catalog i18n parity —— 只查每个 SKU 有 catalog 文案,不查**字段值**怎么渲染。
// 三道门都只看「中文有没有跑出词典」,没有一道看「英文有没有跑进界面」。本门补这条轴。
//
// 抗变异:needle 不写死,**从契约源码里现读** —— 常量改名或改值,门自动跟着改,
// 读不到就判红(而不是静默扫不到东西然后报绿)。
//
// 用法:
//   node scripts/spec-sentinel-render-gate.mjs             扫全仓
import fs from "node:fs";
import path from "node:path";

const CONTRACT = "src/api/product-catalog-contract.ts";
const LOCALES = ["en", "zh", "vi"];
const I18N_KEY = "specValueUnavailable";
// 渲染面:商品域的页面与组件。这些文件里哨兵值只该以「import 进来的常量」出现,
// 裸字面量一律是 bug。别的域(network-rank / fx / genesis)拿 "unavailable" 当状态枚举
// 成员用是合法的,所以 Rule B 不扩到全仓。
// Rule B/C 的判定面 = 全部页面与组件。原先只圈 `*/store`,而独立审计实测:同类漏洞完全
// 可能落在圈外(以及圈内但换个写法),把面收窄等于给自己留盲区。别的域(network-rank / fx /
// genesis)拿 "unavailable" 当**状态枚举成员**是合法的 —— 那由 Rule B 只认整串字面量、
// Rule C 只认 `.<字段名>` 属性读取来区分,不靠缩小扫描面来回避。
const RENDER_FACE = ["src/pages", "src/components"];
// Rule B(裸字面量)只圈商品域:别的域(network-rank / fx / genesis / geo)拿 "unavailable"
// 当**状态枚举成员**是合法写法,在全域判它会淹没在误报里。Rule C 靠字段名精确定位,不受此限。
const LITERAL_FACE = ["src/pages/store", "src/components/store"];
// 认可的降级包装函数。两个都住在 src/lib/product-copy.ts,都在同一处消化哨兵值:
//   · specText —— 值位显示,缺失时给本地化占位串(单值展示位没法「隐藏一行」);
//   · specRow  —— 表格行,缺失时整行不出现(空行不携带信息)。
// 🔴 只许收录**集中消化哨兵值的**函数,别把「碰巧包了一层」的函数塞进来 —— 这份名单每多
// 一个,Rule C 的判定面就少一块。改名会让 Rule C 全体判红,改名的人必须同步这里:
// 门宁可吵,不可瞎。
const MAPPERS = ["specText", "specRow"];
// 非展示用途(取数值去算术等)的显式豁免标记,写在该行。默认收紧、例外留痕。
const EXEMPT_MARK = "spec-sentinel-ok";
const SCAN_EXT = /\.(vue|ts)$/;
const SKIP = /\.(test|spec)\.ts$/;

// 抹掉注释内容但**保留行结构** —— 换行留着,其余字符换成空格。行号必须和原文严格对齐,
// 否则报出来的位置是错的(实测:压缩式剥离让报告指向隔壁无关行,读的人会以为门在乱叫)。
const blank = (s) => s.replace(/[^\n]/g, " ");
function stripComments(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:\\])(\/\/[^\n]*)/g, (_m, pre, cmt) => pre + blank(cmt));
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (SCAN_EXT.test(entry.name) && !SKIP.test(entry.name)) out.push(full.replace(/\\/g, "/"));
  }
  return out;
}

/**
 * 从契约源码里现读哨兵的**常量名 + 字面值**;读不到 = 门瞎了 = 判红。
 * 要求**全文有且仅有一个**导出字符串常量:多一个就无从判断该锚哪个,而锚错的失效方式恰好是
 * 「换了个 needle 后扫不到东西然后报绿」—— 宁可在这里吵着判红,要人明确指定。
 */
function readSentinel(contractSrc) {
  const all = [...contractSrc.matchAll(/export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)];
  if (all.length !== 1) return null;
  const [, name, value] = all[0];
  return value ? { name, value } : null;
}

/**
 * 现读「哪些字段可能收到哨兵值」—— 契约里走 displayString() 的那批。同样不手写:
 * 契约新增一个 displayString 字段,门自动开始守它的渲染点。
 */
function readSentinelFields(contractSrc) {
  return [...contractSrc.matchAll(/(\w+):\s*displayString\(/g)].map((m) => m[1]);
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 求每个认可包装函数调用的实参区间(括号配对),用于判「这次字段读取是不是裹在映射里」。 */
function mapperSpans(text) {
  const spans = [];
  const call = new RegExp(`\\b(?:${MAPPERS.map(escape).join("|")})\\s*\\(`, "g");
  for (const m of text.matchAll(call)) {
    let depth = 0;
    for (let i = m.index + m[0].length - 1; i < text.length; i += 1) {
      if (text[i] === "(") depth += 1;
      else if (text[i] === ")") { depth -= 1; if (depth === 0) { spans.push([m.index, i]); break; } }
    }
  }
  return spans;
}

function scanSource(file, src, sentinel, fields = []) {
  const hits = [];
  const clean = stripComments(src);
  const lines = clean.split(/\r?\n/);
  const rawLines = src.split(/\r?\n/);
  // Rule A:?? / || 兜底到哨兵 —— 字面量与常量名两种写法都判(防「改成引用常量」逃逸)。
  const fallback = new RegExp(`(\\?\\?|\\|\\|)\\s*(["']${escape(sentinel.value)}["']|${escape(sentinel.name)})`);
  // Rule B:渲染面里的裸字面量。整串相等才算,`purchaseUnavailable` 这类标识符不误伤。
  const literal = new RegExp(`["']${escape(sentinel.value)}["']`);
  const onRenderFace = RENDER_FACE.some((d) => file.startsWith(`${d}/`));
  const onLiteralFace = LITERAL_FACE.some((d) => file.startsWith(`${d}/`));
  lines.forEach((line, i) => {
    if (fallback.test(line)) { hits.push({ file, line: i + 1, rule: "A", text: line.trim() }); return; }
    if (onLiteralFace && literal.test(line)) hits.push({ file, line: i + 1, rule: "B", text: line.trim() });
  });
  if (!onRenderFace || fields.length === 0) return hits;

  // Rule C:🔴 A/B 都只看得见**写出来的字面量**,而绝大多数漏网形态一个字面量都没有 ——
  // `{ k: s.specGpu, v: p.gpu }`、`{{ product.gpu }}`、`const g = p.gpu` 转手一道再渲染,
  // 三种都逃得掉(前两种实测各漏过一次:自查抓到 detail.vue 的 gpu/vram,独立审计抓到
  // locked-product-card.vue 的模板插值)。所以判据不再猜「哪里是展示位」——**渲染面上任何
  // 一次读取都必须裹在降级映射里**,读了不裹就是违规;确有非展示用途(取数值去算术)在该行
  // 写 `spec-sentinel-ok` 显式豁免。默认收紧、例外留痕,比枚举展示位形态稳。
  const spans = mapperSpans(clean);
  const inMapper = (idx) => spans.some(([a, b]) => idx > a && idx < b);
  const lineOf = (idx) => clean.slice(0, idx).split(/\r?\n/).length;
  for (const f of fields) {
    for (const m of clean.matchAll(new RegExp(`\\.\\s*${escape(f)}\\b`, "g"))) {
      if (inMapper(m.index)) continue;
      const ln = lineOf(m.index);
      // 标记写在本行或紧邻上一行都认(模板里同行塞注释很难看,沿用 eslint-disable-next-line 的习惯)。
      if (`${rawLines[ln - 2] ?? ""}\n${rawLines[ln - 1] ?? ""}`.includes(EXEMPT_MARK)) continue;
      hits.push({ file, line: ln, rule: "C", text: (rawLines[ln - 1] ?? "").trim(), field: f });
    }
  }
  return hits;
}

function run() {
  if (!fs.existsSync(CONTRACT)) {
    console.error(`FAIL 契约文件不在:${CONTRACT} —— 门失去判据来源,不是「没有违规」`);
    return 1;
  }
  const contractSrc = fs.readFileSync(CONTRACT, "utf8");
  const sentinel = readSentinel(contractSrc);
  if (!sentinel) {
    console.error(`FAIL ${CONTRACT} 里读不到 \`export const X = "..."\` 哨兵常量 —— 门瞎了,不是「没有违规」`);
    return 1;
  }
  const fields = readSentinelFields(contractSrc);
  if (fields.length === 0) {
    console.error(`FAIL ${CONTRACT} 里一个 displayString 字段都没解析到 —— Rule C 恒真,门瞎了`);
    return 1;
  }

  const files = walk("src");
  if (files.length === 0) {
    console.error("FAIL 扫描面为空 —— 0 个文件被判定,任何「0 违规」都不成立");
    return 1;
  }
  const renderFiles = files.filter((f) => RENDER_FACE.some((d) => f.startsWith(`${d}/`)));
  if (renderFiles.length === 0) {
    console.error(`FAIL 渲染面为空(${RENDER_FACE.join(" / ")} 都没扫到文件)—— Rule B 恒真`);
    return 1;
  }

  // 降级文案本身必须三语齐备且非空:key 被删光时三语镜像门是全绿的(它只查两两一致),
  // 而页面会渲染 undefined —— 那正是本门要防的「哨兵值直达界面」的另一种形态。
  const missing = [];
  for (const loc of LOCALES) {
    const file = `src/i18n/messages/${loc}.ts`;
    const m = fs.readFileSync(file, "utf8").match(new RegExp(`${I18N_KEY}:\\s*"([^"]*)"`));
    if (!m || !m[1].trim()) missing.push(loc);
  }
  if (missing.length) {
    console.error(`FAIL 降级文案 store.${I18N_KEY} 在 ${missing.join(" / ")} 缺失或为空 —— 页面会渲染 undefined`);
    return 1;
  }

  const hits = files.flatMap((f) => scanSource(f, fs.readFileSync(f, "utf8"), sentinel, fields));
  if (hits.length) {
    console.error(`FAIL 哨兵值 "${sentinel.value}" 有 ${hits.length} 处会原样到达界面:`);
    for (const h of hits) console.error(`  [${h.rule}] ${h.file}:${h.line}${h.field ? ` (${h.field})` : ""}  ${h.text}`);
    console.error(`  改法:展示取值一律裹 ${MAPPERS.map((m) => `${m}()`).join(" 或 ")};判定用 import 进来的 ${sentinel.name}`);
    return 1;
  }
  console.log(
    `spec 哨兵渲染门 PASS:哨兵 ${sentinel.name}="${sentinel.value}" + ${fields.length} 个 displayString 字段(均现读自契约),`
    + `扫 ${files.length} 文件 / 渲染面 ${renderFiles.length} 文件,0 处兜底(A) + 0 处裸字面量(B) + 0 处未裹降级的展示取值(C),降级文案三语齐`,
  );
  return 0;
}

process.exit(run());
