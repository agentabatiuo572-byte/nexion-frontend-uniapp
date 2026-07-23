#!/usr/bin/env node
/**
 * token-copy 哨兵 —— 抓「设计 token 的色值被抄成字面量」。
 *
 * 为什么是真 bug 不是洁癖:
 *   token 在亮/暗两主题取不同值,字面副本不会变 → 该元素在另一主题下必然失配。
 *   典型:vault-row 同一对象里 softBg/text 走 token、borderColor 抄了亮主题的绿。
 *
 * 判据(第一性原理,只钉必然失配的那类,不制造噪声):
 *   ① 只钉「亮值 ≠ 暗值」的 token —— 单主题 token 的副本不会失配,不入门。
 *   ② 比 RGB 三元组、**忽略 alpha** —— rgba(14,142,74,0.30) 也是 --v5-success 的副本。
 *      (2026-07-23 C1:首版比全等值,漏掉全部变透明度副本,即 vault-row 那 3 处真 bug。)
 *   ③ 真灰(r=g=b)排除 —— #000/#fff/#0F0F0F 是主题无关的通用光影,不是语义色。
 *   ④ hex 3/6/8 位 + rgb()/rgba() 两种书写形式都认。
 *      (旧哨兵 '#0E48E6|#F4F1E9|#FF5A1F|#13141A' 只钉 4 色且只认 #RRGGBB,
 *       被 rgba() 形式绕过过 —— purchase-ticker 注释曾自陈「特意挪值以免触发哨兵」。)
 *
 * 豁免走 docs/TOKEN-COPY-ALLOWLIST.json,每条必须写 reason(人工裁决留痕,不是静默绕过)。
 * --selftest 双向红测:两种书写形式的阳性必中 + 干净样本/真灰/注释/豁免必 0。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const TOKENS_CSS = path.join(SRC, "styles/tokens.css");
const ALLOWLIST = path.join(ROOT, "docs/TOKEN-COPY-ALLOWLIST.json");

/* ── 颜色规范化 → "r,g,b,a" ── */
export function norm(raw) {
  const s = String(raw).trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) {
    const [r, g, b] = m[1].split("");
    return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16), 1];
  }
  m = /^#([0-9a-f]{6})$/.exec(s);
  if (m) {
    const h = m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  m = /^#([0-9a-f]{8})$/.exec(s);
  if (m) {
    const h = m[1];
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      parseInt(h.slice(6, 8), 16) / 255,
    ];
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)$/.exec(s);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3]), a];
  }
  // hsl()/hsla() —— 独立验收指出的唯一漏网写法(当前全库 0 处,先堵上防将来)
  m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.%]+))?\s*\)$/.exec(s);
  if (m) {
    const h = +m[1] / 360, sat = +m[2] / 100, l = +m[3] / 100;
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    const f = (n) => {
      const k = (n + h * 12) % 12;
      return l - sat * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255), a];
  }
  return null;
}
const rgbKey = (n) => `${n[0]},${n[1]},${n[2]}`;
export const isTrueGrey = (n) => n[0] === n[1] && n[1] === n[2];

/* ── tokens.css → 亮暗值不同的语义色表 ── */
const stripCssComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

export function buildThemeVaryingTable(css) {
  const raw = stripCssComments(css);
  const defs = { light: new Map(), dark: new Map() };
  const grab = (re, theme) => {
    let b;
    while ((b = re.exec(raw))) {
      const dre = /(--[\w-]+)\s*:\s*([^;]+);/g;
      let d;
      while ((d = dre.exec(b[1]))) {
        const n = norm(d[2].trim());
        if (n) defs[theme].set(d[1], n);
      }
    }
  };
  grab(/:root\s*\{([\s\S]*?)\n\}/g, "light");
  grab(/html\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/g, "dark");

  const table = new Map(); // rgbKey -> [{token, theme}]
  for (const theme of ["light", "dark"]) {
    for (const [token, val] of defs[theme]) {
      const other = defs[theme === "light" ? "dark" : "light"].get(token);
      if (!other) continue; // 单主题 token:不会失配
      if (rgbKey(other) === rgbKey(val) && other[3] === val[3]) continue; // 两主题同值:不会失配
      if (isTrueGrey(val)) continue; // 真灰 = 通用光影
      const k = rgbKey(val);
      if (!table.has(k)) table.set(k, []);
      table.get(k).push({ token, theme });
    }
  }
  return table;
}

/* ── 源码扫描 ── */
export function stripSourceComments(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:\w])\/\/[^\n]*/gm, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

const LITERAL_RE =
  /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*[\d.]+[\s,]+[\d.]+[\s,]+[\d.]+(?:[\s,/]+[\d.%]+)?\s*\)|hsla?\(\s*[\d.]+(?:deg)?[\s,]+[\d.]+%[\s,]+[\d.]+%(?:[\s,/]+[\d.%]+)?\s*\)/g;

export function scanText(text, rel, table) {
  const hits = [];
  const clean = stripSourceComments(text);
  clean.split(/\r?\n/).forEach((line, i) => {
    let m;
    LITERAL_RE.lastIndex = 0;
    while ((m = LITERAL_RE.exec(line))) {
      const n = norm(m[0]);
      if (!n || isTrueGrey(n)) continue;
      const tokens = table.get(rgbKey(n));
      if (!tokens) continue;
      hits.push({
        file: rel,
        line: i + 1,
        literal: m[0],
        tokens: tokens.map((t) => `${t.token}@${t.theme}`),
        text: line.trim().slice(0, 120),
      });
    }
  });
  return hits;
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(vue|ts|js)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) acc.push(p);
  }
  return acc;
}

function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST)) return [];
  const j = JSON.parse(fs.readFileSync(ALLOWLIST, "utf8"));
  return j.exemptions ?? [];
}
export function isAllowed(hit, exemptions) {
  return exemptions.some(
    (e) => e.file === hit.file && (!e.literal || norm(e.literal)?.join() === norm(hit.literal)?.join()),
  );
}

/* ── selftest:双向红测 ── */
function selftest() {
  const probes = [];
  const p = (name, expect, actual) =>
    probes.push({ name, ok: JSON.stringify(expect) === JSON.stringify(actual), expect, actual });

  const css = fs.readFileSync(TOKENS_CSS, "utf8");
  const table = buildThemeVaryingTable(css);

  // A. 表本身:已知亮暗不同的 token 必须在表里,已知同值/单主题的必须不在
  p("--v5-success@light(#0E8E4A) 入表", true, (table.get("14,142,74") || []).some((t) => t.token === "--v5-success"));
  p("--v5-warning@light(#C68316) 入表", true, (table.get("198,131,22") || []).some((t) => t.token === "--v5-warning"));
  p("--v5-warning@dark(#FFCB4D) 入表", true, (table.get("255,203,77") || []).some((t) => t.token === "--v5-warning"));
  p("--v5-ink@light(#13141A) 入表", true, (table.get("19,20,26") || []).some((t) => t.token === "--v5-ink"));
  p("--v5-on-brand-2 两主题同值 → 不入表", 0, (table.get("10,10,10") || []).length);
  p("真灰 #141414 不入表", 0, (table.get("20,20,20") || []).length);
  p("未知色 #123456 不入表", 0, (table.get("18,52,86") || []).length);

  // B. 🔴 阳性红测:两种书写形式 + 变 alpha 都必须被抓
  p("阳性 hex 形式", 1, scanText(`color: "#0E8E4A";`, "x.vue", table).length);
  p("阳性 rgb() 形式", 1, scanText(`color: rgb(14,142,74);`, "x.vue", table).length);
  p("阳性 rgba() 变 alpha 形式", 1, scanText(`border: 1px solid rgba(14,142,74,0.30);`, "x.vue", table).length);
  p("阳性 rgba() 带空格", 1, scanText(`background: rgba(198, 131, 22, 0.5);`, "x.vue", table).length);
  p("阳性 #RRGGBBAA 形式", 1, scanText(`color: #0E8E4A4D;`, "x.vue", table).length);
  p("阳性 小写 hex", 1, scanText(`color: "#c68316";`, "x.vue", table).length);
  // hsl(198,131,22) = #C68316 → hsl(37.16, 80%, 43.14%);独立验收指出的漏网写法
  p("阳性 hsl() 形式", 1, scanText(`color: hsl(37.16, 80%, 43.14%);`, "x.vue", table).length);
  p("阳性 hsla() 变 alpha", 1, scanText(`border: 1px solid hsla(37.16, 80%, 43.14%, 0.3);`, "x.vue", table).length);
  p("norm(hsl) 与 hex 等价", norm("#C68316")?.join(), norm("hsl(37.16, 80%, 43.14%)")?.join());

  // C. 🔴 阴性红测:干净/真灰/注释/token 引用必须 0
  p("阴性 var() 引用", 0, scanText(`color: var(--v5-success);`, "x.vue", table).length);
  p("阴性 color-mix", 0, scanText(`border: color-mix(in srgb, var(--v5-success) 30%, transparent);`, "x.vue", table).length);
  p("阴性 真灰遮罩", 0, scanText(`background: rgba(0,0,0,0.55);`, "x.vue", table).length);
  p("阴性 #FFFFFF", 0, scanText(`color: #FFFFFF;`, "x.vue", table).length);
  p("阴性 块注释内的违例", 0, scanText(`/* color: #0E8E4A; */`, "x.vue", table).length);
  p("阴性 行注释内的违例", 0, scanText(`// color: #0E8E4A;`, "x.vue", table).length);
  p("阴性 HTML 注释内的违例", 0, scanText(`<!-- #0E8E4A -->`, "x.vue", table).length);
  p("阴性 非 token 色 #C26658", 0, scanText(`color: "#C26658";`, "x.vue", table).length);

  // D. 豁免机制:命中必须能被豁免,且豁免不得误伤其它文件/其它色
  const hit = scanText(`color: "#0E8E4A";`, "src/a.vue", table)[0];
  p("豁免 file+literal 生效", true, isAllowed(hit, [{ file: "src/a.vue", literal: "#0E8E4A", reason: "t" }]));
  p("豁免不跨文件", false, isAllowed(hit, [{ file: "src/b.vue", literal: "#0E8E4A", reason: "t" }]));
  p("豁免不跨色值", false, isAllowed(hit, [{ file: "src/a.vue", literal: "#C68316", reason: "t" }]));

  // E. allowlist 文件本身:每条必须有 reason(防静默绕过)
  const ex = loadAllowlist();
  p("allowlist 每条都有 reason", 0, ex.filter((e) => !e.reason || !String(e.reason).trim()).length);

  const fails = probes.filter((x) => !x.ok);
  console.log("=== token-copy sentinel selftest ===");
  for (const x of probes)
    console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.name}${x.ok ? "" : `  expect=${JSON.stringify(x.expect)} actual=${JSON.stringify(x.actual)}`}`);
  console.log(`\n${probes.length - fails.length}/${probes.length} pass`);
  process.exit(fails.length ? 1 : 0);
}

/* ── main ── */
if (process.argv.includes("--selftest")) selftest();

const table = buildThemeVaryingTable(fs.readFileSync(TOKENS_CSS, "utf8"));
const exemptions = loadAllowlist();
const all = [];
for (const f of walk(SRC)) {
  if (path.normalize(f) === path.normalize(TOKENS_CSS)) continue;
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  if (rel.startsWith("src/i18n/messages/")) continue;
  all.push(...scanText(fs.readFileSync(f, "utf8"), rel, table));
}
const violations = all.filter((h) => !isAllowed(h, exemptions));

if (process.argv.includes("--list")) {
  for (const h of all) console.log(`${isAllowed(h, exemptions) ? "ALLOW" : "VIOL "} ${h.file}:${h.line}  ${h.literal}  = ${h.tokens.join(" | ")}`);
}

if (violations.length) {
  console.error(`token-copy: ${violations.length} 处 token 色值字面副本(亮暗必失配)\n`);
  for (const h of violations)
    console.error(`  ${h.file}:${h.line}  ${h.literal}  = ${h.tokens.join(" | ")}\n     ${h.text}`);
  console.error(`\n修法:改 var(--token) 或 color-mix(in srgb, var(--token) N%, transparent)。`);
  console.error(`确属技法必需(canvas/二维码/第三方品牌色) → 写进 docs/TOKEN-COPY-ALLOWLIST.json 并附 reason。`);
  process.exit(1);
}
console.log(`token-copy: 0 违例(表内亮暗异值 token ${table.size} 色 · 豁免 ${exemptions.length} 条)`);
