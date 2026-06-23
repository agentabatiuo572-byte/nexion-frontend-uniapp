# CLAUDE.md — Nexion-uniapp

This file provides guidance to Claude Code when working in this repository.

**这是 Nexion 前端的唯一实现面**（主人 2026-06-14 拍板：前端新功能/改动都在这里做，不回 H5 `Nexion-prototype`）。任意 Nexion 任务先加载 `nexion-workflow` skill 判工作线；本工程（④ uniapp 线）任务走 `nexion-uniapp-port` skill（自带四阶段闭环 + React→Vue/uni 映射 cookbook）。

## Heads-up: uni-app (Vue3)，不是 React/Next

本工程是 **uni-app + Vue 3.4.21 + Vite 5 + UnoCSS + TypeScript 4.9 + vue-i18n 9**，目标端 App(iOS/Android webview) + H5，全用 `.vue`（无 .nvue）。源原型 `Nexion-prototype` 是 Next.js/React——迁移时把 React 心智**映射**到 Vue/uni，别照搬 JSX 习惯。

**依赖版本锁（踩坑后锁定，勿升级）**：
- Vue `3.4.21`（勿升 3.5，uni 生态锁定）
- Pinia `2.2.8`（≥2.3 需 vue 3.5，装不上；安装用 `--legacy-peer-deps`）
- UnoCSS `66.7.0` 是 **ESM-only** → `package.json` 必须 `"type": "module"`，`vite.config.ts` 对 uni 插件做 CJS interop（`uniPlugin.default ?? uniPlugin`）

## Common commands

```bash
npm run dev:h5            # H5 dev → http://localhost:5173（verify 期望此端口）
npm run dev:mp-weixin     # 微信小程序 dev
npm run build:h5          # H5 生产构建 → dist/
npm run type-check        # vue-tsc --noEmit（宣布完成前必须 0 错）
bash scripts/verify.sh    # 全量自测：类型 + i18n 镜像 + HTTP200 + 源码哨兵
node scripts/i18n-key-mirror.mjs   # en/zh 双语 key 镜像（94 namespace）
```

`verify.sh` 打 `http://localhost:5173`——dev server 必须在 5173 跑。verify 是 tripwire，不是 typecheck：tsc 过 ≠ verify 过。

## 完成门（宣布 module done 前必走）

1. `npm run type-check` → 0 错。**setup store 别写 `(): ReturnType =>` 返回类型注解**，让 Pinia 自动推导（否则 TS2740）。
2. `bash scripts/verify.sh` → 全绿。含 15+ 源码哨兵：React 残留（`className=`/`useState`/JSX 自闭）、反向词（庞氏/杀猪盘/ponzi）、hex 硬码（禁用色号）、SFC 闭合、native `<button>` 禁用、chassis 完整性、CSS 基础、路由有效性。
3. Browser self-check（Playwright）：每个改动路由 navigate + console error=0 + 截图。**verify 绿 ≠ 渲染 OK**（只有浏览器抓 hydration / 遮挡 / 字色回归）。
4. 清理 `.playwright-mcp/` 和临时 `*.png`。
5. PRD sync：报一句 diff，问主人，确认后走 `nexion-prd-sync`（标准 PRD 风格，不加 changelog）。
6. 产品更新日志：每个功能任务收尾追一条 `docs/前端产品更新日志.md`（🆕/✏️/🗑️ 分类）。

## 架构 big-picture

Mock 驱动高保真原型，无真后端。但**每个 store/model 必须 100% 真后台结构（backend-replaceable），随时可接真后台零重写**。

- **状态**：Pinia setup store（`src/store/`，~46 文件）。全局 `app.ts`/`ui.ts`，业务域各自 store；`locale.ts` 用 uniStorage 持久。
- **i18n**：`src/i18n/messages/{en,zh}.ts` 镜像 key 树（94 namespace）；`use-t.ts` 的 `useT()` + `format.ts` 的 `fmt()`。**加 key 必两文件同序**；硬编码英文 = regression。
- **路由**：`pages.json`（navigationStyle custom）+ `src/lib/route.ts` 把原型嵌套逻辑路径映射成 uni 扁平物理路由。导航一律走 `navTo()`，不直接 `navigateTo()`。
- **外壳**：`components/app-chassis.vue`（路由感知 header + tabbar pill + nova 浮标 + 下拉刷新 + 进场动画）；`global-ui.vue`（toast/confirm/netError）。
- **设计 token**：`src/styles/tokens.css`（108 个双主题 CSS 变量 `--v5-*`）。颜色用 token 不写 hex；亮底文字用 `--v5-on-brand`。
- **行尾**：源文件 CRLF（Windows），verify/grep 正则用 `\r?`；`<text>` 必须裹在 `<view>` 内。

## 工作约定

- 设计/UI/文案/新组件前强制加载 `nexion-design` skill（V5 dark + Ponzi 仿真 + 反向教育样本：产品内 0 meta）。
- 完成自检走 `done-review`；功能性任务后走 `nexion-audit`（3-agent 并行修到 P0=0）。
- 删除文件先 Move 到 `<root>\.trash\<时间戳>`，禁 `Remove-Item -Force`（用户级 PreToolUse 守卫 hook 兜底，缓存目录放行）。

## 关键文件

- 迁移台账：`docs/PORT-LEDGER.md`（源坐标 + 版本锁 + 页面矩阵 + 进度）
- 踩坑登记：`docs/PORT-PITFALLS.md`（P-001~，每条已转脚本哨兵或硬规则）
- 产品日志：`docs/前端产品更新日志.md`
- 源原型：`D:\WORKS\PLAN\Nexion-prototype`（迁移源 / 历史参考）
- 前端 PRD：`D:\WORKS\PLAN\PRD\Nexion_产品功能架构设计文档_v3.7.md`（`nexion-prd-sync` 同步对象）
