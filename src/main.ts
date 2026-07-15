import { createSSRApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { mountSpec7DevBridge } from "@/lib/spec7-dev-bridge";
import { mountAuthOtpDevBridge } from "@/store/auth-otp";
import "./styles/tokens.css";
import "uno.css";

declare global {
  interface Window {
    __NX_DEVICE_SHELL__?: boolean;
  }
}

const ShellHost = { render: () => null };

export function createApp() {
  const isDeviceShellHost = typeof window !== "undefined" && window.__NX_DEVICE_SHELL__;
  const app = createSSRApp(isDeviceShellHost ? ShellHost : App);
  if (isDeviceShellHost) {
    return {
      app,
    };
  }

  app.use(createPinia());
  if (import.meta.env.DEV) {
    // DEV-only: SPEC-7 演示桥(模拟后台处置下发)。
    mountSpec7DevBridge();
    // DEV-only: FEAT-AUTH01 OTP 闸门演示桥(seedSendLog/reset/inspect)。
    mountAuthOtpDevBridge();
  }
  return {
    app,
  };
}
