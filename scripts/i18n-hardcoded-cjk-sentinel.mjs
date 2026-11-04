#!/usr/bin/env node
// 硬编码中文哨兵 —— 判据是**构造性**的:src/**/*.{vue,ts} 里注释之外出现任何 CJK 即拦。
//
// 为什么要这道门(2026-08-11):c37e642 一个提交里,10 个文件的用户可见文案直接写成中文,
// 完全绕开 src/i18n。既有的文案哨兵一条都没响,因为它们全是**枚举式**的:
//   · verify.sh 的 mock/演示/phase 词表 —— 只扫 src/i18n/messages/*.ts 的值,页面里的字符串天然免检;
//   · TRIAL02 / funnel-meta / markdown 残留 —— 同样只扫词典,且只认固定词;
//   · i18n-key-mirror —— 只保证「已进词典的 key 三语齐」,对「压根没进词典」的字符串无感。
// 枚举式判据的共同盲区:新写的中文只要不撞词表就静默通过。所以本门反过来判 ——
// **必须不具备中文**,而不是「不得含某些词」。新页面、新词、新写法一律自动落网。
//
// 判定面:.vue + .ts。依据:css/scss/json 里的 CJK 实测全是注释(manifest.json 是 uni 模板
// 自带的段落注释),运行时文案 100% 出自 .vue/.ts —— 扫这两类即覆盖全部可见文案来源。
//
// 用法:
//   node scripts/i18n-hardcoded-cjk-sentinel.mjs             扫全仓
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { parse as parseSfc } from "@vue/compiler-sfc";

// 字符集:汉字基本区 + 扩展 A + CJK 标点 + 全角形式。只判汉字块的话,纯标点文案
// (「」、。—— 之类)与全角标点整段免疫(独立审计 P2 实证)。
const CJK_CLASS = "\\u4e00-\\u9fff\\u3400-\\u4dbf\\u3000-\\u303f\\uff01-\\uff65";
const CJK = new RegExp(`[${CJK_CLASS}]`);
const cjkCount = (s) => (s.match(new RegExp(`[${CJK_CLASS}]`, "g")) ?? []).length;
// pages.json 的 navigationBarTitleText 是原生导航栏标题 = 真·用户可见文案面;
// manifest.json 带 /* */ 注释,靠下面的注释剥离器照常处理。
const SCAN_EXT = /\.(vue|ts|json)$/;
// `教程` 这种转义写法绕过任何字面量匹配 —— 先解码再判,否则门只拦「照直写」的人。
const decodeEscapes = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));

// ── 分类豁免 ────────────────────────────────────────────────────────────────
// 纪律(照抄 i18n-key-mirror.mjs 的 MARK_EXEMPT):① 按**类别**授权,不按文件名逐条放行;
// ② 每条写明理由;③ **0 命中即失效** —— 某条豁免不再对应任何真实行,门直接红,要求删掉它,
//    否则它就只剩「给未来的中文开静默后门」这一个作用。
// 🔴 豁免必须是**值级**的,不是行级 —— 红测实证:`v: 0, title: "Cadet", cnTitle: "学员",`
//    在行级豁免下,同一行的 title 写成中文照样被放行。所以构造类豁免只挖掉被授权的那个
//    字面量,行里**剩下的**中文继续判。
const FILE_EXEMPTIONS = [
  {
    id: "i18n-layer",
    why: "翻译层自身:zh 词典的值就是中文;i18n/index.ts 的 nativeName 必须用各语言自己的文字写",
    match: (file) => file.startsWith("src/i18n/"),
  },
  {
    id: "mock-payload",
    why: "mock 后端载荷:真后台会按 language 下发本地化文本(platform-config 的 zhTitle/zhGuide),faq 是中文查询词匹配,都不是客户端文案",
    match: (file) => file.startsWith("src/mock/"),
  },
  {
    id: "localized-content-builders",
    why: "两份纯函数同时维护 zh/en/vi 状态词表并按 locale 选择，业务正文仍只读服务端发布内容；精确文件作用域避免扩大豁免",
    match: (file) => ["src/lib/commissions-how-content.ts", "src/lib/rank-how-content.ts"].includes(file),
  },
];

const VALUE_EXEMPTIONS = [
  {
    id: "native-scan-error-source-tokens",
    why: "原生扫码 errMsg 的权限/取消标识只用于分类；限定该组件对 message 的两条精确比较表达式，展示错误仍从三语词典读取",
    files: ["src/components/team/invite-scan-entry.vue"],
    strip: (line) => [
      'if (/permission|auth.*deny|denied|权限|未授权/i.test(message)) error.value = t.value.inviteScan.permission;',
      'else if (!/cancel|取消/i.test(message)) error.value = t.value.inviteScan.failed;',
    ].includes(line.trim()) ? "" : line,
  },
  {
    id: "published-pro-tagline-source-token",
    why: "已发布商品中文标语只在此处与服务端原值精确比对；用户看到的是按 locale 选取的英文、越文或服务端中文",
    files: ["src/lib/product-copy.ts"],
    strip: (line) => line.replace(/^(\s*const PRO_PUBLISHED_TAGLINE = )("中端主力·AI 推理 \+ 挖掘")(\s*;\s*)$/, (_m, prefix, _value, suffix) => `${prefix}""${suffix}`),
  },
  {
    id: "virginia-datacenter-source-token",
    why: "机房位置中文只在此处识别服务端原值，物理位置仍取服务端；展示层按 locale 翻译已知地名",
    files: ["src/lib/product-copy.ts"],
    strip: (line) => line.replace(/^(\s*const VIRGINIA_DATACENTER = )("美国·弗吉尼亚")(\s*;\s*)$/, (_m, prefix, _value, suffix) => `${prefix}""${suffix}`),
  },
  {
    id: "cloud-share-promo-alias-token",
    why: "旧服务端周促销目标的简繁中文别名只用于识别商品类型并隐藏旧日产，不作为页面文案展示",
    files: ["src/api/quest-api.ts"],
    strip: (line) => line.replace(/^(\s*\|\| \(productType == null && \/cloud\[\\s_-\]\*share\|)云共享\|雲共享(\/i\.test\(targetDevice \?\? ""\)\);)$/, "$1$2"),
  },
  {
    id: "quota-annualized-source-token",
    why: "服务端配额权益里的年化是待过滤的数据标识，不是客户端展示文案；只授权此识别表达式中的该词",
    files: ["src/lib/quota-perk.ts"],
    strip: (line) => line.replace(/^(\s*return\s+\/\(\?:)年化(?=\|annual\|)/, "$1"),
  },
  {
    id: "support-unassigned-token",
    why: "后端备勤池、待分配代理名仅用于未分配状态比较；限定文件、真实 isWaitingForAgent 返回判据、normalized 变量及严格相等比较，展示中文仍逐字检查",
    files: ["src/pages/support/chat.vue", "src/pages/support/messages.vue"],
    // Only the known comparison tail of the actual predicate is authorized.
    strip: (line) => /^\s*return\s+(?:!normalized\s*\|\|\s*normalized\.toLowerCase\(\)\s*===\s*(["'])unassigned\1\s*\|\|\s*)?normalized\s*===\s*(["'])备勤池\2(?:\s*\|\|\s*normalized\s*===\s*(["'])待分配\3)?\s*;?\s*$/.test(line)
      ? line.replace(/(["'])(?:备勤池|待分配)\1/g, (_m, quote) => `${quote}${quote}`) : line,
  },
  {
    id: "cn-title-field",
    why: "cnTitle 是 API 声明字段(src/api/v-rank-api.ts),本地 V_RANKS 是它的离线镜像;豁免只给**定义面**这两个文件",
    // 🔴 值级豁免必须**带文件作用域**:不带的话,任何页面把文案塞进 cnTitle 字段就能对门隐身
    //    (独立审计实测:scanSource("src/pages/product/detail.vue", 'cnTitle: "立即购买"') → 0 违规)。
    //    作用域取「字段的定义面」,消费面(页面/组件)一律照判。
    files: ["src/store/v-rank.ts", "src/api/v-rank-api.ts"],
    // 单双引号都剥 —— 只认双引号会让豁免的宽严取决于引号风格(同一实测发现)。
    // 替换串传函数,不用 "$1" —— 字面量替换串会把 $& / $1 当引用吃掉(本仓踩过)。
    strip: (line) => line.replace(/(^|[\s{,])cnTitle:\s*(["'])[^"']*\2/g, (_m, lead) => `${lead}cnTitle:""`),
  },
  {
    id: "legacy-config-token",
    why:
      "后端 legacy 策略行的**取值**,不是展示文案:parseTrialBooleanConfig 把旧后台写的 '开'/'关' 这类值" +
      "归一成 JSON boolean(H2 线上契约已是 boolean,这几个只在旧行归一化期间存在)。它们进的是 includes() " +
      "的比较集,永远不会渲染给用户 —— 收进 i18n 反而是错的:词典是给人读的,这里要的是**跟后端字节对齐**。",
    files: ["src/lib/trial-config-enum.ts"],
    // 🔴 钉**具体授权的 4 个 token**,不是「这个文件的数组里都放行」:
    //    ① 只有整串恰好等于授权值才剥(子串不逃逸:"开放试用" 照判);
    //    ② 后端将来新增 "启用"/"停用" 必须显式加进这里 —— 每个新取值都过一次审,这正是要的;
    //    ③ 文件作用域挡住「把文案塞成同名字面量就隐身」(消费面写 "开放" 照抓)。
    strip: (line) =>
      line.replace(/(["'])([^"']*)\1/g, (m, q, inner) =>
        LEGACY_CONFIG_TOKENS.includes(inner) ? `${q}${q}` : m
      ),
  },
  {
    id: "support-idle-close-source-token",
    why: "后端闲置关闭系统消息的原文字节仅用于严格识别；展示内容由三语词典生成，授权范围限于该正则取值",
    files: ["src/lib/support-idle-message.ts"],
    strip: (line) => line.replace(/^(\s*const closed = )\/\^会话已因用户闲置 \(\[1-9\]\\d\*\) 分钟自动结束,可重新发起会话。\$\/(\.exec\(text\);)/, "$1/^([1-9]\\d*)$/$2"),
  },
  {
    id: "fullwidth-percent-token",
    why: "服务端奖励文案兼容解析的全角百分号字节，不是客户端展示文案；仅在归一化函数定义面授权该 token",
    files: ["src/pages/daily/daily-reward-view.ts"],
    strip: (line) => line.replace(/％/g, "%"),
  },
];

// 与上面 legacy-config-token 配对的授权取值表。单独提出来是为了让「授权了哪几个值」
// 一眼可数、可 diff —— 埋在正则里的白名单没人看得见增删。
const LEGACY_CONFIG_TOKENS = ["开", "开放", "关", "关闭"];

// ── 注释剥离 ────────────────────────────────────────────────────────────────
// 🔴 2026-08-17 起搬到 `scripts/lib/sfc-strip-comments.mjs`,与英文面哨兵
// (i18n-hardcoded-en-copy-sentinel.mjs)共用一份 —— 留在这里让那边复制,
// 就是「修了一道门、漏了另一道」的标准形态。本文件下面那批注释红测(HTML 注释 /
// script 行注释 / 块注释 / style 注释 / 含 `//` 的字符串 / 模板里的 `//`)
// **同时是共享模块的回归靶**:改坏共享逻辑,这里立刻红。
export { stripComments } from "./lib/sfc-strip-comments.mjs";
import { stripComments } from "./lib/sfc-strip-comments.mjs";

function supportIdleRegexLines(source) {
  const parsed = ts.createSourceFile("support-idle-message.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const lines = new Set();
  const expected = String.raw`/^会话已因用户闲置 ([1-9]\d*) 分钟自动结束,可重新发起会话。$/`;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "closed") {
      const call = node.initializer;
      const access = call && ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression) ? call.expression : null;
      const regex = access?.expression;
      if (access?.name.text === "exec" && regex && ts.isRegularExpressionLiteral(regex) && regex.text === expected
          && call.arguments.length === 1 && ts.isIdentifier(call.arguments[0]) && call.arguments[0].text === "text") {
        lines.add(parsed.getLineAndCharacterOfPosition(regex.getStart(parsed)).line + 1);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return lines;
}

function supportUnassignedTokenLines(source) {
  const lines = new Set();
  const script = /^<script\b[^>]*>([\s\S]*?)^<\/script>/m.exec(source);
  if (!script) return lines;
  const offset = script.index + script[0].indexOf(">") + 1;
  const lineOffset = source.slice(0, offset).split(/\r?\n/).length - 1;
  const parsed = ts.createSourceFile("chat.ts", script[1], ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  function compare(node) {
    if (!ts.isBinaryExpression(node)) return;
    if (node.operatorToken.kind === ts.SyntaxKind.BarBarToken) { compare(node.left); compare(node.right); return; }
    if (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
        && ts.isIdentifier(node.left) && node.left.text === "normalized" && ts.isStringLiteral(node.right)
        && ["备勤池", "待分配"].includes(node.right.text)) {
      lines.add(lineOffset + parsed.getLineAndCharacterOfPosition(node.right.getStart(parsed)).line + 1);
    }
  }
  for (const node of parsed.statements) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "isWaitingForAgent") {
      for (const statement of node.body?.statements ?? [])
        if (ts.isReturnStatement(statement) && statement.expression) compare(statement.expression);
    }
  }
  return lines;
}

function nativeScanErrorLines(source) {
  const descriptor = parseSfc(source).descriptor;
  const script = descriptor.scriptSetup ?? descriptor.script;
  const lines = new Set();
  if (!script) return lines;
  const parsed = ts.createSourceFile("invite-scan.ts", script.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  function visit(node) {
    if (ts.isIfStatement(node)) {
      const call = ts.isPrefixUnaryExpression(node.expression) && node.expression.operator === ts.SyntaxKind.ExclamationToken
        ? node.expression.operand : node.expression;
      const access = ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression) ? call.expression : null;
      if (access?.name.text === "test" && ts.isRegularExpressionLiteral(access.expression)
          && call.arguments.length === 1 && ts.isIdentifier(call.arguments[0]) && call.arguments[0].text === "message") {
        lines.add(script.loc.start.line + parsed.getLineAndCharacterOfPosition(access.expression.getStart(parsed)).line);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return lines;
}

export function scanSource(file, src) {
  const stripped = decodeEscapes(stripComments(src, file.endsWith(".vue")));
  const fileRule = FILE_EXEMPTIONS.find((rule) => rule.match(file));
  const idleRegexLines = file === "src/lib/support-idle-message.ts" ? supportIdleRegexLines(src) : null;
  const unassignedTokenLines = ["src/pages/support/chat.vue", "src/pages/support/messages.vue"].includes(file) ? supportUnassignedTokenLines(src) : null;
  const scanErrorLines = file === "src/components/team/invite-scan-entry.vue" ? nativeScanErrorLines(src) : null;
  const hits = [];
  stripped.split(/\r?\n/).forEach((line, idx) => {
    if (!CJK.test(line)) return;
    if (fileRule) { hits.push({ file, line: idx + 1, text: "", exempt: fileRule.id }); return; }
    // 逐条挖掉被授权的字面量;命中 = 这条规则真的少掉了中文(纯改写不算,免得白名单靠空转续命)。
    let rest = line;
    const used = [];
    for (const rule of VALUE_EXEMPTIONS) {
      if (!rule.files.includes(file)) continue;
      if (rule.id === "support-idle-close-source-token" && !idleRegexLines?.has(idx + 1)) continue;
      if (rule.id === "support-unassigned-token" && !unassignedTokenLines?.has(idx + 1)) continue;
      if (rule.id === "native-scan-error-source-tokens" && !scanErrorLines?.has(idx + 1)) continue;
      const next = rule.strip(rest);
      if (cjkCount(next) < cjkCount(rest)) used.push(rule.id);
      rest = next;
    }
    for (const id of used) hits.push({ file, line: idx + 1, text: "", exempt: id });
    // 挖完还剩中文 = 这行有未授权的硬编码文案,照判。
    if (CJK.test(rest)) hits.push({ file, line: idx + 1, text: line.trim().slice(0, 140), exempt: null });
  });
  return hits;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name).split(path.sep).join("/");
    if (entry.isDirectory()) walk(p, out);
    else if (SCAN_EXT.test(entry.name)) out.push(p);
  }
  return out;
}

function run() {
  const files = walk("src");
  const violations = [];
  const exemptHits = new Map();
  let filesWithAnyCjk = 0;
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    if (CJK.test(src)) filesWithAnyCjk += 1;
    for (const hit of scanSource(file, src)) {
      if (hit.exempt) exemptHits.set(hit.exempt, (exemptHits.get(hit.exempt) ?? 0) + 1);
      else violations.push(hit);
    }
  }

  // 假绿防线:扫不到文件 / CJK 正则对真实语料 0 命中(编码或走查逻辑坏了)一律判红,
  // 否则「0 违规」既可能是真干净,也可能是门根本没跑起来,两者在输出里长得一模一样。
  if (!files.length) { console.error("i18n-cjk FAIL:src 下没扫到任何 .vue/.ts —— 判据失效"); return 1; }
  if (!filesWithAnyCjk) { console.error("i18n-cjk FAIL:全仓 CJK 命中 0 个文件(连中文注释都没有)—— 判据失效"); return 1; }

  const stale = [...FILE_EXEMPTIONS, ...VALUE_EXEMPTIONS].filter((rule) => !exemptHits.get(rule.id));
  if (stale.length) {
    console.error(
      `i18n-cjk FAIL:${stale.length} 条豁免已无对应行(0 命中即判据失效),请从 EXEMPTIONS 删除:\n` +
        stale.map((rule) => `  ${rule.id} —— ${rule.why}`).join("\n")
    );
    return 1;
  }

  if (violations.length) {
    console.error(
      `i18n-cjk FAIL:${violations.length} 处硬编码中文(注释之外),扫描 ${files.length} 个 .vue/.ts。\n` +
        "撞到本门有**三条**出路,按「这句话是给谁看的」选,别一律往词典搬:\n" +
        "  ① 真·用户文案 → src/i18n/messages/{en,zh,vi}.ts 三语同序,页面用 useT() 读;\n" +
        "  ② 带 SANDBOX / source=mock / DEV 这类**工程话**的字符串 → 改成英文技术串,**不要进词典**。\n" +
        "     verify.sh 那道 mock 门已经定过判据:工程话进词典就成了用户文案契约,而词典是普通对象、\n" +
        "     打包摇不掉,会原样进生产包。给一个调试串做三语本地化是错的方向;本门只判中文,改英文即过。\n" +
        "  ③ 压根不渲染给人看的**取值**(跟后端字节比对的码表等)→ 加 VALUE_EXEMPTIONS:\n" +
        "     必须值级 + 带 files 作用域 + 写明理由,禁整文件放行(照抄 legacy-config-token 那条的形状)。\n" +
        "违规明细:\n" +
        violations.map((v) => `  ${v.file}:${v.line}  ${v.text}`).join("\n")
    );
    return 1;
  }

  const exemptNote = [...exemptHits.entries()].map(([id, n]) => `${id}×${n}`).join(" · ");
  console.log(
    `i18n-cjk PASS:${files.length} 个 .vue/.ts(其中 ${filesWithAnyCjk} 个含 CJK)注释外零硬编码中文 · 分类豁免 ${exemptNote}`
  );
  return 0;
}

process.exit(run());
