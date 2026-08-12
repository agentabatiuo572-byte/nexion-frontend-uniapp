import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { createTrialApi } from "../src/api/trial-api.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

function clientReturning(data) {
  const requests = [];
  return {
    requests,
    request: async (request) => {
      requests.push(request);
      return data;
    },
    refreshSession: async () => { throw new Error("unused"); },
  };
}

const activeState = {
  authoritative: true,
  state: "ACTIVE",
  canStart: false,
  eligibilityReason: "in-progress",
  claimNo: "TRIAL-1",
  version: 3,
  serverNowEpochMs: 1_800_000_000_000,
  claimedAt: "2027-01-15T08:00:00",
  claimedAtEpochMs: 1_800_000_000_000,
  expiresAt: "2027-01-18T08:00:00",
  expiresAtEpochMs: 1_800_259_200_000,
  graceEndsAt: "2027-01-25T08:00:00",
  graceEndsAtEpochMs: 1_800_864_000_000,
  cooldownUntil: null,
  shadowUsdt: "12.5",
  shadowNex: 20,
  source: "nx_trial_claim + nx_user_wallet",
  paymentRail: "NEXION_USDT_WALLET",
  config: {
    trialDays: "3", graceDays: "7", extensionDays: "3", discountRate: "0.15",
    discountCapUSD: "20", trialOffsetCapUSD: "50", autoChargeAtEnd: "true",
    highQualityThresholdUSD: "100", trialProductId: "stellarbox-s1", trialPriceUSD: "1299",
    shadowDailyUSD: "38.52", shadowDailyNEX: "65", cooldownDays: "30", phaseOpen: "true",
    autoPushEnabled: "true", autoPushDelayMs: "1500", autoPushCooldownHours: "24",
    autoPushMaxPerSession: "1",
  },
};

test("trial API parses only authoritative known states", async () => {
  const client = clientReturning(activeState);
  const state = await createTrialApi(client).state();
  assert.equal(state.status, "active");
  assert.equal(state.claimNo, "TRIAL-1");
  assert.equal(state.shadowUSD, 12.5);
  assert.equal(state.startedAt, activeState.claimedAtEpochMs);
  assert.equal(client.requests[0].path, "/api/trial/state");
});

test("trial API accepts canonical boolean DTO values and current Chinese enum values only", async () => {
  const actualBooleanDto = await createTrialApi(clientReturning({
    ...activeState,
    config: { ...activeState.config, phaseOpen: true, autoPushEnabled: false },
  })).state();
  assert.equal(actualBooleanDto.config.phaseOpen, true);
  assert.equal(actualBooleanDto.config.autoPushEnabled, false);

  const currentLegacyDto = await createTrialApi(clientReturning({
    ...activeState,
    config: { ...activeState.config, phaseOpen: "开放", autoPushEnabled: "开" },
  })).state();
  assert.equal(currentLegacyDto.config.phaseOpen, "开放");
  assert.equal(currentLegacyDto.config.autoPushEnabled, "开");
});

test("trial API rejects unknown, non-authoritative, and contradictory responses", async () => {
  for (const mutation of [
    { state: "MYSTERY" },
    { authoritative: false },
    { state: "ACTIVE", canStart: true },
    { eligibilityReason: undefined },
    { serverNowEpochMs: "not-a-time" },
  ]) {
    const client = clientReturning({ ...activeState, ...mutation });
    await assert.rejects(() => createTrialApi(client).state(), /TRIAL_RESPONSE_INVALID/);
  }
});

test("trial commands carry idempotency keys and parse authoritative receipts", async () => {
  const client = clientReturning(activeState);
  const api = createTrialApi(client);
  await api.start("h2-start-1", "NexGridBox S1");
  await api.cancel("explicit", "h2-cancel-1");
  assert.deepEqual(client.requests.map((request) => [request.path, request.idempotencyKey]), [
    ["/api/trial/start", "h2-start-1"],
    ["/api/trial/cancel", "h2-cancel-1"],
  ]);
  assert.deepEqual(client.requests[0].body, { deviceName: "NexGridBox S1" });
  assert.deepEqual(client.requests[1].body, { reason: "explicit" });
});

test("trial start sends the device mapped from the authoritative product config", async () => {
  const client = clientReturning({
    ...activeState,
    config: { ...activeState.config, trialProductId: "device-trial-standard" },
  });
  const api = createTrialApi(client);
  await api.start("h2-start-product-contract", "NexGridBox S1");
  assert.deepEqual(client.requests[0].body, { deviceName: "NexGridBox S1" });
});

test("eligible first-time users retain a visible H2 claim entry which opens the real claim flow", () => {
  const earn = read("src/pages/earn/earn.vue");
  const hero = read("src/components/trial-hero-banner.vue");
  const sheet = read("src/components/trial-claim-sheet.vue");
  assert.match(earn, /<TrialHeroBanner class="w-full"/);
  assert.match(hero, /trial\.status === "none" && trial\.canStart\(\)/);
  assert.match(hero, /@click="onClick"/);
  assert.match(hero, /claimSheet\.show\(\)/);
  assert.match(sheet, /await freeTrial\.start\(\)/);
});

test("remote free-trial store never persists or locally advances an authoritative terminal state", () => {
  const source = read("src/store/free-trial.ts");
  assert.match(source, /trialApi/);
  assert.match(source, /remoteApiEnabled/);
  assert.match(source, /async function refreshRemote/);
  assert.match(source, /trialApi\.eligibility\(\)/);
  assert.match(source, /refreshRemote\(true\)/);
  assert.match(source, /authorityRequestSequence/);
  assert.match(source, /if \(remoteApiEnabled\) return refreshRemote\(\)/);
  assert.match(source, /if \(remoteApiEnabled\) return;/);
  assert.match(source, /authorityStatus/);
  assert.match(source, /refreshInFlightAccount === boundKey/);
  assert.match(source, /reason: "unknown"/);
  const configSource = read("src/store/trial-config.ts");
  assert.match(configSource, /mode !== "mock"/);
  assert.match(configSource, /function reset\(\) \{\s+if \(remoteAuthority\) return;/);
  assert.match(configSource, /device-trial-standard/);
  assert.match(configSource, /TRIAL_PRODUCT_DEVICE_NAMES/);
  assert.match(configSource, /resolveTrialDeviceName/);
  assert.doesNotMatch(configSource, /raw\.trialProductId !== "stellarbox-s1"/);
  const apiSource = read("src/api/trial-api.ts");
  assert.match(apiSource, /start:\s*\(idempotencyKey, deviceName\)/);
  assert.match(apiSource, /body:\s*\{ deviceName \}/);
  const storeSource = read("src/store/free-trial.ts");
  assert.match(storeSource, /resolveTrialDeviceName\(useTrialConfig\(\)\.config\.trialProductId\)/);
  assert.match(storeSource, /trialApi\.start\(pendingStartKey, deviceName\)/);
});
