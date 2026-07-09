import { defineStore } from "pinia";
import { ref } from "vue";
import { pickSponsor, type SponsorMeta } from "@/mock/sponsors";
import { normalizeAccountKey } from "@/store/account-cloud";
import { useConfig } from "@/store/config";

// Ported from Nexion-prototype/lib/v3/sponsorship.ts (zustand → Pinia).
// Records the referral chain; claimGift() mints the one-time welcome reward.
// 礼包金额从 platform config 读取(rewards.welcomeGift,运营可调),不再是本地常量。
// FEAT-SHARE01 [FEAT-SHARE4]: pendingCode = 落地页捕获的链接来源码(未注册前
// last-touch 覆盖;bind 成功即清),让中途溜走的访客晚点注册仍保归因。
const STORAGE_KEY = "nexion-sponsorship-v1";

// 邀请码 client 预检(服务端权威校验另行);大小写不敏感,统一大写。
export const REF_CODE_RE = /^NEXION-[A-Z0-9]{4}$/;

export function normalizeRefCode(raw: string | null | undefined): string | null {
  const v = (raw || "").trim().toUpperCase();
  return REF_CODE_RE.test(v) ? v : null;
}

interface Persisted {
  sponsorCode: string | null;
  sponsor: SponsorMeta | null;
  giftClaimed: boolean;
  giftClaimedByAccount?: Record<string, boolean>;
  boundAt: number | null;
  pendingCode?: string | null;
  pendingAt?: number | null;
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
        pendingCode: s.pendingCode ?? null,
        pendingAt: s.pendingAt ?? null,
      };
    }
  } catch {
    // first run
  }
  return { sponsorCode: null, sponsor: null, giftClaimed: false, giftClaimedByAccount: {}, boundAt: null, pendingCode: null, pendingAt: null };
}

export const useSponsorship = defineStore("sponsorship", () => {
  const init = hydrate();
  const sponsorCode = ref<string | null>(init.sponsorCode);
  const sponsor = ref<SponsorMeta | null>(init.sponsor);
  const giftClaimed = ref<boolean>(init.giftClaimed);
  const giftClaimedByAccount = ref<Record<string, boolean>>(init.giftClaimedByAccount ?? {});
  const boundAt = ref<number | null>(init.boundAt);
  const pendingCode = ref<string | null>(init.pendingCode ?? null);
  const pendingAt = ref<number | null>(init.pendingAt ?? null);

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, {
        sponsorCode: sponsorCode.value,
        sponsor: sponsor.value,
        giftClaimed: giftClaimed.value,
        giftClaimedByAccount: giftClaimedByAccount.value,
        boundAt: boundAt.value,
        pendingCode: pendingCode.value,
        pendingAt: pendingAt.value,
      });
    } catch {
      // storage unavailable
    }
  }

  // 落地页捕获链接来源码:合法才写;bound 终态后忽略;注册前 last-touch 覆盖。
  function capturePending(raw: string) {
    const v = normalizeRefCode(raw);
    if (!v) return;
    if (sponsorCode.value) return;
    pendingCode.value = v;
    pendingAt.value = Date.now();
    persist();
  }

  function clearPending() {
    if (pendingCode.value === null && pendingAt.value === null) return;
    pendingCode.value = null;
    pendingAt.value = null;
    persist();
  }

  // First sponsor wins — don't overwrite an existing binding.
  // 绑定发生即清 pending(注册/登录两路都汇到这里,单一清除点)。
  function bind(code: string) {
    const cleaned = code.trim();
    if (!cleaned) return;
    if (sponsorCode.value) return;
    sponsorCode.value = cleaned;
    sponsor.value = pickSponsor(cleaned);
    boundAt.value = Date.now();
    pendingCode.value = null;
    pendingAt.value = null;
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
    const gift = useConfig().config.rewards.welcomeGift;
    return { usdt: gift.usdtAmount, nex: gift.nexAmount };
  }

  function reset() {
    sponsorCode.value = null;
    sponsor.value = null;
    giftClaimed.value = false;
    giftClaimedByAccount.value = {};
    boundAt.value = null;
    pendingCode.value = null;
    pendingAt.value = null;
    persist();
  }

  return { sponsorCode, sponsor, giftClaimed, boundAt, pendingCode, capturePending, clearPending, bind, claimGift, reset };
});
