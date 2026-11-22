<template><text class="nx-tag" :class="[`nx-tag--${tone}`, `nx-tag--${size}`, { 'nx-tag--wrap': wrap }]"><slot>{{ label }}</slot></text></template>
<script setup lang="ts">
// Status and attribute chips (design system 03 §3.8): status 24px, credential 28px.
// `wrap`: for a label that can outgrow its row (long languages, two values): one line stays 24px, a longer one wraps at word
// boundaries and the tag grows with it, never wider than its container (03 §3.6.1).
withDefaults(defineProps<{ label?: string; wrap?: boolean; tone?: 'neutral' | 'unavailable' | 'brand' | 'success' | 'warning' | 'danger' | 'uvt' | 'genesis'; size?: 'status' | 'credential' }>(), { wrap: false, tone: 'neutral', size: 'status' });
</script>
<style scoped>
.nx-tag { display: inline-flex; align-items: center; flex: none; box-sizing: border-box; height: 24px; padding: 0 8px; border-radius: 999px; background: var(--v5-surface-3); color: var(--v5-ink-2); font: var(--ui-type-chip-weight) var(--ui-type-chip)/var(--ui-type-chip-lh) var(--font-v5); white-space: nowrap; }
.nx-tag--wrap { flex: 0 1 auto; height: auto; min-height: 24px; max-width: 100%; padding-block: 4px; white-space: normal; overflow-wrap: break-word; }
.nx-tag--credential { height: 28px; padding: 0 10px; }
.nx-tag--unavailable { color: var(--v5-ink-3); }
.nx-tag--brand { background: var(--v5-brand-soft); color: var(--v5-brand); }
.nx-tag--success { background: var(--v5-success-soft); color: var(--v5-success-ink); }
.nx-tag--warning { background: var(--v5-warning-soft); color: var(--v5-warning-ink); }
.nx-tag--danger { background: var(--v5-danger-soft); color: var(--v5-danger); }
.nx-tag--uvt { background: var(--v5-nex-soft); color: var(--v5-nex-ink); }
.nx-tag--genesis { background: color-mix(in srgb,var(--v5-genesis-gold) 12%,transparent); color: var(--v5-genesis-gold); }
</style>
