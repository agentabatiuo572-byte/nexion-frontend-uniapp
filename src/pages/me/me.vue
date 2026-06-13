<!--
  Me — ported from Nexion-prototype/app/(main)/me/page.tsx (13 sections).
  Top→bottom: ProfileRow → WalletCard → WithdrawalLockedWarning (if balance < $20)
  → TrialEntry (hero, if eligible) → NetworkCard → MyDevicesEntry → TrialEntry
  (active row, if trial running) → GenesisNodeCard (if purchased a box) →
  OrdersCard (if any orders) → 4 settings sections (Earn extras / Account /
  Preferences / Help) → Sign out → version footer.

  Wrapped in <AppChassis active="me">; entrance via <CardStagger>.

  Secondary settings-row display values are wired to the live ported stores
  (security 2FA / achievements count / notifications unread / receipts / orders /
  points), matching the source. KYC state is driven by the wallet-pairing store.
  Some settings targets are not-yet-ported pages → nav fail:()=>{}.

  Settings-row value formatting matches the source: mono-tabular accent text.
-->
<template>
  <AppChassis active="me">
    <CardStagger class="px-4 pt-3 pb-4 space-y-3" style="color: var(--v5-ink)">
      <ProfileRow />

      <WalletCard />

      <WithdrawalLockedWarning v-if="showWithdrawalLocked" :balance="usdtBalance" />

      <!-- Hero slot — zero-cost trial activation right after wallet -->
      <TrialEntry v-if="trialIsHero" />

      <NetworkCard />

      <MyDevicesEntry />

      <!-- Active-state row once trial is running -->
      <TrialEntry v-if="trialIsActive" />

      <GenesisNodeCard v-if="hasPurchasedBox" />

      <OrdersCard v-if="orderCount > 0" />

      <!-- ───── Earn extras ───── -->
      <SectionHeader :title="t.me.secEarnExtras" />
      <SettingsCard>
        <SettingRow href="/pages/missions/missions" :label="t.me.missionsRow">
          <template #icon><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg></template>
          <template #value><text class="font-mono-tabular" style="color: var(--v5-brand)">{{ t.me.missionsValue }}</text></template>
        </SettingRow>
        <SettingRow href="/pages/daily/daily" :label="t.me.dailyCheckin">
          <template #icon><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg></template>
          <template #value><text class="font-mono-tabular" style="color: var(--v5-brand-2)">{{ pointsBalance }} {{ t.me.pts }}</text></template>
        </SettingRow>
        <SettingRow href="/pages/events/events" :label="t.me.eventsCenter">
          <template #icon><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg></template>
          <template #value><text class="font-mono-tabular" style="color: var(--v5-brand-2)">{{ eventsLiveLabel }}</text></template>
        </SettingRow>
        <SettingRow href="/pages/learn/learn" :label="t.me.learnRow">
          <template #icon><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg></template>
          <template #value><text class="font-mono-tabular" style="color: var(--v5-brand)">{{ t.me.earnNex }}</text></template>
        </SettingRow>
        <SettingRow href="/pages/staking/staking" :label="t.me.stakingVault">
          <template #icon><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg></template>
          <template #value><text class="font-mono-tabular">{{ t.me.upTo180 }}</text></template>
        </SettingRow>
        <!-- My Genesis Node — always present so it's discoverable (→ /genesis/holder,
             which shows holdings for owners / a learn-more state for non-owners).
             The node-count value only renders once the user actually owns one. -->
        <SettingRow href="/pages/genesis/holder" :label="t.me.myGenesisNode">
          <template #icon><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" /></svg></template>
          <template #value><text v-if="ownsGenesis" class="font-mono-tabular" style="color: var(--v5-warning)">{{ myGenesisValue }}</text></template>
        </SettingRow>
        <SettingRow href="/pages/me/achievements" :label="t.me.achievements">
          <template #icon><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg></template>
          <template #value><text class="font-mono-tabular tabular-nums" style="color: var(--v5-brand)">{{ achievementsValue }}</text></template>
        </SettingRow>
        <SettingRow href="/pages/me/goals" :label="t.me.goalsRow">
          <template #icon><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg></template>
          <template #value><text class="font-mono-tabular" style="color: var(--v5-brand-2)">{{ t.me.setTarget }}</text></template>
        </SettingRow>
        <SettingRow href="/pages/me/wrapped" :label="t.me.wrappedRow" last>
          <template #icon><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.287 1.288L3 12l5.8 1.9a2 2 0 0 1 1.288 1.287L12 21l1.9-5.8a2 2 0 0 1 1.287-1.288L21 12l-5.8-1.9a2 2 0 0 1-1.288-1.287z" /></svg></template>
          <template #value><text class="font-mono-tabular" style="color: var(--v5-brand)">2026</text></template>
        </SettingRow>
      </SettingsCard>

      <!-- ───── Account ───── -->
      <SectionHeader :title="t.me.secAccount" />
      <SettingsCard>
        <SettingRow href="/pages/me/profile" :label="t.me.profile" :value="profileName" />
        <SettingRow href="/pages/me/security" :label="t.me.identityKyc">
          <template #icon><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg></template>
          <template #value>
            <text v-if="kycVerified" class="font-mono-tabular" style="color: var(--v5-success)">{{ t.me.kycVerified }}</text>
            <text v-else class="font-mono-tabular" style="color: var(--v5-brand-2)">{{ t.me.kycPending }}</text>
          </template>
        </SettingRow>
        <SettingRow href="/pages/me/security" :label="t.me.security" :value="twoFactorEnabled ? t.me.secWithPasskey : t.me.secNoTwoFa" :value-tint="twoFactorEnabled ? undefined : 'var(--v5-brand-2)'">
          <template #icon>
            <svg v-if="twoFactorEnabled" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
            <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
          </template>
        </SettingRow>
        <SettingRow href="/pages/me/notifications" :label="t.me.notifications">
          <template #icon><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0" /><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" /></svg></template>
          <template #value>
            <text v-if="unreadNotifs > 0" class="font-mono-tabular tabular-nums" :style="notifBadgeStyle">{{ unreadNotifs }}</text>
          </template>
        </SettingRow>
        <SettingRow href="/pages/me/receipts" :label="t.me.receiptsRow" :value="String(receiptCount)" />
        <SettingRow href="/pages/me/risk-disclosure" :label="t.me.riskRow">
          <template #icon><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg></template>
        </SettingRow>
        <SettingRow href="/pages/trust/trust" :label="t.me.trustCenter" :value="t.me.auditsPartners" last>
          <template #icon><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg></template>
        </SettingRow>
      </SettingsCard>

      <!-- ───── Preferences ───── -->
      <SectionHeader :title="t.me.secPreferences" />
      <SettingsCard>
        <SettingRow href="/pages/me/preferences" :label="t.me.preferencesRow">
          <template #icon><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" /><path d="M16 9a5 5 0 0 1 0 6" /><path d="M19.364 18.364a9 9 0 0 0 0-12.728" /></svg></template>
        </SettingRow>
        <ThemeRow />
        <SettingRow href="/pages/me/language" :label="t.me.languageRow" :value="localeUpper" last>
          <template #icon><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg></template>
        </SettingRow>
      </SettingsCard>

      <!-- ───── Help & Support ───── -->
      <SectionHeader :title="t.me.secHelp" />
      <SettingsCard>
        <SettingRow href="/pages/me/replay-tour" :label="t.me.replayTour">
          <template #icon><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg></template>
        </SettingRow>
        <SettingRow href="/pages/me/help" :label="t.me.helpFaq">
          <template #icon><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg></template>
        </SettingRow>
        <SettingRow href="/pages/me/support" :label="t.me.liveSupportRow">
          <template #icon><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg></template>
          <template #value><text class="font-mono-tabular" style="color: var(--v5-success)">{{ t.me.onlineChip }}</text></template>
        </SettingRow>
        <SettingRow href="/pages/developer/developer" :label="t.me.developer" last>
          <template #icon><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" /></svg></template>
        </SettingRow>
      </SettingsCard>

      <!-- Sign out -->
      <view class="w-full inline-flex items-center justify-center active:opacity-90" :style="signOutStyle" @click="handleSignOut">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
        <text style="margin-left: 6px">{{ t.me.signOut }}</text>
      </view>

      <text class="block text-center font-mono-tabular" style="margin-top: 16px; font-size: 11px; color: var(--v5-ink-4)">Nexion · v3.2.0 · build 6824</text>
    </CardStagger>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import CardStagger from "@/components/card-stagger.vue";
import SectionHeader from "@/components/me/section-header.vue";
import ProfileRow from "@/components/me/profile-row.vue";
import WalletCard from "@/components/me/wallet-card.vue";
import WithdrawalLockedWarning from "@/components/me/withdrawal-locked-warning.vue";
import TrialEntry from "@/components/me/trial-entry.vue";
import NetworkCard from "@/components/me/network-card.vue";
import MyDevicesEntry from "@/components/me/my-devices-entry.vue";
import GenesisNodeCard from "@/components/me/genesis-node-card.vue";
import OrdersCard from "@/components/me/orders-card.vue";
import SettingsCard from "@/components/me/settings-card.vue";
import SettingRow from "@/components/me/setting-row.vue";
import ThemeRow from "@/components/me/theme-row.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import { useProfile } from "@/store/profile";
import { useReceipts } from "@/store/receipts";
import { useOrders } from "@/store/orders";
import { useLocaleStore } from "@/store/locale";
import { useWalletPairing } from "@/store/wallet-pairing";
import { usePoints } from "@/store/points";
import { useFreeTrial } from "@/store/free-trial";
import { useSecurity } from "@/store/security";
import { useNotifications } from "@/store/notifications";
import { useGenesis } from "@/store/genesis";
import { useAchievements } from "@/store/achievements";
import { ACHIEVEMENTS } from "@/mock/achievements";
import { confirm as uiConfirm } from "@/store/ui";

const MIN_WITHDRAWAL_USD = 20;

const t = useT();
const app = useApp();
const auth = useAuth();
const profile = useProfile();
const receipts = useReceipts();
const orders = useOrders();
const locale = useLocaleStore();
const pairing = useWalletPairing();
const points = usePoints();
const trial = useFreeTrial();
const security = useSecurity();
const notifications = useNotifications();
const achievements = useAchievements();

const usdtBalance = computed(() => app.user.usdtBalance);
const showWithdrawalLocked = computed(() => usdtBalance.value < MIN_WITHDRAWAL_USD);
const profileName = computed(() => profile.displayName);
const kycVerified = computed(() => pairing.walletPaired);
const receiptCount = computed(() => receipts.receipts.length);
const orderCount = computed(() => orders.orders.length);
const pointsBalance = computed(() => points.points);
const localeUpper = computed(() => locale.code.toUpperCase());

// Trial routing — hero slot (eligible to start) vs active row (running).
const trialStatus = computed(() => trial.status);
const trialIsActive = computed(
  () =>
    trialStatus.value === "active" ||
    trialStatus.value === "grace" ||
    trialStatus.value === "extended",
);
const trialIsHero = computed(() => !trialIsActive.value && trial.canStart());

// Genesis promo card only surfaces to users with a purchased box (phone +
// cloud-share don't count).
const hasPurchasedBox = computed(() =>
  app.devices.some((d) => d.kind !== "phone" && d.kind !== "cloud-share"),
);
// "我的创世节点" row surfaces once the user actually owns a Genesis node →
// links to the holder (holdings/dividends) page.
const genesis = useGenesis();
const ownsGenesis = computed(() => genesis.myOwned > 0);
const myGenesisValue = computed(() => fmt(t.value.me.myGenesisNodeValue, { n: String(genesis.myOwned) }));

// ── Secondary display values, wired to the live ported stores (matches source) ──
const twoFactorEnabled = computed(() => security.twoFactorEnabled);
const unreadNotifs = computed(() => notifications.unread);
const achievementsUnlocked = computed(
  () => achievements.records.filter((r) => r.unlockedAt > 0).length,
);
const achievementsTotal = ACHIEVEMENTS.length;
const achievementsValue = computed(() =>
  fmt(t.value.me.achievementsRowValue, { n: achievementsUnlocked.value, total: achievementsTotal }),
);
// Mock urgency — source hardcodes 9 live events (server-driven in the full app).
const eventsLiveLabel = computed(() => fmt(t.value.me.nLive, { n: "9" }));

async function handleSignOut() {
  const ok = await uiConfirm({
    title: t.value.me.signOutConfirmTitle,
    message: t.value.me.signOutConfirmMsg,
    danger: true,
    icon: "warn",
    confirmLabel: t.value.me.signOutConfirmLabel,
  });
  if (ok) {
    auth.signOut();
    uni.reLaunch({ url: "/pages/login/login", fail: () => {} });
  }
}

const notifBadgeStyle: CSSProperties = {
  background: "var(--v5-brand-2)",
  color: "var(--v5-on-brand-2)",
  padding: "1px 6px",
  borderRadius: "999px",
  fontSize: "10px",
  fontWeight: 600,
};
const signOutStyle: CSSProperties = {
  gap: "6px",
  marginTop: "6px",
  height: "44px",
  padding: "0 18px",
  background: "var(--v5-surface)",
  border: "1px solid color-mix(in srgb, var(--v5-danger) 25%, transparent)",
  color: "var(--v5-danger)",
  borderRadius: "12px",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "14px",
  letterSpacing: "-0.005em",
};
</script>
