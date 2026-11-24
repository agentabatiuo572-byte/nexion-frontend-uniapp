/**
 * Reward cooling (F2 后台冷却天数 can be set to 0). Pages switch every "cools N days / credited after N days" sentence
 * to its credited-right-away wording through this one check.
 * LOGIC SEAM: today it reads the parsed coolingDays (direct-referral purchase / deviceEarning, or
 * sevenLayerReference.coolingDays). The logic item replaces the body if the backend signals "no cooling" another way.
 */
export function creditsAtOnce(coolingDays: number | string | null | undefined): boolean {
  return coolingDays === 0;
}
