import { defineConfig, loadEnv } from "vite";
import uniPlugin from "@dcloudio/vite-plugin-uni";
import UnoCSS from "unocss/vite";

// @dcloudio/vite-plugin-uni ships as CJS. With "type":"module" in package.json
// (required so the ESM-only unocss/vite plugin can be imported), Vite loads
// this config as ESM, where the callable is exposed on `.default`. Normalize
// so uni() works regardless of interop mode.
const uni = (uniPlugin as unknown as { default?: typeof uniPlugin }).default ?? uniPlugin;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  // The dev server, rather than the browser bundle, owns the loopback target.
  // This makes H5 -> /api same-origin and avoids localhost/127.0.0.1 identity
  // splits. A production bundle must provide its own HTTPS gateway explicitly.
  const apiPreviewTarget = env.VITE_NEXGRID_API_PREVIEW_TARGET?.trim() || "http://127.0.0.1:8110";
  const apiPreviewEdgeCountry = env.VITE_NEXGRID_API_PREVIEW_EDGE_COUNTRY?.trim().toUpperCase();
  if (apiPreviewEdgeCountry && !/^[A-Z]{2}$/.test(apiPreviewEdgeCountry)) {
    throw new Error("VITE_NEXGRID_API_PREVIEW_EDGE_COUNTRY must be a two-letter ISO country code");
  }
  const apiPreviewHeaders = apiPreviewEdgeCountry
    ? { "X-Nexion-Edge-Country": apiPreviewEdgeCountry }
    : undefined;

  return {
    plugins: [uni(), UnoCSS()],
    // 只被懒编译页面引用的依赖必须在这里显式预打包:uni 的按需编译让启动扫描
    // 抓不到它们,首个访客触发运行时依赖重打包 → 在途模块请求 500 + 整页 reload,
    // uni 异步页面组件等满 60s 直接弹「连接服务器超时」。入口链上的依赖
    // (vue/pinia/vue-i18n)启动即扫到,无需列出。
    optimizeDeps: {
      include: ["qrcode-generator"], // 仅 proof.vue / share-poster-sheet.vue 引用
    },
    server: {
    // 🔴 双栈监听(2026-08-05 结构性反思第 1 步)。此前默认只绑 [::1]:
    //   curl localhost=200 而 127.0.0.1=拒连 → verify 前段 curl 探活全绿、
    //   后段硬写 127.0.0.1 的 6 个 Playwright 齿轮 ERR_CONNECTION_REFUSED,
    //   **「没跑起来」被读成「跑过且绿」**,两轮 agent 还对根因得出互相矛盾的结论。
    //   host:true → Node 监听 `::` 双栈,127.0.0.1 / [::1] / localhost / 局域网都通。
    //   修在服务端一处,不追着改 N 个脚本里写死的地址(那是散弹枪,新脚本必复发)。
    host: true,
    port: 5173,
      strictPort: true, // 5173 被占就明着炸,不许静默换端口把 verify 全家变假红
      proxy: {
        // The real H5 UI calls /auth/users/* from its same-origin base URL.
        // The backend intentionally owns that same path, so proxy it without
        // rewriting. Backend-native configuration routes continue under /api.
        "/auth": {
          target: apiPreviewTarget,
          changeOrigin: true,
          headers: apiPreviewHeaders,
        },
        "/api": {
          target: apiPreviewTarget,
          changeOrigin: true,
          headers: apiPreviewHeaders,
        },
      },
    },
  };
});
