# 2026-08-15 · date-locale-unify（pkg/zp-date-locale）

**Status**: Aligned（方向 = 主人转发的独立 tester 判据 + 指定修法,视为已对齐;S/M 级机械同型清扫)

## Why

独立 tester 2026-08-15 验收发现(既有问题,非当轮引入):proof 页 "Member since" 用
`toLocaleDateString(undefined, …)` = 跟**浏览器**语言;应用语言 ≠ 设备语言时出混语日期
(实测 en 页 "Member since 2026年7月"、vi 页 "Thành viên từ 2026年7月"),同字符串还画进分享海报 canvas(约 L348)。
全站扫同型共 **22 处 / 17 文件**(无参 / `undefined` / `[]` 三种形态)。
wallet-bills 早已单点修过(本地 `localeTag`)但未扫全站——本包补「修一处必修全部」。

## What changes

- `src/i18n/format.ts` 新增单源 **`dateLocale()`**:应用语言(locale store)→ BCP-47
  (en→en-US / vi→vi-VN / zh→zh-CN;词典未落地语言随 UI 文案回退 en-US,避免反向混语);
  computed 内调用读 store,切语言即重算。
- 22 处 Date 格式化(`toLocaleDateString` / `toLocaleTimeString` / Date 的 `toLocaleString`)全部改传 `dateLocale()`;
  wallet-bills 本地 `localeTag` computed + `useLocaleStore` 引用收编删除。
- `scripts/verify.sh` 焊哨兵 `date toLocale* pins app locale (dateLocale())`;`docs/PORT-PITFALLS.md` 登记 P-096。
- **skeptic 对抗轮**(3 条 P1 全采纳):feed 两处 `toLocaleTimeString` 钉 `hour12: false`(防 en 应用 12h 撑破固定栅格列);
  tag 表补全 11 语 + `Record<LocaleCode, string>` 类型锁,启用与否由 `code in DICTS` 派生(消灭第二张手抄开关表);
  哨兵扩容 4 分支(navigator.* / 字符串字面量 / Intl.DateTimeFormat / `[ ]` 变体),合成探针 11/11 红、真实 src 0 误伤。

**Out of scope**:数字千分位 `Number#toLocaleString()`(~150 处,部分已定点 "en-US")不属于「混语日期」族——
数字分组无月名等语言词,视觉混感极低,且全站统一属产品口径决策(vi 会变 `1.234,56`),不在本包动。

## Done-when

1. 浏览器语言 ≠ 应用语言时,proof 页 memberSince 按**应用**语言渲染(en=英文月名 / vi=越南语 / zh=中文),海报 canvas 同步(同一 `memberSinceText` 源)。
2. 哨兵 grep 修后 = 0 命中;修前基线 22 命中(四种缺陷形态全有真实红证)。
3. proof 页内切换语言不刷新即重算(`joined` 是 computed,依赖 locale store)。
4. `vue-tsc` 0 err;`bash scripts/verify.sh` 全量绿(445 基线不倒退);en/vi/zh 三语浏览器实测截图。

## Impact

- 页面:proof / profile / trial / daily / orders / order-detail / wallet-bills / wallet-exchange / wallet-nex /
  globe / developer / binary / commissions / genesis-holder;组件:trial-countdown-hero / stake-sheet /
  position-row / earnings-ledger-card / live-feed-card;根:App.vue(grace toast)。
- store 无改动;i18n key 无增删;持久键无改动。
- PRD:缺陷修复,恢复 i18n 不变量(文案已随应用语言,日期本就该随)——判**不同步**。

## 实施拆解

- [x] format.ts 落 `dateLocale()` 单源
- [x] 22 处调用点接线(含 wallet-bills 收编)
- [x] verify.sh 哨兵 + PORT-PITFALLS P-096
- [x] skeptic 证伪轮 → 3 条 P1 修复(hour12 / 类型锁+DICTS 派生 / 哨兵扩容+红测 11/11)
- [x] vue-tsc 0 err
- [~] verify.sh 全量:R3 = **435 PASS / 15 FAIL(exit 1)**——15 条全为运行时探针「加载超时/覆盖为空」族,零断言失败。
  定性为环境红,证据链:① 同套门当日晨间基线 445/0/0;② 三轮 FAIL 集与本包 diff 零交集(auth/register/entry-surfaces 无日期格式化);
  ③ 实测 dev server 喂满一轮探针流量后进程膨胀至 4.8GB、**空载 shell 31s**;④ 最小复现:同一秒内裸 `/` goto 超时 30s、
  紧接的 hash 路由 goto **528ms 成功** = 服务器侧请求队列拥塞(被杀探针客户端的残留转译积压),非页面问题;
  ⑤ 「单浏览器串行耐心」模式当晚 176 次 goto 全成(预热 91/91 + 88/91),一门一浏览器的探针模式则集体超时;
  ⑥ 我的浏览器在「失败」页(index/proof/me)全部秒级实景渲染,console 无应用错误;⑦ 当晚机器同时挂 3 个 uni dev server(两个属其它会话)。
  另:cross-repo sampling 门红 = admin 仓审计脚本指向已改名的 `NX1.0-UniApp`(现 `NX1.0-UniApp-UI`),与本包无关,已挂修复芯片。
  🔴 **未清账**:静机(其它会话服务器停掉后)复跑 `BASE_URL=… bash scripts/verify.sh` 全绿才许合并主线——runbook:
  `VITE_NEXGRID_API_MODE=mock npm run dev:h5 -- --port 5223` 起新服务器 → `node <scratch>/warm-all-routes.cjs` 预热 → 全量 verify。
- [ ] 浏览器三语实测(proof 页,浏览器语言与应用语言错开)+ 截图
- [ ] 独立 tester 黑盒验收(报告落同目录 `2026-08-15-date-locale-unify-t1-test.md`)
- [ ] 合并回 UniApp 主线(主线只收合并)
