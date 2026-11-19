import { accountDeletionWallet } from './prototype-demo-account.mjs';
// Synthetic, loopback-only read model based on remainder/staking-fixture.json.
// Mount stakingDemo(url, state, request) before generic demo routes. Wrap its
// non-undefined result in the demo's usual API success envelope. GET only;
// writes and open-status are deliberately unsupported. Never forward them.
// state.dataState === "empty" gives a canonical empty account. Optional
// state.stakingNow fixes the clock for repeatable review. Inject 503 at the
// host route for error/retry checks; errors must not return an empty snapshot.
const DAY = 86_400_000;
const proof = {
  source: "nx_staking_product + nx_config_item + nx_emergency_control_setting",
  sourceEnvironment: "PRODUCTION", runId: "", serverCanonical: true,
};

function demoStakePosition(now) {
  return {
    positionNo: "AUDIT-READONLY-001", tierKey: "usdt30d",
    productCode: "AUDIT30", productName: "Audit 30 day",
    amountUsdt: 100, termDays: 30, apyPct: 12, penaltyPct: 5,
    lockedAt: new Date(now - DAY).toISOString(),
    unlockAt: new Date(now + 29 * DAY).toISOString(),
    estimatedInterestUsdt: .99, status: "ACTIVE",
  };
}

export function demoDeletionStake(state) {
  return state.accountDeletionState === "locked" ? demoStakePosition(state.stakingNow ?? state.previewFactsAt) : null;
}

export function createStakingDemoFixture({ empty = false, now = Date.now(), wallet } = {}) {
  return {
    pools: {
      ...proof,
      pools: [30, 90, 180, 365].map((termDays, index) => ({
        poolId: index + 1, tierKey: `usdt${termDays}d`, currency: "USDT", termDays,
        apyPct: [12, 15, 18, 20][index], penaltyPct: 5, minAmountUsdt: 20,
        enabled: true, killed: false, status: "ACTIVE",
      })),
    },
    snapshot: {
      ...proof, walletBalanceUsdt: wallet ?? 0,
      serverTime: new Date(now).toISOString(),
      positions: empty ? [] : [demoStakePosition(now)],
      positionsPage: { total: empty ? 0 : 1, pageNum: 1, pageSize: 50, snapshotId: "1" },
    },
  };
}

export function stakingDemo(url, state, request) {
  if (request.method() !== "GET") return undefined;
  if (url.pathname !== "/api/config/staking/pools" && url.pathname !== "/api/stakes") return undefined;
  if (state.stakingState === "error") throw Object.assign(new Error("DEMO_STAKING_READ_UNAVAILABLE"), { status: 503 });
  // The stake sheet's balance is the account's wallet fact, the one every other wallet read and payment uses.
  const deletionWallet = accountDeletionWallet(state);
  const fixture = createStakingDemoFixture({ empty: Boolean(deletionWallet) || state.dataState === "empty" || state.paymentState === "reward-clawback-debt",
    now: state.stakingNow, wallet: deletionWallet?.usdtAvailable ?? (state.dataState === "empty" ? 0 : state.walletBalance ?? 52800.64) });
  if (url.pathname === "/api/config/staking/pools") return fixture.pools;
  const stake = demoDeletionStake(state);
  const positions = stake ? [stake] : fixture.snapshot.positions;
  const pageNum = Math.max(1, Number(url.searchParams.get("pageNum") || 1));
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize") || 50));
  return { ...fixture.snapshot,
    positions: positions.slice((pageNum - 1) * pageSize, pageNum * pageSize),
    positionsPage: { ...fixture.snapshot.positionsPage, total: positions.length, pageNum, pageSize },
  };
}
