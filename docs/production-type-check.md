# 生产类型检查

`npm run type-check` 使用 `tsconfig.app.json` 检查全部生产 TypeScript 和 Vue，保留原编译器规则，仅将测试入口、测试辅助和 `src/test` 从生产检查根文件拆出。沿用CI现有 `NODE_OPTIONS=--max-old-space-size=2560`，不改变CI容器预算、共享构建脚本或额外降低类型检查heap。2026-11-07 App376 的类型检查通过、H5 打包触及原 1792MiB 堆上限；打包改用 2304MiB，仍在现有 3GiB CI 容器预算内，新的 CI 结果单独记录。

原含测试的完整类型检查保留为 `npm run type-check:all`，原 `tsconfig.json` 不变；按任务需要运行。测试行为继续通过相应Vitest用例验证，本轮名称展示覆盖79项，不能用生产类型通过代替测试行为或TEST页面验收。

App363在原2560MiB Node heap的 `vue-tsc` 阶段以exit134失败，尚未进入H5打包；本地默认4288MiB heap下通过不证明CI适配。该问题与之前App360的CI cgroup OOM、App361的1536MiB打包heap不足，以及临时publisher256MiB OOM分别记录。拆分后的本地2560MiB生产检查exit0、79项行为检查通过；新命令仍需App364原生CI复验，不据本地成功宣称实机内存或业务长稳通过。
