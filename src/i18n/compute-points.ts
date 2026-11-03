import { uiLocale } from "@/i18n";
/** Platform compute points are a count, never a currency conversion or physical TOPS. */
const COPY = {
  zh: { unit: '算力点', self: '自购算力', team: '团队算力', month: '本月算力', lifetime: '累计算力', needSelf: '自购算力还差 {n}', needTeam: '团队算力还差 {n}', conditionsPending: '算力条件待公布', memberSummary: '{n} 名成员 · {points}' },
  en: { unit: 'compute pts', self: 'Own compute', team: 'Team compute', month: 'Monthly compute', lifetime: 'Total compute', needSelf: '{n} more own compute', needTeam: '{n} more team compute', conditionsPending: 'Compute requirements pending', memberSummary: '{n} members · {points}' },
  vi: { unit: 'điểm tính toán', self: 'Điểm cá nhân', team: 'Điểm của nhóm', month: 'Điểm tháng này', lifetime: 'Điểm tích lũy', needSelf: 'Còn thiếu {n} (cá nhân)', needTeam: 'Còn thiếu {n} (nhóm)', conditionsPending: 'Chưa công bố điều kiện điểm', memberSummary: '{n} thành viên · {points}' },
  id: { unit: 'poin komputasi', self: 'Poin beli sendiri', team: 'Komputasi tim', month: 'Komputasi bulan ini', lifetime: 'Total komputasi', needSelf: 'Kurang {n} (beli sendiri)', needTeam: 'Kurang {n} (tim)', conditionsPending: 'Syarat komputasi belum diumumkan', memberSummary: '{n} anggota · {points}' },
  ms: { unit: 'mata', self: 'Mata sendiri', team: 'Mata pasukan', month: 'Mata bulan ini', lifetime: 'Mata terkumpul', needSelf: 'Beli sendiri: perlu {n} lagi', needTeam: 'Pasukan: perlu {n} lagi', conditionsPending: 'Syarat pengkomputeran belum diumumkan', memberSummary: '{n} ahli · {points}' },
  fil: { unit: 'Pts ng compute', self: 'Sariling compute', team: 'Compute ng team', month: 'Compute/buwan', lifetime: 'Kabuuang compute', needSelf: '{n} pang sariling compute', needTeam: '{n} pang compute ng team', conditionsPending: 'Ilalabas pa ang compute requirement', memberSummary: '{n} miyembro · {points}' },
  ru: { unit: 'оч. мощности', self: 'Мощность покупок', team: 'Мощность команды', month: 'За месяц', lifetime: 'Мощность всего', needSelf: 'Ещё мощности покупок: {n}', needTeam: 'Ещё мощности команды: {n}', conditionsPending: 'Требования к мощности не объявлены', memberSummary: '{n} чел. · {points}' },
  kk: { unit: 'есептеу ұпайы', self: 'Жеке сатып алу ұпайы', team: 'Команда ұпайы', month: 'Айлық ұпай', lifetime: 'Жалпы ұпай', needSelf: 'Тағы {n} жеке сатып алу ұпайы', needTeam: 'Тағы {n} команда ұпайы', conditionsPending: 'Ұпай талаптары жарияланбаған', memberSummary: '{n} мүше · {points}' },
  uz: { unit: 'quvvat balli', self: 'Shaxsiy quvvat', team: 'Jamoa quvvati', month: 'Oylik quvvat', lifetime: 'Jami quvvat', needSelf: 'Yana {n} kerak (shaxsiy)', needTeam: 'Yana {n} kerak (jamoa)', conditionsPending: 'Quvvat shartlari eʼlon qilinmagan', memberSummary: '{n} aʼzo · {points}' },
};
export function computePointsCopy(locale: string) {
  return COPY[uiLocale(locale.split('-')[0])];
}
export function formatComputePoints(value: number | null | undefined, locale: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '—';
  // Expand scientific notation and round decimal digits without Intl or binary toFixed ties.
  const [mantissa, exponent = '0'] = value.toString().split('e');
  const [integer, fraction = ''] = mantissa.split('.');
  const digits = integer + fraction;
  const point = integer.length + Number(exponent);
  const whole = point > 0 ? digits.slice(0, point).padEnd(point, '0') : '0';
  const tail = (point < 0 ? '0'.repeat(-point) : '') + digits.slice(Math.max(0, point));
  const rounded = [...whole, ...tail.slice(0, 6).padEnd(6, '0')];
  if (tail[6] >= '5') {
    let carry = true;
    for (let i = rounded.length - 1; i >= 0 && carry; i--) {
      if (rounded[i] === '9') rounded[i] = '0';
      else { rounded[i] = String(Number(rounded[i]) + 1); carry = false; }
    }
    if (carry) rounded.unshift('1');
  }
  const fixed = rounded.join('');
  const decimals = fixed.slice(-6).replace(/0+$/, '');
  const vi = locale.split('-')[0] === 'vi';
  const number = fixed.slice(0, -6).replace(/\B(?=(\d{3})+(?!\d))/g, vi ? '.' : ',') + (decimals ? (vi ? ',' : '.') + decimals : '');
  return `${number} ${computePointsCopy(locale).unit}`;
}
/** Missing any member's value means the aggregate is unknown, not zero. */
export function sumComputePoints(values: readonly (number | null | undefined)[]): number | null {
  if (values.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) return null;
  return values.reduce<number>((sum, value) => sum + (value as number), 0);
}
