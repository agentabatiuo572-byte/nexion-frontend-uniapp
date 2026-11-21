// SPEC-7:活跃参数域、历史读取兼容及退役合同。不是默认值等值检查。
// 活跃6个K1数值键仍锚PC校验域；3个历史键仅核结构及Java退役/存储读取合同。
// 在线证明时长同样只保留兼容结构，禁止重新开放；旧模式读取必须归一为manual_only。
// Java旧修改入口已410，历史促销合同仍按原字段顺序读取storedValue；不再断言旧值域。
// 任一必需源/有限提取锚缺失、模式误重开或未知形态均红，不以空集通过。
// K2/H8检查和K3/K4升级哨兵保持原范围。
//
// 用法:node scripts/spec7-admin-domain-parity.mjs <ADMIN_ROOT> "<riskCluster 键清单>" "<otpGate 键清单>"
// 键清单来自 verify.sh 的 SPEC7_RISKCLUSTER_KEYS / SPEC7_OTPGATE_KEYS(单源,勿在此另抄)。
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [adminRoot, rcKeysArg, ogKeysArg] = process.argv.slice(2);
if (!adminRoot || !rcKeysArg || !ogKeysArg) {
  console.error("usage: spec7-admin-domain-parity.mjs <ADMIN_ROOT> <riskClusterKeys> <otpGateKeys>");
  process.exit(1);
}
const RC_KEYS = rcKeysArg.trim().split(/\s+/);
const OG_KEYS = ogKeysArg.trim().split(/\s+/);

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log(`ok    ${m}`); };
const bad = (m) => { fail++; console.log(`FAIL  ${m}`); };

// 剥注释(k1-release-params-contract.test.mjs 家法):防注释里的历史值/示例值污染提取
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, "")).join("\n");
const read = (p, label) => {
  try { return strip(fs.readFileSync(p, "utf8")); }
  catch { bad(`${label} 读不到:${p}(锚缺失必红,禁静默跳过)`); return null; }
};

const uni = read("src/mock/platform-config.ts", "uniapp 种子");
const kClient = read(path.join(adminRoot, "lib", "admin", "k-client.ts"), "admin k-client");
const hClient = read(path.join(adminRoot, "lib", "admin", "h-client.ts"), "admin h-client");
if (!uni || !kClient || !hClient) {
  console.log(`result: ${pass} pass, ${fail} fail`);
  process.exit(1);
}
const { resolveNexionBackendRoot } = await import(pathToFileURL(path.join(adminRoot, "scripts/lib/nexion-workspace-paths.mjs")).href);
const backendRoot = resolveNexionBackendRoot({ adminRoot });
const javaRelease = read(path.join(backendRoot, "src/main/java/ffdd/opsconsole/risk/application/RiskReleaseParamsService.java"), "Java K1退役合同");
const javaEarnings = read(path.join(backendRoot, "src/main/java/ffdd/opsconsole/finance/application/EarningsReleaseService.java"), "Java收益释放");
if (!javaRelease || !javaEarnings) process.exit(1);

// ── uniapp seed 提取(块内逐键,与 verify.sh 覆盖度门同块口径)──────────────
function seedBlock(src, name) {
  const m = src.match(new RegExp(`${name}: \\{([\\s\\S]*?)\\n  \\}`));
  if (!m) { bad(`uniapp 种子块 ${name} 定位失败(形状变了必红)`); return {}; }
  const out = {};
  for (const kv of m[1].matchAll(/(\w+): ("[^"]*"|true|false|-?[\d.]+)(?=\s*(?:,|$))/g)) out[kv[1]] = kv[2];
  return out;
}
const seedRc = seedBlock(uni, "riskCluster");
const seedOg = seedBlock(uni, "otpGate");
if (Object.keys(seedRc).length !== RC_KEYS.length || RC_KEYS.some(key => !(key in seedRc))) {
  bad("riskCluster 种子键集与调用方键集不一致");
}

// ── admin 值域提取 ─────────────────────────────────────────────────────────
// LIMITS 表:`key: { min: X, max: Y, step: Z, integer: B }`
const limits = {};
for (const m of kClient.matchAll(/(\w+): \{ min: (-?[\d.]+), max: (-?[\d.]+), step: [\d.]+, integer: (true|false) \}/g)) {
  limits[m[1]] = { min: +m[2], max: +m[3], integer: m[4] === "true" };
}
// inline 校验:`key === "<lit>"` 出现点之后**首个 return 语句体**(到分号)抓 >= X / <= Y(/ % N)。
// 截到语句边界是必须的:共行键(captchaAfterSends|maxVerifyAttempts)开定长窗会吞到邻行
// otpTtlSeconds 的 `% 60`,把步长约束误挂到别的键上(首跑实锤)。
function inlineDomain(src, keyLiteral) {
  const at = src.indexOf(`key === "${keyLiteral}"`);
  if (at < 0) return null;
  const stmt = src.slice(at, at + 400).match(/return [^;]*/)?.[0];
  if (!stmt) return null;
  const lo = stmt.match(/>=\s*(-?[\d.]+)/), hi = stmt.match(/<=\s*(-?[\d.]+)/);
  if (!lo || !hi) return null;
  return { min: +lo[1], max: +hi[1], integer: /Number\.isInteger\s*\(/.test(stmt), multiple: stmt.match(/%\s*(\d+)\s*===\s*0/)?.[1] };
}

// ── K1当前读取/编辑分界：四历史键必须过滤，旧mode只可作为读取输入 ────────
// 完整字符串字面量列表，可有尾逗号；表达式不提取合法子串。
const quoted = text => text && /^\s*"[^"]+"(?:\s*,\s*"[^"]+")*\s*,?\s*$/.test(text)
  ? text.match(/"[^"]+"/g).map(value => value.slice(1, -1)) : [];
const sameSet = (actual, expected) => actual.length === expected.length && expected.every(key => actual.includes(key));
// 只压缩代码空白，键名和拒绝原因字符串内的原文必须保留。
const compact = text => text.replace(/"(?:\\.|[^"\\])*"|\s+/g, token => token.startsWith('"') ? token : "");
const pcCompact = compact(kClient), javaCompact = compact(javaRelease);
const retiredKeys = quoted(kClient.match(/RETIRED_K1_RELEASE_KEYS\s*=\s*new Set\(\[([^\]]+)\]/)?.[1]);
const editableKeys = quoted(kClient.match(/K1_RELEASE_PARAM_KEYS\s*=\s*\[([^\]]+)\]/)?.[1]);
const retiredContract = ["freePhoneSlotsPerCluster", "pendingReleaseHours", "appAttestationReleaseHours", "freeSlotRequiresBinding"];
const validators = kClient.match(/(?:export )?function validateK1(?:Release)?ParamValue\b[\s\S]*?\n\}/g);
if (!sameSet(retiredKeys, retiredContract)
    || !sameSet(editableKeys, ["duplicateAccountPendingFrom", "duplicateAccountFreezeFrom", "releaseMode"])
    || !pcCompact.includes("constcurrentReleaseParams=releaseParams.filter(param=>!RETIRED_K1_RELEASE_KEYS.has(param.key));")
    || validators?.length !== 2
    || retiredContract.some(key => limits[key] || validators.some(source => source.includes(`"${key}"`)))) {
  bad("K1历史键退役/过滤锚缺失或重新进入编辑域");
} else ok("K1四历史键保留读取兼容、排除PC编辑域");

const historyKeys = retiredContract.filter(key => key !== "appAttestationReleaseHours");
const javaRetiredKeys = quoted(javaCompact.match(/\bRETIRED_KEYS=Set\.of\(("[^"]+"(?:,"[^"]+")*)\);/)?.[1]);
const javaActiveKeys = quoted(javaCompact.match(/\bKEYS=List\.of\(("[^"]+"(?:,"[^"]+")*)\);/)?.[1]);
const javaPromotionKeys = quoted(javaCompact.match(/\bPROMOTION_CONTRACT_KEYS=List\.of\(("[^"]+"(?:,"[^"]+")*)\);/)?.[1]);
const promotionContract = ["freePhoneSlotsPerCluster", "duplicateAccountPendingFrom", "duplicateAccountFreezeFrom",
  "pendingReleaseHours", "appAttestationReleaseHours", "releaseMode", "freeSlotRequiresBinding"];
if (!sameSet(javaRetiredKeys, historyKeys)
    || !sameSet(javaActiveKeys, [...editableKeys, "appAttestationReleaseHours"])
    || javaPromotionKeys.join() !== promotionContract.join()
    || !javaCompact.includes("publicList<Map<String,Object>>rows(){returnrows(KEYS,values());}")
    || !javaCompact.includes("privateMap<String,String>values(){Map<String,String>map=newLinkedHashMap<>();for(Stringkey:KEYS){")) {
  bad("Java K1历史键退役/活跃读取集合/旧合同字段顺序锚缺失或误重开");
} else ok("Java K1三历史键退出活跃集合、保留原促销合同字段顺序");

for (const [label, source, anchor] of [
  ["在线证明禁用", javaCompact, "privatestaticfinalbooleantrustedAttestationEnabled=false;"],
  ["在线证明写410", javaCompact, 'if("appAttestationReleaseHours".equals(key))thrownewBizException(410,"K1_TRUSTED_ATTESTATION_RETIRED");'],
  ["在线证明兼容值", javaCompact, 'if("appAttestationReleaseHours".equals(key)){map.put(key,"1");continue;}'],
  ["三历史键修改410", javaCompact, 'publicApiResult<Map<String,Object>>update(Stringkey,StringidempotencyKey,RiskReleaseParamUpdateRequestrequest){'
    + 'if("appAttestationReleaseHours".equals(key))thrownewBizException(410,"K1_TRUSTED_ATTESTATION_RETIRED");'
    + 'if(RETIRED_KEYS.contains(key))thrownewBizException(410,"K1_RELEASE_PARAM_RETIRED");'],
  ["旧促销合同storedValue读取", javaCompact, 'publicList<Map<String,Object>>promotionContractRows(){Map<String,String>snapshot=values();'
    + 'for(Stringkey:RETIRED_KEYS){Stringvalue=config.storedValue(PREFIX+key).filter(StringUtils::hasText)'
    + '.orElseThrow(()->newBizException(503,"K1_RELEASE_CONFIG_UNAVAILABLE"));snapshot.put(key,value.trim());}'
    + 'returnrows(PROMOTION_CONTRACT_KEYS,snapshot);}'],
  ["K1有效释放模式", javaCompact, 'booleanmode="releaseMode".equals(key);StringeffectiveValue=mode?"manual_only":values.get(key);'],
  ["收益有效释放模式", compact(javaEarnings), 'response.put("releaseMode","manual_only");'],
]) {
  if (!source.includes(anchor)) bad(`Java ${label}退役锚缺失或形态改变`);
  else ok(`Java ${label}锚有效`);
}
const modeList = quoted(kClient.match(/K1_RELEASE_MODE_VALUES = \[([^\]]+)\]/)?.[1]);
const modeRead = pcCompact.match(/for\(constparamofcurrentReleaseParams\)if\(param\.key==="releaseMode"\)\{([^}]+)\}/)?.[1] ?? "";
const readModes = quoted(modeRead.match(/if\(!\[([^\]]+)\]\.includes\(param\.value\)\)invalidK1Response\("multiAccount\.releaseParams\.releaseMode"\);/)?.[1]);
const modesValid = sameSet(modeList, ["manual_only"])
  && sameSet(readModes, ["manual_only", "attest_or_manual"])
  && modeRead.includes('param.value="manual_only";param.val="manual_only";param.adjustable=false;');
if (!modesValid) bad("releaseMode读取兼容/有效归一化/仅人工编辑域锚缺失或误重开");

// ── riskCluster 11键：6活跃域、4历史兼容结构、1模式归一化 ──────────────
for (const k of RC_KEYS) {
  const raw = seedRc[k];
  if (raw == null) { bad(`${k} uniapp 种子缺失(riskCluster 块里没有)`); continue; }
  if (k === "releaseMode") {
    if (modesValid && readModes.includes(raw.replace(/"/g, ""))) ok(`releaseMode seed=${raw} ∈ 读取兼容域 → manual_only(不可重开自动证明)`);
    else bad(`releaseMode seed=${raw} 不满足当前读取/仅人工释放合同`);
    continue;
  }
  if (retiredContract.includes(k)) {
    const valid = k === "freeSlotRequiresBinding" ? raw === "true" || raw === "false" : Number.isFinite(Number(raw));
    if (!valid) bad(`${k} 历史兼容结构不是${k === "freeSlotRequiresBinding" ? "布尔" : "数值"}字面`);
    else ok(`${k} seed=${raw} 仅历史兼容结构，不作为当前释放政策`);
    continue;
  }
  const dom = limits[k] ?? inlineDomain(kClient, k);
  if (!dom) { bad(`${k} admin值域提取失败(形状变了必红)`); continue; }
  const v = Number(raw);
  if (!Number.isFinite(v)) bad(`${k} seed=${raw} 不是数值,没法进域断言`);
  else if (v < dom.min || v > dom.max) bad(`${k} seed=${v} 越出 admin允许域 [${dom.min},${dom.max}]`);
  else if (dom.integer && !Number.isInteger(v)) bad(`${k} seed=${v} 应为整数(admin integer 域)`);
  else ok(`${k} seed=${v} ∈ admin域 [${dom.min},${dom.max}]`);
}

// ── otpGate:正式服务端共用键锚 admin 域;本地滑块模拟键锚客户端安全域 ────────
// `captchaAfterSends` / `captchaTicketTtlSeconds` 只驱动非 remote 的本地滑块
// 模拟器。正式注册/登录由 Java 的 dayLimit 与验证码策略执行,PC 不应出现一组
// 看似可写、实则不被 Java 消费的假参数。因此这两项在 App 内按安全域验种子,
// 其余键继续要求 PC 活源存在并落入同一值域。
for (const k of OG_KEYS) {
  const raw = seedOg[k];
  if (raw == null) { bad(`otpGate.${k} uniapp 种子缺失`); continue; }
  const clientOnlyDomain = k === "captchaAfterSends"
    ? { min: 1, max: 10 }
    : k === "captchaTicketTtlSeconds" ? { min: 30, max: 600 } : null;
  if (clientOnlyDomain) {
    const v = Number(raw);
    if (!Number.isInteger(v) || v < clientOnlyDomain.min || v > clientOnlyDomain.max) {
      bad(`otpGate.${k} seed=${raw} 越出本地滑块安全域 [${clientOnlyDomain.min},${clientOnlyDomain.max}]`);
    } else {
      ok(`otpGate.${k} seed=${v} ∈ 本地滑块安全域 [${clientOnlyDomain.min},${clientOnlyDomain.max}]`);
    }
    continue;
  }
  const dom = inlineDomain(kClient, `otpGate.${k}`);
  if (!dom) { bad(`otpGate.${k} admin 值域提取失败(形状变了必红)`); continue; }
  const v = Number(raw);
  if (!Number.isFinite(v) || v < dom.min || v > dom.max) bad(`otpGate.${k} seed=${raw} 越出 admin 域 [${dom.min},${dom.max}]`);
  else if (dom.multiple && v % +dom.multiple !== 0) bad(`otpGate.${k} seed=${v} 不是 ${dom.multiple} 的倍数(admin 步长域)`);
  else ok(`otpGate.${k} seed=${v} ∈ admin 域 [${dom.min},${dom.max}]${dom.multiple ? ` ∧ %${dom.multiple}=0` : ""}`);
}

// ── lockMode:seed ∈ h-client 白名单(键在 key parity,值锚顺带钉死)────────
{
  const wl = hClient.match(/lockMode !== "(\w+)" && lockMode !== "(\w+)"/);
  const raw = uni.match(/\block(?:Mode): ("[^"]+")/)?.[1];
  if (!wl) bad(`lockMode 白名单提取失败(h-client newcomer.lockMode 校验行形状变了)`);
  else if (!raw) bad(`lockMode uniapp 种子缺失`);
  else if ([wl[1], wl[2]].includes(raw.replace(/"/g, ""))) ok(`lockMode seed=${raw} ∈ admin 白名单 [${wl[1]},${wl[2]}]`);
  else bad(`lockMode seed=${raw} 不在 admin 白名单 [${wl[1]},${wl[2]}]`);
}

// ── 升级哨兵:K3/K4 键 main 前端落地即红(把新域接进比对,别让登记表烂在这)──
// 代表键选无子串冲突的三个(paymentInstrument 会撞 maxAccountsPerPaymentInstrument,不选)。
{
  const SENTINELS = ["weakSignalClusterThreshold", "firstWithdrawalManual", "minWithdrawableUsdt"];
  const libDir = path.join(adminRoot, "lib", "admin");
  let hits = [];
  for (const f of fs.readdirSync(libDir).filter((n) => n.endsWith(".ts"))) {
    const src = fs.readFileSync(path.join(libDir, f), "utf8");
    for (const s of SENTINELS) if (src.includes(s)) hits.push(`${f}:${s}`);
  }
  if (hits.length) bad(`K3/K4 参数已在 admin main 落地(${hits.join(" ")})—— 把该域接进本比对再收哨兵`);
  else ok(`K3/K4 升级哨兵:提现前置/聚簇权重键 main 前端未落地,登记态与现实一致`);
}

console.log(`result: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
