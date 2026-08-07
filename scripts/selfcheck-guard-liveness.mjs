#!/usr/bin/env node
/**
 * 守卫存活性门(2026-08-07 · 同族第三次复发后的结构根治)
 *
 * 守的不变量:**周期性权限守卫(questTimer)是安全装置,不是业务循环。**
 *   它只随前台/后台成对开关 —— onShow 起、onHide 停,其余任何时候都必须活着。
 *
 * 为什么要机器门而不是写个约定:这一族已经修过三轮,每轮都只修了「武装侧」——
 *   R1 修读取口归一(守卫看错路由)· R2 修 onShow 无条件启动(冷启动那一枪被吞)
 *   —— 三轮都没人动「解除武装侧」,因为 stopQuestWatch() 藏在 stopBusinessLoops() 里,
 *   看起来天经地义。叠加 H5 的 App 级 onShow 不随应用内跳转触发(只在整页加载 /
 *   标签页重新可见时),守卫一旦被关就**没有任何重新武装的路径**,本次页面加载内永久死亡。
 *   后果实测:登出态可停在提现页看到余额并把金额填进输入框。
 *
 * 同一根因的第二条腿:落地页被当成本次加载的永久状态 —— scheduleAccountSessionBootstrap
 *   在静态评审页落地时直接 return,而认领是一次性的,于是该标签永无 sessionId;
 *   session.validate() 首行「没有 sessionId 就算 active」→ 跨标签登出/运营吊销永远踢不掉它。
 *   故本门同时守「守卫每拍补一次会话认领」。
 *
 * 判据构造性:四个代码块按名定位,**任一块定位不到即判红**(判据失效不许静默放行);
 *   并在每次运行时对内存副本做四组缺陷注入自证,注入后仍全绿说明判据已死 → 判红。
 */
import fs from "node:fs";

const FILE = "src/App.vue";
const src = fs.readFileSync(FILE, "utf8");

/** 按名取出代码块体(函数声明 / onShow(() => {…}) 这类回调都适用)。取不到返回 null。 */
function blockBody(text, marker) {
  const at = text.indexOf(marker);
  if (at < 0) return null;
  const open = text.indexOf("{", at);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return null;
}

const BLOCKS = {
  stopBusinessLoops: "function stopBusinessLoops()",
  checkQuestRoute: "function checkQuestRoute()",
  onShow: "onShow(",
  onHide: "onHide(",
};

/** 判据全集。每条 = {名, 取块, 判定}。判定返回 true = 该条通过。 */
const CHECKS = [
  {
    id: "guard-not-a-business-loop",
    block: "stopBusinessLoops",
    desc: "守卫不在 stopBusinessLoops 里(它是安全装置,不随业务一起关)",
    ok: (b) => !/stopQuestWatch\s*\(/.test(b),
  },
  {
    id: "guard-stops-only-on-background",
    block: "onHide",
    desc: "守卫的唯一停点在 onHide(进后台才停,回前台由 onShow 重新武装)",
    ok: (b) => /stopQuestWatch\s*\(/.test(b),
  },
  {
    id: "guard-armed-unconditionally",
    block: "onShow",
    desc: "onShow 里无条件启动守卫(不得落在任何提前 return 之后或条件块内)",
    ok: (b) => {
      const lines = b.split(/\r?\n/);
      const idx = lines.findIndex((l) => /^ {2}startQuestWatch\s*\(/.test(l)); // 顶层缩进 2 空格
      if (idx < 0) return false; // 不在顶层 = 被包进了条件块
      // 它前面不许有顶层 return(那等于「某些情况下守卫不启动」)
      return !lines.slice(0, idx).some((l) => /^ {2}return\b/.test(l));
    },
  },
  {
    id: "session-claim-retried-by-guard",
    block: "checkQuestRoute",
    desc: "守卫每拍补一次会话认领(落地页不决定本次加载的余生)",
    ok: (b) => /bootstrapAccountSession\s*\(/.test(b),
  },
];

/** 对给定源码跑一遍全部判据,返回 {pass, fail:[…]}。块定位不到 = 该条判红。 */
function evaluate(text) {
  const fail = [];
  let pass = 0;
  for (const c of CHECKS) {
    const body = blockBody(text, BLOCKS[c.block]);
    if (body === null) { fail.push(`${c.id}: 定位不到代码块 ${BLOCKS[c.block]} —— 判据已失效`); continue; }
    if (c.ok(body)) pass++;
    else fail.push(`${c.id}: ${c.desc}`);
  }
  return { pass, fail };
}

/** 缺陷注入器:每条判据配一个「把它打红」的改法,用来自证判据还活着。 */
const INJECTIONS = [
  {
    id: "guard-not-a-business-loop",
    label: "把 stopQuestWatch 塞回 stopBusinessLoops",
    apply: (t) => t.replace(/( {2}stopMilestonePoll\(\);\r?\n)(\})/, (m, a, b) => `${a}  stopQuestWatch();\n${b}`),
  },
  {
    id: "guard-stops-only-on-background",
    label: "删掉 onHide 里的 stopQuestWatch",
    apply: (t) => {
      const at = t.indexOf("onHide(");
      if (at < 0) return t;
      return t.slice(0, at) + t.slice(at).replace(/\r?\n\s*stopQuestWatch\(\);/, "");
    },
  },
  {
    id: "guard-armed-unconditionally",
    label: "把 onShow 里的 startQuestWatch 挪到提前 return 之后",
    apply: (t) => t.replace(/( {2})startQuestWatch\(\);/, (m, ind) => `${ind}return;\n${ind}startQuestWatch();`),
  },
  {
    // 🔴 必须按块定位再删 —— 文件里 bootstrapAccountSession() 有两处同缩进调用
    // (另一处在 scheduleAccountSessionBootstrap 里),全局 replace 会删错那一处、
    // 判据照样绿。本门第一版就栽在这里,是自证把它抓出来的。
    id: "session-claim-retried-by-guard",
    label: "删掉守卫里的会话认领",
    apply: (t) => {
      const at = t.indexOf(BLOCKS.checkQuestRoute);
      if (at < 0) return t;
      return t.slice(0, at) + t.slice(at).replace(/\r?\n {2}bootstrapAccountSession\(\);/, () => "");
    },
  },
];

const real = evaluate(src);
const selfFail = [];
let selfPass = 0;
for (const inj of INJECTIONS) {
  const mutated = inj.apply(src);
  if (mutated === src) { selfFail.push(`红测自证[${inj.id}]:注入没改动源码 —— 注入器已过时,自证无效`); continue; }
  const r = evaluate(mutated);
  const caught = r.fail.some((f) => f.startsWith(inj.id + ":"));
  if (caught) selfPass++;
  else selfFail.push(`红测自证[${inj.id}]:${inj.label} 之后判据仍绿 —— 这条判据是死的`);
}

const allFail = [...real.fail, ...selfFail];
for (const f of allFail) console.log("  FAIL " + f);
const total = real.pass + selfPass;
console.log(
  allFail.length === 0
    ? `${total} pass / 0 fail(不变量 ${CHECKS.length} 条 · 判据红测自证 ${INJECTIONS.length} 条)`
    : `${total} pass / ${allFail.length} fail`,
);
process.exit(allFail.length === 0 ? 0 : 1);
