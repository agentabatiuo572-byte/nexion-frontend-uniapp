<!-- Home "My devices" and Earn: one card for the pending replacements (boards S8a, S8b, S8c). One pair puts both machines and
     「撤销替换」 on the title line; several pairs get one line each with their own undo. The old device keeps its colour: it is
     still online and running until the job ends. -->
<template>
  <view v-if="pending.length" class="slot-replacement-status" :class="{ 'slot-replacement-status--multi': pending.length > 1 }" role="status">
    <view class="slot-replacement-status__head">
      <view v-if="pending.length === 1" class="slot-replacement-status__avatars" aria-hidden="true">
        <view class="slot-replacement-status__av"><DeviceArt class="slot-replacement-status__art" :device="pending[0].oldDevice" /></view>
        <view v-if="pending[0].newDevice" class="slot-replacement-status__av slot-replacement-status__av--new"><DeviceArt class="slot-replacement-status__art" :device="pending[0].newDevice" /></view>
      </view>
      <view class="slot-replacement-status__title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        <text>{{ pending.length === 1 ? copy.waitingTitle : fmt(copy.waitingTitleN, { n: pending.length }) }}</text>
      </view>
      <view v-if="pending.length === 1" class="slot-replacement-status__undo nx-reverse-action" role="button" tabindex="0"
        @click="goToReplacement(pending[0].pair.newDeviceId)" @keydown.enter.prevent="goToReplacement(pending[0].pair.newDeviceId)" @keydown.space.prevent="goToReplacement(pending[0].pair.newDeviceId)"><text>{{ copy.cancel }}</text></view>
    </view>
    <view v-for="item in pending" :key="item.pair.oldDeviceId" class="slot-replacement-status__pair">
      <text class="slot-replacement-status__line"><text v-for="(part, i) in slotCopyParts(copy.cardLine, item.sides)" :key="i" :class="{ 'slot-replacement-status__name': part.key }">{{ part.text }}<text v-if="part.code" class="slot-replacement-status__code">{{ '\u00a0' + part.code }}</text></text></text>
      <view v-if="pending.length > 1" class="slot-replacement-status__undo nx-reverse-action" role="button" tabindex="0"
        @click="goToReplacement(item.pair.newDeviceId)" @keydown.enter.prevent="goToReplacement(item.pair.newDeviceId)" @keydown.space.prevent="goToReplacement(item.pair.newDeviceId)"><text>{{ copy.cancel }}</text></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import DeviceArt from "@/components/device-art.vue";
import { fmt } from "@/i18n/format";
import { slotCopyParts, useDeviceSlotReplacementCopy } from "@/i18n/device-slot-replacement";
import { navTo } from "@/lib/route";
import { useApp } from "@/store/app";

const app = useApp();
const copy = useDeviceSlotReplacementCopy();
// The new device's art and instance number come from the fleet by its id; without that row only its name is written.
const pending = computed(() => app.visibleDevices.flatMap((device) => {
  const pair = device.replacement;
  if (!pair || String(pair.oldDeviceId) !== device.id) return [];
  const newDevice = app.visibleDevices.find((item) => item.id === String(pair.newDeviceId));
  return [{ pair, oldDevice: device, newDevice,
    sides: { old: { name: pair.oldDeviceName, code: device.instanceNo }, new: { name: pair.newDeviceName, code: newDevice?.instanceNo } } }];
}));

function goToReplacement(id: number) {
  navTo(`/pages/me/devices?cancelReplacementId=${encodeURIComponent(id)}`);
}
</script>

<style scoped>
/* A plain content card like the fleet dock below it (01 §1.1.2 纯色). */
/* Its spacing comes from the host: home under the section title, earn under the device stage. */
.slot-replacement-status { padding: 6px 4px 12px 14px; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); color: var(--v5-ink); }
[data-theme="light"] .slot-replacement-status { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
/* The undo never shrinks or wraps (03 §3.6.1): when the title row cannot hold it, it moves whole to the next line, right-aligned. */
.slot-replacement-status__head { display: flex; flex-wrap: wrap; align-items: center; gap: 0 12px; min-height: 44px; }
.slot-replacement-status__avatars { position: relative; flex: none; width: 66px; height: 38px; }
.slot-replacement-status__av { position: absolute; top: 0; left: 0; width: 38px; height: 38px; overflow: hidden; border-radius: 50%; background: radial-gradient(80% 70% at 50% 72%, color-mix(in srgb, var(--v5-ink) 10%, transparent), transparent), var(--v5-surface-2); box-shadow: 0 0 0 2.5px var(--v5-surface); }
.slot-replacement-status__av--new { left: 28px; }
.slot-replacement-status__art { position: absolute; left: 50%; top: 50%; width: 42px; height: 42px; transform: translate(-50%, -56%); }
.slot-replacement-status__title { display: flex; flex: 1; align-items: center; gap: 6px; min-width: min-content; font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); }
.slot-replacement-status__title > svg { flex: none; color: var(--v5-warning-ink); }
.slot-replacement-status__undo { display: inline-flex; flex: none; align-items: center; min-height: 44px; margin-left: auto; padding: 0 8px; white-space: nowrap; cursor: pointer; }
.slot-replacement-status__pair { display: flex; align-items: flex-start; gap: 8px; }
.slot-replacement-status__line { flex: 1; min-width: 0; margin: 6px 10px 0 0; color: var(--v5-ink-3); font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); overflow-wrap: break-word; }
/* Several pairs: one line each, 1px rules between, the undo beside its own line. */
.slot-replacement-status--multi { padding-bottom: 6px; }
.slot-replacement-status--multi .slot-replacement-status__pair { margin-top: 8px; padding-top: 8px; border-top: 1px solid color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.slot-replacement-status--multi .slot-replacement-status__line { margin: 3px 0 0; }
.slot-replacement-status--multi .slot-replacement-status__undo { margin-top: -10px; }
.slot-replacement-status__name { white-space: nowrap; }
/* Instance numbers are codes: JetBrains Mono, one line (03 §3.6.1). */
.slot-replacement-status__code { white-space: nowrap; font: var(--ui-type-inline-figure-weight) var(--ui-type-meta)/var(--ui-type-list-subtitle-lh) var(--font-metric); }
.slot-replacement-status__undo:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
</style>
