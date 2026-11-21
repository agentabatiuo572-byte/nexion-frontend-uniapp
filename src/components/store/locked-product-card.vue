<!--
  LockedProductCard (inline variant) — "Coming soon" gen-2 phase-locked card
  (ported from store/page.tsx via locked-product-card.tsx inline branch).
  Anticipation surface: brand-2 aurora drift + 24px grid texture + Lock badge.
  Detailed specs, progress, queue proof and Notify CTA stay collapsed by default.
-->
<template>
  <view ref="cardRef" class="nx-glass-card relative overflow-hidden" :style="rootStyle">
    <!-- aurora drift bg (paused off screen or while the page is hidden) -->
    <view ref="auroraRef" aria-hidden class="locked-card__aurora" :class="{ 'is-paused': !auroraLoop.running.value }" />
    <!-- 24px grid overlay -->
    <view aria-hidden class="locked-card__grid" />

    <view class="relative" style="padding: 16px">
      <!-- Top row — Lock badge + identity + ETA chip -->
      <view class="flex items-start" style="gap: 12px">
        <view class="shrink-0 grid place-items-center relative" :style="lockBoxStyle">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          <view aria-hidden class="locked-card__dot" :class="{ 'is-paused': !auroraLoop.running.value }" :style="lockDotStyle" />
        </view>
        <view class="flex-1 min-w-0 active:opacity-70" role="button" tabindex="0" :aria-expanded="detailsOpen" @click.stop="toggleDetails">
          <view class="flex items-center justify-between" style="gap: 8px">
            <text class="font-mono-tabular" style="font-size: 12px; color: var(--v5-brand-2-ink); font-weight: 500; letter-spacing: 0.04em">{{ t.store.comingSoonHeading }}</text>
            <view class="flex items-center shrink-0" style="gap: 6px">
              <view class="grid place-items-center" :style="toggleStyle">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </view>
            </view>
          </view>
          <text class="block mt-1" :style="titleStyle">{{ (product.name) }}</text>
          <view v-if="detailsOpen">
            <text class="block mt-1 line-clamp-2" style="font-size: var(--ui-type-list-subtitle); color: var(--v5-ink-3); line-height: 1.35">{{ copy.tagline }}</text>
            <view class="mt-2 flex items-center font-mono-tabular truncate" style="gap: 6px; font-size: 12px; color: var(--v5-ink-3)">
              <text style="color: var(--v5-ink-2)">{{ gpuText }}</text>
              <template v-if="props.product.productType !== 'SHARE'">
                <text style="color: var(--v5-ink-4)">·</text>
                <text style="color: var(--v5-ink-2)">{{ vramText }}</text>
              </template>
            </view>
          </view>
        </view>
      </view>

      <!-- Bottom row — Notify + queue social proof -->
      <view v-if="detailsOpen" class="mt-3 flex items-center" style="gap: 10px">
        <view class="flex-1 inline-flex items-center justify-center nx-frosted-button locked-card__notify" role="button" tabindex="0" :aria-pressed="serverSubscribed" :aria-disabled="notifyBusy || notificationStatus === 'loading'" :aria-busy="notifyBusy || notificationStatus === 'loading'" :aria-label="t.store.lockedNotifyMe" @click.stop="handleNotify">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path :d="serverSubscribed ? 'm5 12 4 4L19 6' : 'M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9'" /><path v-if="!serverSubscribed" d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          <text>{{ notifyBusy || notificationStatus === 'loading' ? t.store.coLoading : notificationStatus === 'error' ? t.ui.retry : t.store.lockedNotifyMe }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch, type CSSProperties } from "vue";
import type { Product } from "@/mock/products";
import { useT } from "@/i18n/use-t";
import { useLocaleStore } from "@/store/locale";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";
import { productNotificationApi, remoteApiEnabled } from "@/api/runtime";
import { useApp } from "@/store/app";
import { captureAccountScope, isCurrentAccountScope } from "@/lib/account-scope";
import { captureRuntimeRevision, isCurrentRuntimeRevision, subscribeRuntimeRevision, type RuntimeRevisionScope } from "@/api/order-api";
import { useLoopsInView } from "@/composables/use-loops-in-view";
import { useScrollGrowProgress, PROGRESS_GROW_TRANSITION } from "@/composables/use-scroll-grow-progress";
import { productCopy, specText } from "@/lib/product-copy";

const props = defineProps<{ product: Product }>();
const app = useApp();
const t = useT();
const locale = useLocaleStore();
const copy = computed(() => productCopy(t.value, props.product, remoteApiEnabled, locale.code));
const gpuText = computed(() => specText(t.value, props.product.gpu, "—"));
const vramText = computed(() => specText(t.value, props.product.vram, "—", "vram"));

const PHASE_TO_PROGRESS: Record<string, { current: number; total: number; pct: number }> = {
  P3: { current: 1, total: 3, pct: 33 },
  P5: { current: 1, total: 5, pct: 20 },
};
const PHASE_TO_QUEUE: Record<string, number> = { P3: 1842, P5: 614 };

const detailsOpen = ref(false);
const notifyBusy = ref(false);
const serverSubscribed = ref(false);
const notificationStatus = ref<"idle" | "loading" | "ready" | "error">("idle");
let notificationEpoch = 0;
let notificationMounted = true;
let lastToggleAt = 0;
const progress = computed(() =>
  props.product.available === undefined && props.product.unlocksAtPhase
    ? PHASE_TO_PROGRESS[props.product.unlocksAtPhase] ?? null
    : null,
);
const queue = computed(() =>
  props.product.available === undefined && props.product.unlocksAtPhase
    ? PHASE_TO_QUEUE[props.product.unlocksAtPhase] ?? null
    : null,
);
const queueText = computed(() => (queue.value ?? 0).toLocaleString());

const { elRef: cardRef, inView: cardInView } = useScrollGrowProgress({ threshold: 0.01, fallbackInView: false, nativeSelector: ".nx-glass-card" });
const auroraLoop = useLoopsInView(".locked-card__aurora");
const auroraRef = auroraLoop.elRef;

function requestIsCurrent(scope: ReturnType<typeof captureAccountScope>, epoch: number, accountKey: string, runScope: RuntimeRevisionScope, productNo: string): boolean {
  return notificationMounted
    && epoch === notificationEpoch
    && isCurrentAccountScope(scope)
    && String(app.accountKey) === accountKey
    && props.product.id === productNo
    && isCurrentRuntimeRevision(runScope);
}

async function reloadNotificationState(): Promise<void> {
  if (notifyBusy.value || notificationStatus.value === "loading") return;
  const epoch = ++notificationEpoch;
  const scope = captureAccountScope();
  const runScope = captureRuntimeRevision();
  const accountKey = scope.accountKey;
  const productNo = props.product.id;
  notificationStatus.value = "loading";
  try {
    const result = await productNotificationApi.status(productNo);
    if (!requestIsCurrent(scope, epoch, accountKey, runScope, productNo)) return;
    if (result.serverCanonical && result.productNo === productNo) {
      serverSubscribed.value = result.subscribed;
      notificationStatus.value = "ready";
    } else {
      notificationStatus.value = "error";
    }
  } catch {
    // Status is a best-effort hydration. The CTA remains available and only
    // a confirmed mutation can move it to the subscribed state.
    if (requestIsCurrent(scope, epoch, accountKey, runScope, productNo)) notificationStatus.value = "error";
  }
}

async function handleNotify() {
  if (notifyBusy.value || notificationStatus.value === "loading") return;
  const scope = captureAccountScope();
  const runScope = captureRuntimeRevision();
  const accountKey = scope.accountKey;
  const productNo = props.product.id;
  if (notificationStatus.value !== "ready") {
    const reading = reloadNotificationState();
    const epoch = notificationEpoch;
    await reading;
    if (requestIsCurrent(scope, epoch, accountKey, runScope, productNo) && notificationStatus.value === "error") toast.error(t.value.authOtp.errorServiceUnavailable);
    return;
  }
  // A mutation also advances the local request epoch so an older GET (or a
  // previous mutation) cannot overwrite its confirmed state for this account.
  const epoch = ++notificationEpoch;
  const nextSubscribed = !serverSubscribed.value;
  notifyBusy.value = true;
  try {
    const result = nextSubscribed
      ? await productNotificationApi.subscribe(productNo)
      : await productNotificationApi.unsubscribe(productNo);
    if (!requestIsCurrent(scope, epoch, accountKey, runScope, productNo)) return;
    if (result.serverCanonical && result.productNo === productNo && result.subscribed === nextSubscribed) {
      serverSubscribed.value = nextSubscribed;
      if (nextSubscribed) toast.success(fmt(t.value.store.notifyToast, { name: (props.product.name) }));
    } else {
      toast.error(t.value.authOtp.errorServiceUnavailable);
    }
  } catch {
    if (!requestIsCurrent(scope, epoch, accountKey, runScope, productNo)) return;
    // A failed request is not a subscription. Keep the CTA available for a
    // retry and avoid claiming success from stale UI state.
    toast.error(t.value.authOtp.errorServiceUnavailable);
  } finally {
    if (requestIsCurrent(scope, epoch, accountKey, runScope, productNo)) notifyBusy.value = false;
  }
}

function resetNotificationState() {
  // Account rebinds must clear the prior account's status immediately; the
  // next GET is fenced by the new account scope/epoch before it may restore it.
  notificationEpoch += 1;
  serverSubscribed.value = false;
  notifyBusy.value = false;
  notificationStatus.value = "idle";
}
watch(() => String(app.accountKey), resetNotificationState, { flush: "sync" });
watch(() => props.product.id, resetNotificationState, { flush: "sync" });
watch([cardInView, notificationStatus], ([visible, status]) => {
  if (visible && status === "idle") void reloadNotificationState();
}, { immediate: true });
const stopRuntime = subscribeRuntimeRevision(resetNotificationState);
onUnmounted(() => {
  stopRuntime();
  notificationMounted = false;
  notificationEpoch += 1;
});
function toggleDetails() {
  const now = Date.now();
  if (now - lastToggleAt < 120) return;
  lastToggleAt = now;
  detailsOpen.value = !detailsOpen.value;
  if (detailsOpen.value && notificationStatus.value === "idle") void reloadNotificationState();
}

const rootStyle: CSSProperties = { boxShadow: "var(--nx-glass-edge)",
  background: "var(--nx-glass-fill)",
  borderRadius: "var(--nx-glass-radius)",
};

const lockBoxStyle: CSSProperties = {
  width: "44px",
  height: "44px",
  borderRadius: "12px",
  background:
    "linear-gradient(135deg, color-mix(in srgb, var(--v5-brand-2) 10%, transparent), color-mix(in srgb, var(--v5-tech-cyan) 8%, transparent))",
};

const lockDotStyle: CSSProperties = {
  position: "absolute",
  bottom: "-2px",
  right: "-2px",
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  background: "var(--v5-tech-cyan)",
  border: "2px solid var(--v5-surface)",
};

const stageChipStyle: CSSProperties = {
  padding: "2px 7px",
  borderRadius: "4px",
  background: "var(--v5-brand-2-soft)",
  color: "var(--v5-brand-2-ink)",
  fontSize: "12px",
  fontWeight: 600,
};
const toggleBaseStyle: CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "999px",
  color: "var(--v5-brand-2-ink)",
  background: "var(--v5-brand-2-soft)",
  transition: "transform 160ms ease",
};
const toggleStyle = computed<CSSProperties>(() => ({
  ...toggleBaseStyle,
  transform: detailsOpen.value ? "rotate(180deg)" : "rotate(0deg)",
}));

// The product name is the card's display title (10 §10.1 展示标题, 26/34 at 390), read from the role variables.
const titleStyle: CSSProperties = {
  font: "var(--ui-type-display-title-weight) var(--ui-type-display-title)/var(--ui-type-display-title-lh) var(--font-v5)",
  color: "var(--v5-ink)",
  letterSpacing: "-0.02em",
};

const barFillStyle = computed<CSSProperties>(() => ({
  height: "100%",
  width: `${cardInView.value ? (progress.value?.pct ?? 0) : 0}%`,
  background: "linear-gradient(90deg, var(--v5-brand-2) 0%, var(--v5-tech-cyan) 100%)",
  transition: cardInView.value ? PROGRESS_GROW_TRANSITION : "none",
  willChange: "width",
}));


</script>
<style scoped>
/* The coming-soon card is a neutral solid content card (01 §1.1.2): it is not a main visual listed in 04 and has no
   approved board, so it carries no corner light and no grid. The decorative layers stay in the markup but do not render. */
.locked-card__aurora, .locked-card__grid { display: none; }
/* The lock dot is a static mark: only live state loops (07 §7.1, design-rules Motion). */
.locked-card__dot::after { content: ""; position: absolute; inset: -2px; border-radius: 50%; background: var(--v5-tech-cyan); border: 2px solid var(--v5-surface); }
/* In-card action on a solid card: the shared neutral glass M (03 §3.1), button role 15/20 at 500. */
.locked-card__notify { gap: 6px; min-height: 40px; box-sizing: border-box; padding: 8px 16px; border-radius: 999px; font: var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5); }
.locked-card__notify:active { transform: scale(.98); }
</style>
