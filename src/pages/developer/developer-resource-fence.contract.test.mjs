import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./developer.vue", import.meta.url), "utf8");
const fenceSource = await readFile(new URL("./developer-resource-fence.ts", import.meta.url), "utf8");

test("developer resource operations all capture and validate the account fence", () => {
  assert.match(fenceSource, /captureRuntimeRevision/);
  assert.match(fenceSource, /isCurrentRuntimeRevision/);
  assert.match(source, /let resourceGeneration = 0/);
  assert.match(source, /resetResourceScope\(\);/);
  assert.match(source, /if \(!resourceFenceCurrent\(fence\)\) return;/);

  for (const functionName of ["createApiKey", "revokeApiKey", "createWebhook", "deleteWebhook", "rotateWebhook"]) {
    const start = source.indexOf(`async function ${functionName}`);
    assert.notEqual(start, -1, `${functionName} should exist`);
    const body = source.slice(start, source.indexOf("\n}", start) + 2);
    assert.match(body, /const fence = resourceFence\(\);/, `${functionName} should capture a fence`);
    assert.match(body, /resourceFenceCurrent\(fence\)/, `${functionName} should reject stale responses`);
  }

  const loadStart = source.indexOf("async function loadResources");
  const loadBody = source.slice(loadStart, source.indexOf("\n}\nfunction retryLoadResources", loadStart) + 2);
  assert.match(loadBody, /fence = resourceFence\(\)/);
  assert.match(loadBody, /resourceFenceCurrent\(fence\)/);
});
