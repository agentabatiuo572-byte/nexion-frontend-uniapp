# PORT-PITFALLS — Next.js/React → uni-app 迁移踩坑登记

> 「反思 → 进化」台账。每批迁移收尾把新踩的坑追加于此，并尽量转化为
> `scripts/verify.sh` 哨兵或 `nexion-uniapp-port` SKILL 硬规则，让机制随每轮变强。
> 对标后台 `NEXION_DEFECT_REGISTER` / `PORT-LEDGER`。

格式：`#编号 [阶段] 症状 → 根因 → 对策(+是否已转哨兵/规则)`

---

## Batch 0（地基 + 机制）— 已踩 9 坑

### P-001 [脚手架] `unocss/vite` ESM-only 致 vite config 加载失败
- **症状**：`ERROR: "unocss/vite" resolved to an ESM file. ESM file cannot be loaded by require` → `failed to load config`。
- **根因**：vite 默认按 CJS bundle `vite.config.ts`；unocss 66 是 pure ESM，require 不了。
- **对策**：`package.json` 加 `"type": "module"`（项目自身无 .js，对 uni 影响面小）。
- **已转**：SKILL「脚手架」硬规则。

### P-002 [脚手架] type:module 后 `uni is not a function`
- **症状**：加 type:module 后，config 走 ESM，`import uni from "@dcloudio/vite-plugin-uni"` → `uni is not a function`。
- **根因**：vite-plugin-uni 是 CJS，ESM interop 下可调用体落在 `.default`。
- **对策**：`const uni = (uniPlugin as any).default ?? uniPlugin;`（见 vite.config.ts）。
- **已转**：SKILL「脚手架」硬规则 + 注释在 vite.config.ts。

### P-003 [依赖] pinia 装不上（ERESOLVE）
- **症状**：`npm i pinia` / `pinia@2` 均 ERESOLVE，要 `vue@^3.5.11`，但 uni 锁 `vue@3.4.21`。
- **根因**：pinia ≥2.3 把 peer 提到 vue 3.5+。uni 的 vue 版本滞后。
- **对策**：`npm i pinia@2.2.8 --legacy-peer-deps`（运行时与 vue 3.4 兼容）。
- **已转**：SKILL「依赖版本锁」+ PORT-LEDGER 依赖表。

### P-004 [架构] uni 的 App.vue 不渲染 template（无 root layout）
- **症状**：想把全局 overlay（toast/confirm）挂 App.vue 失败。
- **根因**：uni App.vue 仅 onLaunch/全局样式，无 `<template>` 渲染；uni 没有 Next 的 root layout。
- **对策**：全局 overlay（GlobalUi）挂进 **chassis 组件**（每页外壳 AppChassis）。每个页面用 `<AppChassis>` 包裹。
- **已转**：SKILL「chassis = 页面外壳」架构规则。

### P-005 [搬运] CRLF 行尾致正则失配
- **症状**：脚本搬 globals.css 时 `@theme inline` 块没删掉。
- **根因**：源文件是 CRLF；正则 `\n\}\n` 匹配不了 `}\r\n`。
- **对策**：用 `\r?\n` 或对无嵌套块用 `[^}]*\}`。处理 Windows 源文件正则一律加 `\r?`。
- **已转**：本台账 + SKILL「Windows/CRLF」注意项。

### P-006 [样式] token 体系靠任意值，不需 UnoCSS theme 映射
- **现象（正向经验）**：原项目 3219 处 `[var(--*)]` + 1889 处 inline `var()`。
- **结论**：UnoCSS 用 `presetWind3` + 内置任意值即可，token 作全局 CSS 变量（tokens.css），**零映射**就能让全部引用生效（H5 + App webview 均验证）。
- **已转**：SKILL「样式策略」。

### P-007 [渲染] uni 标签改名，evaluate 选择器别用标签名
- **症状**：`document.querySelectorAll('.nx-content text')` 返回 0，误以为内容没渲染。
- **根因**：uni H5 把 `<view>→<uni-view>`、`<text>→<uni-text>`、`<image>→<uni-image>`。
- **对策**：browser self-check 的选择器一律用 **class**，不用标签名。
- **已转**：SKILL「browser self-check」规则。

### P-008 [验证] uni H5 是 CSR SPA，curl 拿不到渲染内容
- **症状**：想 `curl | grep needle` 验证页面文案，拿到的是空 app 壳。
- **根因**：uni H5 客户端渲染，curl 只得 index.html 壳 + JS 引用。
- **对策**：verify.sh 只验 **编译 + HTTP200 路由 + 源码哨兵**；渲染 needle 交给 **Playwright evaluate**（review 阶段）。
- **已转**：verify.sh 注释 + SKILL「自测 vs 审查」分工。

### P-009 [跨端] 内联 `<svg>` 在 .vue 双端可用（因全 webview 渲染）
- **现象（正向经验）**：tab 图标用内联 `<svg><path>` 在 H5 渲染正常（bell + 9 path 全出）。
- **结论**：因决定**全用 .vue（webview 渲染）不用 .nvue**，SVG / CSS 变量 / CSS 动画在 App 端也可用。代价是 App 性能略低于纯原生 nvue，但换来 H5 代码最大复用。
- **已转**：SKILL「.vue not .nvue」架构铁律。

### 已知无害（不阻断）
- favicon.ico 404（dev 期，uni 默认无 favicon）→ chassis/index.html 阶段补 `<link rel=icon>` 即可。

---

## Batch 1（样板页 intro + home）

### P-010 [环境] cwd 漂移致 `Missing script: dev:h5`
- **症状**：重启 dev server 报 `Missing script "dev:h5"`，但 package.json 完好。
- **根因**：读原项目时 `cd Nexion-prototype`，Bash cwd 持续，重启 dev 命令在错目录跑。
- **对策**：所有 Nexion-uniapp 命令显式 `cd /d/WORKS/PLAN/Nexion-uniapp && ...`，不依赖持续 cwd。
- **已转**：SKILL 提醒 + 本台账。

### P-011 [路由] pages.json 新增页需**重启 dev server**（HMR 不处理）
- **症状**：新建页 .vue + 注册 pages.json 后，navigate 该路由不渲染（元素全空，但 token/theme 正常）。
- **根因**：uni 路由是编译期从 pages.json 生成，HMR 只热更已存在页面，不处理新增路由。
- **对策**：每次 pages.json 增删页面 → kill dev server + 重启。
- **已转**：SKILL「port 阶段」步骤 + 本台账。

### P-012 [机制] verify 哨兵 `framer-motion` 太宽，匹配注释误报
- **症状**：intro.vue 的注释 `/* framer-motion → CSS */` 被 framer-motion 哨兵 FAIL。
- **根因**：哨兵 `framer-motion|motion\.[a-z]` 匹配纯文本提及，非真 import。
- **对策**：精确化为 `from .framer-motion|<motion\.`（只查真 import / JSX 标签）。
- **已转**：verify.sh 已改（机制进化一例）。

### P-013 [正向·重大] uni H5 完整支持内联 SVG + SMIL 动画
- **现象**：intro 的 ComputeOrb（16 circle + 11 个 `<animate>`/`<animateMotion>` + `<radialGradient>` + `<feGaussianBlur>`）零改照搬，H5 全渲染 + 动画运行。framer-motion 入场也成功转 CSS `@keyframes`。
- **结论**：复杂 SVG 视觉/动画可**直接照搬**（因全 .vue webview 渲染）。framer-motion → CSS keyframes + `animation-delay` 是可靠映射。
- **已转**：SKILL cookbook「lucide/SVG/动画」。

### P-014 [审查] mcp-chrome 浏览器反复 closed / already in use
- **症状**：navigate 后 `Target page closed`，重 navigate 报 `Browser is already in use`，evaluate 跑不了。
- **根因**：mcp-chrome 进程不稳定（wedged），与 connect 页无关（dev output 无错、tsc 0）。
- **对策**：精准杀 `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where CommandLine -match 'ms-playwright\\mcp-chrome' | %{ Stop-Process $_.ProcessId -Force }` 后重 navigate。若反复不稳，**降级**：verify.sh(tsc+哨兵) 验代码正确性 + 信任同源逻辑（已验证页模式），完整视觉验证延后到 mcp 稳定。
- 注意：残留 console-*.log 可能是别项目(3002 admin)的旧日志，别误读。

### P-015 [机制] meta 哨兵 `funnel` 匹配代码注释误报（同 P-012 模式）
- **症状**：auth.ts 注释 "don't bounce them through funnel" 被 meta/ponzi 哨兵 FAIL。
- **根因**：`funnel` 是中性技术术语（onboarding funnel），哨兵 grep 含代码注释。
- **对策**：迁移时**代码注释用中性词**（onboarding flow，不写 funnel/conversion/庞氏），避哨兵误报；哨兵保留（防用户可见文案泄 meta）。
- **元教训**：源码哨兵扫注释会误报技术术语（framer-motion/funnel）。注释纪律 = 避 meta/框架专名；或哨兵后续排除注释行。

---

## Batch 2（home 基础层 — 6 v3 store + 4 primitives）

### P-016 [i18n] 迁移页引用 `t.ns.key` 前必须 grep 目标 namespace 真实 key 列表
- **症状**：register/login 迁移时臆测 i18n key（invitedYou / useOtp / usePassword / finish / errorInvalidCredentials / resetDone）被 vue-tsc 全抓。
- **根因**：凭印象写 key 名，源 en.ts/zh.ts 实际命名不同。
- **对策**：写 template 前 `grep -nE "key1|key2" src/i18n/messages/en.ts` 确认存在;vue-tsc 是 i18n key 的可靠门(`Messages` 类型 property 不存在即报错)。
- **已转**：SKILL「转换」步骤 + 本台账。（自 ledger Batch 1 note 归并）

### P-017 [类型] Pinia setup store 显式返回类型注解与 Ref unwrap 冲突
- **症状**：`trial-config.ts` 基线 `vue-tsc` FAIL TS2740 —— `Type 'Ref<{…}>' is missing the following properties from type 'TrialConfig'`。
- **根因**：setup store 写了显式返回注解 `defineStore("trialConfig", (): TrialConfigStore => {…})`，接口里 `config: TrialConfig`(裸值) 与实际 `return { config }`(`Ref<TrialConfig>`) 不匹配。zustand → Pinia 移植惯性带来的。
- **对策**：setup store **不写显式返回注解**，让 Pinia 推断（对齐已验证的 market.ts / profile.ts）。需要导出 store 类型时用 `ReturnType<typeof useStore>`，或抽独立 data interface(如 v-rank 的 `VRankData`)给纯函数用。
- **已转**：✅ verify.sh 哨兵 `no defineStore setup return annotation`（pattern `defineStore\(.*\(\): *[A-Za-z_]`）。机制进化一例。

### P-018 [架构决策·正向] CardStagger 弃 useNavMemory 依赖，framer staggerChildren → CSS nth-child
- **现象**：源 `card-stagger.tsx` 用 framer-motion `staggerChildren` + `useNavMemory`(back-nav skip 优化)。
- **结论**：uni 版用全局 `@keyframes nx-card-stagger-in` + `> *:nth-child(n)` 的 `animation-delay: calc(... var(--nx-cs-step))` 实现等效错落入场，`stagger` prop 经 CSS 变量参数化;**省略 back-nav skip**（非样本必需,避免为一个动画优化再移一个 store）。reduced-motion 用 `@media` 关闭。
- **已转**：SKILL cookbook「framer-motion → CSS」可补「staggerChildren → nth-child calc delay」条目。

### P-019 [跨端·重大] uni H5 里 `<view>` 的 template ref 返回组件实例,不是 DOM Element
- **症状**：home ZONE-1 挂载后 console 报 `TypeError: Failed to execute 'observe' on 'IntersectionObserver': parameter 1 is not of type 'Element'` @ use-scroll-grow-progress.ts。verify 9/9 全绿、tsc 0,但**只有 Playwright 实景跑才暴露**(P-008 印证:verify 绿 ≠ client OK)。
- **根因**：plain Vue/web 里 `ref="elRef"` 绑在原生元素上 → `elRef.value` 是 DOM Element;但 uni 的 `<view>` 是注册组件(`uni-view`),ref 拿到的是**组件实例**,不是裸 Element → `IntersectionObserver.observe()` / `getBoundingClientRect()` 直接挂。
- **对策**：composable/组件里取 DOM 节点时**经 `$el` 解析**：`const el = raw instanceof Element ? raw : (raw as {$el?:Element})?.$el instanceof Element ? raw.$el : null`。已修 `use-scroll-grow-progress.ts`。
- **元教训**：所有 **DOM 测量类**逻辑(IntersectionObserver / getBoundingClientRect 宽度审计 / scrollIntoView)在 uni 都要走 `$el`;且这类 bug **tsc + 源码哨兵都抓不到**,必须 Playwright 实景验 console=0。**单页/批 port 后必跑一次 browser self-check**,不能只信 verify 绿。
- **已转**：composable 内置 $el 解析 + 注释;SKILL「审查」阶段已强调 Playwright console=0,本坑加强为 DOM-ref 必经 $el 的硬规则。

## Batch 2（store 主列表页）

### P-020 [类型] `importsNotUsedAsValues:error` 下纯类型 vue 导入必须 `import type`，不能用 `import { type X }`
- **症状**：`store-hero.vue` / `vs-phone-hero.vue` vue-tsc FAIL `TS1371: This import is never used as a value and must use 'import type' because 'importsNotUsedAsValues' is set to 'error'`。
- **根因**：这两个组件的 style 对象全用 `const s: CSSProperties = {…}`（无 `computed<CSSProperties>`），所以从 `vue` 只取了**类型** `CSSProperties`、没取任何运行时值。项目 tsconfig 开了 `importsNotUsedAsValues: error`，此时 `import { type CSSProperties } from "vue"`（内联 type 修饰但整条 import 无 value 用途）被判为「import 从未作为 value 使用」→ 必须整条写成 `import type`。已验证组件能用 `import { type CSSProperties } from "vue"` 是因为它们**同时**从 vue 取了 `computed`/`ref`（有 value 用途），混合导入下内联 type 合法。
- **对策**：组件**只从 vue 取类型**（仅静态 style 对象、无 computed/ref）时写 `import type { CSSProperties } from "vue"`；**同时取运行时值 + 类型**时才用 `import { computed, type CSSProperties } from "vue"`。
- **元教训**：`import type` vs 内联 `import { type }` 取决于该 import 语句**整体**有无 value 用途，不是单个符号。纯类型 import 用 `import type` 最稳。
- **已转**：本台账 + SKILL「port 要点」可补一条。vue-tsc 是可靠门(TS1371 直接抓)。

## Batch 2（购买→订单生命周期：checkout / orders / order-detail）

### P-021 [跨端·生命周期] 组件里 `onUnload` 不触发 → 定时器泄漏，须用 `onUnmounted`
- **症状**：把页面里验证过的「`onLoad`/`onUnload` 成对清定时器」惯性照搬到**子组件**（chain-payment.vue 的 30min 倒计时 + 12s auto-detect）时，`onUnload` 永不触发——组件 v-else-if 切走后定时器仍在跑（H5 内存泄漏；App 端同理）。
- **根因**：`@dcloudio/uni-app` 的 `onLoad`/`onShow`/`onUnload`/`onUnload` 是**页面级**生命周期，只在 `pages.json` 注册的 page 根组件上触发；普通子组件（被 page `import` 的 `.vue`）拿不到这些钩子，只有 Vue 的 `onMounted`/`onUnmounted`。
- **对策**：**页面**用 `onLoad`(读 query) + `onUnload`/`onUnmounted`(双保险，对齐 login.vue)；**子组件**一律用 Vue 的 `onMounted`/`onUnmounted`，绝不用 uni 页面钩子做副作用/清理。已修 chain-payment.vue（`onUnload`→`onUnmounted`）。
- **元教训**：「页面 vs 组件」的生命周期来源不同——`@dcloudio/uni-app` 钩子=页面专属；`vue` 钩子=组件通用。迁移时凡是带定时器/订阅的**子组件**，cleanup 必挂 `onUnmounted`。tsc + 哨兵都抓不到（import 合法、调用合法），属运行时泄漏，靠规则前置。
- **已转**：SKILL cookbook 可补「页面级 `useEffect(mount)`→onLoad/onShow；**组件级**→onMounted/onUnmounted」一条 + 本台账。

### P-022 [正向·样式] `${color}10` 透明度 hex 后缀 → uni 用 `color-mix(... transparent)`
- **现象**：源 order-detail 用 `backgroundColor: ${STATUS_COLOR}10` / `${color}20` / `${color}40`（把 8 位 hex alpha 拼到颜色字符串上）做状态色淡底/边框/光环。但 STATUS_COLOR 在 uni 是 CSS 变量 `var(--v5-brand)` 等——`var(--v5-brand)10` 不是合法颜色。
- **结论**：用 `color-mix(in srgb, var(--v5-x) N%, transparent)` 等效表达「颜色 @ N% 不透明度」，H5 + App webview 均支持（因全 .vue webview 渲染）。当前点 ring（源 `ring-4 ring-[var]/15`）用 `box-shadow: 0 0 0 4px color-mix(... 15%, transparent)`。
- **已转**：本台账（正向技法）。

## Batch 2（me / wallet 域：me / wallet / wallet-topup / wallet-withdraw）

### P-023 [跨端·样式] scoped `<style>` 里的 `@keyframes` 不跨组件边界 → 共享动画须放 tokens.css
- **症状**：me/wallet 子页的 spinner（`animation: spin …`）+ 步骤入场（`class="nx-step-in"`）不动——`spin`/`nx-step-in` keyframe 只定义在 `checkout.vue` 的 **scoped** `<style>` 里，别的页面/组件引用不到（Vue scoped 给选择器加 `[data-v-xxx]` 属性隔离，keyframe 名也被该组件“私有化”，跨组件 `animation-name` 解析为 undefined → 不播）。
- **根因**：Vue SFC `<style scoped>` 的 `@keyframes` 仅在该组件内可见；`nx-card-stagger-in`/`v5-*` 之所以全局可用，是因为它们定义在 `src/styles/tokens.css`（全局、无 scoped）。
- **对策**：任何被 **≥2 组件/页面**复用的 keyframe 一律定义在 `src/styles/tokens.css`（全局）。本批把 `@keyframes spin` + `@keyframes nx-step-in` + `.nx-step-in` 工具类（含 `prefers-reduced-motion`）加进 tokens.css。组件内 `animation: spin …` / `class="nx-step-in"` 即生效。
- **元教训**：迁 framer-motion → CSS 动画时，若动画要在多个 .vue 间复用，**先看 tokens.css 有没有**（grep keyframe 名），没有就**加到 tokens.css**，不要复制到各组件 scoped `<style>`（既不 DRY 又因 scoped 隔离失效）。tsc + 哨兵都抓不到（CSS 不进类型系统），属运行时静默失效，靠规则前置。
- **已转**：本台账 + tokens.css 注释。SKILL cookbook「framer-motion → CSS」可补一条「共享 keyframe 放 tokens.css 不放 scoped」。

### P-024 [类型] filter 后的联合类型不收窄 → 赋值给窄 ref 须显式 narrow 函数
- **现象（正向技法）**：`Channel.id: Withdrawal["network"] | "CARD"`；`KYC_CHANNELS = ALL_CHANNELS.filter(c => c.id===USDT…)` 运行时只剩 USDT，但 **TS 仍保留 `Channel["id"]` 联合**（filter 不收窄数组元素类型）。模板 `@click="network = c.id"`（`network: ref<Withdrawal["network"]>`）→ TS2322「"CARD" 不可赋」。
- **对策**：包一层 narrow 函数 `selectKycNetwork(id: Channel["id"]) { if (id==="CARD") return; network.value = id }`，在 `id==="CARD"` 分支 return 后 TS 把剩余收窄为 `Withdrawal["network"]`。对齐源的 `setNetwork(c.id as Withdrawal["network"])`，但用类型守卫比 `as` 更稳（不掩盖真错）。
- **已转**：本台账。vue-tsc 是可靠门（TS2322 直接抓）。

### P-025 [SFC·重大] `<script>` 缺 `</script>` 闭合 → vue-tsc 绿但 vite:vue 编译 500
- **症状**：`me/profile-row.vue`（错在 line 33）、`me/wallet-card.vue`（line 95）`curl` 取到 `<!DOCTYPE`（ErrorOverlay HTML，500），报 `Element is missing end tag`，错误帧 `^` 指向 `<script setup lang="ts">` 那一行；导致整个 me 域页面运行时 500。但 `vue-tsc --noEmit` = 0、Volar 不报错。
- **根因**：这两个文件**结尾就缺 `</script>` 闭合标签**（最后一行是 `};\n`，`<script setup>` 块一直延伸到 EOF 也没闭合；也无 `<style>`）。`@vue/compiler-sfc` 的块解析器（`vite:vue` 运行时用）**强制要求**显式 `</script>`，找不到就把 `<script>` 起始标签判为「missing end tag」并抛错。而 **Volar / vue-tsc 对缺尾 `</script>` 宽容**——它把脚本块当作延伸到 EOF 仍能抽取并类型检查，所以 tsc 全绿 → 又一例 **P-008「vue-tsc 绿 ≠ uni/vite 编译 OK」**。
- **为何 bisection 一度误导**：手敲的 stripped 复现文件 heredoc 自带 `</script>` 都能编译；只有 `cp` 原文件（保留截断）才同样 500。最终用 `grep -c "</script>"` 扫全 me 域，发现**有且仅有这 2 个文件**缺闭合（其余 22 个 me 文件都有），定位干净。可能是上游 port 时写文件被截断/漏写尾标签。
- **对策**：给两文件末尾补 `</script>`（保持视觉/逻辑零改，纯补标签）。修后两文件 `curl` 返回 `import{…}`，me 500-scan 清空，me.vue 编译，vue-tsc 仍 0，home/store 无回归。
- **元教训**：SFC 三块（`<template>`/`<script>`/`<style>`）**只要开了就必须闭**；`vite:vue` 严格、Volar 宽容，缺尾 `</script>` 是 tsc 抓不到的运行时 500。任何「tsc 绿但页面 500」先 `grep -c "</script>"` 排查块闭合。
- **已转**：✅ verify.sh 哨兵 `every .vue closes its <script>/<template>`（遍历所有 `.vue`，开了 `<script`/`<template` 却无对应闭合即 FAIL；已做正/负用例验证）。机制进化一例。

## Batch 2（earn 标签页 + bundle）

### P-026 [跨端·渲染] 裸插值 `<view>{{ x }}</view>` 在 App 端不渲染文本 → 必裹 `<text>`
- **症状**：device-card-pc 的「背景模式」帮助框照搬源 `<div className=...>{hint}</div>` 写成 `<view ...>{{ t.earn.phoneRequirementsHint }}</view>`。H5 webview 里这种裸文本**能显示**（uni H5 把 `<view>` 渲成 `<uni-view>`=div，浏览器容忍裸文本节点），但 **App 端 nvue/原生不渲染** `<view>` 的直接文本子节点——文案静默消失。vue-tsc 0、curl-compile 返回 `import{…}`（编译合法）、verify 哨兵全绿，**全都抓不到**（属 App 端运行时渲染差异，H5 自测也看不出）。
- **根因**：HARD RULE「ALL bare text→`<text>`」的反面——源 React 的 `<div>{text}</div>` 直译成 `<view>{{text}}</view>` 看着对、H5 也对，但跨端要求文本必须在 `<text>` 里。最易漏的是**单一文案直接塞容器**（不像 `名字<span>...` 那种会自然想到拆）。
- **对策**：任何 `<view>` 的直接文本子（含 `{{ }}` 插值、字面量）一律包一层 `<text>`。已修 device-card-pc 帮助框。
- **元教训**：H5 webview 对裸文本宽容 = 又一例「H5 绿 ≠ App OK」（同 P-008/P-019/P-025 家族，只是这次连 Playwright H5 都看不出，要 App 端真机/模拟器才暴露）。写 template 时把「容器只放容器、文本只放 `<text>`」当硬习惯，别等跨端验。
- **已转**：✅ verify.sh 哨兵 `no bare {{ }} directly in <view>`（pattern `<view[^>]*>\{\{[^}]+\}\}</view>`，单行裸插值容器）。机制进化一例。多行裸文本仍靠 review（哨兵只覆盖单行）。

## Batch 2（market + team 域：market / team / commissions / binary / agent）

### P-027 [响应式] React `useState(new Set())` 切换不能直译为 Vue `ref(new Set())` → 用 `reactive<Record<string,boolean>>`
- **症状（前置规避）**：源 market `const [stars, setStars] = useState<Set<string>>(...)` + `setStars(prev => { const next = new Set(prev); next.add/delete; return next })`。若直译成 Vue `const stars = ref(new Set())` 再 `stars.value.add(sym)`，**模板里 `stars.value.has(sym)` 不会重新求值**——Vue 的 `ref(Set)` 只追踪 `.value` 整体替换，不追踪 Set 内部 `add`/`delete`（响应式 Set 需 `reactive(new Set())` 且仍有模板 `.has()` 不触发 re-render 的边角）。
- **根因**：Vue 3 reactivity 对 `Set`/`Map` 的细粒度追踪在模板 getter（`.has()`）里不稳；React `useState` 每次 `setStars` 换新引用强制 re-render，Vue 无此机制。
- **对策**：把"集合成员"建模成 `reactive<Record<string, boolean>>({...})`，`has = (k) => state[k] === true`、`toggle = (k) => state[k] = !state[k]`。`Record` 的属性增改 Vue 稳定追踪，模板/computed 都会重算（market.vue stars 已用此法，filtered computed 读 `starState[sym]` 正确响应）。
- **元教训**：迁 `useState(Set/Map)` 一律换 `reactive(Record)` 或 `ref<string[]>` + includes，别直译 `ref(new Set())`。tsc 抓不到（类型合法），属运行时响应式静默失效，靠规则前置。
- **已转**：本台账。SKILL cookbook 可补「useState(Set)→reactive(Record)」一条。

### P-028 [跨端·正向] `navigator.share`/`navigator.clipboard` → uni `uni.share?.()` + `uni.setClipboardData`，须 optional-chain + typeof 双保险
- **现象（正向技法）**：源 InviteEarnCard 用 `navigator.share`（有则原生分享）+ `navigator.clipboard.writeText`（fallback 复制）。uni H5 无 `navigator.share` 的统一保证、App/小程序才有 `uni.share`。
- **对策**：复制一律 `uni.setClipboardData({ data, showToast:false, fail:()=>{} })`（双端可用）。分享用 `uni.share?.({ provider, type, href, title, summary, success, fail })`（App/小程序）——但 `uni.share` 在纯 H5 是 `undefined`，须 `uni.share?.(...)` optional-chain **且** 额外 `if (typeof uni.share !== "function") { 复制 fallback }`，否则 H5 点击主 CTA 静默无反应。`fail` 回调里也接复制兜底（App 用户取消/无微信时）。
- **元教训**：跨端 API（share/clipboard/scanCode…）H5 与 App 能力不一，必 optional-chain + 显式 typeof 兜底，不能假设 uni.* 都存在。
- **已转**：本台账（正向技法）。

### P-029 [架构·正向] zustand `useMemo(() => deriveFrom(store))` 聚合 → Pinia `computed(() => deriveFrom(storeRefs))`，跨 store 派生在页面层组合
- **现象（正向经验）**：team 页源把 commission 月聚合 / binary 对碰 / 网络分层全用 `useMemo([...deps], ...)` 在组件里算；这些读多个 zustand store 的字段。
- **结论**：uni 版每个聚合写成 `const ledger = computed(() => { for (const e of events.value) {...} return {...} })`，再 `const monthUSDT = computed(() => ledger.value.monthUSDT)` 拆字段。store 互不 import（对齐架构铁律），聚合逻辑落在**页面 computed**。`nextRankProgress(state)` 这类纯函数直接传 store 解构的数据对象（uni store 已把 setter 从签名去掉，只收 `VRankData` 数据字段）。
- **已转**：本台账（正向技法）。

## Batch 2（genesis + staking + daily 域）

### P-030 [跨端·渲染] 文本叶子默认写成 `<view>` 而非 `<text>` → 系统性铺开,App 端文本静默消失
- **症状**：genesis/staking/daily 域一次性写了 7 页 + 17 组件,文本叶子(label / value / 段落 / 单行文案)惯性写成 `<view :style="...">{{ x }}</view>`(把 React 的 `<div>{text}</div>` 直译成 `<view>{{text}}</view>`,且套了 inline style 看着像个"文本块")。verify.sh 单行哨兵 `no bare {{ }} directly in <view>`(P-026)一跑抓出 131 处。H5 webview 容忍(渲成 `<uni-view>`=div),但 **App 端 `<view>` 的直接文本子节点不渲染** → 全站文案静默丢。vue-tsc 0、curl-compile 全 `import{…}`、H5 自测都看不出(同 P-026 家族,只是这次是**整批系统性**而非零星)。
- **根因**：「容器 = `<view>`、文本 = `<text>`」是硬约束(P-026 的反面)。但写大批页面时,**文本叶子套了 `:style` 后视觉上像个 block,极易当成 `<view>` 写**。尤其纯 `{{ interp }}` 或字面量直接塞带样式的容器——不像 `名字<span>...` 那种会自然想到拆 text。一旦养成习惯,一个域几十上百处全错。
- **对策**：① 写 template 时硬习惯——**任何只含文本/插值的叶子一律 `<text class="block" :style="...">`,不是 `<view>`**(对齐已发布 store/detail.vue / me.vue 的 `<text class="block">` 模式;uni `<text>` 默认 inline,加 `block` 类得块级行为)。② 系统性已铺开时用 Node `fs` 脚本批量转:正则 `^(\s*)<view\b([^>]*)>([^<]*?)</view>(\s*)$`(单行、子内容无 `<` = 纯文本叶子)→ 换 `<text>` 并补 `block` 类;**别 shell out grep**(Windows Node 跑 cmd.exe 无 grep,用 fs.readdirSync 递归)。本批一次转 131 处,转后 vue-tsc 仍 0 + 哨兵 11/11 + curl 28/28 import。③ 多行文本叶子(`<view>` 换行后下一行才是裸文本)单行哨兵抓不到,靠 review 阶段扫 `<view ...>$` 后跟非标签行(本批写了 scan-multiline 脚本验 = 0)。
- **元教训**：P-026 是「零星漏一个」,P-030 是「**整批养错习惯铺几十处**」。写新页第一原则:**容器只放容器,文本只放 `<text>`**,当肌肉记忆,别等 verify 哨兵/跨端验回头改一片。哨兵(P-026 单行)是安全网不是设计——设计在写的时候就对。
- **已转**：✅ 已被 verify.sh 哨兵 `no bare {{ }} directly in <view>`(P-026,单行)覆盖;SKILL「HARD RULES」已有「ALL bare text→`<text>`」。本坑强化为「文本叶子默认 `<text class="block">` 不是 `<view>`」的写法肌肉记忆 + 系统性铺开时的 Node fs 批量转范式。

## Batch 2（me 子页 batch 1：devices / profile / security / kyc / goals）

### P-031 [架构·正向] 跨 store 不变量(slot-cap)用「参数注入」由页面组合,保 store 权威 + 不破 store-互不-import
- **现象**：源 `activateDevice(id)` 内部调 `trialReservesSlotNow()`(读 free-trial store)做 MAX_DEVICES 槽位上限——active 设备数 + 试用占的 shadow 槽 ≥ MAX_DEVICES 即拒。但架构铁律是**store 互不 import**(app.ts 不能 import free-trial)。
- **对策**：把跨 store 的那部分入参化——`activateDevice(id, reservedSlots = 0)`，**MAX_DEVICES 上限判断仍在 store 里(权威不外泄)**，但「试用占几个槽」由**页面**算好(`trialReserved = trialActive ? 1 : 0`)传进来。页面层本就同时持有 app + free-trial 两 store(组合是页面职责),store 之间零耦合。默认 `reservedSlots=0` 让 orders.advanceOrder 的纯设备 spawn 调用(`app.activateDevice(id)`)无需关心试用、直接通过。
- **元教训**：跨 store 的**判定逻辑**留在拥有该不变量的 store(此处 MAX_DEVICES cap 属 app),跨 store 的**输入数据**由调用方(页面)组合后注入。比「store 互相 import」或「把 cap 判断挪到页面」都干净——前者破铁律,后者让 store 失去不变量权威(别处调 activateDevice 可绕过 cap)。zustand 版能内部 `getState()` 别的 store,Pinia 版坚持铁律改用参数注入。
- **已转**：本台账(正向技法)。SKILL「架构铁律·无后端/store 互不 import」可补一条「跨 store 不变量:判定留 owner store,输入由页面注入」。

### P-032 [架构·正向] chassis-store 驱动的全局 sheet → uni 用 page 挂载 + `:device` prop + emit(因无 root layout P-004)
- **现象**：源 DeactivateSheet 在 chassis(IOSFrame)挂一次,用 zustand `useDeactivateSheet` store(`show(device)`/`hide()`)从任意页打开。uni 无 root layout(P-004:App.vue 不渲染 template),没法在 chassis 级挂一个全局 sheet host 给子页共享。
- **对策**：sheet 改成**普通组件**,由**用它的那一页**直接挂在模板里,用 `:device="sheetDevice"`(null=隐藏)prop 驱动 + `@wait/@force/@dismiss` emit 把动作回抛页面 handler(app-store mutation 在页面组合,sheet 只管 UI + 自己的进度时钟)。页面用一个 `ref<Device|null>` 当开关(`handleDeactivate` 里 `sheetDevice.value = d` 打开)。sheet 自带 `position:fixed inset` scrim + slide-up(framer→tokens.css keyframe),`onMounted/onUnmounted` 管自己的 1s nowMs 时钟(组件级 P-021)。
- **元教训**：源里「chassis 级单例 overlay + store 驱动」的模式(deactivate-sheet / 各种 bottom sheet),uni 一律降级为「页面挂载 + prop/emit」——因 P-004 没有可共享的 root host。只在**多页复用同一 overlay** 时才值得做 GlobalUi 式 chassis 内挂载(如 toast/confirm);单页用的 sheet 就近挂、prop 控、emit 抛,最简。
- **已转**：本台账(正向技法)。与 P-004 同族(uni 无 root layout 的连锁影响)。

## Batch 2（me 子页 batch 2：wallet-bills / exchange / nex / cards / cards-new / receipts / proof / wrapped）

### P-033 [类型·已有约定] uni `<input>` 的 `@input` 处理器 vue-tsc 判 DOM `Event` → 不能直接标 `(e: { detail: { value } })`
- **症状**：把 React `onChange={(e)=>x(e.target.value)}` 直译为 uni `@input="(e: { detail: { value: string } })=>…"`（或 `function onPan(e: { detail: { value: string } })`），vue-tsc FAIL `TS2322: Type '(e: { detail: {…} }) => void' is not assignable to type '(payload: Event) => void'`。uni H5 的 `<input>` 在 vue-tsc 眼里事件类型是标准 DOM `Event`（无 `detail.value`），但**运行时** uni 走的是 `e.detail.value`（小程序事件模型）。类型与运行时不一致。
- **根因**：uni 的 `@input` 既要满足 vue-tsc 的 DOM `Event` 签名（编译期），又要在运行时读 `e.detail.value`（uni 事件）。直接把参数标成 `{detail:{value}}` 与 vue 推断的 `(payload: Event)=>void` 冲突。
- **对策**：处理器参数标 `(e: Event)`，用一个 `detailVal(e: Event)` 助手桥接：`return (e as unknown as { detail: { value: string } }).detail.value;`。**这是 `topup-card-form.vue` 既有约定**（本批 wallet-exchange / wallet-cards-new 沿用）。迁任何带受控 `<input>` 的页面，input 处理器一律 `(e: Event)` + `detailVal`，别直译 React 的 `e.target.value` 也别标 `{detail:{value}}`。
- **元教训**：uni 事件「编译期 DOM 类型 vs 运行时小程序 detail」的二象性——`@input`/`@change`/`@confirm` 都属此类。vue-tsc 是可靠门（TS2322 直接抓），但写时按既有 `detailVal` 约定可一次过。
- **已转**：本台账 + SKILL「port 要点」可补「uni input 事件→`(e: Event)`+`detailVal`」。既有 `topup-card-form.vue` 为范例。

### P-034 [架构·正向] zustand `getState()` 跨 store 副作用 + 周期 `useEffect` → Pinia 直引 store + 页面 onMounted/onUnmounted interval
- **现象（正向技法）**：源 exchange 页用 `useEffect(()=>{ const s = useExchangeV3.getState(); s.resetIfNewDay(); s.setKycVerified(walletPaired); }, [walletPaired])`（避免 depend on store 触发循环，errata #24）+ 两个 `useEffect` setInterval(refreshRate 15s / secsAgo 500ms)。
- **结论**：uni 版 Pinia 无 `getState()` 静态访问惯性——直接 `const v3 = useExchangeV3()` 持有 store，`onMounted` 里调 `v3.resetIfNewDay()`/`v3.setKycVerified(walletPairing.walletPaired)`（一次，不放 watch 避免循环，对齐源意图）。周期 interval 是**页面级** → `onMounted` setInterval + `onUnmounted` clearInterval（P-021：page 也用 Vue 钩子清理最稳，别用 `onUnload`）。源「subscribe-for-render-but-getState-for-action」的循环规避在 Pinia 不需要（Pinia action 调用不强制组件 re-render），直接调即可。
- **已转**：本台账（正向技法）。与 P-021（组件/页面 interval onUnmounted）同族。

### P-035 [架构·正向] 535 行多子组件 modal → 通用 `sections` 描述符数组 v-for 渲染（DRY）
- **现象（正向技法）**：源 ReceiptModal 用 8+ 小组件（Section/Row/RowCopy/Divider/DetailsRows/LossCurve/KycSections/VerifiedStamp）+ KYC 与 task 两套结构 + 6 种 detail kind 分支，535 行。直译成等量 uni 子组件既冗长又难维护。
- **结论**：把「每段若干行」建模为 `DescSection { heading?, rows: DescRow[], checks? }` + `DescRow { k, v?, accent?, muted?, strong?, copyValue?, hint?, divider? }` 的**描述符数组**（computed `sections`），模板用嵌套 v-for 通用渲染一次（copy 行 `@click` 走 `uni.setClipboardData`，accent/muted/strong 经 `valueStyle(row)` 派生）。KYC vs task 只是 `sections` computed 里的两条返回分支。FT 的 loss_curve mini-svg 等纯装饰省略。比逐组件直译省 ~60% 代码且单点可维护。
- **已转**：本台账（正向技法）。受 ≥2 形态复用、行级高度同构的详情面板适用此法。

### P-036 [架构·重大] Batch-0 chassis 被简化，未字段级对齐原型（全站 chrome 偏离）
- **症状**：主人一瞥即指出「底部导航栏样式不对」+ 顺带标了 earn/me 的按钮。排查发现 3 个按钮其实**字段级对齐原型且渲染正确**（fill-slot/sign-out/add-device 都对），真根因是 **Batch-0 我快速搭的 `app-chassis.vue` 被简化**，不忠实：
  1. **TabBar**：原型是**浮动磨砂玻璃 pill**（`mx-3` + `rounded-22` + `backdrop-filter blur(40)` + active **渐变 brand pill** 背景 + label 12px + Liquid-Glass boxShadow），我做成了**实色满宽 bar**（`var(--v5-surface)` + border-top + label 10px + active 仅变色无 pill）。
  2. **Header**：原型 tab 页是「N badge + Nexion v3.2(home)/页面标题 + 搜索图标 + bell 通知角标」，我只有「Nexion + 光秃 bell」（无 N badge/标题/搜索/角标）。
  3. **子页 chrome（~56 页）**：原型子页**隐藏 5-tab bar**（只 home indicator）+ header 显示 back+标题；我所有页都显示实色 5-tab bar + Nexion 行（子页还叠了自己的 in-page back → 双 header + 错的底栏）。
- **根因**：地基组件（chassis）在 Batch 0 是我手搭并「verify 8/8 + 截图看着像」就过了，**没和原型 tab-bar.tsx / header.tsx 做字段级 diff**。「看着像 tab bar」≠「是原型那个 pill」。chassis 全站共享 → 一处简化 = 全站 chrome 偏离 = 用户一眼可见。
- **对策**：**chassis 路由感知重写**（`getCurrentPages()` 自检 tab/子页模式，零页面改动修全站）：tab 页→品牌/标题 header + 搜索 + bell角标 + 浮动 pill TabBar + active 渐变 brand pill + home indicator；子页→无品牌行 + 无 5-tab bar（页面自带 in-page back）+ home indicator。token `--v5-tabbar-bg`(dark `rgba(12,12,14,0.22)`) 已在 tokens.css。
- **元教训**：① **地基/chrome 组件（chassis/header/tabbar/sheet）必须和原型源码字段级 diff**，不能「看着像」就 verify 过——它们全站共享，简化代价 ×N 页。② 主人指一处 chrome 错 = 全站共享层的系统样本，必查同层全部维度（pill/header/sub-page/active 态）+ 跨 tab/子页两态实景，不只修被点那处。
- **已转**：✅ verify.sh 哨兵 `no native <button> tag`（cookbook：uni 原生 `<button>` 自带默认 chrome，必 `<view @click>`；迁移注释带 → 排除）。chassis 字段级保真本身机器难测 → 归本台账 + skill「审查」阶段「chrome 与原型 tab-bar.tsx/header.tsx 字段级 diff」硬项。

### P-037 [架构·重大] chrome 完整性盲区——只搬 Header+TabBar，漏 IOSFrame 挂载的其余 always-on chrome（nova 浮标 + 下拉刷新 + bell 角标）
- **症状**：P-036 修完 chassis 的 header/tabbar 后，主人再指「缺失 nova 浮标入口」+「缺下拉刷新功能和样式」+ 截图显 bell 有「15」角标我没有。运行时核查（直查 DOM/Pinia 实例）：tabbar-pill ✅、header N徽标/v3.2/搜索 ✅（P-036 已修对，主人截图 2/4 是修复前旧图），但 **3 项真缺**：① **StellaBubble（nova 浮标）** 完全没移植（`stella/` 只港了 avatar+card-slot+store，漏 bubble+drawer+triggers）；② **下拉刷新** chassis scroll-view 无 refresher；③ **bell 角标数**=0（notifications 未播种）。
- **根因**：移植 chassis 时我把「chrome」窄化为「**Header + TabBar**」两件，但原型的 chrome 拥有者是 `app/components/ios-frame.tsx`（≠ `(main)/layout.tsx`），它在 chassis 级**还挂着一整套 always-on 元素**：StellaBubble（+drawer+triggers）、PullToRefresh/PullableContent、SystemHost。我只盯着视觉最显眼的 header/tabbar，没**枚举 IOSFrame 的全部子挂载**逐一核对在不在。这是 P-036「声明即覆盖」幻觉的**完整性变体**：查了「搬来的对不对」（header/tabbar 字段级），漏了「该搬的全不全」（IOSFrame 还挂了啥没搬）这个正交维度。
- **对策**：
  1. **下拉刷新**：原型是 web 自定义 document-touch 手势（App 无 document，必换）→ 用 **uni 原生 `<scroll-view refresher-enabled :refresher-triggered @refresherrefresh>`**（双端通用）。`src/store/refresh.ts`（Pinia）`refresh()` 推进同款 mock：`useApp().tick(3500)`+`tickOrders()`+`useExchange().refreshRate()` + ~900ms 合成时延。
  2. **nova 浮标**：港 `stella/stella-bubble.vue`（fixed 右下 bottom 100px，`unread>0` 才显，含 badge + StellaAvatar + 内嵌 drawer + 触发器）+ `stella/stella-drawer.vue`（slide-up 聊天面板，framer→CSS keyframe，lucide→inline svg，input P-033，**bold/换行 markdown → `<text>` 分段** P-026，scroll-into-view 自动滚底）+ `mock/stella-templates.ts`（welcome + 4 快捷回复，复用 `getLockedTeasers`）。
  3. **bell 角标 + nova 角标**：港 StellaTriggers/V3 的聚焦子集（welcome + team/staking/market 三通道）进 bubble 的 `onMounted`，每条 push 同时喂 stella（nova 角标）+ notifications（bell 角标），首发延时缩到 1.2~9s 让两角标 ~10s 内出现（原型截图即已填充态）。timer 在 `onUnmounted` 清（P-021）；cooldown 在 app-singleton store 里 → 每页 chassis 重挂不会重复 welcome/刷屏。
- **运行时铁证**（不靠合成触摸——uni H5 refresher 阈值对合成 TouchEvent 不响应，工具限制非缺陷）：直查 `#app.__vue_app__` → Pinia 实例 → `refresh.refresh()` 实跑（`isRefreshing` false→true→false 无抛错，证 `@refresherrefresh→onRefresh→refresh()` 整链 + `:refresher-triggered` 驱动 spinner）；nova 浮标 DOM 在位（右下 badge「4」）+ 点开 drawer（头部 Nova/4 消息/中文快捷 chips）+ bell 角标「3」+ console 仅 favicon 404。
- **元教训**：**chrome 完整性 = 枚举原型壳层（IOSFrame）的全部 always-on 子挂载逐一核「在不在」**，不只搬最显眼的 header/tabbar。「我把 chrome 搬了」要追问「壳层一共挂了几件？我搬全了吗？」——和后台「动作完整性门 / 字段级门」同型：门只在被设计去看的维度有效，**正交的「该有的在不在」要单独枚举核对**。
- **已转**：✅ verify.sh 哨兵 `chassis_chrome_complete`（枚举断言 app-chassis.vue 含 `nx-header`+`nx-tabbar-pill`+`StellaBubble`+`refresher-enabled`，少一件即 FAIL，防 always-on chrome 再被静默简化）。verify 现 **13**。剩 1 同类偏离：bell 点击我接 `/pages/me/notifications` 整页 vs 原型 chassis 级 in-place slide-in MessageDrawer（功能可用，保真改进项，待主人定夺，未擅自重建）。

### P-038 [地基·重大] 全站字体变 Times New Roman + 全站 box-sizing 偏大——next/font 变量未定义 + 缺 Tailwind Preflight
- **症状**：主人发 4 个按钮截图（查看测算/填满槽位/添加设备/退出登录）问「这里对吗？为什么不改」——质疑我上轮「这 3 个按钮字段级对齐原型」的结论。我**上轮只 Read 源码就断言对齐，没和原型实景并排 diff**（违反自己的「不回源不实景」铁律）。这轮真做并排 computed-style diff，揪出**两个地基级系统 bug**：
  1. **全站字体 = Times New Roman 衬线**：按钮 computed `fontFamily: "Times New Roman"`。根因——`--font-v5`/body/`.font-mono-tabular` 的 `font-family` 链里引用 **`var(--font-display)` / `var(--font-jet-mono)`**，这俩在原型是 **next/font 注入到 :root 的变量**（`Manrope`/`JetBrains_Mono`，由 `app/layout.tsx` 注入）。**uni 没有 layout.tsx，这俩变量从未定义** → 按 CSS 规范含未定义 `var()`（无 fallback）的整条 `font-family` 声明是「guaranteed-invalid」→ **被丢弃 → 退回浏览器初始字体 = Times New Roman**。且 index.html **从没加载 General Sans/Manrope**（原型靠 layout.tsx 的 Fontshare `<link>`）。颜色/圆角/边框 token 全对（rgb 数值并排 match），唯独字体全错——**整站每个字、每个数字都在用宋体衬线**，肉眼一看就「不对」。
  2. **全站 box-sizing = content-box（元素偏大）**：add-device pill computed `height:66`（原型 44），sign-out `46`（原型 44）。根因——原型靠 **Tailwind v4 Preflight** 的全局 `*{box-sizing:border-box}`；uni **无任何全局 reset**，UnoCSS `presetWind3` **不注入 preflight**（reset 是独立 `@unocss/reset`，没引）→ 默认 content-box → 凡「显式 height/width + padding/border」的元素都比原型大（padding 外加而非内含）。我的组件全是原型(border-box)的字段级拷贝、本就为 border-box 写的，跑在 content-box 下才是 bug。
- **对策**（两个地基 patch，一次修全站）：
  1. tokens.css `:root` **定义 `--font-display` + `--font-jet-mono`**（含完整 sans/mono fallback 链）→ 所有 `var()` 解析成功 → 声明有效 → 即便字体没加载也退到 Segoe UI/Arial 干净无衬线，绝不再 Times New Roman。
  2. index.html `<head>` **加载 General Sans(Fontshare)+Manrope+JetBrains Mono(Google)**，`display=swap` 防 FOIT → 与原型同源同字体。
  3. tokens.css 顶部加 **全局 `*,::before,::after{box-sizing:border-box}`** → 对齐原型 Preflight。
- **运行时铁证**：修后 computed `fontFamily` 链解析到 **General Sans**（`document.fonts.check('16px "General Sans"')=true`，loaded 列表含 General Sans+JetBrains Mono）、`isTimesNewRoman=false`；add-device/sign-out height **44/44**（曾 66/46）、boxSizing `border-box`。home/me/earn 三页全页截图肉眼复验：全 General Sans、布局无破坏、按钮尺寸对齐原型。
- **元教训**：① **「字段级对齐」必须是实景并排 computed-style diff，不是只 Read 源码**——源码 + token 可以字字相同，但**运行环境缺失的地基（字体加载 / 全局 reset / next/font 注入的 var）**让渲染完全不同。我上轮只读源码就说「对齐」是错的，被主人当场抓出。② **跨框架移植必查「框架隐式地基」**：Next.js 的 next/font 注入 :root var + Tailwind Preflight 的全局 box-sizing，都是「源码里看不见、但渲染依赖」的隐式基础设施；uni 一概没有，必须显式补。③ 主人指一处「样式不对」= 地基样本：单个按钮色/形对不上往往是**全站字体/盒模型**这种地基塌方的局部投影，必往「全站共因」深挖，别只盯被点的那个按钮。
- **已转**：✅ verify.sh 哨兵 `css_foundation`（断言 tokens.css 定义 `--font-display`+`--font-jet-mono` + 含 `box-sizing:border-box` + index.html 有 `general-sans` 字体链接，任一缺即 FAIL）。verify 现 **14**。

### P-039 [架构·重大] `<scroll-view>` 独立合成层杀死 fixed chrome 的 backdrop-filter 磨砂 + 缺全局页面入场动画
- **症状**：主人指「导航栏透明度不够，header 也需要透明，透明色彩渲染范围要和原型一致」+「每页载入入场动画缺失 + 下拉刷新按钮颜色要和主题一致」。
- **根因**：① **磨砂失效**——chrome token（`--v5-chrome-bg` rgba(0,0,0,0.55)/`--v5-tabbar-bg` rgba(12,12,14,0.22)）+ `backdrop-filter` 与原型**逐字段一致**，computed 也都在，但**视觉无磨砂**。注入亮色块实测：header/pill 后的内容**锐利实色、完全没被磨砂** → 因为我 chassis 内容用了 **uni `<scroll-view>`**，它渲染在**独立合成层**，fixed chrome 的 backdrop-filter **抓不到**滚动内容 → 只磨砂到 chassis 近黑底 → 看着扁平不透。原型用的是普通 `absolute inset-0 overflow-y-auto` **div（同一绘制层）**，fixed header 能磨砂它。② **入场动画**——原型有全局 `PageTransition`（opacity 0→1 + y 12→0 + 360ms ease-out-expo，每页 mount 重放），我只港了 home 的 card-stagger，**漏了全局页面入场**。③ **下拉刷新 spinner 色**——我用 uni 原生 `refresher-default-style="white"`，只能 black/white，无法主题色。
- **对策**（一个 chassis 重写解决三者）：**`<scroll-view>` → 普通 `<view class="nx-content" style="overflow-y:auto">`**（恢复 backdrop 磨砂，对齐原型架构）。下拉刷新没了原生 refresher → **港原型的 touch 手势**（`@touchstart/move/end`，scrollTop===0 才 arm，DAMP 0.5/TRIGGER 70/HOLD 56，调 `refresh.refresh()`）+ **自绘品牌色 spinner**（深色 chip + `stroke:var(--v5-brand)` 旋转弧，一并解决 #1b）。`<slot>` 包 `.nx-page-enter`（`@keyframes nx-page-in` fade+translateY，每页 chassis 重挂重放）实现全局入场。header/statusbar blur 20→24 对齐原型。
- **运行时铁证**：① 滚动正常（plain view scrollTop 生效）；② 注入亮内容滚到 header 后方——**透过 header 磨砂隐约可见**（不再锐利实色），磨砂恢复；③ 合成 touch 下拉：refresher 可见 + `spinnerStrokeColor=rgb(158,220,29)`（=#9EDC1D 品牌绿）+ 松手 `isRefreshing=true`；④ home/me 截图布局无破坏（scroll-view→view 安全，因 .vue webview 支持 CSS overflow 滚动，与原型同款）。
- **元教训**：跨端「token + CSS 字段级一致」**仍可能渲染不同**——`backdrop-filter` 这类**依赖合成层关系**的效果，受**容器类型**（scroll-view vs 普通 overflow div）影响。组件的「框架隐式地基」不止 next/font + Preflight（P-038），还有 **scroll 容器的合成行为**。磨砂/`position:fixed` 锚定/`mix-blend` 等效果**必须实景注入对照测**，computed 有值 ≠ 视觉生效。
- **已转**：✅ verify.sh 哨兵 `chassis_chrome_complete` 升级（加断言含 `nx-refresher`+`nx-page-enter`，且**禁止** `<scroll-view class="nx-content">`——用 scroll-view 即 FAIL，防磨砂再被破坏）。verify 仍 **14**。

### P-040 [架构·重大] 磨砂第二根因：`-webkit-overflow-scrolling:touch` 动量层 + `position:fixed` 仍杀 backdrop-filter（P-039 首修不彻底）
- **症状**：P-039 把 `<scroll-view>` 换成普通 `<view overflow:auto>` 后我**自认磨砂修好了**（看到滚动内容透过 header「隐约可见」就下结论）——**但主人复看仍说「tabbar 和 header 透明效果没生效」**。我那次「隐约可见」是被 `rgba(0,0,0,0.55)` 的 **55% 半透（锐利不糊）** 骗了，误当成磨砂。
- **根因（两个残留）**：① 我给 `.nx-content` 加了 **`-webkit-overflow-scrolling: touch`**（iOS 动量滚动）——它和 `<scroll-view>` 一样**提升独立合成层**，fixed/absolute chrome 的 backdrop-filter 抓不到。② chrome + content 我全用 **`position: fixed`**，原型是 **`position: absolute`**（chassis 才是定位容器，children 全 absolute）。两者叠加仍破坏磨砂。
- **对策**：`.nx-content` **删 `-webkit-overflow-scrolling: touch`** + chrome/content 全部 **`position: fixed` → `absolute`**（`.nx-chassis` 保持 fixed inset:0 作定位容器，对齐原型 IOSFrame 结构）。
- **决定性铁证**（这次用**细条纹注入**，不再靠「隐约可见」自欺）：往 header 后方注入 `repeating-linear-gradient` 红白 6px 细条纹——**header 区条纹糊成柔和粉灰渐变、header 下方条纹锐利红白**，对比刀切般清晰 = backdrop-filter 真磨砂。
- **元教训（叠加 P-038/039）**：① **磨砂/半透必须用「锐利图案(细条纹/文字)」注入测**——纯色块或「隐约可见」分不清「半透(锐利)」vs「磨砂(模糊)」，我就是用纯色+肉眼「隐约」自欺了一轮。② 破坏 backdrop-filter 合成的元凶是一族：`<scroll-view>` / `-webkit-overflow-scrolling:touch` / 某些 `transform`/`will-change`/`contain` / `position:fixed` 嵌套——逐个排除并实景验。③ **我又犯了「自认为 OK」**——主人明令「禁止自认为 OK」，磨砂这种视觉效果**只认锐利图案注入对照**，computed 有值/纯色隐约可见都不算。
- **附带修复**：下拉 spinner 居中下拉空白（`translateY = indicatorY/2 - 18`，实测 center 107 = gap[52,162] 中点）；nova 输入框底部 padding `+16→+22px` 叠 `env(safe-area-inset-bottom)` 避让 iOS 横条。
- **已转**：哨兵 `chassis_chrome_complete` 已禁 `<scroll-view>` 做 nx-content；位置/动量层难机器测 → 归本台账「磨砂必锐利图案注入实景验」硬项。verify 仍 **14**。

### P-041 [架构·重大] Liquid Glass 真根因：内容容器从 header 下方起 + 裁切 → chrome 后无内容可磨砂（连栽 3 轮假阳性）
- **症状**：主人**连续 3 轮**说「tabbar/header 透明效果没生效、没有 Liquid Glass」，我 P-039/P-040 改了两轮（scroll-view→view、去 webkit-overflow-scrolling、fixed→absolute）每轮都**自认修好**，主人每轮都说还是没生效。
- **真根因（我前两轮全没找到）**：我的 `.nx-content` 用 `top: contentTop`（从 header **下方**起）+ `overflow:auto` **裁切**——内容区根本不覆盖 header(0-52)/tabbar 区域 → **chrome 背后永远没有内容可磨砂**，backdrop-filter 只能磨砂 chassis 黑底 = 看着死黑、毫无玻璃感。原型的 scroll 容器是 `absolute inset-0`（**top:0 铺满整个 chassis**）+ 给内容 `paddingTop`，内容滚动时**穿到 header 后面**被磨砂。我漏了这个铺满+padding 结构。**另**:我那个 `transform:translateY(0)` 常驻 pull-wrap（P-041 子因）也把内容提升合成层挡磨砂——空闲必须移除 transform（已改 pullActive 条件 + 入场动画 backwards）。
- **对策**：`.nx-content` 改 `top:0;bottom:0`（铺满 chassis）+ 内层 `.nx-page-enter` 加 `paddingTop:contentTop / paddingBottom:contentBottom`（内容视觉上仍在 chrome 下，但 scroll 容器铺满 → 内容滚到 chrome 后被磨砂）；refresher 锚到 `top:contentTop`；pull-wrap transform 仅下拉/刷新时挂、空闲移除。
- **决定性验证法（终于不自欺）**：前几轮我用「纯色块/隐约可见/locator.screenshot」都被骗（纯色分不清半透vs磨砂；条纹注在 transform 层外假阳性；locator.screenshot 不含 backdrop 显纯黑）。**最终用 `backdrop-filter: invert(1)` 临时强替 + 全屏截图**——header 区清晰显示**反色内容**（顶部变白、"N"反色）→ 铁证 ①backdrop-filter 在此 uni H5 结构真生效 ②内容真在 chrome 后。这是验 backdrop-filter「是否真磨砂到目标内容」的**金标准**（invert 比 blur 直观一万倍，纯色/深色底都骗不了它）。
- **元教训（最痛）**：① **磨砂这类合成效果，验证只认 `invert(1)` 注入实景** —— blur 在深色底上看不出、纯色块/「隐约可见」/单元素截图全是自欺陷阱，我连栽 3 轮就是每次用了弱验证就报「修好」。② backdrop-filter 要生效，**目标内容必须真的绘制在 chrome 背后**（容器铺满 + padding，不是从 chrome 下方起+裁切）——这是比「合成层」更前置的结构前提，我查合成层查了两轮却漏了「背后压根没内容」。③ 主人能看到原型生效=浏览器支持 backdrop-filter，问题 100% 在我结构 —— 这个推理早该让我直接对标原型 `absolute inset-0` 结构，而非逐个试。
- **已转**：哨兵难测「内容是否绘制在 chrome 后」→ 归本台账「Liquid Glass 必用 invert(1) 注入验 + 容器必铺满 chassis+padding」硬项。verify 仍 **14**。

### P-042 [完整性·中] 「领取试用」UI 缺失——store+触发已接线但 chassis sheet UI 没港（P-037 同类，按铁律全扫同型）
- **症状**：主人指「缺失领取试用的 UI/UX 内容」。排查：uni **有** `store/trial-claim-sheet.ts`(open/show/hide)+`trial-config`+`free-trial.canStart`+i18n `t.trial.sheet*` 全键+触发组件(trial-hero-banner/trial-entry 都调 `claimSheet.show()`)——**唯独缺 `trial-claim-sheet.vue` UI**，点领取 store.open=true 但无渲染。
- **根因**：又是 P-037「IOSFrame 挂的 chassis sheet 漏港」——逻辑(store)港了、视觉(sheet)没港，且触发已接线 → 「能点不弹」的隐性断裂。
- **对策**：港 `trial-claim-sheet.vue`(底部 sheet：sparkle 头部+cap label+标题+关闭 / 影子收益 hero `$shadowDaily×days`+grid / 3 ValueProp / 领取 CTA→`navigateTo wallet-cards-new?returnTo=/pages/me/trial?trial=1&trial=1` / dismiss；framer→CSS keyframe，lucide→inline svg，canStart 守卫+toast.info)，chassis 无条件挂载。**铁证**:store.show() 后 sheet 渲染(标题「NexionBox S1 免费试用」/hero $116/3 ValueProp/领取CTA「立即免费试用」)+背景 backdrop blur 生效。
- **按铁律全扫同型(被指一处=系统排查)**：盘点原型 IOSFrame 全部 chassis sheet vs uni——**已港**:genesis purchase-sheet / staking stake-sheet / device-deactivate-sheet / receipt-modal / stella-drawer / trial-claim(本次)。**trial-claim 是唯一「store+触发接线但缺 UI」的真断裂**。**未港(连 store 都无=整功能缺失,非断裂)**:slot-action-sheet / tradein-sheets / lucky-spin-sheet / trial-extension-sheet / trial-unbind-retention-sheet / genesis-dock / message-drawer / sticky-cta-bar——这些入口在 uni 走简化路径(如 empty-slots「填满槽位」直接 navigateTo /store,非开 slot-action sheet)或未实现,待主人定是否补。
- **元教训**:「store/逻辑港了」≠「功能可用」——chassis 级 sheet 必须同时港 **store + UI + 挂载**三件,且查「触发是否接线但 UI 缺失」(能点不弹=最隐蔽)。验证用 store.show() 直触发看渲染。
- **已转**:本台账 + 上方 chassis sheet 清单(已港6/未港8)。哨兵难测语义完整 → 归「port 任一 sheet 必同时港 store+UI+chassis 挂载」硬项。

### P-043 [完整性·重大] 8 个 chassis sheet 整功能缺失——接 P-042「未港8」清单全港 + 挂载
- **症状**：主人「补全部 / 全部清完」。P-042 盘点出 8 个原型 IOSFrame chassis sheet 在 uni **连 store 都无**（整功能缺失，非断裂）：slot-action / sticky-cta / tradein / lucky-spin / trial-extension / trial-unbind-retention / genesis-dock / message-drawer。
- **根因**：Batch 简化只港了 MVP 漏斗主路径，这 8 个 overlay 入口走简化 navigateTo 或未实现。
- **对策**：5 个并行 agent 港全部 8 个（每个 `.vue` UI + `.ts` store + i18n 镜像 key），chassis 无条件挂载 9 overlay（StellaBubble/TrialClaimSheet/SlotActionSheet/TradeinSheets/LuckySpinSheet/TrialExtensionSheet/TrialUnbindRetentionSheet/StickyCtaBar/GenesisDockHost/MessageDrawer/GlobalUi）。补 App.vue 缺失的 trial poll（SimulationProvider TRIAL_TICK 4s）。**铁证**：逐个 store.show() 触发，DOM 增长 393 节点，每个 sheet 渲染验证。
- **已转**：`chassis_chrome_complete` 哨兵枚举 always-on chrome；sheet 完整性归「港任一 sheet 必同时 store+UI+chassis 挂载」硬项（P-042）。

### P-044 [架构·中] `?trial=1` deep-link 在 hash-only 导航到已挂载页时 onLoad 不重触发
- **症状**：`/pages/me/wallet-cards-new?returnTo=...&trial=1` 刷新/深链时，试用自动扣款披露框不显示。
- **根因**：uni `onLoad(query)` 只在页面**首次**加载触发；H5 hash-only 导航到已挂载页不重新 onLoad，query 拿不到。
- **对策**：`parseHashQuery()` H5 回退——直接解析 `window.location.hash` 的 query，onLoad override 合并。`?trial=1` 在刷新/深链都能正确显示披露。**铁证**：Playwright 刷新带 `?trial=1` 的 URL → 披露框渲染。
- **已转**：本台账；归「uni onLoad query 在 H5 需 parseHashQuery 回退」硬项。

### P-046 [架构·重大] 原型逻辑路径 vs uni flatten 路由——raw `navigateTo` 静默失败「点击无跳转」（连栽 3 处，全扫同型）
- **症状**：主人「团队 创世节点 点击无跳转」。排查发现是**系统性**：stella / 通知 CTA 数据里 `ctaHref` 是原型 **web 逻辑路径**（`/team/commissions`、`/genesis`、`/me/wallet/exchange`、`/staking`、`/trust`、`/team/leadership-pool`、`/team/binary`、`/team/rank`、`/store` 等），但 uni 路由是 flatten 后的 `/pages/...`。直接 `uni.navigateTo({url: 逻辑路径, fail: ()=>{}})` → 路由不存在 → **fail 回调吞掉 → 静默无跳转**。
- **根因**：uni 把原型嵌套路径**拍平**且**单段着陆要双写**：`/genesis`→`/pages/genesis/genesis`（单段着陆双写）、`/team/commissions`→`/pages/team/commissions`（2段直通）、`/me/wallet/exchange`→`/pages/me/wallet-exchange`（3+段 dash 拍平）、tab 根→reLaunch。3 个消费出口各错各的：message-drawer 喂 raw 逻辑路径（全断）；stella-drawer 朴素 `/pages${href}` 前缀（断单段 `/genesis`→`/pages/genesis` 不存在 + 断嵌套 `/me/wallet/exchange`→`/pages/me/wallet/exchange`）；**notifications.vue 漏网**（stella-bubble line 112 把逻辑路径 ctaHref **push 进 notifications store**，notifications.vue onTap raw navigateTo 消费 → 同病）。team 卡片另有字面量笔误 `/pages/genesis`（缺第二段）。
- **对策**：建 `src/lib/route.ts` 单一映射器 `toUniRoute(href)`/`navTo(href)`——`/pages/` 开头直通、tab 根 reLaunch、单段双写、2+段首段作目录 + 其余 dash 拍平。三出口（message-drawer / stella-drawer / notifications.vue）全部改用 `navTo`。team 卡片字面量补全 `/pages/genesis/genesis`。**铁证**：notifications 页真实上下文 `navTo('/genesis')`→`#/pages/genesis/genesis`、`navTo('/team/commissions')`→`#/pages/team/commissions`、`navTo('/me/wallet/exchange')`→`#/pages/me/wallet-exchange` 全部真跳，console 0 错。
- **按铁律全扫同型**：①静态——全站 74 个 `/pages/` 路由字面量 vs pages.json 逐一核对，0 broken（team 笔误已修）。②动态——扫所有 navigateTo/reLaunch 的**变量 url**：`/pages/` 模板字面量类安全；**数据驱动 href 类**逐个核源——终极 grep「任意字段 = `/xxx` 非 /pages 逻辑路径」**仅命中 stella-bubble + stella-templates 两文件**，三出口已全经 navTo；其余 class-B 消费者（events/learn/me settings/wallet/search/quick-action/sticky-cta/tab.route）数据源全是 `/pages/`。
- **元教训**：跨框架迁移时**逻辑路由 ≠ 物理路由**；`fail:()=>{}` 是「点击无跳转」的隐形元凶（吞错）。数据驱动导航必须有**单一映射层**，绝不让组件各自拼路由。验证要在**真实页面上下文**跑 navTo 看 location.hash 真变（非只读源码）。
- **已转**：①`src/lib/route.ts` 单一映射器（消除各组件自拼路由）。②`verify.sh` 新增 `nav_routes_valid` 哨兵——node 跨核全站 `/pages/` 字面量 ⊆ pages.json（跳过注释行防误报），防 team 笔误类回归（机器可测层）。③本台账 + 元教训「逻辑路径必经 navTo」硬项（语义层）。**verify 15/15**。

### P-047 [工具·中] WSL bash 内 Linux `curl` 误判 Windows H5 dev server 不在线，导致 HTTP probe 被跳过
- **症状**：`Get-NetTCPConnection` 与 Windows `curl.exe -I http://localhost:5173/` 都证明 H5 dev server 返回 200，但 `bash scripts/verify.sh` 的 `[2] H5 routes HTTP 200` 仍显示 `SKIP dev server not running`。
- **根因**：当前命令从 Windows PowerShell 调起 WSL bash，脚本内裸 `curl` 命中 Linux curl；在本机 WSL/Windows localhost 转发场景下，Linux curl 不能稳定访问 Windows 侧 Vite dev server。脚本把工具链连通性问题误判为 dev server 未启动，导致 H5 HTTP probe 缺失。
- **对策**：`scripts/verify.sh` 增加 `CURL_BIN` 选择：检测到 WSL 且存在 `curl.exe` 时优先用 Windows `curl.exe`，否则沿用环境提供的 `curl`。`check_http` 和 dev-server online probe 全部走 `"$CURL_BIN"`。
- **运行时铁证**：修后 `bash scripts/verify.sh` 输出 `Home shell [200] /`，总计 **15 pass / 0 fail**，H5 probe 不再 SKIP。
- **已转**：机器层：verify 内置 WSL `curl.exe` fallback。语义层：Windows/WSL 混合项目里，HTTP probe 被 skip 不能当作通过；必须确认是真离线还是验证工具访问错端。

### P-048 [交互·重大] UniApp H5 `<input>`/`<view @click>` 视觉存在不等于真实业务可操作
- **症状**：`SPEC-L3c02` persona proof 跑 FT-013/014/015 时连续抓到两类“看起来有,实际不稳”的控件问题：① 提现地址 input 的 host 卡片可见,但内层 `.uni-input-input` 高度为 0,`agent-browser fill` 地址时焦点仍留在金额框,地址文本会污染 amount；② 提现提交、回购、团队 finance 入口都是 `<view @click>` 文案按钮,文本 locator 能找到,但 H5 下不稳定触发业务事件,会停留原页或不写 store。
- **根因**：uni H5 渲染的可视 host 不等于真实输入/点击 target。`<input>` 外层尺寸和内层原生 input 尺寸可能脱钩；`<view @click>` 没有 native button 语义,纯靠文案定位时可能点到内部 text/包装层或 offscreen 状态,不触发期望的业务 handler。此前泛动作采样只证明“有可见控件/有路由”,没有证明“这个控件能完成承诺的业务结果”。
- **对策**：
  1. 对需要自动化和真实业务 proof 的关键控件加稳定业务类名,如 `nx-withdraw-submit-cta`、`nx-repurchase-submit-cta`、`nx-team-*-link`。
  2. 对关键 `<input>` 同时验证 host 与内层 `.uni-input-input`:必要时用 `:deep(.xxx .uni-input-input)` 固定 `min-height/height/line-height`,并在 proof 中断言 `activeClass` 与 input value。
  3. proof 点击用 `scrollintoview + click(selector)`,业务结果必须回源断言 storage/route/body,不能只看点击无报错。
  4. 弹窗 proof 必查业务语义控件:例如 exchange modal 不能只证明弹窗出现,还要断言 `NEX 10 -> USDT`、primary confirm、swap history、v3 caps、双 bill。
- **运行时铁证**：`node scripts/uniapp-persona-walkthrough-proof.mjs` 7/7 passed。FT-013 写入 WD tracking + points 100→95 + pending withdraw bill；FT-014 写 swap history/v3 cap/2 bills + repurchase points 95→195/stake/bill；FT-015 四个 team finance 入口进入 commissions/rank/binary/leadership-pool。
- **已转**：机器层：admin `verify.sh` 新增 `uniapp-persona-walkthrough-proof` gate。语义层：关键业务控件必须有可点 selector + 业务结果回源断言；“按钮文案存在/弹窗出现/grep 到 @click”一律不算交互闭环。

### P-049 [架构·中] 同页 hash query 切换不重触发 `onLoad` → KYC Express 同页跳转仍停在普通充值
- **症状**：`SPEC-L3c03` feature-mapping proof 首跑 FM-004 时,从 `/pages/me/wallet-topup` 切到 `/pages/me/wallet-topup?kyc=1` 后页面仍显示普通充值状态,KYC Express 的生成地址/付款确认控件不可操作。
- **根因**：与 P-044 同族,但发生在同一个已挂载页面内部。UniApp H5 hash-only 同页 query 改变时不保证重新触发 `onLoad(query)`,组件仍沿用旧的 `mode=topup` 状态。
- **对策**：`wallet-topup.vue` 增加 H5 hash query 回源解析和 `hashchange` 监听:`routeHasKyc()` 同时读 `onLoad` options 与 `window.location.hash`;`syncKycRoute()` 在 onLoad/onMounted/hashchange 都执行;onUnmounted 清 listener。
- **运行时铁证**：`node scripts/feature-mapping-walkthrough-proof.mjs` PASS。FM-004 从普通 top-up TRC20 通道进入 `?kyc=1`,KYC Express 生成检查 `KYC-2026-A78235`,显示 exact amount,写入 `KYC-KYC-2026-A78235` bill。
- **已转**：机器层：admin `verify.sh` 新增 `feature-mapping-walkthrough-proof` gate。语义层：任何同页 query 驱动的 H5 状态切换不能只信 `onLoad`;必须有 hash-query 回退或明确重挂载策略。

### P-050 [工具·中] PowerShell→WSL bash 验证链里 `node`/`curl` 执行端会漂移,导致假失败或假跳过
- **症状**：L5 终验首跑时,Next/UniApp/Admin verify 在独立 PowerShell 下可过,但被汇总脚本或 bash 调用时出现两类工具链问题:① WSL bash 的 PATH 找不到 Windows Node,脚本直接 `node: command not found`;② Linux curl 访问 Windows 侧 dev server 得到 `000` 或被脚本判断为 offline。
- **根因**：当前项目常从 Windows PowerShell 调起 WSL bash。bash 内的 `node`/`curl` 不一定和 Windows 端 dev server/runtime 同端,裸命令会把“工具链错端”误判成“产品坏了”。
- **对策**：
  1. `verify.sh` 统一定义 `NODE_BIN`,优先环境变量,找不到时回退 `node.exe`,仍找不到才 fail。
  2. WSL 环境且存在 `curl.exe` 时 HTTP probe 使用 Windows `curl.exe`,否则才用当前 bash 的 `curl`。
  3. L5 汇总脚本调用 Windows `.cmd` 不走 `shell:true`,改用 `cmd.exe /d /s /c` 并记录 stdout/stderr/spawn-error。
- **运行时铁证**：Next `bash scripts/verify.sh all` **230/0**; UniApp `bash scripts/verify.sh` **16/0**; Admin `npm run verify` **148/0**; L5 `node scripts\l5-final-sweep.mjs --run-verifiers` **12/12 passed**。
- **已转**：Next/UniApp/Admin verify 均有 `NODE_BIN`/`CURL_BIN` 选择;L5 汇总日志保留 `l5-*.log`,工具链错误会显式出现在日志里。

### P-051 [架构·中] navigateTo 页在 enter 翻转「共享 store 开关」必须 onUnload 对称复位 + 一次性回复 timer 须 onUnload 清
- **症状**：会话中心 chat.vue(`?type=ai`)进 AI 聊天调 `stella.open()` 置 `isOpen=true` 清 Nova 未读；但离开页(navigateBack)时无人复位 → `isOpen` 永真 → 此后 stella-bubble 的 team/staking/market 推送命中 `push()` 的 `unread = isOpen ? 0 : unread+1` 恒取 0 → **首访 AI 聊天后浮标再不显示 Nova 未读**(隐性回归,3-agent audit Round 1 Agent A 报 P1,main Read 复核精确定位 `isOpen` 卡死为真根因——A 原报「幽灵回复推高 unread」经核不准:`conversations.pushAgentReply` 不动 unread、AI push 因 isOpen 真而置 0)。
- **根因**：原 stella-drawer 由 `close()` 复位 isOpen;退役 drawer + chat 页接管「open 视图」后,只在 onLoad `open()` 置真,**漏了「离页复位」这一对称面**(维度②:flag set on enter 没有对称的 reset on exit)。
- **对策**：chat.vue 持 `pendingTimers[]` + `onUnload`/`onUnmounted` 双钩子 cleanup:清所有一次性回复 `setTimeout`(防卸载后幽灵回复写 singleton store)+ `isAi` 时 `stella.close()`(复位 isOpen)。页用 `onUnload`(uni 页生命周期)+ `onUnmounted`(组件保险,对齐 P-021)。
- **元教训**：① 任何「进页置 flag/占资源」必须有对称的「离页复位/释放」,尤其 flag 在**共享 app-singleton store** 上影响别处累加逻辑时——单看本页对、跨页累加错。② navigateTo 页(非 chassis)有副作用(timer/flag)必走 onUnload 清理(同 P-021)。
- **已转**：本台账 + skill「页 lifecycle:enter 置的 flag/timer 必 onUnload 对称复位」硬项。跨页运行时状态机器难测 → 归流程层。

### P-052 [验证方法·中] Playwright `page.goto` 同路径仅改 query 不重触发 uni `onLoad` → chat→chat 读到陈旧 state（P-044/P-049 的「测试侧」变体）
- **症状**：验证时 `page.goto('.../chat?cid=A')` 后再 `page.goto('.../chat?cid=B')`,第二次页面仍显示 A 的 header/消息。一度误判类型路由有 bug。
- **根因**：uni H5 是 hash 路由 SPA;page.goto 同路径仅改 query 是**同文档 hash 变更**,不重载文档 → `onLoad(query)` 不重触发(P-044/P-049 同根)→ cid/isAi 仍是首次值。**这是测试方法假象,非产品 bug**:真 app 里 chat→chat 走 `uni.navigateTo`(每次 push 新页实例→fresh onLoad,已实景验「转人工 pill」AI→support 正确切换)。
- **对策**：验证同路径不同 query 的页,要么 **about:blank → 目标 URL 强制整文档重载**,要么**走真 in-app `uni.navigateTo`**(点 UI 触发);绝不用「page.goto 同路径换 query」断言路由切换。
- **元教训**：H5 SPA「同页 query 不重 onLoad」既是产品坑(P-044/P-049 需 hashchange 兜底)也是**验证坑**——测试方法本身被同一机制骗。判路由切换必用整文档重载或真 navigateTo。
- **同根扩展(2026-06-16)**：同一「hash-nav 不重载 JS」机制也骗 **mid-session 源码/config 改动的运行时验证**——编辑 `trial-config.ts`(shadowDailyUSD 38.52→7)后 hash-nav 到 earn,运行中 **Pinia 单例仍持编辑前载入的旧模块默认值** → trial banner 一度显旧「$38.52/d × 3 = $116」,差点误报成信息岛;`about:blank → 目标 URL` 整文档重载后正确显「$7.00/d × 3 = $21」。**判据**:验证任何 store/config/常量模块的 mid-session 改动的运行时效果,必整文档重载(about:blank→back)或重启,**勿凭 hash-nav 断言**(verify 绿 + 代码对 ≠ 运行中单例已更新)。
- **已转**：本台账(验证方法纪律,已含 query 切换 + mid-session 模块改动两面)。

### P-053 [工具/语义·中] 数值重校准的「同形 grep」漏三类：裸整数 prose · 派生值句子 · 营销圆整造的第二值
- **症状**：经济重校准（旧 S1 $38.50/d → $7/d 等）首轮用小数锚点 grep（`38\.5`/`142\.6`/`640×`）扫净 src，宣布信息岛清零。3-agent 审计却补抓出 4 处旧值残留：① tier1 标题/buyCta 写 `$38/day`（裸整数，小数 grep 漏）；② 提现锁定文案「S1 13 小时达 $20」（按旧 $38.50/d 推算的**派生值**，新 $7/d 应「不到 3 天」，任何值 grep 都抓不到）；③ vs-phone 手机 `+12 NEX`（与 device 规格 `baseRateNEX:10` 不一致的陈旧 marketing 值）；④ 营销文案手动圆整成 `120×`，而实时计算徽章 `Math.round(7/0.06)=117×` → 同一钩子两个倍数值并存（**圆整本身造了信息岛**）。
- **根因**：值 grep 只匹配「字面等于旧值」的串。但旧值在产品里有三种逃逸形态：(a) **裸整数/不同小数位**（`$38` vs `$38.50`、`$142` vs `$142.60`）；(b) **派生句子**——「X 时间达 $Y」「N× 手机」「N 天回本」是从费率**算出来**的，改费率后这些句子整体失真，但没有任何一个旧数字字面出现；(c) **营销圆整**——人为把 116.7 写成「120×」做 hook，与数据派生的 117× 不等，制造了「营销值 ≠ 计算值」的岛。
- **对策**：重校准的同形 grep 必扫三轮——① 每个旧值的**小数 + 裸整数**双形式（`\$38\b` 和 `38\.5` 都扫）；② 全量 `$N/day`/`$N/天`/`N×`/`N 倍`/`N hours`/`N 天回本`/`N 小时达` 类 prose **逐句按新费率重算**核对（不是值匹配，是语义重算）；③ 营销显示的圆整数 **= 数据派生计算值**（计算 `Math.round(s1/phone)=117` 就全站用 117，勿手动圆成 120），否则圆整即岛。
- **元教训**：「数字一致性」审计不能只问「旧值还在不在」（值匹配），要问「**每个露出的数字/时长/倍数，按当前 SoT 重算后还成立吗**」（语义重算）。派生值 + 裸整数 + 圆整三类靠值 grep 永远漏，必须语义层 + 实景层兜（本轮即靠 3-agent 审计 + browser 实景才补净）。
- **已转**：done-review/审计语义层（派生值需逐句重算，非值匹配，难无脆机器门）；本台账记规则。重校准任务的 P1 Done-when 应含「全站 prose 数字按新 SoT 语义重算 = 0 失真」。
- **同根扩展(2026-06-17)**：统一某个派生值（如 phone→box 倍数 117×）时，**同一量可能有多个计算点、各自圆整方式不同**——审计当时只改了营销文案串（hero/vsMore/faq→117×），漏了 `detail.vue` 的 `speedup = round(daily/0.06/10)*10`（round-to-10 → Pro 220× / S1 120×），与卡片 `round(daily/0.06)`（217×/117×）并存。主人看详情页才发现 220 vs 217。**判据**：统一倍数/比率类派生值，必 grep 所有计算点（`/0.06`、`/PHONE_RATE`、`/10)*10` 等同形）核对圆整方式一致，不只改字面文案串——计算公式也是「同形」的一种。

### P-054 [架构·高] 子页冷开点返回卡死——uni H5 `navigateBack` 单页栈走 success 空操作、fail 不触发
- **症状**：deep-link/刷新直开任一子页（如 `/pages/store/detail?id=...`）点返回按钮无反应，卡在原页；in-app 进入（有历史）则正常。
- **根因**：uni-app H5 在单页栈（`getCurrentPages().length===1`，冷开/刷新）时 `uni.navigateBack()` **返回 success 的空操作、`fail` 回调永不触发**（Playwright 探针 `navigateBack({success,fail})` 实测：返回 SUCCESS）。全站 12 处返回逻辑都用 `uni.navigateBack({ fail: () => 回退 })` 模式 → 回退分支是冷开下的死代码。与 P-044/P-049（hash-nav onLoad 不重触发）同属 H5 SPA 路由族，但症状不同。
- **对策**：新增共享 `navBack(fallbackHref?)`（`src/lib/route.ts`）：`getCurrentPages().length>1` 才 `navigateBack`；否则 `reLaunch` 到声明的 backHref（navTo 兜底；无 href 兜到 home，永不死路）。12 处全收口到 helper（app-chassis navBack / sub-page-header goBack / 10 页 goBack）。
- **已转**：`verify.sh` 哨兵「no raw uni.navigateBack」（除 route.ts 外 grep `uni.navigateBack(` 必 0，防回归）+ 本台账。实景验冷开 detail/binary-how/terms 返回 + in-app pop 无回归 + console 0。
- **元教训**：H5 平台 API 的「失败」语义未必走 fail 回调（navigateBack 把「无法后退」当 success）——任何「赌 fail 兜底」的逻辑必须改为**前置条件判断**（查真栈深 `getCurrentPages()`），不能依赖 SDK 在边界情况报错。

## P-055 · `v-else` 非相邻 → 组件编译失败、整页动态导入挂掉(vue-tsc 漏 + verify 只 curl 首页漏)

- **现象**：购买门 Buy 按钮里写 `<svg v-if="gateLockedView"/> <text>{{buyLabel}}</text> <svg v-else/>`——`v-else` 与 `v-if` 之间夹了 `<text>`。vite vue-plugin 报 `v-else/v-else-if has no adjacent v-if`，product-card.vue 编译失败 → 引用它的 `store.vue` 动态导入 `Failed to fetch dynamically imported module` → 商城整页不渲染。
- **双重盲区**：① `vue-tsc --noEmit` = 0(它只查**类型**,不查模板语义 `v-if/v-else` 相邻性)→ 机器门「假绿」；② `verify.sh` 只 `curl /`(首页 shell HTTP200,P-008 SPA 空壳),**不编译/不渲染 store 路由**,漏掉路由级编译错。两道门都过、实际整页崩——只有浏览器实景(preview console + 渲染断言)抓到。
- **对策**：`v-else` 必**紧邻** `v-if` 元素;中间隔了别的元素时,改用两个独立条件 `v-if="cond"` / `v-if="!cond"`。
- **元教训**：**vue-tsc 0 ≠ vite 编译过 ≠ 页面渲染**。模板语义错(v-else 相邻/未注册组件/指令误用)只在 vite vue-plugin transform 时报,且只在该路由被**实际加载**时触发——必须浏览器 navigate 到改动路由实景验,不能只信 tsc+verify。
- **待转哨兵(建议)**：`verify.sh` 增「关键非首页路由编译探针」——对 store/team/me 等改动密集路由 curl `/src/pages/<route>.vue` 模块(非 200 / 含 transform error 即 fail),把路由级编译错从「实景才发现」提前到机器门。

<!-- 后续每批新坑追加于下，转哨兵/规则后标注「已转」 -->

## P-056 · meta-words 哨兵排除 /i18n/messages → 用户可见文案的 funnel-meta 泄漏处在盲区

- **现象**：首日任务分类标签 `转化/convert`(运营漏斗黑话)印在用户端 chip 上;全站排查同类又揪出 2 条用户可见文案——`转化路径/conversion paths`(签到 footer)、`转化门槛/conversion gate`(充值档位 body)。3 处都绕过了现有「no meta/ponzi words」哨兵。
- **根因**：`sentinel_absent`(verify.sh:50)对所有哨兵统一 `grep -vE '/i18n/messages/'`——为容忍货币 "conversion"(NEX↔USDT 兑换)+ `upsell:` 命名空间 key 的合法出现而排除了 i18n 文案文件。但**用户可见文案恰恰全在 i18n/messages**,于是 meta 哨兵对「文案级 meta」完全失明(标签当初正因此漏过门)。
- **对策**：① 修 3 处(标签 `转化`→`推荐`、key `dayOneCatConvert`→`dayOneCatRecommend`;footer/body 去 meta 改 benefit 框架),双语同步。② 加**专扫 i18n/messages 的独立门**(不走排除 i18n 的 sentinel_absent):`转化路径|转化门槛|转化率|转化漏斗|"转化"|conversion path|conversion gate|conversion funnel|conversion rate`——复合词 + 带引号裸 `"转化"` 是无歧义 meta(货币在文案里写「兑换/exchange」),零误报。
- **已转**：`verify.sh` 哨兵「no funnel-meta in i18n copy」+ 本台账。**负向探针验真**:5 个 meta 串全 CAUGHT、5 个合法串(货币 conversion / 兑换 / 推荐 / 注释裸转化)全放行;verify 24/0;5175 实景验 chip=推荐、控制台 0。
- **元教训**：哨兵的**排除范围**本身可能制造盲区——「为避免误报而 `grep -v` 某目录」时必问「该目录里有没有正该被这条哨兵守的东西」。文案 meta 的权威位置是 i18n/messages,守它的门必须扫它(用精准 pattern 规避误报,而非整目录排除)。

## P-057 · `now % ONE_WEEK` 周界错对齐到周四(纪元是周四)→ 结算倒计时偏差数天

- **现象**：领导奖池 `store/leadership-pool.ts` 用 `weekStart = now - (now % ONE_WEEK)` 算周界。JS 纪元 1970-01-01 是**周四**,故 `now % ONE_WEEK == 0` 落在**周四 00:00 UTC**——weekStart 与派生的 `nextPayoutTs = weekStart + ONE_WEEK` 都对齐到周四,而非周一。页面 hero「N 天后结算」实测显示 ~1 天,实际到下周一应 ~5 天。
- **口径矛盾**：权威口径(PRD §8.5.3 + 玩法说明页 i18n「周一 00:00 UTC 开新池 → 周日 23:59 UTC 快照」)明写周一周界——代码却算周四,**声明(文案)≠实现(代码)**,且 vue-tsc/verify 全绿(纯逻辑值错,无类型/渲染症状),只有实景核对倒计时数字才暴露。
- **对策**：新增 `weekStartMondayUTC()` 助手——`getUTCDay`(周一→0…周日→6)+ `Date.UTC` 取本周一 00:00 UTC,替换 epoch-modulo 式;`nextPayoutTs`(下周一)/ history(往周一)随之正确。
- **已转**：`verify.sh` 哨兵「no epoch-modulo week boundary」grep `% ONE_WEEK`(排除 JSDoc/`//` 注释行,容忍文档引用反例)。**负向探针验真**:真代码行 `now % ONE_WEEK` CAUGHT、注释行 EXCLUDED;verify 25/0;5173 双语实景「5天 / settles in 5d」与玩法页周一/周日 UTC 口径自洽、console 0。
- **元教训**：**纪元锚点不是周一**——任何「时间戳 `% 周期`」做日历对齐都隐含「从周四起算」的偏差。日历周界(周/月)必须走 `getUTCDay`/`Date.UTC` 显式派生,绝不用 epoch-modulo。纯逻辑值 bug 无机器症状,必**回源核权威口径(PRD/文案)+ 实景核派生数字**,不能只信 tsc+verify 绿。

## P-058 · playwright 脚本顶层 frame 裸 import 源码模块 → 双 Pinia「no active Pinia」稳定假红

- **现象**:`scripts/spec4-account-cloud-app-sync.mjs` 在 verify 中稳定 FAIL:`page.evaluate` 里 `await import("/src/store/app.ts")` 后 `useApp()` 报「getActivePinia() was called but there was no active Pinia」;页面本身 console 0 error 运行正常。git stash 判别与工作区改动无关(干净 HEAD 同样挂)。
- **根因**:uni-app H5 dev 把应用渲染在**同源 iframe** 里;`page.evaluate` 默认跑在**顶层 frame**。顶层 frame 裸动态 import `/src/store/app.ts` 时 vite 照样服务模块,但这是在一个从没跑过 `main.ts` 的 realm 里**凭空构建第二套模块图**——第二份 pinia 模块自然没有 active 实例。模块图分裂不是时序 flake,是 frame 上下文错位,必然复现。
- **对策**:脚本改用应用 frame 上下文——`page.frames().find(f => f !== page.mainFrame())` 轮询取 iframe(build 产物无 iframe 时回退主 frame),`appFrame.evaluate(...)`。同 frame 内动态 import 命中 vite 模块缓存,拿到的就是页面主链的 store 实例,零产品代码改动。
- **已转**:本台账 + 修复落地(verify 169/0)。硬规则:**任何要碰 store/import 源码模块的 walkthrough/验收脚本,evaluate 必须进应用 iframe frame**(参照 spec4-app-sync 的 `resolveAppFrame()` 写法);纯 localStorage 读写因同源共享可豁免但建议统一走 frame。
- **元教训**:「脚本以前过、现在稳定挂、代码没动」≠ 环境玄学——先 **git stash 二分定责**(我的改动 vs 存量),再看**执行上下文**(frame/realm/进程)是否与被测物错位;evaluate 的 frame 归属是 playwright 对 iframe 型应用(uni H5 dev)的第一陷阱。

## P-059 · 同元素 @tap+@click 双绑 → H5 真实点击/触摸链路 handler 双触发(步进器 ±2、开关开了又关、导航栈损毁)

- **现象**:PR-C 验收实测(2026-07-07 复证):H5 端同一元素同挂 `@tap` 与 `@click`,一次触摸 handler 跑两次——数量步进器一摸 1→3(+2);折叠开关开了立刻关(回原位,看似"没反应");导航类 `navigateTo` 连发两次,第二次撞 uni 导航锁 fail → `navTo` fallback 链(redirectTo/reLaunch)把页面栈**重写坍缩**(实测 [index,…] → 仅 [目标页],用户按返回=直接退出而非回上页)。全仓清扫揪出存量 **57 处双绑 / 16 文件**(checkout 13 处最重)。
- **根因**:uni H5 runtime 把 `@tap` 与 `@click` **都注册为 click 监听**(H5 无原生 tap,tap 即 click 别名+触摸增强)——同一个 click 事件依次触发两个 handler。所以不止真机触摸:**鼠标点击、`el.click()`、任何合成 click 都双触发**。写双绑的动机(「保险起见两端都绑」)在 uni 语义下是反的:uni 编译器在小程序端把 `@click` 自动映射为 tap,`@click` 单绑本就全端正确,`@tap` 没有任何补充价值。
- **对策**:**单绑 `@click` 是全端唯一正确姿势**(修饰符照常:`@click.stop` 等)。双绑一律删 `@tap` 保 `@click`;单绑 `@tap` 也统一改名 `@click`(风格与哨兵一致)。修复实测:同一触摸序列步进器 1→2、开关正常展开、导航栈 +1。
- **已转**:`verify.sh` 哨兵「no @tap binding」——扫绑定形态 `@tap(\.[a-z]+)*=`,命中即 fail;**先涂空注释体再扫**(script 的 `//` 行与 `/* */`、template 的 `<!-- -->`;涂空时保留换行 → 报出的行号不漂),故注释里**引用**完整绑定写法不误伤。2026-08-07 修:原实现直接 grep 原文,「提及不带等号所以安全」的假设被 `behavior-analytics.ts` 的 JSDoc(逐字写了 `@tap="trackBehaviorTap"`)推翻,门恒红。双向红测:CRLF 文件里真造 `@tap="x"` / `@tap.stop="x"` 均 CAUGHT 且行号精确;多行 `<!-- -->`、多行 `/* */`、`//` 行注释里的同款写法全部放行。
- **元教训**:「两端都绑更保险」类**冗余防御**在编译器已做端间映射的体系里=自我攻击;跨端事件这类「框架承诺」要用**真实事件链路**(触摸序列/合成 click)实测验证,不能靠肉眼「渲染了、能点」——双触发的开关类症状(开了又关)恰恰伪装成「没反应」,极易误判为"点击不灵"再叠一层错误修补。

## P-060 · 把 store 存储改按账号「还不够」——消费者把设备级源镜像进账号字段=隔离被击穿(P2-8 第二批 audit 抓)

- **现象**:P2-8 把 `exchange-v3.kycVerified` 改成按账号分行(存储层已隔离、机器门 + 首轮 A/B/A 都过)。对抗审计仍抓出真跨账号泄漏:`wallet-exchange.vue` onMounted 无条件 `v3.setKycVerified(walletPairing.walletPaired)`,而 `walletPairing` 当时**仍是设备级单键**。账号 A 配对钱包(walletPaired=true 设备全局)→ 换 B → B 打开兑换页 → 镜像把 true 写进 B 的账号级 KYC 字段 → **B 绕过 >$100 KYC 闸**。存储改对了,值被设备级源经镜像重新灌回。
- **根因**:账号隔离是**数据流全链路**属性,不只是「这个 store 的持久化按账号」。只要有任一消费者在 mount/watch 里 `账号级store.setX(设备级store.y)`,设备级源就会在换账号后把 X 重新污染成上一账号的值——存储层的隔离形同虚设。
- **对策**:**修源头,不修镜像**——把被镜像的设备级 store(walletPairing)也按账号隔离,镜像自然变成 per-account 一致(B 的 walletPaired=false → 镜像置 B 的 KYC=false)。镜像代码本身不动(它拿本账号态镜像本账号字段是对的)。反面:去 gate 镜像=治标,源头仍是设备级泄漏面。
- **已转**:本台账 + `nexion-audit` 跨-store 镜像镜头(每批 P2-8 audit 专查「有没有设备级源经 onMounted/watch 灌进账号字段」);account-scope 收口哨兵保证**源头 store 已按账号**(walletPairing 已补入 rebind + 哨兵)。运行时复验:跑 `wallet-exchange.vue:225` 原样镜像那行,断言 B 的 KYC 仍 false。
- **元教训**:改「按账号隔离」时,`grep` 该字段的**所有 setter 调用点**,凡是入参来自另一个 store 的,追那个 store 是否也按账号——**account-scope 一个 store 时要顺带审它的上游镜像源**。存储层测试(机器门 + 存储 A/B/A)会「假绿」,只有把**真实消费链路**(页面 mount 的镜像)纳入运行时验收才抓得到。同 P-058「存储改对 ≠ 数据流对」族。

## P-061 · 账号隔离改动的验证方法论——纯 hash 导航留 HMR 陈旧假红 + 迁 persist key 必同步所有护栏

- **现象 A(HMR 陈旧假红)**:改完 store 后,Playwright `page.goto` 只改 hash(`#/a`→`#/b`)**不触发整页重载**,app 仍是改动前那个实例;HMR 只补了 `account-scope.ts`(调 12 个 bindAccount),但改动前已实例化的旧 Pinia store 实例**没有新加的 bindAccount 方法**(setup store 定义变更 HMR 不干净重注册)→ bootstrap 报 `useVoucher(...).bindAccount is not a function`,看似真 bug 实为 HMR 陈旧。
- **现象 B(迁 key 漏改护栏)**:把 `nexion-bills-v1` / `nexion-milestones-v1` 迁成 `*-accounts-v1` 后,`spec6-entry-surface-runtime.mjs` 反泄漏护栏仍盯旧死键 → 未来真泄漏它读到空串**静默失明不报红**(修一处漏改哨兵)。
- **对策**:**A**:改 store 后验证必**换 query**(`?b2=1#/...`,query 变=整页重载)拿 fresh app 实例,纯 hash 导航只用于同 app 内累积实例化;reach Pinia 走 `document.querySelector('#app').__vue_app__` → provides 里找 `._s instanceof Map` 的 pinia,`_s.get(id)` 取真 store 实例,对真实例调 `bindAccount` + 真 action 造数据(跑的是产品确切代码)。**B**:迁任一 persist key,`grep` 全站(尤其 `scripts/*.mjs` 护栏 + verify.sh)该旧键,同步改到新键;把清单 DRY 成单源防再漂移;加哨兵机器化断言护栏跟踪迁移键(`spec6 guard tracks new key`)。
- **已转**:B 半已机器化(verify.sh「spec6 guard tracks new key」哨兵);A 是验证程序,记本台账 + nexion-workflow P4 实景门(store 改动实景验必换 query 重载)。voucher/cart 的 `watch` 异步持久化:A/B/A 测须在切号前 `await` 一拍让 watcher flush(模拟真实使用的事件循环分 turn,否则同步测造人造 race 假红)。
- **元教训**:store 结构变更的实景验证有两个**测试侧**陷阱(非产品 bug):HMR 陈旧(纯 hash 不重载,同 P-052 hash-nav 族)与异步 watcher 未 flush;判「假 bug」先**换 query 整页重载复现**再定责。护栏键与被守数据同生死——**迁数据键=迁所有引用该键的护栏键**,否则守卫静默失明比没有还危险(给「已守」的假象)。

## P-060 · uni scroll-view 有两层 `.uni-scroll-view`(外 wrapper overflow=0 + 内真滚层)+ 声明式滚不到底 → 聊天「自动到底」查错元素假通过、实际差一截

- **现象**:会话中心聊天页「发消息/收回复自动滚到最新」实测**没到底**(差 ~75-177px);更隐蔽的是**验证一直假通过**——脚本查 `.nx-conv-list`(uni-scroll-view 标签外壳)的 `scrollHeight-clientHeight` 恒 =0,`atBottom`(差值<8)恒真,导致「没到底」这个真 bug 被绿灯放过多轮。
- **根因**:① uni H5 `<scroll-view>` 编译成**两层**都含 class `uni-scroll-view` 的节点——外层标签 `overflow:0`(wrapper,不滚),深一层 div 才是真滚动层(`overflow>0`);`host.querySelector('.uni-scroll-view')` 命中**第一个(wrapper)**,设它 `scrollTop` 无效。② uni 声明式 `:scroll-top`/`:scroll-into-view` 都对**布局前高度**算偏移——刚 append 的 reply 气泡还没进 scrollable range,滚动量偏小停在半路;`:scroll-top` 设超大值本想让 view clamp 到底,但 `bump` 抖动只差 1px 被 uni 判定"未变"不重滚。
- **对策**:H5 用 **DOM 直接驱动真滚层**——`[host,...host.querySelectorAll('*')].find(e => e.scrollHeight-e.clientHeight>4)`(按**实际溢出**找,不认 class),`scroller.scrollTop = scroller.scrollHeight`;双 kick(nextTick 立即 + `setTimeout 90` 补偿异步气泡布局);App 端保留 `:scroll-into-view` fallback(条件编译 `#ifdef H5`)。实景确认 `top:602 max:602 atBottom:true`。
- **已转**:本台账 + `components/support/conversation-thread.vue` 的 `domToBottom()`。硬规则:**验证滚动位置/尺寸必须查「真正溢出的元素」(find `scrollHeight-clientHeight>4`),绝不查 `.nx-conv-list` 这类 uni-scroll-view 外壳**(其 max 恒 0 → 一切 atBottom 断言假通过);uni 聊天滚到底 H5 走 DOM,不信声明式 scroll-top/into-view。
- **元教训**:**「验证工具查错元素」比 bug 本身更危险**——外壳 max=0 让 atBottom 恒真,把「没到底」伪装成「到底了」骗过多轮自检(完成铁律"运行时证明对"的反面活样本:渲染了 ≠ 位置对)。查任何滚动/尺寸断言前,先证伪「我查的这个元素真的是会变的那个吗」(打印 sh/ch/scrollable 三元组);uni 同 class 多层节点是 H5 port 的隐形陷阱。

## P-061 · uni H5 `navigateTo` 前进离开 = 「隐藏但存活」中间态,`onUnload`/`watch` 全漏 → Nova 未读被永久压制 + 返回后列表跳顶

- **现象**:两个 P1(对抗审查揪出,实景复现):① AI 聊天页发消息后 1.1s 内点「转人工」pill 前进离开,延时的 `nova.push` 触发时 `isOpen` 仍 true → 未读被吃,且 `isOpen` **永久卡 true**,之后所有 Nova 主动推送未读全静默丢失(直到点 tab reLaunch 才复位)。② 聊天滚到底 → 前进离开(`display:none` 清零内部 scrollTop)→ `navigateBack` 返回(keep-alive 不重新 mount)→ `watch([messages,typing])` 不触发 → 列表停在顶部,用户「消息全没了」。
- **根因**:uni H5 `navigateTo` 是 **push/keep-alive**——前进离开时源页只 `display:none` **不销毁**,`onUnload`/`onUnmounted` 都不触发(它们只在真 `navigateBack` 销毁时跑);清理逻辑(`nova.close`)与滚动恢复(数据 watch)全挂在这两个漏掉的时机上。这个「隐藏但存活」中间态是 keep-alive 型路由的通用盲区。
- **对策**:用 uni **页面级 `onShow`/`onHide`** 覆盖中间态——`onHide` 关 Nova(前进离开也置 isOpen=false → 后续 push 正常累积未读);`onShow`(首次进 + navigateBack 再现都触发)重开 Nova 清未读 + bump `revealTick` 让 thread 重新滚到底。`onShow` 无条件递增 `revealTick`、`conversation-thread` 的 watch 纳入 `revealTick` → 返回即回底。
- **已转**:本台账 + `pages/support/chat.vue` 的 `onShow`/`onHide`。硬规则:**keep-alive 页面(uni 所有 navigateTo 目标)里「离开要清、回来要恢复」的逻辑必须挂 `onHide`/`onShow`,不能只挂 `onUnload`/`onUnmounted`**(那俩只覆盖真销毁,漏掉前进离开);验证这类必跑「发消息→前进离开→等副作用→navigateBack」完整往返,不能只测真返回。
- **元教训**:同物理路由互跳(如 `/pages/support/chat?type=ai` → `?cid=x`)uni `navigateTo` 会**坍缩成 redirectTo 不 push**——验证「前进再返回」要用**不同路由**页面前进(实测用 `/pages/genesis/genesis`),否则栈没那一层、navigateBack 直接回更上层,验证路径本身就错。

## P-062 · bare 全屏页(不套 AppChassis)缺 `GlobalUi` 宿主 → toast/confirm/netError 进 store 却无处渲染,静默失败

- **现象**:聊天页 `chat.vue` 是 `position:fixed inset:0` 的 bare 全屏页(为聚焦对话不要 tabbar/nova 浮标,刻意不套 `AppChassis`)。发送限频命中时 `toast.warn(...)` 正常写进 ui store,但**用户看不到任何提示**——限频「拦」对了,「提示」没落地。
- **根因**:toast/confirm/netError 的**渲染宿主 `<GlobalUi />` 只在 `AppChassis` 里挂**。bare page 不套 chassis → 该页整条 overlay 链无渲染出口,任何在此页 raise 的 toast/confirm 都进 store 石沉大海。
- **对策**:bare page 自带宿主——`chat.vue` 模板末尾加 `<GlobalUi />`(它自 gate `showBusinessOverlays` 按路由判,chat 路由非 static-review → 正常显示;与 `login.vue`/`register.vue` 既有 bare 页挂法一致)。实景确认限频 toast 双语弹出。
- **已转**:本台账。硬规则:**任何 bare 全屏页(不套 `AppChassis`)只要可能 raise toast/confirm/netError,必须自带 `<GlobalUi />`**;写 bare page 时先自问「这页的 overlay 往哪渲染」。
- **元教训**:全局能力(toast/confirm)默认**依附某个容器**(这里 AppChassis)——脱离容器的页面白拿一个「调了不报错但没效果」的静默陷阱;「声明(调了 toast)≠实现(渲染出来)」,验证反馈类交互必**实景看到那个 toast/弹窗**,不能只确认「代码调了」。

## P-063 · canvas 无法解析 CSS var → 海报/图形绘制的 token 纪律需「运行时读取 + 画稿常量」双轨

- **现象**:FEAT-SHARE01 邀请海报用 uni canvas 绘制,`setFillStyle("var(--v5-brand)")` 无效(canvas 2D 填充不走 CSS 级联),若直接写死 hex 又违反「颜色用 token 不写 hex」铁律,且亮/暗主题切换后海报 brand 色会与 app 当前主题脱节。
- **根因**:canvas 是位图绘制 API,不在 DOM 样式系统内——CSS 自定义属性对它天然不可见;而 V5 token 铁律的适用前提是「样式走 CSS」。
- **对策**:双轨——① 主题相关色(brand / on-brand / accent)运行时 `getComputedStyle(document.documentElement).getPropertyValue("--v5-*")` 读真值(H5;非 H5 回退常量),海报随当前主题;② 画稿固有色(海报暗底渐变、暗底上的墨色)= 营销画面常量,与 UI 主题无关,文件头注释声明豁免理由。禁第三种形态(裸写死主题色)。
- **已转**:本台账 + `share-poster-sheet.vue` 头注 + `cssVar()` helper。硬规则:**canvas/位图绘制里的主题色必须运行时读 token(带回退),画稿常量必须头注声明豁免**;审查 canvas 代码时把 `setFillStyle/fillStyle` 里的 hex 逐个归类「主题色(必须 cssVar)/画稿常量(必须有豁免注释)」。
- **⚠️ 适用域更新(2026-07-08)**:主人拍板分享海报为**恒定深色画稿**(浅/深模式同一张图),`share-poster-sheet.vue` 已删 `cssVar()`,全部颜色转画稿常量(轨②)并头注豁免——「轨①运行时读 token」对该文件不再适用,**勿按本条把 cssVar 加回去**。双轨规则对未来其它「需随主题变」的 canvas 场景仍有效。
- **元教训**:铁律有隐含适用域(token 铁律 ⊆ CSS 渲染域);出域场景(canvas / 邮件模板 / 导出图)要人为把「单源」精神翻译过去,而不是机械 grep hex=0 或干脆放弃纪律。

## P-064 · uni H5 storage 值带 `{type,data}` 包装 → 外部/测试直写 localStorage 必须同格式,否则 hydrate 静默回退默认值

- **现象**:实景走查想模拟登出,直接 `localStorage.setItem('nexion-auth-v1', JSON.stringify({isAuthenticated:false,...}))`,刷新后仍是登录态——像「改不动」;读侧 `JSON.parse(...).pendingCode` 也一直 undefined,像「没写进去」。
- **根因**:uni H5 端 `uni.setStorageSync` 会把对象包装成 `{"type":"object","data":{…}}` 落 localStorage;`uni.getStorageSync` 读到**裸 JSON**(无包装)时按字符串返回,store 的 `typeof s === "object"` hydrate 守卫判失败 → 静默走默认值分支。写读两侧都「不报错但不生效」。
- **对策**:任何绕开 uni API 直操 localStorage 的场景(Playwright 走查注入 / 调试脚本 / 数据迁移)一律读改写 `{type:"object",data:…}` 包装;或干脆在页面上下文里调 `uni.setStorageSync`。走查前先 `getItem` 看一眼真实格式再动手。
- **已转**:本台账。硬规则:**E2E/走查脚本注入 uni 持久层,必须先读真实存储格式对齐包装**;凡「注入后行为没变」先怀疑格式不匹配,不是逻辑没生效。
- **元教训**:框架适配层会给「标准 API」加私有约定;测试代码绕过适配层时,绕过的不只是 API 还有约定——注入型测试的第一步永远是「看一条真数据长什么样」。

## P-065 · bottom sheet 底部留白必须「基础值 + env(safe-area-inset-bottom)」,新组件要对齐工程 38px 众数基准

- **现象**:FEAT-SHARE01 两个新分享 sheet 底部贴屏幕边——渠道面板 `padding-bottom: env(safe-area-inset-bottom)` 裸用(浏览器/无刘海设备 env=0 → 基础留白 0),海报面板基础值只给 16px;主人指出「离屏幕边框太近,要考虑 iOS 底部小横条」。
- **根因**:两层——① `env(safe-area-inset-bottom)` 只在 iOS 刘海屏 PWA/App 内有值,它是「避开小横条的系统区」,不是「视觉留白」,裸用=在其他环境完全贴边;② 写新 sheet 时没先 grep 工程既有 sheet 的基准:全站 10+ 个 bottom sheet 全是 `calc(env(safe-area-inset-bottom) + 38px)`,38px 是众数基准(同 `feedback_width_alignment_audit` 「先实测众数」的纵向版)。
- **对策**:bottom sheet 一律 `padding-bottom: calc(env(safe-area-inset-bottom) + 38px)`;非 sheet 的贴底条(聊天输入条等)最低 22px。新做任何贴底组件前先 grep `safe-area-inset-bottom` 对齐既有基准。
- **已转**:verify.sh 哨兵 `safe-area-inset-bottom base padding >=22px (P-065)`(node 解析两种词序 + env fallback 形态,基础值 <22px 即 FAIL;已探针验证真抓 0px/16px 反例)。
- **元教训**:safe-area 类 env 变量是「条件性系统补偿」,永远要叠加设计留白而不是替代它;新组件的间距基准先问「工程里同类怎么写」,不是拍脑袋给个小值。

## P-066 · 试用提前购买扣款失败仍记「已购买」账单——裸 `app.debitBalance()` 丢弃 false 返回值

- **现象**:试用期点「立即购买」提前兑换,余额预检查(确认框前)通过后、确认框停留期间余额被别端(多端/其它购买)消耗光;确认后 `app.debitBalance()` 返回 false(不扣款),但代码照常 `bills.add({type:"purchase"})` + creditBalance + addDevice → 账本记一笔「已购买」但钱没动、白发设备(账单与实际扣款不一致,非偿付性,审计相邻发现)。
- **根因**:裸语句 `app.debitBalance(chargeAmount);` 丢弃 boolean 返回值;第 206 行余额预检查在 `await confirm()` 的并发窗口下已 stale。且 `redeemEarly()` 在 debit 之前已把试用状态推进到 `redeemed` 终态——只 return 会留下「显示已兑换、实则没钱没设备」的死状态 + 冷却锁死。
- **对策**:检查返回值,false 时 `freeTrial.markChargeFailed("insufficient_funds")`(翻 failed 保留 finishedAt 起冷却) + toast + return,后续记账/加余额/发设备全不执行。对齐 App.vue handleAutoRedeem / checkout.vue 既有正确写法;全站 12 处 debit 调用同形排查,trial 是唯一漏点。
- **已转**:verify.sh 哨兵 `debit_return_checked`(grep 行首裸 `app.debit(Balance|Nex)(...);` = bug 形态;现有 12 调用点零误报、原 bug 形态真抓,5 形态自测过)。
- **元教训**:返回 boolean 的资金原语(debit/扣款/校验)裸语句调用 = 静默吞掉失败信号;凡「先检查后执行」跨 await/用户确认,检查必在真正动钱那步复核(预检查只是前置过滤,不是授权)。

## P-067 · 重开先刷新心跳再结算 → 被杀 App 的离线墙钟差按在线档倒补

- **现象**:手机曾在线后杀掉 App 数小时，重开第一拍直接拿到完整在线加成；同一段离线时间从 H5 看是基础托管，从 App 重开看却被倒补在线收益。
- **根因**:tick 先把 `onlineHeartbeatAt` 写成当前时间，再用这个新心跳给 `now - lastSettledAt` 的历史墙钟差定价，把“现在重新上线”错误外推成“整个离线区间都在线”。
- **对策**:结算顺序固定为“读取旧心跳 → 给本次墙钟差定价 / 累计 attestation → 刷新新心跳供下一拍使用”；暂停、退役、重校准、会话失效同步清理心跳和结算锚点，多端合并忽略未来时间戳。
- **已转**:`scripts/r7-device-detail-runtime.mjs` 覆盖 null / 新鲜 / 超时边界 / 未来心跳、6 小时陈旧重开、生命周期清理与多端合并；`verify.sh` 锁先结算后刷新顺序和全站在线判定单一入口。
- **元教训**:心跳是区间末端的观测，不是对上一整段时间的证明。任何“刷新状态 + 按时间差结算”链都必须先用旧状态封账，再让新状态影响未来。

## P-068 · uni H5 弹层靠 `@keydown.tab` 困焦点 → Shift+Tab 仍逃到背景

- **现象**:设备快捷菜单能由 Shift+F10 打开并把焦点送入，但首项按 Shift+Tab 会跳到页面背景按钮；只测“打开 / Escape / 回焦”的脚本仍全绿。
- **根因**:uni H5 的 `<view>` 事件包装下，弹层容器的 `.tab` 键修饰和并列 keydown handler 没有稳定拦截原生 Tab 默认行为；Vue 状态和 ARIA 看起来正确，但浏览器焦点已越界。
- **对策**:H5 在菜单打开期间用 `document.addEventListener('keydown', handler, true)` 捕获原生键盘事件，关闭 / 卸载时对称解绑；边界 Tab 明确 `preventDefault + stopPropagation` 并手动首尾循环，Escape 走同一 handler。
- **已转**:runtime 新增“首项 Shift+Tab → 末项、末项 Tab → 首项”双向断言，再验证 Escape 关闭与焦点回到设备卡；verify 锁 capture listener、focus trap 和 modal 语义。
- **元教训**:无障碍弹层不能只证明“焦点进得去、关得掉”，还必须对抗性证明两个边界都出不去；框架键修饰不是原生默认行为已被阻止的证据。

## P-069 · bare 登录注册页未继承 chassis 系统栏 → 顶部状态栏、Home Indicator 与底部安全区成了逐页漏项

- **现象**:主应用页面由 `AppChassis` 提供 iOS 状态栏和 Home Indicator，但 onboarding / login / register 是 bare 全屏页，各自只画业务内容；estimator CTA 仅留 24px 底距，既和注册成功页的 38px 基线不齐，也会贴近 Home Indicator。
- **根因**:系统 chrome 的所有权只落在 `AppChassis`，bare 页面没有等价共享壳；页面作者只能逐页记 `env(safe-area-inset-*)`，导致“内容渲染正确”掩盖“该有的系统层不存在”这个完整性盲区。
- **对策**:新增 `standalone-page-shell.vue`，复用 `DeviceStatusBar` + `DeviceHomeIndicator`，统一计算 App 真状态栏 / H5 设备预览 54px 状态栏与 `env(safe-area-inset-bottom) + 38px` 底部基线；9 个登录入口/auth/onboarding 页面全部接入。可滚动 bare 页的系统栏用 viewport-fixed，避免随内容滚走；系统 chrome 层级高于页面弹层。
- **已转**:`verify.sh` 自动扫描 onboarding/login/register/ref/session 目录，任一新增页漏接共享壳、主操作标记、Home Indicator 抽取回退或 38px 基线未实际应用即失败；总门禁直接运行 `scripts/auth-system-chrome-runtime.mjs`，在 430×940 与 320×568 逐页记录滚动前几何，再用真实滚轮验证可达性、状态栏 / Home Indicator / 控件安全距离与弹层层级，并锁 estimator 与 register-success 首屏 CTA 同坐标；AUTH02 真实 referral 礼包成功态另锁 `scrollTop=0` + 16px 安全距。
- **元教训**:系统状态栏和 Home Indicator 不是页面装饰，是页面壳不变量。以后设计任何 full-screen 页面先选 `AppChassis` 或 `StandalonePageShell`，不能从零开始猜上下留白。

## P-070 · 扫描器的「相等」与「上下文」两个口径都太窄 → 两次得出「已清完」的假结论

- **现象(C1 批次,我的工具连错两次,均在下结论前被已知答案探针拦住)**:
  ① 判「字面量是不是某 token 的副本」时按**颜色值全等**比 —— `rgba(14,142,74,0.30)` 与 `--v5-success` 的 `#0E8E4A` **只差 alpha**,不全等 → 漏掉 `vault-row` / `how-callout-box` 共 5 处真 bug,还会给出「全站只有 13 处」的假清单。
  ② 用「同行必须出现 `color`/`background`/`border` 等属性关键词」当上下文过滤 → 变量赋值行(`const tint = … : "#C26658"`)、对象字段行(`lemon: "rgba(…)"`)全在盲区,再漏 5 处。
- **根因**:两个口径都是**为了降噪而设的启发式**,但降噪门槛设在了「违例的实际书写形态」之上。同一个语义色在真实代码里有至少 5 种形态:`#RGB` / `#RRGGBB` / `#RRGGBBAA` / `rgb()` / `rgba()`,再乘上「改 alpha 做描边/底色」的派生用法;它出现的位置也不限于 CSS 声明行,可以是常量表、三元表达式、模板字符串。
- **对策(第一性原理重定判据)**:
  - 比 **RGB 三元组、忽略 alpha** —— 变透明度副本同样必失配。
  - **去掉上下文启发式** —— 颜色字面量本身就只可能是颜色,不需要属性关键词佐证;降噪改用「显式豁免台账 + reason 必填」。
  - 只钉**亮值 ≠ 暗值**的 token(单主题 token 的副本不会失配),真灰 `r=g=b` 排除(是通用光影不是语义色)——用**判据精度**降噪,不用**匹配面收窄**降噪。
- **已转**:`scripts/token-copy-sentinel.mjs`(已接 verify.sh,`--selftest` 25 条双向红测:5 种书写形式 + 变 alpha 阳性全中,`var()`/`color-mix`/真灰/三种注释阴性全 0)+ `docs/TOKEN-COPY-ALLOWLIST.json`。旧的 4 色 hex 哨兵保留为无豁免硬地板。
- **③ 同病第三次发作(同批 ROUND 2,由 audit 门抓出)**:清「弹层遮罩」时我用 `grep 'rgba(0,0,0,0.5x)'` 这类**值**匹配,只捞到 9/20;漏的 11 个写的是 `rgba(8,8,12,0.45)`/`rgba(7,9,15,0.62)`/`rgba(0,0,0,0.72)`。
  🔴 **用「值」去找「扮演某角色的东西」必然漏 —— 角色不由值定义。** 遮罩的角色特征是「选择器叫 `*-backdrop`/`*-mask`」或「铺满视口 + 有底色的覆盖层」,与它取什么值无关。
  已转 `scripts/scrim-single-source.mjs`(按**角色**扫,19 条双向红测 + 仓内红测;已接 verify.sh);全站 20 个遮罩收敛为 `var(--v5-bg-color-mask)` 单源。
- **元教训**:**「扫描器报 0」只等于「我的正则口径内是 0」。** 焊哨兵前先拿一批**已知的真违例位置**当靶子反查,靶子没被命中就说明口径有洞 —— 而不是等报 0 就宣布清完。
  推论(本条三次发作共有的形状):**清理某一"类"东西时,先定义这个类的「角色判据」,再去找;不要用手头碰巧见过的几个「值 / 写法」当类的定义。** 值是角色的实例,不是角色本身。
  这是「验证工具用错」元模式在本仓的第 3 个样本(前两个:tsc 被管道吞退出码、字号 codemod 与哨兵共用只认 kebab 的正则)。

### P-055 [验证方法·中] 门的结论用管道判 = 静默放过;跨语言占位符不能做硬门

- **症状(两条同源:都是「门看起来在守,其实没守/守错」)**:
  ① 红测新哨兵时写 `node gate.mjs 2>&1 | head -4; echo exit=$?` —— 打印的是 `head` 的退出码恒为 0,**种了真缺陷也显示"通过"**。这是本仓 EVOLUTION 台账记过的同类坑第 2 次(前次:verify 的 tsc 被 `| tail` 吞退出码误报 PASS)。
  ② 新加的「三语插值占位符必须逐键相等」硬门,首跑即报 4 条,回源后**全部是误报**。
- **根因**:① shell 管道的 `$?` 是最后一个命令的退出码,`head`/`tail`/`grep` 都会覆盖真实门结果。② 占位符集合跨语言**天然不同**:英文复数/语法标记(`seat{s}`、`direct {label}`)中文无对应,调用点传 `{ s: qty > 1 ? "s" : "" }`,中文少写是正确的;组件还可传占位符**超集**供各语言各取所需(`binary-how.vue:193` 明写「zh 用 `{freq}`、en 用 `{unit}`,两者都传,fmt 忽略未用占位符」)。
- **对策**:① 判门结论一律**落文件再读**:`cmd > log 2>&1; echo "exit=$?"`,或用 `${PIPESTATUS[0]}`;禁止 `cmd | head` 后读 `$?`。② 占位符检查降为 **INFO 级清单**(打印供人审阅,不 fail);键镜像仍是硬门(红测:改一个键名 → 真实退出码 1)。真正的风险「文案要的参数组件没传」需解析全部 fmt 调用点,非镜像脚本职责。
- **已转**:`scripts/i18n-key-mirror.mjs` 扩 AST 收集占位符(495 条带插值文案纳入 INFO 监控),硬门维持键集镜像;本条元教训写入 PITFALLS。
- **元教训**:**一个会稳定误报的门,必然被加白名单绕过,最终等于没门** —— 焊门前先问「它的误报率是否可长期为 0」,做不到就降级成报告,别用白名单硬撑。另:**验证「门有效」本身也要用无管道的方式验**,否则是用一个坏方法去验一个门。

### P-056 [并发·高] 哨兵把「设计值」写死进自测 → 该值事实上不可改;并发 session 撞车先撤回

- **症状**:本会话把 5 个亮色语义 token 加深到无障碍达标(色相 0 偏移),`verify.sh` 立刻红——不是我的改动有错,而是**另一个并发 session 新建的 `token-copy-sentinel.mjs`,其 selftest 把当前色值硬写进 fixture**(`p("--v5-success@light(#0E8E4A) 入表", ...)`、`scanText('color: "#0E8E4A"', ...)`)。改值后 fixture 找不到对应色 → `scanText` 返回空 → `isAllowed(undefined)` 抛 TypeError,**整个自测崩溃而非失败**。
- **根因(两层)**:①**哨兵设计缺陷**:断言依赖「具体设计值」而非「值之间的关系」,等于把设计值焊死——任何合法的设计演进都会崩它,与哨兵本意(防 token 值被抄成字面量)无关。②**并发协作盲区**:两个 session 在同一领域(颜色)作业,后者不知前者存在;发现方式是工作树里出现 untracked 的陌生脚本 + 其数据文件自带批次标注(`_updated: "2026-07-23 · C1 …批次"`、`pending:` 在途条目)。
- **对策**:
  - 哨兵侧:自测**从 tokens.css 动态读当前值**构造 fixture,断言改为**关系式**(「亮暗两值都能扫出」「两值不等」「同值 token 不入表」);取不到元素时让该 probe FAIL 并打印原因,**禁止崩溃**(崩溃会掩盖真实结论)。
  - 协作侧:🔴 察觉并发迹象(陌生 untracked 脚本 / 数据文件带他人批次标注 / 自测因自己改动崩)→ **先撤回自己的改动让对方跑完**,而不是改对方的在途代码;撤回后立刻验证机器门恢复,并把**分析结论留档**(撤的是改动不是结论)。
- **已转**:结论与目标值留档 `docs/changes/2026-07-23-after-c1-followup.md`(含 C1 收口判据 + 哨兵改造方案 + 颜色目标值表 + rem 修复受控实验步骤);本条元教训入 PITFALLS。
- **元教训**:**「哨兵越严格越好」是错的——哨兵该钉住的是不变量(关系),不是当期取值**。钉住取值的哨兵,会把「本应可演进的设计决策」变成「改不动的水泥」,并在第一次合法演进时以崩溃形式暴露。判据:问自己「这个断言在设计合法演进后还成立吗?」不成立就说明钉错了层。

## P-057 · 运行时探针的可信度必须先于结论(C3 2026-07-23)

**现象**:新写的 tap 探针首跑报 203 条「缺按下反馈」,四轮修正后只剩 31 条 —— **172 条是工具 bug**。

**四类根因**(每类都已落成 selftest 红测锚,见 `scripts/tap-feedback-probe.mjs`):

1. **SPA 状态跨路由累积** —— hash 变化不重载页面,一次弹出的 sheet / celebration overlay 会跟着
   后面所有路由被采样(一个 tradein 关闭按钮记进 68 个路由)。**判据:同一元素出现在几十个
   不相干路由 = 先怀疑扫描污染,不是产品全站缺陷。** 修法:URL 加每轮变化的 query 强制整页重载。
2. **过渡起点值** —— `CSS.forcePseudoState` 之后立刻读 computed style,带 `transition` 的元素
   拿到的是过渡**起点**(旧值)→ 明明有反馈判成没有。修法:注入 `transition-duration:0s`。
3. **`:active` 会应用到整条祖先链** —— 反馈写在父容器、click 绑在内层 `<text>`(store 主 CTA 的写法),
   只测元素自身必然误报。修法:自身无变化时再查 4 层祖先。
4. **可见性判定过度杀伤** —— 一度改用 `elementFromPoint` 命中测试,把首屏之外的正常内容
   全判成不可见,目标数 1443 → 225(84% 假阴)。**弹层本工程一律 `v-if`,不在 DOM 即不计,
   不需要视口判定兜底。**

**元教训**:探针的每一次「异常发现」都先当作**工具的嫌疑**,跑已知答案探针证伪自己,再看产品。
四轮里任何一轮直接开修,都会产出一大批「修了不存在的问题」的改动。

## P-058 · inline `style` 会静默吃掉 class 写的 `:active` 反馈(C3 2026-07-23)

`team/agent.vue` 的 bucket 行写着 `class="... active:opacity-70"`,UnoCSS 也确实生成了
`.active\:opacity-70:active{opacity:.7}` —— 但同元素的 `:style` 里有 `opacity: unlocked ? 1 : 0.7`。

**inline style 优先级高于任何 class 规则**,所以这个反馈:
- 锁定态:基础值本来就是 0.7,`:active` 也是 0.7 → 零变化
- 解锁态:inline 的 `opacity:1` 直接压掉 `:active` 的 0.7 → 零变化

**两种状态下都完全失效**,而 grep class 名的检查一律看不出来 —— 只有运行时实测 `:active` 前后
computed style 才抓得到。修法:反馈换用 inline 没写的属性(这里改 `active:scale-[0.98]`)。

全站扫过一遍(88 路由,查 class 有 `active:opacity` 而 inline 有 `opacity` 的元素):**仅此一处**,不是系统性问题。

同形还有一种「声明了等于没有」:`trial-hero-banner` 的 `active:scale-[0.998]` —— 0.2% 缩放,
肉眼与探针都测不出。**反馈值必须与基础值有可感知差异,写了不等于生效。**

## P-059 · SFC 模板 HMR 静默不生效,i18n 却热更了 → 误判「代码没写对」(卡通道 2026-07-27)

同一批改动横跨两层:i18n 新增 key(`cardLimitHint`)+ 组件模板里消费它的那两行。实景检查看到的是:
文案层**是新的**(费用行显示未插值的 `卡通道费 {rate}`,而旧文案写死 `3.5%`),但插值没替换、
新加的限额提示整行不存在 —— 看起来像「`fmt` 调用写错了 + 模板行没保存」。

真因:**i18n 的 .ts 模块热更了,.vue 组件没热更**,页面跑的是「新文案 × 旧模板」的混合体。
旧模板直接 `{{ t.x.cardFeeLabel }}` 输出未插值原文,于是占位符原样显示;限额行本就不在旧模板里。
`location.reload()` 后两处立刻正常,代码一个字没改。

**教训**:改动同时横跨「数据/文案模块」和「组件模板」时,HMR 可能只更新一半,产出一个
两边都不是的中间态。**实景检查前先硬刷新**,别拿混合态的现象去改代码 —— 这次若直接
「修 fmt 调用」,改的是一个根本不存在的问题。(同族:探针异常先怀疑工具见 P-057 元教训。)

## P-060 · verify 的空状态探针存在偶发假红(2026-07-27)

同一份代码连跑三次 verify:第一次 1 fail、第二次 2 fail(含 `pages/search/search` 空状态未渲染)、
第三次 0 fail;而单独跑 `node scripts/empty-state-probe.mjs` 是 20/20 全过。
即该探针在 verify 全量上下文里(前序检查已开过多个 headless 浏览器)会偶发超时假红。

**处置**:遇到空状态探针红,先单跑该探针复核 —— 单跑过 = 假红,不要去改产品代码。
长期修法(未做):探针内部加重试,或让浏览器实例在检查间复用。

## P-061 · 哨兵可以在你以为它在守的时候早就什么都不守了(2026-07-27 audit)

品牌改名(07-22)把 uniapp 的 storage 键从旧前缀改成了 `nexgrid-*`。三处连锁失效,一处比一处隐蔽:

1. **跨仓走查空跑**:admin 的 `*-walkthrough-proof.mjs` 往浏览器注入的仍是旧前缀键,前端读不到 →
   注入全部落空 → 页面保持默认态,于是 FT/FM 那批业务闭环断言**一直在红**,被当成「走查脆性」搁置。
2. **看守它的哨兵自己瞎了**:`uni-storage-key-sentinel.mjs` 的 `KEY_RE` 也只认旧前缀,
   「现役键集」恒为**空集** —— 空集导致「消费键 ∉ 现役集」对每个键都成立,把 30+ 条正常引用全报成废弃。
3. **修完消费侧,哨兵变假绿**:把脚本里的键改成 `nexgrid-` 之后,哨兵按旧前缀既扫不到消费键、
   也扫不到现役键 → 输出「0 处引用全部现役(前端键集 **0 个**)」+ 退出码 0。
   **绿得比真绿还干净,而它一个键都没检查。**

抓住它的只有一个细节:PASS 那行括号里写着「前端键集 0 个」。修好后同一行是「57 个」。

**教训**:
- **改任何全局命名(品牌前缀 / 存储键 / 路由段),必须同时 grep 哨兵与 harness 的判据**,
  它们通常把旧命名硬编码在正则里,而且不会因为失效而报错 —— 只会变绿。
- **哨兵的 PASS 行必须打印「检查了多少个」**,否则空集假绿无法与真绿区分。本条已是本仓惯例,
  这次正是靠它抓到的;新写哨兵一律照办。
- 双向红测要连**判据本身**一起测:阴性(当前代码不报)+ 阳性(注入违规能报)+ **样本量非零**。
  只测前两条,空集也能全过。

(同族:harness 键不同步见 memory `feedback_verify_harness_storage_keys`;
未验证工具输出别建叙事见 `feedback_tool_output_self_distrust`。)

## P-062 · 「N 个步骤失败」多半是第一步挂了,后面根本没跑到(B4 收口 2026-07-27)

admin verify 长期报 `FM-004/005/008/013/016 业务闭环失败`(5 个)+ `FT-013/014/015 失败`(3 个),
读起来像 8 处功能都坏了,实际各只有**一处**根因,修一行整条链就全绿:

| 走查 | 唯一根因 | 表面症状 |
|---|---|---|
| FM(7 步) | 网络 chip 的 label 由 `USDT-TRC20` 缩短为 `TRC20`(uniapp 9d66d4d),class 与文案随之变,走查断言未同步 | 第一步 `.nx-dep-net-usdt-trc20` 找不到 → 抛错 → 后 6 步未执行 |
| FT(7 步) | 脚本引用了一个**从未定义**的常量 `WITHDRAW_ADDRESS`(ReferenceError) | 同上,一进 FT-013 就死 |

**教训**:
- 走查/测试报「一批 ID 失败」时,**先看第一个 ID 的第一条错**,别按数量估工作量 —— 顺序执行的
  链式脚本里,后面的 ID 只是「没轮到」,不是「也坏了」。
- 反过来:**修好第一处后要重跑**,因为后面那些从未真正执行过,可能藏着各自独立的问题
  (本次 FT 修完第一处,立刻暴露第二处坏断言:`seeded.boundAddress` 字段从未被返回过,恒 undefined)。
- 同一批还暴露:门 A 恒失败会掩盖门 B 的问题(`fe-be-mapping-coverage` 的 11/11 全绿断言
  长期挂着,导致它后面的「运营面禁工程名词」检查从未执行,其扫描范围错配也就一直没暴露)。
  **一个 verify 项里串了多个断言时,前面的长期红 = 后面的全部失明。**

## P-063 · 哨兵里 pin 死像素尺寸 = 定时假红,因为行高是「跑门那台机器装了什么字体」的函数(2026-07-28)

零-border 门报 `/pages/team/network 新增 1 处「有填充 + 四边描边」358x390`,读起来像新违例。
实际那个元素**早就在 allowlist 里**、理由写了整段并经主人拍板,只是条目 pin 的是 `358x391` ——
高度掉了 1px,`size` 精确匹配失配,豁免整条落空。

**根因不在代码**:9d66d4d(基线重建)→ HEAD 之间 `src/` 只动了入金 store 逻辑、i18n 文案、
充值卡表单和商品图,`network.vue` 自 3c9aa7c 起零改动,`uno.config.ts` 那次改动去掉注释后与前一版**逐字节相同**。
1px 来自字体度量:`tokens.css` 的字体栈首选 **General Sans**,而本工程 `index.html` 只取
Manrope / JetBrains Mono —— 那句「loaded via `<link>` in layout.tsx」是从 Next 原型抄来的,**在 uni 侧不成立**。
于是 General Sans 渲不渲得出来,取决于**跑门那台机器装没装它**;换机器、装个设计软件,全站文字行高就集体差 1px。
本次同批漂移的还有 3 处(都是 partial 不拦门):`compute-share/download` 46→45、`me/devices` 46→45、
`trust/trust` 39→38,外加 `me/notifications` 多出一条 65(原 66)。**四处同向 −1px,没有一处是真的样式改动。**

**同一根因这是第 3 次发作**,前两次都只改了数字:C3 genesis hero 232→242、B4 orb 卡 388→391。
B4 当时的对策是在 commit message 里写「改字号必顺手核对各基线里 pin 了尺寸的条目」——
**把机器能测的事交给人记,4 天后原样再犯。**

**教训**:
- **哨兵的判据里出现像素值,先问它是不是字体度量的函数**;是,就必须给容差,不能 pin 死。
  已落地:`zero-border-gate.mjs` 的 `sizeMatches()`,allowlist 尺寸走 **±2px**
  (真实设计改动的位移是 3~10px,仍会失配被拦下复核;只放行度量抖动那 1~2px),配 8 条双向红测。
- **容差只给没有自愈路径的那一层**。allowlist 是人工裁决,失配会把人推向 `--update-baseline`,
  那会把「带理由的例外」洗成「无理由的存量」;基线本身有自愈路径(`--update-baseline` 被 `added=0` 守着),
  所以**不给**基线容差。⚠️ 遗留敞口:基线里的 `full` 条目若也漂 1px,仍会报成「新增违例」误导人,
  目前靠 full 条目少(3 条)扛着,要不要一并给容差是门的语义决策,留给主人拍板。
- **报「新增违例」之前先查它在不在 allowlist**:同 route+cls 只差尺寸的,九成是漂移不是新违例。
  照着 FAIL 提示去删 border,删掉的会是一条有理由的例外(C2 第二轮就这么误删过一次)。

---

## P-071 · 限额「先查后建」在异步窗口里必被绕过;判定被没被接上是第二道门

**症状**:FEAT-WD01b「每日提现 1 笔」。独立验收两个标签页同刻点提交,**3 轮 3 中**各自建单成功
(两个不同单号、两页都跳追踪页);同一轮 code review 独立指出同一处。

**根因**:实现成「读计数判超限 → 600ms 风控评估(异步)→ 建单 → `commitWithdrawal` 里 +1」。
检查点与占用点之间隔着整个提交流程,两边都能在对方写盘前读到「今天还没提过」。
**不是并发处理写得糙,是限额模型选错了**:限额只能「先占后建」(claim),不能「先查后建」。
讽刺的是同一个 `submitWithdrawal` 里 60 行外的**余额**并发透支门当天刚做过「落盘再核」的同款修复,
新加的计数门没抄——**加新的资源限额门前,先看同类门(余额/库存)是怎么防并发的**。

**修法**:纯函数 `claimDailySlot(counter, limit, now) → {allowed, next}`;
存储层 `claimWithdrawSlot` 做一次**同步**读-改-写;调用点放在所有拒绝条件之后、建单之前;
`commitWithdrawal` 不再事后 +1。被拒不递增(被拒的提交不该白吃额度)。
残余窗口(跨进程读写交错)写进注释,PROD 由服务端 `UPDATE ... WHERE count < limit` 兜底。

**第二个坑(更值钱)**:验收 F3 实测——把写计数那**一行整个摘掉**(限额彻底失效),
`selfcheck-fastlane` 43/0、`feegate` 14/0、`type-check` 0 错、`verify.sh` 全绿。
判定层有 63 条行为断言守着,「这个判定有没有被调用」**零覆盖**。
判定对不对 / 判定有没有被接上,是两个正交维度,必须分别设门。

**已转哨兵**(`scripts/selfcheck-fastlane.mjs` 第 8/9 节,7 路红测全部会红):
- 行为门:claim 的准入/递增/跨日/坏配置/NaN,平台日边界随机 5000 样本
- **接线门**:claim 调用存在 + 失败 return null · claim 源码位置早于建单 ·
  `commitWithdrawal` 不再计数 · 存储层判据来自 core · 提现路径不直读 `Date.now()`
  (用**精确表达式**不用关键词;每条都有红测)

**顺带**:`floor(ts/86400000)` 切的是 UTC 日,越南(UTC+7)用户额度在当地早 7 点重置。
平台日改按 UTC+7;文案从写死「明日 X 重置」改成绝对时刻「MM-DD HH:mm 后可再提」——
用户本地时钟与平台日未必同一天,写死的相对词在某些时段必然说错(验收实测本地 08-01 02:00 时仍写「明日」)。

---

## P-072 · 判据钉在「会变的东西」上 —— 一次重构同时造出假红与假绿

**症状**(2026-07-31 audit 横切 C 实测):FEAT-WD01 收尾时 `verify.sh` **本身是红的**,
而且同一批哨兵里既有假红也有假绿:

| 形态 | 实例 | 后果 |
|---|---|---|
| 钉局部变量名 | 哨兵 pin `readAccountSnapshot(accountKey.value)`,重构把它改名 `acct` | 无害重命名 → 资金门变红 |
| 钉重构后的死代码 | 哨兵 pin `nextWithdrawable = Math.min(`,而该变量已被 `applyDebit` 取代、零消费者 | 真 clamp 改坏也不红(**假绿**);`tsconfig` 无 `noUnusedLocals`,tsc 也不报 |
| 禁用串被新名超集覆盖 | 禁 `app.advanceWithdrawal`,新函数叫 `advanceWithdrawalArrival`,连**注释**里提一句都命中 | 假红,且诱导后人「放宽哨兵」消红 |
| 整行过滤的白名单 | 品牌哨兵 `grep -viE` 是**整行**过滤,为放行工程目录名加了 `cc|janus` | 同一行里的真违规被一起放行(红测 4 组漏 3 组) |

**根因一句话**:判据锚定的对象比它要守的不变量**变得更快**。变量名、函数名、行内其它内容都会变,
不变量不会。

**修法(已落地)**:
- 别 pin 局部变量名 → 改数**门的道数**(「提现链上必须恰有 2 处重读落盘余额」),少一处即红;
- 别 pin 可能变成死代码的表达式 → 先删死代码,再把哨兵指向真正在跑的实现;
- 禁用串加收尾定界(`app.advanceWithdrawal(` 而不是 `app.advanceWithdrawal`)且**剥注释再判**;
- 整行过滤的白名单**不要为一处例外放宽** —— 改那一处例外本身(哨兵自己的注释里就写着这条正解)。

**衍生**:接线门断言在本轮随实现升级了三次。每次都要**回源改判据**而不是改代码去迁就旧断言 ——
后者等于让哨兵反过来锁死实现。

**同源**:P-071(限额先占后建)· memory `feedback_sentinel_green_without_checking`(判据失效=空集全过)。

---

## P-073 · 提现单据从「单条」改成「列表」——与真后端同构才是根治

**症状**(2026-07-31 audit 两个独立 P0,同一根因):
① 第二笔提现建单会把第一笔**整个顶掉** —— 第一笔的钱已扣、单据从此不可达、到账推进永不再碰它。
  默认配置(每日 1 笔 + 到账 24h)下必然发生:今晚 20:00 提一笔,明早 09:00 平台日已重置就能再提。
② 为兜①加的「在途不许再提」闸,遇上**人工审核单在 mock 里没有任何出口**,把用户**永久锁死**
  (首提 > 小额线即转人工 → 钱扣了 → 此后再也提不了)。补丁比病更糟。

**根因**:`latestWithdrawal: Withdrawal | null` —— 只存最新一条。真后端 `GET /api/withdrawals`
返回的是**列表**。这违反项目 🔴🔴 铁律「Mock 必须 100% 真后台结构、随时可接真后台零重写」。
主人拍板「一切按真接后端处理」后定位清楚:**不是 mock 里怎么变通,是模型本身错了**。

**修法**(结构性,不是打补丁):
- `AccountCloudSnapshot.withdrawals: Withdrawal[]`;读盘处把老快照的单条**自动升级**成列表(不升 schema、老数据不丢)
- 合并层 `mergeWithdrawals`:**按单号取并集**,同一单状态取 rank 更靠后的那份
  (跨进程「读最新」会读到旧值,last-write 会把已到账的单退回处理中)
- store 里 `withdrawals` 是源真理,`latestWithdrawal` 变**派生 computed** —— 十几处消费面一行没改
- 建单 = 追加;到账推进 = **全表扫**(单条版只看最新一笔,前面那笔到点了也永远推不动)
- 单槽闸整条删除 —— 它本就是为兜单槽模型加的产品限制

**运行时证明**:注入老格式(只有单条)→ 重新加载 → 落盘变成 2 条列表、**两笔各自推进到已到账**、老字段清掉。
**已转哨兵**(5 条接线门 + 5 路红测,每路都能打红):列表化 / 追加不覆盖 / 全表扫 / 落盘失败回滚 / 单槽闸不得回归。
合并语义测试补了列表化才有的不变量:**两端各自新建的单必须都保留**(单条版这里会互相顶掉)。

**教训**:补丁修补丁,先问「这个洞是不是模型选错了」。②那个「更糟的补丁」正是没问这句的代价。

---

## P-074 · 「每轮红的脚本都不一样、单跑全过」= 先查环境,而且要查到**具体那个请求**

**症状**:`verify.sh all` 连续 6 轮,每轮红 1-3 条,**每轮红的脚本都不同**,报错却都是同一句
「Failed to load resource: 500」;逐个单跑**全部 PASS**。

**我先后判错两次根因**:
1. 「headless 浏览器孤儿堆积压垮 dev server」—— 实测确有 53 个 `chrome-headless-shell.exe` 孤儿,
   清掉后**恰好**跑出一次 362/0,于是收工。**这是巧合,不是因果。**
2. 「dev server 跑了一整天涨到 811MB 劣化」—— 干净重启后**照样红**。也不是。

**真根因**(12 并发压测 + `page.on("response")` 抓 4xx/5xx 的**具体 URL** 才现形):
`index.html` 外链字体 `https://api.fontshare.com/...`,**并发下被限流返 500**;
而这些脚本把「控制台有任何报错」一律判失败 → **外部网络抖动变成本项目的假红**。
Vite 日志里查不到(不是它发的 500),所以看服务端日志会一路查空。

**修法**:新增 `scripts/lib/console-origin-filter.mjs` —— 只忽略**第三方源的资源加载失败**,
判据写成「白名单本 origin」而不是「黑名单某域名」(换 CDN 不用改门);
第三方脚本抛的 JS 异常、自家任何报错**一条都不放过**。已接入 4 个受影响脚本,
配 8 条双向红测哨兵 `selfcheck-console-filter.mjs`(已进 verify 循环)。修完 **363 pass / 0 fail** 且稳定。

**教训(比这个 bug 本身值钱)**:
- 「同一症状、不同位置、单跑即过」→ 先查环境。**但别停在第一个看起来合理的环境解释上** ——
  我两次都找到了「真实存在且看起来足够」的环境异常(孤儿进程、内存膨胀),两次都不是因果。
- 判据是:**能不能指到那个具体的失败请求**。指不到就还没找到根因,清进程 / 重启只是在换骰子。
  抓法:并发复现 + `page.on("response", r => r.status()>=400 && log(r.url()))`。
- 「一次跑绿了」不等于修好了。修好的标志是**根因被指认 + 判据能解释此前每一次红**。

## P-075 · 能力跑通了 ≠ 用户知道 —— 「静默生效」的功能等于没做

2026-08-01,FEAT-WD01 小额免审快车道。判定层 92 条断言全绿、每道风控闸都有固定靶,
端到端确实在免闸。可走查一坐下来就发现:**表单上一个字都没提**。
输 $30 页面什么都不说(用户以为「这平台本来就快」);输 $80 只说「需人工确认」,
**不说「小一点就能立刻处理」**——用户按字面读只会得出「我这地址提多少都得审」,然后老实等一天。
功能的产品目的(让新用户第一笔小额成功)完全落空,而所有机器门都是绿的。

同批次牵出的三个同族坑:

- **判据混用**:`fastLaneApplied` 只表示「金额在小额线内」,老用户提 $10 也是 true 但一道闸没免。
  拿它当「享受了免审」的渲染判据 → 弹出一句空的「已免去:」。判据必须是 `waivedGates`。
- **假承诺**:免了两道冷启动闸 ≠ 这笔能立刻走(风控闸快车道免不掉)。共用地址 + $30 时
  横幅喊「这笔可立即处理」而实际照样进人工队列。能对用户承诺的**只有最终 route**。
- **常显提示当场对打**:「首次提现审核 24 小时内」原本无条件挂着,于是免审横幅刚说完立即处理,
  下一行就说要审 24 小时;已提过现的老用户也照样被吓一次。且 24 是写死的,
  运营改 `payoutSlaHours` 它不跟着变——空头承诺。

**规则**:

- 任何「静默生效」的能力(免闸 / 提速 / 降费 / 优待),**必须有一条面向用户的告知**,
  且**双向**:生效时正向说出来,不生效时说清「改成什么样就能生效」并给一键改的下一步。
- 「该不该劝他改」用**把目标值代进同一个判定函数**问一次,不许用 `amount > line` 这类启发式——
  启发式会在风控闸命中时照样劝,等于骗用户白改一次金额。
- 判定结果里的每个字段各有语义(`fastLaneApplied` / `waivedGates` / `route`),渲染前先问
  「我要对用户说的这句话,由哪个字段负责」,不许拿相近的字段顶替。
- 判定层的哨兵证明不了这一类问题:它们守的是「算得对不对」,守不了「有没有说出来」。
  接线门(选择器/条件表达式的精确串 + 逐条红测)是正交的第二道门。

已焊 `selfcheck-fastlane.mjs` 接线门 8 条,逐条红测 8/8 命中对应门。

## P-076 · 「显示出来的数字」也是承诺 —— 提交不了的动作不许报价,兑现不了的时限不许写

2026-08-01,FEAT-WD01 收尾的独立走查(把自己当第一次用的越南新用户,真点真输)。
机器门 363 全绿、console 0 报错,却挖出 3 个 P0,全是**数字在骗人**:

- **账单页的「余额」差 400 倍**。`recomputeBalance` 从 0 正向累加账单里 `posted` 的 USDT 行,
  而账单是**部分**流水(收益按 tick 累加不写账单),永远补不齐;提现在提交时就扣了款、
  账单却落 `pending`,只数 posted 又把扣掉的钱算回来。实测账单写「余额 $60.31」、
  钱包写「$24,826.56」。用户看对账单第一反应是「我的两万四被吞了」。
  **修法**:`balanceAfter` 的正主是服务端复式账本,store 不编造;mock 期由页面
  **以当前真实余额为锚往回倒推**,保证最上面那条(用户唯一会核对的一条)= 钱包上的数。
- **超过可提余额时照样出完整报价**。余额 $24,856 输 99999,页面把网络费 / 惩罚费 / NEX 抵扣 /
  「你会收到 $84,750.20」整套算完,底下还接一张「质押 180 天变成 $139,450」的预测卡,
  只有最底下按钮的小字说余额不够。低于最低额、今日笔数用完时同理。
  **修法**:报价是对「你提交后会发生什么」的承诺 —— **提交不了就没有会发生什么**。
  判据直接取页面已有的拦截单源 `submitDisabledReason`,不另起一套(另起必然漂移成
  「明细区说能提、按钮说不能提」)。
- **提交前强制勾选确认的风险披露 §04 写着「标准提现约 30 天」**,而系统实际是
  提交 + `payoutSlaHours`(24h);「> $1,000 进 45 天增强审查窗口」而该窗口当前阶段配置为 0。
  同一笔提现全站四个说法:5 分钟(链上)/ 立即处理(免审横幅)/ 24 小时(页脚 + 追踪页)/ 30 天(披露)。
  **修法**:时限数字全部从配置插值;大额审查窗口配 0 时**整句不出现**,而不是显示「0 天窗口」。

**规则**:

- **凡是显示给用户的钱和时间,都要能指出它从哪个单源来。** 指不出来的,要么接单源,要么别显示。
- 派生「运行余额 / 累计值」这类量,**不要从局部列表正向累加** —— 列表几乎总是不完整的。
  以权威当前值为锚**往回倒推**,至少保证用户会核对的那一端是对的。
- **报价只对真能提交的输入出。** 精确到分的数字会被读成承诺,给一个提交不了的金额报价,
  比不报价更伤信任。判据必须复用页面已有的拦截单源。
- **合规文本(用户勾选「我已阅读」的那份)是最硬的承诺**,里面的时限 / 阈值一个都不许写死;
  条件不成立的条款整句不出现,不要退化成「0 天 / $0」这种自曝配置的写法。

已焊 `selfcheck-slacopy.mjs`(16 断言,红测 7/7)并挂 `verify.sh`;
`selfcheck-feegate` 的两条判据同步从「pin 整串」改成**结构锚定 + 允许附加条件**
(pin 整串会在正当地多挂一道门时假红),红测 5/5 仍能挡住历史漏网形态。

## P-077 · 防线自己需要被防线检验 —— 为 P0 建的门,对那个 P0 是敞开的

2026-08-01,FEAT-WD01 收尾跑 nexion-audit 五层(7 个独立 agent)。机器门 364 全绿、
类型 0 错、走查报的 3 个 P0 已修 —— 审计仍挖出 9 个 P0,其中**多条出在当轮的修复本身上**。

**最该记的三条(都是关于「验证手段」而不是「代码」):**

1. **哨兵对中文失明**。新建的时限哨兵判据用 `/\b\d+\s*(天|days?|ngày)\b/`,
   而 JS 的 `\b` **只认 ASCII** —— 「天」是非词字符、后面的句号也是,两个非词字符之间没有边界。
   实测:走查抓到的原始 P0 文案「标准提现约 30 天。」原样贴回去,哨兵照样全绿;
   en 的 `days` / vi 的 `ngày` 以字母结尾反而正常命中。
   **唯独中文那一面完全不设防,而中文是主人验收看的那一面。**
2. **红测「红了」是靠错的理由**。断言是「占位符在 **且** 没写死时长」两个合取项;
   红测注入把 `{h} 小时` 换成 `30 天`,**同时破坏了两项**,于是因第一项而红。
   「不许写死时长」这个子判据从头到尾没被触发过一次。真正的漏洞形态是
   `30 天({h} 小时内完成审核)` —— 占位符还在、时长也写死了,整条断言 PASS。
3. **哨兵把漏洞焊死当成正确行为**。换绑闸用的「在途状态白名单」漏了 sent / frozen,
   而 selfcheck-rebind 里有一行断言写着「sent / frozen … 判假」—— 哨兵在守护那个漏洞。
   后果:风控冻结中、钱已扣的账户可以在放款前改收款地址。

**归层规则**:

- **红测按合取项拆**:断言有 N 个条件就要有 N 个注入,每个只破坏其中一个、其余保持合法。
  一个注入打红多个条件时,那次红测只能算验了「最先失败的那一项」。
- **红测的注入形态取自真实事故现场**,不要另编一个更容易被抓的;修完必须用原始事故文案再打一次。
- **CJK 文本的判据禁用 `\b`**。要表达「这里不许有数字」,直接写「挖掉占位符后不得出现任何 `\d`」,
  范围收窄到**枚举出来的 key 白名单**,别靠正则在整段里猜边界(顺带消掉 staking 锁仓档位的误伤)。
- **`indexOf` 返回 -1 一律直接判失败**,禁止喂给 `slice`(切出空串 → 正则不命中 → 判 PASS)。
- **结构化文本用真解析**(esbuild transform + import 读对象),不用正则抠 —— 折行 / 单引号 / 模板串 /
  嵌套同名 key / 跨 namespace 取错值,五类坑一次全消。取函数体用**括号配对**,不找字面 `});`。
- **同一个概念只许有一份判据**;白名单与黑名单的失败方向相反(白名单漏一个 = 放行,黑名单漏一个 = 拦住),
  涉及钱一律取保守那一侧。
- **参与建单的每一个输入都要在提交开始时冻成快照**。曾冻了费用与 NEX 余额,唯独漏了金额;
  下单读调用那一刻、写账单是 await 之后重读同一个 ref → 扣款额 ≠ 账单额。
- **没有后台配置面的「配置项」是假的**。为了不写死数字而新增一个 admin 里不存在、
  且没有任何机制按它执行的字段,只是把硬编码换个地方藏,比原来更糟。

**顺带一条工具坑**(本条自己就踩了):往 Bash 里传含反引号的中文长文本,
反引号会被 shell 当命令替换**执行掉**,内容静默消失且 exit 0。写台账 / 注释这类含代码标记的长文本,
一律先把脚本 Write 到 scratchpad 再 node 跑,不走 `node -e` 或 heredoc。

本轮修完:新增/重写机器门 3 个文件,红测 **15/15** 逐项命中对应门(含用原始中文 P0 文案打的那一发)。


## P-078 · 「一半生效」比「完全不生效」更难查 —— 改状态要走这个 store 公认的入口

2026-08-01,给提现失败终态补退款。自己拼了一段 `user.value = { ...user.value, usdtBalance: +(...), earningBuckets: {...} }`,
tsc 绿、哨兵绿、幂等键也写进去了。实景一验:**可提桶加上了 40,总余额纹丝不动**。

根因:account-cloud 的三方合并把余额当**增量计数器**(ADDITIVE_NUMBER_KEYS),
直接写绝对值会在合并时按基线差值算回去;而 earningBuckets 不在那张表里,所以照原样落盘。
同一次赋值里两个字段走了两条不同的合并规则 —— 于是「改了一半」。

**如果只跑机器门,这个 bug 会完整地活下来**:类型对、断言对、幂等对,只有钱不对。

**规则**:

- **改余额 / 状态一律走这个 store 已有的 action**(`creditRewardBucketOnce` / `creditBalance` / `debitBalance`),
  不要在新代码里自己拼 `user.value = {...}`。那些 action 之所以存在,就是因为它们知道合并规则、持久化时机、幂等键该怎么写。
- 确实要新写一条路径时,**先问这个字段在合并表(additive / time-anchor / status-rank)里是哪一类**,
  再问「同一次赋值里的其它字段是不是同一类」。不同类混在一起改,必然一半生效。
- 「幂等键写进去了」≠「这次操作真发生了」。幂等键只证明**走到了那一步**,不证明**结果落地**。
  验收要盯**被改的那个数**,不是盯副产物。
- 这一族只有实景能抓:机器门断言的是「代码长什么样」,而这里代码写得完全正确 —— 错的是它对底层合并规则的假设。

同批还确认了一条正向经验:**退款与置账单失败必须在同一处完成**。
此前两个缺口分开看都像「反正 mock 里走不到」(没有 failed 生产者、也没有退款实现),
合起来就是「钱扣了、单子废了、没人还」。现在两件事写在 `reconcileBills()` 的同一段里,
接后端时不可能只做一半。

---

## P-079 · 「判据失效必红」的门红了,会把它后面整块检查一起吞掉

2026-08-07,在 linked worktree(`.claude/worktrees/<name>/`)里跑 verify,3 条恒红。
根因是几处读兄弟仓写的是**裸相对路径**(`../Nexion-admin-prototype` / `../admin-ops`),
worktree 下解析进了 `.claude/worktrees/` 里,文件恒读不到 —— 是环境假红,不是真漂移。

**真正的教训不在假红本身,在它吞掉的东西。**创世门检查 ⑧ 的写法是
「兄弟仓两文件可读」判完再 `if (可读) { ⑧a…⑧d + 各自红测 }`。第一条红了之后,
后面 7 项**连同它们的红测一起被跳过**——日志上只显示 1 条红,而实际上
这道跨仓一致性门在 worktree 里是**全暗的**。修完 48 pass/1 fail → 56 pass/0 fail,
差额 8 条全是原本被吞的检查。

**规则**:

- **读兄弟仓一律走解析,不写裸相对路径**。`verify.sh:36-44` 早就有 worktree 感知的
  `ADMIN_ROOT`(同级优先 → 落空用 `git rev-parse --git-common-dir` 反推主 checkout 根),
  病灶只是别处没复用它。`selfcheck-genesis-gate.mjs` 现在有同款 `siblingRepo()`。
  **不要抄「`../x` 和 `../../../../x` 双候选」那种写死层级的写法**——层级一变又哑。
- **看到「判据失效」类的红,先问它吞了多少检查**,别只数红的条数。
  一条红后面挂着 7 条静默跳过,和一条红就是一条红,在日志里长得一模一样。
- 判假红还是真漂移:**直接读主 checkout 下那个真文件**,确认要比对的字面量真在里面。
  「文件读不到」和「读到了但内容真漂移」在 grep 日志里无法区分。

**已转**:`verify.sh` platform-anchor 段改走 `$ADMIN_ROOT`;
`selfcheck-genesis-gate.mjs` ⑧ 加 `siblingRepo()` 解析(git 不可用时落回同级路径,读不到照旧判红,fail-closed 未变)。

---

## P-080 · 探针 fail-open:探不到 ≠ 无违例

同一天,给上面那条做双向验证时撞出来的 —— **是双向验证本身抓到的,不是审阅代码看出来的**。

`scripts/tap-feedback-probe.mjs` 把 `BASE_URL` 指向一个死端口,5 条路由全部
`ERR_CONNECTION_REFUSED`,它却打印 **「tap-feedback 无新违例(扫 5 路由 / 0 个 tap 目标)」
并 exit 0**。机制:逐路由的 `try/catch` 把导航失败降级成一行 `!` 警告,
然后 0 个目标 → 0 条违例 → 一路走到隐式 exit 0。空集让全称判据恒真。

更险的是 `--update-ledger`:拿这么一次坏跑去重建基线,会把 11 条存量黄灯**清成空台账**
——门连自己的基线一起丢。

**规则**:

- **凡是「扫了 N 个 / 0 违例」形态的门,都要回头验一次 N=0 时它红不红。**
  这条和 P-079 是同一个病的两面:一个是判据被跳过,一个是判据在跟空集比。
- 覆盖面 witness 要放在**任何写盘/重建基线之前**,否则坏跑会污染基线。
- 双向验证不是走过场:这个洞存在多久没人知道,是「把 BASE_URL 指向死端口看它红不红」
  这一步逼出来的。**只验绿的那一面,等于没验。**

**已转**:`tap-feedback-probe.mjs` 加覆盖面 witness
(任一路由探测失败 或 总目标数 = 0 → 判红 exit 1),置于 `--update-ledger` 分支之前。
同族的 `dom-qa` / `invisible-fill-scan` 实测本来就是非零退出,`empty-state-probe` 亦然。

### P-057 [验证方法·高] 红测/走查的环境不冷启不独占 → 伪 bug 吃掉 40 分钟 + A/B 误判

- **症状**(2026-08-07 守卫重构):走查结果与磁盘代码矛盾(守卫行为忽对忽错、
  同条件两次结果不同),一度得出「我的 diff 引入回归」的错误 A/B 判决,受控重放后推翻。
- **根因**(三个变体,同族于「dev server 供旧模块图」):
  1. 对 `App.vue` 的「改了再还原」红测探针,每次写盘都 HMR 进正开着的页面 → 模块图搅浑;
  2. 僵尸旧标签页(旧代码实例)与被测页共享 localStorage,定时器还在写;
  3. `localStorage.clear()` + 跳转 ≠ 白纸——濒死页的计时器在 clear 后、卸载前把旧状态写回。
- **对策**:🔴 红测前停 dev server(或对不被供应的副本做);🔴 走查前关光同源旁页 +
  冷重启 dev;🔴 状态手术在静默态做;🔴 **行为敏感改动先在旧代码上录基线**,
  A/B 是第一步不是最后的破案工具,两侧测量条件必须对等。
- **已转**:memory `feedback-dev-server-stale-module-graph` 族条目扩容(四条新规)。

### P-058 [框架假设·待真机验证] H5 的 onShow 唯一触发源是 visibilitychange —— bfcache 恢复场景未验证

- **来源**:2026-08-07 守卫增量独立审查 Finding D(读框架源码证实:uni-h5 只挂
  visibilitychange 一根线,无 pageshow/pagehide 兜底;onShow 在 H5 上没有第二条触发路径)。
- **影响面**:**全部** onShow 驱动的生命周期(采矿 tick / 结算 / 各轮询 / 守卫自愈环)——
  若某浏览器/webview 在 bfcache 恢复时不补发 visibilitychange,回前台后所有循环不重启,
  整个应用静止(守卫只是其中之一,非它独有)。属**既有全局假设**,守卫修复让它多了一个依赖方。
- **待验证**:真机/多浏览器矩阵走「整页跳出 → 系统返回」路径(不是切标签页/切 App——那些必触发)。
  旁支:reLaunch 对在途同目标导航的并发语义未查到源码,慢设备上 1s 重试理论存在活锁可能,一并真机验。
- **另记**(同审查 (a)):白名单前缀集合与 quest 路由集合互斥是无哨兵看守的隐性前提,
  谁往白名单里加 quest 路由,守卫返回 false 的语义就悄悄变了。

---

## P-081 · 安全装置被归进它自己要管的那组开关里

**症状**(2026-08-07,守卫存活性族**第三次**复发):全站唯一的周期性权限守卫,在若干页面上
整个生命周期都不启动 —— 未登录的人只用页面自带链接就能走进提现页并停留、操作;已登录的人
中途路过一次静态评审页,守卫当场失效,之后在别的标签退出登录也踢不掉他。

**为什么前两轮都没修掉**:R1 修「守卫看错路由」(读取口归一)、R2 修「冷启动那一枪被吞」
(onShow 无条件启动)——**两轮修的都是「武装侧」**。没人动「解除武装侧」,因为
`stopQuestWatch()` 就写在 `stopBusinessLoops()` 里,看起来天经地义。

**根因(第一性原理)**:守卫是**安全装置**,却被归类成**业务循环**。于是每一处
「本页不该跑业务」的判断都会顺手把它一起关掉 —— 而恰恰是这些页面最需要它:它们正是
未授权者能停留、并借以跳进业务页的跳板。叠加 H5 的 App 级 `onShow` 只在整页加载 /
标签页重新可见时触发、**不随应用内跳转触发**,关掉就没有任何重新武装的路径。

**同根因的第二条腿**:落地页被当成本次页面加载的**永久状态**。`scheduleAccountSessionBootstrap`
在评审页落地时直接 return,而认领是一次性的 → 该标签**永无 sessionId** →
`session.validate()` 首行「没有 sessionId 就算 active」→ 跨标签登出与运营吊销永远踢不掉它,
哪怕守卫活着、哪怕早已走到业务页。

**规则**:

- 🔴 **给任何「批量停止」函数划成员时,先问:这里面有没有安全装置?** 安全装置不跟业务共用开关,
  它的开关只跟「进程/前台是否存在」绑定(本例:`onShow` 起、`onHide` 停,一对一)。
- 🔴 **冷启动落地页不决定本次加载的余生。** 凡是「落地在 X 就跳过 Y」的一次性决定,都要问
  「用户走开之后 Y 还补不补?」——不补就是永久跳过。
- 🔴 **同型第三次复发 = 停下来重画结构,不许再打第三个补丁。** 前两轮都在同一侧修,
  说明大家看的是同一张不完整的图。

**已转**:`scripts/selfcheck-guard-liveness.mjs`(挂 `verify.sh`)——守 4 条不变量
(守卫不在业务停止组里 / 唯一停点在 onHide / onShow 无条件武装 / 守卫每拍补会话认领),
每次运行对内存副本做 4 组缺陷注入自证判据还活着(判据死了也判红)。已双向红测:
撤回任一处修复,对应那条判据判红并点名。

**追记(独立审计 2026-08-07,同轮)**:这一族其实有**三条腿**,y1 只收了前两条。

第三条腿 = 「谁都能停,只有一处能起」的不对称:五个业务循环
(`startTick / startArrivalPoll / startTrialPoll / startOrderPoll / startMilestonePoll`)
**全站唯一起点在 `onShow` 里**,而 `stopBusinessLoops()` 有 8 个调用点。
路过一次静态评审页,到账推进/账单结算/退款/里程碑/试用/订单在本次页面加载内**全部永久停摆**。
**未修,详情与建议改法见 `docs/audit/2026-08-07-probe-and-guard-audit.md`「第三条腿」段。**

**再追一条方法论**:本轮为这一族焊的第一版哨兵,被独立审计用 **7 种改法全部绕过**
(挪进另一个失败分支 / 包一层壳函数 / 内联 clearInterval / 一行式 return / 裹进永假条件 /
挪到短路之后 / 把节拍稀释到 30 分钟),而它照报 8 pass / 0 fail。
根因:**判据形态是「某个函数体里有没有这个字符串」= 形状判据**,搬个地方就绕过去了。
🔴 **规则:守「只许谁做某件事」的不变量,判据要写成「全文件扫谁在做,集合必须恰好等于允许集」,
不要写成「在某个地方查有没有」。** 前者对搬家/包壳天然免疫,后者是打地鼠。
🔴 **同一族出过 N 种形状之后,形状判据已经不够了,必须补一道行为门**
(`scripts/guard-liveness-runtime.mjs`:真浏览器跑那条越权路径,代码怎么重构都拦得住)。

## P-082 · 拿路径字符串当判据:同一个目录有四种写法,门在「官方链」绿、在「文档教的跑法」必红

`verify.sh` 的 [2.5] 树身份门比 `VITE_ROOT_DIR`(server 报的)和 `PROJECT_DIR`(套件所在)
是否相等,只把反斜杠换成了斜杠。而同一个目录在本仓有**四种写法**:
`D:\WORKS\x`(Node 的 `process.cwd()` 序进 vite env JSON)· `D:/WORKS/x`(Node 起的 bash 里 pwd)·
`/d/WORKS/x`(Git Bash 的 pwd)· `/mnt/d/WORKS/x`(WSL 的 pwd)。于是:

- `npm run verify` → `run-legacy-suite.mjs` 用 Node spawn bash,两边都是 `D:/x` → **恰好判等,门是绿的**;
- CLAUDE.md 让人直接敲的 `bash scripts/verify.sh`(Git Bash)→ `D:/x` vs `/d/x` **永不相等**,
  门**必红**,还红成「server 服的是别的工作树」这种指错方向的结论。

**偏偏后者才是这道门唯一有意义的用法** —— 前者由自启壳自起自验,树身份天然相等,
判据是同义反复。也就是说:门在它不管用的地方绿着,在它该管用的地方一直红着。

**规则**:

- **两个路径要判等,先归一形态再比**(反斜杠/正斜杠 · 盘符 `D:/x` ↔ `/d/x` ↔ `/mnt/d/x` ·
  大小写 · 末尾斜杠),别拿原样字符串比。只 `tr A-Z a-z` 不叫归一。
- **一道门如果在某条常用跑法上「一直是红的」,那不是已知技术债,是判据坏了**。
  门一旦落下「公认的正常红」,人就学会了跳过它,它就不再是门(与 P-079 同族:
  一个是判据被跳过,一个是判据被人跳过)。
- **判红之后要问「哪条路径在跑它」**:这条洞能长期存在,是因为官方链绿、只有手跑红,
  而手跑的人默认「worktree 里本来就这样」。

**已转**:`verify.sh` [2.5] 加 `norm_root()` 归一 + **常驻双向红测**
(四种写法判等 / 嵌套工作树·异盘符判不等),自检不过则树身份判断不许发绿灯。
已实测双向:同树四种写法全 PASS;真指到 sibling worktree(`z2-withdraw-cap`)
与父树(`Nexion-uniapp`)时照旧 FAIL。
