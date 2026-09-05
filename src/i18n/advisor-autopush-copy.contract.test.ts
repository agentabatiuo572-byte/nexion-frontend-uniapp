import { describe, expect, it } from "vitest";
import { en } from "./messages/en";
import { zh } from "./messages/zh";
import { vi } from "./messages/vi";

describe("advisor empty-state delivery claims", () => {
  it("does not promise a proactive advisor message before the executor exists", () => {
    expect(en.conversations.listEmptyAdvisor).not.toContain("will reach out");
    expect(zh.conversations.listEmptyAdvisor).toContain("尚未开放");
    expect(vi.conversations.listEmptyAdvisor).toContain("chưa khả dụng");
  });
});
