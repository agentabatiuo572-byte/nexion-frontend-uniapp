import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const env = read(".env.acceptance-h5");
const launcher = read("scripts/start-acceptance-h5.ps1");
const orders = read("src/store/orders.ts");
const checkout = read("src/pages/store/checkout.vue");
const orderApi = read("src/api/order-api.ts");
const catalogContract = read("src/api/product-catalog-contract.ts");
const ordinaryOrderSubmission = checkout.slice(
  checkout.indexOf("const created = await orderApi.create"),
  checkout.indexOf("// A canonical PENDING_PAYMENT receipt proves only creation"),
);

assert.match(env, /^VITE_NEXGRID_API_MODE=sandbox$/m);
assert.match(env, /^VITE_NEXGRID_API_PREVIEW_TARGET=http:\/\/127\.0\.0\.1:8110$/m);
assert.match(launcher, /VITE_NEXGRID_API_MODE\s*=\s*'sandbox'/);
assert.match(launcher, /npm\.cmd run dev:h5 -- --mode acceptance-h5/);
assert.doesNotMatch(launcher, /VITE_NEXGRID_API_MODE\s*=\s*'production'/);
assert.ok(orders.includes("const requestGeneration = ++refreshGeneration")
  && orders.includes("const requestRunScope = captureCommerceSandboxRun()")
  && orders.includes("requestGeneration === refreshGeneration")
  && orders.includes("isCurrentCommerceSandboxScope(requestRunScope)")
  && orders.includes("const canonical = await orderApi.list()")
  && orders.includes("if (!isCurrent()) return"),
"a remote order response must be discarded after logout, account rebinding, or sandbox-run switching");
assert.match(checkout, /REMOTE_CHECKOUT_COMMANDS_KEY[\s\S]*readAccountRow[\s\S]*writeAccountRow/,
  "remote checkout idempotency must survive an H5 reload in the account-scoped store");
assert.match(checkout, /retireRemoteOrderKey\(\);[\s\S]*step\.value = "live"/,
  "the durable command key is retired only on the verified success path");
assert.match(checkout, /canonical PENDING_PAYMENT receipt proves only creation[\s\S]*step\.value = "awaiting"/,
  "a remotely-created pending order must wait for an authoritative payment/fulfillment callback rather than claim provisioning");
assert.doesNotMatch(ordinaryOrderSubmission, /refreshRemoteFleet/,
  "a pending order must not be reported as failed merely because the not-yet-activated fleet cannot refresh");
assert.match(checkout, /if \(remoteApiEnabled && \(s === "awaiting" \|\| s === "confirmed" \|\| s === "activating"\)\) \{[\s\S]*restartRemoteOrderPolling\(\);[\s\S]*return;/,
  "remote checkout timers must never manufacture payment, provisioning, or activation state");
assert.match(checkout, /onShow\(\(\) => \{[\s\S]*restartRemoteOrderPolling\(\)/,
  "a visible remote checkout must resume authoritative order polling");
assert.match(checkout, /onHide\(\(\) => \{[\s\S]*stopRemoteOrderPolling\(\)/,
  "remote order polling must stop as soon as the checkout page is hidden");
assert.match(checkout, /requestAccount = auth\.accountId[\s\S]*requestAccount !== auth\.accountId[\s\S]*requestEpoch !== remoteOrderPollEpoch/,
  "a late order read must not overwrite another account or a newer page epoch");
assert.match(checkout, /case "paid":[\s\S]*step\.value = "confirmed"[\s\S]*case "provisioning":[\s\S]*step\.value = "activating"[\s\S]*case "activated":[\s\S]*step\.value = "live"/,
  "only canonical server statuses may advance the remote checkout");
assert.match(checkout, /asApiError\(error\)[\s\S]*apiError\.kind === "network"[\s\S]*apiError\.message === "IDEMPOTENCY_RESULT_UNKNOWN"[\s\S]*if \(!keepForReadback\) retireRemoteOrderKey\(\)/,
  "structured business rejection such as COMMERCE_SANDBOX_PRODUCT_NOT_AVAILABLE retires the durable key, while unknown outcomes do not");
assert.match(orderApi, /idSource: "server" \| "sandbox-server"[\s\S]*sourceEnvironment\?: "SANDBOX"[\s\S]*runId\?: string/,
  "the order client must retain the sandbox provenance required to accept a sandbox-created order");
assert.ok(orderApi.includes('const sandboxResponse = source.idSource === "sandbox-server"')
  && orderApi.includes('source.source !== "mock"')
  && orderApi.includes('source.sourceEnvironment !== "SANDBOX"')
  && orderApi.includes('RUN_ID.test(sandboxRunId)'),
  "sandbox-created orders require mock/SANDBOX/run-id proof instead of being treated as production server output");
assert.match(orderApi, /source === "mock" && sourceEnvironment === "SANDBOX"[\s\S]*rawRunId === currentSandboxRunId[\s\S]*source === "server" && sourceEnvironment === "PRODUCTION"/,
  "order list rejects an unproven sandbox source and keeps production source proof distinct");
assert.ok(catalogContract.includes('sourceEnvironment?: "SANDBOX"')
  && catalogContract.includes('runId?: string')
  && catalogContract.includes('catalogSource !== "mock"')
  && catalogContract.includes('RUN_ID.test(runId)'),
  "catalog parsing must preserve and validate the sandbox run proof used by checkout");
console.log("commerce acceptance H5 launcher: PASS");
