<!--
  NxCodeValue — one long code (order, withdrawal, bill, quote, receipt or ticket number, hash,
  invite code) as a value. JetBrains Mono on one line; when the space runs out the middle gives way
  to an ellipsis and the start and the last `tail` characters stay, so the code never breaks at a
  random place. Screen readers get the whole code; the copy button copies the whole code.
  The root shrinks to its content, so in a label | value row the parent places it (right in a
  space-between row). Keep the label at its natural width up to about 45% of the row
  (flex: none; max-width: 45%) so it wraps only when it is very long and never squeezes the code.
  `full`: the whole code on its own full-width line, wrapping evenly. Only for strings the user must
  check character by character before acting (a payout address on a confirm step) or that the user
  asked to reveal; put it under its label, never beside it.
-->
<template>
  <view class="nx-code font-mono-code" :class="{ 'nx-code--full': full }">
    <text v-if="full" class="nx-code__full">{{ value }}</text>
    <template v-else>
      <text class="nx-code__sr">{{ value }}</text>
      <view class="nx-code__line" aria-hidden="true"><text class="nx-code__head">{{ head }}</text><text v-if="end" class="nx-code__tail">{{ end }}</text></view>
    </template>
    <CopyCodeButton v-if="copyable" :value="value" :label="label" />
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import CopyCodeButton from "@/components/copy-code-button.vue";

const props = withDefaults(defineProps<{ value: string; label: string; copyable?: boolean; full?: boolean; tail?: number }>(), { copyable: true, full: false, tail: 6 });
const cut = computed(() => props.value.length > props.tail * 2 ? props.value.length - props.tail : props.value.length);
const head = computed(() => props.value.slice(0, cut.value));
const end = computed(() => props.value.slice(cut.value));
</script>

<style scoped>
.nx-code { position: relative; display: flex; align-items: center; gap: var(--v5-space-1); min-width: 0; color: var(--v5-ink); font-size: var(--ui-type-list-subtitle); line-height: var(--ui-type-list-subtitle-lh); font-weight: 400; }
.nx-code__line { display: flex; min-width: 0; overflow: hidden; }
/* uni-text sets white-space: pre-line on itself, so nowrap must sit on each text, not on the line. */
.nx-code__head, .nx-code__tail { white-space: nowrap; }
/* The head keeps a short prefix (about four characters) before it gives way. */
.nx-code__head { flex: 0 1 auto; min-width: 4ch; overflow: hidden; text-overflow: ellipsis; }
.nx-code__tail { flex: none; }
.nx-code__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.nx-code--full { align-items: flex-start; width: 100%; }
.nx-code__full { flex: 1; min-width: 0; word-break: break-all; }
.nx-code--full :deep(.copy-code-button) { margin-top: -4px; }
</style>
