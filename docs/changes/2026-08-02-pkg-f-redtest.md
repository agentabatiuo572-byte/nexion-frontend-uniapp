# FEAT-TRIAL02 哨兵红测留痕(包F · F8)

方法:从 `scripts/verify.sh` 原文提取 TRIAL02 哨兵段(A/B/C 三组)驱动执行;
每个合取项**单独**注入一处真实事故形态的最小残留 → 断言哨兵 FAIL → `cp` 备份还原
(禁 git checkout)→ 复跑绿。基线先证绿(0 fail)再开测,防「注入没生效」假红。

| # | 合取项 | 注入形态(单独) | 注入后 | 还原后 |
|---|---|---|---|---|
| A1 | startWithCard | `export function startWithCard(tokenId){…}` → trial-config.ts | FAIL(1) | 绿 |
| A2 | autoChargeAtEnd | `export const autoChargeAtEnd = true;` | FAIL(1) | 绿 |
| A3 | chargeFailRate | `export const chargeFailRate = 0.01;` | FAIL(1) | 绿 |
| A4 | scheduledChargeAt | `export let scheduledChargeAt = null;` | FAIL(1) | 绿 |
| A5 | trialDisclose | `export const leakKey = "trialDiscloseTitle";` | FAIL(1) | 绿 |
| A6 | trialExtension | `export const leakNs = "trialExtension";` | FAIL(1) | 绿 |
| A7 | trial=1 | `"…wallet-cards-new?trial=1"` 字面量 | FAIL(1) | 绿 |
| A8 | redeemEarly | `export function redeemEarly(){…}` | FAIL(1) | 绿 |
| A9 | markChargeFailed | `export function markChargeFailed(){}` | FAIL(1) | 绿 |
| A10 | cardTokenId(豁免区外) | `export const cardTokenId = null;` → trial-config.ts | FAIL(1) | 绿 |
| A11 | extendedEndsAt(豁免区外) | `export const extendedEndsAt = null;` | FAIL(1) | 绿 |
| A-ctrl | 豁免负控 | 同 token 出现在 free-trial.ts(legacy 迁移读取器所在文件) | **不触发**(by design) | 绿 |
| B1 | Auto-charge | en.ts 注入 | FAIL(1) | 绿 |
| B2 | Auto-purchase | en.ts 注入 | FAIL(1) | 绿 |
| B3 | 自动扣款 | zh.ts 注入 | FAIL(1) | 绿 |
| B4 | 自动完成购买 | zh.ts 注入 | FAIL(1) | 绿 |
| B5 | 绑卡后开始试用 | zh.ts 注入 | FAIL(1) | 绿 |
| B6 | Tự động thu tiền | vi.ts 注入 | FAIL(1) | 绿 |
| B7 | Tự động mua | vi.ts 注入 | FAIL(1) | 绿 |
| C1 | convert() 丢失 | sed `convert()`→`convertRenamed()` | FAIL(1) | 绿 |
| C2 | store 混入钱 API | `…debitBalance(1)` 注入 free-trial.ts | FAIL(1) | 绿 |

第一轮 C1 曾 RED-MISS:原判据 `grep -q "function convert"` 被 `function convertRenamed`
**子串假绿**(grep 子串假阳性坑的镜像形态)→ 已收紧为 `grep -qE 'function convert\(\)'`
后复测转红。此判据修正即本轮红测的直接产出。

结论:21/21 合取项独立转红 + 1 豁免负控通过;PASS 行均携样本量(扫描文件数 / 三语行数)。
