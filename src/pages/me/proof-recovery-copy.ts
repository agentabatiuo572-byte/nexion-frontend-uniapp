import { uiLocale } from "@/i18n";
const copy = {
  zh: {
    loading: "正在加载证明资料",
    loadingHint: "加载完成后可复制链接、分享或保存卡片。",
    unavailable: "证明资料暂时无法加载",
    unavailableHint: "请重试，加载完成后可继续分享。",
    linkUnavailable: "分享链接暂时不可用",
    linkUnavailableHint: "请重新加载资料后再复制、分享或保存卡片。",
  },
  en: {
    loading: "Loading proof details",
    loadingHint: "Once loaded, you can copy the link, share or save your card.",
    unavailable: "Proof details could not be loaded",
    unavailableHint: "Retry loading the details to continue sharing.",
    linkUnavailable: "Sharing link is unavailable",
    linkUnavailableHint: "Reload the details before copying, sharing or saving your card.",
  },
  vi: {
    loading: "Đang tải thông tin chứng minh",
    loadingHint: "Sau khi tải xong, bạn có thể sao chép liên kết, chia sẻ hoặc lưu thẻ.",
    unavailable: "Chưa tải được thông tin chứng minh",
    unavailableHint: "Thử tải lại thông tin để tiếp tục chia sẻ.",
    linkUnavailable: "Liên kết chia sẻ chưa khả dụng",
    linkUnavailableHint: "Tải lại thông tin trước khi sao chép, chia sẻ hoặc lưu thẻ.",
  },
  id: {
    loading: "Memuat detail bukti",
    loadingHint: "Setelah dimuat, Anda bisa menyalin tautan, membagikan, atau menyimpan kartu.",
    unavailable: "Detail bukti gagal dimuat",
    unavailableHint: "Muat ulang detailnya untuk melanjutkan berbagi.",
    linkUnavailable: "Tautan berbagi tidak tersedia",
    linkUnavailableHint: "Muat ulang detailnya sebelum menyalin, membagikan, atau menyimpan kartu.",
  },
  ms: {
    loading: "Memuatkan butiran bukti",
    loadingHint: "Setelah dimuatkan, anda boleh menyalin pautan, berkongsi atau menyimpan kad anda.",
    unavailable: "Butiran bukti gagal dimuatkan",
    unavailableHint: "Muat semula butiran untuk terus berkongsi.",
    linkUnavailable: "Pautan perkongsian tidak tersedia",
    linkUnavailableHint: "Muat semula butiran sebelum menyalin, berkongsi atau menyimpan kad anda.",
  },
  fil: {
    loading: "Nilo-load ang detalye ng patunay",
    loadingHint: "Kapag na-load, puwede mong kopyahin ang link, ibahagi o i-save ang card mo.",
    unavailable: "Hindi ma-load ang detalye ng patunay",
    unavailableHint: "I-load ulit ang detalye para maituloy ang pag-share.",
    linkUnavailable: "Hindi available ang share link",
    linkUnavailableHint: "I-reload ang detalye bago kopyahin, ibahagi o i-save ang card mo.",
  },
  ru: {
    loading: "Загружаем данные",
    loadingHint: "После загрузки можно скопировать ссылку, поделиться или сохранить карточку.",
    unavailable: "Не удалось загрузить данные",
    unavailableHint: "Загрузите данные снова, чтобы продолжить.",
    linkUnavailable: "Ссылка недоступна",
    linkUnavailableHint: "Перезагрузите данные, прежде чем копировать, делиться или сохранять карточку.",
  },
  kk: {
    loading: "Растама мәліметі жүктелуде",
    loadingHint: "Жүктелгеннен кейін сілтемені көшіріп, онымен бөлісіп не карточканы сақтай аласыз.",
    unavailable: "Растама мәліметі жүктелмеді",
    unavailableHint: "Бөлісуді жалғастыру үшін мәліметті қайта жүктеңіз.",
    linkUnavailable: "Бөлісу сілтемесі қолжетімсіз",
    linkUnavailableHint: "Сілтемені көшірмес, онымен бөліспес не карточканы сақтамас бұрын қайта жүктеңіз.",
  },
  uz: {
    loading: "Isbot maʼlumotlari yuklanmoqda",
    loadingHint: "Yuklangach, havolani nusxalash, ulashish yoki kartani saqlash mumkin.",
    unavailable: "Isbot maʼlumotlarini yuklab boʻlmadi",
    unavailableHint: "Ulashishni davom ettirish uchun qayta yuklang.",
    linkUnavailable: "Ulashish havolasi mavjud emas",
    linkUnavailableHint: "Nusxalash, ulashish yoki kartani saqlashdan oldin maʼlumotlarni qayta yuklang.",
  },
};

export function proofRecoveryCopyFor(locale: string) {
  return copy[uiLocale(locale)];
}
