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
  "receipts.vue",
  // Formal App keeps the 5174 visual styles while adding production-only
  // accessibility, server-authority and fail-closed controls in these templates.
  "risk-disclosure.vue",
  "security.vue",
  "trial.vue",
  "wallet-address-rebind.vue",
  "wallet-bills.vue",
  "wallet-cards-new.vue",
  "wallet-cards.vue",
  "wallet-exchange-how.vue",
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
  "devices.vue": "e64a76a8f86553593c817bde899e84484fbb20a5f2f1b4c6349fdd458b505b93",
  "goals.vue": "7a9ab371a63179ec30aa5543e06d4e0e1eb10c897ac09df974c60b082d1e9dde",
  "help.vue": "3778085811bed95842e216e5d1a2d56cecaf1feb1e44e0b1773ddaa5c67ea671",
  "me.vue": "4c844c3c785073e568c38568d4bba897df86325bad2f677428b3588ba6d85aaf",
  "preferences.vue": "1d91c7ba3e5b24311070d04697018c02ad233ce4cca1d7926c0c4fad664efd1b",
  "profile.vue": "08bbb8611dfef4d895ea64766fb067e59cdba9fc8487089da91785bbbf0e696a",
  "receipts.vue": "b70aab7c11556baa0577c6ff2874ec0e883e17122a5bd2c4869dd96561c056af",
  "risk-disclosure.vue": "4fcb42f5d5245fe23b1269ac36de0eeba2b5a9e4e74a80ad219311b52013d64f",
  "security.vue": "d2ee24d1b0833bda99c89e316f49c223f867a3e419f979e27a630d5a7ca661aa",
  "trial.vue": "d1e97c05e19ad14071c3ff95fc8f54c234c23f949c5447c8f394f8730cd25e1a",
  "wallet-address-rebind.vue": "c5865a83b3fe7e15196a9b0e852100900e72b1d88125692469b84062d957a7be",
  "wallet-bills.vue": "9cc229e2d58c12036fb4f5730223e3360cc79c68e9dc59a49aca444afa97ece4",
  "wallet-cards-new.vue": "d0134756c231552e9068b064b664c5ef1cc7ee3242272f03d4ed1744f9696c97",
  "wallet-cards.vue": "3d1ab2de2b31a61e95bf2a388ba334b6d785a977421f7de75d9ab6e147171622",
  "wallet-exchange-how.vue": "cdcabf7a5eb516b3612fcd458984a8266d6038ae363150c8146120276a9273aa",
  "wallet-repurchase-how.vue": "6e12626d38a041f066c2dd37a8f3bf5497746c83b5962a11f9c578308662662a",
  "wallet-repurchase.vue": "db6d2885e48405029ca9ae45565166c57cf416406637b413b4e39e29e35852f3",
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
