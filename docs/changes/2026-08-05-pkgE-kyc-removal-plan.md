# 包 E · 删 KYC + 提现地址直管 — 实施拆解

> 规格:`PRD/specs/FEAT-KYC-RM01-remove-kyc-and-pairing.md`(**Signed**,主人 2026-07-31 签字)
> 定级 **L** · 本文是规格要求的「实施拆解」,**待主人签字后才进实现**。
> 规格硬性前置:「实现线**必须先产全量引用清单**(六类逐文件列出,基线 34+ 文件)再动手,**删一类验一类**」。

---

## 一、全量引用清单(2026-08-05 实测,**53 个文件** > 规格基线 34)

| 类 | 数量 | 文件 |
|---|---|---|
| ① 页面 | **11** | `me/kyc.vue`(本体)· `me/me.vue` · `me/security.vue` · `me/support-tickets.vue` · `me/wallet-address-rebind.vue` · `me/wallet-bills.vue` · `me/wallet-exchange.vue` · `me/wallet-topup.vue` · `me/wallet-withdraw.vue` · `store/detail.vue` · `trust/trust.vue` |
| ② 组件 | **9** | `me/verify-row.vue` · `me/profile-row.vue` · `me/complete-row.vue` · `me/receipt-modal.vue` · `me/bill-type-icon.vue` · `genesis/purchase-sheet.vue` · `app-chassis.vue` · `captcha-slider.vue` · `sticky-cta-bar.vue` |
| ③ store/lib/composable/mock | **15** | `store/wallet-pairing.ts` · `store/wallet-pairing-core.ts` · `store/exchange-v3.ts` · `store/bills.ts` · `store/types.ts` · `store/sticky-cta-bar.ts` · `lib/account-scope.ts` · `lib/header-title.ts` · `lib/workload-label.ts` · `composables/use-device-eligibility.ts` · `mock/eligibility.ts` · `mock/faq.ts` · `mock/receipt.ts` · `mock/tickets.ts` · `mock/tradein-config.ts` |
| ④ 路由 | 1 | `pages.json`(`pages/me/kyc` 注册项) |
| ⑤ 文案 | 三语各 **59-63 行** | 含整个 `kycExpress` 命名空间 + `kyc: "实名认证"` / `kycVerified` / `kycPending` 等 |
| ⑥ 脚本哨兵 | **17** | 见下节分类 |

---

## 二、🔴 最险的一处:哨兵会在删机制后**静默变绿**

17 个哨兵按「删了 KYC 会怎样」分类:

| 分类 | 数量 | 处置 |
|---|---|---|
| 🔴 **判据依赖被删对象** | **2** | 见下,必须**先改判据** |
| ✅ 假阳性 | 1 | `selfcheck-checkout-trial-quote.mjs` 命中的是「大括号不**配对**」,与钱包配对无关 |
| ✅ 只在注释/文案里提到 | 14 | 改注释即可,不影响判定 |

**两个真依赖的**:

1. **`selfcheck-rebind.mjs`** — 整个文件的被测对象就是 `store/wallet-pairing-core.ts`。
   删了该文件 → 哨兵 `readFileSync` **直接抛错**。抛错比空转好,但仍需重写为「地址管理」的新判据。
2. 🔴 **`selfcheck-fastlane.mjs`** — **最危险**。它断言提现快车道要检查
   `wallet-pairing.ts` 里的在途提现闸(`pairingSrc.includes("useApp().inFlightWithdrawals.length > 0")`),
   还有一处文件清单硬编码了两个配对文件。删了 store → **扫不到 → 判定「没有违规」→ 静默变绿**。

**因此动手顺序必须反过来**:

```
先改哨兵判据(指向新的地址管理机制)
  → 再删机制
  → 每删一类,立刻验哨兵**还会不会红**(红测,不是看它绿)
```

绝不能「先删完再修哨兵」—— 中间那段窗口里全部哨兵都是假绿。

---

## 三、子任务拆解(每个 ≤1 个上下文,tester pass 才许打勾)

| # | 子任务 | 交付 | 独立验收判据 |
|---|---|---|---|
| E-0 | **哨兵改判据前置**:`selfcheck-rebind` / `selfcheck-fastlane` 判据从「配对 store」改指「地址管理」 | 2 个脚本 | 🔴 **红测**:把新机制的关键行摘掉,两个哨兵必须转红;删除旧 store 后仍能正常判定 |
| E-1 | 提现地址直管数据模型 + store(`payoutAddress[network]`:current/history/freezeUntil/nextChangeAt) | 新 store + 类型 | 行为固定靶:首次添加 / 更换 / 在途单拦截 / 7 天频控 / 24h 冻结 / **换号不继承** |
| E-2 | 存量迁移:已配对地址 → `source:"migrated"`,无保护期无需重验 | 迁移函数 + 门 | 🔴 固定靶:老数据进入新版后**地址仍在且可直接提现**;迁移失败**不得**静默变成空地址 |
| E-3 | 提现页 / 地址管理页改造(空态引导、掩码展示、冻结横幅倒计时) | 2 页 | 实景:未设地址 → 引导卡(不是拦截横幅);冻结中 → 倒计时且提交禁用 |
| E-4 | 删 KYC 机制:验证页 + 路由 + 充值页验证分支 + 兑换 $100 门 + 资格规则里的认证条件 | 11 页 + 15 store | 🔴 `?kyc` 深链**不得 404/白屏**;资格其余条件**不放宽** |
| E-5 | 文案三语同删同改;账单类型 `kyc` 值保留但标签中性化 | i18n ×3 | 键镜像门全绿;历史账单**仍可查且看得懂** |
| E-6 | 收口 grep:KYC / 实名 / 认证供应商名 / `?kyc` 全站残留 = **0**(历史数据字段与账单类型值白名单显式列出) | 收口报告 | 🔴 **计数必须打进汇报**,不打数字的「已清干净」一律当未验证 |

---

## 四、待主人拍板

1. **E-0 前置是否认可**?(先改哨兵再删机制,比常规顺序多一轮,但避免整段假绿窗口)
2. **在途 $1 的处置**:规格说「已侦测到的照常返还入余额,未侦测到的给客服入口」——
   mock 期没有真链上侦测,是否按「一律返还」实现并在注释里标明真后台差异?
3. 包 E 与包 G 的**先后**:两者都要动提现页 / 首页,是否串行做以免交织?

---

## 五、本文件的由来

规格 §⑦ 要求「实现线必须先产全量引用清单再动手」。本文是该清单 + 风险面分析 + 拆解,
**尚未动任何代码**(实测:`src/pages/me/kyc.vue` 仍在,`pages.json` 仍注册该路由)。
