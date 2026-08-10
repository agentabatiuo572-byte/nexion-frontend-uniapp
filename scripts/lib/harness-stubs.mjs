// selfcheck harness 的共享 stub 单源。
//
// 🔴 why 单源:c37e642 给 earning-release.ts 加了一条 `import { shallowRef } from "vue"`,
// 5 份手抄 vue-stub 只有 money-receipt 被同步补了 shallowRef —— 其余 4 个脚本
// (money-cas / genesis-invite / money-rollback / claim-idempotency)esbuild bundle 期
// 硬崩、0 断言执行,资金门形同虚设(2026-08-10 z1 判决包立案)。
// stub 台账是判据的一部分,散抄必漂移;两种方言与 runtime 导出面都只在本文件维护。
import { readFileSync } from "node:fs";
import path from "node:path";

// vue-stub 两种方言(按脚本自家 pinia-stub 的协议选用):
// PLAIN:裸 { value } —— 配 `defineStore = (_id, setup) => setup` 直取 setup 返回值的脚本。
export const VUE_STUB_PLAIN = `export const ref = (v) => ({ value: v });
export const shallowRef = ref;
export const computed = (f) => ({ get value() { return f(); } });
export const watch = () => {};
export const reactive = (v) => v;`;

// NXREF:带 __nxRef 标记 —— 配 Proxy 解包版 pinia-stub 的脚本。
export const VUE_STUB_NXREF = `export const ref = (v) => ({ __nxRef: true, value: v });
export const shallowRef = ref;
export const computed = (fn) => ({ __nxRef: true, get value() { return typeof fn === "function" ? fn() : fn.get(); } });
export const reactive = (v) => v;
export const watch = () => {};`;

// runtime-stub 不手列导出 —— 从 src/api/runtime.ts 磁盘真相扫出口清单,新增 API 永不掉队
// (手列清单正是本次 pointsApi / i18nApi 掉队的根因)。
// remoteApiEnabled 固定 false:selfcheck 族验的全是 mock/本地语义;
// apiRuntimeConfig 给 mock 形状,其余导出一律「调用即抛」的不可用代理。
export function runtimeStub(root) {
  const src = readFileSync(path.join(root, "src", "api", "runtime.ts"), "utf8");
  const names = [...src.matchAll(/^export (?:const|let|function|async function) (\w+)/gm)].map((m) => m[1]);
  if (names.length === 0 || !names.includes("remoteApiEnabled")) {
    throw new Error("harness-stubs: src/api/runtime.ts 导出面解析失败(0 个或缺 remoteApiEnabled)—— 判据失效必红,禁静默放行");
  }
  const special = {
    remoteApiEnabled: "export const remoteApiEnabled = false;",
    apiRuntimeConfig: 'export const apiRuntimeConfig = { mode: "mock", baseUrl: "" };',
  };
  const body = names.map((n) => special[n] ?? `export const ${n} = unavailable;`).join("\n");
  return `const unavailable = new Proxy({}, { get: () => async () => { throw new Error("runtime API is outside this self-check"); } });\n${body}`;
}
