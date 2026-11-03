import { uiLocale } from "@/i18n";
const routeBadgeNames: Record<string, readonly [string, string]> = {
  ROYALTY_BOOST: ['团队成长徽章', 'teamGrowthBadge'],
  STREAK_BADGE: ['连续签到徽章', 'checkInStreakBadge'],
  STAKING_APY: ['质押活动入口', 'stakingActivityEntry'],
  GENESIS_ALLOWLIST: ['Genesis 资格入口', 'genesisEligibilityEntry'],
};

export function powerUpNameText(code: string, effectType: string, publishedName: string, copy: Readonly<Record<string, string>>): string {
  const known = Object.prototype.hasOwnProperty.call(routeBadgeNames, code) ? routeBadgeNames[code] : undefined;
  // These published badges/entries differ from the prototype's financial boosts.
  // A renamed/custom publication or another effect keeps its own name.
  return effectType === 'ROUTE_BADGE' && known?.[0] === publishedName ? copy[known[1]] || publishedName : publishedName;
}

export function powerUpEffectText(effectType: string, rawValue: string | number, locale: string): string {
  // Unknown effects have no safe display interpretation; keep the published name.
  if (String(rawValue).trim() === '') return '';
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0) return '';
  if (effectType !== 'CHECKIN_MULTIPLIER') return '';
  const copy = ({ zh: '签到奖励 × {n}，断签后失效', en: 'Check-in reward × {n}, ends if your streak breaks', vi: 'Thưởng điểm danh × {n}, mất khi đứt chuỗi', id: 'Hadiah check-in × {n}, berakhir jika check-in beruntun terputus', ms: 'Ganjaran daftar masuk × {n}, tamat jika rentetan terputus', fil: 'Reward sa check-in × {n}, mawawala kapag naputol ang streak', ru: 'Награда за отметку × {n}, сгорает при прерывании серии', kk: 'Белгі сыйақысы × {n}, серия үзілсе, тоқтайды', uz: 'Belgilanish mukofoti × {n}, seriya uzilsa tugaydi' })[uiLocale(locale)];
  return copy.replace('{n}', String(value));
}
