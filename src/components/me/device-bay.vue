<!-- One occupied compute slot on the device warehouse hero (P-43): live LED, device art, name and a running strip while online. -->
<template>
  <view class="device-bay" :class="{ 'device-bay--online': online }" role="button" tabindex="0" :aria-label="label" @click="emit('open')">
    <view class="device-bay__led" :class="{ 'device-bay__led--off': !online }" aria-hidden="true" />
    <text v-if="badge" class="device-bay__badge">{{ badge }}</text>
    <view class="device-bay__art" aria-hidden="true">
      <image v-if="src" class="device-bay__image" :src="src" mode="aspectFit" @error="imageError" />
      <view class="device-bay__floor" />
    </view>
    <text class="device-bay__name">{{ name }}</text>
    <view v-if="online" class="device-bay__strip" aria-hidden="true"><view /></view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Device } from "@/store/types";
import { useDeviceProductImage } from "@/composables/use-device-product-image";

const props = defineProps<{ device?: Device; image?: string; name: string; online: boolean; badge?: string; label: string }>();
const emit = defineEmits<{ (e: "open"): void }>();
// A trial bay has no fleet row; its art comes from the trial product instead.
const { imageSrc, imageError } = useDeviceProductImage(() => props.device ?? { kind: "phone", productCode: "", capacitySource: "server" } as Device);
const src = computed(() => props.image ?? (props.device ? imageSrc.value : undefined));
</script>

<style scoped>
.device-bay { position: relative; height: 112px; overflow: hidden; border-radius: var(--v5-radius-m); background: color-mix(in srgb, var(--v5-ink) 4%, transparent); box-shadow: var(--device-bay-well), inset 0 0 0 1px var(--v5-border); animation: nx-viz-light 320ms cubic-bezier(.2, .8, .2, 1) both; animation-delay: calc(var(--i, 0) * 40ms); }
.device-bay--online::before { content: ""; position: absolute; inset: 0; background: radial-gradient(70% 55% at 50% 58%, color-mix(in srgb, var(--v5-success) 15%, transparent), transparent 72%); }
.device-bay__led { position: absolute; z-index: 1; top: 10px; left: 10px; width: 6px; height: 6px; border-radius: 50%; background: var(--v5-success); }
.device-bay__led--off { background: var(--v5-ink-4); animation: none; }
.device-bay__badge { position: absolute; z-index: 1; top: 8px; right: 8px; padding: 1px 5px; border-radius: 6px; background: var(--v5-brand); color: var(--v5-on-brand); font: 500 10px/14px var(--font-v5); }
.device-bay__art { position: absolute; left: 50%; top: 12px; width: 80px; height: 62px; margin-left: -40px; }
.device-bay__image { display: block; width: 100%; height: 100%; }
.device-bay__floor { position: absolute; left: 20%; right: 20%; bottom: -3px; height: 8px; border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.65), transparent); }
[data-theme="light"] .device-bay__floor { background: radial-gradient(closest-side, rgba(20,16,8,.20), transparent); }
.device-bay:not(.device-bay--online) .device-bay__image { filter: grayscale(.7); opacity: .55; }
.device-bay__name { position: absolute; left: 8px; right: 8px; bottom: 16px; overflow: hidden; text-align: center; text-overflow: ellipsis; white-space: nowrap; color: var(--v5-ink); font: 500 12px/16px var(--font-v5); }
.device-bay__strip { position: absolute; left: 14px; right: 14px; bottom: 8px; height: 2px; overflow: hidden; border-radius: 2px; background: color-mix(in srgb, var(--v5-success) 22%, transparent); }
.device-bay__strip > view { width: 36%; height: 100%; border-radius: 2px; background: linear-gradient(90deg, transparent, var(--v5-success), transparent); animation: device-bay-flow 2.4s cubic-bezier(.45, 0, .55, 1) infinite; animation-delay: calc(var(--i, 0) * .3s); }
[role="button"] { cursor: pointer; }
[role="button"]:active { transform: scale(.97); }
[role="button"]:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
@keyframes device-bay-flow { from { transform: translateX(-110%); } to { transform: translateX(290%); } }
@media (prefers-reduced-motion: reduce) { .device-bay, .device-bay__strip > view { animation: none; } }
</style>
