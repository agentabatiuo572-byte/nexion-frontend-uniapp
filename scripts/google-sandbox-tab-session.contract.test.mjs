import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("an authenticated route cannot treat a missing carrier session as active", () => {
  const session = read("src/store/session.ts");

  // A Google Sandbox first-user tab click can land in the App guard while a
  // carrier session is still being restored.  `sessionId === ""` is not an
  // active session: accepting it lets a broken restore continue rendering a
  // protected tab, while a later auth callback can evict the whole app to the
  // onboarding shell.  The guard must fail closed and use its kicked/session
  // recovery route instead.
  const missingSession = session.slice(session.indexOf("function validate(): SessionStatus"), session.indexOf("const registry", session.indexOf("function validate(): SessionStatus")));
  assert.match(missingSession, /if \(!remoteApiEnabled\)[\s\S]*?status\.value = "active";\s*return "active";/,
    "the standalone mock runtime keeps its intentional demo bootstrap");
  assert.match(missingSession, /if \(!remoteApiEnabled\)[\s\S]*?return "active";[\s\S]*?status\.value = "logged-out";\s*kickedReason\.value = "logged-out";\s*return "logged-out";/,
    "remote mode must fail closed when the carrier session is absent");
});

test("visible tab navigation uses the shared route primitive", () => {
  const chassis = read("src/components/app-chassis.vue");
  assert.match(chassis, /function go\(tab: \{ key: string; route: string \}\) \{[\s\S]*?navTo\(tab\.route\)/);
});
