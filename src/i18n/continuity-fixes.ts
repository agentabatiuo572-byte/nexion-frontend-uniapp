import { uiLocale } from "@/i18n";
export function continuityCopy(language: string) {
  return ({
    zh: {
      trustRefreshing: '正在更新资料，当前显示上次内容。',
      trustRefreshFailed: '资料更新失败，当前显示上次内容。请重试。',
      tomorrowBaseReward: '明日签到基础奖励 +{n}\u00A0UVT',
    },
    en: {
      trustRefreshing: 'Updating information. Previously loaded content is shown.',
      trustRefreshFailed: 'Could not update information. Previously loaded content is shown. Please retry.',
      tomorrowBaseReward: 'Tomorrow’s base check-in reward: +{n}\u00A0UVT',
    },
    vi: {
      trustRefreshing: 'Đang cập nhật thông tin. Nội dung đã tải trước đó vẫn được hiển thị.',
      trustRefreshFailed: 'Không thể cập nhật thông tin. Nội dung đã tải trước đó vẫn được hiển thị. Vui lòng thử lại.',
      tomorrowBaseReward: 'Thưởng điểm danh cơ bản ngày mai: +{n}\u00A0UVT',
    },
    id: {
      trustRefreshing: 'Memperbarui informasi. Menampilkan konten sebelumnya.',
      trustRefreshFailed: 'Informasi gagal diperbarui. Menampilkan konten sebelumnya. Coba lagi.',
      tomorrowBaseReward: 'Hadiah dasar check-in besok: +{n}\u00A0UVT',
    },
    ms: {
      trustRefreshing: 'Mengemas kini maklumat. Kandungan yang dimuatkan sebelum ini dipaparkan.',
      trustRefreshFailed: 'Maklumat tidak dapat dikemas kini. Kandungan sebelum ini dipaparkan. Sila cuba lagi.',
      tomorrowBaseReward: 'Ganjaran asas daftar masuk esok: +{n}\u00A0UVT',
    },
    fil: {
      trustRefreshing: 'Ina-update ang impormasyon. Ipinapakita ang dating na-load na content.',
      trustRefreshFailed: 'Hindi ma-update ang impormasyon. Ipinapakita ang dating na-load na content. Subukan ulit.',
      tomorrowBaseReward: 'Base na reward sa check-in bukas: +{n}\u00A0UVT',
    },
    ru: {
      trustRefreshing: 'Обновляем данные. Показаны ранее загруженные.',
      trustRefreshFailed: 'Не удалось обновить данные. Показаны ранее загруженные. Повторите попытку.',
      tomorrowBaseReward: 'Базовая награда за отметку завтра: +{n}\u00A0UVT',
    },
    kk: {
      trustRefreshing: 'Ақпарат жаңартылуда. Бұрын жүктелген мазмұн көрсетілуде.',
      trustRefreshFailed: 'Ақпарат жаңартылмады. Бұрын жүктелген мазмұн көрсетілуде. Қайталап көріңіз.',
      tomorrowBaseReward: 'Ертеңгі белгінің негізгі сыйақысы: +{n}\u00A0UVT',
    },
    uz: {
      trustRefreshing: 'Maʼlumotlar yangilanmoqda. Oldin yuklangan kontent koʻrsatilmoqda.',
      trustRefreshFailed: 'Maʼlumotlarni yangilab boʻlmadi. Oldin yuklangan kontent koʻrsatilmoqda. Qayta urining.',
      tomorrowBaseReward: 'Ertangi belgilanish uchun asosiy mukofot: +{n}\u00A0UVT',
    },
  })[uiLocale(language)];
}
