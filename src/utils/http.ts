import { getLocale, TOKEN_KEY } from '@/utils/storage'

export interface ApiResult<T> {
  code: number
  message: string
  data: T
}

export interface RequestOptions<T = unknown> {
  url: string
  method?: UniApp.RequestOptions['method']
  data?: T
  auth?: boolean
}

const configuredBaseUrl = import.meta.env.VITE_NEXION_API_BASE_URL as string | undefined

export const API_BASE_URL = configuredBaseUrl || '/api'

function joinUrl(path: string) {
  const base = API_BASE_URL.replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalizedPath}`
}

export function request<T, B = unknown>(options: RequestOptions<B>): Promise<T> {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync(TOKEN_KEY)
    const header: Record<string, string> = {
      'Accept-Language': getLocale(),
      'Content-Type': 'application/json'
    }

    if (options.auth !== false && token) {
      header.Authorization = `Bearer ${token}`
    }

    uni.request({
      url: joinUrl(options.url),
      method: options.method || 'GET',
      data: options.data as UniApp.RequestOptions['data'],
      header,
      success(response) {
        const body = response.data as ApiResult<T> | T
        if (typeof body === 'object' && body !== null && 'code' in body) {
          const result = body as ApiResult<T>
          if (result.code !== 0) {
            reject(new Error(result.message || '接口请求失败'))
            return
          }
          resolve(result.data)
          return
        }
        resolve(body as T)
      },
      fail(error) {
        reject(new Error(error.errMsg || '网络请求失败'))
      }
    })
  })
}
