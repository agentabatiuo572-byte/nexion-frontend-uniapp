import { computed, onScopeDispose, ref } from "vue";
import { defineStore } from "pinia";
import { supportApi } from "@/api/runtime";
import { apiClient,apiRuntimeConfig,sessionVault } from "@/api/runtime";
import { ConversationRealtime } from '@/api/conversation-realtime';
import { createUniRealtimeSocket,setAppConversationRealtime } from '@/api/app-conversation-realtime';
import { catchUpConversation,mergeConversationMessages } from '@/api/conversation-history';
import { conversationPeerKey, groupConversationThreads, type ConversationThread } from '@/api/conversation-threads';
import type { ConversationUserClear } from '@/api/conversation-management';
import { remoteApiEnabled } from "@/api/runtime";
import { ApiError, asApiError } from "@/api/errors";
import { awaitMessageOutcome, isConversationDeliveryAmbiguous, isConversationPeerChanged, isConversationUserClearRejected, MESSAGE_ACK_TIMEOUT_MS, MESSAGE_READBACK_TIMEOUT_MS, SupportReplyRejected } from '@/lib/conversation-delivery-policy';
import { isSupportAttachmentNotReady, type ConversationDismissal, type CurrentAdvisor, type SupportCommandResult } from "@/api/support-api";
import type { Conversation, ConversationCategoryAvailability, ConversationType } from "@/domain/support";
import { opaqueSupportIntentSlot } from "@/lib/support-intent-slot";
import { restoreSupportPending, persistSupportPending, clearSupportPending, retireSupportPending } from "@/lib/support-pending-storage";
import { maintainRemoteSession } from "@/auth/remote-session-maintenance";
import { useConfig } from "@/store/config";
import { passiveTabReadScope } from "@/lib/passive-tab-read";
import { captureRuntimeRevision } from "@/api/order-api";
import { MESSAGE_MAX_LENGTH } from "@/lib/message-length-policy";

/** The server asks for a customer reply before this send; not an ambiguous delivery. */
function isSupportReplyRequired(cause: unknown): boolean {
  return cause instanceof ApiError && cause.status === 409 && cause.message === 'SUPPORT_REPLY_REQUIRED';
}

function mutationKey(scope: string): string {
  const label = scope.split(":", 1)[0].replace(/[^a-z0-9-]/gi, "").slice(0, 24) || "command";
  return `support-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
const restorePending = (accountKey: string, runId: string) => restoreSupportPending(accountKey, runId, "conversations");
const persistPending = (accountKey: string, runId: string, values: Map<string, string>) => persistSupportPending(accountKey, runId, "conversations", values);
type CommandScope = { accountKey: string; epoch: number; runId: string; pending: Map<string, string>; inFlight: Map<string, Promise<unknown>> };
type SnapshotScope = { accountKey: string; epoch: number; runId: string };
type AccountScope = Pick<SnapshotScope, "accountKey" | "epoch">;
export type CategoryRefreshOutcome = "applied" | "stale" | "failed";
export type CategoryAvailabilityStatus = "loading" | "ready" | "failed";
export type HumanComposer = {
  text: string;
  imageDraft: { filePath: string; clientUploadId: string; key: string; state: "uploading" | "ready" | "failed"; attachmentId?: string; error?: "tooLarge" | "unsupported" | "uploadFailed" | "expired"; replaceOnly?: boolean } | null;
  failedSend: { text: string; attachmentId?: string; commandKey?: string; expiresAt?: number; kind: "unknown" | "failed" | "expired"; settled: boolean; retryable: boolean; attempts: number; peerChanged?: true; replyRejected?: true } | null;
  recoveredId?: string;
  retainDraft?: boolean;
  /** Visibility boundary already observed when this draft/unknown was saved. */
  userClearThrough?: number;
};

const HUMAN_OUTBOX_PREFIX = "support-human-outbox:";
const HUMAN_PENDING_PREFIX = "support-human-pending:";
const HUMAN_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const humanOutboxKey = (account: string) => HUMAN_OUTBOX_PREFIX + account;
const humanPendingKey = (account: string) => HUMAN_PENDING_PREFIX + account;

function humanOutboxStorage(durable = false) {
  try {
    if (typeof plus === "undefined") {
      const storage = durable ? localStorage : sessionStorage;
      return { getItem: (key: string) => storage.getItem(key), setItem: (key: string, value: string) => storage.setItem(key, value),
        removeItem: (key: string) => storage.removeItem(key), keys: () => Object.keys(storage) };
    }
    return { getItem: (key: string) => uni.getStorageSync(key) as string,
      setItem: (key: string, value: string) => uni.setStorageSync(key, value),
      removeItem: (key: string) => uni.removeStorageSync(key), keys: () => uni.getStorageInfoSync().keys };
  } catch { return null; }
}
function readHumanOutbox(account: string, durable = false): Record<string, HumanComposer> {
  if (!account.startsWith("user:")) return {};
  try {
    const raw = humanOutboxStorage(durable)?.getItem(durable ? humanPendingKey(account) : humanOutboxKey(account));
    if (!raw) return {};
    const rows: unknown = JSON.parse(raw);
    if (!rows || typeof rows !== "object" || Array.isArray(rows)) return {};
    const restored: Record<string, HumanComposer> = {};
    for (const [key, value] of Object.entries(rows)) {
      if (!/^(start:(advisor|support)|conversation:[A-Za-z0-9_-]{1,80})$/.test(key) || !value || typeof value !== "object") continue;
      const saved = value as { text?: unknown; failedSend?: HumanComposer["failedSend"]; userClearThrough?: number; recoveredId?: unknown; retainDraft?: unknown };
      const text = typeof saved.text === "string" ? saved.text.slice(0, MESSAGE_MAX_LENGTH) : "";
      const clearVersion = Number.isSafeInteger(saved.userClearThrough) && saved.userClearThrough! >= 0
        ? { userClearThrough: saved.userClearThrough } : {};
      const failed = saved.failedSend;
      const recoveredId = saved.recoveredId;
      if (typeof recoveredId === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(recoveredId) && key.startsWith("start:")) {
        restored[key] = { ...clearVersion, text, imageDraft: null, failedSend: null, recoveredId, retainDraft: true };
        continue;
      }
      if (saved.retainDraft === true && text && !failed) {
        restored[key] = { ...clearVersion, text, imageDraft: null, failedSend: null, retainDraft: true };
        continue;
      }
      const rejectedReply = key.startsWith("conversation:") && (failed?.peerChanged === true || failed?.replyRejected === true)
        && failed.settled === true && failed.kind === "failed" && failed.retryable === false;
      if (!failed || (failed.settled && !rejectedReply) || typeof failed.text !== "string" || !["unknown", "failed", "expired"].includes(failed.kind) || typeof failed.attempts !== "number"
        || (failed.attachmentId !== undefined && typeof failed.attachmentId !== "string")) continue;
      const { commandKey, expiresAt, ...rest } = failed;
      const commandType = key.startsWith("start:") ? "create" : "reply";
      const validKey = typeof commandKey === "string" && commandKey.length <= 128
        && /^support-conversation-(create|reply)-[a-z0-9-]+$/.test(commandKey)
        && commandKey.startsWith(`support-conversation-${commandType}-`);
      const deadline = typeof expiresAt === "number" && Number.isSafeInteger(expiresAt) && expiresAt > 0 ? expiresAt : undefined;
      if (durable && (!deadline || failed.settled)) continue;
      restored[key] = { ...clearVersion, text, imageDraft: null, failedSend: {
        ...rest, ...(validKey ? { commandKey } : {}), ...(deadline ? { expiresAt: deadline } : {}),
      } };
    }
    return restored;
  } catch { return {}; }
}

export const useConversations = defineStore("conversations", () => {
  const conversations = ref<Conversation[]>([]);
  const dismissedThrough = ref<Record<string, number>>({});
  const dismissingIds = ref<Record<string, boolean>>({});
  const dismissalAvailable = ref(false);
  const deletionAvailable = ref(false), deletingIds = ref<Record<string, boolean>>({});
  const clearedThrough = new Map<string, number>();
  const humanThreads = computed(() => groupConversationThreads(conversations.value)
    .filter(thread => thread.conversationIds.some(id => visibleInInbox(get(id)!))));
  function getThread(id: string): ConversationThread | undefined {
    return groupConversationThreads(conversations.value).find(thread => thread.conversationIds.includes(id));
  }
  async function openThread(id: string, active: () => boolean = () => true): Promise<ConversationThread | undefined> {
    const missing = !get(id);
    if (missing) await open(id, active);
    const members = getThread(id)?.conversationIds ?? [];
    for (const member of members) {
      if (!active()) return getThread(id);
      if (!missing || member !== id) await open(member, active);
    }
    return getThread(id);
  }
  async function loadEarlierThread(id: string, active: () => boolean = () => true): Promise<ConversationThread | undefined> {
    const members = getThread(id)?.conversationIds ?? [];
    const earlier = members.map(member => get(member)!).filter(row => row.historyNextCursor)
      .sort((a, b) => b.historyNextCursor! - a.historyNextCursor!)[0];
    if (earlier) await loadEarlier(earlier.id, active);
    return getThread(id);
  }
  async function deleteConversation(id: string): Promise<void> {
    if (!deletionAvailable.value) throw new Error('SUPPORT_HISTORY_DELETION_UNAVAILABLE');
    const thread = getThread(id);
    if (!thread || deletingIds.value[id]) return;
    const account = { accountKey: accountKeyValue, epoch: accountEpoch };
    const members = thread.conversationIds.map(member => get(member)!);
    for (const member of members) deletingIds.value[member.id] = true;
    try {
      const result = await command(`conversation-user-clear:${thread.peerKey}:${[...thread.conversationIds].sort().join(',')}`,
        key => supportApi.deleteConversation(thread.id, thread.peerKey, members, key), async key => {
          const receipt = await supportApi.commandResult(key);
          return receipt?.kind === 'conversation-user-clear' && receipt.clearance.peerKey === thread.peerKey
            && thread.conversationIds.every(id => receipt.clearance.conversationNos.includes(id))
            ? receipt.clearance : null;
        }, account);
      if (!accountScopeIsCurrent(account)) throw new Error('SUPPORT_ACCOUNT_SCOPE_CHANGED');
      applyUserClear(result);
    } catch (cause) {
      // Keep the records. Refresh the next confirmation's versions/members without retrying the write.
      if (accountScopeIsCurrent(account) && isConversationUserClearRejected(cause)) await refresh();
      throw cause;
    } finally {
      if (accountScopeIsCurrent(account)) for (const member of members) delete deletingIds.value[member.id];
    }
  }
  function userVisibleSnapshot(row: Conversation): Conversation | undefined {
    const boundary = Math.max(clearedThrough.get(conversationPeerKey(row)) ?? -1, clearedThrough.get(`conversation:${row.id}`) ?? -1);
    if (boundary < 0) return row;
    if (latestPublicMessageId(row) <= boundary) return undefined;
    const cursor = row.historyNextCursor != null && row.historyNextCursor > boundary ? row.historyNextCursor : null;
    return { ...row, userClearedThroughMessageId: boundary,
      messages: row.messages.filter(message => Number(message.id) > boundary),
      historyNextCursor: cursor, historyTruncated: cursor !== null && row.historyTruncated };
  }
  function applyUserClear(result: ConversationUserClear) {
    const previous = clearedThrough.get(result.peerKey) ?? -1;
    for (const id of result.conversationNos) clearedThrough.set(`conversation:${id}`,
      Math.max(clearedThrough.get(`conversation:${id}`) ?? -1, result.throughMessageId));
    if (previous >= result.throughMessageId) return;
    clearedThrough.set(result.peerKey, result.throughMessageId);
    const members = new Set([...result.conversationNos,
      ...conversations.value.filter(row => conversationPeerKey(row) === result.peerKey).map(row => row.id)]);
    for (const member of members) {
      openGeneration.delete(member);
      delete dismissedThrough.value[member]; delete typingIds.value[member]; delete onlineIds.value[member];
    }
    for (const [key, saved] of Object.entries(humanComposers.value)) {
      const id = key.startsWith('conversation:') ? key.slice(13) : saved.recoveredId;
      if (id && members.has(id) && (saved.userClearThrough ?? -1) < result.throughMessageId) clearComposer(key, result.throughMessageId);
    }
    conversations.value = conversations.value.flatMap(row => { const visible = userVisibleSnapshot(row); return visible ? [visible] : []; });
  }
  function latestPublicMessageId(conversation: Conversation): number {
    return conversation.messages.reduce((max, message) => message.sender === "system" ? max : Math.max(max, Number(message.id) || 0), conversation.lastPublicMessageId ?? 0);
  }
  function visibleInInbox(conversation: Conversation): boolean {
    const boundary = dismissedThrough.value[conversation.id];
    return !boundary || latestPublicMessageId(conversation) > boundary;
  }
  function mergeDismissals(markers: ConversationDismissal[] | null) {
    dismissalAvailable.value = markers !== null;
    if (markers === null) return;
    for (const marker of markers) dismissedThrough.value[marker.conversationNo] = Math.max(dismissedThrough.value[marker.conversationNo] ?? 0, marker.throughMessageId);
  }
  async function dismissConversation(id: string): Promise<void> {
    const conversation = get(id);
    if (!conversation || dismissingIds.value[id]) return;
    const throughMessageId = latestPublicMessageId(conversation);
    if (!throughMessageId) throw new Error("SUPPORT_DISMISSAL_BOUNDARY_INVALID");
    const scope = snapshotScope();
    dismissingIds.value[id] = true;
    try {
      const marker = await supportApi.dismissConversation(id, throughMessageId);
      if (!snapshotIsCurrent(scope)) throw new Error("SUPPORT_ACCOUNT_SCOPE_CHANGED");
      mergeDismissals([marker]);
    } finally {
      if (snapshotIsCurrent(scope)) delete dismissingIds.value[id];
    }
  }
  const loading = ref(false);
  const mutating = ref(false);
  const error = ref<string | null>(null);
  const typingIds = ref<Record<string, boolean>>({});
  const onlineIds = ref<Record<string, boolean>>({});
  const realtimeReady = ref(false);
  const realtimeFallback = ref(false);
  const scopeInvalidated = ref(0);
  const peerChangedReadbacks = ref<Record<string, Promise<void>>>({});
  const advisor = ref<CurrentAdvisor | null>(null);
  const advisorLoading = ref(false);
  const advisorError = ref(false);
  let advisorRequestGeneration = 0;
  const humanComposers = ref<Record<string, HumanComposer>>({});
  const clearedComposerThrough = ref<Record<string, number>>({});
  let humanWritesBlocked = false;
  let humanExpiryTimer: ReturnType<typeof setTimeout> | undefined;
  let nextHumanExpiry = Infinity;

  function scheduleHumanExpiry(deadline: number) {
    if (deadline >= nextHumanExpiry) return;
    clearTimeout(humanExpiryTimer);
    nextHumanExpiry = deadline;
    humanExpiryTimer = setTimeout(sweepHumanOutboxes, Math.max(0, deadline - Date.now()));
  }
  onScopeDispose(() => clearTimeout(humanExpiryTimer));

  function writeHumanOutbox(account: string, rows: Record<string, HumanComposer>, durable: boolean) {
    const storage = humanOutboxStorage(durable);
    const key = durable ? humanPendingKey(account) : humanOutboxKey(account);
    if (!Object.keys(rows).length) { storage?.removeItem(key); return; }
    const encoded = JSON.stringify(rows);
    storage?.setItem(key, encoded);
    if (storage?.getItem(key) !== encoded) throw new Error("SUPPORT_HUMAN_OUTBOX_PERSIST_FAILED");
  }

  function sweepHumanOutboxes() {
    clearTimeout(humanExpiryTimer);
    nextHumanExpiry = Infinity;
    const now = Date.now();
    try {
      for (const storageKey of humanOutboxStorage(true)?.keys() ?? []) {
        if (!storageKey.startsWith(HUMAN_PENDING_PREFIX + "user:")) continue;
        const account = storageKey.slice(HUMAN_PENDING_PREFIX.length);
        const rows = readHumanOutbox(account, true);
        const expired = new Map<string, string | undefined>();
        for (const [key, saved] of Object.entries(rows)) {
          const failed = saved.failedSend;
          const deadline = failed?.expiresAt;
          if (!failed || deadline === undefined) continue;
          if (deadline > now) { scheduleHumanExpiry(deadline); continue; }
          const slot = humanSendSlot(key, failed);
          expired.set(slot, failed.commandKey);
          delete rows[key];
        }
        if (!expired.size && Object.keys(rows).length) continue;
        retireSupportPending(account, "conversations", expired);
        writeHumanOutbox(account, rows, true);
      }
    } catch { /* Storage can be unavailable; subsequent account binding retries cleanup. */ }

    for (const [key, saved] of Object.entries(humanComposers.value)) {
      const failed = saved.failedSend;
      if (!failed || failed.settled || failed.expiresAt === undefined) continue;
      if (failed.expiresAt > now) { scheduleHumanExpiry(failed.expiresAt); continue; }
      const slot = humanSendSlot(key, failed), pendingKey = pendingKeys.get(slot);
      if (!failed.commandKey || pendingKey === failed.commandKey) pendingKeys.delete(slot);
      saveComposer(key, { ...saved, failedSend: null });
    }
  }
  function persistHumanOutbox(required = false) {
    if (!accountKeyValue.startsWith("user:")) return;
    const drafts: Record<string, HumanComposer> = {};
    const pending: Record<string, HumanComposer> = {};
    for (const [key, composer] of Object.entries(humanComposers.value)) {
      const { text, failedSend, recoveredId, retainDraft, userClearThrough } = composer;
      if (failedSend && !failedSend.settled && failedSend.expiresAt !== undefined) {
        scheduleHumanExpiry(failedSend.expiresAt);
        pending[key] = { text: "", imageDraft: null, failedSend, userClearThrough };
        if (text) drafts[key] = { text, imageDraft: null, failedSend: null, retainDraft: true, userClearThrough };
      } else if (failedSend?.peerChanged || failedSend?.replyRejected || (key.startsWith("start:") && recoveredId) || (retainDraft && text)) {
        drafts[key] = { text, imageDraft: null, failedSend, recoveredId, retainDraft, userClearThrough };
      }
    }
    try {
      writeHumanOutbox(accountKeyValue, pending, true);
      writeHumanOutbox(accountKeyValue, drafts, false);
    } catch {
      if (required) throw new Error("SUPPORT_HUMAN_OUTBOX_PERSIST_FAILED");
    }
  }
  function composer(key: string): HumanComposer {
    return humanComposers.value[key] ?? { text: "", imageDraft: null, failedSend: null };
  }
  function saveComposer(key: string, value: HumanComposer, required = false) {
    if (remoteApiEnabled && (humanWritesBlocked || !accountKeyValue.startsWith("user:"))) return;
    const previous = humanComposers.value[key];
    // Keep the next unsent draft after readback retires the preceding intent.
    const retainDraft = !!value.text && !!(value.retainDraft || previous?.retainDraft || (previous?.failedSend && !value.failedSend));
    const id = key.startsWith('conversation:') ? key.slice(13) : value.recoveredId;
    const row = id ? get(id) : undefined;
    const boundary = Math.max(value.userClearThrough ?? -1, id ? clearedThrough.get(`conversation:${id}`) ?? -1 : -1,
      row ? clearedThrough.get(conversationPeerKey(row)) ?? -1 : -1);
    const failed = value.failedSend;
    const failedSend = failed && !failed.settled && failed.expiresAt === undefined
      ? { ...failed, expiresAt: Date.now() + HUMAN_PENDING_TTL_MS } : failed;
    const next = { ...value, failedSend, retainDraft, ...(boundary >= 0 ? { userClearThrough: boundary } : {}) };
    humanComposers.value[key] = next;
    if (key.startsWith("start:") && value.recoveredId && value.text) {
      humanComposers.value[`conversation:${value.recoveredId}`] = { ...next, recoveredId: undefined, retainDraft: true };
    }
    persistHumanOutbox(required);
  }
  function clearComposer(key: string, throughMessageId?: number) {
    if (humanWritesBlocked) return;
    delete humanComposers.value[key];
    if (throughMessageId !== undefined) clearedComposerThrough.value[key] = throughMessageId;
    persistHumanOutbox();
  }
  function continueRejectedReply(sourceKey: string, targetKey: string) {
    const source = composer(sourceKey), failed = source.failedSend;
    if (!failed?.peerChanged && !failed?.replyRejected) return;
    const target = composer(targetKey);
    // Leave the destination's draft and any unresolved command intact.
    if (target.text || target.imageDraft || target.failedSend || target.recoveredId) return;
    const image = source.imageDraft;
    const attachment = image?.state === "ready" && image.attachmentId && image.attachmentId === failed.attachmentId ? image : null;
    if (!failed.text && !attachment) return;
    saveComposer(targetKey, { ...target, text: failed.text, imageDraft: attachment, retainDraft: true });
    saveComposer(sourceKey, { ...source, imageDraft: attachment ? null : image, failedSend: null });
  }
  function forgetHumanDrafts(account: string) {
    try { writeHumanOutbox(account, {}, false); }
    catch { /* The account epoch still clears private memory. */ }
  }
  function suspendForReauthentication() {
    // Stop old page watchers writing while the account is being unbound.
    humanWritesBlocked = true;
  }
  function discardHumanOutbox() {
    suspendForReauthentication();
    if (accountKeyValue.startsWith("user:")) {
      forgetHumanDrafts(accountKeyValue);
      try { writeHumanOutbox(accountKeyValue, {}, true); } catch { /* Authentication must still close. */ }
      clearSupportPending(accountKeyValue, "conversations");
    }
    reset();
  }
  function humanSendSlot(key: string, failed: NonNullable<HumanComposer["failedSend"]>): string {
    const intent = key.startsWith("start:")
      ? `conversation-create:${key.slice(6)}:${failed.attachmentId ?? "text"}:${failed.text.trim()}`
      : `conversation-reply:${key.slice(13)}:${failed.attachmentId ?? "text"}:${failed.text.trim()}`;
    return opaqueSupportIntentSlot(intent);
  }
  async function pendingHumanSendKey(key: string, failed: NonNullable<HumanComposer["failedSend"]>): Promise<string | undefined> {
    const scope = await commandScope();
    const pendingKey = scope.pending.get(humanSendSlot(key, failed));
    return !failed.commandKey || failed.commandKey === pendingKey ? pendingKey : undefined;
  }
  function matchesReplyRejection(result: SupportCommandResult | null, id: string, key: string): result is Extract<SupportCommandResult, { kind: 'reply-rejected' }> {
    return result?.kind === 'reply-rejected' && result.conversationNo === id
      && result.idempotencyKey === key && result.clientMessageId === key;
  }
  function applyPendingReplyRejection(scope: CommandScope, fingerprint: string, id: string, key: string): boolean {
    const composerKey = `conversation:${id}`, saved = humanComposers.value[composerKey], failed = saved?.failedSend;
    if (!saved || !failed || failed.settled || humanSendSlot(composerKey, failed) !== fingerprint
        || (failed.commandKey && failed.commandKey !== key)) return false;
    if (scope.pending.get(fingerprint) === key) completePending(scope, fingerprint);
    saveComposer(composerKey, { ...saved, failedSend: { ...failed, settled: true, retryable: false, kind: 'failed', replyRejected: true } });
    return true;
  }
  async function checkHumanReply(id: string, failed: NonNullable<HumanComposer["failedSend"]>, active: () => boolean): Promise<{ status: 'sent' | 'rejected'; key: string } | null> {
    const scope = await commandScope();
    const fingerprint = humanSendSlot(`conversation:${id}`, failed);
    const pendingKey = scope.pending.get(fingerprint);
    const key = failed.commandKey ?? pendingKey;
    if (!active() || !key || scope.inFlight.has(fingerprint)) return null;
    const result = await supportApi.commandResult(key);
    if (!active() || !scopeIsCurrent(scope) || scope.pending.get(fingerprint) !== pendingKey
        || scope.inFlight.has(fingerprint)) return null;
    if (matchesReplyRejection(result, id, key) && applyPendingReplyRejection(scope, fingerprint, id, key)) return { status: 'rejected', key };
    if (result?.kind !== "conversation" || result.conversation.id !== id) return null;
    applyPendingConversation(scope, fingerprint, key, result.conversation);
    return { status: 'sent', key };
  }
  let realtime: ConversationRealtime | null = null;
  let watchedId: string | null = null;
  let typingExpiry: ReturnType<typeof setTimeout> | undefined;
  function startRealtime() {
    if (realtime || !remoteApiEnabled || !accountKeyValue.startsWith("user:")) return;
    const session = sessionVault.read();
    if (!session?.accessToken || accountKeyValue !== `user:${session.user.userId}`) return;
    const epoch = accountEpoch; let instance!: ConversationRealtime;
    const current = () => realtime === instance && epoch === accountEpoch;
    instance = new ConversationRealtime({
      url: `${apiRuntimeConfig.baseUrl.replace(/^http/, "ws").replace(/\/$/, "")}/ws/conversations`,
      ticket: signal => apiClient.request({ method: "POST", path: "/api/app/support/realtime-ticket", signal }), socket: createUniRealtimeSocket,
      reconcile: async signal => { const active = () => current() && !signal.aborted; if (!active()) return; await refresh(active, true); if (active() && watchedId) { const id=watchedId; await open(id,()=>active()&&watchedId===id); } },
      state: (ready, _terminal, unavailable) => { if (current()) { realtimeReady.value = ready; realtimeFallback.value = unavailable; } },
      presence: value => { if (!current()) return; clearTimeout(typingExpiry); if (!value) { typingIds.value={}; onlineIds.value={}; return; } onlineIds.value[value.conversationNo]=value.online; typingIds.value[value.conversationNo]=value.typing; typingExpiry=setTimeout(()=>{if(current())typingIds.value[value.conversationNo]=false;},value.expiresIn??5000); },
      authRejected: () => { if (current()) maintainRemoteSession(true); },
      configInvalidated: () => { if (current()) useConfig().invalidate(); },
      scopeInvalidated: customerId => {
        if (!current() || accountKeyValue !== `user:${customerId}`) return;
        const watched = watchedId;
        // Assignment changes invalidate live presence, not the outcome of a sent command.
        // Keep the account's pending keys and payloads for authoritative readback.
        stopRealtime();
        scopeInvalidated.value += 1;
        startRealtime();
        if (watched) watchRealtime(watched);
        void Promise.allSettled([refreshAdvisor(), refreshCategories(), refresh().then(() => watched ? open(watched) : undefined)]);
      },
    });
    realtime=instance; setAppConversationRealtime(instance); instance.watch(watchedId); instance.start();
  }
  function stopRealtime() { const instance=realtime; realtime=null; setAppConversationRealtime(null); clearTimeout(typingExpiry); realtimeReady.value=false; realtimeFallback.value=false; typingIds.value={}; onlineIds.value={}; instance?.stop(); }
  const unsubscribeSession = sessionVault.subscribe?.((previous, next, continuation) => {
    if (!continuation) stopRealtime();
    else if (previous?.accessToken !== next?.accessToken) realtime?.renewCredentials();
  });
  onScopeDispose(() => { unsubscribeSession?.(); stopRealtime(); });
  function watchRealtime(id: string | null) { watchedId=id; realtime?.watch(id); if (!id) { typingIds.value={}; onlineIds.value={}; } }
  function setTyping(active: boolean) { realtime?.typing(active); }
  async function refreshAdvisor(): Promise<void> {
    if (!remoteApiEnabled) return;
    const scope = { accountKey: accountKeyValue, epoch: accountEpoch };
    const requestGeneration = ++advisorRequestGeneration;
    advisorLoading.value = true;
    advisorError.value = false;
    try {
      const result = await supportApi.advisor();
      if (accountScopeIsCurrent(scope) && requestGeneration === advisorRequestGeneration) advisor.value = result;
    } catch {
      if (accountScopeIsCurrent(scope) && requestGeneration === advisorRequestGeneration) { advisor.value = null; advisorError.value = true; }
    } finally {
      if (accountScopeIsCurrent(scope) && requestGeneration === advisorRequestGeneration) advisorLoading.value = false;
    }
  }

  const categoryAvailability = ref<ConversationCategoryAvailability>(remoteApiEnabled
    ? { advisor: false, support: false, ai: false }
    : { advisor: true, support: true, ai: true });
  // M5 controls new human conversation entry. Existing human conversations
  // remain readable and replyable.
  const categoryAvailabilityStatus = ref<CategoryAvailabilityStatus>(remoteApiEnabled ? "loading" : "ready");
  const categoryLoading = ref(remoteApiEnabled);
  // The retired "ai" category is never listed, so its rows never count as unread.
  const totalUnread = computed(() => humanThreads.value.reduce((sum, row) => sum + row.unread, 0));
  let pendingKeys = new Map<string, string>();
  let inFlight = new Map<string, Promise<unknown>>();
  const runningCommandKeys = new WeakMap<Promise<unknown>, string>();
  let accountEpoch = 0;
  let accountKeyValue = "anonymous";
  let pendingRunId = "unverified";
  const openGeneration = new Map<string, number>();
  let listRequestGeneration = 0;
  let listPending: { owner: string; active: Array<() => boolean>; dispatched: boolean; promise: Promise<void> } | null = null;
  let categoryRequestGeneration = 0;

  async function preparePendingRun(): Promise<void> {
    const accountKey = accountKeyValue;
    const epoch = accountEpoch;
    const runId = await supportApi.authorityRevision();
    if (epoch !== accountEpoch || accountKey !== accountKeyValue) return;
    if (runId === pendingRunId) return;
    const restored = restorePending(accountKey, runId);
    pendingRunId = runId;
    pendingKeys = restored;
    migrateLegacyHumanSends();
  }

  function scopeIsCurrent(scope: CommandScope): boolean {
    return scope.epoch === accountEpoch && scope.accountKey === accountKeyValue && scope.runId === pendingRunId && scope.pending === pendingKeys && scope.inFlight === inFlight;
  }

  function snapshotScope(): SnapshotScope { return { accountKey: accountKeyValue, epoch: accountEpoch, runId: pendingRunId }; }
  function snapshotIsCurrent(scope: SnapshotScope): boolean {
    return scope.epoch === accountEpoch && scope.accountKey === accountKeyValue && scope.runId === pendingRunId;
  }
  function accountScopeIsCurrent(scope: AccountScope): boolean {
    return scope.epoch === accountEpoch && scope.accountKey === accountKeyValue;
  }

  async function commandScope(): Promise<CommandScope> {
    const accountKey = accountKeyValue;
    const epoch = accountEpoch;
    const startingRunId = pendingRunId;
    const startingPending = pendingKeys;
    const startingInFlight = inFlight;
    const runId = await supportApi.authorityRevision();
    if (epoch !== accountEpoch || accountKey !== accountKeyValue || startingInFlight !== inFlight) throw new Error("SUPPORT_ACCOUNT_SCOPE_CHANGED");
    if (runId !== pendingRunId) {
      if (startingRunId !== pendingRunId || startingPending !== pendingKeys) throw new Error("SUPPORT_ACCOUNT_SCOPE_CHANGED");
      const restored = restorePending(accountKey, runId);
      pendingRunId = runId;
      pendingKeys = restored;
      migrateLegacyHumanSends();
    }
    return { accountKey, epoch, runId, pending: pendingKeys, inFlight };
  }

  function mustReadBack(cause: unknown): boolean {
    return !isSupportAttachmentNotReady(cause)
      && !isSupportReplyRequired(cause)
      && isConversationDeliveryAmbiguous(cause);
  }

  function migrateLegacyHumanSends() {
    let migrated = false;
    for (const [key, saved] of Object.entries(humanComposers.value)) {
      const failed = saved.failedSend;
      if (!failed || failed.settled || failed.expiresAt !== undefined) continue;
      const commandKey = pendingKeys.get(humanSendSlot(key, failed));
      const timestamp = Number(commandKey?.match(/^support-conversation-(?:create|reply)-(\d{13})-/)?.[1]);
      const now = Date.now();
      const expiresAt = (timestamp > 0 && timestamp <= now ? timestamp : now) + HUMAN_PENDING_TTL_MS;
      humanComposers.value[key] = { ...saved, failedSend: { ...failed, commandKey, expiresAt } };
      migrated = true;
    }
    if (migrated) {
      persistHumanOutbox();
      sweepHumanOutboxes();
    }
  }

  function completePending(scope: CommandScope, fingerprint: string): void {
    const key = scope.pending.get(fingerprint);
    const next = new Map(scope.pending);
    next.delete(fingerprint);
    persistPending(scope.accountKey, scope.runId, next);
    scope.pending.delete(fingerprint);
    if (key) {
      const storage = startTargetStorage(), targetKey = startTargetKey(scope, key);
      if (storage.getItem(targetKey)) storage.removeItem(targetKey);
    }
  }

  // A reused start sends a reply. Keep that decision with the original key across
  // reload so an unknown reply can never be retried as a new create (or vice versa).
  function startTargetStorage() {
    return typeof plus === 'undefined' ? localStorage : {
      getItem: (key: string) => uni.getStorageSync(key) as string,
      setItem: (key: string, value: string) => uni.setStorageSync(key, value),
      removeItem: (key: string) => uni.removeStorageSync(key),
    };
  }
  function startTargetKey(scope: SnapshotScope, key: string) { return `support-start-target:${scope.accountKey}:${scope.runId}:${key}`; }
  async function dispatchStart(type: 'support' | 'advisor', text: string, key: string, attachmentId: string | undefined,
      scope: CommandScope, recovering: boolean): Promise<Conversation> {
    const storage = startTargetStorage(), storageKey = startTargetKey(scope, key);
    const raw = storage.getItem(storageKey);
    let target: string | null;
    if (raw) {
      target = JSON.parse(raw);
      if (target !== null && (typeof target !== 'string' || !target.trim())) throw new Error('SUPPORT_START_TARGET_INVALID');
    } else {
      target = null;
      if (!recovering && supportApi.advisor) {
        const assignment = await supportApi.advisor();
        if (!scopeIsCurrent(scope)) throw new Error('SUPPORT_ACCOUNT_SCOPE_CHANGED');
        const peerId = assignment.currentAdvisorId === null ? null : String(assignment.currentAdvisorId);
        if (peerId) {
          const page = await supportApi.conversations();
          if (!scopeIsCurrent(scope)) throw new Error('SUPPORT_ACCOUNT_SCOPE_CHANGED');
          mergeConversations(page.items);
          target = page.items.filter(row => row.ownerAgentId === peerId && (row.status === 'open' || row.status === 'resolved'))
            .sort((a, b) => b.lastTs - a.lastTs)[0]?.id ?? null;
        }
      }
      storage.setItem(storageKey, JSON.stringify(target));
      if (storage.getItem(storageKey) !== JSON.stringify(target)) throw new Error('SUPPORT_PENDING_PERSIST_FAILED');
    }
    if (!scopeIsCurrent(scope)) throw new Error('SUPPORT_ACCOUNT_SCOPE_CHANGED');
    if (!target) return supportApi.startConversation(type, text, key, attachmentId);
    const current = await supportApi.conversation(target);
    if (!scopeIsCurrent(scope)) throw new Error('SUPPORT_ACCOUNT_SCOPE_CHANGED');
    return supportApi.replyConversation(current, text, key, attachmentId);
  }

  async function command<T>(intent: string, action: (key: string) => Promise<T>, recover?: (key: string) => Promise<T | null>, expectedAccount?: AccountScope, policy?: { gate?: () => boolean; recovery?: { scope: CommandScope; key: string }; replyKey?: string }, onKey?: (key: string) => void): Promise<T> {
    const scope = await commandScope();
    if (expectedAccount && (expectedAccount.epoch !== scope.epoch || expectedAccount.accountKey !== scope.accountKey)) {
      throw new Error("SUPPORT_ACCOUNT_SCOPE_CHANGED");
    }
    const fingerprint = opaqueSupportIntentSlot(intent);
    if (!scopeIsCurrent(scope)) throw new Error("SUPPORT_ACCOUNT_SCOPE_CHANGED");
    // Recovery authorization is tied to the final send scope and original key.
    // A new run, retired slot or changed key must never fall through to minting.
    const recovery = policy?.recovery;
    const originalKey = recovery?.key ?? policy?.replyKey;
    if ((recovery && !scopeIsCurrent(recovery.scope)) || (originalKey && scope.pending.get(fingerprint) !== originalKey)) {
      throw new Error("SUPPORT_PENDING_RECOVERY_SCOPE_CHANGED");
    }
    if (!originalKey && policy?.gate && !policy.gate()) {
      throw new Error("SUPPORT_CATEGORY_UNAVAILABLE");
    }
    const running = scope.inFlight.get(fingerprint) as Promise<T> | undefined;
    if (running) {
      const originalKey = runningCommandKeys.get(running);
      if (originalKey) onKey?.(originalKey);
      return running;
    }
    const key = originalKey ?? scope.pending.get(fingerprint) ?? mutationKey(intent);
    const humanSend = intent.startsWith('conversation-create:') || intent.startsWith('conversation-reply:');
    const userClear = intent.startsWith('conversation-user-clear:');
    const echoedOutcome = () => humanSend && scopeIsCurrent(scope)
      ? conversations.value.find(row => (intent.startsWith('conversation-reply:') ? row.id === intent.split(':')[1] : row.type === intent.split(':')[1])
        && row.messages.some(message => message.sender === 'user' && message.clientMessageId === key)) : undefined;
    scope.pending.set(fingerprint, key);
    persistPending(scope.accountKey, scope.runId, scope.pending);
    if (!scopeIsCurrent(scope)) throw new Error("SUPPORT_ACCOUNT_SCOPE_CHANGED");
    onKey?.(key);
    // Every caller shares the authoritative outcome, including recovery. Start
    // after installing the promise so even a synchronous failure is single-flight.
    const promise = Promise.resolve().then(async () => {
      try {
        if (!scopeIsCurrent(scope)) throw new Error("SUPPORT_ACCOUNT_SCOPE_CHANGED");
        if (originalKey && scope.pending.get(fingerprint) !== originalKey)
          throw new Error("SUPPORT_PENDING_RECOVERY_SCOPE_CHANGED");
        if (!originalKey && policy?.gate && !policy.gate())
          throw new Error("SUPPORT_CATEGORY_UNAVAILABLE");
        const operation = action(key);
        const result = await (humanSend ? awaitMessageOutcome(operation, MESSAGE_ACK_TIMEOUT_MS) : operation);
        if (!scopeIsCurrent(scope)) throw new Error("SUPPORT_ACCOUNT_SCOPE_CHANGED");
        completePending(scope, fingerprint);
        return result;
      } catch (cause) {
        const echoed = echoedOutcome();
        if (echoed) { completePending(scope, fingerprint); return echoed as T; }
        if (recover && mustReadBack(cause) && !(userClear && isConversationUserClearRejected(cause)) && scopeIsCurrent(scope)) {
          let adopted: T | null = null;
          try {
            const recovery = recover(key);
            adopted = await (humanSend ? awaitMessageOutcome(recovery, MESSAGE_READBACK_TIMEOUT_MS) : recovery);
          } catch (readbackError) {
            if (readbackError instanceof SupportReplyRejected && scopeIsCurrent(scope) && scope.pending.get(fingerprint) === key) {
              completePending(scope, fingerprint);
              throw readbackError;
            }
            // The readback endpoint exposes these reasons only for a retained terminal clear refusal.
            if (userClear && isConversationUserClearRejected(readbackError) && scopeIsCurrent(scope)
                && scope.pending.get(fingerprint) === key) completePending(scope, fingerprint);
            if (!humanSend) throw readbackError;
            // A failed read cannot turn an uncertain write into a refusal.
            // Preserve the original cause unless a canonical echo confirms it.
          }
          if (!scopeIsCurrent(scope)) throw new Error("SUPPORT_ACCOUNT_SCOPE_CHANGED");
          if (adopted === null) {
            const confirmed = echoedOutcome();
            if (confirmed) adopted = confirmed as T;
          }
          if (adopted !== null) {
            completePending(scope, fingerprint);
            return adopted;
          }
        }
        if ((!mustReadBack(cause) || (userClear && isConversationUserClearRejected(cause)))
            && scopeIsCurrent(scope) && scope.pending.get(fingerprint) === key) completePending(scope, fingerprint);
        throw cause;
      } finally {
        scope.inFlight.delete(fingerprint);
        if (scopeIsCurrent(scope)) mutating.value = scope.inFlight.size > 0;
      }
    });
    runningCommandKeys.set(promise, key);
    scope.inFlight.set(fingerprint, promise);
    if (scopeIsCurrent(scope)) mutating.value = true;
    return promise;
  }

  function replace(conversation: Conversation) {
    if (conversation.userClearedThroughMessageId !== undefined) applyUserClear({ scope: 'USER_VIEW', userScopeCleared: true,
      peerKey: conversationPeerKey(conversation), throughMessageId: conversation.userClearedThroughMessageId, conversationNos: [conversation.id] });
    const visible = userVisibleSnapshot(conversation);
    if (!visible) return;
    conversation = visible;
    const prior = conversations.value.find((row) => row.id === conversation.id);
    if (prior && (conversation.version < prior.version || (conversation.version === prior.version && conversation.lastTs < prior.lastTs))) return;
    const rest = conversations.value.filter((row) => row.id !== conversation.id);
    conversations.value = [mergeConversationMessages(prior,conversation), ...rest].sort((a, b) => b.lastTs - a.lastTs);
    // A canonical echo is as conclusive as a command readback. Never correlate by body text.
    const echoed = new Set(conversation.messages.filter(m => m.sender === 'user').map(m => m.clientMessageId).filter(Boolean));
    if (!echoed.size) return;
    const scope: CommandScope = { accountKey: accountKeyValue, epoch: accountEpoch, runId: pendingRunId, pending: pendingKeys, inFlight };
    for (const [composerKey, saved] of Object.entries(humanComposers.value)) {
      const failed = saved.failedSend;
      if (!failed || failed.settled) continue;
      if (composerKey.startsWith('start:') && composerKey.slice(6) !== conversation.type) continue;
      if (!composerKey.startsWith('start:') && composerKey !== `conversation:${conversation.id}`) continue;
      const intent = composerKey.startsWith('start:')
        ? `conversation-create:${composerKey.slice(6)}:${failed.attachmentId ?? 'text'}:${failed.text.trim()}`
        : `conversation-reply:${conversation.id}:${failed.attachmentId ?? 'text'}:${failed.text.trim()}`;
      const fingerprint = opaqueSupportIntentSlot(intent), pendingKey = scope.pending.get(fingerprint);
      const key = failed.commandKey ?? pendingKey;
      if (!key || !echoed.has(key)) continue;
      if (pendingKey === key) completePending(scope, fingerprint);
      saveComposer(composerKey, { ...saved, failedSend: null, recoveredId: composerKey.startsWith('start:') ? conversation.id : undefined });
    }
  }

  /** A delayed page may add an absent row, but cannot erase or regress a newer live snapshot. */
  function mergeConversations(items: Conversation[]) { for (const conversation of items) replace(conversation); }

  function refresh(active:()=>boolean=()=>true, fresh = false): Promise<void> {
    const owner = JSON.stringify([accountKeyValue, accountEpoch, scopeInvalidated.value, passiveTabReadScope(), captureRuntimeRevision().epoch]);
    const previous = listPending?.owner === owner ? listPending : null;
    if (previous && (!fresh || !previous.dispatched)) {
      previous.active.push(active);
      return previous.promise;
    }
    const readers = [active];
    const current = () => owner === JSON.stringify([accountKeyValue, accountEpoch, scopeInvalidated.value, passiveTabReadScope(), captureRuntimeRevision().epoch])
      && readers.some(isActive => isActive());
    const epoch = accountEpoch;
    const promise = Promise.resolve().then(async () => {
      // An event cannot be reconciled by a GET issued before that event.
      // Queued readers share the next read even if the preceding read failed.
      if (previous) await Promise.allSettled([previous.promise]);
      if (!current()) return;
      const requestGeneration = ++listRequestGeneration;
      loading.value = true;
      error.value = null;
      try {
        await preparePendingRun();
        const scope = snapshotScope();
        if (scope.epoch !== epoch || requestGeneration !== listRequestGeneration || !current()) return;
        await reconcilePending();
        if (!snapshotIsCurrent(scope) || requestGeneration !== listRequestGeneration || !current()) return;
        deletionAvailable.value = false;
        pending.dispatched = true;
        const [page, dismissals, capability] = await Promise.all([supportApi.conversations(), supportApi.conversationDismissals(), supportApi.conversationManagement?.()]);
        if (snapshotIsCurrent(scope) && requestGeneration === listRequestGeneration && current()) {
          for (const marker of capability?.clearedPeers ?? []) applyUserClear(marker);
          mergeConversations(page.items); mergeDismissals(dismissals);
          deletionAvailable.value = capability?.clearUserHistory === true;
        }
      } catch (cause) {
        if (epoch === accountEpoch && requestGeneration === listRequestGeneration && current()) {
          error.value = cause instanceof Error ? cause.message : "SUPPORT_CONVERSATIONS_LOAD_FAILED";
        }
        throw cause;
      } finally {
        if (epoch === accountEpoch && requestGeneration === listRequestGeneration) loading.value = false;
      }
    }).finally(() => { if (listPending?.promise === promise) listPending = null; });
    const pending = { owner, active: readers, dispatched: false, promise };
    listPending = pending;
    return promise;
  }

  async function refreshCategories(active: () => boolean = () => true): Promise<CategoryRefreshOutcome> {
    if (!remoteApiEnabled) return "applied";
    const account = { epoch: accountEpoch, accountKey: accountKeyValue };
    const requestGeneration = ++categoryRequestGeneration;
    categoryLoading.value = true;
    try {
      const next = await supportApi.conversationCategories();
      if (!accountScopeIsCurrent(account) || requestGeneration !== categoryRequestGeneration || !active()) return "stale";
      categoryAvailability.value = next;
      categoryAvailabilityStatus.value = "ready";
      return "applied";
    } catch {
      if (!accountScopeIsCurrent(account) || requestGeneration !== categoryRequestGeneration || !active()) return "stale";
      categoryAvailabilityStatus.value = "failed";
      return "failed";
    } finally {
      if (accountScopeIsCurrent(account) && requestGeneration === categoryRequestGeneration) categoryLoading.value = false;
    }
  }

  function categoryEnabled(type: ConversationType): boolean {
    return categoryAvailabilityStatus.value === "ready" && categoryAvailability.value[type === "support" ? "advisor" : type] === true;
  }

  /** Older pages prepend immutable messages; their write state describes the current assignment. */
  function prependHistory(current: Conversation, older: Conversation): Conversation {
    const messages = [...older.messages, ...current.messages]
      .sort((left, right) => left.ts - right.ts || Number(left.id) - Number(right.id))
      .filter((message, index, all) => index === 0 || all[index - 1].id !== message.id);
    const clearedThrough = Math.max(current.userClearedThroughMessageId ?? -1, older.userClearedThroughMessageId ?? -1);
    return { ...current, writeState: older.writeState ?? current.writeState, messages, historyTruncated: older.historyTruncated,
      historyNextCursor: older.historyNextCursor ?? null,
      ...(clearedThrough >= 0 ? { userClearedThroughMessageId: clearedThrough } : {}) };
  }

  function byType(type: ConversationType): Conversation[] {
    return conversations.value.filter((row) => row.type === type && visibleInInbox(row)).sort((a, b) => b.lastTs - a.lastTs);
  }
  function categoryReadable(type: ConversationType): boolean {
    return categoryEnabled(type) || (type !== "ai" && conversations.value.some(row => row.type === type));
  }
  function get(id: string): Conversation | undefined { return conversations.value.find((row) => row.id === id); }

  async function open(id: string, active: () => boolean = () => true, onDetailApplied?: () => void): Promise<Conversation> {
    const epoch = accountEpoch;
    const accountKey = accountKeyValue;
    const requestGeneration = (openGeneration.get(id) ?? 0) + 1;
    openGeneration.set(id, requestGeneration);
    error.value = null;
    await preparePendingRun();
    if (epoch !== accountEpoch || accountKey !== accountKeyValue || openGeneration.get(id) !== requestGeneration || !active()) {
      throw new Error("SUPPORT_ACCOUNT_SCOPE_CHANGED");
    }
    const runId = pendingRunId;
    let conversation = await supportApi.conversation(id);
    if (epoch !== accountEpoch || accountKey !== accountKeyValue || runId !== pendingRunId || openGeneration.get(id) !== requestGeneration || !active()) {
      throw new Error("SUPPORT_ACCOUNT_SCOPE_CHANGED");
    }
    const current=()=>epoch===accountEpoch&&accountKey===accountKeyValue&&runId===pendingRunId&&openGeneration.get(id)===requestGeneration&&active();
    conversation=await catchUpConversation(conversation,get(id),(no,before)=>supportApi.conversation(no,before),current);
    if(!current())throw new Error("SUPPORT_ACCOUNT_SCOPE_CHANGED");
    const lastAgent = [...conversation.messages].reverse().find(message => message.sender === "agent");
    if (conversation.unread > 0 && lastAgent) {
      try {
        const acknowledged=await supportApi.markConversationRead(conversation, Number(lastAgent.id));
        if(!current())return conversation;
        conversation = mergeConversationMessages(conversation,acknowledged);
      } catch (cause) {
        if(!current())return conversation;
        if (mustReadBack(cause)) {
          try { conversation = mergeConversationMessages(conversation,await supportApi.conversation(id)); } catch { /* retain the prior server snapshot */ }
        }
        if(!current())return conversation;
        error.value = cause instanceof Error ? cause.message : "SUPPORT_CONVERSATION_READ_FAILED";
      }
    }
    if (current()) {
      replace(conversation);
      onDetailApplied?.();
    }
    return conversation;
  }

  async function loadEarlier(id: string, active: () => boolean = () => true): Promise<Conversation | undefined> {
    const current = get(id);
    const beforeMessageId = current?.historyNextCursor;
    if (!current || !beforeMessageId) return current;
    const epoch = accountEpoch;
    const accountKey = accountKeyValue;
    const runId = pendingRunId;
    const requestGeneration = (openGeneration.get(id) ?? 0) + 1;
    openGeneration.set(id, requestGeneration);
    const older = await supportApi.conversation(id, beforeMessageId);
    if (epoch !== accountEpoch || accountKey !== accountKeyValue || runId !== pendingRunId
        || openGeneration.get(id) !== requestGeneration || !active()) return get(id);
    const latest = get(id);
    if (!latest) return older;
    const merged = prependHistory(latest, older);
    replace(merged);
    return get(id);
  }

  async function reconcile(id: string, account: AccountScope): Promise<void> {
    if (!accountScopeIsCurrent(account)) return;
    try {
      const runId = pendingRunId;
      const requestGeneration = (openGeneration.get(id) ?? 0) + 1;
      openGeneration.set(id, requestGeneration);
      const conversation = await supportApi.conversation(id);
      if (accountScopeIsCurrent(account) && runId === pendingRunId && openGeneration.get(id) === requestGeneration) replace(conversation);
    } catch {
      // The original failure remains authoritative; reconciliation is best effort.
    }
  }

  async function reconcileAll(account: AccountScope): Promise<void> {
    if (!accountScopeIsCurrent(account)) return;
    let requestGeneration: number | undefined;
    try {
      await preparePendingRun();
      if (!accountScopeIsCurrent(account)) return;
      const scope = snapshotScope();
      requestGeneration = ++listRequestGeneration;
      loading.value = true;
      error.value = null;
      const [page, dismissals] = await Promise.all([supportApi.conversations(), supportApi.conversationDismissals()]);
      if (snapshotIsCurrent(scope) && requestGeneration === listRequestGeneration) {
        mergeConversations(page.items); mergeDismissals(dismissals);
      }
    } catch (cause) {
      if (accountScopeIsCurrent(account) && requestGeneration === listRequestGeneration) {
        error.value = cause instanceof Error ? cause.message : "SUPPORT_CONVERSATIONS_LOAD_FAILED";
      }
      // The original command failure remains authoritative for its caller.
    } finally {
      if (accountScopeIsCurrent(account) && requestGeneration === listRequestGeneration) loading.value = false;
    }
  }

  function applyPendingConversation(scope: CommandScope, fingerprint: string, key: string, conversation: Conversation): void {
    replace(conversation);
    if (scope.pending.get(fingerprint) === key) completePending(scope, fingerprint);
    for (const [composerKey, saved] of Object.entries(humanComposers.value)) {
      const failed = saved.failedSend;
      if (!failed || failed.settled || humanSendSlot(composerKey, failed) !== fingerprint
          || (failed.commandKey && failed.commandKey !== key)) continue;
      saveComposer(composerKey, { ...saved, failedSend: null, recoveredId: composerKey.startsWith("start:") ? conversation.id : undefined });
    }
  }

  async function reconcilePending(): Promise<void> {
    const scope: CommandScope = { accountKey: accountKeyValue, epoch: accountEpoch, runId: pendingRunId, pending: pendingKeys, inFlight };
    for (const [fingerprint, key] of [...scope.pending]) {
      if (!scopeIsCurrent(scope)) return;
      if (scope.inFlight.has(fingerprint) || scope.pending.get(fingerprint) !== key) continue;
      try {
        const result = await supportApi.commandResult(key);
        if (!scopeIsCurrent(scope)) return;
        if (scope.inFlight.has(fingerprint) || scope.pending.get(fingerprint) !== key) continue;
        if (!result) continue;
        if (result.kind === 'conversation-user-clear') {
          applyUserClear(result.clearance); completePending(scope, fingerprint); continue;
        }
        if (result.kind === "conversation") applyPendingConversation(scope, fingerprint, key, result.conversation);
        if (result.kind === 'reply-rejected' && matchesReplyRejection(result, result.conversationNo, key))
          applyPendingReplyRejection(scope, fingerprint, result.conversationNo, key);
      } catch (cause) {
        // A recorded refusal is terminal; other read failures still leave the original command unknown.
        if (isConversationUserClearRejected(cause) && scopeIsCurrent(scope)
            && !scope.inFlight.has(fingerprint) && scope.pending.get(fingerprint) === key) completePending(scope, fingerprint);
      }
    }
  }

  async function hasPendingHumanCreate(type: Exclude<ConversationType, "ai">, openingText: string, attachmentId?: string): Promise<boolean> {
    const account = { epoch: accountEpoch, accountKey: accountKeyValue };
    await preparePendingRun();
    if (!accountScopeIsCurrent(account)) throw new Error("SUPPORT_ACCOUNT_SCOPE_CHANGED");
    return pendingKeys.has(opaqueSupportIntentSlot(`conversation-create:${type}:${attachmentId ?? "text"}:${openingText.trim()}`));
  }
  async function startConversation(type: Exclude<ConversationType, "ai">, openingText: string, attachmentId?: string, onDispatch?: (key: string) => void, expectedKey?: string): Promise<string> {
    const account = { epoch: accountEpoch, accountKey: accountKeyValue };
    const intent = `conversation-create:${type}:${attachmentId ?? "text"}:${openingText.trim()}`;
    const originalScope = remoteApiEnabled ? await commandScope() : undefined;
    if (!accountScopeIsCurrent(account)) throw new Error("SUPPORT_ACCOUNT_SCOPE_CHANGED");
    const originalKey = originalScope?.pending.get(opaqueSupportIntentSlot(intent));
    if (expectedKey && expectedKey !== originalKey) throw new Error("SUPPORT_PENDING_RECOVERY_SCOPE_CHANGED");
    const createPolicy = { gate: () => !remoteApiEnabled || categoryEnabled(type),
      recovery: originalScope && originalKey ? { scope: originalScope, key: originalKey } : undefined };
    if (!createPolicy.recovery && !createPolicy.gate()) throw new Error("SUPPORT_CATEGORY_UNAVAILABLE");
    let conversation: Conversation;
    try {
      conversation = await command(intent,
        key => originalScope ? dispatchStart(type, openingText, key, attachmentId, originalScope, !!originalKey)
          : supportApi.startConversation(type, openingText, key, attachmentId), async key => {
          const result = await supportApi.commandResult(key);
          return result?.kind === "conversation" ? result.conversation : null;
        }, account, createPolicy, onDispatch);
    } catch (cause) {
      if (accountScopeIsCurrent(account) && mustReadBack(cause)) void reconcileAll(account);
      throw cause;
    }
    if (accountScopeIsCurrent(account)) replace(conversation);
    return conversation.id;
  }

  async function startSupportSession(openingText: string): Promise<string> {
    return startConversation("support", openingText);
  }

  async function sendUser(id: string, text: string, attachmentId?: string, onDispatch?: (key: string) => void, originalKey?: string): Promise<boolean> {
    const account = { epoch: accountEpoch, accountKey: accountKeyValue };
    const current = get(id) ?? await open(id);
    if (!accountScopeIsCurrent(account)) throw new Error("SUPPORT_ACCOUNT_SCOPE_CHANGED");
    const epoch = accountEpoch;
    let conversation: Conversation;
    try {
      conversation = await command(`conversation-reply:${id}:${attachmentId ?? "text"}:${text.trim()}`,
        key => supportApi.replyConversation(current, text, key, attachmentId), async key => {
          const result = await supportApi.commandResult(key);
          if (matchesReplyRejection(result, id, key)) throw new SupportReplyRejected(result.businessCode, result.businessReason);
          return result?.kind === "conversation" ? result.conversation : null;
        }, account, { replyKey: originalKey }, onDispatch);
    } catch (cause) {
      if (accountScopeIsCurrent(account) && isConversationPeerChanged(cause)) {
        peerChangedReadbacks.value[id] = reconcile(id, account);
        void refreshAdvisor();
      }
      if (accountScopeIsCurrent(account) && mustReadBack(cause)) void reconcile(id, account);
      throw cause;
    }
    if (epoch === accountEpoch) replace(conversation);
    return true;
  }

  function reset() {
    stopRealtime();watchedId=null;
    advisorRequestGeneration += 1;
    accountEpoch += 1; conversations.value = []; error.value = null; loading.value = false; typingIds.value = {};
    advisor.value = null; advisorLoading.value = false; advisorError.value = false;
    peerChangedReadbacks.value = {};
    humanComposers.value = {};
    clearedComposerThrough.value = {};
    dismissedThrough.value = {}; dismissingIds.value = {};
    clearedThrough.clear(); deletionAvailable.value = false; deletingIds.value = {};
    dismissalAvailable.value = false;
    openGeneration.clear(); listRequestGeneration += 1; categoryRequestGeneration += 1;
    inFlight = new Map(); mutating.value = false;
    pendingKeys = new Map();
    categoryAvailability.value = remoteApiEnabled
      ? { advisor: false, support: false, ai: false }
      : { advisor: true, support: true, ai: true };
    categoryAvailabilityStatus.value = remoteApiEnabled ? "loading" : "ready";
    categoryLoading.value = remoteApiEnabled;
  }

  function bindAccount(accountKey: string) {
    if (accountKeyValue !== accountKey && accountKeyValue.startsWith("user:")) forgetHumanDrafts(accountKeyValue);
    reset();
    accountKeyValue = accountKey;
    humanWritesBlocked = false;
    if (remoteApiEnabled) {
      sweepHumanOutboxes();
      const drafts = readHumanOutbox(accountKey);
      const retained = readHumanOutbox(accountKey, true);
      for (const [key, saved] of Object.entries(retained)) {
        retained[key] = { ...saved, text: drafts[key]?.text ?? "" };
      }
      humanComposers.value = { ...drafts, ...retained };
    }
    pendingRunId = remoteApiEnabled ? "unverified" : "mock";
    // 启动预热是 fire-and-forget:权威不可达自吞(resilience 门)。pendingRunId 留
    // "unverified",首次 refresh() 重走 preparePendingRun 并把失败落 error 态;
    // preparePendingRun 本身保持 reject 契约(refresh/reconcile 的 await 消费方靠它报错)。
    const account = { accountKey, epoch: accountEpoch };
    if (remoteApiEnabled) void preparePendingRun().then(() => {
      if (accountScopeIsCurrent(account)) return reconcilePending();
    }).catch(() => undefined);
  }

  return { conversations, humanThreads, getThread, openThread, loadEarlierThread, deleteConversation, deletionAvailable, deletingIds, dismissConversation, dismissingIds, dismissalAvailable, typingIds, onlineIds,realtimeReady,realtimeFallback,scopeInvalidated,peerChangedReadbacks,advisor,advisorLoading,advisorError,humanComposers,clearedComposerThrough,composer,saveComposer,clearComposer,continueRejectedReply,suspendForReauthentication,discardHumanOutbox,pendingHumanSendKey,checkHumanReply,hasPendingHumanCreate,refreshAdvisor,startRealtime,stopRealtime,watchRealtime,setTyping, categoryAvailability, categoryAvailabilityStatus, categoryLoading, totalUnread, loading, mutating, error, refresh, refreshCategories, categoryEnabled, categoryReadable, byType, get, open, loadEarlier, startConversation, startSupportSession, sendUser, reset, bindAccount };
});
