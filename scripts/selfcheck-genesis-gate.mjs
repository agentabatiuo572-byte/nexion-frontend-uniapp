#!/usr/bin/env node
// 创世「购买可用性单一派生」的机器门(规格 FEAT-GEN10 ④)— node 直跑:
//   node scripts/selfcheck-genesis-gate.mjs
//
// ══ 本门的来历,以及第一版为什么是假的 ═══════════════════════════════════════
//
// v1(2026-08-05 上午):此前 composable 注释里写着这个文件名,而**文件根本不存在**。
//   补建之后,判据是「文件里同时出现 return "marketClosed"/"halted"/"soldOut"/"preSale"
//   四句才算有一套判定」。当天下午独立验收**实测构造了 6 种绕法,全部放行**:
//     ① `if (!loaded || marketStatus === "closed") return false;` ← **上一轮那条缺陷的原样复发**
//     ② 只抄两档 ③ 换单引号 ④ 用模板字面量 ⑤ 写成三元链 ⑥ 先赋值再 return
//   外加:文件清单写死 7 个,**新文件根本不扫**,而消费面是开放集合。
//   也就是说 v1 拦不住它唯一该拦的那种错误 —— 一个「看起来像门」的东西。
//
// v2(本文件)针对性重建:
//   🔴 **两条正交判据**,因为绕法①**不含任何档位字面量**,只靠扫字面量必漏:
//      ④a 产出面:任一档位值在纯函数外**被产出**即红(不管什么引号 / 三元 / 先赋值后返回);
//      ④b 输入面:决策输入(marketStatus / loaded)只许在白名单文件里被**比较**——
//          绕法①正是「不产出档位值、直接拿输入自己判」,只有这条抓得住。
//   🔴 扫**全 src/**,不写死文件清单;扫到 0 个文件直接判红(空集会让全称判据恒真)。
//   🔴 每条判据配**真**红测:把改坏的文本**喂回该条判据本身**,看它转不转红 ——
//      v1 的红测写成 `!(s.replaceAll("X","x").includes("X"))`,那是**恒真**的
//      (换掉 X 之后当然找不到 X),拿空字符串、拿一首诗跑都 true,从未喂回任何判据。
//
// 方法:行为断言用 esbuild 载**真纯函数**跑;结构断言跑在剥注释后的正主源码上。
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";
import { atAliasResolver } from "./lib/at-alias.mjs";
import { strip } from "./lib/strip-code.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(root, "src");

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

/** 递归列出 src 下所有 .ts/.vue(**不写死清单**:消费面是开放集合,新文件必须自动进扫描面)。 */
function allSources(dir = SRC, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) allSources(p, out);
    else if (/\.(ts|vue)$/.test(name)) out.push(path.relative(root, p).replaceAll("\\", "/"));
  }
  return out;
}

console.log("selfcheck-genesis-gate — 购买可用性必须只有一处判定(v2:v1 被实测绕过 6 种后重建)");

const KINDS = ["marketClosed", "halted", "soldOut", "preSale", "configUnavailable"];
const OWNER = "src/store/genesis-config.ts";     // 判定本体唯一宿主
/** 允许比较决策**输入**的文件:本体 + 它的唯一消费入口。别处比较 = 自己判了一套。 */
const INPUT_ALLOW = new Set([OWNER, "src/composables/use-genesis-sale-gate.ts"]);

// ── ① 优先级链:**用行为证明**,不读源码顺序 ─────────────────────────────────
const FUTURE = 4102444800000;
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
    check(`🔴 ① ${label}(期望 ${want ?? "null"})`, b(input) === want, `实得 ${b(input)}`);
  }
  check(`① 售罄判据认 <=0 而非 ===0`, b({ remaining: -1 }) === "soldOut", `实得 ${b({ remaining: -1 })}`);
}

// ── ② 二级市场 ──────────────────────────────────────────────────────────────
{
  const s = (o) => genesisSecondaryBlock({ loaded: true, marketStatus: "open", now: base.now, ...o });
  check(`🔴 ② 二级不受主售售罄影响`, s({}) === null, `实得 ${s({})}`);
  check(`🔴 ② 二级照样被市场关闭拦`, s({ marketStatus: "closed" }) === "marketClosed", `实得 ${s({ marketStatus: "closed" })}`);
  check(`🔴 ② 二级照样被配置未知拦`, s({ loaded: false }) === "configUnavailable", `实得 ${s({ loaded: false })}`);
}

// ── ③ 紧迫感闸 ──────────────────────────────────────────────────────────────
{
  const want = { null: true, preSale: true, marketClosed: false, halted: false, soldOut: false, configUnavailable: false };
  for (const [k, expect] of Object.entries(want)) {
    const v = k === "null" ? null : k;
    check(`③ 紧迫感:${k} → ${expect ? "允许" : "禁止"}`, genesisShowsUrgency(v) === expect, `实得 ${genesisShowsUrgency(v)}`);
  }
}

// ══ ④a 产出面:档位值只许在本体里被产出 ══════════════════════════════════════
/**
 * 判「产出」而非「出现」。**产出** = 该字面量不是比较运算的操作数,也不是 case 标签。
 * 覆盖 v1 漏掉的:单引号 / 模板字面量 / 三元链 / 先赋值再 return / 只抄两档。
 */
function producedKinds(src) {
  const hits = [];
  for (const k of KINDS) {
    // 三种引号形态各扫一遍
    const re = new RegExp(`(['"\`])${k}\\1`, "g");
    let m;
    while ((m = re.exec(src)) !== null) {
      const before = src.slice(Math.max(0, m.index - 40), m.index);
      const after = src.slice(m.index + m[0].length, m.index + m[0].length + 6);
      const isCompare = /[=!]==?\s*$/.test(before) || /^\s*[=!]==?/.test(after) || /\bcase\s+$/.test(before)
        || /\.includes\(\s*$/.test(before) || /\bhas\(\s*$/.test(before)
        // 🔴 Vue 模板属性绑定 `v-else-if="preSale"` / `:foo="preSale"` 是**引用同名变量**,
        //   不是产出该字符串。首跑就被它误报(单个 `=` 前面是字母,与 `===` 区分开)。
        || /[\w\-\]]=$/.test(before);
      if (!isCompare) hits.push(k);
    }
  }
  return [...new Set(hits)];
}
{
  const files = allSources();
  check(`④ 扫描面非空(实测 ${files.length} 个源文件;写死清单会漏掉新文件)`, files.length > 100, `只扫到 ${files.length} 个`);
  const offenders = files
    .filter((f) => f !== OWNER)
    .map((f) => [f, producedKinds(strip(readFileSync(path.join(root, f), "utf8"), true))])
    .filter(([, k]) => k.length > 0);
  check(`🔴 ④a 档位值只在本体被产出(实测越界 ${offenders.length} 处)`, offenders.length === 0,
    offenders.slice(0, 3).map(([f, k]) => `${f}:${k.join("/")}`).join(" | "));
  check(`④a 本体自己确实产出全部 ${KINDS.length} 档(否则判据在跟空集比)`,
    producedKinds(strip(readFileSync(path.join(root, OWNER), "utf8"), true)).length === KINDS.length,
    `本体只产出 ${producedKinds(strip(readFileSync(path.join(root, OWNER), "utf8"), true)).length} 档`);
}

// ══ ④b 输入面:决策输入只许在白名单文件里被比较 ══════════════════════════════
// 🔴 绕法① `if (!loaded || marketStatus === "closed") return false;` **不含任何档位值**,
//    只有这条判据抓得住 —— 它拿决策**输入**自己判了一套。
{
  const files = allSources();
  const offenders = [];
  for (const f of files) {
    if (INPUT_ALLOW.has(f)) continue;
    const src = strip(readFileSync(path.join(root, f), "utf8"), true);
    // 比较 marketStatus,或把 .loaded 当布尔条件用(!x / x && / x ||)
    if (/marketStatus\s*[=!]==/.test(src)) offenders.push(`${f}:marketStatus 比较`);
    if (/[!(]\s*\w+\.loaded\b|\w+\.loaded\s*(&&|\|\|)/.test(src)) offenders.push(`${f}:loaded 当条件`);
  }
  check(`🔴 ④b 决策输入只在 ${INPUT_ALLOW.size} 个白名单文件里被比较(实测越界 ${offenders.length} 处)`,
    offenders.length === 0, offenders.slice(0, 3).join(" | "));
}

// ══ ⑤ 接线 + 基数台账 ═══════════════════════════════════════════════════════
{
  const CONSUMERS = [
    ["src/pages/genesis/genesis.vue", "useGenesisSaleGate"],
    ["src/components/store/genesis-showcase-card.vue", "useGenesisSaleGate"],
    ["src/pages/genesis/marketplace.vue", "useGenesisSaleGate"],
    ["src/components/genesis/purchase-sheet.vue", "useGenesisSaleGate"],
    ["src/store/genesis.ts", "genesisPurchaseBlock"],
  ];
  for (const [f, sym] of CONSUMERS) {
    check(`⑤ ${f.split("/").pop()} 接线到单源`, strip(readFileSync(path.join(root, f), "utf8"), true).includes(sym), "没接线 = 它在自己判");
  }
  // 🔴 基数台账:门都在遍历现存成员,**删掉一个消费者没有任何遍历会走到它**。
  const actual = allSources().filter((f) => strip(readFileSync(path.join(root, f), "utf8"), true).includes("useGenesisSaleGate")).length;
  // 基数台账(改动数字必须同时说明原因):
  //   genesis.vue · genesis-showcase-card.vue · marketplace.vue · purchase-sheet.vue
  //   · quick-action-row.vue · holder.vue · composable 自身定义处 = 7
  //   🔴 首跑时我写的是 6 —— 因为后来给购买半屏也接了闸却忘了同步这个数。
  //   基数台账正是为了逼出这种「加了消费者没登记 / 摘了闸没人知道」。
  const EXPECTED_GATE_CONSUMERS = 7;
  check(`🔴 ⑤ 闸消费者基数 = ${EXPECTED_GATE_CONSUMERS}(实测 ${actual})`, actual === EXPECTED_GATE_CONSUMERS,
    `数量变了就同步改这个数并说明:新增了消费者,还是有人把闸摘了`);
}

// ══ ⑥ 紧迫感元素受闸 —— **逐渲染点**判,不是「文件里出现过就算」 ═══════════════
// v1 是文件级:只要文件里有一次 showUrgency 就放行,第三处 tier.left 不接闸照样绿。
/**
 * 🔴 判据是**表达式级**,不是文件级,也不能是死板的单行级:
 *   - 文件级(v1)太松:文件里出现过一次 showUrgency 就放行,第三处不接闸照样绿;
 *   - 单行级(v2 首跑)太紧:`const x = computed(() =>` 与闸在**不同行**,
 *     Vue 模板里定义处与渲染处也常常分离 —— 首跑就把两处正确实现误报了。
 *   折中:取该行**上下各 3 行**的窗口(足够覆盖一个多行表达式或一个模板元素),
 *   窗口内必须出现闸。窗口大小写死在这里,改它要同时改红测。
 */
const URGENCY_WINDOW = 3;
function urgencySitesUngated(src) {
  const lines = src.split(/\r?\n/);
  const bad = [];
  lines.forEach((line, i) => {
    // 🔴 用**带域前缀的完整键路径**,不用裸子串:`notHolderBody` 会误命中变量名
    //   `notHolderBodyText`(那是渲染点,闸在它的定义里),把正确实现判成漏网。首跑即暴露。
    if (!/genesis\.tier\.left|genesis\.leftSuffix|home\.quickGenesisLeft|genesisHolder\.notHolderBody|store\.genesisCardLeft/.test(line)) return;
    if (/messages\//.test(line)) return;
    const win = lines.slice(Math.max(0, i - URGENCY_WINDOW), i + URGENCY_WINDOW + 1).join("\n");
    if (!/showUrgency|genesisUrgencyOk/.test(win)) bad.push(`L${i + 1}: ${line.trim().slice(0, 60)}`);
  });
  return bad;
}
{
  const RENDER_FILES = [
    "src/pages/genesis/genesis.vue", "src/components/store/genesis-showcase-card.vue",
    "src/components/home/quick-action-row.vue", "src/pages/genesis/holder.vue",
  ];
  for (const f of RENDER_FILES) {
    const bad = urgencySitesUngated(strip(readFileSync(path.join(root, f), "utf8"), true));
    check(`🔴 ⑥ ${f.split("/").pop()} 的每个「余席」渲染点都在同一表达式内受闸`, bad.length === 0, bad.join(" | "));
  }
  const g = strip(readFileSync(path.join(root, "src/pages/genesis/genesis.vue"), "utf8"), true);
  check(`🔴 ⑥ 社会证明播报受闸`, /function emitSocial\(\)[\s\S]{0,400}showUrgency/.test(g), "关闭态仍播成交");
  check(`🔴 ⑥ 已售数推进受闸`, /tickSales[\s\S]{0,200}showUrgency|showUrgency[\s\S]{0,200}tickSales/.test(g), "关闭态已售数仍自增");
  check(`🔴 ⑥ dock 取色不再按 remaining 判`, !g.includes("remaining.value > 0"), "还有取色点按老条件走");
}

// ══ 红测自证:每条结构判据**把改坏的文本喂回它自己** ═════════════════════════
// 🔴 v1 的红测是 `!(s.replaceAll("X","x").includes("X"))` —— **恒真**,拿空字符串、
//    拿一首诗跑都 true,从未喂回任何判据。下面每条都真的喂回去。
{
  // ④a:6 种绕法逐个隔离,每种都必须被认出来
  const evasions = {
    "只抄两档": `if (m === "closed") return "marketClosed";\nif (r <= 0) return "soldOut";`,
    "单引号": KINDS.map((k) => `return '${k}';`).join("\n"),
    "模板字面量": KINDS.map((k) => "return `" + k + "`;").join("\n"),
    "三元链": `return c ? "marketClosed" : h ? "halted" : "soldOut";`,
    "先赋值再return": `const r = "marketClosed"; return r;`,
  };
  for (const [label, code] of Object.entries(evasions)) {
    check(`红测自证:④a 认得出绕法「${label}」`, producedKinds(code).length > 0, "放行了 = 门有洞");
  }
  check(`红测自证:④a 不把 case 映射误判成产出`,
    producedKinds(KINDS.map((k) => `case "${k}": return t.x;`).join("\n")).length === 0, "误报文案映射");
  check(`红测自证:④a 不把 === 比较误判成产出`,
    producedKinds(`if (b === "marketClosed") show();`).length === 0, "误报比较");
  // ④b:绕法① —— 不含任何档位值的手写判定
  const evasion1 = `if (!cfg.loaded || cfg.config.marketStatus === "closed") return false;`;
  check(`🔴 红测自证:④b 认得出绕法①(上一轮缺陷的原样复发,**v1 放行的那个**)`,
    /marketStatus\s*[=!]==/.test(evasion1) || /[!(]\s*\w+\.loaded\b/.test(evasion1), "④b 也漏了 = 两条判据都白建");
  // ⑥:把闸从渲染行上摘掉,该条必须转红
  const gated = `<text v-if="showUrgency">{{ fmt(t.genesis.tier.left, { n }) }}</text>`;
  const ungated = gated.replace(/ v-if="showUrgency"/, "");
  check(`红测自证:⑥ 摘掉行内闸后必须转红`,
    urgencySitesUngated(gated).length === 0 && urgencySitesUngated(ungated).length === 1,
    `受闸态 ${urgencySitesUngated(gated).length} 条 / 摘闸态 ${urgencySitesUngated(ungated).length} 条`);
}

console.log(`\n${pass} pass / ${fail} fail(样本:7 组优先级固定靶 · 3 组二级 · 6 种紧迫感态 · 全 src 扫描 · 2 条正交结构判据 · 9 条判据红测自证含 v1 被绕的 6 种形态)`);
process.exit(fail === 0 ? 0 : 1);
