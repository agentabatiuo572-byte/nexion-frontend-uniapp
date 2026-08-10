<!--
  Platform risk disclosure (ported from Nexion-prototype/app/(main)/me/risk-disclosure/page.tsx).
  Required reading before first withdrawal / staking lock. The accept button gates
  on (a) uni-app scroll-view's auditable scroll-to-lower event and (b) checkbox tick.
  Acceptance persists via the risk-disclosure
  store. Reads `?return=` for where to land. Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <scroll-view scroll-y style="height: 100vh" @scrolltolower="onScrollToLower">
    <view style="padding-bottom: 32px">
      <SubPageHeader :back="returnTo" />

      <!-- Hero -->
      <view class="mx-4" :style="heroStyle">
        <view class="flex items-center" style="gap: 8px; margin-bottom: 6px">
          <view class="grid place-items-center" :style="heroIconBoxStyle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
          </view>
          <text :style="heroLabelStyle">{{ w.heroLabel }}</text>
        </view>
        <text class="block" :style="heroTitleStyle">{{ w.heroTitle }}</text>
        <text class="block" :style="heroSubStyle">{{ w.heroSubtitle }}</text>
        <view v-if="accepted" class="flex items-center" :style="acceptedChipStyle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
          <text>{{ w.alreadyAccepted }}</text>
        </view>
        <view v-else-if="loadError" :style="hintStyle">
          <text :style="hintTextStyle">{{ loadError }}</text>
          <text class="block active:opacity-70" :style="retryStyle" @click="reload">重新获取适用于当前地区的披露</text>
        </view>
      </view>

      <!-- Sections -->
      <view class="mx-4" :style="sectionsStyle">
        <view
          v-for="b in blocks"
          :key="b.n"
          class="active:opacity-70 transition-opacity"
          :style="blockStyle(selectedBlock === b.n)"
          role="button"
          tabindex="0"
          :aria-label="b.title"
          @click="selectedBlock = b.n"
        >
          <view class="flex items-baseline" style="gap: 8px; margin-bottom: 4px">
            <text :style="blockNumStyle">{{ String(b.n).padStart(2, "0") }}</text>
            <text :style="blockTitleStyle">{{ b.title }}</text>
          </view>
          <text v-if="selectedBlock === b.n" class="block" :style="selectedBlockStyle">{{ sectionSelectedLabel(b.n) }}</text>
          <text class="block" :style="blockBodyStyle">{{ b.body }}</text>
        </view>
      </view>

      <!-- Scroll hint -->
      <view v-if="!scrolledToBottom && !accepted" class="mx-4 flex items-center" :style="hintStyle">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px"><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></svg>
        <text :style="hintTextStyle">{{ w.scrollHint }}</text>
      </view>

      <!-- Acknowledge -->
      <view class="mx-4" :style="ackCardStyle">
        <!-- 反馈走 scale:同 P-058,inline style 里已有 opacity(未读完时 0.55),写 opacity 反馈会被压掉 -->
        <view class="flex items-start active:scale-[0.98] transition-transform" :style="{ gap: '10px', opacity: scrolledToBottom && !accepted ? 1 : 0.55 }" @click="toggleCheck">
          <view class="grid place-items-center shrink-0" :style="checkboxStyle">
            <svg v-if="checked || accepted" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </view>
          <text :style="checkLabelStyle" style="flex: 1">{{ w.checkboxLabel }}</text>
        </view>

        <view class="flex items-center justify-center active:opacity-80" :style="acceptBtnStyle" @click="onAccept">
          <template v-if="accepted">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
            <text>{{ w.alreadyAcceptedCta }}</text>
          </template>
          <text v-else>{{ w.acceptCta }}</text>
        </view>
        <text class="block text-center" :style="disclaimerStyle">{{ w.disclaimer }}</text>
      </view>
    </view>
    </scroll-view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, type CSSProperties } from "vue";
import { navBack } from "@/lib/route";
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { useLocaleStore } from "@/store/locale";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";
import { useRiskDisclosure } from "@/store/risk-disclosure";
import { safeReturnTo } from "@/routing/safe-return-to";

const t = useT();
const locale = useLocaleStore();
const w = computed(() => t.value.riskDisclosure);
const risk = useRiskDisclosure();
const accepted = computed(() => risk.accepted);
const disclosure = computed(() => risk.current);
const loadError = computed(() => risk.error ? "当前地区的风险披露暂不可用；请检查网络后重试。未加载前不能确认。" : "");

const returnTo = ref("/pages/me/me");
onLoad((options) => {
  returnTo.value = safeReturnTo(options?.return, "/pages/me/me");
});

const scrolledToBottom = ref(false);
const checked = ref(false);
const selectedBlock = ref<number | null>(null);
onMounted(async () => {
  await risk.refresh();
});
function onScrollToLower() { scrolledToBottom.value = true; }

// z1 判决(2026-08-10):披露正文渲染源已改远端 chapters(risk store);本地派生 withdrawWindowBody
// 及其配置插值随 {h} 时限文案改版(服务端口径)一并删除 —— selfcheck-slacopy.mjs 钉远端渲染源。
const blocks = computed(() => disclosure.value?.chapters.map((chapter) => ({
  n: Number(chapter.no),
  title: locale.code === "vi" ? chapter.vi : locale.code === "en" ? chapter.en : chapter.zh,
  body: locale.code === "vi" ? chapter.viBody : locale.code === "en" ? chapter.enBody : chapter.zhBody,
})) ?? []);

function sectionSelectedLabel(n: number): string {
  return fmt(w.value.sectionSelected, { n: String(n).padStart(2, "0") });
}

const canAccept = computed(() => Boolean(disclosure.value) && scrolledToBottom.value && checked.value && !accepted.value && !risk.loading);

function toggleCheck() {
  if (scrolledToBottom.value && !accepted.value) checked.value = !checked.value;
}
async function onAccept() {
  if (!canAccept.value) return;
  if (!await risk.accept()) return;
  toast.success(w.value.acceptToast);
  // 🔴 用 navigateBack 回到**原来那个页面实例**。navigateTo 是压一个新页:
  // 用户在提现页输的金额随新实例重置为空、原实例被压在栈底,提交意图 100% 丢失,
  // 而且页面栈变成 withdraw → disclosure → withdraw,再按返回会退回披露页(死循环观感)。
  // 冷启动直达本页时栈里只有一页,裸 navigateBack 是空操作(P-054)—— 走 helper,它会按栈深选 pop 还是 reLaunch。
  navBack(returnTo.value);
}
async function reload() { await risk.refresh(); }

// Spotlight hero (whitelist ≤1):零 border(《03》§3,C2 第二轮起中性边也删)——
// 边界靠 surface 与页面地板的微差色;the brand-2 mood lives in the icon + label.
// Header provides the 24px top breathing, so no top margin here.
const heroStyle: CSSProperties = {
  borderRadius: "16px",
  padding: "16px",
  background: "var(--v5-surface)",
};
const heroIconBoxStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-brand-2) 22%, transparent)",
};
const heroLabelStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", letterSpacing: "0.16em", color: "var(--v5-brand-2)" };
const heroTitleStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "20px", fontWeight: 600, color: "var(--v5-ink)", lineHeight: 1.25 };
const heroSubStyle: CSSProperties = { marginTop: "6px", fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.625 };
const acceptedChipStyle: CSSProperties = {
  marginTop: "10px",
  alignSelf: "flex-start",
  padding: "4px 10px",
  borderRadius: "6px",
  background: "color-mix(in srgb, var(--v5-brand) 14%, transparent)",
  color: "var(--v5-brand)",
  fontSize: "12px",
  display: "inline-flex",
};
// De-carded: disclosure sections read on the page floor (legal page → clear,
// legible paragraphs). Card shell dropped; blocks separated by whitespace.
const sectionsStyle: CSSProperties = {
  marginTop: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};
const blockNumStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", color: "var(--v5-brand-2)" };
// Unit title + paragraph body per the de-card typography ladder (body = ink-2,
// never ink-3, at a legible 13.5/1.65 for a legal disclosure).
const blockTitleStyle: CSSProperties = { fontSize: "15px", fontWeight: 600, color: "var(--v5-ink)", lineHeight: 1.4 };
const blockBodyStyle: CSSProperties = { fontSize: "13px", color: "var(--v5-ink-2)", lineHeight: 1.65 };
// Selected section keeps a soft brand-2 read-tracking tint (no border — inner
// blocks use soft fill, not a stroke); horizontal bleed reaches the gutter.
function blockStyle(selected: boolean): CSSProperties {
  return {
    borderRadius: "12px",
    padding: "8px 12px",
    margin: "0 -12px",
    background: selected ? "color-mix(in srgb, var(--v5-brand-2) 8%, transparent)" : "transparent",
  };
}
const selectedBlockStyle: CSSProperties = {
  marginBottom: "6px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  color: "var(--v5-brand-2)",
};
const hintStyle: CSSProperties = {
  marginTop: "12px",
  borderRadius: "12px",
  background: "color-mix(in srgb, var(--v5-warning) 8%, transparent)",
  padding: "12px",
};
const hintTextStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-warning)" };
const retryStyle: CSSProperties = { marginTop: "8px", fontSize: "12px", color: "var(--v5-brand)" };
// Acknowledgment gate — de-carded onto the page floor; a hairline opens the
// action group (checkbox control + brand CTA pill are whitelisted as-is).
const ackCardStyle: CSSProperties = {
  marginTop: "16px",
  paddingTop: "16px",
  borderTop: "1px solid var(--v5-border)",
};
const checkboxStyle = computed<CSSProperties>(() => ({
  width: "20px",
  height: "20px",
  borderRadius: "6px",
  marginTop: "2px",
  background: checked.value || accepted.value ? "var(--v5-brand)" : "transparent",
  border: checked.value || accepted.value ? "1px solid var(--v5-brand)" : "1px solid var(--v5-border-strong)",
}));
const checkLabelStyle: CSSProperties = { fontSize: "13px", color: "var(--v5-ink-2)", lineHeight: 1.625 };
const acceptBtnStyle = computed<CSSProperties>(() => ({
  marginTop: "16px",
  width: "100%",
  height: "48px",
  borderRadius: "999px",
  background: canAccept.value || accepted.value ? "var(--v5-brand)" : "var(--v5-surface-2)",
  color: canAccept.value || accepted.value ? "var(--v5-on-brand)" : "var(--v5-ink-4)",
  fontSize: "15px",
  fontWeight: 600,
}));
const disclaimerStyle: CSSProperties = { marginTop: "8px", fontSize: "12px", color: "var(--v5-ink-4)", lineHeight: 1.375 };
</script>
