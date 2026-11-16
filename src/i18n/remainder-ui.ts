import { computed } from "vue";
import { useLocaleStore } from "@/store/locale";
import { uiLocale } from "@/i18n";

export const remainderUiCopy = {
  zh: {
    phoneTitle: "手机算力", phoneBody: "在 Android APP 中连接并校准手机，参与算力作业。",
    phoneAction: "设置手机算力", phoneReadOnly: "查看手机状态",
    genesisSupply: "共 {n} 席 · 售完即止",
    listingMinutes: "{n} 分钟", listingHours: "{n} 小时", listingDays: "{n} 天",
  },
  en: {
    phoneTitle: "Phone compute", phoneBody: "Connect and calibrate your phone in the Android app to run compute jobs.",
    phoneAction: "Set up phone compute", phoneReadOnly: "View phone status",
    genesisSupply: "{n} seats in total · while they last",
    listingMinutes: "{n} minutes", listingMinute: "1 minute", listingHours: "{n} hours", listingHour: "1 hour", listingDays: "{n} days", listingDay: "1 day",
  },
  vi: {
    phoneTitle: "Tính toán trên điện thoại", phoneBody: "Kết nối và hiệu chuẩn điện thoại trong ứng dụng Android để chạy tác vụ tính toán.",
    phoneAction: "Thiết lập điện thoại", phoneReadOnly: "Xem trạng thái điện thoại",
    genesisSupply: "Tổng cộng {n} suất · bán hết là dừng",
    listingMinutes: "{n} phút", listingHours: "{n} giờ", listingDays: "{n} ngày",
  },
  id: {
    phoneTitle: "Komputasi ponsel", phoneBody: "Hubungkan dan kalibrasi ponsel Anda di aplikasi Android untuk menjalankan tugas komputasi.",
    phoneAction: "Atur komputasi ponsel", phoneReadOnly: "Lihat status ponsel",
    genesisSupply: "Total {n} kursi · selama tersedia",
    listingMinutes: "{n} menit", listingMinute: "1 menit", listingHours: "{n} jam", listingHour: "1 jam", listingDays: "{n} hari", listingDay: "1 hari",
  },
  ms: {
    phoneTitle: "Pengkomputeran telefon", phoneBody: "Pautkan dan tentukur telefon anda dalam app Android untuk menjalankan kerja pengkomputeran.",
    phoneAction: "Sediakan telefon", phoneReadOnly: "Lihat status telefon",
    genesisSupply: "{n} tempat keseluruhan · selagi ada",
    listingMinutes: "{n} minit", listingMinute: "1 minit", listingHours: "{n} jam", listingHour: "1 jam", listingDays: "{n} hari", listingDay: "1 hari",
  },
  fil: {
    phoneTitle: "Compute ng phone", phoneBody: "Ikonekta at i-calibrate ang phone mo sa Android app para magpatakbo ng compute job.",
    phoneAction: "I-set up ang compute ng phone", phoneReadOnly: "Tingnan ang status ng phone",
    genesisSupply: "Kabuuang seat: {n} · habang may natitira",
    listingMinutes: "{n} minuto", listingMinute: "1 minuto", listingHours: "{n} oras", listingHour: "1 oras", listingDays: "{n} araw", listingDay: "1 araw",
  },
  ru: {
    phoneTitle: "Вычисления на телефоне", phoneBody: "Подключите и откалибруйте телефон в приложении для Android, чтобы выполнять вычислительные задачи.",
    phoneAction: "Настроить телефон", phoneReadOnly: "Статус телефона",
    genesisSupply: "Всего мест: {n} · пока есть в наличии",
    listingMinutes: "{n} мин", listingMinute: "1 мин", listingHours: "{n} ч", listingHour: "1 ч", listingDays: "{n} дн.", listingDay: "1 дн.",
  },
  kk: {
    phoneTitle: "Телефон есептеу қуаты", phoneBody: "Есептеу жұмыстарын орындау үшін Android қолданбасында телефонды байланыстырып, калибрлеңіз.",
    phoneAction: "Есептеу қуатын баптау", phoneReadOnly: "Телефон күйін қарау",
    genesisSupply: "Барлығы {n} орын · таусылғанша",
    listingMinutes: "{n} минут", listingMinute: "1 минут", listingHours: "{n} сағат", listingHour: "1 сағат", listingDays: "{n} күн", listingDay: "1 күн",
  },
  uz: {
    phoneTitle: "Telefon quvvati", phoneBody: "Hisoblash ishlarini bajarish uchun telefoningizni Android ilovasida ulang va kalibrlang.",
    phoneAction: "Telefon quvvatini sozlash", phoneReadOnly: "Telefon holatini koʻrish",
    genesisSupply: "Jami {n} oʻrin · tugaguncha",
    listingMinutes: "{n} daqiqa", listingMinute: "1 daqiqa", listingHours: "{n} soat", listingHour: "1 soat", listingDays: "{n} kun", listingDay: "1 kun",
  },
};

export function useRemainderUiCopy() {
  const locale = useLocaleStore();
  return computed(() => remainderUiCopy[uiLocale(locale.code)]);
}
