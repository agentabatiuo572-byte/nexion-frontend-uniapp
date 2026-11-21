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
 *   ② 全局天花板:两种滑块验证码都是同级最高的安全控件 —— 全站扫一遍 z-index,除模拟设备
 *      chrome 白名单外不许有人 ≥ 验证码。①只遍历已知成员,新加一个 9600 的浮层它看不见;②才看得见。
 *
 * 用法:node scripts/zindex-order.mjs
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

/** 规则块取 z-index 及其源码偏移;注释以空格替换后偏移仍和原文件一致。 */
export function zHitOf(text, selector) {
  const src = stripComments(text);
  const m = new RegExp(selector.replace(/\./g, "\\.") + "\\s*\\{[^}]*?z-index:\\s*(\\d+)", "s").exec(src);
  return m ? { z: parseInt(m[1], 10), offset: m.index + m[0].lastIndexOf("z-index") } : null;
}

/** 规则块取 z-index;选择器写死 pin,解析不到返回 null(调用方必须判 null) */
export function zOf(text, selector) {
  return zHitOf(text, selector)?.z ?? null;
}

/** 全站扫 z-index 数值(含内联 style),返回 {file,line,z,offset}。 */
export function scanAll(files) {
  const hits = [];
  for (const { rel, text } of files) {
    const src = stripComments(text);
    const re = /z-index:\s*(\d+)/g;
    let m;
    while ((m = re.exec(src))) hits.push({ file: rel, line: src.slice(0, m.index).split("\n").length, z: parseInt(m[1], 10), offset: m.index });
  }
  return hits;
}

/* ── 契约 ①:登录/注册页同时挂载的 6 层,必须严格递增 ────────────────────────
   这 6 个组件在 register.vue / login.vue 里是同一个 stacking context 下的兄弟,
   数值大小 = 真实压盖顺序(已用 elementFromPoint 实测验证过这个前提)。 */
export const LADDER = [
  { file: "src/components/milestone-celebration.vue", sel: ".ms-overlay", role: "里程碑庆祝(必须在业务 UI 之下)" },
  { file: "src/components/country-code-sheet.vue", sel: ".cc-sheet", role: "国家区号半屏" },
  { file: "src/components/global-ui.vue", sel: ".nx-mask", role: "阻断式弹窗 confirm/netError" },
  { file: "src/components/captcha-slider.vue", sel: ".cs-layer", role: "🔴 滑块人机验证(阻断式安全控件,发码流程停在它上面)" },
  { file: "src/components/toast-host.vue", sel: ".nx-toast-host", role: "toast 瞬时层(高于所有浮层和验证码,不拦截点击)" },
  { file: "src/components/device/standalone-page-shell.vue", sel: ".nx-standalone-home", role: "模拟设备 chrome(硬件层,pointer-events:none)" },
];

/*
 * 本地和服务端验证码是同一个发码阻断点的两种运行实现。它们允许同层,但必须同值:
 * 若把其中一个排除出天花板却不钉住同级关系,业务浮层也能借这个口子逃逸。
 */
export const CAPTCHA_SECURITY_CONTROLS = [
  { file: "src/components/captcha-slider.vue", sel: ".cs-layer", role: "本地滑块验证码" },
  { file: "src/components/server-captcha-slider.vue", sel: ".cs-layer", role: "服务端滑块验证码" },
];

/* ── 契约 ③:庆祝浮层必须低于全部业务浮层 ──────────────────────────────────
   秩序表(captcha-slider.vue 单源)原文:「里程碑庆祝 —— 必须在业务 UI 之下」。
   业务浮层带 = 秩序表里 790/800 业务半屏 → 900 说明半屏 → 8000/8001 分享半屏 这一段;
   上沿取 8999(9000 起是瞬时层/阻断层,庆祝低于它们已由阶梯①覆盖,不重复断言)。

   🔴 下沿定在 201 而不是 700(2026-08-16 独立审计实测后收紧):原值 700 把三张
   **付款半屏**漏在窗外 —— stake-sheet / genesis purchase-sheet / eligibility-sheet
   当时是 79/80(比秩序表记的 790/800 少一位数),庆祝 780 压在它们之上并**吃掉
   「锁仓」按钮的点击**(elementFromPoint 实测命中 .ms-backdrop)。那三张已归位到
   790/800。2026-08-17 三处残留(消息抽屉 110/120 · OpenSea 弹窗 120 · PC 设备卡长按
   菜单 200)也已迁入 790/800,下沿随之降到 111 = 底盘常驻件最高值(模拟设备状态栏
   110)+1;此后 111 以上任何新浮层都在扫描面内。 */
export const BUSINESS_BAND_FLOOR = 111; // 仅供文档/红测引用;判据已改为结构式,不再按数值取带

/**
 * 结构判据的**显式欠账清单** —— 空 = 目标状态(2026-08-17 三条全部清掉:消息抽屉
 * 110/120 · OpenSea 弹窗 120 · PC 设备卡长按菜单 200,均已迁入 790/800 业务半屏带)。
 * 🔴 这是**记账不是豁免**:清单在这里就是为了让下一个人看见它、而不是让门装作没看见。
 * 清掉一条就从这里删一条;新增任何一条都必须在这里写明理由,否则等于把缺陷藏进门里。
 *
 * 🔴 清空它的同时必须补扫描面,否则「清单空了」只是话术:实测三条里只有 opensea 一条
 * 真被门挡着,另两条摘掉后门照样 0 违例 —— 抽屉写的是 position:absolute(判据只认
 * fixed)、设备卡写的是内联 style(判据只扫 <style> 块)。所以本轮同时:
 *   · 抽屉改写成 fixed 满屏遮罩,与其余 19 个同形 → 自然落进扫描面;
 *   · 判据补扫 <template> 里的内联 style(见 scanFullScreenScrims);
 *   · 加 BAND_ANCHOR 钉住仍存活的两处,防「改回 absolute」这类绕过扫描面的回退。
 */
export const SCRIM_EXEMPT = [];

/**
 * 回退锚 —— 仍存活的设备卡菜单必须一直**被扫描面看得见**；消息中心已改为普通全屏页面。
 * 与 SCRIM_EXEMPT 极性相反:那张是「别管这些」,这张是「这些必须在管辖内」。
 * why:光靠数值判据挡不住「把 position 改回 absolute」——形态一变判据就看不见它,
 * 于是 z 掉回 110 也全绿(这正是本轮之前的真实状态)。锚按文件断言,改名/删除同样红。
 */
export const BAND_ANCHOR = [
  "src/components/earn/device-card-pc.vue",
];

/** 一段 CSS 声明是不是「全屏遮罩」:position:fixed + 四边贴边 + 带 z-index;是则返回 z */
function scrimZ(body) {
  if (!/position:\s*fixed/.test(body)) return null;
  const zm = body.match(/z-index:\s*(\d+)/);
  if (!zm) return null;
  const fullBleed =
    /inset:\s*0(\s|;|$)/.test(body) ||
    (/top:\s*0/.test(body) && /right:\s*0/.test(body) && /bottom:\s*0/.test(body) && /left:\s*0/.test(body));
  return fullBleed ? parseInt(zm[1], 10) : null;
}

/**
 * 同一个形态的第三种写法:`<script>` 里的 JS 样式对象(`position: "fixed"` + `zIndex: 790`),
 * 由 `:style="xxxStyle"` 绑上去。引号 + camelCase,scrimZ 的 CSS 正则一个都对不上。
 * 🔴 这条轴不是假想:2026-08-17 按它一扫,当场扫出三处**从没被任何门看见过**的违例 ——
 * device-deactivate-sheet / fx-rate-line / wallet-withdraw 的费用说明半屏都是 79/80,
 * 正是 2026-08-16 修付款半屏时那个「比 790/800 少一位数」的笔误同族;那轮只修好了写在
 * <style> 块里的三张,写成 JS 对象的这三张连红都没红过(其中一张还在提现路径上)。
 */
function scrimZFromJsObject(win) {
  if (!/position:\s*["']fixed["']/.test(win)) return null;
  const zm = win.match(/zIndex:\s*["']?(\d+)["']?/);
  if (!zm) return null;
  const fullBleed =
    /inset:\s*["']?0/.test(win) ||
    (/top:\s*["']?0/.test(win) && /right:\s*["']?0/.test(win) && /bottom:\s*["']?0/.test(win) && /left:\s*["']?0/.test(win));
  return fullBleed ? parseInt(zm[1], 10) : null;
}

/**
 * 扫「全屏遮罩」——position:fixed 且四边贴边、且带 z-index。
 * 这个形态就是模态层(遮罩铺满视口、吃掉底下的点击),与它的 z 数值无关;
 * 底盘 chrome(header 只贴 top/left/right、tabbar 只贴 bottom)不满足四边贴边,天然排除。
 * 🔴 两种写法都要扫:<style> 块里的规则**和** <template> 里的内联 style。只扫前者时,
 * 「同一个形态换个写法」就整块隐形 —— 实测 PC 设备卡长按菜单(内联 fixed+inset:0+z:200)
 * 被庆祝盖住多时,而门一直报 0 违例,把它从豁免清单摘掉也照样绿。
 */
export function scanFullScreenScrims(files) {
  const out = [];
  for (const f of files) {
    // 用 stripComments(空格填充)而不是删除:行号不漂,且注释里的示例样式不算数
    const text = stripComments(f.text);
    const styleOnly = text.replace(/<template[\s\S]*?<\/template>/g, (m) => m.replace(/[^\n]/g, " "));
    const ruleRe = /([.#][\w-]+(?:\[[^\]]*\])?)\s*\{([^}]*)\}/g;
    let m;
    while ((m = ruleRe.exec(styleOnly)) !== null) {
      const z = scrimZ(m[2]);
      if (z === null) continue;
      out.push({ file: f.rel, line: styleOnly.slice(0, m.index).split("\n").length, sel: m[1], z });
    }
    const attrRe = /style="([^"]*)"/g;
    while ((m = attrRe.exec(text)) !== null) {
      const z = scrimZ(m[1]);
      if (z === null) continue;
      out.push({ file: f.rel, line: text.slice(0, m.index).split("\n").length, sel: "内联 style", z });
    }
    // 第三种写法:<script> 里的 JS 样式对象。从每个 position:"fixed" 往回找对象起点,
    // 取一段窗口当作这个对象的声明体(足够覆盖一个样式对象,不会跨到下一个)。
    const jsRe = /position:\s*["']fixed["']/g;
    while ((m = jsRe.exec(text)) !== null) {
      const start = text.lastIndexOf("{", m.index);
      if (start < 0) continue;
      const z = scrimZFromJsObject(text.slice(start, start + 900));
      if (z === null) continue;
      out.push({ file: f.rel, line: text.slice(0, m.index).split("\n").length, sel: "JS 样式对象", z });
    }
    // 🔴 第四种写法:定位来自 **UnoCSS 原子类**(`class="fixed inset-0"`),z-index 来自
    // 同一个标签的内联 style 或 `z-<n>` 原子类。前三种判据都要求「position 与 z-index 出现在
    // 同一段声明体里」,而这一种**天生分居两处**:class 里只有定位、style 里只有层级,
    // 任何一边单看都不成立 —— 于是 capacity-explainer / tradein-ladder 两张说明半屏
    // 一直在判据之外(它们眼下是 900 没违例,但改成 90 也不会红)。按**标签**取属性再判。
    const tagRe = /<[a-zA-Z][\w-]*\s([^>]*?)\/?>/g;
    while ((m = tagRe.exec(text)) !== null) {
      const attrs = m[1];
      const cls = (attrs.match(/class="([^"]*)"/) || ["", ""])[1];
      if (!/(^|\s)fixed(\s|$)/.test(cls)) continue;
      const fullBleed =
        /(^|\s)inset-0(\s|$)/.test(cls) ||
        (/(^|\s)top-0(\s|$)/.test(cls) && /(^|\s)right-0(\s|$)/.test(cls) &&
         /(^|\s)bottom-0(\s|$)/.test(cls) && /(^|\s)left-0(\s|$)/.test(cls));
      if (!fullBleed) continue;
      const styleAttr = (attrs.match(/style="([^"]*)"/) || ["", ""])[1];
      const zm = styleAttr.match(/z-index:\s*(\d+)/) || cls.match(/(?:^|\s)z-\[?(\d+)\]?(?:\s|$)/);
      if (!zm) continue;
      out.push({ file: f.rel, line: text.slice(0, m.index).split("\n").length, sel: "原子类定位", z: parseInt(zm[1], 10) });
    }
  }
  return out;
}
export const BUSINESS_BAND_CEIL = 8999;
export const MILESTONE_FILE = "src/components/milestone-celebration.vue";

/* ── 契约 ②:允许高于滑块的白名单(只有模拟硬件 chrome)────────────────────── */
export const CEILING_EXEMPT = [
  { file: "src/components/toast-host.vue", reason: "瞬时提示不拦截点击，高于验证码才看得见断网等提示" },
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
  // 🔴 判据是**结构**不是数值窗口(2026-08-16 第二轮收紧):原先按 z ∈ [700,8999] 取带,
  // 对落在窗外的违例天生失明 —— 实测把付款半屏退回 79/80,门 0 违例照报绿,而那正是
  // 「庆祝盖住锁仓按钮」的现场。现在改成认「全屏遮罩」这个形态:position:fixed 且四边
  // 贴边(inset:0 或 top/right/bottom/left 全 0)+ 带 z-index = 模态层,与它的数值无关。
  const businessBand = scanFullScreenScrims(files).filter(
    (h) => h.z <= BUSINESS_BAND_CEIL && h.file !== MILESTONE_FILE
      && !CEILING_EXEMPT.some((e) => e.file === h.file)
      && !SCRIM_EXEMPT.some((e) => e.file === h.file),
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

  // ③-锚 曾经的欠账三处必须**仍在扫描面内**(不是「值对不对」,是「门还看不看得见它」)。
  //     只断言数值挡不住形态回退:改回 position:absolute 或把样式挪成内联,判据就整块失明,
  //     此时 z 掉回 110 也全绿。按文件钉,改名 / 删除 / 换写法一律红。
  //     文件被删 / 改名同样红(照 LADDER 的老规矩:不许因为「遍历不到」而静默放行)。
  const bandFiles = new Set(scanFullScreenScrims(files).map((h) => h.file));
  for (const rel of BAND_ANCHOR)
    if (!bandFiles.has(rel))
      problems.push(
        `扫描面丢了成员:${rel} 不再被识别为全屏遮罩 —— 它 2026-08-17 才从 110/120/200 迁进业务带,` +
          `形态一改(absolute / 挪写法)判据就看不见它,z 掉回去也不会红`,
      );

  // ② 天花板。两种验证码都必须解析到，且严格保持同级；它们是唯一允许等于安全天花板的组件。
  const capt = rungs.find((r) => r.sel === ".cs-layer");
  const captchaControls = CAPTCHA_SECURITY_CONTROLS.map((control) => {
    const hit = byRel.has(control.file) ? zHitOf(byRel.get(control.file), control.sel) : null;
    return { ...control, hit, z: hit?.z ?? null };
  });
  for (const control of captchaControls) {
    if (control.z === null)
      problems.push(`验证码安全层级解析不到:${control.file} ${control.sel} —— 被删/改名/改写法都算红`);
    else if (capt?.z != null && control.z !== capt.z)
      problems.push(`验证码安全层级不一致:${control.role}(${control.z}) 必须 = 本地滑块验证码(${capt.z})`);
  }
  const exemptFiles = new Set(CEILING_EXEMPT.map((e) => e.file));
  // 只豁免验证码规则内**那一个** z-index 声明，不能按文件排除：同组件中新加的业务
  // 浮层即使也写 9500，仍会在这里被抓住。
  const captchaRuleOffsets = new Map(captchaControls.filter((control) => control.hit).map((control) => [control.file, control.hit.offset]));
  const ceilingHits = scanAll(files);
  const over = capt?.z == null ? [] : ceilingHits.filter((h) =>
    h.z >= capt.z && !exemptFiles.has(h.file) && captchaRuleOffsets.get(h.file) !== h.offset,
  );
  for (const h of over)
    problems.push(`天花板破了:${h.file}:${h.line} z-index ${h.z} ≥ 滑块 ${capt.z} —— 滑块是阻断式安全控件,不许有业务浮层压在它上面`);

  return { rungs, problems, scanned: files.length, ceilingScanned: ceilingHits.length };
}


const res = evaluate();
if (res.problems.length) {
  console.error(`层级秩序: ${res.problems.length} 处违例\n`);
  for (const m of res.problems.slice(0, 10)) console.error("  " + m);
  if (res.problems.length > 10) console.error(`  …另有 ${res.problems.length - 10} 处同类(多为滑块被压低后「全世界都在它上面」的连带)`);
  console.error(`\n秩序表见 src/components/captcha-slider.vue 顶部注释(单源)。验证码同级实现只能改 CAPTCHA_SECURITY_CONTROLS；业务例外才可改 CEILING_EXEMPT 并写 reason。`);
  process.exit(1);
}
console.log(
  `层级秩序: 0 违例(阶梯 ${res.rungs.length} 级 ${res.rungs.map((r) => `${r.sel}=${r.z}`).join(" < ")};天花板扫 ${res.scanned} 个 .vue / ${res.ceilingScanned} 处 z-index)`
);
