#!/usr/bin/env node
/**
 * 🔴 试用状态封装门(2026-08-04 结构性反思产物,见 docs/changes/2026-08-04-structural-reflection.md)
 *
 * 为什么存在:R1 把试用时间边界收敛成单一纯函数 resolveTrialAt,只扫了「定义面」
 * (free-trial.ts 内无残留手写边界比对),没扫「消费面」(谁还在直接读原始 status)。
 * R2 的 P0 就是漏网的消费者(checkout.vue 一半读原始 status、一半读解析器,
 * 拼出用户没见过的净额并扣款)。同型跨两轮复发 → 根因是**封装未被机器强制**。
 *
 * 判据(两条正交):
 *   ① 消费者台账:直接读原始 status 的文件必须在下方 ALLOWLIST 里逐条登记理由;
 *      新增未登记消费者 → 红。台账**写在本门脚本里,不写在被查文件里** —— 否则
 *      「删消费者时顺手删掉台账那行」就能静默绕过(踩坑出处 2026-08-03 防删除门)。
 *   ② 钱路径禁令:MONEY_PATHS 里的文件即便被登记进白名单也一律红 ——
 *      钱只认解析器,不认原始状态。这条覆盖「未来有人给白名单加一行就放行」的方向。
 *
 * 自破坏保护:扫描命中数为 0(说明匹配模式失效或目录改名)一律 exit 1,不许「找不到 = 全过」。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { parse as parseSfc } from "@vue/compiler-sfc";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

/** 解析器自身 —— 它们**定义**状态,不算消费者。 */
const RESOLVER_FILES = ["src/store/trial-boundary.ts", "src/store/free-trial.ts"];

/**
 * 登记在册的消费者。key = 相对路径,value = 为什么允许直接读原始状态。
 * 🔴 新增消费者必须在此登记理由;钱路径一律不许登记(见 MONEY_PATHS)。
 */
const ALLOWLIST = {
  "src/App.vue":
    "轮询编排:在 pollTrial 前后各取一次状态以判定「本 tick 是否发生迁移」,读的是 poll 推进**之后**的值,不参与任何金额计算",
  "src/pages/me/trial.vue":
    "纯展示:试用页五态渲染,≤4s 视觉滞后由下一次 poll 自愈,不参与任何金额计算",
};

/**
 * 钱路径 —— 出现在消费者名单里一律红,即便被加进 ALLOWLIST。
 * 金额必须来自解析器的单次解析结果(见 checkout.vue trialQuoteAt / wallet-withdraw.vue snap)。
 */
const MONEY_PATHS = [
  "src/pages/store/checkout.vue",
  "src/pages/me/wallet-withdraw.vue",
  "src/store/orders.ts",
  "src/store/app.ts",
  "src/store/bills.ts",
  "src/store/account-cloud.ts",
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(vue|ts)$/.test(name)) out.push(full);
  }
  return out;
}

function parseSource(source, file) {
  let script = source, template;
  if (file.endsWith(".vue")) {
    const { descriptor, errors } = parseSfc(source, { filename: file });
    if (errors.length) throw new Error(`${file}: ${errors[0]}`);
    template = descriptor.template?.ast;
    script = source.replace(/[^\r\n]/g, " ");
    for (const block of [descriptor.script, descriptor.scriptSetup].filter(Boolean)) {
      script = script.slice(0, block.loc.start.offset) + block.content + script.slice(block.loc.end.offset);
    }
  }
  return { ast: parseScript(script, file), template };
}

function rawStatusReads(ast, template, file) {
  let text = ast.text;
  const spans = [];
  const append = expression => {
    spans.push([text.length, text.length + expression.content.length, expression.loc.start.offset]);
    text += expression.content;
  };
  const emit = (expression, event = false) => {
    if (!expression?.content) return;
    text += event ? "\n;(($event) => {" : "\n;(";
    append(expression);
    text += event ? "\n});" : "\n);";
  };
  // Bind template expressions in the same module, retaining Vue's local scopes.
  // These generated nodes are only for discovery; authority proofs use the original AST.
  (function visitTemplate(node) {
    if (node.type === 5) emit(node.content);
    const props = node.props || [];
    const loop = props.find(prop => prop.type === 7 && prop.name === "for");
    const slot = props.find(prop => prop.type === 7 && prop.name === "slot" && prop.exp);
    for (const prop of props) if (prop.type === 7 && prop.name === "if") emit(prop.exp);
    if (loop) {
      if (!loop.forParseResult) throw new Error(`${file}: invalid v-for expression`);
      emit(loop.forParseResult.source);
      text += "\n;((";
      [loop.forParseResult.value, loop.forParseResult.key, loop.forParseResult.index].filter(Boolean).forEach((alias, i) => {
        if (i) text += ", ";
        append(alias);
      });
      text += ") => {";
    }
    if (slot) { text += "\n;(("; append(slot.exp); text += ") => {"; }
    for (const prop of props) if (prop.type === 7) {
      if (!["for", "slot", "if"].includes(prop.name)) emit(prop.exp, prop.name === "on");
      if (prop.arg?.isStatic === false) emit(prop.arg);
    }
    for (const child of node.children || []) visitTemplate(child);
    if (slot) text += "\n});";
    if (loop) text += "\n});";
  })(template || {});

  const virtualFile = path.join(ROOT, `${file}.ts`);
  const bound = parseScript(text, virtualFile);
  const options = { noLib: true, noResolve: true };
  const program = ts.createProgram([virtualFile], options, {
    ...ts.createCompilerHost(options),
    getSourceFile: name => path.normalize(name) === virtualFile ? bound : undefined,
  });
  const checker = program.getTypeChecker();
  const trialImport = declaration => {
    let parent = declaration.parent;
    while (parent && !ts.isImportDeclaration(parent)) parent = parent.parent;
    if (!parent || parent.importClause?.isTypeOnly) return false;
    const name = parent.moduleSpecifier.text;
    const target = name.startsWith("@/") ? `src/${name.slice(2)}`
      : name.startsWith(".") ? path.posix.join(path.posix.dirname(file), name) : "";
    return path.posix.normalize(target).replace(/\.(?:ts|js)$/, "") === "src/store/free-trial";
  };
  // ponytail: follow declaration initializers, not arbitrary cross-function data flow.
  const fromTrial = (node, factory = false, seen = new Set()) => {
    while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)
      || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) node = node.expression;
    if (!factory && ts.isCallExpression(node)) return fromTrial(node.expression, true, seen);
    if (factory && ts.isPropertyAccessExpression(node) && node.name.text === "useFreeTrial") {
      const declaration = checker.getSymbolAtLocation(node.expression)?.declarations?.[0];
      return !!declaration && ts.isNamespaceImport(declaration) && trialImport(declaration);
    }
    if (!ts.isIdentifier(node)) return false;
    const symbol = checker.getSymbolAtLocation(node);
    if (!symbol || seen.has(symbol)) return false;
    seen.add(symbol);
    const declaration = symbol.valueDeclaration || symbol.declarations?.[0];
    if (!declaration) return false;
    if (factory && ts.isImportSpecifier(declaration)) return !declaration.isTypeOnly
      && (declaration.propertyName || declaration.name).text === "useFreeTrial" && trialImport(declaration);
    if (!ts.isVariableDeclaration(declaration) || !declaration.initializer) return false;
    if (factory && file === "src/store/free-trial.ts" && declaration.name.getText(bound) === "useFreeTrial"
      && declaration.parent.parent.parent === bound) return true;
    return fromTrial(declaration.initializer, factory, seen);
  };
  const hits = [];
  (function visit(node) {
    let receiver;
    if ((ts.isPropertyAccessExpression(node) && node.name.text === "status")
      || (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression) && node.argumentExpression.text === "status")) receiver = node.expression;
    if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent) && !node.dotDotDotToken) {
      const name = node.propertyName || node.name, owner = node.parent.parent;
      if ((ts.isIdentifier(name) || ts.isStringLiteral(name)) && name.text === "status"
        && (ts.isVariableDeclaration(owner) || ts.isParameter(owner))) receiver = owner.initializer;
    }
    if (receiver && fromTrial(receiver)) {
      const offset = node.getStart(bound);
      if (offset < ast.text.length) hits.push(offset);
      else {
        const span = spans.find(([start, end]) => offset >= start && offset < end);
        if (span) hits.push(span[2] + offset - span[0]);
      }
    }
    ts.forEachChild(node, visit);
  })(bound);
  return hits.sort((a, b) => a - b);
}

const printer = ts.createPrinter({ removeComments: true });
function canonical(node, source) {
  const result = ts.transform(node, [context => root => ts.visitNode(root, function visit(child) {
    return ts.isStringLiteral(child) ? ts.factory.createStringLiteral(child.text) : ts.visitEachChild(child, visit, context);
  })]);
  const text = printer.printNode(ts.EmitHint.Unspecified, result.transformed[0], source);
  result.dispose();
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text), tokens = [];
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) tokens.push([token, scanner.getTokenText()]);
  return JSON.stringify(tokens);
}
function parseScript(text, file) {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (ast.parseDiagnostics.length) throw new Error(`${file}: ${ts.flattenDiagnosticMessageText(ast.parseDiagnostics[0].messageText, " ")}`);
  return ast;
}
const snippets = (text) => {
  const ast = parseScript(text, "trial-proof.ts");
  return ast.statements.map(node => ({ kind: node.kind, text: canonical(node, ast) }));
};
// ponytail: prove these two finite source shapes, not arbitrary data flow. Any
// new consumer or changed shape must establish its purpose before being accepted.
const claimProof = snippets(`
const freeTrial = useFreeTrial();
const claiming = ref(false);
const activated = ref(false);
if (claiming.value || !sheet.open || activated.value) return;
activated.value = true;
watch(() => app.accountBindingEpoch, () => {
  claimSequence++; claiming.value = false; activated.value = false;
  claimError.value = false; claimErrorReason.value = undefined; sheet.closeTransient();
}, { flush: "sync" });
watch(() => sheet.open, open => {
  if (!open) return;
  claimError.value = false; claimErrorReason.value = undefined;
  activated.value = !claiming.value && freeTrial.authorityStatus === "ready"
    && (freeTrial.status === "active" || freeTrial.status === "grace");
});`);
const quoteProof = snippets(`
const freeTrial = useFreeTrial();
const hasOriginalCheckout = computed(() => !!createdCheckoutOrder.value || !!pendingCheckoutCreate.value);
const trialQuoteIncomplete = computed(() => trialEarlyQuoteLapsed.value
  || ((freeTrial.status === "active" || freeTrial.status === "grace")
    && (freeTrial.authoritativeOffsetUSD === null || freeTrial.authoritativeRemainderUSD === null || freeTrial.authoritativePriceUSD === null)));
const trialQuoteUnavailable = computed(() => remoteApiEnabled && !hasOriginalCheckout.value && (freeTrial.authorityStatus !== "ready" || trialQuoteIncomplete.value));
const trialQuoteScreenUnavailable = computed(() => remoteApiEnabled && !hasOriginalCheckout.value && ((freeTrial.authorityStatus !== "ready"
  && !(freeTrial.authorityStatus === "loading" && freeTrial.authorityServerState !== null)) || trialQuoteIncomplete.value));
if (trialQuoteUnavailable.value && !trialQuoteScreenUnavailable.value) {
  const ready = await freeTrial.refreshRemote(); if (!ready || !isCurrentCheckoutRoute(scope)) return;
}
if (trialQuoteUnavailable.value || quantitySwitching.value || (remoteApiEnabled && !checkoutWalletReadable.value)) return;
if (trialQuoteUnavailable.value) return;
if (trialQuoteUnavailable.value && !createdCheckoutOrder.value && !pendingCheckoutCreate.value) return;
if (!isCurrentCheckoutRoute(scope) || ((!createdCheckoutOrder.value && !pendingCheckoutCreate.value) && trialQuoteScreenUnavailable.value) || step.value !== "confirm") return;
if (trialQuoteScreenUnavailable.value && !createdCheckoutOrder.value && !pendingCheckoutCreate.value) return;
if (trialQuoteUnavailable.value) { confirming = false; return; }
const paymentCurrent = () => isCurrentCheckoutRoute(confirmationScope) && (!!replay || (!trialQuoteScreenUnavailable.value
  && totalStillConfirmed(confirmedAmount) && confirmedTrialApplied === trialView.value.applied && confirmedTrialQuoteVersion === trialView.value.quoteVersion));
if (!createdCheckoutOrder.value && !pendingCheckoutCreate.value && (trialQuoteScreenUnavailable.value || trialView.value.applied || freeTrial.hasPendingConversion()
    || reviewedTrialVersion !== trialView.value.quoteVersion || reviewedTotal !== confirmationTotal.value)) {
  confirming = false; toast.warn(t.value.store.coTotalQuoteChanged); step.value = "select-payment"; return;
}
const authorized = await executeSelectedPurchase({ amount: originalAmount, currency: "USDT", summary: p.name },
  async authorization => {
    if (!paymentCurrent()) return null;
    return freeTrial.convert(p.id, originalAmount, originalVersion, authorization);
  }, paymentCurrent,
  { kind: "TRIAL_CONVERT", payload: { productNo: p.id, expectedAmountUsdt: originalAmount, quoteVersion: originalVersion },
    commandKey: () => freeTrial.conversionPaymentKey(p.id, originalAmount, originalVersion),
    parseReceipt: async raw => { const receipt = parseTrialConvertReceipt(raw); const result = await freeTrial.convert(p.id, originalAmount, originalVersion); if (!result.ok || result.orderNo !== receipt.orderNo) throw new Error("TRIAL_CONVERT_RESULT_UNKNOWN"); return result; } });`);
claimProof.forEach((proof, i) => { proof.owner = i === 3 || i === 4 ? "onClaim" : ""; });
quoteProof.forEach((proof, i) => { proof.owner = ["", "", "", "", "", "submitReview", "submitReview", "goConfirm", "requestConfirmPay", "requestConfirmPay", "onConfirmPay", "onConfirmPay", "onConfirmPay", "submitRemoteOrder", "onConfirmPay"][i]; });
const paymentProof = snippets(`
const recoveryScope = captureCheckoutRoute();
const confirmedAmount = confirmationTotal.value;
const confirmedTrialApplied = trialView.value.applied;
const confirmedTrialQuoteVersion = trialView.value.quoteVersion;
if (remoteApiEnabled) {
  const recovering = createdCheckoutOrder.value ? false : await resumeServerOrder(recoveryScope);
  if (recovering || !isCurrentCheckoutRoute(recoveryScope)) { confirming = false; return; }
  if (checkoutOnboardingRequired.value && !freeTrial.hasPendingConversion()) {
    confirming = false; step.value = "select-payment"; toast.warn(t.value.store.coSetupRequired); return;
  }
  const trialReady = await freeTrial.refreshRemote();
  if (!trialReady || !isCurrentCheckoutRoute(recoveryScope)) { confirming = false; return; }
}
if (trialQuoteUnavailable.value) { confirming = false; return; }
if (!totalStillConfirmed(confirmedAmount) || (!freeTrial.hasPendingConversion() && (confirmedTrialApplied !== trialView.value.applied
    || confirmedTrialQuoteVersion !== trialView.value.quoteVersion))) {
  confirming = false; toast.warn(t.value.store.coTotalQuoteChanged); step.value = "select-payment"; return;
}`);
const claimTemplate = [
  ["if:", "activated", 4], ["bind:class", "{ 'tcs-spark-box--success': activated }", 1],
  ["else-if:", "!activated && freeTrial.authorityStatus === 'error'", 1],
  ["bind:aria-label", "activated ? copy.activationSuccessTitle : copy.activateTitle", 1],
  ["bind:aria-label", "activated ? copy.close : t.trial.sheetDismissCta", 1],
  ["text", "activated ? copy.close : t.trial.sheetDismissCta", 1],
];
const quoteTemplate = [
  ["else-if:", "trialQuoteScreenUnavailable", 1],
  ["if:", "!promotionRoute && !keepCheckoutTarget && !pendingCheckoutCreate && !remoteTradeinRecoveryError && product && !trialQuoteScreenUnavailable && !receiptWriteFailure && (step === 'select-payment' || step === 'confirm')", 1],
];
const expressionKey = (text) => snippets(`const value = (${text});`)[0].text;

function provenAuthorityReads(source, file) {
  const { ast, template } = parseSource(source, file);
  const nodes = [], identifiers = [], bindings = new Map(), rawNodes = [];
  const conditionalRegions = [], starts = [];
  for (const match of source.matchAll(/^[ \t]*(?:\/\/|<!--)[ \t]*#(ifdef|ifndef|endif)\b[^\r\n]*/gm)) {
    if (match[1] !== "endif") starts.push(match.index);
    else {
      const start = starts.pop();
      if (start === undefined) throw new Error(`${file}: unmatched conditional-compilation endif`);
      conditionalRegions.push([start, match.index + match[0].length]);
    }
  }
  for (const start of starts) conditionalRegions.push([start, source.length]);
  const conditional = (node) => conditionalRegions.some(([from, to]) => node.getStart(ast) < to && node.end > from);
  (function visit(node) {
    if (ts.isIdentifier(node)) identifiers.push(node);
    if (ts.isVariableStatement(node) || ts.isIfStatement(node) || ts.isExpressionStatement(node)) nodes.push(node);
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node) || ts.isFunctionDeclaration(node)
      || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node) || ts.isImportSpecifier(node) || ts.isImportClause(node) || ts.isNamespaceImport(node)) && node.name && ts.isIdentifier(node.name)) {
      bindings.set(node.name.text, [...(bindings.get(node.name.text) || []), node]);
    }
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "freeTrial" && node.name.text === "status") rawNodes.push(node);
    ts.forEachChild(node, visit);
  })(ast);
  const code = new Map(), allowed = new Set();
  const normalized = (node) => {
    if (!code.has(node)) code.set(node, canonical(node, ast));
    return code.get(node);
  };
  const owner = (node) => {
    for (let parent = node.parent; parent && parent !== ast; parent = parent.parent) if (ts.isFunctionLike(parent)) return ts.isFunctionDeclaration(parent) ? parent.name?.text : null;
    return node.parent === ast ? "" : null;
  };
  const importFrom = (name, module) => {
    const entries = bindings.get(name) || [];
    return entries.length === 1 && ts.isImportSpecifier(entries[0]) && !entries[0].isTypeOnly
      && (entries[0].propertyName || entries[0].name).text === name
      && !entries[0].parent.parent.isTypeOnly && entries[0].parent.parent.parent.moduleSpecifier.text === module;
  };
  for (const [proof, flags, expectedTemplate, imports, protectedNames] of [
    [claimProof, ["activated"], claimTemplate, [["ref", "vue"], ["watch", "vue"]], ["claiming", "sheet", "app"]],
    [quoteProof, ["trialQuoteIncomplete", "trialQuoteUnavailable", "trialQuoteScreenUnavailable"], quoteTemplate,
      [["computed", "vue"], ["remoteApiEnabled", "@/api/runtime"], ["executeSelectedPurchase", "@/lib/selected-purchase-payment"]],
      ["hasOriginalCheckout", "createdCheckoutOrder", "pendingCheckoutCreate"]],
  ]) {
    const names = ["freeTrial", "useFreeTrial", ...flags, ...protectedNames, ...imports.map(([name]) => name)];
    if (!importFrom("useFreeTrial", "@/store/free-trial") || !imports.every(([name, module]) => importFrom(name, module))
      || names.some(name => bindings.get(name)?.length !== 1)) continue;
    if (names.some(name => conditional(bindings.get(name)[0]))) continue;
    let changedBinding = false;
    (function assignments(node) {
      if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
        && ts.isIdentifier(node.left) && names.includes(node.left.text)) changedBinding = true;
      ts.forEachChild(node, assignments);
    })(ast);
    if (changedBinding) continue;
    const matches = proof.map(expected => nodes.filter(node => node.kind === expected.kind && owner(node) === expected.owner && normalized(node) === expected.text));
    if (matches.some(found => found.length !== 1)) continue;
    const approved = matches.flat();
    if (approved.some(conditional)) continue;
    if (identifiers.some(node => flags.includes(node.text) && !approved.some(parent => node.getStart(ast) >= parent.getStart(ast) && node.end <= parent.end))) continue;
    if (proof === quoteProof) {
      const paymentNode = approved.find(node => ts.isVariableStatement(node) && node.declarationList.declarations[0].name.getText(ast) === "paymentCurrent");
      const paymentScope = paymentNode.parent;
      const paymentUses = approved.filter(node => node === paymentNode || (ts.isVariableStatement(node) && node.declarationList.declarations[0].name.getText(ast) === "authorized"));
      if (identifiers.some(node => node.text === "paymentCurrent" && node.getStart(ast) >= paymentScope.getStart(ast) && node.end <= paymentScope.end
        && !paymentUses.some(parent => node.getStart(ast) >= parent.getStart(ast) && node.end <= parent.end))) continue;
      const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "onConfirmPay" && !node.parameters.length);
      const statements = fn?.body?.statements || [];
      if (!statements.some((node, start) => paymentProof.every((expected, i) => statements[start + i]?.kind === expected.kind
        && canonical(statements[start + i], ast) === expected.text && !conditional(statements[start + i])))) continue;
    }
    const seenTemplate = new Map();
    let unknownTemplate = false;
    (function visitTemplate(node) {
      for (const [expression, dynamicArg] of [[node.type === 5 ? node.content : node.exp, false], [node.arg?.isStatic === false ? node.arg : undefined, true]]) {
        if (expression?.content && flags.some(name => new RegExp(`\\b${name}\\b`).test(expression.content))) {
          const parsed = parseScript(`const value = (${expression.content});`, `${file}:template`);
          let readsFlag = false;
          (function reads(child) { if (ts.isIdentifier(child) && flags.includes(child.text)) readsFlag = true; ts.forEachChild(child, reads); })(parsed);
          if (readsFlag) {
            const kind = node.type === 5 ? "text" : `${node.name}:${node.arg?.isStatic === false ? "dynamic:" : ""}${node.arg?.content || ""}`;
            const index = expectedTemplate.findIndex(([type, text]) => type === kind && expressionKey(text) === canonical(parsed.statements[0], parsed));
            if (dynamicArg || index < 0) unknownTemplate = true;
            else seenTemplate.set(index, (seenTemplate.get(index) || 0) + 1);
          }
        }
      }
      for (const child of node.children || []) visitTemplate(child);
      for (const prop of node.props || []) visitTemplate(prop);
    })(template || {});
    if (unknownTemplate || expectedTemplate.some(([, , count], i) => seenTemplate.get(i) !== count)) continue;
    for (const node of rawNodes) if (approved.some(parent => node.getStart(ast) >= parent.getStart(ast) && node.end <= parent.end)) allowed.add(node.getStart(ast));
  }
  return allowed;
}

const files = walk(SRC);
const consumers = new Map(); // rel -> [lineNo...]
let scannedHits = 0;
let provenHits = 0;

for (const full of files) {
  const rel = path.relative(ROOT, full).replace(/\\/g, "/");
  const raw = readFileSync(full, "utf8");
  // Other platform SFCs can contain mutually exclusive script blocks; only the
  // trial definition and files naming its import module need this TS/Vue binder.
  if (!RESOLVER_FILES.includes(rel) && !/\bfree-trial(?:\.(?:ts|js))?["']/.test(raw)) continue;
  const { ast, template } = parseSource(raw, rel);
  const rawHits = rawStatusReads(ast, template, rel).map(offset => ({ offset, line: raw.slice(0, offset).split("\n").length }));
  if (!rawHits.length) continue;
  scannedHits += new Set(rawHits.map(hit => hit.line)).size;
  if (RESOLVER_FILES.includes(rel)) continue; // 定义面,不算消费者
  const proven = provenAuthorityReads(raw, rel);
  const hits = [...new Set(rawHits.filter(hit => !proven.has(hit.offset)).map(hit => hit.line))];
  provenHits += rawHits.filter(hit => proven.has(hit.offset)).length;
  if (hits.length) consumers.set(rel, hits);
}

const fails = [];

// 判据① 未登记消费者
for (const [rel, lines] of consumers) {
  if (!(rel in ALLOWLIST)) {
    fails.push(
      `未登记的原始状态消费者:${rel}(行 ${lines.join(",")})—— ` +
        `金额相关必须改走解析器(resolveTrialAt);纯展示请在 scripts/selfcheck-trial-encapsulation.mjs 的 ALLOWLIST 登记理由`,
    );
  }
}

// 判据② 钱路径禁令(与①正交:即便登记了也红)
for (const rel of consumers.keys()) {
  if (MONEY_PATHS.includes(rel)) {
    fails.push(
      `钱路径直接读原始试用状态:${rel} —— 金额只认解析器单次解析结果,` +
        `禁止混源(R2 P0 事故形态:一半原始状态一半解析器,拼出用户没见过的净额)`,
    );
  }
}

// 自破坏保护:扫不到任何命中 = 判据失效,不许静默全过
if (scannedHits === 0) {
  console.error(
    `FAIL 试用封装门判据失效:扫了 ${files.length} 个源文件却 0 命中 —— ` +
      `解析器自身也应至少出现一次;疑似匹配模式或目录结构已变更`,
  );
  process.exit(1);
}

if (fails.length) {
  for (const f of fails) console.error(`FAIL ${f}`);
  process.exit(1);
}

const listed = [...consumers.keys()];
console.log(
  `PASS trial state encapsulation: 消费者 ${listed.length} 处均已登记且非钱路径` +
    `(${listed.join(" · ") || "无"});扫 ${files.length} 个源文件 / ${scannedHits} 处原始状态读取 / ` +
    `完整权威布尔用途已证明 ${provenHits} 个读取节点 / ` +
    `钱路径禁令覆盖 ${MONEY_PATHS.length} 个文件`,
);
