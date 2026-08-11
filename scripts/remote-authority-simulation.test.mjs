/**
 * remote-authority-simulation — 「客户端定时器伪造服务端状态」这一族的**行为**门。
 *
 * 缺陷族(2026-08-11 独立排查):remote 是**默认档**(src/api/runtime-config.ts:29,
 * 仓里也没有 .env),而一批本该属于服务端的状态推进在 remote 下照跑不误 —— 收益计提、
 * 提现到账、订单履约(推到 activated 还会凭空发一台设备)、里程碑发奖、入金到账。
 * 判据全是设备墙钟或 Math.random(),把手机时间往后拨就能让 App 宣布钱到了。
 *
 * 🔴 为什么必须是行为门,不是源码哨兵:这仓既有的哨兵是「文件里有没有出现某串字符」
 *    式的存在性 / 计数判据,而本族缺陷恰恰能在那种判据全绿的情况下发生(gate 写在
 *    别的函数上、写了但被 early-return 绕开、加了新调用点没跟着加判断)。所以这里
 *    真把 store 装进 node 跑起来,直接观察「钱有没有变」「设备有没有多」。
 *
 * 🔴 双向断言(防假绿):每条都跑 remote + mock 两遍。只断言 remote 不动的话,
 *    把功能整个删掉也能通过 —— 那是把一个缺陷换成另一个。mock 那遍证明功能还活着。
 *    两个 bundle 唯一的差别就是 VITE_NEXGRID_API_MODE 这一个 define,故差异可归因。
 *
 * 跑法:node --test scripts/remote-authority-simulation.test.mjs
 *      (已登记进 scripts/run-contract-suite.mjs 的 chain,npm run verify 会跑)
 */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** uni-app 运行时桩:store 只用到存储与设备信息两族。 */
function installUniShim() {
  const cell = new Map();
  globalThis.uni = {
    getStorageSync: (k) => (cell.has(k) ? cell.get(k) : ""),
    setStorageSync: (k, v) => cell.set(k, v),
    removeStorageSync: (k) => cell.delete(k),
    getSystemInfoSync: () => ({ platform: "devtools", uniPlatform: "h5" }),
    getAccountInfoSync: () => ({ miniProgram: {} }),
  };
  globalThis.window = globalThis.window
    ?? { location: { origin: "http://localhost:5173", protocol: "http:", hostname: "localhost" } };
  return cell;
}

const uniappStub = {
  name: "uniapp-stub",
  setup(b) {
    b.onResolve({ filter: /^@dcloudio\// }, () => ({ path: "uniapp", namespace: "uniapp-stub" }));
    b.onLoad({ filter: /.*/, namespace: "uniapp-stub" }, () => ({
      contents: ["onLaunch", "onShow", "onHide", "onLoad", "onUnload"]
        .map((n) => `export const ${n}=()=>{};`).join(""),
      loader: "js",
    }));
  },
};

/**
 * 把被测 store 连同它自己那份 vue/pinia 打成一个 bundle 再 import。
 * pinia 必须**打进同一个 bundle**:外部 import 的 pinia 与 bundle 内那份是两个实例,
 * setActivePinia 作用不到 bundle 里,useApp() 会直接抛「no active Pinia」。
 *
 * `mode` 直接喂 import.meta.env.VITE_NEXGRID_API_MODE —— 与真实构建同一条读取路径
 * (runtime-config.ts:`env.VITE_NEXGRID_API_MODE === "mock" ? "mock" : "remote"`),
 * 不给 undefined 特判,所以 remote 那遍走的确实是**默认档**。
 */
async function loadStores(mode) {
  const out = await build({
    stdin: {
      contents: `export { createPinia, setActivePinia } from "pinia";
export { remoteApiEnabled } from "@/api/runtime";
export { advanceArrival } from "@/store/withdrawal-arrival-core";
export { useApp } from "@/store/app";
export { useConfig } from "@/store/config";
export { useFx } from "@/store/fx";
export { useDeposits } from "@/store/deposits";
export { useOrders, tickOrders } from "@/store/orders";`,
      resolveDir: root,
      loader: "ts",
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    alias: { "@": path.join(root, "src") },
    define: {
      "import.meta.env.DEV": "true",
      "import.meta.env.PROD": "false",
      "import.meta.env.VITE_NEXGRID_API_MODE": mode === undefined ? "undefined" : JSON.stringify(mode),
      "import.meta.env.VITE_NEXGRID_API_BASE_URL": "undefined",
      "import.meta.env.VITE_NEXGRID_API_DEV_BASE_URL": "undefined",
    },
    plugins: [uniappStub],
  });
  installUniShim();
  const mod = await import(
    `data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`
  );
  mod.setActivePinia(mod.createPinia());
  // 平台配置默认 syncFailed=true,而 settle() 早就有一条「配置没同步就不结算」的闸。
  // 不清掉的话 remote 那遍会因为**另一个**原因不结算 —— 断言通过但什么也没证明。
  mod.useConfig()._devSetConfigSyncFailed(false);
  // 牌价初值是「未拉取」(lockWindowMin=0),而银行轨建单有一条「牌价不可用禁下单」的
  // 既有闸。页面在 onMounted 里会拉,这里补上同一步 —— 不补的话 remote 那遍返 null 是
  // 因为**没牌价**而不是因为本轮的闸,断言就归错因了(与上面清 syncFailed 同一个道理)。
  // 两档都拉,差异才只剩 API 模式这一个变量。
  await mod.useFx().load();
  return mod;
}

/** remote = 默认档(不设环境变量);mock = 显式 "mock"。 */
const REMOTE = undefined;
const MOCK = "mock";

function seedWithdrawal(overrides = {}) {
  const submittedAt = Date.now() - 48 * 3_600_000;
  return {
    id: "WD-TEST-1",
    amount: 100,
    network: "USDT-TRC20",
    address: "TXtest0000000000000000000000000000",
    fee: { networkConfirmUsd: 1, nexBurned: 0, actualFeeUsd: 1 },
    status: "processing",
    riskRoute: "pass",
    riskReasons: [],
    submittedAt,
    // 到账时刻已过 —— 这正是「把手机时间往后拨」之后单据会呈现的样子。
    estimatedCompletion: submittedAt + 3_600_000,
    ...overrides,
  };
}

/** 让每台在跑的设备都欠一小时的账,使一次 settle() 的进账大到不会被四舍五入吃掉。 */
function anchorDevicesOneHourBack(app) {
  const anchor = Date.now() - 3_600_000;
  app.devices = app.devices.map((d) => (d.activatedAt === null ? d : { ...d, lastSettledAt: anchor }));
}

// ── ① 纯函数:到账推进的权威开关 ────────────────────────────────────────────
test("advanceArrival 只在本地权威时推进,远端权威时恒不推进", async () => {
  const { advanceArrival } = await loadStores(MOCK);
  const wd = seedWithdrawal();
  const now = Date.now();

  const local = advanceArrival(wd, now, { serverAuthoritative: false });
  assert.equal(local?.status, "confirmed", "本地权威(mock)下到点必须推进,否则单据永不终结");
  assert.equal(local?.confirmedAt, wd.estimatedCompletion);

  assert.equal(
    advanceArrival(wd, now, { serverAuthoritative: true }),
    null,
    "远端权威下必须拒绝推进 —— 单据是服务端签发的,墙钟不是权威",
  );
});

test("advanceArrival 漏传权威上下文时抛错,不静默按本地权威推进", async () => {
  const { advanceArrival } = await loadStores(MOCK);
  // 必填参数的运行时那一面:tsc 挡编译期的新调用点,这条挡「any 一把梭 / 从 js 调进来」。
  // 失败方向必须是响亮报错,不是默默给自己发钱。
  assert.throws(() => advanceArrival(seedWithdrawal(), Date.now()));
});

// ── ② 收益计提(app.settle)────────────────────────────────────────────────
test("settle:mock 计提收益,remote 一分不动", async (t) => {
  for (const [label, mode, shouldAccrue] of [["remote", REMOTE, false], ["mock", MOCK, true]]) {
    await t.test(label, async () => {
      const m = await loadStores(mode);
      assert.equal(m.remoteApiEnabled, mode !== MOCK, "验错模式了,后面的断言全无意义");
      const app = m.useApp();
      anchorDevicesOneHourBack(app);
      const before = { total: app.earnings.total, usdt: app.user.usdtBalance, nex: app.user.nexBalance };
      app.settle();
      const grew = app.earnings.total > before.total;
      assert.equal(grew, shouldAccrue, `${label}: earnings.total ${before.total} → ${app.earnings.total}`);
      if (!shouldAccrue) {
        // settle 不止写 earnings.*,它还经 bucketUserEarnings + applyReleaseOutcome
        // 直写余额 —— 「显示的数字没变」不等于「钱没动」,两边都要钉。
        assert.equal(app.user.usdtBalance, before.usdt, "remote 下 settle 不得改动 USDT 余额");
        assert.equal(app.user.nexBalance, before.nex, "remote 下 settle 不得改动 NEX 余额");
      }
    });
  }
});

// ── ③ 提现到账推进 ────────────────────────────────────────────────────────
test("提现到账:mock 到点补齐,remote 保持在途等服务端", async (t) => {
  for (const [label, mode, shouldConfirm] of [["remote", REMOTE, false], ["mock", MOCK, true]]) {
    await t.test(label, async () => {
      const m = await loadStores(mode);
      const app = m.useApp();
      app.withdrawals = [seedWithdrawal()];
      assert.equal(app.withdrawals.length, 1, "种子没塞进去,后面的断言是空跑");

      const advanced = app.advanceWithdrawalArrival();
      const confirmed = app.withdrawals[0].status === "confirmed";
      assert.equal(confirmed, shouldConfirm, `${label}: status = ${app.withdrawals[0].status}`);
      assert.equal(advanced.length, shouldConfirm ? 1 : 0);
      if (!shouldConfirm) {
        // 关掉本地推进的代价必须由服务端镜像来兜(app.refreshRemoteWithdrawals),
        // 否则在途单永不终结 → 收款地址换绑与下一笔提现被永久拦死。
        assert.equal(typeof app.refreshRemoteWithdrawals, "function",
          "remote 下必须存在服务端状态回读路径,否则单据永远卡在途");
        assert.equal(app.inFlightWithdrawals.length, 1);
      }
    });
  }
});

// ── ④ 订单履约 + 设备铸造 ──────────────────────────────────────────────────
test("订单履约:mock 推到 activated 并发设备,remote 一步不推", async (t) => {
  for (const [label, mode, shouldActivate] of [["remote", REMOTE, false], ["mock", MOCK, true]]) {
    await t.test(label, async () => {
      const m = await loadStores(mode);
      const app = m.useApp();
      const orders = m.useOrders();
      const devicesBefore = app.devices.length;
      const order = orders.createOrder({
        productId: "stellarbox-pro",
        productName: "NexGridBox Pro",
        unitPrice: 100,
        paymentMethod: "balance",
      });
      // 每步 0.45 概率:60 拍后仍停在 paid 的概率约 1e-15,不是随机性造成的假红。
      for (let i = 0; i < 60; i++) m.tickOrders(0);
      const status = orders.getById(order.id).status;
      assert.equal(status === "activated", shouldActivate, `${label}: order status = ${status}`);
      assert.equal(
        app.devices.length > devicesBefore,
        shouldActivate,
        `${label}: 设备数 ${devicesBefore} → ${app.devices.length}(remote 下多一台 = 凭空铸库存)`,
      );
    });
  }
});

// ── ⑤ 入金:卡轨(同步加钱)+ 链上到账引擎(定时器推进)────────────────────
test("卡轨入金:mock 入账,remote 拒付不加钱", async (t) => {
  for (const [label, mode, shouldCredit] of [["remote", REMOTE, false], ["mock", MOCK, true]]) {
    await t.test(label, async () => {
      const m = await loadStores(mode);
      const app = m.useApp();
      const dep = m.useDeposits();
      const before = app.user.usdtBalance;
      // mock 侧有 CARD_DECLINE_RATE 随机拒付,重试到成功为止(remote 侧恒 null)。
      let rec = null;
      for (let i = 0; i < 40 && !rec; i++) rec = dep.submitCardPayment(50, app.accountKey);
      assert.equal(rec !== null, shouldCredit, `${label}: submitCardPayment → ${rec && rec.status}`);
      assert.equal(
        app.user.usdtBalance > before,
        shouldCredit,
        `${label}: 余额 ${before} → ${app.user.usdtBalance}`,
      );
    });
  }
});

// ── ⑥ 链外付款目标:远端模式下一个都不许给出 ────────────────────────────────
// 🔴 这是入金的**另一面**,与上面的「不许伪造入账」正交:那边挡「假装钱到了」,
//    这边挡「真把钱送出去」。两条轨给的收款目标都是本地造的 —— 链上地址由
//    deriveDepositAddress 伪随机派生(没人持有私钥,打过去 = 永久丢币),银行账号
//    来自本地常量表;页面两处都带一键复制。真后端未接线时展示 = 引导用户在链外付真钱。
test("链外收款目标:mock 给得出,remote 一个都不给", async (t) => {
  for (const [label, mode, shouldOffer] of [["remote", REMOTE, false], ["mock", MOCK, true]]) {
    await t.test(label, async () => {
      const m = await loadStores(mode);
      const dep = m.useDeposits();

      const addr = dep.depositAddress("usdt-trc20");
      assert.equal(addr !== "", shouldOffer, `${label}: 链上专属地址 = ${JSON.stringify(addr)}`);

      const intent = dep.createBankIntent(200);
      assert.equal(intent !== null, shouldOffer, `${label}: 银行付款单 = ${intent && intent.intentId}`);
      if (shouldOffer) {
        // 反向对照钉住「这道闸没有把功能整个关掉」:mock 那遍必须真给出可执行的收款信息。
        assert.match(addr, /^T[0-9A-F]{33}$/, "mock 下链上地址必须是完整的 TRON 形态");
        assert.ok(intent.bankAccount.accountNumber, "mock 下付款单必须带收款账号");
        assert.ok(intent.memoCode, "mock 下付款单必须带附言码");
      }
    });
  }
});

test("链上到账引擎:mock 推进确认,remote 整体停摆", async (t) => {
  for (const [label, mode, shouldProgress] of [["remote", REMOTE, false], ["mock", MOCK, true]]) {
    await t.test(label, async () => {
      const m = await loadStores(mode);
      const dep = m.useDeposits();
      dep.resumeMockEngine();
      const rec = dep._devSimulateIncomingTransfer("usdt-trc20", 200);
      assert.ok(rec, "入金单本身两种模式都建得出来(闸在推进侧,不在登记侧)");
      assert.equal(rec.status, "detected");
      // 引擎第一跳 DETECT_TO_CONFIRM_MS = 1200ms:detected → confirming。
      await new Promise((r) => setTimeout(r, 1_800));
      const after = dep.records.find((x) => x.depositId === rec.depositId).status;
      assert.equal(after !== "detected", shouldProgress, `${label}: 入金单状态 = ${after}`);
      dep.pauseMockEngine();
    });
  }
});
