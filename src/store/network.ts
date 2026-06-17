import { defineStore } from "pinia";
import { ref } from "vue";
import type { VRank } from "./v-rank";

/**
 * Ported from Nexion-prototype/lib/v3/network.ts + network-seed.ts
 * (zustand → Pinia; seed inlined since uni has no separate module concern).
 * ⚠️ MOCK-ONLY influence-network graph. Production: GET /api/network/members
 * returns server-authoritative downline (PRD §4). Derivations (byBinary /
 * leftVolumeMonth / vDownlineCounts) are display-only previews.
 *
 * v3 玩法 — 影响力网络(7 层覆盖 + 双轨 Track A/B + 自动分配)。
 * 每个 member 占两维:layer 1-7(覆盖深度) + binary left|right(双轨脚位)。
 * isSpillover 标记系统空降(给上层"贵人感")。
 */

export type MemberStatus = "active" | "idle" | "offline";

export interface NetworkMember {
  id: string;
  name: string;
  avatar: string; // emoji or single char
  vRank: VRank;
  layer: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  binary: "left" | "right";
  isSpillover: boolean;
  joinedAt: number; // epoch ms
  monthVolumeUSD: number;
  totalVolumeUSD: number;
  status: MemberStatus;
  sponsorId?: string;
  city: string;
}

const ONE_DAY = 86400 * 1000;

const NAMES = [
  "Sarah K.", "Tom Wang", "Lisa Park", "Marina K.", "John R.",
  "David Liu", "Sara L.", "Priya N.", "Carlos R.", "Yuki H.",
  "Mehmet A.", "Lena F.", "Anh T.", "Diego P.", "Mila V.",
  "Hiro O.", "Nina K.", "Ravi S.", "Eva M.", "Kenji T.",
  "Olivia W.", "Lucas B.", "Sofia G.", "Ahmed Z.", "Maya J.",
  "Felix R.", "Aria H.", "Marco V.", "Zara K.", "Leo S.",
  "Ivy N.", "Ben C.", "Ella M.", "Owen T.", "Ruby L.",
  "Sam K.", "Tara W.", "Wu Jin", "Xena F.", "Yuna L.",
  "Zoe P.", "Akira H.", "Bo Chen", "Cora M.", "Dani G.",
  "Eli R.", "Fae L.", "Gus N.", "Hana W.", "Iris K.",
];

const CITIES = [
  "Berlin", "SF", "Tokyo", "Seoul", "Singapore", "London", "Bangkok",
  "Dubai", "Mumbai", "Shanghai", "Sydney", "Toronto", "Madrid", "Paris",
];

const EMOJIS = ["👨‍💻", "👩‍💻", "🧑‍🔬", "👨‍🎨", "👩‍🔧", "🧑‍✈", "🧑‍🚀"];

/** Build a member with stable pseudo-random values via index. */
function mk(
  i: number,
  layer: 1 | 2 | 3 | 4 | 5 | 6 | 7,
  binary: "left" | "right",
  opts: Partial<NetworkMember> = {},
): NetworkMember {
  const monthVol = opts.monthVolumeUSD ?? Math.floor(((i * 37) % 200) + 30);
  const totalVol = opts.totalVolumeUSD ?? monthVol * (1 + ((i * 17) % 6));
  return {
    id: `net-${i}`,
    name: NAMES[i % NAMES.length],
    avatar: EMOJIS[i % EMOJIS.length],
    vRank: opts.vRank ?? 0,
    layer,
    binary,
    isSpillover: opts.isSpillover ?? false,
    joinedAt: Date.now() - (((i * 11) % 90) + 1) * ONE_DAY,
    monthVolumeUSD: monthVol,
    totalVolumeUSD: totalVol,
    status: opts.status ?? (i % 5 === 0 ? "idle" : i % 11 === 0 ? "offline" : "active"),
    sponsorId: opts.sponsorId,
    city: CITIES[i % CITIES.length],
  };
}

const NETWORK_SEED: NetworkMember[] = [
  // L1 direct: 8 (3× V1)
  mk(0, 1, "left", { vRank: 1, monthVolumeUSD: 480, totalVolumeUSD: 1850 }),
  mk(1, 1, "left", { vRank: 1, monthVolumeUSD: 420, totalVolumeUSD: 1240 }),
  mk(2, 1, "right", { vRank: 1, monthVolumeUSD: 380, totalVolumeUSD: 980 }),
  mk(3, 1, "left", { vRank: 0, monthVolumeUSD: 180 }),
  mk(4, 1, "right", { vRank: 0, monthVolumeUSD: 240 }),
  mk(5, 1, "right", { vRank: 0, monthVolumeUSD: 0, status: "offline" }),
  mk(6, 1, "left", { vRank: 0, monthVolumeUSD: 90 }),
  mk(7, 1, "right", { vRank: 0, isSpillover: true, monthVolumeUSD: 60 }),

  // L2: 12
  ...Array.from({ length: 12 }).map((_, k) =>
    mk(8 + k, 2, k % 2 === 0 ? "left" : "right", {
      vRank: k < 2 ? 1 : 0,
      monthVolumeUSD: 80 + k * 25,
    }),
  ),

  // L3: 10
  ...Array.from({ length: 10 }).map((_, k) =>
    mk(20 + k, 3, k % 2 === 0 ? "left" : "right", { monthVolumeUSD: 50 + k * 15 }),
  ),

  // L4: 8
  ...Array.from({ length: 8 }).map((_, k) =>
    mk(30 + k, 4, k % 2 === 0 ? "left" : "right", { monthVolumeUSD: 40 + k * 12 }),
  ),

  // L5: 6
  ...Array.from({ length: 6 }).map((_, k) =>
    mk(38 + k, 5, k % 2 === 0 ? "left" : "right", { monthVolumeUSD: 30 + k * 10 }),
  ),

  // L6: 4
  ...Array.from({ length: 4 }).map((_, k) =>
    mk(44 + k, 6, k % 2 === 0 ? "left" : "right", { monthVolumeUSD: 20 + k * 8 }),
  ),

  // L7: 2 (deepest)
  mk(48, 7, "left", { monthVolumeUSD: 15 }),
  mk(49, 7, "right", { monthVolumeUSD: 12 }),
];

type ByLayer = Record<1 | 2 | 3 | 4 | 5 | 6 | 7, NetworkMember[]>;

export const useNetwork = defineStore("network", () => {
  const members = ref<NetworkMember[]>([...NETWORK_SEED]);
  const totalMembers = ref(NETWORK_SEED.length);
  const totalMonthVolumeUSD = ref(NETWORK_SEED.reduce((s, m) => s + m.monthVolumeUSD, 0));
  const totalAllTimeVolumeUSD = ref(NETWORK_SEED.reduce((s, m) => s + m.totalVolumeUSD, 0));

  function byLayer(): ByLayer {
    const buckets: Record<number, NetworkMember[]> = {
      1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [],
    };
    for (const m of members.value) buckets[m.layer].push(m);
    return buckets as ByLayer;
  }

  function byBinary(): { left: NetworkMember[]; right: NetworkMember[] } {
    const left: NetworkMember[] = [];
    const right: NetworkMember[] = [];
    for (const m of members.value) {
      if (m.binary === "left") left.push(m);
      else right.push(m);
    }
    return { left, right };
  }

  function leftVolumeMonth() {
    return members.value
      .filter((m) => m.binary === "left")
      .reduce((s, m) => s + m.monthVolumeUSD, 0);
  }
  function rightVolumeMonth() {
    return members.value
      .filter((m) => m.binary === "right")
      .reduce((s, m) => s + m.monthVolumeUSD, 0);
  }

  function binaryMatchToday() {
    const L = leftVolumeMonth() / 30;
    const R = rightVolumeMonth() / 30;
    const match = Math.min(L, R) * 0.1;
    return Math.min(match, 5000);
  }

  function vDownlineCounts(): Partial<Record<VRank, number>> {
    const counts: Partial<Record<VRank, number>> = {};
    for (const m of members.value) {
      counts[m.vRank] = (counts[m.vRank] ?? 0) + 1;
    }
    return counts;
  }

  function addSpillover(n: number) {
    const now = Date.now();
    const newMembers: NetworkMember[] = Array.from({ length: n }).map((_, i) => ({
      id: `spillover-${now}-${i}`,
      name: `Spillover #${totalMembers.value + i + 1}`,
      avatar: "🪂",
      vRank: 0 as VRank,
      layer: 1,
      binary: "right",
      isSpillover: true,
      joinedAt: now - i * 60000,
      monthVolumeUSD: 0,
      totalVolumeUSD: 0,
      status: "active",
      city: "Auto-placed",
    }));
    members.value = [...members.value, ...newMembers];
    totalMembers.value = totalMembers.value + n;
  }

  return {
    members, totalMembers, totalMonthVolumeUSD, totalAllTimeVolumeUSD,
    byLayer, byBinary, leftVolumeMonth, rightVolumeMonth,
    binaryMatchToday, vDownlineCounts, addSpillover,
  };
});
