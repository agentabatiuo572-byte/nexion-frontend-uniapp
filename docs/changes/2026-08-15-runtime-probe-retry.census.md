# Runtime 探针族 census(T1 产出 · 供 T2 换装 + T3 selftest 期望数)

- 生成:2026-08-15,基于 UniApp `811e0f1` 的 `scripts/verify.sh`(3400 行版)。行号=当时锚点,T2 换装时逐点回源重核(SPEC-7 会话可能先改此文件)。
- 判据:**构造性**——脚本源码真含 `playwright|chromium|page.goto|process.env.BASE_URL` 才算 runtime(不是手写名单);两个子串假阳性已剔除(见下)。

## 包装族(14 脚本 / ~15 真跑调用点;`--selftest` 行一律不包)

| 脚本 | 真跑调用行(锚) | 备注 |
|---|---|---|
| auth-system-chrome-runtime.mjs | 456 | bare login-entry 几何 |
| spec6-entry-surface-runtime.mjs | 1281 · 1568 | **两个调用点**(runtime + isolation) |
| r7-device-detail-runtime.mjs | 1292 | |
| spec7-risk-gate-runtime.mjs | 1499 | K1 注册/支付门 |
| auth-register-existing-runtime.mjs | 1505 | AUTH02,per-locale 循环(en/zh),轮2抖动成员 |
| spec4-account-cloud-app-sync.mjs | 1655 | |
| spec4-runtime-session-guard.mjs | 1660 | |
| theme-constant-gate.mjs | 2624(2617/2620=selftest 不包) | 真 chromium+goto |
| zero-border-gate.mjs | 2645(2638/2641=selftest 不包) | 真 chromium+goto |
| dom-qa.mjs | 2666 · 2669(2659/2662=selftest 不包) | **两个调用点** |
| tap-feedback-probe.mjs | 2689(2682=selftest 不包) | |
| empty-state-probe.mjs | 2742 | |
| withdraw-bill-runtime.mjs | 2939 | `BASE_URL=` 前缀式调用 |
| verify-h5-runtime.mjs | 3383 | 自带隔离起服,轮3抖动成员;重试=整probe重跑(~2min)可接受 |

## 明确不包(判据+理由)

- `endpoint-citation-sentinel.mjs` — 假阳性:命中的是 SKIP_DIR 列表里的 `.playwright-mcp` 字符串,实为静态扫描器(P-012 同款子串坑)
- `selfcheck-remote-refresh-resilience.mjs` — 假阳性:命中的是 `VITE_NEXGRID_API_BASE_URL` 变量名子串,实为注入式模拟,无浏览器
- `selfcheck-config-compat.mjs` — 无浏览器标记;模式相关但给定模式下确定性 → 失败=真问题
- 跨仓文件检查(SPEC-7 parity / wd02 契约锚 / uniapp-port-coverage-audit)— 确定性文件读,失败=真欠账
- 全部 `--selftest` 调用行 — 红测自证必须保持确定性锐度
- 其余 51 个逻辑/静态哨兵 — 确定性门,重试无意义且掩盖不该存在的非确定性

## 交叉核对(T1 AC)

- ✅ 三轮抖动成员全在族内:AUTH02(zh)→auth-register-existing-runtime;H5 门→verify-h5-runtime
- ✅ 16-fail 假红名单(remote 模式误跑)中所有浏览器成员均在族内;不在族内的成员(config-compat / SPEC-7 parity / 契约锚 / 采样证据 / API-mode preflight)均为确定性门,分类一致
- T3 selftest 期望数:**真跑调用点 = 14**(T2 在 SPEC-7 落地后的 `00069e6` 上逐点重核钉死;初版 15 是两处假锚——「spec6 第二调用点」实为 sentinel_present 静态哨兵行提到脚本名,「dom-qa 第二调用点」实为 bad 消息行,均非真调用)
- T2 换装终值:14/14(env 前缀形态 8 点用 `probe_retry env ...`,普通形态 6 点用 `probe_retry ...`);T3 红测:基线绿 + 解包 1 点→③红(13≠14)+ 废重跑臂→②红,三变异均先证落地再看判定,演示在草稿副本上做、真文件零污染
