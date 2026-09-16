import { describe, expect, it, vi } from "vitest";
import { createBankBindingForm, validBankRecipient } from "./bank-binding-form";
import { ApiError } from "@/api/errors";

const beneficiary = { bankCode: "", bankName: "BANKQR", maskedAccount: "****6789", effectiveAt: "2099-09-17T00:00:00Z", nextChangeAt: "2099-09-23T00:00:00Z" };
const config = { enabled: false, banks: [], bankCodeRequired: false, bindingOtpRequired: false, payType: "BANKQR", beneficiary: null };
function fixture() {
  const api = { config: vi.fn().mockResolvedValue(config), bind: vi.fn().mockResolvedValue(beneficiary), verify: vi.fn().mockResolvedValue(beneficiary) };
  let current = "user-a:1";
  const form = createBankBindingForm(api, () => current);
  const fill = () => Object.assign(form.state, { account: "00123456789", holder: "NGUYEN VAN A" });
  return { api, form, fill, switchUser: () => { current = "user-b:2"; form.reset(); } };
}
describe("bank binding form", () => {
  it("validates account and holder without requiring a bank, OTP, PAN expiry or CVV", () => {
    expect(validBankRecipient({ account: "001234", holder: "Nguyễn Văn An" })).toBe(true);
    for (const draft of [{ account: "12345", holder: "NGUYEN VAN A" },
      { account: "1234x5678", holder: "NGUYEN VAN A" }, { account: "001234", holder: "A" }])
      expect(validBankRecipient(draft)).toBe(false);
  });
  it("requires the server to confirm BANKQR plus no-bank/no-OTP capability", async () => {
    const { form, api, fill } = fixture(); fill();
    for (const c of [{ ...config, bankCodeRequired: undefined }, { ...config, bindingOtpRequired: true },
      { ...config, payType: "BANK" }, { ...config, bankCodeRequired: true }]) {
      api.config.mockResolvedValue(c); await form.load();
      expect(form.canContinue()).toBe(false); await form.submit();
    }
    expect(api.bind).not.toHaveBeenCalled();
  });
  it("submits directly with explicit empty bank code and only account/name then verifies readback", async () => {
    const { form, api, fill } = fixture(); await form.load(); fill();
    expect(form.canContinue()).toBe(true);
    api.config.mockResolvedValue({ ...config, beneficiary }); await form.submit();
    expect(api.bind).toHaveBeenCalledOnce();
    expect(api.bind.mock.calls[0][0]).toEqual({ bankCode: "", account: "00123456789", holder: "NGUYEN VAN A" });
    expect(api.bind.mock.calls[0][1]).toMatch(/^bank-bind:[a-f0-9-]{36}$/);
    expect(form.state.phase).toBe("saved"); expect(form.state.account).toBe(""); expect(form.state.holder).toBe("");
  });
  it("a lost response retains the exact request and key; editing cannot create a second bind", async () => {
    const { form, api, fill } = fixture(); await form.load(); fill();
    api.bind.mockRejectedValueOnce(new ApiError({ kind: "network", message: "LOST" }));
    await form.submit(); expect(form.state.phase).toBe("uncertain");
    form.state.account = "9999999999"; await form.load();
    api.config.mockResolvedValue({ ...config, beneficiary }); await form.submit();
    expect(api.bind.mock.calls[1]).toEqual(api.bind.mock.calls[0]); expect(form.state.phase).toBe("saved");
  });
  it("does not declare success when readback disagrees and retries GET without rebinding", async () => {
    const { form, api, fill } = fixture(); await form.load(); fill();
    await form.submit(); expect(form.state.phase).toBe("uncertain"); expect(api.bind).toHaveBeenCalledOnce();
    api.config.mockResolvedValue({ ...config, beneficiary }); await form.submit();
    expect(api.bind).toHaveBeenCalledOnce(); expect(form.state.phase).toBe("saved");
  });
  it("blocks concurrent calls and discards late responses after account switch", async () => {
    const { form, api, fill, switchUser } = fixture(); await form.load(); fill();
    let resolve!: (v: typeof beneficiary) => void;
    api.bind.mockImplementation(() => new Promise(done => { resolve = done; }));
    const first = form.submit(); await form.submit(); expect(api.bind).toHaveBeenCalledOnce();
    switchUser(); resolve(beneficiary); await first;
    expect(form.state.account).toBe(""); expect(form.state.config).toBe(null); expect(api.config).toHaveBeenCalledOnce();
  });
  it("failed config refresh cannot allow blind submission", async () => {
    const { form, api, fill } = fixture(); await form.load(); fill();
    api.config.mockRejectedValue(new Error("OFFLINE")); await form.load();
    expect(form.state.config).toBe(null); expect(form.canContinue()).toBe(false); expect(form.state.error).toBe("load");
  });
  it("cooldown blocks fresh binding even with no OTP requirement", async () => {
    const { form, api, fill } = fixture(); api.config.mockResolvedValue({ ...config, beneficiary }); await form.load(); fill();
    expect(form.canContinue()).toBe(false); await form.submit(); expect(api.bind).not.toHaveBeenCalled();
  });
  it("a definite rejection allows correction with a new key; leaving clears the entire draft", async () => {
    const { form, api, fill } = fixture(); await form.load(); fill();
    api.bind.mockRejectedValueOnce(new ApiError({ kind: "business", message: "BANK_BENEFICIARY_INVALID", code: 422 }));
    await form.submit(); expect(form.state.phase).toBe("details");
    api.config.mockResolvedValue({ ...config, beneficiary }); await form.submit();
    expect(api.bind.mock.calls[1][1]).not.toEqual(api.bind.mock.calls[0][1]);
    form.reset(); expect(form.state.account).toBe(""); expect(form.state.holder).toBe(""); expect(form.state.config).toBe(null);
  });
});
