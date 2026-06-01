<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useAuthStore } from '@/store/auth'

onLaunch(() => {
  useAuthStore().restore()
})
</script>

<style>
page {
  --v5-bg: #000000;
  --v5-surface: #141414;
  --v5-surface-2: #1f1f1f;
  --v5-surface-3: #2a2a2a;
  --v5-border: rgba(255,255,255,0.06);
  --v5-border-strong: rgba(255,255,255,0.12);
  --v5-ink: #f5f7fa;
  --v5-ink-2: #d1d5db;
  --v5-ink-3: #9ba3b5;
  --v5-ink-4: #6b7385;
  --v5-brand: #9edc1d;
  --v5-brand-deep: #84b82a;
  --v5-brand-soft: rgba(158,220,29,0.20);
  --v5-brand-border: rgba(158,220,29,0.45);
  --v5-on-brand: #0a0a0a;
  --v5-brand-2: #ff7a3d;
  --v5-brand-2-soft: rgba(255,122,61,0.20);
  --v5-brand-2-border: rgba(255,122,61,0.45);
  --v5-success: #9edc1d;
  --v5-success-soft: rgba(158,220,29,0.20);
  --v5-warning: #ffcb4d;
  --v5-warning-soft: rgba(255,203,77,0.20);
  --v5-danger: #ff5c5c;
  --v5-danger-soft: rgba(255,92,92,0.18);
  --v5-tech-cyan: #8e72ff;
  --v5-tech-cyan-soft: rgba(142,114,255,0.20);
  --v5-tech-cyan-border: rgba(142,114,255,0.45);
  --v5-chrome-bg: rgba(0,0,0,0.55);
  --v5-chrome-border: transparent;
  --v5-glass-bg: rgba(255,255,255,0.08);
  --v5-glass-border: rgba(255,255,255,0.12);
  --v5-glass-shadow: 0 2px 8px rgba(0,0,0,0.40);
  --v5-tabbar-bg: rgba(12,12,14,0.22);
  --v5-tabbar-border: rgba(255,255,255,0.10);
  --v5-tabbar-shadow: 0 12px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.10);
  --v5-card-shadow-lift: 0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.55);
  --v5-card-shadow-lift-strong: 0 1px 0 rgba(255,255,255,0.06) inset, 0 12px 32px rgba(0,0,0,0.70);
  --v5-money-aurora:
    radial-gradient(45% 35% at 22% 30%, rgba(142,114,255,0.22), transparent 60%),
    radial-gradient(40% 30% at 78% 20%, rgba(198,255,58,0.18), transparent 60%),
    radial-gradient(50% 40% at 55% 80%, rgba(255,122,61,0.24), transparent 65%);
  --v5-earn-aurora:
    radial-gradient(55% 40% at 18% 75%, rgba(255,142,68,0.22), transparent 65%),
    radial-gradient(50% 35% at 82% 25%, rgba(12,196,214,0.20), transparent 60%),
    radial-gradient(60% 45% at 50% 50%, rgba(124,92,255,0.10), transparent 70%);
  min-height: 100%;
  background: var(--v5-bg);
  color: var(--v5-ink);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

button,
uni-button {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: 1;
}

button::after,
uni-button::after {
  border: 0;
}

input {
  color: inherit;
}

/* H5 only: keep scrolling but hide desktop scrollbars inside uni scroll-view. */
::-webkit-scrollbar,
page::-webkit-scrollbar,
body::-webkit-scrollbar,
uni-page-body::-webkit-scrollbar,
uni-scroll-view::-webkit-scrollbar,
.uni-scroll-view::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

page,
body,
uni-page-body,
uni-scroll-view,
.uni-scroll-view {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
