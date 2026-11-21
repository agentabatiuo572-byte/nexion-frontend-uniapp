<template>
  <view class="security-reason-sent" role="group" :aria-label="t.security.deletionReasonSubmitted">
    <view class="security-reason-head"><text class="security-reason-label">{{ t.security.deletionReasonSubmitted }}</text><svg class="security-reason-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" /></svg></view>
    <text class="security-reason-sent__text" :class="{ 'security-reason-sent__text--empty': !reason }">{{ reason || t.security.deletionReasonNone }}</text>
    <text v-if="retry" class="security-reason-hint">{{ t.security.deletionReasonLocked }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { normalizeAccountDeletionReason } from "@/api/account-api";
import { useT } from "@/i18n/use-t";

const props = defineProps<{ reason: string; retry?: boolean }>();
const t = useT();
const reason = computed(() => normalizeAccountDeletionReason(props.reason));
</script>

<style scoped>
.security-reason-sent { display:flex; flex-direction:column; gap:6px; min-width:0; padding:12px; border-radius:8px; background:var(--v5-surface-2); }
.security-reason-head { display:flex; align-items:baseline; justify-content:space-between; gap:12px; min-width:0; }
.security-reason-label { min-width:0; font:600 13px/18px var(--font-v5); color:var(--v5-ink-2); }
.security-reason-lock { flex:none; align-self:center; color:var(--v5-ink-3); }
.security-reason-sent__text { font:400 14px/20px var(--font-v5); color:var(--v5-ink); white-space:pre-wrap; overflow-wrap:anywhere; }
.security-reason-sent__text--empty { color:var(--v5-ink-3); }
.security-reason-hint { font-size:12px; line-height:16px; color:var(--v5-ink-3); }
</style>
