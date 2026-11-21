import { uiLocale } from "@/i18n";
export const searchRecoveryCopy = {
  zh: { unavailable: '搜索资料暂时无法加载', retryHint: '搜索资料未能完整加载，请重试后再确认结果。', partial: '部分搜索资料未能加载，以下结果仍可查看。' },
  en: { unavailable: 'Search information is unavailable', retryHint: 'Some search information could not be loaded. Retry to check the full results.', partial: 'Some search information could not be loaded. Available results are still shown.' },
  vi: { unavailable: 'Chưa tải được thông tin tìm kiếm', retryHint: 'Chưa tải đủ thông tin tìm kiếm. Thử lại để kiểm tra đầy đủ kết quả.', partial: 'Chưa tải được một phần thông tin. Bạn vẫn có thể xem các kết quả hiện có.' },
  id: { unavailable: 'Informasi pencarian tidak tersedia', retryHint: 'Sebagian informasi pencarian gagal dimuat. Coba lagi untuk melihat hasil lengkap.', partial: 'Sebagian informasi pencarian gagal dimuat. Hasil yang tersedia tetap ditampilkan.' },
  ms: { unavailable: 'Maklumat carian tidak tersedia', retryHint: 'Sesetengah maklumat carian gagal dimuatkan. Cuba lagi untuk menyemak hasil penuh.', partial: 'Sesetengah maklumat carian gagal dimuatkan. Hasil yang tersedia masih dipaparkan.' },
  fil: { unavailable: 'Hindi available ang impormasyon sa search', retryHint: 'May impormasyon sa search na hindi na-load. Subukan ulit para makita ang buong resulta.', partial: 'May impormasyon sa search na hindi na-load. Ipinapakita pa rin ang available na resulta.' },
  ru: { unavailable: 'Данные поиска недоступны', retryHint: 'Часть данных поиска не загрузилась. Повторите, чтобы увидеть все результаты.', partial: 'Часть данных поиска не загрузилась. Доступные результаты показаны.' },
  kk: { unavailable: 'Іздеу ақпараты қолжетімсіз', retryHint: 'Іздеу ақпаратының бір бөлігі жүктелмеді. Толық нәтижені көру үшін қайталаңыз.', partial: 'Іздеу ақпаратының бір бөлігі жүктелмеді. Қолжетімді нәтижелер көрсетілуде.' },
  uz: { unavailable: 'Qidiruv maʼlumotlarini yuklab boʻlmadi', retryHint: 'Ayrim qidiruv maʼlumotlari yuklanmadi. Toʻliq natijalar uchun qayta urining.', partial: 'Ayrim qidiruv maʼlumotlari yuklanmadi. Mavjud natijalar koʻrsatilmoqda.' },
};

export function searchCopyFor(locale: string) {
  return searchRecoveryCopy[uiLocale(locale)];
}
