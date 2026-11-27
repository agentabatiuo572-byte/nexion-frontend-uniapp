<template>
  <view>
    <!-- Focal card: the same five rows at fixed heights while loading, failed, pending or detected, so nothing moves. -->
    <view class="est-hero nx-soft-glass" :class="{ 'anim-up': view === 'detected' }">
      <view class="est-hero__art" aria-hidden="true">
        <view class="est-hero__floor" />
        <image class="est-hero__img" src="/static/img/home-glass-20260928/phone.webp" mode="aspectFit" />
      </view>
      <view class="est-hero__body">
        <view class="est-hero__top">
          <text class="est-hero__name">{{ t.onboarding.yourPhone }}</text>
          <NxTag tone="success" class="est-hero__tag" :class="{ 'est-hero__tag--skel': view === 'loading', 'est-hero__tag--ghost': view === 'read-failed' }" :aria-hidden="view !== 'detected'">
            <svg class="est-hero__tag-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>{{ t.onboarding.detected }}
          </NxTag>
        </view>
        <text class="est-hero__k">{{ t.bundle.estimatedDaily }}</text>
        <template v-if="view === 'loading'">
          <view class="est-amt"><view class="ob-skel" style="width: 112px; height: 32px" /></view>
          <view class="est-amt2"><view class="ob-skel" style="width: 72px; height: 14px" /></view>
          <view class="est-basis"><view class="ob-skel" style="width: 96px; height: 12px" /></view>
        </template>
        <template v-else-if="view === 'read-failed'">
          <view class="est-amt est-amt--unknown" :aria-label="'—' + usdtPerDay"><text>—</text><text class="est-amt__u">{{ usdtPerDay }}</text></view>
          <view class="est-amt2" :aria-label="'—' + uvtPerDay"><text>—</text><text class="est-amt2__u">{{ uvtPerDay }}</text></view>
          <text class="est-basis"><text class="est-basis__v est-basis__v--unknown">—</text>{{ '\u00A0' + t.onboarding.phoneComputeUnit }}</text>
        </template>
        <template v-else>
          <view :id="countHost" class="est-amt" :count-up="countConfig" :change:count-up="countUp.update" :aria-label="phoneUsdtLabel + usdtPerDay">
            <text class="est-amt__int nx-count--int" aria-hidden="true">{{ phoneUsdtParts.int }}</text><text v-if="phoneUsdtParts.dec" class="est-amt__dec nx-count--frac" aria-hidden="true">{{ phoneUsdtParts.dec }}</text><text class="est-amt__u" aria-hidden="true">{{ usdtPerDay }}</text>
          </view>
          <view class="est-amt2 est-detail" :aria-label="phoneUvtLabel + uvtPerDay">
            <text aria-hidden="true">{{ phoneUvtLabel }}</text><text class="est-amt2__u" aria-hidden="true">{{ uvtPerDay }}</text>
          </view>
          <text class="est-basis est-detail"><text class="est-basis__v">{{ calibration?.computeValue ?? '—' }}</text>{{ '\u00A0' + t.onboarding.phoneComputeUnit }}</text>
        </template>
      </view>
    </view>

    <!-- Device comparison: text and a ratio bar per row (no SKU identity, so no device image); unit and period once in the column head. -->
    <template v-if="view !== 'detected' || compareRows.length">
      <text class="est-sec">{{ t.onboarding.unlockMore }}</text>
      <view class="est-list" :class="{ 'anim-up-delay': view === 'detected' }" :role="view === 'detected' ? 'list' : undefined">
        <view class="est-list__head" aria-hidden="true"><text>{{ t.onboarding.colModel }}</text><text>{{ 'USDT' + t.onboarding.perDay }}</text></view>
        <template v-if="view === 'detected'">
          <view v-for="row in compareRows" :key="row.key" class="est-row" role="listitem" :aria-label="row.label + ', ' + row.times + ', ' + row.value + usdtPerDay">
            <view class="est-row__t" aria-hidden="true">
              <text class="est-row__n">{{ row.label }}</text>
              <text class="est-row__s">{{ row.times }}</text>
            </view>
            <text class="est-row__v" aria-hidden="true">{{ row.value }}</text>
            <view v-if="compareRows.length > 1" class="est-row__bar nx-progress" aria-hidden="true" :aria-valuenow="row.pct"><view class="nx-progress__fill nx-viz-grow" :style="{ width: row.pct + '%' }" /></view>
          </view>
        </template>
        <template v-else>
          <view v-for="n in 2" :key="n" class="est-row est-row--skel" aria-hidden="true">
            <view class="est-row__t"><view class="est-row__n"><view class="ob-skel" style="width: 128px; height: 14px" /></view><view class="est-row__s"><view class="ob-skel" style="width: 96px; height: 12px" /></view></view>
            <view class="est-row__v"><view class="ob-skel" style="width: 36px; height: 16px" /></view>
            <view class="est-row__bar nx-progress" />
          </view>
        </template>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, ref, watch } from "vue";
import type { OnboardingCalibration } from "@/api/onboarding-calibration-api";
import type { CountUpConfig } from "@/lib/count-up-view";
import { useT } from "@/i18n/use-t";
import { formatEstimate } from "@/lib/estimate-display";
import { claimPhoneEarningsEntrance } from "@/lib/phone-earnings-entrance";
import NxTag from "@/components/ui/nx-tag.vue";

const props = defineProps<{ view: "loading" | "read-failed" | "detected"; calibration: OnboardingCalibration | null; shown: boolean }>();
const t = useT();
const comparison = (key: string) => computed(() => props.calibration?.comparisonConfig.find((item) => item.key === key) ?? null);
const phone = comparison("phone");
const s1 = comparison("s1");
const pro = comparison("pro");
const phoneRate = computed(() => props.calibration?.baseRateUsdt ?? phone.value?.dailyUsdt ?? null);
const phoneUvt = computed(() => props.calibration?.baseRateNex ?? phone.value?.dailyNex ?? null);
// Estimates show two significant figures (06 §6.2, formatEstimate); ratios and bars use the raw daily USDT.
const phoneUsdtLabel = computed(() => phoneRate.value === null ? "—" : formatEstimate(phoneRate.value));
const phoneUsdtParts = computed(() => { const [int, dec] = phoneUsdtLabel.value.split("."); return { int, dec: dec ? `.${dec}` : "" }; });
const phoneUvtLabel = computed(() => phoneUvt.value === null ? "—" : formatEstimate(phoneUvt.value));
// Number and unit never part (03 §3.6.1): the unit is joined with a no-break space, on screen and in the spoken label.
const usdtPerDay = computed(() => "\u00A0USDT" + t.value.onboarding.perDay);
const uvtPerDay = computed(() => "\u00A0UVT" + t.value.onboarding.perDay);
const compareRows = computed(() => {
  const rows = [s1.value, pro.value].filter((row): row is NonNullable<typeof row> => row !== null);
  const max = Math.max(0, ...rows.map((row) => row.dailyUsdt));
  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    value: formatEstimate(row.dailyUsdt),
    times: phoneRate.value ? t.value.onboarding.timesPhoneDaily.replace("{n}", String(Math.round(row.dailyUsdt / phoneRate.value))) : "",
    pct: max > 0 ? Math.round(row.dailyUsdt / max * 1000) / 10 : 0,
  }));
});

const hostPrefix = `onboarding-estimate-${getCurrentInstance()!.uid}`;
const countHost = ref(hostPrefix);
const countEntrance = ref(false);
let hostVersion = 0;
let lastCountKey: string | null = null;
watch(() => {
  const result = props.calibration;
  return props.shown && props.view === "detected" && phoneRate.value !== null && result
    ? JSON.stringify([result.userId, result.deviceId, result.revision]) : null;
}, (key) => {
  if (key === null) {
    // Stop on the same host so renderjs can restore the final amount.
    countEntrance.value = false;
    return;
  }
  if (key === lastCountKey) return;
  lastCountKey = key;
  countEntrance.value = claimPhoneEarningsEntrance(key);
  countHost.value = `${hostPrefix}-${++hostVersion}`;
}, { immediate: true });
const countConfig = computed<CountUpConfig>(() => ({
  hostId: countHost.value,
  kind: "estimate",
  follow: false,
  value: props.view === "detected" && phoneRate.value !== null ? Number(phoneUsdtLabel.value.replace(/,/g, "")) : null,
  count: countEntrance.value,
}));
</script>

<script module="countUp" lang="renderjs">
import { countUpView } from "@/lib/count-up-view";
// @ts-expect-error vue-tsc treats the renderjs block as a second normal script.
export default countUpView;
</script>

<style scoped>
/* Focal card (01 §1.1.2 soft glass, no blur): phone art left, five fixed-height rows right. */
.est-hero { position: relative; flex: none; display: flex; align-items: center; gap: 16px; padding: 20px; border-radius: var(--ui-radius-surface, 22px); overflow: hidden; }
.est-hero__art { position: relative; flex: none; width: 92px; height: 104px; }
.est-hero__img { position: absolute; left: -25%; top: -22%; width: 150%; height: 150%; object-fit: contain; z-index: 1; }
.est-hero__floor { position: absolute; left: -10px; right: -10px; bottom: -4px; height: 30px; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-tech-cyan) 30%, transparent), transparent); }
[data-theme="light"] .est-hero__floor { background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-tech-cyan) 26%, transparent), transparent); }
.est-hero__body { flex: 1; min-width: 0; }
.est-hero__top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 8px; }
.est-hero__name { flex: 0 1 auto; min-width: 0; font: var(--ui-type-subheading-weight) var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: break-word; }
.est-hero__tag-icon { flex: none; margin-right: 4px; }
.est-hero__tag--skel { background: color-mix(in srgb, var(--v5-ink) 9%, transparent); color: transparent; }
.est-hero__tag--skel .est-hero__tag-icon, .est-hero__tag--ghost { visibility: hidden; }
.est-hero__k { display: block; margin-top: 12px; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
/* Main amount (01 §1.2, 10.2 弹层主金额 size): Montserrat 500, decimals and unit ink-3. The integer is the card's one brand key
   figure (01 §1.1.1 rule 4), the same composition as the trial claim card's 预计收益 (04.1 主金额字体、主题色; 01 §1.2 同一指标跨页同一组成). */
.est-amt { display: flex; align-items: baseline; height: var(--ui-type-wallet-amount-lh); margin-top: 4px; font: 500 var(--ui-type-wallet-amount)/var(--ui-type-wallet-amount-lh) var(--font-amount); letter-spacing: -.02em; color: var(--v5-brand); }
.est-amt__dec { color: var(--v5-ink-3); }
.est-amt__u { font: 500 max(12px, .4em)/1 var(--font-v5); letter-spacing: 0; color: var(--v5-ink-3); }
.est-amt--unknown { color: var(--v5-ink-3); }
.est-amt2 { display: flex; align-items: baseline; height: var(--ui-type-subheading-lh); margin-top: 2px; font: 500 var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-amount); color: var(--v5-ink-3); }
.est-amt2__u { font: 500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.est-basis { display: block; height: var(--ui-type-description-lh); margin-top: 4px; white-space: nowrap; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
/* 10.1 行内数值: a non-amount metric inline, JetBrains Mono 500 (01 §1.2); the row keeps its line height so all states stay level. */
.est-basis__v { font-family: var(--font-metric); font-size: var(--ui-type-inline-figure); font-weight: var(--ui-type-inline-figure-weight); font-variant-numeric: tabular-nums; color: var(--v5-ink); }
.est-basis__v--unknown { font-family: var(--font-v5); color: var(--v5-ink-3); }
/* Comparison: section title, one solid card, column head written once. */
.est-sec { display: block; margin-top: var(--ui-space-section-gap); font: var(--ui-type-section-weight) var(--ui-type-section)/var(--ui-type-section-lh) var(--font-v5); color: var(--v5-ink); }
.est-list { flex: none; margin-top: 12px; padding: 0 16px; border-radius: var(--ui-radius-surface, 22px); background: var(--v5-surface); }
[data-theme="light"] .est-list { box-shadow: var(--v5-glass-shadow); }
.est-list__head { display: flex; justify-content: space-between; gap: 12px; padding-top: 12px; font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; }
.est-row { display: grid; grid-template-columns: 1fr auto; column-gap: 12px; row-gap: 10px; align-items: center; padding: 14px 0; }
.est-list__head + .est-row { padding-top: 8px; }
.est-row + .est-row { border-top: 1px solid var(--v5-border); }
.est-row__t { min-width: 0; }
.est-row__n { display: block; font: 500 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: break-word; }
.est-row__s { display: block; margin-top: 2px; font: var(--ui-type-list-subtitle-weight, 400) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); }
.est-row--skel .est-row__n, .est-row--skel .est-row__s, .est-row--skel .est-row__v { white-space: nowrap; }
.est-row__v { justify-self: end; align-self: start; font: var(--ui-type-card-figure-weight, 500) var(--ui-type-card-figure)/var(--ui-type-card-figure-lh) var(--font-metric); font-variant-numeric: tabular-nums; color: var(--v5-ink); }
.est-row__bar { grid-column: 1 / 3; margin: 1px 0; --nx-progress-hue: var(--v5-tech-cyan); }
/* entrance, once */
.anim-up { animation: est-up .32s cubic-bezier(.16, 1, .3, 1) both; }
.anim-up-delay { animation: est-up .32s cubic-bezier(.16, 1, .3, 1) .15s both; }
@keyframes est-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .anim-up, .anim-up-delay { animation: none; } }
.ob-skel { display: inline-block; vertical-align: middle; border-radius: 8px; background: color-mix(in srgb, var(--v5-ink) 9%, transparent); }
.est-detail { animation: est-detail-in 300ms cubic-bezier(.16, 1, .3, 1) 300ms both; }
@keyframes est-detail-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .est-detail { animation: none; } }
</style>
