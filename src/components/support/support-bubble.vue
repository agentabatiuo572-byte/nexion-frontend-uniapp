<!--
  SupportBubble — the floating shortcut to the dedicated advisor.

  The chassis mounts one shortcut on home/earn/team, above its navigation pill.
  Human support stays available with or without unread replies; the badge counts
  unread advisor / support replies only, and only then does the button glow and
  beat (amber, the unread colour shared with the header message badge). Route gating lives in the chassis; its
  measured navigation height includes the safe area.
-->
<template>
    <view class="nx-support-bubble" :class="{ 'nx-support-bubble--dimmed': hidden, 'nx-support-bubble--light': theme.resolved === 'light', 'nx-support-bubble--unread': showUnreadBadge }" :style="offset ? { transform: `translateY(-${offset}px)` } : undefined" role="button" :tabindex="hidden ? -1 : 0" :aria-hidden="hidden || undefined" :aria-label="t.coreReview.supportHelp" @click="open" @keydown.enter.prevent="!hidden && open()" @keydown.space.prevent="!hidden && open()">
      <view class="nx-support-motion">
        <view v-if="showUnreadBadge" class="nx-support-beat" aria-hidden="true" />
        <view class="nx-support-btn">
          <SupportAvatar :size="36" :appearance="theme.resolved" class="nx-support-avatar" />
          <view v-if="showUnreadBadge" :key="totalUnread" class="nx-support-badge"><text class="nx-support-badge-t">{{ unreadLabel }}</text></view>
        </view>
      </view>
    </view>
</template>

<script setup lang="ts">
import { runPassiveTabRead } from "@/lib/passive-tab-read";
import { computed, inject, onMounted, onUnmounted, ref, watch } from "vue";
import { CHASSIS_QUERY_SCOPE } from "@/composables/use-loops-in-view";
import { useConversations } from "@/store/conversations";
import { remoteApiEnabled } from "@/api/runtime";
import { useMessageDrawer } from "@/store/message-drawer";
import { useT } from "@/i18n/use-t";
import SupportAvatar from "./support-avatar.vue";
import { formatUnreadBadge } from "@/lib/unread-badge";
import { useTheme } from "@/store/theme";

// lift: how far the shortcut moves up while the floating payment bar sits under it (bar height + 12, set by the chassis).
// visit: changes when the page shows or switches tab; layout: changes when the page content changes size (both from the chassis).
const props = defineProps<{ dimmed?: boolean; lift?: number; visit?: string; layout?: number }>();

const t = useT();
const theme = useTheme();
const conversations = useConversations();
const messageCenter = useMessageDrawer();

// The floating shortcut retains only unread human advisor/support replies.
// Notification and ticket counts belong to the unified message center.
const humanUnread = computed(() =>
  [...conversations.byType("advisor"), ...conversations.byType("support")]
    .reduce((sum, row) => sum + row.unread, 0),
);
const totalUnread = computed(() => humanUnread.value);
const showUnreadBadge = computed(() => totalUnread.value > 0);
const unreadLabel = computed(() => formatUnreadBadge(totalUnread.value));

// At rest the shortcut must not cover anything the page lets you tap or a key value (02 §2.4; coordinator 2026-11-24: any
// control). Pages mark those .nx-keep-clear. It takes the lowest spot at its usual place, or above the payment bar while
// that shows (lift), that keeps 8px clear of every marked target in its column, and stays hidden (as while scrolling) when
// only the header is left. With nothing in the way it sits at its usual place, so closing the bar brings it back there.
const SUPPORT_GAP = 12; // the shortcut's own bottom offset above the navigation (CSS below)
const KEEP_CLEAR_GAP = 8;
const avoid = ref(0);
const blocked = ref(false);
// After the page shows, the bar comes or goes or a scroll stops, the shortcut stays hidden (and untappable) until its spot
// has been re-read, then fades in there; it never shows at a spot it has not checked.
const pending = ref(true);
const offset = computed(() => (props.lift ?? 0) + avoid.value);
const hidden = computed(() => props.dimmed || blocked.value || pending.value);
let reading = 0;
// The chassis that mounts the shortcut: its targets are searched there, not in the page uni takes as current.
const chassisScope = inject(CHASSIS_QUERY_SCOPE)!;
type Rect = { top: number; bottom: number; left: number; right: number; height: number };
function settle() {
  if (props.dimmed) return;
  const lift = props.lift ?? 0;
  const read = ++reading;
  uni.createSelectorQuery().in(chassisScope).select('.nx-tabbar-wrap').boundingClientRect().select('.nx-support-bubble').boundingClientRect()
    .selectAll('.nx-keep-clear').boundingClientRect().select('.nx-header').boundingClientRect()
    .exec(([wrap, self, targets, header]: [Rect | null, Rect | null, Rect[] | null, Rect | null]) => {
      if (read !== reading || !wrap || !self || lift !== (props.lift ?? 0) || props.dimmed) return;
      const base = wrap.top - SUPPORT_GAP - lift;
      const blockers = (targets ?? []).filter(r => r.height > 0 && r.right > self.left - KEEP_CLEAR_GAP && r.left < self.right + KEEP_CLEAR_GAP);
      let bottom = base;
      for (let moved = true; moved;) {
        moved = false;
        for (const r of blockers) if (r.top - KEEP_CLEAR_GAP < bottom && r.bottom + KEEP_CLEAR_GAP > bottom - self.height) { bottom = r.top - KEEP_CLEAR_GAP; moved = true; }
      }
      blocked.value = bottom - self.height < (header?.bottom ?? 0) + KEEP_CLEAR_GAP;
      avoid.value = blocked.value ? 0 : Math.round(base - bottom);
      // Reveal one frame after the jump, so the move itself is never animated in view.
      if (pending.value) setTimeout(() => { if (read === reading) pending.value = false; }, 50);
    });
}
// Re-read only when something moved: the page shows or switches tab (visit; content that arrives late, like the benefit
// cards, gets a few more reads in its first seconds, then reading stops), the page content changes size (layout), a scroll
// stops (dimmed) or the bar comes, goes or changes height (lift).
let burst: ReturnType<typeof setTimeout>[] = [];
watch(() => [props.lift, props.dimmed, props.visit], () => {
  pending.value = true;
  burst.forEach(clearTimeout);
  burst = [50, 400, 1200, 2500].map(ms => setTimeout(settle, ms));
}, { immediate: true });
watch(() => props.layout, () => { setTimeout(settle, 0); });
onUnmounted(() => burst.forEach(clearTimeout));

// Human support uses the same full-page center as the bell, opening Service.
function open() {
  messageCenter.show("service");
}

onMounted(() => {
  if (remoteApiEnabled) {
    void runPassiveTabRead("conversations", () => conversations.refresh(), { owner: conversations.scopeInvalidated }, () => !conversations.loading && !conversations.error).catch(() => undefined);
  }
});
</script>

<style scoped>
.nx-support-bubble {
  position: absolute;
  right: 16px;
  bottom: calc(100% + 12px);
  z-index: 1;
  color: var(--v5-ink);
  transition: opacity 150ms, transform 280ms cubic-bezier(.2,.8,.2,1);
  /* Rounded hit area returns transparent corners to the underlying content. */
  border-radius: 999px;
}
/* Hidden, it moves without animating; showing again only fades in. */
.nx-support-bubble--dimmed { opacity: 0; pointer-events: none; transition: opacity 150ms; }
.nx-support-bubble--dimmed .nx-support-motion,
.nx-support-bubble--dimmed .nx-support-beat { animation-play-state: paused; }
.nx-support-bubble--light .nx-support-btn {
  box-shadow: 0 3px 12px rgba(42, 53, 24, .14), inset 0 0 0 1px #dde4d3;
}
/* Unread: a steady amber glow on the button plus an outward ring every 2s. */
.nx-support-bubble--unread .nx-support-btn {
  box-shadow: 0 0 24px color-mix(in srgb, var(--ui-unread-badge) 30%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--ui-unread-badge) 50%, transparent);
}
.nx-support-bubble--light.nx-support-bubble--unread .nx-support-btn {
  box-shadow: 0 3px 12px rgba(42, 53, 24, .14), 0 0 20px rgba(245, 170, 30, .45), inset 0 0 0 1px color-mix(in srgb, var(--v5-warning) 45%, transparent);
}
.nx-support-bubble--light { --nx-support-beat-from: .6; }
/* The ring scales and fades (transform + opacity only) behind the button. */
.nx-support-beat {
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: 999px;
  background: var(--ui-unread-badge);
  opacity: 0;
  pointer-events: none;
  animation: nx-support-beat 2s cubic-bezier(.2, .6, .35, 1) infinite;
}
@keyframes nx-support-beat {
  0% { transform: scale(1); opacity: var(--nx-support-beat-from, .45); }
  70%, 100% { transform: scale(1.58); opacity: 0; }
}
/* The outer hit target's transform is the lift above the payment bar, so the press scales the button inside it;
   idle float belongs to the motion layer between them. */
.nx-support-btn { transition: transform 120ms cubic-bezier(.2,.8,.2,1); }
.nx-support-bubble:active .nx-support-btn {
  transform: scale(.94);
}
.nx-support-btn {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: var(--v5-surface);
}
/* Float the avatar and badge together while keeping the outer hit target stationary. */
.nx-support-motion { position: relative; z-index: 1; width: 48px; height: 48px; animation: nx-support-float 3.4s ease-in-out infinite; }
@keyframes nx-support-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
.nx-support-badge {
  position: absolute;
  z-index: 2;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--ui-unread-badge);
  display: grid;
  place-items: center;
  border: 1px solid var(--v5-bg);
  animation: nx-support-unread 420ms cubic-bezier(.2,1.5,.3,1) both;
}
@keyframes nx-support-unread { from { transform: scale(.65); } to { transform: scale(1); } }
.nx-support-badge-t {
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-v5);
  color: var(--ui-unread-badge-ink);
  line-height: 1;
}
.nx-support-avatar { position: relative; z-index: 1; }
.nx-support-bubble:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) {
  .nx-support-bubble, .nx-support-btn { transition: none; }
  .nx-support-bubble:active .nx-support-btn { transform: none; }
  .nx-support-motion, .nx-support-badge, .nx-support-beat { animation: none; }
}
</style>
