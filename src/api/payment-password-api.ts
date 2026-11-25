import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";

export type PaymentPasswordAuthorization = { paymentPassword: string; credentialVersion: number; attemptNo: string };

export interface PaymentPasswordState {
  configured: boolean;
  credentialVersion: number;
  lockedUntil: string | null;
  remainingAttempts: number;
  serverTime: string;
}
export interface PaymentPasswordReceipt {
  commandKey: string;
  status: "SUCCEEDED" | "REJECTED" | "PROCESSING" | "NOT_SEEN" | "INDETERMINATE";
  state?: PaymentPasswordState;
  code?: number;
  message?: string;
  canResumeSameKey: boolean;
}
export interface PaymentPasswordChallenge {
  phoneMasked: string;
  challengeNo: string;
  resendAfterSec: number;
  expiresAt: string;
}
export interface PaymentPasswordProof { resetProof: string; expiresAt: string }
export interface PaymentPasswordChangeProof { changeProof: string; expiresAt: string }
interface PaymentPasswordChangeAttempt { expectedCredentialVersion: number; attemptNo: string }
export interface PaymentPasswordChangeVerification extends PaymentPasswordChangeAttempt { currentPassword: string }
export interface PaymentPasswordChangeCommand extends PaymentPasswordChangeAttempt {
  changeProof: string;
  newPassword: string;
  confirmPassword: string;
  commandKey: string;
}
type PaymentPasswordChangeVerificationResult = PaymentPasswordChangeProof | {
  reason: (typeof changeVerifyRefusals)[number]["message"];
  state: PaymentPasswordState;
};
export interface PaymentPasswordApi {
  status(): Promise<PaymentPasswordState>;
  setup(input: { newPassword: string; confirmPassword: string; commandKey: string }): Promise<PaymentPasswordReceipt>;
  changeVerify(input: PaymentPasswordChangeVerification): Promise<PaymentPasswordChangeVerificationResult>;
  change(input: PaymentPasswordChangeCommand): Promise<PaymentPasswordReceipt>;
  receipt(commandKey: string): Promise<PaymentPasswordReceipt>;
  challenge(): Promise<PaymentPasswordChallenge>;
  verify(challengeNo: string, code: string): Promise<PaymentPasswordProof>;
  reset(input: { resetProof: string; newPassword: string; confirmPassword: string; expectedCredentialVersion: number; commandKey: string }): Promise<PaymentPasswordReceipt>;
}

const changeVerifyRefusals = [
  { code: 422, message: "PAYMENT_PASSWORD_INCORRECT" },
  { code: 429, message: "PAYMENT_PASSWORD_LOCKED" },
  { code: 409, message: "PAYMENT_PASSWORD_VERSION_CONFLICT" },
  { code: 409, message: "PAYMENT_PASSWORD_NOT_CONFIGURED" },
  { code: 409, message: "PAYMENT_PASSWORD_ATTEMPT_ALREADY_USED" },
] as const;

export function validPaymentPassword(value: unknown): value is string { return typeof value === "string" && /^[0-9]{6}$/.test(value); }
function validChangeProof(value: unknown): value is string { return typeof value === "string" && !!value.trim() && value.length <= 128; }
function validateChangeAttempt({ expectedCredentialVersion, attemptNo }: PaymentPasswordChangeAttempt) {
  if (!Number.isSafeInteger(expectedCredentialVersion) || expectedCredentialVersion < 1
    || typeof attemptNo !== "string" || !/^[A-Za-z0-9:_-]{8,128}$/.test(attemptNo)) throw invalidInput();
}
function invalidInput(): ApiError { return new ApiError({ kind: "business", message: "PAYMENT_PASSWORD_INVALID" }); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function invalid(): ApiError { return new ApiError({ kind: "protocol", message: "PAYMENT_PASSWORD_RESPONSE_INVALID" }); }
function date(value: unknown): value is string { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
export function parsePaymentPasswordState(value: unknown): PaymentPasswordState {
  const data = object(value);
  if (typeof data.configured !== "boolean" || !Number.isSafeInteger(data.credentialVersion)
    || (data.credentialVersion as number) < 0 || (data.configured ? data.credentialVersion === 0 : data.credentialVersion !== 0)
    || !Number.isSafeInteger(data.remainingAttempts) || (data.remainingAttempts as number) < 0
    || !date(data.serverTime) || (data.lockedUntil !== null && !date(data.lockedUntil))) throw invalid();
  return { configured: data.configured, credentialVersion: data.credentialVersion as number,
    remainingAttempts: data.remainingAttempts as number, serverTime: data.serverTime, lockedUntil: data.lockedUntil as string | null };
}
function receipt(value: unknown, commandKey: string): PaymentPasswordReceipt {
  const data = object(value);
  if (data.commandKey !== commandKey || !["SUCCEEDED", "REJECTED", "PROCESSING", "NOT_SEEN", "INDETERMINATE"].includes(data.status as string)
    || (data.canResumeSameKey !== undefined && typeof data.canResumeSameKey !== "boolean")
    || (data.code !== undefined && !Number.isSafeInteger(data.code)) || (data.message !== undefined && typeof data.message !== "string")) throw invalid();
  const state = data.code === 429 && data.message === "PAYMENT_PASSWORD_LOCKED"
    ? parseLockedState(data.state ?? data.receipt)
    : data.state === undefined ? undefined : parsePaymentPasswordState(data.state);
  if (data.status === "SUCCEEDED" && !state) throw invalid();
  return { commandKey: data.commandKey, status: data.status as PaymentPasswordReceipt["status"], state,
    code: data.code as number | undefined, message: data.message as string | undefined, canResumeSameKey: data.canResumeSameKey === true };
}

function parseLockedState(value: unknown): PaymentPasswordState | undefined {
  try {
    const state = parsePaymentPasswordState(value);
    return state.lockedUntil ? state : undefined;
  } catch {
    return undefined;
  }
}

export function createPaymentPasswordApi(client: ApiClient): PaymentPasswordApi {
  const base = "/api/app/security/payment-password";
  const mutate = async (path: string, input: { commandKey: string; [key: string]: unknown }) => {
    const { commandKey, ...body } = input;
    return receipt(await client.request({ method: "POST", path: `${base}/${path}`, body, idempotencyKey: commandKey, retryAfterAuth: false }), commandKey);
  };
  return {
    status: async () => parsePaymentPasswordState(await client.request({ path: base })),
    setup: input => mutate("setup", input),
    async changeVerify(input) {
      validateChangeAttempt(input);
      const { currentPassword, expectedCredentialVersion, attemptNo } = input;
      if (!validPaymentPassword(currentPassword)) throw invalidInput();
      return client.request<PaymentPasswordChangeVerificationResult>({
        method: "POST", path: `${base}/change/verify`, body: { currentPassword, expectedCredentialVersion, attemptNo }, retryAfterAuth: false,
        acceptedResponses: changeVerifyRefusals.flatMap(refusal => [200, refusal.code].map(status => ({ ...refusal, status }))),
        parseResponseData(value, _, { code, message }) {
          const refusal = changeVerifyRefusals.find(entry => entry.code === code && entry.message === message);
          if (refusal) return { reason: refusal.message, state: parsePaymentPasswordState(value) };
          const { changeProof, expiresAt } = object(value);
          if (!validChangeProof(changeProof) || !date(expiresAt)) throw invalid();
          return { changeProof, expiresAt };
        },
      });
    },
    async change(input) {
      validateChangeAttempt(input);
      const { changeProof, newPassword, confirmPassword, expectedCredentialVersion, attemptNo, commandKey } = input;
      if (!validChangeProof(changeProof) || !validPaymentPassword(newPassword) || !validPaymentPassword(confirmPassword)) throw invalidInput();
      return client.request<PaymentPasswordReceipt>({
        method: "POST", path: `${base}/change`, idempotencyKey: commandKey, retryAfterAuth: false,
        body: { changeProof, newPassword, confirmPassword, expectedCredentialVersion, attemptNo },
        acceptedResponses: [200, 429].map(status => ({ status, code: 429, message: "PAYMENT_PASSWORD_LOCKED" })),
        parseResponseData(value, _, { code, message }) {
          return code === 429
            ? { commandKey, status: "REJECTED", code, message, state: parseLockedState(value), canResumeSameKey: false }
            : receipt(value, commandKey);
        },
      });
    },
    reset: input => mutate("reset", input),
    receipt: async key => receipt(await client.request({ path: `${base}/commands/${encodeURIComponent(key)}` }), key),
    challenge: async () => {
      const data = object(await client.request({ method: "POST", path: `${base}/reset/challenge` }));
      if (typeof data.phoneMasked !== "string" || !data.phoneMasked || typeof data.challengeNo !== "string" || !data.challengeNo
        || !Number.isSafeInteger(data.resendAfterSec) || (data.resendAfterSec as number) < 0 || !date(data.expiresAt)) throw invalid();
      return data as unknown as PaymentPasswordChallenge;
    },
    verify: async (challengeNo, code) => {
      const data = object(await client.request({ method: "POST", path: `${base}/reset/verify`, body: { challengeNo, code }, retryAfterAuth: false }));
      if (typeof data.resetProof !== "string" || !data.resetProof || !date(data.expiresAt)) throw invalid();
      return data as unknown as PaymentPasswordProof;
    },
  };
}
