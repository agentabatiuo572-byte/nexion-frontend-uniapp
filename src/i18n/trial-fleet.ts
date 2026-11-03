import { computed } from "vue";
import { useLocaleStore } from "@/store/locale";
import { uiLocale } from "@/i18n";

export const trialFleetCopy = {
  zh: {
    imageBadge: "试用", statusUnknown: "状态未知",
    longRemaining: '{days}天 {hours}小时',
    grace: "试用已停止，抵扣仍可用", remaining: "剩余时间", creditRemaining: "抵扣剩余",
    availableCredit: "当前可抵扣", estimate: "预计试用抵扣", details: "试用详情", detailsAction: "详情", buyEarly: "提前购买", buy: "抵扣购机",
    unknown: "试用状态暂不可用", loading: "正在更新试用状态", retry: "重试", creditNote: "抵扣仅用于购机，不能直接提现。",
    slotsUnknown: "设备容量暂不可用，请刷新后重试", slotsChecking: "正在确认设备容量，请稍候", cancelBusy: "正在取消试用", cancel: "取消试用",
  },
  en: {
    imageBadge: "Trial", statusUnknown: "Status unknown",
    longRemaining: '{days}d {hours}h',
    grace: "Trial stopped · credit available", remaining: "Remaining", creditRemaining: "Credit expires in",
    availableCredit: "Available credit", estimate: "Estimated trial credit", details: "Trial details", detailsAction: "Details", buyEarly: "Buy early", buy: "Buy with credit",
    unknown: "Trial status unavailable", loading: "Updating trial status", retry: "Retry", creditNote: "Credit applies to a device purchase and cannot be withdrawn directly.",
    slotsUnknown: "Device capacity is unavailable. Refresh and try again.", slotsChecking: "Checking device capacity. Please wait.", cancelBusy: "Cancelling trial", cancel: "Cancel trial",
  },
  vi: {
    imageBadge: "Dùng thử", statusUnknown: "Chưa xác định",
    longRemaining: '{days} ngày {hours} giờ',
    grace: "Đã dừng dùng thử · còn khoản khấu trừ", remaining: "Còn lại", creditRemaining: "Khấu trừ còn",
    availableCredit: "Khoản khấu trừ khả dụng", estimate: "Khoản khấu trừ dự kiến", details: "Chi tiết dùng thử", detailsAction: "Chi tiết", buyEarly: "Mua sớm", buy: "Mua với khấu trừ",
    unknown: "Chưa tải được trạng thái dùng thử", loading: "Đang cập nhật lượt dùng thử", retry: "Thử lại", creditNote: "Khoản khấu trừ chỉ dùng để mua thiết bị, không thể rút trực tiếp.",
    slotsUnknown: "Chưa tải được sức chứa thiết bị. Vui lòng tải lại và thử lại.", slotsChecking: "Đang kiểm tra sức chứa thiết bị. Vui lòng đợi.", cancelBusy: "Đang hủy dùng thử", cancel: "Hủy dùng thử",
  },
  id: {
    imageBadge: "Uji coba", statusUnknown: "Status tidak diketahui",
    longRemaining: '{days} hr {hours} jam',
    grace: "Uji coba berhenti · potongan tersedia", remaining: "Sisa waktu", creditRemaining: "Potongan berakhir dalam",
    availableCredit: "Potongan tersedia", estimate: "Est. kredit uji coba", details: "Detail uji coba", detailsAction: "Detail", buyEarly: "Beli lebih awal", buy: "Beli dengan potongan",
    unknown: "Status uji coba tidak tersedia", loading: "Memperbarui status uji coba", retry: "Coba lagi", creditNote: "Potongan hanya berlaku untuk pembelian perangkat dan tidak dapat ditarik langsung.",
    slotsUnknown: "Kapasitas perangkat tidak tersedia. Muat ulang, lalu coba lagi.", slotsChecking: "Memeriksa kapasitas perangkat. Mohon tunggu.", cancelBusy: "Membatalkan uji coba", cancel: "Batalkan uji coba",
  },
  ms: {
    imageBadge: "Percubaan", statusUnknown: "Status tidak diketahui",
    longRemaining: '{days} hari {hours} j',
    grace: "Percubaan berhenti · kredit tersedia", remaining: "Baki masa", creditRemaining: "Kredit luput dalam",
    availableCredit: "Kredit tersedia", estimate: "Anggaran kredit percubaan", details: "Butiran percubaan", detailsAction: "Butiran", buyEarly: "Beli awal", buy: "Beli dengan kredit",
    unknown: "Status percubaan tidak tersedia", loading: "Mengemas kini status percubaan", retry: "Cuba lagi", creditNote: "Kredit untuk pembelian peranti dan tidak boleh dikeluarkan terus.",
    slotsUnknown: "Kapasiti peranti tidak tersedia. Muat semula dan cuba lagi.", slotsChecking: "Menyemak kapasiti peranti. Sila tunggu.", cancelBusy: "Membatalkan percubaan", cancel: "Batal percubaan",
  },
  fil: {
    imageBadge: "Trial", statusUnknown: "Hindi alam ang status",
    longRemaining: '{days}d {hours}h',
    grace: "Huminto ang trial · may credit pa", remaining: "Natitira", creditRemaining: "Expiry ng credit",
    availableCredit: "Available na credit", estimate: "Tinatayang credit sa trial", details: "Detalye ng trial", detailsAction: "Detalye", buyEarly: "Bumili na", buy: "Bumili gamit ang credit",
    unknown: "Hindi available ang status ng trial", loading: "Ina-update ang status ng trial", retry: "Subukan ulit", creditNote: "Para lang sa pagbili ng device ang credit at hindi ito direktang mawi-withdraw.",
    slotsUnknown: "Hindi available ang capacity ng device. Mag-refresh at subukan ulit.", slotsChecking: "Sinusuri ang capacity ng device. Sandali lang.", cancelBusy: "Kinakansela ang trial", cancel: "I-cancel ang trial",
  },
  ru: {
    imageBadge: "Пробный период", statusUnknown: "Статус неизвестен",
    longRemaining: '{days} дн. {hours} ч',
    grace: "Пробный период окончен · бонус доступен", remaining: "Осталось", creditRemaining: "Бонус сгорит через",
    availableCredit: "Доступный бонус", estimate: "≈ пробный бонус", details: "О пробном периоде", detailsAction: "Детали", buyEarly: "Купить раньше", buy: "Купить с бонусом",
    unknown: "Статус пробного периода недоступен", loading: "Обновляем статус пробного периода", retry: "Повторить", creditNote: "Бонус идёт только в зачёт покупки устройства, вывести его нельзя.",
    slotsUnknown: "Данные о слотах недоступны. Обновите и повторите.", slotsChecking: "Проверяем слоты. Подождите.", cancelBusy: "Отменяем пробный период", cancel: "Отменить",
  },
  kk: {
    imageBadge: "Сынақ", statusUnknown: "Күйі белгісіз",
    longRemaining: '{days} күн {hours} сағ',
    grace: "Сынақ тоқтады · бонус қолжетімді", remaining: "Қалды", creditRemaining: "Бонустың аяқталуына",
    availableCredit: "Қолжетімді бонус", estimate: "Болжамды сынақ бонусы", details: "Сынақ мәліметі", detailsAction: "Толығырақ", buyEarly: "Ерте сатып алу", buy: "Бонуспен сатып алу",
    unknown: "Сынақ күйі қолжетімсіз", loading: "Сынақ күйі жаңартылуда", retry: "Қайталау", creditNote: "Бонус тек құрылғы сатып алуға жұмсалады, оны тікелей шығаруға болмайды.",
    slotsUnknown: "Құрылғы орындары туралы дерек қолжетімсіз. Жаңартып, қайталап көріңіз.", slotsChecking: "Құрылғы орындары тексерілуде. Күте тұрыңыз.", cancelBusy: "Сынақ тоқтатылуда", cancel: "Сынақты тоқтату",
  },
  uz: {
    imageBadge: "Sinov", statusUnknown: "Holat nomaʼlum",
    longRemaining: '{days} kun {hours} soat',
    grace: "Sinov toʻxtadi · chegirma mavjud", remaining: "Qoldi", creditRemaining: "Chegirma tugashiga",
    availableCredit: "Mavjud chegirma", estimate: "Taxminiy sinov mablagʻi", details: "Sinov tafsilotlari", detailsAction: "Batafsil", buyEarly: "Erta xarid", buy: "Chegirma bilan olish",
    unknown: "Sinov holatini yuklab boʻlmadi", loading: "Sinov holati yangilanmoqda", retry: "Takrorlash", creditNote: "Chegirma faqat qurilma xaridiga ishlatiladi, uni bevosita yechib boʻlmaydi.",
    slotsUnknown: "Qurilma slotlarini tekshirib boʻlmadi. Yangilab, qayta urining.", slotsChecking: "Qurilma slotlari tekshirilmoqda. Kuting.", cancelBusy: "Sinov bekor qilinmoqda", cancel: "Bekor qilish",
  },
};

export function useTrialFleetCopy() {
  const locale = useLocaleStore();
  return computed(() => trialFleetCopy[uiLocale(locale.code)]);
}
