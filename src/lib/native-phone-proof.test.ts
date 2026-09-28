import { afterEach, expect, it, vi } from "vitest";
import type { ApiClient } from "@/api/api-client";
import { ApiError } from "@/api/errors";
import { nativePhoneRequest, signPhoneChallenge } from "./native-phone-proof";

afterEach(() => vi.unstubAllGlobals());
it("does not invent a native proof in H5 or retry a rejected write", async () => {
  vi.stubGlobal("plus", undefined);
  const request = vi.fn().mockRejectedValue(new ApiError({kind:"business",message:"PHONE_NATIVE_SESSION_REQUIRED"}));
  const client = { request } as unknown as ApiClient;
  await expect(nativePhoneRequest(client,"phone",{method:"POST",path:"/activate"})).rejects.toThrow("PHONE_NATIVE_PROOF_UNAVAILABLE");
  expect(request).toHaveBeenCalledTimes(1);
  expect(() => signPhoneChallenge("phone",{nonce:"",payload:"",expiresAt:0,keyAlias:"phone-v1:42:phone",keyRegistered:false})).toThrow("PHONE_NATIVE_PROOF_UNAVAILABLE");
});
it("preserves business failures and does not renew for arbitrary errors", async () => {
  const request = vi.fn().mockRejectedValue(new ApiError({kind:"business",message:"PHONE_REPLACEMENT_DISABLED"}));
  await expect(nativePhoneRequest({request} as unknown as ApiClient,"phone",{path:"/activate"})).rejects.toThrow("PHONE_REPLACEMENT_DISABLED");
  expect(request).toHaveBeenCalledTimes(1);
});
it("does not issue a challenge when the account changes after the original rejection", async () => {
  let changed = false;
  const request = vi.fn().mockImplementation(async () => {
    changed = true;
    throw new ApiError({kind:"business",message:"PHONE_NATIVE_SESSION_REQUIRED"});
  });
  const client = { request, captureSessionGuard: () => () => {
    if (changed) throw new ApiError({kind:"auth",message:"SESSION_CHANGED_DURING_REQUEST"});
  } } as unknown as ApiClient;
  await expect(nativePhoneRequest(client,"phone",{path:"/activate"})).rejects.toThrow("SESSION_CHANGED_DURING_REQUEST");
  expect(request).toHaveBeenCalledTimes(1);
});
it("regenerates an unregistered proof after failure and reuses a registered account key", () => {
  const invoke = vi.fn((_object: unknown, method: string) => {
    if (method === "containsAlias") return true;
    if (method === "getLength") return 2;
    if (method === "encodeToString") return "Y2VydA==";
    return {};
  });
  vi.stubGlobal("plus", { os: { name: "Android" }, android: { invoke, newObject: () => ({}) } });
  const challenge = { nonce: "bm9uY2U=", payload: "cGF5bG9hZA==", expiresAt: Date.now()+10000, keyAlias: "phone-v1:42:phone", keyRegistered: false };
  signPhoneChallenge("phone",challenge);
  expect(invoke.mock.calls.filter((call) => call[1] === "generateKeyPair")).toHaveLength(1);
  signPhoneChallenge("phone",{ ...challenge, keyRegistered: true });
  expect(invoke.mock.calls.filter((call) => call[1] === "generateKeyPair")).toHaveLength(1);
  signPhoneChallenge("phone",{ ...challenge, keyAlias: "phone-v1:43:phone" });
  expect(invoke.mock.calls.filter((call) => call[1] === "generateKeyPair")).toHaveLength(2);
});
