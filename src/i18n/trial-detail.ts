import { computed } from 'vue';
import { useLocaleStore } from '@/store/locale';

/** P-59 free-trial detail page (/pages/me/trial): strings only this page uses. */
export const trialDetailCopy = {
  zh: {
    remaining: '剩余', keptLabel: '收益保留', keptUntil: '{time} 到期',
    graceAmountLabel: '试用收益', withdrawAfterBuy: '购机后可提现',
    earlyTag: '试用期专享', earlyTitle: '留下这台 {device}，额外立减 {amount}',
    earlySubtitle: '提前奖励试用期收益', earlyEstimate: '（预估收益）',
    graceTitle: '别让试用收益白白过期',
    totalBreakdown: '本单折扣 {discount} + 购后到账 {credit}', totalDiscountOnly: '本单折扣 {discount}', totalLabel: '合计到手',
    unitPrice: '设备单价', promoRow: '试用期折扣（{pct}%，最高 {cap}）', promoRowNoCap: '试用期折扣（{pct}%）', limitedTag: '限时',
    earlyRow: '专享立减', offsetRow: '试用抵扣金（{amount} USDT）',
    discountTotal: '总折扣额', finalPrice: '换算后购买价', creditRow: '预估收益（可提现）',
    rulesRow: '抵扣与退款规则', earnRow: '在赚取页查看', buyCta: '立即购买 · {amount}', freeDays: '免费 {n} 天',
    rulesBeforeNoCap: '购买前，试用抵扣金仅用于抵扣购机款。',
  },
  en: {
    remaining: 'Ends in', keptLabel: 'Earnings kept for', keptUntil: 'Expires {time}',
    graceAmountLabel: 'Trial earnings', withdrawAfterBuy: 'Withdrawable once you buy',
    earlyTag: 'Trial-only offer', earlyTitle: 'Keep this {device} and save an extra {amount}',
    earlySubtitle: 'Your full trial earnings, paid early', earlyEstimate: ' (estimated)',
    graceTitle: "Don't let your trial earnings expire",
    totalBreakdown: '{discount} off this order + {credit} after purchase', totalDiscountOnly: '{discount} off this order', totalLabel: 'Total benefit',
    unitPrice: 'Device price', promoRow: 'Trial discount ({pct}%, up to {cap})', promoRowNoCap: 'Trial discount ({pct}%)', limitedTag: 'Limited time',
    earlyRow: 'Trial-only discount', offsetRow: 'Trial credit ({amount} USDT)',
    discountTotal: 'Total discount', finalPrice: 'Final price', creditRow: 'Estimated earnings (withdrawable)',
    rulesRow: 'Credit and refund rules', earnRow: 'View on Earn', buyCta: 'Buy now · {amount}', freeDays: '{n} days free',
    rulesBeforeNoCap: 'Before purchase, trial credit only offsets the device price.',
  },
  vi: {
    remaining: 'Còn lại', keptLabel: 'Thu nhập được giữ thêm', keptUntil: 'Hết hạn {time}',
    graceAmountLabel: 'Thu nhập dùng thử', withdrawAfterBuy: 'Có thể rút sau khi mua máy',
    earlyTag: 'Ưu đãi dùng thử', earlyTitle: 'Giữ lại {device} này, giảm thêm {amount}',
    earlySubtitle: 'Nhận trước thu nhập cả kỳ dùng thử', earlyEstimate: ' (ước tính)',
    graceTitle: 'Đừng để thu nhập dùng thử hết hạn',
    totalBreakdown: 'Giảm {discount} cho đơn này + nhận {credit} sau khi mua', totalDiscountOnly: 'Giảm {discount} cho đơn này', totalLabel: 'Tổng nhận được',
    unitPrice: 'Đơn giá thiết bị', promoRow: 'Giảm giá dùng thử ({pct}%, tối đa {cap})', promoRowNoCap: 'Giảm giá dùng thử ({pct}%)', limitedTag: 'Có thời hạn',
    earlyRow: 'Giảm thêm khi dùng thử', offsetRow: 'Khấu trừ dùng thử ({amount} USDT)',
    discountTotal: 'Tổng giảm giá', finalPrice: 'Giá sau khi giảm', creditRow: 'Thu nhập ước tính (có thể rút)',
    rulesRow: 'Quy tắc khấu trừ và hoàn tiền', earnRow: 'Xem ở trang Kiếm tiền', buyCta: 'Mua ngay · {amount}', freeDays: 'Miễn phí {n} ngày',
    rulesBeforeNoCap: 'Trước khi mua, tiền khấu trừ dùng thử chỉ dùng để trừ vào giá máy.',
  },
};

export function useTrialDetailCopy() {
  const locale = useLocaleStore();
  return computed(() => trialDetailCopy[locale.code === 'zh' || locale.code === 'vi' ? locale.code : 'en']);
}
