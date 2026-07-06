// FEAT-AUTH01 OTP 发送闸门与生命周期(PRD §4.6.2 / §16.2.1;规格
// PRD/specs/FEAT-AUTH01-otp-antibomb-gate.md)。
//
// MOCK-ONLY: 本文件是 `POST /api/auth/otp/send | /api/auth/captcha/* |
// /api/auth/otp/verify` 的 server 同构 mock —— 判定全部走"服务端"规则
// (冷却 / 24h 限频 / ticket / TTL / attemptsLeft / 一码一),client 只消费
// discriminated union 结论。PROD: 三个入口函数体整体替换为真实 API 调用,
// 返回形态不变;storage 记录随之废弃(server 权威)。
import { useConfig } from "@/store/config";

export type OtpScene = "login" | "register" | "reset";

export type OtpSendResult =
  | { ok: true; requestId: string; resendAfterSec: number; expiresInSec: number }
  | { ok: false; error: "captcha_required" }
  | { ok: false; error: "rate_limited"; retryAfterSec: number }
  // 预留:§4.6.2 密码锁定期间拒发。mock 无密码错误计数器,不触发。
  | { ok: false; error: "locked"; lockedUntil: number };

export type CaptchaChallenge = { challengeId: string; targetRatio: number };

export type CaptchaVerifyResult =
  | { ok: true; ticket: string; expiresInSec: number }
  | { ok: false; error: "captcha_failed"; failCount: number }
  | { ok: false; error: "captcha_throttled" };

export type OtpVerifyResult =
  | { ok: true; verifyToken: string }
  | { ok: false; error: "otp_invalid"; attemptsLeft: number }
  | { ok: false; error: "otp_expired" }
  | { ok: false; error: "otp_attempts_exceeded" }
  | { ok: false; error: "otp_not_found" };

// ── storage(mock server 侧状态;ms epoch;独立 key,不进 account-cloud)──
const SEND_LOG_KEY = "nx_otp_send_log_v1"; // Record<phone, number[]> 仅成功 send
const ACTIVE_KEY = "nx_otp_active_v1"; // Record<phone, ActiveOtp>
const CAPTCHA_KEY = "nx_otp_captcha_v1"; // Record<phone, CaptchaState>

interface ActiveOtp {
  requestId: string;
  scene: OtpScene;
  code: string; // PROD: server 持有,永不下发;mock 生成后仅按测试码规则判定
  issuedAt: number;
  expiresAt: number;
  attemptsLeft: number;
  status: "active" | "consumed" | "expired" | "exhausted";
}

interface CaptchaState {
  challengeId: string | null;
  targetRatio: number;
  fails: number;
  ticket: string | null;
  ticketExpiresAt: number;
  ticketUsed: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// ponytail: 拼图容差按轨道宽度比例判定(±2% ≈ 300px 区宽下 ±6px)。
const CAPTCHA_TOLERANCE_RATIO = 0.02;
// 单一来源:滑块失败上限,组件展示 n/max 与节流判定共用(勿在组件重复定义)。
export const MAX_CAPTCHA_FAILS = 5;
const MOCK_LATENCY_MS = 300;

function readMap<T>(key: string): Record<string, T> {
  try {
    const raw = uni.getStorageSync(key);
    return raw ? (JSON.parse(raw) as Record<string, T>) : {};
  } catch {
    return {};
  }
}
function writeMap<T>(key: string, map: Record<string, T>) {
  uni.setStorageSync(key, JSON.stringify(map));
}
function mint(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}
function delay(): Promise<void> {
  return new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));
}
function gate() {
  return useConfig().config.otpGate;
}

function recentSends(phone: string, now: number): number[] {
  const log = readMap<number[]>(SEND_LOG_KEY);
  return (log[phone] ?? []).filter((ts) => now - ts < DAY_MS);
}
function captchaState(phone: string): CaptchaState {
  const map = readMap<CaptchaState>(CAPTCHA_KEY);
  return (
    map[phone] ?? { challengeId: null, targetRatio: 0, fails: 0, ticket: null, ticketExpiresAt: 0, ticketUsed: true }
  );
}
function saveCaptchaState(phone: string, st: CaptchaState) {
  const map = readMap<CaptchaState>(CAPTCHA_KEY);
  writeMap(CAPTCHA_KEY, { ...map, [phone]: st });
}
function hasValidTicket(st: CaptchaState, now: number): boolean {
  return !!st.ticket && !st.ticketUsed && st.ticketExpiresAt > now;
}

// ── POST /api/auth/otp/send ───────────────────────────────────────────────
// 闸门判定顺序(规格 ④):① 冷却 → ② 24h 限频(无有效 ticket 即 429)→ ③ 放行。
export async function otpSend(phone: string, scene: OtpScene, captchaTicket?: string): Promise<OtpSendResult> {
  await delay();
  const cfg = gate();
  const now = Date.now();

  const sends = recentSends(phone, now);
  const lastSentAt = sends.length ? Math.max(...sends) : 0;
  const cooldownEndsAt = lastSentAt + cfg.resendSeconds * 1000;
  if (cooldownEndsAt > now) {
    // rate_limited 不生成新码、不失效现有码、不计 SendLog(规格 ④ 禁止动作)。
    return { ok: false, error: "rate_limited", retryAfterSec: Math.ceil((cooldownEndsAt - now) / 1000) };
  }

  if (sends.length >= cfg.captchaAfterSends) {
    const st = captchaState(phone);
    // ticket 必须显式出示且与签发一致(规格 ④ 单次使用):未出示视同无票,
    // 不隐式复用 storage 里的存票——防"滑块成功但未消费的孤儿票"被后续
    // 无参 send 静默用掉(audit P0)。
    const ticketOk = !!captchaTicket && hasValidTicket(st, now) && captchaTicket === st.ticket;
    if (!ticketOk) return { ok: false, error: "captcha_required" };
    // ticket 单次使用:放行即消费。
    saveCaptchaState(phone, { ...st, ticketUsed: true });
  }

  // 放行:新码覆盖旧码(一码一机制,§4.6.2)。
  const record: ActiveOtp = {
    requestId: mint("OTP"),
    scene,
    code: String(Math.floor(100000 + Math.random() * 900000)),
    issuedAt: now,
    expiresAt: now + cfg.otpTtlSeconds * 1000,
    attemptsLeft: cfg.maxVerifyAttempts,
    status: "active",
  };
  const active = readMap<ActiveOtp>(ACTIVE_KEY);
  writeMap(ACTIVE_KEY, { ...active, [phone]: record });
  const log = readMap<number[]>(SEND_LOG_KEY);
  writeMap(SEND_LOG_KEY, { ...log, [phone]: [...sends, now] });

  return { ok: true, requestId: record.requestId, resendAfterSec: cfg.resendSeconds, expiresInSec: cfg.otpTtlSeconds };
}

// ── POST /api/auth/captcha/challenge ──────────────────────────────────────
// server 出题:目标缺口在 40%–85% 区间随机;失败计数保留在 phone 维度。
// ⚠️ PROD 差异(与 otpSend/otpVerify 的"函数体无痛替换"不同):真实滑块验证
// server 不下发 targetRatio(答案),challenge 为加密拼图资源;verify 的 proof
// 也不是位置比例,而是完整拖动轨迹(时间序列),server 做行为分析判定。
// mock 明文下发 target 是"前端要渲染缺口"的固有限制,接真后台时这两个函数的
// 入参/返回 shape 需按厂商 SDK(极验类)整体重设计,client 渲染层随之替换。
export async function captchaChallenge(phone: string): Promise<CaptchaChallenge> {
  await delay();
  const st = captchaState(phone);
  const challenge: CaptchaChallenge = { challengeId: mint("CH"), targetRatio: 0.4 + Math.random() * 0.45 };
  saveCaptchaState(phone, { ...st, challengeId: challenge.challengeId, targetRatio: challenge.targetRatio });
  return challenge;
}

// ── POST /api/auth/captcha/verify ─────────────────────────────────────────
// 判定权在 server(mock 同构):client 只上报释放位置比例。
export async function captchaVerify(
  phone: string,
  proof: { challengeId: string; offsetRatio: number },
): Promise<CaptchaVerifyResult> {
  await delay();
  const cfg = gate();
  const st = captchaState(phone);
  const now = Date.now();

  const hit = st.challengeId === proof.challengeId && Math.abs(proof.offsetRatio - st.targetRatio) <= CAPTCHA_TOLERANCE_RATIO;
  if (hit) {
    const ticket = mint("CT");
    saveCaptchaState(phone, {
      ...st,
      challengeId: null,
      fails: 0,
      ticket,
      ticketExpiresAt: now + cfg.captchaTicketTtlSeconds * 1000,
      ticketUsed: false,
    });
    return { ok: true, ticket, expiresInSec: cfg.captchaTicketTtlSeconds };
  }

  const fails = st.fails + 1;
  if (fails >= MAX_CAPTCHA_FAILS) {
    // 连续 5 次失败:关闭并要求稍后再试;计数清零,下次重新拉起再来。
    // ponytail: mock 不做跨轮冷却(规格 ④ 显式认领);PROD 由 server 风控
    // 对高频 throttled 升级处置(更长冷却/设备封禁),预留。
    saveCaptchaState(phone, { ...st, challengeId: null, fails: 0 });
    return { ok: false, error: "captcha_throttled" };
  }
  saveCaptchaState(phone, { ...st, challengeId: null, fails });
  return { ok: false, error: "captcha_failed", failCount: fails };
}

// ── POST /api/auth/otp/verify ─────────────────────────────────────────────
export async function otpVerify(phone: string, scene: OtpScene, code: string): Promise<OtpVerifyResult> {
  await delay();
  void scene; // 记录用途;code 按手机号维度校验(§4.6.2 一码一)。
  const map = readMap<ActiveOtp>(ACTIVE_KEY);
  const rec = map[phone];
  const now = Date.now();

  if (!rec || rec.status === "consumed") return { ok: false, error: "otp_not_found" };
  if (rec.status === "exhausted") return { ok: false, error: "otp_attempts_exceeded" };
  if (rec.status === "expired" || rec.expiresAt <= now) {
    writeMap(ACTIVE_KEY, { ...map, [phone]: { ...rec, status: "expired" } });
    return { ok: false, error: "otp_expired" };
  }

  // MOCK 判定规则(Stripe 测试卡模式,规格 ③):000000=invalid · 999999=expired
  // · 其它 6 位=通过。PROD: 替换为 `code === rec.code` 的 server 权威比对。
  if (code === "999999") {
    writeMap(ACTIVE_KEY, { ...map, [phone]: { ...rec, status: "expired" } });
    return { ok: false, error: "otp_expired" };
  }
  if (code === "000000") {
    const attemptsLeft = rec.attemptsLeft - 1;
    if (attemptsLeft <= 0) {
      writeMap(ACTIVE_KEY, { ...map, [phone]: { ...rec, attemptsLeft: 0, status: "exhausted" } });
      return { ok: false, error: "otp_attempts_exceeded" };
    }
    writeMap(ACTIVE_KEY, { ...map, [phone]: { ...rec, attemptsLeft } });
    return { ok: false, error: "otp_invalid", attemptsLeft };
  }

  writeMap(ACTIVE_KEY, { ...map, [phone]: { ...rec, status: "consumed" } });
  return { ok: true, verifyToken: mint("VT") };
}

// ── DEV/DEMO bridge(spec7-dev-bridge 同模式;PROD 不挂载)──────────────
export function mountAuthOtpDevBridge(): void {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  (window as unknown as Record<string, unknown>).__nexionAuthDev = {
    /** 预填 n 条 24h 内 send 记录:免等 2 轮冷却即可演示滑块闸门。 */
    seedSendLog(phone: string, n: number) {
      const now = Date.now();
      const log = readMap<number[]>(SEND_LOG_KEY);
      // 记录落在冷却窗之外(-2h 起、每条隔 1h),只推高 24h 计数、不触发 rate_limited。
      const stamps = Array.from({ length: n }, (_, i) => now - (i + 2) * 60 * 60 * 1000);
      writeMap(SEND_LOG_KEY, { ...log, [phone]: stamps });
    },
    /** 清空该手机号的全部闸门状态(send log / active code / captcha)。 */
    reset(phone: string) {
      const log = readMap<number[]>(SEND_LOG_KEY);
      delete log[phone];
      writeMap(SEND_LOG_KEY, log);
      const active = readMap<ActiveOtp>(ACTIVE_KEY);
      delete active[phone];
      writeMap(ACTIVE_KEY, active);
      const cap = readMap<CaptchaState>(CAPTCHA_KEY);
      delete cap[phone];
      writeMap(CAPTCHA_KEY, cap);
    },
    /** 只读观测口。 */
    inspect(phone: string) {
      return {
        sendLog: readMap<number[]>(SEND_LOG_KEY)[phone] ?? [],
        active: readMap<ActiveOtp>(ACTIVE_KEY)[phone] ?? null,
        captcha: readMap<CaptchaState>(CAPTCHA_KEY)[phone] ?? null,
      };
    },
    /** 运行时验收透传(绕 UI 直打"服务端",走页面主链模块实例)。 */
    send(phone: string, scene: OtpScene, captchaTicket?: string) {
      return otpSend(phone, scene, captchaTicket);
    },
    verify(phone: string, scene: OtpScene, code: string) {
      return otpVerify(phone, scene, code);
    },
  };
}
