import { defineStore } from "pinia";
import { ref } from "vue";
import { pickSponsor, type SponsorMeta } from "@/mock/sponsors";
import { normalizeAccountKey } from "@/store/account-cloud";

// Ported from Nexion-prototype/lib/v3/sponsorship.ts (zustand → Pinia).
// Records the referral chain; claimGift() mints the one-time welcome reward.
export const WELCOME_GIFT_USDT = 5;
// NEX 接管提现摩擦闸后,注册礼包 NEX 收紧(原 200 = 免费 $2000 提现额度,过松)。
export const WELCOME_GIFT_NEX = 20;
const STORAGE_KEY = "nexion-sponsorship-v1";

interface Persisted {
  sponsorCode: string | null;
  sponsor: SponsorMeta | null;
  giftClaimed: boolean;
  giftClaimedByAccount?: Record<string, boolean>;
  boundAt: number | null;
}

function hydrate(): Persisted {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as Persisted | "";
    if (s && typeof s === "object") {
      return {
        sponsorCode: s.sponsorCode ?? null,
        sponsor: s.sponsor ?? null,
        giftClaimed: !!s.giftClaimed,
        giftClaimedByAccount: s.giftClaimedByAccount ?? {},
        boundAt: s.boundAt ?? null,
      };
    }
  } catch {
    // first run
  }
  return { sponsorCode: null, sponsor: null, giftClaimed: false, giftClaimedByAccount: {}, boundAt: null };
}

export const useSponsorship = defineStore("sponsorship", () => {
  const init = hydrate();
  const sponsorCode = ref<string | null>(init.sponsorCode);
  const sponsor = ref<SponsorMeta | null>(init.sponsor);
  const giftClaimed = ref<boolean>(init.giftClaimed);
  const giftClaimedByAccount = ref<Record<string, boolean>>(init.giftClaimedByAccount ?? {});
  const boundAt = ref<number | null>(init.boundAt);

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, {
        sponsorCode: sponsorCode.value,
        sponsor: sponsor.value,
        giftClaimed: giftClaimed.value,
        giftClaimedByAccount: giftClaimedByAccount.value,
        boundAt: boundAt.value,
      });
    } catch {
      // storage unavailable
    }
  }

  // First sponsor wins — don't overwrite an existing binding.
  function bind(code: string) {
    const cleaned = code.trim();
    if (!cleaned) return;
    if (sponsorCode.value) return;
    sponsorCode.value = cleaned;
    sponsor.value = pickSponsor(cleaned);
    boundAt.value = Date.now();
    persist();
  }

  function claimGift(accountKey?: string): { usdt: number; nex: number } | null {
    const key = accountKey ? normalizeAccountKey(accountKey) : null;
    if (key && giftClaimedByAccount.value[key]) return null;
    if (!key && giftClaimed.value) return null;
    if (!sponsorCode.value) return null;
    if (key) giftClaimedByAccount.value = { ...giftClaimedByAccount.value, [key]: true };
    giftClaimed.value = true;
    persist();
    return { usdt: WELCOME_GIFT_USDT, nex: WELCOME_GIFT_NEX };
  }

  function reset() {
    sponsorCode.value = null;
    sponsor.value = null;
    giftClaimed.value = false;
    giftClaimedByAccount.value = {};
    boundAt.value = null;
    persist();
  }

  return { sponsorCode, sponsor, giftClaimed, boundAt, bind, claimGift, reset };
});
