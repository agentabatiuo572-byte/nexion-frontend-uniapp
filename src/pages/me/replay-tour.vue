<!--
  Replay tour / demo tooling (ported from Nexion-prototype/app/(main)/me/replay-tour/page.tsx).

  Dev-only walkthrough surface: re-run onboarding steps + a live trial-config panel
  (backend-controllable params) + a demo-lifecycle panel. Gated to non-production via
  import.meta.env.PROD (mirrors the source NODE_ENV gate; production users reLaunch to
  /me). Wrapped in <AppChassis active="me">.

  Scope note: the trial-config panel + phase-cycle are fully wired (trial-config,
  product-phase-override, trial-claim-sheet stores exist). The other demo-lifecycle
  actions (seed legacy device / fast-forward / reset / milestone / Stella push /
  extension sheet) depend on `_dev*` app helpers + the milestones / trial-extension-sheet
  stores + stella-templates mock, which are out of this port's scope — those buttons
  surface an explanatory toast instead of silently no-op'ing.
-->
<template>
  <AppChassis active="me">
    <view v-if="!allowed" style="padding-bottom: 24px">
      <SubPageHeader back="/pages/me/me" />
      <text class="block mx-4 text-center" :style="gateTextStyle">{{ w.title }}</text>
    </view>

    <view v-else style="padding-bottom: 32px">
      <SubPageHeader back="/pages/me/me" />

      <text class="block mx-4" :style="pageTitleStyle">{{ w.title }}</text>
      <text class="block mx-4" :style="introStyle">{{ w.intro }}</text>

      <!-- Onboarding replay steps -->
      <view class="mx-4" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px">
        <view v-for="s in steps" :key="s.id" class="block active:opacity-90" :style="stepCardStyle" @click="goStep(s.href)">
          <view class="flex items-center" style="gap: 16px">
            <view class="grid place-items-center shrink-0" :style="stepIconBoxStyle(s.color)">
              <view v-html="s.icon" />
            </view>
            <view class="min-w-0" style="flex: 1">
              <text class="block" :style="stepTitleStyle">{{ w[s.labelKey] }}</text>
              <text class="block" :style="stepHintStyle">{{ w[s.hintKey] }}</text>
            </view>
            <view class="grid place-items-center shrink-0" :style="playBtnStyle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 2px"><polygon points="6 3 20 12 6 21 6 3" /></svg>
            </view>
          </view>
        </view>
      </view>

      <!-- Demo lifecycle panel -->
      <view class="mx-4" style="margin-bottom: 32px">
        <view class="flex items-center" style="gap: 8px; margin-bottom: 12px; padding-left: 4px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
          <text :style="sectionHeadStyle">{{ w.demoLifecycleHeading }}</text>
        </view>
        <text class="block" :style="sectionIntroStyle">{{ w.demoLifecycleIntro }}</text>
        <view style="display: flex; flex-direction: column; gap: 8px">
          <DemoAction :icon="ICONS.box" accent="var(--v5-brand)" :title="w.demoSeedTitle" :hint="w.demoSeedHint" :cta-label="w.demoSeedCta" @tap="onDemoUnavailable" />
          <DemoAction :icon="ICONS.server" accent="var(--v5-warning)" :title="w.demoSeedRack" :hint="w.demoSeedRackHint" :cta-label="w.demoSeedRackCta" @tap="onDemoUnavailable" />
          <DemoAction :icon="ICONS.fastForward" accent="var(--v5-tech-cyan)" :title="w.demoFastForwardTitle" :hint="w.demoFastForwardHint" :cta-label="w.demoFastForwardCta" @tap="onDemoUnavailable" />
          <DemoAction :icon="ICONS.trophy" accent="var(--v5-brand)" :title="w.demoMilestoneTitle" :hint="w.demoMilestoneHint" :cta-label="w.demoMilestoneCta" @tap="onDemoUnavailable" />
          <DemoAction :icon="ICONS.layers" accent="var(--v5-tech-cyan)" :title="w.demoPhaseTitle" :hint="phaseHint" :cta-label="pinnedPhase ?? w.demoPhaseCta" @tap="cyclePhase" />
          <DemoAction :icon="ICONS.bell" accent="var(--v5-warning)" :title="w.demoStellaTitle" :hint="w.demoStellaHint" :cta-label="w.demoStellaCta" @tap="onDemoUnavailable" />
          <DemoAction :icon="ICONS.refresh" accent="var(--v5-brand-2)" :title="w.demoResetTitle" :hint="w.demoResetHint" :cta-label="w.demoResetCta" @tap="onDemoUnavailable" />
        </view>
      </view>

      <!-- Trial config panel -->
      <view class="mx-4" style="margin-bottom: 12px">
        <text class="block" :style="configTitleStyle">Trial config(后台可控)</text>
        <text class="block" :style="configIntroStyle">
          真后台:GET/PUT /api/admin/trial/config。当前 trial 状态:<text :style="{ color: 'var(--v5-ink)' }">{{ trialStatus }}</text>
        </text>

        <view :style="configCardStyle">
          <NumberRow label="试用天数" :value="cfg.trialDays" :step="1" :min="1" :max="14" @change="(v) => update({ trialDays: v })" />
          <NumberRow label="保留期天数(grace)" :value="cfg.graceDays" :step="1" :min="1" :max="30" @change="(v) => update({ graceDays: v })" />
          <NumberRow label="延长天数(extension)" :value="cfg.extensionDays" :step="1" :min="1" :max="30" @change="(v) => update({ extensionDays: v })" />
          <NumberRow label="抵扣比例(%)" :value="discountPct" :step="5" :min="0" :max="50" @change="(v) => update({ discountRate: v / 100 })" />
          <NumberRow label="抵扣上限 ($)" :value="cfg.discountCapUSD" :step="5" :min="0" :max="500" @change="(v) => update({ discountCapUSD: v })" />
          <NumberRow label="高质量阈值 ($)" :value="cfg.highQualityThresholdUSD" :step="10" :min="0" :max="500" @change="(v) => update({ highQualityThresholdUSD: v })" />
          <NumberRow label="冷却天数(终态后)" :value="cfg.cooldownDays" :step="5" :min="0" :max="365" @change="(v) => update({ cooldownDays: v })" />
          <NumberRow label="扣款失败率(%)" :value="chargeFailPct" :step="1" :min="0" :max="100" @change="(v) => update({ chargeFailRate: v / 100 })" />
          <ToggleRow label="phaseOpen(试用入口开关)" :value="cfg.phaseOpen" @change="(v) => update({ phaseOpen: v })" />
          <ToggleRow label="auto-push 弹窗启用" :value="cfg.autoPushEnabled" @change="(v) => update({ autoPushEnabled: v })" />
          <NumberRow label="auto-push 冷却(小时)" :value="cfg.autoPushCooldownHours" :step="1" :min="0" :max="168" @change="(v) => update({ autoPushCooldownHours: v })" />
        </view>

        <view class="grid grid-cols-2" style="margin-top: 12px; gap: 8px">
          <view class="active:scale-[0.98]" :style="qaBrandBtnStyle" @click="onDemoUnavailable">
            <text>强弹 Extension Sheet</text>
          </view>
          <view class="active:scale-[0.98]" :style="qaCyanBtnStyle" @click="clearAutoPushCooldown">
            <text>清 auto-push 冷却</text>
          </view>
          <view class="active:scale-[0.98]" :style="qaResetBtnStyle" @click="resetConfig">
            <text>重置默认</text>
          </view>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import NumberRow from "@/components/me/replay-config-number-row.vue";
import ToggleRow from "@/components/me/replay-config-toggle-row.vue";
import DemoAction from "@/components/me/replay-demo-action.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";
import { useTrialConfig, type TrialConfig } from "@/store/trial-config";
import { useFreeTrial } from "@/store/free-trial";
import { useTrialClaimSheet } from "@/store/trial-claim-sheet";
import { PHASES, useProductPhaseOverride } from "@/store/product-phase";

type StepKey = "step1" | "step2" | "step3";
type HintKey = "step1Hint" | "step2Hint" | "step3Hint";

const t = useT();
const w = computed(() => t.value.replay);

// Admin / dev gate — mirror the source NODE_ENV gate via import.meta.env.PROD.
// Production users reLaunch to /me; dev (or ?dev=1) keeps access.
const allowed = ref(false);
onLoad((options) => {
  const isDev = !import.meta.env.PROD;
  const hasDevFlag = options?.dev === "1";
  if (isDev || hasDevFlag) {
    allowed.value = true;
  } else {
    allowed.value = false;
    uni.reLaunch({ url: "/pages/me/me", fail: () => {} });
  }
});

const ICONS = {
  sparkles: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>`,
  calculator: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" /><line x1="8" x2="16" y1="6" y2="6" /><line x1="16" x2="16" y1="14" y2="18" /><path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 10h.01" /><path d="M12 14h.01" /><path d="M8 14h.01" /><path d="M12 18h.01" /><path d="M8 18h.01" /></svg>`,
  zap: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></svg>`,
  box: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>`,
  server: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2" /><rect width="20" height="8" x="2" y="14" rx="2" ry="2" /><line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" /></svg>`,
  fastForward: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 19 22 12 13 5 13 19" /><polygon points="2 19 11 12 2 5 2 19" /></svg>`,
  trophy: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>`,
  layers: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" /><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" /><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" /></svg>`,
  bell: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0" /><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" /></svg>`,
  refresh: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>`,
};

const steps: { id: string; icon: string; color: string; href: string; labelKey: StepKey; hintKey: HintKey }[] = [
  { id: "intro", icon: ICONS.sparkles, color: "var(--v5-brand)", href: "/pages/onboarding/intro?replay=1", labelKey: "step1", hintKey: "step1Hint" },
  { id: "estimator", icon: ICONS.calculator, color: "var(--v5-warning)", href: "/pages/onboarding/estimator?replay=1", labelKey: "step2", hintKey: "step2Hint" },
  { id: "connect", icon: ICONS.zap, color: "var(--v5-tech-cyan)", href: "/pages/onboarding/connect?replay=1", labelKey: "step3", hintKey: "step3Hint" },
];

// Trial config (fully wired — store exists).
const trialConfig = useTrialConfig();
const cfg = computed(() => trialConfig.config);
const trialStatus = computed(() => useFreeTrial().status);
const discountPct = computed(() => Math.round(cfg.value.discountRate * 100));
const chargeFailPct = computed(() => Math.round(cfg.value.chargeFailRate * 100));

function update(patch: Partial<TrialConfig>) {
  trialConfig.update(patch);
}
function resetConfig() {
  trialConfig.reset();
  toast.success(w.value.toastConfigReset);
}
function clearAutoPushCooldown() {
  useTrialClaimSheet().resetCooldown();
  toast.info(w.value.toastCooldownCleared);
}

// Phase cycle (fully wired — override store exists).
const override = useProductPhaseOverride();
const pinnedPhase = computed(() => override.pinned);
const phaseHint = computed(() => fmt(w.value.demoPhaseHint, { current: pinnedPhase.value ?? "—" }));
function cyclePhase() {
  const idx = PHASES.findIndex((p) => p.id === override.pinned);
  if (idx === -1) {
    override.setPinned(PHASES[0].id);
    toast.success(fmt(w.value.demoToastPhasePinned, { phase: PHASES[0].id }));
  } else if (idx >= PHASES.length - 1) {
    override.setPinned(null);
    toast.success(w.value.demoToastPhaseUnpinned);
  } else {
    override.setPinned(PHASES[idx + 1].id);
    toast.success(fmt(w.value.demoToastPhasePinned, { phase: PHASES[idx + 1].id }));
  }
}

// Out-of-scope demo actions (see scope note in the file header).
function onDemoUnavailable() {
  toast.info("Demo tooling", "This dev action isn't wired in the uni build yet.");
}

function goStep(href: string) {
  uni.navigateTo({ url: href, fail: () => {} });
}

const gateTextStyle: CSSProperties = { marginTop: "32px", fontSize: "12.5px", color: "var(--v5-ink-3)" };
const pageTitleStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "20px", fontWeight: 600, lineHeight: 1.2, marginBottom: "8px", color: "var(--v5-ink)" };
const introStyle: CSSProperties = { fontSize: "12.5px", color: "var(--v5-ink-3)", lineHeight: 1.6, marginBottom: "16px" };
const stepCardStyle: CSSProperties = { background: "var(--v5-surface)", border: "1px solid var(--v5-border)", borderRadius: "16px", padding: "16px" };
function stepIconBoxStyle(color: string): CSSProperties {
  return { width: "48px", height: "48px", borderRadius: "12px", background: `color-mix(in srgb, ${color} 10%, transparent)` };
}
const stepTitleStyle: CSSProperties = { fontSize: "14px", fontWeight: 600, color: "color-mix(in srgb, var(--v5-ink) 95%, transparent)" };
const stepHintStyle: CSSProperties = { fontSize: "11.5px", color: "var(--v5-ink-3)", marginTop: "2px", lineHeight: 1.6 };
const playBtnStyle: CSSProperties = { width: "36px", height: "36px", borderRadius: "999px", background: "var(--v5-surface-2)" };
const sectionHeadStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "13.5px", fontWeight: 600, color: "var(--v5-ink-3)" };
const sectionIntroStyle: CSSProperties = { paddingLeft: "4px", marginBottom: "12px", fontSize: "11.5px", color: "var(--v5-ink-3)", lineHeight: 1.6 };
const configTitleStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "13.5px", fontWeight: 600, color: "var(--v5-ink)", marginBottom: "8px", paddingLeft: "4px" };
const configIntroStyle: CSSProperties = { paddingLeft: "4px", marginBottom: "12px", fontSize: "11.5px", color: "var(--v5-ink-3)", lineHeight: 1.6 };
const configCardStyle: CSSProperties = {
  borderRadius: "16px",
  padding: "14px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};
const qaBrandBtnStyle: CSSProperties = {
  height: "40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "12px",
  fontSize: "12px",
  fontWeight: 500,
  background: "color-mix(in srgb, var(--v5-brand) 14%, transparent)",
  color: "var(--v5-brand)",
};
const qaCyanBtnStyle: CSSProperties = {
  height: "40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "12px",
  fontSize: "12px",
  fontWeight: 500,
  background: "color-mix(in srgb, var(--v5-tech-cyan) 14%, transparent)",
  color: "var(--v5-tech-cyan)",
};
const qaResetBtnStyle: CSSProperties = {
  gridColumn: "span 2",
  height: "40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "12px",
  fontSize: "12px",
  fontWeight: 500,
  background: "var(--v5-surface-2)",
  color: "var(--v5-ink-2)",
};
</script>
