import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";
import { ONE_MINUTE_MS, mockServerNow } from "./server-time";
import { useApp } from "./app";
import { useBills } from "./bills";
import { useFx } from "./fx";
import { vndForUsdt } from "./fx-core";
import {
  BANK_MAX_DEPOSIT_USDT,
  BANK_RECEIVE_ACCOUNTS,
  BANK_VND_TOLERANCE,
  CARD_DECLINE_RATE,
  CHAIN_REQUIRED_CONFIRMATIONS,
  MAX_CARD_DEPOSIT_USDT,
  MIN_CARD_DEPOSIT_USDT,
  MIN_DEPOSIT_USDT,
  cardChargeUsd,
  cardFeeUsd,
  chainDepositFeeUsdt,
  computeCreditedUsdt,
  deriveDepositAddress,
  isDuplicateAuthCode,
  isDuplicateTxHash,
  mockCardAuthCode,
  mockChainTxHash,
  mockDepositId,
  mockMemoCode,
  pickBankAccount,
  type BankReceiveAccount,
} from "./deposits-core";
import type { ChainDepositChannel, DepositChannel, DepositIntent, DepositRecord } from "./types";

// 入金 store(PAY-规格 [FEAT-PAY01] 链上三网络;[FEAT-PAY02] 银行轨意向单
// 生命周期:createBankIntent → 回调匹配/超时/取消;锁价语义见 [FEAT-PAY03])。
//
// MOCK 铁律:status server-canonical——状态推进(链上侦测 → 确认数 → 入账、
// 银行轨回单匹配、卡轨授权结果)一律由本文件扮演的「服务端」裁定,页面只提交意图、
// 只读结果,不自己算状态。client 可发起的写入口恰好三个,均为「用户动作」而非
// 「状态推进」:createBankIntent(下单)/ cancelBankIntent(撤单)/ submitCardPayment(付款)。
// PROD 切换:到账引擎与授权模拟整体删除,client 改为轮询收敛状态;那三个用户动作
// 各接一个 endpoint;入账(余额 + 账单)由 server 在 credited 落库事务内完成。
//
// ⚠️ 本文件注释里的 `/api/...` 全部是**候选命名**:PAY 规格未定义 API 层(全文 0 个
// /api/),PRD v3.7 也尚未同步入金新架构的接口章节。接后台时以届时的接口契约为准,
// 勿把这些路径当既定契约引用(规则:注释 endpoint 必在 PRD 有据,否则标候选)。

const ACCOUNTS_KEY = "nexgrid-deposits-accounts-v1"; // { [accountKey]: { records, intents } }

interface DepositsRow {
  records: DepositRecord[];
  intents: DepositIntent[];
}

function hydrate(accountKey: string): DepositsRow {
  const row = readAccountRow<Partial<DepositsRow>>(ACCOUNTS_KEY, accountKey);
  return {
    records: row && Array.isArray(row.records) ? row.records : [],
    intents: row && Array.isArray(row.intents) ? row.intents : [],
  };
}

/** 链上通道 → tx 页网络短码(大写白名单键)。法币轨无映射:非链上转账,账单不落 network。 */
export const CHAIN_NET_SHORT: Partial<Record<DepositChannel, "TRC20" | "ERC20" | "BEP20">> = {
  "usdt-trc20": "TRC20",
  "usdt-erc20": "ERC20",
  "usdt-bep20": "BEP20",
};

/** bills memo 用通道标签(账单 memo 与既有 seed "Top-up · USDT-TRC20" 同款式)。 */
const CHANNEL_MEMO: Record<DepositChannel, string> = {
  "usdt-trc20": "USDT-TRC20",
  "usdt-erc20": "USDT-ERC20",
  "usdt-bep20": "USDT-BEP20",
  "bank-vietqr": "Bank VietQR",
  "card-intl": "Card",
};

// 确认推进节奏(演示压缩;真链 TRC20 分钟级)。detected → 1.2s → confirming,
// 之后按 requiredConfirmations 均分 ~10s 逐一推进 → 全程 ~11s 落 credited。
const DETECT_TO_CONFIRM_MS = 1200;
const CONFIRM_WINDOW_MS = 10_000;

export const useDeposits = defineStore("deposits", () => {
  // 账号维度。boot 期落 "default";账号确定后由 lib/account-scope 的
  // rebindAccountScopedStores 统一重绑(P-031 store 不互 import 的编排收口)。
  let boundKey = "default";
  const initial = hydrate(boundKey);
  const records = ref<DepositRecord[]>(initial.records);
  const intents = ref<DepositIntent[]>(initial.intents);

  // mock 到账引擎的在途定时器(depositId → timer)。账号切换即停:引擎跑在
  // client,跨账号继续推进会把钱记进新绑账号;PROD 服务端持续推进,
  // client 重新拉取即收敛(切回账号后记录停在 confirming,属 mock 已知边界)。
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function persist(): boolean {
    return writeAccountRow<DepositsRow>(ACCOUNTS_KEY, boundKey, {
      records: records.value,
      intents: intents.value,
    });
  }

  /** 账号切换重绑:装载该账号分行,停掉上一账号的在途引擎定时器,
   *  再对新账号在途意向单做一次 server 状态收敛(过期落地 + 定时器重武装)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    const row = hydrate(boundKey);
    records.value = row.records;
    intents.value = row.intents;
    syncBankIntents();
  }

  /** 专属充值地址:同账号同网络恒定(mock 确定性派生;PROD server 派发)。 */
  function depositAddress(network: ChainDepositChannel): string {
    return deriveDepositAddress(boundKey, network);
  }

  /** 当前绑定账号键(只读)。组件发起「跨延迟」的资金动作时先捕获,回调时传回校验 ——
   *  与两条 mock 引擎的 `const key = boundKey; … if (boundKey !== key) return;` 同形。 */
  function currentAccountKey(): string {
    return boundKey;
  }

  /** 单号铸造(server mint 形态)。🔴 必须查重:`DP-YYYYMMDD-NNNN` 同日仅 9000 种,
   *  而 depositId 是三轨共享主键 —— 撞号会让 `records.find(depositId)` 命中错记录,
   *  链上单被判成终态后引擎直接 return 且定时器已释放,那笔钱永久停在 confirming。
   *  次要标识(memoCode / authCode / txHash)本就有查重,主键反而没有,此处补齐。
   *  查重域 = records ∪ intents(两者共用同一号段:意向单入账时 intentId 即 depositId)。 */
  function mintDepositId(now: number): string {
    let id = mockDepositId(now);
    // 重摇设上界:9000 号段被占满(或 mock 随机源被钉死)时无界 while 会转死页面。
    // 兜底返回带序号后缀的唯一串,宁可号形略异也不挂死(PROD 由 server 保证唯一)。
    for (let i = 0; i < 50; i++) {
      const taken =
        records.value.some((r) => r.depositId === id) ||
        intents.value.some((i2) => i2.intentId === id);
      if (!taken) return id;
      id = mockDepositId(now);
    }
    return `${id}-${records.value.length + intents.value.length}`;
  }

  // 通道启停位(server 配置非用户态,不入账号分行;mock 种子全启用。
  // PROD:GET /api/config/deposit-channels 的 enabled 字段,本段被拉取结果替换)。
  const chainChannelEnabled = ref<Record<ChainDepositChannel, boolean>>({
    "usdt-trc20": true,
    "usdt-bep20": true,
    "usdt-erc20": true,
  });

  /** ⚠️ DEV/DEMO-ONLY:后台启停链上通道(D1 通道配置形态)。 */
  function _devSetChannelEnabled(network: ChainDepositChannel, enabled: boolean): boolean {
    if (import.meta.env.PROD) return false;
    if (!(network in chainChannelEnabled.value)) return false; // console 驱动,入参不可信
    chainChannelEnabled.value = { ...chainChannelEnabled.value, [network]: enabled === true };
    return true;
  }

  // 收款账户池镜像(server 配置非用户态,不入账号分行;种子 = deposits-core 池,
  // 停用/熔断统一 enabled=false。PROD:GET /api/config/bank-accounts 下发,本段被替换)。
  const bankAccounts = ref<BankReceiveAccount[]>(BANK_RECEIVE_ACCOUNTS.map((a) => ({ ...a })));
  /** 池内还有可用户?否 → 银行转账通道置灰([FEAT-PAY02] ⑤ 空状态)。 */
  const bankRailAvailable = computed(() => bankAccounts.value.some((a) => a.enabled));

  /** ⚠️ DEV/DEMO-ONLY:按账号尾 4 位启停收款账户(admin bank-rail 启停/熔断形态)。 */
  function _devSetBankAccountEnabled(tail4: string, enabled: boolean): boolean {
    if (import.meta.env.PROD) return false;
    const tail = String(tail4).trim();
    if (!/^\d{4}$/.test(tail)) return false; // console 驱动,入参不可信
    if (!bankAccounts.value.some((a) => a.accountNumber.replace(/\s/g, "").endsWith(tail))) return false;
    bankAccounts.value = bankAccounts.value.map((a) =>
      a.accountNumber.replace(/\s/g, "").endsWith(tail) ? { ...a, enabled: enabled === true } : a,
    );
    return true;
  }

  /** 延迟回调禁 stale 闭包:一律现读 records.value 现改现写(feedback_delayed_callback_stale_closure)。
   *  persist 失败回滚内存态,防内存/存储分叉(同 bills.add 先例);跨 store
   *  的余额/账单原子性归 PROD server 事务,mock 已在文件头声明边界。 */
  function patchRecord(depositId: string, patch: Partial<DepositRecord>): DepositRecord | null {
    const previous = records.value;
    let next: DepositRecord | null = null;
    records.value = records.value.map((r) => {
      if (r.depositId !== depositId) return r;
      next = { ...r, ...patch };
      return next;
    });
    if (!next) return null;
    if (!persist()) {
      records.value = previous;
      return null;
    }
    return next;
  }

  /** 入账(mock server 内部;confirming 走满 / dust 人工核销两条边共用)。
   *  幂等三重:状态机边界(仅 confirming|dust_hold 可入)+ recordDeposit 原子
   *  入账 + bills.addOnce 以 txHash 为 ref 判重。PROD:server 在同一事务内
   *  置 credited + 记账 + 写账单(复式分录见规格 §5)。 */
  function settleCredited(depositId: string): boolean {
    const rec = records.value.find((r) => r.depositId === depositId);
    if (!rec) return false;
    // credited/returned 终态禁再处置(server 409 形态);detected 不可直接入账。
    if (rec.status !== "confirming" && rec.status !== "dust_hold") return false;
    if (rec.creditedUsdt <= 0) return false; // gross ≤ fee 的 dust 不可核销入账,只能退回
    if (!useApp().recordDeposit(rec.creditedUsdt)) return false;
    useBills().addOnce({
      type: "topup",
      symbol: "USDT",
      amount: rec.creditedUsdt,
      status: "posted",
      memo: `Top-up · ${CHANNEL_MEMO[rec.channel]}`,
      ref: rec.txHash ?? rec.depositId,
      // 链上通道落网络码位(法币轨为 undefined 不落);账单详情跳转不再依赖 memo 文案正则
      network: CHAIN_NET_SHORT[rec.channel],
    });
    patchRecord(depositId, { status: "credited", creditedAt: mockServerNow() });
    return true;
  }

  /** mock 到账引擎:detected → confirming(或 dust_hold 停住)→ 逐步推进
   *  确认数 → 走满调 settleCredited。每步回源读当前记录,终态即停。 */
  function scheduleConfirmations(depositId: string) {
    const key = boundKey;
    function queue(ms: number) {
      timers.set(depositId, setTimeout(step, ms));
    }
    function step() {
      timers.delete(depositId);
      if (boundKey !== key) return; // 账号已切换,mock 引擎停(见顶部注释)
      const rec = records.value.find((r) => r.depositId === depositId);
      if (!rec) return;
      if (rec.status === "detected") {
        if (rec.grossAmountUsdt < MIN_DEPOSIT_USDT) {
          patchRecord(depositId, { status: "dust_hold" }); // 停住等后台人工处置
          return;
        }
        patchRecord(depositId, { status: "confirming" });
        queue(stepDelay(rec.requiredConfirmations ?? 1));
        return;
      }
      if (rec.status !== "confirming") return; // 终态/dust_hold 不再推进
      const required = rec.requiredConfirmations ?? 1;
      const confs = Math.min(required, (rec.confirmations ?? 0) + 1);
      patchRecord(depositId, { confirmations: confs });
      if (confs >= required) {
        settleCredited(depositId);
        return;
      }
      queue(stepDelay(required));
    }
    function stepDelay(required: number): number {
      return Math.max(400, Math.round(CONFIRM_WINDOW_MS / Math.max(1, required)));
    }
    queue(DETECT_TO_CONFIRM_MS);
  }

  /** ⚠️ DEV/DEMO-ONLY:模拟「链上侦测到入账转账」(tester 驱动通道)。
   *  双层 guard 同 _devSetEligibilityTimeout 模式(globalThis 挂载层 + 本层)。
   *  同 txHash 重复上报 no-op 返 null([FEAT-PAY01] ④ 幂等)。
   *  PROD 无此入口:真实链路 = 链上侦测服务回报,server 推进状态。 */
  function _devSimulateIncomingTransfer(
    network: ChainDepositChannel,
    amountUsdt: number,
    txHash?: string,
  ): DepositRecord | null {
    if (import.meta.env.PROD) return null;
    if (!(network in CHAIN_REQUIRED_CONFIRMATIONS)) return null; // console 驱动,入参不可信
    if (!Number.isFinite(amountUsdt) || amountUsdt <= 0 || amountUsdt > 1e9) return null;
    const hash = txHash && txHash.trim() ? txHash.trim() : mockChainTxHash();
    if (isDuplicateTxHash(records.value, hash)) return null; // no-op
    const now = mockServerNow();
    const gross = +amountUsdt.toFixed(2);
    const fee = chainDepositFeeUsdt(network);
    const rec: DepositRecord = {
      depositId: mintDepositId(now),
      channel: network,
      grossAmountUsdt: gross,
      feeUsdt: fee,
      creditedUsdt: computeCreditedUsdt(gross, fee),
      address: depositAddress(network),
      txHash: hash,
      confirmations: 0,
      requiredConfirmations: CHAIN_REQUIRED_CONFIRMATIONS[network],
      status: "detected",
      createdAt: now,
    };
    records.value = [rec, ...records.value];
    persist();
    scheduleConfirmations(rec.depositId);
    return rec;
  }

  /** ⚠️ DEV/DEMO-ONLY(后台动作形态):dust_hold 人工处置——核销入账或登记退回。
   *  仅 dust_hold 可处置,终态拒绝(server 409 形态)。PROD:后台 D1 高敏动作
   *  (确认 + 理由 + 审计 + 失败态),endpoint 形态
   *  POST /api/admin/deposits/:id/resolve { action: "credit"|"return", reason };client 无入口。 */
  function _devResolveDustHold(depositId: string, resolution: "credit" | "return"): boolean {
    if (import.meta.env.PROD) return false;
    const rec = records.value.find((r) => r.depositId === depositId);
    if (!rec || rec.status !== "dust_hold") return false;
    if (resolution === "credit") return settleCredited(depositId);
    return patchRecord(depositId, { status: "returned" }) !== null;
  }

  // ════════ 银行轨意向单生命周期([FEAT-PAY02] ③④;mock 扮演 server)════════

  /** 意向单补丁(同 patchRecord:现读现改现写,persist 失败回滚防内存/存储分叉)。 */
  function patchIntent(intentId: string, patch: Partial<DepositIntent>): DepositIntent | null {
    const previous = intents.value;
    let next: DepositIntent | null = null;
    intents.value = intents.value.map((i) => {
      if (i.intentId !== intentId) return i;
      next = { ...i, ...patch };
      return next;
    });
    if (!next) return null;
    if (!persist()) {
      intents.value = previous;
      return null;
    }
    return next;
  }

  function clearIntentTimer(intentId: string) {
    const timer = timers.get(intentId);
    if (timer) {
      clearTimeout(timer);
      timers.delete(intentId);
    }
  }

  /** 锁价窗到点置 expired(mock server 侧推进)。回调现读 intents.value 现改,
   *  禁 stale 闭包(feedback_delayed_callback_stale_closure);账号切换即停。 */
  function scheduleIntentExpiry(intentId: string) {
    const key = boundKey;
    const intent = intents.value.find((i) => i.intentId === intentId);
    if (!intent || intent.status !== "awaiting_payment") return;
    clearIntentTimer(intentId);
    timers.set(
      intentId,
      setTimeout(
        () => {
          timers.delete(intentId);
          if (boundKey !== key) return; // 账号已切换,mock 引擎停(见顶部注释)
          const cur = intents.value.find((i) => i.intentId === intentId);
          if (!cur || cur.status !== "awaiting_payment") return;
          patchIntent(intentId, { status: "expired" });
        },
        Math.max(0, intent.expireAt - mockServerNow()),
      ),
    );
  }

  /** server 状态收敛(启动/换号即跑):已过锁价窗的在途单落 expired,未过期的重新武装
   *  超时定时器。PROD:server 持续推进,client 拉取即收敛,本函数删除。 */
  function syncBankIntents() {
    const now = mockServerNow();
    intents.value
      .filter((i) => i.status === "awaiting_payment")
      .forEach((i) => {
        if (i.expireAt <= now) patchIntent(i.intentId, { status: "expired" });
        else scheduleIntentExpiry(i.intentId);
      });
  }

  /** 生成付款单(PROD = POST /api/deposits/bank-intents;校验失败即 422 形态返 null)。
   *  锁价:fxRate/vndAmount/expireAt 均在此刻定格,后续调价不影响本单(规格 ② 异常2)。 */
  function createBankIntent(usdtAmount: number): DepositIntent | null {
    if (!Number.isFinite(usdtAmount)) return null;
    const amt = +usdtAmount.toFixed(2);
    if (amt < MIN_DEPOSIT_USDT || amt > BANK_MAX_DEPOSIT_USDT) return null;
    const fx = useFx();
    // 牌价不可用禁下单([FEAT-PAY03] ② 异常1);锁价窗缺失同视为配置不可用(禁写死回退)。
    if (!fx.fxAvailable || fx.lockWindowMin <= 0) return null;
    // 收款账户池无可用户(全部停用/熔断)禁下单([FEAT-PAY02] ⑤ 空状态)
    const bankAccount = pickBankAccount(intents.value.length, bankAccounts.value);
    if (!bankAccount) return null;
    const now = mockServerNow();
    const fxRate = fx.quoteRate;
    // 附言码在途期内唯一(mock 域 = 本账号在途单;PROD server 全局唯一)
    let memoCode = mockMemoCode();
    while (intents.value.some((i) => i.status === "awaiting_payment" && i.memoCode === memoCode)) {
      memoCode = mockMemoCode();
    }
    const intent: DepositIntent = {
      intentId: mintDepositId(now),
      usdtAmount: amt,
      fxRate,
      vndAmount: vndForUsdt(amt, fxRate),
      memoCode,
      bankAccount,
      status: "awaiting_payment",
      expireAt: now + fx.lockWindowMin * ONE_MINUTE_MS,
    };
    const previous = intents.value;
    intents.value = [intent, ...intents.value];
    if (!persist()) {
      intents.value = previous;
      return null;
    }
    scheduleIntentExpiry(intent.intentId);
    return intent;
  }

  /** 取消付款单:client 仅可对 awaiting_payment 执行;终态再处置拒绝(server 409 形态)。 */
  function cancelBankIntent(intentId: string): boolean {
    const intent = intents.value.find((i) => i.intentId === intentId);
    if (!intent || intent.status !== "awaiting_payment") return false;
    clearIntentTimer(intentId);
    return patchIntent(intentId, { status: "cancelled" }) !== null;
  }

  /** 银行轨入账(mock server 内部;精确匹配 / 差额按实收核销两条边共用)。
   *  幂等三重同链上 settleCredited:状态机边界(调用方把关)+ 记录判重(depositId=intentId)
   *  + bills.addOnce(ref=intentId)。0 手续费;PROD 同事务置 credited + 记账 + 写账单(§5 分录)。 */
  function settleBankIntent(intentId: string, creditedUsdt: number, receivedVnd: number): boolean {
    const intent = intents.value.find((i) => i.intentId === intentId);
    if (!intent) return false;
    const credited = +creditedUsdt.toFixed(2);
    if (credited <= 0) return false;
    if (!useApp().recordDeposit(credited)) return false;
    useBills().addOnce({
      type: "topup",
      symbol: "USDT",
      amount: credited,
      status: "posted",
      memo: `Top-up · ${CHANNEL_MEMO["bank-vietqr"]}`,
      ref: intent.intentId,
    });
    const now = mockServerNow();
    if (!records.value.some((r) => r.depositId === intent.intentId)) {
      // DepositRecord 与意向单同号互相关联([FEAT-PAY02] ③);银行轨无链上字段。
      const rec: DepositRecord = {
        depositId: intent.intentId,
        channel: "bank-vietqr",
        grossAmountUsdt: credited,
        feeUsdt: 0,
        creditedUsdt: credited,
        status: "credited",
        createdAt: now,
        creditedAt: now,
      };
      records.value = [rec, ...records.value];
    }
    patchIntent(intentId, { status: "credited", receivedVnd, matchedAt: now });
    return true;
  }

  /** ⚠️ DEV/DEMO-ONLY:模拟「银行回单到达」(tester 驱动通道)。省参 = 命中最新在途单、
   *  金额精确 → credited;差额超容差 ±1,000₫ → mismatch_review;对 expired 单调用 =
   *  迟到转账(只登记回单进人工核对,不自动入账,[FEAT-PAY02] ② 异常1)。
   *  同单重复回报 no-op;credited/cancelled/return_pending 终态拒(server 409 形态)。
   *  PROD 无此入口:真实链路 = PSP 回单回调,server 匹配推进。 */
  function _devBankCallback(intentId?: string, receivedVnd?: number): DepositIntent | null {
    if (import.meta.env.PROD) return null;
    const target = intentId
      ? intents.value.find((i) => i.intentId === intentId)
      : intents.value.find((i) => i.status === "awaiting_payment");
    if (!target) return null;
    if (target.status === "credited" || target.status === "cancelled" || target.status === "return_pending") return null;
    // console 驱动,入参不可信:非法金额回落为精确金额
    const received =
      typeof receivedVnd === "number" && Number.isFinite(receivedVnd) && receivedVnd > 0
        ? Math.round(receivedVnd)
        : target.vndAmount;
    if (target.status === "expired") {
      // ponytail: 过期后宽限期(10min)内按锁定价自动入账属真后台回单时间戳匹配,mock 统一走人工核对展示。
      return patchIntent(target.intentId, { receivedVnd: received, matchedAt: mockServerNow() });
    }
    if (target.status === "mismatch_review") return null; // 已在人工核对,重复回单 no-op
    clearIntentTimer(target.intentId);
    if (Math.abs(received - target.vndAmount) > BANK_VND_TOLERANCE) {
      return patchIntent(target.intentId, {
        status: "mismatch_review",
        receivedVnd: received,
        matchedAt: mockServerNow(),
      });
    }
    // 容差内按锁定牌价足额入账(规格阳光路径)
    if (!settleBankIntent(target.intentId, target.usdtAmount, received)) return null;
    return intents.value.find((i) => i.intentId === target.intentId) ?? null;
  }

  /** ⚠️ DEV/DEMO-ONLY:直接催熟超时(tester 驱动;省参 = 最新在途单)。 */
  function _devBankExpire(intentId?: string): boolean {
    if (import.meta.env.PROD) return false;
    const target = intentId
      ? intents.value.find((i) => i.intentId === intentId)
      : intents.value.find((i) => i.status === "awaiting_payment");
    if (!target || target.status !== "awaiting_payment") return false;
    clearIntentTimer(target.intentId);
    return patchIntent(target.intentId, { status: "expired" }) !== null;
  }

  /** ⚠️ DEV/DEMO-ONLY(后台动作形态):mismatch_review 人工处置——按实收核销入账或
   *  登记退回。仅 mismatch_review 可处置,其余拒绝(server 409 形态)。PROD:后台 D1
   *  高敏动作(确认 + 理由 + 审计 + 失败态),endpoint 形态
   *  POST /api/admin/deposits/bank-intents/:id/resolve { action: "credit"|"return", reason };client 无入口。 */
  function _devResolveBankMismatch(intentId: string, resolution: "credit" | "return"): boolean {
    if (import.meta.env.PROD) return false;
    const intent = intents.value.find((i) => i.intentId === intentId);
    if (!intent || intent.status !== "mismatch_review") return false;
    if (resolution === "return") return patchIntent(intentId, { status: "return_pending" }) !== null;
    // 按实收核销:实收 VND 按本单锁定牌价折 USDT(0 费;fxRate > 0 由下单校验保证)
    const receivedVnd = intent.receivedVnd ?? intent.vndAmount;
    return settleBankIntent(intentId, receivedVnd / intent.fxRate, receivedVnd);
  }

  /** ⚠️ DEV/DEMO-ONLY(后台动作形态):过期单迟到转账人工匹配补入账(孤儿队列,
   *  [FEAT-PAY02] ④ expired → credited 边)。仅「expired 且已登记回单(bankCallback
   *  对过期单调用过)」可走,按实收 × 锁定牌价折 USDT 入账;其余拒绝(server 409 形态)。
   *  PROD:后台 D1 孤儿队列高敏动作(确认 + 理由 + 审计 + 失败态);client 无入口。 */
  function _devResolveLateBankTransfer(intentId: string): boolean {
    if (import.meta.env.PROD) return false;
    const intent = intents.value.find((i) => i.intentId === intentId);
    if (!intent || intent.status !== "expired" || !intent.receivedVnd) return false;
    return settleBankIntent(intentId, intent.receivedVnd / intent.fxRate, intent.receivedVnd);
  }

  // ════════ 卡通道(国际卡辅助轨;同步授权,无确认数推进)════════

  /** 卡支付。本函数扮演「client 提交 → 收单方 3DS 授权 → server 入账」三步:
   *  PROD = POST /api/deposits/card 提交,收单方授权后 server webhook 落库入账,
   *  client 轮询 GET /api/deposits 收敛;本层的授权模拟整体删除。
   *  返回 null = 未入账(账号已切走 / 入参越界 / 拒付 / 落盘失败),调用方展示拒付态并允许重试。
   *  🔴 副作用顺序:先落单 + persist,过了才动钱 —— 「失败」必须等于「什么都没发生」。
   *     反过来(先动钱、落盘失败再回滚单据)会让 UI 那颗重试按钮把「已扣款」变成可重复刷余额:
   *     余额加了 N 次、账单 N 条、入金单 0 条,正是本次改动要消灭的对账黑洞。
   *  🔴 幂等域:mock 只保证「一次提交内」(授权号由本次提交现铸,跨提交无从判重);
   *     跨提交幂等归 PROD 的 Idempotency-Key(收单方 + server 侧),mock 不承诺。
   *  🔴 计费方向:卡费另收在用户卡上 → gross = 实扣额、credited = 用户输入额。 */
  function submitCardPayment(creditedUsdt: number, expectedAccountKey: string): DepositRecord | null {
    // 账号守卫:授权等待期(组件侧 ~3.8s)内账号可能被切走(会话被踢/登出会 rebind 到
    // default),此时入账必须作废,否则钱记进别人账上、还白送对方入金资格进度。
    // 与两条 mock 引擎的 `const key = boundKey; … if (boundKey !== key) return;` 同形 ——
    // 差别只在这段延迟活在组件里,store 够不着,故由调用方捕获并回传。
    if (expectedAccountKey !== boundKey) return null;
    const credited = +creditedUsdt.toFixed(2);
    // 信任边界:金额来自输入框,NaN/±Infinity/越界一律拒(server 422 形态)
    if (!Number.isFinite(credited)) return null;
    if (credited < MIN_CARD_DEPOSIT_USDT || credited > MAX_CARD_DEPOSIT_USDT) return null;
    // ⚠️ MOCK-ONLY:扮演收单方 3DS 授权。PROD:收单方回调带真实授权结果。
    if (Math.random() < CARD_DECLINE_RATE) return null;
    let authCode = mockCardAuthCode();
    // 同 mintDepositId:重摇设上界,避免号段占满/随机源异常时死循环转死页面。
    for (let i = 0; i < 50 && isDuplicateAuthCode(records.value, authCode); i++) {
      authCode = mockCardAuthCode();
    }
    if (isDuplicateAuthCode(records.value, authCode)) return null; // 摇不出新号:拒绝入账,不冒重复风险
    const now = mockServerNow();
    const rec: DepositRecord = {
      depositId: mintDepositId(now),
      channel: "card-intl",
      grossAmountUsdt: cardChargeUsd(credited),
      feeUsdt: cardFeeUsd(credited),
      creditedUsdt: credited,
      authCode,
      status: "credited",
      createdAt: now,
      creditedAt: now,
    };
    // ① 先落单 + 落盘:此刻零跨 store 副作用,失败即干净返回,用户重试安全。
    const previous = records.value;
    records.value = [rec, ...records.value];
    if (!persist()) {
      records.value = previous;
      return null;
    }
    // ② 落盘过了才动钱。credited 已过 [MIN, MAX] 双门,recordDeposit 只拒 NaN/≤0/>1e9,
    //    此处恒真;万一失败则回滚单据,宁可「无单无钱」也不留「有单无钱」。
    if (!useApp().recordDeposit(credited)) {
      records.value = previous;
      persist();
      return null;
    }
    useBills().addOnce({
      type: "topup",
      symbol: "USDT",
      amount: credited,
      status: "posted",
      memo: `Top-up · ${CHANNEL_MEMO["card-intl"]}`,
      ref: authCode,
    });
    return rec;
  }

  // 启动即收敛一次(挂载账号的在途单:过期落 expired / 未过期重新武装定时器)。
  syncBankIntents();

  // tester 驱动通道:DEV 挂 globalThis.__nxDev(PROD 不挂 —— guard 双层之外层)。
  // store 在 rebindAccountScopedStores(App 启动恢复/login/register)首次实例化时挂上。
  if (!import.meta.env.PROD) {
    const g = globalThis as unknown as { __nxDev?: Record<string, unknown> };
    g.__nxDev = {
      ...(g.__nxDev ?? {}),
      simulateIncomingTransfer: _devSimulateIncomingTransfer,
      resolveDustHold: _devResolveDustHold,
      setChannelEnabled: _devSetChannelEnabled,
      bankCallback: _devBankCallback,
      bankExpire: _devBankExpire,
      resolveBankMismatch: _devResolveBankMismatch,
      resolveLateBankTransfer: _devResolveLateBankTransfer,
      setBankAccountEnabled: _devSetBankAccountEnabled,
    };
  }

  return {
    records,
    intents,
    chainChannelEnabled,
    bankAccounts,
    bankRailAvailable,
    bindAccount,
    depositAddress,
    currentAccountKey,
    createBankIntent,
    cancelBankIntent,
    submitCardPayment,
    _devSimulateIncomingTransfer,
    _devResolveDustHold,
    _devSetChannelEnabled,
    _devBankCallback,
    _devBankExpire,
    _devResolveBankMismatch,
    _devResolveLateBankTransfer,
    _devSetBankAccountEnabled,
  };
});
