<!--
  Wallet Cards — ported from Nexion-prototype/app/(main)/me/wallet/cards/page.tsx.
  Saved bank cards list + management. Each card: brand + •••• last4, default
  badge, "Set as default" + "Unbind" actions. Empty state + "Add a new card"
  CTA + PCI disclaimer. Reads the new useCards store; remove is destructive →
  confirm() (P: destructive → confirm). Trial-card interception (ported): if the
  card being removed is the bound trial card during an active/grace/extended
  trial, open the retention sheet (useTrialUnbindSheet.show(tokenId)) INSTEAD of
  removing — the sheet's confirm path runs the atomic cancel("unbind") + remove.
  Cross-store check (cards + free-trial) is composed here at the page layer
  (stores never import each other, P-031/032). SetPageHeader → SubPageHeader.
  SSR mounted-guard dropped. Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/wallet" :title="t.cards.listTitle" :subtitle="t.cards.listSubtitle" />

      <view :style="bodyStyle">
        <!-- Empty -->
        <view v-if="cards.length === 0" :style="emptyStyle">
          <view class="grid place-items-center" :style="emptyIconStyle">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></svg>
          </view>
          <text class="block" :style="emptyTitleStyle">{{ t.cards.emptyTitle }}</text>
          <text class="block" :style="emptyHintStyle">{{ t.cards.emptyHint }}</text>
        </view>

        <!-- Card rows -->
        <view v-for="card in cards" :key="card.tokenId" :style="cardRowStyle">
          <view class="flex items-center" :style="cardRowHeadStyle">
            <view class="grid place-items-center shrink-0" :style="cardIconStyle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></svg>
            </view>
            <view class="flex-1 min-w-0">
              <view class="flex items-center" style="gap: 6px">
                <text class="truncate" :style="cardNameStyle">{{ brandLabel(card.brand) }} •••• {{ card.last4 }}</text>
                <view v-if="card.tokenId === defaultTokenId" class="inline-flex items-center font-mono-tabular" :style="defaultBadgeStyle">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--v5-brand)" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.69 21.65a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.453 10.434a.53.53 0 0 1 .294-.904l5.165-.756a2.122 2.122 0 0 0 1.597-1.16z" /></svg>
                  <text style="margin-left: 2px">{{ t.cards.defaultBadge }}</text>
                </view>
              </view>
              <text class="block font-mono-tabular" :style="cardMetaStyle">{{ rowMeta(card) }}</text>
            </view>
          </view>
          <view class="flex" :style="cardActionsStyle">
            <view v-if="card.tokenId !== defaultTokenId" class="flex-1 grid place-items-center active:opacity-70" :style="actionBtnStyle" @click="setDefault(card.tokenId)">
              <view class="inline-flex items-center" style="gap: 6px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                <text :style="actionDefaultTextStyle">{{ t.cards.setDefault }}</text>
              </view>
            </view>
            <view class="flex-1 grid place-items-center active:opacity-70" :style="actionBtnStyle" @click="handleRemove(card)">
              <view class="inline-flex items-center" style="gap: 6px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                <text :style="actionUnbindTextStyle">{{ t.cards.unbind }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- Add new -->
        <view class="flex items-center justify-center active:scale-[0.98]" :style="addBtnStyle" @click="goNew">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
          <text style="margin-left: 6px" :style="addBtnTextStyle">{{ t.cards.addNew }}</text>
        </view>

        <text class="block" :style="disclaimerStyle">{{ t.cards.listDisclaimer }}</text>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { confirm, toast } from "@/store/ui";
import { useCards, brandLabel, type SavedCard } from "@/store/cards";
import { useFreeTrial } from "@/store/free-trial";
import { useTrialUnbindSheet } from "@/store/trial-unbind-retention-sheet";

const t = useT();
const cardsStore = useCards();
const freeTrial = useFreeTrial();
const unbindSheet = useTrialUnbindSheet();

const cards = computed(() => cardsStore.cards);
const defaultTokenId = computed(() => cardsStore.defaultTokenId);

function rowMeta(card: SavedCard): string {
  return fmt(t.value.cards.rowMeta, { expiry: card.expiry, holder: card.holder });
}

function setDefault(tokenId: string) {
  cardsStore.setDefault(tokenId);
}

const TRIAL_HOLDING_STATUSES = ["active", "grace", "extended"] as const;

async function handleRemove(card: SavedCard) {
  // Trial-card interception: if this is the bound trial card during a live
  // trial (active/grace/extended), open the retention sheet INSTEAD of removing.
  // The sheet's "Remove anyway" path runs the atomic cancel("unbind") + remove;
  // "Keep this card" dismisses with no change. (P-031/032: composed here.)
  const isTrialCard =
    freeTrial.cardTokenId === card.tokenId &&
    (TRIAL_HOLDING_STATUSES as readonly string[]).includes(freeTrial.status);
  if (isTrialCard) {
    unbindSheet.show(card.tokenId);
    return;
  }
  // Non-trial card: plain destructive confirm + remove.
  const ok = await confirm({
    title: t.value.cards.unbindConfirmTitle,
    message: `${brandLabel(card.brand)} •••• ${card.last4}`,
    confirmLabel: t.value.cards.unbindConfirmLabel,
    cancelLabel: t.value.cards.unbindCancelLabel,
  });
  if (ok) {
    cardsStore.remove(card.tokenId);
    toast.success(t.value.cards.unbindToast);
  }
}

function goNew() {
  uni.navigateTo({ url: "/pages/me/wallet-cards-new", fail: () => {} });
}

// ── styles ──
const bodyStyle: CSSProperties = { padding: "12px 16px 0" };
const emptyStyle: CSSProperties = {
  marginBottom: "12px",
  borderRadius: "16px",
  border: "1px dashed var(--v5-border-strong)",
  background: "color-mix(in srgb, var(--v5-surface) 40%, transparent)",
  padding: "32px 20px",
  textAlign: "center",
};
const emptyIconStyle: CSSProperties = {
  width: "48px",
  height: "48px",
  margin: "0 auto",
  borderRadius: "999px",
  background: "var(--v5-surface-2)",
};
const emptyTitleStyle: CSSProperties = { marginTop: "12px", fontSize: "14px", fontWeight: 600, color: "var(--v5-ink)" };
const emptyHintStyle: CSSProperties = { marginTop: "4px", fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.4 };

const cardRowStyle: CSSProperties = {
  marginBottom: "12px",
  borderRadius: "16px",
  border: "1px solid var(--v5-border)",
  background: "var(--v5-surface)",
  overflow: "hidden",
};
const cardRowHeadStyle: CSSProperties = { padding: "16px 20px", gap: "12px" };
const cardIconStyle: CSSProperties = { width: "40px", height: "40px", borderRadius: "8px", background: "var(--v5-surface-2)" };
const cardNameStyle: CSSProperties = { fontSize: "14px", fontWeight: 600, color: "var(--v5-ink)" };
const defaultBadgeStyle: CSSProperties = {
  fontSize: "10.5px",
  color: "var(--v5-brand)",
  background: "color-mix(in srgb, var(--v5-brand) 12%, transparent)",
  borderRadius: "6px",
  padding: "1px 6px",
};
const cardMetaStyle: CSSProperties = { marginTop: "2px", fontSize: "11.5px", color: "var(--v5-ink-3)" };
const cardActionsStyle: CSSProperties = { borderTop: "1px solid var(--v5-border)" };
const actionBtnStyle: CSSProperties = { height: "44px", fontSize: "12.5px" };
const actionDefaultTextStyle: CSSProperties = { fontSize: "12.5px", color: "var(--v5-ink-2)" };
const actionUnbindTextStyle: CSSProperties = { fontSize: "12.5px", color: "var(--v5-brand-2)" };

const addBtnStyle: CSSProperties = {
  height: "48px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
};
const addBtnTextStyle: CSSProperties = { fontSize: "13.5px", fontWeight: 500, color: "var(--v5-on-brand)" };
const disclaimerStyle: CSSProperties = {
  marginTop: "16px",
  padding: "0 4px",
  fontSize: "11.5px",
  color: "var(--v5-ink-4)",
  lineHeight: 1.6,
};
</script>
