import { computed, nextTick, onScopeDispose, ref, watch } from "vue";
import { formatAmount } from "@/lib/amount-display";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { deviceName } from "@/lib/device-copy";
import { canControlDevice } from "@/lib/device-control-platform";
import { useApp } from "@/store/app";
import { useTradeinSheet } from "@/store/tradein-sheet";
import { PRODUCTS } from "@/mock/products";
import { computeTradeInCredit, TRADEIN_LADDER_RULES, DEFAULT_TRADEIN_CONFIG } from "@/mock/tradein-config";
import { isDeviceTaskBlocked } from "@/mock/eligibility";
import { getMonthsSince, isTradeInTargetAvailable } from "@/store/product-phase";
import { useProductPhase } from "@/composables/use-product-phase";
import type { Device } from "@/store/types";
import { apiRuntimeConfig, deviceE3Api, remoteApiEnabled } from "@/api/runtime";
import type { CanonicalTradeinQuote } from "@/api/device-e3-api";
import { captureAccountScope, isCurrentAccountScope } from "@/lib/account-scope";
import { isProductAvailable } from "@/store/product-availability";
import { productCatalogState, refreshProductCatalog } from "@/store/product-catalog";
import { originalCapacityCheckoutHref } from "@/components/checkout/checkout-keep-resume";
import { navTo } from "@/lib/route";
import { confirm } from "@/store/ui";

// ── FEAT-DEV02 升级置换条 ──────────────────────────────────────────────
// 设备仓库行与赚取页设备操作面板共用同一资格判定与 retire 入口。
// 总开关关 / 免费设备(paidPriceUsdt=0)/ Cloud Share → 返回空对象 =
// 零痕迹；无合规目标也不显示入口，其余给「可抵 $X」chip + 置换 CTA。
// 预览采用最低价合资格目标的实际报价；进入结算后重新确认最终报价。
// `enabled` 为 false 时不读远端资格(操作面板只在打开时读取)。
export function useTradeinStrip(enabled: () => boolean = () => true) {
  const t = useT();
  const app = useApp();
  const tradeinSheet = useTradeinSheet();
  // 上架节奏门(FEAT-DEV02b):未正式上架且不在抢先购窗口的 SKU 不算升级目标。
  const phase = useProductPhase();
  const monthsSinceJoin = computed(() => getMonthsSince(app.user.joinedAt));
  const remoteEligibilityRows = ref(new Map<number, {
    sourceKey: string; request: number; target: string; price: number;
    quote?: Pick<CanonicalTradeinQuote, "discountUsdt" | "outputRatioPct" | "creditRatePct"> | null;
    quoteRequest: number; earnings: number | undefined;
    account: ReturnType<typeof captureAccountScope>; context: string;
  }>());
  let remoteEligibilityRequest = 0;
  let remoteEligibilityContext = "";
  let remoteEligibilityMounted = true;

  function remoteEligibilitySourceKey(device: Device): string {
    return JSON.stringify([device.id, device.rowVersion, device.kind, device.productCode,
      device.activatedAt, device.activationUnconfirmed, device.pendingDeactivate,
      Boolean(device.currentTask), device.paidPriceUsdt]);
  }
  function remoteEligibilityContextKey(): string {
    return JSON.stringify([app.accountKey, app.accountBindingEpoch, apiRuntimeConfig.environment,
      apiRuntimeConfig.baseUrl, productCatalogState.status, productCatalogState.revision, phase.value]);
  }
  function remoteEligibilityRowCurrent(id: number, row: NonNullable<ReturnType<typeof remoteEligibilityRows.value.get>>): boolean {
    const device = app.devices.find(device => Number(device.id) === id);
    return remoteEligibilityMounted && enabled() && isCurrentAccountScope(row.account)
      && row.context === remoteEligibilityContextKey() && productCatalogState.status === "ready"
      && remoteEligibilityRows.value.get(id)?.request === row.request
      && !!device && row.sourceKey === remoteEligibilitySourceKey(device);
  }
  async function refreshRemoteTradeinQuote(id: number): Promise<void> {
    const row = remoteEligibilityRows.value.get(id);
    if (!row?.target || !remoteEligibilityRowCurrent(id, row)) return;
    const device = app.devices.find(device => Number(device.id) === id)!;
    const version = device.rowVersion;
    row.earnings = device.cumulativeEarningsUsdt;
    row.quote = undefined;
    const request = ++row.quoteRequest;
    const target = row.target;
    const current = () => remoteEligibilityRowCurrent(id, row) && request === row.quoteRequest && target === row.target;
    try {
      const quote = await deviceE3Api.quote(id, target);
      if (!current()) return;
      const { discountUsdt, outputRatioPct, creditRatePct } = quote;
      const matches = quote.sourceDeviceId === id && quote.targetProductNo === target && quote.sourceRowVersion === version;
      row.quote = matches ? { discountUsdt, outputRatioPct, creditRatePct } : null;
    } catch {
      if (current()) row.quote = null;
    }
  }
  async function refreshRemoteTradeinEligibility(sourceIds = app.devices.map(device => Number(device.id))): Promise<void> {
    if (!remoteApiEnabled || !enabled() || !remoteEligibilityMounted || sourceIds.length === 0) return;
    const request = ++remoteEligibilityRequest;
    const account = captureAccountScope();
    const context = remoteEligibilityContextKey();
    for (const device of app.devices.filter(device => sourceIds.includes(Number(device.id)))) {
      remoteEligibilityRows.value.set(Number(device.id), { sourceKey: remoteEligibilitySourceKey(device),
        request, target: "", price: Infinity, quoteRequest: 0, earnings: device.cumulativeEarningsUsdt, account, context });
    }
    // The catalog store already shares current/in-flight reads for this account and environment.
    if (!(await refreshProductCatalog())) return;
    const rows = sourceIds.flatMap(id => {
      const row = remoteEligibilityRows.value.get(id);
      return row?.request === request && remoteEligibilityRowCurrent(id, row) ? [{ id, row }] : [];
    });
    if (rows.length === 0) return;
    const targets = PRODUCTS.filter(product => product.productType === "DEVICE" && isProductAvailable(product, phase.value));
    await Promise.allSettled(targets.map(async product => {
      const snapshot = await deviceE3Api.eligibility(product.id);
      if (!snapshot.enabled || !snapshot.eligible || snapshot.targetProductNo !== product.id) return;
      await Promise.allSettled(rows.map(async ({ id, row }) => {
        if (!remoteEligibilityRowCurrent(id, row) || !snapshot.sources.some(source => source.sourceDeviceId === id && source.eligible)
            || row.target && (snapshot.targetPriceUsdt ?? Infinity) >= row.price) return;
        // Publish this row immediately; a cheaper authorized target may replace its preview later.
        row.target = product.id;
        row.price = snapshot.targetPriceUsdt ?? Infinity;
        await refreshRemoteTradeinQuote(id);
      }));
    }));
  }

  watch(
    () => enabled() && JSON.stringify([remoteEligibilityContextKey(), app.devices.map(remoteEligibilitySourceKey)]),
    (value, _previous, onCleanup) => {
      let current = true;
      onCleanup(() => { current = false; });
      const context = remoteEligibilityContextKey();
      if (!value || context !== remoteEligibilityContext) remoteEligibilityRows.value = new Map();
      remoteEligibilityContext = context;
      if (!value || !remoteApiEnabled) return;
      const devices = new Map(app.devices.map(device => [Number(device.id), device]));
      for (const [id, row] of remoteEligibilityRows.value) {
        const device = devices.get(id);
        if (!device || row.sourceKey !== remoteEligibilitySourceKey(device)) remoteEligibilityRows.value.delete(id);
      }
      // Account bindings finish synchronously after app.bindAccount; read in the next tick.
      void nextTick(() => {
        if (current) return refreshRemoteTradeinEligibility([...devices.keys()].filter(id => !remoteEligibilityRows.value.has(id)));
      });
    },
    { immediate: true, flush: "sync" },
  );
  watch(() => enabled() && app.devices.map(device => [device.id, device.cumulativeEarningsUsdt]), () => {
    if (!remoteApiEnabled) return;
    for (const device of app.devices) {
      const row = remoteEligibilityRows.value.get(Number(device.id));
      if (row?.target && row.earnings !== device.cumulativeEarningsUsdt) void refreshRemoteTradeinQuote(Number(device.id));
    }
  }, { flush: "sync" });
  onScopeDispose(() => { remoteEligibilityMounted = false; remoteEligibilityRows.value = new Map(); });

  function tradeinStrip(d: Device): {
    tradeinCreditText?: string;
    tradeinQuoteAmount?: number;
    tradeinCtaLabel?: string;
    tradeinDisabledText?: string;
  } {
    if (remoteApiEnabled) {
      const row = remoteEligibilityRows.value.get(Number(d.id));
      if (!row?.target || !remoteEligibilityRowCurrent(Number(d.id), row)) return {};
      return {
        tradeinCtaLabel: t.value.tradein.stripCta,
        tradeinCreditText: t.value.tradein.remoteQuoteCreditLabel,
        tradeinQuoteAmount: row.quote?.discountUsdt,
      };
    }
    if (!DEFAULT_TRADEIN_CONFIG.enabled) return {};
    const paid = d.paidPriceUsdt ?? 0;
    if (paid <= 0 || d.kind === "cloud-share") return {};
    const targets = PRODUCTS.filter(
      (p) =>
        p.productType === "DEVICE" && (!TRADEIN_LADDER_RULES.requireHigherPrice || p.price > paid) &&
        isTradeInTargetAvailable(p.unlocksAtPhase, phase.value, monthsSinceJoin.value),
    );
    if (targets.length === 0) return {};
    const credit = computeTradeInCredit(
      paid,
      Math.max(0, d.cumulativeEarningsUsdt ?? 0),
      Math.min(...targets.map((p) => p.price)),
    );
    return {
      tradeinCreditText: fmt(t.value.tradein.stripCredit, { credit: formatAmount(credit) }),
      tradeinQuoteAmount: credit,
      tradeinCtaLabel: t.value.tradein.stripCta,
    };
  }

  function handleTradein(d: Device) {
    if (!canControlDevice(d)) return;
    try {
      const href = originalCapacityCheckoutHref(app.accountKey);
      if (href) { void navTo(href); return; }
    } catch {
      // The result of the user's own earlier purchase is unknown (03 §3.5.1 决定): a centred confirm whose way out is the
      // orders list; it does not continue the purchase.
      void confirm({ title: t.value.tradein.recoveryUnreadableTitle, message: t.value.tradein.recoveryUnreadableBody, icon: "warn",
        confirmLabel: t.value.tradein.recoveryViewOrders, cancelLabel: t.value.tradein.sheetCancel })
        .then(view => { if (view) void navTo("/pages/store/orders"); });
      return;
    }
    // 激活中且任务运行:阻断层(完成后可下架,查看任务/知道了),不硬拆(规格
    // DEV02A 异常2)。库存机的出厂任务不在跑,不阻断——判定单源 isDeviceTaskBlocked。
    if (!remoteApiEnabled && isDeviceTaskBlocked(d)) {
      tradeinSheet.showRetireBlock(d.id, deviceName(t.value, d));
      return;
    }
    tradeinSheet.showRetire(d.id);
  }

  function tradeinQuote(deviceId: string) {
    const id = Number(deviceId);
    const row = remoteEligibilityRows.value.get(id);
    return row?.target && remoteEligibilityRowCurrent(id, row) ? row.quote : undefined;
  }

  return { tradeinStrip, handleTradein, refreshRemoteTradeinEligibility, tradeinQuote, refreshRemoteTradeinQuote };
}
