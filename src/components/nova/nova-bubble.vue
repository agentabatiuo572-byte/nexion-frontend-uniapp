<!--
  NovaBubble — the "nova 浮标" floating advisor entry. Ported from
  Nexion-prototype/app/components/nova/nova-bubble.tsx (+ a focused port of
  nova-triggers / nova-triggers-v3 so the unread badge actually populates).

  Visibility: the chassis mounts this ONLY on tab routes (home/earn/store/team/
  me), so route-gating lives in the chassis. The floating button itself shows
  only when unread > 0 — but the COMPONENT mounts unconditionally on tab routes
  so its push triggers run (the button appears once the first push lands).

  Position: absolute, bottom-right, above the floating-pill TabBar (~100px) so
  it stays clipped inside the simulated device chassis on desktop H5 too.

  Timers are module-light: started in onMounted, cleared in onUnmounted (uni
  components don't fire onUnload — P-021). Cooldown gating lives in the Pinia
  nova store (an app-singleton across in-SPA navigations), so re-mounting the
  chassis per navigation can't double-fire welcome / spam the channels.
-->
<template>
  <view>
    <view v-if="visible" class="nx-nova-bubble nova-float" :class="{ 'nx-nova-bubble--compact': compact }" @click="open">
      <view class="nx-nova-btn nova-pulse">
        <NovaAvatar class="nx-nova-avatar-dark" :size="36" pulse />
        <view class="nx-support-light-entry" aria-hidden="true">
          <image
            class="nx-support-light-entry-img"
            src="/static/img/marketing/customer-service-light.png"
            mode="aspectFill"
          />
          <view class="nx-support-light-entry-ring" />
        </view>
        <view class="nx-nova-badge"><text class="nx-nova-badge-t">{{ unreadLabel }}</text></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useNova } from "@/store/nova";
import { useConversations } from "@/store/conversations";
import { useNotifications, type NotifKind } from "@/store/notifications";
import { welcomeMessage } from "@/mock/nova-templates";
import { navTo } from "@/lib/route";
import NovaAvatar from "./nova-avatar.vue";

const nova = useNova();
const conversations = useConversations();
const notifications = useNotifications();

// Bubble badge reflects ALL unread — Nova pushes + human-category conversations
// (the advisor's proactive seed shows immediately as a conversion hook). Tapping
// opens the unified conversation center; unread clears per-thread on open there.
const totalUnread = computed(() => nova.unread + conversations.totalUnread);
const visible = computed(() => totalUnread.value > 0);
const unreadLabel = computed(() => (totalUnread.value > 9 ? "9+" : String(totalUnread.value)));
const compact = ref(false);
let scrollHost: HTMLElement | null = null;

function updateCompact() {
  compact.value = (scrollHost?.scrollTop ?? 0) > 96;
}

function open() {
  navTo("/pages/support/messages");
}

// ── focused trigger port (nova-triggers welcome + nova-triggers-v3 channels)
// Each channel pushes a Nova message (cooldown-gated) AND, when it fires, a
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
  const fired = nova.push(
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
  if (typeof document !== "undefined") {
    scrollHost = document.querySelector(".nx-content") as HTMLElement | null;
    updateCompact();
    scrollHost?.addEventListener("scroll", updateCompact, { passive: true });
  }

  timers.push(setTimeout(() => {
    nova.push(welcomeMessage(), { cooldownKey: "welcome", cooldownMs: WELCOME_COOLDOWN });
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
  scrollHost?.removeEventListener("scroll", updateCompact);
  scrollHost = null;
  timers.forEach(clearTimeout);
  intervals.forEach(clearInterval);
});
</script>

<style scoped>
.nx-nova-bubble {
  position: absolute;
  right: 16px;
  bottom: 100px;
  z-index: 40;
  transition: right 0.18s ease, bottom 0.18s ease;
}
.nx-nova-btn {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: var(--v5-bg);
  border: 1px solid color-mix(in srgb, var(--v5-brand) 45%, transparent);
  transition: width 0.18s ease, height 0.18s ease, background-color 0.18s ease;
}
.nx-support-light-entry {
  position: relative;
  width: 36px;
  height: 36px;
  display: inline-block;
  flex-shrink: 0;
}
.nx-support-light-entry-img {
  display: block;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  box-shadow:
    0 0 0 1.5px color-mix(in oklab, var(--v5-brand) 35%, transparent),
    0 4px 10px rgba(0, 0, 0, 0.18);
}
.nx-support-light-entry-ring {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  pointer-events: none;
  animation: v5-nova-halo 1.8s ease-in-out infinite;
  box-shadow: 0 0 0 0 color-mix(in oklab, var(--v5-brand) 60%, transparent);
}
html[data-theme="dark"] .nx-support-light-entry {
  display: none;
}
html:not([data-theme="dark"]) .nx-nova-avatar-dark {
  display: none;
}
html:not([data-theme="dark"]) .nx-nova-btn {
  animation: nx-support-blue-pulse 2s ease-out infinite;
}
.nx-nova-bubble--compact {
  right: 18px;
  bottom: 112px;
}
.nx-nova-bubble--compact .nx-nova-btn {
  width: 36px;
  height: 36px;
}
.nx-nova-bubble--compact .nx-support-light-entry,
.nx-nova-bubble--compact .nx-support-light-entry-img {
  width: 28px;
  height: 28px;
}
.nx-nova-bubble--compact .nx-nova-badge {
  top: -5px;
  right: -6px;
}
@keyframes nx-support-blue-pulse {
  0%, 100% {
    box-shadow:
      0 0 24px rgba(14, 72, 230, 0.22),
      0 0 0 0 rgba(14, 72, 230, 0.38);
  }
  70% {
    box-shadow:
      0 0 24px rgba(14, 72, 230, 0.22),
      0 0 0 14px rgba(14, 72, 230, 0);
  }
}
.nx-nova-badge {
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
.nx-nova-badge-t {
  font-size: 10.5px;
  font-weight: 600;
  font-family: var(--font-v5);
  color: var(--v5-on-brand-2);
  line-height: 1;
}
</style>
