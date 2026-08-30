import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  closeTrial: vi.fn(),
  closeVoucher: vi.fn(),
  navigationError: vi.fn(),
  throwTrialStore: false,
  throwVoucherStore: false,
}));

vi.mock("@/store/trial-claim-sheet", () => ({
  useTrialClaimSheet: () => {
    if (mocks.throwTrialStore) throw new Error("no active Pinia");
    return { closeTransient: mocks.closeTrial };
  },
}));

vi.mock("@/store/voucher-claim-sheet", () => ({
  useVoucherClaimSheet: () => {
    if (mocks.throwVoucherStore) throw new Error("no active Pinia");
    return { closeTransient: mocks.closeVoucher };
  },
}));

vi.mock("@/store/ui", () => ({
  toast: { error: mocks.navigationError },
}));

vi.mock("@/i18n/use-t", () => ({
  getT: () => ({ ui: { navigationFailed: "Navigation failed" } }),
}));

import { navBack, navTo, navReset, navReplace, toUniRoute } from "./route";

type NavigationOptions = {
  url: string;
  success?: () => void;
  fail?: () => void;
};

describe("route navigation failure handling", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mocks.closeTrial.mockReset();
    mocks.closeVoucher.mockReset();
    mocks.navigationError.mockReset();
    mocks.throwTrialStore = false;
    mocks.throwVoucherStore = false;
  });

  it("reports a visible error after all normal-page fallbacks fail", () => {
    vi.stubGlobal("uni", {
      navigateTo: vi.fn((options: NavigationOptions) => options.fail?.()),
      redirectTo: vi.fn((options: NavigationOptions) => options.fail?.()),
      reLaunch: vi.fn((options: NavigationOptions) => options.fail?.()),
    });

    navTo("/pages/team/commissions");

    expect(uni.navigateTo).toHaveBeenCalledTimes(1);
    expect(uni.redirectTo).toHaveBeenCalledTimes(1);
    expect(uni.reLaunch).toHaveBeenCalledTimes(1);
    expect(mocks.navigationError).toHaveBeenCalledOnce();
    expect(mocks.navigationError).toHaveBeenCalledWith("Navigation failed");
  });

  it("does not report an error when a fallback succeeds", () => {
    vi.stubGlobal("uni", {
      navigateTo: vi.fn((options: NavigationOptions) => options.fail?.()),
      redirectTo: vi.fn(),
      reLaunch: vi.fn(),
    });

    navTo("/pages/me/wallet-withdraw");

    expect(uni.navigateTo).toHaveBeenCalledTimes(1);
    expect(uni.redirectTo).toHaveBeenCalledTimes(1);
    expect(uni.reLaunch).not.toHaveBeenCalled();
    expect(mocks.navigationError).not.toHaveBeenCalled();
  });

  it("reports a visible error after all tab-page fallbacks fail", () => {
    vi.stubGlobal("uni", {
      navigateTo: vi.fn((options: NavigationOptions) => options.fail?.()),
      redirectTo: vi.fn((options: NavigationOptions) => options.fail?.()),
      reLaunch: vi.fn((options: NavigationOptions) => options.fail?.()),
    });

    navTo("/team");

    expect(uni.reLaunch).toHaveBeenCalledTimes(1);
    expect(uni.redirectTo).toHaveBeenCalledTimes(1);
    expect(uni.navigateTo).toHaveBeenCalledTimes(1);
    expect(mocks.navigationError).toHaveBeenCalledOnce();
  });

  it("recognizes physical tabBar routes during migrated navigation", () => {
    expect(toUniRoute("/pages/team/team")).toEqual({ url: "/pages/team/team", tab: true });
    expect(toUniRoute("/pages/me/wallet")).toEqual({ url: "/pages/me/wallet", tab: false });
  });

  it("continues navigation when transient stores are not initialized yet", () => {
    mocks.throwTrialStore = true;
    mocks.throwVoucherStore = true;
    vi.stubGlobal("uni", {
      navigateTo: vi.fn(),
      redirectTo: vi.fn(),
      reLaunch: vi.fn(),
    });

    expect(() => navTo("/pages/team/commissions")).not.toThrow();
    expect(uni.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: "/pages/team/commissions",
    }));
  });

  it("reports invalid runtime href values instead of throwing or navigating", () => {
    vi.stubGlobal("uni", {
      navigateTo: vi.fn(),
      redirectTo: vi.fn(),
      reLaunch: vi.fn(),
    });

    expect(() => navTo(null as unknown as string)).not.toThrow();
    expect(mocks.navigationError).toHaveBeenCalledOnce();
    expect(uni.navigateTo).not.toHaveBeenCalled();
    expect(uni.redirectTo).not.toHaveBeenCalled();
    expect(uni.reLaunch).not.toHaveBeenCalled();
  });

  it("reports navigateBack failure even when no fallback href is supplied", () => {
    vi.stubGlobal("getCurrentPages", () => [{}, {}]);
    vi.stubGlobal("uni", {
      navigateBack: vi.fn((options: NavigationOptions) => options.fail?.()),
      showToast: vi.fn(),
    });

    navBack();

    expect(uni.navigateBack).toHaveBeenCalledOnce();
    expect(uni.showToast).toHaveBeenCalledWith({ title: "Navigation failed", icon: "none" });
  });

  it("uses the platform toast even when the optional UI store is unavailable", () => {
    mocks.navigationError.mockImplementationOnce(() => { throw new Error("no active Pinia"); });
    vi.stubGlobal("uni", {
      navigateTo: vi.fn((options: NavigationOptions) => options.fail?.()),
      redirectTo: vi.fn((options: NavigationOptions) => options.fail?.()),
      reLaunch: vi.fn((options: NavigationOptions) => options.fail?.()),
      showToast: vi.fn(),
    });

    navTo("/pages/team/commissions");

    expect(uni.showToast).toHaveBeenCalledWith({
      title: "Navigation failed",
      icon: "none",
    });
  });

  it("reports an invalid singleton fallback without throwing", () => {
    vi.stubGlobal("getCurrentPages", () => [{}]);
    vi.stubGlobal("uni", {
      reLaunch: vi.fn(),
      showToast: vi.fn(),
    });

    expect(() => navBack({} as unknown as string)).not.toThrow();
    expect(uni.showToast).toHaveBeenCalledWith({ title: "Navigation failed", icon: "none" });
    expect(uni.reLaunch).not.toHaveBeenCalled();
  });

  it("retries a forced reset without downgrading a mandatory gate to a stack push", async () => {
    vi.stubGlobal("uni", {
      reLaunch: vi.fn((options: NavigationOptions) => options.fail?.()),
      redirectTo: vi.fn(), navigateTo: vi.fn(),
    });
    const fail = vi.fn();
    const complete = vi.fn();
    expect(await navReset({ url: "/pages/onboarding/terms", fail, complete })).toBe(false);
    expect(uni.reLaunch).toHaveBeenCalledTimes(2);
    expect(uni.redirectTo).not.toHaveBeenCalled();
    expect(uni.navigateTo).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
    expect(mocks.navigationError).toHaveBeenCalledOnce();
  });

  it("recovers a replacement by resetting to the exact same URL", async () => {
    vi.stubGlobal("uni", {
      redirectTo: vi.fn((options: NavigationOptions) => options.fail?.()),
      reLaunch: vi.fn((options: NavigationOptions) => options.success?.()),
      navigateTo: vi.fn(),
    });
    const success = vi.fn();
    const fail = vi.fn();
    const complete = vi.fn();
    expect(await navReplace({ url: "/pages/store/order-detail?id=123", success, fail, complete })).toBe(true);
    expect(uni.reLaunch).toHaveBeenCalledWith(expect.objectContaining({ url: "/pages/store/order-detail?id=123" }));
    expect(success).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
    expect(fail).not.toHaveBeenCalled();
    expect(uni.navigateTo).not.toHaveBeenCalled();
    expect(mocks.navigationError).not.toHaveBeenCalled();
  });

  it("handles synchronous platform exceptions and malformed targets visibly", async () => {
    vi.stubGlobal("uni", { reLaunch: vi.fn(() => { throw new Error("SDK unavailable"); }) });
    expect(await navReset("/login")).toBe(false);
    expect(uni.reLaunch).toHaveBeenCalledTimes(2);
    expect(mocks.navigationError).toHaveBeenCalledOnce();
    expect(await navReset(null as unknown as string)).toBe(false);
    expect(mocks.navigationError).toHaveBeenCalledTimes(2);
    expect(uni.reLaunch).toHaveBeenCalledTimes(2);
  });

  it("ignores duplicate SDK callbacks after a successful transition", async () => {
    vi.stubGlobal("uni", { reLaunch: vi.fn((options: NavigationOptions) => {
      options.success?.(); options.fail?.(); options.success?.();
    }) });
    const success = vi.fn();
    expect(await navReset({ url: "/pages/login/login", success })).toBe(true);
    expect(success).toHaveBeenCalledOnce();
    expect(uni.reLaunch).toHaveBeenCalledOnce();
    expect(mocks.navigationError).not.toHaveBeenCalled();
  });

  it("renders forced-navigation failures on bare onboarding pages without a GlobalUi host", async () => {
    vi.stubGlobal("uni", {
      reLaunch: vi.fn((options: NavigationOptions) => options.fail?.()),
      showToast: vi.fn(),
    });
    expect(await navReset("/pages/login/login")).toBe(false);
    expect(uni.showToast).toHaveBeenCalledWith({ title: "Navigation failed", icon: "none" });
    expect(mocks.navigationError).not.toHaveBeenCalled();
  });

  it("also shows normal navigation failure from a bare Terms page without GlobalUi", () => {
    vi.stubGlobal("uni", {
      navigateTo: vi.fn((options: NavigationOptions) => options.fail?.()),
      redirectTo: vi.fn((options: NavigationOptions) => options.fail?.()),
      reLaunch: vi.fn((options: NavigationOptions) => options.fail?.()),
      showToast: vi.fn(),
    });
    navTo("/pages/me/risk-disclosure");
    expect(uni.showToast).toHaveBeenCalledWith({ title: "Navigation failed", icon: "none" });
  });
});
