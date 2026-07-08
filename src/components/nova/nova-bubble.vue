<!--
  NovaBubble — the "nova 浮标" floating advisor entry. Ported from
  Nexion-prototype/app/components/nova/nova-bubble.tsx (+ a focused port of
  nova-triggers / nova-triggers-v3 so the unread badge actually populates).

  Visibility: the chassis mounts this ONLY on tab routes (home/earn/store/team/
  me), so route-gating lives in the chassis. The floating button itself shows
  only when unread > 0 — but the COMPONENT mounts unconditionally on tab routes
  so its push triggers run (the button appears once the first push lands).

  Position: fixed, bottom-right, above the floating-pill TabBar (~100px) — the
  chassis is position:fixed inset:0 on uni so fixed == device viewport.

  Timers are module-light: started in onMounted, cleared in onUnmounted (uni
  components don't fire onUnload — P-021). Cooldown gating lives in the Pinia
  nova store (an app-singleton across in-SPA navigations), so re-mounting the
  chassis per navigation can't double-fire welcome / spam the channels.
-->
<template>
  <view>
    <view v-if="visible" class="nx-nova-bubble nova-float" @click="open">
      <view class="nx-nova-btn" :class="isLightMode ? 'nova-pulse-blue' : 'nova-pulse'">
        <image
          v-if="isLightMode"
          class="nx-nova-light-avatar"
          src="/static/img/marketing/customer-service-light.png"
          mode="aspectFill"
        />
        <NovaAvatar v-else :size="36" pulse />
        <view class="nx-nova-badge"><text class="nx-nova-badge-t">{{ unreadLabel }}</text></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { useNova } from "@/store/nova";
import { useConversations } from "@/store/conversations";
import { useNotifications, type NotifKind } from "@/store/notifications";
import { useTheme } from "@/store/theme";
import { welcomeMessage } from "@/mock/nova-templates";
import { navTo } from "@/lib/route";
import NovaAvatar from "./nova-avatar.vue";

const nova = useNova();
const conversations = useConversations();
const notifications = useNotifications();
const theme = useTheme();

// Bubble badge reflects ALL unread — Nova pushes + human-category conversations
// (the advisor's proactive seed shows immediately as a conversion hook). Tapping
// opens the unified conversation center; unread clears per-thread on open there.
const totalUnread = computed(() => nova.unread + conversations.totalUnread);
const visible = computed(() => totalUnread.value > 0);
const unreadLabel = computed(() => (totalUnread.value > 9 ? "9+" : String(totalUnread.value)));
const isLightMode = computed(() => theme.mode === "light");

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
    return { text: `${buyer} 刚购买 ${order.product} · +$${order.l1.toFixed(2)} USDT + ${nexPart} NEX 已入账(30 天冷却)`, ctaLabel: "查看佣金", ctaHref: "/team/commissions" };
  }
  if (r < 0.75) {
    const n = 1 + Math.floor(Math.random() * 3);
    return { text: `网络伙伴 V5 Sarah K. 自动把 ${n} 位新成员放入你的 B 轨。`, ctaLabel: "查看平衡匹配", ctaHref: "/team/binary" };
  }
  if (r < 0.9) {
    const remain = 200 + Math.floor(Math.random() * 1800);
    return { text: `距离 V3 舰长还差 $${remain.toLocaleString()} — Apple Watch SE 奖励待领取。`, ctaLabel: "提升团队", ctaHref: "/team/rank" };
  }
  const peerAmt = 50 + Math.floor(Math.random() * 350);
  return { text: `同级伙伴 ${buyer} 本周赚到 $${(peerAmt * 20).toLocaleString()} → 你的 5% 平级奖 +$${peerAmt}。`, ctaLabel: "打开", ctaHref: "/team/commissions" };
}

function stakingEventMessage(): ChannelMsg {
  const r = Math.random();
  if (r < 0.4) return { text: "⚡ 180 天金库年化刚从 80% 提升到 95%(仅 24 小时窗口)。", ctaLabel: "立即锁定", ctaHref: "/staking" };
  if (r < 0.7) { const slot = 7 + Math.floor(Math.random() * 18); return { text: `🔥 创世节点仅剩 ${slot} 个 · 0.1% 终身 TVL 分红 + V5 快速通道。`, ctaLabel: "预约", ctaHref: "/genesis" }; }
  if (r < 0.9) return { text: "$NEX 上线 Binance 前锁定 180 天,可获得 2× 空投倍率。", ctaLabel: "锁定 180 天", ctaHref: "/staking" };
  return { text: "你的 90 天质押将在 12 天后到期 · 可自动领取或延长以获得 35% 加成年化。", ctaLabel: "管理", ctaHref: "/staking" };
}

function marketEventMessage(): ChannelMsg {
  const r = Math.random();
  if (r < 0.35) { const price = (0.16 + Math.random() * 0.04).toFixed(3); const change = (5 + Math.random() * 18).toFixed(1); return { text: `📈 $NEX 刚突破 $${price} · 24 小时 +${change}% · 本周创历史新高。`, ctaLabel: "购买 NEX", ctaHref: "/me/wallet/exchange" }; }
  if (r < 0.6) return { text: "🚨 $NEX 已通过 Binance 一线交易所上市审核 — 预计本季度公开公告。", ctaLabel: "查看更多", ctaHref: "/trust" };
  if (r < 0.85) { const tvl = (840 + Math.random() * 60).toFixed(0); return { text: `🎉 平台 TVL 一夜突破 $${tvl}M · 你的领导池份额同步增长。`, ctaLabel: "查看奖池", ctaHref: "/team/leadership-pool" }; }
  return { text: "🤝 Nexion × OPPO 战略合作已签署 — NEX 现可在 OPPO Wallet 使用。", ctaLabel: "信任中心", ctaHref: "/trust" };
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
  timers.forEach(clearTimeout);
  intervals.forEach(clearInterval);
});
</script>

<style scoped>
.nx-nova-bubble {
  position: fixed;
  right: 16px;
  bottom: 100px;
  z-index: 40;
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
}
.nx-nova-light-avatar {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: block;
  box-shadow: 0 0 0 1.5px rgba(14, 72, 230, 0.35), 0 4px 10px rgba(0,0,0,0.18);
}
.nova-pulse-blue {
  animation: nova-pulse-blue 2s ease-out infinite;
}
@keyframes nova-pulse-blue {
  0%, 100% {
    box-shadow:
      0 0 24px rgba(14, 72, 230, 0.22),
      0 0 0 0 rgba(14, 72, 230, 0.42);
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
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-v5);
  color: var(--v5-on-brand-2);
  line-height: 1;
}
</style>
