import { describe, expect, it } from "vitest";

const sources = import.meta.glob(["./genesis/*.vue", "./staking/*.vue"], {
  query: "?raw", import: "default", eager: true,
}) as Record<string, string>;
const read = (relative: string) => sources[relative] ?? "";

describe("dialog focus roots", () => {
  it.each([
    ["./genesis/eligibility-sheet.vue", "nx-elig-root"],
    ["./genesis/purchase-sheet.vue", "nx-genesis-purchase-root"],
    ["./staking/stake-sheet.vue", "nx-staking-sheet-root"],
  ])("keeps the backdrop and interactive panel inside %s", (file, root) => {
    const source = read(file);
    expect(source).toContain(`class="${root}" role="dialog" aria-modal="true"`);
    expect(source).toContain(`useDialogA11y(computed(() => props.open), ".${root}"`);
  });
});
