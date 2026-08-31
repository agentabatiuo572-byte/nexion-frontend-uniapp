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
  "me.vue",
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
  "devices.vue": "23fea78987f10dfcdcabb8d6a176eda307e087fdbacb28678b8674a11d4bc716",
  // Disable editing and repeat activation while the same goal intent is saving.
  "goals.vue": "60440d2dd970a5e3ed9a4648fc83e272cb452e10a90f26e1dc0c4a02c3b33307",
  "help.vue": "3778085811bed95842e216e5d1a2d56cecaf1feb1e44e0b1773ddaa5c67ea671",
  "me.vue": "4c844c3c785073e568c38568d4bba897df86325bad2f677428b3588ba6d85aaf",
  // Translate the closed error category instead of showing protocol identifiers.
  "preferences.vue": "7542b5f017a2c86127c8009c659a74868b6b02793d689ad3dc1bc66b76053ba0",
  "profile.vue": "08bbb8611dfef4d895ea64766fb067e59cdba9fc8487089da91785bbbf0e696a",
  // R2-06: server facts take precedence over the Prototype's fabricated earnings curve.
  "proof.vue": "96d5320da341bc25337e4290b25dfdbcc12d2e84ff550b04d0ce6b680184d381",
  // Formal receipts keep the 5174 row layout but render server settlement
  // status and suppress positive amounts unless the receipt is CREDITED.
  // P3-13 additionally renders recoverable initial/pagination errors and a busy
  // load-more label; the successful receipt-row layout is unchanged.
  "receipts.vue": "f8bc3661a5ec95dbba6b6a2fe193d91b206dc13a4fb92c77f569b20df1fed1df",
  "rewards.vue": "9334402601bb42d5429ed5fd665da0e2fd093d4d1e1a659ad8339b2a0420dd3b",
  "risk-disclosure.vue": "4fcb42f5d5245fe23b1269ac36de0eeba2b5a9e4e74a80ad219311b52013d64f",
  "security.vue": "d2ee24d1b0833bda99c89e316f49c223f867a3e419f979e27a630d5a7ca661aa",
  "support-tickets.vue": "d8e7636778eccb869fb086231126505c5eddfd832a051f4612136ff5caa8bfe8",
  "support.vue": "6f1d1582608f17177bb3c902a2849db742f410da016e66dcf6e602cb7c43f714",
  "trial.vue": "d1e97c05e19ad14071c3ff95fc8f54c234c23f949c5447c8f394f8730cd25e1a",
  "wallet-address-rebind.vue": "c5865a83b3fe7e15196a9b0e852100900e72b1d88125692469b84062d957a7be",
  "wallet-bills.vue": "289a982f94511e9bee5917d67b735f720935f4b58ed41666e67c2429c8794033",
  "wallet-cards-new.vue": "d0134756c231552e9068b064b664c5ef1cc7ee3242272f03d4ed1744f9696c97",
  "wallet-cards.vue": "3d1ab2de2b31a61e95bf2a388ba334b6d785a977421f7de75d9ab6e147171622",
  "wallet-exchange-how.vue": "cdcabf7a5eb516b3612fcd458984a8266d6038ae363150c8146120276a9273aa",
  "wallet-exchange.vue": "56d32953f04a0c8ed538ed9caa55642867bcf0be02cd7892776dcc34bfc3a3a5",
  // Same recent-activity rows; loading/error/retry now precede the true empty state.
  // The reviewed production delta also labels the P&L calculation as a platform baseline estimate.
  "wallet-nex.vue": "e3cb6933ab8f85a035f63e68f6e74de3ed10e0143d20713881ced423ae753a87",
  "wallet-repurchase-how.vue": "6e12626d38a041f066c2dd37a8f3bf5497746c83b5962a11f9c578308662662a",
  // Input and principal display preserve the command's six-decimal precision.
  "wallet-repurchase.vue": "5f5835e141a1c8d20b6c8f42cebaee7a5f3ecba4dcdbd369a1f19e88200df48c",
  "wallet-topup.vue": "3b2340e7c531a1153f39940da24b755f92fb733172e137627140ba6d1d31f76f",
  "wallet-withdraw-tracking.vue": "66490f81614d168d2dcc518695e019f198fd24ab714b3fc21bab6b52605aafb1",
  "wallet-withdraw.vue": "7e7767300871771fdbd248bcbbb36b965c4165288c2b1c33dc447329a0514cf2",
  "wallet.vue": "ef089d14a5ffe0cec0dc7663b78b867b62f822fc3acc50e9d57a075dccc657cf",
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
