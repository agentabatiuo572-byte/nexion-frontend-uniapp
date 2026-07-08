/**
 * Sponsor pool — shared between /ref/[code] landing and /register sponsor
 * confirmation card. Picks a stable sponsor for any given referral code
 * via a tiny hash so the same shared link always shows the same sponsor.
 */

export interface SponsorMeta {
  name: string;
  vRank: number;
  title: string;
  city: string;
  downlines: number;
}

const SPONSORS: SponsorMeta[] = [
  { name: "Sarah K.",  vRank: 5, title: "翼领",     city: "柏林",    downlines: 87 },
  { name: "Tom Wang",  vRank: 4, title: "指挥官",   city: "新加坡",  downlines: 42 },
  { name: "Lisa Park", vRank: 5, title: "翼领",     city: "首尔",    downlines: 124 },
  { name: "Carlos R.", vRank: 6, title: "中队长",   city: "马德里",  downlines: 268 },
  { name: "Yuki H.",   vRank: 4, title: "指挥官",   city: "东京",    downlines: 56 },
];

export function pickSponsor(code: string): SponsorMeta {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  return SPONSORS[h % SPONSORS.length];
}
