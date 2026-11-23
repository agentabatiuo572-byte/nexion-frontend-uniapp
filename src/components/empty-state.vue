<!--
  EmptyState —《06 缺省页规范》的唯一实现。7 种状态共用一个组件:
  插画 + 一句话标题 + 说明 + 可选 CTA,垂直居中。

  🔵 规范铁律:禁白屏 / 空容器 / 通用转圈兜底 —— 任何空数据都给 composed 引导态。
  插画是共享的立体物件 NxEmptyArt(01 §1.3),深浅主题由它自己的样式跟随 data-theme。

  加载态**不用**这个组件(规范 §3:加载走 skeleton,要匹配真实布局形状)。
  表单字段校验错误也不用(规范 §4:inline 就地提示,不升整页缺省页)。
-->
<template>
  <view class="nx-empty" :class="{ 'nx-empty--page': page }" :style="rootStyle">
    <view class="nx-empty__art" :style="artStyle"><NxEmptyArt :kind="kind" /></view>
    <text class="nx-empty__title" :style="titleStyle">{{ title }}</text>
    <text v-if="desc" class="nx-empty__desc" :style="descStyle">{{ desc }}</text>
    <!-- 03 §3.1: a return is neutral glass L at full width, any other entry neutral glass M (the shared NxButton). -->
    <NxButton
      v-if="ctaLabel && !isReadRetry"
      class="nx-empty__cta"
      variant="secondary"
      :size="ctaSize"
      :label="ctaLabel"
      :disabled="ctaDisabled"
      :busy="ctaBusy"
      :style="ctaStyle"
      @click="emit('cta')"
    />
    <view
      v-else-if="ctaLabel"
      class="nx-empty__cta nx-card-recovery-action active:opacity-90 transition-opacity"
      :style="ctaStyle"
      role="button"
      :tabindex="ctaDisabled || ctaBusy ? -1 : 0"
      :aria-label="ctaLabel"
      :aria-disabled="ctaDisabled || ctaBusy ? 'true' : 'false'"
      :aria-busy="ctaBusy ? 'true' : 'false'"
      @click="activateCta()"
      @keydown.enter.prevent="activateCta($event)"
      @keydown.space.prevent="activateCta($event)"
    >
      <text>{{ ctaLabel }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import NxButton from "@/components/ui/nx-button.vue";
import NxEmptyArt from "@/components/ui/nx-empty-art.vue";

// 每种状态一张 NxEmptyArt 插画
export type EmptyKind =
  | "empty-list"
  | "no-search-results"
  | "no-filter-results"
  | "no-owned-asset"
  | "locked-or-no-permission"
  | "network-offline"
  | "recoverable-error";

const props = withDefaults(
  defineProps<{
    kind: EmptyKind;
    title: string;
    desc?: string;
    ctaLabel?: string;
    ctaDisabled?: boolean;
    ctaBusy?: boolean;
    /** No visual effect: every caller passing it is a read retry, which is the shared text button (03 §3.1). */
    emphasis?: boolean;
    /** Non-retry CTA size: large for a return (full width), medium for any other entry (03 §3.1). */
    ctaSize?: "large" | "medium";
    /** 嵌在卡片/小容器里时收窄纵向留白 */
    compact?: boolean;
    /** The page has nothing else to show: the result sits in the middle of the page body below the header (03 §3.5.2). */
    page?: boolean;
  }>(),
  { emphasis: false, compact: false, ctaDisabled: false, ctaBusy: false, page: false, ctaSize: "medium" },
);

const emit = defineEmits<{ (e: "cta"): void }>();

function activateCta(event?: KeyboardEvent) {
  if (event?.repeat || props.ctaDisabled || props.ctaBusy) return;
  emit("cta");
}

// The one 重新加载 of a page whose read failed is a text button: brand 13/18 at 500 from the shared
// recovery action (03 §3.1 table, 10.2), centred under the title. Other kinds use the shared neutral glass button.
const isReadRetry = computed(() => props.kind === "recoverable-error");

const rootStyle = computed<CSSProperties>(() => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  opacity: props.ctaDisabled || props.ctaBusy ? 0.55 : 1,
  textAlign: "center",
  padding: props.compact ? "24px 24px" : "40px 24px",
}));
// 插画盒 144px,嵌在卡片里 112px
const artStyle = computed<CSSProperties>(() => ({
  width: props.compact ? "112px" : "144px",
  height: props.compact ? "112px" : "144px",
}));
// Overview-title role (10.1), so 360 gets its own step; tracking lives in the class below.
const titleStyle: CSSProperties = {
  marginTop: "12px",
  fontFamily: "var(--font-v5)",
  fontSize: "var(--ui-type-hero-title)",
  lineHeight: "var(--ui-type-hero-title-lh)",
  fontWeight: "var(--ui-type-hero-title-weight)" as CSSProperties["fontWeight"],
  color: "var(--v5-ink)",
  // A two-line title splits evenly instead of leaving one word alone (06 §6.3).
  textWrap: "balance",
};
// 空态说明 is 13/18, 400, auxiliary colour at every width (10.1 正文类角色的边界, 01 §1.1.1).
const descStyle: CSSProperties = {
  marginTop: "6px",
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  lineHeight: "18px",
  fontWeight: 400,
  color: "var(--v5-ink-3)",
  maxWidth: "260px",
  textWrap: "pretty",
};
const ctaStyle = computed<CSSProperties>(() => isReadRetry.value
  ? { margin: "12px auto 0", alignSelf: "center" }
  : { marginTop: "16px", alignSelf: props.ctaSize === "large" ? "stretch" : "center" });
</script>
