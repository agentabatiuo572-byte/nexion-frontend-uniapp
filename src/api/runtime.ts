import { createAccountApi } from "./account-api";
import { createUniHttpTransport } from "./api-client";
import { createAuthApi } from "./auth-api";
import { createPaymentApi } from "./payment-api";
import { createProductCatalogApi } from "./product-catalog-api";
import { createWithdrawalApi } from "./withdrawal-api";
import { createEarnConfigApi } from "./earn-config-api";
import { createDeviceE3Api } from "./device-e3-api";
import { createOrderApi } from "./order-api";
import { createPlatformConfigApi } from "./platform-config-api";
import { createVRankApi } from "./v-rank-api";
import { createCommissionConfigApi } from "./commission-config-api";
import { createStakingApi } from "./staking-api";
import { createExchangeApi } from "./exchange-api";
import { createMarketApi } from "./market-api";
import { createGenesisApi } from "./genesis-api";
import { createRepurchaseApi } from "./repurchase-api";
import { createRiskDisclosureApi } from "./risk-disclosure-api";
import { createPayoutAddressApi } from "./payout-address-api";
// 注:trial-api 未随本批搬入 —— 它写于 2026-07-24,契约仍是「卡时代」试用机模型
// (自动续费 / 提前赎回 / 延期三组字段),主线已在 FEAT-TRIAL02 改为无卡试用机,
// 并焊了哨兵防该模型复活(哨兵按字段名匹配且不剥注释,故此处不列原字段名)。
// 要接试用机后端须按现行无卡模型重写该 api。
import { createQuestApi } from "./quest-api";
import { createEventsApi } from "./events-api";
import { createPointsApi } from "./points-api";
import { createVoucherApi } from "./voucher-api";
import { createContentCopyApi } from "./content-copy-api";
import { createNotificationApi } from "./notification-api";
import { createTrustSectionApi } from "./trust-section-api";
import { createI18nApi } from "./i18n-api";
import { createJanusApi } from "./janus-api";
import { createBehaviorAnalyticsApi } from "./behavior-analytics-api";
import { readApiRuntimeConfig } from "./runtime-config";
import { createRuntimeApiClient } from "./runtime-client";
import { createRuntimeSessionVault } from "./session-vault";

export const apiRuntimeConfig = readApiRuntimeConfig();
export const remoteApiEnabled = apiRuntimeConfig.mode === "remote";
export const sessionVault = createRuntimeSessionVault();
let unauthorizedHandler: (() => void | Promise<void>) | undefined;

function isLoopbackSameOriginPreview(baseUrl: string): boolean {
  if (typeof window === "undefined" || window.location.origin !== baseUrl) return false;
  return window.location.protocol === "http:"
    && (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost" || window.location.hostname === "::1");
}

export const apiClient = createRuntimeApiClient({
  config: apiRuntimeConfig,
  transport: createUniHttpTransport(),
  vault: sessionVault,
  development: import.meta.env.DEV,
  localPreview: isLoopbackSameOriginPreview(apiRuntimeConfig.baseUrl),
  onUnauthorized: () => unauthorizedHandler?.(),
});
export const authApi = createAuthApi(apiClient, sessionVault);
export const accountApi = createAccountApi(apiClient);
export const paymentApi = createPaymentApi(apiClient);
export const productCatalogApi = createProductCatalogApi(apiClient);
export const withdrawalApi = createWithdrawalApi(apiClient);
export const earnConfigApi = createEarnConfigApi(apiClient);
export const deviceE3Api = createDeviceE3Api(apiClient);
export const orderApi = createOrderApi(apiClient);
export const platformConfigApi = createPlatformConfigApi(apiClient);
export const vRankApi = createVRankApi(apiClient);
export const commissionConfigApi = createCommissionConfigApi(apiClient);
export const stakingApi = createStakingApi(apiClient);
export const exchangeApi = createExchangeApi(apiClient);
export const marketApi = createMarketApi(apiClient);
export const genesisApi = createGenesisApi(apiClient);
export const repurchaseApi = createRepurchaseApi(apiClient);
export const riskDisclosureApi = createRiskDisclosureApi(apiClient);
export const payoutAddressApi = createPayoutAddressApi(apiClient);
export const questApi = createQuestApi(apiClient);
export const eventsApi = createEventsApi(apiClient);
export const pointsApi = createPointsApi(apiClient);
export const voucherApi = createVoucherApi(apiClient);
export const contentCopyApi = createContentCopyApi(apiClient);
export const notificationApi = createNotificationApi(apiClient);
export const trustSectionApi = createTrustSectionApi(apiClient);
export const i18nApi = createI18nApi(apiClient);
export const janusApi = createJanusApi(apiClient);
export const behaviorAnalyticsApi = createBehaviorAnalyticsApi(apiClient);

export function setRemoteUnauthorizedHandler(handler: (() => void | Promise<void>) | undefined): void {
  unauthorizedHandler = handler;
}
