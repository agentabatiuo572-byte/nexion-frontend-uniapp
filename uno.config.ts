import { defineConfig, presetWind3, presetAttributify } from "unocss";

// NexGrid uni-app UnoCSS config.
// presetWind3 = Tailwind v3-compatible utilities (covers the ~5449 className
// usages ported from the Next.js prototype, including arbitrary values like
// text-[var(--v5-ink)] / bg-[var(--v5-surface)] which resolve against the CSS
// custom properties defined in src/styles/tokens.css).
// We keep px (not rpx): H5 + App(webview .vue) both render standard CSS.
export default defineConfig({
  presets: [
    presetWind3(),
    // 🔴 attributify 会把 SVG 的呈现属性当成属性式工具类:`font-size="9.5"` 被扫成 `[font-size~="9.5"]{font-size:2.375rem}`,
    // 真 SVG 文字直接放大 4 倍(P-121 追记,2026-08-17 实测)。UnoCSS 自带的默认豁免表已经为同一件事豁免了
    // fill / opacity / stroke-opacity;这里把 font-size / fill-opacity 补进去(传了 ignoreAttributes 就整表覆盖,默认四项要照抄)。
    // 全仓 `font-size=` 属性只出现在 <svg> 里的 <SvgText> 上,HTML 元素零使用 —— 对现有可见 UI 影响为 0。
    // 守卫:scripts/svg-text-source-gate.mjs(静态,豁免在位)+ scripts/svg-text-render-probe.mjs(运行时,属性值 == 计算值)。
    presetAttributify({ ignoreAttributes: ["placeholder", "fill", "opacity", "stroke-opacity", "font-size", "fill-opacity"] }),
  ],
});
