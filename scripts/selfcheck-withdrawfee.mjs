#!/usr/bin/env node
// FEAT-WD02 提现费纯逻辑自检 — node 直跑,不起 Vue/uni:
//   node scripts/selfcheck-withdrawfee.mjs
//
// 守的核心不变量(新模型,取代 WD01c「网络费夹逼 + 惩罚费」):
//   ① 费用 = 每笔固定网络确认费(按网络取值);默认**不抵扣**(offsetWithNex=false 永不烧 NEX)。
//   ② 开抵扣:nexBurned = min(userNex, ceil(费/offsetRate));actualFee = max(0, 费 − 烧×率)。
//   ③ 🔴 feeWaived = min(费, 烧×率) —— ceil 过烧时账单只准记实际减免(3 NEX 抵 $1 费,
//      feeWaived 必须是 $1.00 不是 $1.20;NEX 账单 memo 直接吃这个数,独立证伪抓出的反例)。
//   ④ 🔴 offsetRate ≤ 0 除零守卫 —— 少了它 ceil(fee/0)=∞ → 烧光全部 NEX 抵 $0(同上反例)。
//   ⑤ 配置判据三键齐全 ∈[0,25](0 合法);快照校验 isWithdrawalFeeSnapshotValid 拦意图/等式坏单。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { transformSync } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, "src", "store", "nex-faucet.ts"), "utf8");

// nex-faucet.ts 顶部 import 了 pinia 等运行时依赖,纯逻辑自检不需要也起不来。
// 只截取纯函数转译 —— 与 selfcheck-fx 直接整文件转译的差别在此,故单独说明。
function grabFn(name) {
  const start = src.indexOf(`export function ${name}(`);
  if (start < 0) throw new Error(`selfcheck-withdrawfee: 源码里找不到 ${name}(实现被改名或删除?)`);
  // 先跳过参数表(括号配对)—— 参数的对象类型注解自带 { },直接数花括号会在参数表内截断。
  let p = src.indexOf("(", start);
  let paren = 0;
  for (; p < src.length; p++) {
    if (src[p] === "(") paren++;
    else if (src[p] === ")") { paren--; if (paren === 0) { p++; break; } }
  }
  let depth = 0;
  let started = false;
  for (; p < src.length; p++) {
    if (src[p] === "{") { depth++; started = true; }
    else if (src[p] === "}") { depth--; if (started && depth === 0) return src.slice(start, p + 1); }
  }
  throw new Error(`selfcheck-withdrawfee: ${name} 括号不闭合`);
}

const constMax = src.match(/export const NETWORK_CONFIRM_FEE_MAX_USD = (\d+)/);
if (!constMax) throw new Error("selfcheck-withdrawfee: NETWORK_CONFIRM_FEE_MAX_USD 常量丢失");
const bundle = [
  `const NETWORK_CONFIRM_FEE_MAX_USD = ${constMax[1]};`,
  grabFn("computeWithdrawFee"),
  grabFn("isNetworkFeeConfigUsable"),
  grabFn("isWithdrawalFeeSnapshotValid"),
].join("\n");
const { code } = transformSync(bundle.replace(/export function/g, "export function"), { loader: "ts", format: "esm" });
const { computeWithdrawFee, isNetworkFeeConfigUsable, isWithdrawalFeeSnapshotValid } = await import(
  "data:text/javascript;base64," + Buffer.from(code, "utf8").toString("base64")
);

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}`); }
}
const near = (a, b, tol = 0.0001) => Math.abs(a - b) < tol;

// mock seed 口径(platform-config.ts):trc20/bep20 $1 · erc20 $5;抵扣率 $0.40/NEX(§13.4 全 phase)
const TRC = 1;
const ERC = 5;
const OFFSET = 0.4;

{
  // 阳光1:默认不抵扣。TRC20 提 $100 → 费 $1、到手 $99;不出现 penalty 字段。
  const r = computeWithdrawFee(100, 1240, false, OFFSET, TRC);
  check("默认关:费 $1(固定,不随金额比例)", near(r.networkConfirmUsd, 1) && near(r.actualFee, 1));
  check("默认关:到手 $99", near(r.netReceive, 99));
  check("🔴 默认关:NEX 一枚不烧(有 1240 NEX 也不烧 —— server 无意图永不烧)", r.nexBurned === 0 && near(r.feeWaived, 0));
  check("结果无 penalty/grossFee 字段(旧模型概念已删)", !("penaltyFee" in r) && !("grossFee" in r) && !("networkFee" in r));
}

{
  // 阳光2:开抵扣 + NEX 充足。费 $1、率 $0.40 → requiredNex = ceil(2.5) = 3(整数拍板)。
  const r = computeWithdrawFee(100, 1240, true, OFFSET, TRC);
  check("开抵扣:全抵所需 NEX = 3(ceil(1/0.4),整数)", r.requiredNex === 3);
  check("开抵扣:烧 3 NEX、实付 $0、到手 $100", r.nexBurned === 3 && near(r.actualFee, 0) && near(r.netReceive, 100));
  check("🔴 feeWaived 封顶费本身($1.00,不是 3×0.4=$1.20 —— NEX 账单 memo 吃这个数)", near(r.feeWaived, 1));
  check("实付不为负", r.actualFee >= 0);
}

{
  // 异常1:部分抵扣。userNex=2 < required 3 → 烧 2、抵 $0.8、实付 $0.2。
  const r = computeWithdrawFee(100, 2, true, OFFSET, TRC);
  check("部分抵:烧 2 NEX、抵 $0.80、实付 $0.20", r.nexBurned === 2 && near(r.feeWaived, 0.8) && near(r.actualFee, 0.2));
  check("部分抵:到手 $99.80", near(r.netReceive, 99.8));
}

{
  // NEX=0 勾选 → 烧 0、全额付费。
  const r = computeWithdrawFee(100, 0, true, OFFSET, TRC);
  check("NEX=0 开抵扣:烧 0、实付 $1", r.nexBurned === 0 && near(r.actualFee, 1));
}

{
  // 金额 0 → 费 0(没转账就没这笔费)。
  const r = computeWithdrawFee(0, 1240, true, OFFSET, TRC);
  check("金额 0:费 0、烧 0、到手 0", near(r.networkConfirmUsd, 0) && r.nexBurned === 0 && near(r.netReceive, 0));
}

{
  // ERC20 $5 键值正确取用:required = ceil(5/0.4) = 13;13×0.4 = 5.2 → waived 封顶 $5。
  const r = computeWithdrawFee(100, 1240, true, OFFSET, ERC);
  check("ERC20 $5:required 13、烧 13、抵 $5.00(封顶)、实付 $0", r.requiredNex === 13 && r.nexBurned === 13 && near(r.feeWaived, 5) && near(r.actualFee, 0));
}

{
  // server 权威校验等式:|actualFee − max(0, fee − nexBurned×0.4)| ≤ 0.0001(逐场景)。
  const cases = [
    computeWithdrawFee(100, 1240, true, OFFSET, TRC),
    computeWithdrawFee(100, 2, true, OFFSET, TRC),
    computeWithdrawFee(100, 0, true, OFFSET, TRC),
    computeWithdrawFee(100, 1240, false, OFFSET, ERC),
    computeWithdrawFee(37.5, 7, true, OFFSET, ERC),
  ];
  check("等式 |actualFee − max(0, fee − 烧×0.4)| ≤ 0.0001(5 场景)",
    cases.every((r) => near(r.actualFee, Math.max(0, r.networkConfirmUsd - r.nexBurned * OFFSET))));
}

{
  // 🔴 除零反例(独立证伪构造):offsetRate=0 且勾选 → 必须烧 0,不许烧光 999 NEX 抵 $0。
  const r0 = computeWithdrawFee(100, 999, true, 0, TRC);
  check("🔴 offsetRate=0:烧 0、实付全费(禁 Infinity 烧光)", r0.nexBurned === 0 && near(r0.actualFee, 1) && Number.isFinite(r0.requiredNex));
  const rn = computeWithdrawFee(100, 999, true, -0.4, TRC);
  check("offsetRate<0:同样烧 0", rn.nexBurned === 0 && near(rn.actualFee, 1));
}

{
  // fee=$0 网络(拍板项3):开着也消耗 0、不出负数,费行照显 $0.00。
  const r = computeWithdrawFee(100, 1240, true, OFFSET, 0);
  check("$0 免费网络:费 0、烧 0、到手全额", near(r.networkConfirmUsd, 0) && r.nexBurned === 0 && near(r.netReceive, 100));
}

// ── 配置判据(T1):三键齐全 ∈[0,25];任一键缺失/NaN/-1/26 → false;0 与 25 → true ──
{
  check("合法种子 {1,1,5} 放行", isNetworkFeeConfigUsable({ trc20: 1, bep20: 1, erc20: 5 }) === true);
  check("0 合法($0 免费网络)", isNetworkFeeConfigUsable({ trc20: 0, bep20: 0, erc20: 0 }) === true);
  check("25 合法(边界含等于)", isNetworkFeeConfigUsable({ trc20: 25, bep20: 25, erc20: 25 }) === true);
  // 🔴 与 admin normalize 的 30→invalid 同数字系固定靶:上限单边改会两边一起红。
  check("🔴 26 超值域判不可用(admin 侧同族固定靶为 30→invalid)", isNetworkFeeConfigUsable({ trc20: 1, bep20: 1, erc20: 26 }) === false);
  check("-1 判不可用", isNetworkFeeConfigUsable({ trc20: -1, bep20: 1, erc20: 5 }) === false);
  check("NaN 判不可用", isNetworkFeeConfigUsable({ trc20: NaN, bep20: 1, erc20: 5 }) === false);
  check("缺键判不可用(bep20 缺)", isNetworkFeeConfigUsable({ trc20: 1, erc20: 5 }) === false);
  check("undefined / null 判不可用",
    isNetworkFeeConfigUsable(undefined) === false && isNetworkFeeConfigUsable(null) === false);
}

// ── server 侧快照校验(T3 接线用;mock 同构 POST /api/withdrawals 的拒单判据) ──
{
  check("快照:合法全抵单放行(fee$1 烧3 实付0,开抵扣)",
    isWithdrawalFeeSnapshotValid({ networkConfirmUsd: 1, nexBurned: 3, actualFeeUsd: 0 }, true, OFFSET) === true);
  check("快照:默认关 + 烧 0 放行",
    isWithdrawalFeeSnapshotValid({ networkConfirmUsd: 1, nexBurned: 0, actualFeeUsd: 1 }, false, OFFSET) === true);
  check("🔴 快照:意图关但烧了 NEX → 拒单(无意图永不烧)",
    isWithdrawalFeeSnapshotValid({ networkConfirmUsd: 1, nexBurned: 3, actualFeeUsd: 0 }, false, OFFSET) === false);
  check("🔴 快照:等式不成立 → 拒单(fee$1 烧0 实付$0.5)",
    isWithdrawalFeeSnapshotValid({ networkConfirmUsd: 1, nexBurned: 0, actualFeeUsd: 0.5 }, false, OFFSET) === false);
  check("快照:负数/NaN/缺失 → 拒单",
    isWithdrawalFeeSnapshotValid({ networkConfirmUsd: -1, nexBurned: 0, actualFeeUsd: 0 }, false, OFFSET) === false
    && isWithdrawalFeeSnapshotValid({ networkConfirmUsd: NaN, nexBurned: 0, actualFeeUsd: 0 }, false, OFFSET) === false
    && isWithdrawalFeeSnapshotValid(null, false, OFFSET) === false);
}

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
