import { request } from '@/utils/http'
import type {
  RegisterSmsCodeRequest,
  RegisterSmsCodeResponse,
  UserLoginRequest,
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
