import { defineStore } from "pinia";
import { ref } from "vue";
import { pickSponsor, type SponsorMeta } from "@/mock/sponsors";

// Ported from Nexion-prototype/lib/v3/sponsorship.ts (zustand → Pinia).
// Records the referral chain; claimGift() mints the one-time welcome reward.
export const WELCOME_GIFT_USDT = 5;
export const WELCOME_GIFT_NEX = 200;
const STORAGE_KEY = "nexion-sponsorship-v1";

interface Persisted {
  sponsorCode: string | null;
  sponsor: SponsorMeta | null;
  giftClaimed: boolean;
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
        boundAt: s.boundAt ?? null,
      };
    }
  } catch {
    // first run
  }
  return { sponsorCode: null, sponsor: null, giftClaimed: false, boundAt: null };
}

export const useSponsorship = defineStore("sponsorship", () => {
  const init = hydrate();
  const sponsorCode = ref<string | null>(init.sponsorCode);
  const sponsor = ref<SponsorMeta | null>(init.sponsor);
  const giftClaimed = ref<boolean>(init.giftClaimed);
  const boundAt = ref<number | null>(init.boundAt);

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, {
        sponsorCode: sponsorCode.value,
        sponsor: sponsor.value,
        giftClaimed: giftClaimed.value,
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

  function claimGift(): { usdt: number; nex: number } | null {
    if (giftClaimed.value) return null;
    if (!sponsorCode.value) return null;
    giftClaimed.value = true;
    persist();
    return { usdt: WELCOME_GIFT_USDT, nex: WELCOME_GIFT_NEX };
  }

  function reset() {
    sponsorCode.value = null;
    sponsor.value = null;
    giftClaimed.value = false;
    boundAt.value = null;
    persist();
  }

  return { sponsorCode, sponsor, giftClaimed, boundAt, bind, claimGift, reset };
});
