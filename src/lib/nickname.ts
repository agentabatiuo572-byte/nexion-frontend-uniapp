// Nickname constructor — the only source of display names since the
// content-governance change (2026-07-15): free-text input was removed, so
// names can only be composed from these curated pools (violations are
// structurally impossible; no moderation pipeline needed).
// Real backend: GET /profile/nickname-candidates → string[] (same shape);
// this module is the mock stand-in (backend-replaceable).

// 与后端 UserNicknames 同一词库与格式：`{形容词} {名词} {后缀}`，后缀字母数字混合（不出现纯数字编号）。
// 词库刻意避开产品业务词(Node/Box/Rack/Share/Grid 等)、像官方的词(UVEL/Support/Nova)和金钱词。
const ADJECTIVES = [
  "Swift", "Cosmic", "Lunar", "Solar", "Stellar", "Astro", "Hyper", "Turbo",
  "Photon", "Quantum", "Nebula", "Zenith", "Vector", "Ember", "Atlas", "Radiant",
  "Polar", "Arctic", "Amber", "Azure", "Cobalt", "Crimson", "Silver", "Indigo",
  "Violet", "Scarlet", "Jade", "Onyx", "Neon", "Sonic", "Rapid", "Bold",
  "Brave", "Calm", "Clever", "Bright", "Silent", "Steady", "Nimble", "Agile",
  "Keen", "Vivid", "Misty", "Frosty", "Sunny", "Velvet", "Crystal", "Mellow",
];
const NOUNS = [
  "Rover", "Pilot", "Falcon", "Orbit", "Beacon", "Vertex", "Ranger", "Comet",
  "Spark", "Drift", "Harbor", "Summit", "Voyager", "Nomad", "Scout", "Sailor",
  "Glider", "Hawk", "Eagle", "Raven", "Fox", "Wolf", "Lynx", "Otter",
  "Panda", "Tiger", "Condor", "Heron", "Owl", "Phoenix", "Meteor", "Quasar",
  "Pulsar", "Galaxy", "Aurora", "Horizon", "Canyon", "River", "Forest", "Island",
  "Glacier", "Breeze", "Thunder", "Cascade", "Lantern", "Compass", "Anchor", "Arrow",
];
// 去掉 I/O/0/1，避免和别的字符看混。
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";

// 两位后缀：一个字母 + 一个数字，顺序由 letterFirst 决定。
function compose(adjIdx: number, nounIdx: number, letterIdx: number, digitIdx: number, letterFirst: boolean): string {
  const letter = LETTERS[letterIdx], digit = DIGITS[digitIdx];
  return `${ADJECTIVES[adjIdx]} ${NOUNS[nounIdx]} ${letterFirst ? letter + digit : digit + letter}`;
}

const pick = (n: number) => Math.floor(Math.random() * n);

export function generateNickname(): string {
  return compose(pick(ADJECTIVES.length), pick(NOUNS.length), pick(LETTERS.length), pick(DIGITS.length), Math.random() < 0.5);
}

/** 一批不重复候选（默认 6 个），供昵称选择 sheet 展示。 */
export function generateNicknameCandidates(count = 6): string[] {
  const seen = new Set<string>();
  while (seen.size < count) seen.add(generateNickname());
  return [...seen];
}

/** 账号 key 确定性派生默认昵称：同账号每次 hydrate 相同，不同账号大概率不同（真后端由服务端保证唯一）。 */
export function defaultNickname(accountKey: string): string {
  let h = 5381;
  for (let i = 0; i < accountKey.length; i++) h = (h * 33) ^ accountKey.charCodeAt(i);
  h = h >>> 0;
  // 全部用无符号移位:>> 会把 >2^31 的 hash 重新解释成负数 → 负索引出 undefined。
  return compose(h % ADJECTIVES.length, (h >>> 6) % NOUNS.length, (h >>> 12) % LETTERS.length,
    (h >>> 17) % DIGITS.length, ((h >>> 20) & 1) === 1);
}
