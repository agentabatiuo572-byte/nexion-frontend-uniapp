import { describe, expect, it } from "vitest";

const sources = import.meta.glob([
  "./me/device-deactivate-sheet.vue",
  "./me/theme-picker-sheet.vue",
  "./me/nickname-sheet.vue",
  "./me/receipt-modal.vue",
  "./slot-action-sheet.vue",
  "./tradein-sheets.vue",
  "./me/theme-row.vue",
  "../pages/me/wallet-withdraw.vue",
], { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const read = (relative: string) => sources[relative] ?? "";

describe("accessibility remediation contracts", () => {
  it.each([
    ["./me/device-deactivate-sheet.vue", "nx-device-deactivate-root", "props.device !== null"],
    ["./me/theme-picker-sheet.vue", "nx-theme-picker-root", "props.open"],
    ["./me/nickname-sheet.vue", "nx-nickname-sheet-root", "props.open"],
    ["./me/receipt-modal.vue", "nx-receipt-modal-root", "props.receipt !== null"],
  ])("makes %s a named, focus-trapped dialog", (file, root, openExpression) => {
    const source = read(file);
    expect(source).toContain(`class=\"${root}\" role=\"dialog\" aria-modal=\"true\"`);
    expect(source).toContain(`useDialogA11y(computed(() => ${openExpression}), \".${root}\"`);
  });

  it("keeps sheet actions keyboard-operable and blocks insufficient replacement", () => {
    expect(read("./slot-action-sheet.vue")).toContain('class="sas-close" role="button" tabindex="0"');
    const tradein = read("./tradein-sheets.vue");
    expect(tradein).toContain(':aria-disabled="replaceView.insufficient ? \'true\' : \'false\'"');
    expect(tradein).toContain('if (replaceView.value?.insufficient) return;');
    expect(tradein).toContain('class="tis-close" role="button" tabindex="0"');
  });

  it("preserves a single keyboard focus stop for theme and withdrawal radio groups", () => {
    const themeRow = read("./me/theme-row.vue");
    expect(themeRow).toContain('data-theme-mode="light"');
    expect(themeRow).toContain('nextTick(() =>');
    const withdraw = read("../pages/me/wallet-withdraw.vue");
    expect(withdraw).toContain('nx-withdraw-network-radio');
    expect(withdraw).toContain('@keydown.left.prevent="moveNetwork(-1)"');
    expect(withdraw).toContain('function moveNetwork(delta: number)');
  });
});
