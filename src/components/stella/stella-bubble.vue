<!--
  StellaBubble — the "nova 浮标" floating advisor entry. Ported from
  Nexion-prototype/app/components/stella/stella-bubble.tsx (+ a focused port of
  stella-triggers / stella-triggers-v3 so the unread badge actually populates).

  Visibility: the chassis mounts this ONLY on tab routes (home/earn/store/team/
  me), so route-gating lives in the chassis. The floating button itself shows
  only when unread > 0 — but the COMPONENT mounts unconditionally on tab routes
  so its push triggers run (the button appears once the first push lands).

  Position: fixed, bottom-right, above the floating-pill TabBar (~100px) — the
  chassis is position:fixed inset:0 on uni so fixed == device viewport.

  Timers are module-light: started in onMounted, cleared in onUnmounted (uni
  components don't fire onUnload — P-021). Cooldown gating lives in the Pinia
  stella store (an app-singleton across in-SPA navigations), so re-mounting the
  chassis per navigation can't double-fire welcome / spam the channels.
-->
<template>
  <view>
    <view v-if="visible" class="nx-stella-bubble stella-float" @click="open">
      <view class="nx-stella-btn" :class="stella.isOpen ? 'nx-stella-btn--open' : 'stella-pulse'">
        <StellaAvatar :size="36" pulse />
        <view class="nx-stella-badge"><text class="nx-stella-badge-t">{{ unreadLabel }}</text></view>
      </view>
    </view>
    <StellaDrawer />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { useStella } from "@/store/stella";
import { useNotifications, type NotifKind } from "@/store/notifications";
import { welcomeMessage } from "@/mock/stella-templates";
import StellaAvatar from "./stella-avatar.vue";
import StellaDrawer from "./stella-drawer.vue";

const stella = useStella();
const notifications = useNotifications();

const visible = computed(() => stella.unread > 0);
const unreadLabel = computed(() => (stella.unread > 9 ? "9+" : String(stella.unread)));

function open() {
  stella.open();
}

// ── focused trigger port (stella-triggers welcome + stella-triggers-v3 channels)
// Each channel pushes a Stella message (cooldown-gated) AND, when it fires, a
// matching notification — so the bell badge + nova badge populate in tandem,
// exactly like the prototype. First delays are short so both badges appear
// within ~10s of landing on a tab route (the prototype shows them populated).

const TEAM_TICK_MS = 90_000, TEAM_COOLDOWN_MS = 70_000, FIRST_TEAM = 2_500;
const STAKING_TICK_MS = 240_000, STAKING_COOLDOWN_MS = 300_000, FIRST_STAKING = 6_000;
const MARKET_TICK_MS = 360_000, MARKET_COOLDOWN_MS = 420_000, FIRST_MARKET = 9_000;
const WELCOME_DELAY = 1_200, WELCOME_COOLDOWN = 24 * 60 * 60 * 1000;

const TEAM_NAMES = ["Sarah K.", "Tom Wang", "Lisa Park", "Carlos R.", "Yuki H.", "Mehmet A.", "Diego P.", "Mila V."];
const TEAM_ORDERS = [
  { product: "NexionBox S1", price: 299, l1: 29.9 },
  { product: "NexionBox Pro", price: 899, l1: 89.9 },
  { product: "NexionRack P1", price: 3499, l1: 349.9 },
];

interface ChannelMsg { text: string; ctaLabel: string; ctaHref: string; }

function teamEventMessage(): ChannelMsg {
  const r = Math.random();
  const buyer = TEAM_NAMES[Math.floor(Math.random() * TEAM_NAMES.length)];
  if (r < 0.5) {
    const order = TEAM_ORDERS[Math.floor(Math.random() * TEAM_ORDERS.length)];
    const nexPart = Math.floor(order.price * 50).toLocaleString();
    return { text: `${buyer} just bought ${order.product} · +$${order.l1.toFixed(2)} USDT + ${nexPart} NEX credited (30d cooling)`, ctaLabel: "View commission", ctaHref: "/team/commissions" };
  }
  if (r < 0.75) {
    const n = 1 + Math.floor(Math.random() * 3);
    return { text: `Network partner V5 Sarah K. auto-placed ${n} new member${n > 1 ? "s" : ""} into your Track B.`, ctaLabel: "See Balance Match", ctaHref: "/team/binary" };
  }
  if (r < 0.9) {
    const remain = 200 + Math.floor(Math.random() * 1800);
    return { text: `You're $${remain.toLocaleString()} away from V3 Captain — Apple Watch SE waiting.`, ctaLabel: "Boost team", ctaHref: "/team/rank" };
  }
  const peerAmt = 50 + Math.floor(Math.random() * 350);
  return { text: `Same-rank peer ${buyer} earned $${(peerAmt * 20).toLocaleString()} this week → your 5% peer bonus +$${peerAmt}.`, ctaLabel: "Open", ctaHref: "/team/commissions" };
}

function stakingEventMessage(): ChannelMsg {
  const r = Math.random();
  if (r < 0.4) return { text: "⚡ 180-day vault APY just rose from 80% → 95% (24h window only).", ctaLabel: "Lock now", ctaHref: "/staking" };
  if (r < 0.7) { const slot = 7 + Math.floor(Math.random() * 18); return { text: `🔥 Only ${slot} Genesis Nodes left · 0.1% lifetime TVL dividend + V5 fast-track.`, ctaLabel: "Reserve", ctaHref: "/genesis" }; }
  if (r < 0.9) return { text: "Lock 180 days now for 2× airdrop multiplier when $NEX lists on Binance.", ctaLabel: "Lock 180d", ctaHref: "/staking" };
  return { text: "Your 90-day stake matures in 12 days · auto-claim or extend for 35% bonus APY.", ctaLabel: "Manage", ctaHref: "/staking" };
}

function marketEventMessage(): ChannelMsg {
  const r = Math.random();
  if (r < 0.35) { const price = (0.16 + Math.random() * 0.04).toFixed(3); const change = (5 + Math.random() * 18).toFixed(1); return { text: `📈 $NEX just broke $${price} · +${change}% in 24h · new ATH this week.`, ctaLabel: "Buy NEX", ctaHref: "/me/wallet/exchange" }; }
  if (r < 0.6) return { text: "🚨 $NEX cleared Binance tier-1 listing review — public announcement expected this quarter.", ctaLabel: "Read more", ctaHref: "/trust" };
  if (r < 0.85) { const tvl = (840 + Math.random() * 60).toFixed(0); return { text: `🎉 Platform TVL crossed $${tvl}M overnight · your Leadership pool share grew.`, ctaLabel: "View pool", ctaHref: "/team/leadership-pool" }; }
  return { text: "🤝 Nexion × OPPO strategic partnership signed — NEX now usable across OPPO Wallet.", ctaLabel: "Trust Center", ctaHref: "/trust" };
}

function fireChannel(prefix: "team" | "staking" | "market", kind: NotifKind, m: ChannelMsg, cooldownMs: number) {
  const cooldownKey = `${prefix}_${m.ctaHref}`;
  const fired = stella.push(
    { kind: "market-event", text: m.text, ctaLabel: m.ctaLabel, ctaHref: m.ctaHref },
    { cooldownKey, cooldownMs },
  );
  if (fired) {
    notifications.push({ id: `${cooldownKey}-${Date.now()}`, kind, title: m.text, ctaLabel: m.ctaLabel, ctaHref: m.ctaHref });
  }
}

const timers: ReturnType<typeof setTimeout>[] = [];
const intervals: ReturnType<typeof setInterval>[] = [];

onMounted(() => {
  timers.push(setTimeout(() => {
    stella.push(welcomeMessage(), { cooldownKey: "welcome", cooldownMs: WELCOME_COOLDOWN });
  }, WELCOME_DELAY));

  const teamFire = () => fireChannel("team", "team", teamEventMessage(), TEAM_COOLDOWN_MS);
  timers.push(setTimeout(teamFire, FIRST_TEAM));
  intervals.push(setInterval(teamFire, TEAM_TICK_MS));

  const stakingFire = () => fireChannel("staking", "staking", stakingEventMessage(), STAKING_COOLDOWN_MS);
  timers.push(setTimeout(stakingFire, FIRST_STAKING));
  intervals.push(setInterval(stakingFire, STAKING_TICK_MS));

  const marketFire = () => fireChannel("market", "market", marketEventMessage(), MARKET_COOLDOWN_MS);
  timers.push(setTimeout(marketFire, FIRST_MARKET));
  intervals.push(setInterval(marketFire, MARKET_TICK_MS));
});

onUnmounted(() => {
  timers.forEach(clearTimeout);
  intervals.forEach(clearInterval);
});
</script>

<style scoped>
.nx-stella-bubble {
  position: fixed;
  right: 16px;
  bottom: 100px;
  z-index: 40;
}
.nx-stella-btn {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: var(--v5-bg);
  border: 1px solid color-mix(in srgb, var(--v5-brand) 45%, transparent);
}
.nx-stella-btn--open {
  box-shadow: 0 0 24px color-mix(in srgb, var(--v5-brand) 25%, transparent);
}
.nx-stella-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--v5-brand-2);
  display: grid;
  place-items: center;
  border: 1px solid var(--v5-bg);
}
.nx-stella-badge-t {
  font-size: 10px;
  font-weight: 600;
  font-family: var(--font-v5);
  color: var(--v5-on-brand-2);
  line-height: 1;
}
</style>
