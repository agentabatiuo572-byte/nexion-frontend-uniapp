<template>
  <view class="update-page">
    <DeviceStatusBar />
    <view class="update-header">
      <button v-if="!required" class="update-back" :aria-label="words.back" @click="leave">‹</button>
      <text>{{ words.title }}</text>
    </view>
    <scroll-view class="update-scroll" scroll-y>
      <view class="update-body">
        <view class="update-hero">
          <image src="/static/img/brand/uvel-symbol.png" mode="aspectFit" />
          <text>{{ upgrade ? words.latest : words.installed }}</text>
          <text class="update-version">{{ (upgrade ? policy?.versionName : installed?.name) || '—' }}</text>
          <text>UVEL · {{ platform }}</text>
        </view>
        <view class="update-panel" role="status" aria-live="polite">
          <text class="update-heading">{{ statusTitle }}</text>
          <text v-if="reason" class="update-description">{{ reason }}</text>
          <text v-if="statusBody" class="update-description">{{ statusBody }}</text>
        </view>
        <view v-if="upgrade && policy" class="update-panel">
          <text class="update-heading">{{ words.notes }}</text>
          <text class="update-description">{{ policy.notes[language] }}</text>
        </view>
        <view v-if="installed" class="update-panel">
          <text class="update-heading">{{ words.details }}</text>
          <view class="update-row"><text>{{ words.installed }}</text><text>{{ installed.name }}</text></view>
          <view class="update-row"><text>{{ words.build }}</text><text>{{ installed.build }}</text></view>
          <view v-if="installed.resourceBuild" class="update-row"><text>{{ words.resource }}</text><text>{{ installed.resourceBuild }}</text></view>
          <view class="update-row"><text>{{ words.platform }}</text><text>{{ platform }}</text></view>
        </view>
      </view>
    </scroll-view>
    <view class="update-actions">
      <button class="update-primary" :disabled="checking || opening" @click="act">{{ actionLabel }}</button>
    </view>
    <view v-if="confirming && !required" class="update-overlay" @click.self="confirming = false">
      <view class="update-sheet" role="dialog" :aria-label="words.available">
        <text class="update-heading">{{ words.available }} · {{ policy?.versionName }}</text>
        <text class="update-description">{{ policy?.notes[language] }}</text>
        <text class="update-description">{{ words.guide }}</text>
        <button class="update-primary" @click="handoff">{{ words.install }}</button>
        <button class="update-later" @click="confirming = false">{{ words.later }}</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onBackPress, onShow } from "@dcloudio/uni-app";
import DeviceStatusBar from "@/components/device/device-status-bar.vue";
import { navBack } from "@/lib/route";
import { current, checkFailed, checking, checkUpdate, installed, language, openInstaller, words } from "@/services/native-update";

const required = computed(() => current.value?.decision === "required");
const upgrade = computed(() => required.value || current.value?.decision === "optional");
const policy = computed(() => current.value?.policy);
const platform = computed(() => installed.value?.platform === "android" ? "Android" : installed.value?.platform === "ios" ? "iOS" : "—");
const reason = computed(() => required.value ? policy.value?.reasons[language.value] : "");
const confirming = ref(false);
const opening = ref(false);
const state = ref<"idle" | "opened" | "returned" | "failed">("idle");
const statusTitle = computed(() => {
  const w = words.value;
  if (checking.value) return w.checking;
  if (checkFailed.value) return w.error;
  if (state.value === "failed") return w.failed;
  if (state.value === "opened") return w.opened;
  if (required.value) return w.required;
  if (upgrade.value) return w.available;
  return current.value?.decision === "none" ? w.none : w.current;
});
const statusBody = computed(() => {
  if (checkFailed.value) return words.value.reconnect;
  if (state.value === "failed") return policy.value?.updateType === "resource" ? words.value.unsupported : words.value.reconnect;
  if (state.value === "opened") return words.value.guide;
  return state.value === "returned" && upgrade.value ? words.value.unchanged : "";
});
const actionLabel = computed(() => {
  if (checking.value) return words.value.checking;
  if (checkFailed.value || state.value === "failed") return words.value.retry;
  return upgrade.value && state.value !== "opened" ? words.value.now : words.value.check;
});
async function refresh() {
  const afterOpen = state.value === "opened";
  state.value = "idle";
  await checkUpdate(true);
  if (afterOpen && upgrade.value) state.value = "returned";
}
onShow(() => { void refresh(); });
onBackPress(() => {
  if (required.value) return true;
  if (confirming.value) { confirming.value = false; return true; }
  return false;
});
function leave() { if (!required.value) navBack("/pages/me/preferences"); }
async function handoff() {
  if (opening.value) return;
  opening.value = true;
  confirming.value = false;
  state.value = "opened";
  try { await openInstaller(() => { state.value = "failed"; }); }
  catch { state.value = "failed"; }
  finally { opening.value = false; }
}
async function act() {
  if (checkFailed.value || !upgrade.value || state.value === "opened") { await refresh(); return; }
  if (required.value || state.value === "failed") { await handoff(); return; }
  confirming.value = true;
}
</script>

<style scoped>
.update-page { height: 100vh; box-sizing: border-box; padding-top: var(--status-bar-height); display: flex; flex-direction: column; background: var(--v5-bg); color: var(--v5-ink); font-family: var(--font-v5); }
.update-header { position: relative; flex: none; display: flex; justify-content: center; align-items: center; min-height: 54px; padding: 0 52px; font-weight: 650; font-size: 18px; }
.update-back { position: absolute; left: 16px; top: 7px; padding: 0; width: 40px; height: 40px; line-height: 34px; font-size: 32px; border-radius: 50%; color: var(--v5-ink); background: var(--v5-surface-2); }
.update-scroll { min-height: 0; height: 0; flex: 1; }
.update-body { padding: 8px 18px 24px; }
.update-hero { display: flex; flex-direction: column; align-items: center; padding: 15px 0 24px; gap: 4px; color: var(--v5-ink-3); font-size: 13px; }
.update-hero image { height: 56px; width: 56px; margin-bottom: 8px; }
.update-version { color: var(--v5-ink); font-size: 34px; font-weight: 650; }
.update-panel { display: flex; flex-direction: column; gap: 10px; border-radius: 18px; background: var(--v5-surface-2); padding: 17px; margin-bottom: 12px; }
.update-heading { font-weight: 650; font-size: 17px; }
.update-description { display: block; color: var(--v5-ink-2); line-height: 1.5; font-size: 15px; white-space: pre-line; overflow-wrap: anywhere; }
.update-row { display: flex; justify-content: space-between; gap: 14px; font-size: 14px; color: var(--v5-ink-2); }
.update-actions,.update-sheet { flex: none; padding: 12px 18px calc(16px + env(safe-area-inset-bottom)); }
.update-primary,.update-later { margin: 0; width: 100%; font-size: 16px; line-height: 48px; font-weight: 600; border-radius: 14px; }
.update-primary { color: var(--v5-on-brand); background: var(--v5-brand); }
.update-primary[disabled] { opacity: .55; }
.update-later { background: transparent; color: var(--v5-ink-2); }
.update-sheet { display: flex; flex-direction: column; gap: 14px; background: var(--v5-bg); border-radius: 24px 24px 0 0; max-height: 80vh; overflow: auto; }
.update-overlay { position: fixed; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; background: rgba(0,0,0,.52); }
button::after { border: 0; }
</style>
