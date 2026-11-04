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
  grab(/(?:html\[data-theme="dark"\]|:root:not\(\[data-theme="light"\]\))\s*\{([\s\S]*?)\n\}/g, "dark");

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

/* ── main ── */

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
