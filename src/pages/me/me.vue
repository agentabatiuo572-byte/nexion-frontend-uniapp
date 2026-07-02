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
      <MenuGridCard :items="earnMenuItems" @select="handleMenuSelect" />

      <!-- ───── Account ───── -->
      <SectionHeader :title="t.me.secAccount" />
      <MenuGridCard :items="accountMenuItems" @select="handleMenuSelect" />

      <!-- ───── Preferences ───── -->
      <SectionHeader :title="t.me.secPreferences" />
      <MenuGridCard :items="preferenceMenuItems" @select="handleMenuSelect" />

      <!-- ───── Help & Support ───── -->
      <SectionHeader :title="t.me.secHelp" />
      <MenuGridCard :items="helpMenuItems" @select="handleMenuSelect" />

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
import MenuGridCard from "@/components/me/menu-grid-card.vue";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import { useSession } from "@/store/session";
import { useOrders } from "@/store/orders";
import { useFreeTrial } from "@/store/free-trial";
import { useTheme } from "@/store/theme";
import { confirm as uiConfirm } from "@/store/ui";

type MeMenuItem = {
  id: string;
  label: string;
  href?: string;
  icon: string;
  tone: "brand" | "orange" | "success" | "neutral" | "warning";
};

const MIN_WITHDRAWAL_USD = 20;

const t = useT();
const app = useApp();
const auth = useAuth();
const session = useSession();
const orders = useOrders();
const trial = useFreeTrial();
const theme = useTheme();

const usdtBalance = computed(() => app.user.usdtBalance);
const showWithdrawalLocked = computed(() => usdtBalance.value < MIN_WITHDRAWAL_USD);
const orderCount = computed(() => orders.orders.length);

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

const earnMenuItems = computed<MeMenuItem[]>(() => [
  { id: "missions", label: t.value.me.missionsShort, href: "/pages/missions/missions", icon: "trophy", tone: "brand" },
  { id: "daily", label: t.value.me.dailyShort, href: "/pages/daily/daily", icon: "flame", tone: "orange" },
  { id: "events", label: t.value.me.eventsShort, href: "/pages/events/events", icon: "trophy-star", tone: "orange" },
  { id: "learn", label: t.value.me.learnShort, href: "/pages/learn/learn", icon: "book", tone: "neutral" },
  { id: "staking", label: t.value.me.stakingShort, href: "/pages/staking/staking", icon: "vault", tone: "success" },
  { id: "genesis", label: t.value.me.genesisShort, href: "/pages/genesis/holder", icon: "crown", tone: "warning" },
  { id: "achievements", label: t.value.me.achievementsShort, href: "/pages/me/achievements", icon: "trophy-star", tone: "brand" },
  { id: "rewards", label: t.value.me.rewardsShort, href: "/pages/me/rewards", icon: "gift", tone: "brand" },
  { id: "goals", label: t.value.me.goalsShort, href: "/pages/me/goals", icon: "target", tone: "orange" },
  { id: "wrapped", label: t.value.me.wrappedShort, href: "/pages/me/wrapped", icon: "sparkle", tone: "brand" },
]);

const accountMenuItems = computed<MeMenuItem[]>(() => [
  { id: "profile", label: t.value.me.profileShort, href: "/pages/me/profile", icon: "user", tone: "neutral" },
  { id: "kyc", label: t.value.me.kycShort, href: "/pages/me/security", icon: "shield", tone: "success" },
  { id: "security", label: t.value.me.securityShort, href: "/pages/me/security", icon: "key", tone: "orange" },
  { id: "notifications", label: t.value.me.notificationsShort, href: "/pages/me/notifications", icon: "bell", tone: "brand" },
  { id: "receipts", label: t.value.me.receiptsShort, href: "/pages/me/receipts", icon: "receipt", tone: "neutral" },
  { id: "risk", label: t.value.me.riskShort, href: "/pages/me/risk-disclosure", icon: "warning", tone: "orange" },
  { id: "trust", label: t.value.me.trustShort, href: "/pages/trust/trust", icon: "shield", tone: "neutral" },
]);

const preferenceMenuItems = computed<MeMenuItem[]>(() => [
  { id: "preferences", label: t.value.me.preferencesShort, href: "/pages/me/preferences", icon: "sliders", tone: "neutral" },
  { id: "theme", label: t.value.me.themeShort, icon: theme.mode === "dark" ? "moon" : "sun", tone: "brand" },
  { id: "language", label: t.value.me.languageShort, href: "/pages/me/language", icon: "globe", tone: "neutral" },
]);

const helpMenuItems = computed<MeMenuItem[]>(() => [
  { id: "replay", label: t.value.me.replayShort, href: "/pages/me/replay-tour", icon: "replay", tone: "neutral" },
  { id: "help", label: t.value.me.helpShort, href: "/pages/me/help", icon: "help", tone: "neutral" },
  { id: "support", label: t.value.me.supportShort, href: "/pages/me/support", icon: "chat", tone: "success" },
  { id: "developer", label: t.value.me.developerShort, href: "/pages/developer/developer", icon: "code", tone: "neutral" },
]);

function handleMenuSelect(item: MeMenuItem) {
  if (item.id === "theme") theme.toggle();
}

async function handleSignOut() {
  const ok = await uiConfirm({
    title: t.value.me.signOutConfirmTitle,
    message: t.value.me.signOutConfirmMsg,
    danger: true,
    icon: "warn",
    confirmLabel: t.value.me.signOutConfirmLabel,
  });
  if (ok) {
    // Self sign-out: void in-flight tasks (rollback) + release the shared
    // session record (other tabs see "logged-out") before clearing auth.
    app.interruptAllTasks("logged-out");
    session.signOutSession();
    auth.signOut();
    uni.reLaunch({ url: "/pages/login/login", fail: () => {} });
  }
}

const signOutStyle: CSSProperties = {
  gap: "6px",
  marginTop: "6px",
  height: "44px",
  padding: "0 18px",
  background: "var(--v5-surface-bg)",
  border: "1px solid color-mix(in srgb, var(--v5-danger) 25%, transparent)",
  color: "var(--v5-danger)",
  borderRadius: "12px",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "14px",
  letterSpacing: "-0.005em",
};
</script>
