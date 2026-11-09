<!--
  Security — ported from Nexion-prototype/app/(main)/me/security/page.tsx.
  Password change (collapsible inline form) · 2FA toggle ·
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
    <view class="pb-6 security-page" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/me" :title="t.security.title" />
      <view v-if="modeLabel" class="mx-4" :style="mockModeBannerStyle" data-testid="mock-security-label">
        <text :style="mockModeBannerTextStyle">{{ modeLabel }}</text>
      </view>
      <view v-if="remoteApiEnabled && !securityPresentation" class="mx-4 flex items-center justify-between" :style="remoteSecurityUnavailableStyle" data-testid="remote-security-unavailable" aria-live="polite">
        <text :style="remoteSecurityUnavailableTextStyle">{{ remoteSecurityLoading ? "…" : t.security.opFailed }}</text>
        <view v-if="!remoteSecurityLoading" class="flex items-center justify-center active:opacity-70 nx-card-recovery-action nx-card-recovery-action--quiet nx-card-recovery-action--inline" role="button" tabindex="0" :aria-label="t.ui.retry" @click="loadRemoteSecurity">
          <text :style="remoteSecurityRetryTextStyle">{{ t.ui.retry }}</text>
        </view>
      </view>

      <view
        v-if="retiredFlow"
        data-qa="retired-flow-notice"
        aria-live="polite"
        class="mx-4"
        style="margin-bottom: 14px; padding: var(--v5-space-3) 14px; border: 1px solid var(--v5-warning); border-radius:var(--ui-radius-icon); background: var(--v5-warning-soft); color: var(--v5-ink-2)"
      >
        <text class="block" style="font-size: var(--ui-type-list-subtitle); line-height: 1.5">{{ t.topupChrome.flowRetired }}</text>
      </view>

      <view v-if="remoteApiEnabled" class="mx-4 security-providers"><ThirdPartyAuth :key="app.accountKey + ':' + app.accountBindingEpoch" intent="LINK" sheet :disabled="securityBusy || !remoteSecurity" @busy="oauthBusy = $event" /></view>
      <view v-if="phoneBound === false" class="mx-4 nx-glass-card" style="padding: var(--v5-space-4); margin-bottom: 16px" role="status">
        <text class="block">{{ t.security.phoneBindingRequired }}</text>
        <view role="button" tabindex="0" style="min-height: 44px; color: var(--v5-brand); display: flex; align-items: center" @click="navTo('/pages/me/phone-binding')">{{ t.security.phoneBindingTitle }} →</view>
      </view>
      <!-- ───── Password + Two-factor (merged, de-carded group) ───── -->
      <view class="nx-glass-card mx-4 security-credentials" :style="cardStyle">
        <view class="flex items-center active:opacity-90" :style="rowStyle" role="button" tabindex="0" :aria-expanded="editingPwd ? 'true' : 'false'" @click="editingPwd = !editingPwd">
          <view class="grid place-items-center shrink-0" :style="iconBox('var(--v5-danger-soft)')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-danger)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block" :style="rowLabelStyle">{{ t.security.passwordTitle }}</text>
            <text class="block" :style="passwordHintStyle">{{ passwordHintLine }}</text>
          </view>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="chevronStyle"><path d="m9 6 6 6-6 6" /></svg>
        </view>

        <view class="flex items-center" :style="rowBorderedStyle">
          <view class="grid place-items-center shrink-0" :style="iconBox(displayTwoFactorEnabled === true ? 'var(--v5-success-soft)' : 'var(--v5-surface-3)')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" :stroke="displayTwoFactorEnabled === true ? 'var(--v5-success)' : 'var(--v5-ink-3)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block" :style="rowLabelStyle">{{ t.security.twoFactorTitle }}</text><text class="block" :style="rowSubStyle">{{ t.security.twoFactorHint }}</text>
          </view>
          <text v-if="displayTwoFactorEnabled === null" :style="unavailableValueStyle">—</text>
          <view v-else class="shrink-0 flex items-center justify-center active:opacity-70 transition-opacity" style="width: 44px; height: 44px" role="switch" tabindex="0" :aria-label="t.security.twoFactorSwitchLabel" :aria-checked="displayTwoFactorEnabled" :aria-disabled="remoteApiEnabled && (!remoteSecurity || remoteSecurityLoading)" @click="openTwoFactorSheet">
            <view :style="toggleTrackStyle">
              <view class="security-toggle-thumb" :style="toggleThumbStyle" />
            </view>
          </view>
        </view>

      </view>


      <view v-if="phoneBound === true" class="nx-glass-card mx-4 security-phone" :style="[cardStyle, groupGap]">
        <view class="flex items-center active:opacity-90" :style="rowStyle" role="button" tabindex="0"
          :aria-expanded="phoneEditing ? 'true' : 'false'" @click="phoneEditing = !phoneEditing">
          <view class="security-phone-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg></view><view class="flex-1 min-w-0">
            <text class="block" :style="rowLabelStyle">{{ t.security.phoneChangeTitle }}</text>
            <text class="block" :style="rowSubStyle">{{ phonePolicy
              ? fmt(t.security.phoneChangeSummary, { days: phonePolicy.windowDays, max: phonePolicy.maxChanges, used: phonePolicy.usedChanges })
              : t.security.phoneChangeUnavailable }}</text>
          </view>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
        </view>

      </view>

      <!-- ───── Active sessions ───── -->
      <text class="block mx-4" :style="sectionHeadStyle">{{ t.security.sessionsTitle }}</text>
      <view class="nx-glass-card mx-4" :style="[cardStyle, groupGap]">
        <view v-if="remoteApiEnabled && !securityPresentation" class="flex items-center" :style="rowStyle">
          <text :style="unavailableValueStyle">—</text>
        </view>
        <view v-for="(s, i) in displaySessions" :key="s.id" class="flex items-center" :style="i === 0 ? rowStyle : rowBorderedStyle">
          <view class="grid place-items-center shrink-0" :style="iconBox(s.current ? 'var(--v5-success-soft)' : 'var(--v5-surface-3)')">
            <!-- Smartphone -->
            <svg v-if="deviceIconKind(s.deviceName) === 'phone'" width="20" height="20" viewBox="0 0 24 24" fill="none" :stroke="s.current ? 'var(--v5-success)' : 'var(--v5-ink-3)'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>
            <!-- Tablet -->
            <svg v-else-if="deviceIconKind(s.deviceName) === 'tablet'" width="17" height="17" viewBox="0 0 24 24" fill="none" :stroke="s.current ? 'var(--v5-success)' : 'var(--v5-ink-3)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2" /><line x1="12" x2="12.01" y1="18" y2="18" /></svg>
            <!-- Monitor -->
            <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" :stroke="s.current ? 'var(--v5-success)' : 'var(--v5-ink-3)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" /></svg>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block truncate" :style="rowLabelStyle">{{ sessionDeviceLabel(s) }}</text>
            <text class="block truncate security-session-meta" :style="rowSubStyle">{{ sessionSecondaryLabel(s) }}</text>
          </view>
          <text v-if="s.current" :style="currentBadgeStyle">{{ t.security.sessionCurrent }}</text>
          <view v-else class="grid place-items-center active:opacity-70" :style="revokeBtnStyle" role="button" tabindex="0" :aria-label="`${t.security.sessionRevoke} · ${sessionDeviceLabel(s)}`" @click="handleRevoke(s)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </view>
        </view>
        <view v-if="displaySessions.some(s => !s.current)" class="flex items-center justify-center active:scale-[0.98] transition-transform" :style="revokeAllRowStyle" role="button" tabindex="0" :aria-disabled="!remoteSecurity || remoteSecurityLoading" :aria-label="t.security.revokeAll" @click="handleRevokeAll">
          <text :style="revokeAllLabelStyle">{{ t.security.revokeAll }}</text>
        </view>
      </view>
      <view v-if="securityPresentation?.nextCursor" class="mx-4 flex justify-center" :style="revokeAllRowStyle"
        role="button" :tabindex="sessionPageLoading ? -1 : 0" :aria-disabled="sessionPageLoading || !remoteSecurity || remoteSecurityLoading"
        @click="loadMoreSessions">
        <text>{{ t.notifs.loadMore }}</text>
      </view>
      <text class="block mx-4" :style="footerStyle">{{ t.security.sessionsHint }}</text>

      <!-- ───── Danger zone ───── -->
      <view class="nx-glass-card mx-4 security-danger" :style="[cardStyle, groupGap]">
        <view class="flex items-center" :class="deletionPending ? '' : 'active:opacity-90'" :style="rowStyle" role="button" :tabindex="deletionPending ? -1 : 0" :aria-disabled="deletionPending ? 'true' : 'false'" @click="openDeletionSheet">
          <view class="grid place-items-center shrink-0" :style="iconBox('var(--v5-danger-soft)')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-danger)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10M18.4 6.6a9 9 0 1 1-12.8 0"/></svg>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block" :style="dangerLabelStyle">{{ t.security.deleteAccount }}</text>
          </view><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
        </view>

        <view v-if="remoteApiEnabled && deletionCanCancel" class="flex items-center justify-center active:scale-[0.98] transition-transform"
          :style="revokeAllRowStyle" role="button" tabindex="0" :aria-label="t.security.cancelDeletionRequest"
          @click="handleCancelAccountDeletion">
          <text :style="revokeAllLabelStyle">{{ t.security.cancelDeletionRequest }}</text>
        </view>
      </view>
      <text class="block mx-4" :style="footerStyle">{{ remoteApiEnabled && !remoteSecurity ? "—" : deletionStatus.status === 'BLOCKED' ? fmt(t.security.deleteAccountBlocked, { reason: deletionBlockedReason }) : deletionPending ? t.security.deleteAccountPending : t.security.deleteAccountHint }}</text>
    </view>
    <NxSheet :open="editingPwd" :title="t.security.passwordTitle" @close="cancelPwd" class="security-half-sheet"><view class="security-sheet-form">
          <input class="w-full" :style="pwdInputStyle" password :value="current" :placeholder="t.security.currentPassword" :aria-label="t.security.currentPassword" :maxlength="PASSWORD_MAX_LENGTH" :focus="pwdFocusField === PWD_FIELD_CURRENT" :aria-invalid="pwdErrorField === PWD_FIELD_CURRENT ? 'true' : 'false'" :aria-describedby="pwdErrorField === PWD_FIELD_CURRENT ? 'security-pwd-error-current' : undefined" @input="onCurrent" />
          <input class="w-full" :style="pwdInputStyle" password :value="next" :placeholder="t.security.newPassword" :aria-label="t.security.newPassword" :maxlength="PASSWORD_MAX_LENGTH" :focus="pwdFocusField === PWD_FIELD_NEXT" :aria-invalid="pwdErrorField === PWD_FIELD_NEXT ? 'true' : 'false'" :aria-describedby="pwdErrorField === PWD_FIELD_NEXT ? 'security-pwd-error-next' : undefined" @input="onNext" />
          <input class="w-full" :style="pwdInputStyle" password :value="confirmPwd" :placeholder="t.security.confirmPassword" :aria-label="t.security.confirmPassword" :maxlength="PASSWORD_MAX_LENGTH" :focus="pwdFocusField === PWD_FIELD_CONFIRM" :aria-invalid="pwdErrorField === PWD_FIELD_CONFIRM ? 'true' : 'false'" :aria-describedby="pwdErrorField === PWD_FIELD_CONFIRM ? 'security-pwd-error-confirm' : undefined" @input="onConfirmPwd" />
          <text v-if="err && pwdErrorField === PWD_FIELD_CURRENT" id="security-pwd-error-current" class="block" :style="errStyle" role="alert">{{ err }}</text>
          <text v-else-if="err && pwdErrorField === PWD_FIELD_NEXT" id="security-pwd-error-next" class="block" :style="errStyle" role="alert">{{ err }}</text>
          <text v-else-if="err && pwdErrorField === PWD_FIELD_CONFIRM" id="security-pwd-error-confirm" class="block" :style="errStyle" role="alert">{{ err }}</text>
          <text v-else-if="err" class="block" :style="errStyle" role="alert">{{ err }}</text>

        </view><template #footer><view class="flex" style="gap: var(--v5-space-2); margin-top: 4px">
            <NxButton variant="secondary" size="medium" class="flex-1 flex items-center justify-center" :disabled="securityBusy" @click="cancelPwd"><text>{{ t.ui.cancel }}</text></NxButton>
            <NxButton variant="primary" size="medium" class="flex-1 flex items-center justify-center" :disabled="securityBusy" @click="submitPasswordChange"><text>{{ t.ui.save }}</text></NxButton>
          </view></template></NxSheet>
    <NxSheet :open="twoFactorSheetOpen" :title="t.security.twoFactorTitle" @close="closeTwoFactorSheet" class="security-half-sheet"><view class="security-sheet-form">
          <input class="w-full" :style="pwdInputStyle" password :value="twoFactorPassword" :placeholder="t.security.currentPassword" :aria-label="t.security.twoFactorCurrentPassword" :aria-invalid="twoFactorPasswordError ? 'true' : 'false'" :aria-describedby="twoFactorPasswordError ? 'security-2fa-password-error' : undefined" :focus="twoFactorPasswordFocus" :maxlength="PASSWORD_MAX_LENGTH" @input="onTwoFactorPassword" />
          <text v-if="twoFactorPasswordError" id="security-2fa-password-error" class="block" :style="errStyle" role="alert">{{ twoFactorPasswordError }}</text>
          <view v-if="remoteApiEnabled && twoFactorChallengeNo" class="flex" style="gap: var(--v5-space-2); margin-top: 8px">
            <input class="flex-1" :style="pwdInputStyle" inputmode="numeric" :value="twoFactorCode" :placeholder="t.addrRebind.otpPlaceholder" :aria-label="t.addrRebind.otpPlaceholder" maxlength="6" @input="onTwoFactorCode" />
            <NxButton variant="primary" size="medium" class="flex items-center justify-center active:opacity-80" :busy="securityBusy" @click="confirmTwoFactorChallenge"><text>{{ t.addrRebind.otpConfirmCta }}</text></NxButton>
          </view>
          <text v-if="remoteApiEnabled && twoFactorChallengeNo" class="block" :style="rowSubStyle">{{ fmt(t.addrRebind.otpBody, { phone: twoFactorPhoneMasked }) }}</text>
        </view><template #footer><NxButton v-if="!twoFactorChallengeNo" variant="primary" :busy="securityBusy" @click="toggleTwoFactor(requestedTwoFactor)">{{ t.ui.confirm }}</NxButton></template></NxSheet>
    <NxSheet :open="phoneEditing" :title="t.security.phoneChangeTitle" @close="!securityBusy && (phoneEditing = false)" class="security-half-sheet"><view class="security-sheet-form">
          <text v-if="phonePolicy && phonePolicy.remainingChanges === 0" class="block" :style="rowSubStyle">
            {{ t.security.phoneChangeLimit }} {{ phonePolicy.nextAvailableAt ? formatDisplayDate(phonePolicy.nextAvailableAt, dateLocale()) : "" }}
          </text>
          <template v-else-if="!phoneChallenge">
            <view class="flex" style="gap: 8px">
              <view :style="pwdInputStyle" role="button" tabindex="0" :aria-label="t.countryCodes.title"
                :aria-expanded="showPhoneCountries" @click="showPhoneCountries = true">{{ '+' + phoneCountry }} ▾</view>
              <input class="flex-1" :style="pwdInputStyle" type="number" :value="phoneNext" :placeholder="t.security.phoneChangeNew"
                :aria-label="t.security.phoneChangeNew" maxlength="15" @input="phoneNext = detailVal($event)" />
            </view>
            <input class="w-full" :style="pwdInputStyle" password :value="phonePassword" :placeholder="t.security.currentPassword"
              :aria-label="t.security.currentPassword" :maxlength="PASSWORD_MAX_LENGTH" @input="phonePassword = detailVal($event)" />
            <NxButton variant="primary" size="medium" class="flex items-center justify-center active:opacity-80"
              :disabled="securityBusy || !phonePolicy || phonePolicy.remainingChanges === 0"
              @click="startPhoneChange"><text>{{ t.security.phoneChangeSendCodes }}</text></NxButton>
          </template>
          <template v-else>
            <text class="block" :style="rowSubStyle">{{ fmt(t.security.phoneChangeCodesSent,
              { old: phoneChallenge.oldPhoneMasked, next: phoneChallenge.newPhoneMasked }) }}</text>
            <input class="w-full" :style="pwdInputStyle" type="number" :value="phoneOldCode" :placeholder="t.security.phoneChangeOldCode"
              :aria-label="t.security.phoneChangeOldCode" maxlength="6" @input="phoneOldCode = detailVal($event)" />
            <input class="w-full" :style="pwdInputStyle" type="number" :value="phoneNewCode" :placeholder="t.security.phoneChangeNewCode"
              :aria-label="t.security.phoneChangeNewCode" maxlength="6" @input="phoneNewCode = detailVal($event)" />
            <NxButton variant="primary" size="medium" class="flex items-center justify-center active:opacity-80" :disabled="securityBusy"
              @click="confirmPhoneChange"><text>{{ t.security.phoneChangeConfirm }}</text></NxButton>
            <view role="button" tabindex="0" :style="rowSubStyle" @click="resetPhoneChallenge">
              {{ t.security.phoneChangeRestart }}
            </view>
          </template>
          <text v-if="phoneError" class="block" :style="errStyle" role="alert">{{ phoneError }}</text>
          <view v-if="!phonePolicy" role="button" tabindex="0" :style="[rowSubStyle, { minHeight: '44px', display: 'flex', alignItems: 'center', font: '600 13px/20px var(--font-v5)' }]" @click="loadPhonePolicy">
            {{ t.ui.retry }}
          </view>
        </view></NxSheet>
    <NxSheet :open="deletionSheetOpen" :title="t.security.deleteAccount" @close="closeDeletionSheet" class="security-half-sheet"><view class="security-sheet-form"><text class="security-sheet-note">{{ t.security.deleteAccountHint }}</text><template v-if="remoteApiEnabled && !deletionPending">
          <input class="w-full" :style="pwdInputStyle" password :value="deletionPassword" :placeholder="t.security.currentPassword" :aria-label="t.security.deletionPassword" :maxlength="PASSWORD_MAX_LENGTH" @input="onDeletionPassword" />
        </template></view><template #footer><NxButton variant="primary" :busy="securityBusy" @click="handleDeleteAccount">{{ t.security.deleteAccount }}</NxButton></template></NxSheet>
    <CountryCodeSheet :open="showPhoneCountries" :model-value="'+' + phoneCountry" @select="selectPhoneCountry" @close="showPhoneCountries = false" />
  </AppChassis>
</template>

<script setup lang="ts">
import { dateLocale } from "@/i18n/format";
import { displayTimestamp, formatDisplayDate, formatDisplayDateTime } from "@/lib/display-date";
import NxSheet from "@/components/ui/nx-sheet.vue";
import NxButton from "@/components/ui/nx-button.vue";
import ThirdPartyAuth from "@/components/third-party-auth.vue";
import { formatAmount } from "@/lib/amount-display";
import { computed, onUnmounted, ref, watch, type CSSProperties } from "vue";
import { onHide, onLoad, onShow } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import CountryCodeSheet from "@/components/country-code-sheet.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { parseServerTimestamp } from "@/api/server-time";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useSecurity } from "@/store/security";
import { captureAccountScope, isCurrentAccountScope, rebindAccountScopedStores } from "@/lib/account-scope";
import { useAuth } from "@/store/auth";
import { useConversations } from "@/store/conversations";
import { useApp } from "@/store/app";
// 注销提交前核实锁定本金，未结清时引导用户先处理质押。
import { useStaking } from "@/store/staking";
import { useConfig } from "@/store/config";
import { navReset, navTo } from "@/lib/route";
import { useSession, type SessionListItem } from "@/store/session";
import { nexGridBrandText } from "@/lib/brand-copy";
import { confirm as uiConfirm, toast, useUI } from "@/store/ui";
import { isPasswordOk, PASSWORD_MAX_LENGTH } from "@/auth/password-rules";
import { dialCodeForLocale, validateNationalPhone } from "@/auth/phone-number";
import { useLocaleStore } from "@/store/locale";
import { accountApi, authApi, apiRuntimeConfig, remoteApiEnabled, sessionVault } from "@/api/runtime";
import { requireAccountPhone } from "@/lib/require-account-phone";
import { apiEnvironmentBadgeLabel } from "@/api/runtime-config";
import { deleteMockAuthAccount } from "@/api/mock-auth-api";
import type { SecurityState } from "@/api/contracts";
import type { AccountDeletionStatus, PhoneNumberChangePolicy, PhoneNumberChangeChallenge } from "@/api/account-api";
import { ApiError } from "@/api/errors";
import { createP318AccountPageFence, type P318AccountPageScope } from "./p3-18-account-page-fence";
import { accountErrorMessageKey } from "@/lib/account-error-message";
import { acquireAccountCommandKey, readAccountRow, releaseAccountCommandKey } from "@/store/account-scoped-storage";

const SECURITY_COMMAND_TABLE = "nexgrid-security-command-accounts-v1";

const t = useT();
const retiredFlow = ref(false);

// 已下线验证流深链兜底：toast 提供即时反馈，页内 notice 保持可发现，
// 避免冷启较快时 toast 在验收/用户看清之前到时消失。
onLoad((options) => {
  if ((options as Record<string, string> | undefined)?.from === "retired-flow") {
    retiredFlow.value = true;
    toast.info(t.value.topupChrome.flowRetired);
  }
  if (remoteApiEnabled) void loadRemoteSecurity();
});
const security = useSecurity();
const auth = useAuth();
const app = useApp();
const staking = useStaking();
const config = useConfig();
const session = useSession();
const ui = useUI();
const securityPageFence = createP318AccountPageFence(
  () => String(app.accountKey),
  () => app.accountBindingEpoch,
);
const securityConfirmOwner = `p3-18-security:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
let securityPageVisible = true;

const remoteSecurity = ref<SecurityState | null>(null);
const securityPresentation = ref<SecurityState | null>(null);
const securityLocale = useLocaleStore();
let securityEnvironmentInvalidated = false;
watch(() => apiRuntimeConfig?.environment, () => { securityEnvironmentInvalidated = true; clearSecurityAccountState(); }, { flush: 'sync' });
watch(() => securityLocale.code, () => { clearSecurityAccountState(); refreshSecurityForCurrentAccount(); }, { flush: 'sync' });
// Unknown (null) until there is a session: after an H5 reload it is restored after the page shows, then the
// account watch below reads it again. Neither the binding prompt nor the change-phone entry shows while unknown.
const phoneBound = ref<boolean | null>(null);
function readPhoneBinding() {
  const session = remoteApiEnabled ? sessionVault.read() : null;
  phoneBound.value = session ? !!session.user.phone : null;
}
readPhoneBinding();
const phonePolicy = ref<PhoneNumberChangePolicy | null>(null);
const phoneEditing = ref(false);
const showPhoneCountries = ref(false);
function selectPhoneCountry(value: string) { phoneCountry.value = value.slice(1); }
const phoneCountry = ref(dialCodeForLocale(useLocaleStore().code).slice(1));
const phoneNext = ref("");
const phonePassword = ref("");
const phoneOldCode = ref("");
const phoneNewCode = ref("");
const phoneChallenge = ref<PhoneNumberChangeChallenge | null>(null);
const phoneError = ref("");
const deletionStatus = ref<AccountDeletionStatus>({ status: "NONE" });
const deletionPending = computed(() => deletionStatus.value.status !== "NONE"
  && (deletionStatus.value.status === "REQUESTED" || deletionStatus.value.status === "IN_REVIEW" || deletionStatus.value.status === "BLOCKED"));
const deletionBlockedReason = computed(() => {
  const request = deletionStatus.value;
  if (request.status !== "BLOCKED") return "";
  const reason = request.blockReason ?? request.reason;
  switch (reason) {
    case "UNSETTLED_FUNDS_OR_ORDERS": return t.value.security.deleteAccountPendingReason;
    case "UNSETTLED_STATE_UNAVAILABLE": return t.value.security.deleteAccountStateUnavailableReason;
    default: return !reason || /^[A-Z0-9_]+$/.test(reason)
      ? t.value.security.deleteAccountUnknownReason : reason;
  }
});
const deletionCanCancel = computed(() => deletionStatus.value.status === "REQUESTED"
  || deletionStatus.value.status === "IN_REVIEW" || deletionStatus.value.status === "BLOCKED");
const oauthBusy = ref(false);
const localSecurityBusy = ref(false);
const securityBusy = computed({ get: () => localSecurityBusy.value || oauthBusy.value, set: (value: boolean) => { localSecurityBusy.value = value; } });
const twoFactorPassword = ref("");
const twoFactorPasswordError = ref("");
const twoFactorPasswordFocus = ref(false);
const twoFactorCode = ref("");
const twoFactorChallengeNo = ref("");
const twoFactorPhoneMasked = ref("");
const twoFactorTarget = ref<boolean | null>(null);
const deletionPassword = ref("");
const deletionCommandKey = ref("");
const remoteSecurityLoading = ref(false);
const sessionPageLoading = ref(false);
const twoFactorEnabled = computed<boolean | null>(() => remoteApiEnabled
  ? remoteSecurity.value?.twoFactorEnabled ?? null
  : security.twoFactorEnabled);
const displayTwoFactorEnabled = computed(() => remoteApiEnabled ? securityPresentation.value?.twoFactorEnabled ?? null : security.twoFactorEnabled);
const modeLabel = computed(() => apiEnvironmentBadgeLabel(apiRuntimeConfig, t.value.security.developmentModeLabel));
const sessions = computed<SessionListItem[]>(() => remoteApiEnabled
  ? (remoteSecurity.value?.sessions ?? []).map((item) => ({
      id: item.id,
      deviceName: nexGridBrandText(item.deviceName),
      device: nexGridBrandText(item.deviceName),
      location: item.ipMasked,
      ip: item.ipMasked,
      // 🔴 zentao #228:`lastActiveAt` 是 Java `LocalDateTime` 序列化出来的**无时区**串,
      //   后端按业务时区 Asia/Shanghai 写入。直接 `Date.parse` 会把它当成**本机时区**
      //   (此处 +09:00),于是刚注册账号的当前设备显示成「59 分钟前」—— 差的就是那 1 小时。
      //   统一走 `parseServerTimestamp`(无时区默认 +08:00),与提现/兑换等面同源。
      lastActiveMs: parseServerTimestamp(item.lastActiveAt),
      current: item.current,
      entrySurface: "h5",
    }))
  : session.activeSessions);
const displaySessions = computed<SessionListItem[]>(() => remoteApiEnabled
  ? (securityPresentation.value?.sessions ?? []).map((item) => ({
      id: item.id,
      deviceName: nexGridBrandText(item.deviceName),
      device: nexGridBrandText(item.deviceName),
      location: item.ipMasked,
      ip: item.ipMasked,
      // 🔴 zentao #228:`lastActiveAt` 是 Java `LocalDateTime` 序列化出来的**无时区**串,
      //   后端按业务时区 Asia/Shanghai 写入。直接 `Date.parse` 会把它当成**本机时区**
      //   (此处 +09:00),于是刚注册账号的当前设备显示成「59 分钟前」—— 差的就是那 1 小时。
      //   统一走 `parseServerTimestamp`(无时区默认 +08:00),与提现/兑换等面同源。
      lastActiveMs: parseServerTimestamp(item.lastActiveAt),
      current: item.current,
      entrySurface: "h5",
    }))
  : session.activeSessions);
const hasOtherSessions = computed(() => sessions.value.some((s) => !s.current));

const editingPwd = ref(false);
const deletionSheetOpen = ref(false);
const requestedTwoFactor = ref(false);
const twoFactorSheetOpen = ref(false);
const current = ref("");
const next = ref("");
const confirmPwd = ref("");
const err = ref("");
// 哪个字段是这条错误的归属(zentao #216)。错误文本经 aria-describedby 关联到该输入框,
// 并给它挂 aria-invalid=true —— 否则读屏只知道「提交失败」,不知道改哪一格。
// 服务端/传输层错误不属于任何单格,留空。
//
// 🔴 三个错误 id 与三个字段码都提成常量:门的 aria-describedby 判据会把绑定表达式里的
// **所有**单引号字面量当成 id 引用,写进模板的 'current'/'next'/'confirm' 会被判成悬空 id;
// 而 id 本身必须是模板里的**字面量** id="..."。两条合起来 = developer.vue(BUG 105)同形。
const PWD_FIELD_CURRENT = "current";
const PWD_FIELD_NEXT = "next";
const PWD_FIELD_CONFIRM = "confirm";
const pwdErrorField = ref<"" | "current" | "next" | "confirm">("");
// 焦点移到首个错误字段(zentao #216)。uni-app 的 :focus 是「置真即聚焦」的边沿信号,
// 字段被再次编辑时释放,否则焦点会一直钉在该格、用户无法手动移开。
const pwdFocusField = ref<"" | "current" | "next" | "confirm">("");
function focusPwdField(field: "current" | "next" | "confirm") {
  pwdFocusField.value = field;
}

function securityErrorMessage(cause: unknown): string {
  const labels = t.value.security as typeof t.value.security & Record<
    "currentPasswordInvalid" | "securityVerificationRateLimited" | "accountDeletionVersionConflict" | "sessionUnavailable", string
  >;
  switch (accountErrorMessageKey(cause)) {
    case "currentPasswordInvalid": return labels.currentPasswordInvalid;
    case "securityVerificationRateLimited": return labels.securityVerificationRateLimited;
    case "accountDeletionVersionConflict": return labels.accountDeletionVersionConflict;
    case "sessionUnavailable": return labels.sessionUnavailable;
    default: return t.value.security.opFailed;
  }
}

function isCurrentSecurityRequest(
  pageScope: P318AccountPageScope,
  accountScope = captureAccountScope(),
  accountKey = auth.accountId,
): boolean {
  return !securityEnvironmentInvalidated && securityPageVisible
    && securityPageFence.isCurrent(pageScope)
    && isCurrentAccountScope(accountScope)
    && auth.accountId === accountKey;
}

function clearSecurityAccountState(keepPresentation = false) {
  if (!keepPresentation) securityPresentation.value = null;
  twoFactorSheetOpen.value = false;
  deletionSheetOpen.value = false;
  securityPageFence.invalidate();
  ui.clearConfirmsBy(securityConfirmOwner);
  securityBusy.value = false;
  remoteSecurityLoading.value = false;
  sessionPageLoading.value = false;
  remoteSecurity.value = null;
  phonePolicy.value = null;
  phoneEditing.value = false;
  phoneNext.value = "";
  phonePassword.value = "";
  phoneOldCode.value = "";
  phoneNewCode.value = "";
  phoneChallenge.value = null;
  phoneError.value = "";
  deletionStatus.value = { status: "NONE" };
  editingPwd.value = false;
  current.value = "";
  next.value = "";
  confirmPwd.value = "";
  twoFactorPassword.value = "";
  twoFactorPasswordError.value = "";
  twoFactorPasswordFocus.value = false;
  twoFactorCode.value = "";
  twoFactorChallengeNo.value = "";
  twoFactorPhoneMasked.value = "";
  twoFactorTarget.value = null;
  deletionPassword.value = "";
  deletionCommandKey.value = "";
  err.value = "";
}

function refreshSecurityForCurrentAccount() {
  if (securityPageVisible && remoteApiEnabled) {
    void loadRemoteSecurity();
    void loadPhonePolicy();
  }
}

async function loadPhonePolicy() {
  const pageScope = securityPageFence.capture("phone-policy");
  const accountScope = captureAccountScope();
  const accountKey = auth.accountId;
  try {
    const policy = await accountApi.phoneNumberPolicy();
    if (isCurrentSecurityRequest(pageScope, accountScope, accountKey)) phonePolicy.value = policy;
  } catch (cause) {
    if (isCurrentSecurityRequest(pageScope, accountScope, accountKey)) {
      phonePolicy.value = null;
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) clearSecurityAccountState();
    }
  }
}

function phoneChangeMessage(cause: unknown) {
  if (cause instanceof ApiError) {
    if (cause.message === "USER_PHONE_CHANGE_LIMIT_REACHED") return t.value.security.phoneChangeLimit;
    if (cause.message === "USER_PHONE_ALREADY_IN_USE") return t.value.security.phoneChangeInUse;
    if (cause.message === "USER_PHONE_CHANGE_CODE_INVALID") return t.value.security.phoneChangeInvalidCode;
    if (cause.message === "USER_PHONE_CHANGE_EXPIRED") return t.value.security.phoneChangeExpired;
    if (cause.message === "USER_PHONE_CHANGE_CHALLENGE_RATE_LIMITED") return t.value.security.phoneChangeRateLimited;
    if (cause.message === "USER_OTP_DELIVERY_UNAVAILABLE") return t.value.security.phoneChangeDeliveryUnavailable;
    if (cause.message === "USER_PHONE_INVALID" || cause.message === "USER_PHONE_UNCHANGED") return t.value.security.phoneChangeInvalidNumber;
  }
  return securityErrorMessage(cause);
}

function resetPhoneChallenge() {
  if (securityBusy.value) return;
  phoneChallenge.value = null;
  phoneOldCode.value = "";
  phoneNewCode.value = "";
  phoneError.value = "";
}

async function startPhoneChange() {
  if (securityBusy.value || !phonePolicy.value || phonePolicy.value.remainingChanges === 0) return;
  phoneError.value = "";
  if (!phonePassword.value || !validateNationalPhone("+" + phoneCountry.value, phoneNext.value)) {
    phoneError.value = t.value.security.phoneChangeCheckInput;
    return;
  }
  const pageScope = securityPageFence.capture("phone-change");
  const accountScope = captureAccountScope();
  const accountKey = auth.accountId;
  securityBusy.value = true;
  try {
    const challenge = await accountApi.startPhoneNumberChange(phonePassword.value, phoneCountry.value, phoneNext.value);
    if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
    phoneChallenge.value = challenge;
    phonePassword.value = "";
  } catch (cause) {
    if (isCurrentSecurityRequest(pageScope, accountScope, accountKey)) {
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) clearSecurityAccountState();
      phoneError.value = phoneChangeMessage(cause);
    }
  } finally {
    if (isCurrentSecurityRequest(pageScope, accountScope, accountKey)) securityBusy.value = false;
  }
}

async function confirmPhoneChange() {
  if (securityBusy.value || !phoneChallenge.value) return;
  phoneError.value = "";
  if (!/^[0-9]{6}$/.test(phoneOldCode.value) || !/^[0-9]{6}$/.test(phoneNewCode.value)) {
    phoneError.value = t.value.security.phoneChangeInvalidCode;
    return;
  }
  const pageScope = securityPageFence.capture("phone-change");
  const accountScope = captureAccountScope();
  const accountKey = auth.accountId;
  const changeNo = phoneChallenge.value.changeNo;
  securityBusy.value = true;
  try {
    await accountApi.confirmPhoneNumberChange(changeNo, phoneOldCode.value, phoneNewCode.value);
    if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
    try { await authApi.logout(); } catch { /* The local session must still be cleared. */ }
    if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
    toast.success(t.value.security.phoneChangeDone);
    session.signOutSession();
    auth.signOut();
    app.bindAccount("default");
    rebindAccountScopedStores("default");
    navReset({ url: "/pages/login/login", fail: () => {} });
  } catch (cause) {
    if (isCurrentSecurityRequest(pageScope, accountScope, accountKey)) {
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) clearSecurityAccountState();
      phoneError.value = phoneChangeMessage(cause);
    }
  } finally {
    if (isCurrentSecurityRequest(pageScope, accountScope, accountKey)) securityBusy.value = false;
  }
}

onShow(() => {
  securityPageVisible = true;
  readPhoneBinding();
  refreshSecurityForCurrentAccount();
});
onHide(() => {
  securityPageVisible = false;
  clearSecurityAccountState(true);
});
onUnmounted(() => {
  securityPageVisible = false;
  clearSecurityAccountState();
});
watch([() => String(app.accountKey), () => app.accountBindingEpoch, () => auth.accountId], () => {
  readPhoneBinding();
  clearSecurityAccountState();
}, { flush: "sync" });
// Sign-in changes these keys before it rebinds the account scope; a read started here would be fenced out as stale.
// The default flush runs once after the whole sign-in step, under the rebound scope.
watch([() => String(app.accountKey), () => app.accountBindingEpoch, () => auth.accountId], refreshSecurityForCurrentAccount);

const passwordHintLine = computed(() => {
  if (remoteApiEnabled && !securityPresentation.value) return "—";
  return t.value.security.passwordHint.replace("{when}", formatDisplayDateTime(
    remoteApiEnabled ? securityPresentation.value?.passwordChangedAt : security.passwordChangedAt, dateLocale(),
  ));
});

async function loadRemoteSecurity(): Promise<boolean> {
  const pageScope = securityPageFence.capture("security-overview");
  const scope = captureAccountScope();
  const accountKey = auth.accountId;
  if (!isCurrentSecurityRequest(pageScope, scope, accountKey)) return false;
  remoteSecurityLoading.value = true;
  sessionPageLoading.value = false;
  remoteSecurity.value = null;
  try {
    const [securityState, accountDeletion] = await Promise.all([
      accountApi.securityOverview(),
      accountApi.accountDeletionStatus(),
    ]);
    if (!isCurrentSecurityRequest(pageScope, scope, accountKey)) return false;
    remoteSecurity.value = securityState;
    securityPresentation.value = { ...securityState, sessions: [...securityState.sessions] };
    deletionStatus.value = accountDeletion;
    return true;
  } catch (cause) {
    if (!isCurrentSecurityRequest(pageScope, scope, accountKey)) return false;
    securityPresentation.value = null;
    if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) clearSecurityAccountState();
    console.warn("[security] overview load failed:", cause);
    err.value = t.value.security.opFailed;
    return false;
  } finally {
    if (isCurrentSecurityRequest(pageScope, scope, accountKey)) remoteSecurityLoading.value = false;
  }
}

async function loadMoreSessions(): Promise<void> {
  const snapshot = remoteSecurity.value;
  if (!snapshot?.nextCursor || sessionPageLoading.value || remoteSecurityLoading.value) return;
  const pageScope = securityPageFence.capture("security-sessions-page");
  const scope = captureAccountScope();
  const accountKey = auth.accountId;
  sessionPageLoading.value = true;
  try {
    const nextPage = await accountApi.securityOverview(snapshot.nextCursor);
    if (!isCurrentSecurityRequest(pageScope, scope, accountKey) || remoteSecurity.value !== snapshot) return;
    if (nextPage.nextCursor === snapshot.nextCursor) throw new Error("SECURITY_CURSOR_NOT_ADVANCING");
    const existing = new Set(snapshot.sessions.map((row) => row.id));
    remoteSecurity.value = { ...snapshot, nextCursor: nextPage.nextCursor,
      sessions: [...snapshot.sessions, ...nextPage.sessions.filter((row) => !existing.has(row.id))] };
    securityPresentation.value = { ...remoteSecurity.value, sessions: [...remoteSecurity.value.sessions] };
  } catch (cause) {
    if (isCurrentSecurityRequest(pageScope, scope, accountKey) && remoteSecurity.value === snapshot) {
      securityPresentation.value = null;
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) clearSecurityAccountState();
      toast.error(securityErrorMessage(cause));
    }
  } finally {
    if (isCurrentSecurityRequest(pageScope, scope, accountKey)) sessionPageLoading.value = false;
  }
}

function detailVal(e: Event): string {
  return (e as unknown as { detail: { value: string } }).detail.value;
}
function onCurrent(e: Event) {
  current.value = detailVal(e);
  if (pwdFocusField.value === PWD_FIELD_CURRENT) pwdFocusField.value = "";
  if (pwdErrorField.value === PWD_FIELD_CURRENT) { err.value = ""; pwdErrorField.value = ""; }
}
function onNext(e: Event) {
  next.value = detailVal(e);
  if (pwdFocusField.value === PWD_FIELD_NEXT) pwdFocusField.value = "";
  if (pwdErrorField.value === PWD_FIELD_NEXT) { err.value = ""; pwdErrorField.value = ""; }
}
function onConfirmPwd(e: Event) {
  confirmPwd.value = detailVal(e);
  if (pwdFocusField.value === PWD_FIELD_CONFIRM) pwdFocusField.value = "";
  if (pwdErrorField.value === PWD_FIELD_CONFIRM) { err.value = ""; pwdErrorField.value = ""; }
}
function onTwoFactorPassword(e: Event) {
  twoFactorPassword.value = detailVal(e);
  twoFactorPasswordError.value = "";
  twoFactorPasswordFocus.value = false;
}
function onTwoFactorCode(e: Event) {
  twoFactorCode.value = detailVal(e).replace(/\D/g, "").slice(0, 6);
}
function onDeletionPassword(e: Event) {
  deletionPassword.value = detailVal(e);
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
  return remoteApiEnabled ? s.deviceName : `${s.deviceName} · ${surfaceLabel(s)}`;
}

function sessionSecondaryLabel(s: SessionListItem): string {
  const location = remoteApiEnabled ? s.ip : t.value.security.sessionLocation;
  return `${location} · ${lastActiveLabel(s.lastActiveMs)}`;
}

function lastActiveLabel(ms: number | null): string {
  if (ms === null || displayTimestamp(ms) === null) return "—";
  const diff = Date.now() - ms;
  if (diff < 5 * 60 * 1000) return t.value.security.timeJustNow;
  if (diff < 3600 * 1000) return fmt(t.value.security.timeMinutesAgo, { n: Math.floor(diff / 60000) });
  if (diff < 24 * 3600 * 1000) return fmt(t.value.security.timeHoursAgo, { n: Math.floor(diff / 3600000) });
  return fmt(t.value.security.timeDaysAgo, { n: Math.floor(diff / (24 * 3600 * 1000)) });
}

function cancelPwd() {
  // Clearing the form cannot cancel a pending command or its authoritative readback.
  if (securityBusy.value) return;
  editingPwd.value = false;
  err.value = "";
  pwdErrorField.value = "";
  current.value = "";
  next.value = "";
  confirmPwd.value = "";
}

async function submitPasswordChange() {
  if (securityBusy.value) return;
  const pageScope = securityPageFence.capture("password-change");
  const accountScope = captureAccountScope();
  const accountKey = auth.accountId;
  if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
  err.value = "";
  pwdErrorField.value = "";
  if (!current.value) {
    err.value = t.value.login.errorInvalidPassword;
    pwdErrorField.value = PWD_FIELD_CURRENT;
    focusPwdField(PWD_FIELD_CURRENT);
    return;
  }
  if (!isPasswordOk(next.value)) {
    err.value = t.value.security.passwordShort;
    pwdErrorField.value = PWD_FIELD_NEXT;
    focusPwdField(PWD_FIELD_NEXT);
    return;
  }
  if (next.value !== confirmPwd.value) {
    err.value = t.value.security.passwordMismatch;
    pwdErrorField.value = PWD_FIELD_CONFIRM;
    focusPwdField(PWD_FIELD_CONFIRM);
    return;
  }
  const currentPassword = current.value;
  const newPassword = next.value;
  securityBusy.value = true;
  let commandKey: string | null = null;
  let recovered = false;
  try {
      if (remoteApiEnabled) {
        if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
        commandKey = acquireAccountCommandKey(SECURITY_COMMAND_TABLE, accountKey, "password-change", "password");
        const priorReceipt = await accountApi.passwordCommandReceipt(commandKey);
        if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
        if (priorReceipt) recovered = true;
        else await accountApi.changePassword(currentPassword, newPassword, commandKey);
        if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
        if (!(await loadRemoteSecurity())) throw new Error("SECURITY_READBACK_FAILED");
        if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
        releaseAccountCommandKey(SECURITY_COMMAND_TABLE, accountKey, "password-change", commandKey);
    } else {
      security.changePassword(currentPassword, newPassword);
    }
  } catch (cause) {
    if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
    if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) clearSecurityAccountState();
    // Keep the operation number until a committed receipt is confirmed; never store passwords.
    err.value = securityErrorMessage(cause);
    return;
  } finally {
    if (isCurrentSecurityRequest(pageScope, accountScope, accountKey)) securityBusy.value = false;
  }
  if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
  current.value = "";
  next.value = "";
  confirmPwd.value = "";
  editingPwd.value = false;
  toast.success(recovered ? t.value.security.passwordRecovered : t.value.security.passwordSaved);
}

async function toggleTwoFactor(value: boolean) {
  if (securityBusy.value) return;
  if (!requireAccountPhone()) return;
  const pageScope = securityPageFence.capture("two-factor");
  const accountScope = captureAccountScope();
  const accountKey = auth.accountId;
  if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
  if (remoteApiEnabled && !remoteSecurity.value) {
    err.value = t.value.security.opFailed;
    return;
  }
  if (!twoFactorPassword.value) {
    twoFactorPasswordError.value = t.value.security.twoFactorPasswordRequired;
    twoFactorPasswordFocus.value = true;
    toast.error(t.value.login.errorInvalidPassword);
    return;
  }
  if (value === twoFactorEnabled.value) return;
  if (!value) {
    const ok = await uiConfirm({
      title: t.value.security.twoFactorDisable,
      message: t.value.security.twoFactorConfirmDisable,
      danger: true,
      confirmLabel: t.value.security.twoFactorDisable,
      owner: securityConfirmOwner,
    });
    if (!ok || !isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
  }
  if (!remoteApiEnabled) {
    security.setTwoFactor(value, twoFactorPassword.value);
    twoFactorPassword.value = "";
    value ? toast.success(t.value.security.twoFactorEnabledToast) : toast.warn(t.value.security.twoFactorDisabledToast);
    return;
  }
  securityBusy.value = true;
  try {
    const challenge = await accountApi.sendTwoFactorChallenge(value, twoFactorPassword.value);
    if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
    twoFactorTarget.value = value;
    twoFactorChallengeNo.value = challenge.challengeNo;
    twoFactorPhoneMasked.value = challenge.phoneMasked;
    twoFactorCode.value = "";
    toast.success(t.value.addrRebind.otpSendCta);
  } catch (cause) {
    if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
    if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) clearSecurityAccountState();
    console.warn("[security] 2FA challenge failed:", cause);
    err.value = securityErrorMessage(cause);
  } finally {
    if (isCurrentSecurityRequest(pageScope, accountScope, accountKey)) securityBusy.value = false;
  }
}

async function confirmTwoFactorChallenge() {
  if (securityBusy.value || twoFactorTarget.value === null || !twoFactorChallengeNo.value) return;
  if (!/^\d{6}$/.test(twoFactorCode.value)) {
    err.value = t.value.addrRebind.otpExpired;
    return;
  }
  const pageScope = securityPageFence.capture("two-factor-confirm");
  const accountScope = captureAccountScope();
  const accountKey = auth.accountId;
  const target = twoFactorTarget.value;
  securityBusy.value = true;
  try {
    await accountApi.updateTwoFactor(target, twoFactorPassword.value, twoFactorChallengeNo.value, twoFactorCode.value);
    if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
    if (!(await loadRemoteSecurity())) throw new Error("SECURITY_READBACK_FAILED");
    if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
    twoFactorPassword.value = "";
    twoFactorCode.value = "";
    twoFactorChallengeNo.value = "";
    twoFactorPhoneMasked.value = "";
    twoFactorTarget.value = null;
    target ? toast.success(t.value.security.twoFactorEnabledToast) : toast.warn(t.value.security.twoFactorDisabledToast);
  } catch (cause) {
    if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
    if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) clearSecurityAccountState();
    console.warn("[security] 2FA update failed:", cause);
    err.value = securityErrorMessage(cause);
  } finally {
    if (isCurrentSecurityRequest(pageScope, accountScope, accountKey)) securityBusy.value = false;
  }
}

async function handleRevoke(s: SessionListItem) {
  if (remoteApiEnabled && (!remoteSecurity.value || remoteSecurityLoading.value)) return;
  if (securityBusy.value) return;
  const pageScope = securityPageFence.capture("session-revoke");
  const accountScope = captureAccountScope();
  const accountKey = auth.accountId;
  if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
  const ok = await uiConfirm({
    title: t.value.security.sessionRevoke,
    message: `${t.value.security.sessionRevokeConfirm}\n\n${sessionDeviceLabel(s)} · ${t.value.security.sessionLocation}`,
    danger: true,
    owner: securityConfirmOwner,
  });
  if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
  if (ok) {
    securityBusy.value = true;
    try {
      if (remoteApiEnabled) {
        if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
        if (!remoteSecurity.value || remoteSecurityLoading.value) return;
        await accountApi.revokeSession(s.id);
        if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
        if (!(await loadRemoteSecurity())) throw new Error("SECURITY_READBACK_FAILED");
        if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
      } else session.revokeSession(s.id);
      toast.success(t.value.security.sessionRevoked);
    } catch (cause) {
      if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
    if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) clearSecurityAccountState();
      toast.error(securityErrorMessage(cause));
    } finally {
      if (isCurrentSecurityRequest(pageScope, accountScope, accountKey)) securityBusy.value = false;
    }
  }
}

async function handleRevokeAll() {
  if (remoteApiEnabled && (!remoteSecurity.value || remoteSecurityLoading.value)) return;
  if (!hasOtherSessions.value || securityBusy.value) return;
  const pageScope = securityPageFence.capture("session-revoke-all");
  const accountScope = captureAccountScope();
  const accountKey = auth.accountId;
  if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
  const ok = await uiConfirm({
    title: t.value.security.revokeAll,
    message: t.value.security.revokeAllConfirm,
    danger: true,
    owner: securityConfirmOwner,
  });
  if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
  if (ok) {
    securityBusy.value = true;
    try {
      if (remoteApiEnabled) {
        if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
        if (!remoteSecurity.value || remoteSecurityLoading.value) return;
        await accountApi.revokeOtherSessions();
        if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
        if (!(await loadRemoteSecurity())) throw new Error("SECURITY_READBACK_FAILED");
        if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
      } else session.revokeAllOtherSessions();
      toast.success(t.value.security.revokeAllDone);
    } catch (cause) {
      if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
    if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) clearSecurityAccountState();
      toast.error(securityErrorMessage(cause));
    } finally {
      if (isCurrentSecurityRequest(pageScope, accountScope, accountKey)) securityBusy.value = false;
    }
  }
}

async function handleDeleteAccount() {
  // 🔴 重入闸(审计 P2):本函数在「刷新权威面」处有一次真网络往返 —— 没有这道闸,
  //   双击会各推一个确认弹窗进队列(confirm 是队列不是单例),确认完第一个立刻露出
  //   第二个一模一样的,极易连着点两次。同文件另外两个操作(改密 / 2FA)都有同款闸。
  if (securityBusy.value) return;
  const pageScope = securityPageFence.capture("account-deletion");
  const accountScope = captureAccountScope();
  const accountKey = auth.accountId;
  if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
  if (remoteApiEnabled && !remoteSecurity.value) {
    toast.error(t.value.security.opFailed);
    return;
  }
  if (deletionPending.value) {
    toast.info(t.value.security.deleteAccountPending);
    return;
  }
  if (remoteApiEnabled && !deletionPassword.value) {
    toast.error(t.value.login.errorInvalidPassword);
    return;
  }
  // 🔴 重入闸的另一半:入口挡掉的是「busy 期间再点」,这里保证 busy 覆盖**整个**流程
  //   (含刷新等待与确认弹窗停留),所有出口统一由 finally 放闸 —— 不靠每条 return 记得复位。
  securityBusy.value = true;
  try {
    // 余额、提现列表和质押均须读取成功，未知状态不能按已结清放行。
    if (remoteApiEnabled) {
      if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
      const [fleet, withdrawals, stake] = await Promise.allSettled([
        app.refreshRemoteFleet(), app.refreshRemoteWithdrawalList(), staking.syncRemote(),
      ]);
      if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
      const fleetOk = fleet.status === "fulfilled" && fleet.value === true;
      const withdrawalsOk = withdrawals.status === "fulfilled" && withdrawals.value === true;
      const stakeOk = stake.status === "fulfilled" && stake.value === true;
      if (!fleetOk || !withdrawalsOk || !stakeOk) {
        toast.error(t.value.security.deleteAccountVerifyFailed);
        return;
      }
    }
    // 沿用提现记录的在途判据和处理入口。
    if (app.inFlightWithdrawals.length > 0) {
      const view = await uiConfirm({
        title: t.value.security.deleteAccount,
        message: t.value.security.deleteAccountBlockedByWithdrawal,
        confirmLabel: t.value.security.deleteAccountViewWithdrawals,
        owner: securityConfirmOwner,
      });
      if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
      if (view && !(await navTo("/pages/me/wallet-withdraw-tracking"))
        && isCurrentSecurityRequest(pageScope, accountScope, accountKey)) toast.error(t.value.ui.navigationFailed);
      return;
    }
    // 本金尚未回到可用余额的质押，包括已到期但未领取的部分。
    const lockedPrincipal = staking.positions
      .filter((p) => p.status === "pending-lock" || p.status === "active" || p.status === "matured")
      .reduce((s, p) => s + p.amountUSDT, 0);
    if (lockedPrincipal > 0) {
      const stakingVisible = config.isEnabled("stakingVisible");
      const view = await uiConfirm({
        title: t.value.security.deleteAccount,
        message: fmt(stakingVisible ? t.value.security.deleteAccountBlockedByPrincipal : t.value.security.deleteAccountBlockedByHiddenStaking, { principal: formatAmount(lockedPrincipal, "full") }),
        confirmLabel: stakingVisible ? t.value.security.deleteAccountViewStaking : t.value.help.contactSupport,
        owner: securityConfirmOwner,
      });
      if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
      if (view && !(await navTo(stakingVisible ? "/pages/staking/staking" : "/pages/support/chat?start=support"))
        && isCurrentSecurityRequest(pageScope, accountScope, accountKey)) toast.error(t.value.ui.navigationFailed);
      return;
    }
    if (app.user.usdtBalance > 0 || app.user.nexBalance > 0) {
      const hasNex = app.user.nexBalance > 0;
      const view = await uiConfirm({
        title: t.value.security.deleteAccount,
        message: fmt(t.value.security.deleteAccountBlockedByBalance, {
          usdt: formatAmount(app.user.usdtBalance, "full"), nex: formatAmount(app.user.nexBalance, "full"),
        }),
        confirmLabel: hasNex ? t.value.security.deleteAccountViewExchange : t.value.security.deleteAccountWithdrawBalance,
        owner: securityConfirmOwner,
      });
      if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
      if (view && !(await navTo(hasNex ? "/pages/me/wallet-exchange" : "/pages/me/wallet-withdraw-method"))
        && isCurrentSecurityRequest(pageScope, accountScope, accountKey)) toast.error(t.value.ui.navigationFailed);
      return;
    }
    const ok = await uiConfirm({
      title: t.value.security.deleteAccount,
      message: `${t.value.security.deleteAccountSettlementRequirements}\n\n${t.value.security.deleteAccountConfirm}`,
      danger: true,
      confirmLabel: t.value.security.deleteAccount,
      owner: securityConfirmOwner,
    });
    if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
    if (ok) {
      if (remoteApiEnabled) {
        if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
        const intent = "account-deletion-request";
        deletionCommandKey.value = acquireAccountCommandKey(
          SECURITY_COMMAND_TABLE,
          accountKey,
          intent,
          "app-security:account-deletion",
        );
        try {
          const request = await accountApi.requestAccountDeletion(deletionPassword.value, deletionCommandKey.value);
          if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
          releaseAccountCommandKey(SECURITY_COMMAND_TABLE, accountKey, intent, deletionCommandKey.value);
          deletionCommandKey.value = "";
          if (request.status === "CANCELLED") {
            deletionStatus.value = request;
            toast.info(t.value.security.deleteAccountCancelledReplay);
            return;
          }
          useConversations().discardHumanOutbox();
          toast.success(t.value.security.deleteAccountToast, request.requestNo);
          const logoutRevision = sessionVault.revision();
          app.interruptAllTasks("logged-out");
          await app.pauseLocalPhoneRuntimeBeforeSignOut();
          if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)
              || (sessionVault.revision() !== logoutRevision && !sessionVault.isRefreshContinuation(logoutRevision))) return;
          try {
            await authApi.logout();
          } catch {
            if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
            // Remote deletion is already accepted. Clear this shell even when
            // native cleanup needs another startup, while reporting failure.
            toast.warn(t.value.session.nativeStorageFailure);
          }
          if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
          if (sessionVault.read()) return; // A newer login won the logout CAS.
        } catch (cause) {
          if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
    if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) clearSecurityAccountState();
          toast.error(securityErrorMessage(cause));
          return;
        }
      } else {
        if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
        if (!deleteMockAuthAccount(auth.accountId)) {
          toast.error(t.value.security.opFailed);
          return;
        }
        toast.success(t.value.security.deleteAccountToast);
      }
      if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
      if (!remoteApiEnabled) app.interruptAllTasks("logged-out");
      if (!remoteApiEnabled) useConversations().discardHumanOutbox();
      session.signOutSession();
      auth.signOut();
      // 删除账号即登出兜底:清全部账号级数据内存残留(P2-8 纵深防御)。app + 28 store 归 default。
      app.bindAccount("default");
      rebindAccountScopedStores("default");
      navReset({ url: "/pages/login/login", fail: () => {} });
    }
  } finally {
    if (isCurrentSecurityRequest(pageScope, accountScope, accountKey)) securityBusy.value = false;
  }
}

async function handleCancelAccountDeletion() {
  if (!remoteApiEnabled || !remoteSecurity.value || !deletionCanCancel.value || securityBusy.value) return;
  const pageScope = securityPageFence.capture("account-deletion-cancel");
  const accountScope = captureAccountScope();
  const accountKey = auth.accountId;
  if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
  const ok = await uiConfirm({
    title: t.value.security.cancelDeletionRequest,
    message: t.value.security.cancelDeletionMessage,
    danger: true,
    confirmLabel: t.value.security.cancelDeletionRequest,
    owner: securityConfirmOwner,
  });
  if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
  if (!ok) return;
  securityBusy.value = true;
  try {
    if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
    const current = deletionStatus.value;
    if (current.status === "NONE") return;
    const intent = `account-deletion-cancel:${current.requestNo}:${current.version}`;
    const key = acquireAccountCommandKey(
      SECURITY_COMMAND_TABLE,
      accountKey,
      intent,
      "app-security:account-deletion-cancel",
    );
    await accountApi.cancelAccountDeletion(current.version, key);
    if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
    if (!(await loadRemoteSecurity())) throw new Error("SECURITY_READBACK_FAILED");
    if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
    if (deletionStatus.value.status !== "CANCELLED") throw new Error("SECURITY_READBACK_FAILED");
    releaseAccountCommandKey(SECURITY_COMMAND_TABLE, accountKey, intent, key);
    const requestKey = readAccountRow<{ commands: Record<string, string> }>(SECURITY_COMMAND_TABLE, accountKey)
      ?.commands["account-deletion-request"];
    if (requestKey) releaseAccountCommandKey(SECURITY_COMMAND_TABLE, accountKey, "account-deletion-request", requestKey);
    deletionCommandKey.value = "";
    toast.success(t.value.security.cancelDeletionSuccess);
  } catch (cause) {
    if (!isCurrentSecurityRequest(pageScope, accountScope, accountKey)) return;
    if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) clearSecurityAccountState();
    toast.error(securityErrorMessage(cause));
    await loadRemoteSecurity();
  } finally {
    if (isCurrentSecurityRequest(pageScope, accountScope, accountKey)) securityBusy.value = false;
  }
}

// UI carriers only: the existing security commands retain their validation and request fences.
function openTwoFactorSheet() {
  if (securityBusy.value || (remoteApiEnabled && (!remoteSecurity.value || remoteSecurityLoading.value))) return;
  requestedTwoFactor.value = !twoFactorEnabled.value;
  twoFactorSheetOpen.value = true;
}
function closeTwoFactorSheet() {
  if (securityBusy.value) return;
  twoFactorSheetOpen.value = false;
  twoFactorCode.value = "";
  twoFactorChallengeNo.value = "";
  twoFactorPhoneMasked.value = "";
  twoFactorTarget.value = null;
  twoFactorPassword.value = "";
  twoFactorPasswordError.value = "";
}
function closeDeletionSheet() {
  if (securityBusy.value) return;
  deletionSheetOpen.value = false;
  deletionPassword.value = "";
}
function openDeletionSheet() {
  if (securityBusy.value || deletionPending.value) return;
  deletionSheetOpen.value = true;
}
watch(twoFactorEnabled, (value) => { if (value === requestedTwoFactor.value) twoFactorSheetOpen.value = false; });

// ── styles ──
function iconBox(bg: string): CSSProperties {
  return {
    width: "40px",
    height: "40px",
    borderRadius: "var(--ui-radius-icon)",
    background: bg,
  };
}

// De-carded settings group (form b): filled surface, no border. The first group
// sits at the global 24px header gap (no top margin); groupGap spaces the rest.
const cardStyle: CSSProperties = { boxShadow: "none",
  padding: "0 16px",
  background: "var(--v5-surface)",
  borderRadius: "var(--ui-radius-surface)",
};
const groupGap: CSSProperties = { marginTop: "var(--v5-space-3)" };
const rowStyle: CSSProperties = {
  boxSizing: "border-box",
  gap: "var(--v5-space-3)",
  minHeight: "64px",
  padding: "10px 0",
};
const rowBorderedStyle: CSSProperties = {
  boxSizing: "border-box",
  gap: "var(--v5-space-3)",
  minHeight: "64px",
  padding: "9.5px 0",
  borderTop: "1px solid var(--v5-border)",
};
const rowLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  lineHeight: "20px",
  color: "var(--v5-ink)",
};
const rowSubStyle: CSSProperties = {
  marginTop: "2px",
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  lineHeight: "16px",
  color: "var(--v5-ink-3)",
};
const passwordHintStyle: CSSProperties = { ...rowSubStyle, lineHeight: "16px", whiteSpace: "normal", overflowWrap: "anywhere" };
const chevronStyle: CSSProperties = { flexShrink: 0 };
const footerStyle: CSSProperties = {
  marginTop: "var(--v5-space-2)",
  marginLeft: "var(--v5-space-5)",
  marginRight: "var(--v5-space-5)",
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
  lineHeight: "18px",
};
const mockModeBannerStyle: CSSProperties = {
  marginTop: "10px",
  padding: "8px 10px",
  borderRadius: "8px",
  background: "var(--v5-warning-soft)",
};
const mockModeBannerTextStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--v5-warning)",
};
const remoteSecurityUnavailableStyle: CSSProperties = {
  marginTop: "10px",
  padding: "10px 12px",
  borderRadius: "8px",
  background: "var(--v5-surface-2)",
};
const remoteSecurityUnavailableTextStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
const remoteSecurityRetryTextStyle: CSSProperties = {
  font: "600 13px/20px var(--font-v5)",
  color: "var(--v5-brand)",
};
const unavailableValueStyle: CSSProperties = {
  marginLeft: "auto",
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  color: "var(--v5-ink-4)",
};
// Section label (de-card spec): 15/600/ink.
const sectionHeadStyle: CSSProperties = {
  marginLeft: "var(--v5-space-5)",
  marginRight: "var(--v5-space-5)",
  marginTop: "var(--v5-space-8)",
  marginBottom: "var(--v5-space-3)",
  fontFamily: "var(--font-v5)",
  fontSize: "17px",
  lineHeight: "24px",
  fontWeight: 600,
  letterSpacing: "-0.012em",
  color: "var(--v5-ink)",
};
const pwdFormStyle: CSSProperties = {
  borderTop: "1px solid var(--v5-border)",
  padding: "12px 0",
  display: "flex",
  flexDirection: "column",
  gap: "var(--v5-space-2)",
};
const pwdInputStyle: CSSProperties = {
  height: "44px",
  background: "var(--v5-surface-2)",
  borderRadius: "8px",
  padding: "0 12px",
  fontFamily: "var(--font-v5)",
  fontSize: "var(--ui-type-input)",
  lineHeight: "var(--ui-type-input-lh)",
  color: "var(--v5-ink)",
};
const errStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "var(--ui-type-list-subtitle)",
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
  fontSize: "var(--ui-type-button)",
  fontWeight: "var(--ui-type-button-weight)",
  color: "var(--v5-on-brand)",
};
const toggleTrackStyle = computed<CSSProperties>(() => ({
  position: "relative",
  width: "44px",
  height: "26px",
  borderRadius: "var(--v5-radius-full)",
  background: displayTwoFactorEnabled.value ? "var(--v5-brand)" : "var(--v5-surface-3)",
  boxShadow: displayTwoFactorEnabled.value ? "none" : "inset 0 0 0 1px var(--v5-border)",

}));
const toggleThumbStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  top: "3px",
  left: "3px",
  width: "20px",
  height: "20px",
  borderRadius: "var(--v5-radius-full)",
  background: "var(--ui-switch-thumb)",
  boxShadow: "0 1px 3px var(--v5-bg-color-mask)",
  transform: `translateX(${displayTwoFactorEnabled.value ? 18 : 0}px)`,
  transition: "transform 200ms ease",
}));
const currentBadgeStyle: CSSProperties = {
  flexShrink: 0,
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  lineHeight: "16px",
  fontWeight: 400,
  color: "var(--v5-success-ink)",
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
  fontSize: "var(--ui-type-body)",
  color: "var(--v5-danger)",
};
const dangerLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "var(--ui-type-body)",
  color: "var(--v5-danger)",
};


</script>

<style scoped>
.security-providers { margin-top:18px; margin-bottom:var(--v5-space-6); }
.security-providers :deep(.oauth-title) { font:600 17px/24px var(--font-v5); margin:0 4px 12px; color:var(--v5-ink); }
.security-providers :deep(.auth-provider) { position:relative; height:88px; min-height:88px; border-radius:18px; background:var(--v5-surface); gap:6px; }
.security-providers :deep(.auth-provider--linked) { box-shadow:none; }
:global([data-theme="light"] .security-providers .auth-provider--linked) { box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--v5-success) 55%,transparent); }
.security-providers :deep(.auth-provider--linked)::after { content:""; position:absolute; top:8px; right:8px; width:18px; height:18px; display:grid; place-items:center; border-radius:50%; background:var(--v5-success); color:var(--v5-on-brand); font-size:12px; }
.security-phone { margin-top:0!important; border-radius:0 0 22px 22px!important; }
.security-phone > view:first-child { margin-inline:-16px; padding-inline:16px!important; border-top:1px solid var(--v5-border); }
.security-session-meta { font-family:var(--font-metric)!important; }
.security-providers :deep([data-provider="Google"] .auth-provider__icon) { width:22px; height:22px; flex-basis:22px; }
.security-providers :deep([data-provider="Google"] svg) { width:22px; height:22px; flex-shrink:0; }
.security-providers :deep([data-provider="Apple"] .auth-provider__icon) { color:var(--v5-ink); }
.security-providers :deep([data-provider="Telegram"] .auth-provider__icon) { width:22px; height:22px; flex-basis:22px; }
.security-providers :deep([data-provider="Telegram"] svg) { width:22px; height:22px; flex-shrink:0; transform:translateY(-1px); }
.security-providers :deep([data-provider="Telegram"] path) { fill:var(--ui-telegram-brand); }
.security-providers :deep(.auth-provider--linked)::before { content:""; position:absolute; z-index:1; top:11.5px; right:11.5px; width:11px; height:11px; background:var(--v5-on-brand); mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 12.5 5 4.5 9-9.5'/%3E%3C/svg%3E") center/contain no-repeat; }
.security-credentials { border-radius:22px 22px 0 0!important; }
.security-phone-icon { flex:none; display:grid; place-items:center; width:36px; height:36px; border-radius:var(--ui-radius-icon); background:var(--v5-tech-cyan-soft); color:var(--v5-tech-cyan); }
.security-danger { margin-top:var(--v5-space-8)!important; }
.security-sheet-form { display:flex; flex-direction:column; gap:var(--v5-space-3); }
.security-sheet-form input { box-sizing:border-box; min-width:0; }
.security-sheet-form .nx-button { flex:1; }
.security-sheet-note { font-size:13px; line-height:20px; color:var(--v5-ink-3); }
</style>

<style scoped>
.security-providers :deep(.third-party-auth) { margin-top:19px; }
.security-providers :deep(.auth-provider-grid) { gap:var(--v5-space-2); }
.security-providers :deep(.auth-provider__label) { font-size:13px; line-height:18px; color:var(--v5-ink); }
.security-providers :deep(.auth-provider--linked .auth-provider__status) { color:var(--v5-success-ink); line-height:16px; }
.security-phone-icon { width:40px; height:40px; }
</style>


<style scoped>
.security-credentials > view:nth-child(2) { margin-inline:calc(-1 * var(--v5-space-4)); padding-inline:var(--v5-space-4)!important; }
</style>

<style scoped>
.security-half-sheet :deep(.nx-sheet) { min-height:50vh; }
.security-half-sheet :deep(.nx-sheet__body) { flex:1; }
.security-half-sheet :deep(.nx-sheet__footer) > .nx-button { width:100%; }
</style>
