/**
 * 待支付会话 store —— 结算扫码步开出的「发票」(金额 / 地址 / 截止)按账号持久,
 * 用户离开再回来仍是同一笔;到点作废。浮动条(pending-checkout-bar)与结算页共同消费。
 *
 * 🔴 不变量(store 自守,不靠调用点):**同账号同一时刻至多一张在窗内的发票**。
 * `begin()` 在磁盘最新行上复核:除调用方明示要替换的那张(`replaceId`,撞单确认框已问过用户)
 * 外若还有别的活票 → 拒开(返 null,并把最新行同步进内存让浮动条露出那张票)。
 * 曾经的形状:调用点判「不是本页手里那张才问」+ store 纯追加 → 支付时刻守卫回弹后再点 Pay now
 * 直接铸出第二张活票、两个地址同时催付、落单后旧票成孤儿继续拉人二次付款(独立审计 P0 族)。
 *
 * 落盘走 account-scoped-storage 的 CAS 提交器(同 deposits):基准取磁盘最新行 —— H5 多标签页
 * 共享 localStorage、各自内存副本永久不同步,纯覆盖写会让 B 页复活/抹掉 A 页的发票。
 *
 * 真后台:一行 = 一张 PENDING_PAYMENT 服务端订单 + 支付指令(orderNo / amountUsdt / address /
 * paymentDeadline);hydrate → GET /api/orders(status=PENDING_PAYMENT),begin → 现有
 * POST /api/orders 路径,完成腿 = 服务端支付回读(sandbox `POST /api/orders/{orderNo}/pay`,
 * 生产 = 支付服务商回调后的 canonicalStatus)。远端模式(fundsServerEnabled)本 store
 * **不建行也不读行**:服务端契约尚无付款截止字段,客户端不得自造 30 分钟并宣称过期;也不许铸
 * 一个没人持有私钥的假地址(与 deposits.depositAddress 同一条闸)。
 */
import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { fundsServerEnabled } from "@/api/runtime";
import { createAccountRowCommit } from "./account-scoped-storage";
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

const ACCOUNTS_KEY = "nexgrid-pending-checkout-accounts-v1"; // { [accountKey]: { sessions: PendingCheckoutSession[], rev } }
const CHAIN_METHODS: readonly PendingCheckoutMethod[] = ["usdt-trc20", "usdt-bep20", "usdt-erc20"];

type PendingRow = { sessions: PendingCheckoutSession[] };

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
  /** 撞单确认框里用户明示放弃的那张旧票 —— 与开新票同一次提交(先销后开不再有半执行窗口)。 */
  replaceId?: string | null;
}

export const usePendingCheckout = defineStore("pendingCheckout", () => {
  const sessions = ref<PendingCheckoutSession[]>([]);
  /** 结算页正在展示的会话 id(内存态)—— 浮动条对它不重复显示。 */
  const viewingId = ref<string | null>(null);
  /** 浮动条倒计时读它(1s 心跳,只在有会话时跑;前后台切换即时重同步)。 */
  const clock = ref(mockServerNow());

  const rows = createAccountRowCommit<PendingRow>({
    tableKey: ACCOUNTS_KEY,
    parse: (raw) => ({ sessions: normalizeSessions((raw as { sessions?: unknown } | null)?.sessions) }),
    snapshot: () => ({ sessions: sessions.value }),
    sync: (row) => { sessions.value = row.sessions; },
  });

  function commitSessions<R>(apply: (cur: PendingCheckoutSession[]) => { next: PendingCheckoutSession[]; result: R } | null): R | null {
    if (fundsServerEnabled) return null;
    const outcome = rows.commit<R>((cur) => {
      const applied = apply(cur.sessions);
      return applied ? { next: { sessions: applied.next }, result: applied.result } : null;
    });
    return outcome.ok ? outcome.result : null;
  }

  // 1s 心跳:推进 clock;到点的票剪掉(经 CAS 提交,顺带把别的标签页的最新行刷进内存)。
  let ticker: ReturnType<typeof setInterval> | undefined;
  function tick() {
    clock.value = mockServerNow();
    if (sessions.value.some((s) => !isSessionLive(s, clock.value))) {
      const now = clock.value;
      commitSessions((cur) => {
        const live = pruneExpiredSessions(cur, now);
        return live.length === cur.length ? null : { next: live, result: true };
      });
    }
  }
  watch(() => sessions.value.length, (n) => {
    if (n > 0 && !ticker) ticker = setInterval(tick, 1000);
    else if (n === 0 && ticker) { clearInterval(ticker); ticker = undefined; }
  }, { immediate: true });
  // 后台标签页的定时器会被浏览器节流;回到前台先把时钟拨准,别让浮动条展示一张其实已死的票。
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
  }

  /** 账号切换重绑:装载该账号的会话行(过期行读入即剪);正在展示的会话属于旧账号,一并放手。 */
  function bindAccount(rawAccountKey: string) {
    viewingId.value = null;
    clock.value = mockServerNow();
    if (fundsServerEnabled) { sessions.value = []; return; }
    const row = rows.bind(rawAccountKey);
    sessions.value = pruneExpiredSessions(row?.sessions ?? [], clock.value);
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

  /**
   * 开票:进入扫码步那一刻冻结金额 / 地址 / 截止。
   * 返 null 的三种情况:远端模式(见文件头)/ 入参非法 / 磁盘最新行里还有别的活票
   * (多标签页各开一张、或调用方没先问用户)—— 此时内存已同步成磁盘最新态,浮动条会露出那张票。
   */
  function begin(input: BeginPendingCheckoutInput): PendingCheckoutSession | null {
    if (fundsServerEnabled) return null;
    if (!CHAIN_METHODS.includes(input.method)) return null;
    if (!Number.isFinite(input.amountUsdt) || input.amountUsdt < 0) return null;
    if (!input.quote || !Number.isFinite(input.quote.total) || input.quote.total < 0) return null;
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
    return commitSessions((cur) => {
      const live = pruneExpiredSessions(cur, now).filter((s) => s.id !== input.replaceId);
      if (live.length > 0) return null; // 不变量:至多一张活票 —— 别的活票在,拒开
      return { next: [session], result: session };
    });
  }

  /** 完成付款(已建单)/ 用户放弃 / 支付时刻守卫回弹作废 —— 这张发票不再有任何可恢复动作。 */
  function remove(id: string) {
    if (viewingId.value === id) viewingId.value = null;
    if (!sessions.value.some((s) => s.id === id)) return;
    commitSessions((cur) => (cur.some((s) => s.id === id)
      ? { next: cur.filter((s) => s.id !== id), result: true }
      : null));
  }

  /** 首次离开时返回 true(调用方据此给一次性提示);之后恒 false。 */
  function markLeftNotice(id: string): boolean {
    return commitSessions((cur) => {
      const s = cur.find((x) => x.id === id);
      if (!s || s.leftNoticeShown) return null;
      return { next: cur.map((x) => (x.id === id ? { ...x, leftNoticeShown: true } : x)), result: true };
    }) === true;
  }

  function setViewing(id: string | null) {
    viewingId.value = id;
  }

  return { sessions, current, barSession, viewingId, clock, bindAccount, get, isLive, secondsLeft, begin, remove, markLeftNotice, setViewing };
});
