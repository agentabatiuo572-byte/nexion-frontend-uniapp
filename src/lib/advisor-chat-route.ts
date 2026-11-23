import { remoteApiEnabled } from "@/api/runtime";
import { getT } from "@/i18n/use-t";
import { navTo } from "@/lib/route";
import { copyText } from "@/lib/share";
import type { useConversations } from "@/store/conversations";
import { useLocaleStore } from "@/store/locale";
import { toast } from "@/store/ui";

/**
 * The advisor chat to open: the current advisor's thread when one exists. Without a
 * current advisor, the newest waiting (ownerless) thread, e.g. the registration welcome.
 * Otherwise a new conversation.
 */
export async function advisorChatRoute(convStore: ReturnType<typeof useConversations>): Promise<string> {
  if (remoteApiEnabled) await Promise.allSettled([convStore.refresh(), convStore.refreshAdvisor()]);
  const advisorId = convStore.advisor?.currentAdvisorId;
  const ongoing = advisorId ? convStore.humanThreads.find(row => row.ownerAgentId === String(advisorId))
    : convStore.humanThreads.find(row => !row.ownerAgentId);
  return ongoing ? "/pages/support/chat?cid=" + encodeURIComponent(ongoing.id) : "/pages/support/chat?start=advisor";
}

export async function openOrderAdvisorChat(
  convStore: ReturnType<typeof useConversations>,
  orderNo: string,
  current: () => boolean,
): Promise<void> {
  if (!current()) return;
  const locale = useLocaleStore().code;
  const copiedMessage = locale === "zh" ? "内容已复制" : locale === "en" ? "Content copied" : getT().ui.copied;
  void copyText(orderNo).then((copied) => {
    if (copied) toast.success(copiedMessage);
  });
  const route = await advisorChatRoute(convStore);
  if (current()) void navTo(route);
}
