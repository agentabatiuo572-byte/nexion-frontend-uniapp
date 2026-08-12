import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const app = read("src/store/app.ts");
const shell = read("src/App.vue");
const bills = read("src/store/bills.ts");
const deposits = read("src/store/deposits.ts");
const withdraw = read("src/pages/me/wallet-withdraw.vue");
const billPage = read("src/pages/me/wallet-bills.vue");
const walletPage = read("src/pages/me/wallet.vue");
const ledgerProjection = read("src/store/funds-sandbox-ledger.ts");
const cardPane = read("src/components/me/topup-card-form.vue");
const bankPane = read("src/components/me/deposit-bank-pane.vue");
const chainPane = read("src/components/me/deposit-usdt-pane.vue");
const trackingPage = read("src/pages/me/wallet-withdraw-tracking.vue");
const mutationKeys = read("src/lib/funds-mutation-key.ts");
const sandboxBadge = read("src/components/me/funds-sandbox-badge.vue");

assert.match(app, /const bootSnapshot = remoteApiEnabled[\s\S]{0,180}\? createServerEmptySnapshot[\s\S]{0,180}: hydrateSnapshotEconomics\(readAccountSnapshot/,
  "server boot must not adopt the legacy local account snapshot");
assert.match(app, /const withdrawals = ref<Withdrawal\[]>\(remoteApiEnabled\s*\?\s*\[\]/,
  "server boot must not hydrate legacy local withdrawals");
assert.match(app, /if \(remoteApiEnabled\)[\s\S]{0,1200}withdrawals\.value = \[\]/,
  "server account rebind must clear the prior subject's withdrawals synchronously");
assert.match(app, /lastCloudSnapshot = createServerEmptySnapshot\(/,
  "server account rebind must replace the local merge base");
assert.match(app, /async function refreshFundsSandbox[\s\S]{0,1200}expectedAccountKey !== accountKey\.value[\s\S]{0,1400}withdrawals\.value = \[\]/,
  "a stale or failed account refresh must fail closed without adopting another subject's facts");
assert.match(walletPage, /fundsAuthorityError[\s\S]{0,250}fundsSandboxError/,
  "wallet refresh failure must remain visible instead of falling back to a local balance");
assert.match(walletPage, /<FundsSandboxBadge\b/,
  "the successful sandbox wallet balance must stay visibly labelled");
assert.match(sandboxBadge, /Acceptance Sandbox · source=mock · SANDBOX[\s\S]{0,900}fundsSandboxEvidence/,
  "the label must be derived from the validated server provenance");
assert.match(app, /function refundFailedWithdrawals\(\)[\s\S]{0,180}if \(fundsServerEnabled\) return \[\]/,
  "server mode must not refund via local reward buckets");
assert.match(app, /function creditRewardBucketOnce[\s\S]{0,220}if \(fundsServerEnabled\) return false/,
  "server mode must reject local reward-bucket credits");

assert.match(shell, /function advanceArrivalAndSettleBill\(\)[\s\S]{0,180}if \(fundsServerEnabled\) return/,
  "server mode must disable local arrival/refund reconciliation");
assert.match(shell, /function startArrivalPoll\(\)[\s\S]{0,180}if \(fundsServerEnabled\) return/,
  "server mode must not start the five-second local finalizer");

assert.match(bills, /fundsServerEnabled \? \[\] : hydrate\(/,
  "server bills must not hydrate localStorage or seed rows");
assert.match(bills, /adoptFundsSandboxLedger/);
assert.match(ledgerProjection, /balanceAfter: entry\.availableAfter/,
  "server balanceAfter must come from the authoritative sandbox ledger");
assert.match(bills, /if \(fundsServerEnabled\) return false/,
  "local bill persistence must fail closed in server mode");
assert.match(bills, /expectedAccountKey[\s\S]{0,800}FUNDS_SANDBOX_ACCOUNT_CHANGED/,
  "ledger refresh must reject a response after account switching");
assert.match(ledgerProjection, /source: "mock"[\s\S]{0,120}sourceEnvironment: "SANDBOX"/,
  "sandbox ledger rows must remain visibly labelled");
assert.match(billPage, /onShow\(async \(\) =>[\s\S]{0,300}refreshFundsSandboxLedger/,
  "the ledger page must re-read the server authority after refresh or re-entry");
assert.match(billPage, /b\.balanceAfter !== undefined[\s\S]{0,200}runningBalanceLabel\(b\.balanceAfter!/,
  "ledger UI must render the authoritative availableAfter projection");
assert.match(billPage, /<FundsSandboxBadge\b/,
  "the authoritative sandbox ledger must stay visibly labelled");

assert.match(deposits, /serverAccountKey = normalizeAccountKey\(rawAccountKey\)[\s\S]{0,180}records\.value = \[\][\s\S]{0,120}intents\.value = \[\]/,
  "deposit facts must clear synchronously when switching accounts");
assert.match(deposits, /async function refreshFundsSandboxDeposits[\s\S]{0,700}expectedAccountKey !== serverAccountKey/,
  "deposit refresh must reject a stale account response");
assert.doesNotMatch(deposits, /refreshFundsSandboxDeposits\(\)\.catch\(\(\) => undefined\)/,
  "sandbox refresh failures must not be silently converted into local fallback");

assert.match(withdraw, /fundsSandboxEnabled\s*\?\s*\[\{ id: "USDT-BEP20"/,
  "sandbox withdrawal UI must expose only the backend-supported BEP20 network");
assert.match(withdraw, /withdrawalPolicyError/,
  "provider/policy errors must remain visible instead of collapsing to a fake fallback");
assert.match(withdraw, /if \(withdrawalPolicyError\.value\) return withdrawalPolicyError\.value/,
  "the submit blocker must preserve the real policy error");
assert.doesNotMatch(withdraw, /idempotencyKey:\s*`withdrawal:[^`]*(Date\.now|Math\.random)/,
  "a withdrawal retry must not mint a new key from the client clock or PRNG");

assert.match(cardPane, /runRecoverableFundsOperation\(async \(\) =>[\s\S]{0,900}await deposits\.createSandboxTopup\("CARD", usdtAmount\.value, acct\)[\s\S]{0,700}failure: \(reason\)[\s\S]{0,180}phase\.value = "fail"/,
  "card API rejection (401, missing schema, or network loss) must leave 3DS in a retryable failure state");
assert.match(cardPane, /failureReason\.value = reason/,
  "card failures must retain the authority's real reason");
assert.match(bankPane, /expectedAccountKey = dep\.currentAccountKey\(\)[\s\S]{0,180}setTimeout\(\(\) => \{ void completeCreateOrder\(usdt, expectedAccountKey\); \}, 600\)/,
  "VietQR timer must not contain an unobserved async callback");
assert.match(bankPane, /async function completeCreateOrder[\s\S]{0,900}runRecoverableFundsOperation[\s\S]{0,900}failure: \(reason\)[\s\S]{0,300}settled: \(\) => \{ creating\.value = false/,
  "VietQR API rejection must expose the reason and always release loading for retry");
assert.match(deposits, /normalizeAccountKey\(rawExpectedAccountKey\) !== expectedAccountKey[\s\S]{0,150}FUNDS_SANDBOX_ACCOUNT_CHANGED/,
  "delayed top-up intents must not move to a newly bound account before the request starts");

for (const [name, source] of [["card", cardPane], ["VietQR", bankPane], ["Cregis", chainPane]]) {
  assert.doesNotMatch(source, /createSandbox(?:Topup|BankIntent)\([^\n]*(?:Date\.now|Math\.random)/,
    `${name} response-lost retry must not generate a second mutation key`);
}
assert.match(mutationKeys, /accountKey[\s\S]{0,120}environment[\s\S]{0,120}method[\s\S]{0,120}fingerprint/,
  "pending mutation keys must be isolated by account, environment, method and payload");
assert.match(mutationKeys, /generations[\s\S]{0,2500}getOrCreate[\s\S]{0,1800}finishByOrder/,
  "pending mutation keys must survive retry and rotate only after a bound order reaches terminal authority");
assert.match(app, /const mutation: FundsMutationIdentity \| null = fundsSandboxEnabled \?[\s\S]{0,900}: null/,
  "the durable pending registry must be limited to server sandbox commands");
assert.match(app, /if \(!fundsSandboxEnabled\) \{[\s\S]{0,240}FUNDS_PRODUCTION_WITHDRAWAL_HOLD/,
  "production withdrawal must HOLD before POST until a durable terminal readback contract exists");
assert.doesNotMatch(app, /createProductionFundsRequestKey\(\)/,
  "a production retry must not mint a fresh key without terminal readback");
assert.match(trackingPage, /<FundsSandboxBadge\b/,
  "terminal and non-terminal sandbox orders must remain visibly labelled");

console.log("funds server sandbox regressions: PASS");
