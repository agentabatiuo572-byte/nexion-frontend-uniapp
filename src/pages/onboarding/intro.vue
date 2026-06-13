<template>
  <view class="intro-root">
    <!-- Backdrop: radial brand glow (center above page top) -->
    <view class="intro-glow" />
    <!-- Top-blend vignette under header edge -->
    <view class="intro-vignette" />
    <!-- Lime dot grid -->
    <view class="intro-dotgrid dot-grid" />

    <!-- Floating nodes (deterministic positions) -->
    <view
      v-for="(p, i) in positions"
      :key="i"
      class="intro-node pulse-node"
      :style="{ top: p.top, left: p.left, transform: `scale(${p.scale})`, animationDelay: p.delay + 's' }"
    />

    <!-- Centerpiece -->
    <view class="intro-content">
      <view class="intro-orb-area">
        <view class="intro-orb anim-orb">
          <view class="orb-glow" />
          <svg viewBox="0 0 240 240" class="orb-svg" aria-hidden="true">
            <defs>
              <radialGradient id="orb-chip" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stop-color="var(--v5-surface-2)" />
                <stop offset="100%" stop-color="#070707" />
              </radialGradient>
              <radialGradient id="orb-core" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="var(--v5-brand)" stop-opacity="0.55" />
                <stop offset="55%" stop-color="var(--v5-brand)" stop-opacity="0.12" />
                <stop offset="100%" stop-color="var(--v5-brand)" stop-opacity="0" />
              </radialGradient>
              <radialGradient id="orb-die" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="var(--v5-on-brand)" />
                <stop offset="100%" stop-color="#000000" />
              </radialGradient>
              <filter id="orb-soft" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.2" />
              </filter>
            </defs>

            <!-- Outer dashed orbit -->
            <circle cx="120" cy="120" r="108" fill="none" stroke="var(--v5-surface-2)" stroke-width="1" stroke-dasharray="2 5" />

            <!-- 4 fixed satellites -->
            <g v-for="(s, i) in satellites" :key="`sat-${i}`">
              <circle :cx="s.x" :cy="s.y" r="6" fill="var(--v5-brand)" opacity="0.12" filter="url(#orb-soft)" />
              <circle :cx="s.x" :cy="s.y" r="2.4" fill="var(--v5-brand)" opacity="0.75">
                <animate attributeName="opacity" values="0.75;0.3;0.75" :dur="`${2.2 + i * 0.4}s`" repeatCount="indefinite" />
              </circle>
            </g>

            <!-- Active orbiting node + comet halo -->
            <g>
              <circle r="7" fill="var(--v5-brand)" opacity="0.25">
                <animateMotion dur="9s" repeatCount="indefinite" :path="orbitPath" rotate="auto" />
              </circle>
              <circle r="3.4" fill="var(--v5-brand)">
                <animateMotion dur="9s" repeatCount="indefinite" :path="orbitPath" rotate="auto" />
              </circle>
            </g>

            <!-- Expanding pulse rings (2× staggered) -->
            <circle cx="120" cy="120" r="36" fill="none" stroke="var(--v5-brand)" stroke-width="1.4">
              <animate attributeName="r" from="36" to="92" dur="2.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.55;0;0" keyTimes="0;0.75;1" dur="2.6s" repeatCount="indefinite" />
            </circle>
            <circle cx="120" cy="120" r="36" fill="none" stroke="var(--v5-brand)" stroke-width="1.4">
              <animate attributeName="r" from="36" to="92" dur="2.6s" begin="1.3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.55;0;0" keyTimes="0;0.75;1" dur="2.6s" begin="1.3s" repeatCount="indefinite" />
            </circle>

            <!-- Middle thin ring -->
            <circle cx="120" cy="120" r="72" fill="none" stroke="#262626" stroke-width="1" />
            <!-- Center radial glow -->
            <circle cx="120" cy="120" r="56" fill="url(#orb-core)" />

            <!-- Chip badge -->
            <rect x="90" y="90" width="60" height="60" rx="14" fill="url(#orb-chip)" stroke="var(--v5-brand)" stroke-opacity="0.45" stroke-width="1" />

            <!-- PCB pins -->
            <g v-for="(p, i) in pinPos" :key="`pin-${i}`" stroke="var(--v5-brand)" stroke-opacity="0.45" stroke-width="1.3">
              <line :x1="p" y1="90" :x2="p" y2="86" />
              <line :x1="p" y1="150" :x2="p" y2="154" />
              <line x1="90" :y1="p" x2="86" :y2="p" />
              <line x1="150" :y1="p" x2="154" :y2="p" />
            </g>

            <!-- Inner die -->
            <rect x="106" y="106" width="28" height="28" rx="4" fill="url(#orb-die)" stroke="var(--v5-brand)" stroke-opacity="0.55" stroke-width="1" />
            <!-- Brand N -->
            <text x="120" y="124.2" text-anchor="middle" font-size="13" font-weight="600" fill="var(--v5-brand)" fill-opacity="0.85">N</text>
            <!-- LED -->
            <circle cx="120" cy="98" r="1.6" fill="var(--v5-brand)">
              <animate attributeName="opacity" values="1;0.25;1" dur="1.4s" repeatCount="indefinite" />
            </circle>
          </svg>
        </view>
      </view>

      <view class="intro-hero anim-hero">
        <text class="intro-title">{{ t.intro.title1 }}</text>
        <text class="intro-sub">{{ t.intro.subtitleLine1 }}</text>

        <view class="intro-stats anim-stats">
          <view class="stat-item">
            <view class="stat-dot" />
            <text class="stat-num">{{ fmtNum(devices) }}</text>
            <text class="stat-label">{{ t.intro.statsDevices }}</text>
          </view>
          <view class="stat-sep" />
          <view class="stat-item">
            <text class="stat-num stat-num--brand">${{ fmtNum(paid) }}</text>
            <text class="stat-label">{{ t.intro.statsPaidToday }}</text>
          </view>
        </view>
      </view>

      <view class="intro-cta anim-cta">
        <view class="cta-primary" @click="goRegister">
          <text class="cta-primary__t">{{ t.intro.getStarted }}</text>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
          </svg>
        </view>
        <view class="cta-secondary" @click="goLogin">
          <text class="cta-secondary__t">{{ t.intro.signIn }}</text>
        </view>
        <view class="intro-terms">
          <text class="terms-left">{{ t.intro.termsLeft }} </text>
          <text class="terms-link active:opacity-70" @click="goTerms">{{ t.intro.termsLink }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useT } from "@/i18n/use-t";

const t = useT();
const paid = ref(1247893);
const devices = ref(28432);

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

// Deterministic PRNG (SSR-safe in the prototype; here just keeps positions stable).
function mulberry32(seed: number) {
  return function () {
    let x = (seed += 0x6d2b79f5);
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const positions = Array.from({ length: 18 }).map((_, i) => {
  const rng = mulberry32(i + 1);
  return {
    top: `${(5 + rng() * 70).toFixed(2)}%`,
    left: `${(rng() * 95).toFixed(2)}%`,
    delay: +(rng() * 2.5).toFixed(2),
    scale: +(0.6 + rng() * 1.2).toFixed(2),
  };
});

// ComputeOrb geometry (cx=cy=120, orbitR=108)
const satellites = [
  { x: 120, y: 12 },
  { x: 228, y: 120 },
  { x: 120, y: 228 },
  { x: 12, y: 120 },
];
const pinPos = [0, 1, 2, 3].map((i) => 98 + i * 14.6);
const orbitPath = "M 120 12 A 108 108 0 1 1 119.999 12 Z";

let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => {
    paid.value += Math.floor(Math.random() * 250) + 80;
    devices.value += Math.floor(Math.random() * 3);
  }, 1800);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function goRegister() {
  uni.reLaunch({ url: "/pages/register/register", fail: () => {} });
}
function goLogin() {
  uni.reLaunch({ url: "/pages/login/login", fail: () => {} });
}
function goTerms() {
  uni.navigateTo({ url: "/pages/onboarding/terms", fail: () => {} });
}
</script>

<style scoped>
.intro-root {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--v5-bg);
}
.intro-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(120% 70% at 50% -10%, rgba(198, 255, 58, 0.18), transparent 60%);
}
.intro-vignette {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 180px;
  pointer-events: none;
  background: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0.85) 25%, rgba(0, 0, 0, 0.45) 60%, transparent 100%);
}
.intro-dotgrid {
  position: absolute;
  inset: 0;
  opacity: 0.5;
}
.intro-node {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 9999px;
  background: var(--v5-brand);
}

.intro-content {
  position: relative;
  height: 100%;
  padding: 0 24px;
  display: flex;
  flex-direction: column;
}
.intro-orb-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 40px;
}
.intro-orb {
  position: relative;
  width: 240px;
  height: 240px;
}
.orb-glow {
  position: absolute;
  left: 50%;
  bottom: 8px;
  transform: translateX(-50%);
  width: 170px;
  height: 34px;
  border-radius: 9999px;
  background: color-mix(in oklab, var(--v5-brand) 20%, transparent);
  filter: blur(28px);
}
.orb-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.intro-hero {
  text-align: center;
  padding-bottom: 8px;
}
.intro-title {
  display: block;
  font-family: var(--font-v5);
  font-size: 30px;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--v5-ink);
}
.intro-sub {
  display: block;
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--v5-ink-3);
  padding: 0 16px;
}
.intro-stats {
  margin-top: 20px;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 6px 14px;
  border-radius: 9999px;
  background: rgba(15, 15, 15, 0.8);
  border: 1px solid var(--v5-surface-2);
  backdrop-filter: blur(12px);
}
.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.stat-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: var(--v5-brand);
  animation: intro-pulse 1.6s ease-in-out infinite;
}
.stat-num {
  font-family: var(--font-v5);
  font-variant-numeric: tabular-nums;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--v5-ink);
}
.stat-num--brand {
  color: var(--v5-brand);
}
.stat-label {
  font-size: 11.5px;
  color: var(--v5-ink-3);
}
.stat-sep {
  width: 2px;
  height: 2px;
  border-radius: 9999px;
  background: var(--v5-surface-3);
}

.intro-cta {
  padding-top: 40px;
  padding-bottom: 40px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cta-primary {
  width: 100%;
  height: 54px;
  border-radius: 9999px;
  background: var(--v5-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.cta-primary__t {
  font-size: 15px;
  font-weight: 500;
  color: var(--v5-on-brand);
}
.cta-secondary {
  width: 100%;
  height: 54px;
  border-radius: 9999px;
  background: var(--v5-surface);
  border: 1px solid var(--v5-surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.cta-secondary__t {
  font-size: 14px;
  font-weight: 600;
  color: var(--v5-ink);
}
.intro-terms {
  text-align: center;
  padding-top: 8px;
  font-size: 12px;
  color: var(--v5-ink-4);
}
.terms-link {
  color: var(--v5-ink-3);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* framer-motion → CSS entrance animations */
.anim-orb {
  animation: intro-scale-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.anim-hero {
  animation: intro-fade-up 0.6s ease 0.5s both;
}
.anim-stats {
  animation: intro-fade-in 0.6s ease 0.9s both;
}
.anim-cta {
  animation: intro-fade-up 0.6s ease 1.2s both;
}
@keyframes intro-scale-in {
  from { transform: scale(0.85); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@keyframes intro-fade-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes intro-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes intro-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
