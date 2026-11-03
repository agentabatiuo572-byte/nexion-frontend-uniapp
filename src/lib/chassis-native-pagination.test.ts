import { afterEach, expect, it, vi } from "vitest";
import { mountChassis } from "./liquid-glass-view";

afterEach(() => vi.unstubAllGlobals());

it("bridges one real downward gesture per page, fencing hidden views and replaced list keys", async () => {
  const listeners = new Map<string, Set<EventListener>>();
  const scroll = {
    scrollTop: 0, scrollHeight: 1000, clientHeight: 200,
    addEventListener(name: string, listener: EventListener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(listener);
    },
    removeEventListener(name: string, listener: EventListener) { listeners.get(name)?.delete(listener); },
  };
  const fire = (name: string, fields = {}) => {
    for (const listener of listeners.get(name) ?? []) listener(fields as Event);
  };
  const root = { dataset: {} as Record<string, string>, querySelector: () => scroll, querySelectorAll: () => [] };
  const notify = vi.fn();
  const controller = mountChassis(root as unknown as HTMLElement, { scrollKey: "visit-1:usdt" }, notify);
  const move = (top: number) => { scroll.scrollTop = top; fire("scroll"); };
  const swipe = () => { fire("touchstart", { touches: [{ clientY: 500 }] }); fire("touchmove", { touches: [{ clientY: 100 }] }); };

  move(710); // Restored scroll cannot load a page.
  expect(notify).not.toHaveBeenCalled();
  swipe(); move(720);
  expect(notify).toHaveBeenCalledExactlyOnceWith("visit-1:usdt");
  await Promise.resolve(); await Promise.resolve();
  fire("touchmove", { touches: [{ clientY: 50 }] });
  move(730); // Momentum and layout changes cannot drain the next page.
  expect(notify).toHaveBeenCalledTimes(1);

  swipe();
  controller.update({ scrollKey: "visit-1:uvt" });
  move(740); // An old asset/account gesture cannot cross a list reset.
  expect(notify).toHaveBeenCalledTimes(1);
  swipe(); move(750);
  expect(notify).toHaveBeenLastCalledWith("visit-1:uvt");
  await Promise.resolve(); await Promise.resolve();

  root.dataset.pageVisible = "false";
  controller.update({ visible: false, scrollKey: "visit-2:uvt" });
  swipe(); move(760);
  expect(notify).toHaveBeenCalledTimes(2);
  root.dataset.pageVisible = "true";
  controller.update({ visible: true, scrollKey: "visit-3:uvt" });
  move(770);
  expect(notify).toHaveBeenCalledTimes(2);
  swipe(); move(780);
  expect(notify).toHaveBeenLastCalledWith("visit-3:uvt");
  controller.destroy();
  swipe(); move(790);
  expect(notify).toHaveBeenCalledTimes(3);
});
