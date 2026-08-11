#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverSessionReloadRecoveryOnly = process.argv.includes("--server-session-reload-recovery");

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function probe(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.setTimeout(1000, () => request.destroy());
    request.once("error", () => resolve(false));
  });
}

async function waitForServer(url, child, output) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`H5 dev server exited early (${child.exitCode})\n${output()}`);
    if (await probe(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`H5 dev server did not become ready\n${output()}`);
}

function runGate(script, baseUrl, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, "scripts", script), ...args], {
      cwd: root,
      env: { ...process.env, BASE_URL: baseUrl },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => code === 0
      ? resolve(output.trim())
      : reject(new Error(`${script} failed (${code})\n${output}`)));
  });
}

function stopTree(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const npmCliCandidates = [
  process.env.npm_execpath,
  path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
].filter((candidate) => candidate && fs.existsSync(candidate));
const serverCommand = npmCliCandidates.length ? process.execPath : (process.platform === "win32" ? "npm.cmd" : "npm");
const serverArgs = [
  ...(npmCliCandidates.length ? [npmCliCandidates[0]] : []),
  "run", "dev:h5", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort",
];
const server = spawn(serverCommand, serverArgs, {
  cwd: root,
  env: {
    ...process.env,
    VITE_NEXGRID_API_MODE: serverSessionReloadRecoveryOnly ? "sandbox" : "mock",
  },
  shell: false,
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput = (serverOutput + chunk).slice(-12_000); });
server.stderr.on("data", (chunk) => { serverOutput = (serverOutput + chunk).slice(-12_000); });

try {
  await waitForServer(`${baseUrl}/?nx_device=off`, server, () => serverOutput);
  // The two route-guard suites deliberately keep pages open across several
  // one-second guard ticks. Running them beside eight Chromium-heavy probes can
  // starve those timers on Windows and create a false red even though the same
  // witness passes immediately in isolation. Keep the security-critical route
  // suites deterministic, then parallelise only the independent DOM probes.
  const outputs = serverSessionReloadRecoveryOnly
    ? [await runGate("server-session-reload-recovery-runtime.mjs", baseUrl)]
    : [
      await runGate("guard-liveness-runtime.mjs", baseUrl),
      await runGate("auth-guard-verify.mjs", baseUrl),
      ...await Promise.all([
        runGate("business-loop-liveness-runtime.mjs", baseUrl),
        runGate("spec6-entry-surface-runtime.mjs", baseUrl),
        runGate("trial-check.mjs", baseUrl),
        runGate("sticky-check.mjs", baseUrl),
        runGate("backnav-check.mjs", baseUrl),
        runGate("page-check.mjs", baseUrl, [
          "/#/pages/index/index",
          "h5-runtime-home",
          ".home-earnings-cluster",
        ]),
      ]),
    ];
  for (const output of outputs) console.log(output.split(/\r?\n/).at(-1));
  console.log(serverSessionReloadRecoveryOnly
    ? `H5 server-session reload recovery: PASS (isolated server ${port}, returning + fresh flows)`
    : `H5 runtime gates: PASS (isolated server ${port}, 20 scenarios + 5 direct probes)`);
} finally {
  stopTree(server);
}
