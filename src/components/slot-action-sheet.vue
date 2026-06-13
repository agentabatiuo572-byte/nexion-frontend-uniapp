<!--
  SlotActionSheet — chassis-level bottom sheet that opens when the user taps an
  empty slot in /earn. Ported from Nexion-prototype/app/components/slot-action-sheet.tsx.
  Two branches:
    · has inactive (inventory) devices → list them; tap one to activate
      (respects MAX_DEVICES cap via app.activateDevice).
    · inventory empty → single CTA routing to /store.
    · framer slide-up / fade  → CSS @keyframes
    · lucide Smartphone/Server/ShoppingBag/X/Power → inline <svg stroke="currentColor">
    · fully i18n-routed (t.slotSheet.*; close aria reuses t.trial.sheetCloseAria).
  Triggers call useSlotActionSheet().show(); this is the missing UI that renders
  when open (mounted once at chassis level).
-->
<template>
  <view v-if="sheet.open" class="sas-root">
    <view class="sas-backdrop" @click="hide" />

    <view class="sas-panel" @click.stop>
      <!-- header -->
      <view class="sas-head">
        <view class="sas-head-meta">
          <text class="sas-title">{{ headTitle }}</text>
          <text class="sas-desc">{{ headDesc }}</text>
        </view>
        <view class="sas-close" :aria-label="closeAria" @click="hide">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </view>
      </view>

      <!-- branch A: inactive devices to activate -->
      <view v-if="inactiveDevices.length > 0" class="sas-list">
        <view
          v-for="d in inactiveDevices"
          :key="d.id"
          class="sas-device"
          @click="onActivate(d)"
        >
          <view class="sas-device-ico">
            <svg v-if="d.kind === 'phone'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" /></svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2" /><rect width="20" height="8" x="2" y="14" rx="2" ry="2" /><path d="M6 6h.01" /><path d="M6 18h.01" /></svg>
          </view>
          <view class="sas-device-meta">
            <text class="sas-device-name">{{ d.name }}</text>
            <text class="sas-device-rate">${{ d.baseRate.toFixed(2) }}/d</text>
          </view>
          <view class="sas-device-power">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.77.04" /></svg>
          </view>
        </view>
      </view>

      <!-- branch B: empty inventory → go to store -->
      <view v-else class="sas-store-cta" @click="onGoStore">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
        <text class="sas-store-cta-t">{{ t.slotSheet.goStoreCta }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useSlotActionSheet } from "@/store/slot-action-sheet";
import { useApp } from "@/store/app";
import { MAX_DEVICES } from "@/store/device-types";
import { toast } from "@/store/ui";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import type { Device } from "@/store/types";

const sheet = useSlotActionSheet();
const app = useApp();
const t = useT();

const inactiveDevices = computed(() => app.devices.filter((d) => d.activatedAt === null));
const activeCount = computed(() => app.devices.filter((d) => d.activatedAt !== null).length);

const headTitle = computed(() =>
  inactiveDevices.value.length > 0 ? t.value.slotSheet.titleActivate : t.value.slotSheet.titleStore,
);
const headDesc = computed(() =>
  inactiveDevices.value.length > 0
    ? fmt(t.value.slotSheet.descActivate, { active: activeCount.value, max: MAX_DEVICES })
    : t.value.slotSheet.descStore,
);
const closeAria = computed(() => t.value.trial.sheetCloseAria);

function hide() {
  sheet.hide();
}

function onActivate(d: Device) {
  if (activeCount.value >= MAX_DEVICES) {
    toast.warn(fmt(t.value.slotSheet.toastSlotsFull, { max: MAX_DEVICES }));
    return;
  }
  const ok = app.activateDevice(d.id);
  if (ok) {
    toast.success(fmt(t.value.slotSheet.toastActivated, { name: d.name }));
    sheet.hide();
  }
}

function onGoStore() {
  sheet.hide();
  uni.navigateTo({ url: "/pages/store/store", fail: () => {} });
}
</script>

<style scoped>
.sas-root {
  position: fixed;
  inset: 0;
  z-index: 790;
}
.sas-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(8, 8, 12, 0.45);
  backdrop-filter: blur(8px) saturate(150%);
  animation: sas-fade 0.24s ease-out;
}
.sas-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 800;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  background: var(--v5-surface);
  border-top: 1px solid var(--v5-border);
  padding: 18px 16px;
  padding-bottom: calc(env(safe-area-inset-bottom) + 38px);
  animation: sas-slide-up 0.36s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes sas-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes sas-slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.sas-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.sas-head-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.sas-title {
  font-family: var(--font-v5);
  font-size: 15px;
  font-weight: 600;
  color: var(--v5-ink);
  line-height: 1.2;
}
.sas-desc {
  font-size: 12px;
  color: var(--v5-ink-3);
  margin-top: 4px;
  line-height: 1.4;
}
.sas-close {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: var(--v5-surface-2);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.sas-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 50vh;
  overflow-y: auto;
}
.sas-device {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 12px;
  padding: 12px;
  background: var(--v5-surface-2);
  text-align: left;
}
.sas-device:active {
  background: var(--v5-surface-3);
}
.sas-device-ico {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--v5-surface);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.sas-device-meta {
  flex: 1;
  min-width: 0;
}
.sas-device-name {
  display: block;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--v5-ink);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sas-device-rate {
  display: block;
  font-size: 11.5px;
  color: var(--v5-ink-3);
  margin-top: 2px;
  font-family: var(--font-jet-mono), monospace;
}
.sas-device-power {
  flex-shrink: 0;
  display: grid;
  place-items: center;
}
.sas-store-cta {
  margin-top: 16px;
  width: 100%;
  height: 48px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--v5-brand);
}
.sas-store-cta:active {
  transform: scale(0.98);
}
.sas-store-cta-t {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--v5-on-brand);
  font-family: var(--font-v5);
}
</style>
