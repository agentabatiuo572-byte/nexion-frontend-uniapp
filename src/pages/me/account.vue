<template>
  <AppChassis active="me">
    <view class="pb-6" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/me" :title="t.me.secAccount" />

      <view class="mx-4" :style="accountListStyle">
        <view
          v-for="item in accountEntries"
          :key="item.key"
          class="flex items-center active:opacity-80"
          :style="accountRowStyle"
          @click="goAccount(item)"
        >
          <view class="grid place-items-center shrink-0" :style="accountIconStyle(item.tone)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path v-for="path in accountIconPaths[item.icon]" :key="path" :d="path" />
            </svg>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block truncate" :style="accountLabelStyle">{{ item.label }}</text>
            <text v-if="item.meta" class="block truncate" :style="accountMetaStyle(item.tone)">{{ item.meta }}</text>
          </view>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { navTo } from "@/lib/route";
import { useProfile } from "@/store/profile";
import { useReceipts } from "@/store/receipts";
import { useSecurity } from "@/store/security";
import { useWalletPairing } from "@/store/wallet-pairing";

const t = useT();
const profile = useProfile();
const pairing = useWalletPairing();
const receipts = useReceipts();
const security = useSecurity();

const displayName = computed(() => profile.displayName);
const kycVerified = computed(() => pairing.walletPaired);
const receiptCount = computed(() => receipts.receipts.length);
const twoFactorEnabled = computed(() => security.twoFactorEnabled);

const accountIconPaths = {
  user: ["M20 21a8 8 0 1 0-16 0", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8"],
  shield: ["M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z", "m9 12 2 2 4-4"],
  lock: ["M7 11V7a5 5 0 0 1 10 0v4", "M5 11h14v10H5z"],
  receipt: ["M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2z", "M8 7h8", "M8 12h8", "M8 17h5"],
  card: ["M2 7h20v10H2z", "M2 11h20", "M6 15h4"],
  warning: ["M12 9v4", "M12 17h.01", "m10.3 4.3-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-2.7l-8-14a2 2 0 0 0-3.4 0z"],
  trust: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10", "m9 12 2 2 4-4"],
} as const;
type AccountIcon = keyof typeof accountIconPaths;
type AccountTone = "brand" | "orange" | "success" | "warning" | "muted";
interface AccountEntry {
  key: string;
  label: string;
  href: string;
  icon: AccountIcon;
  meta?: string;
  tone: AccountTone;
}

const accountEntries = computed<AccountEntry[]>(() => [
  { key: "profile", label: t.value.me.profile, href: "/me/profile", icon: "user", meta: displayName.value, tone: "muted" },
  { key: "kyc", label: t.value.me.identityKyc, href: "/me/security", icon: "shield", meta: kycVerified.value ? t.value.me.kycVerified : t.value.me.kycPending, tone: kycVerified.value ? "success" : "orange" },
  { key: "security", label: t.value.me.security, href: "/me/security", icon: "lock", meta: twoFactorEnabled.value ? t.value.me.secWithPasskey : t.value.me.secNoTwoFa, tone: twoFactorEnabled.value ? "muted" : "orange" },
  { key: "receipts", label: t.value.me.receiptsRow, href: "/me/receipts", icon: "receipt", meta: String(receiptCount.value), tone: "brand" },
  { key: "cards", label: t.value.me.walletCardsRow, href: "/me/wallet-cards", icon: "card", meta: t.value.me.walletCardsMeta, tone: "muted" },
  { key: "risk", label: t.value.me.riskRow, href: "/me/risk-disclosure", icon: "warning", tone: "orange" },
  { key: "trust", label: t.value.me.trustCenter, href: "/trust", icon: "trust", meta: t.value.me.auditsPartners, tone: "success" },
]);

function goAccount(item: AccountEntry) {
  navTo(item.href);
}

function accountToneColor(tone: AccountTone): string {
  switch (tone) {
    case "brand":
      return "var(--v5-brand)";
    case "orange":
      return "var(--v5-brand-2)";
    case "success":
      return "var(--v5-success)";
    case "warning":
      return "var(--v5-warning)";
    default:
      return "var(--v5-ink-2)";
  }
}

const accountListStyle: CSSProperties = {
  marginTop: "8px",
  background: "var(--v5-surface-bg)",
  borderRadius: "16px",
  padding: "8px 10px",
};
const accountRowStyle: CSSProperties = {
  minHeight: "56px",
  gap: "12px",
  padding: "8px 6px",
  borderRadius: "14px",
};
function accountIconStyle(tone: AccountTone): CSSProperties {
  const color = accountToneColor(tone);
  return {
    width: "40px",
    height: "40px",
    borderRadius: "13px",
    background: `color-mix(in srgb, ${color} 14%, transparent)`,
    color,
  };
}
const accountLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 500,
  color: "var(--v5-ink)",
};
function accountMetaStyle(tone: AccountTone): CSSProperties {
  return {
    marginTop: "2px",
    fontFamily: "var(--font-v5)",
    fontSize: "12px",
    color: accountToneColor(tone),
  };
}
</script>
