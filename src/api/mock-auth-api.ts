import type { AuthApi } from "./auth-api";
import type { SessionSnapshot, SessionVault } from "./session-vault";
import type { UserSession } from "./contracts";
import { ApiError } from "./errors";

/**
 * mock 档的本地 AuthApi 实现(主人 2026-08-15 拍板包 zm T0)。
 *
 * 背景:服务端权威化批次后 auth 全链 server-backed,mock 客户端对一切调用抛
 * REMOTE_API_DISABLED_IN_MOCK_MODE —— 注册/登录在演示档彻底不可用(只能存储注入绕过)。
 * 本文件按「Mock 100% 真后台结构」不变量补上 mock 层实现:**接口契约与真实现逐方法对齐**
 * (含 vault 乐观并发/丢弃语义),切回 sandbox/remote 档零改动。
 *
 * 演示语义(产品面不露 demo):
 * - 验证码:挑战号本地签发,任意 6 位数字通过(老演示约定;文案仍是「输入 6 位验证码」)。
 * - OTP 登录未注册号码自动开户(演示不设死胡同);密码登录仍校验已设密码。
 * - userId 由 国家码+号码 稳定派生 —— 同一手机号跨会话同一账号,account-cloud 按此自初始化。
 */

interface MockUserRecord {
  userId: number;
  password: string | null;
  nickname: string;
}

interface MockUserRegistry {
  schema: 1;
  users: Record<string, MockUserRecord>;
}

const REGISTRY_KEY = "nexgrid-mock-auth-users-v1";

function identityOf(countryCode: string, phone: string): string {
  return `${countryCode} ${phone}`.trim();
}

/** 稳定正整数 userId(djb2):同号码跨会话不变,避免本地账本换主。 */
function deriveUserId(identity: string): number {
  let h = 5381;
  for (let i = 0; i < identity.length; i++) h = ((h * 33) ^ identity.charCodeAt(i)) >>> 0;
  return (h % 2_000_000_000) + 1_000_000;
}

function maskedHint(phone: string): string {
  const tail = phone.slice(-4);
  return `••• ${tail}`;
}

function loadRegistry(): MockUserRegistry {
  try {
    const raw = uni.getStorageSync(REGISTRY_KEY) as MockUserRegistry | "";
    if (raw && raw.schema === 1 && raw.users && typeof raw.users === "object") return raw;
  } catch {
    // first run / storage unavailable
  }
  return { schema: 1, users: {} };
}

function saveRegistry(reg: MockUserRegistry): void {
  try {
    uni.setStorageSync(REGISTRY_KEY, reg);
  } catch {
    // storage unavailable — session survives in memory via vault only
  }
}

function ensureUser(reg: MockUserRegistry, countryCode: string, phone: string): MockUserRecord {
  const id = identityOf(countryCode, phone);
  const existing = reg.users[id];
  if (existing) return existing;
  const created: MockUserRecord = { userId: deriveUserId(id), password: null, nickname: phone.slice(-4) };
  reg.users[id] = created;
  saveRegistry(reg);
  return created;
}

function assertSixDigit(code: string): void {
  if (!/^\d{6}$/.test(code)) {
    throw new ApiError({ kind: "business", message: "OTP_CODE_INVALID" });
  }
}

function snapshotFor(user: UserSession): SessionSnapshot {
  return {
    accessToken: `mock-access-${user.userId}-${Date.now()}`,
    refreshToken: `mock-refresh-${user.userId}`,
    tokenType: "Bearer",
    user,
  };
}

function sessionUser(countryCode: string, phone: string, rec: MockUserRecord): UserSession {
  return { userId: rec.userId, countryCode, phone, nickname: rec.nickname };
}

let challengeSeq = 0;

export function createMockAuthApi(vault: SessionVault): AuthApi {
  const issueChallenge = () => ({
    challengeNo: `MOCK-CH-${++challengeSeq}`,
    resendAfterSec: 60,
  });
  const persistLogin = (user: UserSession, revision: number): { kind: "authenticated"; user: UserSession; vaultRevision: number } => {
    // 与真实现同语义:以进入时的 revision 做乐观写;并发被抢先则按脏会话拒绝。
    if (!vault.saveIfUnchanged(snapshotFor(user), revision)) {
      throw new ApiError({ kind: "protocol", message: "SESSION_VAULT_CONFLICT" });
    }
    return { kind: "authenticated", user, vaultRevision: vault.revision() };
  };
  const discardSessionIfCurrent = (expectedRevision: number): void => {
    if (vault.revision() !== expectedRevision) return;
    if (!vault.read()) return;
    vault.clearIfUnchanged(expectedRevision);
  };

  return {
    async login(request) {
      const reg = loadRegistry();
      const rec = reg.users[identityOf(request.countryCode, request.phone)];
      if (!rec || rec.password === null || rec.password !== request.password) {
        throw new ApiError({ kind: "business", message: "INVALID_CREDENTIALS" });
      }
      return persistLogin(sessionUser(request.countryCode, request.phone, rec), vault.revision());
    },
    async sendLoginOtp(request) {
      return { ...issueChallenge(), deliveryHint: maskedHint(request.phone) };
    },
    async completeOtpLogin(request) {
      assertSixDigit(request.code);
      const reg = loadRegistry();
      const rec = ensureUser(reg, request.countryCode, request.phone);
      return persistLogin(sessionUser(request.countryCode, request.phone, rec), vault.revision());
    },
    async sendPasswordResetOtp(request) {
      return { ...issueChallenge(), deliveryHint: maskedHint(request.phone) };
    },
    async completePasswordReset(request) {
      assertSixDigit(request.code);
      const reg = loadRegistry();
      const rec = ensureUser(reg, request.countryCode, request.phone);
      rec.password = request.newPassword;
      saveRegistry(reg);
      return { status: "PASSWORD_RESET", revokedSessionCount: 0 };
    },
    async completeTwoFactor() {
      // mock 档不签发 2FA 挑战,走到这里 = 调用面出了岔子,如实报协议错而不是伪造放行。
      throw new ApiError({ kind: "protocol", message: "TWO_FACTOR_NOT_ISSUED_IN_MOCK" });
    },
    async sendRegistrationOtp(request) {
      return { ...issueChallenge(), deliveryHint: maskedHint(request.phone) };
    },
    async register(request) {
      assertSixDigit(request.code);
      const reg = loadRegistry();
      const rec = ensureUser(reg, request.countryCode, request.phone);
      rec.password = request.password;
      rec.nickname = request.phone.slice(-4);
      saveRegistry(reg);
      return persistLogin(sessionUser(request.countryCode, request.phone, rec), vault.revision());
    },
    async restore() {
      // 真实现走 refreshSession 换新 access token;mock 无服务端,本地重签同语义。
      const snapshot = vault.read();
      if (!snapshot?.refreshToken) return null;
      const renewed = snapshotFor(snapshot.user);
      vault.save(renewed);
      return renewed;
    },
    discardSessionIfCurrent(expectedRevision) {
      discardSessionIfCurrent(expectedRevision);
    },
    discardSessionForIdentity(identity) {
      const expectedRevision = vault.revision();
      const snapshot = vault.read();
      if (!snapshot) return;
      if (`user:${snapshot.user.userId}` !== identity) return;
      discardSessionIfCurrent(expectedRevision);
    },
    async logout() {
      vault.clear();
    },
  };
}
