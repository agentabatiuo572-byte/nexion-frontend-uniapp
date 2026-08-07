import type { ApiClient } from "./api-client";
import { isUserSession, type AuthSessionResponse, type UserSession } from "./contracts";
import { ApiError } from "./errors";
import type { SessionSnapshot, SessionVault } from "./session-vault";

export interface PasswordLoginRequest {
  countryCode: string;
  phone: string;
  password: string;
}

export interface TwoFactorLoginRequest extends PasswordLoginRequest {
  challengeNo: string;
  code: string;
}

export interface RegistrationOtpRequest {
  countryCode: string;
  phone: string;
}

export interface RegistrationOtpResult {
  challengeNo: string;
  resendAfterSec: number;
  deliveryHint: string;
}

export interface RegistrationRequest extends RegistrationOtpRequest {
  challengeNo: string;
  code: string;
  password: string;
  sponsorCode: string | null;
}

export type LoginResult =
  | { kind: "challenge"; user: UserSession; challengeNo: string; deliveryHint: string }
  | { kind: "authenticated"; user: UserSession };

export interface AuthApi {
  login(request: PasswordLoginRequest): Promise<LoginResult>;
  completeTwoFactor(request: TwoFactorLoginRequest): Promise<LoginResult>;
  sendRegistrationOtp(request: RegistrationOtpRequest): Promise<RegistrationOtpResult>;
  register(request: RegistrationRequest): Promise<LoginResult>;
  restore(): Promise<SessionSnapshot | null>;
  logout(): Promise<void>;
}

function registrationOtpFromResponse(value: unknown): RegistrationOtpResult {
  if (!value || typeof value !== "object") {
    throw new ApiError({ kind: "protocol", message: "REGISTRATION_OTP_RESPONSE_INVALID" });
  }
  const data = value as Partial<RegistrationOtpResult>;
  if (
    typeof data.challengeNo !== "string"
    || !/^REG-[a-f0-9]{32}$/i.test(data.challengeNo)
    || !Number.isSafeInteger(data.resendAfterSec)
    || Number(data.resendAfterSec) < 1
    || Number(data.resendAfterSec) > 600
    || typeof data.deliveryHint !== "string"
  ) {
    throw new ApiError({ kind: "protocol", message: "REGISTRATION_OTP_RESPONSE_INVALID" });
  }
  return data as RegistrationOtpResult;
}

function sessionFromResponse(data: AuthSessionResponse): SessionSnapshot | null {
  if (
    !data
    || typeof data !== "object"
    || typeof data.accessToken !== "string"
    || data.accessToken.length === 0
    || typeof data.refreshToken !== "string"
    || data.refreshToken.length === 0
    || typeof data.tokenType !== "string"
    || data.tokenType.toLowerCase() !== "bearer"
    || !isUserSession(data.user)
  ) return null;
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    tokenType: data.tokenType,
    user: data.user,
  };
}

function consumeLoginResponse(
  data: AuthSessionResponse,
  vault: SessionVault,
  expectedRevision: number,
): LoginResult {
  if (
    data
    && typeof data === "object"
    && typeof data.tokenType === "string"
    && data.tokenType.toLowerCase() === "challenge"
    && data.accessToken === null
    && data.refreshToken === null
    && typeof data.challengeNo === "string"
    && data.challengeNo.length > 0
    && isUserSession(data.user)
  ) {
    return {
      kind: "challenge",
      user: data.user,
      challengeNo: data.challengeNo,
      deliveryHint: data.deliveryHint || "",
    };
  }
  const session = sessionFromResponse(data);
  if (!session) throw new ApiError({ kind: "protocol", message: "AUTH_RESPONSE_INVALID" });
  if (!vault.saveIfUnchanged(session, expectedRevision)) {
    throw new ApiError({ kind: "auth", message: "SESSION_CHANGED_DURING_AUTH" });
  }
  return { kind: "authenticated", user: session.user };
}

export function createAuthApi(client: ApiClient, vault: SessionVault): AuthApi {
  return {
    async login(request) {
      const revision = vault.revision();
      const data = await client.request<AuthSessionResponse>({
        path: "/auth/users/login",
        method: "POST",
        body: request,
        authenticated: false,
        acceptedResponses: [{
          status: 428,
          code: 428,
          message: "USER_TWO_FACTOR_VERIFICATION_REQUIRED",
        }],
      });
      return consumeLoginResponse(data, vault, revision);
    },
    async completeTwoFactor(request) {
      const revision = vault.revision();
      const data = await client.request<AuthSessionResponse>({
        path: "/auth/users/login/2fa",
        method: "POST",
        body: request,
        authenticated: false,
      });
      return consumeLoginResponse(data, vault, revision);
    },
    async sendRegistrationOtp(request) {
      const data = await client.request<unknown>({
        path: "/auth/users/register/otp/send",
        method: "POST",
        body: request,
        authenticated: false,
      });
      return registrationOtpFromResponse(data);
    },
    async register(request) {
      const revision = vault.revision();
      const data = await client.request<AuthSessionResponse>({
        path: "/auth/users/register",
        method: "POST",
        body: request,
        authenticated: false,
      });
      const result = consumeLoginResponse(data, vault, revision);
      if (result.kind !== "authenticated") {
        throw new ApiError({ kind: "protocol", message: "REGISTRATION_SESSION_INVALID" });
      }
      return result;
    },
    async restore() {
      if (!vault.read()?.refreshToken) return null;
      return client.refreshSession();
    },
    async logout() {
      const revision = vault.revision();
      const refreshToken = vault.read()?.refreshToken;
      try {
        if (refreshToken) {
          await client.request({
            path: "/auth/users/logout",
            method: "POST",
            body: { refreshToken },
            authenticated: false,
          });
        }
      } catch {
        // Local logout is authoritative for this device even when offline.
      } finally {
        vault.clearIfUnchanged(revision);
      }
    },
  };
}
