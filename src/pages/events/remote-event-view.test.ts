import { describe, expect, it } from "vitest";
import type { CanonicalEvent } from "@/api/events-api";
import {
  eventOpenTarget,
  shouldShowDecorativeAction,
  shouldShowJoinedProgressAction,
} from "@/components/events/event-open-target";
import { remoteEventView, type EventActionLabels } from "./remote-event-view";

const labels: EventActionLabels = {
  claimDiscount: "领取折扣",
  checkIn: "去打卡",
  reinvest: "去复投",
  spin: "立即抽奖",
  leaderboard: "查看排行",
  viewDetails: "查看详情",
};

function canonicalEvent(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    eventCode: "evt-1",
    kind: "boost",
    state: "ongoing",
    title: "Event",
    subtitle: "Event subtitle",
    rewardName: "Reward",
    rewardType: "NEX",
    rewardAmount: 10,
    featured: false,
    trackable: false,
    targetValue: 0,
    progressValue: 0,
    userStatus: "AVAILABLE",
    geo: "",
    href: "/pages/store/store",
    startsAt: null,
    endsAt: null,
    ...overrides,
  };
}

describe("remoteEventView", () => {
  it.each([
    ["discount", "/pages/store/store", "领取折扣"],
    ["boost", "/pages/daily/daily", "去打卡"],
    ["boost", "/pages/me/wallet-repurchase", "去复投"],
    ["regional", "/pages/team/leaderboard", "查看排行"],
    ["seasonal", "/pages/store/store", "查看详情"],
  ] as const)("maps %s activity at %s to its business CTA", (kind, href, expectedLabel) => {
    const view = remoteEventView(canonicalEvent({ kind, href }), labels);

    expect(view.ctaLabel).toBe(expectedLabel);
    expect(view.href).toBe(href);
    expect(view.runtimeSource).toBe("remote");
  });

  it("keeps a wheel actionable even when the canonical event has no href", () => {
    const view = remoteEventView(canonicalEvent({ kind: "wheel", href: "" }), labels);

    expect(view.ctaLabel).toBe("立即抽奖");
    expect(view.href).toBeUndefined();
    expect(view.useHref).toBeUndefined();
  });

  it("does not render a dead decorative CTA when neither an href nor an in-app action exists", () => {
    const view = remoteEventView(canonicalEvent({ kind: "holding", href: "" }), labels);

    expect(view.ctaLabel).toBeUndefined();
    expect(view.href).toBeUndefined();
  });

  it("does not replace the join action label of a trackable event", () => {
    const view = remoteEventView(canonicalEvent({
      kind: "discount",
      trackable: true,
      targetValue: 3,
    }), labels);

    expect(view.ctaLabel).toBeUndefined();
    expect(view.href).toBe("/pages/store/store");
  });

  it("uses the canonical href after a claimed discount", () => {
    const view = remoteEventView(canonicalEvent({
      kind: "discount",
      userStatus: "CLAIMED",
      href: "/pages/store/store",
    }), labels);

    expect(view.useHref).toBe("/pages/store/store");
  });

  it("keeps the canonical business href after any claimed reward", () => {
    const view = remoteEventView(canonicalEvent({
      kind: "boost",
      userStatus: "CLAIMED",
      rewardType: "NEX",
      href: "/pages/daily/daily",
    }), labels);

    expect(view.useHref).toBe("/pages/daily/daily");
  });

  it.each(["NEX", "USDT"] as const)("does not invent a post-claim %s route when the business href is absent", (rewardType) => {
    const view = remoteEventView(canonicalEvent({
      trackable: true,
      userStatus: "CLAIMED",
      rewardType,
      href: "",
    }), labels);

    expect(view.useHref).toBeUndefined();
  });

  it("does not expose a post-claim link before the reward is claimed", () => {
    const view = remoteEventView(canonicalEvent({
      trackable: true,
      userStatus: "CLAIMABLE",
      href: "",
    }), labels);

    expect(view.useHref).toBeUndefined();
  });

  it("prefers a canonical href over a wheel's local sheet action", () => {
    expect(eventOpenTarget({ kind: "wheel", href: "/pages/store/store" })).toEqual({
      type: "route",
      href: "/pages/store/store",
    });
  });

  it("uses the local sheet only when a wheel has no canonical href", () => {
    expect(eventOpenTarget({ kind: "wheel" })).toEqual({ type: "local" });
    expect(eventOpenTarget({ kind: "discount", runtimeSource: "mock" })).toEqual({ type: "local" });
    expect(eventOpenTarget({ kind: "discount", runtimeSource: "remote" })).toBeNull();
    expect(eventOpenTarget({ kind: "wheel", trackable: true })).toBeNull();
    expect(eventOpenTarget({ kind: "discount", trackable: true, runtimeSource: "mock" })).toBeNull();
    expect(eventOpenTarget({ kind: "holding" })).toBeNull();
  });

  it("keeps claimed decorative events inert and allows only an actionable available row", () => {
    expect(shouldShowDecorativeAction({
      kind: "wheel",
      status: "ongoing",
      ctaLabel: "立即抽奖",
      _trackable: false,
      _claimed: true,
    })).toBe(false);
    expect(shouldShowDecorativeAction({
      kind: "discount",
      status: "ongoing",
      ctaLabel: "领取折扣",
      runtimeSource: "remote",
      _trackable: false,
      _claimed: false,
    })).toBe(false);
    expect(shouldShowDecorativeAction({
      kind: "discount",
      status: "ongoing",
      ctaLabel: "领取折扣",
      runtimeSource: "mock",
      _trackable: false,
      _claimed: false,
    })).toBe(true);
  });

  it("hides joined progress when a trackable event has no actionable target", () => {
    expect(shouldShowJoinedProgressAction({
      kind: "holding",
      trackable: true,
      joined: true,
      _trackable: true,
      _done: false,
    })).toBe(false);
    expect(shouldShowJoinedProgressAction({
      kind: "holding",
      href: "/pages/store/store",
      trackable: true,
      joined: true,
      _trackable: true,
      _done: false,
    })).toBe(true);
  });
});
