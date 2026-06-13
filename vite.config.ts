import { defineConfig } from "vite";
import uniPlugin from "@dcloudio/vite-plugin-uni";
import UnoCSS from "unocss/vite";

// @dcloudio/vite-plugin-uni ships as CJS. With "type":"module" in package.json
// (required so the ESM-only unocss/vite plugin can be imported), Vite loads
// this config as ESM, where the callable is exposed on `.default`. Normalize
// so uni() works regardless of interop mode.
const uni = (uniPlugin as unknown as { default?: typeof uniPlugin }).default ?? uniPlugin;

export default defineConfig({
  plugins: [uni(), UnoCSS()],
});
