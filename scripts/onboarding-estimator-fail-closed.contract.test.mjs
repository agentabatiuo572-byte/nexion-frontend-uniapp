import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const estimator = fs.readFileSync("src/pages/onboarding/estimator.vue", "utf8");
const api = fs.readFileSync("src/api/onboarding-calibration-api.ts", "utf8");

test("estimator only reveals a server-confirmed usable calibration", () => {
  assert.match(estimator, /!result\.calibrationAvailable/);
  assert.match(estimator, /result\.activationStatus !== "CALIBRATED"/);
  assert.match(estimator, /result\.activationStatus !== "ACTIVE"/);
  assert.match(estimator, /calibration\.value = result;\s*scheduleReveal\(\)/);
  assert.doesNotMatch(estimator, /onMounted\(\(\) => \{[\s\S]*?loadCalibration\(\);\s*scheduleReveal\(\)/);
  assert.match(estimator, /!detected\.value \|\| !calibration\.value\?\.calibrationAvailable/);
});

test("estimator exposes retry and defer controls without inventing a result", () => {
  assert.match(estimator, /v-if="loadFailed"/);
  assert.match(estimator, /@click="retryCalibration"/);
  assert.match(estimator, /@click="leaveEstimator"/);
  assert.match(estimator, /activationRewardGate/);
});

test("calibration comparison rows require strictly positive bounded values", () => {
  assert.match(api, /dailyUsdt:\s*number\(item\.dailyUsdt, Number\.MIN_VALUE, 999_999_999_999\.999999\)/);
  assert.match(api, /dailyNex:\s*number\(item\.dailyNex, Number\.MIN_VALUE, 999_999_999_999\.999999\)/);
});
