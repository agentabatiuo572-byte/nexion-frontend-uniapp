# 收割改动审计台账(2026-08-04 · 模式 B 五层)

审计对象:本会话工作树收割落地的改动(`c1758f6` / `e3fe564` / `d4d94c5` / `b946c38` / `50a9ae5` / `d49ad84`),
重点 `src/store/deposits.ts` 三轨入金、`scripts/selfcheck-money-receipt.mjs` 合并后的判据、`scripts/lib/at-alias.mjs`。

**纪律**:报告全部收齐后才动手;每条 P0/P1 先派独立 skeptic 试图证伪,main 回源 Read 铁证才采纳。

---

## 单元1 · 入金三轨顺序与幂等(已回报:P0 3 / P1 6 / P2 7)

### P0

| # | 断言 | 依据 | 状态 |
|---|---|---|---|
| P0-1 | **账单写入不走 CAS,跨标签页整行覆盖 → 已写好的 topup 账单行被静默抹掉。** deposits 行已上 CAS,收据面没上——同一族缺陷只焊了一半 | `bills.ts:140-142`(`persist()` 用非 CAS 的 `writeAccountRow` 全量覆盖)· `bills.ts:138`(`bills.value` 只在 bind 时 hydrate)· 三轨 `deposits.ts:265/534/675` 全经此路 | 🔴 **main 已独立实测确认**(`scripts/measure-bills-crosstab-loss.mjs`:两页各写一条,磁盘只剩 `["TAB-B","seed"]`,TAB-A 被吞)。免对抗证伪 |
| P0-2 | **`recordDeposit` 失败后的状态回滚 commit 三处返回值全丢,且回滚手段与失败原因是同一层 storage** —— storage 写不进去时回滚必然同样失败。残迹:链上单永久停 `credited` 而余额没加(钱蒸发);银行意向单停 `credited` 被终态门挡住一切重试;卡轨留一张有单无钱的记录 | `deposits.ts:252-260` / `524-530` / `669-672` | 待证伪 |
| P0-3 | **`settleBankIntent` 的状态门是黑名单(只挡 `credited`),三个调用方的白名单门跑在内存** → cancelled / return_pending / expired 单可被入账,撤单意图丢失 | 唯一门 `deposits.ts:497`;对照链上白名单门 `deposits.ts:235`;调用方内存门 `552-556` / `597-598` / `611-612`;正确写法见 `cancelBankIntent:469-470` | 待证伪 |

### P1

| # | 断言 | 依据 |
|---|---|---|
| P1-1 | 记账失败时钱和状态都不回滚、返回值被丢弃、**全仓无补记路径** → 永久「钱进了账没有单」。`reconcileBills` 只自愈 withdraw/bonus,没有 topup 分支 | `deposits.ts:265-274`/`534-541`/`675-682` 返回值丢弃;`settleCredited:276` 仍 return true;`App.vue:85-138`;`topup-card-form.vue:267-269` 同时弹 error toast 与 success 屏 |
| P1-2 | `settleCredited` 失败后引擎不重排定时器 → 记录永久卡在 confirming | `deposits.ts:302-305` 不看返回值,而 `281` 已 `timers.delete` |
| P1-3 | mock 引擎 `patchRecord` 返回值全丢,`dust_hold` 分支失败即死(不重排定时器) | `deposits.ts:292` / `295` / `302` |
| P1-4 | **卡轨 ref = 每次现铸的 authCode** → 同一笔重放产生两个不同 ref、两条账单、两次入账。「三条轨 ref 同构」这条不成立 | `deposits.ts:640-645`(每次现铸)· `682`(`ref: authCode`);对照链上 `271`(txHash)与银行 `541`(intentId) |
| P1-5 | `settleBankIntent` 缺 `Number.isFinite` / 上限守卫:`NaN <= 0` 为 **false** → 放行;`fxRate===0` → Infinity 同样放行。脏值先被 CAS 写盘再靠 recordDeposit 兜 | `deposits.ts:488-489`;调用方 `602` / `613`;对照卡轨先校验后落盘 `636-637` |
| P1-6 | `_devBankCallback` 在 settle 之前就 `clearIntentTimer`,settle 失败后意向单永不过期 | `deposits.ts:567` → `576` |

### P2

| # | 断言 | 依据 |
|---|---|---|
| P2-1 | 三轨回滚写法各不同构、且都是无条件盲写(链上回写 2 字段 / 银行整对象覆盖 / 卡直接删记录),都不校验「磁盘上仍是我刚写的那个 credited」 | `deposits.ts:255` / `527` / `670` |
| P2-2 | `recordDeposit` 失败回滚是整快照回退,会一并丢弃刚合并进来的别处状态;与 `restoreMoney` 的「按增量回滚」纪律口径分叉 | `app.ts:1114-1117`;对照 `app.ts:1033-1040` |
| P2-3 | `recordDeposit` 不进 `moneyApplied` 账。**当前行为是对的**(入金不该被别处冲正抹平)但无注释钉死 → 下一个人照 `creditBalance` 补上就会让 `restoreMoney` 把入金一起退掉 | `app.ts:1102-1119`;对照 `app.ts:912-926` |
| P2-4 | 银行轨 `createdAt` 记的是入账时刻不是下单时刻 → 后台对账「创建→到账」耗时恒为 0 | `deposits.ts:506-507`;`DepositIntent` 没存 createdAt |
| P2-5 | `bills.addOnce` 判重域是本标签页**内存**,与 deposits 侧「磁盘最新」口径分叉 | `bills.ts:204-208`;对照 `deposits.ts:155-167` / `334` / `650` |
| P2-6 | 「一律在磁盘最新上复核」在 storage 读失败 / 行不存在时**静默降级到内存** | `account-scoped-storage.ts:154`(`disk.row ?? opts.snapshot()`);`readAccountRow` 吞异常返 null(`:16-19`) |
| P2-7 | 卡轨无在途锁,同一 tick 内双击理论可双提交 | `deposits.ts:628-684` 无重入守卫;`topup-card-form.vue:120` |

**agent 的一条阴性结论(值得记)**:撞号核查未发现两笔不同入金撞同一 ref —— txHash / intentId / authCode 都在磁盘最新上判重;反向的「同一笔重放出两个 ref」**只在卡轨成立**(P1-4)。

---

## 单元2 · 机器门判据合并后是否假绿 — 待回报

## 单元3 · 回归横切 + 解析器收敛 — 待回报

---

## main 的独立实测(不依赖 agent 断言)

| 测什么 | 脚本 | 结果 |
|---|---|---|
| 落盘代价基线 | `scripts/measure-persist-cost.mjs` | 账户快照 60 次/60s · 253.5 KB;40 条种子账单序列化 6,662 B(比整份快照还大);真实产出只 29 次 → **60 次里 31 次纯空写** |
| 账单跨标签页丢失 | `scripts/measure-bills-crosstab-loss.mjs` | 轨道甲(账单裸覆盖)**TAB-A 被吞**;轨道乙(快照三路合并)两笔都在($130)。同一并发形态,差别只有有没有合并层 |

---

## 单元2 · 机器门判据合并后是否假绿(已回报:P0 4 / P1 6 / P2 8)

**结论方向:这道门比它 PASS 行显示的弱得多。**

| # | 断言 | 依据 | main 复核 |
|---|---|---|---|
| P0-1 | **多行调用整族逃逸** —— 判据按行匹配,而所有真实 draft 都是多字段对象,prettier 一换行即逃。实测 `  bills.add(` → false | `selfcheck-money-receipt.mjs:464` | 待验 |
| P0-2 | **`strip()` 块注释劫持** —— `//` 行注释或字符串里出现 `/*`,到下一个 `*/` 之间**全被删**,门看不见 | `:44` 的 `\/\*[\s\S]*?\*\//g` 不认上下文 | 🔴 **main 已实测确认**:`security.ts` 78 行 → strip 后 38 行,`interface Persisted` / `function hydrate` **整段被吞**;`header-title.ts` 吞 18 行 |
| P0-3 | **receiver 白名单只认三个名字** —— `const store = useBills(); store.add(…)` / `billStore.add(…)` / `bills?.add(…)` / 解构后直调,四种全逃 | `:464` | 待验 |
| P0-4 | **语句位判据放行 10 种丢弃形态** —— `void` / `await` / 无花括号 else / 箭头函数体 / `.then(...)` / 三元 / `&&` / `\|\|` / `.vue` 模板内联 handler / 展开实参 | `:473` | 待验 |
| P1-1 | 第 4 条冲正路径(`stake-sheet.vue`)只上了 1 针,删掉 `{restoreTo}` 门仍全绿 | `:407` vs `stake-sheet.vue:166/199` | 待验 |
| P1-2 | WIRED 是**手工名单,无「新调用点必须入册」反向门**;存量已有两处在册外(`register.vue:537-544` / `wallet-withdraw.vue:1001,1011`) | `:396-422` | 待验 |
| P1-3/P1-5 | 行尾 `//` 注释未剥 → 既能**哄绿**三针,也能**哄红**⑥ | `:44` 只剥整行 | 待验 |
| P1-4 | 三针**不锁同一条失败分支**,全文件共现即过 | `:429` | 待验 |
| P1-6 | **`)$` 分支零正控** —— 我刚补的 addMany 正控只覆盖了 empty 分支;`)$` / `;` / `}` 三种收尾无任何控制线 | `:492-504` | 待验 |
| P2 ×8 | 样本量写死 `primitives: 5` 实跑 4 · 后缀只 `.ts\|.vue` · 收口点整文件豁免 · 首字符类未全覆盖 · storage key 漂移致空集判绿 · 一行多处只计 1 · 「接了但不用」判 false · ⑤ 的裸调禁令只禁 `bills.add(` | | |

## 单元3 · 回归横切 + 解析器收敛(已回报:P0 1 / P1 5 / P2 7)

| # | 断言 | 依据 | main 复核 |
|---|---|---|---|
| **P0-1** | **路由任务奖励:发钱、零账单、返回值丢弃** —— 同族漏迁的第三处(另两处 `share.ts:186` / `wallet-cards-new.vue:187` 已迁)。门看不见:⑤只查 App.vue 含 `postMoneyBill(`(文件别处有,过),⑥只扫 `bills.*` 不扫 `app.credit*` | `App.vue:512-514` · 金额 `quest.ts:61-63` | 🔴 **main 已回源确认**:`if (r.rewardNex > 0) app.creditNex(r.rewardNex); if (r.rewardUsdt > 0) app.creditBalance(r.rewardUsdt);` 之后直接 toast,全函数无任何 bills 写入 |
| P1-2 | **冲正返回值三处全丢 → 「已退款」是假话** | `marketplace.vue:340-352`(`:354` 无条件弹「payment refunded」)· `wallet-repurchase.vue:164-175`(`:179` 「The full amount is back in your balance」)· `purchase-sheet.vue:207-219` | 待验 |
| P1-3 | **「领取已消费、奖归零」——App.vue 改了序,5 个同族没改**,相对改前是**回归**(改前至少钱到账了) | `App.vue:280-287` 已反序;`weekly-quest-hero:158+170` / `weekly-quest-list:163+174` / `events:152+163` / `daily:306+316` / `achievements:188+193` 仍是先消费后记账 | 待验 |
| P1-4 | `onClaimRow` 返回值完全没接(**同一提交里的孪生函数接了**) | `weekly-quest-list.vue:151-158` vs `:167-174` | 待验 |
| P1-5 | 转盘:钱可能被回滚,历史与「你赢了」照写照弹 | `lucky-spin-sheet.vue:282` / `:308-310` | 待验 |
| P1-6 | 质押平仓/领取记账失败 → 本金与仓位**同时消失**,且不入待对账(`reportStuckFunds` 只在回滚**失败**时触发) | `staking.vue:219-230` / `:246-256` · `money-receipt.ts:186/196` | 待验 |
| P2 ×7 | 「资金已还原」注释对 `stuck` 分支不成立 · 承接失败文案只说一半 · **冲正分录复用同一幂等键三元组**(`marketplace.vue:312` vs `:349`)· tradein 三处顺序注释未随代码更新 · `d49ad84` 留下死导入 `existsSync`/`statSync` · **棘轮门⑥ 的两个方向盲区(裸调 `app.credit*` + 丢弃 `postMoneyBill` 返回值,共 6 处)** | | |

**单元3 核实通过(阴性结论,一并记)**:六个 `srcDir` 全对;旧五份解析器均未支持 `.tsx/.vue`、无脚本依赖目录优先;vouchers 新旧解析同一文件;全仓仅剩 4 处裸调且均已接返回值;`genesisSecondaryReversed` 三语齐且为真翻译;`app.restoreMoney` 是增量还原不是快照覆盖。

---

## 累计(4/6 已回报)

| 来源 | P0 | P1 | P2 |
|---|---|---|---|
| 单元1 入金三轨 | 3 | 6 | 7 |
| 单元2 机器门判据 | 4 | 6 | 8 |
| 单元3 回归横切 | 1 | 5 | 7 |
| 证伪镜头1 方案原子性 | 5 | 7 | 5 |
| **合计** | **13** | **24** | **27** |

🔴 **一条必须让主人知道的口径修正**:我此前报的「verify 406 pass / 0 fail」如实反映了门的输出,但**门本身有盲区**(P0-2 实测:`security.ts` 40 行真代码被 strip 吞掉,门对那些区间是瞎的)。**通过 ≠ 干净。**
