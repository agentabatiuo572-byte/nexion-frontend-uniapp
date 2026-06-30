import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = fs.readFileSync("src/store/account-cloud.ts", "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText;

const sandbox = { exports: {}, require, console, Date, Map, JSON, Math };
vm.runInNewContext(js, sandbox);
const { mergeAccountSnapshots } = sandbox.exports;
if (typeof mergeAccountSnapshots !== "function") {
  throw new Error("mergeAccountSnapshots export missing");
}

const base = {
  schema: 1,
  accountKey: "demo",
  entrySurface: "h5",
  updatedAt: 1000,
  user: {
    email: "demo@nexion.ai",
    tier: "L2",
    joinedAt: 1,
    referralCode: "NEXION",
    usdtBalance: 100,
    nexBalance: 10,
    pendingEarnings: 1,
    cumulativeDepositUsdt: 0,
  },
  devices: [
    {
      id: "phone-1",
      kind: "phone",
      todayEarnings: 1,
      todayEarningsNEX: 2,
      status: "online",
      lastSettledAt: 1000,
      currentTask: {
        id: "IG-A1",
        category: "IG",
        type: "Image Gen",
        model: "Flux",
        client: "Mosaic",
        location: "Berlin",
        totalSec: 30,
        startedAt: 1000,
        reward: 0.1,
      },
      recentTasks: [],
    },
  ],
  earnings: { today: 1, todayNEX: 2, thisWeek: 10, thisMonth: 20, total: 30, history: [] },
  latestWithdrawal: null,
};

const latest = structuredClone(base);
latest.user.usdtBalance = 999;
latest.devices[0].lastSettledAt = 2000;
latest.devices[0].currentTask.startedAt = 2000;
latest.devices.push({ id: "pc-1", kind: "pc-gpu", todayEarnings: 0, todayEarningsNEX: 0, status: "online" });

const staleWriter = structuredClone(base);
staleWriter.earnings.today = 1.5;
staleWriter.user.pendingEarnings = 1.5;
staleWriter.devices[0].lastSettledAt = 1500;
staleWriter.devices[0].currentTask.startedAt = 1500;

const merged = mergeAccountSnapshots(base, staleWriter, latest);
if (merged.user.usdtBalance !== 999) {
  throw new Error(`stale writer overwrote latest balance: ${merged.user.usdtBalance}`);
}
if (!merged.devices.some((d) => d.id === "pc-1")) {
  throw new Error("stale writer dropped latest device");
}
const mergedPhone = merged.devices.find((d) => d.id === "phone-1");
if (mergedPhone?.lastSettledAt !== 2000) {
  throw new Error(`lastSettledAt was merged as an additive balance field: ${mergedPhone?.lastSettledAt}`);
}
if (mergedPhone?.currentTask?.startedAt !== 2000) {
  throw new Error(`nested currentTask.startedAt was overwritten by a stale writer: ${mergedPhone?.currentTask?.startedAt}`);
}
if (merged.earnings.today <= latest.earnings.today) {
  throw new Error("local earnings delta was not merged");
}

const taskIdentityBase = structuredClone(base);
taskIdentityBase.devices[0].currentTask.id = "TASK-A";
taskIdentityBase.devices[0].currentTask.startedAt = 1000;
const taskIdentityLatest = structuredClone(taskIdentityBase);
taskIdentityLatest.devices[0].currentTask.id = "TASK-C";
taskIdentityLatest.devices[0].currentTask.startedAt = 3000;
const taskIdentityStale = structuredClone(taskIdentityBase);
taskIdentityStale.devices[0].currentTask.id = "TASK-B";
taskIdentityStale.devices[0].currentTask.startedAt = 2000;
const taskIdentityMerged = mergeAccountSnapshots(taskIdentityBase, taskIdentityStale, taskIdentityLatest);
const identityTask = taskIdentityMerged.devices.find((d) => d.id === "phone-1")?.currentTask;
if (identityTask?.id !== "TASK-C" || identityTask?.startedAt !== 3000) {
  throw new Error(`currentTask identity conflict created a hybrid task: ${JSON.stringify(identityTask)}`);
}

const taskNullConflictBase = structuredClone(taskIdentityBase);
const taskNullConflictLatest = structuredClone(taskNullConflictBase);
taskNullConflictLatest.devices[0].currentTask.id = "TASK-C";
taskNullConflictLatest.devices[0].currentTask.startedAt = 3000;
const taskNullConflictStale = structuredClone(taskNullConflictBase);
taskNullConflictStale.devices[0].currentTask = null;
const taskNullConflictMerged = mergeAccountSnapshots(taskNullConflictBase, taskNullConflictStale, taskNullConflictLatest);
const nullConflictTask = taskNullConflictMerged.devices.find((d) => d.id === "phone-1")?.currentTask;
if (nullConflictTask?.id !== "TASK-C" || nullConflictTask?.startedAt !== 3000) {
  throw new Error(`stale currentTask null cleared latest task: ${JSON.stringify(nullConflictTask)}`);
}

const taskEmptyBase = structuredClone(base);
taskEmptyBase.devices[0].currentTask = null;
const taskEmptyLatest = structuredClone(taskEmptyBase);
taskEmptyLatest.devices[0].currentTask = {
  ...base.devices[0].currentTask,
  id: "TASK-C",
  startedAt: 3000,
};
const taskEmptyStale = structuredClone(taskEmptyBase);
taskEmptyStale.devices[0].currentTask = {
  ...base.devices[0].currentTask,
  id: "TASK-B",
  startedAt: 2000,
};
const taskEmptyMerged = mergeAccountSnapshots(taskEmptyBase, taskEmptyStale, taskEmptyLatest);
const emptyConflictTask = taskEmptyMerged.devices.find((d) => d.id === "phone-1")?.currentTask;
if (emptyConflictTask?.id !== "TASK-C" || emptyConflictTask?.startedAt !== 3000) {
  throw new Error(`currentTask empty-baseline conflict did not preserve latest task: ${JSON.stringify(emptyConflictTask)}`);
}

const taskEmptySameIdBase = structuredClone(base);
taskEmptySameIdBase.devices[0].currentTask = null;
const taskEmptySameIdLatest = structuredClone(taskEmptySameIdBase);
taskEmptySameIdLatest.devices[0].currentTask = {
  ...base.devices[0].currentTask,
  id: "TASK-SAME",
  startedAt: 3000,
};
const taskEmptySameIdStale = structuredClone(taskEmptySameIdBase);
taskEmptySameIdStale.devices[0].currentTask = {
  ...base.devices[0].currentTask,
  id: "TASK-SAME",
  startedAt: 2000,
};
const taskEmptySameIdMerged = mergeAccountSnapshots(taskEmptySameIdBase, taskEmptySameIdStale, taskEmptySameIdLatest);
const sameIdCurrentTask = taskEmptySameIdMerged.devices.find((d) => d.id === "phone-1")?.currentTask;
if (sameIdCurrentTask?.startedAt !== 3000) {
  throw new Error(`empty-baseline same-id currentTask regressed latest timestamp: ${JSON.stringify(sameIdCurrentTask)}`);
}

const taskClearedBase = structuredClone(taskIdentityBase);
const taskClearedLatest = structuredClone(taskClearedBase);
taskClearedLatest.devices[0].recentTasks = [
  { ...taskClearedBase.devices[0].currentTask, completedAt: 3000 },
];
taskClearedLatest.devices[0].currentTask = null;
const taskClearedStale = structuredClone(taskClearedBase);
taskClearedStale.devices[0].currentTask.startedAt = 2000;
const taskClearedMerged = mergeAccountSnapshots(taskClearedBase, taskClearedStale, taskClearedLatest);
const clearedDevice = taskClearedMerged.devices.find((d) => d.id === "phone-1");
if (clearedDevice?.currentTask !== null) {
  throw new Error(`stale writer restored a cleared currentTask: ${JSON.stringify(clearedDevice?.currentTask)}`);
}
if (!clearedDevice?.recentTasks.some((task) => task.id === "TASK-A")) {
  throw new Error(`cleared task was dropped from recentTasks: ${JSON.stringify(clearedDevice?.recentTasks)}`);
}

const taskHistoryBase = structuredClone(base);
taskHistoryBase.devices[0].recentTasks = [];
const taskHistoryLatest = structuredClone(taskHistoryBase);
taskHistoryLatest.devices[0].recentTasks = [
  { ...taskHistoryBase.devices[0].currentTask, id: "newer", completedAt: 3000 },
];
const taskHistoryStale = structuredClone(taskHistoryBase);
taskHistoryStale.devices[0].recentTasks = [
  { ...taskHistoryBase.devices[0].currentTask, id: "older", completedAt: 2000 },
];
const taskHistoryMerged = mergeAccountSnapshots(taskHistoryBase, taskHistoryStale, taskHistoryLatest);
const mergedTaskIds = taskHistoryMerged.devices.find((d) => d.id === "phone-1")?.recentTasks.map((task) => task.id) ?? [];
for (const id of ["newer", "older"]) {
  if (!mergedTaskIds.includes(id)) throw new Error(`recentTasks merge dropped task ${id}: ${JSON.stringify(mergedTaskIds)}`);
}

const taskHistorySameIdBase = structuredClone(base);
taskHistorySameIdBase.devices[0].recentTasks = [];
const taskHistorySameIdLatest = structuredClone(taskHistorySameIdBase);
taskHistorySameIdLatest.devices[0].recentTasks = [
  { ...taskHistorySameIdBase.devices[0].currentTask, id: "TASK-SAME", completedAt: 3000 },
];
const taskHistorySameIdStale = structuredClone(taskHistorySameIdBase);
taskHistorySameIdStale.devices[0].recentTasks = [
  { ...taskHistorySameIdBase.devices[0].currentTask, id: "TASK-SAME", completedAt: 2000 },
];
const taskHistorySameIdMerged = mergeAccountSnapshots(taskHistorySameIdBase, taskHistorySameIdStale, taskHistorySameIdLatest);
const sameIdRecentTask = taskHistorySameIdMerged.devices.find((d) => d.id === "phone-1")?.recentTasks.find((task) => task.id === "TASK-SAME");
if (sameIdRecentTask?.completedAt !== 3000) {
  throw new Error(`empty-baseline same-id recentTasks regressed latest completion: ${JSON.stringify(sameIdRecentTask)}`);
}

const withdrawalBase = structuredClone(base);
withdrawalBase.latestWithdrawal = {
  id: "wd-1",
  amount: 10,
  network: "USDT-TRC20",
  address: "Tdemo",
  fee: 1,
  status: "submitted",
  submittedAt: 1000,
  estimatedCompletion: 5000,
};
const withdrawalLatest = structuredClone(withdrawalBase);
withdrawalLatest.latestWithdrawal.status = "processing";
const withdrawalStale = structuredClone(withdrawalBase);
withdrawalStale.latestWithdrawal.status = "review-passed";
const withdrawalMerged = mergeAccountSnapshots(withdrawalBase, withdrawalStale, withdrawalLatest);
if (withdrawalMerged.latestWithdrawal?.status !== "processing") {
  throw new Error(`latestWithdrawal status regressed: ${withdrawalMerged.latestWithdrawal?.status}`);
}

const secondLocalWrite = structuredClone(merged);
secondLocalWrite.user.usdtBalance = +(secondLocalWrite.user.usdtBalance + 1).toFixed(2);
const secondMerged = mergeAccountSnapshots(merged, secondLocalWrite, merged);
if (secondMerged.user.usdtBalance !== 1000) {
  throw new Error(`merged baseline was not reusable for the next write: ${secondMerged.user.usdtBalance}`);
}

const deletionBase = structuredClone(base);
deletionBase.devices.push({ id: "box-1", kind: "stellarbox-s1", todayEarnings: 0, todayEarningsNEX: 0, status: "online" });
const deletionNext = structuredClone(deletionBase);
deletionNext.devices = deletionNext.devices.filter((d) => d.id !== "phone-1");
const deletionLatest = structuredClone(deletionBase);
const deletionMerged = mergeAccountSnapshots(deletionBase, deletionNext, deletionLatest);
if (deletionMerged.devices.some((d) => d.id === "phone-1")) {
  throw new Error("local device deletion did not propagate to account cloud");
}

console.log("SPEC-4 account-cloud merge PASS");
