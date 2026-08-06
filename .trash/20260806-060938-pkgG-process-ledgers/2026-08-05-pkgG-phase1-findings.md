# 包 G 阶段一 · 独立证伪发现台账(2026-08-05)

> 🔴 **2026-08-06 勘误**:本文件 :78/:80 附近三条宽度「更正」(77.5/138.4/113.4)方向是**反的**——
> 它们是字体未就绪态的测量。宽度契约唯一权威 = en.ts 槽位契约注释(fonts.ready 定态量法);
> 本文件为过程台账,收口后删,期间禁止拿这三个数字去改任何 durable 文件。

> 主人 2026-08-05 拍板:**全修**。修完一条在该条下写「已修 + 复验方式」。
> 🔴 这是过程台账,包 G 收口后按主人的清理规矩删除,只留成果与机器门。


## P1(6 条)

### P1-1 〔G3-三语文案(FEAT-HOME02 首页网络脉搏 en/zh/vi 新增 9 键)〕新增的 9 个键 0 消费者:首页脉搏卡在越南语下仍渲染硬编码英文副文本,且没有任何机器门守住

**证据**

```
运行时实景(locale=vi,http://localhost:5173/?nx_device=off,375×812)读到脉搏卡 innerText:
```
Thành viên / 1.42M / registered · +2.9% /mo
Thiết bị / 28,429 / live · 51.2k jobs/hr
Hạng của bạn / #18,742 / ↑ 12 in 24h
```
三条副文本全是英文。源头 src/components/home/network-pulse-card.vue:73-78(已提交在 HEAD,不在本 diff 内):
73: `{ k: t.value.home.networkMembers, v: "1.42M", sub: "registered · +2.9% /mo", …`
74: `{ k: t.value.home.networkDevices, v: app.global.activeDevices.toLocaleString(), sub: "live · 51.2k jobs/hr", …`
78: `{ k: t.value.home.networkYourRank, v: "#18,742", sub: "↑ 12 in 24h", …`
全仓 grep 新增 9 键:只有 en.ts:340-348 / zh.ts:329-337 / vi.ts:341-349 三处定义,**0 处消费**。
规格 FEAT-HOME02 line 88 明写「三格标题与副文本…en/zh/vi 三语镜像」。
仓内既有惯例是每道功能门都钉 i18n(verify 输出原文:「创世邀请码码表核销门 … 5 个拒绝文案 key × 3 语真解析取值」「冲正(回滚)自身门 … 3 语 × 3 key i18n 真解析取值」),但 HOME02 的两道门(scripts/verify.sh:2498「排名派生行为门」、:2514「总有效算力聚合门」)**都不含任何 i18n 断言**,verify.sh 里也没有禁止脉搏卡出现硬编码英文串的哨兵 —— 现在这 9 个键靠下游单元自觉,删掉全绿、不接线也全绿。
```

**证伪方建议**:接线单元落地时同步补一道哨兵:断言 network-pulse-card.vue 的三格 sub/value 全部走 `t.value.home.networkXxx`,且该文件内不得出现裸英文串;并做双向红测(把任一 `t.value.…` 换回字面量必须变红)。别只加「新的在不在」的正向断言 —— 按 feedback_fix_claim_is_itself_a_claim,强判据是「旧硬编码串全文还剩几处 = 0」。

### P1-2 〔G3-三语文案(FEAT-HOME02 首页网络脉搏 en/zh/vi 新增 9 键)〕占位文案 networkStatUpdating 在目标值槽里会被截断,交接说明完全没提这一条(只提了未上榜标签)

**证据**

```
值槽实测(同一次 browser session,375 宽):三格值槽内容宽 = 89.3 / 89.3 / 90.3px。槽样式见 src/components/home/network-pulse-card.vue:38 —— `fontSize: '20px', fontWeight: 600, …, whiteSpace: 'nowrap'`,**没有 truncate**(truncate 只在 :39 的 12px 副文本行);卡片外层 :15 `overflow: hidden`,所以溢出是硬裁不是省略号。
canvas 用同一份计算样式(`600 20px "General Sans"…`)量出:
- zh 「数据更新中」= **100.0px**(超槽 ~10px)
- vi 「Đang cập nhật」= **135.4px**(超槽 ~45px,150%)
- en 「Updating」= 88.1px(贴边过)
对照现渲染值:「#18,742」68.6px、「28,433」61.5px —— 这个槽是按 7 位数字设计的。
规格 line 30(异常2)要求「三格显示骨架并在超时后转为『数据更新中』占位 + 重试」,规格 line 34(异常6)明写「不撑破卡片、不换行断字」。
实现方交接说明第 2 条只点名了 `networkRankUnranked` 的溢出,对 `networkStatUpdating` 只字未提。
```

**证伪方建议**:占位态别用值槽的 20px 渲染(降到 12-14px,或整条放副文本槽);或 zh/vi 换更短说法(zh「更新中」≈80px、vi「Đang tải」)。定案前用同一支 canvas 把三语再量一遍 —— 别凭字符数估,vi 的变音符号让实际宽度远超字符数直觉(13 字符 = 140.7px)。

**已修(2026-08-05,文案侧)**:`networkStatUpdating` zh「数据更新中」(98.6px)→「更新中」(59.2px)、vi `Đang cập nhật`(135.0px)→ `Đang tải`(78.5px);en `Updating`(87.3px)本就放得下,保留。三语现已全部落在值槽内。槽位契约已写进 `src/i18n/messages/en.ts` 该键组上方注释(durable,台账删掉也还在)。

**复验方式**:dev server 5173 + `?nx_device=off` + 375×812,用脉搏卡自己那个 20px/600 值槽的 computed style 造隐藏 probe span 逐串量(不是 canvas 估算,是 DOM 实测宽)。**槽实测**:值槽内容宽 89.3px(第 1、2 格)/ 90.3px(第 3 格),General Sans 20px/600、`white-space:nowrap`、**无 truncate**、外层 `overflow:hidden` → 硬裁;副文本槽 89.8px,**JetBrains Mono** 12px/400(不是 General Sans),带 truncate → 省略号。

**本次 9 键逐条实测(px;✗ = 超槽)**:

| 键 | 槽 | en | zh | vi |
|---|---|---|---|---|
| `networkStatUpdating`(改后) | 值 89.3 | Updating **87.3** | 更新中 **59.2** | Đang tải **78.5** |
| `networkRankUnranked`(改后) | 值 90.3 | No rank **73.4** | 未上榜 **59.2** | Chưa xếp hạng **139.1 ✗** |
| `networkMembersSub` | 副 89.8 | +{n}% a month **93.6 ✗** | 每月 +{n}% **67.2** | +{n}%/tháng **79.2** |
| `networkDevicesSub` | 副 89.8 | running jobs **86.4** | 正在跑任务 **60.0** | đang chạy tác vụ **115.2 ✗** |
| `networkRankUp24h` | 副 89.8 | up {n} in 24h **93.6 ✗** | 24h 上升 {n} 名 **100.8 ✗** | tăng {n} bậc / 24h **129.6 ✗** |
| `networkRankUnrankedHint` | 副 89.8 | Activate to get ranked **158.4 ✗** | 激活设备就上榜 **84.0** | Kích hoạt để có hạng **141.6 ✗** |
| `networkRankTipRanked` / `TipUnranked` / `networkStatRetry` | 非本卡定宽槽 | — | — | — |

**交给接线方的硬约束(P1-2 + P2-1 合并)**:

1. 放进**值槽**的任何语言必须 ≤ **89.3px @ 20px/600**(第 3 格可放宽到 90.3)。仅剩 vi `Chưa xếp hạng` 超 —— 未上榜是**标签不是数字**,不该按数字号渲染;实测降档表:16px=111.4 ✗ / 14px=97.3 ✗ / **12px=83.5 ✓**,即 vi 未上榜整态必须降到 12px(或整条移到副文本槽)。含 `hạng` 的越南语说法**没有一条**能在 20px 下放进 90.3px(Chưa có hạng 127.8 / Không hạng 110.0 / Chưa hạng 101.1 / Ngoài hạng 105.6),故不做无意义缩写,保留最地道说法 + 降档。
2. **副文本槽是 JetBrains Mono**,同字号比 General Sans 宽约 15%;上表 5 处 ✗ 会吃省略号(不硬裁,不致命)。这 5 处**本轮未改**——它们不在本条与 P2-1 的范围内,且现网卡片的硬编码 sub(`registered · +2.9% /mo` = 125.4px)本来就已被截断,属存量形态。接线时要么缩文案(可用短式:en `+{n}% /mo` 64.8 / `+{n} in 24h` 79.2、zh「24h +{n} 名」76.8、vi `+{n} bậc/24h` 86.4 / `chạy tác vụ` 79.2),要么让未上榜态的引导文案横跨整卡而不是挤在 1/3 格里。
3. 别用字符数估宽:vi 变音符号 + 空格让 13 字符 = 139.1px,而 zh 5 个汉字只有 59.2px。

**独立复核(第二轮,另起一支 DOM probe 重量)**:值槽 89.3px(1、2 格)/ 90.3px(第 3 格)、副文本槽 89.3px,三语逐键宽与上表一致(±1px 内)。两处更正:① 副文本槽实测 **89.3px** 不是 89.8px;② 「值槽无 truncate / 副槽有 truncate」经回源确认成立 —— `truncate` 挂在 `<text>` 那层(computed `overflow:hidden` + `text-overflow:ellipsis`),叶子 `<span>` 上读到的 `clip` 是读错了层。**逐键实测表已从本台账搬进 `src/i18n/messages/en.ts` 键组注释**:原注释只写了槽宽、把「哪个键多长」指回本台账,而本台账收口后要删 —— 现在契约两半都 durable 了。

**独立复核(第三轮)—— 抓到第二轮往 durable 契约里写错了一行,已改**:

槽几何与值槽结论三轮一致(值槽 89/89/90px、General Sans 600 20px/ls -0.28px、`text-overflow:clip` = 硬裁;副槽 89px、JetBrains Mono 400 12px、ellipsis)。**但 `networkMembersSub` 一行是错的**:第二轮把 `{n}` 按 1 位数字代入量成 en 79.2 ✓,而该键的 n 是 `src/mock/platform-config.ts:32` 的 `registeredUsersMonthlyGrowthPct = 2.9`(恒 3 字符)→ 真实渲染串 `+2.9% a month` 实测 **93.6px ✗ 溢出**(zh 67.2 / vi 79.2)。verdict 从 ✓ 翻成 ✗,已在 `en.ts` 表里更正。

根因不是算错,是**代入值没写下来**:JetBrains Mono 12px 每字符 7.2px,位数差一位就够翻转 ✓/✗,而第二轮的表只写「按 2 位数字量」却对两个插值键用了不同位数。修法:表里**逐键写明 {n} 代入值**(末列),并给 `networkRankUp24h` 补 3 位数上界行 —— 名次变动量纲无上界,只量 2 位是乐观采样。

顺带核出台账里另 3 处小偏差,以第三轮为准(均不翻转 verdict):vi `Đang tải` **77.5**(台账 78.5)· vi `Chưa xếp hạng` **138.4**(台账 139.1)· vi `đang chạy tác vụ` **113.4**(台账 115.2)。

**「短式备选」一组数字台账全错,已重量后写进 `en.ts`**(原值来自第一轮、`{n}` 代入位数不明,照抄就是在 durable 契约上建未核叙事):en `+{n} in 24h` 实测 **72.0 / 79.2**(台账 79.2)· zh「24h +{n} 名」**69.6 / 76.8**(台账 76.8)· vi `chạy tác vụ` **78.0**(台账 79.2)· vi `+{n} bậc/24h` **78.6 / 85.8**(台账 86.4)。九条候选全部入槽。

**范围声明(免得被当成已收口)**:本轮**只收口值槽**(P1-2 / P2-1 的范围,现 0 处硬裁溢出,vi 未上榜按 vi.ts 注释整态降档)。副槽 5 处 ✗ 仍在,**有意不改** —— 未上榜态的 hint 是否横跨整卡而不是挤在 1/3 格里(见 P2-4 归属定案)会直接改掉它的可用宽,文案该多短取决于接线方的布局决定;短式备选已量好放在 `en.ts` 注释里随时可换。副槽溢出吃省略号不硬裁,不致命。

### P1-3 〔G1-算力聚合(FEAT-HOME02 ③ myTotalHashrate)〕任何持有一台托管硬件的账号,名次永远钉死在 57,281 —— 再买 10 台机架也纹丝不动,核心用户故事「加算力看到排名前进」当场失效

**证据**

```
src/mock/platform-config.ts:39-44 种子分位表最高档只到 150 TOPS:
```
hashratePercentileTable: [
  { tops: 5, cumPct: 20 },
  { tops: 20, cumPct: 55 },
  { tops: 60, cumPct: 82 },
  { tops: 150, cumPct: 96 },
],
```
src/lib/account-hashrate.ts:53 `: device.baseRate * TOPS_PER_USD_DAY;`(TOPS_PER_USD_DAY ≈ 468.09)把硬件放到 3000+ TOPS 量级。我用真模块跑 makeInitialDevices() 种子舰队实测:
```
phone          baselineTops=28.3    effective=27.5
cloud-share    baselineTops=88.9    effective=88.9
stellarbox-s1  baselineTops=3276.6  effective=3019.7
stellarbox-pro baselineTops=6085.1  effective=5608.0
stellarrack-p1 baselineTops=21063.8 effective=19412.4
TOTAL = 28156.6 TOPS
```
接 computeRank(realPopulation=1,420,000 + virtual=12,000):
```
phone only        tops=27.5      pct=60.06  rank=571906
+cloud-share      tops=116.4     pct=90.78  rank=132046
+S1               tops=3136.1    pct=96.00  rank=57281
full seed fleet   tops=28156.6   pct=96.00  rank=57281
10x rack P1       tops=194124.3  pct=96.00  rank=57281
```
即:第一台 $649 的 S1 之后,排名格对所有付费用户是一个常数。规格第 19 行用户故事「我想要我的排名真实反映我投入的算力,以便加算力时能看到排名前进、获得正反馈」由此落空。
```

**证伪方建议**:这不是「后台以后标一下就行」的配置洁癖 —— mock 种子就是原型跑起来时用户看到的东西,现在合上就是坏的。两条路二选一,建议 B:
(A) 把分位表最高档抬到硬件量级(如 5/20/60/150/1500/30000),但要保证曲线在 100–30000 段还有分辨力;
(B) 更省事:让硬件天花板别把量纲拉开 500 倍 —— TOPS_PER_USD_DAY 是「$1/日 = 468 TOPS」,而手机是 $0.06/日 = 28 TOPS,同一条线,所以 A 才是对的修法。建议 A + 在 admin H 域「对外公布数据」卡的分位表编辑器上加一条保存前校验:最高档 tops 必须 ≥ 当前最贵 SKU 的反推值,否则字段级红字。
同时把这条焊进 selfcheck:拿真种子舰队 + 真种子分位表算一次 rank,断言「加一台 stellarbox-pro 后名次必须严格前进」——现在这条断言会红。

**未修(2026-08-05)——两处根因都不在本轮可改文件范围内,如实报告不硬凑**。本轮已按「用仓里现成的型号→算力映射」重写了 `src/lib/account-hashrate.ts`(解掉 P1-4 / P2-9),但**这条没被顺带解掉** —— 回源实测,名次仍然钉死:

| 舰队 | 总算力 (TOPS) | percentile | rank |
|---|---|---|---|
| 只有手机(H5 无心跳) | 16.5 | 46.83 | 761,347 |
| 只有手机(满档) | 27.5 | 60.06 | 571,906 |
| 手机 + cloud-share | 117.5 | 90.94 | 129,676 |
| 手机 + S1 | 2,667.5 | **96(封顶)** | **57,281** |
| 手机 + Pro | 5,307.5 | **96(封顶)** | **57,281** |
| 手机 + Rack P2 | 5,307.5 | **96(封顶)** | **57,281** |
| 手机 + **10 台** Rack P2 | 52,827.5 | **96(封顶)** | **57,281** |

两处根因,都在本轮不许碰的文件里:

1. **`src/mock/platform-config.ts` 分位表最高档只到 150 TOPS**,`percentileForTops` 封顶不外推(`network-rank.ts:74`,那是规格异常5 明令的正确行为)。最便宜的硬件是 2,640 TOPS —— 只要买了一台,percentile 恒为 96。**换映射改不动这一条**:旧的日产反推给 3,277,新的规格串映射给 2,640,两个数都远在 150 之上。
2. **`src/lib/gpu-tiers.ts` 最高档 G6 把 RTX 4090 / RTX 5090 / A100 / H100 收在同一档(660 TOPS)** —— 这就是派单里说的「映射覆盖不全」。后果:`stellarbox-pro`($1,199)/ `stellarbox-pro-v2`($1,319)/ `stellarrack-p1`($4,499)/ `stellarrack-p2`($7,499)四个 SKU 天花板**并列 5,280**。**所以只抬分位表也不够**:抬完 S1→Pro 能拉开(2,640→5,280),但 Pro→Rack P2 花 6 倍的钱名次纹丝不动,用户故事照样是坏的。两件事必须一起做。

**为什么不在本文件里凑**:能凑的只有「再发明一条把 SKU 拉开的换算」——那正是上一版踩的坑(P2-9 的成因),按「判据锚在代码已有的显式清单上」不许再走一遍。本文件产出的算力现在与设备自己那行 GPU 规格串**完全一致**,它不是这条的成因。

**结论已写进 `src/lib/account-hashrate.ts` 文件头的「⚠️ 已知天花板(台账 P1-3)」段**(含实测数字与「两件事必须一起做」的顺序约束)——本台账收口后要删,注释留得住。

**复验方式**:esbuild 载真模块 + **真种子分位表**(`DEFAULT_PLATFORM_CONFIG.publicStats`)跑 `accountTotalHashrate → computeRank`,即上表。判据取强的那一面:**不是「rank 算得出来」,是「不同舰队的 rank 有几个不同值」** —— 现在 4 档硬件舰队全是 57,281,数字为 1 就是坏的。修完这两处后该断言才可能变绿,那时按证伪方原建议焊进 selfcheck(「加一台 stellarbox-pro 后名次必须严格前进」)。

### P1-4 〔G1-算力聚合(FEAT-HOME02 ③ myTotalHashrate)〕H5 上只有手机的账号:设备卡显示 16.4 TOPS、结算按 $0.036/日 真给钱,聚合却算 0 → 首页对一个正在赚钱的已激活用户说「未上榜,激活设备就上榜」

**证据**

```
src/lib/account-hashrate.ts:64 `if (device.activatedAt === null || !isDeviceOnline(device, now)) return 0;`
src/lib/hashpower.ts:63 手机的在线判据要求常驻 App 心跳新鲜;src/store/app.ts:288-296 只有 `carrier === "app"` 才盖 `onlineHeartbeatAt` —— H5 载体永远盖不上。
而同一台手机在另外两个面都是「在产」:
· src/components/earn/device-card-pc.vue:455-466 `online: deviceOnline.value` 走 hashpower.ts:139-143 的 hosted-baseline 分支,照样出一个跳动的 TOPS;
· src/store/app.ts:232-238 settleDevice 的不结算清单里**没有**「心跳过期的手机」,:256 给它 `onlineBonus.h5BaseFactor` 继续计息。
我用真模块实测这个账号:
```
isDeviceOnline           = false
设备卡显示 (TOPS)         = 16.4
settleDevice 仍按         $0.0360/day 计息 (0.06 × 0.6)
accountTotalHashrate     = 0
computeRank              = {"kind":"unranked"}
```
规格第 29 行异常1 的「未上榜」是留给**零算力**用户的,现在它会打在一个有算力、有收益的用户脸上;新增文案 zh.ts:333 `networkRankUnrankedHint: "激活设备就上榜"` 会让他去激活一台已经激活的设备。
```

**证伪方建议**:根因是「离线」在这个仓里有两套含义:hashpower.ts 的 isDeviceOnline 是「有没有常驻 App 心跳」(用来决定拿满档还是拿 hosted 档),不是「在不在产」。settleDevice 才是在不在产的权威(:232-238)。
建议聚合层的手机分支不要 hard-zero,而是**原样把 `online: isDeviceOnline(...)` 传给 computeLiveHashpower**,让既有模型自己给 hosted 档的 16.4 —— 这恰好也更贴规格⑦「复用既有单台模型,不新造口径」,反而比现在少一行代码。真正该 return 0 的是 settleDevice 认定不在产的那几条(activatedAt===null / status!=="online" / pausedReason!=null)。
改完补一条断言:同一台手机,`deviceEffectiveTops` 必须恒等于 device-card 那次 computeLiveHashpower 调用的 effectiveTops(现在这条只在心跳新鲜时成立)。

**已修(2026-08-05,按证伪方的根因判断改)**:证伪方对「离线」两套含义的拆解是对的,回源核过 —— `hashpower.ts:52-64` 的 `isDeviceOnline` 只回答「有没有常驻 App 心跳」(决定拿满档还是 hosted 档),`app.ts` 的 `settleDevice` 才是在不在产的权威。现 `deviceEffectiveTops` 的在产判据逐字对齐后者:`activatedAt === null || status !== "online" || pausedReason != null`,**心跳新鲜与否原样传给既有单台模型**(`online: isDeviceOnline(device, now)`),由它给档 —— 比原来还少一行,也正好落回规格⑦「复用既有单台模型,不新造口径」。

**复验方式**:① 门里 3 条针对性断言 —— 心跳过期手机贡献 > 0、且**恒等于** `computeLiveHashpower({online:false})` 的输出(证伪方要的那条恒等断言)、且 hosted 档确实低于满档(判据不空转);② 端到端两条:`makeInitialDevices()` **不补心跳**(H5 真实形态)时每台已激活设备都 > 0,那台手机单独看也 > 0 —— 上一版这里靠测试自己补一拍心跳才绿;③ 双向红测 R4:把 `!isDeviceOnline(device, now)` 加回在产判据 → `exit 1`「心跳过期的手机贡献 > 0 — 得到 0」,还原 → `exit 0` + sha256 一致。

**实测(真模块 + 真种子分位表)**:只有手机的 H5 账号现在 = **16.5 TOPS → rank 761,347**(修前 0 → `unranked`「未上榜,激活设备就上榜」)。

### P1-5 〔G1-算力聚合(FEAT-HOME02 ③ myTotalHashrate)〕新门对「托管硬件天花板」没有任何独立锚 —— 把它整体 ×2 仍 35 pass / 0 fail,而这一项占付费账号总算力的 99%+

**证据**

```
scripts/selfcheck-account-hashrate.mjs:174-178 那条自称 🔴 的硬件判据是**自指的**:
```
const box = hw("stellarbox-s1");
const boxExpected = deviceBaselineTops(box) * getEfficiency(getMonthsOwned(box.purchasedAt, NOW));
check("🔴 ④ 硬件单台 = 天花板 × 既有产能衰减 getEfficiency(另造一条衰减曲线就红)",
  isDegradable(box.kind) && near(one(box), boxExpected, 1e-9), ...);
```
期望值 `boxExpected` 是拿**被测函数** deviceBaselineTops 自己算的,天花板错多少两边同步错多少,判据恒真。
唯一给这条反推直线定锚的是 :184-188 的 GPU 档位回归循环,但它只喂 `{ kind: "pc-gpu", ... }`,碰不到托管机型。
我的红测 N2:把 src/lib/account-hashrate.ts:53 改成
```
: device.baseRate * TOPS_PER_USD_DAY * (device.kind === "pc-gpu" ? 1 : 2);
```
(pc-gpu 分支不动、NaN 仍能传播,绕开那两条顺带抓到的判据)→ 门输出 `exit=0 | 35 pass / 0 fail`。
对照:同一处写死成常数 5000 会红,但红的是「③ 设备数据坏了(baseRate 非数)按 0 计」这条**跟口径无关**的断言 —— 说明抓到纯属侥幸。
```

**证伪方建议**:把 :175 的期望值换成不经过被测函数的独立算式,例如直接用档位表的斜率现算:
`const boxExpected = box.baseRate * (GPU_TIERS.at(-1).tops / gpuTierDailyRate(GPU_TIERS.at(-1))) * getEfficiency(...)`;
再补一条固定靶:`deviceBaselineTops({kind:"stellarrack-p1", baseRate:45})` 必须落在 21000±100(数字写进断言,改动了就红)。
改完必须按 N2 的形态重新红测一次 —— 现在这条断言从未被红测过。

**已修(2026-08-05,独立锚改成写死的字面数字,比证伪方建议的现算式更强)**:证伪方建议用「档位表斜率现算」当期望值,本轮没走那条 —— 现算式仍然经过被测侧的常量,而**字面数字一个函数都不经过**。现在 6 类非手机机型各有一条固定靶,数字直接来自设备自己那行 GPU 规格串:`stellarbox-s1` 2640(`4× RTX 4090` = 4 × G6 660)· `stellarbox-pro` / `pro-v2` / `stellarrack-p1` / `p2` 各 5280(8 × 660)· `cloud-share` 90(`Distributed` 无型号关键词 → `matchGpuTier` 自带 G2 兜底)。改档位表或改规格串 → 这里必须同步改,红是设计不是噪音。

**复验方式(双向红测,原 N2 形态)**:把 `deviceBaselineTops` 的非 pc-gpu 分支整体 ×2(`(device.kind === "pc-gpu" ? 1 : 2) * ...`,pc-gpu 不动以绕开 GPU 档位循环那条顺带判据)→ **`exit 1`,首条 FAIL 正是固定靶**「stellarbox-s1 天花板 = 2640 TOPS — 得到 5280」;还原 → `exit 0`,文件 sha256 与原始一致。**上一版这个形态是 35 pass / 0 fail 全绿的**,现在抓得住。

另:本轮把「日产反推」整条换成了仓里现成的型号→算力映射(见 P2-9),所以证伪方补的第二条固定靶「`deviceBaselineTops({kind:"stellarrack-p1", baseRate:45})` 落在 21000±100」已不适用 —— 那个 21,064 正是被换掉的那把尺子的读数,现在该机型是 5,280。

### P1-6 〔G6-后台H9配置面〕失败横幅承诺「原样重试用同一个幂等键,不会重复落账」,而每点一次「保存变更」都铸新幂等键

**证据**

```
admin-ops/app/components/domain-views/h-tabs/h9-public-stats.tsx:265 原文:「如果是别人同时改了这页,先点「刷新」拿最新值再改;其它情况可以直接再点「保存变更」原样重试(用的是同一个幂等键,不会重复落账),」
admin-ops/app/components/domain-views/h-tabs/h9-public-stats.tsx:193-195 原文:「const save = () => {\n    if (!data || !nextValues) return;\n    const commandKey = createH9CommandKey();」——commandKey 生成在 save() 体内,而 save 就是「保存变更」的 onClick(:278 `onClick={save}`)。
admin-ops/lib/admin/h9-client.ts:135-141 原文:「let commandSeq = 0;\n/** 一次保存意图一个幂等键:失败重试复用同一个键,不会重复落账。 */\nexport function createH9CommandKey() {\n  commandSeq += 1;\n  return `h9-public-stats-${Date.now()}-${commandSeq}`;\n}」——每次调用都是新键;只有在弹窗不关、原地再点「确认」时才复用同一个 run 闭包里的旧键。
```

**证伪方建议**:失败场景:PATCH 已到服务端并落库,响应在网络上丢了 → 页面报失败 + 横幅 → 运营照横幅指引关掉弹窗、再点「保存变更」→ save() 重新执行,铸出全新幂等键 → 服务端收到的是一条全新命令,幂等去重完全不生效(目前只有 expectedVersion CAS 兜住:版本已 7→8,第二次仍报 7 → 409;横幅承诺的那道防线本身是空的)。修法二选一:① 把 commandKey 提到组件 state,按「本次保存意图」生成一次(值/版本变了才换新键),或直接复用同仓既有范式 lib/admin/pending-mutation-store.ts(sessionStorage + fingerprint + 24h TTL,刷新也不丢);② 若不改实现,就把横幅与 h9-client.ts:137 的注释改成事实,别向运营承诺不存在的保护。自述走查第 46 条只断言了横幅文案「存在」,没验证它说的是不是真的——正是「看起来对 vs 运行时证明对」。

**已修(2026-08-05,选证伪方的①:改实现,复用同仓既有范式)**:文案与实现二者**取实现为准** —— 承诺本身是对的,该有的保护补上,而不是把承诺删掉。幂等键改由 `updateH9PublicStats` 从槽位存储取(`lib/admin/pending-mutation-store.ts` 的 `createSlotAttemptStore`,sessionStorage + TTL),指纹 = `{值, 基版本, 理由}`:三者不变 = 同一次保存意图 → 复用同键(关掉弹窗重开、刷新页面都还是它);任一项变 = 新意图 → 换新键并丢弃旧键;服务端返回新版本即 `forget`,下次保存重新铸。键**不由调用方传** —— 一开这个口子就会有人在 onClick 里现铸,承诺又变空;`save()` 里现在一个字都不铸。横幅同步改成与实现同真:「值、版本与理由都不变时用的是同一个幂等键(刷新页面也还是它)」。

**机器门**:`lib/admin/h9-client.ts` 已进 `scripts/pending-idempotency-key-sentinel.mjs` 的 MIGRATED 名单(已挂 verify),回退成内存态铸号就红。

**复验方式**:双向红测 2 例(改坏必红 + 还原必绿 + sha256 round-trip 一致,还原走写回原始字节而非 `git checkout`):① 整个不引共享 store、退回 `let commandSeq` 计数器 → `exit 1` 命中「未引用共享 store」;② 只 import 不调用(迁个空壳) → `exit 1` 命中「只 import 不用等于没迁」。基线绿。

## P2(19 条)

### P2-1 〔G3-三语文案(FEAT-HOME02 首页网络脉搏 en/zh/vi 新增 9 键)〕未上榜标签 en「Unranked」也超槽,交接说明只点名 vi,会让接线方以为 en 安全

**证据**

```
canvas 同字体同字号实测:en「Unranked」= **92.4px** > 值槽 89.3px(第一、二格实测宽);vi「Chưa xếp hạng」= 140.7px;zh「未上榜」= 60.0px(唯一安全的)。
实现方交接说明原文:「`networkRankUnranked` 是**标签不是数字**,vi 最长 13 字符;卡片值槽现为 20px + `white-space:nowrap`、格宽约 90px,按 20px 渲染会撑破」—— 只举了 vi,en 的 92.4px 刚好卡在门槛上被漏掉。
```

**证伪方建议**:契约里把判据写成绝对值而不是「vi 最长」:未上榜/占位态放进值槽的任何语言,20px 下必须 ≤ ~88px,否则整态降档渲染。三语逐条量,别只量最长那条。

**已修(2026-08-05,文案侧)**:证伪方点对了 —— en 确实超。`networkRankUnranked` en `Unranked`(91.4px > 90.3 槽)→ `No rank`(73.4px),顺带满足 P2-5 要求的 rank 隐喻统一;zh「未上榜」59.2px 不动;vi `Chưa xếp hạng` 保留原文,改由接线方对整态降档(理由与降档表见 P1-2 已修行,含 `hạng` 的越南语说法无一条能在 20px 下入槽)。判据已按证伪方要求写成**绝对值**并落进 `src/i18n/messages/en.ts` 键组注释 + vi 该键上方注释,不是「vi 最长」这种相对说法。

**复验方式**:同 P1-2 的 DOM probe 实测(dev 5173 / 375 宽 / 取脉搏卡值槽自身 computed style)。三语逐条量的完整结果见 P1-2 已修行的表格,不是只量最长那条。

**独立复核(第二轮)**:重量确认 en `No rank` 73.4px、zh「未上榜」59.2px 均入槽;vi `Chưa xếp hạng` 138.4px 仍超,12px 降档后 81.6px 可入 —— 与原结论一致。改前的 en `Unranked` 复量 91.4px,确实超 90.3 槽,证伪方点对了。

**独立复核(第三轮)**:第三支 probe 复量 en `No rank` **73.4** / zh「未上榜」**59.2** / vi `Chưa xếp hạng` **138.4 ✗**,与第二轮逐条一致;12px 降档实测 81.6px 入槽(vi.ts 注释里的 83.5px 是真 12px 渲染值 —— 本轮探针把 `letter-spacing` 保留成 20px 档的绝对值 -0.28px 没随字号缩到 -0.168px,故偏窄约 1.5px;两者都 < 90.3,verdict 不变,**以 vi.ts 的 83.5 为准**)。**值槽本轮 0 处硬裁溢出**(vi 未上榜按注释整态降档后入槽)。

### P2-2 〔G3-三语文案(FEAT-HOME02 首页网络脉搏 en/zh/vi 新增 9 键)〕networkPaidToday 已成孤儿键,三语各留一条无人消费

**证据**

```
en.ts:336 `networkPaidToday: "Paid today",` / zh.ts:325 `networkPaidToday: "今日支付",` / vi.ts:337 `networkPaidToday: "Đã trả hôm nay",`。
全仓 grep 该键:除三处定义外,唯一其它出现是 scripts/verify.sh:1719 的**禁止**模式 —— `if grep -qE 'DAILY_PAYOUT_USD|MONTHLY_PAYOUT_USD|PAYOUT_PER_SEC_USD|networkPaidToday' src/components/home/network-pulse-card.vue`,即哨兵专门禁止它回到卡里。**0 个真实消费者**。
规格 line 25 明写「『今日支付』格及其副文本完全消失」;卡片侧已删干净(git diff HEAD 对该文件为空,删除已提交)。
```

**证伪方建议**:和接线单元一起把这 3 行删掉 —— mirror 门会保证三语同删同增,单删一语会立刻变红(我红测证过)。留着不致命,但下次有人搜「今日支付」还会以为它活着。

**已修(2026-08-05)**:三语各删 1 行(`en.ts` / `zh.ts` / `vi.ts` 的 `networkPaidToday`),键总数 4660 → 4659。`scripts/verify.sh:1719` 那条**禁止**模式不受影响 —— 它 grep 的是 `network-pulse-card.vue` 的文件内容,不读 i18n 字典,所以这个键回流到卡里仍会被拦。

**复验方式**:① `grep -rn networkPaidToday src/ scripts/` → 只剩 verify.sh:1719 的禁止模式,`src/` 0 命中;② `node scripts/i18n-key-mirror.mjs` PASS 且 keys 从 4660 变 4659;③ `npm run type-check` exit 0(有消费者的话 TS 会红)。

**独立复核(第二轮)**:三条复跑全部复现 —— grep 只剩 verify.sh:1719 那条禁止模式、门实测 `4659 keys`、type-check exit 0。

### P2-3 〔G3-三语文案(FEAT-HOME02 首页网络脉搏 en/zh/vi 新增 9 键)〕报告把 mirror 门当成「{n} 三语一致」的证明,但那条判据是 INFO 不是门(红测实证)

**证据**

```
红测(隔离副本,项目未动):把 zh `networkMembersSub: "每月 +{n}%"` 改成 `"每月增长"`(占位符丢失)→ `node scripts/i18n-key-mirror.mjs` **仍 exit 0 / PASS**,只多打一行 `home.networkMembersSub: en{n} zh{—}`。
脚本自己写明了这是有意降级 —— scripts/i18n-key-mirror.mjs:107-117 注释「🔴 INFO 级不 fail(2026-07-23 B1 实证)…故降级为清单打印:人定期审阅,不制造门噪音」。
对照:同一支脚本对「漏键」「改键名」两种红测都正确 exit 1,门本身是有效的,只是不覆盖占位符这一面。
实现方交接契约第 1 条写「各带一个 `{n}`,三语一致」,并把 mirror PASS 作为跑过的门列出 —— 今天事实确实一致(我核过基线 6 条 INFO 全是存量键),但这条契约**无门可守**,下游改文案漏 `{n}` 不会有任何红灯。
```

**证伪方建议**:两条路选一:① 接线单元给这 2 个带插值的键(`networkMembersSub` / `networkRankUp24h`)补一条 3 语真解析取值 + 断言含 `{n}` 的 assert(仓内已有大量同形先例);② 至少在交接说明里把话说准 ——「占位符一致是我人工核的,mirror 门不管这一面」。

**已修(2026-08-05,走的是比 ①② 更根治的第三条:把 INFO 升成真判据)**:理由 —— ① 只守这 2 个键,同型缺陷在其余 547 条插值文案上照样能长出来;② 只是把话说准,契约仍然无门。现 `scripts/i18n-key-mirror.mjs` 逐键比较 en 与各语言的 `{xxx}` **对称差**,非空即 `exit 1`。

**不许直接放宽,所以原降级理由靠 `MARK_EXEMPT` 白名单承接**(4 条存量键,每条写明理由 + 真实调用点):`me.networkCardGapDirectRefs → {label}`(en 用它承载 invite/invites 单复数词,zh 无单复数)· `me.networkCardGapVDownlines → {s}` 与 `genesis.purchaseSuccess → {s}`(纯复数字母,调用点 `s: qty > 1 ? "s" : ""`)· `binaryHowItWorks.s4Intro → {freq,unit}`(binary-how.vue 超集传参,zh 取 freq、en/vi 取 unit)。**四条都核过是真语法差异,不是缺陷,故白名单而非修译文。**

白名单自身的三道防扩权纪律:**① 按占位符名授权,不是整键豁免**(同一键漏掉别的占位符照样红)· ② 每条必写理由 · ③ **0 命中即红** —— 某条授权不再对应任何真实差异时,门直接 FAIL 要求删掉它,不许留着做静默扩权。总结行同步改写,如实带出「N 处按白名单授权放行」,不再写成「完全对齐」。

**复验方式(6 例双向红测,改坏→必红 + 还原→必绿,还原用内容精确反替换而非 `git checkout`;4 个被改文件 sha256 round-trip 全部一致)**:

| # | 红测动作 | 期望 | 实测 |
|---|---|---|---|
| N1 | zh `networkMembersSub` 抽掉 `{n}`(**本条原始证据形态**) | 红 | `exit 1` + `未授权差异 {n}` ✓ |
| N2 | vi `networkDevicesSub` 多写 en 没有的 `{zzz}` | 红 | `exit 1` + `未授权差异 {zzz}` ✓ |
| N3 | 被豁免键 `networkCardGapDirectRefs` 的 zh 抽掉**未授权**的 `{n}` | 红 | `exit 1` ✓(证明授权按名不按键) |
| N4 | zh 给 `networkCardGapDirectRefs` 补上 `{label}` → 该授权 0 命中 | 红 | `exit 1` + `MARK_EXEMPT 有 1 条授权已无对应差异` ✓ |
| N5 | zh 改键名 `networkStatRetry` → `networkStatRetryX`(键镜像回归) | 红 | `exit 1` + `missing in zh` ✓ |
| N6 | 把占位符采集器弄哑(**空集假绿**探针) | 红 | `exit 1` + `5 条授权已无对应差异` ✓ |

还原后基线:`PASS: en/zh/vi 4659 keys · 549 条带插值文案占位符逐键对齐(7 处跨语言语法差异按 MARK_EXEMPT 授权放行)`,`exit 0`。

**留给下游的已知天花板**(写出来免得被当成已守):`binaryHowItWorks.s4Intro` 授权了 `{freq,unit}` 两个名字,所以该键若两个都漏掉仍能过 —— 超集传参这个设计的固有代价,要根治得解析调用点,非本脚本职责。另:`verify.sh:84` 用 `ok "$(cat …log)"` 整段回显本脚本输出,现在多出 EXEMPT 清单几行,只是变啰嗦,不影响判定(判定只看 exit code)。

**独立复核(第二轮,重跑 8 例双向红测:改坏必红 + 还原必绿 + 4 个被改文件 sha256 round-trip 全一致 → 8/8 PASS)**。其中两例是上表未覆盖的方向,补齐后判据才算两侧都焊住:

| # | 红测动作 | 期望 | 实测 |
|---|---|---|---|
| R7 | **en(SoT)侧**抽掉 `networkMembersSub` 的 `{n}`(上表只测了 locale 侧) | 红 | `exit 1`,zh/vi 双双报 `未授权差异 {n}` ✓ |
| R8 | 未豁免键 `networkRankUp24h` 的 zh 把 `{n}` 换成别处被授权的 `{s}`(跨键作用域) | 红 | `exit 1` + `未授权差异 {n,s}` ✓ → 授权是 **key+name 二元**的,不是全局名字白名单 |

**独立复核(第三轮,7 例双向红测重跑,7/7 PASS)**:另起一支 harness(改坏→跑门→**内容精确反替换**还原→再跑门→sha256 round-trip),逐例实测:N1 zh 抽 `{n}`(本条原始证据形态)`exit 1` · N2 vi 多写 `{zzz}` `exit 1` · N3 豁免键抽未授权 `{n}` `exit 1`(授权按名不按键) · N4 豁免键补上 `{label}` → `MARK_EXEMPT 有 1 条授权已无对应差异` `exit 1` · N5 改键名 `exit 1` · N6 **en(SoT)侧**抽 `{n}` `exit 1` · N7 把采集器正则弄哑 → `5 条授权已无对应差异` `exit 1`(空集假绿探针)。**7 例全部「改坏必红 + 还原必绿 + sha256 一致」**,基线 `PASS: en/zh/vi 4659 keys · 549 条带插值文案占位符逐键对齐(7 处按 MARK_EXEMPT 授权放行)` exit 0。附:harness 的 fixture 守卫(命中数须恰好 1)在 N7 第一版猜错正则时**拒绝写盘并抛错**,没有留下半改状态 —— 这是刻意的,红测脚本本身写错时必须失败而不是静默改坏别的东西。

R1–R6 按上表原形态复跑,结果一致。另**回源核过 4 条 `MARK_EXEMPT` 的真实调用点**(`network-card.vue:109` 传 `label: 单/复数词`、`:114` 传 `s: remaining===1?"":"s"`、`purchase-sheet.vue:270` 传 `s: qty>1?"s":""`、`binary-how.vue:194` 同时传 `{freq,unit}` 超集):四条都是真语法差异,白名单不是变相放宽。

### P2-4 〔G3-三语文案(FEAT-HOME02 首页网络脉搏 en/zh/vi 新增 9 键)〕规格点击流矩阵里的「未上榜引导文案内的 CTA」没有对应文案键,归属没交代

**证据**

```
规格 FEAT-HOME02 line 78 把它列为**独立可点元素**:「『未上榜』引导文案内的 CTA | 设备/商城既有入口 | 右进左出,回到首页保持滚动位置」。
本次 9 键里与未上榜相关的只有两个:zh.ts:333 `networkRankUnrankedHint: "激活设备就上榜",`(按 network-pulse-card.vue:39 那是 12px + truncate 的副文本槽)和 zh.ts:335 `networkRankTipUnranked: "还没上榜。激活任意一台设备,算力一进网就有名次。",`(轻提示正文)。**没有按钮/CTA 标签键**。
交接说明里也没写「hint 即 CTA」这个决定。
```

**证伪方建议**:要么补一个 `networkRankUnrankedCta`(如 zh「去激活设备」/ en「Activate a device」/ vi「Kích hoạt thiết bị」),要么在契约里把「hint 整条可点即 CTA」写死。现在这个状态,接线方最省事的做法是就地硬编码一句 —— 又回到 P1 那个坑。

**已修(2026-08-05,选证伪方的第二条:定案「hint 整条即 CTA」,不另立键)**。选它不选补键的理由,三条都是回源实测的:① 卡片一格的结构是 label(12px)/ 值(20px)/ 副文本(12px truncate)/ sparkline(32px),**没有放独立按钮的位置**,补一个 CTA 键 = 第 10 个 0 消费者键,恰好是本台账 P2-2 正在删的那类孤儿;② 三语 hint 本来就都以动词开头(「激活设备就上榜」/ `Activate to get ranked` / `Kích hoạt để có hạng`),做点击目标的语感是对的,不需要再造一句祈使文案;③ 规格 line 78 的原文是「引导文案**内**的 CTA」,本就更接近「引导文案即点击目标」而不是「文案里塞个按钮」。

定案已写成 `src/i18n/messages/en.ts` 中 `networkRankUnrankedHint` **上方的注释**(en 是 SoT,接线方一定会打开它找键),含两条禁令:别就地硬编码按钮文案、别把它渲染成不可点的纯说明。**放注释不放台账**是有意的 —— 本台账收口后要删,注释留得住。

**复验方式**:`grep -n -B4 networkRankUnrankedHint src/i18n/messages/en.ts` 能读到归属定案与两条禁令;`grep -rn networkRankUnrankedCta src/` 应 0 命中(确认没有留下第二套说法)。

**独立复核(第二轮)**:`grep -rn networkRankUnrankedCta src/` 0 命中(确认没留下第二套说法);归属定案 + 两条禁令在 `en.ts` `networkRankUnrankedHint` 上方可读。

**留给接线方的开口**:若最终布局能腾出独立按钮位,补 `networkRankUnrankedCta` 只是三语各加一行 + 改这条注释,成本极低;但**不许两套并存**。另:这条决定目前无机器门守(卡片侧哨兵不在本单元可改文件范围内),建议接线单元焊一条「未上榜态该 hint 必须是可点元素」的断言。

### P2-5 〔G3-三语文案(FEAT-HOME02 首页网络脉搏 en/zh/vi 新增 9 键)〕未上榜状态在 en/vi 里 rank 与 board 两套隐喻混用,zh 反而一致

**证据**

```
en.ts:343-346:`networkRankUnranked: "Unranked"` / `networkRankUnrankedHint: "Activate to get ranked"` / `networkRankTipUnranked: "You're not on the board yet. Activate any device and its hashpower gives you a rank."` —— rank 与 board 混用。
vi.ts:344-347:`"Chưa xếp hạng"` / `"Kích hoạt để có hạng"` / `"Bạn chưa lên bảng…"` —— hạng 与 bảng 混用。
zh.ts:332-335:「未上榜」/「激活设备就上榜」/「还没上榜。…」—— 全程「上榜」,一致。
```

**证伪方建议**:en 统一到 rank("You don't have a rank yet. Activate any device and its hashpower gives you one."),vi 统一到 hạng。同一状态三种说法会让用户多想一秒,而这一格恰恰是要把人推去激活设备的。

**已修(2026-08-05)**:按建议逐语统一,**每种语言内部一致,不强求三语共用同一个隐喻**(zh 全程「上榜」本来就自洽,不动它)。

- en 统一到 **rank**:`networkRankUnranked` `Unranked` → `No rank`(顺带解掉 P2-1 的 91.4px 超槽)· `networkRankTipUnranked` 去掉 board —— 改成 `You don't have a rank yet. Activate any device and its hashpower gives you one.`(直接用证伪方给的句子)· `networkRankUnrankedHint` `Activate to get ranked` 与 `networkRankTipRanked` 本就是 rank,不动。
- vi 统一到 **hạng**:`networkRankTipUnranked` 的 `Bạn chưa lên bảng.` → `Bạn chưa có hạng. Kích hoạt một thiết bị bất kỳ, sức mạnh tính toán của bạn sẽ được xếp hạng ngay.`(bảng 已清零;末句改成 `được xếp hạng` 避免「có hạng…có hạng」同词重复)· `networkRankUnranked` / `Hint` / `TipRanked` 本就用 hạng,不动。

**复验方式**:写一支 CRLF 安全(`\r?$`)的探针逐键取值打隐喻标签,**样本量 6 键 × 3 语,全部命中 6/6**(不是「找不到 = 干净」的空集假绿 —— 第一版探针漏了 `\r?` 全返 NOT_FOUND、`board=0`,险些当成已修)。判据取强的那一面:**旧隐喻残留数 = 0**,不是「新词在不在」。

```
en: BOARD=0,4 个排名态键全部命中 rank
vi: BẢNG=0,4 个排名态键全部命中 hạng
zh: networkRankUnranked / Hint / TipUnranked 命中「上榜」;TipRanked 命中「排名/名次」;TipUnranked 两者都有
```

**对本条原始判断的一处更正**:证伪方说「zh 全程『上榜』,一致」时只引了 332-335 里的 3 条,漏引了 `networkRankTipRanked`「排名按…名次越靠前」—— zh 实际是**上榜 + 排名/名次两套词都在用**。但**判定不改、zh 不动**:中文里「榜 / 排名 / 名次」是同一套排名词汇(榜就是排名表),读者不会感到换喻;而英文 board 与 rank 是两个并列名词、越南语 bảng 与 hạng 同理,那才是本条要消灭的形态。这一点写下来,免得下一个人拿「zh 也混用」当新发现重开一轮。

**独立复核(第二轮)**:en 4 个排名态键 0 处 `board`、vi 0 处 `bảng`。全仓 grep 的其余命中全部落在无关命名空间(`teamLeaderboard` / `leaderboard.*` / vi `bảng điều khiển` 等),不属本卡 —— 判据取的是「旧隐喻在**本卡这 4 个键**里还剩几处 = 0」,不是全文件 0 命中那种会被无关词淹掉的弱判据。

### P2-6 〔G3-三语文案(FEAT-HOME02 首页网络脉搏 en/zh/vi 新增 9 键)〕排名格值仍写死 #18,742,零算力用户也照显,违反规格异常1(存量 WIP,源码已自认)

**证据**

```
运行时(locale=vi 全新 context,无设备)脉搏卡仍渲染 `Hạng của bạn / #18,742 / ↑ 12 in 24h`。
源:src/components/home/network-pulse-card.vue:78 `{ k: t.value.home.networkYourRank, v: "#18,742", sub: "↑ 12 in 24h", …`。
规格 line 29(异常1)明写:「Given 用户总算力为 0…**禁**显示一个巨大的假名次」。
该文件 :75-77 已自认这是 WIP:「⏳ 排名格仍是写死值,**下一增量**接真实派生…零算力显示「未上榜」。需要新增三语文案键,而 i18n 文件此刻正被独立验收读取(冻结中),故本增量先不动它。」
另核:规格 line 50 的 `rankSnapshot24h` 字段全仓 0 实现(grep `rankSnapshot|RankSnapshot|rank24|prevRank` → 0 命中),所以 `networkRankUp24h` 目前也是无后端可依的键。派生侧 src/lib/network-rank.ts 已就位且三态齐全(:23-26 `ranked | unranked | unavailable`),与本次 9 键状态空间**完全对齐** —— 这一点我核过,没有漏态。
```

**证伪方建议**:接线单元收口时一并清掉:值走 computeRank 的三态,`#18,742`/`↑ 12 in 24h` 两个字面量归零,并把「零算力必须走 unranked 分支」做成固定靶(现在 lib 有门、UI 没门)。同时补上 rankSnapshot24h,否则 networkRankUp24h 永远渲染不出来 —— 那反而符合规格异常4,但要在契约里写明「快照未实现前这一条恒不渲染」,别让人以为漏接了。

### P2-7 〔G1-算力聚合(FEAT-HOME02 ③ myTotalHashrate)〕新门看不见「产能衰减套错机型」:去掉 isDegradable() 让 cloud-share / pc-gpu 也跟着衰减,仍 35 pass / 0 fail

**证据**

```
src/store/device-lifecycle.ts:52 `export const CAPACITY_EXEMPT_KINDS: readonly DeviceKind[] = ["phone", "cloud-share", "pc-gpu"];` —— 这三类必须恒定 100% 产能。
src/lib/account-hashrate.ts:80 `const capacity = isDegradable(device.kind) ? getEfficiency(getMonthsOwned(device.purchasedAt, now)) : 1;`
我的红测 N4:把这行改成 `const capacity = getEfficiency(getMonthsOwned(device.purchasedAt, now));` → 门输出 `exit=0 | 35 pass / 0 fail`。
原因:scripts/selfcheck-account-hashrate.mjs:174-180 的 ④ 硬件组只造了 `stellarbox-s1`(可衰减机型),豁免机型只在 :121-126 被断言「贡献 > 0」,而衰减后 cloud-share 仍 > 0(地板 0.22)。
实际影响:一个「手机 + Cloud Share」的常见账号(实测 116.4 TOPS,cloud-share 占 76%)持有 2 个月后会被少算 8%,12 个月后少算 78%,而这个算力段正落在分位曲线最陡的地方(pct 90.78),名次会明显后退。
```

**证伪方建议**:在 ④ 组补一条对称断言:`one(hw("cloud-share", { purchasedAt: NOW - 400*DAY }))` 必须**严格等于** `one(hw("cloud-share", { purchasedAt: NOW - 1*DAY }))`(豁免机型跨持有时长全等),pc-gpu 同理。补完按 N4 红测确认变红。

**已修(2026-08-05,判据比证伪方建议的更宽一档:逐机型全验,不只补 cloud-share / pc-gpu 两条)**:现在 ④ 组对 `HW_CEILING_TOPS` 里**全部 6 类机型**逐个断言「持有 400 天与持有 1 天贡献**全等**」——可衰减机型漏了会让用户什么都不做名次也往后掉(P2-11),豁免机型漏了就是本条的套错机型;一条循环同时钉住两面,加机型时自动跟进,不用记得补。另加一条时间向的:非手机部分在 `now` 与 `now+365d` 全等(衰减若从 `now` 这条路溜回来,30 秒的窗口看不见)。

**复验方式(双向红测,两种破坏形态各测一次 —— 只测一种不算数)**:

| 红测动作 | 期望 | 实测 |
|---|---|---|
| N4 原形态:去掉 `isDegradable()`,**所有 kind** 都乘 `getEfficiency` | 红 | `exit 1` ✓ 还原绿 ✓ sha256 一致 ✓ |
| **隔离形态**:反过来只让**豁免机型**衰减(`isDegradable ? 1 : getEfficiency(...)`) | 红 | `exit 1` ✓,首条 FAIL = 「cloud-share 持有 400 天与 1 天全等 — 400 天 19.8 vs 1 天 89.88」 ✓ |

第二例是刻意做的**合取项隔离**:N4 那种「全都衰减」的形态会被可衰减机型那几条顺带抓到,看不出豁免机型这条是不是在搭顺风车。把可衰减机型摘干净后,只剩 cloud-share 那条红 —— 证明它独立承重。**上一版这两个形态都是 35 pass / 0 fail 全绿的**。

### P2-8 〔G1-算力聚合(FEAT-HOME02 ③ myTotalHashrate)〕防空集地板 FLOOR=28 太松:删掉 7 条断言(全部 3 条时间不变 + 全部 4 条接线)正好落在地板上,门照样 exit 0

**证据**

```
scripts/selfcheck-account-hashrate.mjs:250 `const FLOOR = 28;`,而当前实际断言数是 35 —— 留了 7 条的余量,恰好等于两个最关键判据组的总和(:199-212 三条时间不变 + :229-247 四条接线)。
我的红测 N5:切掉 `// ── 🔴 时间不变` 到 `// ── 种子账号` 与 `// ── 接线门` 到 `// 防空集假绿` 两段 → 输出 `exit=0 | 28 pass / 0 fail`,门全绿。
换句话说,这两组「排名不许每秒抖 / 库写好了没人接」的判据可以被整组删掉而不留痕迹,而它们正是自述里 W1 那次假绿逼出来的东西。
```

**证伪方建议**:FLOOR 提到 35(等于当前实际数),并在注释里写明「加断言必须同步抬地板」;或者更省事:把地板改成按组统计,断言 `样本组数 === 6`。地板的意义是「少一条就红」,留 20% 余量等于没有地板。

**已修(2026-08-05,选证伪方的第一条,但改成「恰好等于」而不是「提到 35」)**:`FLOOR = 28`(≥)整个删掉,换成 `EXPECTED_CHECKS = 57`(**===**)。不选「按组统计断言 6 组」那条:组数守不住组内 —— 从某一组里删掉 1 条断言,组数还是 6,门照样绿,那是把同一个洞挪了个位置。失败信息里直接写着该改成几,加断言的人不用猜。

**复验方式(双向红测 —— 只测「删」这一向不算数,「加」那向同样要红)**:

| 红测动作 | 期望 | 实测 |
|---|---|---|
| N5 原形态:整组切掉「时间不变」+「接线」两段(证伪方原始证据形态) | 红 | `exit 1` ✓「断言总数 **47** ≠ 台账 57 …若是有意加断言,把 EXPECTED_CHECKS 改成 47」 |
| **反向**:多插一条 `check()` 而不同步抬台账数 | 红 | `exit 1` ✓「断言总数 **58** ≠ 台账 57」 |

反向那例是判「是等于还是不低于」的唯一强判据:旧的 `FLOOR`(≥)在这一向永远绿。两例还原后均 `exit 0` + sha256 一致。

### P2-9 〔G1-算力聚合(FEAT-HOME02 ③ myTotalHashrate)〕反推出来的硬件 TOPS 与设备自己对外宣称的 GPU 规格最多差 5.6 倍(机架 P2:标称 5,280 vs 反推 35,106),而仓里本来就有 GPU 型号→TOPS 的映射

**证据**

```
src/lib/account-hashrate.ts:11-13 注释断言「托管硬件只有 MH/s 营销数与日产」,据此选了日产反推。但 src/store/device-types.ts:24-28 每台托管硬件都带 `gpu` 型号串,而 src/lib/gpu-tiers.ts:37-41 的 G6 档 keywords 里就有 `"rtx 4090", "h100", "a100"` —— `matchGpuTier()` 能直接把这些串解成 TOPS。我实测两把尺子的读数:
```
stellarbox-s1     gpu="4× RTX 4090"     标称=2640   反推=3277   (+24%)
stellarbox-pro    gpu="8× RTX 4090"     标称=5280   反推=6085   (+15%)
stellarbox-pro-v2 gpu="8× RTX 5090"     标称=5280   反推=6553   (+24%)
stellarrack-p1    gpu="8× NVIDIA A100"  标称=5280   反推=21064  (+299%)
stellarrack-p2    gpu="8× NVIDIA H100"  标称=5280   反推=35106  (+565%)
```
今天不外露(设备卡的 TOPS 读数在 device-card-pc.vue:445-446 被 `phoneRunning` 挡住,只有手机显示),所以不是 P1;但只要将来任何一处显示单台硬件的 TOPS,「8× A100 = 21,064 TOPS」就会和它自己那行 GPU 型号当场打架。
```

**证伪方建议**:不建议改算法(反推口径对排序单调、对手机口径自洽,是对的选择),建议把这个约束显式记下来:在 account-hashrate.ts 文件头补一句「本文件产出的 TOPS 只用于排序,禁止外露为单台设备的规格读数」,并在 verify.sh 加一条极便宜的哨兵:`deviceBaselineTops` / `accountTotalHashrate` 的返回值不许出现在任何 .vue 的模板插值里(只许流进 network-rank)。

**已修(2026-08-05,没走证伪方建议的路 —— 那是给「两把尺子并存」打的补丁,本轮把第二把尺子删了)**:证伪方说「不建议改算法,建议把约束显式记下来 + 加禁外露哨兵」。**这条本轮明确不采纳**,理由是证伪方自己在同一条里给出的:仓里**本来就有**型号→算力的映射(`lib/gpu-tiers.ts` 的 `GPU_TIERS.keywords` 已含 `rtx 4090` / `rtx 5090` / `a100` / `h100`,电脑 GPU 一直走它),而每台托管硬件在 `store/device-types.ts` 的 `DEVICE_SPECS` 里都带 `gpu` 型号串。日产反推是上一版**自己发明的第二把尺子**;留着它再加一道「禁止外露」的哨兵,等于承认两把尺子读数不一致、然后拿哨兵挡住别让人看见。现 `deviceBaselineTops` 非手机分支直接读设备自己那行 `device.gpu`,用既有 `matchGpuTier()` 解档 × 规格串写明的张数。**两把尺子合并成一把,「禁外露」的约束自然消失** —— 将来任何一处要显示单台 TOPS 都不会再和它自己那行 GPU 规格打架。

**复验方式**:两把尺子读数逐 SKU 对比(实测,真模块):

| SKU | GPU 规格串 | 标称 | 旧(日产反推) | 新(规格串映射) |
|---|---|---|---|---|
| stellarbox-s1 | `4× RTX 4090` | 2,640 | 3,277(+24%) | **2,640 ✓** |
| stellarbox-pro | `8× RTX 4090` | 5,280 | 6,085(+15%) | **5,280 ✓** |
| stellarbox-pro-v2 | `8× RTX 5090` | 5,280 | 6,553(+24%) | **5,280 ✓** |
| stellarrack-p1 | `8× NVIDIA A100` | 5,280 | 21,064(+299%) | **5,280 ✓** |
| stellarrack-p2 | `8× NVIDIA H100` | 5,280 | 35,106(+565%) | **5,280 ✓** |

最大偏差 5.6 倍 → **0**。这 6 个数(含 cloud-share 90)已写成门里的固定靶字面量(见 P1-5),规格串或档位表一动就红。

**🔴 顺带查出的映射覆盖缺口(按派单要求列出,不自己发明公式补)**:`GPU_TIERS` 最高档 **G6 把 RTX 4090 / RTX 5090 / A100 / H100 收在同一档(660 TOPS)**,所以上表后 4 个 SKU 天花板**并列 5,280** —— $1,199 的 Pro 与 $7,499 的 Rack P2 算力读数完全相同。今天不外露(分位表 96% 封顶,见 P1-3),但它是 P1-3 的第二个根因,**抬分位表之前必须先给 G6 以上补档**,否则会出现「花 6 倍的钱买机架,名次纹丝不动」。`lib/gpu-tiers.ts` 不在本轮可改文件范围内,故只报不改;结论同步写进 `src/lib/account-hashrate.ts` 文件头(台账收口后仍在)。

### P2-10 〔G1-算力聚合(FEAT-HOME02 ③ myTotalHashrate)〕myTotalHashrate 是读 Date.now() 的 computed —— 非响应式依赖,tick 停摆时整个值冻在过去某一刻,设备在线→离线的切换看不见

**证据**

```
src/store/app.ts:374
```
const myTotalHashrate = computed(() => accountTotalHashrate(visibleDevices.value, Date.now(), cfg.config.onlineBonus));
```
`Date.now()` 不是响应式源,Vue 的 computed 只在 `visibleDevices` / `cfg.config.onlineBonus` 变化时才重算。而 src/store/app.ts:465 `if (miningPaused.value) return;` —— 会话被顶号 / 登出 / 管理员吊销时 tick 直接早退,`devices` 不再被重新赋值,这个 computed 就永久停在最后一次重算的时刻。
后果:src/lib/hashpower.ts:63 的心跳超时判据(`now - onlineHeartbeatAt < timeoutMs`)拿的是一个过去的 now,已经掉线 3 分钟以上的手机仍被当成在线计入排名。对照 src/components/earn/device-card-pc.vue:454 用的是一个会走的 `now` ref,所以设备卡会翻成离线而首页排名不会。
```

**证伪方建议**:两条路,建议第一条:
(A) 让它显式依赖一个已有的秒级 tick ref(设备卡那套 `now` ref 的同款),`computed(() => accountTotalHashrate(visibleDevices.value, nowRef.value, ...))` —— 依赖变显式,同时保留 computed 的缓存。
(B) 若不想引时钟,就把它从 computed 改成一个接受 now 的函数,由调用方(排名格)传入自己的时钟。
配套在 selfcheck 的接线组加一条:getter 体里不许出现 `Date.now()`(现在它出现了,而门第 236-239 行的两条接线判据都没管这件事)。

**已修(2026-08-05,选证伪方的 (B) 而不是他建议的 (A))**:证伪方建议 (A) 让 computed 显式依赖一个秒级 tick ref。**本轮选 (B)**,理由是 (A) 会在 store 里新造一个全局秒级时钟:这个值今天**还没有任何消费者**(见 P2-12),一个每秒 invalidate 一次的全局 computed 是给还不存在的页面预付的开销,而且到时候排名格自己也有 now ref(设备卡那套),就成了两个时钟。现改成 `function myTotalHashrateAt(now: number)`,由调用方传自己的时钟 —— 依赖显式、无缓存失效问题、接线方要秒级还是分钟级自己定。`computed` 整条删除,store return 里换成这个函数。

**复验方式**:① 门的接线组 3 条 —— 函数体里**不许出现 `Date.now()`**(证伪方点名要的那条)、传给聚合的 `now` 必须**就是入参**(正则 `accountTotalHashrate(\s*visibleDevices\.value\s*,\s*now\s*,`,防止改成从别处捞一个时刻)、`myTotalHashrateAt` 必须出现在 store 的 `return` 块里;判据先剥注释再切函数体,切法按位置确定性切片(惰性正则会从别处起跳,上一版就这么假绿过)。② 双向红测两例:把入参换成 `Date.now()` → `exit 1`「算力入参不许自己读 Date.now()」✓;从 store return 里删掉这个名字 → `exit 1`「否则页面拿不到」✓;两例还原均 `exit 0` + sha256 一致。③ `npm run type-check` exit 0。

### P2-11 〔G1-算力聚合(FEAT-HOME02 ③ myTotalHashrate)〕埋雷:硬件产能衰减被放进了排名入参,一旦按 P1-1 重标分位表,S1 用户 12 个月内算力 3277→721,名次会**倒退** —— 规格阳光路径4 明令「永不倒退」

**证据**

```
规格 D:/WORKS/PLAN/PRD/specs/FEAT-HOME02-network-pulse-configurable.md:28「Then 名次**只可能前进或持平,永不倒退**(算力单调 → 排名单调)」。
src/lib/account-hashrate.ts:80-81 把 `getEfficiency()` 乘进了排名入参,而 src/store/device-lifecycle.ts:36,40 的曲线是 `capacity(month 12) ≈ floor = 0.22` —— 单调下降。
scripts/selfcheck-account-hashrate.mjs:208-209 自己也把这件事写进了断言:`t0 - t30 < 0.01 && t0 >= t1 && t1 >= t30`(只降不升)。
今天不发作,是因为它被 96% 封顶掩盖了:S1 从 3277 衰到 721 TOPS 仍远高于分位表最高档 150,percentile 恒为 96。**但 P1-1 的修法就是把最高档抬到硬件量级**,抬完这一层掩盖立刻消失,S1 用户的名次会在 12 个月里持续后退。两个需求在这一点上是直接冲突的。
```

**证伪方建议**:这条要和 P1-1 一起拍板,别分开修。建议:排名入参用**不含衰减的天花板**(deviceBaselineTops),把衰减留在收益侧(settleDevice 已经在用了)—— 理由是排名格回答的是「你投入了多少算力」,那是采购决策,不该因为设备变老而惩罚;而衰减本来就已经在钱那一侧惩罚过一次了,进排名等于罚两遍。
若主人决定保留衰减,则必须改规格第 28 行,把「永不倒退」限定为「同一时刻、算力增加时不倒退」。无论哪条,补一条断言把结论钉住:同一台 S1,now 与 now+365d 的名次关系必须符合被选中的那条口径。

**🔴 本条措辞更正(2026-08-05,回源坐实)—— 原文「硬件产能衰减 → 算力随时间下降 → 名次倒退」里的「算力下降」不成立,别照着这个说法修**:

平台语义是**硬件算力恒定不变,随时间递减的是它能接到的「任务量」**。回源 `src/store/device-lifecycle.ts` 逐条对上:

- 文件头 line 7-12 原文写明模型:平台 AI 任务池不断升级 → 新模型要更多显存 → 高档任务变多、低档任务量萎缩 → **显存固定的设备每月能接的任务变少**;并自陈是「hardware degradation」那套说法的**继任者**(`Successor of the retired "hardware degradation" framing`)。
- 档位表叫 `TASK_CAPACITY_BANDS`(line 33),不叫 degradation。
- `CAPACITY_EXEMPT_KINDS`(line 48-52)注释原文 `Kinds exempt from the **task-mix decline**`,并写明后台把它暴露成「参与任务递减」开关。
- 全文件**没有任何一处产出 TOPS**:`getLifecycleSummary` 的 `efficiency` 乘的是 `device.baseRate`(USD/日),产物是 `dailyRateNow` / `dailyLossUSD` / `monthlyLossUSD` —— 全是钱。

**所以正确的修法不是「防倒退」,是把这个因子从算力聚合里拿掉** —— 把「接多少活」乘进「跑多快」本身就是语义错。拿掉之后算力不随时间变,名次天然不会倒退,规格阳光路径4 自动成立,**不需要任何单调性兜底代码**。

**已修(2026-08-05)**:`deviceEffectiveTops` 的非手机分支直接返回天花板,不乘 `getEfficiency`;`account-hashrate.ts` 文件头写明为什么(排名格回答的是「你投入了多少算力」=采购决策,不该因设备变老而惩罚;何况衰减已经在收益侧 `settleDevice` 罚过一次,进排名等于罚两遍)。规格第 28 行**不用改**。

**同型全扫(派单要求:还有没有别处把「任务量/产出」因子当算力用)—— 结论 0 处**。`getEfficiency` / `getLifecycleSummary` / `getNetworkMonthlyLoss` / `isDegradable` 的全部 4 个消费者逐个回源核过,产物全在钱那一侧:

| 消费者 | 用途 | 产物单位 |
|---|---|---|
| `src/store/app.ts:251` `settleDevice` | 结算计息 | USD / NEX |
| `src/store/device-types.ts:167` | 持有期收益积分 | USD |
| `src/components/earn/device-card-pc.vue:530` | 设备卡产能% / 日产 | % + USD |
| `src/components/earn/device-lifecycle-banner.vue:73,79` | /earn 横幅月度缺口 | USD |

设备卡那个跳动的 TOPS 走的是另一条线(`lib/hashpower.ts` 的 `computeLiveHashpower`),与 `getEfficiency` 无关 —— 即「算力恒定、产出递减」在代码里本来就是分开的两条线,只有上一版的排名聚合把它们串了。

**复验方式**:见 P2-7 已修行的双向红测表(两种破坏形态各一例,含合取项隔离);另加一条时间向断言:非手机部分在 `now` 与 `now+365d` 全等,防衰减从 `now` 这条路溜回来。

### P2-12 〔G1-算力聚合(FEAT-HOME02 ③ myTotalHashrate)〕G1 的产出目前是死代码:全仓没有任何消费者,首页排名格仍是写死的 #18,742 / ↑ 12 in 24h,且两格副文本是硬编码英文

**证据**

```
全仓 grep `myTotalHashrate`,除 src/store/app.ts:374(定义)与 :1472(store return)外,只有一处**注释**:src/components/home/network-pulse-card.vue:76 `//    myTotalHashrate → 百分位 → 名次;零算力显示「未上榜」。需要新增三语文案键,`。
卡片当前实际渲染(src/components/home/network-pulse-card.vue:73,74,78):
```
{ k: t.value.home.networkMembers, v: "1.42M", sub: "registered · +2.9% /mo", ... },
{ k: t.value.home.networkDevices, v: app.global.activeDevices.toLocaleString(), sub: "live · 51.2k jobs/hr", ... },
{ k: t.value.home.networkYourRank, v: "#18,742", sub: "↑ 12 in 24h", ... },
```
三处 `sub` 与排名值全是硬编码英文字面量,绕过了 i18n(verify.sh 的 i18n 哨兵没抓到对象字面量里的字符串);而本次工作树里刚加的 zh/en/vi 三个键 `networkMembersSub` / `networkDevicesSub` / `networkRankUp24h` 正是它们的替代品,现在挂着没人用。同时规格第 29 行异常1(未上榜)、第 32 行异常4(无 24h 快照不许编造 ↑12)也都还没实现 —— 现在这个「↑ 12 in 24h」正是异常4 明令禁止的编造值。
```

**证伪方建议**:如果 G2/G3 就是干这件事,这条只是排期提示,不必现在动。但有两点建议现在就定:
① 「↑ 12 in 24h」是规格明文禁止的编造值(异常4),在 G3 落地前它一直在线上说谎,建议先把这个 sub 置空,比留着假数据安全;
② i18n 硬编码这个形态 verify 抓不到(哨兵只扫模板不扫 script 里的对象字面量),建议顺手给 verify.sh 加一条:.vue 的 `<script setup>` 里出现 `sub:` / `v:` 后面跟纯英文字面量即红 —— 否则同型还会再来。

### P2-13 〔G6-后台H9配置面〕amplifies 挂在纯展示参数上,弹窗谎称「会先检查备付金覆盖率」而实际一次都没查

**证据**

```
admin-ops/app/components/domain-views/h-tabs/h9-public-stats.tsx:221 原文:「amplifies: fleetChanged && nextValues.fleetDevices > data.values.fleetDevices,」(且未传 coverage)
admin-ops/app/components/domain-views/k-tabs/types.ts:8 契约原文:「/** 放大资金流出方向才挂(B1 覆盖率预检):解除误判 / 复审通过解冻 / 调阈值放宽 / 停用规则;冻结 / 驳回 / 确认违规不挂。 */」
admin-ops/app/components/domain-views/h-view.tsx:10 原文:「amplifies 仅放大流出方向(放松 dial / 升奖励 / 升概率 / 升 NEX 奖励 / 降门槛 / 真实奖)。」
admin-ops/app/components/domain-views/design-kit.tsx:681 原文:「{ label: "提交前", text: `${defaultCheck}${amplifies ? "该改动会放大资金流出,系统会先检查备付金覆盖率。" : ""}` },」
```

**证伪方建议**:失败场景:运营把对外公布设备总数 28432 → 30000(纯对外展示口径,不动任何真实资金),确认弹窗「提交前」行告诉他「该改动会放大资金流出,系统会先检查备付金覆盖率」;而 H9 没传 coverage,系统一次覆盖率检查都没做,运营却据此以为有一道资金闸把关。注意 completionCopy 只替换了「影响」行(design-kit.tsx:736),替不掉这句。修法:去掉 amplifies(H9 改的是公布口径不是资金流出),对「改设备总数」的警示已由弹窗自有的 fleetChanged 段落覆盖(:212-215)。

**已修(2026-08-05,按建议去掉 amplifies)**:H9 改的是对外公布口径,一分钱都不流出,也没传 coverage —— 挂着就是在弹窗里向运营承诺一道根本没跑的资金闸。原处留了注释写明**为什么不挂**,免得下一个人照抄别的 H 面板又加回来。改设备总数的警示仍由弹窗自有的 `fleetChanged` 段落负责(那段说的是公布金额口径,不是备付金),覆盖没有变薄。

**复验方式**:`grep -n amplifies app/components/domain-views/h-tabs/h9-public-stats.tsx` → 只剩那条解释性注释,`openActionConfirm` 的入参里 0 处;弹窗「提交前」行因此不再出现「该改动会放大资金流出,系统会先检查备付金覆盖率」。

### P2-14 〔G6-后台H9配置面〕分位表值域后台自造(≤8 档、tops>0)且严于规格与前端,合法配置会把整页锁成不可保存

**证据**

```
admin-ops/lib/admin/h9-client.ts:132-133 原文:「export const H9_BAND_MIN = 2;\nexport const H9_BAND_MAX = 8;」
admin-ops/app/components/domain-views/h-tabs/h9-public-stats.tsx:78 原文:「if (!Number.isFinite(tops) || tops <= 0) errors[index] = "算力档要填大于 0 的数字";」
admin-ops/app/components/domain-views/h-tabs/h9-public-stats.tsx:133-136 原文:「const bandCountError = bands.length < H9_BAND_MIN ? ... : bands.length > H9_BAND_MAX ? `分位表最多 ${H9_BAND_MAX} 档` : "";\n  const allValid = ... && !bandCountError;」
PRD/specs/FEAT-HOME02-network-pulse-configurable.md:117 原文:「| `H.publicStats.hashratePercentileTable` | 档位表 | 是 | 4–5 档种子 | tops 升序、cumPct 单调不减且 ≤ 100;至少 2 档 |」——无档数上限、无 tops>0
Nexion-uniapp/src/lib/network-rank.ts:35-41 原文:「if (!Array.isArray(table) || table.length < 2) return false; ... if (band.tops < 0 || band.cumPct < 0 || band.cumPct > 100) return false;」——前端也无上限,且允许 tops = 0
```

**证伪方建议**:失败场景:服务端下发一张 9 档(或首档 tops=0)的分位表——按规格与前端都合法——后台 allValid 恒 false,「保存变更」永久禁用(:278),运营连改在线率这种无关参数都保存不了,必须先删档/改档,而那等于被迫改掉一个本来合法的配置。而哨兵 C 只比标量 min/max(scripts/h9-public-stats-parity.mjs:111-130),分位表这条完全没门——与该脚本自己写的「规格是权威,后台不许自己定值域」相悖。修法:要么把上限写进规格再焊进哨兵 C,要么删掉 H9_BAND_MAX 并把 tops 判据放宽到 >= 0 与前端对齐。

**已修(2026-08-05,选第二条:以规格为准,删掉后台自造的更严限制)**:`H9_BAND_MAX` 整个删除(规格没有档数上限);面板的 `tops > 0` 改成 `tops >= H9_BAND_TOPS_MIN`,而 `H9_BAND_TOPS_MIN = 0` 逐字取自前端 `network-rank.ts` 的 `band.tops < 0` 门槛 —— 首档 tops=0 现在合法。面板逐行校验与前端 `isValidPercentileTable` 现已项项等价(≥2 档 / tops 严格升序 / cumPct ∈ [0,100] 且单调不减),后台**不再比权威侧更严**,一张 9 档或首档为 0 的合法表不会再把整页锁成不可保存。

**机器门**:哨兵补两条判据 —— **C2** 档数值域随规格(规格写「至少 N 档」就等于 `H9_BAND_MIN`;规格没写上限而后台自造一个就红)、**C3** 单档 tops 下限随前端,**且面板必须真的引用该常量**。C3 的后半是接线门:常量对了没接上,面板照样会自己再写一套判据 —— 那正是本条的原形。

**复验方式**:双向红测 5 例,全部「改坏必红 + 还原必绿 + sha256 round-trip 一致」—— C2a 后台重新自造 `H9_BAND_MAX = 8`(**本条原始形态**)· C2b 档数下限偏离规格「至少 2 档」· C3a 后台 tops 下限退回 1 · C3b 前端把门槛改严而后台没跟(**反方向**)· C3c 面板丢掉共享常量、自己写一条 `tops <= 0`。

### P2-15 〔G6-后台H9配置面〕占位卡/失败横幅会把机器错误码原样丢给运营,违反「页面文案禁错误码 + 运营面必中文」

**证据**

```
admin-ops/lib/admin/h9-client.ts:143-145 原文:「function invalid(field: string): never {\n  throw new Error(`H9_RESPONSE_INVALID:${field}`);\n}」
admin-ops/app/components/domain-views/h-tabs/h9-public-stats.tsx:119 原文:「setError(cause instanceof Error ? cause.message : "H9_DATA_LOAD_FAILED");」
admin-ops/app/components/domain-views/h-tabs/h9-public-stats.tsx:249 原文:「<div className="htint danger">{error || "没拿到服务端权威快照"}。为免拿旧值当真值,这里不显示任何数字,写操作也一并冻结。</div>」
同仓较新范式:admin-ops/lib/admin/d-client.ts:609 原文:「throw new Error(formatAdminApiError("D1_RESPONSE_INVALID", `D1_RESPONSE_INVALID:${field}`));」——先过翻译再抛
```

**证伪方建议**:失败场景:后端把 fleetDevices 写成字符串 "28,432" → parseH9PublicStatsOverview 抛 `H9_RESPONSE_INVALID:values.fleetDevices` → 运营在占位卡上看到的就是这一串英文码。走 /api/admin/growth 的错误已被 growthRequest 的 formatAdminApiError 翻成中文,唯独 h9-client 自己抛的解析错没翻。修法:invalid() 改成 `throw new Error(formatAdminApiError("H9_RESPONSE_INVALID", \`H9_RESPONSE_INVALID:${field}\`))`。(H7/H8 有同族存量债,但同仓已有更好范式,新写的面不该复制旧债。)

**已修(2026-08-05,按建议先过翻译再抛)+ 顺带堵掉同族第二处**:`invalid()` 改成 `throw new Error(formatAdminApiError("H9_RESPONSE_INVALID", ...))`(同 d-client 范式);面板的读失败与保存失败两条路径也都过一遍字典;`lib/admin/error-messages.ts` 补 H9 三条中文(`H9_RESPONSE_INVALID` / `H9_DATA_LOAD_FAILED` / `H9_SAVE_FAILED`)。

🔴 **只做上面这些还是漏的**:运行时探针实测发现,`H9_CONFIG_VERSION_CONFLICT:v7` 这种**带 `:明细` 后缀**的码会原样落到失败横幅上 —— 兜底判据 `MACHINE_CODE_RE` 写的是 `/^[A-Z][A-Z0-9_]+$/`,两头锚死,带后缀的码既命不中字典也命不中兜底,直接从函数末尾 `return raw` 漏出去。而 H9 保存走 expectedVersion CAS、并发必回 409,**那恰恰是这一页最可能遇到的错误**。根因在 41 个调用方共用的那一个正则,所以补在那里(`(?::[\s\S]*)?`),而不是给每个域的字典各塞一批猜出来的后端码(端点契约本机还无法核实,见 P2-19)。静态读代码看不出这一条,是运行时探针抓的。

**复验方式**:判据取强的那一面 —— 不是「有没有调 `formatAdminApiError`」,是**运营眼前那个串里机器码数 = 0**。真 import 该模块跑 5 条真实错误路径(解析错 / 网络错 / 保存失败 / 字典外新码 / 409 带后缀),`[A-Z][A-Z0-9_]{4,}` 残留 **0 处**;含探针有效性反证(未翻译原串必须被同一支检测器判阳性,防检测器哑掉的空集假绿 —— 实测阳性)。双向红测:撤掉后缀那一支 → 探针 `exit 1` 且泄漏复现,还原 → `exit 0` + sha256 一致。改完 `npx tsc --noEmit` 0 错、`npm run verify` 全绿(该函数有 41 个调用方,回归面在 verify 的 node --test 套里)。

### P2-16 〔G6-后台H9配置面〕同一个参数在同一页上有三个名字,规格明令禁止用委婉措辞

**证据**

```
admin-ops/lib/admin/h9-client.ts:120 原文:「label: "排名基数中的虚拟人口",」
admin-ops/app/components/domain-views/h-tabs/h9-public-stats.tsx:260 原文:「<div className="sub">真实注册人口 + 排名基数人口</div>」
admin-ops/app/components/domain-views/h-tabs/h9-public-stats.tsx:217 原文:「⚠️ 排名基数人口填了 0:名次分母只剩真实注册人口({int(data.realUserCount)} 人),用户看到的名次会大幅提前。确认这是有意为之。」
admin-ops/app/components/domain-views/h-tabs/h9-public-stats.tsx:39 原文:「{ title: "名次口径", ... keys: ["virtualUserCount"] }」
PRD/specs/FEAT-HOME02-network-pulse-configurable.md:122 原文:「**永不**在后台用「虚拟用户」以外的委婉措辞混淆该参数用途(运营面要说人话、可读)」
```

**证伪方建议**:失败场景:运营在确认弹窗读到「排名基数人口填了 0」,回表单找不到叫这个名字的输入框(那行叫「排名基数中的虚拟人口」),分组又叫「名次口径」;三个称呼指同一个数,运营要么以为是三个参数,要么找不到弹窗说的那一项。修法:全页统一用「虚拟人口」一个称呼(H9_FIELDS.label 已经写对,顺着它改另外两处即可),规格允许也要求这么直说。

**已修(2026-08-05,按建议全页统一「虚拟人口」)**:表单标签「排名基数中的虚拟人口」→「虚拟人口」· 统计卡副标「真实注册人口 + 排名基数人口」→「真实注册人口 + 虚拟人口」· 确认弹窗警示「排名基数人口填了 0」→「虚拟人口填了 0」。**分组标题「名次口径」保留** —— 它与「平台规模」「用户规模」是同一层的**分组名**,不是参数名,不构成第四个称呼(证伪方把它列进来是对的:在旧状态下运营确实无从分辨,但称呼收敛成一个之后这层歧义就没了)。

改完按「修一处必全站复验同类」扫了同仓其余运营可读面:`docs/后台产品更新日志.md` 与 `docs/cgm/cgm.manifest.json` 里各有两处旧称呼(registry summary 本来就写的是「虚拟人口」),一并改掉 —— 否则运营在更新日志里还是会读到第二个名字。

**复验方式**:`grep -rn 排名基数 --include=*.ts --include=*.tsx --include=*.json --include=*.md .` → **全仓 0 命中**。判据取的是「**旧称呼还剩几处 = 0**」这一面,不是「新称呼在不在」那种弱判据。

### P2-17 〔G6-后台H9配置面〕跨仓 parity 门只焊了「字段名 + 后台↔规格值域」,规格 ⑦ 要求的「默认值三处一致」与前端侧取值域两条无门

**证据**

```
admin-ops/scripts/h9-public-stats-parity.mjs:19-21 判据原文:「A. `PublicStatsConfig` 与 `H9PublicStatsValues` 键集合**双向**相等... B. `H9_FIELDS` 的可写项 = 键集合 − 派生锚点 − 分位表... C. `H9_FIELDS` 每项的 min/max 与规格 ③ 表里的 `[a, b]` 逐字段相等。」——没有默认值判据
PRD/specs/FEAT-HOME02-network-pulse-configurable.md:143 原文:「- 与 [FEAT-HOME02] 前端字段名、取值域、默认值三处一致,焊跨仓逐键等值哨兵。」
前端取值域只在注释里:Nexion-uniapp/src/store/config-types.ts:213 原文:「/** 平台舰队规模锚。合法域 [1000, 1000000]。 */」;前端种子在 Nexion-uniapp/src/mock/platform-config.ts:28-44(fleetDevices: FLEET_DEVICES / onlineRatePct: 100 / onlineJitter: 24 / registeredUsersBase: 1_420_000 / registeredUsersMonthlyGrowthPct: 2.9 / virtualUserCount: 12_000 / 4 档表),两处都无机器比对。
```

**证伪方建议**:失败场景:有人把前端种子 registeredUsersBase 从 1_420_000 改成别的数、或把注释里的合法域改宽,parity 门照绿——正是这道门号称守住的那类静默漂移。我实测当前前端种子与规格 ③ 一致,所以这是门的覆盖缺口而非当下的值漂移。修法:哨兵加判据 D′——把 mock/platform-config.ts 的 publicStats 种子逐键与规格 ③「默认(种子)」列比对(fleetDevices 走锚文件间接比,别在种子里写字面量)。

**已修(2026-08-05,两条都补上了)**:哨兵新增判据 **F**(默认值三处一致)与 **G**(前端侧取值域)。

- **F**:规格 ③「默认(种子)」列 ↔ 前端 `mock/platform-config.ts` 种子逐键比。`fleetDevices` 在种子里是锚常量,按证伪方叮嘱**经 `lib/platform-stats.ts` 间接解引用**取值,不要求种子里写字面量(那本身就是把单源变双源,前端另有 `platform_stats_anchor` 哨兵守那条)。分位表比的是种子档数落不落在规格的「4–5 档种子」区间里。后台侧刻意不比 —— 后台不存本地默认,种子由服务端下发,存一份就又是双源。
- **G**:前端合法域只活在 `PublicStatsConfig` 的文档注释里,所以判据就打在注释上:每个可写标量必须写着 `[a, b]` 且与规格 ③ 逐字段相等。没写、写宽、整块注释消失,三种都红。

两条都带「解析出 0 条即红」的空集守卫。

**复验方式**:双向红测 8 例,全部「改坏必红 + 还原必绿 + sha256 round-trip 一致」。前端侧的探针**没有动 `Nexion-uniapp` 一个字节**(该仓有并行 agent 在写)—— 用哨兵自带的 `NEXION_APP_ROOT` 覆盖指到副本上破坏;副本先做过逐文件 sha256 与真仓一致的断言,且**副本基线必须先绿**,否则整轮红测无意义。8 例:F1 种子 `registeredUsersBase` 漂移 · F2 种子档数越出「4–5 档」· F3 锚常量 `FLEET_DEVICES` 漂移(证明间接解引用**真的在比**,不是静默跳过)· F4 `publicStats` 块改名(空集假绿探针)· F5 锚常量换写法解引用不到(必须报判据失效)· G1 注释合法域被改宽(**本条点名的形态**)· G2 注释里的合法域被删 · G3 整块字段注释消失。

### P2-18 〔G6-后台H9配置面〕顺带扫出的存量 CSS 裸奔比自述报的多一处:param-grid 在 G4 也裸,不只 H8

**证据**

```
用处:admin-ops/app/components/domain-views/g-tabs/g4-admin-operations.tsx:115 原文含「<div className="param-grid">」;admin-ops/app/components/domain-views/h-tabs/h8-referral-rewards.tsx:120 原文含「<div className="param-grid">」
定义:全仓源码 CSS 只有两处 —— admin-ops/app/components/domain-views/k-domain.css:148 原文「.kdom .param-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }」与 admin-ops/app/components/domain-views/l-domain.css:321 原文「.ldom .param-grid { display: grid; ... }」;`.hdom` / `.gdom` 均无(app/globals.css 里也搜不到 param-grid)。
d5-params 的 l-inp 确认属实:admin-ops/app/components/domain-views/h-domain.css:158 新增了 `.hdom .l-inp`,`.ddom .l-inp` 仍不存在。
```

**证伪方建议**:自述只报了 H8,漏了 G4——两个模块的参数卡现在都退化成无 grid 的堆叠。另:新哨兵的判据 E 只扫 H9 这一个面板(scripts/h9-public-stats-parity.mjs:135 PANEL 写死为 h9-public-stats.tsx),同族缺陷在别的域照样能新长出来。建议把 E 抽成通用门:遍历 app/components/domain-views/{x}-tabs/**,逐面板核 class 是否在对应 `{x}-domain.css` 或 globals 里有样式——一条门治整族,而不是每加一个面板补一条。

**已修(2026-08-05,两处都补齐)**:`.gdom .param-grid`(G4)与 `.hdom .param-grid`(H8)按 `.kdom` 那份的规则补进各自域的 CSS —— 两个模块的参数卡不再是无栅格的堆叠。证伪方点对了:自述只报了 H8。

**「把 E 抽成通用门」本轮不做,理由是实测出来的**:照那个判据(面板用到的 class 在对应 `{x}-domain.css` 或 globals 里有**主语位**规则)扫全部 13 个域的 `*-tabs/**`,**31 个面板命中裸 class**(含本条已确认的 `d5-params` 的 `.ddom .l-inp`)。一次性焊上去等于让整条 verify 立刻变红,而且里面掺着 Tailwind 工具类(`c1-search` 的 `gap-2 px-3 sm:grid-cols-2`)和 `active` / `empty` 这类本来就不需要样式的状态修饰类 —— 判据得先分离这批假阳性才立得住。那是一轮独立的存量专项,不该塞进本次修复轮悄悄扩权。**数字留在这里,专项启动时不用重扫。**

另记一条:判据 E 现在的写法是「`.token` 在文件里出现过」,而 `.hdom .p-row .txt` 这种**后代位**命中也算数 —— 所以「E 绿」只等于「这个 class 在本域被提到过」,不等于「这个元素自己有样式」。本轮用主语位判据复扫过 H9 面板的 33 个 class,`.hdom .p-row` 等基础规则确实都在(H 域早有),没有藏着的裸元素;但这层区别写下来,免得下一个人把 E 绿当成更强的结论。

**复验方式**:`grep -rn "\.gdom \.param-grid\|\.hdom \.param-grid" app/components/domain-views/*.css` → 两处规则各就位;verify 齿轮 `[16/36] H9 public-stats cross-repo parity` 输出里带样本量「面板 33 个 class 在 .hdom 均有样式」(PASS 必打样本量,防空集假绿)。

### P2-19 〔G6-后台H9配置面〕「后端 /api/admin/growth/public-stats 目前不存在」这条拍板依据在本机无法证实

**证据**

```
admin-ops/app/api/admin/growth/[...path]/route.ts:4 原文:「const BACKEND_BASE_URL = process.env.NEXION_BACKEND_URL || "http://127.0.0.1:8110";」——后台只是代理,端点在不在要看 nexion-backend 那个仓。
我重跑 npm run verify 的收尾实测输出:「⚠️  verify 完成,但 5/36 个齿轮**未运行**(环境缺件,非缺陷): ⏭ real recharge-channel parity ← 缺 nexion-backend ... 原因:本机无兄弟仓 nexion-backend。」——本机根本没有那个仓可看。
```

**证伪方建议**:这条断言驱动主人在「让后端补端点=一个 sprint」与「前端 mock 兜底」之间拍板,不能当已核实的事实交底。建议改写成:「本机无 nexion-backend 仓,端点是否已存在无法核实;需在有仓的环境或远端确认后再定 A/B」。(记忆铁律:断言「没实现」前先核本地是不是旧分叉线/缺件环境。)代码侧无需改动。

**已修(2026-08-05,按建议改写断言;代码侧确认无需改动)**:原话「后端 `/api/admin/growth/public-stats` 目前不存在」不成立为已核实事实,改写成 ——

> **本机无兄弟仓 `nexion-backend`,该端点是否已存在无法核实;A/B(让后端补端点 vs 前端 mock 兜底)需在有仓的环境或远端确认后再定。**

本轮实测确认这确实是环境缺件而非缺陷:`npm run verify` 36 齿里 5 齿因缺该仓未运行,收尾行自己明写「在这台机器上『verify 通过』只覆盖 31 个齿,涉及跨仓契约的结论不成立」。

**「代码侧无需改动」的依据(回源核过,不是照抄建议)**:后台只有代理路由 `app/api/admin/growth/[...path]/route.ts`,`public-stats` 已进白名单;`app/api/` 下**没有**任何 public-stats 的本地实现或 mock 路由,`h9-client.ts` 与 `growthRequest` 也**没有任何失败兜底**。端点真不在时页面走占位卡:不显示任何数字、写操作一并冻结。也就是说 A/B 未拍板**不会让页面拿假数字冒充真值**,这条不阻塞收口 —— 但它仍是一条待核实事项,不是已完成项。

**复验方式**:`ls app/api/admin/growth/` → 只有 `[...path]`;`find app/api -name "*public-stats*"` → 0 命中;`grep -n "mock\|fallback\|catch" lib/admin/h-client.ts` → 0 命中。
