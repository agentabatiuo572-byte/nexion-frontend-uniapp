import { defineStore } from "pinia";
import { ref } from "vue";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";

// Ported from Nexion-prototype/lib/store/cards.ts (zustand → Pinia).
// Bank/credit card binding — saved-cards repository for the Card payment
// method in checkout. User binds a card once (via /me/wallet/cards/new), then
// reuses it across orders with just a CVV re-entry. The full PAN is NEVER
// stored — only last4 + brand + expiry + holder name, matching how PSPs
// (Stripe, Adyen) tokenize cards.
// MOCK-ONLY: real PSP returns a token id; here we generate a uuid as `tokenId`.
export type CardBrand = "visa" | "mastercard" | "amex" | "unionpay" | "unknown";

export interface SavedCard {
  /** Mock PSP token id — never the real PAN */
  tokenId: string;
  brand: CardBrand;
  /** Last 4 of PAN — for masked display `•••• 1234` */
  last4: string;
  /** "MM/YY" */
  expiry: string;
  /** Cardholder uppercase */
  holder: string;
  /** epoch ms of binding */
  boundAt: number;
}

// 旧设备级单键 "nexgrid-cards-v1" 废弃(存量无账号归属,mock 可重建);绑卡按账号分行。
const ACCOUNTS_KEY = "nexgrid-cards-accounts-v1"; // { [accountKey]: PersistShape }

function uuid(): string {
  if (typeof crypto !== "undefined" && (crypto as Crypto).randomUUID) {
    return (crypto as Crypto).randomUUID();
  }
  return `card_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** Brand detection from raw digits (Luhn-prefix heuristic, not exhaustive) */
export function detectBrand(digits: string): CardBrand {
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^62/.test(digits)) return "unionpay";
  return "unknown";
}

export function brandLabel(brand: CardBrand): string {
  switch (brand) {
    case "visa": return "Visa";
    case "mastercard": return "Mastercard";
    case "amex": return "American Express";
    case "unionpay": return "UnionPay";
    default: return "Card";
  }
}

interface PersistShape {
  cards: SavedCard[];
  defaultTokenId: string | null;
}

function hydrate(accountKey: string): PersistShape {
  const row = readAccountRow<Partial<PersistShape>>(ACCOUNTS_KEY, accountKey);
  if (row && Array.isArray(row.cards)) {
    return { cards: row.cards, defaultTokenId: row.defaultTokenId ?? null };
  }
  return { cards: [], defaultTokenId: null };
}

export const useCards = defineStore("cards", () => {
  // 账号维度。boot 期落 "default";账号确定后由 lib/account-scope 统一重绑(P-031 store 不互 import)。
  let boundKey = "default";
  const init = hydrate(boundKey);
  const cards = ref<SavedCard[]>(init.cards);
  const defaultTokenId = ref<string | null>(init.defaultTokenId);

  function persist() {
    writeAccountRow<PersistShape>(ACCOUNTS_KEY, boundKey, { cards: cards.value, defaultTokenId: defaultTokenId.value });
  }

  /** 账号切换重绑:装载该账号绑定的银行卡(P2-8 设备级泄漏修复;绑卡=金融凭证,必按账号)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    const next = hydrate(boundKey);
    cards.value = next.cards;
    defaultTokenId.value = next.defaultTokenId;
  }

  function add(input: Omit<SavedCard, "tokenId" | "boundAt">, opts: { makeDefault?: boolean } = {}): string {
    const tokenId = uuid();
    const card: SavedCard = { ...input, tokenId, boundAt: Date.now() };
    cards.value = [...cards.value, card];
    // First card auto-defaults unless the binding form explicitly opts out.
    if (opts.makeDefault === true || (defaultTokenId.value === null && opts.makeDefault !== false)) {
      defaultTokenId.value = tokenId;
    }
    persist();
    return tokenId;
  }

  function remove(tokenId: string) {
    const next = cards.value.filter((c) => c.tokenId !== tokenId);
    if (defaultTokenId.value === tokenId) {
      defaultTokenId.value = next[0]?.tokenId ?? null;
    }
    cards.value = next;
    persist();
  }

  function setDefault(tokenId: string) {
    if (cards.value.some((c) => c.tokenId === tokenId)) {
      defaultTokenId.value = tokenId;
      persist();
    }
  }

  function getCard(tokenId: string): SavedCard | null {
    return cards.value.find((c) => c.tokenId === tokenId) ?? null;
  }

  return { cards, defaultTokenId, add, remove, setDefault, getCard, bindAccount };
});
