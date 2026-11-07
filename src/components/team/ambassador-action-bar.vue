<template>
  <!-- Design system 04 §4.0: the page's main action sits in a fixed soft-glass bar (uniform fill, blur, shared soft rim; no top hairline or gradient). -->
  <view class="amb-bar nx-frosted-button"><slot /></view>
</template>

<style scoped>
.amb-bar { position: absolute; left: 0; right: 0; bottom: 0; z-index: 36; display: flex; flex-direction: column; gap: var(--v5-space-2); box-sizing: border-box; padding: var(--v5-space-3) var(--v5-space-4) calc(30px + env(safe-area-inset-bottom)); border-radius: 0; color: var(--v5-ink);
  background: color-mix(in srgb, var(--ui-ticket-bottom, var(--v5-surface)) 86%, transparent); backdrop-filter: blur(18px) saturate(160%); -webkit-backdrop-filter: blur(18px) saturate(160%); }
.amb-bar :deep(.amb-bar__row) { display: flex; gap: var(--v5-space-3); }
.amb-bar :deep(.amb-bar__row > *) { flex: 1 1 0; min-width: 0; }
.amb-bar :deep(.amb-bar__row > .amb-bar__main) { flex-grow: 2; }
.amb-bar :deep(.amb-bar__why) { display: block; font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); text-align: center; overflow-wrap: anywhere; }
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .amb-bar { background: var(--v5-surface-2); backdrop-filter: none; -webkit-backdrop-filter: none; }
}
</style>
