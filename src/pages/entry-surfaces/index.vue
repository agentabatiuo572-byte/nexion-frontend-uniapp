<template>
  <AppChassis active="home">
    <view class="entry-index">
      <view class="entry-index__head">
        <text class="entry-index__eyebrow">三端入口</text>
        <text class="entry-index__title">完整可点击链接</text>
        <text class="entry-index__body">签名版 APP、H5 网页版、白 APP 接管首页分开进入，正盘默认首页保持独立。</text>
      </view>

      <view class="entry-index__list">
        <view v-for="item in links" :key="item.route" class="entry-index__row" role="button" tabindex="0" :aria-label="item.label" @tap="open(item.route)" @click="open(item.route)">
          <view class="entry-index__row-copy">
            <text class="entry-index__row-label">{{ item.label }}</text>
            <text class="entry-index__row-url">{{ item.fullUrl }}</text>
          </view>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 17 17 7" />
            <path d="M8 7h9v9" />
          </svg>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import AppChassis from "@/components/app-chassis.vue";
import { useSetPageHeader } from "@/composables/use-page-header";
import { navTo } from "@/lib/route";

const links = [
  {
    label: "签名版 APP 首页",
    route: "/pages/entry-surfaces/signed",
    fullUrl: "http://localhost:5173/#/pages/entry-surfaces/signed",
  },
  {
    label: "H5 网页版首页",
    route: "/pages/entry-surfaces/h5",
    fullUrl: "http://localhost:5173/#/pages/entry-surfaces/h5",
  },
  {
    label: "白 APP 接管首页",
    route: "/pages/entry-surfaces/white?entry=white-app",
    fullUrl: "http://localhost:5173/#/pages/entry-surfaces/white?entry=white-app",
  },
];

useSetPageHeader({
  title: "三端入口",
  subtitle: "完整链接",
  backHref: "/",
});

function open(route: string) {
  navTo(route);
}
</script>

<style scoped>
.entry-index {
  min-height: 100%;
  padding: 16px;
  color: var(--v5-ink);
  font-family: var(--font-v5);
  background:
    radial-gradient(circle at 18% 8%, color-mix(in srgb, var(--v5-brand) 14%, transparent), transparent 32%),
    radial-gradient(circle at 88% 6%, color-mix(in srgb, var(--v5-brand-2) 12%, transparent), transparent 30%),
    var(--v5-bg);
}

.entry-index__head {
  padding: 18px 0 10px;
}

.entry-index__eyebrow {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid var(--v5-border);
  border-radius: 8px;
  background: var(--v5-surface);
  color: var(--v5-ink-2);
  font-size: 12px;
  font-weight: 800;
}

.entry-index__title {
  display: block;
  margin-top: 18px;
  color: var(--v5-ink);
  font-size: 34px;
  font-weight: 900;
  line-height: 1.08;
}

.entry-index__body {
  display: block;
  margin-top: 12px;
  color: var(--v5-ink-2);
  font-size: 14px;
  line-height: 1.62;
}

.entry-index__list {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.entry-index__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 92px;
  padding: 14px;
  border: 1px solid var(--v5-border);
  border-radius: 8px;
  background: var(--v5-surface);
  box-shadow: var(--v5-card-shadow-lift);
}

.entry-index__row-copy {
  min-width: 0;
}

.entry-index__row-label {
  display: block;
  color: var(--v5-ink);
  font-size: 14px;
  font-weight: 900;
}

.entry-index__row-url {
  display: block;
  margin-top: 7px;
  color: var(--v5-ink-3);
  font-family: var(--font-jet-mono);
  font-size: 11px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

@media (min-width: 700px) {
  .entry-index {
    padding: 24px;
  }

  .entry-index__title {
    font-size: 44px;
  }
}
</style>
