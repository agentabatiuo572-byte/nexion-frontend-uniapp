import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const courses = await readFile(new URL("./courses.vue", import.meta.url), "utf8");
const course = await readFile(new URL("./course.vue", import.meta.url), "utf8");

test("learning list and course pages guard async state with account/run/generation/mount scope", () => {
  for (const [name, source] of [["courses", courses], ["course", course]]) {
    assert.match(source, /createLearningPageFenceReader/);
    assert.match(source, /captureRuntimeRevision/);
    assert.match(source, /onUnmounted/);
    assert.match(source, /generation \+= 1/);
    assert.match(source, /watch\(\(\) => String\(app\.accountKey\)/);
    assert.match(source, /if \(current\(scope\)\)/, `${name} should guard state writes`);
  }
  assert.match(course, /const scope = fence\(\);[\s\S]*learningApi\.start/);
  assert.match(course, /recoverAuthoritative\(scope, submittedCourse\)/);
});
