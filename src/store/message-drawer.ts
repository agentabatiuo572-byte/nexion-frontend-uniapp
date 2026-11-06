import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useNotifications } from "./notifications";
import { useConversations } from "./conversations";
import { useTickets } from "./tickets";
import { navTo } from "@/lib/route";

export type MessageSection = "notifications" | "service";
export const useMessageDrawer = defineStore("messageDrawer", () => {
  const section = ref<MessageSection>("notifications");
  const notifications = useNotifications(), conversations = useConversations(), tickets = useTickets();
  const advisorUnread = computed(() => conversations.byType("advisor").reduce((sum, row) => sum + row.unread, 0));
  const supportUnread = computed(() => conversations.byType("support").reduce((sum, row) => sum + row.unread, 0));
  const humanUnread = computed(() => advisorUnread.value + supportUnread.value);
  const ticketUnread = computed(() => tickets.tickets.reduce((sum, ticket) => sum + ticket.unread, 0));
  const serviceUnread = computed(() => humanUnread.value + ticketUnread.value);
  const totalUnread = computed(() => notifications.unread + serviceUnread.value);
  const loading = computed(() => notifications.loading || conversations.loading || tickets.loading);
  const error = computed(() => notifications.error || conversations.error || tickets.error
    || (conversations.categoryAvailabilityStatus === "failed" ? "SUPPORT_CATEGORIES_UNAVAILABLE" : null));
  let epoch = 0;
  let inFlight: Promise<void> | undefined;
  let opening: Promise<boolean> | undefined;

  function show(initialSection?: MessageSection) {
    if (opening) return opening;
    if (initialSection) section.value = initialSection;
    try {
      const pages = getCurrentPages();
      if (pages[pages.length - 1]?.route === "pages/me/notifications") return Promise.resolve(true);
    } catch { /* Startup navigation may not yet expose a page stack. */ }
    return opening = navTo(`/pages/me/notifications?section=${section.value}`)
      .finally(() => { opening = undefined; });
  }

  async function refresh(): Promise<void> {
    if (inFlight) return inFlight;
    const requestEpoch = epoch;
    const active = () => requestEpoch === epoch;
    const requests: Promise<unknown>[] = [];
    // A page-triggered request already supplies this snapshot; do not race pagination.
    if (!notifications.loading) requests.push(notifications.refreshRemote(undefined, active));
    if (!tickets.loading) requests.push(tickets.refresh(active));
    requests.push(conversations.refresh(active), conversations.refreshCategories(active));
    const job = Promise.allSettled(requests).then(() => undefined);
    inFlight = job;
    try { await job; }
    finally { if (inFlight === job) inFlight = undefined; }
  }

  function stopRefresh() {
    epoch += 1;
    inFlight = undefined;
    notifications.cancelRefresh();
    tickets.cancelRefresh();
  }
  function bindAccount() {
    stopRefresh();
    section.value = "notifications";
  }

  return { section, show, advisorUnread, supportUnread, humanUnread, ticketUnread, serviceUnread, totalUnread,
    loading, error, refresh, startRefresh: refresh, stopRefresh, bindAccount };
});
