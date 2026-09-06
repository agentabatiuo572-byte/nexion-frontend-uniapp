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
  "achievements.vue": "939b5668f4f8dffc104856476b69b53375f6b3a4b056f63f19a9e901d2c3fcbd",
  // Existing formal phone-calibration entry, trial state and physical-slot guard.
  "devices.vue": "eef17485a1a19178f62b0d85c6c940497c149aa04993deba62e30e46a13f52b0",
  // Disable editing and repeat activation while the same goal intent is saving.
  "goals.vue": "60440d2dd970a5e3ed9a4648fc83e272cb452e10a90f26e1dc0c4a02c3b33307",
  // R3: preserve layout while enabling keyboard FAQ and category controls.
  "help.vue": "ecea9895c4b6949e728f61b0ce7e5ced94ce27e79d70753d4f3ede509dbec552",
  "language.vue": "13447b1d8aa9e01afb78d7f65d5f9cb4dcc89e947c843eb172d79b34a40ea2fb",
  "me.vue": "4c844c3c785073e568c38568d4bba897df86325bad2f677428b3588ba6d85aaf",
  "notifications.vue": "a5364e90ea9b5111df247207a486ac094a1839fecccb7f63b6e11f95df4706b5",
  // Translate the closed error category instead of showing protocol identifiers.
  "preferences.vue": "2113efe4331a844e135e9f403a6b0b683ef72a3283b34f0a571c58cb5fdd5cab",
  "profile.vue": "08bbb8611dfef4d895ea64766fb067e59cdba9fc8487089da91785bbbf0e696a",
  // R2-06: server facts take precedence over the Prototype's fabricated earnings curve;
  // the formal page also uses the shared BrandLockup without changing the surrounding layout.
  "proof.vue": "7de4caeb6ac8cfa9bfd48a0f216af7ac712f9966e0c727dbf259d26f362f29e9",
  // Formal receipts keep the 5174 row layout but render server settlement
  // status and suppress positive amounts unless the receipt is CREDITED.
  // P3-13 additionally renders recoverable initial/pagination errors and a busy
  // load-more label. Compute-summary failures now remain explicit and retryable.
  "receipts.vue": "11de2e695fae89d874feebdc8e4aa3acc1c213fd2619e11b1032bb73c0c656f8",
  "rewards.vue": "9334402601bb42d5429ed5fd665da0e2fd093d4d1e1a659ad8339b2a0420dd3b",
  "risk-disclosure.vue": "4fcb42f5d5245fe23b1269ac36de0eeba2b5a9e4e74a80ad219311b52013d64f",
  // Formal single-device signout names that device; server cursor exposes remaining sessions.
  "security.vue": "8eb2584d7f83472ec1eac4dd1d4de4f49ea226cabf5ccb9a185131af34ddd7f7",
  // R3: resolved tickets can receive replies; closed tickets remain read-only.
  // P1: the create form also renders its own PC-published Ticket Create knowledge surface.
  // Production ticket detail can request the server-paginated earlier history.
  "support-tickets.vue": "c058bea3b141432c95f151d342bb509cf456b709237737f776edcf6ea9d40d10",
  "support.vue": "c3592d6ff3f3c88a9e8def9171378f62f7f56f6927a30baa750a3d38cdc71020",
  // Production EXTENDED retains its purchase deadline and explicitly frozen credit copy.
  "trial.vue": "03a78f5ddadde8693fe0ef11c8f5ed0306d52a73334d8a5bb3c6c840da9ec1bc",
  "wallet-address-rebind.vue": "c5865a83b3fe7e15196a9b0e852100900e72b1d88125692469b84062d957a7be",
  "wallet-bills.vue": "b2479f2aa783f980f4e04db1dbc133a5b2f4588330d66395f0222fdacde425af",
  "wallet-cards-new.vue": "d0134756c231552e9068b064b664c5ef1cc7ee3242272f03d4ed1744f9696c97",
  "wallet-cards.vue": "3d1ab2de2b31a61e95bf2a388ba334b6d785a977421f7de75d9ab6e147171622",
  "wallet-exchange-how.vue": "cdcabf7a5eb516b3612fcd458984a8266d6038ae363150c8146120276a9273aa",
  // Queued exchanges state that funds are reserved immediately and refunded on cancellation.
  // Server fee and six-decimal net proceeds are disclosed before confirmation.
  "wallet-exchange.vue": "48c7571b34de2737fb0b8d4e1a395813a7b4a11c583a29f91fe394e3a1107041",
  // Same recent-activity rows; loading/error/retry now precede the true empty state.
  // The reviewed production delta also labels the P&L calculation as a platform baseline estimate.
  "wallet-nex.vue": "50f0cd137035f0f0bc3ee3eb69e6c033b1c2a7c45a671b2f0c8b07eab9c9c0d9",
  "wallet-repurchase-how.vue": "6e12626d38a041f066c2dd37a8f3bf5497746c83b5962a11f9c578308662662a",
  // Input and principal display preserve the command's six-decimal precision.
  // R3: unresolved intents retain their amount and expose an explicit recovery CTA.
  // Confirmed operations retain the form while a separate history-sync notice offers GET-only retry.
  // Formal G7 now exposes historical orders, claim/early actions and server-configured copy.
  "wallet-repurchase.vue": "6e3844e14cd7dd5505034f9452cf47cf427fb156aa7dc7076216fd0193fe7269",
  "wallet-topup.vue": "3b2340e7c531a1153f39940da24b755f92fb733172e137627140ba6d1d31f76f",
  "wallet-withdraw-tracking.vue": "66490f81614d168d2dcc518695e019f198fd24ab714b3fc21bab6b52605aafb1",
  // Per-transaction maximum, daily count capacity and channel availability remain distinct.
  "wallet-withdraw.vue": "21e60cec868dc64a1310fe2edde5c151ea5748815e50d0227b78da37022a5333",
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
    const files = readdirSync(formalMeDir).filter((name: string) => name.endsWith(".vue")).sort();
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
