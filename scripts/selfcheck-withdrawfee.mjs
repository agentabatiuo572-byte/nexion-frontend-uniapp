#!/usr/bin/env node
// FEAT-WD01c 提现费纯逻辑自检 — node 直跑,不起 Vue/uni:
//   node scripts/selfcheck-withdrawfee.mjs
//
// 守的核心不变量:**总费 = 网络费 + 金额 × 惩罚费率**。
// 后端对这条等式有硬校验(admin d-client `withdrawal.financialInvariants`,误差 > 0.0001 判非法);
// 前端曾只算惩罚费那半截,接真后端后会出现「页面显示的费 < 实扣」——资金面最不能出的错。
// 另守:网络费上下限夹取、NEX 抵扣作用于总费(不是只抵惩罚费)、金额 0 不产生费。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { transformSync } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, "src", "store", "nex-faucet.ts"), "utf8");

// nex-faucet.ts 顶部 import 了 pinia 等运行时依赖,纯逻辑自检不需要也起不来。
// 只截取两个纯函数转译 —— 与 selfcheck-fx 直接整文件转译的差别在此,故单独说明。
function grabFn(name) {
  const start = src.indexOf(`export function ${name}(`);
  if (start < 0) throw new Error(`selfcheck-withdrawfee: 源码里找不到 ${name}(实现被改名或删除?)`);
  let depth = 0;
  let started = false;
  for (let p = start; p < src.length; p++) {
    if (src[p] === "{") { depth++; started = true; }
    else if (src[p] === "}") { depth--; if (started && depth === 0) return src.slice(start, p + 1); }
  }
  throw new Error(`selfcheck-withdrawfee: ${name} 括号不闭合`);
}

// 🔴 isNetworkFeeConfigUsable 必须一起测。第 4 轮复验实证:它此前**零行为覆盖** ——
// 删掉「费率不得超 5%」那条判据,本自检与 feegate 双绿,而后端下发 50% 费率时
// 提 $100 会变成「网络费 $50 + 平台费 $20 = 到手 $30」,页面当正常明细照渲。
// 那 5% 是后台 D5 的法定上限,而这个函数是**唯一执行者**。
const bundle = [grabFn("computeNetworkFee"), grabFn("computeWithdrawFee"), grabFn("isNetworkFeeConfigUsable")].join("\n");
const { code } = transformSync(bundle, { loader: "ts", format: "esm" });
const { computeWithdrawFee, computeNetworkFee, isNetworkFeeConfigUsable } = await import(
  "data:text/javascript;base64," + Buffer.from(code, "utf8").toString("base64")
);

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}`); }
}
const near = (a, b, tol = 0.0001) => Math.abs(a - b) < tol;

// mock seed 口径(platform-config.ts withdrawRules):1% / 下限 $1 / 上限 $25;惩罚 20%;抵扣 $0.4/NEX
const NET = { rate: 0.01, min: 1, max: 25 };
const PEN = 0.2;
const OFFSET = 0.4;

{
  const r = computeWithdrawFee(100, 0, PEN, OFFSET, NET);
  check("提$100:网络费 $1(1% 被下限顶起)", near(r.networkFee, 1));
  check("提$100:惩罚费 $20", near(r.penaltyFee, 20));
  check("提$100:总费 $21 = 网络 + 惩罚", near(r.grossFee, 21));
  // 后端不变量原式:|grossFee − networkFee − amount×penaltyRate| ≤ 0.0001
  check("提$100:满足后端财务不变量", near(r.grossFee - r.networkFee - 100 * PEN, 0));
  check("提$100:抵满所需 NEX = 52.5(按总费算,非按惩罚费的 50)", near(r.requiredNex, 52.5));
  check("提$100:到手 $79", near(r.netReceive, 79));
}

{
  // 下限存在的理由:按比例算是 $0.1,付不起真实链上 gas
  const r = computeWithdrawFee(10, 0, PEN, OFFSET, NET);
  check("提$10:网络费按下限取 $1(非 $0.1)", near(r.networkFee, 1));
}

{
  // 上限存在的理由:大额按比例会收走 $100,远超真实 gas
  const r = computeWithdrawFee(10000, 0, PEN, OFFSET, NET);
  check("提$10000:网络费按上限封顶 $25(非 $100)", near(r.networkFee, 25));
}

{
  // NEX 抵扣必须覆盖总费,而不是只抵惩罚费 —— 否则用户烧满 NEX 仍被扣网络费,与后端不一致
  const r = computeWithdrawFee(100, 99999, PEN, OFFSET, NET);
  check("NEX 充足:实扣 0(抵扣覆盖含网络费的总费)", near(r.actualFee, 0));
  check("NEX 充足:到手 = 提现额 $100", near(r.netReceive, 100));
  check("NEX 充足:实扣不为负", r.actualFee >= 0);
}

{
  // 部分抵扣:烧 50 NEX 抵 $20,总费 $21 → 实扣 $1
  const r = computeWithdrawFee(100, 50, PEN, OFFSET, NET);
  check("NEX 部分(50):抵 $20、实扣 $1", near(r.feeWaived, 20) && near(r.actualFee, 1));
}

{
  // 金额 0 不套下限 —— 否则用户没输金额就看到「网络费 $1」,且总费 > 提现额
  const r = computeWithdrawFee(0, 0, PEN, OFFSET, NET);
  check("金额 0:网络费 0、总费 0(下限不生效)", near(r.networkFee, 0) && near(r.grossFee, 0));
  check("金额 0:到手 0", near(r.netReceive, 0));
}

{
  // 坏配置容错:min > max 不得算出负数或 NaN
  const bad = computeWithdrawFee(100, 0, PEN, OFFSET, { rate: 0.01, min: 30, max: 5 });
  check("坏配置 min>max:网络费非负且有限", bad.networkFee >= 0 && Number.isFinite(bad.networkFee));
  check("任何情况下到手 ≤ 提现额(后端 netReceive ≤ amount)", bad.netReceive <= 100);
}

{
  // 费率为 0 的边界(运营把网络费关掉):仍取下限?不 —— rate 0 时比例为 0,被 min 顶起是预期,
  // 运营要真关掉网络费应把 min 也设 0。此断言固化该语义,防止后续误改成「rate 0 即免费」。
  check("rate=0 且 min=0:网络费 0", near(computeNetworkFee(100, { rate: 0, min: 0, max: 25 }), 0));
  check("rate=0 但 min=1:网络费仍取 $1(关费率须同时清下限)", near(computeNetworkFee(100, { rate: 0, min: 1, max: 25 }), 1));
}

// ── 🔴 配置校验器的行为覆盖(2026-07-31 第 4 轮复验补) ──────────────
// 它是「后台下发的费率合不合法」的**唯一执行者**,此前**零行为覆盖** ——
// 独立验收实测:删掉「费率不得超 5%」那条判据后,本自检与 feegate 双绿,
// 而后端下发 50% 费率时提 $100 变成「网络费 $50 + 平台费 $20 = 到手 $30」,
// 页面把它当正常费用明细照渲,无失败态。5% 是后台 D5 的法定上限。
{
  check("合法配置放行", isNetworkFeeConfigUsable({ rate: 0.01, min: 1, max: 25 }) === true);
  check("🔴 费率超 5% 法定上限判不可用(50% 会让 $100 只到手 $30)",
    isNetworkFeeConfigUsable({ rate: 0.5, min: 1, max: 100000 }) === false);
  check("费率恰好 5% 放行(边界含等于)",
    isNetworkFeeConfigUsable({ rate: 0.05, min: 1, max: 25 }) === true);
  check("费率 5.01% 判不可用", isNetworkFeeConfigUsable({ rate: 0.0501, min: 1, max: 25 }) === false);
  check("负费率判不可用", isNetworkFeeConfigUsable({ rate: -0.01, min: 1, max: 25 }) === false);
  check("NaN 费率判不可用", isNetworkFeeConfigUsable({ rate: NaN, min: 1, max: 25 }) === false);
  check("NaN 下限判不可用", isNetworkFeeConfigUsable({ rate: 0.01, min: NaN, max: 25 }) === false);
  check("NaN 上限判不可用", isNetworkFeeConfigUsable({ rate: 0.01, min: 1, max: NaN }) === false);
  check("负下限判不可用", isNetworkFeeConfigUsable({ rate: 0.01, min: -1, max: 25 }) === false);
  check("下限 > 上限判不可用", isNetworkFeeConfigUsable({ rate: 0.01, min: 30, max: 5 }) === false);
  check("缺字段判不可用", isNetworkFeeConfigUsable({ rate: 0.01, min: 1 }) === false);
  check("undefined / null 判不可用",
    isNetworkFeeConfigUsable(undefined) === false && isNetworkFeeConfigUsable(null) === false);
}

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
