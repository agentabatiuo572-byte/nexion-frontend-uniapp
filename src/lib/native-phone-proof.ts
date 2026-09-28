import type { ApiClient, ApiRequest } from "@/api/api-client";
import { ApiError } from "@/api/errors";
import { hasNativeAndroidPhoneRuntime } from "./native-phone-runtime";

interface Challenge { nonce: string; payload: string; expiresAt: number; keyAlias: string; keyRegistered: boolean }
interface Proof { certificates: string[]; signature: string }

function unavailable(): never {
  throw new ApiError({ kind: "configuration", message: "PHONE_NATIVE_PROOF_UNAVAILABLE" });
}

/** Android owns the private key; no exported key or browser signature fallback. */
export function signPhoneChallenge(deviceId: string, challenge: Challenge): Proof {
  if (!hasNativeAndroidPhoneRuntime()) return unavailable();
  try {
    const android = plus.android;
    const call = (object: Parameters<PlusAndroid["invoke"]>[0], method: string, ...args: unknown[]) =>
      android.invoke(object, method, ...args);
    const decode = (value: string) => call("android.util.Base64", "decode", value, 2);
    const encode = (value: unknown): string => {
      const result = call("android.util.Base64", "encodeToString", value, 2);
      if (typeof result !== "string" || !result) return unavailable();
      return result;
    };
    if (!/^phone-v1:[1-9][0-9]*:[A-Za-z0-9._:-]{1,128}$/.test(challenge.keyAlias)
        || !challenge.keyAlias.endsWith(`:${deviceId}`) || typeof challenge.keyRegistered !== "boolean") return unavailable();
    const alias = `uvel.${challenge.keyAlias}`;
    const store = call("java.security.KeyStore", "getInstance", "AndroidKeyStore");
    if (!store) return unavailable();
    call(store, "load", null);
    const exists = call(store, "containsAlias", alias);
    if (typeof exists !== "boolean") return unavailable();
    if (challenge.keyRegistered && !exists) return unavailable();
    if (!challenge.keyRegistered) {
      // Native.js supports Java constructor varargs; its bundled declaration omits them.
      const construct = android.newObject.bind(android) as (name: string, ...args: unknown[]) => PlusAndroidInstanceObject;
      const builder = construct("android.security.keystore.KeyGenParameterSpec$Builder", alias, 4);
      const curve = android.newObject("java.security.spec.ECGenParameterSpec", "secp256r1");
      if (!builder || !curve) return unavailable();
      if (!call(builder, "setAlgorithmParameterSpec", curve)
          || !call(builder, "setDigests", ["SHA-256"])
          || !call(builder, "setAttestationChallenge", decode(challenge.nonce))) return unavailable();
      const generator = call("java.security.KeyPairGenerator", "getInstance", "EC", "AndroidKeyStore");
      if (!generator) return unavailable();
      call(generator, "initialize", call(builder, "build"));
      if (!call(generator, "generateKeyPair")) return unavailable();
    }
    const chain = call(store, "getCertificateChain", alias);
    const length = chain && call("java.lang.reflect.Array", "getLength", chain);
    if (!Number.isInteger(length) || length < 2 || length > 8) return unavailable();
    const certificates: string[] = [];
    for (let i = 0; i < length; i++) {
      const certificate = call("java.lang.reflect.Array", "get", chain, i);
      certificates.push(encode(call(certificate, "getEncoded")));
    }
    const key = call(store, "getKey", alias, null);
    const signer = call("java.security.Signature", "getInstance", "SHA256withECDSA");
    if (!key || !signer) return unavailable();
    call(signer, "initSign", key);
    call(signer, "update", decode(challenge.payload));
    return { certificates, signature: encode(call(signer, "sign")) };
  } catch { return unavailable(); }
}

/** Serialize challenge renewal; each request still rechecks its authenticated session. */
let renewal: Promise<unknown> = Promise.resolve();
export async function nativePhoneRequest<T>(client: ApiClient, deviceId: string, request: ApiRequest): Promise<T> {
  const checkSession = client.captureSessionGuard?.();
  try { return await client.request<T>(request); }
  catch (error) {
    if (!(error instanceof ApiError) || error.message !== "PHONE_NATIVE_SESSION_REQUIRED") throw error;
    const pending = renewal.catch(() => undefined).then(async () => {
      if (!checkSession) return unavailable();
      checkSession();
      if (!hasNativeAndroidPhoneRuntime()) return unavailable();
      const challenge = await client.request<Challenge>({ method: "POST", path: "/api/onboarding/phone-installation/challenge", body: { deviceId } });
      checkSession();
      if (!challenge || typeof challenge.nonce !== "string" || typeof challenge.payload !== "string"
          || challenge.nonce.length > 128 || challenge.payload.length > 2048
          || !Number.isFinite(challenge.expiresAt) || challenge.expiresAt <= Date.now()) return unavailable();
      const proof = signPhoneChallenge(deviceId, challenge);
      await client.request({ method: "POST", path: "/api/onboarding/phone-installation/verify", body: { deviceId, ...proof } });
      checkSession();
      return client.request<T>(request);
    });
    renewal = pending;
    return pending;
  }
}
