# 老哨兵套件 43 红门逐条判决(包 z1-legacy-gates)

- **基准提交**:origin/UniApp = `c37e642`(feat: align app remote business flows)。基线实测:老套件 `bash scripts/verify.sh` = **380 pass / 43 fail**;新链 `npm run verify` = **绿(exit 0)**。两条链在同一 checkout 串行实测,与主人交底一致。
- **两笔肇事提交**:`c37e642`(远端业务流对齐,客户端资金权威整体让渡后端,113 文件 ±5k 行)与 `a8f57f4`(移除 KYC client runtime)。另有前置 `819a6da`(种子搬进 compat 运行时边界)贡献 3 条。
- **判决口径**:A=判据过期(不变量在,形态变了→改成构造性判据+双向红测)· B=真回归(修码+门同一提交)· C=判据废弃(主语已不存在→显式删除并写明)。
- 状态列:☐ 待实施 · ◐ 实施中 · ☑ 已实施 · ✔ 已红测。

## 总判决:A 30 · B 8 · C 7(B 类单列见文末;B7/B8 为首轮修复后全量复跑揪出的第二层真回归)

| # | 门 | 判决 | 依据(回源) | 处置 |
|---|---|---|---|---|
| 1 | selfcheck-fastlane(13 子红) | A+C+B4 | 13 子红全在静态接线门半区,行为断言半区全绿。子 1-9/12:submitWithdrawal 本地「占额度/扣款/落盘/重放」链整体删除(app.ts:1249-1280 remote-only,-182 行),主语灭失→C;子 10:列表模型仍在,写法 `wd`→`canonical`+按 id 去重(app.ts:1278)→A 重锚;子 13:smallAmountLine 有意 HOLD 硬编码 0(wallet-withdraw.vue:660,注释明写 backend 未实现快车道)→A 钉 HOLD 态;子 11:commitWithdrawal(风控台账落地)搬进 withdrawal-eligibility.ts:135-137 后**全站零调用**→B4 | 重写静态块:删灭失主语断言(替代义务记 HANDOFF:服务端事务内占额度/复核);重锚子 10/13;B4 接线+钉新调用点 |
| 2 | selfcheck-feegate(2 子红) | A | F1:feeConfigUsable 判据换源(config store→页面本地远端 policy,3 合取 fail-closed,wallet-withdraw.vue:532-537);F2:重试 `cfg.load()`→`loadWithdrawalPolicy()`(:540-548),语义未变 | 整串 pin 换钉新定义全文(保留「尾部不得追加分支」防 `\|\| true`);F2 重锚新函数名。另加 B2 的渲染条件 pin |
| 3 | selfcheck-slacopy(8 子红) | A+C | 6 条 {h} 占位符:三语时限承诺句被有意改为「以服务端订单状态为准」(zh 932/en 994/vi 950 + terms 127/138/139,三语同步无漏);§04 渲染源换远端 chapters(risk-disclosure.vue:141-145),本地 withdrawWindowBody 成零消费死 computed;§06 插值机制随文案删除 | {h} 断言退役,保留并确认「无写死数字」断言;重锚 §04 远端渲染源+loadError 重试;删死 computed(其 4 条绿断言一并退役,防假绿);§06 断言退役 |
| 4 | bare login-entry chrome runtime geometry | A(共因) | 18 页×2 视口全部几何断言通过,仅 console 断言红=启动期 3 个 unhandled rejection(B1)+ suite 从未声明 dev server 需 mock 模式 | B1 修复 + verify.sh 焊「server 必须 mock 模式」前置断言(构造性:探不到模式即红) |
| 5 | payout-address PROD guard | A | 守卫仍在且**加强**:`if (import.meta.env.PROD \|\| remoteApiEnabled) return false`×2(payout-address.ts:296/308,a8f57f4);老判据钉死单条件字面 | 重锚:函数体内 `import.meta.env.PROD` 出现在守卫 return 且允许附加合取/析取;0 候选即红;两处都验 |
| 6 | SPEC-7 riskScore cloned | A | 克隆逻辑 819a6da 搬进 compat(platform-config-compat.ts:64-67),写法同款(seed 展开),覆盖面更全;config store 经 completePlatformConfigSeed 初始化(config.ts:20) | 新 selfcheck-config-compat.mjs 行为断言:合成两次互不污染+改合成物不污染种子 |
| 7 | SPEC-7 release ledger exists (R1) | C | c37e642 客户端释放引擎整体让渡后端:LEDGER_KEY/readLedger/writeLedger 删,appendLedgerEntry 成 `return false` 空壳;快照改 shallowRef+GET /api/earnings/release-status(earning-release.ts 15-39) | 显式删门。**连带处置殉葬绿门**:verify.sh:405-416 一带钉空壳调用的 journal×2/attest/release 哨兵同批退役(绿但守死代码=假绿);替代=新链 hard-block-k1 契约+earnings-release-api 协议校验。HANDOFF:服务端账本义务 |
| 8 | SPEC-7 cluster circuit breaker (R1) | C | clusterBreakerTripped 函数+调用整删;替代=服务端下发 clusterRestricted(earnings-release-api.ts:10/34/55),唯一消费 wallet-withdraw.vue:406 归零可提;新链 hard-block-k1 已钉 4 条 | 显式删门,提交信息写明替代;消费点归零行为并入 #10 新判据 |
| 9 | AUTH03 captchaAlwaysScenes seed pin | A | 键从种子移出(otpGate 5 键),compat 运行时默认 `["register"]`(platform-config-compat.ts:35/43-45/70);种子类型改 Partial;消费链经 config store 合成配置闭合 | selfcheck-config-compat:合成后 captchaAlwaysScenes 含 "register"(行为断言,种子若显式覆盖为空必红);AUTH03 wiring 哨兵(470-490)不动 |
| 10 | withdraw available = total balance | A | 2026-07-31 规则被新规则取代:(总余额−服务端 held 两桶)×balanceMaxRatio,clusterRestricted/无快照/无 policy 三态 fail-closed 归 0(wallet-withdraw.vue:405-412) | 重锚:钉 fail-closed 结构(三个归 0 分支+乘比率),不钉字面表达式 |
| 11 | SPEC-7 reject route never debits | A | 本地扣款链删除(「never debits」结构性成立);reject 闸移页面提交前(wallet-withdraw.vue:942)+API 白名单不含 reject(withdrawal-api.ts:91-98 回包校验) | 重锚三合一:页面 pre-submit reject 闸在+API allowedRiskRoutes 无 reject+submitWithdrawal 函数体无余额写入(负向结构断言) |
| 12 | SPEC-7 risk route maps to queue status | A | 映射换输入源:服务端 status 字符串→canonicalStatus()(withdrawal-api.ts:190-225,FROZEN→frozen 等,未知值抛错) | 重锚 canonicalStatus 映射表+未知态抛错分支 |
| 13 | withdrawal 落盘余额复核 ×2 | C | 占额度/落盘/复核链整删,客户端不再本地扣款;并发收敛=服务端事务+idempotencyKey(wallet-withdraw.vue:877) | 显式删门;HANDOFF:服务端 POST /api/withdrawals 事务内必须重读余额(幂等键≠CAS,主人错题集同款) |
| 14 | withdrawal clamps withdrawable >= 0 | C | 主语(本地提现扣款 applyDebit)删除;购买链 debitBalance 的姊妹 clamp 仍在且其哨兵(565/569)仍绿 | 显式删门,写明姊妹门仍守购买链 |
| 15 | P0 neg-balance 总余额门 | C | 主语(本地扣款透支)灭失;页面 fail-closed 上限+服务端 reservation | 显式删门;页面上限并入 #10 |
| 16 | P0 neg-balance 金额有效性 | A | store 边界删,但用户流上的守卫在页面层:amount≤0 禁提交(wallet-withdraw.vue:782)+输入剥非数字(:815-821);四余额原语守卫仍在(app.ts:975/988/1013/1027,nex_guard_sites 门绿) | 重锚页面层守卫;残余缺口(store 直调透传)记 HANDOFF:服务端必须拒非法 amount |
| 17 | P1 fee snapshot 5 参交叉核对 | A | 5 参调用活在页面提交链(wallet-withdraw.vue:518-526/962),第 5 参权威源换 policy.networkConfirmFeeUsd;store 侧死;config 的 currentNetworkConfirmFeeUsd() 成零调用死码 | 重锚页面 5 参调用+提交链位置;删死函数(防未来门盯死代码假绿) |
| 18 | SPEC-7 value parity coverage otpGate=5(应 6) | A | captchaAlwaysScenes 出种子进 compat(见 #9);循环 5 数值键与种子 5 键现实一致,硬计数「应 6」过期 | 覆盖度改集合等式:种子块键集 == 循环键集(键清单单源成 bash 变量,两处共用);0 键即红 |
| 19 | WD02 network-confirm-fee parity | A | 提取器按设计红(种子形状变了);值搬 compat RUNTIME_WITHDRAW_RULE_DEFAULTS={1,1,5}(compat:25),admin-ops 锚={1,1,5} **仍逐键一致** | selfcheck-config-compat:合成配置取有效值逐键 vs admin 锚(路径双候选,锚缺失必红);键数覆盖度保留 |
| 20 | R7 device detail runtime | A(共因) | 业务断言全过,仅 console 断言红(B1 启动噪声) | 同 #4 |
| 21 | SPEC-7 K1 registration gates | A(共因) | K1 闸门断言全过(result.length=0),仅 console 断言红 | 同 #4 |
| 22 | AUTH02 handoff (en) | A | 探针驱动 mock 流;c37e642 给 register.vue:329-347 加 remote 分支(remote 下 POST /auth/users/register/otp/send→404→流程停第 1 步);mock 分支原样在 | 同 #4(mock 模式 server 前置断言);remote 注册流由新链契约测试守 |
| 23 | AUTH02 handoff (zh) | A | 同 #22 | 同 #22 |
| 24 | SPEC-4 account-cloud app sync | A(共因) | 三条合并断言(:88/:91/:94)全过,仅 console 红 | 同 #4 |
| 25 | SPEC-4 runtime session guard | A(共因) | 撤销后停写断言过,仅 console 红 | 同 #4 |
| 26 | brand legacy 'Nexion' residual | A+B5 | 4 命中全 scripts/ 层、全 c37e642:2×`../nexion-backend` 路径(后端仓目录名=白名单族)+`x-nexion-edge-country`(后端契约 header,client 只能跟随)+`nexion-ops-console`(**把创世门取材面改成本机不存在的仓名**,实存 admin-ops)| 白名单收编 3 个后端契约字面(tight pattern);B5=genesis-gate 仓名回退双候选;header 改名义务记 HANDOFF |
| 27 | platform-anchor: code.vue MONTHLY_NEW_JOINERS | A | c37e642 把 joiners 从编译期常量改为配置派生+健康门控+"—" 兜底(code.vue:145-156);import 列表整条移除,非死 import | 重写消费对清单为现状真值(intro.vue/code.vue 的 *Of 派生函数+健康门控);0 消费即红 |
| 28 | platform-anchor: app.ts FLEET_DEVICES | A | 同上:app.ts:326-336 改健康门控归 0,remote watch 重基线 | 同 #27 |
| 29 | platform-anchor: 种子取自编译期锚 | A(判据反转) | 819a6da 种子出走+c37e642 compat 默认清零并注释「Deliberately invalid sentinel…Never replace with plausible data」 | 新判据钉**全零哨兵不变量**(compat publicStats 默认必须全零/空表,出现可信假数即红)——这是新的承重不变量 |
| 30 | platform-anchor: trust.vue 27,150 | C | Q2 字面量整删:QTR_FINANCIALS=[]+模板段 v-if="false"(trust.vue:46/279);披露改远端 trustSectionApi 按地区下发;admin-ops 侧同字段已服务端化(i4-trust.tsx:91),字面量 0 命中 | 显式删门(连同 $47.0M 与 admin data.ts 镜像判据);对照锚在停更仓,概念整体废弃 |
| 31 | platform-anchor: trust.vue $47.0M | C | 同 #30 | 同 #30 |
| 32 | sampling evidence(learn 2 页) | B6 | 门正当拦截:c37e642 仅有的两个新增页面 learn/courses+learn/course 无走查证据;证据体系最新体(plan/auditor/corpus)仍在 Nexion-admin-prototype,admin-ops 副本是旧子集(缺 UNI-FR-11/12+空心证据检查) | 给 2 页补采样证据(prototype 仓 corpus+shard 计划登记);体系迁 admin-ops 作为拍板项报主人 |
| 33 | 四边描边容器(3 违例) | A+B2+B3 | ①genesis dock 禁用态:allowlist cls 钉了启用态类串,禁用态掉 active:scale 类→miss(元素本身已被豁免)→A 放宽 cls 匹配;②tcs-hero:1px brand 描边违《03》§3,被 voucher 弹层让位暴露→B3 删描边;③stake-alt 卡:渲染条件被 policy-null 回退削弱(0≥0 恒真),空表单即渲染→B2 收条件 amountNum>0 | ①改 allowlist 条目;②③产品修+门不动(zero-border 门本身工作正常) |
| 34 | dom-qa 新 DOM 违例 | A(共因) | 5 路由 DOM 违例 0(gate=0 info=0);红=coverage 前置的 pageerror(B1 噪声) | B1 修复+mock 前置;dom-qa 门不动。附:team 页 25 节点疑点记走查清单 |
| 35 | 兑换/创世重入守卫 | A | B④ 资金原语命中 0=创世购买让渡后端原子事务(purchase-sheet.vue:167-204,不再本地扣款);:580 needle 掉 async 前缀致 transform 崩 | 重写:锁点须在 `await genesis.purchase` 前+needle 换 async 形态+双击固定靶用 stub genesisApi 数调用次数(恰 1) |
| 36 | P1 涉钱/配额乐观并发(money-cas) | A | harness 缺 shallowRef(stub 单源化已修);真断言浮出 3 红:voucher/daily-powerup/nex-faucet 的 remote-apply 缝(clearRemoteFacts/refreshRemote 等)是「sync+bindAccount」外第三类赋值,remote-gated(voucher.ts:99-105 首行守卫) | stub 单源化(scripts/lib/harness-stubs.mjs,runtime 导出面从磁盘扫)+判据扩第三类:remote-apply 函数需自带 remoteApiEnabled 守卫才豁免 |
| 37 | 创世邀请码码表核销 | A | c37e642 删本地码表(-157 行):「Server-only redemption. No local registry, seed code or rollback exists.」;错误码→reason 映射是仅存客户端逻辑(genesis-invite.ts:12-26) | 重写:行为测错误码映射(5 码→4 reason+格式预检不打 API)+负向钉码表字眼不复活;一码一用义务记 HANDOFF |
| 38 | 冲正(回滚)自身 | A | 纯 harness 崩(shallowRef);stub 修复后 28/0 全绿 | stub 单源化即毕(✔ 已复跑绿) |
| 39 | 领奖幂等 | A | 同 #38;修复后 0 fail | 同 #38(✔) |
| 40 | 总有效算力聚合 | A(判据反转) | ⑥ 期望本地种子分位表合法;819a6da 删种子表+c37e642 清零 compat(故意非法哨兵);合法性校验移 platform-config-api.ts:151-174(<2 档抛 H9_PUBLIC_STATS_RESPONSE_INVALID) | ⑥ 改钉:合成种子表=空(全零哨兵)+API 校验器拒 <2 档;名次固定靶改用 fixture 表喂纯函数(行为保留) |
| 41 | 创世单一派生 | A(含 B5) | 48/1:唯一红=兄弟仓名被 c37e642 改成不存在的 nexion-ops-console(实存 admin-ops;作者环境仓名不同) | 仓名双候选(admin-ops→nexion-ops-console),都缺才红(保留「判据失效必红」) |
| 42 | 资金 ⊗ 收据 | A | runtime-stub 缺 pointsApi/i18nApi(手列清单没跟上依赖面);修复后浮出 2 红:①「1>0」实为 App.vue `businessTimeouts.add(handle)`(Set.add,被门的**有意过近似**扫中——机制本体要求逐个登记);② WIRED needles 未含 postMoneyBillsOnce(b023674 claim 族统一引入) | stub 单源化+ALLOW 登记 App.vue:1(Set.add,写明缘由)+WIRED 三针补 postMoneyBillsOnce;**顺带补洞**:收口点 EXPORTS 缺 postMoneyBillsOnce→补上后反向入册门抓出漏网的 payout-address.ts,已入册(80/0) |
| 43 | 接口引用台账 | A | 门按设计工作:台账孤儿 /api/market/nex(c37e642 删了唯一引用注释,契约本身也变 HTTP fetch);同笔已删 3 条同族孤儿,漏此 1 条 | 从 LEDGER 删该条+邻条 GET /api/market 备注同步修 |

## B 类(真回归)单列 — 8 条

| B# | 归属门 | 回归内容 | 修法(与门同一提交) |
|---|---|---|---|
| B1 | #4/20/21/24/25/34(6 门共因) | c37e642 的 10 个远端刷新缝 7 个有 try/catch,漏 3 个:v-rank.ts:228(Promise.all 裸 await)、commission.ts:183(裸 await)、genesis.ts:319(applyPublicState 在 try 外)→ 无后端时每次启动 3 个 unhandled rejection | 补 catch(照同批 quest/voucher/cards 的既有写法);新增 selfcheck-remote-refresh-resilience.mjs(esbuild 行为门:API 全抛时 refresh 必须 resolve,unhandledRejection=0)接入 verify.sh |
| B2 | #33③ | wallet-withdraw 质押劝阻卡渲染条件被削:minWithdrawable 回退 0 后 `0>=0` 恒真,空表单即渲染转化卡 | 条件收紧 `amountNum > 0 &&`;feegate 加结构 pin |
| B3 | #33② | trial-claim-sheet .tcs-hero 有填充+四边描边(违《03》§3),被 voucher 让位暴露 | 删 border 保留 tint;zero-border 门本身即防复发 |
| B4 | #1 子 11 | commitWithdrawal(首提标记+地址登记)搬家后全站零调用,客户端风控引擎数据面断供:hasWithdrawn 永 false → 首提人工审永远误触发、地址永不登记 → 新地址 hold 永误判、K1 强维输入丢失。已回源核验:seam 注释自证用途+消费面(eligibility-core:442)活着 | ✔ app.ts:1282 建单成功后接回 `commitWithdrawal(accountKey.value, network, address)`;fastlane #11 重锚三合取(调用在/顺序对/seam 体内两原语在),红测 3 组各自隔离打红 |
| B5 | #26/#41 | c37e642 把创世门跨仓取材面改成本机不存在的仓名,门失效 | 双候选仓名+失效必红(已并入 #41 处置) |
| B6 | #32 | learn/courses+learn/course 两新页无走查采样证据(门的本职拦截) | ✔ prototype 仓证据生成器补 2 页证据+shard 计划登记(auditor findings 2→0,commit b702df4) |
| B7 | #33②→连锁 | 「故意非法」全零哨兵在 publicStatsHealth 的 members/rank/jitter 合法域里**是合法值**(0∈域)→ mock 首页把「Members 0 +0%/mo」当真数据渲染(tap-feedback 探针连带报违例) | ✔ compat 哨兵三字段(onlineJitter/growthPct/virtualUserCount)0→-1 使六健康位全 false;account-hashrate ⑥a 升级为「无正数 + 六健康位全 false」行为断言(86/0);红测:塞 28432 必红 |
| B8 | #22/#23 根因二段 | creditRewardBucketInternal 把「客户端释放台账写成功」当 held 两路由的放行条件,而 c37e642 已把台账空壳化恒 false → **mock 模式风控标记账号的赠金/奖励入桶无条件失败**(AUTH02 注册重试恒「服务不可用」实锤;settle 路径同调用但忽略返回值,无此病) | ✔ 与 settle 同形 fire-and-forget(台账义务在服务端);新增 selfcheck-reward-buckets.mjs(3 路由+幂等+非法金额,10/0)接入 [1.6];红测:塞回判死条件→held 两路由精准判红、withdrawable 不误伤;AUTH02 en/zh 复跑 PASS |

## 实施补记(2026-08-10 收口)

- **红测计分板**(除各 selfcheck 内置自证外的文件级注入):resilience✓✓ · preflight✓✓(5173 remote 必红/5183 mock 必绿)· PROD 守卫✓✓ · canonicalStatus✓✓ · available fail-closed✓✓ · no-local-debit✓✓ · compat 全零✓✓ · coverage 集合等式✓✓(此条红测揪出我判据自身的幽灵键 bug 并修正——红测同样防「broken-red」)· trust Q2✓(注入红+还原字节校验)· brand✓✓(裸词红/白名单三形态绿);I1 9 组 · I2 9 组 · I3 13 组(各 agent 报告存证)。
- **实施 agent 裁量披露**:① I3 将本地 admin-ops checkout `--ff-only` 快进 5 笔到 origin/main(⑧c 键 parity 的红是本地旧线环境红,错题集「本地可能是旧分叉线」同型;纯 ff 干净树,未改判据);② I3 补齐 money-receipt 收口点 EXPORTS(postMoneyBillsOnce),连带抓出并入册漏网的 payout-address.ts。
- **采样证据**:Nexion-admin-prototype 仓 commit `b702df4`(落在其当前所在分支 `rhythm-configurable`,未推送——门读工作树文件不受分支影响;归置留主人定)。
- **相邻发现(未在 43 门内,已立案未擅修)**:① learn 双页整页硬编码中文(i18n 违规)→ 任务芯片 task_245aaf60;② SPEC-7 param key/value parity 两条绿门仍锚停更仓 Nexion-admin-prototype 的 compute-config.ts(值得迁 admin-ops,涉对侧文件结构差异,留拍板);③ c37e642 新增的远端契约测试(g/h-remote-authority、hard-block-auth/d5/h9/k6、h9-visible-user-method)**两条链都没接**(孤儿;h-remote 还需 nexion-backend 兄弟仓,本机缺);④ team 页 runtime 仅渲染 25 节点(其它 tab 572-693),疑似 remote 化后空壳,待实景走查确认。

## 收口决定(推荐,待主人拍板 —— 本包未执行)

**推荐:接回,不退役。** `npm run verify` 末尾串 `bash scripts/verify.sh`,并把孤儿契约测试同笔接入;拆细见收尾报告的拍板项(含代价/风险/不做会怎样)。核心理由:① 本包已把 43 红清零、判据全部构造化+红测,套件恢复资产状态;② 两链已有真实重叠(老套件末检=新链 verify-h5-runtime 同款自起隔离 server),接回只增不冲突;③ 「留着不跑=假装有门」在本仓 3 天内已实证三次(新链架空老套件 / 43 红无人跑 / 新契约测试无链可跑),不接回必然复发。

## HANDOFF 义务清单(随包写入后台仓交接书)

1. POST /api/withdrawals 服务端事务内:重读落盘余额(幂等键≠并发闸)、拒 NaN/≤0 金额、reject 路由零扣款、费用与 policyVersion 交叉核对。
2. 收益释放:服务端账本+熔断(clusterRestricted)为唯一权威;客户端已只读。
3. 创世邀请码:一码一用/一账号一次改服务端强制。
4. `x-nexion-edge-country` header 名含旧品牌,改名需后端同步(client 测试跟随)。
5. 采样证据体系(l1-shards/auditor/corpus)仍在停更的 Nexion-admin-prototype,是否迁 admin-ops 待拍板。
