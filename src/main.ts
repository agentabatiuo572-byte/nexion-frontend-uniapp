import { createSSRApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { mountSpec7DevBridge } from "@/lib/spec7-dev-bridge";
import "./styles/tokens.css";
import "uno.css";
export function createApp() {
  const app = createSSRApp(App);
  app.use(createPinia());
  // DEV-only: SPEC-7 演示桥(模拟后台处置下发;PROD 构建内部直接 return)。
  mountSpec7DevBridge();
  return {
    app,
  };
}
