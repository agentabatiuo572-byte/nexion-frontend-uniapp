import { describe, expect, it } from "vitest";

const source = (import.meta.glob("./leaderboard.vue", {
  query: "?raw", import: "default", eager: true,
})["./leaderboard.vue"] ?? "") as string;

describe("leaderboard paging and keyboard contract", () => {
  it("loads concrete server pages instead of truncating the first 100 rows", () => {
    expect(source).toContain("teamInsightsApi.leaderboard(requestedPeriod, page, PAGE_SIZE,");
    expect(source).toContain("append ? remoteSnapshot.value?.snapshotAt : null");
    expect(source).toContain("rows.value.length < (remoteSnapshot.value?.totalRows ?? 0)");
    expect(source).toContain("rows: [...previous.rows, ...snapshot.rows]");
  });

  it("keeps tabs and click targets keyboard operable", () => {
    expect(source).toContain('role="tablist"');
    expect(source).toContain('role="tab"');
    expect(source).toContain('@keydown.left.prevent="movePeriod(-1)"');
    expect(source).toContain('@keydown.right.prevent="movePeriod(1)"');
    expect(source).toContain('@keydown.space.prevent="loadMore"');
    expect(source).toContain('@keydown.space.prevent="loadRemote()"');
  });
});
