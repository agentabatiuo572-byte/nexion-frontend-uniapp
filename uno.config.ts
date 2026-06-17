import { defineConfig, presetWind3, presetAttributify } from "unocss";

// Nexion uni-app UnoCSS config.
// presetWind3 = Tailwind v3-compatible utilities (covers the ~5449 className
// usages ported from the Next.js prototype, including arbitrary values like
// text-[var(--v5-ink)] / bg-[var(--v5-surface)] which resolve against the CSS
// custom properties defined in src/styles/tokens.css).
// We keep px (not rpx): H5 + App(webview .vue) both render standard CSS.
export default defineConfig({
  presets: [presetWind3(), presetAttributify()],
});
