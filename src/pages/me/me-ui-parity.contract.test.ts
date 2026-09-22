// @ts-expect-error Vitest executes this structural contract in Node; the App tsconfig intentionally omits Node globals.
import { existsSync, readFileSync, readdirSync } from "node:fs";
// @ts-expect-error Vitest executes this structural contract in Node; the App tsconfig intentionally omits Node globals.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./me.vue", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const formalMeDir = new URL("./", import.meta.url);
const prototypeMeDir = new URL("../../../../NX1.0-Prototype/src/pages/me/", import.meta.url);
const EXPECTED_TEMPLATE_DIFFERENCES = [
  "achievements.vue",
  "devices.vue",
  "goals.vue",
  "help.vue",
  // Production language choices only advertise locales with complete bundled copy.
  "language.vue",
  "me.vue",
  // Formal notifications retain the 5174 layout while adding a labelled,
  // confirmed clear-read action and page-show server refresh.
  "notifications.vue",
  "preferences.vue",
  "profile.vue",
  // Formal earnings proof deliberately omits the Prototype's synthetic sparkline;
  // this surface displays the server-authoritative total rather than invented trend data.
  "proof.vue",
  "receipts.vue",
  // Voucher reads retain the 5174 ticket layout while making initial/failed
  // remote reads explicit; only a current ready read can claim an empty wallet.
  "rewards-list.vue",
  // Same 5174 cards, plus production-only authoritative-summary unavailable/retry state.
  "rewards.vue",
  // Formal App keeps the 5174 visual styles while adding production-only
  // accessibility, server-authority and fail-closed controls in these templates.
  "risk-disclosure.vue",
  "security.vue",
  // Real support targets replace prototype response statistics and availability.
  "support-tickets.vue",
  "support.vue",
  "trial.vue",
  "wallet-address-rebind.vue",
  "wallet-bills.vue",
  "wallet-cards-new.vue",
  "wallet-cards.vue",
  "wallet-exchange-how.vue",
  // Keep editing decimal text intact; canonicalize on blur before confirmation.
  "wallet-exchange.vue",
  "wallet-nex.vue",
  "wallet-repurchase-how.vue",
  "wallet-repurchase.vue",
  "wallet-topup.vue",
  "wallet-withdraw-tracking.vue",
  "wallet-withdraw.vue",
  "wallet.vue",
];
// Pin the exact formal/reference template pair for every approved difference.
// A new edit inside an approved file therefore still fails until its specific
// production-only delta is reviewed; this is not a file-level exemption.
const EXPECTED_TEMPLATE_PAIR_SHA256: Record<string, string> = {
  "achievements.vue": "ae19a15f2b050424de21be06c40d08a1b2a4855e6464fc9ed78dc2bd96162d62",
  // Existing formal phone-calibration entry, trial state and physical-slot guard.
  "devices.vue": "ff2a1662e252b3233c387cc24fc07708ff9ac53b5f4c2fddf3dc1d2c212bc00f",
  // Goal reads retain the 5174 structure while current-scope recovery makes
  // loading/error explicit, preserves a confirmed snapshot, and exposes retry.
  // Saving remains idempotent; a completed or unavailable recommendation has no purchase CTA.
  // #103: preset target/deadline pills are mutually exclusive choices, so they are
  // radiogroups with aria-checked instead of unlabelled clickable views; the amount
  // input and remove action carry accessible names. Styles are unchanged.
  "goals.vue": "265bbf2b295d52dbb62e3bbce42ab6425d192a2f5061bba621ce3ba4c2b02c10",
  // R3 keyboard controls plus reviewed production FAQ empty-state authority:
  // unread, failed, or incomplete pagination cannot claim no matching content.
  // Exact FAQ deep links clear on category selection; withdrawn targets use the
  // generic no-match state without rendering their internal ID. Styles are unchanged.
  // #104: FAQ search and Bot inputs carry accessible names and the send button is named.
  // #94: category chips are a radiogroup with aria-checked, not toggle buttons.
  // #94: 分类 chips 补齐 roving tabindex + 左右方向键(此前六个成员全是 tabindex="0")。
  "help.vue": "d180b1016227da9570f320c1912cc1db9fdebc4b394b173be63e4ab3e0136c35",
  // Formal picker presents only shipped interface languages; priority/RTL roadmap UI is excluded.
  // #94: the language list is a mutually exclusive choice, so it is a named radiogroup
  // with aria-checked and roving tabindex instead of toggle buttons.
  "language.vue": "ca4e5280ab00b77a8b570ed380d2ba2d053873128d023b7155112bc881428120",
  // BUG 173: the trial hero slot is three-state — a fixed-height skeleton holds the
  // slot while the first authoritative trial read is in flight, so the card cannot
  // appear late and push every module below it down.
  "me.vue": "38690fef026420ad8ead1b9f0604dc13a804789e20422f07b88c8b0a470092b9",
  // Keep the selected zero-count category visible and show category-specific empty copy;
  // loading and request failures must not render a successful empty-feed message.
  // #94/#210: the mutually exclusive category chips are a radiogroup (role=radio +
  // aria-checked + roving tabindex + arrow keys), not aria-pressed toggle buttons.
  "notifications.vue": "65da5d90ea7db6b540f068180fef697f12192bbfa19a3d7219f7f42cf5d5982a",
  // Translate the closed error category instead of showing protocol identifiers.
  "preferences.vue": "2113efe4331a844e135e9f403a6b0b683ef72a3283b34f0a571c58cb5fdd5cab",
  // Unknown canonical payout state retains a neutral management entry; only a
  // confirmed empty address book offers setup. Layout and styles are unchanged.
  // #89: avatar, wallet row and save action expose names, link/button roles and
  // Enter/Space activation. Layout and styles are unchanged.
  "profile.vue": "1d41442da5a5583a4f34102537fd1cbf2b57787dc3b0f218b92925e96ea0b66d",
  // R2-06: server facts take precedence over the Prototype's fabricated earnings curve;
  // an unavailable server percentile occupies the same label/value slot as a neutral unknown,
  // without inventing a rank or changing the surrounding 5174 layout.
  // #83: an absent streak fact reads as unavailable instead of rendering the unit alone.
  // #94: the three proof variants are a mutually exclusive choice, so they are a
  // named radiogroup with aria-checked and roving tabindex instead of toggle buttons.
  "proof.vue": "c7839154d46d332c138af9a7ed8c45dfe3703cda989e037bdcead580fd390692",
  // Formal receipts keep the 5174 row layout but render server settlement
  // status and suppress positive amounts unless the receipt is CREDITED.
  // Compute and VietQR receipts render in separately selected, independently
  // recoverable lanes; a VietQR-only account must not be labelled as compute receipts.
  // #94: compute/top-up type switch and category tabs are tablists with aria-selected,
  // matching their mutually exclusive behaviour instead of toggle buttons.
  "receipts.vue": "d517d95ad6fdae2f54fb9835e1590a4edb6fb5b892bfb354a35eb823b5335d89",
  // L2 keeps the 5174 voucher-ticket styles but distinguishes unknown, retryable
  // failure, and server-confirmed empty states.
  "rewards-list.vue": "e94eda52ff2176ff9fe6e46b5837433b062a7953934302da732281703042fbf5",
  // L1's #80 source-only count gate does not alter this template pair.
  "rewards.vue": "9334402601bb42d5429ed5fd665da0e2fd093d4d1e1a659ad8339b2a0420dd3b",
  // Published-document metadata/language fallback, plus reset of reading proof
  // whenever server jurisdiction/version/token identity changes. #226 keeps
  // anonymous legal text readable without rendering an acknowledgment control.
  // #60: an unprovisioned region mapping states the configuration fact and
  // offers no retry CTA, since retrying cannot change the outcome.
  "risk-disclosure.vue": "b9465bdf68bd257c65a1efb47cd8498fb62374c0e96196256695758c1bb83e26",
  // Formal single-device signout names that device; server cursor exposes remaining sessions.
  // #80: password/2FA inputs carry an accessible name, not a placeholder alone.
  // #216: the password-change validation error is associated to its own field
  // (aria-describedby + aria-invalid, one literal id per field), announced via
  // role=alert, and focus moves to the first invalid field; editing clears it.
  "security.vue": "b0412facb6c2625f0148375533c2bcd8d9de2556ea8814fd3461449e3a73dd62",
  // R3: resolved tickets can receive replies; closed tickets remain read-only.
  // P1: the create form also renders its own PC-published Ticket Create knowledge surface.
  // Production ticket detail can request the server-paginated earlier history.
  // Every mode change now routes through setMode so the address tracks the visible
  // form (back-to-list clears ?mode=create; a create deep link survives reload).
  // #162: the create form's category chips are a radiogroup with aria-checked and
  // roving tabindex (they were unnamed toggle buttons with no selected state), and
  // the subject/description fields carry accessible names plus required and
  // length hints; the empty-submit error is associated to its field. Styles unchanged.
  "support-tickets.vue": "0aec7c6ce7090a8b35877f5b25ac05f051049c775e1774724433ef2008268241",
  "support.vue": "c3592d6ff3f3c88a9e8def9171378f62f7f56f6927a30baa750a3d38cdc71020",
  // Production EXTENDED retains its purchase deadline and explicitly frozen credit copy.
  "trial.vue": "03a78f5ddadde8693fe0ef11c8f5ed0306d52a73334d8a5bb3c6c840da9ec1bc",
  // Unknown server time keeps changes closed and exposes an accessible read-only refresh.
  "wallet-address-rebind.vue": "af2acd0ccced08df5e0671e5e870bd2efd80e4daa79c4bc2af8ab16ecc3ef8d8",
  // 账单类型是互斥单选(选一个,其余取消)。此前用 role="button" + aria-pressed,浏览器
  // 按 toggle button 暴露、读屏按复选框朗读 —— 用户会以为能同时选多个类型(zentao #94)。
  // 改 radiogroup/radio + aria-checked,并补 Enter/Space;视觉样式与原型一致,未改动。
  // #220: the empty-state description follows the active filter, so the expense tab no
  // longer reuses the income wording ("充值和到账").
  // #94: 类型单选组补齐 roving tabindex + 左右方向键(同上)。
  "wallet-bills.vue": "4fe232cb79b7e25673bc2b8bb786e7d69257d0151e146158323cbf7a25faf353",
  // Authorized bank selector and real beneficiary binding reuse the original visual tokens.
  // Bank account/holder replace PAN semantics; expiry/CVV remain visible but are not collected.
  // #88: cardholder input carries its visible label as an accessible name.
  "wallet-cards-new.vue": "6af630a5acf97669826202e3842042a8b28af8813f0657da0a6085336f7a3fc2",
  "wallet-cards.vue": "b9800456add8dee31bbf2182901b4d6d30b717f3ad6b54fc55dc11abc8308671",
  "wallet-exchange-how.vue": "cdcabf7a5eb516b3612fcd458984a8266d6038ae363150c8146120276a9273aa",
  // Queued exchanges state that funds are reserved immediately and refunded on cancellation.
  // Server fee and six-decimal net proceeds are disclosed before confirmation;
  // an unknown remote snapshot is distinct from an empty transaction history.
  // A server-paused exchange shows an explicit status above the unchanged form.
  // #88: pay-amount input and the icon-only flip/refresh/max actions carry accessible names.
  "wallet-exchange.vue": "b7b60d345af7ae5dfa5071f90be54095677ea0f20451821d42b5c0994ecbd53c",
  // Same recent-activity rows; loading/error/retry now precede the true empty state.
  // Unknown market authority suppresses estimated valuation, and ledger activity
  // uses the controlled public presentation instead of internal bill vocabulary.
  // #87: view-market, quick cells, use tiles and view-all expose link roles,
  // names and Enter activation (navigations, so Space stays with page scroll).
  "wallet-nex.vue": "fc77db09f74971cf1184bf5ccf8e233d57d9deb3b5133d0a1e116383e5655fa8",
  "wallet-repurchase-how.vue": "6e12626d38a041f066c2dd37a8f3bf5497746c83b5962a11f9c578308662662a",
  // Input and principal display preserve the command's six-decimal precision.
  // R3: unresolved intents retain their amount and expose an explicit recovery CTA.
  // Confirmed operations retain the form while a separate history-sync notice offers GET-only retry.
  // Formal G7 now exposes historical orders, claim/early actions and server-configured copy.
  // Readiness audit #59: neutral busy status replaces stale wallet/form output until
  // the current authoritative snapshot completes; no retry CTA during an active read.
  // #165: the main CTA exposes aria-disabled, and an insufficient balance states its
  // reason plus a top-up path instead of only greying out.
  "wallet-repurchase.vue": "a74d55193c065bdb2a714d1043313d1ab453f85b0c9c55c427603710ee2628ed",
  // #88: channel tabs expose a group name and per-tab names alongside aria-selected.
  // #94: 通道 tablist 补齐 roving tabindex(选中项 0、其余 -1)与左右方向键 ——
  //      只加 role=tab 而每个成员都 tabindex="0" 不是 roving,组内方向键也无效。
  "wallet-topup.vue": "124e03f7fb3a1debb1ed8a658e3c612d4c84f9ac486189c190a3484acd507b9b",
  // Deep-link tracking waits for an owned exact read and distinguishes loading,
  // retryable read failure, and server-confirmed absence from a memory miss.
  "wallet-withdraw-tracking.vue": "7e295fb4b5e5bc50dcbfbbe136c6ede7bcab07ae9bb6193b666bf397acb60e9a",
  // Per-transaction maximum, daily count capacity and channel availability remain distinct.
  // Withdrawal methods share the selection page; USDT has no duplicate bank entry.
  // Local financial snapshot freshness/retry controls remain unchanged.
  "wallet-withdraw.vue": "60e3ad63c63486cabca84d4815ca5d62c46ca82f5843c33fa4700abb0753eb73",
  // P2: unavailable funds render as unknown and retain the last confirmed snapshot with retry.
  "wallet.vue": "ccab754cc7fad16663e64b3c19115f0fe08d2245abaefd72e7c926efc6176140",
};

function block(text: string, tag: "style" | "template"): string {
  return text.replace(/\r\n/g, "\n").match(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`))?.[0] ?? "";
}

function quickKeys(section: string): string[] {
  const quickSource = source.slice(source.indexOf("const quickSections"));
  const match = quickSource.match(new RegExp(`key: "${section}"[\\s\\S]*?items: \\[([\\s\\S]*?)\\n    \\],`, "m"));
  if (!match) throw new Error(`ME_SECTION_NOT_FOUND:${section}`);
  return [...match[1].matchAll(/\{ key: "([^"]+)"/g)].map((row) => row[1]);
}

describe("Me page 5174 normal-state UI parity", () => {
  it("keeps the same five large modules and quick-entry order", () => {
    expect(quickKeys("network")).toEqual(["team", "invite", "commissions", "rank"]);
    expect(quickKeys("devices")).toEqual(["inventory", "add", "slots", "goals"]);
    expect(quickKeys("account")).toEqual(["rewards", "receipts", "orders", "genesis", "cards", "profile", "security"]);
    expect(quickKeys("preferences")).toEqual(["preferences", "theme", "language"]);
    expect(quickKeys("help")).toEqual(["messages", "support", "faq", "tickets", "trust", "learning", "risk", "developer"]);
  });

  it("preserves the 5174 top-to-bottom component order", () => {
    const markers = [
      "<ProfileRow />",
      "<WalletCard />",
      "<WithdrawalLockedWarning",
      "<TrialEntry v-if=\"trialIsHero\" />",
      "v-for=\"section in quickSections\"",
      "<TrialEntry v-if=\"trialIsActive\" />",
      "<OrdersCard v-if=\"orderCount > 0\" />",
      "t.me.signOut",
    ];
    const indexes = markers.map((marker) => source.indexOf(marker));
    expect(indexes.every((index) => index >= 0)).toBe(true);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });

  it("isolates authenticated module refreshes with all-settled semantics", () => {
    expect(source).toContain("settleRemoteMeLoaders");
    for (const key of ["home", "fleet", "funds", "orders", "security", "notifications", "conversations", "trial", "vouchers", "rank", "genesis", "bills", "market"]) {
      expect(source).toContain(`["${key}"`);
    }
  });

  it("derives the Message Center badge from conversations instead of notification campaigns", () => {
    expect(source).toContain('import { useConversations } from "@/store/conversations"');
    expect(source).toContain('import { useNova } from "@/store/nova"');
    expect(source).toContain("const conversationUnread = computed(() => conversations.totalUnread + nova.unread)");
    expect(source).toContain('key: "messages", label: t.value.me.supportMessagesRow, href: "/support/messages", icon: "messages", badge: conversationUnread.value > 0 ? String(conversationUnread.value) : undefined');
    expect(source).not.toContain("const unreadNotifs = computed(() => notifications.unread)");
  });

  it("matches the checked-out 5174 Me-page visual baseline when it is available", () => {
    if (!existsSync(prototypeMeDir)) return;
    // User-requested HDPay payout is a new server-only page, covered by bank-withdrawal-runtime.mjs.
    expect(existsSync(new URL("wallet-withdraw-bank.vue", formalMeDir))).toBe(true);
    const files = readdirSync(formalMeDir).filter((name: string) => name.endsWith(".vue") && !["wallet-withdraw-bank.vue", "wallet-withdraw-method.vue"].includes(name)).sort();
    const prototypeFiles = readdirSync(prototypeMeDir).filter((name: string) => name.endsWith(".vue")).sort();
    expect(files).toEqual(prototypeFiles);
    expect(files).toHaveLength(32);

    const templateDifferences: string[] = [];
    const templatePairHashes: Record<string, string> = {};
    for (const name of files) {
      const formal = readFileSync(new URL(name, formalMeDir), "utf8");
      const prototype = readFileSync(new URL(name, prototypeMeDir), "utf8");
      expect(block(formal, "style"), `${name} style`).toBe(block(prototype, "style"));
      const formalTemplate = block(formal, "template");
      const prototypeTemplate = block(prototype, "template");
      if (formalTemplate !== prototypeTemplate) {
        templateDifferences.push(name);
        templatePairHashes[name] = createHash("sha256")
          .update(formalTemplate)
          .update("\0")
          .update(prototypeTemplate)
          .digest("hex");
      }
    }
    expect(templateDifferences).toEqual(EXPECTED_TEMPLATE_DIFFERENCES);
    expect(templatePairHashes).toEqual(EXPECTED_TEMPLATE_PAIR_SHA256);
  });
});
