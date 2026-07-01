import { defineStore } from "pinia";
import { ref } from "vue";
import { getDeviceIdentity, _devResetDeviceIdentity } from "@/lib/device-id";
import { mockServerUuid } from "./mock-id";

/**
 * Login session + device-binding store — powers single-device login,
 * task-interrupt-on-eviction, and new-device recalibration.
 *
 * THE MODEL (mock of a server session table):
 * A single shared record `nexion-active-session-v1` represents "which session
 * currently owns the account" (the server's canonical record). Each login mints
 * a fresh sessionId and OVERWRITES that record → a new login supersedes the old
 * one (single device). Every tab/device holds its own sessionId in memory and
 * polls/watches the shared record; if the record's sessionId no longer matches
 * its own (another device claimed it) or carries a killedAt (admin revoked /
 * logged out), that tab is "kicked".
 *
 * Composition note: stores never import each other (codebase invariant). The
 * login/register pages, App.vue, and the sign-out handlers COMPOSE this store
 * with useApp() (interruptAllTasks/resumeMining) and useAuth() — this store
 * stays dependency-free except for the device-id lib.
 *
 * ⚠️ MOCK-ONLY → backend-replaceable contract:
 *   POST /api/auth/signin  → { token, sessionId, deviceId, requiresRecalibration }
 *                            (server invalidates any prior session = single device)
 *   GET  /api/auth/session → { sessionId, status, killedAt }  (poll/heartbeat; this
 *                            store's validate() mirrors it client-side)
 *   POST /api/auth/logout  → clears the server session
 *   Admin `A.session.user.<uid>.killedAt` (ops console) → maps to record.killedAt
 *                            → validate() detects the revoke on the next poll.
 */

const ACTIVE_KEY = "nexion-active-session-v1";
const CALIBRATED_KEY = "nexion-calibrated-device-v1"; // { [accountKey]: deviceId }

export type SessionStatus = "active" | "kicked" | "logged-out";
export type KickReason = "kicked" | "logged-out" | null;

export interface ActiveSessionRecord {
  sessionId: string;
  deviceId: string;
  deviceName: string;
  loginAt: number;
  /** Set when the session is force-revoked (admin/ops or self logout). */
  killedAt?: number | null;
}

function readActiveRecord(): ActiveSessionRecord | null {
  try {
    const r = uni.getStorageSync(ACTIVE_KEY) as ActiveSessionRecord | "";
    if (r && typeof r === "object" && r.sessionId) return r;
  } catch {
    // ignore
  }
  return null;
}

function writeActiveRecord(rec: ActiveSessionRecord | null): void {
  try {
    if (rec === null) uni.removeStorageSync(ACTIVE_KEY);
    else uni.setStorageSync(ACTIVE_KEY, rec);
  } catch {
    // ignore
  }
}

function readCalibratedMap(): Record<string, string> {
  try {
    const m = uni.getStorageSync(CALIBRATED_KEY) as Record<string, string> | "";
    if (m && typeof m === "object") return m;
  } catch {
    // ignore
  }
  return {};
}

function writeCalibratedMap(m: Record<string, string>): void {
  try {
    uni.setStorageSync(CALIBRATED_KEY, m);
  } catch {
    // ignore
  }
}

export const useSession = defineStore("session", () => {
  const identity = getDeviceIdentity();
  const sessionId = ref("");
  const deviceId = ref(identity.deviceId);
  const deviceName = ref(identity.deviceName);
  const status = ref<SessionStatus>("active");
  const kickedReason = ref<KickReason>(null);
  const requiresRecalibration = ref(false);

  /**
   * Claim the account for THIS device: mint a fresh sessionId and overwrite the
   * shared record (a new login supersedes any prior session → single device).
   * Sets requiresRecalibration when a DIFFERENT device previously calibrated
   * this account (a first-ever / never-calibrated account does NOT force it —
   * the legacy fallback baseline is fine). Called on explicit login and on
   * App startup for an already-authenticated user.
   */
  function claim(accountKey: string): { requiresRecalibration: boolean } {
    // Refresh identity (it may have been reset by the dev "new device" trigger).
    const id = getDeviceIdentity();
    deviceId.value = id.deviceId;
    deviceName.value = id.deviceName;

    const sid = mockServerUuid();
    sessionId.value = sid;
    writeActiveRecord({ sessionId: sid, deviceId: id.deviceId, deviceName: id.deviceName, loginAt: Date.now(), killedAt: null });
    status.value = "active";
    kickedReason.value = null;

    const calibrated = readCalibratedMap()[accountKey];
    requiresRecalibration.value = !!calibrated && calibrated !== id.deviceId;
    return { requiresRecalibration: requiresRecalibration.value };
  }

  /**
   * Compare this tab's sessionId to the shared record. Returns the resolved
   * status and updates state. Dormant (returns "active") until this tab has
   * actually claimed a session, so the auto-authenticated demo user isn't
   * spuriously kicked before any login.
   */
  function validate(): SessionStatus {
    if (!sessionId.value) {
      status.value = "active";
      return "active";
    }
    const rec = readActiveRecord();
    if (!rec) {
      status.value = "logged-out";
      kickedReason.value = "logged-out";
      return "logged-out";
    }
    if (rec.killedAt) {
      status.value = "kicked";
      kickedReason.value = "kicked";
      return "kicked";
    }
    if (rec.sessionId !== sessionId.value) {
      // Same PHYSICAL device re-claimed (another H5 tab shares localStorage → same
      // deviceId, or a relaunch minted a new sessionId). That is a benign
      // self-supersede, NOT an eviction: adopt the record's sessionId and stay
      // active. Only a DIFFERENT device's claim (or killedAt, handled above) is a
      // real single-device kick.
      if (rec.deviceId === deviceId.value) {
        sessionId.value = rec.sessionId;
        status.value = "active";
        return "active";
      }
      status.value = "kicked";
      kickedReason.value = "kicked";
      return "kicked";
    }
    status.value = "active";
    return "active";
  }

  /** Record that the current device is now the calibrated device for this
   *  account (called after the calibration ritual completes). */
  function markCalibrated(accountKey: string): void {
    const map = readCalibratedMap();
    map[accountKey] = deviceId.value;
    writeCalibratedMap(map);
    requiresRecalibration.value = false;
  }

  /** Self sign-out: release the shared record (only if we own it) so other
   *  tabs see "logged-out", and reset local state. */
  function signOutSession(): void {
    const rec = readActiveRecord();
    if (rec && rec.sessionId === sessionId.value) writeActiveRecord(null);
    sessionId.value = "";
    status.value = "logged-out";
    kickedReason.value = "logged-out";
  }

  /** Mark this tab kicked (called by App.vue after validate() resolves kicked,
   *  alongside app.interruptAllTasks). */
  function kick(reason: Exclude<KickReason, null>): void {
    status.value = "kicked";
    kickedReason.value = reason;
  }

  // ── DEV/QA-only demo triggers (never on production path) ──

  /** Simulate "someone logged in on another device": overwrite the shared
   *  record with a foreign session WITHOUT touching local state → the next
   *  validate() in this tab resolves "kicked". */
  function _devSimulateOtherDeviceLogin(): void {
    writeActiveRecord({
      sessionId: mockServerUuid(),
      deviceId: mockServerUuid(),
      deviceName: "Another device",
      loginAt: Date.now(),
      killedAt: null,
    });
  }

  /** Simulate signing in on a brand-new device: forget this install's device
   *  identity so the next claim() mints a new deviceId → requiresRecalibration
   *  fires (assuming the account was calibrated before). Caller should then
   *  re-login / reload to re-claim. */
  function _devForgetDevice(): void {
    _devResetDeviceIdentity();
  }

  return {
    sessionId, deviceId, deviceName, status, kickedReason, requiresRecalibration,
    claim, validate, markCalibrated, signOutSession, kick,
    _devSimulateOtherDeviceLogin, _devForgetDevice,
  };
});
