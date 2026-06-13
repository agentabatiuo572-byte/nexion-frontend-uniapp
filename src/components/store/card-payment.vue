<!--
  CardPaymentForm — ported from Nexion-prototype/app/(main)/store/checkout/
  page.tsx (CardPaymentForm). Saved-card selector + per-charge CVV + fee/total.

  DEGRADED: the source reads useCards (saved-card store) which is NOT ported
  yet. To keep the buy flow completable, this renders a single mock saved card
  so the user can enter CVV and pay. When cards.ts + /me/wallet/cards/new land,
  swap MOCK_CARDS for `useCards()` and restore the empty-state + add-card link.
  (Reported to parent — see PORT report §8.)
-->
<template>
  <view class="rounded-2xl border overflow-hidden" :style="cardStyle">
    <!-- Header -->
    <view class="flex items-center border-b" :style="headerStyle">
      <view class="grid place-items-center shrink-0" :style="iconBoxStyle">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></svg>
      </view>
      <view class="flex-1 min-w-0">
        <text class="block" :style="headerTitleStyle">{{ t.store.coCardSelect }}</text>
        <view class="flex items-center" style="gap: 6px; margin-top: 2px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          <text style="font-size: 11.5px; color: var(--v5-ink-3)">{{ t.store.coCardSecurity }}</text>
        </view>
      </view>
    </view>

    <!-- Card list -->
    <view style="padding: 12px">
      <view
        v-for="card in cards"
        :key="card.tokenId"
        class="w-full flex items-center rounded-xl active:opacity-90"
        :style="cardRowStyle(card.tokenId === selectedTokenId)"
        role="button"
        tabindex="0"
        @tap.stop="selectCard(card.tokenId)"
        @click.stop="selectCard(card.tokenId)"
      >
        <view class="grid place-items-center shrink-0" :style="cardRowIconStyle">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></svg>
        </view>
        <view class="flex-1 min-w-0">
          <text class="block font-mono-tabular" :style="cardBrandStyle">{{ brandLabel(card.brand) }} •••• {{ card.last4 }}</text>
          <text class="block font-mono-tabular" style="font-size: 11.5px; color: var(--v5-ink-3); margin-top: 2px">{{ expiryLabel(card) }}</text>
        </view>
        <svg v-if="card.tokenId === selectedTokenId" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M20 6 9 17l-5-5" /></svg>
      </view>
    </view>

    <!-- CVV -->
    <view v-if="selectedCard" style="padding: 8px 20px 16px">
      <view class="flex items-center justify-between" style="margin-bottom: 6px">
        <text class="block" :style="cvvLabelStyle">{{ t.store.coEnterCvv }}</text>
        <text class="font-mono-tabular tabular-nums" :style="cvvCountStyle">{{ cvv.length }}/4</text>
      </view>
      <input
        class="w-full font-mono-tabular tabular-nums"
        :style="cvvInputStyle"
        type="text"
        inputmode="numeric"
        confirm-type="done"
        cursor-spacing="28"
        placeholder="123"
        placeholder-style="color: var(--v5-ink-4)"
        :value="cvv"
        aria-label="CVV"
        autocomplete="cc-csc"
        @focus="cvvFocused = true"
        @blur="cvvFocused = false"
        @input="onCvv"
      />
      <text class="block" :style="cvvHelpStyle">{{ t.store.coCardSecurity }}</text>
    </view>

    <!-- Fee + total -->
    <view class="border-t" :style="totalsBoxStyle">
      <view class="flex items-center justify-between" style="padding: 3px 0">
        <text style="font-size: 12.5px; color: var(--v5-ink-3)">{{ t.store.coSubtotalLabel }}</text>
        <text class="tabular-nums" style="font-size: 13.5px; font-weight: 500; color: var(--v5-ink)">${{ amountText }}</text>
      </view>
      <view class="flex items-center justify-between" style="padding: 3px 0">
        <text style="font-size: 12.5px; color: var(--v5-ink-3)">{{ t.store.coCardFeeLabel }}</text>
        <text class="tabular-nums" style="font-size: 13.5px; font-weight: 500; color: var(--v5-ink)">${{ feeText }}</text>
      </view>
      <view class="flex items-center justify-between" style="padding: 3px 0">
        <text style="font-size: 12.5px; color: var(--v5-ink-3)">{{ t.store.coPayTotalLabel }}</text>
        <text class="tabular-nums" style="font-size: 18px; font-weight: 600; color: var(--v5-ink)">${{ totalText }}</text>
      </view>
    </view>

    <!-- Pay + cancel -->
    <view style="padding: 8px 16px 16px">
      <view class="w-full grid place-items-center active:opacity-90" :style="payBtnStyle" role="button" tabindex="0" :aria-label="payLabel" @tap.stop="onPay" @click.stop="onPay">
        <text @tap.stop="onPay" @click.stop="onPay">{{ payLabel }}</text>
      </view>
      <view class="w-full grid place-items-center active:opacity-80" :style="cancelBtnStyle" role="button" tabindex="0" :aria-label="t.store.coCancel" @tap.stop="emitCancel" @click.stop="emitCancel">
        <text @tap.stop="emitCancel" @click.stop="emitCancel">{{ t.store.coCancel }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";

const props = defineProps<{ amount: number }>();
const emit = defineEmits<{ complete: []; cancel: [] }>();

const t = useT();

// MOCK saved cards (stand-in for the unported useCards store). Keeps the buy
// flow completable; replace with `useCards()` when cards.ts is ported.
interface MockCard {
  tokenId: string;
  brand: "visa" | "mastercard" | "amex" | "unionpay";
  last4: string;
  expiry: string;
  holder: string;
}
const cards: MockCard[] = [
  { tokenId: "tok_mock_1", brand: "visa", last4: "4242", expiry: "08/27", holder: "ALEX NEXION" },
];
function brandLabel(brand: MockCard["brand"]): string {
  switch (brand) {
    case "visa": return "Visa";
    case "mastercard": return "Mastercard";
    case "amex": return "Amex";
    case "unionpay": return "UnionPay";
  }
}
function expiryLabel(card: MockCard): string {
  return fmt(t.value.store.coCardExpiry, { expiry: card.expiry, holder: card.holder });
}

const selectedTokenId = ref<string | null>(cards[0]?.tokenId ?? null);
const cvv = ref("");
const cvvFocused = ref(false);
const selectedCard = computed(() => cards.find((c) => c.tokenId === selectedTokenId.value) ?? null);
const validCvv = computed(() => /^\d{3,4}$/.test(cvv.value));
const valid = computed(() => !!selectedCard.value && validCvv.value);

const fee = computed(() => +(props.amount * 0.035).toFixed(2));
const total = computed(() => +(props.amount + fee.value).toFixed(2));
const amountText = computed(() => props.amount.toLocaleString());
const feeText = computed(() => fee.value.toLocaleString());
const totalText = computed(() => total.value.toLocaleString());

const payLabel = computed(() => {
  if (valid.value) return fmt(t.value.store.coPayAmount, { total: total.value.toLocaleString() });
  return selectedCard.value ? t.value.store.coCvvNeedCvv : t.value.store.coCvvSelectCard;
});

function onCvv(e: Event) {
  const raw = (e as unknown as { detail?: { value?: string }; target?: { value?: string } }).detail?.value ??
    (e as unknown as { target?: { value?: string } }).target?.value ??
    "";
  cvv.value = raw.replace(/\D/g, "").slice(0, 4);
}
function selectCard(tokenId: string) {
  selectedTokenId.value = tokenId;
}
function onPay() {
  if (!valid.value) return;
  emit("complete");
}
function emitCancel() {
  emit("cancel");
}

// ─── styles ───
const cardStyle: CSSProperties = { background: "var(--v5-surface)", borderColor: "var(--v5-border)" };
const headerStyle: CSSProperties = { padding: "16px 20px", gap: "12px", borderColor: "var(--v5-border)" };
const iconBoxStyle: CSSProperties = { width: "36px", height: "36px", borderRadius: "8px", background: "var(--v5-brand-2-soft)" };
const headerTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
function cardRowStyle(selected: boolean): CSSProperties {
  return {
    padding: "12px",
    gap: "12px",
    borderRadius: "12px",
    background: selected ? "var(--v5-brand-2-soft)" : "var(--v5-surface-2)",
  };
}
const cardRowIconStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "8px",
  background: "var(--v5-surface)",
};
const cardBrandStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const cvvLabelStyle: CSSProperties = {
  fontSize: "11.5px",
  color: "var(--v5-ink-3)",
};
const cvvCountStyle: CSSProperties = {
  fontSize: "11px",
  color: "var(--v5-ink-4)",
};
const cvvInputStyle = computed<CSSProperties>(() => ({
  boxSizing: "border-box",
  height: "48px",
  minHeight: "48px",
  background: cvvFocused.value ? "var(--v5-surface)" : "var(--v5-surface-2)",
  border: `1px solid ${cvvFocused.value ? "var(--v5-brand-2)" : "var(--v5-border)"}`,
  borderRadius: "12px",
  padding: "0 14px",
  fontFamily: "var(--font-v5)",
  fontSize: "16px",
  lineHeight: "48px",
  fontWeight: 600,
  color: "var(--v5-ink)",
  outline: "none",
  caretColor: "var(--v5-brand-2)",
  boxShadow: cvvFocused.value ? "0 0 0 3px color-mix(in srgb, var(--v5-brand-2) 18%, transparent)" : "none",
  transition: "border-color 160ms ease, box-shadow 160ms ease, background 160ms ease",
}));
const cvvHelpStyle: CSSProperties = {
  marginTop: "8px",
  fontSize: "11px",
  lineHeight: 1.45,
  color: "var(--v5-ink-4)",
};
const totalsBoxStyle: CSSProperties = {
  padding: "12px 20px 16px",
  borderColor: "var(--v5-border)",
};
const payBtnStyle = computed<CSSProperties>(() => ({
  height: "44px",
  borderRadius: "999px",
  background: valid.value ? "var(--v5-brand-2)" : "var(--v5-surface-2)",
  color: valid.value ? "var(--v5-on-brand)" : "var(--v5-ink-4)",
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 600,
}));
const cancelBtnStyle: CSSProperties = {
  marginTop: "8px",
  height: "40px",
  borderRadius: "12px",
  background: "var(--v5-surface-2)",
  color: "var(--v5-ink-2)",
  fontSize: "12.5px",
};
</script>
