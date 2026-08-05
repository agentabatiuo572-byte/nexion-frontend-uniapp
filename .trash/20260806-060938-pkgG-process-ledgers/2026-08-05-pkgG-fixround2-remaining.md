# 包 G 第二轮修复台账(2026-08-05,结构轮之后)

> 结构轮已闭:门假绿族 5 条 + 环境项(verify 414/0,6 死齿轮复活)。
> 本文件 = 剩余功能项,连证伪方原始证据。修完在条目下写「已修 + 复验方式」。
> 🔴 过程台账,包 G 收口后删,只留成果与机器门。


## P0〔B-三语文案〕verify.sh 因本组 diff 变红(7 处 markdown 残留),而自述报「两个门全绿」 —— ✅ 结构轮已闭

```
我跑 `bash scripts/verify.sh` → exit 1,412 pass / **1 fail**。失败哨兵:`markdown residue in i18n copy (** or \`/path\`)`(scripts/verify.sh:177-178,判据 `grep -rEnI '\*\*[^*]+\*\*|\`/[a-z]' src/i18n/messages`)。

全部 7 处命中,**全部来自本组新加的注释块**:en.ts:342 / 343 / 346 / 349 / 370 / 377 + vi.ts:345,形如 `//   → 超宽是**省略号**,不致命。`、`//   本轮**只收口值槽**(P1-2 / P2-1 的范围)`。
对照 HEAD:`git show HEAD:src/i18n/messages/{en,zh,vi}.ts` 三个文件各 **0 命中** → 100% 是这次改动造的,不是存量。

自述说「两个门全绿」,跑的却只有 `i18n-key-mirror.mjs` + `type-check`。本工程 CLAUDE.md 明写「verify 是 tripwire,不是 typecheck:tsc 过 ≠ verify 过」,完成门第一条是「tsc + verify 全绿」——这道门现在是红的。

讽刺的是同仓 `src/components/home/network-pulse-card.vue:66-68` 就挂着这条警告原文:「注意:本文件里不许再出现那几个符号名,连注释里也不行 —— 哨兵扫全文,不区分代码与注释」。同一个坑,隔一个文件。
```

## P1〔B-三语文案〕新加的 MARK_EXEMPT 白名单不分语言,vi 真丢占位符照样绿 —— ✅ 结构轮已闭

```
红测 A8(修复方 7 例矩阵未覆盖的方向):把 vi `me.networkCardGapDirectRefs` 从 `"Thêm {n} {label} trực tiếp"` 改成 `"Thêm {n} trực tiếp"` → 门 **exit 0**,总结行只从「7 处」静默变成「8 处」,没有任何红灯。还原 sha256 一致、复跑 exit 0。

为什么这是真缺陷而不是理论洞:授权理由写在 scripts/i18n-key-mirror.mjs:99-101,是**针对 zh 说的**(「zh「还差 {n} 个直推」无单复数,不需要该词」),但代码 :138 `MARK_EXEMPT[key]` 对所有 locale 一视同仁。而调用点 src/components/me/network-card.vue:109-112 传的是**本地化名词**:`label: g.remaining === 1 ? t.value.me.networkCardInviteWord : t.value.me.networkCardInvitesWord` —— vi 是真消费它的,丢了就渲染成「Thêm 3 trực tiếp」,名词整个没了。

台账 R8 写「授权是 **key+name 二元**的,不是全局名字白名单」——对,但漏了第三维 locale;三条「防扩权纪律」(按名授权 / 写理由 / 0 命中即红)一条都拦不住这个形态。

修法就在仓里现成:`scripts/i18n-placeholder-parity.mjs` 是既有的 en↔vi 占位符门,只全局豁免 `{s}`,能抓住 A8;我跑了它 → **exit 0**(今天就能过)。但 grep 全仓确认它**没接进 verify.sh 也没进 package.json**,是死脚本。本轮等于绕开一道更严的既有门,另造了一道更松的。
```

## P1〔C-后台H9〕P1-6 台账写的机器门「回退成内存态铸号就红」在最可能的回退形态下不成立(哨兵假绿)

```
实现是对的(运行时探针 5/5 + 负对照 FAIL 已证),但守它的门守不住。`scripts/pending-idempotency-key-sentinel.mjs:149-170` 的判据 3 只测两件事:文件里有没有字符串 `pending-mutation-store`、有没有 `create(PendingMutation|SlotAttempt)Store(` 调用。**它完全不看调用点**。我的红测(scratchpad/indep-sentinel-rt.mjs,跑在 lib/app/scripts 完整副本上,基线绿):
· SR-B:保留 `lib/admin/h9-client.ts:157` 的 `const h9Attempts = createSlotAttemptStore({...})` 不动(没人会去删一个 const),只把 `:245-249` 的 `h9Attempts.resolve(...)` 换成内联 `` `h9-public-stats-${Date.now()}-${Math.random()...}` `` → 哨兵 **PASS / exit 0**,失败横幅那句「用的是同一个幂等键,不会重复落账」当场又变成空承诺,而门一声不吭。
· SR-C:删掉 `:258` 的 `h9Attempts.forget(H9_SLOT)`(命令永不收敛,下次保存复用已被后端消费的旧号)→ 也 **PASS**。
· 对照 SR-A(自述红测过的粗形态:整个不 import 共享 store)确实红。
没有第二道门兜底:admin-ops **没装 ESLint**(package.json devDeps 里 eslint 相关 0 个),`tsconfig.json` 只有 `strict`、**没有 `noUnusedLocals`** —— 我用项目自带 typescript 实测 `--strict` 单独不报 TS6133,加上 `--noUnusedLocals` 才报。所以悬空的 store 常量既不被哨兵抓也不被 tsc 抓。
```

**已修(2026-08-06,C 组)**:`scripts/pending-idempotency-key-sentinel.mjs` 判据 3 加 3b——逐标识符核**调用点**:每个 `createSlotAttemptStore` 标识符必须同时有 `.resolve(`(取号)与 `.forget(`(成功收敛),缺一即红;每个 `createPendingMutationStore` 标识符至少一次方法调用(纯悬空 const 即红)。核过的标识符数进 PASS 样本量(`24 个 store 标识符逐个核过调用点`),0 个即 FAIL(防判据静默失效)。ponytail 天花板已注明:resolve 出的键是否真塞进 Idempotency-Key 头,静态 regex 判不了,由 pending-mutation 契约测试 + 评审兜。
**复验方式**:红测按证据里的回退形态注入(备份+注入同脚本,还原后 sha256 逐字节核对)——R1-SRB(保留 const,resolve 调用换内联铸号,forget 留着)→ **exit 1**「没有任何 .resolve(」;R2-SRC(删 `h9Attempts.forget(H9_SLOT)`)→ **exit 1**「没有任何 .forget(」;各自还原后复跑 **exit 0**。基线全量:29 个 MIGRATED 文件、24 个标识符全过(baseline 逐文件核过 resolve/forget 均在,无误伤)。

## P1〔A-算力口径〕P1-3 未修:所有付费舰队名次仍钉死 57,281,核心用户故事照旧失效

```
我用真模块 + 真种子分位表(src/mock/platform-config.ts 最高档 150 TOPS)独立复算 8 档舰队:只有手机(H5)16.5→rank 761,347 · 只有手机(满档)27.5→571,906 · 手机+cloud-share 117.5→129,676 · 手机+S1($649)2,667.5→**57,281** · 手机+Pro($1,199)5,307.5→**57,281** · 手机+Rack P1($4,499)5,307.5→**57,281** · 手机+Rack P2($7,499)5,307.5→**57,281** · 手机+10台 Rack P2 52,827.5→**57,281**。8 档舰队只出 4 个不同 rank 值,5 档付费硬件全挤在同一个;$649 与 $74,990 读数完全相同。规格 FEAT-HOME02 line 19「加算力看到排名前进」失效。修复方数字与我实测逐格一致、如实报了未修,但台账这条 P1 仍未闭合,且它同时是下面那条 P1 的遮蔽层——不解掉它,新缺陷也验不出来。
```

**已修(2026-08-05,A 组)**:`src/mock/platform-config.ts:39-59` 分位表 4 档 → **10 档**,前 4 档原值不动(手机档名次零漂移),新增 700/97.6 · 2,700/98.7 · 5,400/99.3 · 11,000/99.6 · 27,000/99.8 · 53,000/99.9(覆盖 10 台顶配机架 ≈52,800 TOPS;最高档 99.9 → 超表顶封顶名次 ≈1,433,不出「第 1 名」;尾部每 TOPS 密度单调下降)。`account-hashrate.ts` 文件头 ⚠️② 改记「已收口」,① G6 四 SKU 并列仍在(同算力必同名次,分位表解不了,要 G6 拆档,本轮不碰 gpu-tiers.ts)。
**复验方式**:`scripts/selfcheck-account-hashrate.mjs` 新增 ⑥ 组 7 条固定靶 —— 真种子表 + 真聚合现算 8 档参考舰队(H5 手机 16.5 / 满档 27.5 / +云 117.5 / +S1 2,667.5 / +Pro 5,307.5 / +2 机架 10,587.5 / +5 机架 26,427.5 / +10 机架 52,827.5),断言名次互不相同且随算力严格前进;实跑名次 761,347 → 571,906 → 129,676 → 18,872 → 10,319 → 6,045 → 2,967 → 1,442。⚠️ 台账原列的 8 档里「+Pro / +Rack P1 / +Rack P2」三档算力全等(都 5,307.5,①的并列),不可能被任何表拉开,固定靶改取 8 个算力互不相同的舰队并在注释写明。红测 RT-A:注回旧 4 档表 → 门 exit 1(付费 5 档全 57,281 复现)· 还原 sha256 一致复跑 exit 0。EXPECTED_CHECKS 64→79。

## P1〔A-算力口径〕新缺陷:排名算力不读运营可配的 GPU 档位表,运营一改就少算 7.3 倍(旧实现本来是跟着配置走的)

```
src/lib/account-hashrate.ts:75 `Number(GPU_COUNT_RE.exec(gpu)?.[1] ?? 1) * matchGpuTier(gpu).tops` —— `matchGpuTier` 不传 tiers 入参,用的是编译期常量 GPU_TIERS(gpu-tiers.ts:57 签名明明支持 `tiers` 第二参)。而这张表是运营可编辑的:admin-ops/app/components/domain-views/e-tabs/e6-compute-config.tsx 渲染并编辑 gpuTiers,admin-ops/docs/PRD/Nexion_运营控制后台_开发落地规格.md:422-423 有 `PUT /api/admin/config/compute-share/gpu-tiers/:tierId`(改档位 TOPS)与 `.../keywords/:slot`(增删识别词);前端消费面 src/store/app.ts:795 与 src/pages/compute-share/download.vue:104 都读 `cfg.config.computeShare.gpuTiers`。真模块实测两个形态:①运营把 G4 tops 290→400,设备 `gpu` 串写成 "NVIDIA GeForce RTX 4070 · 400 TOPS"、`baseRate` 0.86 按 400 算,而 `deviceBaselineTops` 给 **290**(0.725×);②运营给 G6 加识别词 "rtx 6090",设备串 "· 660 TOPS"、baseRate 1.41,`deviceBaselineTops` 落进 matchGpuTier 的 G2 静默兜底 = **90**(**少算 7.3 倍**)→ 账号总算力 117.5(应为 687.5)→ **rank 129,676 vs 应为 57,281**,pct 90.94 vs 96 —— 这一支落在分位曲线内,**不被 96% 封顶掩盖,当下就翻转名次**。这是回退不是存量:旧实现 `device.baseRate * TOPS_PER_USD_DAY` 里的 baseRate 正是 `gpuTierDailyRate(配置档)` 算出来的,天然跟配置走(400 档反推 ≈402.6),改成解析字符串后反而跟不上了。account-hashrate.ts 文件头「本文件产出的算力现在与设备自己那行 GPU 规格串完全一致」「两把尺子已合并」在这两个形态下为假——P2-9 要消灭的「两把尺子」经配置这条路又长回来了。门对这一面 0 条断言(门的 GPU 档位循环遍历的就是同一张编译期表,构造上自洽,永远看不见)。
```

**已修(2026-08-05,A 组)**:配置表穿进聚合链 —— `src/lib/account-hashrate.ts`:`deviceBaselineTops(device, gpuTiers)` / `deviceEffectiveTops(..., gpuTiers)` / `accountTotalHashrate(..., gpuTiers)` 四参必传(无默认值,`matchGpuTier(gpu, gpuTiers)` 双参);`src/store/app.ts:382-387` `myTotalHashrateAt` 传 `cfg.config.computeShare.gpuTiers`(与 connectComputeShareDevice / download 页同一单源)。文件头写明禁 import 常量当档位表 + 哨兵指路。
**复验方式**:同一提交焊进 `selfcheck-account-hashrate.mjs` ⑤ 组 7 条 —— 行为靶 4 条(改 G6 tops 660→1000:pc-gpu 单台 660→1000、8× 串聚合 →8000;加识别词 rtx 6090:兜底 90→正档 660,即台账形态②那支 7.3 倍)+ 源码哨兵 3 条(剥注释后 GPU_TIERS 字样 0 命中 / matchGpuTier 调用 0 命中即红(防空转)/ 每处调用带第二参)+ 接线 1 条(app.ts fnBody 必含 `cfg.config.computeShare.gpuTiers`)。红测双向:RT-B 单参回退 → exit 1(行为靶「改后 660」+哨兵齐红);RT-C 重新 import GPU_TIERS → exit 1;RT-D store 第四参换 `[]` → exit 1(接线红);各自还原 sha256 一致复跑 exit 0。type-check 0 错。

## P2〔B-三语文案〕en.ts durable 契约里 9 个越南语数字是错的,第三轮的三条「更正」全部改反了方向

```
越南语宽度**随 webfont 加载状态漂移**(en/zh 两态完全相同,只有 vi 变),而两份契约是在不同、未受控的加载状态下量的。我用「写进真实槽节点触发真字体栈 → fonts.ready → 连续两趟必须一致」的定态探针复量(unstable=0,两趟逐行相同):

| 串 | en.ts 写的 | 实测真值 |
|---|---|---|
| `Đang tải`(值槽) | 77.5 | **78.48** |
| `Chưa xếp hạng`(值槽) | 138.4 | **139.14** |
| `đang chạy tác vụ`(副槽) | 113.4 | **115.2** |
| `tăng {n} bậc / 24h` @2 | 121.2 | **122.41** |
| `tăng {n} bậc / 24h` @3 | 128.4 | **129.61** |
| `Kích hoạt để có hạng` | 141.6 | **144.0** |
| 短式 `chạy tác vụ` | 78.0 | **79.2** |
| 短式 `+12 bậc/24h` | 78.6 | **79.2** |
| 短式 `+128 bậc/24h` | 85.8 | **86.41** |

**0 处 verdict 翻转** —— 表里每个 ✓/✗ 今天仍然是对的,所以是 P2 不是 P1。en/zh 全部 22 个数字实测吻合到 ±0.04px。

但三件事必须点出来:
① 台账第 78 行把其中三条记成第三轮的**更正**(「以第三轮为准」:`Đang tải` 78.5→77.5、`Chưa xếp hạng` 139.1→138.4、`đang chạy tác vụ` 115.2→113.4)——**三条全部改反**,vi.ts 里原来的数字才是对的。
② 台账给出的根因(「代入值没写下来」)解释不了这三条,它们是字体加载态造成的,自述通篇没提这个变量。
③ 同一次提交里两份 durable 契约对同一个串给出不同数字(en.ts 77.5/138.4 vs vi.ts 78.5/139.1),而修复方在 P2-4 里刚写下「不许两套并存」。

附带:短式备选被标注「全部入槽…要收进槽时直接换,**无需重量**」,而最长那条 `+128 bậc/24h` 真值 86.41 对 89.33 的槽,余量是 2.9px 不是自述的 3.5px;另 en.ts:344-345 把副文本槽写成单一「89.3px」,实测第 3 格副槽是 90.34px(值槽那段正确区分了 89.3/90.3,副槽这段没区分)。
```

**已修(2026-08-05,B 组第二轮)**:en.ts 注释区 9 个 vi 宽度数字逐个替换为定态真值(77.5→78.48 / 138.4→139.14 / 113.4→115.2 / 121.2→122.41 / 128.4→129.61 / 141.6→144.0 / 78.0→79.2 / 78.6→79.2 / 85.8→86.41),第三轮改反的三条已按真值表纠正;修复中另扫出同值第 10 处(散文「vi 13 字符 = 138.4px」→ 139.14px,不清会同文件两套数字并存)。量法已写进注释(en.ts:354-358):宽度随 webfont 加载态漂移、en/zh 不漂只有 vi 漂、契约数字一律取 fonts.ready 后定态值(真实槽节点 + 真字体栈 + 连续两趟一致)、未就绪测量作废不得拿去更正。只动注释,0 文案值变更(git diff 逐行核过)。

**复验方式**(全部亲手跑):① 旧值清零:`grep -nE '77\.5|138\.4|113\.4|121\.2|128\.4|141\.6|78\.0|78\.6|85\.8' src/i18n/messages/en.ts` → 全文 0 命中;② verify.sh:177 残留哨兵同款 regex(`\*\*[^*]+\*\*|` + 反引号路径)扫 src/i18n/messages → 0 hits PASS;③ `node scripts/i18n-key-mirror.mjs` → PASS exit 0(en/zh/vi 4659 keys · 549 插值);④ `npm run type-check` → exit 0;⑤ 行尾:5280 CRLF / 0 裸 LF(改前 5274,+6 = 插入行数)。

**残余留档(不在本条 9 数字范围)**:① en.ts 现为 probe 精度(78.48/139.14),vi.ts 同串为 1 位小数圆整(78.5/139.1)——同一定态测量不同书写精度,差 0.02-0.04px,非第三套数字,vi.ts 不在本单可碰范围未动;② 附带项(副文本槽第 3 格 90.34px 未区分、短式余量 2.9px 表述)属证据块附带观察,非 vi 宽度数字,未动。

## P2〔B-三语文案〕占位符判据从字符串比较改成 Set 比较,丢了重复计数这一面 —— ✅ 结构轮已闭

```
红测 A9:en `networkMembersSub` 改成 `"+{n}% a month ({n})"`(用两次 `{n}`),zh 仍是一次 `{n}` → 门 **exit 0**,毫无提示。

原因:改前的 scripts/i18n-key-mirror.mjs 是 `if (got !== en)`,比的是排序后逗号拼接的**字符串**,对出现次数敏感;改后 :134-136 用 `markSet()` 转成 Set 求对称差,次数信息被抹掉。

这不是门的 regression(旧判据本来就是 INFO、从不 fail),但 PASS 总结行现在写的是「549 条带插值文案占位符**逐键对齐**」,把一个次数不管的判据说成了逐键对齐 —— 下一个人拿这行当「三语插值已验」,和台账 P2-3 一开始点名的问题是同一形态。
```

## P2〔C-后台H9〕parity 门 C3 的「面板必须真用共享常量」接线判据,被一行悬空 import 满足

```
`scripts/h9-public-stats-parity.mjs:234-236` 的判据是 `panelSource.includes("H9_BAND_TOPS_MIN")` —— 纯子串。红测 RT21(scratchpad/indep-h9-rt2.mjs):保留 `h9-public-stats.tsx:20` 的 import 行不动,把 `:84` 和 `:376` 两处真实使用全换成字面量 `0` → 门 **绿**。而 C3 的注释自称「常量对了没接上,面板照样会自己再写一套判据 —— 那正是本条的原形(P2-14)」,即这条判据要守的正是它守不住的形态。与 P1 同根:判据打在「文件里出现过这个名字」而不是「这个名字被用在判据上」;同样没有 ESLint / noUnusedLocals 兜底。
```

**已修(2026-08-06,C 组)**:parity 门 C3 接线判据改打**剥掉 import 语句之后的用途位**(`panelUsage = panelSource.replace(/^import…from "…";$/gm, "")` 再 `includes`),悬空 import 不再算接上;接线清单扩成 4 条(`H9_BAND_TOPS_MIN` / `H9_BAND_MIN` / `h9BandRowErrors(` / `h9PlaceholderCopy(`),PASS 行打样本量「共享校验/常量在面板用途位接线 4 处」。配套结构改动:分位表逐行校验从面板抽进零 import 纯模块 `lib/admin/h9-validation.ts`(面板手写第二套判据 → C3 红;校验语义本身另由行为级契约测试钉,见下条)。
**复验方式**:红测四条合取项逐个隔离(import 全保留只拆用途位)——R3a(`min={H9_BAND_TOPS_MIN}`→`min={0}`)/ R3b(`h9BandRowErrors(bands)`→面板内联恒真)/ R3c(`H9_BAND_MIN` 全部 4 处用途位→字面量)/ R3d(`{h9PlaceholderCopy(error)}`→手工拼接)→ 各自 **exit 1** 且报对应判据行;还原 sha256 一致、复跑 **exit 0**。

## P2〔C-后台H9〕P2-15 改完之后,H9 占位卡每条错误路径都渲染出双句号「。。」

```
`h9-public-stats.tsx:259` 是 `{error || "没拿到服务端权威快照"}。为免拿旧值当真值,…`,末尾那个「。」是给裸错误码补的。本轮把 `:126` 改成 `setError(formatAdminApiError(...))` 后,`error` 变成**必定以「。」结尾**的字典整句。实测渲染串:「对外公布数据读取失败，页面没有展示任何数字；请点重试，持续失败时联系值班人员。。为免拿旧值当真值,这里不显示任何数字,写操作也一并冻结。」通用兜底句同理:「…刷新页面后重试。。为免拿旧值当真值…」。这是运行时可见的文案缺陷,由本轮修法引入(修前 `H9_RESPONSE_INVALID:values.x` 这条路径不带句号,「。」是对的)。
```

**已修(2026-08-06,C 组)**:拼接收进 `lib/admin/h9-validation.ts` 的 `h9PlaceholderCopy(error)`——错误句先剥尾部「。」再统一补**恰好一个**句号接固定尾句;三态全对:字典整句(自带。)不叠、无句号透传串(如网络层英文)补上、空值回落「没拿到服务端权威快照」。面板 `:259` 改渲染 `{h9PlaceholderCopy(error)}`;parity 门 C3 第 4 条接线判据锁面板必须用它(手工拼接回归即红)。
**复验方式**:契约测试「占位卡拼接恒出恰好一个句号(字典整句 / 无句号透传串 / 空值三态)」断言 `!copy.includes("。。")` 且 `/。为免拿旧值当真值/` —— `node --test tests/h9-public-stats-contract.test.mjs` **7/7 pass**;红测 R10(拼接不再剥句号)→ contract **exit 1** 报「。。」,R3d(面板绕开该函数)→ parity **exit 1**;各自还原绿。

## P2〔C-后台H9〕后端不可达(本机常态、也是这页最可能的读失败)时,运营读到的是「请检查输入内容」,而本轮新加的 H9_DATA_LOAD_FAILED 文案在该路径上是死条目

```
链路我逐段核过:后端不通 → `app/api/admin/growth/[...path]/route.ts:87` 返回 `GROWTH_BACKEND_UNAVAILABLE` → `h-client.ts:84` 把它交给 `formatAdminApiError` → 该码**不在**字典里(字典只有 RISK_/EMERGENCY_/PLATFORM_ 三个同族),也不含任何字典码子串 → 落到 `MACHINE_CODE_RE` 兜底。探针实测输出:「操作失败,请检查输入内容或刷新页面后重试。」—— 这是一次**只读加载**失败,页面上根本没有「输入内容」可检查,指引是错的;而本轮专门为此加的 `H9_DATA_LOAD_FAILED`(「对外公布数据读取失败…请点重试」)只在 message 为空时才用得上,这条路径永远走不到它。P2-15 的判据「机器码数 = 0」达标,但它要解决的「运营看得懂」在概率最高的那条路径上没达标。同族路径 `GROWTH_ROUTE_NOT_FOUND` 同样落通用句。
```

**已修(2026-08-06,C 组;修法与派单描述不同,回源理由如下)**:派单写「后端不可达路径接上 H9_DATA_LOAD_FAILED」,回源发现死条目的根因在**共享字典缺了 growth 代理层的两个闭集机器码**——`growthRequest` 在 `h-client.ts:84` 就把码翻成中文整句,面板 `:126` 的第二次 `formatAdminApiError` 对非空消息恒为透传,H9_DATA_LOAD_FAILED 构造上只可能在 message 为空时生效;要「接上」它得改 `growthRequest` 的抛错形态,波及 H1-H8 全部调用方。真正的最小根修 = 照 RISK_/EMERGENCY_/PLATFORM_ 同族先例把 `GROWTH_BACKEND_UNAVAILABLE`(「增长与运营节奏服务暂时不可用，请稍后重试；持续失败时请联系值班人员。」)与 `GROWTH_ROUTE_NOT_FOUND`(「当前服务版本未提供该增长与运营能力…检查前后端版本。」)补进 `lib/admin/error-messages.ts`——H9 读失败与 H1-H8 读写全族一次修对,文案读写中性;H9_DATA_LOAD_FAILED 保留为空消息兜底(仍是活条目,非本路径主文案)。
**复验方式**:契约测试断言两码不落「请检查输入内容」兜底、不漏英文码、含「值班人员」下一步,并带对照(未知码仍走通用兜底,证明没把兜底本身改掉)——`node --test tests/h9-public-stats-contract.test.mjs` 7/7 pass;红测 R9(删字典条目)→ **exit 1**「落进了机器码通用兜底」,还原绿。

## P2〔C-后台H9〕P2-14 只焊住分位表 tops 下限一条,cumPct ∈[0,100] / 单调不减 / tops 严格升序三条与前端等价性无门

```
`h9-public-stats.tsx:73-76` 自己写着判据「只许照抄规格与前端(tops 升序、cumPct 单调不减且 ≤100、至少 2 档)」,parity 门只覆盖其中两条(C2 档数下限、C3 tops 下限)。红测 RT16:删掉 `:87` 的 `else if (cumPct > 100) errors[index] = "累计占比不能超过 100%";` → 门 **绿**、tsc **0 错**。后果方向与 P2-14 相反但同样有害:后台比权威侧更松,运营能存进一张前端 `isValidPercentileTable` 判非法的表,首页名次格直接退化成 unavailable 占位 —— 而这正是 `h9-public-stats-parity.mjs:9-10` 抬头自称要防的那件事(「后台把值域抄错 = 前端能收到自己判为非法的值」)。
```

**已修(2026-08-06,C 组)**:门做成**行为级等价**而非子串——校验从面板抽进零 import 纯模块 `lib/admin/h9-validation.ts`,新契约测试 `tests/h9-public-stats-contract.test.mjs` 跨仓真跑前端 `network-rank.ts` 的 `isValidPercentileTable`(动态 import 真模块,不手抄第二份判据),在 14 组 fixture 上断言两侧 verdict 逐格全等:非法 8 组(cumPct>100 / 负 / 递减、tops 相等 / 递减 / 低于下限、1 档、空表)两边都拒;合法 6 组(**9 档表、首档 tops=0**——曾被自造限制锁死的两个形状——cumPct 持平、顶到 100 整、小数、落盘 4 档旧形状)两边都收,**禁自造更严限制由「合法必收」方向直接判红**(上一轮 ≤8 档锁死合法配置的同形不会再溜过)。落盘 10 档种子表 textually 解析后两侧同判合法(H9 默认值域跟 `src/mock/platform-config.ts` 落盘终值走,非记忆旧表)。测试挂进 verify 齿轮表(`[17/37] H9 percentile-table behavior contract`)。**附带跨组事实**:开工时 parity 门基线已红——A 组 10 档种子落盘而规格 ③ 默认列仍写「4–5 档种子」;已同步规格两处默认列(HOME02 line 47 / HOME02b line 117 → 「10 档种子」),F 判据解析器兼容单值「N 档」形(区间形保留)。
**复验方式**:`node --test tests/h9-public-stats-contract.test.mjs` → **7/7 pass**;红测 R4(删 cumPct>100 校验,RT16 原形)→ **exit 1**「后台漏拒」;R5(tops 下限加严成 `<=`,tops>0 同形)→ **exit 1**「后台加严」;R8(种子删一档 10→9,规格不动)→ parity **exit 1**「F 分位表种子档数漂移」;各自还原 sha256 一致复跑绿。

## P2〔C-后台H9〕parity 门的删除向盲区:规格 ③ 里有、而后台与前端类型双双删掉的字段,A/B/C/F/G 五条判据全绿

```
红测 RT13:同时从 `Nexion-uniapp/src/store/config-types.ts` 的 `PublicStatsConfig`、`admin-ops/lib/admin/h9-client.ts` 的 `H9PublicStatsValues`、以及 `H9_FIELDS` 里删掉 `onlineJitter`(种子与规格不动)→ 门 **绿**。原因:A 是两侧互比(一起删则仍相等);C/G 只遍历后台 `fieldKeys`(删了就不遍历);F(`:285-310`)拿 specRows 只跟**前端种子**比,种子还在所以过。门自称守规格 ⑦「字段名三处一致」,但从来没断言过「规格 ③ 的字段全部在两侧代码里存在」。缓解事实我也核了:该形态会被 uniapp 自己的 `type-check` 抓(种子多字段触发 excess property),但那不在 admin verify 链上。补法是一行:遍历 `specRows` 反查 `adminKeys`。
```

**已修(2026-08-06,C 组)**:parity 门加判据 A2——遍历规格 ③ 表逐行解析出的 `specRows`(**锚在规格文件的字段表上,不手抄清单**;specRows 解析 0 行本就 FAIL,判据不会静默空转)反查 `adminKeys`,规格行在、后台键没了即红;前端侧经 A 的双向相等传递闭合(只删前端 → A 红;只删后台 → A 红;两端一起删 → A2 红)。PASS 行打样本量「规格 ③ 7 字段在代码两侧均存在(删除向)」。
**复验方式**:红测 R6 按 RT13 原形三处注入(后台 interface + H9_FIELDS 块 + 前端 PublicStatsConfig 的 onlineJitter,规格与种子不动)→ **exit 1** 且恰好报「A2 规格 ③ 有 onlineJitter,后台 H9PublicStatsValues 里没有」单条(无连带误报);两仓文件还原 sha256 逐字节一致,复跑 **exit 0**。

## P2〔C-后台H9〕P2-18 补的两条 CSS 规则本身没有任何机器门,删掉即全绿

```
红测 RT25:删掉 `app/components/domain-views/h-domain.css:180` 的 `.hdom .param-grid { display: grid; ... }` → parity 门 **绿**、tsc 0 错。因为判据 E(`h9-public-stats-parity.mjs:199` 的 `PANEL` 写死为 `h9-public-stats.tsx`)只扫 H9 这一个面板的 class,而 `param-grid` 是 G4/H8 用的。自述把「verify 齿轮输出带样本量『面板 33 个 class 在 .hdom 均有样式』」列为 P2-18 的复验方式,那句话证明的是 H9 的 class,与本条修的两个模块无关。通用门被书面延后(理由是量出来的 31 个面板存量,合理),但延后的是根治,不是这两条规则此刻裸奔的事实。
```

**已修(2026-08-06,C 组)**:parity 门加判据 E2——**param-grid 一族**的专用门:扫全部 `{a..m}-tabs/*.tsx` 找 `className` 里用 `param-grid` 的域(**消费面扫出来的,不手写两条名单**;扫到 0 个消费者即 FAIL 防判据失效),逐域要求 `{x}-domain.css` 有主语位 `.{x}dom .param-grid { … display: grid … }` **基础规则**——`@container` 里只改列数的变体不算数(RT25 删的正是基础规则,变体还在,子串判据会被变体骗绿)。当前覆盖 g/h/k/l 4 个消费域,PASS 行打样本量。13 域 × 全部 class 的通用门仍按 P2-18 的书面理由留给存量专项(31 面板命中数字已留档),E2 不悄悄扩权。
**复验方式**:红测 R7 按 RT25 原形删 `.hdom .param-grid` display:grid 基础规则(@container 变体留着)→ **exit 1**「E2 h-tabs 面板在用 param-grid,但 h-domain.css 没有主语位…」;还原 sha256 一致复跑 **exit 0**。G4 侧同规则(`.gdom .param-grid`)被同一判据覆盖。

## P2〔C-后台H9〕P2-19 的更正只写在「收口后要删」的台账里,没有 durable 落点

```
全仓 grep「目前不存在 / public-stats 目前不存在」只有两处命中,都在 `Nexion-uniapp/docs/changes/2026-08-05-pkgG-phase1-findings.md`(第 657 行标题 + 第 668 行修复段),而该文件第 4 行自己写着「包 G 收口后按主人的清理规矩删除」。同一份台账的 P1-2 / P1-3 / P2-4 都专门把结论搬进了代码注释并写明理由「台账收口后要删,注释留得住」,唯独这条没有。同时 `lib/admin/h9-client.ts:4-6` 的头注释把端点写成既成事实(「数据面沿用 H 域既有后端族」),`lib/admin/registry/h.ts` 的 summary 写「唯一配置入口」,两处都不带「端点存否未核实、A/B 待定」的任何痕迹 —— 台账一删,这条待决事项就没了。
```

**已修(2026-08-06,C 组)**:更正落进三处 durable 源码注释——① `lib/admin/h9-client.ts` 头注释端点两行下追加 ⚠️ 段:两个端点是「本文件的契约期望,不是已核实的后端事实」,开发机无 nexion-backend 无法核实,A/B(后端补端点 vs 前端 mock 兜底)待有仓环境或远端确认再定;端点缺席走占位卡不出假数字,不阻塞收口但仍是待决事项。② `lib/admin/registry/h.ts` H9 条目上方加同旨注释(summary 是运营可见渲染面,开发向 caveat 放注释不进文案)。③ `scripts/endpoint-citation-sentinel.mjs` LEDGER 的 `/api/admin/growth/public-stats` 条目注明「上游是否已实现未核实——h9-client.ts 头注释的 A/B 待决即此事」(顺带:本轮新增的两处注释端点引用被 endpoint-citation 齿轮当场拦下,登记后放行——门真的在咬)。台账删除后待决事项在代码里可 grep(「未核实」「A/B」)。
**复验方式**:`grep -n "未核实" lib/admin/h9-client.ts lib/admin/registry/h.ts scripts/endpoint-citation-sentinel.mjs` → 3 文件各 ≥1 命中;verify 齿轮 `[36/37] endpoint citation ledger` PASS(22 处引用 / 17 地址全有据)。

## P2〔A-算力口径〕新门对 pc-gpu 零覆盖:把电脑算力这一路整条判成 0,门仍 57 pass / 0 fail —— ✅ 结构轮已闭

```
破坏注入 B1:把 src/lib/account-hashrate.ts 的 `return baselineTops;` 改成 `return device.kind === "pc-gpu" ? 0 : baselineTops;` → `node scripts/selfcheck-account-hashrate.mjs` 仍 **57 pass / 0 fail, exit 0**,还原后 sha256 一致。根因:门的 `hw()` 只造 HW_CEILING_TOPS 那 6 类(selfcheck-account-hashrate.mjs:210-217),GPU 档位循环(:239-244)只调 `deviceBaselineTops({kind:"pc-gpu"})` 不经过 `deviceEffectiveTops`,`makeInitialDevices()` 又刻意不种 pc-gpu(device-types.ts:121-123 注释写明)。但 pc-gpu 是真实舰队成员:app.ts:356-359 `computeShareEnabled` 打开时 `visibleDevices` 含 pc-gpu,实测 `deviceEffectiveTops(已激活在线 pc-gpu)` = 290 会真进和。即门号称守的『某一类设备被静默漏掉时这条红』(①组原话),对 8 类设备里的这一类根本没接线。
```

## P2〔A-算力口径〕新门的固定靶是写死闭集,漏「新增机型」向:加一个 SKU 全绿,且未覆盖的型号串会静默按 90 TOPS 计入排名 —— ✅ 结构轮已闭

```
破坏注入 B2:往 src/store/device-types.ts 的 DEVICE_SPECS 加一个 SKU(`"stellarrack-p3": { gpu: "16x NVIDIA B200", baseRate: 150, ... }`)→ 门仍 **57 pass / 0 fail 全绿**。HW_CEILING_TOPS(selfcheck-account-hashrate.mjs:210-217)是手写的 6 条字面量,不从 DEVICE_SPECS 派生,加机型既不红也不提示补靶;EXPECTED_CHECKS=57 只守「删」不守「集合本身变大」。叠加 gpu-tiers.ts:70 的 G2 静默兜底,新 SKU 只要型号关键词不在表里就按 90 TOPS/张 计入排名——该例 16×90=1,440,低于 $7,499 的 Rack P2 的 5,280,排序当场倒挂,全程无报错无门。本仓 memory 已有同族规矩(「可枚举内容抽骨架+门」「门集体漏某一向」):判据该锚在 DEVICE_SPECS 的真实键集上,并对『matchGpuTier 走了兜底分支』这个失败特征直接红,而不是枚举 6 条。
```

## P2〔A-算力口径〕durable 注释把 settleDevice 不结算清单写成 3 条(实际 5 条),差出来的那条既无门也无交代:拔了充电器的手机赚 $0 却按 16.5 TOPS 上榜

```
src/store/app.ts:234-240 的清单实际 5 条:`activatedAt===null` / `status!=="online"` / `kind==="cloud-share"` / `pausedReason!=null` / `(kind==="phone" && (isCharging===false || isWifiConnected===false))`。src/lib/account-hashrate.ts:41-42 文件头把它写成「(未激活 / status 非 online / pausedReason 非空)」,scripts/selfcheck-account-hashrate.mjs:8 与 scripts/verify.sh:2509 抄的是同一个 3 条版本——三处 durable 说法一致地少两条。逐条实测排名贡献:前 3 条 = 0 ✓;`isWifiConnected===false` = 0(靠既有模型的 network 因子归零,不是这条判据在守);**`isCharging===false` = 16.5 TOPS** —— settleDevice 对它一分钱不给,排名里却照样上榜。cloud-share 同样在清单里(排名给 90),但那一条文件头显式交代了「收益侧的安排,算力照样在网」,充电这条一个字都没有,门里也没有任何断言把这个取舍钉住。我不主张一定改代码(设备卡对不充电的手机也显示正数 TOPS,聚合与展示自洽,而展示与结算本来就不一致,两边不可能同时对齐);问题在于注释把「权威 = 那张清单」说成了全等关系——按 P1-4 的教训,下一个人照这句话回源,要么把这 16.5 当 bug 修掉,要么把 cloud-share 那 90 删掉,两种都会把刚修好的东西改回去。
```

**已修(2026-08-05,A 组)**:三处 durable 注释逐处改成 5 条全列 + 两条取舍写明 —— ① `src/lib/account-hashrate.ts` 文件头:5 条清单(未激活 / 非 online / cloud-share / pausedReason / 手机未充电或无 WiFi)+ 明写「排名在产判据只取 ①②④ 三条,**不是全等关系**」+ 两条取舍(cloud-share:收益另路、算力在网,排名照算 G2 兜底 90;手机不充电:结算给 $0、排名照算 charge 0.6 打折正数 16.5,与设备卡显示自洽,展示≠结算;断网半条由既有模型 network 因子归 0,殊途同归但守它的是因子不是清单);`deviceEffectiveTops` 行内注释同步。② `scripts/selfcheck-account-hashrate.mjs` 头注释同款 5 条+取舍。③ `scripts/verify.sh` account_hashrate_gate 注释同款(并补 ⑤⑥ 两组新靶说明)。
**复验方式**:grep 三个文件「不结算清单」上下文均已是 5 条版;既有行为断言本就钉着取舍两面(⑤组「手机不充电时贡献下降且 >0」、cloud-share 天花板固定靶 90),注释现在与断言一致,下一个人回源不会把取舍当 bug 改回去。代码零改动(本条只对齐注释),selfcheck 79/0、type-check 0 错。

## P2〔A-算力口径〕「verify 412 pass / 1 fail」复现不出:实测 406/7,其中 6 个浏览器齿轮根本没跑起来,自述对根因的归因也不成立 —— ✅ 结构轮已闭

```
我重跑 `bash scripts/verify.sh` → `━━ result: 406 pass, 7 fail ━━`(日志 scratchpad\auditG-verify.log)。7 条里 6 条全是 `page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173`:R7 + device detail runtime · SPEC-7 K1 device/payment registration gates · AUTH02 registered-number runtime handoff (en) · 同 (zh) · SPEC-4 account-cloud app sync · SPEC-4 runtime session guard。实测 `Get-NetTCPConnection -LocalPort 5173` → **LocalAddress = ::1 独占监听**,127.0.0.1 拒连、localhost 200(所以 verify 前段 curl 探活的齿轮 PASS,后段 Playwright 硬写 127.0.0.1 的全挂)。因此自述那句「IPv6-only 是真的但**不是** AUTH02 的成因,是并发争用偶发」在我这次实测里不成立——6 个齿轮就是被这个绑定挡住的,不是 flaky。第 7 条正是他们上报待拍板的 `markdown residue in i18n copy`(en.ts:342/343/346 注释里的 `**`),仍红。本组自己的门(总有效算力聚合门 57 pass / 0 fail)确实绿,但「verify 全绿」这句话覆盖不到那 6 个没跑起来的运行时齿轮——按本仓 memory「机器门全绿先问门跑了没」,收尾必须列出没跑的门,自述没列。
```

---

# R2 收尾记账(2026-08-06):三条 P2 不在本轮修,理由如下

| 条 | 为什么不修 |
|---|---|
| 弹层连播压住未上榜引导 | 存量转化策略行为(里程碑/代金券自动推送),非包 G 引入;要不要给连播加节流是产品决策,待主人裁 |
| vi 动态流 who 徽章溢出 5px | 脉搏卡之外的组件(同屏抽查捕获),属独立 UI 债,不夹带进包 G |
| syncFailed 同屏降级不一致(三格占位、上方网格条仍显示种子值) | 网格条是营销纹理,规格异常3 只管脉搏三格;统一降级涉及「营销面要不要跟着示弱」的产品取向,待主人裁。现状 = 网格条永远回种子锚,注释已写明 |
