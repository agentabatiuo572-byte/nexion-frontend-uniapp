# NX1.0-UniApp 项目规则

正式 App 仓库。跨项目定位见 [Nexion 项目地图](C:/Users/72921/.codex/context/nexion.md)；高保真参考位于 `D:\workspace\NX1.0-Prototype`，真实业务状态以正式后端为准。

## 分支与同步

- 保留分支为本地 `main` 和 GitHub `main`（2026-09-05 决策）。不得自行创建 `UniApp`、`pkg/*` 或 `codex/*` 分支。
- 已授权代码修改任务完成后，自动提交并推送本任务改动，报告推送范围；只读审计、咨询和方案不触发同步。不得夹带用户或其他任务的未提交改动。
- 推送前 `git fetch` 并比较本地与远端；快进推送无须重复确认。非快进或覆盖远端独有提交需要当前明确授权，不能默认 force-push。
- 2026-09-11 起，本机验证通过后的常规提交获得持续授权，无须逐次请求人工确认；此授权不包含覆盖远端或跳过验证。

## 提交与推送门禁

- `.githooks/config.json` 与 hook 脚本是机器执行规则。取消按文件数量、`docs/changes/` 路径和已有未推送提交划分的人工审批门槛。
- 提交前将本任务改动暂存，在待提交代码上运行 `npm run verify`，并完成任务所需的本机验收。验证通过后自动提交，不再申请 `ALLOW_MAIN_COMMIT` 或当次主线例外。
- pre-commit 核对 `.verify-cache/last-run.json` 的 `full`、通过、运行中树未变，以及 `commitCandidate` 与当前 HEAD、暂存树完全一致。验证工作树须与暂存树一致；验证失败、代码变化或记录缺失时先修复或重验，不以人工确认替代验证。
- 有其他任务的未提交改动时，使用不创建分支的隔离工作树准备并验证本任务提交，保持原工作区和暂存区内容；不得为了门禁把无关文件一并暂存。
- 推送远端 `main` 前，在最终提交后、干净工作树上运行 `npm run verify`。`.verify-cache/last-run.json` 必须记录 `full`、通过、运行中树未变，并匹配待推送提交的树。scoped/static 检查不能替代该门禁。
- 已知失败只按 `scripts/known-red.json` 中有理由、有期限的现行记录处理，不为通过本次检查临时放宽。
- 当前环境无法完成 full verify，或无关脏改动阻止验证时，保留本任务改动并说明未同步原因；不要自动创建逃生分支。
- 正常提交自动记录于 `.verify-cache/commit-verified.log`；旧 `ALLOW_MAIN_COMMIT` 不再用作放行开关。`ALLOW_UNVERIFIED_PUSH=<reason>` 仍仅限当前明确授权并写入 `.verify-cache/push-valve.log`，自动提交授权不覆盖此例外。禁止 `--no-verify`。
- `prepare` 安装 hooks；需要修复安装时使用 `git config core.hooksPath .githooks`。门禁行为自测：`npm run test:githooks`。
