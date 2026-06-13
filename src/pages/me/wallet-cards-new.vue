<!--
  Bind new bank card — ported from
  Nexion-prototype/app/(main)/me/wallet/cards/new/page.tsx.
  Form: PAN (auto-formatted + brand detect) / expiry / CVV / holder + "set as
  default" toggle. On submit: validate, derive brand + last4, persist via
  useCards.add() (PAN/CVV NEVER stored), navigate back to the cards list.

  ?trial=1 (from a trial claim flow) surfaces the auto-charge disclosure here.
  useSearchParams → onLoad(query). safeReturnTo → inline relative-path guard
  (open-redirect defense). <input type=checkbox> → custom tap toggle (uni).
  router.push(returnTo) → uni.redirectTo. Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/wallet-cards" :title="t.cards.newTitle" />

      <view :style="bodyStyle">
        <!-- Trial auto-charge disclosure (only when ?trial=1) -->
        <view v-if="isTrialBinding" class="flex items-start" :style="trialBoxStyle">
          <view class="grid place-items-center shrink-0" :style="trialIconStyle">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
          </view>
          <view class="flex-1 min-w-0" style="margin-left: 9px">
            <text class="block" :style="trialTitleStyle">{{ t.cards.trialDiscloseTitle }}</text>
            <view :style="trialBodyStyle">
              <text>{{ trialBodyText }}</text>
              <text class="font-mono-tabular" style="color: var(--v5-ink-2)">{{ trialAmountText }}</text>
              <text>{{ trialSuffixText }}</text>
              <text style="color: var(--v5-ink-2)">{{ t.cards.trialDiscloseCancel }}</text>
            </view>
          </view>
        </view>

        <!-- Form card -->
        <view :style="formCardStyle">
          <view class="flex items-center" :style="formHeadStyle">
            <view class="grid place-items-center shrink-0" :style="formHeadIconStyle">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></svg>
            </view>
            <view class="flex-1 min-w-0">
              <text class="block" :style="formHeadTitleStyle">{{ t.cards.formCardType }}</text>
              <view class="flex items-center" :style="formHeadNoteStyle">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                <text style="margin-left: 6px">{{ t.cards.formSecurityNote }}</text>
              </view>
            </view>
            <text v-if="brand !== 'unknown'" class="font-mono-tabular shrink-0" :style="brandChipStyle">{{ brandLabel(brand) }}</text>
          </view>

          <view :style="formFieldsStyle">
            <view>
              <text class="block" :style="labelStyle">{{ t.cards.formPanLabel }}</text>
              <input class="font-mono-tabular tabular-nums" :style="[inputStyle, { letterSpacing: '0.04em' }]" type="text" inputmode="numeric" :value="pan" placeholder="1234 5678 9012 3456" @input="onPan" />
            </view>
            <view class="grid grid-cols-2" style="gap: 8px">
              <view>
                <text class="block" :style="labelStyle">{{ t.cards.formExpiryLabel }}</text>
                <input class="font-mono-tabular tabular-nums w-full" :style="inputStyle" type="text" inputmode="numeric" :value="expiry" placeholder="MM/YY" @input="onExpiry" />
              </view>
              <view>
                <text class="block" :style="labelStyle">{{ t.cards.formCvvLabel }}</text>
                <input class="font-mono-tabular tabular-nums w-full" :style="inputStyle" type="text" inputmode="numeric" :value="cvv" placeholder="123" @input="onCvv" />
              </view>
            </view>
            <view>
              <text class="block" :style="labelStyle">{{ t.cards.formHolderLabel }}</text>
              <input class="w-full" :style="[inputStyle, { textTransform: 'uppercase' }]" type="text" :value="holder" :placeholder="t.cards.formHolderPlaceholder" @input="onHolder" />
            </view>

            <checkbox-group @change="onDefaultGroupChange">
              <label
                class="flex items-center active:opacity-70"
                style="margin-top: 4px; gap: 8px"
                role="switch"
                tabindex="0"
                :aria-label="t.cards.formDefaultCheckbox"
                :aria-checked="setAsDefault ? 'true' : 'false'"
              >
                <checkbox value="default" :checked="setAsDefault" color="var(--v5-brand)" style="transform: scale(0.82); transform-origin: left center" />
                <text :style="checkboxLabelStyle">{{ t.cards.formDefaultCheckbox }}</text>
                <text class="font-mono-tabular" :style="checkboxStateStyle">{{ defaultStateLabel }}</text>
              </label>
            </checkbox-group>
          </view>
        </view>

        <!-- Submit -->
        <view class="grid place-items-center" :class="{ 'active:scale-[0.98]': canSubmit }" :style="submitStyle" role="button" tabindex="0" :aria-label="canSubmit ? t.cards.formSubmit : t.cards.formSubmitDisabled" @tap.stop="handleBind" @click.stop="handleBind">
          <text :style="submitTextStyle">{{ canSubmit ? t.cards.formSubmit : t.cards.formSubmitDisabled }}</text>
        </view>

        <text class="block" :style="disclaimerStyle">{{ t.cards.formDisclaimer }}</text>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";
import { useCards, detectBrand, brandLabel } from "@/store/cards";
import { useTrialConfig } from "@/store/trial-config";

const t = useT();
const cardsStore = useCards();
const trialConfig = useTrialConfig();

// Query (onLoad — page-level): ?trial=1 surfaces auto-charge disclosure;
// ?returnTo=<relative path> for post-bind navigation (open-redirect guarded).
// Initialize from the H5 URL hash query FIRST (covers direct deep-link / refresh,
// and the case where onLoad doesn't re-fire on a hash-only change to an already-
// mounted page instance). onLoad then overrides for the uni.navigateTo path (App
// + in-SPA nav). Without the hash fallback, ?trial=1 on a refreshed/deep-linked
// page failed to surface the auto-charge disclosure. (P-044)
const initialQ = parseHashQuery();
const isTrialBinding = ref(initialQ.trial === "1");
const returnTo = ref(safeReturnTo(initialQ.returnTo, "/pages/me/wallet-cards"));
onLoad((q) => {
  if (q?.trial !== undefined) isTrialBinding.value = q.trial === "1";
  if (q?.returnTo !== undefined) returnTo.value = safeReturnTo(q.returnTo, "/pages/me/wallet-cards");
});

// H5-only hash query parser (App has no window; try/catch returns {}).
function parseHashQuery(): Record<string, string> {
  try {
    const h = (typeof window !== "undefined" && window.location?.hash) || "";
    const qi = h.indexOf("?");
    if (qi < 0) return {};
    const out: Record<string, string> = {};
    new URLSearchParams(h.slice(qi + 1)).forEach((v, k) => { out[k] = v; });
    return out;
  } catch {
    return {};
  }
}
// Open-redirect defense: only accept relative app paths starting with `/pages/`.
function safeReturnTo(raw: string | undefined, fallback: string): string {
  if (raw && raw.startsWith("/pages/")) return raw;
  return fallback;
}

const pan = ref("");
const expiry = ref("");
const cvv = ref("");
const holder = ref("");
const setAsDefault = ref(true);
const isBinding = ref(false);

// uni input event → e.detail.value (typed Event; mirrors topup-card-form).
function detailVal(e: Event): string {
  return (e as unknown as { detail: { value: string } }).detail.value;
}
function onPan(e: Event) {
  const digits = detailVal(e).replace(/\D/g, "").slice(0, 19);
  pan.value = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}
function onExpiry(e: Event) {
  const d = detailVal(e).replace(/\D/g, "").slice(0, 4);
  expiry.value = d.length < 3 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
}
function onCvv(e: Event) {
  cvv.value = detailVal(e).replace(/\D/g, "").slice(0, 4);
}
function onHolder(e: Event) {
  holder.value = detailVal(e);
}
function onDefaultGroupChange(e: Event) {
  const value = (e as unknown as { detail: { value: string[] } }).detail.value;
  setAsDefault.value = value.includes("default");
}

const digits = computed(() => pan.value.replace(/\s/g, ""));
const brand = computed(() => detectBrand(digits.value));
const validPan = computed(() => digits.value.length >= 13);
const validExpiry = computed(() => /^\d{2}\/\d{2}$/.test(expiry.value));
const validCvv = computed(() => /^\d{3,4}$/.test(cvv.value));
const validHolder = computed(() => holder.value.trim().length >= 2);
const valid = computed(() => validPan.value && validExpiry.value && validCvv.value && validHolder.value);
const canSubmit = computed(() => valid.value && !isBinding.value);
const defaultStateLabel = computed(() => (setAsDefault.value ? t.value.cards.formDefaultOn : t.value.cards.formDefaultOff));

// Trial disclosure text (split because the placeholders interleave with
// styled spans — mirror source structure).
const trialBodyText = computed(() => fmt(t.value.cards.trialDiscloseBody, { days: String(trialConfig.config.trialDays) }));
const trialAmountText = computed(() =>
  fmt(t.value.cards.trialDiscloseAmount, { amount: `$${trialConfig.config.trialPriceUSD.toLocaleString()}` }),
);
const trialSuffixText = computed(() =>
  fmt(t.value.cards.trialDiscloseSuffix, { cap: String(trialConfig.config.trialOffsetCapUSD) }),
);

function handleBind() {
  if (!canSubmit.value) return;
  isBinding.value = true;
  // MOCK-ONLY: real backend posts raw PAN/CVV to PSP tokenization (never our
  // server); client stores only display fields. Here we synthesize a fake token.
  const tokenId = cardsStore.add({
    brand: brand.value,
    last4: digits.value.slice(-4),
    expiry: expiry.value,
    holder: holder.value.trim().toUpperCase(),
  }, { makeDefault: setAsDefault.value });
  if (setAsDefault.value) cardsStore.setDefault(tokenId);
  toast.success(fmt(t.value.cards.bindToast, { brand: brandLabel(brand.value), last4: digits.value.slice(-4) }));
  uni.redirectTo({
    url: returnTo.value,
    fail: () => uni.navigateBack({ fail: () => { isBinding.value = false; } }),
  });
}

// ── styles ──
const bodyStyle: CSSProperties = { padding: "12px 16px 0" };
const trialBoxStyle: CSSProperties = {
  marginBottom: "12px",
  borderRadius: "16px",
  padding: "12px 14px",
  background: "var(--v5-surface)",
  border: "1px solid color-mix(in srgb, var(--v5-warning) 40%, transparent)",
};
const trialIconStyle: CSSProperties = {
  width: "26px",
  height: "26px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-warning) 18%, transparent)",
};
const trialTitleStyle: CSSProperties = { fontSize: "12.5px", fontWeight: 600, color: "var(--v5-ink)", lineHeight: 1.4 };
const trialBodyStyle: CSSProperties = { marginTop: "4px", fontSize: "11px", color: "var(--v5-ink-3)", lineHeight: 1.6 };

const formCardStyle: CSSProperties = {
  marginBottom: "12px",
  borderRadius: "16px",
  border: "1px solid var(--v5-border)",
  background: "var(--v5-surface)",
  overflow: "hidden",
};
const formHeadStyle: CSSProperties = {
  padding: "13px 16px",
  borderBottom: "1px solid color-mix(in srgb, var(--v5-border) 70%, transparent)",
  gap: "10px",
};
const formHeadIconStyle: CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "7px",
  background: "color-mix(in srgb, var(--v5-brand-2) 15%, transparent)",
};
const formHeadTitleStyle: CSSProperties = { fontSize: "13.5px", fontWeight: 600, color: "var(--v5-ink)" };
const formHeadNoteStyle: CSSProperties = { marginTop: "2px", fontSize: "11.5px", color: "var(--v5-ink-3)" };
const brandChipStyle: CSSProperties = {
  fontSize: "11.5px",
  color: "var(--v5-ink-2)",
  background: "var(--v5-surface-2)",
  borderRadius: "6px",
  padding: "4px 8px",
};
const formFieldsStyle: CSSProperties = { padding: "20px" };
const labelStyle: CSSProperties = { marginBottom: "4px", fontSize: "11.5px", color: "var(--v5-ink-3)" };
const inputStyle: CSSProperties = {
  // uni <input> renders taller than a native one — pin a fixed 40px box (=
  // prototype px-3 py-2.5 ≈ 40px) with horizontal-only padding + vertical
  // centering so all four fields align to the prototype exactly.
  width: "100%",
  height: "40px",
  background: "var(--v5-surface-2)",
  border: "1px solid var(--v5-border)",
  borderRadius: "8px",
  padding: "0 12px",
  marginBottom: "12px",
  fontSize: "13.5px",
  color: "var(--v5-ink)",
};
const checkboxLabelStyle: CSSProperties = { fontSize: "12.5px", color: "var(--v5-ink-2)" };
const checkboxStateStyle = computed<CSSProperties>(() => ({
  marginLeft: "auto",
  fontSize: "11px",
  fontWeight: 600,
  color: setAsDefault.value ? "var(--v5-brand)" : "var(--v5-ink-4)",
}));

const submitStyle = computed<CSSProperties>(() => ({
  height: "48px",
  borderRadius: "999px",
  background: canSubmit.value ? "var(--v5-brand)" : "var(--v5-surface-2)",
}));
const submitTextStyle = computed<CSSProperties>(() => ({
  fontSize: "13.5px",
  fontWeight: 600,
  color: canSubmit.value ? "var(--v5-on-brand)" : "var(--v5-ink-4)",
}));
const disclaimerStyle: CSSProperties = { marginTop: "12px", padding: "0 4px", fontSize: "11.5px", color: "var(--v5-ink-4)", lineHeight: 1.6 };
</script>
