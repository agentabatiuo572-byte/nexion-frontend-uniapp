<template>
  <view class="cs-mask" @click.self="onCancel">
    <view class="cs-card">
      <view class="cs-head">
        <view class="cs-head__txt">
          <text class="cs-title">{{ t.authOtp.captchaTitle }}</text>
          <text class="cs-sub">{{ t.authOtp.captchaHint }}</text>
        </view>
        <view class="cs-x" @click="onCancel">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </view>
      </view>

      <!-- 拼图区:challenge 未就绪 = 骨架占位(⑤ 空状态,禁白块) -->
      <view id="cs-puzzle" class="cs-puzzle" :class="{ 'cs-puzzle--skeleton': !challenge }">
        <template v-if="challenge">
          <view class="cs-slot" :style="{ left: slotLeft }" />
          <view class="cs-piece" :style="{ left: pieceLeft }" />
          <view class="cs-refresh" @click="reloadChallenge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
          </view>
        </template>
      </view>

      <!-- 滑轨 -->
      <view id="cs-track" class="cs-track" :class="trackCls">
        <view class="cs-fill" :style="{ width: curX + 24 + 'px' }" />
        <view v-if="showHint" class="cs-hintwrap"><text class="cs-hint">{{ t.authOtp.captchaTrackHint }}</text></view>
        <view
          class="cs-handle"
          :style="{ left: curX + 2 + 'px' }"
          @touchstart.prevent="onDown"
          @touchmove.prevent="onMove"
          @touchend="onUp"
          @touchcancel="onUp"
          @mousedown="onDown"
        >
          <view v-if="busy" class="cs-spin" />
          <text v-else class="cs-handle__t">{{ verified ? "✓" : "→" }}</text>
        </view>
      </view>

      <view class="cs-meta">
        <text class="cs-meta__fail">{{ failText }}</text>
        <text v-if="hintText" class="cs-meta__hint" :class="{ 'cs-meta__hint--err': hintIsError }">{{ hintText }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, getCurrentInstance } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";
import { captchaChallenge, captchaVerify, MAX_CAPTCHA_FAILS, type CaptchaChallenge } from "@/store/auth-otp";

const props = defineProps<{ phone: string }>();
const emit = defineEmits<{ (e: "success", ticket: string): void; (e: "close"): void }>();

const t = useT();

const challenge = ref<CaptchaChallenge | null>(null);
const curX = ref(0);
const dragging = ref(false);
const busy = ref(false);
const verified = ref(false);
const shaking = ref(false);
const fails = ref(0);
const hintText = ref("");
const hintIsError = ref(false);
const trackW = ref(0);

let startPX = 0;

const maxHandle = computed(() => Math.max(1, trackW.value - 48));
// slot/piece 用 calc 定位:left = ratio × (拼图区宽 − 拼块 44px − 边距 8px)。
const slotLeft = computed(() => `calc((100% - 52px) * ${challenge.value?.targetRatio ?? 0})`);
const pieceLeft = computed(() => `calc((100% - 52px) * ${curX.value / maxHandle.value})`);
const showHint = computed(() => !dragging.value && curX.value === 0 && !busy.value && !verified.value);
const trackCls = computed(() => ({ "cs-track--err": shaking.value, "cs-track--ok": verified.value, "cs-track--busy": busy.value }));
const failText = computed(() => fmt(t.value.authOtp.captchaFailCount, { n: fails.value, max: MAX_CAPTCHA_FAILS }));

const instance = getCurrentInstance();

function measureTrack() {
  uni
    .createSelectorQuery()
    .in(instance)
    .select("#cs-track")
    .boundingClientRect((rect) => {
      const r = rect as UniApp.NodeInfo | null;
      if (r?.width) trackW.value = r.width;
    })
    .exec();
}

async function reloadChallenge() {
  if (busy.value) return;
  challenge.value = null;
  resetHandle();
  challenge.value = await captchaChallenge(props.phone);
  measureTrack();
}

function resetHandle() {
  curX.value = 0;
  dragging.value = false;
  hintText.value = "";
  hintIsError.value = false;
}

function pointerX(e: TouchEvent | MouseEvent): number {
  const te = e as TouchEvent;
  return te.touches && te.touches.length ? te.touches[0].clientX : (e as MouseEvent).clientX;
}
function onDown(e: TouchEvent | MouseEvent) {
  if (busy.value || verified.value || !challenge.value) return;
  dragging.value = true;
  startPX = pointerX(e) - curX.value;
}
function onMove(e: TouchEvent | MouseEvent) {
  if (!dragging.value) return;
  curX.value = Math.min(maxHandle.value, Math.max(0, pointerX(e) - startPX));
}
async function onUp() {
  if (!dragging.value || busy.value || !challenge.value) return;
  dragging.value = false;
  if (curX.value <= 0) return; // 未拖动,忽略
  busy.value = true;
  const res = await captchaVerify(props.phone, {
    challengeId: challenge.value.challengeId,
    offsetRatio: curX.value / maxHandle.value,
  });
  busy.value = false;
  if (res.ok) {
    verified.value = true;
    hintText.value = t.value.authOtp.captchaVerified;
    hintIsError.value = false;
    setTimeout(() => emit("success", res.ticket), 300);
    return;
  }
  if (res.error === "captcha_throttled") {
    toast.info(t.value.authOtp.captchaThrottled, "");
    emit("close");
    return;
  }
  fails.value = res.failCount;
  hintText.value = t.value.authOtp.captchaFail;
  hintIsError.value = true;
  shaking.value = true;
  setTimeout(async () => {
    shaking.value = false;
    challenge.value = null;
    curX.value = 0;
    challenge.value = await captchaChallenge(props.phone);
  }, 380);
}
function onCancel() {
  if (busy.value) return;
  emit("close");
}

// H5:鼠标拖出把手仍要跟踪 → window 级 move/up(touch 序列自锁定元素,不需要)。
function winMove(e: MouseEvent) { onMove(e); }
function winUp() { void onUp(); }

onMounted(async () => {
  if (typeof window !== "undefined") {
    window.addEventListener("mousemove", winMove);
    window.addEventListener("mouseup", winUp);
  }
  challenge.value = await captchaChallenge(props.phone);
  measureTrack();
});
onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("mousemove", winMove);
    window.removeEventListener("mouseup", winUp);
  }
});
</script>

<style scoped>
.cs-mask { position: fixed; inset: 0; z-index: 90; background: var(--v5-bg-color-mask); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px; }
.cs-card { width: 100%; max-width: 340px; background: var(--v5-surface); border: 1px solid var(--v5-surface-2); border-radius: 20px; padding: 18px; }
.cs-head { display: flex; align-items: flex-start; justify-content: space-between; }
.cs-head__txt { display: flex; flex-direction: column; gap: 3px; }
.cs-title { font-family: var(--font-v5); font-size: 15px; font-weight: 600; color: var(--v5-ink); }
.cs-sub { font-size: 13px; color: var(--v5-ink-3); text-wrap: pretty; }
.cs-x { width: 44px; height: 44px; margin: -12px -12px 0 0; border-radius: 9999px; display: flex; align-items: center; justify-content: center; }
.cs-x:active { opacity: 0.7; }

.cs-puzzle { position: relative; margin-top: 12px; height: 150px; border-radius: 14px; overflow: hidden; background:
    radial-gradient(120px 80px at 20% 30%, color-mix(in srgb, var(--v5-brand) 22%, transparent), transparent 70%),
    radial-gradient(140px 90px at 75% 65%, color-mix(in srgb, var(--v5-brand-2) 16%, transparent), transparent 70%),
    radial-gradient(90px 70px at 55% 20%, color-mix(in srgb, var(--v5-tech-cyan) 14%, transparent), transparent 70%),
    var(--v5-surface-2);
}
.cs-puzzle--skeleton::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent); animation: cs-shimmer 1.2s infinite; }
@keyframes cs-shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
.cs-slot { position: absolute; top: 53px; width: 44px; height: 44px; border-radius: 10px; border: 2px dashed rgba(255, 255, 255, 0.5); background: rgba(0, 0, 0, 0.35); box-sizing: border-box; }
.cs-piece { position: absolute; top: 53px; width: 44px; height: 44px; border-radius: 10px; background: linear-gradient(135deg, color-mix(in srgb, var(--v5-brand) 90%, transparent), color-mix(in srgb, var(--v5-brand) 65%, transparent)); border: 1px solid rgba(255, 255, 255, 0.25); box-sizing: border-box; }
.cs-refresh { position: absolute; right: 4px; top: 4px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
.cs-refresh:active { opacity: 0.7; }

/* 🔴 零-border 扫荡请勿删这条 border:它是**状态通道**,不是卡片描边 ——
   下面 .cs-track--err / --ok 靠改 border-color 传达验证成功/失败反馈,
   删掉等于删掉验证码的结果反馈(P0 可用性)。《03》§3 末条:交互控件边界归《无障碍规范》。 */
.cs-track { position: relative; margin-top: 12px; height: 48px; border-radius: 9999px; background: color-mix(in srgb, var(--v5-surface-2) 55%, transparent); border: 1px solid var(--v5-surface-2); overflow: hidden; }
.cs-fill { position: absolute; left: 0; top: 0; bottom: 0; background: color-mix(in srgb, var(--v5-brand) 18%, transparent); }
.cs-hintwrap { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.cs-hint { font-size: 13px; color: var(--v5-ink-4); }
.cs-handle { position: absolute; top: 2px; width: 44px; height: 44px; border-radius: 9999px; background: var(--v5-brand); display: flex; align-items: center; justify-content: center; touch-action: none; }
.cs-handle:active { transform: scale(0.98); }
.cs-handle__t { font-size: 15px; font-weight: 600; color: var(--v5-on-brand); }
.cs-track--err { border-color: color-mix(in srgb, var(--v5-brand-2) 55%, transparent); animation: cs-shake 0.35s; }
.cs-track--err .cs-handle { background: var(--v5-brand-2); }
.cs-track--ok { border-color: color-mix(in srgb, var(--v5-brand) 60%, transparent); }
.cs-track--ok .cs-fill { background: color-mix(in srgb, var(--v5-brand) 30%, transparent); }
@keyframes cs-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 50% { transform: translateX(5px); } 75% { transform: translateX(-3px); } }
.cs-spin { width: 16px; height: 16px; border: 2px solid color-mix(in srgb, var(--v5-on-brand) 35%, transparent); border-top-color: var(--v5-on-brand); border-radius: 9999px; animation: cs-rot 0.7s linear infinite; }
@keyframes cs-rot { to { transform: rotate(360deg); } }

.cs-meta { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; min-height: 16px; }
.cs-meta__fail { font-size: 12px; color: var(--v5-ink-4); font-variant-numeric: tabular-nums; }
.cs-meta__hint { font-size: 12px; color: var(--v5-ink-3); }
.cs-meta__hint--err { color: var(--v5-brand-2); }
</style>
