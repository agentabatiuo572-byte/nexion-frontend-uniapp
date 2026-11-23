<!--
  Earnings alerts (App only, 系统通知 group). A settings row with the current choice, and a bottom sheet with three
  single-choice rows (03 §3.5.1 选择 → sheet; radio rows as in the deposit network picker, design-rules). Hidden until the
  server has answered earningPush: a missing field is not OFF. Choosing saves through the preferences store and closes;
  a failed save keeps the previous choice (store rollback) and shows one toast. Push only; in-app messages follow 系统.
-->
<template>
  <view v-if="value" class="earning-push-row" role="button" tabindex="0" aria-haspopup="dialog" :aria-label="`${copy.pushTitle}, ${copy.pushOptions[value].label}`" @click="open = true" @keydown.enter.prevent="open = true" @keydown.space.prevent="open = true">
    <view class="earning-push-icon" aria-hidden="true">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H5a2 2 0 0 1 0-4h13v4" /><path d="M3 5v14a2 2 0 0 0 2 2h15V7" /><path d="M16 14h.01" /></svg>
    </view>
    <view class="earning-push-copy">
      <text class="earning-push-label">{{ copy.pushTitle }}</text>
      <text class="earning-push-hint">{{ copy.pushHint }}</text>
    </view>
    <text class="earning-push-value">{{ copy.pushOptions[value].label }}</text>
    <view class="earning-push-chevron" aria-hidden="true"><NxIcon name="chevron-right" /></view>
  </view>
  <NxSheet :open="open && !!value" :title="copy.pushTitle" @close="open = false">
    <view :id="groupId" class="earning-push-options" role="radiogroup" :aria-label="copy.pushTitle">
      <view v-for="(option, index) in OPTIONS" :key="option" class="earning-push-option" :class="{ 'earning-push-option--on': value === option }" role="radio" :aria-checked="value === option ? 'true' : 'false'" :tabindex="value === option ? 0 : -1" @click="choose(option)" @keydown.enter.prevent="choose(option)" @keydown.space.prevent="choose(option)" @keydown.down.prevent="moveFocus(index, 1)" @keydown.right.prevent="moveFocus(index, 1)" @keydown.up.prevent="moveFocus(index, -1)" @keydown.left.prevent="moveFocus(index, -1)">
        <view class="earning-push-option__copy">
          <text class="earning-push-option__label">{{ copy.pushOptions[option].label }}</text>
          <text class="earning-push-option__hint">{{ copy.pushOptions[option].hint }}</text>
        </view>
        <view class="earning-push-option__radio" aria-hidden="true" />
      </view>
    </view>
    <text class="earning-push-note">{{ copy.pushNote }}</text>
  </NxSheet>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onUnmounted, ref } from "vue";
import { onHide } from "@dcloudio/uni-app";
import NxIcon from "@/components/ui/nx-icon.vue";
import NxSheet from "@/components/ui/nx-sheet.vue";
import { earningCreditCopy } from "@/i18n/earning-credit";
import { useT } from "@/i18n/use-t";
import { uiLocale } from "@/i18n";
import { useLocaleStore } from "@/store/locale";
import { usePreferences } from "@/store/preferences";
import { remoteAccountScope } from "@/lib/remote-account-epoch";
import { toast } from "@/store/ui";
import type { EarningPush } from "@/api/notification-preferences-api";

const OPTIONS: EarningPush[] = ["DAILY", "HALF_HOURLY", "OFF"];
const t = useT();
const locale = useLocaleStore();
const copy = computed(() => earningCreditCopy[uiLocale(locale.code)]);
const prefs = usePreferences();
const value = computed(() => prefs.earningPush);
const open = ref(false);
// A save answered after the user left the page or switched account does not toast here (same guard as the switches).
let visit = 0;
function leave() { visit++; open.value = false; }
onHide(leave);
onUnmounted(leave);

async function choose(option: EarningPush) {
  open.value = false;
  const started = visit;
  const account = remoteAccountScope.snapshot();
  const result = await prefs.setEarningPush(option);
  if (result === "failed" && started === visit && remoteAccountScope.isCurrent(account)) toast.error(t.value.preferences.updateFailed);
}
// Arrow keys move focus between the rows; Enter or Space chooses (each choice is a save, so moving focus does not save).
const groupId = `earning-push-options-${getCurrentInstance()?.uid}`;
function moveFocus(index: number, step: number) {
  if (typeof document === "undefined") return;
  const rows = document.querySelectorAll<HTMLElement>(`#${groupId} .earning-push-option`);
  rows[(index + step + OPTIONS.length) % OPTIONS.length]?.focus();
}
</script>

<style scoped>
/* Settings row (03 §3.5, 10.1): menu-row title 400, list subtitle under it, current value as the right-hand summary. */
.earning-push-row { display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 12px 14px; border-top: 1px solid var(--v5-border); cursor: pointer; }
.earning-push-row:active { opacity: .75; }
.earning-push-row:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: -2px; }
.earning-push-icon { display: grid; place-items: center; flex-shrink: 0; align-self: flex-start; width: 28px; height: 28px; border-radius: 6px; background: var(--v5-surface-2); color: var(--v5-brand); }
.earning-push-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.earning-push-label { color: var(--v5-ink); font: 400 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); overflow-wrap: break-word; }
.earning-push-hint { color: var(--v5-ink-3); font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); overflow-wrap: break-word; text-wrap: pretty; }
/* The summary column never takes the title's width (10.3): it stays within 40% and wraps at word boundaries. */
.earning-push-value { flex: 0 1 auto; max-width: 40%; color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); text-align: right; overflow-wrap: break-word; text-wrap: balance; }
.earning-push-chevron { flex-shrink: 0; color: var(--v5-ink-4); }
/* Single-choice rows (design-rules picker rows): 22px radio on the right, selected row brand 10% tint and outline. */
.earning-push-options { display: flex; flex-direction: column; gap: 8px; }
.earning-push-option { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 10px 16px; box-sizing: border-box; border-radius: 16px; background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); cursor: pointer; transition: transform 120ms cubic-bezier(.2,.8,.2,1); }
.earning-push-option:active { transform: scale(.97); }
.earning-push-option:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.earning-push-option--on { background: color-mix(in srgb, var(--v5-brand) 10%, var(--v5-surface)); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--v5-brand) 60%, transparent); }
.earning-push-option__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.earning-push-option__label { color: var(--v5-ink); font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); overflow-wrap: break-word; }
.earning-push-option--on .earning-push-option__label { color: var(--v5-brand); }
.earning-push-option__hint { color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); overflow-wrap: break-word; }
.earning-push-option__radio { position: relative; flex: none; width: 22px; height: 22px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--v5-ink-4); }
.earning-push-option--on .earning-push-option__radio { box-shadow: inset 0 0 0 2px var(--v5-brand); }
.earning-push-option--on .earning-push-option__radio::after { content: ""; position: absolute; inset: 5px; border-radius: 50%; background: var(--v5-brand); }
.earning-push-note { display: block; margin-top: 12px; color: var(--v5-ink-3); font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); text-wrap: pretty; }
@media (prefers-reduced-motion: reduce) { .earning-push-option { transition: none; } .earning-push-option:active { transform: none; } }
</style>
