#!/usr/bin/env bash
# Nexion uni-app port verifier — the "自测" stage of the nexion-uniapp-port loop.
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

echo -e "${C}━━ Nexion uni-app verify · module=$MODULE ━━${N}"

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
# token discipline: no hardcoded v5 light hex in components (use var(--v5-*))
sentinel_absent "no hardcoded #0E48E6/#F4F1E9 hex"  '#0E48E6|#F4F1E9|#FF5A1F|#13141A'
# ── SPEC-1 载体分层 + 服务端结算解耦 sentinels ──
# carrier-tiering: hashpower MUST keep the H5 base-hosting branch (防回退到 App/H5 同口径)
sentinel_present "SPEC-1 carrier-tiering: H5 base-hosting branch" src/lib/hashpower.ts 'carrier === "h5"'
sentinel_present "SPEC-1 carrier-tiering: H5_BASE_FACTOR present" src/lib/hashpower.ts 'H5_BASE_FACTOR'
sentinel_present "SPEC-1 carrier single-source: #ifdef APP-PLUS" src/lib/carrier.ts '#ifdef APP-PLUS'
# settle-single-source: earnings accrue by WALL-CLOCK Δ via settleDevice (not tick-time / fixed window)
sentinel_present "SPEC-1 settle: settleDevice exists" src/store/app.ts 'function settleDevice'
sentinel_present "SPEC-1 settle: wall-clock lastSettledAt anchor" src/store/app.ts 'now - d\.lastSettledAt'
sentinel_present "SPEC-1 settle: Device.lastSettledAt typed" src/store/types.ts 'lastSettledAt'
# single accrual source: the baseRate accrual must appear EXACTLY once (no 2nd bypass)
SPEC1_ACC=$(grep -cE 'd\.baseRate \* lifeEff \* phoneFactor' src/store/app.ts 2>/dev/null)
if [ "$SPEC1_ACC" = "1" ]; then ok "SPEC-1 settle single-source: 1 accrual site"; else bad "SPEC-1 settle: expected 1 accrual site, found $SPEC1_ACC"; fi
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
sentinel_present "SPEC-7 risk registry isolated storage" src/store/risk-identity.ts 'nexion-risk-registry-v1'
sentinel_present "SPEC-7 registry tracks first withdrawal (R2)" src/store/risk-identity.ts 'hasWithdrawn'
sentinel_present "SPEC-7 registry tracks attestation" src/store/risk-identity.ts 'attestedOnlineMs'
sentinel_present "SPEC-7 realtime cluster evaluator (R5)" src/store/risk-cluster.ts 'export function evaluateAccountCluster'
sentinel_present "SPEC-7 multi-dimension clustering (R3)" src/store/risk-cluster.ts 'function dimensionHits'
sentinel_present "SPEC-7 bare identity enters watch (R3)" src/store/risk-cluster.ts 'bare-identity'
sentinel_present "SPEC-7 unbound free slot pends (R4)" src/store/risk-cluster.ts 'unbound-free-slot'
sentinel_present "SPEC-7 release ledger exists (R1)" src/store/earning-release.ts 'nexion-earning-ledger-v1'
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
sentinel_present "SPEC-7 register honors signup gate" src/pages/register/register.vue 'gateRoute === "manual_or_reject"'
sentinel_present "SPEC-7 register OTP verify is async with loading state" src/pages/register/register.vue 'verifying\.value = true'
sentinel_present "SPEC-7 register review copy is reason-aware" src/pages/register/register.vue 'rewardReviewBodyUnbound'
sentinel_present "SPEC-7 register commits identity" src/pages/register/register.vue 'commitRegistration\(identity'
sentinel_present "SPEC-7 welcome gift routes through buckets (R6)" src/pages/register/register.vue 'creditRewardBucket\(assessment\.giftRoute'
sentinel_present "SPEC-7 welcome gift claimed per account" src/pages/register/register.vue 'claimGift\(identity\)'
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
sentinel_present "SPEC-7 wallet pending bucket info sheet" src/pages/me/wallet.vue 'pendingSheetTitle'
sentinel_present "SPEC-7 wallet reasons mapped via i18n (no raw codes)" src/pages/me/wallet.vue 't\.value\.wallet\.riskReasons'
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
sentinel_present "SPEC-7 tracking maps risk reasons via i18n" src/pages/me/wallet-withdraw-tracking.vue 't\.value\.wallet\.riskReasons'
sentinel_present "SPEC-7 tracking has frozen hold variant" src/pages/me/wallet-withdraw-tracking.vue 'routeHeldFrozenTitle'
sentinel_present "SPEC-7 pairing registers payment instrument" src/pages/me/wallet-topup.vue 'recordPaymentInstrument\(app\.accountKey'
sentinel_present "SPEC-7 reject route never debits" src/store/app.ts 'if \(riskRoute === "reject"\) return null'
sentinel_present "SPEC-7 risk route maps to queue status" src/store/app.ts 'riskRoute === "freeze" \? "frozen"'
sentinel_present "SPEC-7 withdrawal debits withdrawable bucket" src/store/app.ts 'withdrawableUsdt: \+\(currentUser\.earningBuckets\.withdrawableUsdt - amount\)'
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
    const body=fs.readFileSync("src/components/entry-surfaces/entry-surface-home.vue","utf8")+index;
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
# ── SPEC-4 account-cloud + multi-carrier session sentinels ──
sentinel_present "SPEC-4 account-cloud storage exists" src/store/account-cloud.ts 'nexion-account-cloud-v1'
sentinel_present "SPEC-4 app binds account snapshot" src/store/app.ts 'function bindAccount'
sentinel_present "SPEC-4 app persists account snapshot" src/store/app.ts 'function persistAccountSnapshot'
sentinel_present "SPEC-4 login binds account before session claim" src/pages/login/login.vue 'app\.bindAccount\(identity\)'
sentinel_present "SPEC-4 register binds account before rewards" src/pages/register/register.vue 'app\.bindAccount\(identity\)'
sentinel_present "SPEC-4 entry surface supports white-app carrier" src/lib/entry-surface.ts '"white-app"'
sentinel_present "SPEC-4 session registry storage exists" src/store/session.ts 'nexion-account-sessions-v1'
sentinel_present "SPEC-4 security page uses live session registry" src/pages/me/security.vue 'session\.activeSessions'
spec4_account_session_semantics() {
  if "$NODE_BIN" -e '
    const fs=require("fs");
    const session=fs.readFileSync("src/store/session.ts","utf8");
    const app=fs.readFileSync("src/store/app.ts","utf8");
    const appVue=fs.readFileSync("src/App.vue","utf8");
    const login=fs.readFileSync("src/pages/login/login.vue","utf8");
    const register=fs.readFileSync("src/pages/register/register.vue","utf8");
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
    if(!/mergeAndWriteAccountSnapshot\(lastCloudSnapshot, snapshot\)/.test(app)) throw new Error("account snapshot is not merged through app store");
    if(!/adoptAccountSnapshot\(merged\)/.test(app)) throw new Error("merged account snapshot is not adopted back into app state");
    if(!/accountKey,\s*entrySurface,\s*accountCloudUpdatedAt/.test(app)) throw new Error("account cloud state is not returned to consumers");
    if(!/auth\.signIn\(identity\)[\s\S]*app\.bindAccount\(identity\)[\s\S]*session\.claim\(identity\)/.test(login)) throw new Error("login must bind account before session claim");
    if(!/auth\.signUp\(identity\)[\s\S]*app\.bindAccount\(identity\)[\s\S]*session\.claim\(identity\)/.test(register)) throw new Error("register must bind account before rewards/session flow");
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
}
subpage_header_sticky
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

echo -e "${C}━━ result: ${G}$pass pass${N}, $( [ $fail -gt 0 ] && echo -e "${R}$fail fail${N}" || echo -e "${G}0 fail${N}" ) ━━"
[ $fail -eq 0 ]
