import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import ts from "typescript";
import source from "./wallet-exchange-how.vue?raw";

const script = source.split('<script setup lang="ts">')[1].split("</script>")[0];
const code = script.slice(script.indexOf("const exchangeAvailable ="), script.indexOf("function goBack"));

function mount(fetchCaps: () => Promise<{ swapEnabled: boolean }>) {
  let show!: () => void;
  let unmount!: () => void;
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const page = new Function("ref", "remoteApiEnabled", "exchangeApi", "onShow", "onUnmounted",
    `${js}; return { exchangeAvailable, exchangeLoading, loadExchangeCaps };`)(
      ref, true, { fetchCaps }, (callback: () => void) => { show = callback; },
      (callback: () => void) => { unmount = callback; },
    ) as {
      exchangeAvailable: { value: boolean | null };
      exchangeLoading: { value: boolean };
      loadExchangeCaps: () => Promise<void>;
    };
  return { page, show: () => show(), unmount: () => unmount() };
}

describe("exchange guide availability", () => {
  it("shows published instructions only after the current server caps enable swaps", async () => {
    expect(source).toContain('remoteApiEnabled && exchangeAvailable === true');
    const fetchCaps = vi.fn().mockResolvedValueOnce({ swapEnabled: false }).mockResolvedValueOnce({ swapEnabled: true });
    const { page, show } = mount(fetchCaps);
    show();
    await Promise.resolve();
    expect(page.exchangeAvailable.value).toBe(false);
    show();
    expect(page.exchangeAvailable.value).toBeNull();
    await Promise.resolve();
    expect(page.exchangeAvailable.value).toBe(true);
  });

  it("keeps failed and superseded reads unknown instead of showing submission advice", async () => {
    let resolveOld!: (value: { swapEnabled: boolean }) => void;
    const old = new Promise<{ swapEnabled: boolean }>((resolve) => { resolveOld = resolve; });
    const fetchCaps = vi.fn().mockReturnValueOnce(old).mockRejectedValueOnce(new Error("offline"));
    const { page, show, unmount } = mount(fetchCaps);
    show();
    await page.loadExchangeCaps();
    resolveOld({ swapEnabled: true });
    await old;
    expect(page.exchangeAvailable.value).toBeNull();
    expect(page.exchangeLoading.value).toBe(false);
    unmount();
  });
});
