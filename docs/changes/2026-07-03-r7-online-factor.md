# R7:手机算力在线因子改设备真在线驱动

**状态**:Shipped(2026-07-03 · vue-tsc 0 + verify 165/0 + Playwright 双态翻转 + 结算回归 + nexion-audit P0=P1=0 · 3 轮)
**规格**:`PRD/三端架构改造/specs/SPEC-1-手机算力叙事.md` 文末 R7 章节
**工作线**:④ uniapp · 动已上线收益逻辑(SPEC-1 §6 载体分层),有回归面

## Why
现状因子由编译期 `carrier`(用 App 还是 H5 查看)决定 → 「挂个 App 端即拿高倍,设备没真在线也行」。R7 改为:因子只看**设备真在线态**(App 后台心跳),查看方式不再改因子。

## What changes
1. `store/types.ts` — Device 加 `onlineHeartbeatAt?: number | null`(设备级 App 心跳时间戳;PROD 服务端写,client 只读判定)。
2. `lib/hashpower.ts` — 加 `isDeviceOnline(d, now)` 纯函数 + `ONLINE_HEARTBEAT_TIMEOUT_MS` 常量;`LiveHashInput.carrier` → `online: boolean`;`if (carrier==="h5")` → `if (!online)` 走基线。
3. `store/app.ts` — `settleDevice` 去 carrier 参数,内部读 `isDeviceOnline(d, now)`;`settle()` 里 App 载体(mock 心跳源)为在跑手机刷 `onlineHeartbeatAt=now`(settleDevice 前置)。attestation 分支不动(SPEC-7)。
4. `components/earn/device-card-pc.vue` — `computeLiveHashpower` 传 `online: isDeviceOnline(device, now)`;`isH5`(L105 弱钩子块 + L380 factorLabel)触发条件 `getCarrier()==='h5'` → `!deviceOnline`。
5. `scripts/verify.sh` — carrier-tiering 哨兵语义改写:从「hashpower 必含 `carrier==="h5"` 分支」→「因子由 online 驱动 + settleDevice/hashpower 不读 carrier 定因子」。

## Out-of-scope(不动)
- `lib/carrier.ts` getCarrier() 保留(§96 carrier 作「设备登记载体」+ 心跳来源判定);`entry-surface.ts` / 多端会话 / 数据中心文案的 carrier 引用无关因子。
- 算力卡文案(基础托管/升级 App 拿在线加成)语义仍准确 → 不改,只改触发条件。
- OnlineBonus config 结构不变 → admin compute-config 不动(timeout 作 lib 常量,非运营系数)。
- SPEC-7 attestation / 收益释放不动。

## Impact
- 页面:earn 算力卡(显示)+ 全域收益结算。store:app。i18n:无新增 key。
- 不变量风险:载体分层(§6)必须回归——H5 恒基线 × 0.6、App 含 continuity;lastSettledAt 回拨补算不变。
- PRD 章节:SPEC-1 R7 状态→已实现 + 回执;admin D 表 M4 注记 + FRONTEND-LEVER-MAP(落地后同步)。

## Done-when(逐条回测)
1. `grep 'carrier ===' src/lib/hashpower.ts` = 0;`function settleDevice` 签名不含 `carrier` 参数 —— 因子不读载体。
2. H5(onlineHeartbeatAt 恒 null):算力卡显示基础托管;settle phone Δ6h → todayEarnings 落 `0.06×0.6×[0.8,1.21]×6/24 = [0.0072,0.0109]` 带内(同 §6 回执)。
3. online 分支:onlineHeartbeatAt=now → effectiveTops 含 continuity(>基线);null/陈旧 → 基线。逻辑自测证。
4. 同一设备 onlineHeartbeatAt 固定时,因子不随 getCarrier() 翻转(哨兵防回退)。
5. 机器门:vue-tsc 0 + verify.sh 全绿(哨兵改写后)。
