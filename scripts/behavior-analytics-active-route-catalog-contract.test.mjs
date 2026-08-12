import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pages = JSON.parse(readFileSync(new URL("../src/pages.json", import.meta.url), "utf8"));
const migrationPath = resolve(fileURLToPath(new URL("../", import.meta.url)), "..", "nexion-backend",
  "scripts", "migrations", "20260811_l6_h5_active_route_catalog.sql");

function manifestRoutes() {
  return pages.pages.map(({ path }) => `/${path}`).sort();
}

function catalogRoutes(sql) {
  return [...sql.matchAll(/^\('\/pages\/[^']+'(?:,[^\n]*)?\),?$/gm)]
    .map(([line]) => line.match(/^\('([^']+)'/)[1])
    .sort();
}

test("every normalized UniApp business page route has one tracked backend catalog row", () => {
  const migration = readFileSync(migrationPath, "utf8");
  const routes = manifestRoutes();
  assert.ok(routes.length > 0);
  assert.deepEqual(catalogRoutes(migration), routes);
  assert.match(migration, /ON DUPLICATE KEY UPDATE[\s\S]*tracked=1[\s\S]*is_deleted=0/);
});

test("runtime route normalization accepts exactly the pages.json route form", () => {
  const tracker = readFileSync(new URL("../src/services/behavior-analytics.ts", import.meta.url), "utf8");
  assert.ok(tracker.includes("return /^\\/pages\\/[a-z0-9-]+\\/[a-z0-9-]+$/.test(route) ? route : \"\";"));
  assert.ok(manifestRoutes().every((route) => /^\/pages\/[a-z0-9-]+\/[a-z0-9-]+$/.test(route)));
});
