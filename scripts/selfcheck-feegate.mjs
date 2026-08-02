#!/usr/bin/env node
// FEAT-WD01c 提现页费率门控自检 — node 直跑:
//   node scripts/selfcheck-feegate.mjs
//
// 🔴 守两条,都是 2026-07-31 独立验收实测出来、且**当时四道机器门全绿放行**的漏网点:
//   ① 费率不可用时,页面上**任何吃费用数据的区块都不许渲染数字**。
//      漏网史:只给费用明细区加了门,漏了旁边的 NEX 抵扣面板 —— 坏配置下漏 3 处 NaN;
//      失败态下更糟:上方写「费率不可用、已暂停提交」,同屏下方还笃定显示
//      「52.5 NEX 已抵扣 · 手续费全免」,自相矛盾。
//   ② 可用性判据必须含「配置真拉到了」这一项。
//      漏网史:只判了「值合法」。配置拉取失败时 store 仍保留前端种子,值看着合法 →
//      按写死值算费并放行下单,正是规格禁止的回退。
//
// 为什么用文本断言而不是行为断言:这两条是**模板门控**,不是纯逻辑;
// Vue 模板的条件渲染没法脱壳跑。故此处 pin 模板结构,并由浏览器实景走查兜底
// (逐态截图,见 docs/changes 的 T3 验收报告)。文本断言的已知弱点是可被重排绕过,
// 但它守的是「有没有加门」这种增删型改动,不是「控制流搬迁」那种语义型改动。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const page = readFileSync(path.join(root, "src", "pages", "me", "wallet-withdraw.vue"), "utf8");

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`); }
}

// 剥注释:本文件注释里会提到这些串,不剥会让判据被自己的说明污染。
const code = page
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^[ \t]*\/\/.*$/gm, "");

// ── ① 可用性判据:**整式逐字**匹配,不用前缀正则 ──────
// 🔴 漏网史(2026-07-31 第 3 轮复验,已被真实踩中):原判据只锚前缀,
//    在尾部追加 `|| true`(伪装成临时调试开关)即可让整式恒真、把资金门整个架空,
//    而本哨兵与其余四道门**全绿放行**,坏配置下全页 6 处 NaN、失败态再不出现。
//    这与 selfcheck-fastlane 已修掉的「追加析取项」是同一个弱点,在兄弟哨兵里原样复发。
const norm = (s) => s.replace(/\s+/g, " ").trim();
const flat = norm(code);
const FEE_USABLE_DEF = "const feeConfigUsable = computed(() => !cfg.syncFailed && cfg.feeConfigValid);";
check("🔴 费率可用性定义逐字符合规(两个合取项,尾部不得追加任何分支)",
  flat.includes(FEE_USABLE_DEF),
  "定义已偏离 —— 追加 `|| true` 之类会让门恒真而看不出来");
check("不可用时提交被拦(submitDisabledReason 里有这道门)",
  /if \(!feeConfigUsable\.value\) return/.test(code));

// ── ② 所有吃费用数据的区块都挂同一个门 ────────────────
// 🔴 漏网史:原判据只查「门的字面量在文件里存在」,把它搬到一个无害空元素上、
//    再把真面板改回只按金额门控,哨兵照样全绿(重构残留的常见形态)。
//    改法:锚定**这个门和 NEX 面板的容器写在同一个标签上**。
check("🔴 NEX 抵扣面板本体挂了 feeConfigUsable 门(坏配置不渲染 NaN)",
  // 结构锚定 + **允许附加条件**:pin 整串会在正当地多挂一道门时假红(2026-08-01 加
  // quoteBlocked「提交不了就不给报价」时踩到),但仍必须与 nexGateStyle 写在同一标签上。
  (() => {
    const m = code.match(/<view v-if="([^"]*)"[^>]*:style="nexGateStyle">/);
    return !!m && m[1].includes("feeConfigUsable") && m[1].includes("amountNum > 0");
  })(),
  "该面板只按金额门控 = 坏配置漏 NaN + 失败态显示与提示矛盾的费用数字");
check("费用明细区在不可用时整块换成失败态",
  /v-else-if="!feeConfigUsable"/.test(code));
// 警告框那句「上方手续费可抵扣」也吃费用语境(同一类的第三例)
// 抵扣半句必须**两个条件都挂**:费率可用 + 已输入金额。
// 漏网史:第 4 轮只挂了前者 —— 未输入金额时明细区是「输入金额后显示费用明细」,
// 上方并无任何手续费,这句就成了悬空指代;而那正是打开提现页的落地首屏。
check("🔴 警告框的抵扣提示同时挂「费率可用」与「已输入金额」两个门",
  (() => {
    // 同上:锚定到抵扣半句**自己**那个 <text> 的 v-if,允许其上再叠别的门。
    const m = code.match(/<text v-if="([^"]*)">\{\{ t\.wallet\.minWithdrawNoteOffset \}\}<\/text>/);
    return !!m && m[1].includes("feeConfigUsable") && m[1].includes("amountNum > 0");
  })(),
  "少任一个都会变成悬空指代(失败态 / 未输入金额态)");
// 🔴 分隔符必须放在**各语言串自身**,模板里不得硬编码空格。
// 漏网史:第 5 轮我在模板里硬编码了一个西文空格修 `$20.The` 粘连,
// 结果中文渲染成「$20。 上方手续费…」—— 中文句号自带字宽间距,再补空格是排版错误。
// 这是「改一个语言、漏另一个」的同类第 6 例。分隔符归串自身:en/vi 带前导空格,zh 不带。
check("模板不硬编码分隔空格(分隔符归各语言串,CJK 才不会多空格)",
  !/\{\{ ' ' \}\}\{\{ t\.wallet\.minWithdrawNoteOffset \}\}/.test(code));
check("🔴 最低提现额从配置插值,不写死(否则运营调值后同屏两个最低额)",
  /minWithdrawNoteText = computed\(\(\) => fmt\(t\.value\.wallet\.minWithdrawNote, \{ n: minWithdrawable\.value/.test(code));

// ── ③ 四态齐且**加载态可达** ──────────────────────────
// 漏网史:加载态原本排在失败态**后面**,而重试只可能从失败态发起,
// 此时失败态 v-if 恒真 → 骨架永远抢不到 → 死 UI(25ms 采样 14 帧从未出现)。
const orderLoading = code.indexOf('v-if="feeConfigLoading"');
const orderUnusable = code.indexOf('v-else-if="!feeConfigUsable"');
const orderEmpty = code.indexOf('v-else-if="amountNum <= 0"');
check("🔴 加载态排在失败态之前(否则重试期间骨架永远抢不到 = 死 UI)",
  orderLoading >= 0 && orderUnusable > orderLoading,
  `loading@${orderLoading} unusable@${orderUnusable}`);
check("空状态(未输入金额)存在且排在默认态之前",
  orderEmpty > orderUnusable);
check("四态齐(加载 / 不可用 / 未输入 / 默认)",
  orderLoading >= 0 && orderUnusable >= 0 && orderEmpty >= 0 && /v-else class="mx-4 mt-4 space-y-1\.5"/.test(code));
check("失败态给了重试出口",
  /@click="retryFeeConfig"/.test(code) && /async function retryFeeConfig/.test(code));
check("重试真能重拉配置(不是只清本地标志)",
  /await cfg\.load\(\)/.test(code));

// ── ④ 费用标签不得用惩罚费率标注含网络费的总额 ──────────
// 漏网史:`Fee (20%) $21.00` —— $100 的 20% 是 $20 不是 $21。改了明细区那处,
// 另一处原样搬到 NEX 面板,复验又抓出来。两处都必须不传 rate。
check("🔴 总费标签不插值惩罚费率(总额含网络费,标 20% 自相矛盾)",
  !/feeGross,\s*\{\s*rate:/.test(code),
  "feeGrossLabel 仍在传 rate");
check("🔴 NEX 面板的费用文案也不插值惩罚费率(同一矛盾的第二处)",
  !/feePartial,\s*\{\s*rate:/.test(code),
  "partialOffsetText 仍在传 rate —— 复验实见 `fee is 20% ($21.00)`");

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
