import { describe, expect, it } from "vitest";
import source from "./notifications.vue?raw";

describe("notification foreground and clear-read accessibility", () => {
  it("refreshes server notifications whenever the page returns to foreground", () => {
    expect(source).toContain('import { onShow, onHide } from "@dcloudio/uni-app"');
    expect(source).toMatch(/onShow\(\(\) => \{\s*if \(disposed\) return;\s*pageVisible = true;\s*void notifs.refreshRemote\(\);/);
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
    // 分类是**互斥**选择:必须暴露 radiogroup + 唯一 aria-checked + roving tabindex。
    // 原断言钉的是 role=button + aria-pressed,而浏览器把 aria-pressed 按钮当 toggle
    // button、读屏按复选框朗读 —— 用户以为能同时选多个分类(zentao #94)。判据改成
    // 单选语义,键盘可操作性(Enter/Space/方向键)一并守住。
    expect(source).toContain('role="radiogroup"');
    expect(source).toContain(':aria-label="t.notifs.filterGroupLabel"');
    expect(source).toContain('role="radio"');
    expect(source).toContain(':aria-checked="filter === id ? \'true\' : \'false\'"');
    expect(source).toContain(':tabindex="filter === id ? 0 : -1"');
    expect(source).toContain("@keydown.left.stop.prevent=\"moveFilter(-1)\"");
    expect(source).toContain("@keydown.right.stop.prevent=\"moveFilter(1)\"");
    expect(source).toContain('@keydown.enter.stop.prevent="filter = id"');
    expect(source).toContain('@keydown.space.stop.prevent="filter = id"');
    expect(source).not.toContain(':aria-pressed="filter === id"');
    expect(source).toContain('@keydown.enter.stop.prevent="notifs.retryRemote()"');
    expect(source).toContain('@keydown.space.stop.prevent="notifs.retryRemote()"');
    expect(source).toContain('@keydown.enter.stop.prevent="notifs.loadMoreRemote()"');
    expect(source).toContain('@keydown.space.stop.prevent="notifs.loadMoreRemote()"');
  });

  it("moves the roving focus over the same list it renders", () => {
    // 键盘按 filterIds 走、渲染按另一套判据走 → 焦点会落到没渲染的项上,roving
    // tabindex 随之丢失,整组再也进不去。两边必须共用 visibleFilterIds。
    expect(source).toContain("const visibleFilterIds = computed(");
    expect(source).toContain("v-for=\"id in visibleFilterIds\"");
    expect(source).toContain("const ids = visibleFilterIds.value;");
  });
});
