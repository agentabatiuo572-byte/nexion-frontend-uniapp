#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = fs.readFileSync("src/store/quest.ts", "utf8")
  .replace(/^import .*;\r?\n/gm, "")
  .replace(/export type QuestTaskId[\s\S]*?;\r?\n\r?\nexport interface QuestTaskDef/, "interface QuestTaskDef")
  .replace(/export interface QuestCompleteResult/, "interface QuestCompleteResult")
  .replace(/export const QUEST_TASKS/, "const QUEST_TASKS")
  .replace(/export const QUEST_FINAL_BONUS_NEX/, "const QUEST_FINAL_BONUS_NEX")
  .replace("export const useQuest", "const useQuest");

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function snapshot(code) {
  return { quests: [{ questCode: code, status: "CLAIMED" }] };
}

function createStore(replies) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const reactive = (value) => value;
  const defineStore = (_name, setup) => setup;
  const questApi = {
    state: () => {
      const reply = replies.shift();
      assert.ok(reply, "unexpected quest state request");
      return reply.promise;
    },
    claim: async () => { throw new Error("claim not used"); },
  };
  const useQuest = new Function(
    "reactive", "defineStore", "questApi", "remoteApiEnabled", "normalizeAccountKey",
    "readAccountRow", "writeAccountRow",
    `${compiled}\nreturn useQuest;`,
  )(reactive, defineStore, questApi, true, (key) => key, () => null, () => undefined);
  return useQuest();
}

test("A slow state response cannot repopulate B completedMap", async () => {
  const a = deferred();
  const b = deferred();
  const store = createStore([a, b]);

  store.bindAccount("A");
  store.bindAccount("B");
  b.resolve(snapshot("B"));
  await Promise.resolve();
  a.resolve(snapshot("A"));
  await Promise.resolve();

  assert.deepEqual(Object.keys(store.completedMap), ["B"]);
});

test("A fast state is cleared on B bind and B slow response becomes authoritative", async () => {
  const a = deferred();
  const b = deferred();
  const store = createStore([a, b]);

  store.bindAccount("A");
  a.resolve(snapshot("A"));
  await Promise.resolve();
  assert.deepEqual(Object.keys(store.completedMap), ["A"]);

  store.bindAccount("B");
  assert.deepEqual(Object.keys(store.completedMap), []);
  b.resolve(snapshot("B"));
  await Promise.resolve();
  assert.deepEqual(Object.keys(store.completedMap), ["B"]);
});

test("older same-account refresh cannot overwrite a newer response", async () => {
  const older = deferred();
  const newer = deferred();
  const store = createStore([older, newer]);

  const first = store.refreshRemote();
  const second = store.refreshRemote();
  newer.resolve(snapshot("NEW"));
  await second;
  older.resolve(snapshot("OLD"));
  await first;

  assert.deepEqual(Object.keys(store.completedMap), ["NEW"]);
});
