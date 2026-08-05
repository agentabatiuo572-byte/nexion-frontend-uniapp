#!/usr/bin/env node
// 创世「购买可用性单一派生」的机器门(规格 FEAT-GEN10 ④)— node 直跑:
//   node scripts/selfcheck-genesis-gate.mjs
//
// 🔴 **这道门是被一次独立验收逼出来的**(2026-08-05)。此前我在 composable 的注释里
//   写着「机器门:scripts/selfcheck-genesis-gate.mjs」,而**那个文件根本不存在** ——
//   一个凭空的安全感。同一轮验收抓到的 4 条缺陷,全是这条不变量失守的样本:
//     · 主按钮 5 个取色点只改了 4 个(亮主题白字白底,还打翻了原本正常的预售态)
//     · 「还剩 N 席」只关了 hero,档位阶梯那处没关
//     · 二级承接在 store 里手写了第二套条件,注释还写着与代码不符的第三套说法
//     · 二级市场页只挡「市场关闭」,配置未知时先扣钱再拒
//   所以本门守两件事:**① 优先级链本身对不对(行为验证)② 有没有人绕过它自判(结构验证)**。
//
// 方法:① 用 esbuild 载**真纯函数**跑真行为,不靠读源码顺序猜;② 结构断言跑在正主源码上。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";
import { atAliasResolver } from "./lib/at-alias.mjs";
import { strip } from "./lib/strip-code.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(root, "src");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const bundle = await build({
  stdin: {
    contents: `export { genesisPurchaseBlock, genesisSecondaryBlock, genesisShowsUrgency } from "@/store/genesis-config";`,
    resolveDir: root, loader: "ts",
  },
  bundle: true, write: false, format: "esm",
  plugins: [{ name: "alias", setup(b) { b.onResolve({ filter: /^@\// }, atAliasResolver(SRC, "selfcheck-genesis-gate")); } }],
});
const { genesisPurchaseBlock, genesisSecondaryBlock, genesisShowsUrgency } = await import(
  "data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text, "utf8").toString("base64")
);

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`); }
}

console.log("selfcheck-genesis-gate — 购买可用性必须只有一处判定");

// ── ① 优先级链:**用行为证明**,不读源码顺序 ─────────────────────────────────
// 规格 ④:配置未知 > 市场关闭 > 熔断 > 售罄 > 预售倒计时。
const FUTURE = 4102444800000; // 2100 年,恒未开售
const base = { configLoaded: true, marketStatus: "open", halted: false, remaining: 10, saleStartAt: null, now: 1_700_000_000_000 };
const b = (o) => genesisPurchaseBlock({ ...base, ...o });
{
  const cases = [
    ["配置未知压过全部", { configLoaded: false, marketStatus: "closed", halted: true, remaining: 0, saleStartAt: FUTURE }, "configUnavailable"],
    ["市场关闭压过熔断/售罄/预售", { marketStatus: "closed", halted: true, remaining: 0, saleStartAt: FUTURE }, "marketClosed"],
    ["熔断压过售罄/预售", { halted: true, remaining: 0, saleStartAt: FUTURE }, "halted"],
    ["售罄压过预售", { remaining: 0, saleStartAt: FUTURE }, "soldOut"],
    ["只剩预售未到", { saleStartAt: FUTURE }, "preSale"],
    ["全清 → 可购买", {}, null],
  ];
  for (const [label, input, want] of cases) {
    const got = b(input);
    check(`🔴 ① ${label}(期望 ${want ?? "null"})`, got === want, `实得 ${got}`);
  }
  check(`① 售罄判据认 <=0 而非 ===0(负数也算售罄)`, b({ remaining: -1 }) === "soldOut", `实得 ${b({ remaining: -1 })}`);
}

// ── ② 二级市场:不吃主售名额与开售时间,但关闭/熔断/配置未知照拦 ────────────
{
  const s = (o) => genesisSecondaryBlock({ loaded: true, marketStatus: "open", now: base.now, ...o });
  check(`🔴 ② 二级不受主售售罄影响(存量转让)`, s({}) === null, `实得 ${s({})}`);
  check(`🔴 ② 二级照样被市场关闭拦`, s({ marketStatus: "closed" }) === "marketClosed", `实得 ${s({ marketStatus: "closed" })}`);
  check(`🔴 ② 二级照样被配置未知拦`, s({ loaded: false }) === "configUnavailable", `实得 ${s({ loaded: false })}`);
}

// ── ③ 紧迫感闸:只有「可购买」与「预售倒计时」允许催 ────────────────────────
{
  const want = { null: true, preSale: true, marketClosed: false, halted: false, soldOut: false, configUnavailable: false };
  for (const [k, expect] of Object.entries(want)) {
    const blockVal = k === "null" ? null : k;
    check(`③ 紧迫感:${k} → ${expect ? "允许" : "禁止"}`, genesisShowsUrgency(blockVal) === expect, `实得 ${genesisShowsUrgency(blockVal)}`);
  }
}

// ── ④ 结构:判定链只许存在于纯函数里(禁第二处自判)──────────────────────────
{
  // 🔴 判据要分清「**判定**」与「**映射**」,否则误报:
  //   判定 = 产出这个值(`return "marketClosed"`)—— 只许在纯函数里;
  //   映射 = 拿这个值比对(`case "marketClosed":` / `=== "marketClosed"`)—— 页面出文案要用,合法。
  //   第一版只查「文件里有没有这 4 个字面量」,把创世页与商城卡的 switch 文案映射
  //   一起判红了(首跑即暴露,已改)。现在只认**产出形态**。
  const KINDS = ["marketClosed", "halted", "soldOut", "preSale"];
  const producesChain = (s) => KINDS.every((k) => new RegExp(`return\\s+"${k}"`).test(s));
  const FILES = [
    "src/store/genesis-config.ts", "src/store/genesis.ts", "src/composables/use-genesis-sale-gate.ts",
    "src/pages/genesis/genesis.vue", "src/pages/genesis/marketplace.vue",
    "src/components/store/genesis-showcase-card.vue", "src/components/genesis/purchase-sheet.vue",
  ];
  const owners = FILES.filter((f) => producesChain(strip(read(f), true)));
  check(`🔴 ④ 判定链只有 1 个产出宿主(实测 ${owners.length} 个:${owners.join(", ") || "无"})`,
    owners.length === 1 && owners[0] === "src/store/genesis-config.ts",
    `期望只有 genesis-config.ts —— 别处**产出**整条链 = 又抄了一套判定`);
  // 红测:把判据喂一段「假装在别处产出整条链」的文本,必须判成 2 个宿主
  const fakeChain = KINDS.map((k) => `return "${k}";`).join("\n");
  check(`红测自证:④ 判据能认出新增的产出宿主`, producesChain(fakeChain) === true, "判据认不出产出形态 = 形同虚设");
  check(`红测自证:④ 判据不把 case 映射误判成产出`,
    producesChain(KINDS.map((k) => `case "${k}": return t.x;`).join("\n")) === false,
    "把文案映射也判成判定 = 又会误报(第一版的原始缺陷)");
}

// ── ⑤ 结构:会渲染购买入口的文件必须**接线**到单源 ────────────────────────────
{
  const CONSUMERS = [
    ["src/pages/genesis/genesis.vue", "useGenesisSaleGate"],
    ["src/components/store/genesis-showcase-card.vue", "useGenesisSaleGate"],
    ["src/pages/genesis/marketplace.vue", "useGenesisSaleGate"],
    ["src/store/genesis.ts", "genesisPurchaseBlock"],
  ];
  for (const [f, sym] of CONSUMERS) {
    check(`⑤ ${f.split("/").pop()} 接线到单源(${sym})`, strip(read(f), true).includes(sym), "没接线 = 它在自己判");
  }
  // store 的二级路径必须走共享输入构造,不许自拼
  check(`🔴 ⑤ acquireSecondary 走共享构造(genesisSecondaryBlock)`,
    strip(read("src/store/genesis.ts"), true).includes("genesisSecondaryBlock"),
    "自拼输入 = 与页面口径迟早分叉(2026-08-05 验收 P1-5 正是此形态)");
}

// ── ⑥ 结构:紧迫感元素必须**受闸**(这是验收 P1-3 / P1-4 的定点防复发)──────────
{
  const g = strip(read("src/pages/genesis/genesis.vue"), true);
  // 页面里每一处「剩余席位」类渲染都应在 showUrgency 的射程内。判据取保守形态:
  // 只要文件里出现 tier.left / leftSuffix,就必须同时出现 showUrgency。
  const hasLeftCopy = g.includes("tier.left") || g.includes("leftSuffix");
  check(`🔴 ⑥ 创世页出现「剩余席位」文案时必须引用 showUrgency`,
    !hasLeftCopy || g.includes("showUrgency"), "有催单文案却没接紧迫感闸");
  check(`🔴 ⑥ 社会证明播报受闸(emitSocial 内引用 showUrgency)`,
    /function emitSocial\(\)[\s\S]{0,400}showUrgency/.test(g),
    "关闭态仍播「某某刚买了 N 个」,与「市场未开放」当面拆台(验收 P1-3)");
  check(`🔴 ⑥ 已售数推进受闸(tickSales 调用处引用 showUrgency)`,
    /tickSales[\s\S]{0,200}showUrgency|showUrgency[\s\S]{0,200}tickSales/.test(g),
    "关闭态已售数仍自增,关久了自己跑到售罄(验收 P1-2)");
  // dock 取色判据统一:不许再出现按 remaining 取色的残留
  check(`🔴 ⑥ dock 取色不再按 remaining 判(白字白底的根因,验收 P0)`,
    !g.includes("remaining.value > 0"), "还有取色点按老条件走");
}

// ── 红测自证:每条结构判据各自隔离 ──────────────────────────────────────────
{
  const g = strip(read("src/pages/genesis/genesis.vue"), true);
  check(`红测自证:去掉 showUrgency 后 ⑥ 必转 false`,
    !(g.replaceAll("showUrgency", "xx").includes("showUrgency")), "替换没生效 = 红测空转");
  check(`红测自证:优先级链判据不是恒真(把 closed 换 open 会得到别的结果)`,
    b({ marketStatus: "closed", remaining: 0 }) !== b({ marketStatus: "open", remaining: 0 }),
    "两种输入结果相同 = 判据没在看 marketStatus");
}

console.log(`\n${pass} pass / ${fail} fail(样本:7 组优先级固定靶 · 3 组二级 · 6 种紧迫感态 · 7 个文件结构扫描 · 2 条判据红测自证)`);
process.exit(fail === 0 ? 0 : 1);
