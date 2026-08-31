<template>
  <view class="block" :style="cardStyle" role="link" tabindex="0" @click="goTrust" @keydown.enter.stop.prevent="goTrust" @keydown.space.stop.prevent="goTrust">
    <view class="flex items-start justify-between" style="gap: 12px">
      <view class="flex items-center" style="gap: 8px">
        <view class="grid place-items-center" :style="iconStyle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </view>
        <view>
          <text class="block" :style="titleStyle">{{ t.home.trustSnapshotTitle }}</text>
          <text class="block" :style="subtitleStyle">{{ t.home.trustSnapshotOpen }} ›</text>
        </view>
      </view>
      <text v-if="remoteApiEnabled && !ready" class="active:opacity-70" :style="retryStyle" role="button" tabindex="0" @click.stop="load(true)" @keydown.enter.stop.prevent="load(true)" @keydown.space.stop.prevent="load(true)">
        {{ status === 'error' ? t.ui.retry : t.home.networkStatUpdating }}
      </text>
    </view>

    <template v-if="ready">
      <view class="flex flex-wrap" style="gap: 6px; margin-top: 12px">
        <text v-for="(chip, index) in summary.chips" :key="`trust-chip-${index}`" :style="chipStyle">{{ chip }}</text>
      </view>
      <text class="block" :style="bodyStyle">{{ summary.reserveProof }}</text>
    </template>
    <text v-else-if="status === 'error' || status === 'ready'" class="block" :style="bodyStyle">{{ t.home.trustSnapshotUnavailable }}</text>
  </view>
</template>

<script setup lang="ts">
import { navTo } from "@/lib/route";
import { computed, onMounted, watch, type CSSProperties } from "vue";
import { remoteApiEnabled } from "@/api/runtime";
import type { TrustLocale } from "@/api/trust-section-api";
import { usePublishedTrust } from "@/composables/use-published-trust";
import { useT } from "@/i18n/use-t";
import { buildHomepageTrustSummary } from "@/lib/home-data-presenters";
import { useLocaleStore } from "@/store/locale";

const t = useT();
const locale = useLocaleStore();
const { sections, status, refresh } = usePublishedTrust();
const language = computed<TrustLocale>(() => ["zh", "vi", "en"].includes(locale.code) ? locale.code as TrustLocale : "en");
const summary = computed(() => buildHomepageTrustSummary(sections.value, language.value));
const ready = computed(() => status.value === "ready" && summary.value.chips.length === 7 && summary.value.reserveProof !== null);

function load(force = false) {
  if (remoteApiEnabled) void refresh(force);
}

function goTrust() {
  navTo("/pages/trust/trust");
}

onMounted(() => load());

watch(status, (next) => {
  if (remoteApiEnabled && next === "idle") load(true);
});

const cardStyle: CSSProperties = { padding: "14px", borderRadius: "16px", background: "var(--v5-surface)" };
const iconStyle: CSSProperties = { width: "32px", height: "32px", flexShrink: 0, borderRadius: "10px", background: "var(--v5-brand-soft)" };
const titleStyle: CSSProperties = { fontSize: "14px", fontWeight: 600, color: "var(--v5-ink)" };
const subtitleStyle: CSSProperties = { marginTop: "2px", fontSize: "11px", color: "var(--v5-brand)" };
const retryStyle: CSSProperties = { fontSize: "12px", fontWeight: 600, color: "var(--v5-brand)" };
const chipStyle: CSSProperties = { padding: "4px 8px", borderRadius: "999px", fontSize: "11px", color: "var(--v5-ink-2)", background: "var(--v5-surface-2)" };
const bodyStyle: CSSProperties = { marginTop: "9px", fontSize: "11px", lineHeight: 1.5, color: "var(--v5-ink-3)" };
</script>
