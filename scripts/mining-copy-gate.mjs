#!/usr/bin/env node
// 挖矿文案哨兵 —— node scripts/mining-copy-gate.mjs
//
// 产品语义:NexGrid 出租 AI 算力,不做加密挖矿。用户可见文案里出现「挖矿 / mining / đào」
// 有两重代价:① 品牌语义错(主人 2026-08-16 在 /session/kicked 抓到「本设备的挖矿已暂停」);
// ② 上架合规风险 —— Apple 3.1.5 与 Play 金融功能声明都禁设备端加密挖矿,
// admin-ops 的商店送审文案包(docs/PRD/specs/ 下)把「挖矿赚钱」列进 CLM 获批前禁用词表,
// 前端 PRD v3.7 的真平台口径段也写明「不出现模拟 / 网页挖矿等字眼」。
//
// 🔴 为什么这是同型第二次:上一轮已经修过这个页面(见 docs/前端产品更新日志.md「登录已结束」条),
// 但只删了「同一时间只能有一台设备运行挖矿」这**一句**,配的哨兵(verify.sh SPEC-4 段)也只钉死
// 那一句字面量 —— 词族里其余 7 个 key(三语 24 处)于是安然活到今天。教训:文案类哨兵要判
// **整个词族**,不是判被举报的那一句;判据构造性,不枚举已知句子。
//
// 判据边界(有意为之,不是遗漏):只吃**字符串字面量的值**,后面紧跟 `:` 的是 key 不是文案。
// 因此内部 store 字段(miningPaused / miningSince / kind:"mining")与成就 key a_diamond_miner
// 不在射程内 —— 它们不面向用户,且改动会牵连持久化数据与跨仓门,属另一层的事。
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")));

// 词族。两处刻意的放行,删了会误伤:
//   · en `Mine` 只在后面接单词时算动词 —— Genesis 市场的 "Mine ({n})" 是「我的」tab;
//   · vi `đào` 用 Unicode 边界(\b 只认 ASCII,挨着 đ 恒不成立),并放行 đào tạo(=培训)。
const BAN =
  /挖矿|矿工|矿机|矿池|预挖|开采|\bmining\b|\bminers?\b|pre-?mine\b|\bMine +[A-Za-z]|khai thác|(?<!\p{L})[đĐ]ào(?!\p{L})(?! tạo)/iu;

const FILES = ["src/i18n/messages/zh.ts", "src/i18n/messages/en.ts", "src/i18n/messages/vi.ts"];

// 文案 = 字符串字面量的值;后面紧跟 `:` 的那些是 key,跳过。
function copyStrings(src) {
  const out = [];
  for (const m of src.matchAll(/"((?:[^"\\\r\n]|\\.)*)"(\s*:)?/g)) if (!m[2]) out.push(m[1]);
  return out;
}

// ── 真扫描 ────────────────────────────────────────────────────────────────
let scanned = 0;
const leaks = [];
for (const rel of FILES) {
  const strings = copyStrings(readFileSync(path.join(root, rel), "utf8"));
  // 候选集塌了(改名 / 解析失效 / 文件被清空)也要判红,不能表现成「干净」。
  if (strings.length < 500) {
    console.log(`FAIL  ${rel} 只解析出 ${strings.length} 条文案,不像一份完整的 message 表 —— 判据失效,判红`);
    process.exit(1);
  }
  scanned += strings.length;
  for (const s of strings) {
    const hit = s.match(BAN);
    if (hit) leaks.push(`${rel}  ⟵ "${hit[0]}"  in: ${s.slice(0, 80)}`);
  }
}

if (leaks.length) {
  console.log(`FAIL  ${leaks.length} 处用户可见文案含加密挖矿词(NexGrid 出租 AI 算力,自己不挖矿):`);
  for (const l of leaks) console.log(`        ${l}`);
  process.exit(1);
}

console.log(
  `mining-copy-gate PASS —— 扫 ${scanned} 条三语文案,无挖矿词`,
);
