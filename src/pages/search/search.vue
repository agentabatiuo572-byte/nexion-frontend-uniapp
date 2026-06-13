<!--
  Global search — ported from Nexion-prototype/app/(main)/search/page.tsx.

  Single search input indexes a static route/FAQ catalog + live store products,
  user devices, and network members. Real-time filter, grouped results.

  Wrapped in <AppChassis active="home"> (reached from Home). SetPageHeader
  backHref="/" → SubPageHeader back="/pages/index/index". <Link> → uni.navigateTo
  with fail:()=>{} so taps to not-yet-ported routes are no-ops, not crashes.
  Route/FAQ catalog hrefs map to uni page paths; unported ones still listed
  (faithful catalog) but navigate is a graceful no-op.
-->
<template>
  <AppChassis active="home">
    <CardStagger class="pb-6" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/index/index" />

      <!-- Search input -->
      <view class="mx-4">
        <view class="flex items-center" :style="inputWrapStyle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            v-model="q"
            type="text"
            :placeholder="t.search.placeholder"
            :style="inputStyle"
            placeholder-class="nx-search-ph"
          />
        </view>
      </view>

      <!-- Empty state -->
      <view v-if="!q.trim()" class="mx-4 mt-4 rounded-2xl border text-center" :style="emptyCardStyle">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 8px"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        <text class="block" style="font-size: 13.5px; color: var(--v5-ink)">{{ t.search.emptyTitle }}</text>
        <text class="block" style="font-size: 11px; color: var(--v5-ink-3); margin-top: 4px; line-height: 1.6">{{ t.search.emptyBody }}</text>
      </view>

      <!-- No results -->
      <view v-else-if="results.length === 0" class="mx-4 mt-4 rounded-2xl border text-center" :style="noResultsStyle">
        <text style="font-size: 12px; color: var(--v5-ink-3)">{{ t.search.noResults }}</text>
      </view>

      <!-- Results -->
      <view v-else class="mx-4 mt-3 space-y-3">
        <view v-for="grp in groupedList" :key="grp.group">
          <text class="block px-1 font-mono-tabular" :style="groupLabelStyle">{{ groupLabel(grp.group) }}</text>
          <view class="rounded-2xl border overflow-hidden" :style="resultCardStyle">
            <view
              v-for="(h, i) in grp.hits"
              :key="`${h.group}-${h.label}-${i}`"
              class="flex items-center active:opacity-70"
              :style="rowStyle(i === grp.hits.length - 1)"
              @click="openHit(h)"
            >
              <view class="flex-1 min-w-0">
                <text class="block truncate" style="font-size: 12.5px; font-weight: 600; color: var(--v5-ink)">{{ h.label }}</text>
                <text v-if="h.sublabel" class="block truncate" style="font-size: 10.5px; color: var(--v5-ink-3); margin-top: 2px">{{ h.sublabel }}</text>
              </view>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M7 7h10v10" /><path d="M7 17 17 7" /></svg>
            </view>
          </view>
        </view>
      </view>
    </CardStagger>
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import CardStagger from "@/components/card-stagger.vue";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { useNetwork } from "@/store/network";
import { PRODUCTS } from "@/mock/products";

type Group = "route" | "device" | "product" | "member" | "faq";
interface Hit {
  group: Group;
  label: string;
  sublabel?: string;
  href: string;
}

const t = useT();
const app = useApp();
const network = useNetwork();

const q = ref("");

const devices = computed(() => app.devices);
const members = computed(() => network.members);

// Static route catalog. href = uni page path when the page is ported,
// otherwise a placeholder path that navigate's fail:()=>{} swallows.
const ROUTES: ReadonlyArray<{ label: string; href: string; sub: string }> = [
  { label: "Home / Mission Control", href: "/pages/index/index", sub: "Live earnings · ticker · dashboard" },
  { label: "Earn / Fleet", href: "/pages/earn/earn", sub: "Device cards · task center · efficiency" },
  { label: "Store", href: "/pages/store/store", sub: "NexionBox / Rack / Cloud Share" },
  { label: "Trade-in", href: "/pages/me/devices", sub: "Legacy salvage + upgrade path" },
  { label: "Team hub", href: "/pages/team/team", sub: "Royalty / V-rank / network" },
  { label: "Influence Network Royalty", href: "/pages/team/unilevel", sub: "Direct + Network Yield Bonus" },
  { label: "Network visualization", href: "/pages/team/network", sub: "Direct / Extended orbits" },
  { label: "Wallet", href: "/pages/me/wallet", sub: "Balance + withdraw + topup" },
  { label: "Withdraw", href: "/pages/me/wallet-withdraw", sub: "Cash out USDT to chain" },
  { label: "Staking Vault", href: "/pages/staking/staking", sub: "4 lock tiers up to 180%" },
  { label: "Genesis marketplace", href: "/pages/genesis/marketplace", sub: "Secondary Genesis trading" },
  { label: "Goals", href: "/pages/me/goals", sub: "Set earnings target + recommended path" },
  { label: "Risk disclosure", href: "/pages/me/risk-disclosure", sub: "Required reading" },
  { label: "Developer / API", href: "/pages/developer/developer", sub: "Public API + partner integrations" },
  { label: "Globe / Network map", href: "/pages/globe/globe", sub: "Worldwide active nodes" },
  { label: "Market", href: "/pages/market/market", sub: "AI workload prices + NEX K-line" },
  { label: "Learn / Academy", href: "/pages/learn/learn", sub: "Lessons · learn-to-earn NEX" },
  { label: "Events", href: "/pages/events/events", sub: "Promotions · contests · seasonal" },
  { label: "Missions", href: "/pages/missions/missions", sub: "Quests · streaks · challenges" },
];

const FAQ: ReadonlyArray<{ label: string; href: string; sub: string }> = [
  { label: "How Unilevel Royalty works", href: "/pages/team/unilevel", sub: "Direct + Network Yield Bonus + Rate Tier" },
  { label: "How Staking works", href: "/pages/staking/staking", sub: "Lock periods + APY + early unlock penalty" },
  { label: "How Genesis works", href: "/pages/genesis/genesis", sub: "Founder NFT + perks + secondary" },
  { label: "NEX token explained", href: "/pages/me/wallet", sub: "Sources · uses · burn mechanism" },
];

const results = computed<Hit[]>(() => {
  const query = q.value.trim().toLowerCase();
  if (!query) return [];
  const out: Hit[] = [];
  for (const r of ROUTES) {
    if (r.label.toLowerCase().includes(query) || r.sub.toLowerCase().includes(query)) {
      out.push({ group: "route", label: r.label, sublabel: r.sub, href: r.href });
    }
  }
  for (const p of PRODUCTS) {
    if (p.name.toLowerCase().includes(query) || p.tagline.toLowerCase().includes(query)) {
      out.push({
        group: "product",
        label: p.name,
        sublabel: `$${p.price} · ${p.tagline}`,
        href: `/pages/store/detail?id=${p.id}`,
      });
    }
  }
  for (const d of devices.value) {
    if (d.name.toLowerCase().includes(query) || d.gpu.toLowerCase().includes(query)) {
      out.push({ group: "device", label: d.name, sublabel: d.gpu, href: "/pages/earn/earn" });
    }
  }
  for (const m of members.value.slice(0, 30)) {
    if (m.name.toLowerCase().includes(query)) {
      out.push({
        group: "member",
        label: m.name,
        sublabel: `${m.city ?? ""} · V${m.vRank}`,
        href: "/pages/team/network",
      });
    }
  }
  for (const f of FAQ) {
    if (f.label.toLowerCase().includes(query) || f.sub.toLowerCase().includes(query)) {
      out.push({ group: "faq", label: f.label, sublabel: f.sub, href: f.href });
    }
  }
  return out.slice(0, 30);
});

// Grouped as an ordered list of { group, hits } (preserves insertion order,
// avoids Object.entries over a reactive Record per P-027 spirit).
const groupedList = computed<Array<{ group: Group; hits: Hit[] }>>(() => {
  const order: Group[] = [];
  const map: Record<string, Hit[]> = {};
  for (const h of results.value) {
    if (!map[h.group]) {
      map[h.group] = [];
      order.push(h.group);
    }
    map[h.group].push(h);
  }
  return order.map((g) => ({ group: g, hits: map[g] }));
});

function groupLabel(g: Group): string {
  const labels = t.value.search.groupLabels;
  return labels[g as keyof typeof labels] ?? g;
}

function openHit(h: Hit) {
  uni.navigateTo({ url: h.href, fail: () => {} });
}

// ── styles ──
const inputWrapStyle: CSSProperties = {
  gap: "8px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "12px",
  padding: "0 12px",
  height: "48px",
};
const inputStyle: CSSProperties = {
  flex: "1",
  background: "transparent",
  fontSize: "14px",
  color: "var(--v5-ink)",
  height: "100%",
};
const emptyCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "20px",
};
const noResultsStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "20px",
};
const groupLabelStyle: CSSProperties = {
  marginBottom: "6px",
  fontSize: "10px",
  letterSpacing: "0.16em",
  color: "var(--v5-ink-3)",
};
const resultCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
};
function rowStyle(isLast: boolean): CSSProperties {
  return {
    gap: "8px",
    padding: "10px 14px",
    borderBottom: isLast ? "none" : "1px solid var(--v5-border)",
  };
}
</script>

<style scoped>
.nx-search-ph {
  color: var(--v5-ink-4);
}
</style>
