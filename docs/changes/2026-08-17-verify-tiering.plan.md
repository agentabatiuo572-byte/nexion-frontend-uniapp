# verify 三档制 + 门链去重 · 实施方案

> 配对提案:`2026-08-17-verify-tiering.md`(同目录;原稿 `D:\WORKS\PLAN\WORKFLOW-PROPOSAL-verify-tiering-2026-08-17.md`,主人 2026-08-17 拍板 Q1A-Q5A)· **定级**:L · **包**:`pkg/ar-verify-tiering`(worktree `.claude/worktrees/ar-verify-tiering`)
> **北极星**:门仍绕不过、宣布 done / 合并前必有一次全量绿;但内循环从 ~30 min 降到 1-5 min,全量从 29 min 降到 ~15 min;任何跳过三态点名。
> **状态**:InProgress

## 子任务

### [ ] T2 · 链 runner + 一对共享 server + tsc 增量壳 + h5 探针只跑一遍 + 跑完汇总
- **范围**:`scripts/verify-chain.mjs`(新)`scripts/typecheck-cached.mjs`(新)`scripts/lib/verify-scope.mjs`(新,树指纹/改动集/manifest 匹配共用库)`scripts/verify-h5-runtime.mjs`(加 `H5_RUNTIME_REUSE_BASE_URL` 复用入口)`scripts/run-legacy-suite.mjs`(加复用入口)`scripts/verify.sh`(:234 tsc 走缓存壳;:3629 H5 隔离起服门支持 `H5_RUNTIME_REUSED_TREE`)`package.json` `.gitignore`
- **AC**:
  - AC1:`node scripts/verify-chain.mjs --full` 跑完 18 步全部(一步红不断链),末尾汇总表按 PASS / FAIL / CACHED / SCOPED-SKIP / NOT-RUN 分列,并写 `.verify-cache/last-run.json`(mode/tree/headTree/dirty/steps/verdict)+ `.verify-chain.code`
  - AC2:全量 wall-clock ≤ 18 min(基线 29.1 min);vue-tsc 只跑一遍(第二次命中缓存);h5-runtime 探针只跑一遍(verify.sh 末尾门显示 `复用`);dev server 只起 1 对
  - AC3:红测:① 注入 tsc 错 → type-check FAIL 且其它步照跑;② 改任一 src 文件 → typecheck 缓存失效重跑;③ 复用 h5 结果时若树指纹不等 → verify.sh 末尾门重新真跑
- **测试指令**:在 worktree 根:`node scripts/verify-chain.mjs --full`;`node scripts/typecheck-cached.mjs`
- **敏感度**:普通(门基建;不碰钱/权限/状态机业务码)
- **tester 报告**:
- **回源三问**:

### [ ] T3 · verify.sh 范围化:manifest + `scope_hit` + 23 格重门/18 步骤 inputs + 全局不变量清单 + 三态结果行 + static 模式
- **范围**:`scripts/verify.sh` `scripts/gates.manifest.json`(新)`scripts/lib/verify-scope.mjs`
- **AC**:
  - AC1:`VERIFY_MODE=scoped` 且改动集只含 `src/store/withdrawal-*.ts` 时,只跑命中的重门,结果行 `ran / scoped-skip / fail` 三数与 manifest 推算一致;哨兵第 2 行含 `mode= scoped_skip= tree=`
  - AC2:改动集命中全局清单(如 `src/styles/tokens.css`)→ 自动升 full 并打印原因
  - AC3:未在 manifest 声明的门在 scoped 模式照跑(红测:临时改一个声明外文件,该门仍出现在 ran 里)
  - AC4:`VERIFY_MODE=static` 无 dev server 也能跑完静态部分,server 类门标 `scoped-skip(static)`,exit 码只看 fail
  - AC5:manifest lint(门的门):manifest 里每个 id 在 verify.sh 里有 `scope_hit`,反之亦然;glob 至少命中 1 个存在文件;缺一即红
- **测试指令**:`VERIFY_MODE=scoped bash scripts/verify.sh`(需 BASE_URL)/ `VERIFY_MODE=static bash scripts/verify.sh`
- **敏感度**:普通
- **tester 报告**:
- **回源三问**:

### [ ] T4 · Stop hook 改 A 档 + 合并守卫 C 档指纹 + 逃生阀 + hooks 红测
- **范围**:`Nexion-uniapp/.claude/hooks/verify-on-stop.mjs` `PLAN/.claude/hooks/verify-fresh-before-merge.mjs`(新)+ `test-verify-fresh-before-merge.mjs`(新)`PLAN/.claude/settings.json` `~/.claude/hooks/hooks-selftest.mjs`(登记)`D:/WORKS/PLAN/scripts/pkg.mjs`(close 完成门改走 chain --full)
- **AC**:
  - AC1:Stop 时树指纹等于最近一次绿记录 → 秒退;否则跑 `--static` ≤1.5 min,红 exit 2 并回喂 FAIL 行
  - AC2:Bash 工具里对主线执行 `git merge pkg/x` / `git push origin UniApp|main` 时,若 `.verify-cache/last-run.json` 不是 full 绿或 headTree ≠ 该分支 tip 树 → exit 2 说明;`# ALLOW-UNVERIFIED-MERGE` 放行并留痕
  - AC3:`node ~/.claude/hooks/hooks-selftest.mjs` FAIL=0,新红测 ≥5 条(阳性/阴性/阀/fail-open/他仓不管)
- **敏感度**:普通(harness)
- **tester 报告**:
- **回源三问**:

### [ ] T5 · 元门:manifest lint(每次 verify 内跑)+ `--deep` 双跑比对
- **范围**:`scripts/verify-scope-audit.mjs`(新)`scripts/verify.sh`(接线一格)
- **AC**:故意漏配一条映射 → lint 红;`--deep` 输出 scoped 与 full 失败集差异
- **tester 报告**:
- **回源三问**:

### [ ] T6 · 工作流文本
- **范围**:`nexion-workflow/SKILL.md`(P2/P3/P5/§8)`done-review/SKILL.md`(⑥)`nexion-prd-sync/SKILL.md`(Step1)`Nexion-uniapp/CLAUDE.md`(命令 + 完成门 + [2.6] 段号)`WORKFLOW.md`(§二 [4][5])`nexion-workflow/EVOLUTION-LEDGER.md`(WF-18)· 改 CLAUDE.md 前加载 claude-md-writer
- **AC**:`node audit-routing.mjs` 绿;文本里不再有无机制的「增量哨兵」句;每处写明 `verify:static|scoped|full` 与何时用
- **tester 报告**:
- **回源三问**:

### [ ] T7 · admin-ops verify.mjs 同款(inputs + 跑完汇总 + pass 计数 + gear 27/44 合一 + gear 31 走解析器 + gear 65 计入 skipped + last-run.json)
- **范围**:`admin-ops/scripts/verify.mjs`(+ 必要的 lib)
- **AC**:一齿红不断链且末尾列「没跑」;pass/fail/skip 三数;`.verify-cache/last-run.json` 与 uniapp 同结构
- **tester 报告**:
- **回源三问**:

### [ ] T8 · 陈旧 hook 修复
- **范围**:`PLAN/.claude/hooks/audit-pending-tracker.mjs`(INCLUDE 换 admin-ops/app)`admin-ops/.claude/settings.json`(新,挂同一套门)`Nexion-admin-prototype/.claude/settings.json`(摘 Stop tsc hook)`PLAN/.claude/.audit-skip-* .changelog-skip-*`(Move 到 .trash)
- **AC**:改 `admin-ops/app/x.tsx` 后 `.audit-pending` 出现该行;退役线不再每回合跑 tsc;残留阀 0
- **tester 报告**:
- **回源三问**:

### [ ] T9 · 审计轮次收敛 —— 另出 L 级提案(Q3A),本包只写提案不改 nexion-audit 代码
- **范围**:`docs/changes/2026-08-17-audit-convergence-proposal.md`(新)

## 总回测(全部打勾后才进)
- [ ] 全量机器门:`node scripts/verify-chain.mjs --full` 全绿(既有 2 红另计:contract-registry h2-trial、dom-qa 首页崩)
- [ ] 独立 tester 逐 AC 报告齐
- [ ] hooks-selftest FAIL=0
- [ ] done-review 6 维
