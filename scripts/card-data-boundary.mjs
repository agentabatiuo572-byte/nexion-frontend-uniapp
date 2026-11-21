#!/usr/bin/env node
// 卡数据信任边界哨兵 —— 明文卡号 / CVV 只许活在托管组件里。
//   node scripts/card-data-boundary.mjs            # 全量扫描
//
// 为什么要这道门:产品文案向用户承诺「NexGrid 不会接触你的完整卡号」,
// 而承诺只能由代码结构守住。任何人在托管组件之外再写一个卡号输入框,
// 这句话就变成不实陈述 —— 这不是风格问题,所以是机器门不是 review 项。
//
// 判据认「数据绑定」不认关键词:cvvLength / cvvFocused / cvvInputStyle /
// kind="cvv" 都是合法的非明文用法,必须放行;:value="cvv" 才是违例。
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(root, "src");

/** 托管边界内部 —— 明文本来就该在这里。 */
const INSIDE_BOUNDARY = new Set([
  "components/me/hosted-card-vault.vue",
  "components/me/hosted-card-field.vue",
  "store/cards-core.ts",
]);

/** 明文卡数据的标识符(完整词,不做前缀匹配)。 */
const SECRET = "pan|cvv|cardNum|cardNumber|cardNo";

const RULES = [
  {
    id: "binding",
    re: new RegExp(`(?::value|v-model(?:\\.\\w+)?)\\s*=\\s*"\\s*(?:${SECRET})(?:\\.value)?\\s*"`, "g"),
    why: "把明文卡字段绑到了输入框",
  },
  {
    id: "ref-decl",
    re: new RegExp(`\\b(?:const|let)\\s+(?:${SECRET})\\s*=\\s*ref\\(`, "g"),
    why: "在托管组件外持有明文卡字段的 ref",
  },
  {
    // 对抗审查实测的绕过口:把明文塞进对象再绑(`:value="state.cvv"`),
    // 上面的「整词绑定」判据完全不中。只认**明文字段名**作最右段,
    // `card.last4` / `card.expiry` 这类正当读取不受影响(不在 SECRET 里)。
    id: "binding-path",
    re: new RegExp(`(?::value|v-model(?:\\.\\w+)?)\\s*=\\s*"\\s*[\\w$]+(?:\\.[\\w$]+)*\\.(?:${SECRET})(?:\\.value)?\\s*"`, "g"),
    why: "把对象里的明文卡字段绑到了输入框",
  },
  {
    id: "reactive-group",
    re: new RegExp(`reactive\\s*\\(\\s*\\{[^}]*\\b(?:${SECRET})\\s*:`, "g"),
    why: "在托管组件外用 reactive() 持有明文卡字段",
  },
  {
    // 🔴 与变量名**无关**的判据 —— 上面全部规则都靠拼中 5 个磁词,对抗审查实测
    // 改名成 securityCode 就整体失明。规范的卡输入框一定会声明 cc-* 自动填充提示
    // (不声明则浏览器/密码管理器填不进去,是可用性硬需求),这条躲不掉。
    // 判据不失效才是这道门的全部价值,所以必须有一条不依赖命名的兜底。
    id: "cc-autocomplete",
    re: /autocomplete\s*=\s*"?\s*cc-(?:number|csc|exp)/g,
    why: "在托管组件外声明了卡字段自动填充(cc-*),即此处在收卡数据",
  },
  {
    // 自审(层②)翻出的哨兵盲区:vault 通过 provide 暴露 display(kind),它**返回明文**。
    // 父组件注入不到(它是 vault 的上层),但 slot 里任何后代 inject 一下就能读卡号,
    // 而绑定类判据完全抓不到这种写法 —— 缺口在注入面不在绑定面。
    id: "vault-inject",
    re: /inject\s*\(\s*HOSTED_CARD_VAULT/g,
    why: "在 hosted-card-field 之外注入 vault(可直接读到明文卡号 / CVV)",
  },
];

/** 卡号占位符只在**裸 `<input>`** 里算违例 —— 同样的占位符传给 <HostedCardField>
 *  是正当用法(占位符本身不是卡数据)。故按标签判、不按行判:行级判据会把
 *  托管组件误伤成违例(首轮实测踩到,已补进下方阴性样本)。 */
const RAW_INPUT_TAG = /<input\b[^>]*>/gs;
const PAN_PLACEHOLDER = /placeholder\s*=\s*"1234[\s-]?5678/;

function scanText(text) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  for (const rule of RULES) {
    lines.forEach((line, i) => {
      rule.re.lastIndex = 0;
      if (rule.re.test(line)) hits.push({ rule: rule.id, line: i + 1, why: rule.why, snippet: line.trim().slice(0, 96) });
    });
  }
  RAW_INPUT_TAG.lastIndex = 0;
  for (const m of text.matchAll(RAW_INPUT_TAG)) {
    if (!PAN_PLACEHOLDER.test(m[0])) continue;
    hits.push({
      rule: "pan-placeholder",
      line: text.slice(0, m.index).split(/\r?\n/).length,
      why: "裸 <input> 上出现卡号占位符(意味着此处在收卡号)",
      snippet: m[0].replace(/\s+/g, " ").trim().slice(0, 96),
    });
  }
  return hits;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(vue|ts)$/.test(name)) out.push(p);
  }
  return out;
}

// ── 双向红测:判据失效 = 门失效,所以先证明判据还认得出违例、也不误伤合法写法 ──
const files = walk(SRC);
let inputsSeen = 0;
const violations = [];
for (const f of files) {
  const rel = path.relative(SRC, f).replace(/\\/g, "/");
  const text = readFileSync(f, "utf8");
  inputsSeen += (text.match(/<input\b/g) || []).length;
  if (INSIDE_BOUNDARY.has(rel)) continue;
  for (const h of scanText(text)) violations.push({ file: rel, ...h });
}

// 判据失效自曝:扫不到任何输入框 = 这道门在空集上"全过",必须报错不许假绿。
if (inputsSeen === 0) {
  console.log("🔴 判据失效:全量扫描没找到任何 <input>,门形同虚设(检查 walk/后缀过滤)");
  process.exit(1);
}

if (violations.length) {
  console.log(`卡数据边界:${violations.length} 处明文卡字段在托管组件之外`);
  for (const v of violations) console.log(`  ${v.file}:${v.line}  [${v.rule}] ${v.why}\n      ${v.snippet}`);
  console.log("\n  卡号 / CVV 只许住 hosted-card-vault.vue;别处收卡 = 文案「不会接触你的完整卡号」变成不实陈述。");
  console.log("  接入方式:<HostedCardVault ref=\"vaultRef\" @change> 包住,输入框换 <HostedCardField kind=…>,提交时 vaultRef.tokenize()。");
  process.exit(1);
}

console.log(`卡数据边界: 0 违例(扫 ${files.length} 个源文件 / ${inputsSeen} 个输入框 · 边界内豁免 ${INSIDE_BOUNDARY.size} 个文件)`);
