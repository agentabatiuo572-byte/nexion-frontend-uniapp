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
const mutationRaw = readFileSync(path.join(root, "src", "lib", "funds-mutation-key.ts"), "utf8");
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
const mutation = strip(mutationRaw);
const submit = grabBlock(page, "async function handleSubmit()");
const appSubmit = grabBlock(app, "async function submitWithdrawal(");
const snapAt = submit.indexOf("const snap = {");
const firstAwaitAt = submit.indexOf("await ");
const identityAt = submit.indexOf("app.accountKey !== snap.account");
const realSubmitAt = submit.indexOf("await app.submitWithdrawal(");

check("提交意图在首个 await 前冻结", snapAt >= 0 && firstAwaitAt > snapAt);
check("快照包含账号、网络、地址、金额、抵扣意图与 policyVersion；幂等键由持久意图注册表生成",
  ["account:", "network:", "address:", "amount:", "offset:", "policyVersion:"]
    .every((key) => submit.slice(snapAt, snapAt + 900).includes(key))
  && /pendingFundsMutationKey\(mutation\)/.test(appSubmit)
  && /nexgrid-funds-pending-mutations-v1/.test(mutation)
  && !/(?:Date\.now|Math\.random)/.test(appSubmit));
check("确认后先复核账号/网络/地址，再调用真实提交", identityAt >= 0 && realSubmitAt > identityAt);
check("页面按快照提交 policyVersion 与抵扣意图",
  /submitWithdrawal\(\s*snap\.amount,\s*snap\.network,\s*snap\.address,\s*snap\.fee,\s*snap\.offset,\s*snap\.policyVersion/.test(submit));
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
