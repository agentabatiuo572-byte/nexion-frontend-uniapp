<script setup lang="ts">
import { onMounted } from 'vue'
import AppShell from '@/components/AppShell.vue'
import { useAuthStore } from '@/store/auth'

onMounted(() => {
  const auth = useAuthStore()
  auth.restore()
  setTimeout(() => {
    if (auth.isAuthenticated) {
      uni.switchTab({ url: '/pages/home/index' })
    } else {
      uni.reLaunch({ url: '/pages/onboarding/intro/index' })
    }
  }, 350)
})
</script>

<template>
  <AppShell>
    <view class="launch">
      <view class="logo">N</view>
      <view class="name">Nexion</view>
      <view class="hint">Distributed compute income network</view>
    </view>
  </AppShell>
</template>

<style scoped>
.launch {
  display: flex;
  min-height: calc(100vh - 104rpx);
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.logo {
  display: grid;
  width: 116rpx;
  height: 116rpx;
  place-items: center;
  border-radius: 34rpx;
  background: #c6ff3a;
  color: #121707;
  font-size: 58rpx;
  font-weight: 800;
}

.name {
  margin-top: 30rpx;
  font-size: 42rpx;
  font-weight: 760;
}

.hint {
  margin-top: 12rpx;
  color: #8d96a6;
  font-size: 24rpx;
}
</style>
