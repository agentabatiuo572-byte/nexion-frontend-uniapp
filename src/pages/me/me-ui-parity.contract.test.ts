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
  "language.vue",
  "me.vue",
  "notifications.vue",
  "preferences.vue",
  "profile.vue",
  "proof.vue",
  "receipts.vue",
  "rewards-list.vue",
  "rewards.vue",
  "risk-disclosure.vue",
  "security.vue",
  "support-tickets.vue",
  "support.vue",
  "trial.vue",
  "wallet-address-rebind.vue",
  "wallet-bills.vue",
  "wallet-cards-new.vue",
  "wallet-cards.vue",
  "wallet-exchange-how.vue",
  "wallet-exchange.vue",
  "wallet-nex.vue",
  "wallet-repurchase-how.vue",
  "wallet-repurchase.vue",
  "wallet-topup.vue",
  "wallet-withdraw-tracking.vue",
  "wallet-withdraw.vue",
  "wallet.vue"
];
// Pin the exact formal/reference template pair for every approved difference.
// A new edit inside an approved file therefore still fails until its specific
// production-only delta is reviewed; this is not a file-level exemption.
// Reviewed 710e9ee visual refresh with formal server and accessibility boundaries.
// Reviewed 710e9ee visual refresh with formal server and accessibility boundaries.
const EXPECTED_TEMPLATE_PAIR_SHA256: Record<string, string> = {
  "achievements.vue": "e7cfef2560a4a60747043f2a4d76b875a0faad0383b5cbcf1fb15deeab98e60f",
  "devices.vue": "7f3bf67d7f5c066943c992e8345d1fa25c2d2ff82c21473ff41712dd58d4fbba",
  "goals.vue": "43658431af1e6739fa4a269c4758f7a432b9e74dd33fa031f8fec5cb408e0a60",
  "help.vue": "3eeec6995d290e03d6a008b83f3a2ba8365f702b6c59d3acb306eab055437d7d",
  "language.vue": "147e4114cec9c44704a643c833d582e043565ee17240fe474622f656ae104da9",
  // Reviewed UI regression repair: bind the existing narrow-screen quick grid.
  "me.vue": "11d4a58ee3ea0e50c41eb3762c0f2093909867bf2d012d2eeff1670cd269d5c0",
  "notifications.vue": "68fb8d9ce340c265842e5a6798c74c162d20c7245a6599c52eab5cd9d3e89196",
  "preferences.vue": "5c7a712cb60a21c7e24cbbe85783ea66503f1298724d035f4c8520251fcea632",
  "profile.vue": "67bb87df27035ea1a2f8a374d3653b44d7c2623bc002ff054d412eb6fccc9e95",
  "proof.vue": "956e804b2c96dced42cc10cb0dd757e7abd5c4a6a3596c56bca63490e93f3616",
  "receipts.vue": "ee45b67eef9b7054af4c16b095d1adc9c5c1c48e979469f37dbc41f0f03c613f",
  "rewards-list.vue": "75c2e5fa485fda8e0bf6dbc742b3333f7b70cf3e2788dc5923edf50038bc1218",
  "rewards.vue": "2d899c2643e74a74e5ad4102a8d7c6b328d539cd5368dfe977fe1529c167a782",
  "risk-disclosure.vue": "5f1d1f52b62559b79785d91fd28fd9e4de6597cf91b9174a87191740c95ba2bf",
  "security.vue": "277a220c6aeb77b2c7316ee00dcb945a43d6e63ddb1891888958b19a7cf8e164",
  "support-tickets.vue": "832124bcf9eb5fae78f1bf3232c976563ae1f52334cac6c1ae111330e198d2c0",
  "support.vue": "9a89c364bbc52d36f0218752b5bb69ffbba692fd113feaf285e7d0273180bad0",
  "trial.vue": "9ba1ff2296064a5ccf0c750018c06c722853136431dc2f8e14ffa0ef7bd20d2e",
  "wallet-address-rebind.vue": "64f22ae20b3725ff6df6c516a9f99a6714efd94834cc5b02734c146e377e9e32",
  "wallet-bills.vue": "66562e30900e2169f5ff8bc8bbf6651293d8f33294663b7f90f3b97b249edf0f",
  "wallet-cards-new.vue": "6af630a5acf97669826202e3842042a8b28af8813f0657da0a6085336f7a3fc2",
  "wallet-cards.vue": "4ba7080a2d1b7c9ce4d56c4ea90b5fed3614c689aaeccaf3811d166f08391692",
  "wallet-exchange-how.vue": "53a85b180c00d4a33e73d101a628e8f786924b2e23c48f045147b9f15cb8b9b0",
  "wallet-exchange.vue": "f6e7c49b78de3c05e25da2648b73673ec654ab69330d416dda6042ef63fe8eb6",
  "wallet-nex.vue": "9a45bc613e2aaead9671fd5f33dd35655909afba01623a72cd1417daa6f38d98",
  "wallet-repurchase-how.vue": "238439b99d5b73f9cf7c6ad7b8479cb86f39ef92f93d216938b071c28372e4f0",
  "wallet-repurchase.vue": "19b1c868b06086a2384a8f3bba7f013dc026f2c1bf97a5ff886f3fed3a40adca",
  "wallet-topup.vue": "010252b7630c35defdf57a3f262d0e389c011d2b9d79ad2f5fb788e794d87768",
  "wallet-withdraw-tracking.vue": "7e295fb4b5e5bc50dcbfbbe136c6ede7bcab07ae9bb6193b666bf397acb60e9a",
  "wallet-withdraw.vue": "e3f41cf165b08b6a7813a6f1b180d3da96e5d786f1daa138e95fb4ba334ed10d",
  "wallet.vue": "95b9805fdebe39db2a8920a235436fca6b8d21e65101df5cb866a244122a6bd5"
};
const EXPECTED_STYLE_PAIR_SHA256: Record<string, string> = {
  "proof.vue": "c21851c57140a23d48746e19c798781a56bccc946028165e9f3f61323e6eb2bd",
  "wallet-repurchase.vue": "49b410e94f8d119d898b3c05f01d735af70aac979d6f8d8559341b13841d1477"
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
    expect(source).toContain("const conversationUnread = computed(() => conversations.totalUnread + (NOVA_SUPPORT_VISIBLE ? nova.unread : 0))");
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
      const formalStyle = block(formal, "style"), prototypeStyle = block(prototype, "style");
      if (EXPECTED_STYLE_PAIR_SHA256[name]) {
        expect(createHash("sha256").update(formalStyle).update("\0").update(prototypeStyle).digest("hex"), name).toBe(EXPECTED_STYLE_PAIR_SHA256[name]);
      } else expect(formalStyle, name).toBe(prototypeStyle);
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
