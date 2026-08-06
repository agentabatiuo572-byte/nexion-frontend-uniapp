// selfcheck-slacopy —— 「对用户承诺的时限,必须来自配置」哨兵。
//
// 缘起(2026-08-01 独立走查 P0-2):同一笔提现,页面给了四个互相打架的到账说法 ——
// 网络行「5 分钟」、免审横幅「立即处理」、页脚「首次审核 24 小时」,而**提交前强制勾选确认**的
// 风险披露 §04 写着「标准提现约 30 天」「> $1,000 进 45 天窗口」。系统实际:提交 + payoutSlaHours,
// 大额审查窗口当前阶段配置为 0 天。写死的数字既对不上实现,运营改配置也不会跟着变。
//
// 🔴 本文件 2026-08-01 被哨兵自审推翻重写过一次。旧版三宗罪,写在这里免得重犯:
//   ① 判据 /\b\d+\s*(天|days?|ngày)\b/ —— JS 的 \b 只认 ASCII,「30 天。」尾部不成边界,
//      **中文那一面完全不设防**,而中文是验收看的那一面。为 P0 建的门对该 P0 原文敞开。
//   ② 用 indexOf + slice 抠字符串取值 —— 折行 / 单引号 / 嵌套同名 key / 跨 namespace 全踩,
//      且 indexOf 未命中返回 -1 喂给 slice 切出空串后**判 PASS**(候选为空全过)。
//   ③ 红测靠「{h} 被删掉」变红,那条「不许写死时长」的子判据**从头到尾没被触发过**。
// 现版:真解析读对象 + 判据写成语义(挖掉占位符后不许剩数字)+ 每个合取项各有独立红测。
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMessages, at, hasHardcodedNumber } from "./lib/i18n-load.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}

const LOCALES = ["zh", "en", "vi"];
const msgs = {};
for (const l of LOCALES) msgs[l] = await loadMessages(l);

// 🔴 时限文案 key 白名单。范围收窄到枚举出来的 key,而不是「扫整个 namespace 前 4000 字」——
// 后者既会被 staking 的正当锁仓档位(30/90/180/365)误伤,又会因窗口截断漏掉块尾新增的 key。
const SLA_KEYS = [
  "riskDisclosure.s4Body",
  "riskDisclosure.s4BodyLargeAmount",
  "terms.s6Body",
];

for (const l of LOCALES) {
  for (const key of SLA_KEYS) {
    const v = at(msgs[l], key);
    // 候选为空必须判失败:key 被改名 / 删掉时,这里要红,不能因为「没扫到就没违规」而放行。
    check(`[${l}] ${key} 存在`, typeof v === "string" && v.length > 0, v === undefined ? "取不到值" : String(v));
    check(`[${l}] ${key} 不含写死数字(挖掉占位符后)`, !hasHardcodedNumber(v),
      typeof v === "string" ? v.slice(0, 70) : "取不到值");
  }
  // 各自必须带的占位符(缺了 = 数字没接上配置)
  check(`[${l}] s4Body 带 {h}`, String(at(msgs[l], "riskDisclosure.s4Body") ?? "").includes("{h}"));
  check(`[${l}] s4BodyLargeAmount 带 {d} 与 {large}`,
    ["{d}", "{large}"].every((m) => String(at(msgs[l], "riskDisclosure.s4BodyLargeAmount") ?? "").includes(m)));
  check(`[${l}] terms.s6Body 带 {h}`, String(at(msgs[l], "terms.s6Body") ?? "").includes("{h}"));
  // 首审提示改成不给时间承诺后,它自己也不许再出现数字
  check(`[${l}] wallet.firstTimeReview 不做时间承诺(系统对人工复核无推进机制)`,
    !hasHardcodedNumber(at(msgs[l], "wallet.firstTimeReview")),
    String(at(msgs[l], "wallet.firstTimeReview") ?? ""));
}

// ── 接线门:文案带了占位符,页面没插值 = 用户直接看到 "{h}" ────────
// 判据锚定到目标标识符所在的**那个函数体**,不做整文件撒网(整文件 includes 可被
// 「把表达式搬进死函数 / 写进注释」穿过)。
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const rd = stripComments(read("src/pages/me/risk-disclosure.vue"));
const tm = stripComments(read("src/pages/onboarding/terms.vue"));

/**
 * 取一个 `const x = computed(() => {...})` 的完整函数体 —— 用**括号配对**,不用 indexOf 找 `});`。
 * 找字面 `});` 会被内层的 `fmt(..., { ... })` 提前截断(实测就这么断的),
 * 截断后判据落在半截代码上,红绿都不可信。解析器脆性是本轮哨兵自审点名的一族。
 */
function bodyOf(src, startMark) {
  const i = src.indexOf(startMark);
  if (i < 0) return null;
  let depth = 0, started = false;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (c === "(" || c === "{") { depth++; started = true; }
    else if (c === ")" || c === "}") {
      depth--;
      if (started && depth === 0) return src.slice(i, k + 1);
    }
  }
  return null;
}

const wwBody = bodyOf(rd, "const withdrawWindowBody = computed(");
check("🔴 披露页 §04 的时长真的插了 payoutSlaHours(不插值 = 用户看到 {h})",
  !!wwBody && wwBody.includes("w.value.s4Body") && wwBody.includes("normalizeSlaHours") && wwBody.includes("payoutSlaHours"),
  wwBody ? "" : "找不到 withdrawWindowBody 函数体");
check("🔴 大额审查句按窗口配置门控(配 0 不能显示「0 天窗口」)",
  !!wwBody && wwBody.includes("payoutReviewWindowDays") && /return base/.test(wwBody));
// 判据必须钉到 **`d:` 这个绑定本身**。只查「函数体里出现过 normalizeReviewWindowDays」太松:
// 门控那行也含它,把 `d:` 上的 clamp 摘掉照样绿(红测实证)——一个判据守两件事就会这样。
check("🔴 大额窗口天数与实现同口径夹值域(实现夹 30 天,文案不夹 = 配 3650 就写「3650 天」)",
  !!wwBody && /d:\s*normalizeReviewWindowDays\(/.test(wwBody));
check("🔴 门控也走同一个 clamp(负值 / NaN 时整句不出现)",
  !!wwBody && /normalizeReviewWindowDays\([^)]*\)\s*<=\s*0/.test(wwBody));
check("🔴 §04 真的用了派生结果渲染,不是直接铺原串",
  rd.includes("body: withdrawWindowBody.value"));
check("🔴 条款页 §06 同口径插值",
  tm.includes("normalizeSlaHours") && tm.includes("payoutSlaHours") && tm.includes("w.s6Body"));

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
