import { computed } from 'vue';
import { useLocaleStore } from '@/store/locale';

/** FEAT-TRIAL05 early-conversion copy (mirrors the App's trial-lifecycle entries). */
export const trialEarlyPurchaseCopy = {
  zh: {
    accruedLabel: '已累计试用收益',
    earlyHeadline: '完整试用权益照拿，现在购买再减 ${discount}',
    earlyRewardLabel: '提前购买奖励',
    earlyDiscountLabel: '提前购买立减',
    afterPurchaseLabel: '购后到账',
    earlyNote: '未累计的部分作为奖励，购机后到账；设备支付成功后即开始运行。',
    earlyBuyCta: '立即购买 · 应付 ${amount}',
    earlyCheckoutNote: '完整试用权益照拿 · 购后到账 {rewards}',
    rulesEarly: '试用期内购买：完整试用权益照拿，再减 ${discount}；试用到期后购买不享此立减。',
    rulesRefund: '订单退款时，购机时发放的试用奖励将随退款一并收回。',
  },
  en: {
    accruedLabel: 'Trial earnings accrued',
    earlyHeadline: 'Keep your full trial benefits and get ${discount} off when you buy now',
    earlyRewardLabel: 'Early purchase reward',
    earlyDiscountLabel: 'Early purchase discount',
    afterPurchaseLabel: 'Credited after purchase',
    earlyNote: 'The rest of your trial benefits arrive right after purchase. Your device starts running as soon as payment succeeds.',
    earlyBuyCta: 'Buy now · ${amount} due',
    earlyCheckoutNote: 'Full trial benefits kept · credited after purchase: {rewards}',
    rulesEarly: "Buy during the trial to keep your full trial benefits and get ${discount} off. Buying after the trial ends doesn't include this discount.",
    rulesRefund: 'If the order is refunded, trial rewards paid at purchase are taken back with the refund.',
  },
  vi: {
    accruedLabel: 'Thu nhập dùng thử đã tích lũy',
    earlyHeadline: 'Giữ trọn quyền lợi dùng thử và giảm thêm ${discount} khi mua ngay',
    earlyRewardLabel: 'Thưởng mua sớm',
    earlyDiscountLabel: 'Giảm giá mua sớm',
    afterPurchaseLabel: 'Nhận sau khi mua',
    earlyNote: 'Phần quyền lợi còn lại được cộng ngay sau khi mua. Thiết bị chạy ngay khi thanh toán thành công.',
    earlyBuyCta: 'Mua ngay · phải trả ${amount}',
    earlyCheckoutNote: 'Giữ trọn quyền lợi dùng thử · nhận sau khi mua: {rewards}',
    rulesEarly: 'Mua trong thời gian dùng thử: giữ trọn quyền lợi và giảm thêm ${discount}; mua sau khi hết hạn không được giảm.',
    rulesRefund: 'Khi hoàn tiền đơn hàng, thưởng dùng thử đã trả lúc mua sẽ được thu hồi cùng khoản hoàn.',
  },
};

export function useTrialEarlyPurchaseCopy() {
  const locale = useLocaleStore();
  return computed(() => trialEarlyPurchaseCopy[locale.code === 'zh' || locale.code === 'vi' ? locale.code : 'en']);
}
