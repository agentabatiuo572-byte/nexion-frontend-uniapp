<template>
  <!-- Earnings milestone celebration overlay. Driven by useMilestones().active.
       Ported from Nexion-prototype/app/components/milestone-watcher.tsx — React
       Confetti + framer-motion replaced with CSS @keyframes (App webview has no
       react-dom portal / framer). App.vue's 4s poll calls store.show(); this
       host renders + auto-dismisses after OVERLAY_DURATION_MS. -->
  <view v-if="m.active" class="ms-overlay" @click="m.dismiss()">
    <!-- Backdrop dim + blur — lowers chassis noise so the medal is the focus. -->
    <view class="ms-backdrop" />

    <!-- Glow halo behind the medal card. -->
    <view class="ms-halo" />

    <!-- CSS confetti burst — fixed particle set, varied via per-particle style. -->
    <view class="ms-confetti">
      <view
        v-for="p in particles"
        :key="p.i"
        class="ms-particle"
        :style="p.style"
      />
    </view>

    <!-- Medal card -->
    <view class="ms-card" @click.stop>
      <view class="ms-card__inner">
        <view class="ms-medal">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--v5-brand)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </svg>
        </view>

        <text class="ms-amount">${{ thresholdLabel }}+</text>
        <text class="ms-title">{{ titleText }}</text>
        <text class="ms-body">{{ bodyText }}</text>

        <view class="ms-chip">
          <text class="ms-chip__label">{{ chipText }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, watch, onUnmounted } from "vue";
import { useMilestones } from "@/store/milestones";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";

const OVERLAY_DURATION_MS = 5_200;
const PARTICLE_COUNT = 36;

const m = useMilestones();
const t = useT();

// ── Derived copy (i18n) ──
const thresholdLabel = computed(() =>
  m.active ? m.active.threshold.toLocaleString() : "",
);

const titleText = computed(() =>
  m.active ? fmt(t.value.milestones.title, { amount: m.active.threshold.toLocaleString() }) : "",
);

const bodyText = computed(() => {
  if (!m.active) return "";
  const ns = t.value.milestones as Record<string, string>;
  return ns[m.active.label] ?? ns.genericBody;
});

const chipText = computed(() =>
  m.active
    ? fmt(t.value.milestones.nexChip, { amount: m.active.nexReward.toLocaleString() })
    : "",
);

// ── CSS confetti — deterministic per-particle styles (no runtime randomness in
//    template; computed once). Each particle gets an angle, distance, color,
//    delay, size, and rotation baked into inline style consumed by @keyframes. ──
const CONFETTI_COLORS = [
  "var(--v5-brand)",
  "var(--v5-tech-cyan)",
  "var(--v5-warning)",
  "var(--v5-brand-2)",
  "var(--v5-ink)",
];

interface Particle {
  i: number;
  style: Record<string, string>;
}

const particles = computed<Particle[]>(() => {
  // Re-seeded per fire via active.id so each celebration looks fresh.
  const seedStr = m.active?.id ?? "";
  let seed = 0;
  for (let k = 0; k < seedStr.length; k++) seed = (seed * 31 + seedStr.charCodeAt(k)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = rand() * Math.PI * 2;
    const dist = 90 + rand() * 200;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const color = CONFETTI_COLORS[Math.floor(rand() * CONFETTI_COLORS.length)];
    const size = 6 + rand() * 7;
    const delay = rand() * 0.45;
    const dur = 3.4 + rand() * 1.6;
    const rot = (rand() - 0.5) * 1200;
    return {
      i,
      style: {
        "--dx": `${dx.toFixed(1)}px`,
        "--dy": `${dy.toFixed(1)}px`,
        "--rot": `${rot.toFixed(0)}deg`,
        "--cdelay": `${delay.toFixed(2)}s`,
        "--cdur": `${dur.toFixed(2)}s`,
        width: `${size.toFixed(1)}px`,
        height: `${(size * 0.42).toFixed(1)}px`,
        background: color,
      },
    };
  });
});

// ── Auto-dismiss timer — restarts on each new fire ──
let timer: ReturnType<typeof setTimeout> | null = null;

function clearTimer() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

watch(
  () => m.active?.id,
  (id) => {
    clearTimer();
    if (id != null) {
      timer = setTimeout(() => m.dismiss(), OVERLAY_DURATION_MS);
    }
  },
);

onUnmounted(clearTimer);
</script>

<style scoped>
.ms-overlay {
  position: fixed;
  inset: 0;
  z-index: 9300;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* Backdrop — dark dim + blur over the chassis behind. */
.ms-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px) saturate(120%);
  -webkit-backdrop-filter: blur(8px) saturate(120%);
}

/* Radial glow halo centered behind the card. */
.ms-halo {
  position: absolute;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  background: radial-gradient(
    45% 45% at 50% 50%,
    color-mix(in oklab, var(--v5-brand) 55%, transparent),
    color-mix(in oklab, var(--v5-brand-2) 18%, transparent) 45%,
    transparent 78%
  );
  animation: ms-halo-pulse 3.2s ease-out forwards;
  pointer-events: none;
}

@keyframes ms-halo-pulse {
  0% { opacity: 0; transform: scale(0.6); }
  12% { opacity: 0.9; transform: scale(1); }
  45% { opacity: 0.5; }
  100% { opacity: 0; transform: scale(1.15); }
}

/* ── Confetti ── */
.ms-confetti {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.ms-particle {
  position: absolute;
  left: 50%;
  top: 50%;
  border-radius: 2px;
  opacity: 0;
  animation: ms-particle-fly var(--cdur, 4s) cubic-bezier(0.18, 0.9, 0.32, 1) var(--cdelay, 0s) forwards;
}
@keyframes ms-particle-fly {
  0% {
    transform: translate(-50%, -50%) scale(1.3) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy) + 520px)) scale(0.5) rotate(var(--rot));
    opacity: 0;
  }
}

/* ── Medal card ── */
.ms-card {
  position: relative;
  width: 88%;
  max-width: 300px;
  border: 1px solid var(--v5-border-strong);
  border-radius: 18px;
  padding: 20px;
  overflow: hidden;
  background:
    radial-gradient(70% 60% at 50% 0%, color-mix(in oklab, var(--v5-brand) 22%, transparent) 0%, transparent 70%),
    radial-gradient(60% 50% at 50% 100%, color-mix(in oklab, var(--v5-tech-cyan) 14%, transparent) 0%, transparent 70%),
    var(--v5-surface);
  box-shadow: var(--v5-card-shadow-lift-strong);
  animation: ms-card-pop 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes ms-card-pop {
  0% { transform: scale(0.6) translateY(24px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
.ms-card__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.ms-medal {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--v5-brand-soft);
  animation: ms-medal-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
}
@keyframes ms-medal-pop {
  0% { transform: scale(0.3) rotate(-25deg); }
  100% { transform: scale(1) rotate(0deg); }
}
.ms-amount {
  margin-top: 12px;
  font-size: 26px;
  font-weight: 600;
  line-height: 1;
  color: var(--v5-brand);
  font-variant-numeric: tabular-nums;
}
.ms-title {
  margin-top: 6px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--v5-ink);
}
.ms-body {
  margin-top: 4px;
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--v5-ink-3);
}
.ms-chip {
  margin-top: 12px;
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--v5-tech-cyan-soft);
}
.ms-chip__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--v5-tech-cyan);
  font-variant-numeric: tabular-nums;
}
</style>
