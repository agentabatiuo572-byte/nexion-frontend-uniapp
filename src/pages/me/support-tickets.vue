<!--
  Support tickets (ported from Nexion-prototype/app/(main)/me/support/tickets/page.tsx).
  Three local view modes: list (stat tiles + tabs + transparent hairline ticket
  rows), create (category/subject/description form), detail (message thread +
  reply). Tickets are backed by a Pinia store so create/reply/close persist
  across refresh. Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="padding-bottom: 32px">
      <SubPageHeader back="/pages/me/support" />
      <view v-if="mode.kind !== 'list'" class="px-4" style="padding-bottom: 8px">
        <view class="flex items-center active:opacity-50" :style="backRowStyle" role="button" tabindex="0" :aria-label="t.tickets.backToTickets" @click="setMode({ kind: 'list' })">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          <text style="margin-left: 4px">{{ t.tickets.backToTickets }}</text>
        </view>
      </view>

      <!-- LIST MODE -->
      <view v-if="mode.kind === 'list'" class="px-4" style="display: flex; flex-direction: column; gap: 12px">
        <view class="grid grid-cols-3" style="gap: 8px">
          <StatBox tint="var(--v5-warning)" :label="t.tickets.statsOpen" :value="stats.open" :icon="alertIcon" @select="selectTab('open')" />
          <StatBox tint="var(--v5-brand-2)" :label="t.tickets.statsAwaiting" :value="stats.awaiting" :icon="clockIcon" @select="selectTab('open')" />
          <StatBox tint="var(--v5-brand)" :label="t.tickets.statsResolved" :value="stats.resolved" :icon="checkIcon" @select="selectTab('resolved')" />
        </view>

        <view class="w-full flex items-center justify-center active:scale-[0.98]" :style="newBtnStyle" role="button" tabindex="0" :aria-label="t.tickets.newTicketCta" @click="setMode({ kind: 'create' })">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
          <text style="margin-left: 8px">{{ t.tickets.newTicketCta }}</text>
        </view>

        <text class="block" :style="slaNoticeStyle">{{ t.tickets.slaStatisticsUnavailable }}</text>

        <view class="grid grid-cols-4" :style="tabsStyle" role="tablist" :aria-label="t.tickets.pageTitle">
          <view v-for="(id, i) in tabs" :key="id" class="nx-ticket-status-tab active:opacity-70 transition-opacity" :style="tabStyle(tab === id)" role="tab" :tabindex="tab === id ? 0 : -1" :aria-selected="tab === id ? 'true' : 'false'" :aria-label="tabLabel(id)" @click="selectTab(id)" @keydown.enter.prevent="selectTab(id)" @keydown.space.prevent="selectTab(id)" @keydown.left.prevent="moveTab(i, -1)" @keydown.right.prevent="moveTab(i, 1)">
            <text>{{ tabLabel(id) }}</text>
          </view>
        </view>
        <text v-if="filterFeedback" class="block text-center" :style="filterFeedbackStyle">{{ filterFeedback }}</text>

        <EmptyState v-if="ticketsStore.error" kind="recoverable-error" :title="t.empty.errorTitle" :desc="t.empty.errorDesc" :cta-label="t.empty.errorCta" @cta="reloadTickets" />
        <EmptyState v-else-if="filtered.length === 0" :kind="tab === 'all' ? 'empty-list' : 'no-filter-results'" :title="tab === 'all' ? t.empty.listTitle : t.empty.filterTitle" :desc="tab === 'all' ? t.empty.listDesc : t.empty.filterDesc" />
        <view v-else style="padding: 0 2px; border-top: 1px solid var(--v5-border)">
          <TicketRow v-for="(tk, i) in filtered" :key="tk.id" :tk="tk" :divider="i < filtered.length - 1" @open="openTicket(tk.id)" />
        </view>

        <!-- Remote mode exposes App-internal channels only (live chat / tickets),
             so the footer must not point at an off-App Telegram channel the user
             cannot find or verify from the product. #90 -->
        <text class="block text-center" :style="noteStyle">{{ remoteApiEnabled ? t.tickets.noteInternal : t.tickets.note }}</text>
      </view>

      <!-- CREATE MODE -->
      <view v-else-if="mode.kind === 'create'" class="px-4" style="display: flex; flex-direction: column; gap: 16px">
        <view>
          <text class="block" :style="formLabelStyle">{{ t.tickets.create.catLabel }}</text>
          <!-- 分类是互斥单选(选一个,其余取消)。原先每个 chip 都是 role="button":
               读屏念「按钮」、没有组名,也读不出当前选中哪一个(默认「提现」无任何状态)。
               改 radiogroup/radio + aria-checked,roving tabindex + 方向键(与提现网络选择器同形)。 -->
          <view class="flex" style="flex-wrap: wrap; gap: 6px" role="radiogroup" :aria-label="t.tickets.create.catLabel">
            <view v-for="c in categoriesForNew" :key="c" class="nx-ticket-cat-radio" :style="catChipStyle(newCat === c)" role="radio" :tabindex="newCat === c ? 0 : -1" :aria-checked="newCat === c ? 'true' : 'false'" :aria-label="catLabel(c)" @click="selectCategory(c)" @keydown.left.prevent="moveCategory(-1)" @keydown.right.prevent="moveCategory(1)" @keydown.up.prevent="moveCategory(-1)" @keydown.down.prevent="moveCategory(1)">
              <text>{{ catLabel(c) }}</text>
            </view>
          </view>
          <view v-if="newSlaTarget" :style="slaTargetStyle">
            <text class="block" :style="slaTargetLabelStyle">{{ t.tickets.slaTargetLabel }}</text>
            <text class="block" :style="slaTargetValueStyle">{{ fmt(t.tickets.slaTargetValue, { firstResponseMins: newSlaTarget.firstResponseMins, resolutionHours: newSlaTarget.resolutionHours }) }}</text>
            <text class="block" :style="slaStatisticsStyle">{{ t.tickets.slaStatisticsUnavailable }}</text>
          </view>
          <view v-if="ticketSuggestions.length" :style="suggestionsStyle">
            <text class="block" :style="formLabelStyle">{{ t.tickets.create.suggestionsLabel }}</text>
            <view v-for="faq in ticketSuggestions" :key="faq.id" :style="suggestionRowStyle">
              <text class="block" :style="suggestionQuestionStyle">{{ faq.question }}</text>
              <text class="block" :style="suggestionAnswerStyle">{{ faq.answer }}</text>
            </view>
            <view v-if="canLoadMoreTicketSuggestions" :style="ticketSuggestionLoadMoreStyle" role="button" tabindex="0" :aria-disabled="ticketSuggestionLoading ? 'true' : 'false'" @click="loadMoreTicketSuggestions" @keydown.enter.prevent="loadMoreTicketSuggestions" @keydown.space.prevent="loadMoreTicketSuggestions">
              <text>{{ ticketSuggestionLoading ? t.help.loadingMore : t.help.loadMore }}</text>
            </view>
          </view>
        </view>
        <view>
          <text class="block" :style="formLabelStyle">{{ t.tickets.create.subjectLabel }}</text>
          <!-- 输入框必须带可访问名:可见 <text> 标签与 uni 的 <input> 之间没有程序化关联,
               读屏只念「文本框」。名称 + 必填 + 长度提示都写在控件上,由平台层
               lib/a11y-field-label.ts 镜像到内部真控件(宿主上的 aria-* 不会自己下去)。 -->
          <input :value="subject" :maxlength="SUBJECT_MAX" :placeholder="t.tickets.create.subjectPlaceholder" placeholder-class="ph" :style="inputStyle" :aria-label="t.tickets.create.subjectLabel" aria-required="true" aria-describedby="ticket-subject-hint" :aria-invalid="subjectInvalid ? 'true' : 'false'" :aria-errormessage="subjectInvalid ? 'ticket-subject-error' : undefined" @input="onSubject" />
          <text id="ticket-subject-hint" class="block" :style="fieldHintStyle">{{ t.tickets.create.subjectHint }}</text>
          <text v-if="subjectInvalid" id="ticket-subject-error" class="block" :style="fieldErrorStyle" role="alert">{{ t.tickets.create.subjectRequired }}</text>
        </view>
        <view>
          <text class="block" :style="formLabelStyle">{{ t.tickets.create.descLabel }}</text>
          <textarea :value="desc" :maxlength="DESC_MAX" :placeholder="t.tickets.create.descPlaceholder" placeholder-class="ph" :style="textareaStyle" :aria-label="t.tickets.create.descLabel" aria-required="true" aria-describedby="ticket-desc-hint" :aria-invalid="descInvalid ? 'true' : 'false'" :aria-errormessage="descInvalid ? 'ticket-desc-error' : undefined" @input="onDesc" />
          <text id="ticket-desc-hint" class="block" :style="fieldHintStyle">{{ t.tickets.create.descHint }}</text>
          <text v-if="descInvalid" id="ticket-desc-error" class="block" :style="fieldErrorStyle" role="alert">{{ t.tickets.create.descRequired }}</text>
        </view>
        <view class="grid grid-cols-2" style="gap: 8px">
          <view class="flex items-center justify-center active:scale-[0.98]" :style="cancelBtnStyle" role="button" tabindex="0" :aria-label="t.tickets.create.cancel" @click="setMode({ kind: 'list' })">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            <text style="margin-left: 6px">{{ t.tickets.create.cancel }}</text>
          </view>
          <view class="flex items-center justify-center active:scale-[0.98]" :style="{ ...submitBtnStyle, opacity: ticketsStore.mutating ? 0.55 : 1 }" role="button" tabindex="0" :aria-disabled="ticketsStore.mutating" :aria-label="t.tickets.create.submit" @click="submitCreate">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" /></svg>
            <text style="margin-left: 6px">{{ t.tickets.create.submit }}</text>
          </view>
        </view>
      </view>

      <!-- DETAIL MODE -->
      <view v-else-if="detailTicket" class="px-4" style="display: flex; flex-direction: column; gap: 12px">
        <view :style="detailMetaStyle">
          <view class="flex items-center" style="gap: 6px">
            <text :style="statusTextStyle(detailTicket.status)">{{ statusLabel(detailTicket.status) }}</text>
            <text :style="dotSepStyle">·</text>
            <text :style="catTextStyle">{{ catLabel(detailTicket.category) }}</text>
          </view>
          <text class="block" :style="detailSubjectStyle">{{ detailTicket.subject }}</text>
          <view class="flex items-center justify-between" :style="detailTimesStyle">
            <text>{{ createdLabel }}</text>
            <text>{{ updatedLabel }}</text>
          </view>
          <view v-if="detailSlaTarget" :style="slaTargetStyle">
            <text class="block" :style="slaTargetLabelStyle">{{ t.tickets.slaTargetLabel }}</text>
            <text class="block" :style="slaTargetValueStyle">{{ fmt(t.tickets.slaTargetValue, { firstResponseMins: detailSlaTarget.firstResponseMins, resolutionHours: detailSlaTarget.resolutionHours }) }}</text>
            <text class="block" :style="slaStatisticsStyle">{{ t.tickets.slaStatisticsUnavailable }}</text>
          </view>
        </view>

        <text class="block" :style="messagesLabelStyle">{{ t.tickets.detail.messagesLabel }}</text>
        <text v-if="detailTicket.historyTruncated" class="block" role="status" aria-live="polite" :style="historyTruncatedStyle">{{ t.tickets.historyTruncated }}</text>
        <view v-if="detailTicket.historyNextCursor" class="active:opacity-70" :style="historyLoadEarlierStyle" role="button" tabindex="0" :aria-label="t.tickets.loadEarlier" @click="loadEarlierTicket" @keydown.enter.prevent="loadEarlierTicket" @keydown.space.prevent="loadEarlierTicket">
          <text>{{ t.tickets.loadEarlier }}</text>
        </view>
        <view style="display: flex; flex-direction: column; gap: 8px">
          <view v-for="m in detailTicket.messages" :key="m.id" :style="msgBubbleStyle(m.author === 'user')">
            <view class="flex items-center" :style="msgHeadStyle">
              <text :style="msgAuthorStyle(m.author === 'user')">{{ messageAuthor(m) }}</text>
              <text :style="dotSepStyle" style="margin: 0 4px">·</text>
              <text :style="msgTimeStyle">{{ relWhen(m.ts) }}</text>
            </view>
            <text class="block" :style="msgBodyStyle">{{ m.body }}</text>
          </view>
        </view>

        <view v-if="canReply(detailTicket)" :style="replyCardStyle">
          <textarea :value="reply" :placeholder="t.tickets.detail.replyPlaceholder" :aria-label="t.tickets.detail.replyPlaceholder" placeholder-class="ph" :style="replyTextareaStyle" @input="onReply" />
          <view class="grid grid-cols-2" style="gap: 8px; margin-top: 8px">
            <view v-if="canClose(detailTicket)" class="flex items-center justify-center active:scale-[0.98]" :style="closeBtnStyle" role="button" tabindex="0" :aria-label="t.tickets.detail.closeBtn" @click="closeTicket">
              <text>{{ t.tickets.detail.closeBtn }}</text>
            </view>
            <view class="flex items-center justify-center active:scale-[0.98]" :style="sendReplyStyle(!!reply.trim())" role="button" tabindex="0" :aria-label="t.tickets.detail.sendBtn" @click="sendReply">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" :stroke="reply.trim() ? 'var(--v5-on-brand)' : 'var(--v5-ink-4)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" /></svg>
              <text style="margin-left: 6px">{{ t.tickets.detail.sendBtn }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, nextTick, watch, type CSSProperties } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import EmptyState from "@/components/empty-state.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import StatBox from "@/components/me/ticket-stat-box.vue";
import TicketRow from "@/components/me/ticket-row.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";
import { useTickets } from "@/store/tickets";
import { useApp } from "@/store/app";
import { captureAccountScope, isCurrentAccountScope } from "@/lib/account-scope";
import { supportApi, remoteApiEnabled } from "@/api/runtime";
import { useLocaleStore } from "@/store/locale";
import { navReplace } from "@/lib/route";
import {
  STATUS_COLOR,
  type Ticket,
  type TicketCategory,
  type TicketMessage,
  type TicketStatus,
  type SupportSlaTarget,
  type SupportFaq,
} from "@/domain/support";

type Mode = { kind: "list" } | { kind: "create" } | { kind: "detail"; id: string };
type Tab = "all" | "open" | "resolved" | "closed";

const t = useT();
const ticketsStore = useTickets();
const app = useApp();
const locale = useLocaleStore();
const mode = ref<Mode>({ kind: "list" });
const tab = ref<Tab>("all");
const tabs: Tab[] = ["all", "open", "resolved", "closed"];

// The URL owns the create/list intent so a refresh or a shared deep link
// reproduces what the user sees. `?mode=create` is the only query this page
// reflects; detail stays local because a ticket id would need its own load path.
function modeQueryHref(next: Mode): string {
  return next.kind === "create" ? "/pages/me/support-tickets?mode=create" : "/pages/me/support-tickets";
}
function setMode(next: Mode) {
  mode.value = next;
  // Replace (not push) keeps the back stack intact while making the visible
  // address match the visible form. Routed through the failure-aware adapter so
  // a rejected navigation still reports instead of failing silently.
  void navReplace(modeQueryHref(next));
}

// 新工单不再提供已下线的身份核验类目;历史工单仍可渲染(标签中性化)。
const categoriesForNew: TicketCategory[] = ["withdrawal", "deposit", "hardware", "account", "earnings", "genesis", "technical", "other"];
const newCat = ref<TicketCategory>("withdrawal");
const subject = ref("");
const desc = ref("");
const reply = ref("");
// 服务端 AppSupportService 对这两个字段的界:title 1–160、body 1–2000。
// 客户端只是把同一个界前移(maxlength + 提示),提交守卫仍在服务端。
const SUBJECT_MAX = 160;
const DESC_MAX = 2000;
// 校验态只在用户按过提交之后出现 —— 一进表单就把空字段标红是误报。
const submitAttempted = ref(false);
const subjectInvalid = computed(() => submitAttempted.value && !subject.value.trim());
const descInvalid = computed(() => submitAttempted.value && !desc.value.trim());
// An account switch must drop the previous account's draft, but it must not
// discard the intent the address carries: a reload of ?mode=create has to keep
// showing the create form rather than silently falling back to the list.
watch(() => app.accountKey, () => {
  subject.value = "";
  desc.value = "";
  reply.value = "";
  submitAttempted.value = false;
  if (mode.value.kind === "detail") mode.value = { kind: "list" };
}, { flush: "sync" });
const filterFeedback = ref("");
const slaTargets = ref<SupportSlaTarget[]>([]);
const ticketSuggestions = ref<SupportFaq[]>([]);
const TICKET_SUGGESTION_PAGE_SIZE = 20;
const ticketSuggestionPage = ref(0);
const ticketSuggestionTotal = ref(0);
const ticketSuggestionLoading = ref(false);
const ticketSuggestionCache = new Map<string, SupportFaq[]>();
const ticketSuggestionTotalCache = new Map<string, number>();
const canLoadMoreTicketSuggestions = computed(() => ticketSuggestions.value.length < ticketSuggestionTotal.value);

const historyTruncatedStyle: CSSProperties = {
  color: "var(--v5-warning)",
  fontSize: "12px",
  lineHeight: "18px",
  padding: "8px 10px",
  border: "1px solid color-mix(in srgb, var(--v5-warning) 38%, transparent)",
  borderRadius: "8px",
  background: "color-mix(in srgb, var(--v5-warning) 8%, transparent)",
};
const historyLoadEarlierStyle: CSSProperties = {
  color: "var(--v5-brand)", fontSize: "13px", lineHeight: "20px", textAlign: "center",
  padding: "8px", border: "1px solid var(--v5-border)", borderRadius: "8px",
};

onLoad((query) => {
  if (query?.mode === "create") mode.value = { kind: "create" };
  // 入口可带 ?cat= 预选分类(如充值页「充值未到账?」→ deposit);白名单外忽略。
  if (typeof query?.cat === "string" && (categoriesForNew as string[]).includes(query.cat)) {
    selectCategory(query.cat as TicketCategory);
  }
  if (typeof query?.ticket === "string") mode.value = { kind: "detail", id: query.ticket };
});

onShow(async () => {
  // The create form renders from its own sources (categories, FAQ suggestions,
  // SLA targets). The ticket list only feeds the list view, so a list read that
  // fails while the user is composing a ticket must not surface as a blocking
  // failure about content they cannot see — that was the "unrelated failure"
  // toast on a ?mode=create refresh.
  const listIsVisible = mode.value.kind === "list";
  try {
    const [tickets] = await Promise.allSettled([ticketsStore.refresh(), loadSlaTargets(), loadTicketSuggestions()]);
    if (tickets.status === "rejected" && listIsVisible) throw tickets.reason;
    if (mode.value.kind === "detail") await openTicket(mode.value.id);
  } catch {
    toast.warn(t.value.security.opFailed);
  }
});

async function loadSlaTargets() {
  slaTargets.value = await supportApi.slaTargets();
}

let ticketSuggestionGeneration = 0;
function ticketSuggestionKey(requestedLocale: string, requestedCategory: TicketCategory) {
  return `${requestedLocale}:${requestedCategory}`;
}

async function loadTicketSuggestions() {
  const requestGeneration = ++ticketSuggestionGeneration;
  const requestedLocale = locale.code;
  const requestedCategory = newCat.value;
  const scopeKey = ticketSuggestionKey(requestedLocale, requestedCategory);
  ticketSuggestions.value = ticketSuggestionCache.get(scopeKey) ?? [];
  ticketSuggestionTotal.value = ticketSuggestionTotalCache.get(scopeKey) ?? ticketSuggestions.value.length;
  ticketSuggestionPage.value = ticketSuggestions.value.length > 0
    ? Math.ceil(ticketSuggestions.value.length / TICKET_SUGGESTION_PAGE_SIZE) : 0;
  ticketSuggestionLoading.value = true;
  try {
    const next = await supportApi.faqPage(requestedLocale, requestedCategory, "Ticket Create", 1, TICKET_SUGGESTION_PAGE_SIZE);
    if (requestGeneration === ticketSuggestionGeneration
        && requestedLocale === locale.code && requestedCategory === newCat.value) {
      ticketSuggestionCache.set(scopeKey, next.items);
      ticketSuggestionTotalCache.set(scopeKey, next.total);
      ticketSuggestions.value = next.items;
      ticketSuggestionPage.value = next.pageNum;
      ticketSuggestionTotal.value = next.total;
    }
  } catch {
    if (requestGeneration === ticketSuggestionGeneration
        && requestedLocale === locale.code && requestedCategory === newCat.value) {
      ticketSuggestions.value = ticketSuggestionCache.get(scopeKey) ?? [];
    }
  } finally {
    if (requestGeneration === ticketSuggestionGeneration
        && requestedLocale === locale.code && requestedCategory === newCat.value) ticketSuggestionLoading.value = false;
  }
}

async function loadMoreTicketSuggestions() {
  if (ticketSuggestionLoading.value || !canLoadMoreTicketSuggestions.value) return;
  const requestGeneration = ++ticketSuggestionGeneration;
  const requestedLocale = locale.code;
  const requestedCategory = newCat.value;
  const scopeKey = ticketSuggestionKey(requestedLocale, requestedCategory);
  const nextPage = ticketSuggestionPage.value + 1;
  ticketSuggestionLoading.value = true;
  try {
    const next = await supportApi.faqPage(requestedLocale, requestedCategory, "Ticket Create", nextPage, TICKET_SUGGESTION_PAGE_SIZE);
    if (requestGeneration === ticketSuggestionGeneration
        && requestedLocale === locale.code && requestedCategory === newCat.value) {
      const combined = [...new Map([...ticketSuggestions.value, ...next.items].map(item => [item.id, item])).values()];
      ticketSuggestionCache.set(scopeKey, combined);
      ticketSuggestionTotalCache.set(scopeKey, next.total);
      ticketSuggestions.value = combined;
      ticketSuggestionPage.value = next.pageNum;
      ticketSuggestionTotal.value = next.total;
    }
  } catch {
    // Keep the last good bounded snapshot; the load-more control remains retryable.
  } finally {
    if (requestGeneration === ticketSuggestionGeneration
        && requestedLocale === locale.code && requestedCategory === newCat.value) ticketSuggestionLoading.value = false;
  }
}

watch(() => [newCat.value, locale.code] as const, () => { void loadTicketSuggestions(); });

async function reloadTickets() {
  try { await ticketsStore.refresh(); }
  catch { toast.warn(t.value.security.opFailed); }
}

async function openTicket(id: string) {
  if (ticketsStore.mutating) return;
  const scope = captureAccountScope();
  try {
    const ticket = await ticketsStore.load(id);
    if (!isCurrentAccountScope(scope)) return;
    mode.value = { kind: "detail", id };
    await nextTick();
    if (isCurrentAccountScope(scope) && mode.value.kind === "detail" && mode.value.id === id) {
      // The detail is already available. A stale read acknowledgement has its
      // own store-side readback and must not turn opening the ticket into an
      // erroneous user-facing failure toast.
      await ticketsStore.markRead(ticket).catch(() => undefined);
    }
  } catch {
    if (!isCurrentAccountScope(scope)) return;
    if (mode.value.kind === "detail" && !detailTicket.value) mode.value = { kind: "list" };
    toast.warn(t.value.security.opFailed);
  }
}

async function loadEarlierTicket() {
  const current = detailTicket.value;
  if (!current?.historyNextCursor) return;
  try { await ticketsStore.loadEarlier(current.id); }
  catch { toast.warn(t.value.security.opFailed); }
}

const alertIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>`;
const clockIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>`;
const checkIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" /></svg>`;

const stats = computed(() => ({
  open: ticketsStore.tickets.filter((x) => x.status === "open" || x.status === "in_progress").length,
  awaiting: ticketsStore.tickets.filter((x) => x.status === "pending_user").length,
  resolved: ticketsStore.tickets.filter((x) => x.status === "resolved" || x.status === "closed").length,
}));

const filtered = computed(() => {
  const sorted = [...ticketsStore.tickets].sort((a, b) => b.updatedAt - a.updatedAt);
  switch (tab.value) {
    case "open":
      return sorted.filter((x) => x.status === "open" || x.status === "in_progress" || x.status === "pending_user");
    case "resolved":
      return sorted.filter((x) => x.status === "resolved");
    case "closed":
      return sorted.filter((x) => x.status === "closed");
    default:
      return sorted;
  }
});

const detailTicket = computed(() => {
  const m = mode.value;
  return m.kind === "detail" ? ticketsStore.tickets.find((x) => x.id === m.id) ?? null : null;
});
const newSlaTarget = computed(() => slaTargets.value.find(target => target.category === newCat.value));
const detailSlaTarget = computed(() => detailTicket.value
  ? slaTargets.value.find(target => target.category === detailTicket.value?.category)
  : undefined);
const createdLabel = computed(() => (detailTicket.value ? fmt(t.value.tickets.detail.created, { when: relWhen(detailTicket.value.createdAt) }) : ""));
const updatedLabel = computed(() => (detailTicket.value ? fmt(t.value.tickets.detail.lastUpdate, { when: relWhen(detailTicket.value.updatedAt) }) : ""));

function catLabel(c: TicketCategory): string {
  return t.value.tickets.category[c];
}
/** 选中一个分类。`?cat=` 预选与 chips 点击都走这里,免得两处状态更新漂移。 */
function selectCategory(c: TicketCategory) {
  newCat.value = c;
}
/** roving tabindex 的标准行为:方向键移一格并选上,焦点跟到新选中项。 */
function moveCategory(delta: number): void {
  const index = categoriesForNew.indexOf(newCat.value);
  const next = categoriesForNew[(index + delta + categoriesForNew.length) % categoriesForNew.length];
  if (!next) return;
  selectCategory(next);
  void nextTick(() => {
    if (typeof document === "undefined") return;
    document.querySelector<HTMLElement>(".nx-ticket-cat-radio[tabindex=\"0\"]")?.focus();
  });
}
function statusLabel(s: TicketStatus): string {
  return t.value.tickets.status[s];
}
function tabLabel(id: Tab): string {
  const key = id === "all" ? "tabAll" : id === "open" ? "tabOpen" : id === "resolved" ? "tabResolved" : "tabClosed";
  return (t.value.tickets as unknown as Record<string, string>)[key];
}
function selectTab(id: Tab) {
  if (tab.value === id) {
    filterFeedback.value = fmt(t.value.tickets.filterAlreadyShown, { tab: tabLabel(id) });
    return;
  }
  tab.value = id;
  filterFeedback.value = "";
}

function moveTab(index: number, step: number) {
  const next = tabs[(index + step + tabs.length) % tabs.length];
  if (!next) return;
  selectTab(next);
  void nextTick(() => {
    if (typeof document === "undefined") return;
    document.querySelector<HTMLElement>('.nx-ticket-status-tab[aria-selected="true"]')?.focus();
  });
}
function canClose(tk: Ticket): boolean {
  return tk.status !== "closed" && tk.status !== "resolved";
}
function canReply(tk: Ticket): boolean {
  return tk.status !== "closed";
}
function relWhen(ts: number): string {
  const ms = Date.now() - ts;
  if (ms < 60_000) return t.value.tickets.timeJustNow;
  if (ms < 3600_000) return fmt(t.value.tickets.timeMinutesAgo, { n: Math.floor(ms / 60_000) });
  if (ms < 86_400_000) return fmt(t.value.tickets.timeHoursAgo, { n: Math.floor(ms / 3600_000) });
  return fmt(t.value.tickets.timeDaysAgo, { n: Math.floor(ms / 86_400_000) });
}

function messageAuthor(message: TicketMessage): string {
  if (message.author === "user") return t.value.tickets.detail.youLabel;
  return message.agentName?.trim() || t.value.tickets.detail.agentFallback;
}

function detailVal(e: Event): string {
  return (e as unknown as { detail: { value: string } }).detail.value;
}
function onSubject(e: Event) {
  subject.value = detailVal(e);
}
function onDesc(e: Event) {
  desc.value = detailVal(e);
}
function onReply(e: Event) {
  reply.value = detailVal(e);
}

async function submitCreate() {
  if (ticketsStore.mutating) return;
  submitAttempted.value = true;
  if (!subject.value.trim() || !desc.value.trim()) {
    toast.info(t.value.tickets.create.missingFields, "");
    return;
  }
  try {
    const id = await ticketsStore.createTicket({ category: newCat.value, subject: subject.value, body: desc.value });
    toast.success(t.value.tickets.create.submittedToast, "");
    subject.value = "";
    desc.value = "";
    submitAttempted.value = false;
    mode.value = { kind: "detail", id };
  } catch { toast.error(t.value.security.opFailed); }
}
async function sendReply() {
  if (ticketsStore.mutating) return;
  const current = detailTicket.value;
  if (!current || !canReply(current) || !reply.value.trim()) return;
  try {
    await ticketsStore.reply(current.id, reply.value);
    reply.value = "";
    toast.success(t.value.tickets.detail.sentToast, "");
  } catch { toast.error(t.value.security.opFailed); }
}
async function closeTicket() {
  if (ticketsStore.mutating) return;
  const current = detailTicket.value;
  if (!current) return;
  try {
    await ticketsStore.close(current.id);
    toast.success(t.value.tickets.detail.closedToast, "");
    mode.value = { kind: "list" };
  } catch { toast.error(t.value.security.opFailed); }
}

const backRowStyle: CSSProperties = { minHeight: "44px", marginLeft: "-8px", padding: "0 8px", fontSize: "13px", color: "var(--v5-brand)" };
const newBtnStyle: CSSProperties = { width: "100%", height: "48px", borderRadius: "999px", background: "var(--v5-brand)", color: "var(--v5-on-brand)", fontWeight: 600, fontSize: "15px" };
const slaNoticeStyle: CSSProperties = { padding: "0 6px", fontSize: "12px", color: "var(--v5-ink-3)" };
const slaTargetStyle: CSSProperties = { marginTop: "10px", padding: "10px 12px", borderRadius: "12px", background: "var(--v5-surface)" };
const slaTargetLabelStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)" };
const slaTargetValueStyle: CSSProperties = { marginTop: "2px", fontSize: "13px", fontWeight: 600, color: "var(--v5-ink)" };
const slaStatisticsStyle: CSSProperties = { marginTop: "4px", fontSize: "12px", color: "var(--v5-ink-3)" };
const suggestionsStyle: CSSProperties = { marginTop: "12px", borderTop: "1px solid var(--v5-border)", paddingTop: "12px" };
const suggestionRowStyle: CSSProperties = { padding: "10px 0", borderBottom: "1px solid var(--v5-border)" };
const suggestionQuestionStyle: CSSProperties = { fontSize: "13px", fontWeight: 600, color: "var(--v5-ink)" };
const suggestionAnswerStyle: CSSProperties = { marginTop: "4px", fontSize: "12px", lineHeight: 1.625, color: "var(--v5-ink-3)" };
const ticketSuggestionLoadMoreStyle: CSSProperties = { minHeight: "44px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--v5-brand)", fontSize: "13px", fontWeight: 600 };
// Segmented control — filled container, no border (single visual difference).
// 轨道贴页面底:surface-2 与页面底同色不可辨(亮色 ΔE 2.2),改 L1 surface;选中 pill 是 brand 实底,不撞色
const tabsStyle: CSSProperties = { gap: "4px", padding: "4px", borderRadius: "16px", background: "var(--v5-surface)" };
function tabStyle(active: boolean): CSSProperties {
  return {
    height: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: 600,
    background: active ? "var(--v5-brand)" : "transparent",
    color: active ? "var(--v5-on-brand)" : "var(--v5-ink-3)",
  };
}
// Empty state — dashed outline hint, no fill (V5 empty-state idiom).
const emptyStyle: CSSProperties = { borderRadius: "16px", border: "1px dashed var(--v5-border-strong)", padding: "32px", textAlign: "center" };
const emptyTextStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)" };
const noteStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.625, paddingTop: "4px" };
const filterFeedbackStyle: CSSProperties = { marginTop: "-4px", fontSize: "12px", color: "var(--v5-ink-3)" };
const formLabelStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", color: "var(--v5-ink-3)", marginBottom: "8px" };
// 必填/长度提示与字段错误:两者都在输入框下方,由 aria-describedby / aria-errormessage 关联。
const fieldHintStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-4)", lineHeight: "16px", marginTop: "6px" };
const fieldErrorStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-danger)", lineHeight: "16px", marginTop: "4px" };
function catChipStyle(active: boolean): CSSProperties {
  return {
    height: "44px",
    display: "inline-flex",
    alignItems: "center",
    padding: "0 16px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
    background: active ? "var(--v5-brand)" : "var(--v5-surface-2)",
    color: active ? "var(--v5-on-brand)" : "var(--v5-ink-3)",
  };
}
// Inputs — 零 border。新建表单容器(模板 v-else-if create 那层)没有底色 → 输入框直接
// 贴页面底;原 surface-3 对页面底亮色仅 ΔE 2.7(分不出),整个输入框在亮色下看不见。改 L1。
// (该表单只在"新建工单"时渲染,自动扫描的默认渲染态覆盖不到,靠回源读模板发现。)
const inputStyle: CSSProperties = {
  width: "100%",
  height: "44px",
  borderRadius: "12px",
  background: "var(--v5-surface)",
  padding: "0 12px",
  fontSize: "15px",
  color: "var(--v5-ink)",
};
const textareaStyle: CSSProperties = {
  width: "100%",
  height: "140px",
  borderRadius: "12px",
  // 同 inputStyle:贴页面底,surface-3 亮色下 ΔE 2.7 不可辨 → L1
  background: "var(--v5-surface)",
  padding: "10px 12px",
  fontSize: "13px",
  color: "var(--v5-ink)",
  lineHeight: 1.625,
};
const cancelBtnStyle: CSSProperties = { height: "48px", borderRadius: "12px", background: "var(--v5-surface-2)", color: "var(--v5-ink)", fontWeight: 600, fontSize: "15px" };
const submitBtnStyle: CSSProperties = { height: "48px", borderRadius: "12px", background: "var(--v5-brand)", color: "var(--v5-on-brand)", fontWeight: 600, fontSize: "15px" };
// Ticket header — sits on the page floor, hairline closes the block.
const detailMetaStyle: CSSProperties = { padding: "4px 2px 14px", borderBottom: "1px solid var(--v5-border)" };
function statusTextStyle(s: TicketStatus): CSSProperties {
  return { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", letterSpacing: "0.06em", fontWeight: 600, color: STATUS_COLOR[s] };
}
const dotSepStyle: CSSProperties = { color: "var(--v5-ink-4)", fontSize: "12px" };
const catTextStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", color: "var(--v5-ink-3)" };
const detailSubjectStyle: CSSProperties = { marginTop: "6px", fontSize: "15px", fontWeight: 600, color: "var(--v5-ink)", lineHeight: 1.375 };
const detailTimesStyle: CSSProperties = { marginTop: "8px", fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", color: "var(--v5-ink-3)" };
const messagesLabelStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", letterSpacing: "0.06em", color: "var(--v5-ink-3)" };
// Chat bubbles keep their fill (bubble semantics) — borders dropped,
// the fill alone is the single visual difference.
function msgBubbleStyle(isUser: boolean): CSSProperties {
  return {
    borderRadius: "16px",
    padding: "14px",
    background: isUser ? "color-mix(in srgb, var(--v5-brand) 9%, transparent)" : "var(--v5-surface)",
    marginLeft: isUser ? "24px" : "0",
    marginRight: isUser ? "0" : "24px",
  };
}
const msgHeadStyle: CSSProperties = { marginBottom: "4px" };
function msgAuthorStyle(isUser: boolean): CSSProperties {
  return { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", letterSpacing: "0.06em", fontWeight: 600, color: isUser ? "var(--v5-brand)" : "var(--v5-brand-2)" };
}
const msgTimeStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", color: "var(--v5-ink-3)" };
const msgBodyStyle: CSSProperties = { fontSize: "13px", color: "color-mix(in srgb, var(--v5-ink) 90%, transparent)", lineHeight: 1.625 };
// Reply zone — 外壳卡已删,textarea 自成一体。壳只剩 padding 无底色 → textarea 直接贴
// 页面底;原 surface-3 亮色下对页面底仅 ΔE 2.7(分不出),改 L1(同新建表单输入框)。
const replyCardStyle: CSSProperties = { padding: "4px 2px 0" };
const replyTextareaStyle: CSSProperties = {
  width: "100%",
  height: "84px",
  borderRadius: "12px",
  background: "var(--v5-surface)",
  padding: "8px 12px",
  fontSize: "13px",
  color: "var(--v5-ink)",
  lineHeight: 1.625,
};
const closeBtnStyle: CSSProperties = { height: "40px", borderRadius: "8px", background: "var(--v5-surface-2)", color: "var(--v5-ink-2)", fontWeight: 600, fontSize: "13px" };
function sendReplyStyle(active: boolean): CSSProperties {
  return {
    height: "40px",
    borderRadius: "8px",
    background: active ? "var(--v5-brand)" : "color-mix(in srgb, var(--v5-surface-2) 50%, transparent)",
    color: active ? "var(--v5-on-brand)" : "var(--v5-ink-4)",
    fontWeight: 600,
    fontSize: "13px",
  };
}
</script>

<style scoped>
/* placeholder-class="ph" target — was referenced but never defined (audit P2). */
.ph {
  color: var(--v5-ink-4);
}
</style>
