export interface UserLoginRequest {
  countryCode: string
  phone: string
  password: string
}

export interface UserRegisterRequest extends UserLoginRequest {
  verificationCode: string
  referralCode?: string
}

export interface RegisterSmsCodeRequest {
  countryCode: string
  phone: string
}

export interface RegisterSmsCodeResponse {
  expiresInSeconds: number
}

export interface UserSession {
  token: string
  userId: number
  nickname: string
  referralCode: string
  userLevel: string
  vRank: string
}
