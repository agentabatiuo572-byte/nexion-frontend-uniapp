#!/usr/bin/env bash
# NexGrid uni-app port verifier — the "自测" stage of the nexgrid-uniapp-port loop.
#
# Usage: bash scripts/verify.sh [module]     # default: all
#   BASE_URL overrides the H5 dev origin (default http://localhost:5173).
#
# Checks:
#   (1) vue-tsc type-check (whole project, must be 0 errors)
#   (2) H5 routes return HTTP 200 (dev server must be running)
#   (3) grep sentinels over src/ — React residue + reverse-ed/meta words +
#       hardcoded hex (token discipline)
#
# NOTE on rendered needles: uni H5 is a CSR SPA, so `curl` returns the empty
# app shell — it CANNOT see rendered text. Per-page content assertions belong
# in the browser self-check (Playwright evaluate), not here. This script
# verifies compile + routing + source hygiene; the skill's review stage owns
# rendered-DOM verification.

set -u
MODULE="${1:-all}"
BASE_URL="${BASE_URL:-http://localhost:5173}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

G='\033[0;32m'; R='\033[0;31m'; Y='\033[1;33m'; C='\033[0;36m'; N='\033[0m'
pass=0; fail=0
CURL_BIN="${CURL_BIN:-curl}"
if [ -f /proc/version ] && grep -qi microsoft /proc/version && command -v curl.exe >/dev/null 2>&1; then
  CURL_BIN="curl.exe"
fi
NODE_BIN="${NODE_BIN:-node}"
if ! command -v "$NODE_BIN" >/dev/null 2>&1 && command -v node.exe >/dev/null 2>&1; then
  NODE_BIN="node.exe"
fi

ok()   { printf "  ${G}PASS${N}  %s\n" "$1"; pass=$((pass+1)); }
bad()  { printf "  ${R}FAIL${N}  %s\n" "$1"; fail=$((fail+1)); }

check_http() {
  local label="$1" route="$2"
  local code
  code=$("$CURL_BIN" -s -o /dev/null -w "%{http_code}" "$BASE_URL$route" 2>/dev/null)
  if [ "$code" = "200" ]; then ok "$label [$code] $route"; else bad "$label [$code] $route"; fi
}

# grep sentinel: FAIL if pattern is found in src (excluding allowed paths)
sentinel_absent() {
  local label="$1" pattern="$2"
  local hits
  hits=$(grep -rEnI "$pattern" src 2>/dev/null | grep -vE '(\.d\.ts|/i18n/messages/|/styles/tokens\.css)' | head -5)
  if [ -z "$hits" ]; then ok "$label (0 hits)"; else bad "$label"; echo "$hits" | sed 's/^/        /'; fi
}

# grep sentinel: FAIL if pattern is ABSENT from a specific file (presence assertion)
sentinel_present() {
  local label="$1" file="$2" pattern="$3"
  if grep -qE "$pattern" "$file" 2>/dev/null; then ok "$label"; else bad "$label (missing /$pattern/ in $file)"; fi
}

echo -e "${C}━━ NexGrid uni-app verify · module=$MODULE ━━${N}"

# ── (1) type-check ──
echo -e "${C}[1] vue-tsc type-check${N}"
if npx vue-tsc --noEmit >/tmp/uni-tsc.log 2>&1; then
  ok "vue-tsc 0 errors"
else
  bad "vue-tsc errors"; tail -15 /tmp/uni-tsc.log | sed 's/^/        /'
fi

echo -e "${C}[1.5] i18n mirror${N}"
if "$NODE_BIN" scripts/i18n-key-mirror.mjs >/tmp/uni-i18n-mirror.log 2>&1; then
  ok "$(cat /tmp/uni-i18n-mirror.log)"
else
  bad "i18n en/zh key mismatch"; head -20 /tmp/uni-i18n-mirror.log | sed 's/^/        /'
fi

# 入金/牌价/换绑三条资金纯逻辑自检此前只能手跑,等于资金常量没有机器门 ——
# 改费率/最低额/上限/容差不会红任何一条流水线(2026-07-27 audit 立案)。
echo -e "${C}[1.6] money selfchecks(deposits · fx · rebind)${N}"
for sc in deposits fx rebind; do
  if "$NODE_BIN" "scripts/selfcheck-$sc.mjs" >"/tmp/uni-selfcheck-$sc.log" 2>&1; then
    ok "selfcheck-$sc: $(grep -Eo '[0-9]+ pass / [0-9]+ fail' "/tmp/uni-selfcheck-$sc.log" | tail -1)"
  else
    bad "selfcheck-$sc 有断言失败"; grep -E "FAIL|fail" "/tmp/uni-selfcheck-$sc.log" | head -8 | sed 's/^/        /'
  fi
done

# ── (2) H5 routing (dev server must be up) ──
echo -e "${C}[2] H5 routes HTTP 200 (${BASE_URL})${N}"
if "$CURL_BIN" -s -o /dev/null -w "%{http_code}" "$BASE_URL/" 2>/dev/null | grep -q 200; then
  check_http "Home shell" "/"
  # Ported routes append here as Batch 1/2 land:
  # check_http "Earn" "/#/pages/earn/earn"
else
  printf "  ${Y}SKIP${N}  dev server not running at %s (run: npm run dev:h5)\n" "$BASE_URL"
fi

# ── (3) source hygiene sentinels ──
echo -e "${C}[3] grep sentinels over src/${N}"
# React residue (should never survive a .tsx → .vue port)
sentinel_absent "no className= (use class=)"      'className='
sentinel_absent "no React hooks (useState/useEffect)" '\b(useState|useEffect|useRef|useMemo)\s*\('
sentinel_absent "no framer-motion import"           'from .framer-motion|<motion\.'
sentinel_absent "no JSX self-close div/span"        '</(div|span|button)>'
# Bare-text-in-<view> (PITFALLS P-026): a `<view>` with a direct text/`{{ }}`
# child renders on H5 (uni-view tolerates text nodes) but NOT on App native →
# the copy silently vanishes. vue-tsc + curl-compile + H5 self-check all miss
# it. Direct text under <view> must be wrapped in <text>. (Single-line form;
# multi-line cases caught in review.)
sentinel_absent "no bare {{ }} directly in <view>"  '<view[^>]*>\{\{[^}]+\}\}</view>'
# Pinia setup-store discipline (PITFALLS P-017): an explicit return-type
# annotation on the setup fn — defineStore("x", (): SomeStore => …) — conflicts
# with Ref unwrapping (state typed as a plain value ≠ the returned Ref<T>) →
# TS2740. Setup stores must let Pinia infer the return (cf. market/profile).
sentinel_absent "no defineStore setup return annotation" 'defineStore\(.*\(\): *[A-Za-z_]'
# reverse-ed / meta language must never leak into the product
sentinel_absent "no meta/ponzi words"               '庞氏|割韭菜|杀猪盘|跑路|ponzi|scam|反向教育|揭穿|conversion quest|funnel'
# Funnel-meta vocabulary must not leak into user-facing i18n copy. The sentinel
# above EXCLUDES /i18n/messages/ (to tolerate currency "conversion" + the upsell
# namespace key), so copy-level funnel jargon was blind-spotted there. This gate
# scans the message files directly for unambiguous funnel compounds + a bare
# "转化" value (currency reads 兑换/exchange in copy) → zero false positives.
# (added 2026-06-22: 转化→推荐 task surfaced 3 user-facing leaks past the gate.)
i18n_meta=$(grep -rEnI '转化路径|转化门槛|转化率|转化漏斗|"转化"|conversion path|conversion gate|conversion funnel|conversion rate' src/i18n/messages 2>/dev/null | head -5)
if [ -z "$i18n_meta" ]; then ok "no funnel-meta in i18n copy (0 hits)"; else bad "funnel-meta leaked into i18n copy"; echo "$i18n_meta" | sed 's/^/        /'; fi
# copy hygiene: <text> renders raw — markdown tokens (**bold**, `code`) show as
# literal stars/backticks, and route-path literals violate the no-jargon rule.
# (added 2026-07-09: owner caught **直接版税** + `/team/binary` in how-page copy.)
i18n_md=$(grep -rEnI '\*\*[^*]+\*\*|`/[a-z]' src/i18n/messages 2>/dev/null | head -5)
if [ -z "$i18n_md" ]; then ok "no markdown residue in i18n copy (0 hits)"; else bad "markdown residue in i18n copy (** or \`/path\`)"; echo "$i18n_md" | sed 's/^/        /'; fi
# token discipline: no hardcoded v5 light hex in components (use var(--v5-*))
# 保留为「无豁免硬地板」:这 4 个是最核心的 token 值,任何形式都不许出现,连 allowlist 也不给。
# 全量覆盖(45 个 token × hex/rgb/rgba 三种写法 + 变 alpha 副本)由下面的 token_copy_gate 承担。
sentinel_absent "no hardcoded #0E48E6/#F4F1E9 hex"  '#0E48E6|#F4F1E9|#FF5A1F|#13141A'
# safe-area base padding (PITFALLS P-065): any padding that references
# env(safe-area-inset-bottom) must carry a base offset ≥22px — a bare env()
# (base 0) or a small base hugs the iOS home indicator. House baseline = 38px
# (bottom sheets); 22px floor admits the chat composer. Both operand orders +
# the env(…, 0px) fallback form are parsed.
sa_bad=$("$NODE_BIN" -e '
const fs=require("fs"),path=require("path");
const bad=[];
const re1=/(\d+(?:\.\d+)?)px\s*\+\s*env\(safe-area-inset-bottom(?:,[^)]*)?\)/;
const re2=/env\(safe-area-inset-bottom(?:,[^)]*)?\)\s*\+\s*(\d+(?:\.\d+)?)px/;
(function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);const s=fs.statSync(p);
if(s.isDirectory())walk(p);else if(/\.(vue|css)$/.test(f)){
fs.readFileSync(p,"utf8").split(/\r?\n/).forEach((ln,i)=>{
if(!ln.includes("safe-area-inset-bottom"))return;
const m=ln.match(re1)||ln.match(re2);
const base=m?parseFloat(m[1]):0;
if(base<22)bad.push(p.split(path.sep).join("/")+":"+(i+1)+" base="+base+"px");});}}})("src");
if(bad.length){console.log(bad.join("\n"));process.exit(1)}' 2>&1)
if [ -z "$sa_bad" ]; then ok "safe-area-inset-bottom base padding >=22px (P-065)"; else bad "safe-area base padding <22px (iOS home-indicator hug)"; echo "$sa_bad" | sed 's/^/        /'; fi
# Auth/onboarding bare pages must use one system-chrome owner. This catches the
# orthogonal failure where a new flow page looks fine but forgets the status bar,
# Home Indicator, or bottom safe-area reserve (P-069).
if "$NODE_BIN" <<'NODE' >/tmp/uni-auth-system-chrome.log 2>&1
const fs = require("fs");
const path = require("path");
const flowDirs = ["onboarding", "login", "register", "ref", "session"];
const pages = [];
for (const dir of flowDirs) {
  const root = path.join("src/pages", dir);
  const walk = (current) => {
    for (const name of fs.readdirSync(current)) {
      const file = path.join(current, name);
      if (fs.statSync(file).isDirectory()) walk(file);
      else if (name.endsWith(".vue")) pages.push(file.split(path.sep).join("/"));
    }
  };
  walk(root);
}
for (const file of pages) {
  const source = fs.readFileSync(file, "utf8");
  if (!/<StandalonePageShell\b/.test(source) || !/import StandalonePageShell from "@\/components\/device\/standalone-page-shell\.vue"/.test(source)) {
    throw new Error(`${file}: missing StandalonePageShell`);
  }
  if (!/data-system-chrome-primary/.test(source)) throw new Error(`${file}: missing runtime primary-control marker`);
}
const shell = fs.readFileSync("src/components/device/standalone-page-shell.vue", "utf8");
if (!/DeviceStatusBar/.test(shell) || !/DeviceHomeIndicator/.test(shell)) throw new Error("standalone shell chrome incomplete");
if (!/BOTTOM_SAFE_PADDING\s*=\s*"calc\(env\(safe-area-inset-bottom, 0px\) \+ 38px\)"/.test(shell)) throw new Error("standalone shell lost 38px bottom safe-area baseline");
if (!/paddingBottom:\s*props\.reserveBottom\s*\?\s*BOTTOM_SAFE_PADDING\s*:\s*"0px"/.test(shell)) throw new Error("standalone shell no longer applies its bottom safe-area baseline");
const chassis = fs.readFileSync("src/components/app-chassis.vue", "utf8");
if (!/<DeviceHomeIndicator\s*\/>/.test(chassis)) throw new Error("AppChassis no longer shares DeviceHomeIndicator");
const estimator = fs.readFileSync("src/pages/onboarding/estimator.vue", "utf8");
if (!/:top-inset="24"/.test(estimator) || !/\.est-cta\s*\{[\s\S]*?margin-right:\s*4px;[\s\S]*?margin-left:\s*4px;/.test(estimator)) {
  throw new Error("estimator CTA no longer aligns to register-success 24px side inset");
}
const success = fs.readFileSync("src/pages/register/success.vue", "utf8");
if (!/\.rs-footer\s*\{[^}]*padding-bottom:\s*calc\(env\(safe-area-inset-bottom, 0px\) \+ 38px\)/.test(success)) {
  throw new Error("register-success CTA lost 38px bottom baseline");
}
NODE
then
  ok "all bare login-entry pages share status bar + Home Indicator shell (P-069)"
else
  bad "bare login-entry system chrome contract"; sed 's/^/        /' /tmp/uni-auth-system-chrome.log
fi
if "$CURL_BIN" -s -o /dev/null -w "%{http_code}" "$BASE_URL/" 2>/dev/null | grep -q 200; then
  if BASE_URL="$BASE_URL" "$NODE_BIN" scripts/auth-system-chrome-runtime.mjs >/tmp/uni-auth-system-chrome-runtime.log 2>&1; then
    ok "bare login-entry system chrome runtime geometry (P-069)"
  else
    bad "bare login-entry system chrome runtime geometry"; sed 's/^/        /' /tmp/uni-auth-system-chrome-runtime.log
  fi
else
  printf "  ${Y}SKIP${N}  bare login-entry system chrome runtime geometry (dev server not running at %s)\n" "$BASE_URL"
fi
# ── SPEC-1 R7: factor reads device truth, never the viewing carrier ──
sentinel_present "SPEC-1 R7 online seam exported" src/lib/hashpower.ts 'export function isDeviceOnline'
sentinel_present "SPEC-1 R7 display/settle offline branch" src/lib/hashpower.ts '!input\.online'
sentinel_present "SPEC-1 R7 heartbeat typed" src/store/types.ts 'onlineHeartbeatAt'
sentinel_present "SPEC-1 R7 heartbeat freshest-wins merge" src/store/account-cloud.ts '"onlineHeartbeatAt"'
sentinel_present "SPEC-1 R7 settle reads device online" src/store/app.ts 'isDeviceOnline\(d, now\)'
sentinel_present "SPEC-1 R7 App stamps heartbeat" src/store/app.ts 'onlineHeartbeatAt: now'
sentinel_present "SPEC-1 R7 home row uses true-online seam" src/components/home/device-row.vue 'isDeviceOnline\(props\.device, Date\.now\(\)\)'
sentinel_present "SPEC-1 R7 home slot uses true-online seam" src/components/home/device-slot.vue 'isDeviceOnline\(props\.device, Date\.now\(\)\)'
sentinel_present "SPEC-1 R7 me summary uses true-online seam" src/pages/me/me.vue 'isDeviceOnline\(device, Date\.now\(\)\)'
sentinel_present "SPEC-1 R7 legacy me card uses true-online seam" src/components/me/my-devices-entry.vue 'isDeviceOnline\(device, Date\.now\(\)\)'
sentinel_present "SPEC-1 R7 me summary binds label to true-online count" src/pages/me/me.vue 'onlineLabel.*n: onlineCount\.value'
sentinel_present "SPEC-1 R7 legacy me card binds label to true-online count" src/components/me/my-devices-entry.vue 'onlineLabel.*n: onlineCount\.value'
if grep -nE 'd\.status === "online"|props\.device\.status === "online"' \
  src/components/home/device-row.vue \
  src/components/home/device-slot.vue \
  src/components/earn/device-card-pc.vue \
  src/components/me/wallet-card.vue \
  src/components/me/my-devices-entry.vue \
  src/pages/me/me.vue \
  src/pages/me/proof.vue \
  src/pages/support/chat.vue \
  src/mock/nova-templates.ts >/tmp/uni-r7-ui-status.log 2>&1; then
  bad "SPEC-1 R7 user-facing online state bypasses heartbeat seam"; sed 's/^/        /' /tmp/uni-r7-ui-status.log
else
  ok "SPEC-1 R7 user-facing online state uses heartbeat seam"
fi
sentinel_present "wallet KYC reset UI is DEV-only" src/pages/me/wallet-withdraw.vue 'import\.meta\.env\.DEV && options\?\.dev === "1"'
sentinel_present "wallet KYC reset store has PROD guard" src/store/wallet-pairing.ts 'if \(import\.meta\.env\.PROD\) return'
if grep -qE '5-15%|5-15%' src/i18n/messages/en.ts src/i18n/messages/zh.ts 2>/dev/null; then
  bad "staking disclosure understates 180d/365d principal penalties"
else
  ok "staking disclosure includes canonical high-tier penalties"
fi
sentinel_present "staking risk disclosure EN names all four penalties" src/i18n/messages/en.ts '5% / 15% / 30% / 50% of principal'
sentinel_present "staking how-it-works EN maps all four penalties" src/i18n/messages/en.ts '5% \(30d\).*15% \(90d\).*30% \(180d\).*50% \(365d\)'
sentinel_present "staking risk disclosure ZH names all four penalties" src/i18n/messages/zh.ts '5% / 15% / 30% / 50% 本金'
sentinel_present "staking how-it-works ZH maps all four penalties" src/i18n/messages/zh.ts '30 天扣 5%.*90 天扣 15%.*180 天扣 30%.*365 天扣 50%'
if grep -qE 'simulation engine|simulated\. Real deployments|DEMO CONNECTION|Simulate linking|Simulate connection|模拟引擎|模拟生成|演示连接|模拟连接' src/i18n/messages/en.ts src/i18n/messages/zh.ts 2>/dev/null; then
  bad "user-facing copy exposes mock/simulation internals"
else
  ok "user-facing copy hides mock/simulation internals"
fi
if grep -qE 'mid-operation|运营中期' src/i18n/messages/en.ts src/i18n/messages/zh.ts 2>/dev/null; then
  bad "user-facing copy exposes internal product-phase labels"
else
  ok "user-facing copy hides internal product-phase labels"
fi
sentinel_present "daily sign-in atomic seam names canonical endpoint" src/pages/daily/daily.vue 'POST /api/faucet/sign-in'
sentinel_present "daily milestone atomic seam is honest TBD" src/pages/daily/daily.vue 'milestone-claim endpoint TBD'
sentinel_present "weekly quest atomic seam names canonical endpoint" src/components/home/weekly-quest-list.vue 'POST /api/quests/weekly/\{tier2/:id\}'
sentinel_present "weekly tier1 atomic seam names canonical endpoint" src/components/home/weekly-quest-hero.vue 'POST /api/quests/weekly/\{tier1\}'
sentinel_present "weekly bonus atomic seam names canonical endpoint" src/components/home/weekly-quest-list.vue 'POST /api/quests/weekly/\{bonus\}'
sentinel_present "event claim atomic seam is honest TBD" src/pages/events/events.vue 'event-claim endpoint TBD'
if grep -qE 'input\.carrier|carrier ===|getCarrier|from "@/lib/carrier"' src/lib/hashpower.ts 2>/dev/null; then
  bad "SPEC-1 R7 hashpower must not read/import view carrier"
else
  ok "SPEC-1 R7 hashpower reads device online, never view carrier"
fi
if grep -qE 'function settleDevice\([^)]*carrier' src/store/app.ts 2>/dev/null; then
  bad "SPEC-1 R7 settleDevice must not take carrier"
else
  ok "SPEC-1 R7 settleDevice factor is carrier-independent"
fi
if "$NODE_BIN" -e 'const s=require("fs").readFileSync("src/store/app.ts","utf8");const a=s.indexOf("export function settleDeviceBatch");const b=s.indexOf("const settled =",a);const c=s.indexOf("onlineHeartbeatAt: now",a);if(a<0||b<0||c<0||b>c)process.exit(1)' 2>/dev/null; then
  ok "SPEC-1 R7 stale gap settles before heartbeat refresh"
else
  bad "SPEC-1 R7 heartbeat refresh must happen after stale-gap settlement"
fi
sentinel_present "SPEC-1 hosted baseline present" src/lib/hashpower.ts 'H5_BASE_FACTOR'
sentinel_present "SPEC-1 carrier retained only as App heartbeat source" src/lib/carrier.ts '#ifdef APP-PLUS'
# settle-single-source: earnings accrue by WALL-CLOCK Δ via settleDevice (not tick-time / fixed window)
sentinel_present "SPEC-1 settle: settleDevice exists" src/store/app.ts 'function settleDevice'
sentinel_present "SPEC-1 settle: wall-clock lastSettledAt anchor" src/store/app.ts 'now - d\.lastSettledAt'
sentinel_present "SPEC-1 settle: Device.lastSettledAt typed" src/store/types.ts 'lastSettledAt'
# single accrual source: the baseRate accrual must appear EXACTLY once (no 2nd bypass)
SPEC1_ACC=$(grep -cE 'd\.baseRate \* lifeEff \* phoneFactor' src/store/app.ts 2>/dev/null)
if [ "$SPEC1_ACC" = "1" ]; then ok "SPEC-1 settle single-source: 1 accrual site"; else bad "SPEC-1 settle: expected 1 accrual site, found $SPEC1_ACC"; fi
# Device detail chain: owned-device instance id, registered route, expanded body.
sentinel_present "device detail page exists" src/pages/earn/device-detail.vue 'class="nx-device-detail'
sentinel_present "device detail route registered" src/pages.json 'pages/earn/device-detail'
sentinel_present "device detail defaults expanded" src/pages/earn/device-detail.vue 'const expanded = ref\(true\)'
sentinel_present "device detail rejects inactive inventory" src/pages/earn/device-detail.vue 'item\.activatedAt !== null'
sentinel_present "device card secondary controls are keyboard-accessible" src/components/earn/device-card-pc.vue '@keydown\.space\.stop\.prevent="toggleNetwork"'
sentinel_present "device quick menu is a modal dialog" src/components/earn/device-card-pc.vue 'aria-modal="true"'
sentinel_present "device quick menu traps focus" src/components/earn/device-card-pc.vue 'function trapMenuFocus'
sentinel_present "device quick menu traps native H5 keydown in capture phase" src/components/earn/device-card-pc.vue 'addEventListener\("keydown", onDocumentMenuKeydown, true\)'
sentinel_present "home slot opens owned device id" src/components/home/device-slot.vue 'device-detail\?id=\$\{encodeURIComponent\(props\.device\.id\)\}'
sentinel_present "home row opens owned device id" src/components/home/device-row.vue 'device-detail\?id=\$\{encodeURIComponent\(props\.device\.id\)\}'
sentinel_present "home slot device detail is keyboard-accessible" src/components/home/device-slot.vue '@keydown\.enter\.prevent="go"'
sentinel_present "home row device detail is keyboard-accessible" src/components/home/device-row.vue '@keydown\.enter\.prevent="go"'
sentinel_present "shared sub-page back is keyboard-accessible" src/components/sub-page-header.vue '@keydown\.enter\.prevent="goBack"'
# ── SPEC-7 风险簇/三桶/释放/提现 sentinels(推倒重写版 2026-07-02)──
# 契约层: 全参数寄存器 + 新增整改 key(R1/R2/R4)
sentinel_present "SPEC-7 risk cluster config typed" src/store/config-types.ts 'interface RiskClusterConfig'
sentinel_present "SPEC-7 release mode has no auto variant (R1)" src/store/config-types.ts '"attest_or_manual" \| "manual_only"'
sentinel_present "SPEC-7 free-slot binding gate typed (R4)" src/store/config-types.ts 'freeSlotRequiresBinding: boolean'
sentinel_present "SPEC-7 first-withdrawal-manual typed (R2)" src/store/config-types.ts 'firstWithdrawalManual: boolean'
sentinel_present "SPEC-7 new-address hold typed (R2)" src/store/config-types.ts 'newAddressHoldHours: number'
sentinel_present "SPEC-7 welcome gift lock mode typed" src/store/config-types.ts 'WelcomeGiftLockMode'
sentinel_present "SPEC-7 K4 dimension weights typed (R3)" src/store/config-types.ts 'dimensionWeights'
sentinel_present "SPEC-7 risk cluster seeded" src/mock/platform-config.ts 'releaseMode: "attest_or_manual"'
sentinel_present "SPEC-7 withdraw rules seeded" src/mock/platform-config.ts 'firstWithdrawalManual: true'
sentinel_present "SPEC-7 gift lock seeded" src/mock/platform-config.ts 'lockMode: "risk_bucket"'
sentinel_present "SPEC-7 riskScore cloned into config store" src/store/config.ts 'dimensionWeights: \{ \.\.\.DEFAULT_PLATFORM_CONFIG\.riskScore\.dimensionWeights \}'
# 引擎层: 身份注册表(独立于会话存储)+ 实时聚簇 + 释放 + 提现前置
sentinel_present "SPEC-7 risk registry isolated storage" src/store/risk-identity.ts 'nexgrid-risk-registry-v1'
sentinel_present "SPEC-7 registry tracks first withdrawal (R2)" src/store/risk-identity.ts 'hasWithdrawn'
sentinel_present "SPEC-7 registry tracks attestation" src/store/risk-identity.ts 'attestedOnlineMs'
sentinel_present "SPEC-7 realtime cluster evaluator (R5)" src/store/risk-cluster.ts 'export function evaluateAccountCluster'
sentinel_present "SPEC-7 multi-dimension clustering (R3)" src/store/risk-cluster.ts 'function dimensionHits'
sentinel_present "SPEC-7 bare identity enters watch (R3)" src/store/risk-cluster.ts 'bare-identity'
sentinel_present "SPEC-7 unbound free slot pends (R4)" src/store/risk-cluster.ts 'unbound-free-slot'
sentinel_present "SPEC-7 release ledger exists (R1)" src/store/earning-release.ts 'nexgrid-earning-ledger-v1'
sentinel_present "SPEC-7 release sources limited to attest|manual (R1)" src/store/earning-release.ts 'type ReleaseSource = "attest" \| "manual"'
sentinel_present "SPEC-7 cluster circuit breaker (R1)" src/store/earning-release.ts 'clusterBreakerTripped'
if grep -qE 'releasedBy: *"(timer|auto)"' src/store/earning-release.ts 2>/dev/null; then
  bad "SPEC-7 release engine must not have a time/auto release source (R1)"
else
  ok "SPEC-7 release engine has no auto release source (R1)"
fi
sentinel_present "SPEC-7 eligibility reads live cluster (R5)" src/store/withdrawal-eligibility.ts 'evaluateAccountCluster\(key\)'
sentinel_present "SPEC-7 first withdrawal reviewed (R2)" src/store/withdrawal-eligibility.ts 'first-withdrawal-review'
sentinel_present "SPEC-7 new address hold routed (R2)" src/store/withdrawal-eligibility.ts 'new-address-hold'
# 消费层: 注册 / 结算 / 钱包 / 提现
sentinel_present "SPEC-7 register evaluates via engine" src/pages/register/register.vue 'evaluateRegistration\(prospectiveIdentity\(\)'
sentinel_present "SPEC-7 register honors signup gate" src/pages/register/register.vue 'assessment\.gateRoute !== "manual_or_reject"'
sentinel_present "SPEC-7 register OTP verify is async with loading state" src/pages/register/register.vue 'verifying\.value = true'
sentinel_present "SPEC-7 register review copy is reason-aware" src/pages/register/register.vue 'rewardReviewBodyUnbound'
sentinel_present "SPEC-7 register commits canonical account identity" src/pages/register/register.vue 'commitRegistration\(createdIdentity'
sentinel_present "SPEC-7 welcome gift routes through idempotent buckets (R6)" src/pages/register/register.vue 'creditRewardBucketOnce\(registration\.giftRef, registration\.giftRoute'
sentinel_present "SPEC-7 welcome gift claimed per canonical account" src/pages/register/register.vue 'ensureGiftClaim\(createdIdentity'
sentinel_present "SPEC-7 sponsorship tracks claimed accounts" src/store/sponsorship.ts 'giftClaimedByAccount'
# 新人礼金额可配(2026-07-03 主人批): 金额只从 platform config 读,本地常量禁存(CGM-F-020)
sentinel_present "SPEC-7 gift amounts read from config" src/store/sponsorship.ts 'rewards\.welcomeGift'
sentinel_present "SPEC-7 gift usdt amount seeded" src/mock/platform-config.ts 'usdtAmount: 5'
sentinel_present "SPEC-7 gift nex amount seeded" src/mock/platform-config.ts 'nexAmount: 20'
if grep -rqE 'WELCOME_GIFT_USDT|WELCOME_GIFT_NEX' src/ 2>/dev/null; then
  bad "SPEC-7 gift amount local constants must not exist (config is single source)"
else
  ok "SPEC-7 no local gift amount constants (config-derived)"
fi
sentinel_present "SPEC-7 gift copy parameterized (zh)" src/i18n/messages/zh.ts '\{usd\} USDT \+ \{nex\} NEX'
sentinel_present "SPEC-7 gift copy parameterized (en)" src/i18n/messages/en.ts '\{usd\} USDT \+ \{nex\} NEX'
sentinel_present "SPEC-7 settle reads live cluster (R5)" src/store/app.ts 'evaluateAccountCluster\(accountKey\.value\)'
sentinel_present "SPEC-7 settle buckets earnings" src/store/app.ts 'bucketUserEarnings'
sentinel_present "SPEC-7 settle journals non-withdrawable routes (R1)" src/store/app.ts 'appendLedgerEntry\(accountKey\.value'
SPEC7_LEDGER_SITES=$(grep -cE 'appendLedgerEntry\(accountKey\.value' src/store/app.ts 2>/dev/null)
if [ "$SPEC7_LEDGER_SITES" = "2" ]; then
  ok "SPEC-7 both bucket-credit paths journal to ledger (settle + reward)"
else
  bad "SPEC-7 expected 2 ledger journal sites (settle + creditRewardBucket), found $SPEC7_LEDGER_SITES"
fi
sentinel_present "SPEC-7 settle accrues app attestation" src/store/app.ts 'recordAttestation\(accountKey\.value'
sentinel_present "SPEC-7 settle applies release engine (R1)" src/store/app.ts 'evaluateAttestRelease\(accountKey\.value'
sentinel_present "SPEC-7 settle pauses on config sync failure" src/store/app.ts 'if \(cfgStore\.syncFailed\) return'
sentinel_present "SPEC-7 config sync-failed dev toggle prod-guarded" src/store/config.ts '_devSetConfigSyncFailed'
sentinel_present "SPEC-7 wallet shows config sync failure state" src/pages/me/wallet.vue 'syncFailedTitle'

# ── PAY-VN 越南支付架构(规格 PRD/specs/ 下的「越南支付架构规格 v1.0」· 2026-07-24)──
#    注:此处刻意不写规格文件名全称 —— 文件名带旧品牌前缀,写全会被本文件的 brand 哨兵抓,
#    而为它开白名单会因整行过滤放行一大片(见 no_oldbrand_check 处的红测记录)。
# 入金 = USDT(TRC20/ERC20/BEP20)+ VietQR 银行转账 + 卡;出金仅 USDT;BTC/ETH 充提已下线。
if grep -rnE '\b(BTC|Bitcoin|bc1q)\b' src/store/deposits-core.ts src/store/deposits.ts src/store/fx.ts src/store/fx-core.ts src/pages/me/wallet-topup.vue src/pages/me/wallet-withdraw.vue src/pages/me/wallet-address-rebind.vue src/components/me/deposit-usdt-pane.vue src/components/me/deposit-bank-pane.vue src/components/store/chain-payment.vue src/pages/store/checkout.vue src/components/me/topup-card-form.vue >/dev/null 2>&1; then
  bad "PAY-VN BTC/Bitcoin 通道残留(充提已收窄仅 USDT 三网络)"
else
  ok "PAY-VN 支付面无 BTC 通道残留(仅 USDT×3)"
fi
sentinel_present "PAY-VN 通道枚举单源含 VietQR" src/store/types.ts 'bank-vietqr'
sentinel_present "PAY-VN 通道枚举单源含 BEP20" src/store/types.ts 'usdt-bep20'
sentinel_present "PAY-VN 链上通道费表单源" src/store/deposits-core.ts 'export const CHAIN_DEPOSIT_FEE_USDT'
sentinel_present "PAY-VN fx 牌价派生不缓存(computed)" src/store/fx.ts 'quoteRate = computed\(\(\) => computeQuoteRate'
sentinel_present "PAY-VN 换绑冻结下沉评估层(server-canonical)" src/store/withdrawal-eligibility.ts 'isRebindFrozen'
# 卡轨四条(2026-07-27 audit:此前卡轨走统一入金账后一条哨兵都没有,改坏无人拦)。
# 记账口径最关键 —— 把 gross 塌回 credited 等于平台白送手续费,而纯逻辑 selfcheck
# 只加载 deposits-core,守不到 deposits.ts 里的记录三元组(变异测试实证全绿)。
sentinel_present "PAY-VN 卡轨记账口径(gross = 实扣额,非入账额)" src/store/deposits.ts 'grossAmountUsdt: cardChargeUsd\(credited\)'
sentinel_present "PAY-VN 卡轨账号守卫(授权等待期跨账号不落账)" src/store/deposits.ts 'expectedAccountKey !== boundKey'
sentinel_present "PAY-VN 入金主键查重(DP 号同日仅 9000 种)" src/store/deposits.ts 'function mintDepositId'
sentinel_present "PAY-VN 卡费整数域(半分边界不被浮点压低)" src/store/deposits-core.ts 'cents \* bps'
if grep -rnE '26,?390' src/store/ src/components/me/ 2>/dev/null | grep -vqE 'fx-core|selfcheck'; then
  bad "PAY-VN 硬编码牌价 26390(必须从 fx-core computeQuoteRate 派生)"
else
  ok "PAY-VN 无硬编码牌价(单源派生)"
fi

# FEAT-AUTH01 OTP 防轰炸闸门(PRD §4.6.2/§16.2.1;规格 PRD/specs/FEAT-AUTH01-otp-antibomb-gate.md)
sentinel_present "AUTH01 captcha ticket must be explicit (audit P0 fix)" src/store/auth-otp.ts '!!captchaTicket &&'
sentinel_present "AUTH01 cooldown rejects without minting new code" src/store/auth-otp.ts 'error: "rate_limited"'
sentinel_present "AUTH01 otpGate thresholds read from config" src/store/auth-otp.ts 'useConfig\(\)\.config\.otpGate'
sentinel_present "AUTH01 otpGate seeded in platform config" src/mock/platform-config.ts 'captchaAfterSends: 2'
sentinel_present "AUTH01 login send gated via store" src/pages/login/login.vue 'await otpSend\('
sentinel_present "AUTH01 register send gated via store" src/pages/register/register.vue 'await otpSend\('
sentinel_present "AUTH01 login verify via store" src/pages/login/login.vue 'await otpVerify\('
sentinel_present "AUTH01 register verify via store" src/pages/register/register.vue 'await otpVerify\('
sentinel_present "AUTH01 captcha fail cap single-source" src/components/captcha-slider.vue 'MAX_CAPTCHA_FAILS'
if grep -qE 'const RESEND_SECONDS' src/pages/login/login.vue src/pages/register/register.vue 2>/dev/null; then
  bad "AUTH01 resend seconds local constants must not exist (otpGate config is single source)"
else
  ok "AUTH01 no local resend-seconds constants (config-derived)"
fi
# FEAT-AUTH02 已注册手机号分流：账号目录是唯一事实源；验证码通过后才可发现
# 老号进入既有登录链后，目标页 toast 必须持续展示可读提示。运行时链放在下方 H5
# browser gate。
sentinel_present "AUTH02 phone account directory exists" src/store/auth-account.ts 'AUTH_ACCOUNT_STORAGE_KEY'
sentinel_present "AUTH02 OTP exchanges verified old number" src/store/auth-otp.ts 'exchangeVerifiedSignIn'
sentinel_present "AUTH02 registered-number handoff uses destination toast" src/pages/register/register.vue 'toast\.info\(t\.value\.register\.accountExistsTitle'
sentinel_present "AUTH02 handoff toast is assistive-technology announced" src/components/global-ui.vue 'aria-live="polite"'
sentinel_present "AUTH02 sign-in rejects an unregistered phone identity" src/auth/complete-sign-in.ts '"account_not_found"'
sentinel_present "AUTH02 legacy risk migration seals schema2 barrier" src/store/risk-identity.ts 'sealLegacyRiskRegistryForAuthDirectory'
sentinel_present "AUTH02 sponsorship is rebound per account" src/lib/account-scope.ts 'useSponsorship\(\)\.bindAccount\(accountKey\)'
sentinel_present "AUTH02 sponsorship stores bindings per account" src/store/sponsorship.ts 'bindingsByAccount'
sentinel_present "AUTH02 dev bridge is entrypoint DEV-gated" src/main.ts 'if \(import\.meta\.env\.DEV\)'
sentinel_present "SPEC-7 wallet pending bucket info sheet" src/pages/me/wallet.vue 'pendingSheetTitle'
# 2026-07-24 A6:reason code → 话术码表收口进 lib/risk-reason-text.ts 单源(三渲染源共用,
# 防散抄 dict 漏新增码被 filter(Boolean) 静默吞行);页面哨兵改钉共享函数消费。
sentinel_present "SPEC-7 wallet reasons mapped via i18n (no raw codes)" src/pages/me/wallet.vue 'riskReasonLines\(t\.value'
sentinel_present "SPEC-7 risk reason dict single-source in lib" src/lib/risk-reason-text.ts 't\.wallet\.riskReasons'
sentinel_present "SPEC-7 risk reason dict carries PAY04 rebind codes" src/lib/risk-reason-text.ts '"new-address-large-amount"'
sentinel_present "SPEC-7 payment-instrument overuse mapped (en)" src/i18n/messages/en.ts '"payment-instrument-overuse"'
sentinel_present "SPEC-7 payment-instrument overuse mapped (zh)" src/i18n/messages/zh.ts '"payment-instrument-overuse"'
sentinel_present "SPEC-7 dev bridge is DEV-gated" src/lib/spec7-dev-bridge.ts 'if \(!import\.meta\.env\.DEV\) return'
sentinel_present "SPEC-7 earning buckets typed" src/store/types.ts 'interface EarningBuckets'
sentinel_present "SPEC-7 user carries earningBuckets" src/store/types.ts 'earningBuckets: EarningBuckets'
sentinel_present "SPEC-7 legacy account snapshots receive bucket defaults" src/store/app.ts 'withDefaultEarningBuckets'
sentinel_present "SPEC-7 wallet page reads earning buckets" src/pages/me/wallet.vue 'app\.user\.earningBuckets'
sentinel_present "SPEC-7 wallet card reads earning buckets" src/components/me/wallet-card.vue 'app\.user\.earningBuckets'
sentinel_present "SPEC-7 withdraw page uses withdrawable bucket" src/pages/me/wallet-withdraw.vue 'app\.user\.earningBuckets\.withdrawableUsdt'
sentinel_present "SPEC-7 withdraw page consumes eligibility engine" src/pages/me/wallet-withdraw.vue 'from "@/store/withdrawal-eligibility"'
sentinel_present "SPEC-7 withdraw submit re-evaluates async at submit (R5)" src/pages/me/wallet-withdraw.vue 'await requestWithdrawalEligibility'
sentinel_present "SPEC-7 withdraw submit uses fresh route" src/pages/me/wallet-withdraw.vue 'fresh\.route'
sentinel_present "SPEC-7 withdraw timeout does not debit" src/pages/me/wallet-withdraw.vue 'riskCheckTimeoutTitle'
sentinel_present "SPEC-7 withdraw shows held buckets line" src/pages/me/wallet-withdraw.vue 'heldBucketsLine'
sentinel_present "SPEC-7 tracking maps risk reasons via i18n" src/pages/me/wallet-withdraw-tracking.vue 'riskReasonLines\(t\.value'
sentinel_present "SPEC-7 tracking has frozen hold variant" src/pages/me/wallet-withdraw-tracking.vue 'routeHeldFrozenTitle'
sentinel_present "SPEC-7 pairing registers payment instrument" src/pages/me/wallet-topup.vue 'recordPaymentInstrument\(app\.accountKey'
sentinel_present "SPEC-7 reject route never debits" src/store/app.ts 'if \(riskRoute === "reject"\) return null'
sentinel_present "SPEC-7 risk route maps to queue status" src/store/app.ts 'riskRoute === "freeze" \? "frozen"'
sentinel_present "SPEC-7 withdrawal debits withdrawable bucket" src/store/app.ts 'withdrawableUsdt: \+\(currentUser\.earningBuckets\.withdrawableUsdt - amount\)'
# 负余额不变量(2026-07-10 P0): 购买共用 debitBalance 减总余额时必 clamp 可提额度 ≤ 剩余
# 总余额,否则可提额度 > 总余额 → 提现门(只看可提额度)放行超总余额提现 → usdtBalance 变负
# (凭空取钱)。两条哨兵锁 debitBalance 的 clamp + submitWithdrawal 的总余额兜底门。
sentinel_present "P0 neg-balance: debit clamps withdrawable<=balance" src/store/app.ts 'withdrawableUsdt: Math\.min\(buckets\.withdrawableUsdt, nextUsdt\)'
sentinel_present "P0 neg-balance: withdrawal gate also checks total balance" src/store/app.ts 'if \(currentUser\.usdtBalance < amount\) return null'
# merge 层(2026-07-10 审计补): account-cloud 把余额字段当独立加法计数器三路累加,多端并发
# 扣款合并会把总余额扣穿为负 / 可提额度虚高;写盘前必过资金不变量收口(clamp ≥0 + withdrawable
# ≤ balance),补住 debitBalance 单会话 clamp 管不到的这条旁路(2 个独立审计 + 复现脚本证实)。
sentinel_present "P0 neg-balance: account-cloud has fund-invariant clamp" src/store/account-cloud.ts 'function clampAccountFundInvariants'
sentinel_present "P0 neg-balance: merge writes clamped snapshot" src/store/account-cloud.ts 'const merged = clampAccountFundInvariants\(rawMerged\)'
# 提现金额有效性守卫(对齐 debitBalance):NaN/±Inf/≤0 拒,防负数反向加钱 / NaN 污染余额。
sentinel_present "P0 neg-balance: withdrawal rejects invalid amount" src/store/app.ts 'if \(!Number\.isFinite\(amount\) \|\| amount <= 0\) return null'
# 脏金额守卫覆盖门(补④):credit/debit × USDT/NEX 四个余额原语必须全带 NaN/负数守卫,
# 否则 debitNex(-x) 会因 `bal < -x` 恒 false 反向增币、脏 amount 污染余额成 NaN。
nex_guard_sites=$(grep -cE '!Number\.isFinite\(amount\) \|\| amount < 0' src/store/app.ts)
if [ "${nex_guard_sites:-0}" -ge 4 ]; then
  ok "P0 dirty-amount: credit/debit × USDT/NEX all reject NaN/negative (×$nex_guard_sites)"
else
  bad "P0 dirty-amount: money primitive missing finite guard (only ${nex_guard_sites:-0}/4)"
fi
# 单源门(补⑤):提现劝阻卡 APY 必须读 STAKING_APY 主表,不硬编码镜像(防 Round-7 式漂移)。
sentinel_present "single-source: stake-alt APY reads STAKING_APY (no hardcoded mirror)" src/components/me/stake-alternative-card.vue 'STAKING_APY\['
# client 零推进: 旧全局推进函数必须已收编为 _dev 前缀(仅 pass 路由)
sentinel_present "SPEC-7 demo advance is _dev-prefixed" src/store/app.ts 'function _devAdvanceWithdrawal'
if grep -qE 'function advanceWithdrawal\(' src/store/app.ts 2>/dev/null; then
  bad "SPEC-7 un-prefixed advanceWithdrawal must not exist (client never advances)"
else
  ok "SPEC-7 no un-prefixed withdrawal advancing"
fi
if [ -f src/store/withdrawal-risk.ts ]; then
  bad "SPEC-7 legacy withdrawal-risk.ts must stay deleted (rewritten as withdrawal-eligibility)"
else
  ok "SPEC-7 legacy withdrawal-risk.ts removed"
fi
if grep -q 'app\.advanceWithdrawal' src/pages/me/wallet-withdraw-tracking.vue 2>/dev/null; then
  bad "SPEC-7 tracking page must not auto-advance withdrawals"
else
  ok "SPEC-7 tracking page is display-only"
fi
if grep -q 'app\.creditBalance(gift\.usdt)' src/pages/register/register.vue 2>/dev/null; then
  bad "SPEC-7 register gift must not credit USDT balance directly (R6)"
else
  ok "SPEC-7 register gift not directly credited to balance (R6)"
fi
if grep -q 'const usdtBalance = computed(() => app\.user\.usdtBalance)' src/pages/me/wallet-withdraw.vue 2>/dev/null; then
  bad "SPEC-7 withdraw page must not use total USDT balance as available"
else
  ok "SPEC-7 withdraw page uses withdrawable amount, not total balance"
fi
if grep -q 'nexBalance: +(user.value.nexBalance + positiveNexDelta)' src/store/app.ts 2>/dev/null; then
  bad "SPEC-7 settle must not credit NEX balance outside buckets"
else
  ok "SPEC-7 settle NEX route goes through buckets"
fi
# 双端参数 key parity: uniapp 配置契约 ↔ admin 参数寄存器(DR-7 结构一致)
ADMIN_CFG="../Nexion-admin-prototype/lib/mock/admin/compute-config.ts"
if [ ! -f "$ADMIN_CFG" ]; then
  bad "SPEC-7 parity: admin compute-config.ts not found at $ADMIN_CFG"
else
  parity_miss=""
  for k in freePhoneSlotsPerCluster duplicateAccountPendingFrom duplicateAccountFreezeFrom \
           pendingReleaseHours appAttestationReleaseHours maxSignupPerIp24h maxAccountsPerDevice \
           maxAccountsPerPaymentInstrument clusterFreezeSuggestThreshold releaseMode freeSlotRequiresBinding \
           minWithdrawableUsdt sameAddressRoute firstWithdrawalManual newAddressHoldHours lockMode \
           serverDeviceId ipBucket withdrawAddress paymentInstrument sponsor uaFingerprint signupTiming \
           weakSignalClusterThreshold; do
    grep -q "$k" src/store/config-types.ts || parity_miss="${parity_miss}uniapp:$k "
    grep -q "$k" "$ADMIN_CFG" || parity_miss="${parity_miss}admin:$k "
  done
  if [ -z "$parity_miss" ]; then
    ok "SPEC-7 param key parity (uniapp config-types ↔ admin compute-config)"
  else
    bad "SPEC-7 param key parity missing: $parity_miss"
  fi
  # 双端参数「值」parity: uniapp seed ↔ admin defaultVal(2026-07-14 加焊:K1 双渲染源值漂移
  # 1/0.82≠2/0.7 的同类回归——键在但值抄错。riskCluster 11 键 + otpGate 5 键逐一比对字面值;
  # 红测已验能抓真漂移。07-15 因整树 reset 丢失后重放(feedback_cross_repo_value_parity)。
  value_mismatch=""
  for k in freePhoneSlotsPerCluster duplicateAccountPendingFrom duplicateAccountFreezeFrom \
           pendingReleaseHours appAttestationReleaseHours maxSignupPerIp24h maxAccountsPerDevice \
           maxAccountsPerPaymentInstrument clusterFreezeSuggestThreshold releaseMode freeSlotRequiresBinding \
           resendSeconds captchaAfterSends otpTtlSeconds maxVerifyAttempts captchaTicketTtlSeconds; do
    uni_v=$(grep -oE "\b$k: [^,]+" src/mock/platform-config.ts | head -1 | sed "s/^$k: //" | tr -d '\r')
    # 尾逗号锚定对象字面量条目;类型声明的 union 行(key: "X" | ...)无逗号,天然排除(红测抓过 resendSeconds 撞 union 首键)
    adm_v=$(grep -A6 "key: \"$k\"," "$ADMIN_CFG" | grep -m1 -oE "defaultVal: [^,]+" | sed "s/^defaultVal: //" | tr -d '\r')
    if [ -z "$uni_v" ] || [ -z "$adm_v" ]; then
      value_mismatch="${value_mismatch}${k}(extract-fail:uni=${uni_v:-none} admin=${adm_v:-none}) "
    elif [ "$uni_v" != "$adm_v" ]; then
      value_mismatch="${value_mismatch}${k}(uni=$uni_v!=admin=$adm_v) "
    fi
  done
  if [ -z "$value_mismatch" ]; then
    ok "SPEC-7 param value parity (uniapp seed ↔ admin defaultVal, 16 keys: riskCluster 11 + otpGate 5)"
  else
    bad "SPEC-7 param value parity drift: $value_mismatch"
  fi
  # 值 parity 覆盖度自守:seed riskCluster 块键数必须 = 循环里的 11,otpGate 块 = 5。两端同时
  # 新增键时键 parity 仍绿、值 parity 循环静默漏检,此处变红逼同步扩循环(2026-07-14 对抗审查 D 项缺口)
  seed_key_count=$(sed -n '/riskCluster: {/,/},/p' src/mock/platform-config.ts | grep -cE '^\s+\w+: [^{]')
  og_key_count=$(sed -n '/otpGate: {/,/},/p' src/mock/platform-config.ts | grep -cE '^\s+\w+: [^{]')
  if [ "$seed_key_count" -eq 11 ] && [ "$og_key_count" -eq 5 ]; then
    ok "SPEC-7 value parity coverage (riskCluster=11 + otpGate=5, 与循环清单同步)"
  else
    bad "SPEC-7 value parity coverage: riskCluster=$seed_key_count(应 11) otpGate=$og_key_count(应 5) —— 新增/删除键须同步改值 parity 循环"
  fi
fi
# ── SPEC-2 电脑算力 sentinels ──
spec2_pc_gpu_kind_coverage() {
  local miss=""
  grep -q '"pc-gpu"' src/store/types.ts || miss="${miss}DeviceKind "
  grep -q '"pc-gpu"' src/store/device-types.ts || miss="${miss}device-types "
  grep -q '"pc-gpu"' src/components/earn/device-card-pc.vue || miss="${miss}device-card-icon "
  grep -q '"pc-gpu"' src/components/earn/empty-slots-hint.vue || miss="${miss}slot-grid-icon "
  if [ -z "$miss" ]; then ok "SPEC-2 pc-gpu kind coverage (types/specs/icons)";
  else bad "SPEC-2 pc-gpu kind coverage missing: $miss"; fi
}
spec2_pc_gpu_kind_coverage
sentinel_present "SPEC-2 compute entry gated by feature flag" src/components/earn/compute-share-entry.vue 'isEnabled\("computeShareEnabled"\)'
sentinel_present "SPEC-2 dev config mutation production guarded" src/store/config.ts 'if \(IS_PRODUCTION\) return'
sentinel_present "SPEC-2 compute entry render guarded" src/components/earn/compute-share-entry.vue 'v-if="enabled"'
sentinel_present "SPEC-2 download page guard uses feature flag" src/pages/compute-share/download.vue 'isEnabled\("computeShareEnabled"\)'
sentinel_present "SPEC-2 download body does not render while disabled" src/pages/compute-share/download.vue 'v-if="enabled" class="pb-8"'
sentinel_present "SPEC-2 copy handler re-checks disabled flag" src/pages/compute-share/download.vue 'function copyDownloadUrl\(\)'
sentinel_present "SPEC-2 connect handler re-checks disabled flag" src/pages/compute-share/download.vue 'function connectDemoComputer\(\)'
sentinel_present "SPEC-2 download title reads config content" src/pages/compute-share/download.vue 'cfg\.config\.computeShare\.content'
sentinel_present "SPEC-2 download guide falls back to i18n" src/pages/compute-share/download.vue 'configured \|\| t\.value\.computeShare\.downloadBody'
sentinel_present "SPEC-2 computeShare content typed" src/store/config-types.ts 'interface ComputeShareContent'
sentinel_present "SPEC-2 computeShare zhTitle seeded" src/mock/platform-config.ts 'zhTitle:'
sentinel_present "SPEC-2 computeShare zhGuide seeded" src/mock/platform-config.ts 'zhGuide:'
sentinel_present "SPEC-2 computeShare enTitle seeded" src/mock/platform-config.ts 'enTitle:'
sentinel_present "SPEC-2 computeShare enGuide seeded" src/mock/platform-config.ts 'enGuide:'
sentinel_present "SPEC-2 gpu tiers single source exists" src/lib/gpu-tiers.ts 'export const GPU_TIERS'
sentinel_present "SPEC-2 device factory accepts matched tier" src/store/device-types.ts 'options\.gpuTier \?\? matchGpuTier'
sentinel_present "SPEC-2 connect uses configured GPU tiers" src/store/app.ts 'cfg\.config\.computeShare\.gpuTiers'
sentinel_present "SPEC-2 pc-gpu freezes when flag disabled" src/store/app.ts 'freezeComputeShareDevice'
sentinel_present "SPEC-2 slot cap counts hidden active pc-gpu" src/store/app.ts 'activeSlotCount = computed\(\(\) => devices\.value\.filter'
sentinel_present "SPEC-2 device page slot meter uses authoritative active count" src/pages/me/devices.vue 'app\.activeSlotCount \+ trialReserved\.value'
sentinel_present "SPEC-2 default feature flag is off" src/mock/platform-config.ts 'computeShareEnabled:\s*false'
sentinel_present "SPEC-2 checkout counts trial reserved slot" src/pages/store/checkout.vue 'activeSlotCount \+ reservedSlots\.value'
sentinel_present "SPEC-2 eligibility counts trial reserved slot" src/composables/use-device-eligibility.ts 'activeSlotCount \+ reservedSlots\.value'
sentinel_present "SPEC-2 trade-in choice counts trial reserved slot" src/components/tradein-sheets.vue 'activeSlotCount \+ reservedSlots\.value'
sentinel_present "SPEC-2 trade-in activation receives reserved slots" src/components/tradein-sheets.vue 'activateDevice\(newId, reservedSlots\.value\)'
sentinel_present "SPEC-2 order activation receives reserved slots" src/App.vue 'tickOrders\(trialReservesSlotNow\(\) \? 1 : 0\)'
sentinel_present "SPEC-2 order detail passes trial reserved slot" src/pages/store/order-detail.vue 'advanceOrder\(id\.value, reservedSlots\.value\)'
sentinel_present "SPEC-2 refresh passes trial reserved slot" src/store/refresh.ts 'tickOrders\(trialReservesSlotNow\(\) \? 1 : 0\)'
sentinel_present "SPEC-2 slot sheet counts trial reserved slot" src/components/slot-action-sheet.vue 'slotsUsed\.value >= MAX_DEVICES'
sentinel_present "SPEC-2 slot sheet activation receives reserved slot" src/components/slot-action-sheet.vue 'activateDevice\(d\.id, reservedSlots\.value\)'
sentinel_present "SPEC-2 replace candidate uses slot devices" src/store/tradein-sheet.ts 'useApp\(\)\.slotDevices'
sentinel_present "SPEC-2 purchased hardware helper exists" src/store/device-types.ts 'isPurchasedHardwareKind'
sentinel_present "SPEC-2 download URL defaults to empty" src/mock/platform-config.ts 'downloadUrl:\s*""'
spec2_gpu_tier_monotonic() {
  if "$NODE_BIN" -e '
    const fs=require("fs");
    const s=fs.readFileSync("src/lib/gpu-tiers.ts","utf8");
    const rows=[...s.matchAll(/id:\s*"(G[1-6])"[\s\S]*?tops:\s*(\d+)/g)].map(m=>({id:m[1],tops:+m[2]}));
    const order=["G1","G2","G3","G4","G5","G6"];
    if(rows.length!==6) throw new Error(`expected 6 tiers, got ${rows.length}`);
    const by=new Map(rows.map(r=>[r.id,r.tops]));
    for(let i=1;i<order.length;i++){ if(!(by.get(order[i])>by.get(order[i-1]))) throw new Error(`${order[i]} not > ${order[i-1]}`); }
  ' >/tmp/uni-spec2-gpu.log 2>&1; then
    ok "SPEC-2 gpu-tier monotonic TOPS (G1<...<G6)"
  else
    bad "SPEC-2 gpu-tier monotonic TOPS"; sed 's/^/        /' /tmp/uni-spec2-gpu.log
  fi
}
spec2_gpu_tier_monotonic
spec2_guard_semantics() {
  if "$NODE_BIN" -e '
    const fs=require("fs");
    const download=fs.readFileSync("src/pages/compute-share/download.vue","utf8");
    const app=fs.readFileSync("src/store/app.ts","utf8");
    const deviceTypes=fs.readFileSync("src/store/device-types.ts","utf8");
    const gpu=fs.readFileSync("src/lib/gpu-tiers.ts","utf8");
    if(!/function copyDownloadUrl\(\)[\s\S]*?if \(!enabled\.value\)/.test(download)) throw new Error("copy handler lacks enabled gate");
    if(!/function connectDemoComputer\(\)[\s\S]*?if \(!enabled\.value\)/.test(download)) throw new Error("connect handler lacks enabled gate");
    if(!/addDevice\("pc-gpu", \{ gpuModel: normalizedModel, gpuTier \}\)/.test(app)) throw new Error("pc-gpu creation does not pass matched tier");
    if(!/device\.kind === "pc-gpu" && !computeShareEnabled\.value/.test(app)) throw new Error("pc-gpu activation is not feature-gated");
    if(!/const IS_PRODUCTION = import\.meta\.env\.PROD/.test(fs.readFileSync("src/store/config.ts","utf8"))) throw new Error("dev config mutation lacks production guard constant");
    if(!/function _devSetFlag[\s\S]*?if \(IS_PRODUCTION\) return/.test(fs.readFileSync("src/store/config.ts","utf8"))) throw new Error("_devSetFlag is not production guarded");
    if(!/function _devSetComputeShareContent[\s\S]*?if \(IS_PRODUCTION\) return/.test(fs.readFileSync("src/store/config.ts","utf8"))) throw new Error("_devSetComputeShareContent is not production guarded");
    if(!/const activeSlotCount = computed\(\(\) => devices\.value\.filter\(\(d\) => d\.activatedAt !== null\)\.length\)/.test(app)) throw new Error("slot cap must count hidden active pc-gpu devices");
    const demoKindsMatch = deviceTypes.match(/const demoKinds:[\s\S]*?=\s*\[([^\]]*)\]/);
    if(!demoKindsMatch) throw new Error("default demoKinds seed missing");
    const demoKinds = [...demoKindsMatch[1].matchAll(/"([^"]+)"/g)].map((m)=>m[1]);
    if(demoKinds.includes("pc-gpu")) throw new Error("default demo seed must not include active pc-gpu");
    if(demoKinds.length !== 4) throw new Error(`default demo seed must leave one free slot for pc connect, got ${demoKinds.length} demo kinds`);
    if(/createDevice\("pc-gpu",\s*"pc-gpu-seed"/.test(app)) throw new Error("app store must not append an active pc-gpu seed");
    if(!/const slotDevices = computed\(\(\) =>[\s\S]*computeShareEnabled\.value[\s\S]*devices\.value\.filter\(\(d\) => d\.kind !== "pc-gpu"\)/.test(app)) throw new Error("slotDevices must hide pc-gpu while compute-share is disabled");
    if(!/const slotsUsed = computed\(\(\) => app\.activeSlotCount \+ trialReserved\.value\)/.test(fs.readFileSync("src/pages/me/devices.vue","utf8"))) throw new Error("device page slot meter must use authoritative activeSlotCount");
    if(!/name:\s*"Shared computer"/.test(deviceTypes)) throw new Error("pc-gpu device name still uses tier label");
    if(/PURCHASED_HARDWARE_KINDS[\s\S]*"pc-gpu"/.test(deviceTypes)) throw new Error("pc-gpu must not be a purchased hardware kind");
    const frontText=fs.readFileSync("src/i18n/messages/zh.ts","utf8")+fs.readFileSync("src/i18n/messages/en.ts","utf8");
    if(/原型演示|Prototype path only|运营后台|内部开关|工程字段名|ENV_FILTERED|MANUAL_HOLD/.test(frontText)) throw new Error("front copy leaks internal or engineering language");
    const slotSheet=fs.readFileSync("src/components/slot-action-sheet.vue","utf8");
    const orderDetail=fs.readFileSync("src/pages/store/order-detail.vue","utf8");
    const refresh=fs.readFileSync("src/store/refresh.ts","utf8");
    if(/activateDevice\(d\.id\)/.test(slotSheet)) throw new Error("slot sheet activates without reserved slots");
    if(/advanceOrder\(id\.value\)/.test(orderDetail)) throw new Error("order detail advances without reserved slots");
    if(/tickOrders\(\)/.test(refresh)) throw new Error("refresh advances orders without reserved slots");
    const rows=[...gpu.matchAll(/id:\s*"(G[1-6])"[\s\S]*?keywords:\s*\[([^\]]+)\][\s\S]*?tops:\s*(\d+)/g)];
    const tierFor4070=rows.find(([,id,kw])=>id==="G4" && /rtx 4070/.test(kw));
    const fallbackG2=rows.find(([,id])=>id==="G2");
    if(!tierFor4070) throw new Error("RTX 4070 must map to G4");
    if(!fallbackG2) throw new Error("G2 fallback tier missing");
  ' >/tmp/uni-spec2-guard.log 2>&1; then
    ok "SPEC-2 guard semantics (disabled gate/config tier/hardware naming)"
  else
    bad "SPEC-2 guard semantics"; sed 's/^/        /' /tmp/uni-spec2-guard.log
  fi
}
spec2_guard_semantics
# ── SPEC-3 prototype homes withdrawn ──
spec3_prototype_homes_withdrawn() {
  if "$NODE_BIN" -e '
    const fs=require("fs");
    const pj=JSON.parse(fs.readFileSync("src/pages.json","utf8"));
    const paths=new Set((pj.pages||[]).map(p=>p.path));
    const removedRoutes=["pages/home-signed/home-signed","pages/home-h5/home-h5","pages/home-cloak/home-cloak"];
    for(const p of removedRoutes){ if(paths.has(p)) throw new Error(`removed route still registered: ${p}`); }
    const removedFiles=[
      "src/pages/home-signed/home-signed.vue",
      "src/pages/home-h5/home-h5.vue",
      "src/pages/home-cloak/home-cloak.vue",
      "src/components/home/prototype-home.vue",
    ];
    for(const file of removedFiles){
      if(fs.existsSync(file)) throw new Error(`removed prototype file still exists: ${file}`);
    }
    const chassis=fs.readFileSync("src/components/app-chassis.vue","utf8");
    if(/prototypeHome/.test(chassis)) throw new Error("prototypeHome prop branch should be removed");
    const types=fs.readFileSync("src/store/config-types.ts","utf8");
    if(/HomePrototype|homePrototypes/.test(types)) throw new Error("prototype home config types should be removed");
    const cfg=fs.readFileSync("src/mock/platform-config.ts","utf8");
    if(/homePrototypes|signedApp|h5Mobile|cloakApp/.test(cfg)) throw new Error("prototype home mock seed should be removed");
  ' >/tmp/uni-spec3-prototype-withdrawn.log 2>&1; then
    ok "SPEC-3 prototype home routes removed"
  else
    bad "SPEC-3 prototype home withdrawal"; sed 's/^/        /' /tmp/uni-spec3-prototype-withdrawn.log
  fi
}
spec3_prototype_homes_withdrawn
# ── SPEC-6 new entry-surface homes ──
spec6_entry_surface_homes_present() {
  if "$NODE_BIN" -e '
    const fs=require("fs");
    const pj=JSON.parse(fs.readFileSync("src/pages.json","utf8"));
    const paths=new Set((pj.pages||[]).map(p=>p.path));
    const requiredRoutes=[
      "pages/entry-surfaces/index",
      "pages/entry-surfaces/signed",
      "pages/entry-surfaces/h5",
      "pages/entry-surfaces/white",
    ];
    for(const p of requiredRoutes){ if(!paths.has(p)) throw new Error(`SPEC-6 route missing: ${p}`); }
    const requiredFiles=[
      "src/pages/entry-surfaces/index.vue",
      "src/pages/entry-surfaces/signed.vue",
      "src/pages/entry-surfaces/h5.vue",
      "src/pages/entry-surfaces/white.vue",
      "src/components/entry-surfaces/entry-surface-home.vue",
    ];
    for(const file of requiredFiles){ if(!fs.existsSync(file)) throw new Error(`SPEC-6 file missing: ${file}`); }
    const index=fs.readFileSync("src/pages/entry-surfaces/index.vue","utf8");
    const fullLinks=[
      "http://localhost:5173/#/pages/entry-surfaces/signed",
      "http://localhost:5173/#/pages/entry-surfaces/h5",
      "http://localhost:5173/#/pages/entry-surfaces/white?entry=white-app",
    ];
    for(const link of fullLinks){ if(!index.includes(link)) throw new Error(`SPEC-6 full clickable link missing: ${link}`); }
    if(!/@(tap|click)="open\(item\.route\)"/.test(index)) throw new Error("SPEC-6 full links are not clickable rows");
    const signed=fs.readFileSync("src/pages/entry-surfaces/signed.vue","utf8");
    const h5=fs.readFileSync("src/pages/entry-surfaces/h5.vue","utf8");
    const white=fs.readFileSync("src/pages/entry-surfaces/white.vue","utf8");
    if(!/surface="signed"/.test(signed)) throw new Error("signed entry page does not render signed surface");
    if(!/surface="h5"/.test(h5)) throw new Error("h5 entry page does not render h5 surface");
    if(!/surface="white"/.test(white)) throw new Error("white entry page does not render white surface");
    // 三端入口文案 2026-07-28 迁进 i18n(entrySurface 命名空间)——语义 token 与
    // 泄漏守卫跟着文案走,否则组件里没文案了,这两道门会变成永真的空门。
    const nsSlice=(file)=>{
      const src=fs.readFileSync(file,"utf8");
      const m=src.match(/\n  entrySurface: \{[\s\S]*?\n  \},/);
      if(!m) throw new Error(`SPEC-6 i18n namespace entrySurface missing in ${file}`);
      return m[0];
    };
    const i18nCopy=["src/i18n/messages/en.ts","src/i18n/messages/zh.ts","src/i18n/messages/vi.ts"].map(nsSlice).join("\n");
    const body=fs.readFileSync("src/components/entry-surfaces/entry-surface-home.vue","utf8")+index+i18nCopy;
    for(const token of ["在线增强","基础托管","体检融合"]){ if(!body.includes(token)) throw new Error(`SPEC-6 surface semantic token missing: ${token}`); }
    if(/secondary:\s*\{\s*label:\s*"PC sharing path",\s*href:\s*"\/pages\/compute-share\/download"/.test(body)) throw new Error("H5 entry must not advertise a disabled-by-default PC download path as direct CTA");
    if(/ENV_FILTERED|MANUAL_HOLD|keyword\d+|computeShareEnabled|H5_BASE_FACTOR|home-signed|home-h5|home-cloak|原型演示|工程字段名/.test(body)) throw new Error("SPEC-6 entry UI leaks withdrawn or engineering copy");
  ' >/tmp/uni-spec6-entry-surfaces.log 2>&1; then
    ok "SPEC-6 entry-surface homes present (3 independent routes + full links)"
  else
    bad "SPEC-6 entry-surface homes"; sed 's/^/        /' /tmp/uni-spec6-entry-surfaces.log
  fi
}
spec6_entry_surface_homes_present
if "$CURL_BIN" -s -o /dev/null -w "%{http_code}" "$BASE_URL/" 2>/dev/null | grep -q 200; then
  if BASE_URL="$BASE_URL" "$NODE_BIN" scripts/spec6-entry-surface-runtime.mjs >/tmp/uni-spec6-entry-runtime.log 2>&1; then
    ok "$(cat /tmp/uni-spec6-entry-runtime.log)"
  else
    bad "SPEC-6 entry-surface runtime isolation"; sed 's/^/        /' /tmp/uni-spec6-entry-runtime.log
  fi
else
  printf "  ${Y}SKIP${N}  SPEC-6 entry-surface runtime isolation (dev server not running at %s)\n" "$BASE_URL"
fi
# R7 pricing order and the device-detail route are runtime contracts: static
# sentinels cannot prove a stale App reopen stays baseline or that taps really navigate.
if "$CURL_BIN" -s -o /dev/null -w "%{http_code}" "$BASE_URL/" 2>/dev/null | grep -q 200; then
  if BASE_URL="$BASE_URL" "$NODE_BIN" scripts/r7-device-detail-runtime.mjs >/tmp/uni-r7-device-detail-runtime.log 2>&1; then
    ok "$(cat /tmp/uni-r7-device-detail-runtime.log)"
  else
    bad "R7 + device detail runtime"; sed 's/^/        /' /tmp/uni-r7-device-detail-runtime.log
  fi
else
  printf "  ${Y}SKIP${N}  R7 + device detail runtime (dev server not running at %s)\n" "$BASE_URL"
fi
# 注册成功页的平台边界是编译条件,UA 伪造无法证明 App 分支。锁住 H5
# 提醒块、App 无提醒、底部继续入口和官网配置字段这四个不变量。
if "$NODE_BIN" -e '
  const fs=require("fs");
  const ts=require("typescript");
  const postcss=require("postcss");
  const selectorParser=require("postcss-selector-parser");
  const {initPreContext,preHtml,preJs}=require("@dcloudio/uni-cli-shared");
  const {parse}=require("@vue/compiler-sfc");
  const {baseParse}=require("@vue/compiler-dom");
  const successFile="src/pages/register/success.vue";
  const registerFile="src/pages/register/register.vue";
  const success=fs.readFileSync(successFile,"utf8");
  const register=fs.readFileSync(registerFile,"utf8");
  const config=fs.readFileSync("src/store/config-types.ts","utf8");
  function compile(source,file,platform){
    initPreContext(platform);
    return preJs(preHtml(source,file),file);
  }
  function inspect(source,file){
    const {descriptor,errors}=parse(source,{filename:file});
    if(errors.length) throw errors[0];
    const elements=[],templateExpressions=[];
    const template=baseParse(descriptor.template?.content||"");
    (function walk(node,ancestorHidden=false,ancestorClassNames=[],ancestorElements=[]){
      let hidden=ancestorHidden;
      let descendantClassNames=ancestorClassNames;
      let descendantElements=ancestorElements;
      if(node.type===1){
        const staticValue=(name)=>node.props.find((prop)=>prop.type===6&&prop.name===name)?.value?.content||"";
        const constantIf=node.props.find((prop)=>prop.type===7&&prop.name==="if")?.exp?.content?.trim();
        const style=staticValue("style").replace(/\s+/g,"").toLowerCase();
        const classNames=staticValue("class").split(/\s+/).filter(Boolean);
        const attributes=Object.fromEntries(node.props.filter((prop)=>prop.type===6).map((prop)=>[prop.name,prop.value?.content||""]));
        hidden=hidden||constantIf==="false"||node.props.some((prop)=>prop.type===6&&prop.name==="hidden")||/(display:none|visibility:hidden|opacity:0(?:;|$))/.test(style);
        node.__staticallyHidden=hidden;
        node.__ancestorClassNames=ancestorClassNames;
        node.__ancestorElements=ancestorElements;
        descendantClassNames=ancestorClassNames.concat(classNames);
        descendantElements=ancestorElements.concat({tag:String(node.tag||"").toLowerCase(),classNames,attributes});
        elements.push(node);
        for(const prop of node.props){ if(prop.type===7&&prop.exp?.content) templateExpressions.push(prop.exp.content); }
      }
      if(node.type===5&&node.content?.content) templateExpressions.push(node.content.content);
      for(const child of node.children||[]) walk(child,hidden,descendantClassNames,descendantElements);
    })(template,false,[],[]);
    const script=descriptor.scriptSetup?.content||descriptor.script?.content||"";
    const sourceFile=ts.createSourceFile(file,script,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    const registrationLaunchUrls=[];
    let hasOfficialIdentifier=false,hasWindowOpenCall=false;
    (function walk(node){
      if(ts.isIdentifier(node)&&node.text==="officialDownloadUrl") hasOfficialIdentifier=true;
      if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&ts.isIdentifier(node.expression.expression)&&node.expression.expression.text==="window"&&node.expression.name.text==="open") hasWindowOpenCall=true;
      ts.forEachChild(node,walk);
    })(sourceFile);
    const launchFunction=sourceFile.statements.find((node)=>ts.isFunctionDeclaration(node)&&node.name?.text==="launchRegistrationSuccess");
    if(launchFunction){
      (function collect(node){
        if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&ts.isIdentifier(node.expression.expression)&&node.expression.expression.text==="uni"&&node.expression.name.text==="reLaunch"){
          const options=node.arguments[0];
          if(options&&ts.isObjectLiteralExpression(options)){
            const url=options.properties.find((prop)=>ts.isPropertyAssignment(prop)&&((ts.isIdentifier(prop.name)&&prop.name.text==="url")||(ts.isStringLiteral(prop.name)&&prop.name.text==="url")));
            if(url&&ts.isStringLiteral(url.initializer)) registrationLaunchUrls.push(url.initializer.text);
          }
        }
        ts.forEachChild(node,collect);
      })(launchFunction);
    }
    const styles=descriptor.styles.map((style)=>style.content).join("\n");
    return {elements,templateExpressions,registrationLaunchUrls,hasOfficialIdentifier,hasWindowOpenCall,styles};
  }
  function staticAttr(element,name){
    return element?.props.find((prop)=>prop.type===6&&prop.name===name)?.value?.content||"";
  }
  function hasClass(element,name){
    return staticAttr(element,"class").split(/\s+/).includes(name);
  }
  function elementByClass(output,name){
    return output.elements.find((element)=>hasClass(element,name));
  }
  function appCssBlocker(styles,element){
    const elementClasses=staticAttr(element,"class").split(/\s+/).filter(Boolean);
    const elementAttributes=Object.fromEntries(element.props.filter((prop)=>prop.type===6).map((prop)=>[prop.name,prop.value?.content||""]));
    const elementChain=[...(element.__ancestorElements||[]),{tag:String(element.tag||"").toLowerCase(),classNames:elementClasses,attributes:elementAttributes}];
    let blocker="";
    function isPrintOnly(rule){
      for(let parent=rule.parent;parent;parent=parent.parent){
        if(parent.type!=="atrule"||parent.name.toLowerCase()!=="media") continue;
        const branches=parent.params.toLowerCase().split(",").map((branch)=>branch.trim()).filter(Boolean);
        if(branches.length&&branches.every((branch)=>/^(?:only\s+)?print(?:\s+and\b|$)/.test(branch))) return true;
      }
      return false;
    }
    function splitSelector(selector){
      const compounds=[[]],combinators=[];
      for(const node of selector.nodes||[]){
        if(node.type==="combinator"){
          combinators.push(node.value.trim()||" ");
          compounds.push([]);
        }else compounds[compounds.length-1].push(node);
      }
      return {compounds,combinators};
    }
    function selectorMatches(selector,elementIndex){
      const {compounds,combinators}=splitSelector(selector);
      function compoundMatches(nodes,index){
        const candidate=elementChain[index];
        if(!candidate) return false;
        for(const node of nodes){
          if(node.type==="class"&&!candidate.classNames.includes(node.value)) return false;
          if(node.type==="tag"&&node.value!=="*"&&candidate.tag!==node.value.toLowerCase()) return false;
          if(node.type==="id"&&candidate.attributes.id!==node.value) return false;
          if(node.type==="pseudo"){
            const name=node.value.toLowerCase();
            const alternatives=node.nodes||[];
            if((name===":is"||name===":where"||name===":matches")&&!alternatives.some((alternative)=>selectorMatchesAt(alternative,index))) return false;
            if(name===":not"&&alternatives.some((alternative)=>selectorMatchesAt(alternative,index))) return false;
          }
        }
        return true;
      }
      function selectorMatchesAt(candidateSelector,index){
        const parsed=splitSelector(candidateSelector);
        return matchFrom(parsed.compounds,parsed.combinators,parsed.compounds.length-1,index);
      }
      function matchFrom(compoundsToMatch,combinatorsToMatch,compoundIndex,elementIndex){
        if(elementIndex<0||!compoundMatches(compoundsToMatch[compoundIndex],elementIndex)) return false;
        if(compoundIndex===0) return true;
        const combinator=combinatorsToMatch[compoundIndex-1];
        if(combinator===">") return matchFrom(compoundsToMatch,combinatorsToMatch,compoundIndex-1,elementIndex-1);
        if(combinator===" "){
          for(let parentIndex=elementIndex-1;parentIndex>=0;parentIndex--){
            if(matchFrom(compoundsToMatch,combinatorsToMatch,compoundIndex-1,parentIndex)) return true;
          }
          return false;
        }
        return true;
      }
      return matchFrom(compounds,combinators,compounds.length-1,elementIndex);
    }
    function selectorCanReachChain(selectorText){
      let reaches=false;
      selectorParser((selectors)=>{
        selectors.each((selector)=>{
          for(let index=0;index<elementChain.length&&!reaches;index++) reaches=selectorMatches(selector,index);
        });
      }).processSync(selectorText);
      return reaches;
    }
    function isZeroOpacity(value){
      let normalized=value.toLowerCase().replace(/\s+/g,"");
      while(/^calc\([^()]+\)$/.test(normalized)) normalized=normalized.slice(5,-1);
      return /^(?:0+(?:\.0*)?|\.0+)(?:%)?$/.test(normalized);
    }
    postcss.parse(styles).walkRules((rule)=>{
      if(blocker||isPrintOnly(rule)||!selectorCanReachChain(rule.selector)) return;
      rule.walkDecls((declaration)=>{
        const property=declaration.prop.toLowerCase();
        const value=declaration.value.toLowerCase().trim();
        const blocks=(property==="display"&&value==="none")||(property==="visibility"&&value==="hidden")||(property==="pointer-events"&&value==="none")||(property==="opacity"&&isZeroOpacity(value));
        if(blocks) blocker=`${rule.selector} { ${property}: ${declaration.value} }`;
      });
    });
    return blocker;
  }
  function hasHandler(element,event,modifiers=[]){
    return !!element?.props.find((prop)=>prop.type===7&&prop.name==="on"&&prop.arg?.content===event&&prop.exp?.content==="continueWeb"&&modifiers.every((modifier)=>prop.modifiers.includes(modifier)));
  }
  const h5Success=inspect(compile(success,successFile,"h5"),successFile);
  const appSuccess=inspect(compile(success,successFile,"app-plus"),successFile);
  const h5Register=inspect(compile(register,registerFile,"h5"),registerFile);
  const appRegister=inspect(compile(register,registerFile,"app-plus"),registerFile);
  for(const token of ["class=\"rs-why\"","class=\"rs-h5-download\""]){
    const className=token.match(/rs-[a-z0-9-]+/)[0];
    if(!elementByClass(h5Success,className)) throw new Error(`H5 output lost real ${className} element`);
    if(elementByClass(appSuccess,className)) throw new Error(`App output retained real ${className} element`);
  }
  const appContinue=elementByClass(appSuccess,"rs-continue");
  if(!appContinue) throw new Error("App output lost the real continue CTA element");
  if(appContinue.__staticallyHidden) throw new Error("App continue CTA is statically unreachable or hidden");
  const appContinueCssBlocker=appCssBlocker(appSuccess.styles,appContinue);
  if(appContinueCssBlocker) throw new Error(`App continue CTA is blocked by platform CSS: ${appContinueCssBlocker}`);
  if(staticAttr(appContinue,"role")!=="button"||staticAttr(appContinue,"tabindex")!=="0") throw new Error("App continue CTA lost button semantics");
  if(!hasHandler(appContinue,"click")||!hasHandler(appContinue,"keydown",["enter","prevent"])||!hasHandler(appContinue,"keydown",["space","prevent"])) throw new Error("App continue CTA lost click/Enter/Space.prevent handlers");
  if(appSuccess.hasOfficialIdentifier||appSuccess.hasWindowOpenCall) throw new Error("App output retained H5 download behavior");
  if(appSuccess.templateExpressions.some((expression)=>/doneWhyApp|doneOfficialDownload/.test(expression))) throw new Error("App output retained H5 reminder copy bindings");
  if(/doneComingSoon|APP 即将上线|APP launching soon/.test(success)) throw new Error("obsolete success-page coming-soon contract remains");
  if(!/appDownload:\s*\{[\s\S]*officialUrl:\s*string/.test(config)) throw new Error("official download URL is not typed in platform config");
  if(!h5Register.registrationLaunchUrls.includes("/pages/register/success")) throw new Error("H5 registration function lost the success reLaunch call");
  if(appRegister.registrationLaunchUrls.includes("/pages/register/success")) throw new Error("App registration function retained the H5 success reLaunch call");
  if(!appRegister.registrationLaunchUrls.includes("/pages/onboarding/estimator")) throw new Error("App registration function lost the onboarding reLaunch call");
  ' >/tmp/uni-register-success-platform.log 2>&1; then
  ok "register success H5/App platform contract"
else
  bad "register success H5/App platform contract"; sed 's/^/        /' /tmp/uni-register-success-platform.log
fi
# FEAT-AUTH02 必须用真实 H5 iframe 回归：页面源码和 vue-tsc 都无法证明
# “老号提示 → 自动登录 → 无重复副作用”这条跨 store/路由链实际可用。
if "$CURL_BIN" -s -o /dev/null -w "%{http_code}" "$BASE_URL/" 2>/dev/null | grep -q 200; then
  if BASE_URL="$BASE_URL" "$NODE_BIN" scripts/spec7-risk-gate-runtime.mjs >/tmp/uni-spec7-risk-gate-runtime.log 2>&1; then
    ok "$(cat /tmp/uni-spec7-risk-gate-runtime.log)"
  else
    bad "SPEC-7 K1 device/payment registration gates"; sed 's/^/        /' /tmp/uni-spec7-risk-gate-runtime.log
  fi
  for AUTH02_LOCALE in en zh; do
    if BASE_URL="$BASE_URL" "$NODE_BIN" scripts/auth-register-existing-runtime.mjs "$AUTH02_LOCALE" >/tmp/uni-auth02-runtime-${AUTH02_LOCALE}.log 2>&1; then
      ok "$(cat /tmp/uni-auth02-runtime-${AUTH02_LOCALE}.log)"
    else
      bad "AUTH02 registered-number runtime handoff (${AUTH02_LOCALE})"; sed 's/^/        /' /tmp/uni-auth02-runtime-${AUTH02_LOCALE}.log
    fi
  done
else
  bad "SPEC-7 K1 device/payment registration gates (dev server not running at $BASE_URL)"
  bad "AUTH02 registered-number + success-page runtime (EN/ZH; dev server not running at $BASE_URL)"
fi
# ── SPEC-4 account-cloud + multi-carrier session sentinels ──
sentinel_present "SPEC-4 account-cloud storage exists" src/store/account-cloud.ts 'nexgrid-account-cloud-v1'
sentinel_present "SPEC-4 app binds account snapshot" src/store/app.ts 'function bindAccount'
sentinel_present "SPEC-4 app persists account snapshot" src/store/app.ts 'function persistAccountSnapshot'
sentinel_present "SPEC-4 login uses canonical sign-in completion" src/pages/login/login.vue 'completeSignIn\('
sentinel_present "SPEC-4 canonical sign-in binds account before session claim" src/auth/complete-sign-in.ts 'app\.bindAccount\(options\.identity\)'
sentinel_present "SPEC-4 register binds canonical account before rewards" src/pages/register/register.vue 'app\.bindAccount\(createdIdentity\)'
sentinel_present "SPEC-4 entry surface supports white-app carrier" src/lib/entry-surface.ts '"white-app"'
sentinel_present "SPEC-4 session registry storage exists" src/store/session.ts 'nexgrid-account-sessions-v1'
sentinel_present "SPEC-4 security page uses live session registry" src/pages/me/security.vue 'session\.activeSessions'
# P2-8 存储作用域:创世持仓/V 等级按账号隔离,账号切换收口必须重绑(防跨账号继承复发)
sentinel_present "P2-8 account-scope helper rebinds genesis" src/lib/account-scope.ts 'useGenesis\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds v-rank" src/lib/account-scope.ts 'useVRank\(\)\.bindAccount\(accountKey\)'
# genesis/v-rank(引爆 P2-8 债的最初两个受害者)补 store 层哨兵,与其余 26 个对齐(28×2=56 条墙)
sentinel_present "P2-8 genesis store is account-scoped" src/store/genesis.ts 'writeAccountRow'
sentinel_present "P2-8 v-rank store is account-scoped" src/store/v-rank.ts 'writeAccountRow'
# P2-8 batch-1 钱类:订单/账单/质押/佣金按账号隔离(收口重绑 + store 用 writeAccountRow;摘任一行必红)
sentinel_present "P2-8 account-scope helper rebinds orders" src/lib/account-scope.ts 'useOrders\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds bills" src/lib/account-scope.ts 'useBills\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds staking" src/lib/account-scope.ts 'useStaking\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds commission" src/lib/account-scope.ts 'useCommission\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 orders store is account-scoped" src/store/orders.ts 'writeAccountRow'
sentinel_present "P2-8 bills store is account-scoped" src/store/bills.ts 'writeAccountRow'
sentinel_present "P2-8 staking store is account-scoped" src/store/staking.ts 'writeAccountRow'
sentinel_present "P2-8 commission store is account-scoped" src/store/commission.ts 'writeAccountRow'
# P2-8 batch-2 券/试用/兑换:券包/试用/swap/风控计数/绑卡/签到按账号隔离(摘任一行必红)
sentinel_present "P2-8 account-scope helper rebinds voucher" src/lib/account-scope.ts 'useVoucher\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds free-trial" src/lib/account-scope.ts 'useFreeTrial\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds exchange" src/lib/account-scope.ts 'useExchange\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds exchange-v3" src/lib/account-scope.ts 'useExchangeV3\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds cards" src/lib/account-scope.ts 'useCards\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds nex-faucet" src/lib/account-scope.ts 'useNexFaucet\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 voucher store is account-scoped" src/store/voucher.ts 'writeAccountRow'
sentinel_present "P2-8 free-trial store is account-scoped" src/store/free-trial.ts 'writeAccountRow'
sentinel_present "P2-8 exchange store is account-scoped" src/store/exchange.ts 'writeAccountRow'
sentinel_present "P2-8 exchange-v3 store is account-scoped" src/store/exchange-v3.ts 'writeAccountRow'
sentinel_present "P2-8 cards store is account-scoped" src/store/cards.ts 'writeAccountRow'
sentinel_present "P2-8 nex-faucet store is account-scoped" src/store/nex-faucet.ts 'writeAccountRow'
# P2-8 wallet-pairing:KYC 配对源头按账号隔离(修 wallet-exchange 镜像旁路 exchange-v3.kycVerified)
sentinel_present "P2-8 account-scope helper rebinds wallet-pairing" src/lib/account-scope.ts 'useWalletPairing\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 wallet-pairing store is account-scoped" src/store/wallet-pairing.ts 'writeAccountRow'
# P2-8 batch-3 任务/成就/游戏化:任务/周任务/活动/里程碑/成就/目标/转盘/增益按账号隔离(摘任一行必红)
sentinel_present "P2-8 account-scope helper rebinds quest" src/lib/account-scope.ts 'useQuest\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds weekly-quest" src/lib/account-scope.ts 'useWeeklyQuest\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds event-quest" src/lib/account-scope.ts 'useEventQuest\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds milestones" src/lib/account-scope.ts 'useMilestones\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds achievements" src/lib/account-scope.ts 'useAchievements\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds goals" src/lib/account-scope.ts 'useGoals\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds lucky-spin" src/lib/account-scope.ts 'useLuckySpin\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds daily-powerup" src/lib/account-scope.ts 'useDailyPowerUp\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 quest store is account-scoped" src/store/quest.ts 'writeAccountRow'
sentinel_present "P2-8 weekly-quest store is account-scoped" src/store/weekly-quest.ts 'writeAccountRow'
sentinel_present "P2-8 event-quest store is account-scoped" src/store/event-quest.ts 'writeAccountRow'
sentinel_present "P2-8 milestones store is account-scoped" src/store/milestones.ts 'writeAccountRow'
sentinel_present "P2-8 milestones spec6 guard tracks new key" scripts/spec6-entry-surface-runtime.mjs 'nexgrid-milestones-accounts-v1'
sentinel_present "P2-8 achievements store is account-scoped" src/store/achievements.ts 'writeAccountRow'
sentinel_present "P2-8 goals store is account-scoped" src/store/goals.ts 'writeAccountRow'
sentinel_present "P2-8 lucky-spin store is account-scoped" src/store/lucky-spin.ts 'writeAccountRow'
sentinel_present "P2-8 daily-powerup store is account-scoped" src/store/daily-powerup.ts 'writeAccountRow'
# P2-8 batch-4 记录/账户:通知/凭证/工单/购物车/资料/安全/奖励水位线按账号隔离(摘任一行必红)
sentinel_present "P2-8 account-scope helper rebinds notifications" src/lib/account-scope.ts 'useNotifications\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds receipts" src/lib/account-scope.ts 'useReceipts\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds tickets" src/lib/account-scope.ts 'useTickets\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds cart" src/lib/account-scope.ts 'useCart\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds profile" src/lib/account-scope.ts 'useProfile\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds security" src/lib/account-scope.ts 'useSecurity\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 account-scope helper rebinds rewards-seen" src/lib/account-scope.ts 'useRewardsSeen\(\)\.bindAccount\(accountKey\)'
sentinel_present "P2-8 notifications store is account-scoped" src/store/notifications.ts 'writeAccountRow'
sentinel_present "P2-8 receipts store is account-scoped" src/store/receipts.ts 'writeAccountRow'
sentinel_present "P2-8 tickets store is account-scoped" src/store/tickets.ts 'writeAccountRow'
sentinel_present "P2-8 cart store is account-scoped" src/store/cart.ts 'writeAccountRow'
sentinel_present "P2-8 profile store is account-scoped" src/store/profile.ts 'writeAccountRow'
sentinel_present "P2-8 security store is account-scoped" src/store/security.ts 'writeAccountRow'
sentinel_present "P2-8 rewards-seen store is account-scoped" src/store/rewards-seen.ts 'writeAccountRow'
# P2-8 batch-5 会话记录:会话中心/Nova 非持久,换号收口点必须 reset 重播种(防上一账号的客服对话被下一账号看到;audit 2026-07-16)
sentinel_present "P2-8 account-scope helper resets conversations" src/lib/account-scope.ts 'useConversations\(\)\.reset\(\)'
sentinel_present "P2-8 account-scope helper resets nova" src/lib/account-scope.ts 'useNova\(\)\.reset\(\)'
# 客服会话闲置策略双端 parity(本仓侧 tripwire;admin 侧 canon-sentinel 逐键比 canon-numbers.json):
# 改这两个默认值必须三处同步(uniapp 常量 + admin m-tabs/data.ts + canon json),单独改本仓即红。
sentinel_present "support idle policy warn default pinned (1min · canon parity)" src/mock/conversations.ts 'SUPPORT_IDLE_WARN_MINS = 1'
sentinel_present "support idle policy close default pinned (5min · canon parity)" src/mock/conversations.ts 'SUPPORT_IDLE_CLOSE_MINS = 5'
spec4_account_session_semantics() {
  if "$NODE_BIN" -e '
    const fs=require("fs");
    const session=fs.readFileSync("src/store/session.ts","utf8");
    const app=fs.readFileSync("src/store/app.ts","utf8");
    const appVue=fs.readFileSync("src/App.vue","utf8");
    const login=fs.readFileSync("src/pages/login/login.vue","utf8");
    const register=fs.readFileSync("src/pages/register/register.vue","utf8");
    const signIn=fs.readFileSync("src/auth/complete-sign-in.ts","utf8");
    const entry=fs.readFileSync("src/lib/entry-surface.ts","utf8");
    const wallet=fs.readFileSync("src/pages/me/wallet.vue","utf8");
    const withdrawalTracking=fs.readFileSync("src/pages/me/wallet-withdraw-tracking.vue","utf8");
    if(/function writeActiveRecord|function readActiveRecord|const ACTIVE_KEY/.test(session)) throw new Error("legacy single active-session writer returned");
    if(/rec\.deviceId !== deviceId\.value[\s\S]*return "kicked"/.test(session)) throw new Error("different device login still kicks current session");
    if(!/readAccountSessionRecords/.test(session)) throw new Error("account session list is not exposed");
    if(!/function resumeOrClaim/.test(session)) throw new Error("startup session restore/revoke guard missing");
    if(!/\.resumeOrClaim\(key\)/.test(appVue)) throw new Error("app startup must resume existing session instead of blindly claiming a new one");
    if(!/restored\.status === "kicked"[\s\S]*uni\.reLaunch\(\{ url: "\/pages\/session\/kicked" \}\)/.test(appVue)) throw new Error("app startup must route restored revoked sessions to kicked page");
    if(/useSession\(\)\.claim\(key\)/.test(appVue)) throw new Error("app startup still blindly claims a new session");
    if(!/revokeAllOtherSessions/.test(session)) throw new Error("session revoke-all action missing");
    if(!/mergeAndWriteAccountSnapshotResult\(lastCloudSnapshot, snapshot\)/.test(app)) throw new Error("account snapshot is not merged through app store");
    if(!/adoptAccountSnapshot\(result\.snapshot\)/.test(app)) throw new Error("merged account snapshot is not adopted back into app state");
    if(!/accountKey,\s*entrySurface,\s*accountCloudUpdatedAt/.test(app)) throw new Error("account cloud state is not returned to consumers");
    if(!/completeSignIn\(\{[\s\S]*identity/.test(login)) throw new Error("login does not use the canonical sign-in completion");
    if(!/auth\.signIn\(options\.identity, onboardingComplete\)[\s\S]*app\.bindAccount\(options\.identity\)[\s\S]*session\.(resumeOrClaim|claim)\(options\.identity\)/.test(signIn)) throw new Error("canonical sign-in must bind account before session claim");
    if(!/app\.bindAccount\(createdIdentity\)[\s\S]*rebindAccountScopedStores\(createdIdentity\)[\s\S]*commitRegistration\(createdIdentity/.test(register)) throw new Error("register must bind/rebind canonical account before rewards/session flow");
    if(!/app\.bindAccount\(key\);\s*[\r\n]+\s*rebindAccountScopedStores\(key\)/.test(appVue)) throw new Error("P2-8: app startup must rebind account-scoped stores (genesis/v-rank) right after bindAccount");
    if(!/app\.bindAccount\(options\.identity\);\s*[\r\n]+\s*rebindAccountScopedStores\(options\.identity\)/.test(signIn)) throw new Error("P2-8: canonical sign-in must rebind account-scoped stores right after bindAccount");
    if(!/app\.bindAccount\(createdIdentity\);\s*[\r\n]+\s*rebindAccountScopedStores\(createdIdentity\)/.test(register)) throw new Error("P2-8: register must rebind account-scoped stores right after bindAccount");
    if(!/entry === "white-app" \|\| entry === "white" \|\| entry === "cloak" \|\| entry === "janus"/.test(entry)) throw new Error("white-app entry aliases missing");
    const messages=fs.readFileSync("src/i18n/messages/zh.ts","utf8")+fs.readFileSync("src/i18n/messages/en.ts","utf8");
    if(/同一时间只能有一台设备运行挖矿|only one device runs mining at a time/.test(messages)) throw new Error("old strong single-device copy leaked");
    const walletUi=wallet+withdrawalTracking;
    if(/replace\(\s*\/-\/g/.test(walletUi)) throw new Error("wallet status enum is still transformed into UI copy");
    if(/return "just now"|`\\$\\{m\\}m ago`|`\\$\\{h\\}h ago`|`\\$\\{Math\.floor\(h \/ 24\)\}d ago`/.test(walletUi)) throw new Error("wallet relative time still hardcodes English copy");
    if(/label="My bank cards"|USDT Balance|NEX Boost Active|cards bound|Reused at checkout/.test(wallet)) throw new Error("wallet page still has hardcoded English UI copy");
  ' >/tmp/uni-spec4-session.log 2>&1; then
    ok "SPEC-4 account/session semantics (account cloud + multi-carrier)"
  else
    bad "SPEC-4 account/session semantics"; sed 's/^/        /' /tmp/uni-spec4-session.log
  fi
}
spec4_account_session_semantics
if "$NODE_BIN" scripts/spec4-account-cloud-merge-check.mjs >/tmp/uni-spec4-merge.log 2>&1; then
  ok "$(cat /tmp/uni-spec4-merge.log)"
else
  bad "SPEC-4 account-cloud merge semantics"; sed 's/^/        /' /tmp/uni-spec4-merge.log
fi
if "$CURL_BIN" -s -o /dev/null -w "%{http_code}" "$BASE_URL/" 2>/dev/null | grep -q 200; then
  if BASE_URL="$BASE_URL" "$NODE_BIN" scripts/spec4-account-cloud-app-sync.mjs >/tmp/uni-spec4-app-sync.log 2>&1; then
    ok "$(cat /tmp/uni-spec4-app-sync.log)"
  else
    bad "SPEC-4 account-cloud app sync"; sed 's/^/        /' /tmp/uni-spec4-app-sync.log
  fi
  if BASE_URL="$BASE_URL" "$NODE_BIN" scripts/spec4-runtime-session-guard.mjs >/tmp/uni-spec4-runtime-guard.log 2>&1; then
    ok "$(cat /tmp/uni-spec4-runtime-guard.log)"
  else
    bad "SPEC-4 runtime session guard"; sed 's/^/        /' /tmp/uni-spec4-runtime-guard.log
  fi
else
  printf "  ${Y}SKIP${N}  SPEC-4 account-cloud app sync (dev server not running at %s)\n" "$BASE_URL"
  printf "  ${Y}SKIP${N}  SPEC-4 runtime session guard (dev server not running at %s)\n" "$BASE_URL"
fi
# SFC block closure (PITFALLS P-025): a `<script>` block missing its `</script>`
# close tag compiles fine under vue-tsc/volar (lenient: script extends to EOF)
# but THROWS in vite:vue / uni's @vue/compiler-sfc → "Element is missing end tag"
# → page 500s at runtime. vue-tsc green ≠ compiler OK (cf. P-008). Every .vue
# that opens <script> MUST close it; same for <template>/<style>.
sfc_script_closed() {
  local miss=""
  local f
  while IFS= read -r f; do
    if grep -q '<script' "$f" && ! grep -q '</script>' "$f"; then miss="$miss$f\n"; fi
    if grep -q '<template' "$f" && ! grep -q '</template>' "$f"; then miss="$miss$f (template)\n"; fi
  done < <(find src -name '*.vue')
  if [ -z "$miss" ]; then ok "every .vue closes its <script>/<template> (0 hits)";
  else bad "unclosed SFC block (missing </script> or </template>)"; printf "$miss" | sed 's/^/        /'; fi
}
sfc_script_closed
# Native <button> guard (PITFALLS P-036 / cookbook): uni's <button> ships heavy
# default chrome (border + min-height + ::after hairline + bg) so a raw <button>
# renders "样式不对". Use <view @click> + own styles. Migration-note comments
# ("<button>→<view @click>") carry the → arrow and are excluded.
no_native_button() {
  local hits
  hits=$(grep -rnE '<button[ >]' src 2>/dev/null | grep -v '→' | head -5)
  if [ -z "$hits" ]; then ok "no native <button> tag (use <view @click>) (0 hits)";
  else bad "native <button> tag (uni default chrome — use <view @click>)"; echo "$hits" | sed 's/^/        /'; fi
}
no_native_button
# @tap binding guard (PITFALLS P-059): uni H5 registers BOTH @tap and @click as
# click listeners → a dual-bound element fires its handler TWICE per tap/click
# (steppers +2, toggles open-then-close, navigateTo ×2 → stack corruption via
# the navTo fallback chain). uni's compiler maps @click → tap on mp targets, so
# single @click is correct on every platform. Comment MENTIONS of "@tap"
# (migration notes) are fine — only the binding form `@tap...=` is banned.
no_tap_binding() {
  local hits
  hits=$(grep -rnE '@tap(\.[a-z]+)*=' src 2>/dev/null | head -5)
  if [ -z "$hits" ]; then ok "no @tap binding (single @click correct on all targets, P-059) (0 hits)";
  else bad "@tap binding — H5 double-fires alongside click; use single @click (P-059)"; echo "$hits" | sed 's/^/        /'; fi
}
no_tap_binding
# Raw navigateBack guard (PITFALLS P-054): uni H5 navigateBack on a single-entry
# stack (cold-open/deep-link) returns SUCCESS as a no-op — fail never fires →
# dead back button. Use navBack() helper (src/lib/route.ts, the one legit caller).
no_raw_navigateback() {
  local hits
  hits=$(grep -rnE 'uni\.navigateBack\(' src 2>/dev/null | grep -vE 'src/lib/route\.ts' | head -5)
  if [ -z "$hits" ]; then ok "no raw uni.navigateBack (use navBack() helper) (0 hits)";
  else bad "raw uni.navigateBack — cold-open no-op; use navBack() helper (P-054)"; echo "$hits" | sed 's/^/        /'; fi
}
no_raw_navigateback
# Week-boundary epoch-modulo guard (leadership-pool fix 2026-06-24): the JS epoch
# (1970-01-01) is a THURSDAY, so `now % ONE_WEEK == 0` lands on Thursday 00:00 UTC,
# not Monday. The v3 leadership-pool cycle runs Mon 00:00 → Sun 23:59 UTC (PRD
# §8.5.3). Any week-start MUST derive Monday via getUTCDay/Date.UTC — never
# `x % ONE_WEEK` (no legit use exists; it always mis-aligns to Thursday).
no_epoch_week_modulo() {
  local hits
  # exclude JSDoc/line-comment lines (` * …` / `// …`) — they may quote the
  # anti-pattern for documentation (as the leadership-pool warning does).
  hits=$(grep -rnE '%[[:space:]]*ONE_WEEK' src 2>/dev/null | grep -vE ':[0-9]+:[[:space:]]*(\*|//)' | head -5)
  if [ -z "$hits" ]; then ok "no epoch-modulo week boundary (% ONE_WEEK → Thu, not Mon) (0 hits)";
  else bad "epoch-modulo week boundary aligns to Thursday — use Monday-UTC helper (PRD §8.5.3)"; echo "$hits" | sed 's/^/        /'; fi
}
no_epoch_week_modulo
# Debit return-value guard (trial.vue 账单一致性 fix 2026-07-10): debitBalance/
# debitNex return false on insufficient/NaN/negative and DON'T charge. A bare
# statement `app.debitBalance(x);` discards that boolean → downstream still records
# a "purchased" bill / credits / spawns device with NO money moved (账本不一致).
# Every call MUST consume the return (const x=…;if(!x) / if(!app.debitX) /
# &&!app.debitNex / ?:+if). Row-start bare call ending `);` = the original bug form.
debit_return_checked() {
  local hits
  hits=$(grep -rnE '^[[:space:]]*app\.debit(Balance|Nex)\(.*\);[[:space:]]*$' src 2>/dev/null | head -5)
  if [ -z "$hits" ]; then ok "every app.debitBalance/debitNex consumes its return (no bare charge → 账本一致) (0 hits)";
  else bad "bare debitBalance/debitNex discards false return → bill recorded without charging (fix: const x=…;if(!x){toast;return})"; echo "$hits" | sed 's/^/        /'; fi
}
debit_return_checked
# Local-component import guard (terminal-audit P1): Vue SFC component registration
# is LOCAL-scope only — a child .vue that uses <SectionHeader> in its template MUST
# import section-header.vue itself; the parent page's import does NOT cascade. A
# missing import → runtime "[Vue warn] Failed to resolve component: SectionHeader"
# and the header silently vanishes from the DOM (3 me/* cards regressed this way).
section_header_imported() {
  local hits=""
  local f
  for f in $(grep -rlE '<SectionHeader' src --include='*.vue' 2>/dev/null); do
    grep -qE 'import SectionHeader' "$f" || hits="${hits}${f}"$'\n'
  done
  if [ -z "$hits" ]; then ok "every .vue using <SectionHeader> imports it (no resolve-fail)";
  else bad "<SectionHeader> used without import (Vue resolve-fail, header vanishes):"; printf "%s" "$hits" | sed 's/^/        /'; fi
}
section_header_imported
# Chassis chrome completeness (PITFALLS P-037): the prototype's IOSFrame mounts a
# fixed set of ALWAYS-ON chrome — Header + TabBar + NovaBubble (nova 浮标) +
# pull-to-refresh. Batch-0 chassis was simplified and silently dropped the bubble
# + pull-refresh; verify only caught what it was told to look at (cf. P-036). This
# sentinel enumerates the always-on chrome so it can't regress unnoticed.
chassis_chrome_complete() {
  local f="src/components/app-chassis.vue"
  local miss=""
  [ -f "$f" ] || { bad "chassis file missing ($f)"; return; }
  grep -q 'NovaBubble' "$f" || miss="${miss}NovaBubble(nova浮标) "
  grep -q 'nx-refresher' "$f" || miss="${miss}pull-to-refresh(touch) "
  grep -q 'nx-page-enter' "$f" || miss="${miss}page-entrance-anim "
  grep -q 'nx-tabbar-pill' "$f" || miss="${miss}floating-pill-tabbar "
  grep -q 'nx-header' "$f" || miss="${miss}brand-header "
  # frosted-glass chrome must NOT use <scroll-view> for content (P-039): its
  # separate compositing layer kills the fixed chrome's backdrop-filter frosting.
  grep -qE '<scroll-view[^>]*class="nx-content' "$f" && miss="${miss}scroll-view-breaks-frosting(use-overflow-view) "
  if [ -z "$miss" ]; then ok "chassis chrome complete (header + pill + nova浮标 + pull-refresh + entrance, frosting-safe)";
  else bad "chassis chrome INCOMPLETE — missing: $miss"; fi
}
chassis_chrome_complete
# CSS foundation (PITFALLS P-038): the prototype's globals.css `font-family`
# chains reference --font-display / --font-jet-mono (next/font vars injected on
# :root by app/layout.tsx) and rely on Tailwind Preflight's global border-box.
# uni has NO layout.tsx and UnoCSS presetWind3 ships no preflight, so if these
# aren't redefined locally: (a) the undefined var() makes the WHOLE font-family
# declaration invalid → every text node falls back to Times New Roman serif;
# (b) content-box makes height/width+padding elements larger than the prototype.
# Plus the brand fonts must be loaded (index.html) — the prototype loads them in
# layout.tsx. This sentinel guards all three so the foundation can't regress.
css_foundation() {
  local t="src/styles/tokens.css"
  local miss=""
  [ -f "$t" ] || { bad "tokens.css missing"; return; }
  grep -qE '^\s*--font-display:' "$t"  || miss="${miss}--font-display-undef(→TimesNewRoman) "
  grep -qE '^\s*--font-jet-mono:' "$t" || miss="${miss}--font-jet-mono-undef "
  grep -qE 'box-sizing:\s*border-box' "$t" || miss="${miss}no-border-box-reset "
  grep -q 'general-sans' index.html 2>/dev/null || miss="${miss}no-brand-font-link(index.html) "
  if [ -z "$miss" ]; then ok "css foundation (font vars defined + border-box reset + brand font loaded)";
  else bad "css foundation BROKEN — $miss"; fi
}
css_foundation
# Navigation route validity (PITFALLS P-046): every "/pages/..." route LITERAL in
# src must exist in pages.json — else uni's navigateTo({fail:()=>{}}) silently
# does nothing → "点击无跳转" (cf. team Genesis card used /pages/genesis instead of
# /pages/genesis/genesis). Dynamic prototype logical-path hrefs (/genesis,
# /me/wallet/exchange …) must route through src/lib/route.ts navTo(), not raw
# navigateTo, so they're mapped to real flattened uni routes.
nav_routes_valid() {
  local bad_routes
  bad_routes=$("$NODE_BIN" -e '
    const fs=require("fs"), cp=require("child_process");
    const pj=JSON.parse(fs.readFileSync("src/pages.json","utf8"));
    const valid=new Set((pj.pages||[]).map(p=>"/"+p.path));
    let out=""; try{out=cp.execSync("grep -rnE \"/pages/[A-Za-z0-9_/-]+\" src",{encoding:"utf8",maxBuffer:1e8});}catch(e){out=e.stdout||"";}
    const refs=new Set();
    out.split("\n").forEach(line=>{
      const ci=line.indexOf(":", line.indexOf(":")+1);
      const content=ci>=0?line.slice(ci+1):line;
      if(/^\s*(\/\/|\*|<!--|\/\*)/.test(content)) return; // skip comment / doc lines
      (content.match(/\/pages\/[A-Za-z0-9_\/-]+/g)||[]).forEach(m=>refs.add(m.replace(/\/$/,"")));
    });
    const broken=[...refs].filter(r=>!valid.has(r)).sort();
    if(broken.length) process.stdout.write(broken.join(" "));
  ' 2>/dev/null)
  if [ -z "$bad_routes" ]; then ok "nav routes valid (all /pages/ literals exist in pages.json)";
  else bad "INVALID nav routes (navigateTo silently fails): $bad_routes"; fi
}
nav_routes_valid
# User-facing brand must be NOVA, never Stella (已决产品决策 / ALIGNMENT carve-out).
# The AI assistant was renamed Stella→NOVA; code identifiers (nova-bubble.vue,
# useNova, .nx-nova-*) are internal and fine, but no user-VISIBLE "Stella" may
# leak. i18n message VALUES are the authoritative user-facing surface (all copy
# goes through t()), so guard quoted values containing "Stella" there (excluding
# the unrelated 'stellar*' hardware SKU). Keys like `nova: {` aren't quoted values
# so won't match.
no_userfacing_stella() {
  local hits
  hits=$(grep -rnE ':[[:space:]]*"[^"]*[Ss]tella[^"]*"' src/i18n/messages 2>/dev/null | grep -iv 'stellar' | head -8)
  if [ -z "$hits" ]; then ok "no user-facing 'Stella' (brand=NOVA) (0 hits)";
  else bad "user-facing 'Stella' leaked (brand must be NOVA)"; echo "$hits" | sed 's/^/        /'; fi
}
no_userfacing_stella
# Brand rebrand guard (2026-07-22 → NexGrid): 旧品牌词不得回流用户可见/运行时层。
# 白名单:<旧词>-prototype/-uniapp/-admin 溯源引用(注释/路径级工程名)、static/img 旧图文件名。
# i18n messages/tokens.css 也在守备范围(sentinel_absent 的默认排除不适用),故独立实现。
# 旧词用拆词构造,防本文件自指命中(哨兵红测:见 docs/changes/2026-07-22-nexgrid-rebrand.plan.md 总回测)。
no_oldbrand_check() {
  local tok='Nexi'; tok="${tok}on"
  local hits
  # 白名单三类专有名词:①工程/仓库目录名 ②skill 名(注释里引用规范来源合法)
  # ③静态图文件名。除此之外的旧品牌词一律拦。
  # 🔴 不要为「注释引用 PRD 文件名」加白名单:`grep -viE` 是**整行**过滤,
  #    加 `PRD/…` 等于放行「任何提到 PRD 路径的行」,而品牌散文恰恰住在注释里 ——
  #    红测实证:那样改后 5 条真违规只抓得住 1 条(含用户可见 i18n 串与 DOM 文本)。
  #    需要引用带旧品牌前缀的 PRD 文件名时,注释里省略该前缀即可(见本文件 PAY-VN 段)。
  hits=$(grep -rniEI "$tok" src index.html scripts 2>/dev/null \
    | grep -viE "${tok}-(prototype|uniapp|admin)|${tok}-(design|workflow|audit|spec|sprint|prd-sync|uniapp-port|admin-prd)|static/img/[^:]*${tok}" | head -8)
  if [ -z "$hits" ]; then ok "brand: no legacy '${tok}' outside whitelist (0 hits)";
  else bad "brand: legacy '${tok}' residual (rebrand=NexGrid, see docs/changes/2026-07-22-nexgrid-rebrand.md)"; echo "$hits" | sed 's/^/        /'; fi
}
no_oldbrand_check
# Pass A architecture (ALIGNMENT): chassis must keep the sub-page nav-row branch
# (sticky page-header registration) + the store + composable. Losing the nav row
# would silently revert converted sub-pages to scrolling in-page headers.
nav_header_arch() {
  local f="src/components/app-chassis.vue"
  local miss=""
  grep -q 'nx-navheader' "$f" || miss="${miss}chassis-nav-row "
  [ -f "src/store/page-header.ts" ] || miss="${miss}page-header-store "
  [ -f "src/composables/use-page-header.ts" ] || miss="${miss}use-page-header-composable "
  if [ -z "$miss" ]; then ok "page nav-header architecture present (chassis row + store + composable)";
  else bad "page nav-header architecture INCOMPLETE — $miss"; fi
}
nav_header_arch
# Converted sub-pages (those calling useSetPageHeader) must NOT also carry an
# in-page back row (back-chevron glyph 'm15 18-6-6') → that doubles the header;
# nor a page-level position:fixed (escapes the overflow:hidden bezel — the old
# detail.vue bug; bottom CTAs go via useStickyCTA → the chassis <StickyCtaBar>).
converted_pages_clean() {
  local hits=""
  local f
  while IFS= read -r f; do
    if grep -q 'useSetPageHeader' "$f"; then
      grep -q 'm15 18-6-6' "$f" && hits="${hits}${f}: in-page back glyph (double header)\n"
      grep -qE 'position:[[:space:]]*("fixed"|fixed;)' "$f" && hits="${hits}${f}: page-level fixed positioning (use useStickyCTA)\n"
    fi
  done < <(find src/pages -name '*.vue')
  if [ -z "$hits" ]; then ok "converted nav-header pages clean (no double header / no page-level fixed) (0 hits)";
  else bad "converted page issue"; printf "$hits" | sed 's/^/        /'; fi
}
converted_pages_clean
# SubPageHeader (used by ~55 sub-pages) must stay STICKY (position:sticky) so the
# header pins on scroll + frosts content (prototype-faithful). Regressing it to a
# scrolling in-content row silently breaks 吸顶/磨砂 across the whole app. (uni H5:
# a component store-registrar can't re-assert on back-nav — onShow/onActivated
# aren't delivered to child components — so sticky in-content is the mechanism.)
subpage_header_sticky() {
  local f="src/components/sub-page-header.vue"
  [ -f "$f" ] || { bad "sub-page-header.vue missing"; return; }
  if grep -qE 'position:\s*sticky' "$f"; then ok "SubPageHeader sticky (pins + frosts on scroll)";
  else bad "SubPageHeader not sticky (吸顶/磨砂 broken for ~55 pages)"; fi
  # De-card sweep 2026-07-09: .spv margin-bottom is the SINGLE SOURCE of the
  # nav→content 24px breathing for ~55 SubPageHeader pages. If it's removed,
  # every sub-page's header jams against content (the "太紧" regression).
  if grep -qE 'margin-bottom:\s*24px' "$f"; then ok "SubPageHeader nav→content 24px gap (single-source breathing)";
  else bad "SubPageHeader lost margin-bottom:24px (~55 pages jam header against content)"; fi
}
subpage_header_sticky
# Genesis eligibility gate anti-regression (FEAT-GEN08, added 2026-07-09): the
# purchase sheet's confirm handler MUST re-verify eligibility (L3, checkout-F4b
# pattern) and genesis.ts MUST keep the per-user cap guard in BOTH holding-growth
# entry points — purchase() + acquireSecondary() (L4 single source). If a future
# edit silently drops either, scarcity gating degrades to cosmetics — fail loud.
gen_gate_l3=$(grep -c "gate.value.eligible" src/components/genesis/purchase-sheet.vue 2>/dev/null || echo 0)
gen_gate_l4=$(grep -c "GENESIS_ELIGIBILITY.perUserCap" src/store/genesis.ts 2>/dev/null || echo 0)
gen_gate_sec=$(grep -c "gatesSecondary" src/pages/genesis/marketplace.vue 2>/dev/null || echo 0)
if [ "$gen_gate_l3" -ge 1 ] && [ "$gen_gate_l4" -ge 2 ] && [ "$gen_gate_sec" -ge 1 ]; then
  ok "genesis eligibility gate wired (L3 sheet re-verify + L4 cap guard ×$gen_gate_l4 + secondary gate)"
else
  bad "genesis eligibility gate missing (L3=$gen_gate_l3 need >=1, L4=$gen_gate_l4 need >=2, sec=$gen_gate_sec need >=1)"
fi
# Device daily-yield single-source parity (2026-06-18 drift incident): the same
# per-SKU USDT+NEX daily yield is hand-duplicated across FOUR sources with nothing
# deriving one from another — device-types.ts (DEVICE_SPECS → what the user is
# DELIVERED), products.ts (PRODUCTS → what the store card/detail ADVERTISES), the
# i18n VsPhoneHero sublines (phone + S1) and trial-config.ts (shadowDaily* → what
# the free trial advertises, must equal its trialProductId baseline). They
# silently drifted (phone 2≠10, Cloud 1≠3, Pro v2 14.5/100≠14/90) → advertised ≠
# delivered, a trust bug NONE of the sentinels above caught. This asserts the four
# agree; authoritative values = PRD §7.1/§13.3.
device_yield_parity() {
  if "$NODE_BIN" scripts/check-device-yield-parity.mjs >/tmp/uni-yield-parity.log 2>&1; then
    ok "$(cat /tmp/uni-yield-parity.log)"
  else
    bad "device-yield parity (advertised ≠ delivered drift)"; sed 's/^/        /' /tmp/uni-yield-parity.log
  fi
}
device_yield_parity
# 单源锚哨兵 (2026-07-24 platform-stats-single-anchor): every platform-level
# money/fleet display figure derives from src/lib/platform-stats.ts. Four
# mutually-exclusive daily-flow anchors coexisted before ($1.24M/day home card,
# +$215/sec ⇒ $18.6M/day, ref $1.2M/month ⇒ $40k/day, store seed ⇒ $17.2M/day);
# this pins the class shut: legacy literals dead, anchor confined to the lib,
# consumers must import (derive-not-cache), 28,432 keeps exactly ONE role.
platform_stats_anchor() {
  local fails=0 stray n pat
  # (1) legacy mutually-exclusive anchor literals must stay dead in src/
  for pat in '1247893' '1,247,893' '1_247_893' '\$1\.24M' '\+\$215/sec' 'paidToday' 'todayIncrement' 'networkPhones' 'networkHubs' 'paidToCreators' 'leaderboardHint' '(^|[^0-9])8,432' 'jobs/s' '\bq3(Label|Suffix|ReportTitle)' 'Q3_FINANCIALS'; do
    if grep -rqEI "$pat" src 2>/dev/null; then
      bad "platform-anchor: legacy literal /$pat/ resurfaced in src/"; fails=1
    fi
  done
  # (2) anchor literals (682,368 rate & 127,438,905 cumulative seed) only in the lib
  stray=$(grep -rlEI '682368|682,368|682_368|127_438_905|127,438,905|127438905' src 2>/dev/null | grep -v 'lib/platform-stats.ts' || true)
  if [ -n "$stray" ]; then bad "platform-anchor: anchor literal outside lib/platform-stats.ts: $stray"; fails=1; fi
  # (3) 28,432 role-collision guard: allowed ONLY in the lib (fleet anchor)
  stray=$(grep -rlEI '28,432|28432|28_432' src 2>/dev/null | grep -v 'lib/platform-stats\.ts' || true)
  if [ -n "$stray" ]; then bad "platform-anchor: 28,432 outside the anchor lib (role collision): $stray"; fails=1; fi
  # (4) consumers wired to the single source: import present AND anchor symbol consumed
  #     (import-only would let a hardcoded near-value ride under a green light)
  for pair in \
    'src/components/home/network-pulse-card.vue|DAILY_PAYOUT_USD' \
    'src/components/home/on-grid-section.vue|PAYOUT_PER_SEC_USD' \
    'src/pages/onboarding/intro.vue|paidCumulativeNow' \
    'src/pages/ref/code.vue|MONTHLY_NEW_JOINERS' \
    'src/store/app.ts|FLEET_DEVICES'; do
    f="${pair%%|*}"; sym="${pair##*|}"
    if ! grep -q 'from "@/lib/platform-stats"' "$f" 2>/dev/null; then bad "platform-anchor: $f missing platform-stats import"; fails=1; fi
    if [ "$(grep -c "$sym" "$f" 2>/dev/null)" -lt 2 ]; then bad "platform-anchor: $f imports but never consumes $sym"; fails=1; fi
  done
  # (5) monthly-joiners value mirrored: exactly one 41,286 per locale (poster)
  for lf in src/i18n/messages/en.ts src/i18n/messages/zh.ts src/i18n/messages/vi.ts; do
    if [ "$(grep -cF '41,286' "$lf" 2>/dev/null)" -ne 1 ]; then bad "platform-anchor: $lf joiners 41,286 count != 1"; fails=1; fi
  done
  # (6) trust Q2 print ↔ admin managed-content mirror value parity (键 parity ≠ 值 parity)
  ADMIN_ITABS="../Nexion-admin-prototype/app/components/domain-views/i-tabs/data.ts"
  for v in '27,150' '\$47\.0M'; do
    if ! grep -qE "$v" src/pages/trust/trust.vue 2>/dev/null; then bad "platform-anchor: trust.vue missing Q2 print /$v/"; fails=1; fi
    if ! grep -qE "$v" "$ADMIN_ITABS" 2>/dev/null; then bad "platform-anchor: admin i-tabs mirror missing /$v/ (cross-repo drift)"; fails=1; fi
  done
  if [ "$fails" -eq 0 ]; then ok "platform-stats single anchor (legacy 0 · lib-confined · 5 consumers+symbols · joiners 1×3 · trust↔admin Q2 parity)"; fi
}
platform_stats_anchor
# FEAT-DEV01 等效换皮 P0 (2026-07-06): the task-capacity band literals in
# device-lifecycle.ts must reproduce the retired degradation curve EXACTLY
# (0.25-month-step diff<1e-9, floor, exempt kinds, subsidy display-only) and the
# FEAT-DEV02 credit-ladder literal must be structurally sound (starts at 0,
# contiguous, strictly decreasing creditPct, (0,100], open-ended top band).
# Golden lives in the script — an INTENTIONAL schedule retune must update
# golden + admin canon-numbers.json together.
capacity_curve_parity() {
  if "$NODE_BIN" scripts/check-capacity-curve-parity.mjs >/tmp/uni-capacity-parity.log 2>&1; then
    ok "$(cat /tmp/uni-capacity-parity.log)"
  else
    bad "task-capacity curve parity / credit-ladder structure"; sed 's/^/        /' /tmp/uni-capacity-parity.log
  fi
}
capacity_curve_parity

# 首页任务轮播契约(2026-07-16):0/1/2 张后台投影、5s 自动轮播、展开暂停，
# 两卡等高、奖励色统一 NEX 身份紫(--v5-nex, 2026-07-22)、卡面无外边框；独立审计板块不得重新挂回首页。
home_task_carousel_contract() {
  local page="src/pages/index/index.vue"
  local newcomer="src/components/home/day-one-quest-card.vue"
  local weekly="src/components/home/conversion-banner.vue"
  local flags="src/store/config-types.ts"
  local seed="src/mock/platform-config.ts"
  local zh="src/i18n/messages/zh.ts"
  local miss=""
  grep -q '<swiper' "$page" || miss="${miss}swiper "
  grep -q 'v-if="visibleTaskCards.length"' "$page" || miss="${miss}zero-card-hide "
  grep -q ':autoplay="shouldAutoplay"' "$page" || miss="${miss}autoplay-state "
  grep -q ':interval="TASK_CAROUSEL_INTERVAL_MS"' "$page" || miss="${miss}autoplay-interval-bind "
  grep -q 'TASK_CAROUSEL_INTERVAL_MS = 5000' "$page" || miss="${miss}five-second-interval "
  grep -q ':disable-touch="!hasTaskCarousel"' "$page" || miss="${miss}single-card-static "
  grep -q 'onTaskTouchMove' "$page" || miss="${miss}expanded-swipe-collapse "
  grep -q 'taskCarouselAnnouncement' "$page" || miss="${miss}manual-announcement "
  grep -q 'next-margin="0px"' "$page" || miss="${miss}full-width-slide "
  grep -q 'home-task-carousel__meta' "$page" && miss="${miss}page-number-overlay "
  grep -q 'taskSlide + 1' "$page" && miss="${miss}visible-page-number "
  grep -q '<TrustChipWall' "$page" && miss="${miss}independent-audit-still-mounted "
  grep -q 'event: "update:expanded"' "$newcomer" || miss="${miss}controlled-newcomer-expand "
  grep -q 'expanded: false' "$newcomer" || miss="${miss}newcomer-default-collapse "
  grep -q 'height: "var(--home-task-card-height, 184px)"' "$weekly" || miss="${miss}weekly-equal-height "
  grep -q '/static/img/marketing/trial-hero.png' "$weekly" || miss="${miss}weekly-project-machine-asset "
  grep -q 'PRODUCT_MASK' "$weekly" || miss="${miss}weekly-machine-mask "
  grep -q 'radial-gradient(50% 60% at 100% 0%, var(--v5-brand-soft), transparent 70%)' "$weekly" || miss="${miss}weekly-original-background-glow "
  grep -q 'ellipse 200px 250px at 95% 50%' "$weekly" || miss="${miss}weekly-original-machine-fade "
  grep -q 'top: "-36px"' "$weekly" || miss="${miss}weekly-original-machine-top "
  grep -q 'right: "-50px"' "$weekly" || miss="${miss}weekly-original-machine-right "
  grep -q 'width: "220px"' "$weekly" || miss="${miss}weekly-original-machine-width "
  grep -q 'height: "220px"' "$weekly" || miss="${miss}weekly-original-machine-height "
  grep -q 'class="weekly-quest__header"' "$weekly" || miss="${miss}weekly-redesign-header "
  grep -q 'class="weekly-quest__mark"' "$weekly" || miss="${miss}weekly-redesign-icon "
  grep -q 'class="weekly-quest__body"' "$weekly" || miss="${miss}weekly-redesign-body "
  grep -q 'class="weekly-quest__product"' "$weekly" || miss="${miss}weekly-redesign-product-zone "
  grep -q 'weekly-quest__reward-value' "$weekly" || miss="${miss}weekly-reward-style "
  # 2026-07-23 B1:随《02》14 档迁移由 30px 升 h1 34px(主人已批映射表)。
  grep -q 'font-size: 34px' "$weekly" || miss="${miss}weekly-reward-size-drift "
  grep -q 'color: var(--v5-nex)' "$weekly" || miss="${miss}weekly-reward-color-drift "
  grep -q 'font-weight: 500' "$weekly" || miss="${miss}weekly-reward-weight-drift "
  # 2026-07-23 B1:原 pin 硬编码 hex #9B89E0(哨兵把 token 违规固化了);主人批准
  # 补 --v5-quest-violet token 后改 pin token 名 —— 断言强度不变,且不再锁死违规。
  # 2026-07-23 C1:倒计时是**前景文字**,quest 填充档当文字用时亮主题实测 2.98:1 不达 AA
  # → 改走文字档 --v5-quest-violet-ink(亮主题 5.47,暗主题沿用原色不变)。哨兵同步 pin 文字档。
  grep -q 'color: var(--v5-quest-violet-ink)' "$weekly" || miss="${miss}weekly-countdown-color-drift "
  grep -q 'class="weekly-quest__cta"' "$weekly" || miss="${miss}weekly-cta "
  grep -q 'bottom: 14px' "$weekly" || miss="${miss}weekly-cta-bottom-spacing "
  grep -q 'left: 16px' "$weekly" || miss="${miss}weekly-cta-full-width "
  grep -q 'min-height: 44px' "$weekly" || miss="${miss}weekly-cta-tap-height "
  grep -q 'background: var(--v5-brand-soft)' "$weekly" || miss="${miss}weekly-cta-tone "
  grep -q 'boxShadow: "var(--v5-card-shadow-lift)"' "$weekly" && miss="${miss}weekly-card-edge-returned "
  grep -q 'padding-right: 56px' "$weekly" && miss="${miss}weekly-header-padding-drift "
  # 2026-07-23 B1:16px 随《02》14 档迁移降 body.m/number.mono 15px(主人已批映射表)。
  # 色值原为设计稿钦定 hex,2026-07-23 主人批准收敛为 --v5-quest-violet token。
  grep -q 'font-size: 15px; color: var(--v5-quest-violet-ink)' "$newcomer" || miss="${miss}newcomer-countdown-style-drift "
  grep -q 'newcomer-task__reward-value' "$newcomer" || miss="${miss}newcomer-reward-style "
  grep -q 'color: var(--v5-nex)' "$newcomer" || miss="${miss}newcomer-reward-color-drift "
  grep -q 'minHeight: "44px"' "$newcomer" || miss="${miss}newcomer-toggle-height-drift "
  grep -q 'margin: "14px 16px"' "$newcomer" || miss="${miss}newcomer-toggle-spacing-drift "
  grep -q 'boxShadow: "var(--v5-card-shadow-lift)"' "$newcomer" && miss="${miss}newcomer-card-edge-returned "
  grep -q 'padding-right: 56px' "$newcomer" && miss="${miss}newcomer-header-padding-drift "
  grep -q 'homeNewcomerTasksEnabled: boolean' "$flags" || miss="${miss}newcomer-config-flag "
  grep -q 'homeWeeklyPromoEnabled: boolean' "$flags" || miss="${miss}weekly-config-flag "
  grep -q 'homeNewcomerTasksEnabled: true' "$seed" || miss="${miss}newcomer-mock-projection "
  grep -q 'homeWeeklyPromoEnabled: true' "$seed" || miss="${miss}weekly-mock-projection "
  grep -q 'dayOneFirstDayReward: "新手任务"' "$zh" || miss="${miss}newcomer-copy "
  if "$NODE_BIN" <<'NODE' >/tmp/home-task-carousel-relations.log 2>&1; then
const fs = require("fs");
const ts = require("typescript");
const { baseParse, NodeTypes } = require("@vue/compiler-dom");
const page = fs.readFileSync("src/pages/index/index.vue", "utf8");
const script = page.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error("index.vue script setup not found");
const source = ts.createSourceFile("index.ts", script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const compact = (value) => value.replace(/\s+/g, "");
const need = (condition, message) => {
  if (!condition) throw new Error(message);
};
function variable(name) {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) return declaration;
    }
  }
  throw new Error(`variable not found: ${name}`);
}
function functionBody(name) {
  const declaration = source.statements.find(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  if (!declaration?.body) throw new Error(`function not found: ${name}`);
  return declaration.body;
}
function computedCallback(name) {
  const initializer = variable(name).initializer;
  need(ts.isCallExpression(initializer), `${name} must remain a computed call`);
  need(initializer.expression.getText(source) === "computed", `${name} must use computed`);
  const callback = initializer.arguments[0];
  need(ts.isArrowFunction(callback), `${name} computed must use an arrow callback`);
  return callback;
}
function unwrap(expression) {
  while (ts.isParenthesizedExpression(expression)) expression = expression.expression;
  return expression;
}
function flattenAnd(expression) {
  expression = unwrap(expression);
  if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    return [...flattenAnd(expression.left), ...flattenAnd(expression.right)];
  }
  return [compact(expression.getText(source))];
}

const visible = computedCallback("visibleTaskCards");
need(ts.isBlock(visible.body), "visibleTaskCards must keep an explicit derivation block");
need(compact(visible.body.getText(source)) === compact(`{
  if (platformConfig.syncFailed) return [];
  const cards: TaskCardId[] = [];
  if (platformConfig.isEnabled("homeNewcomerTasksEnabled")) cards.push("newcomer");
  if (platformConfig.isEnabled("homeWeeklyPromoEnabled")) cards.push("weekly");
  return cards;
}`), "visibleTaskCards no longer derives exact 0/1/2 state from sync failure + both flags");

const cardinality = computedCallback("hasTaskCarousel");
need(
  !ts.isBlock(cardinality.body) && compact(cardinality.body.getText(source)) === "visibleTaskCards.value.length>1",
  "carousel mode must require more than one visible card",
);

const autoplay = computedCallback("shouldAutoplay");
need(!ts.isBlock(autoplay.body), "shouldAutoplay must remain a direct boolean expression");
const autoplayTerms = flattenAnd(autoplay.body);
need(
  JSON.stringify(autoplayTerms) === JSON.stringify([
    "hasTaskCarousel.value",
    "!newcomerExpanded.value",
    "!prefersReducedMotion.value",
    "!taskFocusWithin.value",
  ]),
  `autoplay guards/operators changed: ${autoplayTerms.join(" | ")}`,
);

const touchStatements = functionBody("onTaskTouchMove").statements.map((statement) => compact(statement.getText(source)));
need(JSON.stringify(touchStatements) === JSON.stringify([
  "if(!taskTouchStart||touchCollapsedExpandedCard)return;",
  "constpoint=readFirstTouch(event);",
  "if(!point)return;",
  "constdx=point.clientX-taskTouchStart.clientX;",
  "constdy=point.clientY-taskTouchStart.clientY;",
  "if(Math.abs(dx)<18||Math.abs(dx)<=Math.abs(dy)*1.15)return;",
  "touchCollapsedExpandedCard=true;",
  "setNewcomerExpanded(false);",
  "blurTaskCarouselFocus();",
]), "touch continuation no longer performs guarded collapse + focus release in reachable order");

const manualCollapseStatements = functionBody("onNewcomerExpandedChange").statements.map((statement) => compact(statement.getText(source)));
need(JSON.stringify(manualCollapseStatements) === JSON.stringify([
  "setNewcomerExpanded(value);",
  "if(!value)blurTaskCarouselFocus();",
]), "manual newcomer collapse no longer releases carousel focus to resume autoplay");

const watcher = source.statements.find((statement) =>
  ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) &&
  statement.expression.expression.getText(source) === "watch" &&
  statement.expression.arguments[0]?.getText(source) === "taskCardSignature"
);
need(watcher, "task-card signature watcher missing");
const watcherCallback = watcher.expression.arguments[1];
need(ts.isArrowFunction(watcherCallback) && ts.isBlock(watcherCallback.body), "task-card signature watcher must use a block callback");
const watcherStatements = watcherCallback.body.statements.map((statement) => compact(statement.getText(source)));
need(JSON.stringify(watcherStatements) === JSON.stringify([
  "taskSlide.value=0;",
  "setNewcomerExpanded(false);",
  "resetTaskTouch();",
  'taskCarouselAnnouncement.value="";',
]), "0/1/2 hot change no longer performs reachable reset in canonical order");

const template = page.match(/<template>([\s\S]*?)<\/template>/)?.[1] || "";
const templateAst = baseParse(template);
function findElement(node, predicate) {
  if (node.type === NodeTypes.ELEMENT && predicate(node)) return node;
  for (const child of node.children || []) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}
function attr(node, name) {
  return node.props.find((prop) => prop.type === NodeTypes.ATTRIBUTE && prop.name === name)?.value?.content;
}
function meaningfulChildren(node) {
  return node.children.filter((child) =>
    child.type !== NodeTypes.COMMENT && !(child.type === NodeTypes.TEXT && child.content.trim() === "")
  );
}
const carouselNode = findElement(templateAst, (node) => attr(node, "id") === "home-task-carousel");
need(carouselNode, "task carousel template region missing");
const carouselChildren = meaningfulChildren(carouselNode);
need(carouselChildren.length === 2 && carouselChildren[0].tag === "swiper" && carouselChildren[1].tag === "text", "carousel gained an extra visible sibling (page/control overlay)");
const swiperChildren = meaningfulChildren(carouselChildren[0]);
need(swiperChildren.length === 1 && swiperChildren[0].tag === "swiper-item", "swiper content structure changed or gained overlay content");
const itemChildren = meaningfulChildren(swiperChildren[0]);
need(itemChildren.length === 1 && itemChildren[0].tag === "view", "swiper item must contain only the task slide wrapper");
const slideChildren = meaningfulChildren(itemChildren[0]);
need(
  slideChildren.length === 2 && slideChildren[0].tag === "DayOneQuestCard" && slideChildren[1].tag === "ConversionBanner",
  "task slide gained visible content outside the two original cards",
);
const statusNode = carouselChildren[1];
need(attr(statusNode, "class") === "home-task-carousel__status" && attr(statusNode, "aria-live") === "polite", "only the hidden screen-reader status may follow swiper");
const statusChildren = meaningfulChildren(statusNode);
need(
  statusChildren.length === 1 && statusChildren[0].type === NodeTypes.INTERPOLATION && statusChildren[0].content.content === "taskCarouselAnnouncement",
  "carousel status must remain the hidden manual-change announcement only",
);
need(!/home-task-carousel__(meta|count|autoplay)/.test(page), "visible page-number or playback overlay returned");
NODE
    :
  else
    miss="${miss}relationship-gate "
    sed 's/^/        /' /tmp/home-task-carousel-relations.log
  fi
  if [ -z "$miss" ]; then ok "home task carousel contract (0/1/2 + 5s + expand pause + equal crop)";
  else bad "home task carousel contract incomplete — $miss"; fi
}
home_task_carousel_contract

# ── 跨仓采样证据门:pages.json 每个页面必须在 admin 仓有 runtime 采样证据 ──
# 单源 = ../Nexion-admin-prototype/scripts/uniapp-port-coverage-audit.mjs(直接调用,
# 不镜像豁免清单/逻辑,防跨仓 parity 漂移);admin 仓不存在(独立打包/CI)则跳过。
# 出处:2026-07-15 device-detail 增页未补采样证据,admin 跨仓齿轮红了一天才被发现。
cross_repo_sampling_gate() {
  local audit_js="$PROJECT_DIR/../Nexion-admin-prototype/scripts/uniapp-port-coverage-audit.mjs"
  local audit_arg="$audit_js"
  if [ ! -f "$audit_js" ]; then
    ok "cross-repo sampling evidence gate skipped (admin repo absent)"
    return
  fi
  # WSL can resolve `node` to Windows node.exe; translate /mnt/* before passing
  # the script path or Node misreads it as D:\mnt\d\... (MODULE_NOT_FOUND).
  if [ "$("$NODE_BIN" -p 'process.platform' 2>/dev/null)" = "win32" ] && command -v wslpath >/dev/null 2>&1; then
    audit_arg=$(wslpath -w "$audit_js")
  fi
  if "$NODE_BIN" "$audit_arg" > /tmp/uniapp-port-coverage-audit.log 2>&1; then
    ok "cross-repo sampling evidence (admin uniapp-port-coverage-audit findings=0)"
  else
    bad "page(s) lack admin-side sampling evidence — 去 ../Nexion-admin-prototype 把新页面加进 docs/audit/l1-shards.json 对应 UNI-FR-* shard,再跑 node scripts/remediation-runtime-front-shard.mjs <SHARD> && node scripts/remediation-runtime-front-action-sample.mjs <SHARD>"
    tail -25 /tmp/uniapp-port-coverage-audit.log | sed 's/^/        /'
  fi
}
cross_repo_sampling_gate

# ── 值域棘轮哨兵(vibe-playbook P2-F 2026-07-22 主人批):档间字号+圆角值集,只拦增量 ──
# 基线 docs/VALUE-LADDER-BASELINE.json;新代码上阶梯(--v5-radius-* / 9 档字号),存量随尺寸迁移工程消化。
value_ladder_gate() {
  if "$NODE_BIN" scripts/value-ladder-sentinel.mjs --selftest > /tmp/uniapp-value-ladder-selftest.log 2>&1; then
    ok "value-ladder selftest(matcher 精度+棘轮方向红测)"
  else
    bad "value-ladder selftest 失败(node scripts/value-ladder-sentinel.mjs --selftest 看明细)"
    tail -4 /tmp/uniapp-value-ladder-selftest.log | sed 's/^/        /'
    return
  fi
  if "$NODE_BIN" scripts/value-ladder-sentinel.mjs > /tmp/uniapp-value-ladder.log 2>&1; then
    ok "value-ladder 档间字号/离散圆角 无增量(基线 docs/VALUE-LADDER-BASELINE.json)"
  else
    bad "value-ladder 增量违例 — node scripts/value-ladder-sentinel.mjs 看明细;新代码用 9 档字号 + var(--v5-radius-*)/阶梯值"
    tail -8 /tmp/uniapp-value-ladder.log | sed 's/^/        /'
  fi
}
value_ladder_gate

# ── token-copy 哨兵(C1 批次 2026-07-23):token 色值被抄成字面量 = 另一主题必失配 ──
# 旧的 hex 哨兵只钉 4 个色号且只认 #RRGGBB,rgba() 形式与变 alpha 副本全在盲区
# (purchase-ticker 注释曾自陈「特意挪值以免触发哨兵」= 被绕过的实证)。
# 本门:亮暗异值 token 全量 × hex 3/6/8 位 + rgb()/rgba() × 忽略 alpha 比 RGB。
# 豁免走 docs/TOKEN-COPY-ALLOWLIST.json(reason 必填,selftest 校验)。
token_copy_gate() {
  if "$NODE_BIN" scripts/token-copy-sentinel.mjs --selftest > /tmp/uniapp-token-copy-selftest.log 2>&1; then
    ok "token-copy selftest(双向红测:hex/rgb/rgba/变alpha 阳性全中 + 真灰/注释/color-mix 全 0)"
  else
    bad "token-copy selftest 失败(哨兵失效即门失效;node scripts/token-copy-sentinel.mjs --selftest 看明细)"
    tail -6 /tmp/uniapp-token-copy-selftest.log | sed 's/^/        /'
    return
  fi
  if "$NODE_BIN" scripts/token-copy-sentinel.mjs > /tmp/uniapp-token-copy.log 2>&1; then
    ok "$(tail -1 /tmp/uniapp-token-copy.log)"
  else
    bad "token 色值字面副本 — 改 var(--token) 或 color-mix(in srgb, var(--token) N%, transparent)"
    tail -12 /tmp/uniapp-token-copy.log | sed 's/^/        /'
  fi
}
token_copy_gate

# ── 遮罩单源哨兵(C1 批次 2026-07-23):弹层遮罩底色必须走 var(--v5-bg-color-mask) ──
# 起因:清遮罩时用「值」匹配(grep 特定 rgba)只捞到 9/20,漏的 11 个写的是别的值。
# 用值找「扮演某角色的东西」必漏 —— 本门改按角色判(选择器 *-backdrop/*-mask + 内联铺满覆盖层)。
scrim_gate() {
  if "$NODE_BIN" scripts/scrim-single-source.mjs --selftest > /tmp/uniapp-scrim-selftest.log 2>&1; then
    ok "scrim selftest(双向红测:5 种字面值形态阳性全中 + token/非遮罩/注释/渐变全 0)"
  else
    bad "scrim selftest 失败(node scripts/scrim-single-source.mjs --selftest 看明细)"
    tail -6 /tmp/uniapp-scrim-selftest.log | sed 's/^/        /'
    return
  fi
  if "$NODE_BIN" scripts/scrim-single-source.mjs > /tmp/uniapp-scrim.log 2>&1; then
    ok "$(tail -1 /tmp/uniapp-scrim.log)"
  else
    bad "弹层遮罩底色未走单源 token"
    tail -10 /tmp/uniapp-scrim.log | sed 's/^/        /'
  fi
}
scrim_gate

# ── 双主题恒定着色 · 运行时正交门(C1 批次 2026-07-23) ──
# 上面两道是静态门,只能钉「我已经想到的写法」。本批同一个坑连踩三次(按值比 token 漏变
# alpha 副本 / 按值 grep 遮罩漏 11 个 / 按值 grep 网格线漏 2 个),根因都是「用值找角色」。
# 本门换正交维度:不问源码怎么写,只问渲染出来跟不跟主题 —— 双主题 computed 完全相同
# 的有色元素即嫌疑。存量走棘轮 docs/THEME-CONSTANT-BASELINE.json,只拦新增。
theme_constant_gate() {
  if "$NODE_BIN" scripts/theme-constant-gate.mjs --selftest > /tmp/uniapp-theme-const-selftest.log 2>&1; then
    ok "theme-constant selftest(判定纯函数双向红测 + 恒定 token 放行)"
  else
    bad "theme-constant selftest 失败(node scripts/theme-constant-gate.mjs --selftest 看明细)"
    tail -6 /tmp/uniapp-theme-const-selftest.log | sed 's/^/        /'
    return
  fi
  if "$NODE_BIN" scripts/theme-constant-gate.mjs > /tmp/uniapp-theme-const.log 2>&1; then
    ok "$(tail -1 /tmp/uniapp-theme-const.log)"
  else
    bad "新增「双主题恒定」着色元素 — 该元素亮/暗渲染出来一个色 = 没跟主题"
    tail -10 /tmp/uniapp-theme-const.log | sed 's/^/        /'
  fi
}
theme_constant_gate

# ── 零-border 铁律 · 运行时门(C2 批次 2026-07-23) ──
# 《03》§3:带 bg 填充的卡片/板块一律零 border,border 只属透明容器(分组 hairline /
# empty-state 虚线);§4:玻璃 chrome(TabBar/Header/浮层)不在此约束内。
# 同样走运行时判(C1 教训:静态 grep 只能钉想到的写法);门内建 3 条规范自带豁免。
zero_border_gate() {
  if "$NODE_BIN" scripts/zero-border-gate.mjs --selftest > /tmp/uniapp-zero-border-selftest.log 2>&1; then
    ok "zero-border selftest(双向红测:实底/tint/渐变+四边框阳性全中 + 透明底/虚线/chrome/隔离环全 0)"
  else
    bad "zero-border selftest 失败(node scripts/zero-border-gate.mjs --selftest 看明细)"
    tail -6 /tmp/uniapp-zero-border-selftest.log | sed 's/^/        /'
    return
  fi
  if "$NODE_BIN" scripts/zero-border-gate.mjs > /tmp/uniapp-zero-border.log 2>&1; then
    ok "$(tail -1 /tmp/uniapp-zero-border.log)"
  else
    bad "新增「有填充 + 四边描边」容器 — 《03》§3 层级靠 surface 微差色,不靠描边"
    tail -10 /tmp/uniapp-zero-border.log | sed 's/^/        /'
  fi
}
zero_border_gate

# ── DOM-QA 体检哨兵(vibe-playbook P1-A 2026-07-22 主人批):5 探针事实层 ──
# ① 横向溢出 ② 文字<10px(10-12 普查不 gate) ③ tap<44pt ④ img broken ⑤ 按钮无可达名。
# 存量黄灯 = docs/DOM-QA-LEDGER.json;gate 只拦 ledger 外新指纹(新页/改动页硬门)。
# 豁免 = 人工审阅后 --update-ledger 收编 + entry 写 qaOk 理由。selftest = 哨兵自身双向红测。
dom_qa_gate() {
  if "$NODE_BIN" scripts/dom-qa.mjs --selftest > /tmp/uniapp-dom-qa-selftest.log 2>&1; then
    ok "dom-qa selftest(双向红测:5 类阳性全中 + 干净 fixture 0)"
  else
    bad "dom-qa selftest 失败(探针失效即门失效;node scripts/dom-qa.mjs --selftest 看明细)"
    tail -5 /tmp/uniapp-dom-qa-selftest.log | sed 's/^/        /'
    return
  fi
  if "$NODE_BIN" scripts/dom-qa.mjs --sweep core > /tmp/uniapp-dom-qa.log 2>&1; then
    ok "dom-qa core(5 tab)无新 DOM 违例(存量黄灯见 docs/DOM-QA-LEDGER.json)"
  else
    bad "dom-qa 新 DOM 违例 — node scripts/dom-qa.mjs --sweep core 看明细;确属合法例外 → --update-ledger 收编并写 qaOk 理由"
    tail -12 /tmp/uniapp-dom-qa.log | sed 's/^/        /'
  fi
}
dom_qa_gate

# ── tap 目标哨兵(C3 2026-07-23):热区 ≥44pt + 按下有可感知反馈 ──
# 与 dom-qa 的 tap 探针**互补不重复**:dom-qa 靠「交互标签/role + cursor:pointer」找候选,
# 而 uni-app 的 <view @click> 编译成 <uni-view> 且不带 cursor:pointer —— 那条路对本工程系统性漏检。
# 本哨兵在页面脚本前 hook addEventListener,拿的是运行时真注册了 click 的元素;
# 反馈判定走 CDP CSS.forcePseudoState 实测(不是 grep class,声明了但被 inline style 压掉的会被抓出来)。
# 存量黄灯 = docs/TAP-FEEDBACK-LEDGER.json;豁免 = --update-ledger 收编 + entry 写 tapOk 理由。
tap_feedback_gate() {
  if "$NODE_BIN" scripts/tap-feedback-probe.mjs --selftest > /tmp/uniapp-tap-selftest.log 2>&1; then
    ok "tap-feedback selftest(双向红测:尺寸/反馈阳性全中 + 过渡·祖先链·不可点三类假阳 0)"
  else
    bad "tap-feedback selftest 失败(探针失效即门失效;node scripts/tap-feedback-probe.mjs --selftest 看明细)"
    tail -6 /tmp/uniapp-tap-selftest.log | sed 's/^/        /'
    return
  fi
  if "$NODE_BIN" scripts/tap-feedback-probe.mjs > /tmp/uniapp-tap.log 2>&1; then
    ok "$(tail -1 /tmp/uniapp-tap.log)"
  else
    bad "tap 目标新违例 — node scripts/tap-feedback-probe.mjs 看明细;热区补到 44 或按《08》§2 加 active 反馈,确属豁免 → --update-ledger 收编并写 tapOk 理由"
    tail -12 /tmp/uniapp-tap.log | sed 's/^/        /'
  fi
}
tap_feedback_gate

# ── 标签内注释哨兵(2026-07-23):HTML 注释卡在标签属性之间 = Vue 模板非法位置 ──
# vue-tsc 不报(只看类型)、浏览器多数时候也照常渲染 → 人眼与既有门双双测不到,归机器层。
tag_comment_gate() {
  if "$NODE_BIN" scripts/tag-comment-gate.mjs --selftest > /tmp/uniapp-tagcomment-selftest.log 2>&1; then
    ok "tag-comment selftest(标签内阳性中 + 标签外/子元素间假阳 0)"
  else
    bad "tag-comment selftest 失败(node scripts/tag-comment-gate.mjs --selftest 看明细)"
    tail -4 /tmp/uniapp-tagcomment-selftest.log | sed 's/^/        /'
    return
  fi
  if "$NODE_BIN" scripts/tag-comment-gate.mjs > /tmp/uniapp-tagcomment.log 2>&1; then
    ok "$(tail -1 /tmp/uniapp-tagcomment.log)"
  else
    bad "注释卡在标签属性之间 — 挪到标签外那一行"
    tail -8 /tmp/uniapp-tagcomment.log | sed 's/^/        /'
  fi
}
tag_comment_gate

# ── 空状态哨兵(C5 2026-07-23):《06》缺省页体系真的渲染得出来 ──
# 强制清空所有 store 的数组字段让空态显形,逐页断言:插画真加载(naturalWidth>0)+ 标题非空
# + 不溢出 + 无 console error。「接上了组件」和「空态真能显示」是两回事。
empty_state_gate() {
  if "$NODE_BIN" scripts/empty-state-probe.mjs > /tmp/uniapp-empty-state.log 2>&1; then
    ok "$(tail -1 /tmp/uniapp-empty-state.log)"
  else
    bad "空状态渲染失败 — node scripts/empty-state-probe.mjs 看明细(插画路径 / 标题 key / 布局溢出)"
    grep -E "^FAIL" /tmp/uniapp-empty-state.log | head -8 | sed 's/^/        /'
  fi
}
empty_state_gate

echo -e "${C}━━ result: ${G}$pass pass${N}, $( [ $fail -gt 0 ] && echo -e "${R}$fail fail${N}" || echo -e "${G}0 fail${N}" ) ━━"
[ $fail -eq 0 ]
