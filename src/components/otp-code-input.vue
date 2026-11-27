<template>
  <view class="otp-code">
    <view class="otp-code__cells" aria-hidden="true">
      <view v-for="(digit, i) in digits" :key="i" class="otp-code__cell" :class="{ 'otp-code__cell--filled': digit }">
        <text>{{ digit }}</text>
        <view v-if="focused && i === caretIndex" class="otp-code__caret" :class="{ 'otp-code__caret--after': digit }" />
      </view>
    </view>
    <input class="otp-code__field" type="text" inputmode="numeric" text-content-type="oneTimeCode" :value="shown"
      :focus="focus" :cursor-spacing="cursorSpacing" :aria-label="label" confirm-type="done"
      @input="onInput" @focus="focused = true" @blur="focused = false" @confirm="emit('confirm')" />
  </view>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
// One real field takes the whole code, so delete, paste and SMS autofill are the system's own; the six cells only show it.
const props = defineProps<{ modelValue: string; label: string; focus: boolean; cursorSpacing?: number }>();
const emit = defineEmits<{ (event: "update:modelValue", value: string): void; (event: "confirm"): void }>();
const focused = ref(false);
const digits = computed(() => Array.from({ length: 6 }, (_, i) => props.modelValue[i] ?? ""));
const caretIndex = computed(() => Math.min(props.modelValue.length, 5));
const shown = ref(props.modelValue);
watch(() => props.modelValue, (value) => { shown.value = value; });
function onInput(event: Event) {
  const raw = (event as unknown as { detail: { value: string } }).detail.value;
  const value = raw.replace(/\D/g, "").slice(0, 6);
  // The field keeps the first six digits only: separators from a pasted code and keys past the sixth are written back
  // out, so a pasted "01 23-45" fills all six and each delete removes a digit the cells show.
  shown.value = raw;
  if (value !== raw) void nextTick(() => { shown.value = value; });
  if (value !== props.modelValue) emit("update:modelValue", value);
}
</script>
<style scoped>
.otp-code { position: relative; }
.otp-code__cells { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.otp-code__cell { position: relative; display: flex; align-items: center; justify-content: center; width: 48px; height: 56px; font-family: var(--font-v5); font-variant-numeric: tabular-nums; font-size: 20px; font-weight: 600; border-radius: 12px; background: var(--v5-surface); border: 1px solid var(--v5-surface-2); color: var(--v5-ink-4); }
.otp-code__cell--filled { border-color: color-mix(in srgb, var(--v5-brand) 45%, transparent); color: var(--v5-ink); }
.otp-code__caret { position: absolute; top: 50%; left: 50%; width: 2px; height: 22px; margin: -11px 0 0 -1px; border-radius: 1px; background: var(--v5-brand); animation: otp-code-caret 1.06s step-end infinite; }
.otp-code__caret--after { margin-left: 0.45em; }
@keyframes otp-code-caret { 50% { opacity: 0; } }
/* The field starts 32px left of the cells with its text too small to reach them, so a tap anywhere on the cells puts
   the caret after the last digit: the next key fills the first empty cell and delete always takes the last digit. */
.otp-code__field { position: absolute; top: 0; left: -32px; width: calc(100% + 32px); height: 100%; clip-path: inset(0 0 0 32px); opacity: 0; font-size: 1px; color: transparent; caret-color: transparent; }
@media (prefers-reduced-motion: reduce) { .otp-code__caret { animation: none; } }
@media (forced-colors: active) { .otp-code__caret { background: Highlight; forced-color-adjust: none; } }
</style>
