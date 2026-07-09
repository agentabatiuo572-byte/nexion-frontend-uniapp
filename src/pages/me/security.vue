<!--
  Security — ported from Nexion-prototype/app/(main)/me/security/page.tsx.
  Password change (collapsible inline form) · 2FA toggle · KYC-Express link ·
  active sessions (revoke / revoke-all) · danger zone (delete account).

  Wrapped in <AppChassis active="me">; SubPageHeader (back chevron) scrolls
  with content. The source iOS grouped-list primitives (IOSList/IOSToggle, which
  hardcode #1C1C1E + text-white) are rebuilt here with the me-domain token
  surfaces — same structure, token-disciplined. Delete-account omits the
  /api/gate/logout reviewer-cookie fetch (no Next middleware in uni); it signs
  out + reLaunches to login, matching /me sign-out.
-->
<template>
  <AppChassis active="me">
    <view class="pb-6" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/me" :title="t.security.title" />

      <!-- ───── Password + Two-factor (merged, de-carded group) ───── -->
      <view class="mx-4" :style="cardStyle">
        <view class="flex items-center active:opacity-90" :style="rowStyle" @click="editingPwd = !editingPwd">
          <view class="grid place-items-center shrink-0" :style="iconBox('var(--v5-danger-soft)')">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--v5-danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block" :style="rowLabelStyle">{{ t.security.passwordTitle }}</text>
            <text class="block truncate" :style="rowSubStyle">{{ passwordHintLine }}</text>
          </view>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="chevronStyle"><path d="m6 9 6 6 6-6" /></svg>
        </view>
        <view v-if="editingPwd" :style="pwdFormStyle">
          <input class="w-full" :style="pwdInputStyle" password :value="current" :placeholder="t.security.currentPassword" :maxlength="PASSWORD_MAX_LENGTH" @input="onCurrent" />
          <input class="w-full" :style="pwdInputStyle" password :value="next" :placeholder="t.security.newPassword" :maxlength="PASSWORD_MAX_LENGTH" @input="onNext" />
          <input class="w-full" :style="pwdInputStyle" password :value="confirmPwd" :placeholder="t.security.confirmPassword" :maxlength="PASSWORD_MAX_LENGTH" @input="onConfirmPwd" />
          <text v-if="err" class="block" :style="errStyle">{{ err }}</text>
          <view class="flex" style="gap: 8px; margin-top: 4px">
            <view class="flex-1 flex items-center justify-center active:opacity-70" :style="pwdCancelStyle" @click="cancelPwd">
              <text :style="pwdCancelLabelStyle">{{ t.ui.cancel }}</text>
            </view>
            <view class="flex-1 flex items-center justify-center active:opacity-80" :style="pwdSaveStyle" @click="submitPasswordChange">
              <text :style="pwdSaveLabelStyle">{{ t.ui.save }}</text>
            </view>
          </view>
        </view>
        <view class="flex items-center" :style="rowBorderedStyle">
          <view class="grid place-items-center shrink-0" :style="iconBox(twoFactorEnabled ? 'var(--v5-success-soft)' : 'var(--v5-surface-3)')">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" :stroke="twoFactorEnabled ? 'var(--v5-success)' : 'var(--v5-ink-3)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block" :style="rowLabelStyle">{{ t.security.twoFactorTitle }}</text>
          </view>
          <view class="shrink-0" :style="toggleTrackStyle" @click="toggleTwoFactor(!twoFactorEnabled)">
            <view :style="toggleThumbStyle" />
          </view>
        </view>
      </view>
      <text class="block mx-4" :style="footerStyle">{{ t.security.twoFactorHint }}</text>

      <!-- ───── KYC-Express ───── -->
      <view class="mx-4" :style="[cardStyle, groupGap]">
        <view class="flex items-center active:opacity-90" :style="rowStyle" @click="goKyc">
          <view class="grid place-items-center shrink-0" :style="iconBox('var(--v5-tech-cyan-soft)')">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block" :style="rowLabelStyle">{{ t.kycExpress.pageTitle }}</text>
            <text class="block truncate" :style="rowSubStyle">{{ t.kycExpress.ctaNote }}</text>
          </view>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </view>
      </view>

      <!-- ───── Active sessions ───── -->
      <text class="block mx-4" :style="sectionHeadStyle">{{ t.security.sessionsTitle }}</text>
      <view class="mx-4" :style="[cardStyle, groupGap]">
        <view v-for="(s, i) in sessions" :key="s.id" class="flex items-center" :style="i === 0 ? rowStyle : rowBorderedStyle">
          <view class="grid place-items-center shrink-0" :style="iconBox(s.current ? 'var(--v5-success-soft)' : 'var(--v5-surface-3)')">
            <!-- Smartphone -->
            <svg v-if="deviceIconKind(s.deviceName) === 'phone'" width="17" height="17" viewBox="0 0 24 24" fill="none" :stroke="s.current ? 'var(--v5-success)' : 'var(--v5-ink-3)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" /></svg>
            <!-- Tablet -->
            <svg v-else-if="deviceIconKind(s.deviceName) === 'tablet'" width="17" height="17" viewBox="0 0 24 24" fill="none" :stroke="s.current ? 'var(--v5-success)' : 'var(--v5-ink-3)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2" /><line x1="12" x2="12.01" y1="18" y2="18" /></svg>
            <!-- Monitor -->
            <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" :stroke="s.current ? 'var(--v5-success)' : 'var(--v5-ink-3)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" /></svg>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block truncate" :style="rowLabelStyle">{{ sessionDeviceLabel(s) }}</text>
            <text class="block truncate" :style="rowSubStyle">{{ t.security.sessionLocation }} · {{ lastActiveLabel(s.lastActiveMs) }}</text>
          </view>
          <text v-if="s.current" :style="currentBadgeStyle">{{ t.security.sessionCurrent }}</text>
          <view v-else class="grid place-items-center active:opacity-70" :style="revokeBtnStyle" @click="handleRevoke(s)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </view>
        </view>
        <view v-if="hasOtherSessions" class="flex items-center justify-center active:opacity-70" :style="revokeAllRowStyle" @click="handleRevokeAll">
          <text :style="revokeAllLabelStyle">{{ t.security.revokeAll }}</text>
        </view>
      </view>
      <text class="block mx-4" :style="footerStyle">{{ t.security.sessionsHint }}</text>

      <!-- ───── Danger zone ───── -->
      <view class="mx-4" :style="[cardStyle, groupGap]">
        <view class="flex items-center active:opacity-90" :style="rowStyle" @click="handleDeleteAccount">
          <view class="grid place-items-center shrink-0" :style="iconBox('var(--v5-danger-soft)')">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--v5-danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.77.04" /></svg>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block" :style="dangerLabelStyle">{{ t.security.deleteAccount }}</text>
          </view>
        </view>
      </view>
      <text class="block mx-4" :style="footerStyle">{{ t.security.deleteAccountHint }}</text>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useSecurity } from "@/store/security";
import { useAuth } from "@/store/auth";
import { useApp } from "@/store/app";
import { useSession, type SessionListItem } from "@/store/session";
import { confirm as uiConfirm, toast } from "@/store/ui";
import { isPasswordOk, PASSWORD_MAX_LENGTH } from "@/auth/password-rules";

const t = useT();
const security = useSecurity();
const auth = useAuth();
const app = useApp();
const session = useSession();

const twoFactorEnabled = computed(() => security.twoFactorEnabled);
const sessions = computed(() => session.activeSessions);
const hasOtherSessions = computed(() => sessions.value.some((s) => !s.current));

const editingPwd = ref(false);
const current = ref("");
const next = ref("");
const confirmPwd = ref("");
const err = ref("");

const passwordHintLine = computed(() =>
  t.value.security.passwordHint.replace("{when}", relativeWhen(security.passwordChangedAt)),
);

function detailVal(e: Event): string {
  return (e as unknown as { detail: { value: string } }).detail.value;
}
function onCurrent(e: Event) {
  current.value = detailVal(e);
}
function onNext(e: Event) {
  next.value = detailVal(e);
}
function onConfirmPwd(e: Event) {
  confirmPwd.value = detailVal(e);
}

function deviceIconKind(label: string): "phone" | "tablet" | "monitor" {
  if (/iPhone|Android|Phone/i.test(label)) return "phone";
  if (/iPad|Tablet/i.test(label)) return "tablet";
  return "monitor";
}

function surfaceLabel(s: SessionListItem): string {
  if (s.entrySurface === "signed-app") return t.value.security.sessionSurfaceSigned;
  if (s.entrySurface === "white-app") return t.value.security.sessionSurfaceWhite;
  return t.value.security.sessionSurfaceH5;
}

function sessionDeviceLabel(s: SessionListItem): string {
  return `${s.deviceName} · ${surfaceLabel(s)}`;
}

function lastActiveLabel(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 5 * 60 * 1000) return t.value.security.timeJustNow;
  if (diff < 3600 * 1000) return fmt(t.value.security.timeMinutesAgo, { n: Math.floor(diff / 60000) });
  if (diff < 24 * 3600 * 1000) return fmt(t.value.security.timeHoursAgo, { n: Math.floor(diff / 3600000) });
  return fmt(t.value.security.timeDaysAgo, { n: Math.floor(diff / (24 * 3600 * 1000)) });
}

function relativeWhen(ms: number): string {
  const days = Math.floor((Date.now() - ms) / (24 * 3600 * 1000));
  if (days < 1) return t.value.security.timeToday;
  if (days < 30) return fmt(t.value.security.timeDaysAgo, { n: days });
  if (days < 365) return fmt(t.value.security.timeMonthsAgo, { n: Math.floor(days / 30) });
  return fmt(t.value.security.timeYearsAgo, { n: Math.floor(days / 365) });
}

function cancelPwd() {
  editingPwd.value = false;
  err.value = "";
  current.value = "";
  next.value = "";
  confirmPwd.value = "";
}

function submitPasswordChange() {
  err.value = "";
  if (!isPasswordOk(next.value)) {
    err.value = t.value.security.passwordShort;
    return;
  }
  if (next.value !== confirmPwd.value) {
    err.value = t.value.security.passwordMismatch;
    return;
  }
  security.changePassword(next.value);
  current.value = "";
  next.value = "";
  confirmPwd.value = "";
  editingPwd.value = false;
  toast.success(t.value.security.passwordSaved);
}

async function toggleTwoFactor(value: boolean) {
  if (!value && twoFactorEnabled.value) {
    const ok = await uiConfirm({
      title: t.value.security.twoFactorDisable,
      message: t.value.security.twoFactorConfirmDisable,
      danger: true,
      confirmLabel: t.value.security.twoFactorDisable,
    });
    if (ok) {
      security.setTwoFactor(false);
      toast.warn(t.value.security.twoFactorDisabledToast);
    }
  } else if (value && !twoFactorEnabled.value) {
    security.setTwoFactor(true);
    toast.success(t.value.security.twoFactorEnabledToast);
  }
}

async function handleRevoke(s: SessionListItem) {
  const ok = await uiConfirm({
    title: t.value.security.sessionRevoke,
    message: `${t.value.security.sessionRevokeConfirm}\n\n${sessionDeviceLabel(s)} · ${t.value.security.sessionLocation}`,
    danger: true,
  });
  if (ok) {
    session.revokeSession(s.id);
    toast.success(t.value.security.sessionRevoked);
  }
}

async function handleRevokeAll() {
  if (!hasOtherSessions.value) return;
  const ok = await uiConfirm({
    title: t.value.security.revokeAll,
    message: t.value.security.revokeAllConfirm,
    danger: true,
  });
  if (ok) {
    session.revokeAllOtherSessions();
    toast.success(t.value.security.revokeAllDone);
  }
}

async function handleDeleteAccount() {
  const ok = await uiConfirm({
    title: t.value.security.deleteAccount,
    message: t.value.security.deleteAccountConfirm,
    danger: true,
    confirmLabel: t.value.security.deleteAccount,
  });
  if (ok) {
    toast.success(t.value.security.deleteAccountToast);
    app.interruptAllTasks("logged-out");
    session.signOutSession();
    auth.signOut();
    uni.reLaunch({ url: "/pages/login/login", fail: () => {} });
  }
}

function goKyc() {
  uni.navigateTo({ url: "/pages/me/kyc", fail: () => {} });
}

// ── styles ──
function iconBox(bg: string): CSSProperties {
  return {
    width: "28px",
    height: "28px",
    borderRadius: "7px",
    background: bg,
  };
}

// De-carded settings group (form b): filled surface, no border. The first group
// sits at the global 24px header gap (no top margin); groupGap spaces the rest.
const cardStyle: CSSProperties = {
  padding: "0 16px",
  background: "var(--v5-surface)",
  borderRadius: "16px",
};
const groupGap: CSSProperties = { marginTop: "12px" };
const rowStyle: CSSProperties = {
  gap: "12px",
  minHeight: "52px",
  padding: "8px 0",
};
const rowBorderedStyle: CSSProperties = {
  gap: "12px",
  minHeight: "52px",
  padding: "8px 0",
  borderTop: "1px solid var(--v5-border)",
};
const rowLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  color: "var(--v5-ink)",
};
const rowSubStyle: CSSProperties = {
  marginTop: "2px",
  fontFamily: "var(--font-v5)",
  fontSize: "12.5px",
  color: "var(--v5-ink-3)",
};
const chevronStyle: CSSProperties = { flexShrink: 0 };
const footerStyle: CSSProperties = {
  marginTop: "10px",
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.625,
};
// Section label (de-card spec): 15/600/ink.
const sectionHeadStyle: CSSProperties = {
  marginTop: "22px",
  marginBottom: "0",
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  fontWeight: 600,
  letterSpacing: "-0.012em",
  color: "var(--v5-ink)",
};
const pwdFormStyle: CSSProperties = {
  borderTop: "1px solid var(--v5-border)",
  padding: "12px 0",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};
const pwdInputStyle: CSSProperties = {
  height: "44px",
  background: "var(--v5-surface-2)",
  borderRadius: "8px",
  padding: "0 12px",
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  color: "var(--v5-ink)",
};
const errStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  color: "var(--v5-danger)",
};
const pwdCancelStyle: CSSProperties = {
  height: "44px",
  borderRadius: "8px",
  background: "var(--v5-surface-2)",
};
const pwdCancelLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  color: "var(--v5-ink-2)",
};
const pwdSaveStyle: CSSProperties = {
  height: "44px",
  borderRadius: "8px",
  background: "var(--v5-brand)",
};
const pwdSaveLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--v5-on-brand)",
};
const toggleTrackStyle = computed<CSSProperties>(() => ({
  position: "relative",
  width: "51px",
  height: "31px",
  borderRadius: "999px",
  background: twoFactorEnabled.value ? "var(--v5-success)" : "var(--v5-surface-3)",
  transition: "background 200ms ease",
}));
const toggleThumbStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  top: "2px",
  left: "2px",
  width: "27px",
  height: "27px",
  borderRadius: "999px",
  background: "#FFFFFF",
  boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
  transform: `translateX(${twoFactorEnabled.value ? 20 : 0}px)`,
  transition: "transform 200ms ease",
}));
const currentBadgeStyle: CSSProperties = {
  flexShrink: 0,
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 500,
  color: "var(--v5-success)",
};
const revokeBtnStyle: CSSProperties = {
  width: "44px",
  height: "44px",
  marginRight: "-8px",
  flexShrink: 0,
};
const revokeAllRowStyle: CSSProperties = {
  minHeight: "52px",
  borderTop: "1px solid var(--v5-border)",
};
const revokeAllLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  color: "var(--v5-danger)",
};
const dangerLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  color: "var(--v5-danger)",
};
</script>
