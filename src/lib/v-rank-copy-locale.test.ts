import { describe, expect, it } from "vitest";
import { rankLabel, rankName } from "./v-rank-copy";
import type { VRankDef } from "@/store/v-rank";

const published = [
  ["注册会员", "Registered Member", "Thành viên đã đăng ký"],
  ["活跃新星", "Rising Star", "Ngôi sao mới"],
  ["团队达人", "Team Expert", "Chuyên gia đội nhóm"],
  ["一星大使", "One-Star Ambassador", "Đại sứ 1 sao"],
  ["二星大使", "Two-Star Ambassador", "Đại sứ 2 sao"],
  ["三星大使", "Three-Star Ambassador", "Đại sứ 3 sao"],
  ["四星大使", "Four-Star Ambassador", "Đại sứ 4 sao"],
  ["五星大使", "Five-Star Ambassador", "Đại sứ 5 sao"],
  ["资深领袖", "Senior Leader", "Lãnh đạo kỳ cựu"],
  ["钻石领袖", "Diamond Leader", "Lãnh đạo Kim cương"],
  ["皇冠领袖", "Crown Leader", "Lãnh đạo Vương miện"],
  ["传奇大使", "Legendary Ambassador", "Đại sứ huyền thoại"],
  ["名誉董事", "Honorary Director", "Thành viên HĐQT danh dự"],
] as const;

describe("canonical V-rank title locale", () => {
  it("translates every published F1 name while preserving the server rank", () => {
    const ladder = published.map(([zh]) => ({ title: zh, cnTitle: zh })) as VRankDef[];
    published.forEach(([zh, en, vi], v) => {
      expect(rankLabel(v, "zh", ladder)).toBe(`V${v} ${zh}`);
      expect(rankLabel(v, "en", ladder)).toBe(`V${v} ${en}`);
      expect(rankLabel(v, "vi", ladder)).toBe(`V${v} ${vi}`);
    });
  });

  it("prefers a non-Chinese server title and does not guess custom Chinese titles", () => {
    expect(rankName({ title: "Server Rank", cnTitle: "运营自定义" }, "en")).toBe("Server Rank");
    expect(rankName({ title: "Server Rank", cnTitle: "运营自定义" }, "vi")).toBe("Server Rank");
    expect(rankName({ title: "Server Rank", cnTitle: "注册会员" }, "en")).toBe("Server Rank");
    expect(rankName({ title: "Server Rank", cnTitle: "注册会员" }, "vi")).toBe("Thành viên đã đăng ký");
    expect(rankName({ title: "运营自定义", cnTitle: "运营自定义" }, "zh")).toBe("运营自定义");
    expect(rankLabel(0, "en", [{ title: "运营自定义", cnTitle: "运营自定义" } as VRankDef])).toBe("V0");
    expect(rankLabel(0, "vi", [{ title: "运营自定义", cnTitle: "运营自定义" } as VRankDef])).toBe("V0");
  });
});
