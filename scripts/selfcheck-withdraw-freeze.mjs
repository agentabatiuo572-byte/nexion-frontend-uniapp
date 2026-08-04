#!/usr/bin/env node
// 提现提交链「冻结快照」自检 — node 直跑,不起浏览器:
//   node scripts/selfcheck-withdraw-freeze.mjs
//
// 背景(2026-08-04 R2 三条 P1,全部同一个根:**跨 await 的状态漂移**):
//   P1-A 失败提现退还了 NEX,账单里那条「−N NEX(已入账)」却没人冲正 → 账本与钱包互相矛盾;
//   P1-B 确认弹窗读一次报价、扣款又读一次,两次之间跨了 await uiConfirm → 确认 A 报价扣 B 报价;
//   P1-C 账号快照取在 await uiConfirm 之后 → 确认期间换号,钱扣新账号、弹窗写的是旧账号。
//
// 🔴 守的不变量(编号对应红测文档 docs/changes/2026-08-04-withdraw-freeze-redtest.md):
//   ① 提交快照冻在**第一个 await 之前**;确认弹窗文案只读快照(展示 = 扣款,单源)。
//   ② 首个 await 之后不得再读活值 —— 唯一例外是与 snap.* 比对的那一行(确认后校验)。
//   ③ 确认后校验(身份三元组 + 报价复验)排在 debitNex **之前**;建单入参用 snap.fee/snap.offset。
//   ④ quoteStillValid 必须拿**当前**权威值复验(拿冻结费率复验冻结报价 = 等式恒真,门等于没有)。
//   ⑤ 行为固定靶(跑**页面里那个** quoteStillValid + 真 nex-faucet):弹窗后费率变动 → 拒单;
//      费率没变 → 放行(正常路径不受影响);反证「重读活值重新报价」会被放行(旧实现的行为)。
//   ⑥ 行为固定靶(跑**App.vue 里那段** reconcile + 真 bills store):退款幂等键落了才补
//      +N NEX 反向分录,同单号 NEX 净和 = 0(账本对得上),重复调用不重复补。
//
// 方法:结构断言跑在**剥注释后的正主源码**上(注释里出现判定式文本不得哄绿);
// 行为断言把正主代码块原文抠出来执行(不是抄一份复制品)。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build, transformSync } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGE = path.join(root, "src", "pages", "me", "wallet-withdraw.vue");
const APP_VUE = path.join(root, "src", "App.vue");
const pageRaw = readFileSync(PAGE, "utf8");
const appVueRaw = readFileSync(APP_VUE, "utf8");

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`); }
}

/** 行首 // 与块注释一起剥 —— 只剥「整行就是注释」的,不碰 url 里的 //。 */
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/** 从 needle 起花括号配对抠出整块原文。抠不到 = 实现被改名/删除,直接炸(不许静默放行)。 */
function grabBlock(src, needle) {
  const start = src.indexOf(needle);
  if (start < 0) throw new Error(`selfcheck-withdraw-freeze: 源码里找不到 \`${needle}\`(实现被改名或删除?)`);
  let depth = 0;
  for (let i = src.indexOf("{", start); i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`selfcheck-withdraw-freeze: \`${needle}\` 括号不闭合`);
}

console.log("selfcheck-withdraw-freeze — 提交链快照单源化 + NEX 退款账本对齐");

// ── ①②③ handleSubmit 的快照纪律(结构,跑在剥注释后的正主源码上) ─────────────
const submitBody = strip(grabBlock(strip(pageRaw), "async function handleSubmit()"));
const iSnap = submitBody.indexOf("const snap = {");
const iAwait = submitBody.indexOf("await ");
const iConfirm = submitBody.indexOf("await uiConfirm(");
const iDebit = submitBody.indexOf("app.debitNex(");
const iIdentity = submitBody.indexOf("app.accountKey !== snap.account");
const iQuoteGate = submitBody.indexOf("quoteStillValid(snap.fee, snap.offset, snap.network)");
{
  check("① 提交快照存在且冻在第一个 await 之前",
    iSnap >= 0 && iAwait >= 0 && iSnap < iAwait, `snap@${iSnap} await@${iAwait}`);
  // 快照必须覆盖全部建单输入 —— 少一项就是又留一条漂移通道。
  const keys = ["account:", "network:", "address:", "amount:", "maxWithdrawable:", "offset:", "quote:", "fee:"];
  const missing = keys.filter((k) => !submitBody.slice(iSnap, iSnap + 900).includes(k));
  check(`① 快照覆盖 ${keys.length} 项建单输入(账号/网络/地址/金额/上限/开关/报价/费用快照)`,
    missing.length === 0, missing.join(","));
  // 弹窗文案 = 快照。confirmBody 段里出现任何活值读取,就是「展示 A 扣款 B」的原始形态。
  // 段起点取 confirmBody 而非 snap —— 快照字面量自己当然要读一次活值,那正是冻结动作本身。
  const dialogSeg = submitBody.slice(submitBody.indexOf("const confirmBody"), iConfirm);
  check("① 弹窗文案只读快照(段内 0 处 feeCalc.value / amountNum.value)",
    dialogSeg.includes("snap.quote") && dialogSeg.includes("snap.amount")
    && !dialogSeg.includes("feeCalc.value") && !dialogSeg.includes("amountNum.value"));
}
{
  // ② 首个 await 之后逐个活值扫描:允许出现的唯一形态是「与 snap.* 比对」那一行。
  const LIVE = ["feeCalc.value", "amountNum.value", "offsetWithNex.value", "maxWithdrawable.value",
    "app.accountKey", "network.value", "boundAddress.value"];
  const tail = submitBody.slice(iAwait);
  const offenders = [];
  for (const line of tail.split(/\r?\n/)) {
    for (const tok of LIVE) {
      if (line.includes(tok) && !line.includes("snap.")) offenders.push(`${tok} @ ${line.trim().slice(0, 60)}`);
    }
  }
  check(`② 首个 await 之后 0 处裸读活值(扫 ${LIVE.length} 个活值 token · ${tail.split(/\r?\n/).length} 行)`,
    offenders.length === 0, offenders.join(" | "));
}
{
  // ③ 顺序:确认后校验必须排在动钱之前,否则「拒单」发生在 NEX 已经烧掉之后。
  check("③ 身份三元组校验(账号/网络/地址)排在 debitNex 之前",
    iIdentity >= 0 && iDebit >= 0 && iIdentity < iDebit, `identity@${iIdentity} debit@${iDebit}`);
  check("③ 冻结报价复验排在 debitNex 之前(拒单不扣款)",
    iQuoteGate >= 0 && iQuoteGate < iDebit, `gate@${iQuoteGate} debit@${iDebit}`);
  check("③ 身份校验比的是三元组全部(账号 + 网络 + 收款地址)",
    /app\.accountKey !== snap\.account \|\| network\.value !== snap\.network \|\| boundAddress\.value !== snap\.address/.test(submitBody));
  check("③ 建单入参用快照(snap.amount/network/address/fee/offset,不重新拼)",
    /submitWithdrawal\(\s*snap\.amount,\s*snap\.network,\s*snap\.address,\s*snap\.fee,\s*snap\.offset,/.test(submitBody));
  check("③ 拒单归因用同一个判据(quoteStillValid),不是另拿冻结费率自洽复验一遍",
    submitBody.split("quoteStillValid(snap.fee, snap.offset, snap.network)").length - 1 === 2
    && !submitBody.includes("isWithdrawalFeeSnapshotValid("));
}
{
  // ④ 反空转:判据本身若拿冻结值复验冻结报价,等式恒成立 —— 这道门就等于没有。
  const qsv = strip(grabBlock(strip(pageRaw), "function quoteStillValid("));
  check("④ quoteStillValid 拿**当前**权威值复验(nexFeeOffsetRate.value + currentNetworkConfirmFeeUsd())",
    qsv.includes("nexFeeOffsetRate.value") && qsv.includes("currentNetworkConfirmFeeUsd()")
    && qsv.includes("NETWORK_FEE_KEY[net]") && qsv.includes("isWithdrawalFeeSnapshotValid("));
  check("④ 权威值走 config 纯函数单源(页面 import,禁本地写死同名函数)",
    /import \{[^}]*currentNetworkConfirmFeeUsd[^}]*\} from "@\/store\/config"/.test(strip(pageRaw))
    && !/function currentNetworkConfirmFeeUsd/.test(strip(pageRaw)));
  // 提交期间输入面必须整体冻结(弹窗那几秒 submitting 还是 false)。
  check("④ 输入面冻结判据含确认弹窗在途(inputsLocked = submitting || confirmingSubmit)",
    /const inputsLocked = computed\(\(\) => submitting\.value \|\| confirmingSubmit\.value\)/.test(strip(pageRaw))
    && strip(pageRaw).includes(':disabled="inputsLocked"'));
}

// ── 载真依赖:nex-faucet 纯函数 + bills store(stub 掉 pinia/vue/storage) ───────
const STUBS = {
  "pinia-stub": `export const defineStore = (_id, setup) => setup;`,
  "vue-stub": `export const ref = (v) => ({ value: v });`,
  "storage-stub": `const mem = new Map();
export const readAccountRow = (t, k) => mem.get(t + "|" + k) ?? null;
export const writeAccountRow = (t, k, row) => { mem.set(t + "|" + k, row); return true; };
// 本门只用 nex-faucet 的两个**纯函数**(computeWithdrawFee / isWithdrawalFeeSnapshotValid),
// 从不实例化那个 store,所以它的 CAS 提交器不需要在这里跑。真被调到 = 用法变了,
// 炸出来比返回个假对象静默跑偏好(乐观并发行为归 scripts/selfcheck-money-cas.mjs)。
export const createAccountRowCommit = () => {
  throw new Error("selfcheck-withdraw-freeze: 本门不实例化走 CAS 的 store —— 要测并发请用 selfcheck-money-cas.mjs");
};`,
  "cloud-stub": `export const normalizeAccountKey = (s) => String(s || "default").trim().toLowerCase();`,
  "id-stub": `let n = 0; export const mockServerId = (p) => p + "-" + (++n);`,
  "time-stub": `export const mockServerNow = () => Date.now();`,
};
async function loadStore(rel) {
  const out = await build({
    entryPoints: [path.join(root, "src", "store", rel)],
    bundle: true, write: false, format: "esm",
    plugins: [{
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /^pinia$/ }, () => ({ path: "pinia-stub", namespace: "stub" }));
        b.onResolve({ filter: /^vue$/ }, () => ({ path: "vue-stub", namespace: "stub" }));
        b.onResolve({ filter: /account-scoped-storage$/ }, () => ({ path: "storage-stub", namespace: "stub" }));
        b.onResolve({ filter: /account-cloud$/ }, () => ({ path: "cloud-stub", namespace: "stub" }));
        b.onResolve({ filter: /mock-id$/ }, () => ({ path: "id-stub", namespace: "stub" }));
        b.onResolve({ filter: /server-time$/ }, () => ({ path: "time-stub", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({ contents: STUBS[a.path], loader: "js" }));
      },
    }],
  });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text, "utf8").toString("base64"));
}
const { computeWithdrawFee, isWithdrawalFeeSnapshotValid } = await loadStore("nex-faucet.ts");
const { useBills } = await loadStore("bills.ts");

// ── ⑤ 行为固定靶:跑**页面里那个** quoteStillValid,不是抄一份判据 ────────────
{
  const js = transformSync(grabBlock(pageRaw, "function quoteStillValid("), { loader: "ts" }).code;
  const rate = { value: 0.4 };
  let authority = { trc20: 1, bep20: 1, erc20: 5 };
  const NETWORK_FEE_KEY = { "USDT-TRC20": "trc20", "USDT-BEP20": "bep20", "USDT-ERC20": "erc20" };
  // eslint-disable-next-line no-new-func — 正主代码块原文注入执行:改坏它这里必红
  const quoteStillValid = new Function(
    "isWithdrawalFeeSnapshotValid", "nexFeeOffsetRate", "NETWORK_FEE_KEY", "currentNetworkConfirmFeeUsd",
    `${js}; return quoteStillValid;`,
  )(isWithdrawalFeeSnapshotValid, rate, NETWORK_FEE_KEY, () => authority);

  // 弹窗打开那一刻:权威 TRC20 $1,开抵扣,烧 3 NEX 全抵。
  const q = computeWithdrawFee(100, 1240, true, rate.value, 1);
  const snapFee = { networkConfirmUsd: q.networkConfirmUsd, nexBurned: q.nexBurned, actualFeeUsd: q.actualFee };
  check("⑤④ 正常路径:权威没变 → 冻结快照复验放行(不误伤)",
    quoteStillValid(snapFee, true, "USDT-TRC20") === true);

  authority = { trc20: 2, bep20: 1, erc20: 5 };            // 确认期间后台把网络确认费改成 $2
  check("⑤① 弹窗后费率变动 → 冻结快照复验拒单(不静默按新值扣款)",
    quoteStillValid(snapFee, true, "USDT-TRC20") === false);
  const reQuoted = computeWithdrawFee(100, 1240, true, rate.value, 2);
  check("⑤① 反证:重读活值重新报价会被放行 —— 差别就在「用哪份」(旧实现正是扣了这份 B 报价)",
    quoteStillValid({ networkConfirmUsd: reQuoted.networkConfirmUsd, nexBurned: reQuoted.nexBurned, actualFeeUsd: reQuoted.actualFee }, true, "USDT-TRC20") === true);
  check("⑤① B 报价与弹窗展示的 A 报价确实不同(固定靶不是同值自证)",
    reQuoted.networkConfirmUsd !== q.networkConfirmUsd);

  authority = { trc20: 1, bep20: 1, erc20: 5 };
  // 阶段换档:抵扣率**降**到 $0.30 → 3 NEX 只抵 $0.90,用户实付变 $0.10(弹窗写的是 $0)。
  rate.value = 0.3;
  check("⑤① 弹窗后抵扣率换档(降) → 冻结快照复验拒单",
    quoteStillValid(snapFee, true, "USDT-TRC20") === false);
  // 反向的「率涨了」不拒:等式在 max(0,…) 上饱和,按快照扣 = 按新率扣,用户付的正是确认的数。
  rate.value = 0.5;
  check("⑤ 抵扣率上调但实付不变 → 放行(拒单只针对真会改变扣款额的漂移)",
    quoteStillValid(snapFee, true, "USDT-TRC20") === true);
  rate.value = 0.4;
  check("⑤ 配置拉不到 → fail-closed 拒单(禁按写死值放行)",
    ((authority = null), quoteStillValid(snapFee, true, "USDT-TRC20")) === false);
}

// ── ⑥ 行为固定靶:跑**App.vue 里那段** NEX 退还反向分录 + 真 bills store ────────
{
  const anchor = appVueRaw.indexOf("// ②b NEX 抵扣费退还");
  if (anchor < 0) throw new Error("selfcheck-withdraw-freeze: App.vue 里找不到 ②b NEX 退还反向分录段");
  const loopSrc = grabBlock(appVueRaw.slice(anchor), "for (const wd of app.withdrawals)");
  // eslint-disable-next-line no-new-func — 同上,执行的是正主原文
  const reconcileNexRefund = new Function("app", "bills", "postReceiptOnly", loopSrc);

  const store = useBills();
  store.seed();
  // pinia 在 store 代理上解包 ref;stub 不解包,这里补上同一层语义(否则测的不是页面看到的形状)。
  const bills = { get bills() { return store.bills.value; }, add: store.add };
  // ②b 段 2026-08-04 起走收口点 postReceiptOnly(钱已由 refundFailedWithdrawals 退回、
  // 不可回滚,这里只补那条缺的分录)。替身与 lib/money-receipt.ts 同契约:写一行 + 返回是否落盘。
  // 收口点自身的失败处置(报错不静默)归 selfcheck-money-receipt ④;本门只管这段对账逻辑
  // **写出来的分录**对不对 —— 两道门各守一段,不互相顶替。
  const postReceiptOnly = (draft) => !!bills.add(draft);
  const ID = "WD-20260804-1234";
  const app = {
    withdrawals: [{ id: ID, status: "tx-failed", amount: 50, fee: { networkConfirmUsd: 1, nexBurned: 3, actualFeeUsd: 0 } }],
    user: { appliedRewardKeys: {} },
  };
  const nexRows = () => bills.bills.filter((b) => b.ref === ID && b.symbol === "NEX");
  const nexNet = () => nexRows().reduce((a, b) => a + b.amount, 0);

  // 提交那一刻写下的燃烧行(posted —— 当时确实烧了)
  bills.add({ type: "withdraw", symbol: "NEX", amount: -3, status: "posted", memo: "burn", ref: ID });
  check("⑥ 起点:账单里只有 −3 NEX 一行,净和 −3(钱包已扣)", nexRows().length === 1 && nexNet() === -3);

  reconcileNexRefund(app, bills, postReceiptOnly);
  check("⑥ 退款幂等键未落 → 不抢跑记账(账单不得先于余额宣布退款)", nexRows().length === 1 && nexNet() === -3);

  app.user.appliedRewardKeys["refund-nex:" + ID] = true;   // store 真退了 NEX
  reconcileNexRefund(app, bills, postReceiptOnly);
  const refundRow = nexRows().find((b) => b.amount > 0);
  check("⑥ 退款落盘 → 补一条 +3 NEX 反向分录(type/status/ref 与燃烧行同族)",
    !!refundRow && refundRow.amount === 3 && refundRow.status === "posted"
    && refundRow.type === "withdraw" && refundRow.ref === ID);
  check("⑥ 🔴 同单号 NEX 净和 = 0 —— 账单页与钱包余额对得上(P1-A 的核心断言)", nexNet() === 0);
  check("⑥ 反向分录用 memoKey 渲染时翻译(不写死某一种语言)", refundRow?.memoKey === "withdrawNexRefund");
  check("⑥ 燃烧行仍是 posted(既成事实不改写,冲正靠反向分录)",
    nexRows().find((b) => b.amount < 0)?.status === "posted");

  reconcileNexRefund(app, bills, postReceiptOnly);
  reconcileNexRefund(app, bills, postReceiptOnly);
  check("⑥ 幂等:再跑 2 轮不重复补(判据 = 同单号已有正向 NEX 行)", nexRows().length === 2 && nexNet() === 0);

  // 没开抵扣的单(nexBurned 缺失 / 0)与历史纯数字 fee:一条都不许补
  const ID2 = "WD-20260804-5678";
  app.withdrawals.push(
    { id: ID2, status: "review-rejected", amount: 20, fee: { networkConfirmUsd: 1, nexBurned: 0, actualFeeUsd: 1 } },
    { id: "WD-legacy-0001", status: "tx-failed", amount: 10, fee: 1 },
  );
  app.user.appliedRewardKeys["refund-nex:" + ID2] = true;
  reconcileNexRefund(app, bills, postReceiptOnly);
  check("⑥ 没烧过 NEX 的单 + 历史纯数字 fee 的单:0 条反向分录(不凭空发币)",
    bills.bills.filter((b) => b.amount > 0 && (b.ref === ID2 || b.ref === "WD-legacy-0001")).length === 0);

  // 🔴 冲正靠反向分录的前提:settleByRef 不许改写已终态行。若有人「顺手」让它把 NEX 燃烧行
  // 一起翻成 failed,账本就同时说「这笔烧失败了」和「已退还」——同一件事两个说法(bills.ts
  // L189 那段规则的行为背书;跑真 store,不是读注释)。
  bills.add({ type: "withdraw", symbol: "USDT", amount: -50, status: "pending", memo: "wd", ref: ID });
  check("⑥ settleByRef 推进在途 USDT 行到 failed(skip 规则不许过宽)",
    store.settleByRef(ID, "failed") === true
    && bills.bills.find((b) => b.ref === ID && b.symbol === "USDT").status === "failed");
  check("⑥ settleByRef 不改写已终态行:两条 NEX 行仍 posted、净和仍 0",
    nexRows().length === 2 && nexRows().every((b) => b.status === "posted") && nexNet() === 0);

  check("⑥ i18n:withdrawNexRefund 三语齐(en/zh/vi)",
    ["en", "zh", "vi"].every((l) =>
      readFileSync(path.join(root, "src", "i18n", "messages", `${l}.ts`), "utf8").includes("withdrawNexRefund:")));
  check("④ i18n:withdrawContextStale 三语齐(换账号拒单文案)",
    ["en", "zh", "vi"].every((l) =>
      readFileSync(path.join(root, "src", "i18n", "messages", `${l}.ts`), "utf8").includes("withdrawContextStale:")));
}

// ── ⑦ 行为固定靶:换号后账单必须写回**被扣款的那个账号**(R3 P1)────────────
// 原实现在换号时直接 return 不写:动机对(写进当前账号 = 别人的流水),结论错 ——
// 钱已扣在旧账号,不写就是「有扣款、无凭证」。addForAccount 直写目标账号行。
{
  const store = useBills();
  const OLD = "acct-old";
  const NEW = "acct-new";
  const REF = "WD-CROSS-1";
  store.bindAccount(OLD);
  const seenOld = () => store.bills.value ?? store.bills;
  // 模拟 await 期间换号:钱扣在 OLD,写账单时当前绑定已是 NEW
  store.bindAccount(NEW);
  const wrote = store.addForAccount(OLD, {
    type: "withdraw", symbol: "USDT", amount: -50, status: "pending", memo: "cross", ref: REF,
  });
  check("⑦ 换号后写账单返回成功(不再静默 return 丢凭证)", !!wrote);
  check("⑦ 当前(新)账号视图里**没有**这笔别人的流水",
    !(seenOld()).some((b) => b.ref === REF));
  store.bindAccount(OLD);
  check("⑦ 切回被扣款账号后,这笔流水在(金额/单号都对)",
    (seenOld()).some((b) => b.ref === REF && b.amount === -50 && b.symbol === "USDT"));
  // 目标账号 == 当前账号时应退化为 add(),同步刷新内存态
  const same = store.addForAccount(OLD, {
    type: "withdraw", symbol: "NEX", amount: -3, status: "posted", memo: "same", ref: "WD-SAME-1",
  });
  check("⑦ 目标即当前账号 → 退化为 add(),内存态同步可见(页面立刻能看到)",
    !!same && (seenOld()).some((b) => b.ref === "WD-SAME-1"));
  check("⑦ 提现页两处账单写入均已改走 addForAccount(不再有裸 bills.add 漏写)",
    (pageRaw.match(/bills\.addForAccount\(\s*snap\.account/g) || []).length === 2
    && !/bills\.add\(\{\s*type:\s*"withdraw"/.test(pageRaw));
}

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
