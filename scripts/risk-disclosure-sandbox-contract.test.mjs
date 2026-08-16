import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

// 兄弟仓解析沿用本仓 idiom(funds-run-scoped-isolation-contract.test.mjs):NEXGRID_BACKEND_ROOT 显式指定,
// 否则退标准兄弟位 ../nexion-backend。原先三处后端文件写死 `D:/workspace/nexion-backend/...`、
// App 文件写死 `D:/workspace/NX1.0-UniApp/...`(该文件其实就在本仓),且读取在**模块顶层** ——
// 换台机器整个文件顶层就崩,连纯本仓的那两条断言都跑不了(连坐)。
const appRoot = path.resolve(import.meta.dirname, "..");
const configuredBackend = process.env.NEXGRID_BACKEND_ROOT?.trim();
if (configuredBackend && !fs.existsSync(path.resolve(configuredBackend))) {
  // 显式配了却指向空气 = 配置错,必须炸。降级成 skip 会让「我明明配了仓」的人拿到假绿。
  throw new Error(`NEXGRID_BACKEND_ROOT 指向的兄弟仓不存在: ${path.resolve(configuredBackend)}`);
}
const backendRoot = configuredBackend ? path.resolve(configuredBackend) : path.join(appRoot, "..", "nexion-backend");
// 缺仓 → 只让跨仓断言 skip,本仓断言照跑;skip 理由写进文案,套件会统计并大声打印。
const backendMissing = fs.existsSync(backendRoot)
  ? false
  : `跨仓断言未运行 —— 兄弟仓 nexion-backend 不在 ${backendRoot}(设 NEXGRID_BACKEND_ROOT 或克隆到兄弟位后才真跑)`;
const readBackend = (relative) => fs.readFileSync(path.join(backendRoot, "src/main/java/ffdd/opsconsole/content", relative), "utf8");

const appApi = read("src/api/risk-disclosure-api.ts");

test("risk disclosure backend exposes explicit provenance and only local-sandbox may use mock", { skip: backendMissing }, () => {
  const service = readBackend("application/AppRiskDisclosureService.java");
  const view = readBackend("domain/AppRiskDisclosureView.java");
  const initializer = readBackend("application/RiskDisclosureLocalSandboxInitializer.java");
  assert.match(service, /getActiveProfiles\(\)[\s\S]*length == 1[\s\S]*local-sandbox/);
  assert.match(service, /localSandbox \? "SANDBOX"/);
  assert.match(service, /localSandbox \? "mock"/);
  assert.match(initializer, /@Profile\("local-sandbox"\)/);
  assert.match(initializer, /active\.length == 1 && "local-sandbox"\.equals\(active\[0\]\)/);
  // 生产/默认档 fail-closed:辖区没配就报错,不许 fallback 到任何本地文案。
  assert.match(service, /RISK_DISCLOSURE_JURISDICTION_NOT_CONFIGURED/);
  assert.match(view, /String source,/);
  assert.match(view, /String sourceEnvironment,/);
});

test("App parser accepts only server/production or explicit mock/sandbox provenance", () => {
  assert.match(appApi, /source: "server" \| "mock"/);
  assert.match(appApi, /sourceEnvironment: "PRODUCTION" \| "SANDBOX"/);
  assert.match(appApi, /source !== "server" && source !== "mock"/);
  assert.match(appApi, /source === "mock" && sourceEnvironment !== "SANDBOX"/);
  assert.match(appApi, /source === "server" && sourceEnvironment !== "PRODUCTION"/);
});

test("App has no local disclosure fallback and reads the server surface", () => {
  assert.match(appApi, /GET/);
  assert.doesNotMatch(appApi, /localStorage|mock.*fallback|fallback.*mock/i);
});
