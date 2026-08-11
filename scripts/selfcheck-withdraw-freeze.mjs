#!/usr/bin/env node
// D5 real-boundary sentinel. The server owns pricing, NEX burn, wallet
// reservation, withdrawal order and ledgers; the App only freezes intent and
// mirrors the canonical response.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pageRaw = readFileSync(path.join(root, "src", "pages", "me", "wallet-withdraw.vue"), "utf8");
const appRaw = readFileSync(path.join(root, "src", "store", "app.ts"), "utf8");
const apiRaw = readFileSync(path.join(root, "src", "api", "withdrawal-api.ts"), "utf8");
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

function grabBlock(source, needle) {
  const start = source.indexOf(needle);
  if (start < 0) throw new Error(`selfcheck-withdraw-freeze: missing ${needle}`);
  let depth = 0;
  for (let index = source.indexOf("{", start); index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`selfcheck-withdraw-freeze: unclosed ${needle}`);
}

let passed = 0;
let failed = 0;
function check(name, condition) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}`);
  }
}

console.log("selfcheck-withdraw-freeze — D5 server-authoritative submission boundary");
const page = strip(pageRaw);
const app = strip(appRaw);
const api = strip(apiRaw);
const submit = grabBlock(page, "async function handleSubmit()");
const appSubmit = grabBlock(app, "async function submitWithdrawal(");
const snapAt = submit.indexOf("const snap = {");
const firstAwaitAt = submit.indexOf("await ");
const identityAt = submit.indexOf("app.accountKey !== snap.account");
const realSubmitAt = submit.indexOf("await app.submitWithdrawal(");

check("提交意图在首个 await 前冻结", snapAt >= 0 && firstAwaitAt > snapAt);
check("快照包含账号、网络、地址、金额、抵扣意图、policyVersion 与幂等键",
  ["account:", "network:", "address:", "amount:", "offset:", "policyVersion:", "idempotencyKey:"]
    .every((key) => submit.slice(snapAt, snapAt + 900).includes(key)));
check("确认后先复核账号/网络/地址，再调用真实提交", identityAt >= 0 && realSubmitAt > identityAt);
check("页面按快照提交 policyVersion 与抵扣意图",
  /submitWithdrawal\(\s*snap\.amount,\s*snap\.network,\s*snap\.address,\s*snap\.fee,\s*snap\.offset,\s*snap\.policyVersion,\s*snap\.idempotencyKey/.test(submit));

// ── 幂等键的一生(2026-08-11 独立审计 P0)──
// 键此前在 handleSubmit 里每次点击现铸 → 超时重试 = 服务端第二张单;catch 又把所有异常
// 一律报成「费率已更新,请重试」,主动把用户推去建那第二张单。三道门各钉一段:
// 铸(不许现铸)→ 存(发请求前落盘)→ 判(结果未知时保留键、不刷费率、不喊重试)。
const readAttemptAt = submit.indexOf("readWithdrawAttempt(");
const rememberAt = submit.indexOf("rememberWithdrawAttempt(");
const catchAt = submit.indexOf("} catch (", realSubmitAt);
const catchTail = catchAt >= 0 ? submit.slice(catchAt) : "";

check("幂等键不在提交函数里现铸(超时重试必须复用同一个键)",
  !/idempotencyKey:[^\n]*(?:Date\.now|Math\.random|randomUUID)/.test(submit));
check("快照优先取落盘的冻结件(重放要与首次逐字节相同,否则同键异 body 撞 409)",
  readAttemptAt >= 0 && snapAt > readAttemptAt && /idempotencyKey:\s*pending\?\./.test(submit));
// 落盘失败必须拒发:写不进去 = 这一次没有重放保护,超时后认不回那个键,用户一重试就是第二张单。
check("未收口的提交尝试在请求发出前落盘,且落盘失败即拒发",
  rememberAt >= 0 && rememberAt < realSubmitAt && /if \(!rememberWithdrawAttempt\(/.test(submit));
// 刷费率只许出现在「服务端已定局拒绝」那一支的**大括号之内**:结果未知时刷它 →
// policyVersion 变 → 重放的 body 跟着变 → 撞「同键异 body → 409 + 安全事件」。
// 🔴 判据必须按大括号配对划界,不能按「另一个标识符出现在第几个字符」—— 后者能被
// 「插在那个标识符前面」整个绕过(本门自己的变异测试抓到的洞)。
const settledNeedle = "if (isSettledRejection(err)) {";
let policyRefreshOnlyInSettled = false;
if (catchTail.includes(settledNeedle)) {
  const settledBlock = grabBlock(catchTail, settledNeedle);
  const from = catchTail.indexOf(settledBlock);
  const to = from + settledBlock.length;
  policyRefreshOnlyInSettled = ![...catchTail.matchAll(/loadWithdrawalPolicy/g)]
    .some((hit) => hit.index < from || hit.index >= to);
}

check("失败按结果分层:定局才退役键,结果未知时留键、不刷费率、不喊重试",
  catchTail.includes("isIdempotencyConflict(")
  && catchTail.includes("isSettledRejection(")
  && catchTail.includes("withdrawOutcomeUnknown")
  && !catchTail.includes("withdrawFeeStale")
  && policyRefreshOnlyInSettled);
check("页面提交路径没有本地扣 USDT、烧 NEX 或伪造提现账单",
  !/app\.(?:debitBalance|debitNex)\(/.test(submit)
  && !/bills\.(?:add|addForAccount)\(/.test(submit));
check("policy 只从真实 GET /api/withdrawals/policy 获取且失败置空",
  /withdrawalPolicy\.value\s*=\s*await withdrawalApi\.policy\(\)/.test(page)
  && /withdrawalPolicy\.value\s*=\s*null/.test(page)
  && /method:\s*"GET",\s*path:\s*"\/api\/withdrawals\/policy"/.test(api));
check("POST 只发用户意图与版本，不接受客户端费用金额",
  /method:\s*"POST",\s*path:\s*"\/api\/withdrawals"/.test(api)
  && /body:\s*\{\s*amount,\s*chain,\s*address:\s*targetAddress,\s*policyVersion,\s*useNexFeeOffset\s*\}/.test(api)
  && !/body:\s*\{[^}]*networkConfirmUsd/.test(api));
check("幂等键透传到真实 POST", /idempotencyKey,\s*timeoutMs:\s*30_000/.test(api));
check("响应严格要求服务端费用/NEX/净到账快照与 policyVersion",
  ["networkConfirmUsd", "nexBurned", "feeWaived", "actualFee", "netReceive", "policyVersion", "useNexFeeOffset", "idSource"]
    .every((field) => api.includes(field))
  && /row\.idSource !== "server"/.test(api));
check("App 只镜像服务端 canonical order，不改本地余额桶", /withdrawalApi\.submit\(/.test(appSubmit)
  && /toCanonicalWithdrawal\(submission, address\)/.test(appSubmit)
  && !/(?:debitBalance|debitNex|creditRewardBucketOnce)\(/.test(appSubmit));

console.log(`\n${passed} pass / ${failed} fail`);
process.exit(failed ? 1 : 0);
