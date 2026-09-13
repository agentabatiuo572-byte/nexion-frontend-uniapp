import { describe, expect, it } from "vitest";
import { isPublicAuthRoute } from "./auth-route-visibility";

describe("public auth route boundary", () => {
  it("keeps registration entry and public legal pages reachable without a session", () => {
    expect(isPublicAuthRoute("#/pages/register/register?invite=Q1")).toBe(true);
    expect(isPublicAuthRoute("pages/onboarding/intro")).toBe(true);
    expect(isPublicAuthRoute("/pages/onboarding/privacy?return=%2Fpages%2Fonboarding%2Fintro")).toBe(true);
  });

  it("requires a session before calibration or success confirmation can render", () => {
    expect(isPublicAuthRoute("pages/onboarding/estimator")).toBe(false);
    expect(isPublicAuthRoute("pages/onboarding/connect")).toBe(false);
    expect(isPublicAuthRoute("pages/register/success")).toBe(false);
  });

  it("does not grant new routes access merely because they share a public directory", () => {
    for (const folder of ["login", "session", "ref", "tx"]) {
      expect(isPublicAuthRoute(`pages/${folder}/future-private-page`)).toBe(false);
    }
    for (const route of ["login/login", "session/kicked", "ref/code", "tx/hash"]) {
      expect(isPublicAuthRoute(`pages/${route}`)).toBe(true);
    }
  });
});
