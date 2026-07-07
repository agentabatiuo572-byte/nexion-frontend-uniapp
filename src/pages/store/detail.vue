<!--
  Product detail — ported from Nexion-prototype/app/(main)/store/[productId]/
  {page.tsx + _client.tsx}. Dynamic [productId] → `?id=` query (onLoad).

  Wrapped in <AppChassis active="store">. Top→bottom:
    in-page header (back + title/tier) → Hero (ProductRender + ribbon +
    LiveSocialProof + name/tagline/mult + trust chips) → Vs-phone strip →
    ROI (qty stepper + 4-cell grid) → Hardware spec → AI perf spec → Reviews
    (rating summary + bars + 3 rows) → Trust badges → FAQ accordion →
    sticky bottom Buy CTA.

  Phase-gated products (unlocksAtPhase not yet reached) render the shared
  <LockedProductCard> in place of the full page (mirrors ProductDetailGate).
  Dense mock strings (reviews / FAQ / compliance / media) are kept as faithful
  English data, not i18n (matches the source's inline arrays).
-->
<template>
  <AppChassis active="store">
    <view style="color: var(--v5-ink)">
      <!-- Back + title/tier now live in the sticky chassis nav header
           (useSetPageHeader below) so they pin on scroll + frost content,
           mirroring the prototype's SetPageHeader. -->

      <!-- Product not found -->
      <view v-if="!product" class="mx-4 mt-2 rounded-2xl border grid place-items-center" :style="notFoundStyle">
        <text style="font-size: 13.5px; color: var(--v5-ink-3)">{{ t.store.coProductNotFound }}</text>
      </view>

      <!-- Phase-gated → coming-soon lock card -->
      <template v-else-if="isLocked">
        <LockedProductCard :product="product" />
        <view aria-hidden style="height: 32px" />
      </template>

      <!-- Full detail -->
      <template v-else>
        <!-- === Section 1: Hero === -->
        <view class="mx-4 mt-1 rounded-2xl border overflow-hidden relative" :style="heroCardStyle">
          <view aria-hidden :style="auroraStyle" />

          <view class="relative border-b" style="border-color: var(--v5-border)">
            <ProductRender :tier="product.tier" />
            <!-- Folded-corner ribbon -->
            <view v-if="product.badge" class="absolute" :style="ribbonStyle">
              <text>{{ product.badge }}</text>
            </view>
            <!-- Live activity danmaku -->
            <LiveSocialProof :product="product" />
          </view>

          <view class="relative" style="padding: 20px">
            <!-- name + tagline + mult-badge -->
            <view class="flex items-start justify-between" style="gap: 12px">
              <view class="min-w-0">
                <text class="block truncate" :style="nameStyle">{{ product.name }}</text>
                <text class="block" style="margin-top: 4px; font-size: 13.5px; color: var(--v5-ink-3)">{{ product.tagline }}</text>
              </view>
              <text v-if="!isShare" class="shrink-0 tabular-nums" :style="multBadgeStyle">{{ speedup }}×</text>
            </view>

            <!-- trust chips -->
            <view class="flex flex-wrap" style="margin-top: 14px; gap: 8px">
              <text class="font-mono-tabular" :style="codeChip('success')">✓ {{ soldText }} sold</text>
              <text v-if="stockLow" class="font-mono-tabular" :style="codeChip('amber')">🔥 only {{ product.stock }} left</text>
            </view>
          </view>
        </view>

        <!-- === Section 1.5: Cloud Share daily output (entry device — same earning model as the card) === -->
        <view v-if="isShare" class="mx-4 mt-3 rounded-2xl border" style="padding: 16px 18px; background: var(--v5-surface); border-color: var(--v5-border)">
          <view class="font-mono-tabular inline-flex items-center" style="gap: 6px; font-size: 10.5px; font-weight: 500; letter-spacing: 0.08em; color: var(--v5-warning)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></svg>
            <text>{{ t.store.cardYouEarn }}</text>
          </view>
          <view class="flex items-baseline flex-wrap" style="margin-top: 6px; gap: 8px">
            <text class="tabular-nums" style="font-family: var(--font-v5); font-weight: 600; font-size: 30px; color: var(--v5-warning); letter-spacing: -0.022em; line-height: 1">${{ dailyEarnText }}<text style="font-size: 14px; color: var(--v5-ink-3); font-weight: 500">{{ t.store.cardPerDaySuffix }}</text></text>
            <text class="font-mono-tabular tabular-nums" style="margin-left: auto; font-size: 12.5px; color: var(--v5-warning); font-weight: 500">+{{ product.dailyEarnNEX }} NEX/d</text>
          </view>
        </view>

        <!-- === Section 2: Vs phone strip === -->
        <view v-if="!isShare" class="mx-4 mt-3 rounded-2xl border flex items-center" :style="vsStripStyle">
          <view class="flex items-center min-w-0" style="gap: 6px; font-size: 11.5px; color: var(--v5-ink-3)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" /></svg>
            <text class="truncate">{{ t.store.detYourPhone }}</text>
            <text class="tabular-nums" style="font-family: var(--font-v5); color: var(--v5-warning)">$0.06/d</text>
          </view>
          <text class="shrink-0" style="font-size: 12px; color: var(--v5-ink-4)">↔</text>
          <view class="flex-1 flex items-center justify-end min-w-0" style="gap: 6px; font-size: 11.5px; color: var(--v5-warning)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
            <text class="tabular-nums" style="font-family: var(--font-v5); font-weight: 600">${{ dailyEarnText }}/d</text>
          </view>
          <text class="shrink-0" :style="vsMultChipStyle">{{ speedup }}×</text>
        </view>

        <!-- === Section 4: ROI calc — qty stepper + 4-cell grid === -->
        <template v-if="!isShare">
          <view style="padding: 22px 16px 4px"><SectionHeader :title="t.store.detEstReturns" :count="t.store.detEstReturnsMeta" /></view>
          <view class="mx-4 rounded-2xl border" :style="roiCardStyle">
            <!-- qty stepper -->
            <view class="flex items-center justify-between">
              <text style="font-size: 13.5px; color: var(--v5-ink-3)">{{ t.store.detQuantity }}</text>
              <view class="flex items-center" :style="stepperStyle">
                <view class="grid place-items-center active:scale-[0.95] transition-transform" :style="qtyBtnStyle(qty <= 1)" role="button" tabindex="0" aria-label="Decrease quantity" @click.stop="dec">
                  <text>−</text>
                </view>
                <text class="tabular-nums text-center" :style="qtyNumStyle">{{ qty }}</text>
                <view class="grid place-items-center active:scale-[0.95] transition-transform" :style="qtyBtnStyle(qty >= 6)" role="button" tabindex="0" aria-label="Increase quantity" @click.stop="inc">
                  <text>+</text>
                </view>
              </view>
            </view>

            <!-- 4-cell roi-grid -->
            <view class="grid" style="margin-top: 16px; grid-template-columns: 1fr 1fr">
              <view :style="roiCellStyle(0)">
                <text class="block font-mono-tabular" :style="roiLabelStyle">{{ t.store.detDaily }}</text>
                <text class="block tabular-nums" :style="roiValStyle('success')">${{ dailyYieldText }}</text>
                <text class="block" :style="roiSubStyle">{{ t.store.detVsPhone }}</text>
              </view>
              <view :style="roiCellStyle(1)">
                <text class="block font-mono-tabular" :style="roiLabelStyle">{{ t.store.detMonthly }}</text>
                <text class="block tabular-nums" :style="roiValStyle('success')">${{ monthlyYieldText }}</text>
                <text class="block" :style="roiSubStyle">{{ monthlyPctText }}{{ t.store.detPerMoSuffix }}</text>
              </view>
              <view :style="roiCellStyle(2)">
                <text class="block font-mono-tabular" :style="roiLabelStyle">{{ t.store.detAnnual }}</text>
                <text class="block tabular-nums" :style="roiValStyle('success')">${{ annualYieldText }}</text>
                <text class="block" :style="roiSubStyle">{{ annualPctText }}{{ t.store.detRoiSuffix }}</text>
              </view>
              <view :style="roiCellStyle(3)">
                <text class="block font-mono-tabular" :style="roiLabelStyle">{{ t.store.detPayback }}</text>
                <text class="block tabular-nums" :style="roiValStyle('brand')">{{ paybackDays }}<text style="font-size: 13px; color: var(--v5-ink-3); font-weight: 500; margin-left: 1px">{{ t.store.detDaySuffix }}</text></text>
                <text class="block" :style="roiSubStyle">{{ t.store.detToBreakEven }}</text>
              </view>
            </view>
          </view>
        </template>

        <!-- === Section 5: Hardware spec === -->
        <view style="padding: 22px 16px 4px"><SectionHeader :title="t.store.detHardware" /></view>
        <SpecTable :rows="hardwareSpecs" />

        <!-- === Section 6: AI performance spec === -->
        <template v-if="aiPerfRows.length > 0">
          <view style="padding: 22px 16px 4px"><SectionHeader :title="t.store.detAiPerf" /></view>
          <SpecTable :rows="aiPerfRows" brand-value />
        </template>

        <!-- === Section 7: Reviews === -->
        <view style="padding: 22px 16px 4px"><SectionHeader :title="t.store.detReviews" :count="verifiedText" /></view>
        <view class="mx-4 rounded-2xl border" :style="reviewsCardStyle">
          <!-- rating summary: big rating + 5 bars -->
          <view class="flex items-start" style="gap: 16px; padding-top: 16px; padding-bottom: 12px">
            <view class="text-center" style="min-width: 50px">
              <text class="block tabular-nums" :style="ratingBigStyle">{{ ratingText }}</text>
              <view class="flex justify-center" style="gap: 1px; margin-top: 4px; color: var(--v5-warning)">
                <svg v-for="i in 5" :key="i" width="10" height="10" viewBox="0 0 24 24" :fill="i <= ratingRounded ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5 14 8l6 .5-4.5 4 1.4 6L11.5 15l-5.4 3.5L7.5 12.5 3 8.5l6-.5z" /></svg>
              </view>
            </view>
            <view class="flex-1 min-w-0" style="display: flex; flex-direction: column; gap: 4px">
              <view v-for="b in ratingBars" :key="b.star" class="flex items-center" style="gap: 8px">
                <text class="tabular-nums" style="width: 10px; font-size: 11px; color: var(--v5-ink-3)">{{ b.star }}</text>
                <RatingBar :pct="b.pct" />
                <text class="tabular-nums text-right" style="width: 30px; font-size: 10.5px; color: var(--v5-ink-3)">{{ b.pct }}%</text>
              </view>
            </view>
          </view>

          <view style="height: 1px; background: var(--v5-border)" />

          <!-- 3 review rows -->
          <view v-for="(r, i) in reviews" :key="i" class="flex items-start" :style="reviewRowStyle(i)">
            <view class="grid place-items-center shrink-0" :style="avatarStyle(r.color)">
              <text :style="avatarTextStyle">{{ r.name.charAt(0) }}</text>
            </view>
            <view class="min-w-0 flex-1">
              <view class="flex items-center" style="gap: 8px">
                <text :style="reviewNameStyle">{{ r.name }}</text>
                <text class="font-mono-tabular" style="font-size: 11px; color: var(--v5-warning)">{{ starStr(r.stars) }}<text style="color: var(--v5-ink-4)">{{ starStr(5 - r.stars) }}</text></text>
              </view>
              <text class="block" style="margin-top: 4px; font-size: 13px; color: var(--v5-ink-2); line-height: 1.625">{{ r.text }}</text>
              <text class="block font-mono-tabular" style="margin-top: 4px; font-size: 11px; color: var(--v5-ink-4)">{{ r.time }}</text>
            </view>
          </view>

          <view class="text-center" style="padding: 12px 0">
            <text :style="readAllStyle">{{ readAllText }}</text>
          </view>
        </view>

        <!-- === Section 8: Trust badges === -->
        <view style="padding: 22px 16px 4px"><SectionHeader :title="t.store.detTrustedBy" /></view>
        <view class="mx-4 rounded-2xl border" :style="trustCardStyle">
          <text class="block" style="font-size: 13px; color: var(--v5-ink-3)">{{ t.store.detFeaturedIn }}</text>
          <view class="flex flex-wrap" style="margin-top: 12px; gap: 18px">
            <text v-for="m in featuredMedia" :key="m" :style="mediaStyle">{{ m }}</text>
          </view>

          <view style="height: 1px; background: var(--v5-border); margin: 16px 0" />

          <text class="block" style="font-size: 13px; color: var(--v5-ink-3)">{{ t.store.detCompliance }}</text>
          <view class="flex flex-wrap" style="margin-top: 10px; gap: 8px">
            <text v-for="c in compliance" :key="c" :style="complianceChipStyle">{{ c }}</text>
          </view>
        </view>

        <!-- === Section 9: FAQ accordion === -->
        <view style="padding: 22px 16px 4px"><SectionHeader :title="t.store.detFaq" /></view>
        <view class="mx-4 rounded-2xl border" :style="faqCardStyle">
          <view v-for="(f, i) in faqs" :key="i" :style="faqItemStyle(i)">
            <view class="w-full flex items-center justify-between text-left active:opacity-80" :style="faqQStyle" role="button" tabindex="0" :aria-label="f.q" @click.stop="toggleFaq(i)">
              <text class="flex-1" style="padding-right: 8px">{{ f.q }}</text>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" :style="{ transform: openFaq === i ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }"><path d="m9 18 6-6-6-6" /></svg>
            </view>
            <view v-if="openFaq === i" style="padding-bottom: 12px; padding-right: 24px; margin-top: -4px">
              <text style="font-size: 13px; color: var(--v5-ink-3); line-height: 1.625">{{ f.a }}</text>
            </view>
          </view>
        </view>

        <!-- Bottom spacer — clears the chassis-level <StickyCtaBar> (driven by
             useStickyCTA below; renders inside the bezel, absolute not fixed). -->
        <view aria-hidden style="height: 96px" />
      </template>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, type CSSProperties } from "vue";
import { onLoad, onHide } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SectionHeader from "@/components/store/section-header.vue";
import ProductRender from "@/components/store/product-render.vue";
import LiveSocialProof from "@/components/store/live-social-proof.vue";
import SpecTable from "@/components/store/spec-table.vue";
import RatingBar from "@/components/store/rating-bar.vue";
import LockedProductCard from "@/components/store/locked-product-card.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { getProduct, type Product } from "@/mock/products";
import { useProductPhase } from "@/composables/use-product-phase";
import { isPhaseReached } from "@/store/product-phase";
import { useSetPageHeader } from "@/composables/use-page-header";
import { useStickyCTA } from "@/store/sticky-cta-bar";
import { usePurchaseGate } from "@/composables/use-purchase-gate";

const t = useT();
const phase = useProductPhase();

const id = ref("");
onLoad((options) => {
  const o = (options || {}) as Record<string, string>;
  if (o.id) id.value = o.id;
});

const product = computed<Product | undefined>(() => (id.value ? getProduct(id.value) : undefined));
const isShare = computed(() => product.value?.tier === "Share");

// Phase gate: a product with unlocksAtPhase not yet reached shows the lock card.
const isLocked = computed(() => {
  const p = product.value;
  if (!p || !p.unlocksAtPhase) return false;
  return !isPhaseReached(phase.value, p.unlocksAtPhase);
});

// Per-user purchase gate (等级门 + 锁额) — drives the sticky Buy CTA below.
const { gate: purchaseGate } = usePurchaseGate(product);

// Sticky chassis nav header (back + centered title/tier) — replaces the old
// in-page back row so it pins on scroll + frosts content (mirrors prototype
// SetPageHeader). Getter form: title resolves once the product loads (onLoad).
useSetPageHeader(() => ({
  title: product.value?.name ?? t.value.store.coProductNotFound,
  subtitle: product.value?.tier,
  backHref: "/store",
}));

// ── derived ROI math (mirrors page.tsx + _client.tsx) ──
const qty = ref(1);
const openFaq = ref(0);

const PHONE_RATE = 0.06;
const speedup = computed(() =>
  product.value && !isShare.value
    ? Math.round(product.value.dailyEarn / PHONE_RATE)
    : 0,
);
const dailyYield = computed(() => (product.value?.dailyEarn ?? 0) * qty.value);
const monthlyYield = computed(() => dailyYield.value * 30);
const annualYield = computed(() => dailyYield.value * 365);
const totalPrice = computed(() => (product.value?.price ?? 0) * qty.value);
const paybackDays = computed(() =>
  product.value && !isShare.value && dailyYield.value > 0
    ? Math.round(totalPrice.value / dailyYield.value)
    : 0,
);
const paybackLabel = computed(() => {
  if (!product.value || isShare.value) return "";
  const d = Math.round(product.value.price / product.value.dailyEarn);
  return d >= 60 ? `${(d / 30).toFixed(1)} months` : `${d} days`;
});

// Hardware spec rows — real fields + plausible managed-service spec
const hardwareSpecs = computed<{ k: string; v: string }[]>(() => {
  const p = product.value;
  if (!p) return [];
  return [
    { k: "GPU", v: p.gpu },
    { k: "VRAM", v: p.vram },
    { k: "Power", v: p.power ?? "—" },
    { k: "Datacenter", v: "Singapore" },
    { k: "Uptime SLA", v: "99.9%" },
    { k: "Warranty", v: "24 months" },
  ];
});

// AI perf rows from product.ai
const aiPerfRows = computed<{ k: string; v: string }[]>(() => {
  const ai = product.value?.ai;
  if (!ai) return [];
  const rows: { k: string; v: string }[] = [];
  if (ai.imageGenPerMin) rows.push({ k: "Image gen (SDXL)", v: `${ai.imageGenPerMin} img/min` });
  if (ai.llmTokensPerSec) rows.push({ k: "LLM inference", v: `${(ai.llmTokensPerSec / 1000).toFixed(1)}k tok/sec` });
  if (ai.videoMinPerHour) rows.push({ k: "Video gen", v: `${ai.videoMinPerHour} min / hour` });
  if (ai.fineTuneMins) rows.push({ k: "Fine-tune (LoRA)", v: `~${ai.fineTuneMins} min` });
  if (ai.unlocks) rows.push({ k: "Unlocks pool", v: ai.unlocks });
  return rows;
});

// Mock reviews / FAQ / trust — faithful English data (not i18n; matches source)
const reviews = [
  { name: "Maya · ID", stars: 5, time: "2 days ago", text: "Paid back in about 3 months. Withdrew $186 first month no questions.", color: "#C68316" },
  { name: "cypher.eth", stars: 5, time: "1 week ago", text: "Tax-deductible business expense, AI workloads are legitimate. Best ROI in my portfolio.", color: "#7250C8" },
  { name: "Hideo · JP", stars: 4, time: "2 weeks ago", text: "Stable yields. Customer service slow on the first activation. Now running fine.", color: "#0E8E4A" },
];
const ratingBars = [
  { star: 5, pct: 78 },
  { star: 4, pct: 15 },
  { star: 3, pct: 4 },
  { star: 2, pct: 2 },
  { star: 1, pct: 1 },
];
const featuredMedia = ["Forbes", "CoinDesk", "TechCrunch", "The Block"];
const compliance = ["SOC 2 Type II", "ISO 27001", "Chainalysis KYT"];
const faqs = [
  { q: "Where is the device physically?", a: "In our Singapore datacenter. You never receive hardware — all maintenance and power is included." },
  { q: "Can I withdraw earnings anytime?", a: "Yes, from $20. First withdrawal processes within 24 hours. KYC-Express ($1 deposit) required to verify your wallet." },
  { q: "What if AI demand drops?", a: "Earnings scale with AI workload pool pricing. Historical floor: $24/day even during low-demand periods." },
  { q: "Is there a refund window?", a: "7-day money-back if device hasn't been activated. After activation, resale on marketplace." },
];

// ── text helpers (toFixed / toLocaleString / fmt out of template) ──
const stockLow = computed(
  () => !isShare.value && product.value?.stock != null && product.value.stock < 50,
);
const soldText = computed(() => (product.value?.sold ?? 0).toLocaleString());
const dailyEarnText = computed(() => (product.value?.dailyEarn ?? 0).toFixed(2));
const dailyYieldText = computed(() => dailyYield.value.toFixed(2));
const monthlyYieldText = computed(() => monthlyYield.value.toFixed(0));
const annualYieldText = computed(() => annualYield.value.toFixed(0));
const monthlyPctText = computed(() =>
  totalPrice.value > 0 ? ((monthlyYield.value / totalPrice.value) * 100).toFixed(1) : "0",
);
const annualPctText = computed(() =>
  totalPrice.value > 0 ? ((annualYield.value / totalPrice.value) * 100).toFixed(0) : "0",
);
const priceText = computed(() => (product.value?.price ?? 0).toLocaleString());
const ratingText = computed(() => (product.value?.rating ?? 0).toFixed(1));
const ratingRounded = computed(() => Math.round(product.value?.rating ?? 0));
const verifiedText = computed(() =>
  fmt(t.value.store.detVerified, { n: (product.value?.reviews ?? 0).toLocaleString() }),
);
const readAllText = computed(() =>
  fmt(t.value.store.detReadAll, { n: (product.value?.reviews ?? 0).toLocaleString() }),
);
function starStr(n: number): string {
  return "★".repeat(Math.max(0, n));
}

function dec() {
  if (qty.value > 1) qty.value -= 1;
}
function inc() {
  if (qty.value < 6) qty.value += 1;
}
function toggleFaq(i: number) {
  openFaq.value = openFaq.value === i ? -1 : i;
}
// Chassis-level sticky bottom Buy CTA (replaces the old page-level fixed-position
// bar, which positioned against the viewport — wrong inside the bezel). useStickyCTA
// → the chassis-mounted <StickyCtaBar> renders it correctly (absolute). Re-syncs as
// product/qty resolve; cleared on hide/unmount so it never bleeds to the next page.
const sticky = useStickyCTA();
watch(
  [product, isShare, isLocked, priceText, dailyEarnText, paybackLabel, purchaseGate],
  () => {
    if (!product.value || isLocked.value) {
      sticky.hide();
      return;
    }
    // Purchase gate blocks → CTA routes to /team/quota with locked label, not checkout.
    if (purchaseGate.value.blocked) {
      sticky.show({
        href: "/pages/team/quota",
        amount: `$${priceText.value}`,
        amountSubtext: purchaseGate.value.soldOut
          ? t.value.store.gateSoldOut
          : fmt(t.value.store.gateProgress, { pct: Math.round(purchaseGate.value.progressPct * 100) }),
        buttonLabel: purchaseGate.value.soldOut
          ? t.value.store.gateSoldOut
          : t.value.store.gateLockedCta,
        showTabBar: false,
      });
      return;
    }
    sticky.show({
      href: `/pages/store/checkout?product=${product.value.id}`,
      amount: `$${priceText.value}`,
      amountSubtext: isShare.value ? undefined : `$${dailyEarnText.value}/d · ${paybackLabel.value} payback`,
      buttonLabel: t.value.store.cardBuyNow,
      showTabBar: false,
    });
  },
  { immediate: true },
);
onHide(() => sticky.hide());
onUnmounted(() => sticky.hide());

// ─── styles ───
const notFoundStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "40px 16px",
};
const heroCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
};
const auroraStyle: CSSProperties = {
  position: "absolute",
  inset: "-20%",
  background:
    "radial-gradient(40% 50% at 80% 20%, var(--v5-tech-cyan-soft) 0%, transparent 60%)," +
    "radial-gradient(40% 50% at 10% 80%, var(--v5-brand-soft) 0%, transparent 60%)," +
    "radial-gradient(35% 45% at 70% 90%, rgba(255,203,148,0.18) 0%, transparent 60%)",
  filter: "blur(10px)",
  pointerEvents: "none",
  opacity: 0.7,
  animation: "v5-aurora-drift 14s ease-in-out infinite",
};
const ribbonStyle: CSSProperties = {
  top: 0,
  left: "16px",
  padding: "3px 10px 4px",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontVariantNumeric: "tabular-nums",
  fontSize: "11px",
  fontWeight: 500,
  borderRadius: "0 0 6px 6px",
  letterSpacing: "-0.005em",
  zIndex: 2,
  pointerEvents: "none",
};
const nameStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "26px",
  fontWeight: 600,
  letterSpacing: "-0.024em",
  color: "var(--v5-ink)",
};
const multBadgeStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "22px",
  letterSpacing: "-0.024em",
  color: "var(--v5-brand-2)",
  whiteSpace: "nowrap",
};
function codeChip(tone: "success" | "amber"): CSSProperties {
  const palette =
    tone === "success"
      ? { bg: "var(--v5-success-soft)", color: "var(--v5-success)" }
      : { bg: "var(--v5-brand-2-soft)", color: "var(--v5-brand-2)" };
  return {
    padding: "3px 9px",
    borderRadius: "4px",
    background: palette.bg,
    color: palette.color,
    fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "-0.005em",
  };
}
const vsStripStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "12px 14px",
  gap: "12px",
};
const vsMultChipStyle: CSSProperties = {
  padding: "4px 10px",
  borderRadius: "999px",
  background: "var(--v5-brand-soft)",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "15px",
  color: "var(--v5-brand)",
  letterSpacing: "-0.014em",
  lineHeight: 1,
};
const roiCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "16px",
};
const stepperStyle: CSSProperties = {
  borderRadius: "999px",
  border: "1px solid var(--v5-border)",
  background: "var(--v5-surface-2)",
  overflow: "hidden",
};
function qtyBtnStyle(disabled: boolean): CSSProperties {
  return {
    width: "36px",
    height: "36px",
    fontFamily: "var(--font-v5)",
    fontSize: "18px",
    fontWeight: 500,
    color: disabled ? "var(--v5-ink-4)" : "var(--v5-ink)",
    opacity: disabled ? 0.4 : 1,
  };
}
const qtyNumStyle: CSSProperties = {
  minWidth: "36px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "18px",
  color: "var(--v5-ink)",
  letterSpacing: "-0.014em",
};
function roiCellStyle(index: number): CSSProperties {
  return {
    padding: "14px 16px",
    borderRight: index % 2 === 0 ? "1px solid color-mix(in srgb, var(--v5-border) 50%, transparent)" : "none",
    borderBottom: index < 2 ? "1px solid color-mix(in srgb, var(--v5-border) 50%, transparent)" : "none",
  };
}
const roiLabelStyle: CSSProperties = { fontSize: "11px", color: "var(--v5-ink-4)" };
function roiValStyle(tone: "success" | "brand" | "ink"): CSSProperties {
  const color =
    tone === "success" ? "var(--v5-warning)" : tone === "brand" ? "var(--v5-brand)" : "var(--v5-ink)";
  return {
    fontFamily: "var(--font-v5)",
    fontSize: "20px",
    fontWeight: 600,
    color,
    letterSpacing: "-0.018em",
    lineHeight: 1,
    marginTop: "4px",
  };
}
const roiSubStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", marginTop: "4px" };
const reviewsCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "4px 14px",
};
const ratingBigStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "26px",
  fontWeight: 600,
  color: "var(--v5-ink)",
  letterSpacing: "-0.022em",
  lineHeight: 1,
};
function reviewRowStyle(i: number): CSSProperties {
  return {
    gap: "12px",
    padding: "12px 0",
    borderBottom: i < reviews.length - 1 ? "1px solid var(--v5-border)" : "none",
  };
}
function avatarStyle(color: string): CSSProperties {
  return { width: "32px", height: "32px", borderRadius: "50%", background: color };
}
const avatarTextStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "13.5px",
  color: "var(--v5-ink)",
};
const reviewNameStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 500,
  color: "var(--v5-ink)",
};
const readAllStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 500,
  color: "var(--v5-brand)",
};
const trustCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "16px",
};
const mediaStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "13px",
  color: "var(--v5-ink-2)",
};
const complianceChipStyle: CSSProperties = {
  padding: "4px 10px",
  borderRadius: "999px",
  background: "var(--v5-surface-2)",
  border: "1px solid var(--v5-border)",
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--v5-ink-2)",
  letterSpacing: "-0.005em",
};
const faqCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "0 14px",
};
function faqItemStyle(i: number): CSSProperties {
  return { borderBottom: i < faqs.length - 1 ? "1px solid var(--v5-border)" : "none" };
}
const faqQStyle: CSSProperties = {
  padding: "14px 0",
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 500,
  color: "var(--v5-ink)",
  letterSpacing: "-0.005em",
};
</script>
