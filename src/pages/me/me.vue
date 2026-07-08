<!--
  Me — ported from Nexion-prototype/app/(main)/me/page.tsx (13 sections).
  Top→bottom: ProfileRow → WalletCard → WithdrawalLockedWarning (if balance < $20)
  → OKX-style quick sections (earn extras / OrdersCard if any orders /
  preferences / help) → Sign out → version footer.

  Wrapped in <AppChassis active="me">; entrance via <CardStagger>.

  Secondary settings-row display values are wired to the live ported stores
  (achievements count / receipts / orders / points), matching the source.
  Some settings targets are not-yet-ported pages → nav fail:()=>{}.

  Settings-row value formatting matches the source: mono-tabular accent text.
-->
<template>
  <AppChassis active="me">
    <CardStagger class="px-4 pt-2 pb-4 space-y-3" style="color: var(--v5-ink)">
      <ProfileRow />

      <WalletCard />

      <WithdrawalLockedWarning v-if="showWithdrawalLocked" :balance="usdtBalance" />

      <view v-for="section in quickSections" :key="section.key">
        <SectionHeader :title="section.title" :count="section.count" />
        <view v-if="section.layout === 'list'" :style="quickListCardStyle">
          <view
            v-for="(item, index) in section.items"
            :key="item.key"
            class="active:opacity-80"
            :style="quickListRowStyle(index === section.items.length - 1)"
            @click="goQuick(item)"
          >
            <view :style="quickListIconStyle(item.tone)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" :stroke-width="item.strokeWidth ?? 2" stroke-linecap="round" stroke-linejoin="round">
                <path v-for="path in iconPaths[item.icon]" :key="path" :d="path" />
              </svg>
              <text v-if="item.badge" :style="quickBadgeStyle">{{ item.badge }}</text>
            </view>
            <text class="flex-1 truncate" :style="quickListLabelStyle">{{ item.label }}</text>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="quickListChevronStyle()">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </view>
        </view>
        <view v-else :style="quickGridCardStyle">
          <view :style="quickGridStyle">
            <view
              v-for="item in section.items"
              :key="item.key"
              class="active:opacity-80"
              :style="quickItemStyle"
              @click="goQuick(item)"
            >
              <view :style="quickIconStyle(item.tone)">
                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" :stroke-width="item.strokeWidth ?? 2" stroke-linecap="round" stroke-linejoin="round">
                  <path v-for="path in iconPaths[item.icon]" :key="path" :d="path" />
                </svg>
                <text v-if="item.badge" :style="quickBadgeStyle">{{ item.badge }}</text>
              </view>
              <text :style="quickLabelStyle">{{ item.label }}</text>
            </view>
          </view>
        </view>
        <OrdersCard v-if="section.key === 'earn-extras' && orderCount > 0" />
      </view>

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
import OrdersCard from "@/components/me/orders-card.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { navTo } from "@/lib/route";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import { useSession } from "@/store/session";
import { useOrders } from "@/store/orders";
import { useLocaleStore } from "@/store/locale";
import { useNexFaucet } from "@/store/nex-faucet";
import { useGenesis } from "@/store/genesis";
import { useAchievements } from "@/store/achievements";
import { useTheme } from "@/store/theme";
import { ACHIEVEMENTS } from "@/mock/achievements";
import { confirm as uiConfirm } from "@/store/ui";

const MIN_WITHDRAWAL_USD = 20;

const t = useT();
const app = useApp();
const auth = useAuth();
const session = useSession();
const orders = useOrders();
const locale = useLocaleStore();
const faucet = useNexFaucet();
const achievements = useAchievements();
const theme = useTheme();

const iconPaths = {
  network: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 7a4 4 0 1 0 0 .01", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  rank: ["m12 3 2.6 5.3 5.9.9-4.3 4.2 1 5.9L12 16.7l-5.2 3.2 1-5.9-4.3-4.2 5.9-.9z"],
  invite: ["M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7", "M16 6l-4-4-4 4", "M12 2v14"],
  commission: ["M12 2v20", "M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"],
  device: ["M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2", "M12 18h.01"],
  plus: ["M12 5v14", "M5 12h14"],
  slots: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M4 14h6v6H4z", "M14 14h6v6h-6z"],
  target: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20", "M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12", "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4"],
  trophy: ["M6 9H4.5a2.5 2.5 0 0 1 0-5H6", "M18 9h1.5a2.5 2.5 0 0 0 0-5H18", "M4 22h16", "M10 14.7V17c0 .55-.47.98-.97 1.2A4 4 0 0 0 7 22", "M14 14.7V17c0 .55.47.98.97 1.2A4 4 0 0 1 17 22", "M18 2H6v7a6 6 0 0 0 12 0z"],
  checkIn: ["M16 2v4M8 2v4m13 10v-4c0-3.771 0-5.657-1.172-6.828S16.771 4 13 4h-2C7.229 4 5.343 4 4.172 5.172S3 8.229 3 12v2c0 3.771 0 5.657 1.172 6.828S7.229 22 11 22h1M3 10h18", "M21 19.5h-6.5m2 2.5c-.506-.491-2.5-1.8-2.5-2.5s1.994-2.009 2.5-2.5"],
  book: ["M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20", "M8 11h8", "M8 7h6"],
  lock: ["M7 11V7a5 5 0 0 1 10 0v4", "M5 11h14v10H5z"],
  crown: ["M2 6l5 4 5-7 5 7 5-4-3 13H5z", "M5 22h14"],
  gift: ["M20 12v10H4V12", "M2 7h20v5H2z", "M12 22V7", "M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z", "M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"],
  sparkle: ["m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"],
  user: ["M20 21a8 8 0 1 0-16 0", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8"],
  shield: ["M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z", "m9 12 2 2 4-4"],
  bell: ["M10.3 21a2 2 0 0 0 3.4 0", "M4 17h16", "M18 8A6 6 0 0 0 6 8c0 4.5-1.4 6-2.7 7.3A1 1 0 0 0 4 17h16a1 1 0 0 0 .7-1.7C19.4 14 18 12.5 18 8"],
  receipt: ["M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2z", "M8 7h8", "M8 12h8", "M8 17h5"],
  warning: ["M12 9v4", "M12 17h.01", "m10.3 4.3-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-2.7l-8-14a2 2 0 0 0-3.4 0z"],
  trust: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10", "m9 12 2 2 4-4"],
  sliders: ["M4 21v-7", "M4 10V3", "M12 21v-9", "M12 8V3", "M20 21v-5", "M20 12V3", "M2 14h4", "M10 8h4", "M18 16h4"],
  moon: ["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"],
  globe: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20", "M2 12h20", "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"],
  rewind: ["M3 12a9 9 0 1 0 9-9 9.8 9.8 0 0 0-6.7 2.7L3 8", "M3 3v5h5"],
  help: ["M9.1 9a3 3 0 1 1 5.8 1c0 2-3 3-3 3", "M12 17h.01", "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20"],
  chat: ["M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"],
  code: ["m16 18 6-6-6-6", "m8 6-6 6 6 6"],
  ticket: ["M2 9a3 3 0 0 0 0 6v3h20v-3a3 3 0 0 0 0-6V6H2z", "M9 9h6", "M9 15h6"],
  messages: ["M4 4h16v11H7l-3 3z", "M8 8h8", "M8 11h5"],
  card: ["M2 7h20v10H2z", "M2 11h20", "M6 15h4"],
} as const;

type QuickIcon = keyof typeof iconPaths;
type QuickTone = "brand" | "purple" | "orange" | "success" | "warning" | "muted" | "danger";

interface QuickItem {
  key: string;
  label: string;
  href?: string;
  icon: QuickIcon;
  meta?: string;
  badge?: string;
  tone?: QuickTone;
  strokeWidth?: number;
}

interface QuickSection {
  key: string;
  title: string;
  count?: string;
  layout?: "grid" | "list";
  items: QuickItem[];
}

const usdtBalance = computed(() => app.user.usdtBalance);
const showWithdrawalLocked = computed(() => usdtBalance.value < MIN_WITHDRAWAL_USD);
const orderCount = computed(() => orders.orders.length);
const streakDays = computed(() => faucet.signInStreak);
const localeUpper = computed(() => locale.code.toUpperCase());
const themeModeLabel = computed(() => (theme.mode === "dark" ? t.value.me.themeMetaDark : t.value.me.themeMetaLight));

// Genesis row surfaces once the user actually owns a Genesis node →
// links to the holder (holdings/dividends) page.
const genesis = useGenesis();
const ownsGenesis = computed(() => genesis.myOwned > 0);
const myGenesisValue = computed(() => fmt(t.value.me.myGenesisNodeValue, { n: String(genesis.myOwned) }));

// ── Secondary display values, wired to the live ported stores (matches source) ──
const achievementsUnlocked = computed(
  () => achievements.records.filter((r) => r.unlockedAt > 0).length,
);
const achievementsTotal = ACHIEVEMENTS.length;
const achievementsValue = computed(() =>
  fmt(t.value.me.achievementsRowValue, { n: achievementsUnlocked.value, total: achievementsTotal }),
);
// Mock urgency — source hardcodes 9 live events (server-driven in the full app).
const eventsLiveLabel = computed(() => fmt(t.value.me.nLive, { n: "9" }));
const quickSections = computed<QuickSection[]>(() => [
  {
    key: "earn-extras",
    title: t.value.me.secEarnExtras,
    items: [
      { key: "goals", label: "收益目标", href: "/me/goals", icon: "target", meta: t.value.me.setTarget, tone: "orange" },
      { key: "missions", label: "任务中心", href: "/missions", icon: "trophy", meta: t.value.me.missionsValue, tone: "brand" },
      { key: "daily", label: "每日签到", href: "/daily", icon: "checkIn", meta: `${streakDays.value} ${t.value.me.dayStreak}`, tone: "orange", strokeWidth: 1.5 },
      { key: "events", label: "活动中心", href: "/events", icon: "ticket", meta: eventsLiveLabel.value, tone: "orange" },
      { key: "learn", label: "教程中心", href: "/learn", icon: "book", meta: t.value.me.earnNex, tone: "muted", strokeWidth: 1.75 },
      { key: "staking", label: "质押金库", href: "/staking", icon: "lock", meta: t.value.me.upTo180, tone: "success" },
      { key: "genesis", label: "创世节点", href: "/genesis/holder", icon: "crown", meta: ownsGenesis.value ? myGenesisValue.value : undefined, tone: "warning" },
      { key: "achievements", label: "成就徽章", href: "/me/achievements", icon: "gift", meta: achievementsValue.value, tone: "brand" },
      { key: "rewards", label: "奖励中心", href: "/me/rewards", icon: "sparkle", meta: t.value.rewards.entryValue, tone: "brand" },
      { key: "wrapped", label: "年度回顾", href: "/me/wrapped", icon: "sparkle", meta: "2026", tone: "purple" },
    ],
  },
  {
    key: "preferences",
    title: t.value.me.secPreferences,
    layout: "list",
    items: [
      { key: "preferences", label: "偏好设置", href: "/me/preferences", icon: "sliders", tone: "muted" },
      { key: "theme", label: "主题模式", icon: "moon", meta: themeModeLabel.value, tone: "purple" },
      { key: "language", label: "语言设置", href: "/me/language", icon: "globe", meta: localeUpper.value, tone: "brand" },
    ],
  },
  {
    key: "help",
    title: t.value.me.secHelp,
    layout: "list",
    items: [
      { key: "replay", label: "新手引导", href: "/me/replay-tour", icon: "rewind", tone: "muted" },
      { key: "faq", label: "帮助中心", href: "/me/help", icon: "help", tone: "muted" },
      { key: "support", label: "在线客服", href: "/me/support", icon: "chat", meta: t.value.me.onlineChip, tone: "success" },
      { key: "tickets", label: "服务工单", href: "/me/support-tickets", icon: "ticket", tone: "orange" },
      { key: "developer", label: "开发中心", href: "/developer", icon: "code", tone: "muted" },
    ],
  },
]);

function goQuick(item: QuickItem) {
  if (item.key === "theme") {
    theme.toggle();
    return;
  }
  if (item.href) navTo(item.href);
}

function toneColor(tone: QuickTone = "muted"): string {
  switch (tone) {
    case "brand":
      return "var(--v5-brand)";
    case "purple":
      return "var(--v5-tech-cyan)";
    case "orange":
      return "var(--v5-brand-2)";
    case "success":
      return "var(--v5-success)";
    case "warning":
      return "var(--v5-warning)";
    case "danger":
      return "var(--v5-danger)";
    default:
      return "var(--v5-ink-2)";
  }
}

const quickGridCardStyle: CSSProperties = {
  padding: "18px 10px",
  background: "var(--v5-surface-bg)",
  borderRadius: "16px",
};
const quickGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  columnGap: "4px",
  rowGap: "18px",
};
const quickItemStyle: CSSProperties = {
  minHeight: "76px",
  padding: "4px 2px",
  borderRadius: "12px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "7px",
};
const DARK_MODE_ICON_COLOR = "#B8C0CC";

function quickForegroundColor(tone: QuickTone = "muted"): string {
  return theme.mode === "dark" ? DARK_MODE_ICON_COLOR : toneColor(tone);
}

function quickIconStyle(tone: QuickTone = "muted"): CSSProperties {
  const color = quickForegroundColor(tone);
  const tint = toneColor(tone);
  return {
    position: "relative",
    width: "44px",
    height: "44px",
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    background: `color-mix(in srgb, ${tint} 14%, transparent)`,
    color,
  };
}
const quickBadgeStyle: CSSProperties = {
  position: "absolute",
  top: "-4px",
  right: "-4px",
  minWidth: "17px",
  height: "17px",
  padding: "0 4px",
  borderRadius: "999px",
  background: "var(--v5-brand-2)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-numbers)",
  fontSize: "11px",
  fontWeight: 600,
  lineHeight: "17px",
  textAlign: "center",
};
const quickLabelStyle: CSSProperties = {
  maxWidth: "78px",
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 500,
  lineHeight: 1.2,
  color: "var(--v5-ink)",
  textAlign: "center",
  whiteSpace: "normal",
  wordBreak: "break-word",
};

const quickListCardStyle: CSSProperties = {
  padding: "4px 0",
  background: "var(--v5-surface-bg)",
  borderRadius: "16px",
  overflow: "hidden",
};
function quickListRowStyle(isLast: boolean): CSSProperties {
  return {
    minHeight: "54px",
    padding: "8px 14px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    borderBottom: isLast ? "none" : "1px solid color-mix(in srgb, var(--v5-border) 60%, transparent)",
  };
}
function quickListIconStyle(tone: QuickTone = "muted"): CSSProperties {
  const color = quickForegroundColor(tone);
  const tint = toneColor(tone);
  return {
    position: "relative",
    width: "34px",
    height: "34px",
    borderRadius: "12px",
    display: "grid",
    placeItems: "center",
    background: `color-mix(in srgb, ${tint} 12%, transparent)`,
    color,
    flexShrink: 0,
  };
}
const quickListLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "14px",
  fontWeight: 500,
  lineHeight: "20px",
  color: "var(--v5-ink)",
};
function quickListChevronStyle(): CSSProperties {
  return {
    color: theme.mode === "dark" ? DARK_MODE_ICON_COLOR : "var(--v5-ink-4)",
    flexShrink: 0,
  };
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
  borderRadius: "999px",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "14px",
  letterSpacing: "-0.005em",
};
</script>
