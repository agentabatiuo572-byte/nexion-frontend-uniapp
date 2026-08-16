# 结算「可取消/可中断 + 30 分钟待支付浮动条」· Change Proposal

- **工作线**:④ uniapp(pkg/ad-checkout-cancel)
- **日期**:2026-08-16
- **状态**:Aligned(第一包 4 项 + 第二包 3 拍板项主人 2026-08-16 均按推荐批准)→ 待 Shipped
- **定级**:M(2 包 · 6-8 文件 · 不改产品规则;钱相关 → 子任务敏感级,tester 外加 code-review)

## Why
结算支付流程一旦进入扫码页就「下不来」:`chain-payment.vue` 12 秒定时器自动模拟到账把用户推进扣款(取消按钮寿命 12 秒);等待/激活屏零出口;选支付步无显式取消。此外从扫码页返回 = 会话蒸发 —— 若用户已按地址转账,这笔钱在产品层没有归属(孤儿资金)。生产级定调后这不是演示瑕疵,是资金安全缺口。

## P1-a 既有裁决搜索
已搜 `待支付|浮动条|PENDING_PAYMENT|abandon|取消订单|checkout` 于 `docs/changes/`(含 out-of-scope)、`PORT-PITFALLS`、更新日志:**无既有否决**。相关事实:2026-08-16 commerce sandbox 验收——远端订单已服务端持久(`PENDING_PAYMENT`),远端 awaiting 只轮询 canonicalStatus,ChainPayment 是纯 mock 腿;服务端订单契约**无付款截止字段**(客户端不得凭空造远端倒计时,见「诚实边界」)。

## What changes
**第一包(已批)**
1. 删 `chain-payment.vue` 12 秒自动到账定时器(保留 30 分倒计时、「我已完成付款」、取消)。
2. select-payment 步主按钮下加 ghost 弱化「取消」→ 商品详情(转化场景 Cancel 权重必须弱)。
3. awaiting / activating 屏加 `v-if="orderId"` 的「查看订单」出口(数据驱动,不按 mock/remote 分支)。
4. confirm 步不加第三按钮(主人拍板)。

**第二包(2026-08-16 拍板:整包做 · 返回不弹确认框 · 撞旧会话确认框二选一)**
5. **待支付会话 store**(`store/pending-checkout.ts` + 纯逻辑 `pending-checkout-core.ts`):进扫码步建会话 `{id, kind:'purchase', productId, method, amountUsdt, address, createdAt, expiresAt, quote 快照, leftNoticeShown}`;按账号分行持久(`nexgrid-pending-checkout-accounts-v1`,列表形,单一 live);地址 = `deriveDepositAddress(session.id, method)` 每单专属;远端模式(`fundsServerEnabled`)拒建(不造假地址)。
6. **后退语义**:扫码页/等待页离开 → 会话静默保留 + 一次性 toast「订单已为你保留 30 分钟」;不弹确认框。
7. **浮动条** `components/pending-checkout-bar.vue` 挂 app-chassis overlays:「待支付 $X · mm:ss · 继续支付」;点击 → 同一笔(同地址 + 连续倒计时);正在展示该会话的结算页上不显示;完成/取消/超时消失;账号隔离;刷新存活。
8. **超时态**:倒计时归零 → 扫码页进「支付已超时」态(地址不再展示、无法推进),唯一出口「重新下单」→ 回 confirm 步(重新报价再建新会话);浮动条同时消失。
9. **撞旧会话**:已有 live 会话又点「Pay now」→ 确认框:「放弃它,开始新的」(danger,confirm)/「继续那一笔」(ghost,cancel;点遮罩=继续旧的,安全默认);继续旧的 = 同商品原地恢复,异商品 `redirectTo` 旧商品结算页 `?resume=<id>`。
10. **显式「取消」**(扫码页原按钮):加确认框「取消这笔支付?若已转账请勿取消」— 判断项,主人未议,可否决。
- **Out of scope**:卡支付腿不建会话(即时表单,无在途资金);远端模式浮动条(服务端无付款截止字段,待后端补 `paymentDeadline` 后由服务端订单驱动,见 HANDOFF);多笔并存 UI;confirm 步第三按钮;30 分钟窗改后台可配。

## Impact
- **页面**:`pages/store/checkout.vue`(A/B/E 接线 + `?resume=`)· 组件 `store/chain-payment.vue`(props 改 `session`,去本地地址/去 12s)· `app-chassis.vue`(挂浮动条)· 新 `pending-checkout-bar.vue`
- **Store**:新 `store/pending-checkout.ts` + `pending-checkout-core.ts`;`lib/account-scope.ts` 加一行 rebind —— 🔴 backend-replaceable(结构 = 服务端 PENDING_PAYMENT 订单 + 支付指令;远端替换 hydrate 为 GET,`begin` 为 POST /api/orders 已有路径)
- **i18n**:`store.pending*` 约 12 key,en/vi/zh 同序,`node scripts/i18n-key-mirror.mjs`
- **设计**:浮动条走 chrome 玻璃语言(`--v5-chrome-bg` + `--v5-glass-border` + `--v5-glass-shadow` + blur),字号 12.5/13.5,tap ≥ 44,ghost 取消 ink-3;确认框走 `store/ui` `confirm()`(danger 映射到破坏性选项,遮罩=安全默认)
- **PRD**:§7 商城结账流(结账状态机 + 待支付会话/浮动条/超时/撞单规则)
- **不变量风险**:三语镜像 · 账号隔离(per-user 字段按账号作用域)· 时间只用 `mockServerNow()` · 显示的钱指到单源(会话 amount = 确认页快照)· 禁页面开模式分支 · 0 meta 文案 · 焦虑词门

## Done-when(7 条验收判据,P6 逐条回测)
- [ ] ① 扫码页停 60s 不自行推进、不扣款(余额不变、无订单)。
- [ ] ② 从扫码页返回:一次性 toast 出现;浮动条出现且倒计时递减;切 tab / 刷新页面浮动条仍在。
- [ ] ③ 点浮动条回到同一笔:地址与离开前一致、倒计时连续(非重置 30:00)。
- [ ] ④ 「取消」(确认后)/ 完成购买 → 浮动条立即消失。
- [ ] ⑤ 倒计时归零 → 扫码页进超时态、旧地址不再展示、无法「我已完成付款」;浮动条消失。
- [ ] ⑥ 换账号:A 的待支付不出现在 B;切回 A 仍在。
- [ ] ⑦ 完整购买路径(select → confirm → 扫码 → 我已完成付款 → confirmed 扣款建单 → live)与现状一致;远端 sandbox 路径不受影响(不建会话、无浮动条)。

## 实施拆解(M 级内联)
| # | 子任务 | 范围文件 | AC | 敏感 | tester 报告 |
|---|---|---|---|---|---|
| T1 | 核心 store + 纯逻辑 + vitest | `store/pending-checkout-core.ts` · `store/pending-checkout.ts` · `lib/account-scope.ts` · `pending-checkout-core.test.ts` | isLive/prune/secondsLeft 纯函数测试绿;begin 远端拒建;账号 rebind 换行 | 钱 | (机器门 + code-review) |
| T2 | 第一包 A/B/C + chain-payment 改造 + 结算页接线(begin/resume/leave/complete/abandon/collision/expired) | `chain-payment.vue` · `checkout.vue` | 判据 ①③④⑤⑦ | 钱/状态机 | `…-t2-test.md` |
| T3 | 浮动条组件 + chassis 挂载 + i18n 三语 | `pending-checkout-bar.vue` · `app-chassis.vue` · `i18n/messages/{en,vi,zh}.ts` | 判据 ②③⑥;i18n mirror 绿;9 档字号/token 自检 | UI | `…-t3-test.md` |
| T4 | 全套门:tsc · verify.sh(5399)· 独立 tester 7 判据实景 · code-review · nexion-audit · done-review · PRD/更新日志/HANDOFF | — | 全绿 + P0=P1=0 | — | audit 报告 |

## 诚实边界
- 远端模式:ChainPayment 不可达(remote 走 submitRemoteOrder→awaiting 轮询),故会话 store 在远端**不建行也不读行**;浮动条在远端不出现——因为服务端订单契约没有付款截止字段,客户端不得自造 30 分钟并宣称过期。后端补 `paymentDeadline` + 支付指令后,由订单列表驱动同一组件(已在 HANDOFF 登记)。
- 30 分钟窗口 = `PENDING_CHECKOUT_WINDOW_MIN` 单一常量(mock 侧「服务端」);PROD 由服务端下发。
