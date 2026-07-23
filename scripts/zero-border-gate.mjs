#!/usr/bin/env node
/**
 * 零-border 铁律 · 运行时门(C2 批次 2026-07-23)
 *
 * 规范依据 `UI/规范/03-空间圆角边框分层规范.md` §3/§4:
 *   「**任何带背景色填充的卡片 / 板块一律零 border**——靠 surface 微差色分层,不描边。
 *     border **只属于透明容器**(分组 hairline、empty-state 虚线)。」
 *   §4:玻璃质感保留在 TabBar / Header / 浮层(--v5-glass-* / --v5-chrome-*),
 *       是全站 chrome 身份,**不在「卡片零 border」约束内**。
 *   §4 尾:内嵌元素(chip / pill / icon 容器)用 soft bg tint,**禁加 border**。
 *
 * 为什么是运行时门(C1 批次的教训,同一根因在那批发作三次):
 *   静态 grep 只能钉「我已经想到的写法」—— border 可以写成 `border:`、`border-top:`、
 *   `borderColor` 驼峰、UnoCSS class、CSS 类、或从别处继承;bg 可以是 color、gradient、
 *   或 token。用写法去找「扮演某角色的东西」必漏。
 *   本门只问渲染结果:**这个元素既有可见填充、又有可见描边** → 就是违例,不管源码怎么写。
 *
 * 分级:full(≥3 边,是「盒子描边」)进硬门;partial(1-2 边,多为行分隔线)只列不拦。
 * 豁免走 docs/ZERO-BORDER-ALLOWLIST.json(reason 必填);存量走棘轮基线,只拦新增。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const BASELINE = path.join(ROOT, "docs/ZERO-BORDER-BASELINE.json");
const ALLOWLIST = path.join(ROOT, "docs/ZERO-BORDER-ALLOWLIST.json");
const BASE = process.env.BASE_URL || "http://localhost:5173";

const ROUTES = [
  "/pages/index/index", "/pages/earn/earn", "/pages/store/store",
  "/pages/team/team", "/pages/me/me",
  "/pages/staking/staking", "/pages/genesis/genesis", "/pages/daily/daily",
  "/pages/me/wallet", "/pages/team/rank",
];

/* ── 判定纯函数(可离线红测) ── */
export function parseColor(s) {
  if (!s) return null;
  let m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)$/.exec(String(s).trim());
  if (m) {
    const a = m[4] === undefined ? 1 : String(m[4]).endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [+m[1], +m[2], +m[3], a];
  }
  m = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/.exec(String(s).trim());
  if (m) return [+m[1] * 255, +m[2] * 255, +m[3] * 255, m[4] === undefined ? 1 : +m[4]];
  return null;
}

/** 该元素**自身**是否有可见填充(不含祖先) */
export function hasFill(cs) {
  const c = parseColor(cs.backgroundColor);
  if (c && c[3] >= 0.03) return true;
  const bi = cs.backgroundImage;
  if (bi && bi !== "none" && /gradient|url\(/.test(bi)) return true;
  return false;
}

/** 可见描边的边数 */
export function borderSides(cs) {
  const sides = ["Top", "Right", "Bottom", "Left"];
  let n = 0;
  for (const s of sides) {
    const w = parseFloat(cs[`border${s}Width`] || "0");
    const style = cs[`border${s}Style`];
    if (!(w >= 0.5) || !style || style === "none" || style === "hidden") continue;
    const c = parseColor(cs[`border${s}Color`]);
    if (c && c[3] < 0.05) continue;   // 透明描边(占位用,视觉上不存在)
    n++;
  }
  return n;
}

/** chrome 身份豁免:TabBar / Header / 玻璃砖 / 浮层(规范《03》§4 明写不在约束内) */
export function isChrome(className, borderColorRaw) {
  const c = String(className || "");
  if (/nx-tabbar|nx-header|nx-chrome|nx-glass|glass|chassis|nx-nova|nx-toast|nx-sticky/i.test(c)) return true;
  if (/var\(--v5-(glass|chrome|tabbar)-border\)/.test(String(borderColorRaw || ""))) return true;
  return false;
}

export function judge({ fill, sides, chrome }) {
  if (!fill || chrome) return null;
  if (sides >= 3) return "full";
  if (sides >= 1) return "partial";
  return null;
}

/* ── 浏览器内探针 ── */
const PROBE = () => {
  const out = [];
  document.querySelectorAll("uni-view,view,uni-text,text,uni-button,button").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    const cs = getComputedStyle(el);
    out.push({
      cls: (el.className || "").toString().slice(0, 60),
      tag: el.tagName,
      w: Math.round(r.width), h: Math.round(r.height),
      bg: cs.backgroundColor, bgImg: cs.backgroundImage === "none" ? "" : cs.backgroundImage.slice(0, 60),
      radius: cs.borderTopLeftRadius,
      bw: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth],
      bs: [cs.borderTopStyle, cs.borderRightStyle, cs.borderBottomStyle, cs.borderLeftStyle],
      bc: [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor],
      txt: (el.textContent || "").trim().slice(0, 26),
    });
  });
  return out;
};

function evaluate(raw) {
  const cs = {
    backgroundColor: raw.bg, backgroundImage: raw.bgImg || "none",
    borderTopWidth: raw.bw[0], borderRightWidth: raw.bw[1], borderBottomWidth: raw.bw[2], borderLeftWidth: raw.bw[3],
    borderTopStyle: raw.bs[0], borderRightStyle: raw.bs[1], borderBottomStyle: raw.bs[2], borderLeftStyle: raw.bs[3],
    borderTopColor: raw.bc[0], borderRightColor: raw.bc[1], borderBottomColor: raw.bc[2], borderLeftColor: raw.bc[3],
  };
  return judge({ fill: hasFill(cs), sides: borderSides(cs), chrome: isChrome(raw.cls, "") });
}

async function sweep() {
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US" });
  const page = await ctx.newPage();
  const found = new Map();
  for (const route of ROUTES) {
    try {
      await page.goto(`${BASE}/?nx_device=off#${route}`, { waitUntil: "networkidle", timeout: 20000 });
    } catch { continue; }
    await page.waitForTimeout(700);
    for (const theme of ["dark", "light"]) {
      await page.evaluate((m) => document.querySelector("#app")?.__vue_app__?.config?.globalProperties?.$pinia?._s?.get("theme")?.setMode(m), theme);
      await page.waitForTimeout(300);
      await page.evaluate(() => { const s = document.querySelector(".nx-scroll"); if (s) s.scrollTop = s.scrollHeight; });
      await page.waitForTimeout(300);
      for (const raw of await page.evaluate(PROBE)) {
        const v = evaluate(raw);
        if (!v) continue;
        // 指纹不含主题:同一元素两主题都违例算一条
        const fp = `${route}|${v}|${raw.cls}|${raw.w}x${raw.h}`;
        if (!found.has(fp)) found.set(fp, { route, kind: v, cls: raw.cls, size: `${raw.w}x${raw.h}`, radius: raw.radius, sample: raw.txt, count: 0 });
        found.get(fp).count++;
      }
    }
  }
  await browser.close();
  return [...found.values()].sort((a, b) => (a.kind + a.route + a.cls).localeCompare(b.kind + b.route + b.cls));
}

/* ── selftest:双向红测(纯函数,不需浏览器) ── */
function selftest() {
  const P = [];
  const p = (n, e, a) => P.push({ n, ok: JSON.stringify(e) === JSON.stringify(a), e, a });
  const mk = (bg, w, color = "rgb(200,200,200)", style = "solid", bgImg = "none") => ({
    backgroundColor: bg, backgroundImage: bgImg,
    borderTopWidth: w[0], borderRightWidth: w[1], borderBottomWidth: w[2], borderLeftWidth: w[3],
    borderTopStyle: style, borderRightStyle: style, borderBottomStyle: style, borderLeftStyle: style,
    borderTopColor: color, borderRightColor: color, borderBottomColor: color, borderLeftColor: color,
  });
  const J = (o, cls = "") => judge({ fill: hasFill(o), sides: borderSides(o), chrome: isChrome(cls, "") });

  p("解析 rgba", [1, 2, 3, 0.5], parseColor("rgba(1, 2, 3, 0.5)"));
  p("解析 color(srgb)", [255, 0, 0, 0.5], parseColor("color(srgb 1 0 0 / 0.5)"));

  // 🔴 阳性:有填充 + 四边描边 = 违例
  p("阳性 实底卡 + 四边框", "full", J(mk("rgb(20,20,20)", ["1px", "1px", "1px", "1px"])));
  p("阳性 半透明 tint 底 + 四边框", "full", J(mk("rgba(158,220,29,0.2)", ["1px", "1px", "1px", "1px"])));
  p("阳性 渐变底 + 四边框", "full", J(mk("rgba(0,0,0,0)", ["1px", "1px", "1px", "1px"], "rgb(200,200,200)", "solid", "linear-gradient(rgb(1,1,1), rgb(2,2,2))")));
  p("阳性 实底 + 单边(记 partial 不拦)", "partial", J(mk("rgb(20,20,20)", ["0px", "0px", "1px", "0px"])));

  // 阴性:透明底带边 = 合法(分组 hairline / empty-state 虚线)
  p("阴性 透明底 + 四边框(合法透明容器)", null, J(mk("rgba(0,0,0,0)", ["1px", "1px", "1px", "1px"])));
  p("阴性 透明底 + 虚线框(empty state)", null, J(mk("rgba(0,0,0,0)", ["1px", "1px", "1px", "1px"], "rgb(200,200,200)", "dashed")));
  p("阴性 实底无边(合规卡片)", null, J(mk("rgb(20,20,20)", ["0px", "0px", "0px", "0px"])));
  p("阴性 实底 + 全透明描边(占位不跳位)", null, J(mk("rgb(20,20,20)", ["1px", "1px", "1px", "1px"], "rgba(0,0,0,0)")));
  p("阴性 实底 + style:none", null, J(mk("rgb(20,20,20)", ["1px", "1px", "1px", "1px"], "rgb(200,200,200)", "none")));
  p("阴性 极淡底(alpha<0.03)视为透明", null, J(mk("rgba(255,255,255,0.01)", ["1px", "1px", "1px", "1px"])));

  // chrome 豁免(《03》§4 明写)
  p("阴性 tabbar 玻璃砖", null, J(mk("rgba(255,255,255,0.2)", ["1px", "1px", "1px", "1px"]), "nx-tabbar-pill"));
  p("阴性 header chrome", null, J(mk("rgba(0,0,0,0.55)", ["1px", "1px", "1px", "1px"]), "nx-header-bar"));
  p("阳性 普通卡不被 chrome 豁免误放", "full", J(mk("rgb(20,20,20)", ["1px", "1px", "1px", "1px"]), "vb-card"));

  // allowlist reason 必填
  const ex = fs.existsSync(ALLOWLIST) ? JSON.parse(fs.readFileSync(ALLOWLIST, "utf8")).exemptions ?? [] : [];
  p("allowlist 每条有 reason", 0, ex.filter((e) => !e.reason || !String(e.reason).trim()).length);

  const bad = P.filter((x) => !x.ok);
  console.log("=== zero-border gate selftest ===");
  for (const x of P) console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.n}${x.ok ? "" : ` expect=${JSON.stringify(x.e)} actual=${JSON.stringify(x.a)}`}`);
  console.log(`\n${P.length - bad.length}/${P.length} pass`);
  process.exit(bad.length ? 1 : 0);
}
if (process.argv.includes("--selftest")) selftest();

const hits = await sweep();
const key = (h) => `${h.route}|${h.kind}|${h.cls}|${h.size}`;
const ex = fs.existsSync(ALLOWLIST) ? JSON.parse(fs.readFileSync(ALLOWLIST, "utf8")).exemptions ?? [] : [];
const allowed = (h) => ex.some((e) => (!e.route || e.route === h.route) && (!e.cls || e.cls === h.cls));
const live = hits.filter((h) => !allowed(h));

if (process.argv.includes("--update-baseline")) {
  fs.writeFileSync(BASELINE, JSON.stringify({
    _doc: "零-border 铁律棘轮基线。门只拦新增 full 违例(≥3 边描边 + 有填充);partial(1-2 边,多为行分隔线)只列不拦。基线只许缩不许涨,每条 note 写为什么还在。",
    _updated: "2026-07-23", entries: live.map((h) => ({ ...h, note: "存量,C2 批次待判" })),
  }, null, 1));
  console.log(`baseline 已更新:${live.length} 条(full ${live.filter(h=>h.kind==="full").length} · partial ${live.filter(h=>h.kind==="partial").length})`);
  process.exit(0);
}

if (process.argv.includes("--list")) {
  for (const h of live) console.log(`${h.kind.padEnd(7)} ${h.route}  ${h.size}  r${h.radius}  .${h.cls}  « ${h.sample}`);
  console.log(`\n合计 full ${live.filter(h=>h.kind==="full").length} · partial ${live.filter(h=>h.kind==="partial").length}`);
  process.exit(0);
}

const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf8")).entries ?? [] : [];
const known = new Set(baseline.map(key));
const added = live.filter((h) => h.kind === "full" && !known.has(key(h)));
const gone = baseline.filter((b) => !live.some((h) => key(h) === key(b)));

if (added.length) {
  console.error(`零-border:新增 ${added.length} 处「有填充 + 四边描边」(基线 ${baseline.length},消失 ${gone.length})\n`);
  for (const h of added) console.error(`  ${h.route}  ${h.size}  .${h.cls}  « ${h.sample}`);
  console.error(`\n《03》§3:带 bg 填充的卡片/板块一律零 border,层级靠 surface 微差色。删 border 即可。`);
  console.error(`确属 chrome / 透明容器 / 隔离环 → docs/ZERO-BORDER-ALLOWLIST.json 加一条并写 reason。`);
  process.exit(1);
}
console.log(`零-border:无新增 full 违例(基线 ${baseline.length} 条,本次消失 ${gone.length} 条)`);
