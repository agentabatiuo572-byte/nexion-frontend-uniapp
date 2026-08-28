import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("formal App enables only the server-owned commerce payment simulator in dev", () => {
  const runtime = read("src/api/runtime.ts");
  const checkout = read("src/pages/store/checkout.vue");

  assert.match(runtime, /developmentFundsEnabled = false/,
    "the broad browser funds sandbox must stay disabled");
  assert.match(runtime,
    /developmentCommercePaymentEnabled = apiRuntimeConfig\.environment === "dev"/,
    "local checkout payment must be derived only from the compiled dev runtime");
  assert.match(checkout, /developmentCommercePaymentEnabled/);
  assert.doesNotMatch(checkout, /developmentFundsEnabled/,
    "checkout must not couple payment execution to the retired broad funds sandbox");
  assert.match(checkout, /commercePaymentApi\.confirm\(created\.orderNo/,
    "the dev branch must call the Java payment command");
  assert.match(checkout, /commercePaymentApi\.confirm[\s\S]{0,1800}app\.refreshRemoteFleet\(\)/,
    "a settled development purchase must refresh the canonical wallet and fleet projection");
});

test("production checkout still exposes provider-backed waiting instead of simulated success", () => {
  const checkout = read("src/pages/store/checkout.vue");
  assert.match(checkout,
    /if \(developmentCommercePaymentEnabled\)[\s\S]{0,2200}commercePaymentApi\.confirm[\s\S]{0,2200}step\.value = "awaiting"/,
    "only the development branch may execute simulated payment");
});

test("development card UI discloses mock scope without PSP or checkout claims", () => {
  const badge = read("src/components/me/card-simulation-badge.vue");
  const bindPage = read("src/pages/me/wallet-cards-new.vue");
  const cardsPage = read("src/pages/me/wallet-cards.vue");
  const zh = read("src/i18n/messages/zh.ts");
  const en = read("src/i18n/messages/en.ts");

  assert.match(badge, /v-if="developmentPaymentEnabled"/,
    "the disclosure must be visible whenever development card binding is enabled");
  assert.match(badge, /data-testid="card-simulation-badge"/);
  assert.match(bindPage, /<CardSimulationBadge/);
  assert.match(cardsPage, /<CardSimulationBadge/);
  assert.match(zh, /本地开发模拟 · 非真实银行或收单环境 · 不会产生真实扣款/);
  assert.match(zh, /不会参与商城扣款/);
  assert.match(en, /Local development simulation · Not a real bank or payment provider · No real charge/);
  assert.match(en, /not charged at checkout/);
  for (const messages of [zh, en]) {
    const cardsStart = messages.indexOf("  cards: {");
    const cardsEnd = messages.indexOf("  onboarding:", cardsStart);
    const cardsBlock = cardsStart >= 0 && cardsEnd > cardsStart
      ? messages.slice(cardsStart, cardsEnd)
      : "";
    assert.ok(cardsBlock, "cards translations must remain discoverable");
    assert.doesNotMatch(cardsBlock, /PCI DSS|256-bit TLS|Reused at checkout|结算时复用/,
      "the simulated card UI must not imply a real certified acquiring path");
  }
});
