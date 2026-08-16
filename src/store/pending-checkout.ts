/**
 * 待支付会话 store —— 结算扫码步开出的「发票」(金额 / 地址 / 截止)按账号持久,
 * 用户离开再回来仍是同一笔;到点作废。浮动条(pending-checkout-bar)与结算页共同消费。
 *
 * 真后台:一行 = 一张 PENDING_PAYMENT 服务端订单 + 支付指令;hydrate → GET /api/orders
 * (status=PENDING_PAYMENT),begin → 现有 POST /api/orders 路径,expiresAt → 服务端
 * paymentDeadline。远端模式(fundsServerEnabled)本 store **不建行也不读行**:
 * 服务端契约尚无付款截止字段,客户端不得自造 30 分钟并宣称过期;也不许铸一个没人持有
 * 私钥的假地址(与 deposits.depositAddress 同一条闸)。
 */
import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { fundsServerEnabled } from "@/api/runtime";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";
import { deriveDepositAddress } from "./deposits-core";
import { mockServerNow, ONE_MINUTE_MS } from "./server-time";
import {
  firstLiveSession,
  isSessionLive,
  normalizeSessions,
  PENDING_CHECKOUT_WINDOW_MIN,
  pruneExpiredSessions,
  sessionSecondsLeft,
  type PendingCheckoutMethod,
  type PendingCheckoutQuote,
  type PendingCheckoutSession,
} from "./pending-checkout-core";

const ACCOUNTS_KEY = "nexgrid-pending-checkout-accounts-v1"; // { [accountKey]: { sessions: PendingCheckoutSession[] } }

function hydrate(accountKey: string): PendingCheckoutSession[] {
  if (fundsServerEnabled) return [];
  const row = readAccountRow<{ sessions?: unknown }>(ACCOUNTS_KEY, accountKey);
  return pruneExpiredSessions(normalizeSessions(row?.sessions), mockServerNow());
}

function mintSessionId(): string {
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `pc-${suffix}`;
}

export interface BeginPendingCheckoutInput {
  productId: string;
  method: PendingCheckoutMethod;
  amountUsdt: number;
  quote: PendingCheckoutQuote;
}

export const usePendingCheckout = defineStore("pendingCheckout", () => {
  // 账号维度:boot 期落 "default",账号确定后由 lib/account-scope 统一重绑。
  let boundKey = "default";
  const sessions = ref<PendingCheckoutSession[]>(hydrate(boundKey));
  /** 结算页正在展示的会话 id(内存态)—— 浮动条对它不重复显示。 */
  const viewingId = ref<string | null>(null);
  /** 单一时钟:浮动条倒计时 / 过期裁决都读它(1s 心跳,只在有会话时跑)。 */
  const clock = ref(mockServerNow());

  function persist() {
    if (fundsServerEnabled) return;
    writeAccountRow<{ sessions: PendingCheckoutSession[] }>(ACCOUNTS_KEY, boundKey, { sessions: sessions.value });
  }
  watch(sessions, persist, { deep: true });

  let ticker: ReturnType<typeof setInterval> | undefined;
  watch(() => sessions.value.length, (n) => {
    if (n > 0 && !ticker) {
      ticker = setInterval(() => {
        clock.value = mockServerNow();
        const live = pruneExpiredSessions(sessions.value, clock.value);
        if (live.length !== sessions.value.length) sessions.value = live;
      }, 1000);
    } else if (n === 0 && ticker) {
      clearInterval(ticker);
      ticker = undefined;
    }
  }, { immediate: true });

  /** 账号切换重绑:装载该账号的会话行;正在展示的会话属于旧账号,一并放手。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    viewingId.value = null;
    sessions.value = hydrate(boundKey);
    clock.value = mockServerNow();
  }

  const current = computed(() => firstLiveSession(sessions.value, clock.value));
  /** 浮动条要展示的那一笔:有在途会话,且结算页此刻没有在展示它(不重复提醒)。 */
  const barSession = computed(() => (current.value && current.value.id !== viewingId.value ? current.value : null));

  function get(id: string): PendingCheckoutSession | null {
    return sessions.value.find((s) => s.id === id) ?? null;
  }

  function isLive(session: PendingCheckoutSession | null | undefined): boolean {
    return !!session && isSessionLive(session, mockServerNow());
  }

  function secondsLeft(session: PendingCheckoutSession): number {
    return sessionSecondsLeft(session, clock.value);
  }

  /** 开票:进入扫码步那一刻冻结金额 / 地址 / 截止。远端模式拒开(见文件头)。 */
  function begin(input: BeginPendingCheckoutInput): PendingCheckoutSession | null {
    if (fundsServerEnabled) return null;
    if (!Number.isFinite(input.amountUsdt) || input.amountUsdt < 0) return null;
    const now = mockServerNow();
    const id = mintSessionId();
    const session: PendingCheckoutSession = {
      id,
      kind: "purchase",
      orderNo: null,
      productId: input.productId,
      method: input.method,
      amountUsdt: input.amountUsdt,
      // 每单专属地址:以会话 id 为种子派生(与充值地址同一形态函数,不同种子)。
      address: deriveDepositAddress(id, input.method),
      createdAt: now,
      expiresAt: now + PENDING_CHECKOUT_WINDOW_MIN * ONE_MINUTE_MS,
      quote: input.quote,
      leftNoticeShown: false,
    };
    sessions.value = [...pruneExpiredSessions(sessions.value, now), session];
    return session;
  }

  /** 完成付款(已建单)/ 用户放弃 —— 这张发票不再有任何可恢复动作。 */
  function remove(id: string) {
    if (viewingId.value === id) viewingId.value = null;
    if (sessions.value.some((s) => s.id === id)) sessions.value = sessions.value.filter((s) => s.id !== id);
  }

  /** 首次离开时返回 true(调用方据此给一次性提示);之后恒 false。 */
  function markLeftNotice(id: string): boolean {
    const s = sessions.value.find((x) => x.id === id);
    if (!s || s.leftNoticeShown) return false;
    sessions.value = sessions.value.map((x) => (x.id === id ? { ...x, leftNoticeShown: true } : x));
    return true;
  }

  function setViewing(id: string | null) {
    viewingId.value = id;
  }

  return { sessions, current, barSession, viewingId, clock, bindAccount, get, isLive, secondsLeft, begin, remove, markLeftNotice, setViewing };
});
