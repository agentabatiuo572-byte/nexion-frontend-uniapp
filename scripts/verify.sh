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
# token discipline: no hardcoded v5 light hex in components (use var(--v5-*))
sentinel_absent "no hardcoded #0E48E6/#F4F1E9 hex"  '#0E48E6|#F4F1E9|#FF5A1F|#13141A'
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
