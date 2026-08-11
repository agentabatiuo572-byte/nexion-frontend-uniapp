#!/usr/bin/env node
// 提现账单行 **runtime** 门 —— 真页面、真 store、真收口点,只桩网络那一层:
//   BASE_URL=http://localhost:5173 node scripts/withdraw-bill-runtime.mjs
//
// 🔴 为什么静态门不够(z4 R1 独立审计):
//   `scripts/selfcheck-bill-producers.mjs` 守的是「有没有代码写得出这种账单行」,
//   它抓得住「生产者被删」,但**抓不住「生产者不可达」**——`if (false) { …写账单… }`、
//   写在一个永不被调用的函数里、或者调用点在一条实际走不到的分支上,静态判据全绿。
//   同一份审计还实测到:提现那三条 token 里的 `NEX+`(App.vue 的抵扣费冲正行)在 remote
//   模式下运行期确实永不执行 —— 「有生产者」≠「跑得到」,这正是本门补的那一刀。
//
// 🔴 桩到哪一层:只覆盖 `withdrawalApi.policy` / `submit` 两个方法(与
//   scripts/selfcheck-withdraw-failpaths.mjs 同法)。`toCanonicalWithdrawal`、app store、
//   bills store、收口点、**以及提现页那个 handler 本身**全是真代码 —— 被测的正是它们。
//   不桩就跑不了:提现建单只认真后端,mock 模式下 apiClient 一律 reject,
//   本地 dev 没有 /api,两种情况下这条链一步都走不到(那也正是它曾被删掉半年没人发现的原因)。
//
// 守的断言:
//   ① 提交成功后账单里出现**两条**同单号的 withdraw 分录(USDT 主行负额 + NEX 抵扣费负额)
//   ② 两条共用一个 ts(一次落盘,不存在半边账)且**真落盘**(不是只在内存)
//   ③ 金额取服务端回执,不是本地报价(故意让两者不同,断言落盘的是服务端那个数)
//   ④ 同一笔重放(歧义结局保留幂等键 → 服务端返回同一张单)**不写第二对**
//   ⑤ 账单页把它们渲染出来且可点(渲染面与生产面接得上)
//   ⑥ 资金面:提交成功后余额**真的**少了服务端回执那个数、真落盘、重放不重复扣(z5)
//   ⑦ 失败终态把这笔扣款**退回**,且退款幂等(扣款 ⇄ 退款成对,否则拒单 = 烧钱)
//
// 🔴 ⑥⑦ 的能力上界(与上面同一条纪律:先说清楚门守不到哪)——
//   本门只在 **mock 模式**跑(verify.sh [2.5] 的 API-mode preflight 强制如此),
//   所以 ⑦ 证的是「扣了必退、退了不重复」,**证不到**「退款在 remote 模式下也有效」。
//   而提现单恰恰只在 remote 下才建得出来 —— 那一条靠 `refundWithdrawalDebit` 里
//   压根没有 `remoteApiEnabled` 分支来保证(它的兄弟 creditRewardBucketOnce 有,
//   USDT 腿此前正是走的那条,于是「唯一会产生提现的模式」里退款恒 no-op)。
//   下一个把这条腿改回 creditRewardBucketOnce 的人:本门在 mock 下**照绿**,
//   红的是 remote 下真实用户的钱。改之前先读 app.ts refundWithdrawalDebit 头注。
//
// 🔴 红测实录(2026-08-11 z5,基线 worktree 同脚本对跑):无扣款的原状态下 ⑦ 实测
//   余额 9999 →(失败终态退款)**10479.25** —— 退了一笔从没扣过的钱,凭空 +$480.25。
//   即「只有退款腿、没有扣款腿」本身就是一条印钞路径,不是单纯的少扣。
import { chromium } from "playwright";
import { collectAppConsoleErrors } from "./lib/console-origin-filter.mjs";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5173";
const WD_NO = "WD-RUNTIME-0001";
/** 服务端回执里的金额**故意**与页面输入不同 —— 用来证明落盘的是回执而不是本地报价。 */
const SERVER_AMOUNT = 480.25;
const PAGE_AMOUNT = "500";

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") collectAppConsoleErrors(errors, baseUrl)(msg); });
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto(`${baseUrl}/?nx_device=off#/pages/me/wallet-withdraw`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => typeof window.uni !== "undefined" && document.querySelector("#app")?.children.length,
    null,
    { timeout: 20_000 },
  );

  const result = await page.evaluate(async ({ WD_NO, SERVER_AMOUNT, PAGE_AMOUNT }) => {
    const [rt, rel, payoutMod, riskMod, appMod, billsMod] = await Promise.all([
      import("/src/api/runtime.ts"), import("/src/store/earning-release.ts"),
      import("/src/store/payout-address.ts"), import("/src/store/risk-disclosure.ts"),
      import("/src/store/app.ts"), import("/src/store/bills.ts"),
    ]);
    const submitCalls = [];
    // 🔴 桩打在 **transport(apiClient.request)** 那一层,不是 withdrawalApi 的方法上
    // (z4 R2:桩在方法上会把 `parseSubmission` / `parsePolicy` 一起桩掉 —— 而那两个解析器
    //  才是契约的真正守卫:字面量常量、四条费用等式、状态与路由闭集。桩高一层等于把被测面
    //  也一起测没了)。现在返回的是**原始报文**,解析器照跑,payload 不合契约会当场抛 protocol 错。
    const rawPolicy = () => ({
      minAmount: 10, dailyLimitCount: 3, balanceMaxRatio: 1, smallAmountThresholdUsd: 0,
      payoutSlaHours: 24, networkConfirmFeeUsd: { trc20: 1, bep20: 1, erc20: 5 },
      nexFeeOffsetRate: 0.4, policyVersion: "runtime-gate", cooldownDays: 7,
      complianceHoldEnabled: false, withdrawalEnabled: true,
      enabledNetworks: ["USDT-TRC20", "USDT-BEP20", "USDT-ERC20"],
      currentPhase: "P5", currentMonth: 5, gateSource: "J1", source: "D5+H1",
    });
    // 🔴 第一次**制造歧义结局**(响应丢了,但服务端那边单已经建好)——这是真实世界里
    // 「同一张单被返回两次」的唯一入口:页面对歧义**有意保留幂等键**让用户原地重试,
    // 服务端按键去重返回同一张单。之后每次都成功。
    let failNext = true;
    rt.withdrawalApi.policy = async () => rawPolicy();
    rt.withdrawalApi.submit = async (_amount, chain, _addr, pv, useOffset, idem) => {
      submitCalls.push(idem);
      if (failNext) { failNext = false; throw new Error("NETWORK_LOST_AFTER_SERVER_COMMITTED"); }
      const nexBurned = useOffset ? 3 : 0;
      const feeWaived = useOffset ? 1 : 0;
      const actualFee = 1 - feeWaived;
      // 形状与 toCanonicalWithdrawal 的入参一致(含 feeWaived —— 账单的「减免」直接取它)
      return {
        withdrawalNo: WD_NO, amount: SERVER_AMOUNT, chain, status: "SUBMITTED",
        holdUntil: new Date(Date.now() + 864e5).toISOString(),
        networkConfirmUsd: 1, networkFee: 1, penaltyFee: 0, grossFee: 1,
        nexBurned, feeWaived, actualFee, netReceive: SERVER_AMOUNT - actualFee,
        policyVersion: pv, useNexFeeOffset: useOffset, riskRoute: "fast-pass", idSource: "server",
      };
    };
    // 🔴 但**报文解析器要单独证明它活着**:上面桩在方法上,`parseSubmission` 不参与本轮
    // (R2 审计点名的边界)。这里补一枪 —— 走真 transport 喂一份**违反费用等式**的报文,
    // 必须抛 protocol 错;抛不出来说明契约校验已死,那才是账单数字最危险的一种坏法。
    const realRequest = rt.apiClient.request;
    rt.apiClient.request = async () => ({
      withdrawalNo: WD_NO, amount: 100, chain: "USDT-TRC20", status: "SUBMITTED",
      holdUntil: new Date(Date.now() + 864e5).toISOString(),
      networkConfirmUsd: 1, networkFee: 1, penaltyFee: 0, grossFee: 1,
      nexBurned: 0, feeWaived: 0, actualFee: 1, netReceive: 999, // ← amount−actualFee ≠ netReceive
      policyVersion: "x", useNexFeeOffset: false, riskRoute: "fast-pass", idSource: "server",
    });
    let parserAlive = false;
    try {
      await (await import("/src/api/withdrawal-api.ts"))
        .createWithdrawalApi(rt.apiClient).submit(100, "USDT-TRC20", "T", "x", false, "k");
    } catch (e) { parserAlive = /WITHDRAWAL_RESPONSE_INVALID/.test(String(e && e.message)); }
    rt.apiClient.request = realRequest;
    rel.earningsReleaseSnapshot.value = {
      buckets: { pending_review: 0, bonus_locked: 0, withdrawable: 9999 }, clusterRestricted: false,
    };
    const app = appMod.useApp();
    const bills = billsMod.useBills();
    app.user = { ...app.user, usdtBalance: 9999, nexBalance: 500 };
    bills.bills = bills.bills.filter((b) => b.type !== "withdraw");
    app.withdrawals = [];

    const payout = payoutMod.usePayoutAddress();
    payout.addAddress("usdt-trc20", "TRX9Yh7mQ2vK8pLxN4dW6sJ3fBcHgR5tZa");
    const st = payout.stateFor("usdt-trc20");
    // 新地址 24h 安全冻结会挡住提交;回拨 30 小时把它放行,其余判据全走真逻辑。
    const past = Date.now() - 30 * 3600 * 1000;
    payout.book = {
      ...payout.book,
      "usdt-trc20": { ...st, current: { ...st.current, addedAt: past },
        freezeUntil: past + 864e5, nextChangeAt: past + 7 * 864e5 },
    };
    riskMod.useRiskDisclosure().accepted = true;

    // 重挂页面,让 onMounted 用桩过的 policy 重新取一次
    uni.redirectTo({ url: "/pages/me/wallet" });
    await new Promise((r) => setTimeout(r, 600));
    uni.redirectTo({ url: "/pages/me/wallet-withdraw" });
    await new Promise((r) => setTimeout(r, 1200));

    const setValue = (el, v) => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const byText = (sel, txt) => [...document.querySelectorAll(sel)]
      .find((e) => (e.innerText || "").trim().includes(txt));

    setValue(document.querySelector("input"), PAGE_AMOUNT);
    await new Promise((r) => setTimeout(r, 400));
    // 打开 NEX 抵扣,让两条腿都走到
    const toggle = [...document.querySelectorAll('[role="button"], [role="switch"]')]
      .find((b) => /offset|抵扣|NEX/i.test(b.innerText || b.getAttribute("aria-label") || ""));
    if (toggle) { toggle.click(); await new Promise((r) => setTimeout(r, 400)); }

    // 🔴 每次点提交前记下按钮当时的文案。失败时这一列直接给出**置灰原因**
    // (「费率更新中」= 策略没拉到 / 「地址在保护期」= 冻结没解 …),
    // 否则只看到「没弹确认框」,得从头猜起 —— 我为此白查过一轮:症状看着像代码坏了,
    // 实际是 dev server 供的旧 module graph(冷重启后同一份代码 14/14 全过)。
    const labels = [];
    async function submitOnce() {
      const b = byText('[role="button"]', "Submit withdrawal");
      labels.push(b ? b.innerText.trim().slice(0, 80) : "NO BTN");
      b?.click();
      await new Promise((r) => setTimeout(r, 900));
      const confirm = [...document.querySelectorAll(".nx-btn--primary")]
        .find((b) => (b.innerText || "").trim() === "Confirm");
      if (!confirm) return "no-confirm-dialog";
      confirm.click();
      await new Promise((r) => setTimeout(r, 2600)); // eligibility 600ms + submit + 写账单 + 跳转
      return "ok";
    }

    // 🔴 钱的那一面(z5):账单行与余额是同一笔事实的两个面,门必须两面都守。
    // 只守账单 = 账上写着「−480.25」而钱包余额纹丝不动,而门全绿(z4 之后的实况)。
    const balanceOf = () => app.user.usdtBalance;
    const balanceBefore = balanceOf();

    // 第一次:歧义失败。页面停在原地(不跳转),账单**不该**有任何行。
    const first = await submitOnce();
    const rowsAfterFirst = bills.bills.filter((b) => b.type === "withdraw").length;
    // 歧义结局 = 客户端还不知道单号,更不知道服务端建没建单 —— 此时扣款是**乐观扣款**,
    // 一旦服务端其实没建单,钱就凭空少了。所以这一步必须原地不动。
    const balanceAfterAmbiguous = balanceOf();
    const diskOf = () => ((uni.getStorageSync("nexgrid-bills-accounts-v1") || {})[app.accountKey]?.bills || [])
      .filter((b) => b.ref === WD_NO);

    // 第二次:原地重试(同一个页面实例、同样的输入 ⇒ 同一把幂等键 ⇒ 服务端返回同一张单)。
    // 这一次成功,账单补上 —— 也正是这条路要求写入端必须按 ref 判重。
    const second = await submitOnce();

    // ⑤ 渲染面
    uni.redirectTo({ url: "/pages/me/wallet-bills" });
    await new Promise((r) => setTimeout(r, 1200));
    const clickable = [...document.querySelectorAll('[role="button"]')]
      .filter((e) => (e.getAttribute("aria-label") || "").includes(WD_NO));

    const rows = bills.bills.filter((b) => b.ref === WD_NO);

    // ── 资金面探针(全部在账单断言取样之后跑,不影响 ①–⑤)────────────────────
    const balanceAfterSuccess = balanceOf();
    // 扣款真落盘:内存对、盘上没有 = 刷新即回退,用户眼里「钱又回来了」。
    const diskBalance = (uni.getStorageSync("nexgrid-account-cloud-v1") || {})[app.accountKey]?.user?.usdtBalance;
    const wdRow = app.withdrawals.find((w) => w.id === WD_NO);
    // ⑥ 重放不重复扣款:自愈补写 / 用户回退再进都会再走一次,第二次必须不动钱且如实回真。
    // 🔴 探针不许因为「被测的东西不存在」而抛:整段 evaluate 一抛,输出就是一条堆栈,
    // 20 条断言一条都不显示 —— 红测反而看不出是哪一条在守。缺函数 = 记 null 让断言去红。
    const replayReturned = wdRow && typeof app.applyWithdrawalDebit === "function"
      ? app.applyWithdrawalDebit(wdRow)
      : null;
    const balanceAfterReplay = balanceOf();
    // ⑦ 🔴 扣款 ⇄ 退款必须**同模式**对称。这一格是红测本体:把 USDT 腿退回
    // creditRewardBucketOnce(它内部 `if (remoteApiEnabled) return false`)当场变红 ——
    // 而提现单只在 remote 下建得出来,所以那条路等于「拒单 = 用户的钱凭空烧掉」。
    app.withdrawals = app.withdrawals.map((w) => (w.id === WD_NO ? { ...w, status: "tx-failed" } : w));
    const refundedIds = app.refundFailedWithdrawals();
    const balanceAfterRefund = balanceOf();
    // 退款也要幂等:5s 一拍的对账会反复调它,每拍退一次就是印钞。
    app.refundFailedWithdrawals();
    const balanceAfterRefundReplay = balanceOf();

    return {
      balanceBefore,
      balanceAfterAmbiguous,
      balanceAfterSuccess,
      balanceAfterReplay,
      balanceAfterRefund,
      balanceAfterRefundReplay,
      diskBalance,
      replayReturned,
      refundedIds,
      first,
      second,
      submitCalls,
      sameIdemKey: submitCalls.length === 2 && submitCalls[0] === submitCalls[1],
      rowsAfterFirst,
      rows: rows.map((b) => ({ sym: b.symbol, amt: b.amount, st: b.status, key: b.memoKey })),
      sameTs: rows.length === 2 && rows[0].ts === rows[1].ts,
      onDisk: diskOf().length,
      clickable: clickable.length,
      route: location.hash,
      parserAlive,
      labels,
    };
  }, { WD_NO, SERVER_AMOUNT, PAGE_AMOUNT });

  console.log("withdraw-bill-runtime — 提现账单行真的会被写出来(不是「代码里有」)");

  check("提交链路走通(确认弹窗出现并被确认)", result.first === "ok" && result.second === "ok",
    `${result.first} / ${result.second} · 按钮=${JSON.stringify(result.labels)}`);
  check("④ 歧义失败那一次**不写任何账单行**(单据在服务端,客户端还不知道单号)",
    result.rowsAfterFirst === 0, `写了 ${result.rowsAfterFirst} 条`);
  const usdt = result.rows.find((r) => r.sym === "USDT");
  const nex = result.rows.find((r) => r.sym === "NEX");
  check("① 账单里出现两条同单号 withdraw 分录(USDT 主行 + NEX 抵扣费行)",
    result.rows.length === 2 && !!usdt && !!nex, JSON.stringify(result.rows));
  check("① USDT 主行是**负额**且状态为在途", usdt?.amt < 0 && usdt?.st === "pending", JSON.stringify(usdt));
  check("① NEX 抵扣费行是负额", nex?.amt < 0, JSON.stringify(nex));
  check("② 两条共用一个 ts(一次落盘)", result.sameTs === true);
  check("② 真落盘(不是只在内存)", result.onDisk === 2, `盘上 ${result.onDisk} 条`);
  check(`③ 金额取**服务端回执** ${SERVER_AMOUNT}(不是页面输入的 ${PAGE_AMOUNT})`,
    usdt?.amt === -SERVER_AMOUNT, `实测 ${usdt?.amt}`);
  check("③ memoKey 走 i18n 码位(不是写死语言的 memo)",
    usdt?.key === "withdrawPass" && nex?.key === "withdrawNexFee", JSON.stringify([usdt?.key, nex?.key]));
  check("④ 🔴 歧义后原地重试沿用**同一把幂等键**(换键 = 服务端可能真出第二笔)",
    result.sameIdemKey === true, JSON.stringify(result.submitCalls));
  // 🔴 这一格证的是**自愈**:歧义那次没写、重试那次补上,最终正好一对。
  // 「同 ref 重放不写第二遍」那条不变量由 selfcheck-money-receipt ⑧(d)/(d2) 直接打收口点验证 ——
  // 在 UI 上构造不出两次都成功且返回同一张单(成功会 clearSubmitIntent 换键,服务端就会另开一单),
  // 所以那是**纵深防御**,不是这条链上够得着的缺陷。两处分工写清,免得下一个人以为 UI 能复现。
  check("④ 🔴 自愈成功后账单**正好一对**分录(歧义那次零写入 + 重试补上)",
    result.rows.length === 2, `${result.rows.length} 条`);
  check("⑤ 账单页把两条都渲染成可点行(渲染面接得上生产面)",
    result.clickable === 2, `可点 ${result.clickable} 行`);
  check("🔴 服务端报文解析器仍在守契约(喂违反费用等式的报文必抛 protocol 错)",
    result.parserAlive === true, "喂了坏报文却没抛 —— 契约校验已死");
  // ── 资金面:账单行说钱动了,余额也必须真的动(z5)──────────────────────────
  // 🔴 每条判据都必须在「整条链根本没跑」时也**红**。上一版有三条是
  // 「余额没变 → 断言成立」的写法(不等于某值 / 盘上等于内存 / 退款后等于初始),
  // 链条卡在第一步、余额恒 9999 时它们照样 PASS —— 空集全过的经典假绿。
  // 现在一律钉在「实扣额 = 服务端回执」这个**必须发生过**的事实上。
  const B = result;
  const debited = +(B.balanceBefore - B.balanceAfterSuccess).toFixed(2);
  const debitHappened = debited === SERVER_AMOUNT;
  check("⑥ 歧义失败那一次**不扣款**(结局未定时乐观扣款 = 服务端没建单就凭空少钱)",
    B.balanceAfterAmbiguous === B.balanceBefore && debitHappened,
    `歧义后 ${B.balanceBefore} → ${B.balanceAfterAmbiguous};成功那次实扣 ${debited}`);
  check(`⑥ 提交成功后余额**真的**少了服务端回执那个数(实扣 ${SERVER_AMOUNT},不是页面输入的 ${PAGE_AMOUNT})`,
    debitHappened,
    `实扣 ${debited}(${B.balanceBefore} → ${B.balanceAfterSuccess}),期望 ${SERVER_AMOUNT}`);
  check("⑥ 扣款**真落盘**(只在内存 = 刷新后钱又回来了)",
    debitHappened && B.diskBalance === B.balanceAfterSuccess,
    `盘上 ${B.diskBalance} / 内存 ${B.balanceAfterSuccess}(实扣 ${debited})`);
  check("⑥ 同一单重放**不重复扣款**,且如实回真(已扣到位 ≠ 本次写了)",
    debitHappened && B.replayReturned === true && B.balanceAfterReplay === B.balanceAfterSuccess,
    `返回 ${B.replayReturned}、重放后 ${B.balanceAfterReplay}(实扣 ${debited})`);
  check("⑦ 🔴 失败终态**退回**这笔扣款(扣款与退款必须同模式对称,否则拒单 = 烧钱)",
    debitHappened && B.refundedIds.includes(WD_NO) && B.balanceAfterRefund === B.balanceBefore,
    `退回单号 ${JSON.stringify(B.refundedIds)}、退后 ${B.balanceAfterRefund}(期望 ${B.balanceBefore},实扣 ${debited})`);
  check("⑦ 退款幂等(对账 5s 一拍反复调,每拍退一次就是印钞)",
    debitHappened && B.balanceAfterRefund === B.balanceBefore
      && B.balanceAfterRefundReplay === B.balanceAfterRefund,
    `二次调用 ${B.balanceAfterRefund} → ${B.balanceAfterRefundReplay}`);

  check("零 console error", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

console.log(`\n${pass} pass / ${fail} fail(真页面 handler + 真 store + 真收口点;仅桩 withdrawalApi 两个方法)`);
process.exit(fail ? 1 : 0);
