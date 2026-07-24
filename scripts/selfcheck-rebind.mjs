#!/usr/bin/env node
// A6 换绑纯逻辑自检 — node 直跑,不起 Vue/uni:
//   node scripts/selfcheck-rebind.mjs
// 用 esbuild(vite 传递依赖)现场转译 src/store/wallet-pairing-core.ts 后 import,
// 断言:AB 单号格式 / 链地址校验 / 在途单集合 / 频控与禁止动作优先级 /
// 原子换绑后置条件(有且仅有一个 active,旧绑定同事务 revoked)/ 终态禁再处置 /
// 冻结剩余与倒计时排版。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { transformSync } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, "src", "store", "wallet-pairing-core.ts"), "utf8");
const { code } = transformSync(src, { loader: "ts", format: "esm" });
const core = await import(
  "data:text/javascript;base64," + Buffer.from(code, "utf8").toString("base64")
);

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}`);
  }
}

const {
  REBIND_VERIFY_WINDOW_MS,
  REBIND_FREEZE_MS,
  isRebindFrozen,
  IN_FLIGHT_WITHDRAWAL_STATUSES,
  isInFlightWithdrawal,
  isChainAddressValid,
  mintBindingId,
  rebindStartBlockReason,
  applyRebindActivation,
  freezeRemainingMs,
  formatClock,
  CHAIN_TO_WITHDRAW_NETWORK,
  fromWithdrawNetwork,
} = core;

console.log("selfcheck-rebind — wallet-pairing-core 纯逻辑断言");

// 1) AB 单号格式(server mint 形态)
{
  const id = mintBindingId(Date.parse("2026-07-24T10:00:00Z"));
  check("bindingId 形如 AB-YYYYMMDD-NNNN", /^AB-20260724-\d{4}$/.test(id));
}

// 2) 链地址格式校验(TRC20 = T+33;EVM = 0x+40hex)
{
  const tron = "T" + "A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E"; // T + 33 位字母数字
  check("TRC20 合法地址通过", isChainAddressValid("usdt-trc20", tron) && tron.length === 34);
  check("TRC20 拒 0x 形态", !isChainAddressValid("usdt-trc20", "0x" + "a".repeat(40)));
  check("TRC20 拒短地址", !isChainAddressValid("usdt-trc20", "TABC"));
  check("EVM 合法地址通过(erc20/bep20 共形)", isChainAddressValid("usdt-erc20", "0x" + "a1".repeat(20)) && isChainAddressValid("usdt-bep20", "0x" + "F0".repeat(20)));
  check("EVM 拒非 hex", !isChainAddressValid("usdt-erc20", "0x" + "zz".repeat(20)));
  check("EVM 拒 TRON 形态", !isChainAddressValid("usdt-bep20", tron));
  check("首尾空白 trim 后判定", isChainAddressValid("usdt-erc20", "  0x" + "ab".repeat(20) + "  "));
}

// 3) 在途提现单集合(submitted ~ processing)
{
  const inFlight = ["submitted", "review-pending", "review-passed", "processing"];
  check("在途集合 = submitted~processing 四态", JSON.stringify([...IN_FLIGHT_WITHDRAWAL_STATUSES]) === JSON.stringify(inFlight));
  check("四在途态全判真", inFlight.every((s) => isInFlightWithdrawal(s)));
  check("sent/confirmed/frozen/refunded/undefined 判假", ["sent", "confirmed", "frozen", "review-rejected", "refunded", undefined].every((s) => !isInFlightWithdrawal(s)));
}

// 4) 发起换绑禁止动作优先级:在途单 > 进行中换绑单 > 频控
{
  const now = 1_000_000_000_000;
  const day = 24 * 3600 * 1000;
  const verifyingOrder = { bindingId: "AB-1", address: "x", network: "usdt-trc20", status: "verifying", createdAt: now, expiresAt: now + 1 };
  check("在途提现单 → withdrawal-in-flight(压过其它)", rebindStartBlockReason({ now, hasInFlightWithdrawal: true, order: verifyingOrder, lastRebindAt: now - 1, cooldownDays: 7 }) === "withdrawal-in-flight");
  check("进行中换绑单 → order-in-progress", rebindStartBlockReason({ now, hasInFlightWithdrawal: false, order: verifyingOrder, cooldownDays: 7 }) === "order-in-progress");
  check("7 天内已换绑 → cooldown", rebindStartBlockReason({ now, hasInFlightWithdrawal: false, order: null, lastRebindAt: now - 6 * day, cooldownDays: 7 }) === "cooldown");
  check("恰满 7 天 → 放行", rebindStartBlockReason({ now, hasInFlightWithdrawal: false, order: null, lastRebindAt: now - 7 * day, cooldownDays: 7 }) === null);
  check("终态单不挡新发起", rebindStartBlockReason({ now, hasInFlightWithdrawal: false, order: { ...verifyingOrder, status: "expired" }, cooldownDays: 7 }) === null);
  check("全净 → null", rebindStartBlockReason({ now, hasInFlightWithdrawal: false, order: null, cooldownDays: 7 }) === null);
}

// 5) 原子换绑:新 active + 旧 revoked 同事务;后置条件有且仅有一个 active
{
  const now = 1_700_000_000_000;
  const old = { bindingId: "AB-OLD", address: "Told", network: "usdt-trc20", status: "active", createdAt: now - 1000, verifiedAt: now - 1000 };
  const order = { bindingId: "AB-NEW", address: "0x" + "ab".repeat(20), network: "usdt-erc20", status: "verifying", createdAt: now - 60_000, expiresAt: now + REBIND_VERIFY_WINDOW_MS };
  const res = applyRebindActivation([old], order, now);
  check("verifying 单可生效", res !== null);
  const actives = res.bindings.filter((b) => b.status === "active");
  check("生效后有且仅有一个 active", actives.length === 1 && actives[0].bindingId === "AB-NEW");
  check("旧绑定同事务置 revoked", res.bindings.find((b) => b.bindingId === "AB-OLD")?.status === "revoked");
  check("verifiedAt = 生效时刻(账龄起点喂 K3)", res.activated.verifiedAt === now);
  check("freezeUntil = verifiedAt + 24h", res.activated.freezeUntil === now + REBIND_FREEZE_MS && REBIND_FREEZE_MS === 24 * 3600 * 1000);
  check("新绑定继承单的地址/网络/单号", res.activated.address === order.address && res.activated.network === "usdt-erc20" && res.activated.bindingId === "AB-NEW");
  // 终态禁再处置
  for (const s of ["initiated", "active", "expired", "cancelled"]) {
    check(`${s} 单不可生效(禁再处置)`, applyRebindActivation([old], { ...order, status: s }, now) === null);
  }
  // 防御:损坏数据多 active → 全部收敛 revoked,仍只剩一个 active
  const corrupt = [old, { ...old, bindingId: "AB-OLD2" }];
  const res2 = applyRebindActivation(corrupt, order, now);
  check("多 active 损坏输入收敛为单 active", res2.bindings.filter((b) => b.status === "active").length === 1);
}

// 6) 冻结剩余 + 倒计时排版
{
  check("冻结剩余 = until - now(正向)", freezeRemainingMs(2000, 500) === 1500);
  check("冻结过期 clamp 0", freezeRemainingMs(500, 2000) === 0);
  check("无冻结 → 0", freezeRemainingMs(undefined, 2000) === 0);
  // 冻结判定(评估层 K3 硬闸与 UI 共用同一判据)
  const t0 = 1_700_000_000_000;
  check("冻结窗口内 isRebindFrozen=true(评估层硬闸判据)", isRebindFrozen(t0 + REBIND_FREEZE_MS, t0 + REBIND_FREEZE_MS - 1) === true);
  check("窗口过/无冻结 isRebindFrozen=false", isRebindFrozen(t0, t0) === false && isRebindFrozen(undefined, t0) === false);
  check("mm:ss 排版(29:59)", formatClock(REBIND_VERIFY_WINDOW_MS - 1000) === "29:59");
  check("hh:mm:ss 排版(23:59:41)", formatClock((23 * 3600 + 59 * 60 + 41) * 1000, { hours: true }) === "23:59:41");
  check("负值 clamp 00:00", formatClock(-5000) === "00:00");
}

// 7) 网络枚举双向映射(binding 收窄枚举 ↔ 提现单大写形态)
{
  check("chain → withdraw 网络映射", CHAIN_TO_WITHDRAW_NETWORK["usdt-trc20"] === "USDT-TRC20" && CHAIN_TO_WITHDRAW_NETWORK["usdt-bep20"] === "USDT-BEP20");
  check("withdraw → chain 反向映射", fromWithdrawNetwork("USDT-ERC20") === "usdt-erc20" && fromWithdrawNetwork("USDT-TRC20") === "usdt-trc20");
}

console.log(`\nselfcheck-rebind: ${pass} pass / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
