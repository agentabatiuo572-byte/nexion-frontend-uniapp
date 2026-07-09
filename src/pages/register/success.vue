<!--
  [FEAT-SHARE5] 注册成功页 — 礼包确认 + 引导下载 APP。
  规格: PRD/specs/FEAT-SHARE01-invite-chain.md [FEAT-SHARE5]。
  仅 H5 注册链路到达(register.vue finish 的 #ifdef H5 分支);APP 壳内注册直进
  onboarding。bare 全屏页(无 chassis)→ 自带 GlobalUi 宿主(PORT-PITFALLS P-062)。
  下载地址 = platform config share.appDownload(运营可配);全空 = 未上架降级态,
  无死按钮。返回键视同「继续」进 onboarding(禁回注册流)。
-->
<template>
  <view class="rs-root">
    <view class="rs-wrap">
      <!-- 成功徽记 -->
      <view class="rs-badge">
        <view class="rs-badge__in">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </view>
      </view>
      <text class="rs-title">{{ t.register.doneTitle }}</text>
      <text class="rs-sub">{{ subLine }}</text>

      <!-- 礼包确认(giftRoute 两态;无礼包注册则整块省略) -->
      <view v-if="giftState !== 'none'" class="rs-gift">
        <text class="rs-gift__cap">{{ t.share.posterGiftCap }}</text>
        <view class="rs-gift__amt">
          <text class="rs-gift__usd">${{ giftUsdt }}</text>
          <text class="rs-gift__nex">+ {{ giftNex }} NEX</text>
        </view>
        <view v-if="giftState === 'posted'" class="rs-chip rs-chip--ok">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          <text class="rs-chip__t rs-chip__t--ok">{{ t.register.doneGiftPosted }}</text>
        </view>
        <view v-else class="rs-chip rs-chip--pd">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          <text class="rs-chip__t rs-chip__t--pd">{{ t.register.doneGiftPending }}</text>
        </view>
        <text v-if="giftState === 'pending'" class="rs-gift__note">{{ t.register.doneGiftPendingNote }}</text>
      </view>

      <!-- 为什么装 APP -->
      <view class="rs-why">
        <view class="rs-why__r">
          <view class="rs-why__ic" style="background: color-mix(in srgb, var(--v5-brand) 14%, transparent)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>
          </view>
          <text class="rs-why__t">{{ t.register.doneWhyApp1 }}</text>
        </view>
        <view class="rs-why__r">
          <view class="rs-why__ic" style="background: color-mix(in srgb, var(--v5-tech-cyan) 14%, transparent)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
          </view>
          <text class="rs-why__t">{{ t.register.doneWhyApp2 }}</text>
        </view>
        <view class="rs-why__r">
          <view class="rs-why__ic" style="background: color-mix(in srgb, var(--v5-warning) 14%, transparent)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>
          </view>
          <text class="rs-why__t">{{ t.register.doneWhyApp3 }}</text>
        </view>
      </view>

      <!-- 下载 CTA(配置驱动;异常1 未配置 → 降级说明 + 主 CTA 变继续) -->
      <template v-if="dlConfigured">
        <view v-if="layout === 'single'" class="rs-cta active-press" @click="openDownload(primaryUrl)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3" /><path d="m7 10 5 5 5-5" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /></svg>
          <text class="rs-cta__t">{{ t.register.doneDownloadCta }}</text>
        </view>
        <view v-else class="rs-dual">
          <view v-if="dl.iosUrl" class="rs-cta rs-cta--half active-press" @click="openDownload(dl.iosUrl)">
            <text class="rs-cta__t">{{ t.register.doneDownloadIos }}</text>
          </view>
          <view v-if="androidUrl" class="rs-cta rs-cta--half active-press" @click="openDownload(androidUrl)">
            <text class="rs-cta__t">{{ t.register.doneDownloadAndroid }}</text>
          </view>
        </view>
        <view class="rs-skip active-press" @click="continueWeb">
          <text class="rs-skip__t">{{ t.register.doneContinueWeb }} ›</text>
        </view>
      </template>
      <template v-else>
        <view class="rs-soon">
          <text class="rs-soon__t">{{ t.register.doneComingSoonTitle }}</text>
          <text class="rs-soon__b">{{ t.register.doneComingSoonBody }}</text>
        </view>
        <view class="rs-cta active-press" @click="continueWeb">
          <text class="rs-cta__t">{{ t.register.doneContinue }}</text>
        </view>
      </template>
    </view>
    <GlobalUi />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onBackPress, onLoad } from "@dcloudio/uni-app";
import GlobalUi from "@/components/global-ui.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useConfig } from "@/store/config";
import { useSponsorship } from "@/store/sponsorship";
import { copyText } from "@/lib/share";
import { toast } from "@/store/ui";

type GiftState = "posted" | "pending" | "none";

const t = useT();
const cfg = useConfig();
const sponsorship = useSponsorship();

const giftState = ref<GiftState>("none");
onLoad((options) => {
  const g = options && (options as Record<string, string>).gift;
  giftState.value = g === "posted" || g === "pending" ? g : "none";
});

// 礼包金额单源派生 platform config(禁写死镜像)。
const giftUsdt = computed(() => cfg.config.rewards.welcomeGift.usdtAmount);
const giftNex = computed(() => cfg.config.rewards.welcomeGift.nexAmount);
const subLine = computed(() =>
  sponsorship.sponsor ? fmt(t.value.register.doneSubTeam, { name: sponsorship.sponsor.name }) : t.value.register.doneSubSolo,
);

const dl = computed(() => cfg.config.share.appDownload);
const androidUrl = computed(() => dl.value.androidUrl || dl.value.apkUrl);
const dlConfigured = computed(() => !!(dl.value.iosUrl || androidUrl.value));

const osHint = computed<"ios" | "android" | "other">(() => {
  // #ifdef H5
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  // #endif
  return "other";
});
// 本机系统有对应链接才单按钮;否则退化为可用双按钮(各按钮仅在链接存在时渲染)。
const layout = computed<"single" | "dual">(() => {
  if (osHint.value === "ios" && dl.value.iosUrl) return "single";
  if (osHint.value === "android" && androidUrl.value) return "single";
  return "dual";
});
const primaryUrl = computed(() => (osHint.value === "ios" ? dl.value.iosUrl : androidUrl.value));

let opening = false;
function openDownload(url: string) {
  if (!url || opening) return;
  opening = true;
  setTimeout(() => (opening = false), 800);
  // #ifdef H5
  const w = window.open(url, "_blank");
  if (!w) {
    // 异常4: 弹窗被拦/未跳转 → 复制链接兜底。
    void copyText(url).then(() => toast.info(t.value.register.doneDlFailed));
  }
  // #endif
  // #ifndef H5
  void copyText(url).then(() => toast.info(t.value.register.doneDlFailed));
  // #endif
}

function continueWeb() {
  uni.reLaunch({ url: "/pages/onboarding/estimator", fail: () => {} });
}
// 禁回注册流:返回键视同「继续」(App 端;H5 hash 回退由浏览器承担)。
onBackPress(() => {
  continueWeb();
  return true;
});
</script>

<style scoped>
.rs-root { position: fixed; inset: 0; background: #000; overflow-y: auto; }
.rs-wrap { display: flex; flex-direction: column; padding: 44px 24px 32px; min-height: 100%; box-sizing: border-box; text-align: center; }
.rs-badge { width: 74px; height: 74px; border-radius: 9999px; margin: 0 auto; background: color-mix(in srgb, var(--v5-brand) 16%, transparent); display: flex; align-items: center; justify-content: center; }
.rs-badge__in { width: 52px; height: 52px; border-radius: 9999px; background: var(--v5-brand); display: flex; align-items: center; justify-content: center; }
.rs-title { display: block; margin-top: 16px; font-family: var(--font-v5); font-size: 20px; font-weight: 600; letter-spacing: -0.02em; color: #fff; }
.rs-sub { display: block; margin-top: 6px; font-size: 12px; color: var(--text-muted); line-height: 1.5; text-wrap: pretty; }
.rs-gift { margin-top: 18px; border-radius: 16px; background: #0F0F0F; border: 1px solid var(--v5-surface-2); padding: 16px 14px; }
.rs-gift__cap { display: block; font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 10px; letter-spacing: 0.16em; color: var(--v5-brand); }
.rs-gift__amt { display: flex; align-items: baseline; justify-content: center; gap: 6px; margin-top: 8px; }
.rs-gift__usd { font-family: var(--font-v5); font-size: 30px; font-weight: 600; line-height: 1; color: #fff; }
.rs-gift__nex { font-family: var(--font-v5); font-size: 15px; font-weight: 600; color: var(--v5-brand); }
.rs-chip { display: inline-flex; align-items: center; gap: 5px; margin-top: 10px; border-radius: 9999px; padding: 4px 10px; }
.rs-chip--ok { background: color-mix(in srgb, var(--v5-success) 12%, transparent); }
.rs-chip--pd { background: color-mix(in srgb, var(--v5-warning) 12%, transparent); }
.rs-chip__t { font-size: 10.5px; }
.rs-chip__t--ok { color: var(--v5-success); }
.rs-chip__t--pd { color: var(--v5-warning); }
.rs-gift__note { display: block; margin-top: 8px; font-size: 10.5px; color: var(--text-muted); line-height: 1.6; text-wrap: pretty; }
.rs-why { margin-top: 12px; border-radius: 16px; background: #0F0F0F; overflow: hidden; text-align: left; }
.rs-why__r { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid color-mix(in srgb, var(--v5-surface-2) 70%, transparent); }
.rs-why__r:last-child { border-bottom: none; }
.rs-why__ic { width: 30px; height: 30px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rs-why__t { flex: 1; font-size: 12px; color: #C8D0DC; line-height: 1.5; text-wrap: pretty; }
.rs-cta { margin-top: 18px; min-height: 52px; border-radius: 9999px; background: var(--v5-brand); display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 0 24px color-mix(in srgb, var(--v5-brand) 30%, transparent); }
.rs-cta__t { font-size: 14.5px; font-weight: 600; color: var(--v5-on-brand); }
.rs-cta--half { flex: 1; margin-top: 0; }
.rs-dual { display: flex; gap: 10px; margin-top: 18px; }
.rs-skip { margin-top: 14px; min-height: 44px; display: flex; align-items: center; justify-content: center; }
.rs-skip__t { font-size: 12px; color: var(--text-muted); }
.rs-soon { margin-top: 18px; border-radius: 16px; border: 1px dashed var(--v5-surface-3); padding: 14px; }
.rs-soon__t { display: block; font-size: 12.5px; font-weight: 600; color: #C8D0DC; }
.rs-soon__b { display: block; margin-top: 4px; font-size: 11.5px; color: var(--text-muted); line-height: 1.65; text-wrap: pretty; }
.active-press:active { transform: scale(0.985); opacity: 0.9; }
</style>
