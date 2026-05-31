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
  countryCode?: string
  phone?: string
  phoneMasked?: string
  nickname: string
  avatarUrl?: string
  avatarPreviewUrl?: string
  referralCode: string
  userLevel: string
  vRank: string
}

export interface UserProfile {
  id: number
  countryCode?: string
  phone?: string
  phoneMasked?: string
  nickname: string
  avatarUrl?: string
  referralCode?: string
  sponsorUserId?: number
  sponsorCode?: string
  kycStatus?: string
  userLevel?: string
  vRank?: string
  status?: string
  language?: string
  region?: string
  bio?: string
  timezone?: string
  createdAt?: string
  updatedAt?: string
}

export interface UserProfileUpdateRequest {
  nickname?: string
  avatarUrl?: string
  language?: string
  region?: string
  bio?: string
  timezone?: string
}

export interface MediaUploadResponse {
  bucket?: string
  objectKey: string
  downloadUrl?: string
  contentType?: string
  sizeBytes?: number
}
