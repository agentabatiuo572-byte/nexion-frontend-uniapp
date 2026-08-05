import type { PlatformConfig } from "@/store/config-types";
import { GPU_TIERS } from "@/lib/gpu-tiers";
import { FLEET_DEVICES } from "@/lib/platform-stats";

// MOCK-ONLY seed for platform config / feature flags (backend-replaceable).
// Future PROD `GET /api/config/platform` returns this shape by projecting each
// domain's existing source (E/K/H3). The client treats the response as read-only;
// this repo currently has no admin-to-client transport.
export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  featureFlags: {
    // DR-1: 电脑算力默认 OFF。
    computeShareEnabled: false,
    // FEAT-HOME02 mock projections. PROD derives these from the existing H3
    // day-one task statuses and promo-banner status; client remains read-only.
    homeNewcomerTasksEnabled: true,
    homeWeeklyPromoEnabled: true,
  },
  // FEAT-HOME02 对外公布数据 mock seed(后台 H 域「对外公布数据」卡权威可配)。
  // 🔴 fleetDevices 是**平台舰队规模锚**,`lib/platform-stats.ts` 从这里取值再派生
  //   公布日产 / 每秒支付流 / 累计支付;各页禁止另存一份(platform_stats_anchor 哨兵守着)。
  // 🔴 virtualUserCount 与 hashratePercentileTable 只进排名分母与百分位映射,
  //   **永不外露到用户可见的任何地方**(产品内 0 元层)。
  publicStats: {
    // 🔴 **不在这里重写舰队规模的字面量** —— 那个数只许出现在 lib/platform-stats.ts(锚文件);
    //   在这抄一份就是把单源变双源,两处早晚分叉。哨兵 platform_stats_anchor 守这条,
    //   它刚刚把我抄的那份抓了出来(连**注释里写出那个数**也算违例,因为它扫全文)。
    //   运行期真值以本配置为准,种子值取自锚。
    fleetDevices: FLEET_DEVICES,
    onlineRatePct: 100,
    onlineJitter: 24,
    registeredUsersBase: 1_420_000,
    registeredUsersMonthlyGrowthPct: 2.9,
    // 锚点固定为常量而非 Date.now():store 顶层取当前时刻会让「同一份种子在不同时刻
    // 产生不同派生值」,首屏与刷新后对不上。运营改基数时由后台写入新锚点。
    registeredUsersAnchorAt: Date.UTC(2026, 7, 1),
    virtualUserCount: 12_000,
    // 分位表种子:tops 严格升序、cumPct 单调不减且 ≤100。最高档刻意停在 99.9 ——
    // 超表顶封顶在最高档,永远给不出「第 1 名」那种不可信结果(规格 异常5)。
    // 🔴 2026-08-05 扩档(台账 P1-3):旧表最高档 150 TOPS,任何持有托管硬件的账号
    //   (2,640~52,800+ TOPS)全部撞 96% 封顶 → 名次钉死同一个数,「加算力看到排名前进」
    //   对所有付费账号失效。现覆盖到最大合理舰队(10 台顶配机架 ≈ 53,000 TOPS)。
    // 形状:虚拟人口大头在低算力(96% 在 150 TOPS 以下 = 手机用户),硬件持有者是头部
    //   4%,尾部逐档稀疏(每 TOPS 密度单调下降)。前 4 档保持原值不动,手机档名次不漂移。
    // 门:8 档参考舰队名次互不相同且随算力严格前进 —— selfcheck-account-hashrate.mjs
    //   固定靶,舰队算力用 lib/account-hashrate 真模块现算。
    hashratePercentileTable: [
      { tops: 5, cumPct: 20 },
      { tops: 20, cumPct: 55 },
      { tops: 60, cumPct: 82 },
      { tops: 150, cumPct: 96 },
      { tops: 700, cumPct: 97.6 },
      { tops: 2_700, cumPct: 98.7 },
      { tops: 5_400, cumPct: 99.3 },
      { tops: 11_000, cumPct: 99.6 },
      { tops: 27_000, cumPct: 99.8 },
      { tops: 53_000, cumPct: 99.9 },
    ],
  },
  // SPEC-1 在线加成系数(单一来源:lib/hashpower.ts 派生 H5_BASE_FACTOR / CONTINUITY_FULL_MS)。
  // 与 admin compute-config COMPUTE_COEFFICIENTS 同 key,运营在 E6 调,PROD 由服务端下发。
  onlineBonus: {
    h5BaseFactor: 0.6,
    continuityFullHours: 2,
  },
  // SPEC-7 mock seed only. PROD: server/admin owns these values; client must
  // not bake any of them into registration, settlement, or withdrawal logic.
  riskCluster: {
    freePhoneSlotsPerCluster: 1,
    duplicateAccountPendingFrom: 2,
    duplicateAccountFreezeFrom: 4,
    pendingReleaseHours: 72,
    appAttestationReleaseHours: 2,
    maxSignupPerIp24h: 3,
    maxAccountsPerDevice: 2,
    // ↓ 口径 = 后台 PRD K1③(同支付工具 ≤2 / 冻结建议线 0.7),与 admin RISK_CLUSTER_PARAMS
    //   defaultVal 同源;值漂移由 verify.sh「SPEC-7 param value parity」哨兵拦。
    //   (2026-07-14 修正镜像抄错的 1/0.82;07-15 因整树 reset 丢失后重放,详见 memory feedback_cross_repo_value_parity)
    maxAccountsPerPaymentInstrument: 2,
    clusterFreezeSuggestThreshold: 0.7,
    releaseMode: "attest_or_manual",
    freeSlotRequiresBinding: true,
  },
  withdrawRules: {
    minWithdrawableUsdt: 20,
    sameAddressRoute: "manual",
    firstWithdrawalManual: true,
    newAddressHoldHours: 24,
    rebindCooldownDays: 7,
    // FEAT-WD01a:默认 $50(主人 2026-07-31 拍板),单源在后台 D5,此处仅 mock seed。
    smallAmountThresholdUsd: 50,
    // FEAT-WD01b:默认 1 笔/日,单源在后台 D5(dailyLimitCount),此处仅 mock seed。
    dailyWithdrawLimitCount: 1,
    // FEAT-WD01b:到账时效 24h(T+1);大额审查窗口 0 天(当前运营阶段未开)。
    // 两值单源在后台 D5,此处仅 mock seed。
    payoutSlaHours: 24,
    payoutReviewWindowDays: 0,
    // FEAT-WD02:网络确认费(每笔固定,按网络)。TRC20/BEP20 $1、ERC20 $5(链上 gas 实情),
    // 值域 [0, 25]。三键单源在后台 D5,此处仅 mock seed;与 admin-ops 契约声明逐键比值,
    // 漂移由 verify.sh「WD02 network-confirm-fee parity」哨兵拦。
    networkConfirmFeeUsd: { trc20: 1, bep20: 1, erc20: 5 },
  },
  rewards: {
    // NEX 数量原 200(≈免费 $2000 提现抵扣额度)过松,已收紧到 20;此处仅 mock seed,运营在 K 域调。
    welcomeGift: { lockMode: "risk_bucket", usdtAmount: 5, nexAmount: 20 },
    // 邀请人奖励:邀请人每邀请一名新用户得的 NEX;此处仅 mock seed,运营在 K 域调。
    inviterReward: { nexAmount: 200 },
  },
  // FEAT-AUTH01 OTP 闸门 mock seed(PRD §4.6.2/§16.2.1;运营在 K 域调)。
  otpGate: {
    resendSeconds: 60,
    captchaAfterSends: 2,
    otpTtlSeconds: 300,
    maxVerifyAttempts: 5,
    captchaTicketTtlSeconds: 120,
    // FEAT-AUTH03: 注册场景每次发码必过滑块;login/reset 维持次数阈值规则。
    captchaAlwaysScenes: ["register"],
  },
  // SPEC-7 §5b 七维权重 mock seed(K4 权威可配)。强维 0.8+,中维 0.4-0.5,弱维 ≤0.3。
  riskScore: {
    dimensionWeights: {
      serverDeviceId: 0.9,
      ipBucket: 0.8,
      withdrawAddress: 0.9,
      paymentInstrument: 0.5,
      sponsor: 0.4,
      uaFingerprint: 0.2,
      signupTiming: 0.3,
    },
    weakSignalClusterThreshold: 0.6,
  },
  // SPEC-2 M5/M6: structure mirrors admin E6 compute config. DR-7: mock-only,
  // not wired to the admin console yet; PROD server makes this authoritative.
  computeShare: {
    downloadUrl: "",
    content: {
      zhTitle: "电脑显卡算力共享",
      zhGuide: "下载桌面客户端,使用同一账号登录,连接后电脑会出现在设备仓库中。",
      enTitle: "Computer GPU share",
      enGuide: "Download the desktop client, sign in with the same account, and the computer appears in device inventory after connection.",
    },
    gpuTiers: GPU_TIERS,
  },
  // FEAT-SHARE01 分享链路 mock seed(§13.3 share.*;运营在 admin 调)。
  // baseUrl 留空 = dev 回退运行时 origin(扫码可达本机);PROD/admin 配
  // https://nexgrid.ai/ref/(F1 域名单源)。officialUrl 留空 = 官网地址占位态。
  share: {
    baseUrl: "",
    channels: [
      { key: "zalo", intentType: "scheme", androidPackage: "com.zing.zalo", iosScheme: "zalo://", enabled: true },
      { key: "telegram", intentType: "web", urlTemplate: "https://t.me/share/url?url={link}&text={text}", enabled: true },
      { key: "whatsapp", intentType: "web", urlTemplate: "https://wa.me/?text={text}", enabled: true },
      { key: "messenger", intentType: "scheme", androidPackage: "com.facebook.orca", iosScheme: "fb-messenger://", enabled: true },
      { key: "sms", intentType: "web", urlTemplate: "sms:?body={text}", enabled: true },
      { key: "x", intentType: "web", urlTemplate: "https://twitter.com/intent/tweet?text={text}", enabled: true },
      { key: "copy", intentType: "copy", enabled: true },
      { key: "poster", intentType: "poster", enabled: true },
      { key: "system", intentType: "system", enabled: true },
    ],
    appDownload: { officialUrl: "", iosUrl: "", androidUrl: "", apkUrl: "" },
  },
};
