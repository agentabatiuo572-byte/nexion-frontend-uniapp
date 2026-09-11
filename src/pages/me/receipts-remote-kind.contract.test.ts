import { describe, expect, it } from "vitest";
import receiptsPageSource from "./receipts.vue?raw";

describe("remote receipt category isolation", () => {
  it("shows only the selected category's rows, loading state, empty state, and pagination", () => {
    expect(receiptsPageSource).toContain('const remoteReceiptLoading = computed(() => remoteReceiptKind.value === "compute"');
    expect(receiptsPageSource).toContain('const remoteReceiptItems = computed(() => remoteReceiptKind.value === "compute"');
    expect(receiptsPageSource).toContain('const showRemoteReceiptInitialError = computed(() => remoteReceiptInitialStatus.value === "error"');
    expect(receiptsPageSource).toContain('const remoteReceiptHasMore = computed(() => remoteReceiptKind.value === "compute"');
    expect(receiptsPageSource).toContain('v-if="remoteReceiptHasMore"');
    expect(receiptsPageSource).toContain("if (!append) {");
    expect(receiptsPageSource).toContain("remoteComputeInitialLoading.value = true");
    expect(receiptsPageSource).toContain("remoteComputeReceiptNextOffset.value = null");
    expect(receiptsPageSource).toContain("remoteComputeReceiptNextCursor.value = null");
    expect(receiptsPageSource).toContain("canLoadRemoteComputeMore");
    expect(receiptsPageSource).toContain("page.nextCursor");
  });

  it("does not label a top-up-only page as Proof of Compute", () => {
    expect(receiptsPageSource).toContain('const remoteReceiptTitle = computed(() => remoteReceiptKind.value === "compute"');
    expect(receiptsPageSource).toContain("t.value.receipt.depositTitle");
    expect(receiptsPageSource).toContain("t.value.receipt.depositEmptyTitle");
  });
});
