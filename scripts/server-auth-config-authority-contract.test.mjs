import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("server mode starts unauthenticated and only retains a non-secret recovery trace", () => {
  const auth = read("src/store/auth.ts");
  const vault = read("src/api/session-vault.ts");

  assert.match(auth, /import \{ remoteApiEnabled \} from "@\/api\/runtime"/);
  assert.match(auth, /function hydrate\(\): Persisted \{[\s\S]*?if \(remoteApiEnabled\) \{[\s\S]*?isAuthenticated: false[\s\S]*?accountId: "default"/);
  assert.match(auth, /hasPersistedServerAuthenticatedAccountTrace[\s\S]*?startsWith\("user:"\)/);
  assert.match(vault, /createRuntimeSessionVault\(\): SessionVault \{[\s\S]*?return createSessionVault\(\);/);
  assert.doesNotMatch(vault, /accessToken:\s*snapshot\.accessToken/,
    "the H5 persistence format must never contain a Bearer token");
});

test("explicit logout revokes the remote refresh session before local state is cleared", () => {
  const me = read("src/pages/me/me.vue");

  assert.match(me, /import \{ authApi, remoteApiEnabled \} from "@\/api\/runtime"/);
  assert.match(me, /async function handleSignOut\(\)[\s\S]*?if \(remoteApiEnabled\) await authApi\.logout\(\);[\s\S]*?session\.signOutSession\(\);[\s\S]*?auth\.signOut\(\);/);
});

test("remote configuration loads are authoritative and remote writes do not revive local tables", () => {
  const config = read("src/store/config.ts");
  const rank = read("src/store/v-rank.ts");
  const commission = read("src/store/commission.ts");
  const staking = read("src/store/staking.ts");
  const earnConfig = read("src/store/earn-config.ts");
  const phoneTiers = read("src/mock/phone-tiers.ts");
  const app = read("src/App.vue");
  const accountScope = read("src/lib/account-scope.ts");
  const repurchase = read("src/store/repurchase.ts");

  assert.match(config, /if \(!remoteApiEnabled\) \{[\s\S]*?syncFailed\.value = false[\s\S]*?return;/);
  assert.match(config, /const config = ref<PlatformConfig>\(remoteApiEnabled \? unavailableServerConfig : mockConfig\)/);
  assert.match(config, /rewards:\s*remote\.rewards/);
  assert.match(config, /if \(remoteApiEnabled \|\| IS_PRODUCTION\) return;/);
  assert.match(config, /const remote = await platformConfigApi\.platformConfig\(\);[\s\S]*?config\.value = \{[\s\S]*?featureFlags: \{ \.\.\.config\.value\.featureFlags, \.\.\.remote\.featureFlags \}[\s\S]*?publicStats: remote\.publicStats[\s\S]*?onlineBonus: remote\.onlineBonus[\s\S]*?rewards: remote\.rewards[\s\S]*?computeShare: remote\.computeShare/);
  assert.match(config, /catch \{[\s\S]*?syncFailed\.value = true/);
  assert.match(rank, /function setMyRank\(v: VRank\) \{[\s\S]*?if \(remoteApiEnabled\) return;/);
  assert.match(rank, /function bindAccount\([\s\S]*?if \(remoteApiEnabled\) \{[\s\S]*?myRank\.value = 0;[\s\S]*?ladder\.value = \[\];[\s\S]*?void refreshCanonicalVRank\(\)/);
  assert.match(rank, /function setProgress\(p: VRankProgressPatch\) \{[\s\S]*?if \(remoteApiEnabled\) return;/);
  assert.match(commission, /function withdraw\(id: string\): boolean \{[\s\S]*?if \(remoteApiEnabled\) return false;/);
  assert.match(staking, /async function openRemote\([\s\S]*?if \(!remoteReady\.value\) throw new Error\("G1_REMOTE_AUTHORITY_UNAVAILABLE"\);/);
  assert.match(staking, /const boot = remoteApiEnabled \? \{ positions: \[\], rev: 0 \} : hydrate\(boundKey\)/);
  assert.match(staking, /function bindAccount\([\s\S]*?if \(remoteApiEnabled\) \{[\s\S]*?clearRemoteState\(\);[\s\S]*?void syncRemote\(\)\.catch/);
  assert.match(staking, /const pool = pools\.value\.find\(\(row\) => row\.tierKey === tierKey && row\.enabled\);[\s\S]*?if \(!pool \|\| amountUsdt < pool\.minAmountUsdt\) throw new Error\("G1_REMOTE_AUTHORITY_UNAVAILABLE"\);/);
  assert.match(earnConfig, /if \(remoteApiEnabled\) applyCanonicalPhoneTierYields\(\[\]\);/);
  assert.match(earnConfig, /catch \(cause\) \{[\s\S]*?phoneTiers\.value = null;[\s\S]*?applyCanonicalPhoneTierYields\(\[\]\);/);
  assert.match(phoneTiers, /\?\? \{ baseRateUsdt: 0, baseRateNex: 0 \}/);
  assert.match(app, /if \(remoteApiEnabled\) \{[\s\S]*?void refreshEarnConfig\(\)\.catch[\s\S]*?void useMarket\(\)\.syncRemote\(\)\.catch/);
  assert.match(accountScope, /useRepurchase\(\)\.bindAccount\(\);/);
  assert.match(repurchase, /async function refresh\(\) \{[\s\S]*?if \(!remoteApiEnabled\) \{[\s\S]*?config\.value = null[\s\S]*?orders\.value = \[\][\s\S]*?return null;/);
  assert.match(repurchase, /async function open\(amountUsdt: number\) \{[\s\S]*?if \(!remoteApiEnabled\) throw new Error\("REPURCHASE_REMOTE_AUTHORITY_REQUIRED"\);/);
  assert.match(repurchase, /function bindAccount\(\) \{[\s\S]*?pendingKeys\.clear\(\);[\s\S]*?if \(remoteApiEnabled\) void refresh\(\)\.catch/);
});

test("remote-only policy branches stay inert until a dedicated server contract exists", () => {
  const config = read("src/store/config.ts");
  const login = read("src/pages/login/login.vue");
  const share = read("src/lib/share.ts");

  // The public E6/H8 projection does not contain K/D5 risk, OTP, or share
  // policy.  Its pending snapshot must explicitly close those branches rather
  // than spreading DEFAULT_PLATFORM_CONFIG through remote mode.
  assert.match(config, /const unavailableServerConfig: PlatformConfig = \{[\s\S]*?riskCluster: \{[\s\S]*?releaseMode: "manual_only"[\s\S]*?withdrawRules: \{[\s\S]*?sameAddressRoute: "reject"[\s\S]*?dailyWithdrawLimitCount: 0[\s\S]*?riskScore: \{[\s\S]*?weakSignalClusterThreshold: 0[\s\S]*?otpGate: \{[\s\S]*?maxVerifyAttempts: 0[\s\S]*?share: \{[\s\S]*?channels: \[\]/);
  assert.match(login, /import \{ authApi, remoteApiEnabled \} from "@\/api\/runtime"/);
  assert.match(login, /async function requestCode\(captchaTicket\?: string\) \{[\s\S]*?if \(remoteApiEnabled\) \{[\s\S]*?error\.value = t\.value\.authOtp\.errorServiceUnavailable;[\s\S]*?return;/);
  assert.match(login, /async function verifyCode\(\) \{[\s\S]*?if \(remoteTwoFactorChallenge\.value\) \{ await verifyRemoteTwoFactor\(\); return; \}[\s\S]*?if \(remoteApiEnabled\) \{[\s\S]*?error\.value = t\.value\.authOtp\.errorServiceUnavailable;/);
  assert.match(share, /export function buildShareLink[\s\S]*?if \(remoteApiEnabled\) \{[\s\S]*?location\.origin[\s\S]*?return "";/);
  assert.match(share, /export function buildShareText\(\): string \{[\s\S]*?if \(remoteApiEnabled\) return "";/);
  assert.match(share, /export function visibleChannels\(\): ShareChannelDef\[\] \{[\s\S]*?if \(remoteApiEnabled\) return \[\];/);
});
