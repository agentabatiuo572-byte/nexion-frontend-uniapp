#!/usr/bin/env node
// 种子 → 运行时合成层(lib/platform-config-compat)的行为门 — node 直跑:
//   node scripts/selfcheck-config-compat.mjs
//
// 背景(z1 判决包,2026-08-10):819a6da/c37e642 把 captchaAlwaysScenes / networkConfirmFeeUsd
// 等从编译期种子挪进 compat 运行时默认,3 条钉种子文件字面的老哨兵
// (AUTH03 seed pin / SPEC-7 riskScore cloned / WD02 提取器)全部失锚。
// 本门改在**合成后的有效配置**上做行为断言 —— 种子怎么搬家都追得上;种子若显式
// 覆盖出坏值(如 captchaAlwaysScenes: [])一样红,比字面 pin 守得更严。
//
// 🔴 守的不变量:
//   ① 注册场景必须始终强制滑块:合成配置 otpGate.captchaAlwaysScenes 含 "register"
//      (FEAT-AUTH03 / 批次12「注册每次必滑」)。
//   ② 合成是克隆不是共享引用:改合成物不得污染种子,连续两次合成互不污染。
//   ③ WD02 网络确认费:合成有效值逐键 == admin-ops 契约锚(3 键覆盖度照守,锚缺失必红)。
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";
import { atAliasResolver } from "./lib/at-alias.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(root, "src");

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`); }
}

console.log("selfcheck-config-compat — 种子合成层:AUTH03 有效值 / 克隆隔离 / WD02 parity");

const out = await build({
  stdin: {
    contents: `export { completePlatformConfigSeed } from "@/lib/platform-config-compat";
export { DEFAULT_PLATFORM_CONFIG } from "@/mock/platform-config";`,
    resolveDir: root, loader: "ts",
  },
  bundle: true, write: false, format: "esm", platform: "neutral",
  define: { "import.meta.env.PROD": "false", "import.meta.env.DEV": "true" },
  plugins: [{ name: "at", setup(b) { b.onResolve({ filter: /^@\// }, atAliasResolver(SRC, "selfcheck-config-compat")); } }],
});
const mod = await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
const { completePlatformConfigSeed, DEFAULT_PLATFORM_CONFIG } = mod;

// ── ① AUTH03 有效值 ──────────────────────────────────────────────────────────
const composed = completePlatformConfigSeed(DEFAULT_PLATFORM_CONFIG);
const scenes = composed.otpGate.captchaAlwaysScenes;
check(`① 合成配置 captchaAlwaysScenes 含 "register"(实值 ${JSON.stringify(scenes)})`,
  Array.isArray(scenes) && scenes.includes("register"));

// 红测自证:种子显式覆盖成 [] 时,①的判据必须能红(证明「?? 默认」不会掩护坏覆盖)。
const seedBadScenes = structuredClone(DEFAULT_PLATFORM_CONFIG);
seedBadScenes.otpGate.captchaAlwaysScenes = [];
const composedBad = completePlatformConfigSeed(seedBadScenes);
check("①-红测 种子覆盖 [] → 合成值不含 register(判据对坏覆盖真的会咬)",
  !composedBad.otpGate.captchaAlwaysScenes.includes("register"));

// ── ② 克隆隔离 ──────────────────────────────────────────────────────────────
const seedSnapshot = JSON.stringify(DEFAULT_PLATFORM_CONFIG);
const a = completePlatformConfigSeed(DEFAULT_PLATFORM_CONFIG);
const wKeys = Object.keys(a.riskScore.dimensionWeights);
check(`② dimensionWeights 键非空(${wKeys.length} 键)`, wKeys.length > 0);
a.riskScore.dimensionWeights[wKeys[0]] = 999999;
a.otpGate.captchaAlwaysScenes.push("z1-probe");
a.withdrawRules.networkConfirmFeeUsd.trc20 = 999999;
const b = completePlatformConfigSeed(DEFAULT_PLATFORM_CONFIG);
check("② 改合成物不污染种子(JSON 快照逐字节一致)", JSON.stringify(DEFAULT_PLATFORM_CONFIG) === seedSnapshot);
check(`② 二次合成不受一次合成的突变影响(weights[${wKeys[0]}]=${b.riskScore.dimensionWeights[wKeys[0]]})`,
  b.riskScore.dimensionWeights[wKeys[0]] !== 999999
  && !b.otpGate.captchaAlwaysScenes.includes("z1-probe")
  && b.withdrawRules.networkConfirmFeeUsd.trc20 !== 999999);

// ── ③ WD02 parity(合成有效值 ↔ admin-ops 契约锚)────────────────────────────
// 锚点身份沿袭原门:比对对象是 admin-ops wd02 契约测试里的声明锚(server-canonical,
// 后端字段同步是人肉义务)。路径双候选:主树(../admin-ops)与 worktree(../../../../admin-ops)。
const anchorCands = [
  path.join(root, "..", "admin-ops", "tests", "wd02-network-confirm-fee-contract.test.mjs"),
  path.join(root, "..", "..", "..", "..", "admin-ops", "tests", "wd02-network-confirm-fee-contract.test.mjs"),
];
const anchorPath = anchorCands.find((p) => existsSync(p));
if (!anchorPath) {
  check("③ admin-ops 契约锚存在(判据失效必红,禁静默跳过)", false, anchorCands.join(" | "));
} else {
  const adm = readFileSync(anchorPath, "utf8");
  const am = adm.match(/WD02_SEED_NETWORK_CONFIRM_FEE_USD = \{ trc20: ([\d.]+), bep20: ([\d.]+), erc20: ([\d.]+) \}/);
  check("③ 锚字面量可提取(形状变了必红)", !!am, "WD02_SEED_NETWORK_CONFIRM_FEE_USD 提取失败");
  if (am) {
    const eff = composed.withdrawRules.networkConfirmFeeUsd;
    const effKeys = Object.keys(eff).sort().join(",");
    check(`③ 合成有效值键覆盖度 = trc20,bep20,erc20(实得 ${effKeys})`, effKeys === "bep20,erc20,trc20");
    const anchor = { trc20: Number(am[1]), bep20: Number(am[2]), erc20: Number(am[3]) };
    const drift = ["trc20", "bep20", "erc20"]
      .filter((k) => !(Number.isFinite(eff[k]) && eff[k] === anchor[k]))
      .map((k) => `${k}(uni=${eff[k]}!=admin=${anchor[k]})`);
    check(`③ 逐键比值 uni 合成值 ↔ admin 锚(${JSON.stringify(anchor)})`, drift.length === 0, drift.join(" "));
    // 红测自证:种子塞入漂移值时判据必须能咬住。
    const seedDrift = structuredClone(DEFAULT_PLATFORM_CONFIG);
    seedDrift.withdrawRules.networkConfirmFeeUsd = { ...anchor, erc20: anchor.erc20 + 1 };
    const composedDrift = completePlatformConfigSeed(seedDrift);
    check("③-红测 种子漂移 erc20+1 → 合成值 ≠ 锚(parity 判据真的会咬)",
      composedDrift.withdrawRules.networkConfirmFeeUsd.erc20 !== anchor.erc20);
  }
}

console.log(`\n${pass} pass / ${fail} fail(样本:合成×4 · 克隆隔离 3 断言 · WD02 3 键 · 内置红测 2 组)`);
process.exit(fail === 0 ? 0 : 1);
