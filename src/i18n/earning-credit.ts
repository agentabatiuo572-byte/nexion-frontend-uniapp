import type { UiLocale } from "@/i18n";
import type { EarningPush } from "@/api/notification-preferences-api";

/**
 * Earnings credited (04.5): the message row, its detail sheet, and the App's earnings-alert preference.
 * Amounts and units never live in these strings; the App renders them from the message's earning data.
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
  pushTitle: string;
  pushHint: string;
  pushOptions: Record<EarningPush, { label: string; hint: string }>;
  pushNote: string;
}

export const earningCreditCopy = {
  zh: {
    credited: "收益到账", detailTitle: "收益详情", viewAll: "查看全部收益",
    loadFailedTitle: "详情暂时无法加载", loadFailedHint: "正在自动重试", unavailable: "这笔收益的凭证不可用", removed: "这条消息已不可查看", receiptTitle: "收益凭证",
    pushTitle: "收益到账提醒", pushHint: "只管手机推送，站内消息照常",
    pushOptions: {
      REALTIME: { label: "每笔实时", hint: "每笔到账立即推送，23:00–08:00 不推" },
      HALF_HOURLY: { label: "每 30 分钟", hint: "有到账时每 30 分钟推送一次，23:00–08:00 不推" },
      DAILY: { label: "每天一次", hint: "默认 · 每天约 21:00 推送当天收益汇总" },
      OFF: { label: "关闭", hint: "不推送收益提醒" },
    },
    pushNote: "只控制手机推送，首笔收益提醒也按此设置。",
  },
  en: {
    credited: "Earnings credited", detailTitle: "Earnings details", viewAll: "View all earnings",
    loadFailedTitle: "Details can't load right now", loadFailedHint: "Retrying automatically", unavailable: "The receipt for these earnings is unavailable", removed: "This message is no longer available", receiptTitle: "Earnings receipt",
    pushTitle: "Earnings alerts", pushHint: "Phone notifications only; in-app messages unchanged",
    pushOptions: {
      REALTIME: { label: "Real time", hint: "Each credit as it arrives; paused 23:00–08:00" },
      HALF_HOURLY: { label: "Every 30 minutes", hint: "When earnings arrive; paused 23:00–08:00" },
      DAILY: { label: "Once a day", hint: "Default · Daily summary around 21:00" },
      OFF: { label: "Off", hint: "No earnings alerts" },
    },
    pushNote: "Controls phone notifications only, including the first-earnings alert.",
  },
  vi: {
    credited: "Đã nhận thu nhập", detailTitle: "Chi tiết thu nhập", viewAll: "Xem tất cả thu nhập",
    loadFailedTitle: "Tạm thời chưa tải được chi tiết", loadFailedHint: "Đang tự động thử lại", unavailable: "Biên nhận của khoản thu nhập này không khả dụng", removed: "Tin nhắn này không còn khả dụng", receiptTitle: "Biên nhận thu nhập",
    pushTitle: "Thông báo thu nhập", pushHint: "Chỉ áp dụng cho thông báo điện thoại; tin nhắn trong ứng dụng không đổi",
    pushOptions: {
      REALTIME: { label: "Từng khoản", hint: "Gửi ngay khi có từng khoản thu nhập; không gửi từ 23:00 đến 08:00" },
      HALF_HOURLY: { label: "Mỗi 30 phút", hint: "Gửi khi có thu nhập; không gửi từ 23:00 đến 08:00" },
      DAILY: { label: "Mỗi ngày một lần", hint: "Mặc định · Tổng hợp thu nhập trong ngày vào khoảng 21:00" },
      OFF: { label: "Tắt", hint: "Không gửi thông báo thu nhập" },
    },
    pushNote: "Chỉ áp dụng cho thông báo điện thoại, kể cả thông báo thu nhập đầu tiên.",
  },
  id: {
    credited: "Pendapatan masuk", detailTitle: "Detail pendapatan", viewAll: "Lihat semua pendapatan",
    loadFailedTitle: "Detail belum dapat dimuat", loadFailedHint: "Mencoba lagi otomatis", unavailable: "Kuitansi pendapatan ini tidak tersedia", removed: "Pesan ini sudah tidak tersedia", receiptTitle: "Kuitansi pendapatan",
    pushTitle: "Notifikasi pendapatan", pushHint: "Hanya notifikasi ponsel; pesan di aplikasi tetap",
    pushOptions: {
      REALTIME: { label: "Setiap pendapatan", hint: "Dikirim saat setiap pendapatan masuk; tidak dikirim pukul 23.00–08.00" },
      HALF_HOURLY: { label: "Setiap 30 menit", hint: "Saat ada pendapatan masuk; tidak dikirim pukul 23.00–08.00" },
      DAILY: { label: "Sekali sehari", hint: "Default · Ringkasan harian sekitar pukul 21.00" },
      OFF: { label: "Nonaktif", hint: "Tidak ada notifikasi pendapatan" },
    },
    pushNote: "Hanya mengatur notifikasi ponsel, termasuk notifikasi pendapatan pertama.",
  },
  ms: {
    credited: "Pendapatan dikreditkan", detailTitle: "Butiran pendapatan", viewAll: "Lihat semua pendapatan",
    loadFailedTitle: "Butiran belum dapat dimuatkan", loadFailedHint: "Mencuba semula secara automatik", unavailable: "Resit pendapatan ini tidak tersedia", removed: "Mesej ini tidak lagi tersedia", receiptTitle: "Resit pendapatan",
    pushTitle: "Pemberitahuan pendapatan", pushHint: "Pemberitahuan telefon sahaja; mesej dalam aplikasi tidak berubah",
    pushOptions: {
      REALTIME: { label: "Setiap pendapatan", hint: "Dihantar sebaik setiap pendapatan masuk; tiada antara 23:00–08:00" },
      HALF_HOURLY: { label: "Setiap 30 minit", hint: "Apabila ada pendapatan masuk; tiada antara 23:00–08:00" },
      DAILY: { label: "Sekali sehari", hint: "Lalai · Ringkasan harian sekitar 21:00" },
      OFF: { label: "Mati", hint: "Tiada pemberitahuan pendapatan" },
    },
    pushNote: "Hanya mengawal pemberitahuan telefon, termasuk pemberitahuan pendapatan pertama.",
  },
  fil: {
    credited: "Pumasok ang kita", detailTitle: "Detalye ng kita", viewAll: "Tingnan lahat ng kita",
    loadFailedTitle: "Hindi pa ma-load ang detalye", loadFailedHint: "Awtomatikong sinusubukan ulit", unavailable: "Hindi available ang resibo ng kitang ito", removed: "Hindi na makikita ang mensaheng ito", receiptTitle: "Resibo ng kita",
    pushTitle: "Alerto sa kita", pushHint: "Phone notification lang; walang pagbabago sa mensahe sa app",
    pushOptions: {
      REALTIME: { label: "Bawat kita", hint: "Agad sa bawat pumasok na kita; wala mula 23:00 hanggang 08:00" },
      HALF_HOURLY: { label: "Kada 30 minuto", hint: "Kapag may pumasok na kita; wala mula 23:00 hanggang 08:00" },
      DAILY: { label: "Araw-araw", hint: "Default · Buod ng kita bandang 21:00" },
      OFF: { label: "Naka-off", hint: "Walang alerto sa kita" },
    },
    pushNote: "Phone notification lang ang kinokontrol nito, kasama ang alerto sa unang kita.",
  },
  ru: {
    credited: "Доход зачислен", detailTitle: "Детали дохода", viewAll: "Весь доход",
    loadFailedTitle: "Не удалось загрузить детали", loadFailedHint: "Повторяем автоматически", unavailable: "Квитанция по этому доходу недоступна", removed: "Это сообщение больше недоступно", receiptTitle: "Квитанция о доходе",
    pushTitle: "Уведомления о доходе", pushHint: "Только push-уведомления; сообщения в приложении не меняются",
    pushOptions: {
      REALTIME: { label: "Каждое зачисление", hint: "Сразу при каждом зачислении; не с 23:00 до 08:00" },
      HALF_HOURLY: { label: "Каждые 30 минут", hint: "При поступлении дохода; не с 23:00 до 08:00" },
      DAILY: { label: "Раз в день", hint: "По умолчанию · Сводка за день около 21:00" },
      OFF: { label: "Выключено", hint: "Без уведомлений о доходе" },
    },
    pushNote: "Влияет только на push-уведомления, включая уведомление о первом доходе.",
  },
  kk: {
    credited: "Табыс түсті", detailTitle: "Табыс мәліметі", viewAll: "Барлық табыс",
    loadFailedTitle: "Мәлімет әзірге жүктелмеді", loadFailedHint: "Автоматты түрде қайталануда", unavailable: "Бұл табыстың түбіртегі қолжетімсіз", removed: "Бұл хабар енді қолжетімсіз", receiptTitle: "Табыс түбіртегі",
    pushTitle: "Табыс хабарландыруы", pushHint: "Тек телефон хабарландырулары; қолданбадағы хабарлар өзгермейді",
    pushOptions: {
      REALTIME: { label: "Әр түсім сайын", hint: "Әр табыс түскен сайын бірден; 23:00–08:00 аралығында жіберілмейді" },
      HALF_HOURLY: { label: "30 минут сайын", hint: "Табыс түскенде; 23:00–08:00 аралығында жіберілмейді" },
      DAILY: { label: "Күніне бір рет", hint: "Әдепкі · Күндік жиынтық шамамен 21:00\u2011де" /* non-breaking hyphen keeps the time and its suffix together */ },
      OFF: { label: "Өшірулі", hint: "Табыс хабарландыруы жіберілмейді" },
    },
    pushNote: "Тек телефон хабарландыруларын басқарады, алғашқы табыс хабарландыруын қоса.",
  },
  uz: {
    credited: "Daromad tushdi", detailTitle: "Daromad tafsilotlari", viewAll: "Barcha daromadlar",
    loadFailedTitle: "Tafsilotlar hozircha yuklanmadi", loadFailedHint: "Avtomatik qayta urinilmoqda", unavailable: "Bu daromad cheki mavjud emas", removed: "Bu xabar endi mavjud emas", receiptTitle: "Daromad cheki",
    pushTitle: "Daromad bildirishnomalari", pushHint: "Faqat telefon bildirishnomalari; ilovadagi xabarlar oʻzgarmaydi",
    pushOptions: {
      REALTIME: { label: "Har bir tushum", hint: "Har bir daromad tushganda darhol; 23:00–08:00 oraligʻida yuborilmaydi" },
      HALF_HOURLY: { label: "Har 30 daqiqada", hint: "Daromad tushganda; 23:00–08:00 oraligʻida yuborilmaydi" },
      DAILY: { label: "Kuniga bir marta", hint: "Standart · Kunlik hisobot taxminan 21:00 da" },
      OFF: { label: "Oʻchiq", hint: "Daromad bildirishnomalari yuborilmaydi" },
    },
    pushNote: "Faqat telefon bildirishnomalarini boshqaradi, birinchi daromad bildirishnomasi ham shunga kiradi.",
  },
} satisfies Record<UiLocale, EarningCreditCopy>;
