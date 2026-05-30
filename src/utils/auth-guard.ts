import { useAuthStore } from '@/store/auth'

export function requireAuth() {
  const auth = useAuthStore()
  auth.restore()
  if (!auth.isAuthenticated) {
    uni.reLaunch({ url: '/pages/auth/login' })
    return false
  }
  return true
}

export function goAfterAuth() {
  uni.switchTab({ url: '/pages/home/index' })
}
