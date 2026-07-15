import { useAuth } from "@/store/auth";
import { useApp } from "@/store/app";
import { readAccountSessionRecords, useSession } from "@/store/session";
import { useSponsorship } from "@/store/sponsorship";
import { rebindAccountScopedStores } from "@/lib/account-scope";
import { safeReturnTo } from "@/routing/safe-return-to";
import { isPhoneAuthAccountId, resolveAuthAccountById } from "@/store/auth-account";

interface CompleteSignInOptions {
  identity: string;
  returnTo?: string | null;
  sponsorCode?: string | null;
  idempotencyKey?: string | null;
  onboardingComplete?: boolean;
}

interface CompletedSignIn {
  identity: string;
  requiresRecalibration: boolean;
  completedAt: number;
}

export type CompleteSignInResult =
  | { ok: true }
  | { ok: false; error: "account_directory_unavailable" | "account_not_found" | "account_pending" | "sign_in_conflict" | "sign_in_storage_unavailable" };

const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
const COMPLETED_SIGN_INS_KEY = "__nexionAuthCompletedSignIns";
const runtimeScope = globalThis as unknown as Record<string, unknown>;
const completedSignIns = runtimeScope[COMPLETED_SIGN_INS_KEY] instanceof Map
  ? runtimeScope[COMPLETED_SIGN_INS_KEY] as Map<string, CompletedSignIn>
  : new Map<string, CompletedSignIn>();
runtimeScope[COMPLETED_SIGN_INS_KEY] = completedSignIns;

export function _devHasCompletedSignIn(idempotencyKey: string): boolean {
  return import.meta.env.DEV && completedSignIns.has(idempotencyKey);
}

/**
 * ⚠️ MOCK-ONLY CROSS-STORE MUTATION：密码登录、OTP 登录和注册入口老号共用链。
 * PROD 由主 PRD 既有 `POST /api/auth/login` / `POST /api/auth/otp/verify` /
 * `POST /api/auth/password/reset` 原子校验账号目录、创建 session、处理 sponsor
 * first-wins 并返回 canonical session；client 只消费该结果。mock 顺序：先写
 * auth，再绑定 app 与所有账号域 store，再 claim/resume session，最后绑定 sponsor；
 * 任一持久化校验失败都会清 session/auth 并重绑 default，绝不保留半登录态，然后
 * 才按 onboarding/recalibration/returnTo 路由。内存 idempotency key 仅防响应重试
 * 重复 claim session，不替代服务端事务。
 */
export function completeSignIn(options: CompleteSignInOptions): CompleteSignInResult {
  const auth = useAuth();
  const app = useApp();
  const session = useSession();
  const sponsorship = useSponsorship();
  const abortSignIn = (): CompleteSignInResult => {
    session.signOutSession();
    auth.signOut();
    app.bindAccount("default");
    rebindAccountScopedStores("default");
    return { ok: false, error: "sign_in_storage_unavailable" };
  };

  // 手机号账号必须先恢复目录里的 canonical 状态。pending 绝不能借普通
  // 密码/OTP 登录拿到 auth/session；active 的 onboarding 事实也不能由调用方覆盖。
  const accountLookup = resolveAuthAccountById(options.identity);
  if (!accountLookup.ok) return { ok: false, error: accountLookup.error };
  if (isPhoneAuthAccountId(options.identity) && accountLookup.account?.status !== "active") {
    return { ok: false, error: accountLookup.account ? "account_pending" : "account_not_found" };
  }
  if (accountLookup.account?.status === "pending") return { ok: false, error: "account_pending" };
  const onboardingComplete = accountLookup.account?.onboardingComplete ?? options.onboardingComplete ?? true;

  const now = Date.now();
  for (const [key, result] of completedSignIns) {
    if (now - result.completedAt > IDEMPOTENCY_TTL_MS) completedSignIns.delete(key);
  }

  const idempotencyKey = options.idempotencyKey ?? null;
  const completed = idempotencyKey ? completedSignIns.get(idempotencyKey) : null;
  if (completed && completed.identity !== options.identity) return { ok: false, error: "sign_in_conflict" };

  let requiresRecalibration = completed?.requiresRecalibration ?? false;
  const completionStillApplied = !!completed
    && auth.isAuthenticated
    && auth.accountId === options.identity
    && session.accountKey === options.identity
    && session.status === "active";
  if (!completionStillApplied) {
    if (!auth.signIn(options.identity, onboardingComplete)) {
      return { ok: false, error: "sign_in_storage_unavailable" };
    }
    app.bindAccount(options.identity);
    rebindAccountScopedStores(options.identity);
    if (completed) {
      const resumed = session.resumeOrClaim(options.identity);
      ({ requiresRecalibration } = resumed.status === "active" ? resumed : session.claim(options.identity));
    } else {
      ({ requiresRecalibration } = session.claim(options.identity));
    }
    if (!readAccountSessionRecords(options.identity).some((record) => record.sessionId === session.sessionId)) {
      return abortSignIn();
    }
    if (options.sponsorCode && !sponsorship.bind(options.sponsorCode)) {
      return abortSignIn();
    }
    if (idempotencyKey) {
      completedSignIns.set(idempotencyKey, { identity: options.identity, requiresRecalibration, completedAt: now });
    }
  } else if (auth.onboardingComplete !== onboardingComplete) {
    if (!auth.signIn(options.identity, onboardingComplete)) {
      return { ok: false, error: "sign_in_storage_unavailable" };
    }
  }
  if (!auth.onboardingComplete) {
    uni.reLaunch({
      url: "/pages/onboarding/estimator",
      fail: () => uni.reLaunch({ url: "/pages/onboarding/intro", fail: () => {} }),
    });
    return { ok: true };
  }
  if (requiresRecalibration) {
    uni.reLaunch({
      url: "/pages/onboarding/connect?mode=recalibrate",
      fail: () => uni.reLaunch({ url: "/pages/index/index", fail: () => {} }),
    });
    return { ok: true };
  }
  const dest = safeReturnTo(options.returnTo ?? null, "/pages/index/index");
  uni.reLaunch({ url: dest, fail: () => uni.reLaunch({ url: "/pages/index/index", fail: () => {} }) });
  return { ok: true };
}
