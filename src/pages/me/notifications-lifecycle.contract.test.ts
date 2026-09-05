import { describe, expect, it } from "vitest";
import source from "./notifications.vue?raw";

describe("notification foreground and clear-read accessibility", () => {
  it("refreshes server notifications whenever the page returns to foreground", () => {
    expect(source).toContain('import { onShow } from "@dcloudio/uni-app"');
    expect(source).toContain("onShow(() => { void notifs.refreshRemote(); });");
  });

  it("gives the clear-read action an accessible label, 44px target, and confirmation", () => {
    expect(source).toContain(':aria-label="t.notifs.clearReadAria"');
    expect(source).toContain("height: \"44px\"");
    expect(source).toContain("await uiConfirm({");
    expect(source).toContain("notifs.clearRead()");
  });

  it("keeps mark-all and notification rows keyboard-operable", () => {
    expect(source).toContain(':aria-label="t.notifs.markAll"');
    expect(source).toContain('@keydown.enter.stop.prevent="notifs.markAllRead()"');
    expect(source).toContain('@keydown.space.stop.prevent="notifs.markAllRead()"');
    expect(source).toContain('@keydown.enter.stop.prevent="onTap(n)"');
    expect(source).toContain('@keydown.space.stop.prevent="onTap(n)"');
  });

  it("keeps filters, retry, and pagination keyboard-operable", () => {
    expect(source).toContain(':aria-pressed="filter === id"');
    expect(source).toContain('@keydown.enter.stop.prevent="filter = id"');
    expect(source).toContain('@keydown.space.stop.prevent="filter = id"');
    expect(source).toContain('@keydown.enter.stop.prevent="notifs.retryRemote()"');
    expect(source).toContain('@keydown.space.stop.prevent="notifs.retryRemote()"');
    expect(source).toContain('@keydown.enter.stop.prevent="notifs.loadMoreRemote()"');
    expect(source).toContain('@keydown.space.stop.prevent="notifs.loadMoreRemote()"');
  });
});
