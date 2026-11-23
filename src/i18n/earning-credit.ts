import type { UiLocale } from "@/i18n";

/**
 * Earnings credited (04.5): the message row and its detail sheet.
 * Amounts and units never live in these strings; the client renders them from the message's earning data.
 */
export interface EarningCreditCopy {
  /** Row summary lead; the whole summary when the server sends no device or job. */
  credited: string;
  detailTitle: string;
  viewAll: string;
  loadFailedTitle: string;
  loadFailedHint: string;
  unavailable: string;
  /** Centred toast when the tapped message has been removed. */
  removed: string;
  /** One receipt's sheet title on the earnings receipts page (the page itself is 收益凭证). */
  receiptTitle: string;
}

export const earningCreditCopy = {
  zh: {
    credited: "收益到账", detailTitle: "收益详情", viewAll: "查看全部收益",
    loadFailedTitle: "详情暂时无法加载", loadFailedHint: "正在自动重试", unavailable: "这笔收益的凭证不可用", removed: "这条消息已不可查看", receiptTitle: "收益凭证",
  },
  en: {
    credited: "Earnings credited", detailTitle: "Earnings details", viewAll: "View all earnings",
    loadFailedTitle: "Details can't load right now", loadFailedHint: "Retrying automatically", unavailable: "The receipt for these earnings is unavailable", removed: "This message is no longer available", receiptTitle: "Earnings receipt",
  },
  vi: {
    credited: "Đã nhận thu nhập", detailTitle: "Chi tiết thu nhập", viewAll: "Xem tất cả thu nhập",
    loadFailedTitle: "Tạm thời chưa tải được chi tiết", loadFailedHint: "Đang tự động thử lại", unavailable: "Biên nhận của khoản thu nhập này không khả dụng", removed: "Tin nhắn này không còn khả dụng", receiptTitle: "Biên nhận thu nhập",
  },
  id: {
    credited: "Pendapatan masuk", detailTitle: "Detail pendapatan", viewAll: "Lihat semua pendapatan",
    loadFailedTitle: "Detail belum dapat dimuat", loadFailedHint: "Mencoba lagi otomatis", unavailable: "Kuitansi pendapatan ini tidak tersedia", removed: "Pesan ini sudah tidak tersedia", receiptTitle: "Kuitansi pendapatan",
  },
  ms: {
    credited: "Pendapatan dikreditkan", detailTitle: "Butiran pendapatan", viewAll: "Lihat semua pendapatan",
    loadFailedTitle: "Butiran belum dapat dimuatkan", loadFailedHint: "Mencuba semula secara automatik", unavailable: "Resit pendapatan ini tidak tersedia", removed: "Mesej ini tidak lagi tersedia", receiptTitle: "Resit pendapatan",
  },
  fil: {
    credited: "Pumasok ang kita", detailTitle: "Detalye ng kita", viewAll: "Tingnan lahat ng kita",
    loadFailedTitle: "Hindi pa ma-load ang detalye", loadFailedHint: "Awtomatikong sinusubukan ulit", unavailable: "Hindi available ang resibo ng kitang ito", removed: "Hindi na makikita ang mensaheng ito", receiptTitle: "Resibo ng kita",
  },
  ru: {
    credited: "Доход зачислен", detailTitle: "Детали дохода", viewAll: "Весь доход",
    loadFailedTitle: "Не удалось загрузить детали", loadFailedHint: "Повторяем автоматически", unavailable: "Квитанция по этому доходу недоступна", removed: "Это сообщение больше недоступно", receiptTitle: "Квитанция о доходе",
  },
  kk: {
    credited: "Табыс түсті", detailTitle: "Табыс мәліметі", viewAll: "Барлық табыс",
    loadFailedTitle: "Мәлімет әзірге жүктелмеді", loadFailedHint: "Автоматты түрде қайталануда", unavailable: "Бұл табыстың түбіртегі қолжетімсіз", removed: "Бұл хабар енді қолжетімсіз", receiptTitle: "Табыс түбіртегі",
  },
  uz: {
    credited: "Daromad tushdi", detailTitle: "Daromad tafsilotlari", viewAll: "Barcha daromadlar",
    loadFailedTitle: "Tafsilotlar hozircha yuklanmadi", loadFailedHint: "Avtomatik qayta urinilmoqda", unavailable: "Bu daromad cheki mavjud emas", removed: "Bu xabar endi mavjud emas", receiptTitle: "Daromad cheki",
  },
} satisfies Record<UiLocale, EarningCreditCopy>;
