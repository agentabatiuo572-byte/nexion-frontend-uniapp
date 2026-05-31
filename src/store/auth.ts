import { defineStore } from 'pinia'
import {
  getCurrentUserProfile,
  login as loginApi,
  register as registerApi,
  sendRegisterSmsCode as sendRegisterSmsCodeApi,
  updateCurrentUserProfile
} from '@/api/auth'
import { SESSION_KEY, TOKEN_KEY } from '@/utils/storage'
import type {
  RegisterSmsCodeRequest,
  UserLoginRequest,
  UserProfileUpdateRequest,
  UserRegisterRequest,
  UserSession
} from '@/types/auth'

interface AuthState {
  token: string
  session: UserSession | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: '',
    session: null
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
    displayName: (state) => state.session?.nickname || 'Nexion User'
  },
  actions: {
    restore() {
      this.token = uni.getStorageSync(TOKEN_KEY) || ''
      const raw = uni.getStorageSync(SESSION_KEY)
      if (raw) {
        try {
          this.session = typeof raw === 'string' ? JSON.parse(raw) : raw
        } catch {
          this.session = null
        }
      }
    },
    setSession(session: UserSession) {
      this.token = session.token
      this.session = session
      uni.setStorageSync(TOKEN_KEY, session.token)
      uni.setStorageSync(SESSION_KEY, JSON.stringify(session))
    },
    async login(data: UserLoginRequest) {
      const session = await loginApi(data)
      this.setSession(session)
      return session
    },
    async register(data: UserRegisterRequest) {
      const session = await registerApi(data)
      this.setSession(session)
      return session
    },
    sendRegisterSmsCode(data: RegisterSmsCodeRequest) {
      return sendRegisterSmsCodeApi(data)
    },
    async refreshProfile() {
      const profile = await getCurrentUserProfile()
      if (this.session) {
        this.session = {
          ...this.session,
          nickname: profile.nickname || this.session.nickname,
          avatarUrl: profile.avatarUrl || '',
          referralCode: profile.referralCode || this.session.referralCode,
          userLevel: profile.userLevel || this.session.userLevel,
          vRank: profile.vRank || this.session.vRank
        }
        uni.setStorageSync(SESSION_KEY, JSON.stringify(this.session))
      }
      return profile
    },
    async updateProfile(data: UserProfileUpdateRequest) {
      const profile = await updateCurrentUserProfile(data)
      if (this.session) {
        this.session = {
          ...this.session,
          nickname: profile.nickname || this.session.nickname,
          avatarUrl: profile.avatarUrl || '',
          referralCode: profile.referralCode || this.session.referralCode,
          userLevel: profile.userLevel || this.session.userLevel,
          vRank: profile.vRank || this.session.vRank
        }
        uni.setStorageSync(SESSION_KEY, JSON.stringify(this.session))
      }
      return profile
    },
    logout() {
      this.token = ''
      this.session = null
      uni.removeStorageSync(TOKEN_KEY)
      uni.removeStorageSync(SESSION_KEY)
    }
  }
})
