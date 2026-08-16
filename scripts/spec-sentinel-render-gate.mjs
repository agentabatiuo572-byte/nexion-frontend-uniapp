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
//   node scripts/spec-sentinel-render-gate.mjs --selftest   红测(判据自证有效)
import fs from "node:fs";
import path from "node:path";

const CONTRACT = "src/api/product-catalog-contract.ts";
const LOCALES = ["en", "zh", "vi"];
const I18N_KEY = "specValueUnavailable";
// 渲染面:商品域的页面与组件。这些文件里哨兵值只该以「import 进来的常量」出现,
// 裸字面量一律是 bug。别的域(network-rank / fx / genesis)拿 "unavailable" 当状态枚举
// 成员用是合法的,所以 Rule B 不扩到全仓。
const RENDER_FACE = ["src/pages/store", "src/components/store"];
// 降级映射的函数名。Rule C 认它;改名会让 Rule C 全体判红,改名的人必须同步这里 —— 比
// 「悄悄失效」好:门宁可吵,不可瞎。
const MAPPER = "specText";
const SCAN_EXT = /\.(vue|ts)$/;
const SKIP = /\.(test|spec)\.ts$/;

function stripComments(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");
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

function scanSource(file, src, sentinel, fields = []) {
  const hits = [];
  const clean = stripComments(src);
  const lines = clean.split(/\r?\n/);
  // Rule A:?? / || 兜底到哨兵 —— 字面量与常量名两种写法都判(防「改成引用常量」逃逸)。
  const fallback = new RegExp(`(\\?\\?|\\|\\|)\\s*(["']${escape(sentinel.value)}["']|${escape(sentinel.name)})`);
  // Rule B:渲染面里的裸字面量。整串相等才算,`purchaseUnavailable` 这类标识符不误伤。
  const literal = new RegExp(`["']${escape(sentinel.value)}["']`);
  // Rule C:🔴 A/B 都只看得见**写出来的字面量**。`{ k: s.specGpu, v: p.gpu }` 一个字面量都没有,
  // 服务端把 gpu 下发成哨兵值时照样原样渲染 —— 实测漏网(2026-08-16 自查抓到,契约测试第 21 行
  // 明写服务端可对 gpu/vram 下发哨兵)。所以再判一条:渲染面的展示行取值(`v:` / `value:`)只要
  // 引用了 displayString 字段,就必须裹在降级映射里。
  const rowValue = /\b(?:v|value):\s*([^,}]+)/g;
  const onRenderFace = RENDER_FACE.some((d) => file.startsWith(`${d}/`));
  lines.forEach((line, i) => {
    if (fallback.test(line)) { hits.push({ file, line: i + 1, rule: "A", text: line.trim() }); return; }
    if (onRenderFace && literal.test(line)) { hits.push({ file, line: i + 1, rule: "B", text: line.trim() }); return; }
    if (!onRenderFace || fields.length === 0) return;
    for (const [, expr] of line.matchAll(rowValue)) {
      const touches = fields.find((f) => new RegExp(`\\.\\s*${escape(f)}\\b`).test(expr));
      if (touches && !new RegExp(`${escape(MAPPER)}\\s*\\(`).test(expr)) {
        hits.push({ file, line: i + 1, rule: "C", text: line.trim(), field: touches });
      }
    }
  });
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
    console.error(`  改法:展示取值一律裹 ${MAPPER}(),降级到 t.store.${I18N_KEY};判定用 import 进来的 ${sentinel.name}`);
    return 1;
  }
  console.log(
    `spec 哨兵渲染门 PASS:哨兵 ${sentinel.name}="${sentinel.value}" + ${fields.length} 个 displayString 字段(均现读自契约),`
    + `扫 ${files.length} 文件 / 渲染面 ${renderFiles.length} 文件,0 处兜底(A) + 0 处裸字面量(B) + 0 处未裹降级的展示取值(C),降级文案三语齐`,
  );
  return 0;
}

function selftest() {
  const sentinel = { name: "SPEC_UNAVAILABLE", value: "unavailable" };
  const F = ["gpu", "vram", "power", "datacenter", "uptime", "warranty", "phoneDailyEarn"];
  const P = "src/pages/store/detail.vue";   // 渲染面
  const O = "src/store/genesis.ts";          // 非渲染面
  const cases = [
    // ── 阳性:必须抓到 ──
    ["🔴 原样回归:?? 兜底到字面量", P, 'const v = computed(() => p.value?.warranty ?? "unavailable");', 1],
    ["🔴 || 兜底同样算(换个运算符不逃逸)", P, 'const v = p.warranty || "unavailable";', 1],
    ["🔴 间接引用:兜底到常量名而非字面量", P, "const v = p.warranty ?? SPEC_UNAVAILABLE;", 1],
    ["🔴 非渲染面的 ?? 兜底也判(Rule A 全仓生效)", O, 'const v = x ?? "unavailable";', 1],
    ["🔴 渲染面裸字面量(不经 ?? 也算,防挪位)", P, 'rows.push({ k: s.specWarranty, v: "unavailable" });', 1],
    ["🔴 渲染面裸字面量在模板里", P, "<template><text>{{ ok ? v : 'unavailable' }}</text></template>", 1],
    // ── 阴性:不许误伤 ──
    ["合法:渲染面用 import 进来的常量做判定", P, "if (raw === SPEC_UNAVAILABLE) return 0;", 0],
    ["合法:非渲染面拿它当状态枚举成员", O, 'return { ok: false, reason: "unavailable" };', 0],
    ["合法:非渲染面的枚举比较", O, 'if (r.reason === "unavailable") return copy;', 0],
    ["子串包含:标识符 purchaseUnavailable 不误伤", P, "const purchaseUnavailable = computed(() => x);", 0],
    ["子串包含:i18n key specUnavailable 不误伤", P, "toast.warn(t.value.store.specUnavailable);", 0],
    ["子串包含:更长的句子里含该词不误伤", P, 'const msg = "service unavailable now";', 0],
    ["注释里写了不算违规", P, '// 兜底禁止写成 ?? "unavailable"', 0],
    ["块注释里写了不算违规", P, '/* 曾经是 p.warranty ?? "unavailable" */', 0],
    // ── Rule C:一个字面量都没有的裸渲染(A/B 对这形态全瞎,2026-08-16 实测漏网 gpu/vram)──
    ["🔴 展示取值裸引用 displayString 字段(无任何字面量)", P, "rows.push({ k: s.specGpu, v: p.gpu });", 1],
    ["🔴 同上,可选链写法", P, "{ k: s.specWarranty, v: product.value?.warranty },", 1],
    ["🔴 同上,value: 键名", P, "{ label: s.specUptime, value: p.uptime },", 1],
    ["🔴 一行里两个裸取值各算一条", P, "[{ v: p.gpu }, { v: p.vram }]", 2],
    ["合法:裹了降级映射", P, "{ k: s.specGpu, v: specText(p.gpu) },", 0],
    ["合法:非展示位读原值做数值解析(不是 v:/value:)", P, "const raw = product.value?.phoneDailyEarn;", 0],
    ["合法:非渲染面的同名字段读取不判", O, "{ v: p.warranty },", 0],
    ["子串包含:字段名作为更长标识符的一部分不误伤", P, "{ v: p.warrantyBadgeUrl },", 0],
    ["合法:展示取值引用的是非哨兵字段", P, "{ k: s.specSold, v: p.sold },", 0],
  ];
  let failed = 0;
  for (const [name, file, src, want] of cases) {
    const got = scanSource(file, src, sentinel, F).length;
    if (got !== want) { failed += 1; console.error(`  ✗ ${name} —— 期望 ${want} 条违规,实得 ${got}`); }
  }
  // Rule C 的判据来源自证:字段表现读自契约,解析空即门瞎。
  if (readSentinelFields("const x = 1;").length !== 0) {
    failed += 1; console.error("  ✗ 无 displayString 的源码不该解析出字段");
  }
  const realFields = readSentinelFields(fs.readFileSync(CONTRACT, "utf8"));
  if (!realFields.includes("gpu") || !realFields.includes("warranty")) {
    failed += 1; console.error(`  ✗ 从 ${CONTRACT} 现读 displayString 字段失败 —— Rule C 的判据来源断了(实得 ${realFields.length} 个)`);
  }
  // 判据来源自证:契约里读不到常量时必须判红,而不是扫出 0 条然后报绿。
  if (readSentinel("const SPEC_UNAVAILABLE = \"unavailable\";") !== null) {
    failed += 1; console.error("  ✗ 未导出的常量不该被当成判据来源");
  }
  if (readSentinel('export const A = "x";\nexport const B = "y";') !== null) {
    failed += 1; console.error("  ✗ 多个导出字符串常量时该判红(锚错的失效方式是假绿),不该挑第一个");
  }
  if (readSentinel('export const A = "";') !== null) {
    failed += 1; console.error("  ✗ 空字符串哨兵不该被接受(空 needle 会匹配一切/一无所获)");
  }
  if (readSentinel(fs.readFileSync(CONTRACT, "utf8"))?.value !== "unavailable") {
    failed += 1; console.error(`  ✗ 从 ${CONTRACT} 现读哨兵失败 —— 门的判据来源断了`);
  }
  if (failed) { console.error(`spec-sentinel selftest FAIL:${failed} 条判据不成立`); return 1; }
  console.log(`spec-sentinel selftest PASS:${cases.length} 条判据逐条隔离验证 + 判据来源自证(改名/改值/间接引用/子串/注释 全覆盖)`);
  return 0;
}

process.exit(process.argv.includes("--selftest") ? selftest() : run());
