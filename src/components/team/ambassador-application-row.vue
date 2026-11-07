<template>
  <!-- Design system: list rows show the status as plain 12/16 text under the amount, not as a tag. -->
  <view class="amb-row" role="link" tabindex="0" :aria-label="fmt(c.openDetail, { title: application.city ?? '', status: statusText })"
    @click="open" @keydown.enter.prevent="open">
    <AmbassadorBucketIcon :bucket="application.bucket" />
    <view class="amb-row__titles">
      <text class="amb-row__title">{{ application.city }}</text>
      <text class="amb-row__meta">{{ bucketTitle }} · {{ fmt(c.eventOn, { date: application.eventDate ?? '—' }) }}</text>
    </view>
    <view class="amb-row__side">
      <AmbassadorAmount :value="application.budgetUsdt" />
      <text class="amb-row__status" :class="`amb-row__status--${presentation.tone}`">{{ statusText }}</text>
    </view>
    <svg v-if="chevron" class="amb-row__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AmbassadorBucketIcon from "@/components/team/ambassador-bucket-icon.vue";
import AmbassadorAmount from "@/components/team/ambassador-amount.vue";
import type { AmbassadorApplication } from "@/api/ambassador-application-api";
import { ambassadorPresentation, AMBASSADOR_ROUTES } from "@/lib/ambassador-display";
import { ambassadorCopy } from "@/i18n/ambassador";
import { fmt } from "@/i18n/format";
import { useT } from "@/i18n/use-t";
import { useLocaleStore } from "@/store/locale";
import { navTo } from "@/lib/route";

const props = defineProps<{ application: AmbassadorApplication; chevron?: boolean }>();
const t = useT();
const locale = useLocaleStore();
const c = computed(() => ambassadorCopy(locale.code));
const presentation = computed(() => ambassadorPresentation(props.application));
const statusText = computed(() => c.value.statuses[presentation.value.status]);
const bucketTitle = computed(() => props.application.bucket ? t.value.agent.buckets[props.application.bucket].title : c.value.noBucket);
function open() { if (props.application.applicationId) void navTo(AMBASSADOR_ROUTES.detail(props.application.applicationId)); }
</script>

<style scoped>
/* The 44px minimum is the row content; the 14px padding sits outside it (row ≈ 73px with its divider). */
.amb-row { display: flex; align-items: center; gap: var(--ui-space-inline); box-sizing: content-box; min-height: 44px; padding: 14px 0; color: var(--v5-ink); cursor: pointer; }
.amb-row__titles { flex: 1; min-width: 0; }
.amb-row__title, .amb-row__meta { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.amb-row__title { font: var(--ui-type-list-title-weight, 500) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); }
.amb-row__meta { margin-top: var(--v5-space-1); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.amb-row__side { flex: 0 1 auto; min-width: 0; max-width: 60%; display: flex; flex-direction: column; align-items: flex-end; text-align: end; }
.amb-row__status { margin-top: var(--v5-space-1); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.amb-row__status--success { color: var(--v5-success-ink); }
.amb-row__status--danger { color: var(--v5-danger); }
.amb-row__status--warning { color: var(--v5-warning-ink); }
.amb-row__status--brand { color: var(--v5-brand); }
.amb-row__chevron { flex: none; margin-left: calc(-1 * var(--v5-space-1)); color: var(--v5-ink-4); }
.amb-row:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
</style>
