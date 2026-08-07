export interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
}

export interface UserSession {
  userId: number;
  countryCode: string;
  phone: string;
  nickname: string;
}

export function isUserSession(value: unknown): value is UserSession {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<UserSession>;
  return (
    typeof user.userId === "number"
    && Number.isSafeInteger(user.userId)
    && user.userId > 0
    && typeof user.countryCode === "string"
    && user.countryCode.length > 0
    && typeof user.phone === "string"
    && user.phone.length > 0
    && typeof user.nickname === "string"
  );
}

export interface AuthSessionResponse {
  accessToken: string | null;
  tokenType: string;
  user: UserSession;
  challengeNo?: string | null;
  deliveryHint?: string | null;
  refreshToken: string | null;
}

export interface SecuritySession {
  id: string;
  deviceName: string;
  ipMasked: string;
  lastActiveAt: string;
  current: boolean;
}

export interface SecurityState {
  twoFactorEnabled: boolean;
  passwordChangedAt: string | null;
  sessions: SecuritySession[];
}

export interface SecurityMutation {
  twoFactorEnabled?: boolean | null;
  passwordChangedAt?: string | null;
  revokedSessionCount?: number | null;
}
