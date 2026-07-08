<template>
  <AppChassis active="home">
    <view class="entry-page" :class="toneClass">
      <view class="entry-hero">
        <view class="entry-copy">
          <view class="entry-kicker">
            <text>{{ data.kicker }}</text>
          </view>
          <text class="entry-title">{{ data.title }}</text>
          <text class="entry-body">{{ data.body }}</text>
          <view class="entry-actions">
            <view class="entry-action entry-action--primary" role="button" tabindex="0" :aria-label="data.primary.label" @tap="go(data.primary.href)" @click="go(data.primary.href)">
              <text>{{ data.primary.label }}</text>
            </view>
            <view class="entry-action entry-action--ghost" role="button" tabindex="0" :aria-label="data.secondary.label" @tap="go(data.secondary.href)" @click="go(data.secondary.href)">
              <text>{{ data.secondary.label }}</text>
            </view>
          </view>
        </view>

        <view class="entry-visual" aria-hidden="true">
          <svg class="entry-visual-svg" viewBox="0 0 236 236" fill="none">
            <rect x="52" y="18" width="132" height="200" rx="26" fill="var(--v5-surface)" stroke="var(--v5-border-strong)" stroke-width="2" />
            <rect x="68" y="44" width="100" height="148" rx="10" fill="var(--v5-bg)" stroke="var(--v5-border)" />
            <circle cx="118" cy="205" r="6" fill="var(--v5-surface-3)" />
            <path d="M86 84h64" stroke="var(--v5-brand)" stroke-width="7" stroke-linecap="round" />
            <path d="M86 108h44" stroke="var(--v5-brand-2)" stroke-width="7" stroke-linecap="round" />
            <path d="M86 132h76" stroke="var(--v5-tech-cyan)" stroke-width="7" stroke-linecap="round" />
            <path d="M86 156h52" stroke="var(--v5-ink-4)" stroke-width="7" stroke-linecap="round" />
            <circle cx="176" cy="64" r="22" fill="var(--v5-brand-soft)" stroke="var(--v5-brand-border)" />
            <path :d="data.iconPath" stroke="var(--v5-brand)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </view>
      </view>

      <view class="entry-mode">
        <text class="entry-mode-label">{{ data.modeLabel }}</text>
        <text class="entry-mode-value">{{ data.modeValue }}</text>
      </view>

      <view class="entry-grid">
        <view v-for="metric in data.metrics" :key="metric.label" class="entry-metric">
          <text class="entry-metric-value">{{ metric.value }}</text>
          <text class="entry-metric-label">{{ metric.label }}</text>
        </view>
      </view>

      <view class="entry-flow">
        <view v-for="step in data.steps" :key="step.title" class="entry-step">
          <view class="entry-step-dot" />
          <view class="entry-step-copy">
            <text class="entry-step-title">{{ step.title }}</text>
            <text class="entry-step-body">{{ step.body }}</text>
          </view>
        </view>
      </view>

      <view class="entry-link" role="button" tabindex="0" aria-label="查看三端完整入口链接" @tap="go('/pages/entry-surfaces/index')" @click="go('/pages/entry-surfaces/index')">
        <text>查看三端完整入口链接</text>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 17 17 7" />
          <path d="M8 7h9v9" />
        </svg>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import { navTo } from "@/lib/route";

type SurfaceKey = "signed" | "h5" | "white";

interface EntryAction {
  label: string;
  href: string;
}
interface EntryMetric {
  label: string;
  value: string;
}
interface EntryStep {
  title: string;
  body: string;
}
interface EntrySurfaceData {
  kicker: string;
  title: string;
  body: string;
  modeLabel: string;
  modeValue: string;
  primary: EntryAction;
  secondary: EntryAction;
  metrics: EntryMetric[];
  steps: EntryStep[];
  iconPath: string;
}

const props = defineProps<{ surface: SurfaceKey }>();

const SURFACES: Record<SurfaceKey, EntrySurfaceData> = {
  signed: {
    kicker: "签名版 APP",
    title: "持续在线的收益控制台",
    body: "安装版 App 保留完整设备网络、钱包、商城、团队与在线加成。",
    modeLabel: "算力模式",
    modeValue: "在线增强",
    primary: { label: "打开收益看板", href: "/" },
    secondary: { label: "管理设备", href: "/pages/me/devices" },
    metrics: [
      { label: "在线加成", value: "完整" },
      { label: "设备队列", value: "6 槽位" },
      { label: "账户数据", value: "共享" },
    ],
    steps: [
      { title: "启动", body: "安装版 App 直接进入收益账户。" },
      { title: "保持在线", body: "手机硬件状态会进入在线加成模型。" },
      { title: "资金流转", body: "钱包、商城和团队流程都在一触可达的位置。" },
    ],
    iconPath: "M169 64h14M176 57v14M160 83c7 5 25 5 32 0",
  },
  h5: {
    kicker: "H5 网页版",
    title: "基础托管的移动收益入口",
    body: "移动浏览器保留账户设备与钱包能力,不强制后台常驻。PC 分摊能力可用时会展示。",
    modeLabel: "算力模式",
    modeValue: "基础托管",
    primary: { label: "打开赚取页", href: "/pages/earn/earn" },
    secondary: { label: "管理设备槽位", href: "/pages/me/devices" },
    metrics: [
      { label: "浏览器访问", value: "即时" },
      { label: "手机设备", value: "保留" },
      { label: "PC 路径", value: "可选" },
    ],
    steps: [
      { title: "打开链接", body: "浏览器直接进入移动收益界面。" },
      { title: "登记设备", body: "手机能力会作为账户级设备价值保留。" },
      { title: "升级路径", body: "安装版 App 始终可见,PC 分摊可用时同步出现。" },
    ],
    iconPath: "M161 55h31v23h-31zM169 86h15M176 78v8",
  },
  white: {
    kicker: "白 APP 接管",
    title: "体检结果接入 Nexion 首页",
    body: "硬件评分、账户余额和设备状态在接管页先汇总,再进入实时主导航。",
    modeLabel: "入口状态",
    modeValue: "体检融合",
    primary: { label: "继续进入 Nexion", href: "/" },
    secondary: { label: "安全会话", href: "/pages/me/security" },
    metrics: [
      { label: "健康评分", value: "可见" },
      { label: "设备状态", value: "已合并" },
      { label: "导航交接", value: "顺滑" },
    ],
    steps: [
      { title: "进入外壳", body: "体检工具的视觉语言保留在交接顶部。" },
      { title: "读取账户", body: "余额、设备和会话来自同一份账户状态。" },
      { title: "继续前进", body: "商城、赚取、团队和钱包标签继续承接真实产品。" },
    ],
    iconPath: "M160 64c6-10 26-10 32 0M165 78h22M176 50v42",
  },
};

const data = computed(() => SURFACES[props.surface]);
const toneClass = computed(() => `entry-page--${props.surface}`);

function go(href: string) {
  navTo(href);
}
</script>

<style scoped>
.entry-page {
  min-height: 100%;
  padding: 16px;
  color: var(--v5-ink);
  font-family: var(--font-v5);
  background:
    radial-gradient(circle at 22% 8%, color-mix(in srgb, var(--v5-brand) 14%, transparent), transparent 32%),
    radial-gradient(circle at 82% 4%, color-mix(in srgb, var(--v5-brand-2) 12%, transparent), transparent 28%),
    var(--v5-bg);
}

.entry-page--h5 {
  background:
    radial-gradient(circle at 22% 8%, color-mix(in srgb, var(--v5-tech-cyan) 15%, transparent), transparent 32%),
    radial-gradient(circle at 82% 4%, color-mix(in srgb, var(--v5-brand) 10%, transparent), transparent 28%),
    var(--v5-bg);
}

.entry-page--white {
  background:
    radial-gradient(circle at 22% 8%, color-mix(in srgb, var(--v5-brand-2) 14%, transparent), transparent 32%),
    radial-gradient(circle at 82% 4%, color-mix(in srgb, var(--v5-tech-cyan) 13%, transparent), transparent 28%),
    var(--v5-bg);
}

.entry-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 18px;
  min-height: 430px;
  padding: 18px 0 10px;
}

.entry-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
}

.entry-kicker {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid var(--v5-border);
  border-radius: 8px;
  background: var(--v5-surface-bg);
  color: var(--v5-ink-2);
  font-size: 12px;
  font-weight: 600;
}

.entry-title {
  display: block;
  margin-top: 18px;
  color: var(--v5-ink);
  font-size: 35px;
  font-weight: 600;
  line-height: 1.04;
  overflow-wrap: anywhere;
}

.entry-body {
  display: block;
  margin-top: 14px;
  max-width: 560px;
  color: var(--v5-ink-2);
  font-size: 14px;
  line-height: 1.62;
}

.entry-actions {
  display: grid;
  width: 100%;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-top: 22px;
}

.entry-action {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
}

.entry-action--primary {
  background: var(--v5-brand);
  color: var(--v5-on-brand);
}

.entry-action--ghost {
  border: 1px solid var(--v5-border-strong);
  background: var(--v5-surface-bg);
  color: var(--v5-ink);
}

.entry-visual {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 238px;
  border-radius: 8px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--v5-surface) 82%, transparent), color-mix(in srgb, var(--v5-surface-2) 68%, transparent)),
    var(--v5-surface);
  box-shadow: var(--v5-card-shadow-lift);
}

.entry-visual-svg {
  width: min(236px, 100%);
  height: auto;
}

.entry-mode {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 52px;
  padding: 12px;
  border: 1px solid var(--v5-border);
  border-radius: 8px;
  background: var(--v5-surface-bg);
}

.entry-mode-label {
  color: var(--v5-ink-3);
  font-size: 12px;
  font-weight: 600;
}

.entry-mode-value {
  color: var(--v5-brand);
  font-size: 15px;
  font-weight: 900;
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.entry-metric {
  min-width: 0;
  min-height: 82px;
  padding: 12px 10px;
  border: 1px solid var(--v5-border);
  border-radius: 8px;
  background: var(--v5-surface-bg);
}

.entry-metric-value {
  display: block;
  color: var(--v5-ink);
  font-size: 14px;
  font-weight: 900;
  overflow-wrap: anywhere;
}

.entry-metric-label {
  display: block;
  margin-top: 6px;
  color: var(--v5-ink-3);
  font-size: 11px;
  line-height: 1.35;
}

.entry-flow {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.entry-step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 76px;
  padding: 12px;
  border: 1px solid var(--v5-border);
  border-radius: 8px;
  background: var(--v5-surface-bg);
}

.entry-step-dot {
  width: 9px;
  height: 9px;
  margin-top: 6px;
  border-radius: 999px;
  background: var(--v5-brand-2);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--v5-brand-2) 16%, transparent);
}

.entry-step-copy {
  min-width: 0;
}

.entry-step-title {
  display: block;
  color: var(--v5-ink);
  font-size: 13px;
  font-weight: 850;
}

.entry-step-body {
  display: block;
  margin-top: 4px;
  color: var(--v5-ink-3);
  font-size: 12px;
  line-height: 1.48;
}

.entry-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
  margin-top: 12px;
  padding: 0 14px;
  border: 1px solid var(--v5-border-strong);
  border-radius: 8px;
  background: var(--v5-surface-2);
  color: var(--v5-ink-2);
  font-size: 13px;
  font-weight: 600;
}

@media (min-width: 700px) {
  .entry-page {
    padding: 24px;
  }

  .entry-hero {
    grid-template-columns: minmax(0, 1.12fr) minmax(260px, 0.88fr);
    align-items: center;
    min-height: 370px;
  }

  .entry-actions {
    max-width: 430px;
    grid-template-columns: 1fr 1fr;
  }

  .entry-title {
    font-size: 46px;
  }
}
</style>
