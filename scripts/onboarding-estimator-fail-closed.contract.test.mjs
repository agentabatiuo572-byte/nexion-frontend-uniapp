import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const estimator = fs.readFileSync("src/pages/onboarding/estimator.vue", "utf8");
const api = fs.readFileSync("src/api/onboarding-calibration-api.ts", "utf8");
const readState = fs.readFileSync("src/lib/estimator-calibration-read-state.ts", "utf8");

test("estimator only reveals a server-confirmed usable calibration", () => {
  assert.match(readState, /result\.calibrationAvailable/);
  assert.match(readState, /result\.activationStatus === "CALIBRATED"/);
  assert.match(readState, /result\.activationStatus === "ACTIVE"/);
  assert.match(estimator, /const nextState = estimatorCalibrationReadState\(result\);\s*if \(nextState !== "ready"\)/);
  assert.match(estimator, /calibration\.value = result;\s*readState\.value = "ready";\s*scheduleReveal\(\)/);
  assert.doesNotMatch(estimator, /onMounted\(\(\) => \{[\s\S]*?loadCalibration\(\);\s*scheduleReveal\(\)/);
  assert.match(estimator, /!detected\.value \|\| !calibration\.value\?\.calibrationAvailable/);
});

test("estimator exposes retry and defer controls without inventing a result", () => {
  assert.match(estimator, /v-if="readState !== 'loading' && readState !== 'ready'"/);
  assert.match(estimator, /@click="retryCalibration"/);
  assert.match(estimator, /@click="deferPhoneActivation"/);
  assert.match(estimator, /activationRewardGate/);
  assert.match(estimator, /function retryCalibration\(\) \{\s*if \(deferBusy\.value\) return;/,
    "retry cannot invalidate a DEFERRED command while it is in flight");
  assert.match(estimator, /@click="leaveEstimator"/,
    "the visual back control must be a non-mutating exit");
  assert.match(estimator, /onBackPress\(\(\) => \{[\s\S]*?leaveEstimator\(\);[\s\S]*?return true;/,
    "hardware and browser back must not reveal registration success or silently defer activation");
  const leaveHandler = estimator.slice(estimator.indexOf("function leaveEstimator"), estimator.indexOf("async function deferPhoneActivation"));
  assert.match(leaveHandler, /pages\/onboarding\/intro/);
  assert.doesNotMatch(leaveHandler, /confirmDeferredPhoneActivation|onboardingCalibrationApi\.defer|pages\/register\/success/);
});

test("calibration comparison rows require strictly positive bounded values", () => {
  assert.match(api, /dailyUsdt:\s*number\(item\.dailyUsdt, Number\.MIN_VALUE, 999_999_999_999\.999999\)/);
  assert.match(api, /dailyNex:\s*number\(item\.dailyNex, Number\.MIN_VALUE, 999_999_999_999\.999999\)/);
});
