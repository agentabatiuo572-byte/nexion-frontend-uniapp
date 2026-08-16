#!/usr/bin/env node
/**
 * 全站层级秩序门 —— 断言浮层的**相对序**,不是断言某个魔数。
 *
 * 为什么焊这道门(2026-08-04 第 2 轮审计 P1):
 *   滑块人机验证 `.cs-layer` 从 2026-07-06 建档起就是 z-index 90,输给 toast(9000)/
 *   确认弹窗(9100)/国家区号半屏(9000-9001)/里程碑庆祝(8900)。实测:注册页滑块弹出后
 *   打开区号半屏,滑块三个操作点 elementFromPoint 全部命中 `.cc-row`,把手拖不动 ——
 *   而发码流程正停在这个滑块上等它解开 = 死锁。tsc / verify / i18n 镜像全绿,没有任何
 *   一道门看层级,改一个数字不会红任何东西。
 *
 * 两个正交断言(缺一不可):
 *   ① 阶梯序:登录/注册页**同时挂载**的 6 个浮层必须严格递增(值解析不到 = 红,不许假绿)。
 *   ② 全局天花板:滑块必须是业务面最高层 —— 全站扫一遍 z-index,除模拟设备 chrome
 *      白名单外不许有人 ≥ 滑块。①只遍历已知成员,新加一个 9600 的浮层它看不见;②才看得见。
 *
 * 用法:node scripts/zindex-order.mjs [--selftest]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

/** 注释里的层级表/历史记录不是代码,先抹掉再扫(值用空格填,行号不漂) */
export const stripComments = (s) =>
  s
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

/** 规则块取 z-index;选择器写死 pin,解析不到返回 null(调用方必须判 null) */
export function zOf(text, selector) {
  const src = stripComments(text);
  const m = src.match(new RegExp(selector.replace(/\./g, "\\.") + "\\s*\\{[^}]*?z-index:\\s*(\\d+)", "s"));
  return m ? parseInt(m[1], 10) : null;
}

/** 全站扫 z-index 数值(含内联 style),返回 {file,line,z} */
export function scanAll(files) {
  const hits = [];
  for (const { rel, text } of files) {
    const src = stripComments(text);
    const re = /z-index:\s*(\d+)/g;
    let m;
    while ((m = re.exec(src))) hits.push({ file: rel, line: src.slice(0, m.index).split("\n").length, z: parseInt(m[1], 10) });
  }
  return hits;
}

/* ── 契约 ①:登录/注册页同时挂载的 6 层,必须严格递增 ────────────────────────
   这 6 个组件在 register.vue / login.vue 里是同一个 stacking context 下的兄弟,
   数值大小 = 真实压盖顺序(已用 elementFromPoint 实测验证过这个前提)。 */
export const LADDER = [
  { file: "src/components/milestone-celebration.vue", sel: ".ms-overlay", role: "里程碑庆祝(必须在业务 UI 之下)" },
  { file: "src/components/global-ui.vue", sel: ".nx-toast-host", role: "toast 瞬时层" },
  { file: "src/components/country-code-sheet.vue", sel: ".cc-sheet", role: "国家区号半屏" },
  { file: "src/components/global-ui.vue", sel: ".nx-mask", role: "阻断式弹窗 confirm/netError" },
  { file: "src/components/captcha-slider.vue", sel: ".cs-layer", role: "🔴 滑块人机验证(阻断式安全控件,发码流程停在它上面)" },
  { file: "src/components/device/standalone-page-shell.vue", sel: ".nx-standalone-home", role: "模拟设备 chrome(硬件层,pointer-events:none)" },
];

/* ── 契约 ③:庆祝浮层必须低于全部业务浮层 ──────────────────────────────────
   秩序表(captcha-slider.vue 单源)原文:「里程碑庆祝 —— 必须在业务 UI 之下」。
   业务浮层带 = 秩序表里 790/800 业务半屏 → 900 说明半屏 → 8000/8001 分享半屏 这一段;
   下沿取 700(底盘 chrome 最高 200,留足缓冲),上沿取 8999(9000 起是瞬时层/阻断层,
   庆祝低于它们已由阶梯①覆盖,不重复断言)。 */
export const BUSINESS_BAND_FLOOR = 700;
export const BUSINESS_BAND_CEIL = 8999;
export const MILESTONE_FILE = "src/components/milestone-celebration.vue";

/* ── 契约 ②:允许高于滑块的白名单(只有模拟硬件 chrome)────────────────────── */
export const CEILING_EXEMPT = [
  { file: "src/components/device/standalone-page-shell.vue", reason: "模拟设备状态栏 / Home Indicator = 硬件层,与居中卡片零几何重叠,indicator 还是 pointer-events:none" },
];

function readVueFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".vue")) out.push({ rel: path.relative(ROOT, p).replace(/\\/g, "/"), text: fs.readFileSync(p, "utf8") });
    }
  };
  walk(SRC);
  return out;
}

/** 主判定。files 可注入(红测用),不传则读磁盘。 */
export function evaluate(files = readVueFiles()) {
  const byRel = new Map(files.map((f) => [f.rel, f.text]));
  const problems = [];

  // ① 阶梯
  const rungs = LADDER.map((r) => ({ ...r, z: byRel.has(r.file) ? zOf(byRel.get(r.file), r.sel) : null }));
  for (const r of rungs) if (r.z === null) problems.push(`层级值解析不到:${r.file} ${r.sel} —— 被删/改名/改写法都算红,不许静默跳过`);
  for (let i = 1; i < rungs.length; i++) {
    const a = rungs[i - 1], b = rungs[i];
    if (a.z !== null && b.z !== null && !(a.z < b.z))
      problems.push(`序反了:${a.sel}(${a.z}) 必须 < ${b.sel}(${b.z}) —— ${b.role}`);
  }

  // ③ 庆祝浮层必须低于**全部业务浮层**(2026-08-16 补:秩序表原文一直写着这句,
  //    数值却压在业务半屏之上,而阶梯①只排了登录/注册页共挂的 6 层,业务半屏一条
  //    都不在表里 —— 于是「契约被违反」和「门是绿的」同时成立了很久)。
  //    判据用**扫描出的整条业务浮层带**而不是手写清单:手写清单认不出新加进来的面。
  const msZ = rungs.find((r) => r.sel === ".ms-overlay")?.z ?? null;
  const businessBand = scanAll(files).filter(
    (h) => h.z >= BUSINESS_BAND_FLOOR && h.z <= BUSINESS_BAND_CEIL && h.file !== MILESTONE_FILE,
  );
  if (msZ === null) {
    problems.push("庆祝层级解析不到:无法判定它是否压在业务 UI 之下");
  } else if (businessBand.length === 0) {
    // 扫描面塌空 = 假绿的经典形态:期望本就是空集时,「不许出现 X」永远成立。
    problems.push(
      `业务浮层带扫不到任何成员(${BUSINESS_BAND_FLOOR}–${BUSINESS_BAND_CEIL})—— 判据失去扫描面,按红处理`,
    );
  } else {
    const lowest = businessBand.reduce((a, b) => (a.z <= b.z ? a : b));
    if (msZ >= lowest.z)
      problems.push(
        `庆祝压在业务 UI 之上:.ms-overlay(${msZ}) 必须 < ${lowest.file}:${lowest.line}(${lowest.z})` +
          ` —— 秩序表原文「里程碑庆祝必须在业务 UI 之下」`,
      );
  }

  // ② 天花板
  const capt = rungs.find((r) => r.sel === ".cs-layer");
  const exemptFiles = new Set(CEILING_EXEMPT.map((e) => e.file));
  const over = capt?.z == null ? [] : scanAll(files).filter((h) => h.z >= capt.z && !exemptFiles.has(h.file) && h.file !== "src/components/captcha-slider.vue");
  for (const h of over)
    problems.push(`天花板破了:${h.file}:${h.line} z-index ${h.z} ≥ 滑块 ${capt.z} —— 滑块是阻断式安全控件,不许有业务浮层压在它上面`);

  return { rungs, problems, scanned: files.length, ceilingScanned: scanAll(files).length };
}

/* ── 红测:每个合取项单独隔离破坏,一次只坏一项 ───────────────────────────── */
function selftest() {
  const P = [];
  const p = (n, ok, extra = "") => P.push({ n, ok, extra });
  const base = readVueFiles();
  const clone = () => base.map((f) => ({ ...f }));
  const patch = (rel, fn) => { const c = clone(); const t = c.find((f) => f.rel === rel); t.text = fn(t.text); return c; };

  const b0 = evaluate(base);
  p(`基线:磁盘现状 0 违例(阶梯 ${LADDER.length} 级,天花板扫 ${b0.ceilingScanned} 个 z-index)`, b0.problems.length === 0,
    b0.problems.slice(0, 2).join(" / ") + (b0.problems.length > 2 ? ` …共 ${b0.problems.length} 处(直跑本脚本看全量)` : ""));

  // ① 阶梯:逐个相邻对单独踩坏(不同时坏两处,否则「靠 A 红了而 B 从没验过」)
  for (let i = 1; i < LADDER.length; i++) {
    const lo = LADDER[i - 1], hi = LADDER[i];
    const hiZ = zOf(base.find((f) => f.rel === hi.file).text, hi.sel);
    const files = patch(lo.file, (t) => t.replace(new RegExp(`(${lo.sel.replace(/\./g, "\\.")}\\s*\\{[^}]*?z-index:\\s*)\\d+`, "s"), `$1${hiZ + 1}`));
    const r = evaluate(files);
    p(`红测①-${i} ${lo.sel} 抬到 ${hiZ + 1}(越过 ${hi.sel})必红`, r.problems.some((x) => x.startsWith("序反了")), r.problems.join(" / "));
  }
  // 事故现场原样:把滑块改回 90
  {
    const files = patch("src/components/captcha-slider.vue", (t) => t.replace(/(\.cs-layer\s*\{[^}]*?z-index:\s*)\d+/s, "$190"));
    p("红测①-事故现场 .cs-layer 改回 90 必红", evaluate(files).problems.some((x) => x.startsWith("序反了")));
  }
  // ① 删除方向:整条 z-index 删掉,不许因为「遍历不到」而放行
  for (const r of [LADDER[4], LADDER[3]]) {
    const files = patch(r.file, (t) => t.replace(new RegExp(`(${r.sel.replace(/\./g, "\\.")}\\s*\\{[^}]*?)z-index:\\s*\\d+;\\s*`, "s"), "$1"));
    p(`红测①-删除 ${r.sel} 的 z-index 行必红(降数/删成员方向)`, evaluate(files).problems.some((x) => x.startsWith("层级值解析不到")));
  }

  // ③ 庆祝 vs 业务浮层:三条轴各自单独踩坏
  {
    // 轴 1「回退」:把庆祝改回事故值 8900(压在 790/800 业务半屏之上)。
    const files = patch(MILESTONE_FILE, (t) => t.replace(/(\.ms-overlay\s*\{[^}]*?z-index:\s*)\d+/s, "$18900"));
    p("红测③-事故现场 .ms-overlay 改回 8900 必红(压在业务半屏之上)",
      evaluate(files).problems.some((x) => x.startsWith("庆祝压在业务 UI 之上")),
      evaluate(files).problems.join(" / "));
  }
  {
    // 轴 2「新成员」:新加一个业务半屏,其 z 低于庆祝 —— 手写清单式判据对这条是瞎的。
    const files = clone();
    files.push({ rel: "src/components/fake-new-sheet.vue", text: "<style scoped>\n.fake-sheet { position: fixed; z-index: 750; }\n</style>" });
    p("红测③-新成员 新增 750 业务半屏必红(庆祝 780 反而压在它上面)",
      evaluate(files).problems.some((x) => x.startsWith("庆祝压在业务 UI 之上")));
  }
  {
    // 轴 3「扫描面塌空」:业务带一个成员都扫不到时不许判绿 —— 期望是空集的断言天然假绿。
    const files = base.filter((f) => {
      const hits = scanAll([f]);
      return !hits.some((h) => h.z >= BUSINESS_BAND_FLOOR && h.z <= BUSINESS_BAND_CEIL && h.file !== MILESTONE_FILE);
    });
    p("红测③-塌空 业务带扫不到成员时必红(不许因『没找到违例』而假绿)",
      evaluate(files).problems.some((x) => x.startsWith("业务浮层带扫不到任何成员")));
  }

  // ② 天花板:新加一个高于滑块的业务浮层
  {
    const files = clone();
    files.push({ rel: "src/components/fake-new-overlay.vue", text: "<style scoped>\n.foo { position: fixed; z-index: 9600; }\n</style>" });
    p("红测② 新增 9600 业务浮层必红(阶梯遍历不到的新成员)", evaluate(files).problems.some((x) => x.startsWith("天花板破了")));
  }
  {
    const files = clone();
    files.push({ rel: "src/components/device/standalone-page-shell.vue.bak", text: ".x { z-index: 10050; }" });
    p("红测②-反向 白名单外的 10050 也必红(白名单按文件不按数值)", evaluate(files).problems.some((x) => x.startsWith("天花板破了")));
  }

  // 判据本身:注释里的层级表不许被当成代码(否则本文件的说明注释会自伤)
  p("阴性 注释里的 z-index 不计数", scanAll([{ rel: "a.vue", text: "/* z-index: 99999 */\n<!-- z-index: 88888 -->" }]).length === 0);
  p("阴性 zOf 剥注释后仍取到真实值", zOf("/* .cs-layer { z-index: 1 } */\n.cs-layer { z-index: 9500; }", ".cs-layer") === 9500);
  p("阴性 选择器不存在 → null 而非 0", zOf(".other { z-index: 5; }", ".cs-layer") === null);

  const bad = P.filter((x) => !x.ok);
  console.log("=== zindex-order selftest ===");
  for (const x of P) console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.n}${x.ok || !x.extra ? "" : ` | ${x.extra}`}`);
  console.log(`\n${P.length - bad.length}/${P.length} pass`);
  process.exit(bad.length ? 1 : 0);
}
if (process.argv.includes("--selftest")) selftest();

const res = evaluate();
if (res.problems.length) {
  console.error(`层级秩序: ${res.problems.length} 处违例\n`);
  for (const m of res.problems.slice(0, 10)) console.error("  " + m);
  if (res.problems.length > 10) console.error(`  …另有 ${res.problems.length - 10} 处同类(多为滑块被压低后「全世界都在它上面」的连带)`);
  console.error(`\n秩序表见 src/components/captcha-slider.vue 顶部注释(单源)。确属例外 → 改本脚本的 LADDER / CEILING_EXEMPT 并写 reason。`);
  process.exit(1);
}
console.log(
  `层级秩序: 0 违例(阶梯 ${res.rungs.length} 级 ${res.rungs.map((r) => `${r.sel}=${r.z}`).join(" < ")};天花板扫 ${res.scanned} 个 .vue / ${res.ceilingScanned} 处 z-index)`
);
