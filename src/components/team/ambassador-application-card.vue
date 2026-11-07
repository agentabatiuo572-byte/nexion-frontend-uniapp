<template>
  <view class="amb-card nx-viz-press" :class="{ 'amb-card--glass nx-frosted-button': glass }" role="link" tabindex="0" :aria-label="fmt(c.openDetail, { title: application.city ?? '', status: statusText })"
    @click="open" @keydown.enter.prevent="open">
    <view class="amb-card__head">
      <AmbassadorBucketIcon :bucket="application.bucket" />
      <view class="amb-card__titles">
        <text class="amb-card__title">{{ application.city }}</text>
        <text class="amb-card__meta">{{ bucketTitle }} · {{ fmt(c.eventOn, { date: application.eventDate ?? '—' }) }}</text>
      </view>
      <NxTag :tone="presentation.tone" :label="statusText" />
    </view>
    <AmbassadorTrack size="card" :presentation="presentation" :labels="c.steps" :label="c.progress" />
    <view class="amb-card__foot">
      <text class="amb-card__key">{{ c.amount }}</text>
      <AmbassadorAmount :value="application.budgetUsdt" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import NxTag from "@/components/ui/nx-tag.vue";
import AmbassadorBucketIcon from "@/components/team/ambassador-bucket-icon.vue";
import AmbassadorTrack from "@/components/team/ambassador-track.vue";
import AmbassadorAmount from "@/components/team/ambassador-amount.vue";
import type { AmbassadorApplication } from "@/api/ambassador-application-api";
import { ambassadorPresentation, AMBASSADOR_ROUTES } from "@/lib/ambassador-display";
import { ambassadorCopy } from "@/i18n/ambassador";
import { fmt } from "@/i18n/format";
import { useT } from "@/i18n/use-t";
import { useLocaleStore } from "@/store/locale";
import { navTo } from "@/lib/route";

const props = defineProps<{ application: AmbassadorApplication; glass?: boolean }>();
const t = useT();
const locale = useLocaleStore();
const c = computed(() => ambassadorCopy(locale.code));
const presentation = computed(() => ambassadorPresentation(props.application));
const statusText = computed(() => c.value.statuses[presentation.value.status]);
const bucketTitle = computed(() => props.application.bucket ? t.value.agent.buckets[props.application.bucket].title : c.value.noBucket);
function open() { if (props.application.applicationId) void navTo(AMBASSADOR_ROUTES.detail(props.application.applicationId)); }
</script>

<style scoped>
/* Content cards are solid; the records page marks its in-progress card as the page focus (soft glass). */
.amb-card { display: block; box-sizing: border-box; padding: var(--ui-space-inset); border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow, none); color: var(--v5-ink); cursor: pointer; }
.amb-card--glass { background: color-mix(in srgb, var(--v5-ink) 7%, transparent); box-shadow: var(--ui-glass-edge-shadow); }
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) { .amb-card--glass { background: var(--v5-surface-2); } }
.amb-card__head { display: flex; align-items: flex-start; gap: var(--ui-space-inline); }
.amb-card__titles { flex: 1; min-width: 0; }
.amb-card__title { display: block; font: var(--ui-type-card-title-weight, 600) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: anywhere; }
.amb-card__meta { display: block; margin-top: var(--v5-space-1); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); overflow-wrap: anywhere; }
.amb-card__foot { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-inline); margin-top: var(--v5-space-4); padding-top: var(--ui-space-inline); border-top: 1px solid var(--v5-border); }
.amb-card__key { font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.amb-card:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 3px; }
</style>
