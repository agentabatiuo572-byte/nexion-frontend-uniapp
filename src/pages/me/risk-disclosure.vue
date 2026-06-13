<!--
  Platform risk disclosure (ported from Nexion-prototype/app/(main)/me/risk-disclosure/page.tsx).
  Required reading before first withdrawal / staking lock. The accept button gates
  on (a) scroll-to-bottom (IntersectionObserver on a bottom sentinel, resolved via
  $el per P-019) and (b) checkbox tick. Acceptance persists via the risk-disclosure
  store. Reads `?return=` for where to land. Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="padding-bottom: 32px">
      <SubPageHeader :back="returnTo" />

      <!-- Hero -->
      <view class="mx-4 relative overflow-hidden" :style="heroStyle">
        <view class="flex items-center" style="gap: 8px; margin-bottom: 6px">
          <view class="grid place-items-center" :style="heroIconBoxStyle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
          </view>
          <text :style="heroLabelStyle">{{ w.heroLabel }}</text>
        </view>
        <text class="block" :style="heroTitleStyle">{{ w.heroTitle }}</text>
        <text class="block" :style="heroSubStyle">{{ w.heroSubtitle }}</text>
        <view v-if="accepted" class="flex items-center" :style="acceptedChipStyle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
          <text>{{ w.alreadyAccepted }}</text>
        </view>
      </view>

      <!-- Sections -->
      <view class="mx-4" :style="sectionsStyle">
        <view
          v-for="b in blocks"
          :key="b.n"
          :style="blockStyle(selectedBlock === b.n)"
          role="button"
          tabindex="0"
          :aria-label="b.title"
          @click="selectedBlock = b.n"
        >
          <view class="flex items-baseline" style="gap: 8px; margin-bottom: 4px">
            <text :style="blockNumStyle">{{ String(b.n).padStart(2, "0") }}</text>
            <text :style="blockTitleStyle">{{ b.title }}</text>
          </view>
          <text v-if="selectedBlock === b.n" class="block" :style="selectedBlockStyle">{{ sectionSelectedLabel(b.n) }}</text>
          <text class="block" :style="blockBodyStyle">{{ b.body }}</text>
        </view>
      </view>

      <!-- Bottom sentinel for scroll-to-bottom detection -->
      <view ref="sentinelRef" class="mx-4" style="height: 1px; margin-top: 12px" />

      <!-- Scroll hint -->
      <view v-if="!scrolledToBottom && !accepted" class="mx-4 flex items-center" :style="hintStyle">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px"><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></svg>
        <text :style="hintTextStyle">{{ w.scrollHint }}</text>
      </view>

      <!-- Acknowledge -->
      <view class="mx-4" :style="ackCardStyle">
        <view class="flex items-start" :style="{ gap: '10px', opacity: scrolledToBottom && !accepted ? 1 : 0.55 }" @click="toggleCheck">
          <view class="grid place-items-center shrink-0" :style="checkboxStyle">
            <svg v-if="checked || accepted" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </view>
          <text :style="checkLabelStyle" style="flex: 1">{{ w.checkboxLabel }}</text>
        </view>

        <view class="flex items-center justify-center active:opacity-80" :style="acceptBtnStyle" @click="onAccept">
          <template v-if="accepted">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
            <text>{{ w.alreadyAcceptedCta }}</text>
          </template>
          <text v-else>{{ w.acceptCta }}</text>
        </view>
        <text class="block text-center" :style="disclaimerStyle">{{ w.disclaimer }}</text>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, type CSSProperties } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";
import { useRiskDisclosure } from "@/store/risk-disclosure";
import { safeReturnTo } from "@/routing/safe-return-to";

const SCROLL_THRESHOLD_PX = 24;

const t = useT();
const w = computed(() => t.value.riskDisclosure);
const risk = useRiskDisclosure();
const accepted = computed(() => risk.accepted);

const returnTo = ref("/pages/me/me");
onLoad((options) => {
  returnTo.value = safeReturnTo(options?.return, "/pages/me/me");
});

const scrolledToBottom = ref(false);
const checked = ref(false);
const selectedBlock = ref<number | null>(null);
const sentinelRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

onMounted(() => {
  if (typeof IntersectionObserver === "undefined") {
    scrolledToBottom.value = true;
    return;
  }
  const raw = sentinelRef.value as unknown;
  const el: Element | null =
    raw instanceof Element
      ? raw
      : (raw as { $el?: unknown } | null)?.$el instanceof Element
        ? (raw as { $el: Element }).$el
        : null;
  if (!el) {
    scrolledToBottom.value = true;
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) scrolledToBottom.value = true;
    },
    { rootMargin: `0px 0px -${SCROLL_THRESHOLD_PX}px 0px` },
  );
  observer.observe(el);
});
onUnmounted(() => {
  observer?.disconnect();
  observer = null;
});

const blocks = computed(() => [
  { n: 1, title: w.value.s1Title, body: w.value.s1Body },
  { n: 2, title: w.value.s2Title, body: w.value.s2Body },
  { n: 3, title: w.value.s3Title, body: w.value.s3Body },
  { n: 4, title: w.value.s4Title, body: w.value.s4Body },
  { n: 5, title: w.value.s5Title, body: w.value.s5Body },
  { n: 6, title: w.value.s6Title, body: w.value.s6Body },
  { n: 7, title: w.value.s7Title, body: w.value.s7Body },
]);

function sectionSelectedLabel(n: number): string {
  return fmt(w.value.sectionSelected, { n: String(n).padStart(2, "0") });
}

const canAccept = computed(() => scrolledToBottom.value && checked.value && !accepted.value);

function toggleCheck() {
  if (scrolledToBottom.value && !accepted.value) checked.value = !checked.value;
}
function onAccept() {
  if (!canAccept.value) return;
  risk.accept();
  toast.success(w.value.acceptToast);
  uni.navigateTo({ url: returnTo.value, fail: () => uni.reLaunch({ url: returnTo.value, fail: () => {} }) });
}

const heroStyle: CSSProperties = {
  marginTop: "8px",
  borderRadius: "16px",
  padding: "16px",
  background:
    "radial-gradient(80% 60% at 90% 0%, color-mix(in srgb, var(--v5-brand-2) 18%, transparent) 0%, transparent 60%), var(--v5-surface)",
  border: "1px solid color-mix(in srgb, var(--v5-brand-2) 40%, transparent)",
};
const heroIconBoxStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-brand-2) 22%, transparent)",
};
const heroLabelStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "10px", letterSpacing: "0.16em", color: "var(--v5-brand-2)" };
const heroTitleStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "18px", fontWeight: 600, color: "var(--v5-ink)", lineHeight: 1.25 };
const heroSubStyle: CSSProperties = { marginTop: "6px", fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.6 };
const acceptedChipStyle: CSSProperties = {
  marginTop: "10px",
  alignSelf: "flex-start",
  padding: "4px 10px",
  borderRadius: "6px",
  background: "color-mix(in srgb, var(--v5-brand) 14%, transparent)",
  color: "var(--v5-brand)",
  fontSize: "10.5px",
  display: "inline-flex",
};
const sectionsStyle: CSSProperties = {
  marginTop: "12px",
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};
const blockNumStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "10.5px", color: "var(--v5-brand-2)" };
const blockTitleStyle: CSSProperties = { fontSize: "13.5px", fontWeight: 600, color: "var(--v5-ink)" };
const blockBodyStyle: CSSProperties = { fontSize: "11.5px", color: "var(--v5-ink-3)", lineHeight: 1.6 };
function blockStyle(selected: boolean): CSSProperties {
  return {
    borderRadius: "12px",
    padding: "10px",
    margin: "-10px",
    background: selected ? "color-mix(in srgb, var(--v5-brand-2) 8%, transparent)" : "transparent",
    border: selected ? "1px solid color-mix(in srgb, var(--v5-brand-2) 24%, transparent)" : "1px solid transparent",
  };
}
const selectedBlockStyle: CSSProperties = {
  marginBottom: "6px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10px",
  color: "var(--v5-brand-2)",
};
const hintStyle: CSSProperties = {
  marginTop: "12px",
  borderRadius: "12px",
  background: "color-mix(in srgb, var(--v5-warning) 8%, transparent)",
  border: "1px solid color-mix(in srgb, var(--v5-warning) 30%, transparent)",
  padding: "12px",
};
const hintTextStyle: CSSProperties = { fontSize: "11.5px", color: "var(--v5-warning)" };
const ackCardStyle: CSSProperties = {
  marginTop: "12px",
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  padding: "16px",
};
const checkboxStyle = computed<CSSProperties>(() => ({
  width: "20px",
  height: "20px",
  borderRadius: "6px",
  marginTop: "2px",
  background: checked.value || accepted.value ? "var(--v5-brand)" : "transparent",
  border: checked.value || accepted.value ? "1px solid var(--v5-brand)" : "1px solid var(--v5-border-strong)",
}));
const checkLabelStyle: CSSProperties = { fontSize: "12.5px", color: "var(--v5-ink-2)", lineHeight: 1.6 };
const acceptBtnStyle = computed<CSSProperties>(() => ({
  marginTop: "16px",
  width: "100%",
  height: "48px",
  borderRadius: "999px",
  background: canAccept.value || accepted.value ? "var(--v5-brand)" : "var(--v5-surface-2)",
  color: canAccept.value || accepted.value ? "var(--v5-on-brand)" : "var(--v5-ink-4)",
  fontSize: "14px",
  fontWeight: 600,
}));
const disclaimerStyle: CSSProperties = { marginTop: "8px", fontSize: "10px", color: "var(--v5-ink-4)", lineHeight: 1.4 };
</script>
