import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");

test("daily leaderboard consumes the remote points snapshot", () => {
  const page = read("src/pages/daily/daily.vue");
  const faucet = read("src/store/nex-faucet.ts");
  assert.match(page, /faucet\.topStreakers/);
  assert.doesNotMatch(page, /v-for="\(s, i\) in TOP_STREAKERS"/);
  assert.match(faucet, /snapshot\.topStreakers/);
  assert.match(faucet, /createRemoteAccountEpoch/);
  assert.match(faucet, /isCurrent\(/);
});

test("home earnings and live feed have a server-backed remote branch", () => {
  const earnings = read("src/components/home/earnings-ledger-card.vue");
  const feed = read("src/components/home/live-feed-card.vue");
  assert.match(earnings, /remoteApiEnabled/);
  assert.match(earnings, /visibleDevices/);
  assert.match(earnings, /recentTasks/);
  assert.match(feed, /remoteApiEnabled/);
  assert.match(feed, /visibleDevices/);
  assert.match(feed, /recentTasks/);
  const app = read("src/store/app.ts");
  assert.match(app, /createRemoteAccountEpoch/);
  assert.match(app, /isCurrent\(/);
  assert.match(app, /before applying remote task assignments/);
});

test("genesis surfaces do not synthesize remote social proof", () => {
  const genesis = read("src/pages/genesis/genesis.vue");
  const marketplace = read("src/pages/genesis/marketplace.vue");
  assert.doesNotMatch(genesis, /LIVE_MARKET|BUYER_NAMES|emitSocial|tickSales/);
  assert.doesNotMatch(marketplace, /SEED_ACTIVITY|FOMO_ADDR_POOL|genFomoSale|scheduleFomo|Math\.random/);
  assert.match(marketplace, /remoteTransactions/);
  const store = read("src/store/genesis.ts");
  assert.match(store, /createRemoteAccountEpoch/);
  assert.match(store, /isCurrent\(/);
  // remote 档不许从本地存量 hydrate 出「已售 N 席」的稀缺感。原断言钉的是 globalDefaults(),
  // 但那份默认值里带着写死的 847 已售 —— 正是本测试标题要消灭的伪社交证明。现在 remote 档走
  // remoteDefaults()(从 0 起,权威由服务端给),比原断言更贴它自己保护的语义;两条一起钉,
  // 免得日后有人把 remoteDefaults 的 soldSlots 改回 847 而门照绿。
  assert.match(store, /remoteApiEnabled \? remoteDefaults\(\)/);
  assert.match(store, /function remoteDefaults\(\)[\s\S]{0,240}soldSlots: 0/);
  assert.match(store, /remoteApiEnabled \? remoteDefaults\(\) : hydrateGlobal\(\)/);
  assert.match(store, /Remote mode starts unknown, never with the mock's seeded 847 slots/);
});

// 旧断言的前提是「remote 档只有 NEX 币价有服务端权威」,该前提已被 /api/app/home/overview 消除:
// 行情行现在整块来自服务端投影(取不到就显示 Unavailable,不编数)。断言不能删 —— 全仓只有这一条门
// 守这张卡;改成守「remote 只渲染服务端投影 + mock 那几行必须留在 mock 分支里 + 无权威时显式不可用」。
test("remote market board renders only the server-owned home truth rows", () => {
  const board = read("src/components/home/market-board-card.vue");
  assert.match(board, /homeTruth\?\.marketBoard\.workloads/);
  assert.match(board, /app\.homeTruth\?\.marketBoard\.workloads \?\? \[\]/);
  assert.match(board, /v-if="!remoteApiEnabled"/);
  assert.match(board, /v-if="homeMarketRows\.length"/);
  assert.match(board, /Unavailable/);
});

test("purchase social proof consumes the authenticated storefront activity API", () => {
  const ticker = read("src/components/store/purchase-ticker.vue");
  const proof = read("src/components/store/live-social-proof.vue");
  const api = read("src/api/storefront-activity-api.ts");
  assert.match(ticker, /storefrontActivityApi\.activity/);
  assert.match(proof, /storefrontActivityApi\.socialProof/);
  assert.match(api, /\/api\/storefront\/activity/);
  assert.match(api, /social-proof/);
  assert.match(ticker, /createRemoteAccountEpoch/);
  assert.match(ticker, /remoteItems\.value = \[\]/);
  assert.match(proof, /createRemoteAccountEpoch/);
  assert.match(proof, /remoteProof\.value = null/);
});

test("account-scoped event, event-page, and V-rank reads reject stale responses", () => {
  const eventQuest = read("src/store/event-quest.ts");
  const eventsPage = read("src/pages/events/events.vue");
  const missionsPage = read("src/pages/missions/missions.vue");
  const vRank = read("src/store/v-rank.ts");
  for (const source of [eventQuest, eventsPage, missionsPage, vRank]) {
    assert.match(source, /createRemoteAccountEpoch/);
    assert.match(source, /isCurrent\(/);
  }
  assert.match(eventsPage, /watch\(\(\) => app\.accountKey/);
  assert.match(missionsPage, /watch\(\(\) => app\.accountKey/);
  assert.match(eventQuest, /clearRemoteFacts\(\)/);
  assert.match(vRank, /ladder\.value = \[\]/);
});
