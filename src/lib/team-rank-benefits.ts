import type { VRankDef } from '@/store/v-rank';
import { uiLocale } from '@/i18n';

export const rankBenefitKeys = ['directBonus', 'unilevelDepth', 'peerBonus', 'leadershipVotes'] as const;
export type RankBenefitKey = typeof rankBenefitKeys[number];
type RankBenefits = Pick<VRankDef, 'v' | RankBenefitKey>;

/** Presentation only: compare published values, never infer an absent current tier.
 * Fall back to the full next tier if a value is unknown, unchanged throughout, or
 * reduced; an "improvements" summary must not conceal a reduction in benefits.
 */
export function increasedRankBenefitKeys(current: RankBenefits | null | undefined, next: RankBenefits | null | undefined): RankBenefitKey[] | null {
  if (!current || !next || next.v <= current.v) return null;
  const valid = (rank: RankBenefits, key: RankBenefitKey) => typeof rank[key] === 'number'
    && Number.isFinite(rank[key]) && rank[key] >= 0
    && (key !== 'unilevelDepth' && key !== 'leadershipVotes' || Number.isInteger(rank[key]));
  if (rankBenefitKeys.some(key => !valid(current, key) || !valid(next, key) || next[key] < current[key])) return null;
  const increased = rankBenefitKeys.filter(key => next[key] > current[key]);
  return increased.length ? increased : null;
}

export function rankBenefitIncreaseHeading(locale: string): string {
  return ({ zh: '新增／提升权益', en: 'New or improved benefits', vi: 'Quyền lợi mới hoặc nâng cao', id: 'Manfaat baru atau yang ditingkatkan', ms: 'Manfaat baharu atau dipertingkat', fil: 'Bago o pinahusay na benepisyo', ru: 'Новые и улучшенные привилегии', kk: 'Жаңа не жақсартылған артықшылықтар', uz: 'Yangi yoki kengaygan imtiyozlar' })[uiLocale(locale)];
}
