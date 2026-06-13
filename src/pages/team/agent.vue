<!--
  Agent — ported from Nexion-prototype/app/(main)/team/agent/page.tsx.
  Regional Ambassador dashboard (V5+ gated): hero → eligibility status
  (eligible / locked + path CTA) → 4 reimbursable buckets → application form
  (date/city/budget, gated submit) → recently-approved cases. Sub-page →
  <AppChassis active="team"> with in-page back row. Reuses v-rank store +
  v-badge. lucide → inline SVG; <input>→uni input; toast via store/ui.
-->
<template>
  <AppChassis active="team">
    <view class="pb-6" style="color: var(--v5-ink)">
      <!-- In-page header: back -->
      <view class="flex items-center" :style="headerStyle">
        <view class="grid place-items-center active:opacity-60" :style="backBtnStyle" @click="goBack">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </view>
        <text class="block" :style="headerTitleStyle">{{ t.agent.pageTitle }}</text>
      </view>

      <view class="px-4" style="display: flex; flex-direction: column; gap: 12px">
        <!-- hero -->
        <view class="rounded-2xl" :style="heroStyle">
          <view class="flex items-center" style="gap: 8px">
            <view class="rounded-xl grid place-items-center" :style="heroIconStyle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></svg>
            </view>
            <view class="flex-1">
              <text class="block font-mono-tabular" :style="heroCapStyle">{{ t.agent.heroLabel }}</text>
              <text class="block font-display" :style="heroHeadlineStyle">{{ t.agent.heroHeadline }}</text>
            </view>
          </view>
          <text class="block" :style="heroBodyStyle">{{ t.agent.heroBody }}</text>
        </view>

        <!-- eligibility -->
        <view v-if="unlocked" class="rounded-2xl border" :style="eligibleStyle">
          <view class="flex items-center" style="gap: 12px">
            <view class="rounded-xl grid place-items-center" :style="eligibleIconStyle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
            </view>
            <view class="flex-1">
              <view class="flex items-center" style="gap: 6px">
                <text :style="{ fontSize: '13.5px', fontWeight: 600, color: 'var(--v5-ink)' }">{{ t.agent.eligible }}</text>
                <VBadge :v="myRank" size="sm" :show-title="false" />
              </view>
              <text class="block" :style="{ fontSize: '11.5px', color: 'var(--v5-ink-3)', marginTop: '2px' }">{{ t.agent.annualBudget }}</text>
            </view>
          </view>
        </view>
        <view v-else class="rounded-2xl border" :style="lockedStyle">
          <view class="flex items-center" style="gap: 12px">
            <view class="rounded-xl grid place-items-center" :style="lockedIconStyle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </view>
            <view class="flex-1">
              <text class="block" :style="{ fontSize: '13.5px', fontWeight: 600, color: 'var(--v5-ink)' }">{{ t.agent.lockedReq }}</text>
              <text class="block" :style="{ fontSize: '11.5px', color: 'var(--v5-ink-3)', marginTop: '2px' }">{{ lockedSubText }}</text>
            </view>
            <view class="shrink-0 rounded-full flex items-center active:opacity-90" :style="pathCtaStyle" @click="go('/pages/team/rank')">
              <text>{{ t.agent.pathCta }}</text>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </view>
          </view>
        </view>

        <!-- buckets -->
        <view style="display: flex; flex-direction: column; gap: 8px">
          <view
            v-for="b in BUCKETS"
            :key="b.id"
            class="rounded-2xl border flex items-start"
            :style="bucketStyle"
            role="button"
            tabindex="0"
            :aria-label="b.title"
            @click.capture="selectBucket(b)"
          >
            <view class="rounded-xl grid place-items-center shrink-0" :style="bucketIconStyle(b.tint)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" :stroke="b.tint" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-for="(p, pi) in b.paths" :key="pi" :d="p" /></svg>
            </view>
            <view class="flex-1 min-w-0">
              <view class="flex items-center justify-between">
                <text :style="{ fontSize: '13.5px', fontWeight: 600, color: 'var(--v5-ink)' }">{{ b.title }}</text>
                <text class="font-display tabular-nums" :style="{ fontSize: '13.5px', fontWeight: 600, color: b.tint }">{{ b.range }}</text>
              </view>
              <text class="block" :style="{ fontSize: '11px', color: 'var(--v5-ink-3)', marginTop: '2px', lineHeight: 1.4 }">{{ b.rule }}</text>
            </view>
          </view>
        </view>
        <text v-if="selectedBucketTitle" class="block text-center" :style="selectedBucketStyle">{{ selectedBucketTitle }} · {{ t.agent.newApplication }}</text>

        <!-- application form -->
        <view class="rounded-2xl border relative overflow-hidden" :style="cardStyle">
          <text class="block font-mono-tabular" :style="formCapStyle">{{ t.agent.newApplication }}</text>
          <view style="display: flex; flex-direction: column; gap: 8px">
            <view :style="fieldStyle">
              <view class="flex items-center" style="gap: 6px; margin-bottom: 4px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                <text class="font-mono-tabular" :style="fieldLabelStyle">{{ t.agent.fieldEventDate }}</text>
              </view>
              <input
                v-model="date"
                type="text"
                :disabled="!unlocked"
                placeholder="YYYY-MM-DD"
                :style="inputStyle"
                placeholder-style="color: var(--v5-ink-2)"
              />
            </view>
            <view :style="fieldStyle">
              <view class="flex items-center" style="gap: 6px; margin-bottom: 4px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></svg>
                <text class="font-mono-tabular" :style="fieldLabelStyle">{{ t.agent.fieldCity }}</text>
              </view>
              <input
                v-model="city"
                type="text"
                :disabled="!unlocked"
                :placeholder="t.agent.cityPlaceholder"
                :style="inputStyle"
                placeholder-style="color: var(--v5-ink-2)"
              />
            </view>
            <view :style="fieldStyle">
              <view class="flex items-center" style="gap: 6px; margin-bottom: 4px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></svg>
                <text class="font-mono-tabular" :style="fieldLabelStyle">{{ t.agent.fieldBudget }}</text>
              </view>
              <view class="flex items-center">
                <text class="font-display" :style="{ fontSize: '12.5px', color: 'var(--v5-ink-3)', marginRight: '4px' }">$</text>
                <input
                  v-model="budgetText"
                  type="number"
                  :disabled="!unlocked"
                  :style="budgetInputStyle"
                  @input="onBudgetInput"
                />
              </view>
            </view>
          </view>

          <view class="rounded-full flex items-center justify-center active:opacity-90" :style="submitStyle" @click="submit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" :stroke="unlocked ? 'var(--v5-on-brand)' : 'var(--v5-ink-4)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
            <text>{{ unlocked ? t.agent.submitForReview : t.agent.lockedV5 }}</text>
          </view>

          <text v-if="!unlocked" class="block text-center" :style="previewOnlyStyle">{{ t.agent.previewOnly }}</text>
        </view>

        <!-- approved cases -->
        <view>
          <text class="block font-mono-tabular" :style="approvedCapStyle">{{ t.agent.recentlyApproved }}</text>
          <view style="display: flex; flex-direction: column; gap: 8px">
            <view v-for="(c, i) in APPROVED_CASES" :key="i" class="rounded-xl border" :style="caseStyle">
              <view class="flex items-start justify-between">
                <view>
                  <text class="block" :style="{ fontSize: '13.5px', fontWeight: 600, color: 'var(--v5-ink)' }">{{ c.name }}</text>
                  <text class="block font-mono-tabular" :style="{ fontSize: '10.5px', color: 'var(--v5-ink-3)', marginTop: '2px' }">{{ hostedByText(c) }}</text>
                </view>
                <text class="font-display tabular-nums" :style="{ fontSize: '14px', fontWeight: 600, color: 'var(--v5-brand)' }">${{ c.amount.toLocaleString() }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import VBadge from "@/components/team/v-badge.vue";
import { useVRank, V_RANKS } from "@/store/v-rank";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";

const t = useT();
const vrank = useVRank();

const myRank = computed(() => vrank.myRank);
const unlocked = computed(() => vrank.myRank >= 5);

interface Bucket {
  id: string;
  title: string;
  range: string;
  rule: string;
  tint: string;
  paths: string[];
}
const BUCKETS = computed<Bucket[]>(() => [
  {
    id: "venue",
    title: t.value.agent.buckets.venue.title,
    range: "$1,000 — $10,000",
    rule: t.value.agent.buckets.venue.rule,
    tint: "var(--v5-brand)",
    paths: ["M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z", "M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2", "M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2", "M10 6h4M10 10h4M10 14h4M10 18h4"],
  },
  {
    id: "kol",
    title: t.value.agent.buckets.kol.title,
    range: t.value.agent.bucketRangeFlat,
    rule: t.value.agent.buckets.kol.rule,
    tint: "var(--v5-tech-cyan)",
    paths: ["m3 11 18-5v12L3 14v-3z", "M11.6 16.8a3 3 0 1 1-5.8-1.6"],
  },
  {
    id: "print",
    title: t.value.agent.buckets.print.title,
    range: t.value.agent.bucketRangeQuota,
    rule: t.value.agent.buckets.print.rule,
    tint: "var(--v5-warning)",
    paths: ["M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2", "M6 9V2h12v7", "M6 14h12v8H6z"],
  },
  {
    id: "dev",
    title: t.value.agent.buckets.dev.title,
    range: t.value.agent.bucketRangeHourly,
    rule: t.value.agent.buckets.dev.rule,
    tint: "#30B0C7",
    paths: ["m16 18 6-6-6-6", "m8 6-6 6 6 6"],
  },
]);

interface ApprovedCase {
  name: string;
  host: string;
  amount: number;
  attendees: number;
}
const APPROVED_CASES: ApprovedCase[] = [
  { name: "Tokyo Web3 Summit", host: "Sarah K.", amount: 8500, attendees: 247 },
  { name: "Berlin DePIN Meetup", host: "Marina K.", amount: 3200, attendees: 142 },
  { name: "São Paulo AI Devcon", host: "Diego P.", amount: 6700, attendees: 198 },
];

const date = ref("");
const city = ref("");
const budget = ref(3000);
const budgetText = ref("3000");
const selectedBucketTitle = ref("");

function onBudgetInput() {
  const n = Math.max(0, parseInt(budgetText.value.replace(/\D/g, "")) || 0);
  budget.value = n;
}

const lockedSubText = computed(() =>
  fmt(t.value.agent.lockedSub, { n: vrank.myRank, title: V_RANKS[vrank.myRank].title }),
);
function hostedByText(c: ApprovedCase): string {
  return fmt(t.value.agent.hostedBy, { name: c.host, attendees: c.attendees });
}

function selectBucket(b: Bucket) {
  selectedBucketTitle.value = b.title;
}

function submit() {
  if (!unlocked.value) {
    toast.error(t.value.agent.toastV5Required, t.value.agent.toastV5RequiredSub);
    return;
  }
  if (!date.value || !city.value) {
    toast.error(t.value.agent.toastMissingFields, t.value.agent.toastMissingFieldsSub);
    return;
  }
  toast.success(
    t.value.agent.toastSubmitted,
    fmt(t.value.agent.toastSubmittedSub, { city: city.value, budget: budget.value.toLocaleString() }),
  );
  date.value = "";
  city.value = "";
  budget.value = 3000;
  budgetText.value = "3000";
}

function goBack() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: "/pages/team/team", fail: () => {} }) });
}
function go(url: string) {
  uni.navigateTo({ url, fail: () => {} });
}

// ─── styles ───
const headerStyle: CSSProperties = { gap: "8px", padding: "8px 14px 4px" };
const backBtnStyle: CSSProperties = { width: "36px", height: "36px", marginLeft: "-6px" };
const headerTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "17px",
  fontWeight: 600,
  color: "var(--v5-ink)",
  letterSpacing: "-0.014em",
};
const heroStyle: CSSProperties = {
  padding: "16px",
  background:
    "radial-gradient(80% 60% at 50% 0%, rgba(255,190,61,0.18) 0%, transparent 65%), linear-gradient(180deg, #1A1308 0%, var(--v5-on-brand) 100%)",
  border: "1px solid rgba(255,190,61,0.30)",
};
const heroIconStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  background: "color-mix(in srgb, var(--v5-warning) 20%, transparent)",
};
const heroCapStyle: CSSProperties = { fontSize: "10px", letterSpacing: "0.16em", color: "var(--v5-warning)" };
const heroHeadlineStyle: CSSProperties = { fontSize: "18px", fontWeight: 600, lineHeight: 1.2, marginTop: "2px" };
const heroBodyStyle: CSSProperties = { marginTop: "8px", fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.6 };

const eligibleStyle: CSSProperties = {
  padding: "16px",
  background: "color-mix(in srgb, var(--v5-brand) 8%, transparent)",
  borderColor: "var(--v5-border)",
  borderRadius: "16px",
};
const eligibleIconStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  background: "color-mix(in srgb, var(--v5-brand) 20%, transparent)",
};
const lockedStyle: CSSProperties = {
  padding: "16px",
  background: "color-mix(in srgb, var(--v5-brand-2) 10%, transparent)",
  borderColor: "var(--v5-border)",
  borderRadius: "16px",
};
const lockedIconStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  background: "color-mix(in srgb, var(--v5-brand-2) 20%, transparent)",
};
const pathCtaStyle: CSSProperties = {
  padding: "0 12px",
  height: "44px",
  gap: "4px",
  background: "var(--v5-brand-2)",
  color: "var(--v5-ink)",
  fontSize: "11.5px",
  fontWeight: 600,
};

const bucketStyle: CSSProperties = {
  padding: "14px",
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  borderRadius: "16px",
  gap: "12px",
};
const selectedBucketStyle: CSSProperties = {
  marginTop: "-4px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10.5px",
  color: "var(--v5-brand-2)",
};
function bucketIconStyle(tint: string): CSSProperties {
  return {
    width: "40px",
    height: "40px",
    background: `color-mix(in srgb, ${tint} 18%, transparent)`,
  };
}

const cardStyle: CSSProperties = {
  padding: "16px",
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  borderRadius: "16px",
};
const formCapStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.06em",
  color: "var(--v5-ink-3)",
  marginBottom: "12px",
};
const fieldStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderRadius: "12px",
  padding: "10px 12px",
  border: "1px solid var(--v5-border)",
};
const fieldLabelStyle: CSSProperties = { fontSize: "10px", letterSpacing: "0.05em", color: "var(--v5-ink-3)" };
const inputStyle: CSSProperties = {
  width: "100%",
  background: "transparent",
  fontSize: "12.5px",
  color: "var(--v5-ink)",
};
const budgetInputStyle: CSSProperties = {
  flex: "1",
  background: "transparent",
  fontSize: "12.5px",
  color: "var(--v5-ink)",
  fontFamily: "var(--font-v5)",
};
const submitStyle = computed<CSSProperties>(() => ({
  marginTop: "12px",
  height: "48px",
  gap: "6px",
  fontSize: "12.5px",
  fontWeight: 600,
  background: unlocked.value ? "var(--v5-brand)" : "var(--v5-surface-2)",
  color: unlocked.value ? "var(--v5-on-brand)" : "var(--v5-ink-4)",
}));
const previewOnlyStyle: CSSProperties = {
  marginTop: "8px",
  fontSize: "10.5px",
  color: "var(--v5-ink-3)",
};

const approvedCapStyle: CSSProperties = {
  padding: "0 4px",
  marginBottom: "8px",
  fontSize: "10px",
  letterSpacing: "0.16em",
  color: "var(--v5-ink-3)",
};
const caseStyle: CSSProperties = {
  padding: "12px",
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  borderRadius: "12px",
};
</script>
