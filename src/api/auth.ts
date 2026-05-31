import { request, joinUrl } from '@/utils/http'
import { getLocale, TOKEN_KEY } from '@/utils/storage'
import type {
  MediaUploadResponse,
  RegisterSmsCodeRequest,
  RegisterSmsCodeResponse,
  UserLoginRequest,
  UserProfile,
  UserProfileUpdateRequest,
  UserRegisterRequest,
  UserSession
} from '@/types/auth'

export function login(data: UserLoginRequest) {
  return request<UserSession, UserLoginRequest>({
    url: '/auth/users/login',
    method: 'POST',
    data,
    auth: false
  })
}

export function register(data: UserRegisterRequest) {
  return request<UserSession, UserRegisterRequest>({
    url: '/auth/users/register',
    method: 'POST',
    data,
    auth: false
  })
}

export function sendRegisterSmsCode(data: RegisterSmsCodeRequest) {
  return request<RegisterSmsCodeResponse, RegisterSmsCodeRequest>({
    url: '/auth/users/register/sms-code',
    method: 'POST',
    data,
    auth: false
  })
}

export function getCurrentUserProfile() {
  return request<UserProfile>({
    url: '/auth/users/me',
    method: 'GET'
  })
}

export function updateCurrentUserProfile(data: UserProfileUpdateRequest) {
  return request<UserProfile, UserProfileUpdateRequest>({
    url: '/auth/users/me',
    method: 'PATCH',
    data
  })
}

export function getMediaPreviewUrl(objectKey: string) {
  return request<MediaUploadResponse>({
    url: `/commerce/product-media/preview-url?objectKey=${encodeURIComponent(objectKey)}`,
    method: 'GET'
  })
}

export function uploadUserAvatar(filePath: string): Promise<MediaUploadResponse> {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync(TOKEN_KEY)
    uni.uploadFile({
      url: joinUrl('/commerce/product-media?mediaType=USER_AVATAR'),
      filePath,
      name: 'file',
      header: {
        Authorization: token ? `Bearer ${token}` : '',
        'Accept-Language': getLocale()
      },
      success(response) {
        try {
          const body = JSON.parse(response.data || '{}')
          if (body && typeof body === 'object' && 'code' in body) {
            if (body.code !== 0) {
              reject(new Error(body.message || 'Avatar upload failed'))
              return
            }
            resolve(body.data as MediaUploadResponse)
            return
          }
          resolve(body as MediaUploadResponse)
        } catch {
          reject(new Error('Avatar upload response is invalid'))
        }
      },
      fail(error) {
        reject(new Error(error.errMsg || 'Avatar upload failed'))
      }
    })
  })
}
