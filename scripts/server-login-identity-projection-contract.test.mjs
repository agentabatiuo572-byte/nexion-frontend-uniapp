import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("server login consumes the authoritative user returned by authentication", () => {
  const login = read("src/pages/login/login.vue");
  const completion = read("src/auth/complete-sign-in.ts");
  assert.match(login, /finishSignIn\(\{[\s\S]*?serverProfile:\s*result\.user/);
  assert.match(completion, /serverProfile\?:\s*UserSession/);
  assert.match(completion, /SERVER_PROFILE_REQUIRED/);
  assert.match(completion, /app\.projectServerIdentity\(options\.serverProfile\)/);
  assert.match(completion, /useProfile\(\)\.projectServerIdentity\(options\.serverProfile\)/);
});

test("server mode clears local profile data and the profile row cannot render a seed identity", () => {
  const profile = read("src/store/profile.ts");
  const row = read("src/components/me/profile-row.vue");
  const profilePage = read("src/pages/me/profile.vue");
  assert.match(profile, /if \(remoteApiEnabled\) \{[\s\S]*?displayName\.value = ""/);
  assert.match(profile, /function projectServerIdentity\(identity: UserSession\)/);
  assert.doesNotMatch(row, /\+1 \(415\)/);
  assert.doesNotMatch(row, /\}\}\s*· US/);
  assert.match(row, /profile\.phoneE164/);
  assert.match(profilePage, /remoteApiEnabled \? profile\.phoneE164/);
});

test("first server-mode profile render uses the projected name and masked E.164 phone, or an honest blank", () => {
  const me = read("src/pages/me/me.vue");
  const row = read("src/components/me/profile-row.vue");
  assert.match(me, /import ProfileRow from "@\/components\/me\/profile-row\.vue"/);
  assert.match(me, /<ProfileRow\s*\/>/);
  assert.match(row, /const name = computed\(\(\) => profile\.displayName\)/);
  assert.match(row, /const phoneMask = computed\(\(\) => \{[\s\S]*?if \(!phone\) return ""/);
  assert.match(row, /\$\{phone\.slice\(0, 3\)\} ••••• \$\{phone\.slice\(-4\)\}/);
  // Remote mode must not fall back to a browser-owned user:<id> seed.
  assert.match(row, /remoteApiEnabled \? profile\.phoneE164\.replace\(\/\\D\/g, ""\) : app\.user\.email/);
  assert.match(row, /v-if="!remoteApiEnabled"/);
});

test("App bootstrap reprojects the in-memory server user after account-store rebinding", () => {
  const app = read("src/App.vue");
  assert.match(app, /import \{ useProfile \} from "@\/store\/profile"/);
  assert.match(app, /app\.bindAccount\(key\);[\s\S]*?rebindAccountScopedStores\(key\);[\s\S]*?sessionVault\.read\(\)/);
  assert.match(app, /useProfile\(\)\.projectServerIdentity\(serverSession\.user\)/);
  assert.match(app, /app\.projectServerIdentity\(serverSession\.user\)/);
});
