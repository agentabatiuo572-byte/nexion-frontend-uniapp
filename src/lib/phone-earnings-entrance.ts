// Route resets remount the estimate page. Remember each calibration for this App session.
const shownCalibrations = new Set<string>();

export function claimPhoneEarningsEntrance(key: string): boolean {
  if (shownCalibrations.has(key)) return false;
  shownCalibrations.add(key);
  return true;
}
