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
- [ ] vue-tsc 0 err
- [ ] verify.sh 全量绿(哨兵新行 PASS 出现在输出里 = 门已接线)
- [ ] 浏览器三语实测(proof 页,浏览器语言与应用语言错开)+ 截图
- [ ] 独立 tester 黑盒验收(报告落同目录 `2026-08-15-date-locale-unify-t1-test.md`)
- [ ] 合并回 UniApp 主线(主线只收合并)
