<template>
  <!-- Design system 04 §4.0: the page's main action sits in the shared fixed glass bar. -->
  <view class="amb-bar nx-glass-bar"><slot /></view>
</template>

<style scoped>
.amb-bar { position: absolute; left: 0; right: 0; bottom: 0; z-index: 36; display: flex; flex-direction: column; gap: var(--v5-space-2); box-sizing: border-box; padding: var(--v5-space-3) var(--v5-space-4) calc(30px + env(safe-area-inset-bottom)); color: var(--v5-ink); }
.amb-bar :deep(.amb-bar__row) { display: flex; gap: var(--v5-space-3); }
.amb-bar :deep(.amb-bar__row > *) { flex: 1 1 0; min-width: 0; }
.amb-bar :deep(.amb-bar__row > .amb-bar__main) { flex-grow: 2; }
.amb-bar :deep(.amb-bar__why) { display: block; font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); text-align: center; overflow-wrap: anywhere; }
</style>
