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
  assert.match(store, /remoteApiEnabled \? globalDefaults\(\)/);
});

test("remote market board is limited to the NEX market quote", () => {
  const board = read("src/components/home/market-board-card.vue");
  assert.match(board, /remoteApiEnabled/);
  assert.match(board, /market\.nexPriceUSDT/);
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
