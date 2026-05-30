export const TOKEN_KEY = 'nexion_app_token'
export const SESSION_KEY = 'nexion_app_session'
export const LOCALE_KEY = 'nexion_app_locale'

export function getLocale() {
  return uni.getStorageSync(LOCALE_KEY) || 'en'
}
