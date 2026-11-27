<template>
  <view v-if="providers?.length || intent === 'LINK'" class="third-party-auth" data-testid="third-party-auth">
    <text class="oauth-title">{{ intent === "LINK" ? t.thirdParty.linkTitle : t.thirdParty.signInTitle }}</text>
    <text v-if="intent === 'LINK' && providers?.length === 0" class="oauth-copy">{{ t.thirdParty.unavailable }}</text>
    <!-- LINK reads two lists and recovers them silently (03 §3.4, §3.5.2). First read with both unknown: placeholder tiles of
         the final size. Bound list still unknown: the tiles stay greyed and the line below says when binding opens. -->
    <AuthProviderGrid v-if="labels.length || listsLoading" :providers="labels" :linked="linkedLabels" :placeholders="listsLoading ? providerCount : 0"
      :busy="!!flow || submitting || providersDisabled" :preserve-appearance="providersDisabled && !flow && !submitting && !unavailableReason && !linkedUnknown"
      :unavailable-reason="unavailableReason || (linkedUnknown ? t.thirdParty.linkedLoading : undefined)" @select="start" />
    <text v-if="linkedUnknown && !unavailableReason" class="oauth-copy">{{ t.thirdParty.linkedLoading }}</text>
    <component :is="sheet && intent === 'LINK' ? NxSheet : 'view'" v-if="flow" :open="!!flow" :title="t.thirdParty.linkTitle" :class="sheet ? 'oauth-panel-sheet' : 'oauth-panel'"
      :close-locked-by="submitting ? 'oauth-panel-status' : undefined" aria-live="polite" @close="cancelFromUser">
      <!-- The panel's status line. While submitting it says why 取消 and the sheet's close wait (03 §3.1: the reason may sit in
           the panel above the button); swapping its text keeps every control in place and in view. -->
      <text id="oauth-panel-status" class="oauth-copy">{{ submitting ? t.thirdParty.submitLocked : verified ? t.thirdParty.confirmIdentity : t.thirdParty.browserPrompt }}</text>
      <text v-if="verified" class="oauth-identity">{{ label(selected) }} · {{ displayName }}</text>
      <!-- The security sheet is not a short sign-in flow, so the field keeps a visible label (03 §3.3). -->
      <text v-if="verified && intent === 'LINK'" class="oauth-label">{{ t.security.currentPassword }}</text>
      <input v-if="verified && intent === 'LINK'" v-model="password" password :maxlength="128"
        :aria-label="t.security.currentPassword" class="oauth-input" />
      <view v-if="challengeNo">
        <text class="oauth-copy">{{ t.thirdParty.codePrompt }} {{ deliveryHint }}</text>
        <input v-model="code" type="number" :maxlength="6" :placeholder="t.thirdParty.codeLabel"
          :aria-label="t.thirdParty.codeLabel" class="oauth-input" />
      </view>
      <!-- 03 §3.1: confirm is the primary L action, cancel is neutral glass L; busy shows NxButton's spinner. -->
      <NxButton v-if="verified" class="oauth-action" variant="primary" :label="confirmLabel" :busy="submitting"
        :disabled="completionDisabled" :aria-describedby="completionReason && !submitting ? 'oauth-confirm-reason' : undefined" @click="complete()" />
      <!-- 03 §3.1: where confirm can be greyed for a missing password or code, the line under it names what is missing. It keeps
           its height once filled, hidden from view and from screen readers, so 取消 does not jump. -->
      <text v-if="verified && (intent === 'LINK' || challengeNo)" id="oauth-confirm-reason" class="oauth-reason"
        :class="{ 'oauth-reason--off': !completionReason || submitting }"
        :aria-hidden="completionReason && !submitting ? undefined : 'true'">{{ completionReason }}</text>
      <!-- While confirm is submitting there is nothing to cancel yet (mask, Esc and back keep the same guard), so 取消 steps out
           of the way instead of sitting greyed far from its reason; the status line above and confirm's spinner say what is under way.
           It keeps its place (hidden from view, focus and screen readers), so the card and the sheet do not change height. -->
      <NxButton class="oauth-action" :class="{ 'oauth-action--held': submitting }" variant="secondary" :label="t.ui.cancel"
        :disabled="submitting" @click="cancelFromUser" />
    </component>
    <!-- The host page owns recovery of an unknown sign-in result. -->
    <text v-if="message" class="oauth-copy" role="status">{{ message }}</text>
    <ServerCaptchaSlider v-if="showCaptcha" scene="LOGIN" phone="" @success="captchaComplete" @close="showCaptcha = false" />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import NxSheet from "@/components/ui/nx-sheet.vue";
import NxButton from "@/components/ui/nx-button.vue";
import AuthProviderGrid from "@/components/auth-provider-grid.vue";
import ServerCaptchaSlider from "@/components/server-captcha-slider.vue";
import { useT } from "@/i18n/use-t";
import { apiClient, authApi, sessionVault } from "@/api/runtime";
import { createOAuthProviderApi, type OAuthFlow, type ThirdPartyProvider } from "@/api/oauth-provider-api";
import { completeSignIn } from "@/auth/complete-sign-in";
import { stageRemoteRegistrationReceipt } from "@/auth/remote-registration-receipt";
import { navReset } from "@/lib/route";
import { toast } from "@/store/ui";
import { useLocaleStore } from "@/store/locale";
import { ApiError } from "@/api/errors";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { hasVisiblePullRefresh } from "@/lib/active-page-refresh";
import { remoteAccountScope } from "@/lib/remote-account-epoch";
import { listenForNativeOAuthReturn, validOAuthBrowserReceipt, type OAuthBrowserReceipt } from "@/auth/oauth-browser-return";

// beforeStart lets the host page veto a start (e.g. an invalid typed invite code) before the provider opens.
// sponsorRejected hands the refused invite code, as sent, back to the host page that owns the invite field.
const props = withDefaults(defineProps<{ intent?: "LOGIN" | "LINK"; sheet?: boolean; disabled?: boolean; returnTo?: string | null; sponsorCode?: string | null; beforeStart?: (() => Promise<boolean>) | null; sponsorRejected?: ((sent: string | null) => void) | null; unavailableReason?: string }>(), {
  intent: "LOGIN", disabled: false, returnTo: null, sponsorCode: null, beforeStart: null, sponsorRejected: null,
});
const t = useT();
const emit = defineEmits<{ (event: "busy", busy: boolean): void }>();
const api = createOAuthProviderApi(apiClient, authApi);
let disposed = false;

function useProviderList(read: () => Promise<ThirdPartyProvider[]>, active?: () => boolean) {
  const list = ref<ThirdPartyProvider[] | null>(null);
  const recovery = useAutoRecovery({
    active,
    failed: () => list.value === null,
    retry: async () => {
      const scope = remoteAccountScope.snapshot();
      const result = await read();
      if (!disposed && remoteAccountScope.isCurrent(scope)) list.value = result;
    },
    repeatMs: 30_000,
    repeatWhile: () => !hasVisiblePullRefresh(),
  });
  onMounted(() => { void recovery.retry(); });
  return list;
}

const providers = useProviderList(api.available);
const linked = useProviderList(api.linked, () => props.intent === "LINK");
const providersDisabled = computed(() => props.disabled || (props.intent === "LINK" && linked.value === null));
const flow = ref<OAuthFlow | null>(null);
const selected = ref<ThirdPartyProvider>("GOOGLE");
const verified = ref(false);
const displayName = ref("");
const message = ref("");
const password = ref("");
const challengeNo = ref("");
const code = ref("");
const deliveryHint = ref("");
const submitting = ref(false);
const confirmLabel = computed(() => props.intent === "LINK" ? t.value.thirdParty.confirmLink : t.value.thirdParty.continueLogin);
const completionDisabled = computed(() => submitting.value || (props.intent === "LINK" && !password.value)
  || (!!challengeNo.value && !/^\d{6}$/.test(code.value)));
const completionReason = computed(() => props.intent === "LINK" && !password.value ? t.value.security.twoFactorPasswordRequired
  : !!challengeNo.value && !/^\d{6}$/.test(code.value) ? t.value.login.errorInvalidCode : "");
const showCaptcha = ref(false);
const names = { GOOGLE: "Google", APPLE: "Apple", TELEGRAM: "Telegram" } as const;
const label = (provider: ThirdPartyProvider) => names[provider];
const providerCount = Object.keys(names).length;
const listsLoading = computed(() => props.intent === "LINK" && providers.value === null && linked.value === null);
const linkedUnknown = computed(() => props.intent === "LINK" && linked.value === null && !!providers.value?.length);
const linkedLabels = computed(() => props.intent === "LINK" ? (linked.value ?? []).map(label) : []);
const labels = computed(() => (props.intent === "LINK"
  ? [...new Set([...(providers.value ?? []), ...(linked.value ?? [])])] : (providers.value ?? [])).map(label));
let generation = 0;
let pollVersion = 0;
let revision = 0;
let expiresAt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let popup: Window | null = null;
let sentSponsorCode: string | null = null;
function sameSession() {
  return sessionVault.revision() === revision
    || (props.intent === "LINK" && sessionVault.isRefreshContinuation(revision));
}
function acceptReceipt(receipt: OAuthBrowserReceipt) {
  if (!flow.value || disposed || flow.value.flowId !== receipt.flowId) return;
  flow.value.receipt = receipt.receipt;
  if (timer) clearTimeout(timer);
  void poll(generation);
}
const stopNativeReturn = listenForNativeOAuthReturn(acceptReceipt);
function browserMessage(event: MessageEvent) {
  if (!flow.value || event.source !== popup || event.origin !== new URL(flow.value.authorizationUrl).origin
      || event.data?.type !== "uvel-oauth" || !validOAuthBrowserReceipt(event.data)) return;
  acceptReceipt(event.data);
}

function cancel() {
  generation++;
  pollVersion++;
  if (timer) clearTimeout(timer);
  popup?.close(); popup = null;
  flow.value = null; verified.value = false; password.value = ""; code.value = ""; challengeNo.value = "";
  showCaptcha.value = false;
  emit("busy", false);
}
function cancelFromUser() {
  if (submitting.value) return;
  if (props.intent === "LOGIN" && !authApi.pendingLogin()
      && authApi.pendingLoginContext()?.context.flowId === flow.value?.flowId) authApi.cancelLoginChallenge();
  cancel();
}
function errorMessage(cause: unknown): string {
  const error = cause instanceof ApiError ? cause.message : "";
  if (["USER_REGISTRATION_K1_IP_LIMIT", "USER_REGISTRATION_DEVICE_LIMIT"].includes(error)) return t.value.register.errorSignupLimited;
  if (error === "OAUTH_LOGIN_EXPIRED") return t.value.thirdParty.restartExpired;
  if (error === "OAUTH_ACCOUNT_LINK_REQUIRED") return t.value.thirdParty.linkRequired;
  if (error === "USER_REGISTRATION_SPONSOR_NOT_FOUND" || error === "USER_REGISTRATION_SPONSOR_INVALID") return t.value.register.inviteInvalid;
  if (error?.startsWith("USER_REGISTRATION_SPONSOR_")) return t.value.register.sponsorEnvironmentMismatch;
  if (error === "OAUTH_LINK_PASSWORD_INVALID") return t.value.thirdParty.passwordInvalid;
  if (error === "OAUTH_IDENTITY_ALREADY_LINKED" || error === "OAUTH_PROVIDER_ALREADY_LINKED")
    return t.value.thirdParty.linkConflict;
  if (error === "USER_TWO_FACTOR_CHALLENGE_INVALID") return t.value.thirdParty.codeInvalid;
  if (error === "USER_PASSWORD_RESET_REQUIRED") return t.value.thirdParty.passwordReset;
  return t.value.thirdParty.failed;
}
// A refused invite code ends this flow: retrying would send the same code. The host
// page reopens its invite field with the prompt; without a host handler it shows here.
function sponsorRefused(cause: unknown): boolean {
  if (!(cause instanceof ApiError)
      || !["USER_REGISTRATION_SPONSOR_NOT_FOUND", "USER_REGISTRATION_SPONSOR_INVALID"].includes(cause.message)) return false;
  cancel();
  if (props.sponsorRejected) props.sponsorRejected(sentSponsorCode);
  else toast.error(t.value.register.inviteInvalid);
  return true;
}
async function start(name: string) {
  if (flow.value || submitting.value || providersDisabled.value || disposed) return;
  if (props.intent === "LOGIN" && authApi.pendingLogin()) { message.value = t.value.login.unknownAttempt; return; }
  const provider = (Object.keys(names) as ThirdPartyProvider[]).find(key => names[key] === name);
  if (!provider || !providers.value?.includes(provider)
      || (props.intent === "LINK" && linked.value?.includes(provider))) return;
  const current = ++generation;
  revision = sessionVault.revision();
  selected.value = provider; message.value = ""; submitting.value = true; emit("busy", true);
  // Reserve a popup synchronously during the click; never use an embedded provider WebView.
  // #ifdef H5
  popup = window.open("about:blank", "_blank");
  if (!popup) { toast.error(t.value.thirdParty.popupBlocked); submitting.value = false; emit("busy", false); return; }
  // #endif
  try {
    // The popup above is only a blank reservation; a veto closes it before any provider page loads.
    if (props.beforeStart && !(await props.beforeStart())) { cancel(); return; }
    sentSponsorCode = props.sponsorCode;
    const next = await api.start(provider, props.intent, sentSponsorCode);
    if (disposed || current !== generation || !sameSession()) { cancel(); return; }
    flow.value = next; expiresAt = Date.now() + next.expiresInSec * 1000;
    // #ifdef H5
    if (popup) popup.location.href = next.authorizationUrl;
    // #endif
    // #ifdef APP-PLUS
    plus.runtime.openURL(next.authorizationUrl, () => {
      if (current === generation) { cancel(); toast.error(t.value.thirdParty.failed); }
    });
    // #endif
    void poll(current);
  } catch (cause) { if (!sponsorRefused(cause)) { cancel(); toast.error(errorMessage(cause)); } }
  finally { submitting.value = false; }
}
async function poll(current: number) {
  if (disposed || current !== generation || !flow.value || verified.value) return;
  const request = ++pollVersion;
  if (timer) clearTimeout(timer);
  if (Date.now() >= expiresAt || !sameSession()) {
    cancel(); toast.error(t.value.thirdParty.expired); return;
  }
  try {
    const status = await api.status(flow.value);
    if (disposed || current !== generation || request !== pollVersion || verified.value) return;
    if (status.provider !== selected.value) throw new Error("OAUTH_PROVIDER_MISMATCH");
    if (status.status === "VERIFIED") {
      displayName.value = status.displayName || label(selected.value);
      if (flow.value?.receipt) {
        verified.value = true; popup?.close(); popup = null; return;
      }
    }
    else if (status.status !== "PENDING") { cancel(); toast.error(t.value.thirdParty.failed); return; }
  } catch (cause) {
    if (disposed || current !== generation || request !== pollVersion || verified.value) return;
    if (!(cause instanceof ApiError) || cause.kind !== "network") {
      cancel(); toast.error(errorMessage(cause)); return;
    }
  }
  if (!verified.value && request === pollVersion) timer = setTimeout(() => { void poll(current); }, 2000);
}
function captchaComplete(ticket: string) {
  showCaptcha.value = false;
  void complete(ticket);
}
async function complete(captchaTicket?: string) {
  if (!flow.value || !verified.value || completionDisabled.value || disposed) return;
  const current = generation;
  if (Date.now() >= expiresAt || !sameSession()) {
    cancel(); toast.error(t.value.thirdParty.expired); return;
  }
  submitting.value = true; message.value = "";
  try {
    if (props.intent === "LINK") {
      await api.link(flow.value, password.value);
      if (disposed || current !== generation) return;
      // POST is the binding result. A failed optional list refresh must not turn it into a failed mutation.
      if (linked.value && !linked.value.includes(selected.value)) linked.value.push(selected.value);
      cancel(); toast.success(t.value.thirdParty.linkSuccess);
    } else {
      const result = await api.complete(selected.value, flow.value, revision,
        challengeNo.value || undefined, code.value || undefined, captchaTicket);
      if (disposed || current !== generation) {
        if (result.kind === "authenticated") authApi.discardSessionIfCurrent(result.vaultRevision);
        return;
      }
      if (result.kind === "challenge") {
        challengeNo.value = result.challengeNo; deliveryHint.value = result.deliveryHint; code.value = ""; return;
      }
      const registrationDestination = result.registrationReceipt
        ? "/pages/register/success"
        : props.returnTo;
      const completed = completeSignIn({
        identity: `user:${result.user.userId}`, returnTo: registrationDestination,
        serverProfile: result.user, onboardingComplete: result.user.onboardingComplete,
        serverSessionRevision: result.vaultRevision,
        deferNavigation: !!result.registrationReceipt,
        initialOAuthLocale: result.registrationReceipt ? useLocaleStore().code : undefined,
      });
      if (!completed.ok) throw new Error("SIGN_IN_FAILED");
      if (result.registrationReceipt) {
        stageRemoteRegistrationReceipt(result.registrationReceipt, `user:${result.user.userId}`);
        toast.success(t.value.register.registrationSignedIn);
        // #ifdef H5
        navReset({ url: "/pages/register/success", fail: () => navReset({ url: "/pages/onboarding/estimator", fail: () => {} }) });
        // #endif
        // #ifndef H5
        navReset({ url: "/pages/onboarding/estimator", fail: () => {} });
        // #endif
      }
      cancel();
    }
  } catch (cause) {
    if (!disposed && current === generation) {
      if (props.intent === "LOGIN" && authApi.pendingLogin()) {
        // Leave the durable attempt intact. The shared login recovery UI owns
        // ambiguous completion, including recovery after this flow has expired.
        cancel(); message.value = t.value.login.unknownAttempt;
      } else if (cause instanceof ApiError && cause.message === "OAUTH_LOGIN_EXPIRED") {
        cancel(); toast.error(errorMessage(cause));
      } else if (cause instanceof ApiError && ["USER_CAPTCHA_REQUIRED", "USER_CAPTCHA_TICKET_INVALID"].includes(cause.message)) showCaptcha.value = true;
      else if (!sponsorRefused(cause)) toast.error(errorMessage(cause));
    }
  // A refused link keeps the typed password for correction (03 §3.3); success and cancel clear it through cancel().
  } finally { submitting.value = false; }
}
onMounted(() => {
  // #ifdef H5
  window.addEventListener("message", browserMessage);
  // #endif
});
onUnmounted(() => {
  disposed = true; cancel(); stopNativeReturn();
  // #ifdef H5
  window.removeEventListener("message", browserMessage);
  // #endif
});
</script>

<style scoped>
.third-party-auth { margin: var(--v5-space-5) 0; color: var(--v5-ink); }
.oauth-title { display: block; font: var(--ui-type-subheading-weight) var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-v5); margin-bottom: var(--v5-space-3); }
/* Card and sheet descriptions use the description role (10 §10.1); the sheet body is dialog body copy. */
.oauth-copy { display: block; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); margin: var(--v5-space-2) 0; overflow-wrap: break-word; }
.oauth-panel-sheet .oauth-copy { font: var(--ui-type-body-weight) var(--ui-type-body)/var(--ui-type-body-lh) var(--font-v5); color: var(--v5-ink-2); }
/* A plain card (01 §1.1.2): surface fill, 16px inset, default card radius, light shadow in the light theme only.
   Rendered through <component :is="'view'">, which on H5 is a raw inline element, so the card needs display: block. */
.oauth-panel { display: block; padding: var(--v5-space-4); margin-top: var(--v5-space-3); border-radius: var(--ui-radius-surface); background: var(--v5-surface); }
:global([data-theme="light"] .oauth-panel) { box-shadow: var(--v5-glass-shadow); }
.oauth-identity { display: block; overflow-wrap: break-word; font: var(--ui-type-subheading-weight) var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-v5); margin: var(--v5-space-3) 0; }
.oauth-label { display: block; margin-top: var(--v5-space-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
.oauth-input { box-sizing: border-box; min-height: 44px; width: 100%; padding: 10px 12px; border-radius: var(--ui-radius-icon); color: var(--v5-ink); background: var(--v5-surface-3); font: var(--ui-type-input-weight) var(--ui-type-input)/var(--ui-type-input-lh) var(--font-v5); margin: var(--v5-space-3) 0; }
.oauth-label + .oauth-input { margin-top: 4px; }
.oauth-action { display: flex; width: 100%; margin-top: var(--v5-space-3); }
.oauth-action--held { visibility: hidden; }
.oauth-action + .oauth-action, .oauth-reason + .oauth-action { margin-top: var(--v5-space-2); }
.oauth-reason { display: block; min-height: var(--ui-type-description-lh); margin-top: var(--v5-space-2); text-align: center; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
.oauth-reason--off { visibility: hidden; }
</style>

<style scoped>
.oauth-panel-sheet :deep(.nx-sheet) { min-height:50vh; }
</style>
