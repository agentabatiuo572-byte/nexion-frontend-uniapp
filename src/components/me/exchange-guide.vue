<!--
  Exchange · How it works — presentation of the guide (approved fund board ExchangeHow).
  Overview card with an in-page directory, numbered section cards, callouts and a glass
  return button. Fed either by the published document (HowPublishedContent slot) or by
  the local mock copy; it never decides what the guide says.
-->
<template>
  <view class="xg">
    <view class="xg-ov">
      <view class="xg-ov__copy">
        <text class="xg-ov__title">{{ intro.title }}</text>
        <text v-for="(line, i) in intro.lines" :key="i" class="xg-desc xg-ov__line">{{ line }}</text>
      </view>
      <view class="xg-coins" aria-hidden="true">
        <view class="xg-coin xg-coin--u"><text>U</text></view>
        <view class="xg-coin xg-coin--t"><text>₮</text></view>
        <svg class="xg-coins__swap" width="28" height="20" viewBox="0 0 28 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h18l-4-4M24 13H6l4 4" /></svg>
      </view>
      <view v-if="directory.length > 1" class="xg-toc" role="navigation" :aria-label="directoryLabel">
        <view v-for="item in directory" :key="item.id" class="xg-toc__chip nx-frosted-button" role="link" tabindex="0" @click="jump(item.id)"><text>{{ item.title }}</text></view>
      </view>
    </view>

    <template v-for="part in parts" :key="part.id">
      <template v-if="part.kind === 'section'">
        <view :id="anchor(part.id)" class="xg-sec"><text>{{ part.title }}</text></view>
        <text v-if="part.lead" class="xg-desc xg-lead">{{ part.lead }}</text>
        <view v-if="part.rows.length" class="xg-card">
          <view v-for="(row, i) in part.rows" :key="i" class="xg-item">
            <view class="xg-num"><text>{{ i + 1 }}</text></view>
            <view class="xg-item__copy">
              <text class="xg-item__title">{{ row.title }}</text>
              <text v-if="row.body" class="xg-desc xg-item__body">{{ row.body }}</text>
            </view>
          </view>
        </view>
      </template>
      <view v-else class="xg-call">
        <text class="xg-item__title">{{ part.title }}</text>
        <text class="xg-desc xg-call__body">{{ part.body }}</text>
      </view>
    </template>

    <view class="xg-back nx-frosted-button" role="button" tabindex="0" @click="emit('back')"><text>{{ backLabel }}</text></view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";

type Row = { title: string; body?: string };
type Part =
  | { kind: "section"; id: string; title: string; lead?: string; rows: Row[] }
  | { kind: "callout"; id: string; title: string; body: string };

const props = defineProps<{ intro: { title: string; lines: string[] }; parts: Part[]; backLabel: string; directoryLabel: string }>();
const emit = defineEmits<{ back: [] }>();

const directory = computed(() => props.parts.filter(part => part.kind === "section").map(part => ({ id: part.id, title: part.title })));
const anchor = (id: string) => `exchange-guide-${id}`;

// In-page directory (design system 04.7), same reach as the team rule guides: H5 scrolls the
// DOM directly; the App logic layer runs the same call inside the page WebView.
function jump(id: string) {
  const target = anchor(id);
  if (typeof document !== "undefined") { document.getElementById(target)?.scrollIntoView({ block: "start", behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); return; }
  // #ifdef APP-PLUS
  const pages = getCurrentPages();
  const page = pages[pages.length - 1] as unknown as { $getAppWebview?: () => { evalJS: (script: string) => void } };
  page?.$getAppWebview?.().evalJS(`var target=document.getElementById(${JSON.stringify(target)});if(target){target.scrollIntoView({block:'start',behavior:window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}`);
  // #endif
}
</script>

<style scoped>

.xg-desc { display: block; color: var(--v5-ink-3); font: 400 13px/20px var(--font-v5); }

.xg-ov { display: grid; grid-template-columns: minmax(0, 1fr) 96px; gap: 12px; align-items: center; margin: 15px 16px 0; padding: 20px; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); }
.xg-ov__copy { min-width: 0; }
.xg-ov__title { display: block; color: var(--v5-ink); font: 600 20px/28px var(--font-v5); }
.xg-ov__line { margin-top: 4px; }

.xg-coins { position: relative; width: 96px; height: 80px; }
.xg-coin { position: absolute; display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; font: 600 18px/1 var(--font-jet-mono), ui-monospace, monospace;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.10), inset 0 6px 10px -6px rgba(255,255,255,.24), 0 8px 18px rgba(0,0,0,.25); }
.xg-coin--u { left: 2px; top: 4px; background: color-mix(in srgb, var(--v5-nex) 28%, var(--v5-surface-2)); color: var(--v5-nex-ink); }
.xg-coin--t { right: 2px; bottom: 2px; background: color-mix(in srgb, var(--v5-ink) 12%, var(--v5-surface-2)); color: var(--v5-ink); }
[data-theme="light"] .xg-coin { box-shadow: inset 0 0 0 1px rgba(73,94,125,.12), inset 0 6px 10px -6px rgba(255,255,255,.85), 0 8px 18px rgba(0,0,0,.25); }
.xg-coins__swap { position: absolute; left: 34px; top: 30px; color: var(--v5-brand); }

.xg-toc { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.xg-toc__chip { display: inline-flex; align-items: center; justify-content: center; height: 32px; padding: 0 12px; box-sizing: border-box; border-radius: var(--v5-radius-full); white-space: nowrap; font: 500 13px/18px var(--font-v5); cursor: pointer; }

.xg-sec { margin: 32px 20px 12px; color: var(--v5-ink); font: 600 17px/24px var(--font-v5); scroll-margin-top: 110px; }
.xg-lead { margin: -4px 20px 12px; }

.xg-card { margin: 0 16px; padding: 4px 16px; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); }
.xg-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; }
.xg-item + .xg-item { border-top: 1px solid var(--v5-border); }
.xg-num { display: grid; place-items: center; flex: none; width: 24px; height: 24px; border-radius: 50%; background: var(--v5-brand-soft); color: var(--v5-brand); font: 500 12px/1 var(--font-jet-mono), ui-monospace, monospace; }
.xg-item__copy { flex: 1; min-width: 0; }
.xg-item__title { display: block; color: var(--v5-ink); font: 500 15px/22px var(--font-v5); }
.xg-item__body { margin-top: 4px; }

.xg-call { margin: 32px 16px 0; padding: 16px; border-radius: var(--ui-radius-surface); background: var(--v5-surface-2); }
.xg-call__body { margin-top: 4px; }

.xg-back { display: flex; align-items: center; justify-content: center; height: 48px; margin: 24px 16px 0; padding: 0 20px; box-sizing: border-box; border-radius: var(--v5-radius-full); font: 500 15px/20px var(--font-v5); cursor: pointer; }
.xg-back:active, .xg-toc__chip:active { transform: scale(.97); }

/* One-shot entrance (board: each block rises 8px and fades in, 40ms stagger). Opacity and
   transform only, so it stays on the compositor on low-end phones. */
.xg > * { animation: xg-rise 460ms cubic-bezier(.2, .8, .2, 1) both; }
.xg > :nth-child(2) { animation-delay: 40ms; }
.xg > :nth-child(3) { animation-delay: 80ms; }
.xg > :nth-child(4) { animation-delay: 120ms; }
.xg > :nth-child(5) { animation-delay: 160ms; }
.xg > :nth-child(6) { animation-delay: 200ms; }
.xg > :nth-child(7) { animation-delay: 240ms; }
.xg > :nth-child(8) { animation-delay: 280ms; }
.xg > :nth-child(n+9) { animation-delay: 320ms; }
@keyframes xg-rise { from { opacity: 0; transform: translateY(8px); } }
@media (prefers-reduced-motion: reduce) { .xg > * { animation: none; } .xg-back:active, .xg-toc__chip:active { transform: none; } }
</style>
