// Device daily-yield single-source parity gate.
//
// The same per-SKU daily yield (USDT + NEX) is hand-duplicated across FOUR
// sources, with nothing deriving one from another:
//   1. src/store/device-types.ts   DEVICE_SPECS[kind].baseRate / baseRateNEX
//        → drives the live earning fleet — what the user ACTUALLY earns (delivered)
//   2. src/mock/products.ts         PRODUCTS[id].dailyEarn / dailyEarnNEX
//        → drives the store card + detail page — what is ADVERTISED
//   3. src/i18n/messages/{en,zh}.ts vsNexPerDay / vsS1NexPerDay
//        → VsPhoneHero NEX sublines (hardcoded copy, phone + S1)
//   4. src/store/trial-config.ts    shadowDailyUSD / shadowDailyNEX
//        → free-trial shadow accrual — what the trial ADVERTISES it earns
//          (must equal the trialProductId device baseline, currently S1 7/40)
//
// On 2026-06-18 these drifted (phone 2≠10, Cloud 1≠3, Pro v2 14.5/100≠14/90):
// advertised ≠ delivered — a silent "宣传≠实发" trust bug that NONE of the 22
// existing verify sentinels caught (it was fixed only by manual回源). This gate
// asserts the three agree so the class can't recur unnoticed.
//
// It enforces INTERNAL consistency only. The authoritative values live in
// PRD §7.1/§13.3 (phone 10 / Cloud 3 / S1 40 / Pro 80 / Pro v2 14·90 / Rack
// P1 300 / Rack P2 500). Optional argv[2] = root override (negative-probe / CI).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2] || join(SELF_DIR, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const dt = read("src/store/device-types.ts");
const pr = read("src/mock/products.ts");
const en = read("src/i18n/messages/en.ts");
const zh = read("src/i18n/messages/zh.ts");
const tc = read("src/store/trial-config.ts");

// SKUs shared between the device fleet and the store catalog (phone is
// device-only and checked via the i18n subline instead).
const SHARED = [
  "stellarbox-s1",
  "stellarbox-pro",
  "stellarbox-pro-v2",
  "stellarrack-p1",
  "stellarrack-p2",
  "cloud-share",
];
const errs = [];

// ── device specs: each kind is a single { … } line in DEVICE_SPECS ──
// `baseRate:` matches the USDT field, not `baseRateNEX:` (that has NEX before
// the colon). `["']?key["']?:` only matches the exact key (stellarbox-pro does
// NOT match inside stellarbox-pro-v2 — the `-v2` breaks the `["']?:` tail).
function deviceSpec(kind) {
  const m = dt.match(new RegExp(`["']?${kind}["']?:\\s*\\{([^}]*)\\}`));
  if (!m) {
    errs.push(`device-types: spec for "${kind}" not found (renamed?)`);
    return null;
  }
  const rate = m[1].match(/baseRate:\s*([0-9.]+)/);
  const nex = m[1].match(/baseRateNEX:\s*([0-9.]+)/);
  return { rate: rate ? +rate[1] : NaN, nex: nex ? +nex[1] : NaN };
}

// ── products: array of multi-line objects (nested `ai: {}`), so slice per id
// and extract the two fields from that bounded window. The id literal carries
// its closing quote so "stellarbox-pro" won't match "stellarbox-pro-v2". ──
function productSpec(id) {
  const start = pr.indexOf(`id: "${id}"`);
  if (start < 0) {
    errs.push(`products: "${id}" not found (renamed?)`);
    return null;
  }
  const next = pr.indexOf(`id: "`, start + 5);
  const body = pr.slice(start, next < 0 ? undefined : next);
  const rate = body.match(/dailyEarn:\s*([0-9.]+)/);
  const nex = body.match(/dailyEarnNEX:\s*([0-9.]+)/);
  return { rate: rate ? +rate[1] : NaN, nex: nex ? +nex[1] : NaN };
}

for (const id of SHARED) {
  const d = deviceSpec(id);
  const p = productSpec(id);
  if (!d || !p) continue;
  if (d.rate !== p.rate) errs.push(`${id}: USDT/day device ${d.rate} ≠ product ${p.rate}`);
  if (d.nex !== p.nex) errs.push(`${id}: NEX/day device ${d.nex} ≠ product ${p.nex}`);
}

// ── i18n VsPhoneHero NEX sublines vs device baseRateNEX (phone + S1) ──
const phone = deviceSpec("phone");
const s1 = deviceSpec("stellarbox-s1");
const i18nNum = (src, key) => {
  const m = src.match(new RegExp(`${key}:\\s*"\\+?\\s*([0-9.]+)`));
  return m ? +m[1] : NaN;
};
for (const [label, src] of [["en", en], ["zh", zh]]) {
  if (phone) {
    const v = i18nNum(src, "vsNexPerDay");
    if (v !== phone.nex) errs.push(`i18n ${label}: vsNexPerDay ${v} ≠ phone baseRateNEX ${phone.nex}`);
  }
  if (s1) {
    const v = i18nNum(src, "vsS1NexPerDay");
    if (v !== s1.nex) errs.push(`i18n ${label}: vsS1NexPerDay ${v} ≠ S1 baseRateNEX ${s1.nex}`);
  }
}

// ── trial shadow accrual vs its trialProductId device baseline ──
// Parse from DEFAULT_TRIAL_CONFIG (the interface block declares `: number` /
// `: "stellarbox-s1"` types, no concrete digits, so the numeric regexes only
// hit the default object anyway — slicing keeps trialProductId unambiguous).
const def = tc.slice(Math.max(0, tc.indexOf("DEFAULT_TRIAL_CONFIG")));
const trialId = (def.match(/trialProductId:\s*"([^"]+)"/) || [])[1];
const shadowUSD = (def.match(/shadowDailyUSD:\s*([0-9.]+)/) || [])[1];
const shadowNEX = (def.match(/shadowDailyNEX:\s*([0-9.]+)/) || [])[1];
if (!trialId || shadowUSD === undefined || shadowNEX === undefined) {
  errs.push("trial-config: trialProductId / shadowDailyUSD / shadowDailyNEX not found (renamed?)");
} else {
  const td = deviceSpec(trialId);
  if (td) {
    if (+shadowUSD !== td.rate) errs.push(`trial-config: shadowDailyUSD ${+shadowUSD} ≠ ${trialId} baseRate ${td.rate}`);
    if (+shadowNEX !== td.nex) errs.push(`trial-config: shadowDailyNEX ${+shadowNEX} ≠ ${trialId} baseRateNEX ${td.nex}`);
  }
}

if (errs.length) {
  console.error("device-yield parity FAIL (advertised ≠ delivered drift):\n  " + errs.join("\n  "));
  process.exit(1);
}
console.log(
  `device-yield parity OK (${SHARED.length} SKUs × USDT+NEX + i18n phone/S1 sublines en+zh + trial shadow vs ${trialId})`,
);
