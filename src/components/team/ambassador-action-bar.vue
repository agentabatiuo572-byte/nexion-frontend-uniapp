<template>
  <!-- Design system 04 §4.0: the page's main action sits in the shared fixed glass bar. -->
  <view class="amb-bar nx-glass-bar"><slot /></view>
</template>

<style scoped>
.amb-bar { position: absolute; z-index: 36; display: flex; flex-direction: column; color: var(--v5-ink); }
.amb-bar :deep(.amb-bar__row) { display: flex; gap: 8px; }
.amb-bar :deep(.amb-bar__row > *) { flex: 1 1 40px; min-width: 0; }
.amb-bar :deep(.amb-bar__row > .amb-bar__main) { flex: 2 1 40px; }
</style>
