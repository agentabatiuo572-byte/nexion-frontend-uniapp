<template><NetworkPulseCard v-if="available" compact-view :registered-display="memberCount" estimated /></template>
<script setup lang="ts">
import { computed } from 'vue';
import { useRegisteredUsersEstimate } from '@/composables/use-registered-users-estimate';
import { useConfig } from '@/store/config';
import NetworkPulseCard from './network-pulse-card.vue';
const cfg = useConfig(), memberCount = useRegisteredUsersEstimate();
const available = computed(() => memberCount.value !== null && Number.isSafeInteger(cfg.config.networkPulse?.onlineDevices) && cfg.config.networkPulse!.onlineDevices! >= 0);
</script>
<style scoped>
.network-snapshot__estimate { display: block; font: 400 12px/1.5 var(--font-v5); color: var(--v5-ink-2); margin-top: 4px; }
.network-snapshot__totals { display: flex; flex-wrap: wrap; gap: 4px 12px; font: 500 var(--ui-type-list-subtitle)/1.6 var(--font-v5); color: var(--v5-ink-2); }
.network-snapshot__row { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--v5-border); font: 400 12px/1.5 var(--font-v5); color: var(--v5-ink-2); }
</style>
