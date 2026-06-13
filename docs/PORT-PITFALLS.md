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

<!-- 后续每批新坑追加于下，转哨兵/规则后标注「已转」 -->
