import { computed } from "vue";
import { useLocaleStore } from "@/store/locale";
import { uiLocale } from "@/i18n";

export const remainderUiCopy = {
  zh: {
    earnWays: {
      phoneTitle: "手机算力", phoneBody: "连接 Android 手机", phoneAction: "设置手机", phoneReadOnly: "手机状态",
      stakingBody: "期限及提前退出规则。",
      gpuTitle: "共享电脑算力", gpuBody: "闲置 GPU · 占 1 个槽位", gpuAction: "查看连接方式",
    },
    phoneTitle: "手机算力", phoneBody: "在 Android APP 中连接并校准手机，参与算力作业。",
    phoneAction: "设置手机算力", phoneReadOnly: "查看手机状态", downloadApp: "下载 APP",
    stakingTitle: "质押", stakingAction: "查看质押",
    genesisSupply: "共 {n} 席 · 售完即止",
    listingMinutes: "{n} 分钟", listingHours: "{n} 小时", listingDays: "{n} 天",
  },
  en: {
    earnWays: {
      phoneTitle: "Phone compute", phoneBody: "Compute on Android.", phoneAction: "Set up phone", phoneReadOnly: "Phone status",
      stakingBody: "Terms and early exit rules.",
      gpuTitle: "Share GPU power", gpuBody: "Idle GPU · 1 slot", gpuAction: "How to connect",
    },
    phoneTitle: "Phone compute", phoneBody: "Connect and calibrate your phone in the Android app to run compute jobs.",
    phoneAction: "Set up phone compute", phoneReadOnly: "View phone status", downloadApp: "Download app",
    stakingTitle: "Staking", stakingAction: "View staking",
    genesisSupply: "{n} seats in total · while they last",
    listingMinutes: "{n} minutes", listingMinute: "1 minute", listingHours: "{n} hours", listingHour: "1 hour", listingDays: "{n} days", listingDay: "1 day",
  },
  vi: {
    earnWays: {
      phoneTitle: "Tính toán di động", phoneBody: "Kết nối điện thoại Android.", phoneAction: "Thiết lập", phoneReadOnly: "Trạng thái điện thoại",
      stakingBody: "Kỳ hạn và quy tắc rút sớm.",
      gpuTitle: "Chia sẻ GPU", gpuBody: "GPU nhàn rỗi · 1 khe", gpuAction: "Cách kết nối",
    },
    phoneTitle: "Tính toán trên điện thoại", phoneBody: "Kết nối và hiệu chuẩn điện thoại trong ứng dụng Android để chạy tác vụ tính toán.",
    phoneAction: "Thiết lập điện thoại", phoneReadOnly: "Xem trạng thái điện thoại", downloadApp: "Tải ứng dụng",
    stakingTitle: "Staking", stakingAction: "Xem staking",
    genesisSupply: "Tổng cộng {n} suất · bán hết là dừng",
    listingMinutes: "{n} phút", listingHours: "{n} giờ", listingDays: "{n} ngày",
  },
  id: {
    earnWays: {
      phoneTitle: "Komputasi HP", phoneBody: "Hubungkan ponsel Android.", phoneAction: "Atur ponsel", phoneReadOnly: "Status ponsel",
      stakingBody: "Durasi dan aturan buka kunci lebih awal.",
      gpuTitle: "Bagikan daya GPU", gpuBody: "GPU menganggur · 1 slot", gpuAction: "Cara menghubungkan",
    },
    phoneTitle: "Komputasi ponsel", phoneBody: "Hubungkan dan kalibrasi ponsel Anda di aplikasi Android untuk menjalankan tugas komputasi.",
    phoneAction: "Atur komputasi ponsel", phoneReadOnly: "Lihat status ponsel", downloadApp: "Unduh aplikasi",
    stakingTitle: "Staking", stakingAction: "Lihat staking",
    genesisSupply: "Total {n} kursi · selama tersedia",
    listingMinutes: "{n} menit", listingMinute: "1 menit", listingHours: "{n} jam", listingHour: "1 jam", listingDays: "{n} hari", listingDay: "1 hari",
  },
  ms: {
    earnWays: {
      phoneTitle: "Telefon", phoneBody: "Pautkan telefon Android.", phoneAction: "Sediakan telefon", phoneReadOnly: "Status telefon",
      stakingBody: "Tempoh dan peraturan buka kunci awal.",
      gpuTitle: "Kongsi kuasa GPU", gpuBody: "GPU melahu · 1 slot", gpuAction: "Cara menyambung",
    },
    phoneTitle: "Pengkomputeran telefon", phoneBody: "Pautkan dan tentukur telefon anda dalam app Android untuk menjalankan kerja pengkomputeran.",
    phoneAction: "Sediakan telefon", phoneReadOnly: "Lihat status telefon", downloadApp: "Muat turun app",
    stakingTitle: "Staking", stakingAction: "Lihat staking",
    genesisSupply: "{n} tempat keseluruhan · selagi ada",
    listingMinutes: "{n} minit", listingMinute: "1 minit", listingHours: "{n} jam", listingHour: "1 jam", listingDays: "{n} hari", listingDay: "1 hari",
  },
  fil: {
    earnWays: {
      phoneTitle: "Compute ng phone", phoneBody: "Compute sa Android.", phoneAction: "I-set up ang phone", phoneReadOnly: "Status ng phone",
      stakingBody: "Term at tuntunin sa maagang alis.",
      gpuTitle: "I-share ang GPU", gpuBody: "Idle na GPU · 1 slot", gpuAction: "Paano kumonekta",
    },
    phoneTitle: "Compute ng phone", phoneBody: "Ikonekta at i-calibrate ang phone mo sa Android app para magpatakbo ng compute job.",
    phoneAction: "I-set up ang compute ng phone", phoneReadOnly: "Tingnan ang status ng phone", downloadApp: "I-download",
    stakingTitle: "Staking", stakingAction: "Buksan ang staking",
    genesisSupply: "Kabuuang seat: {n} · habang may natitira",
    listingMinutes: "{n} minuto", listingMinute: "1 minuto", listingHours: "{n} oras", listingHour: "1 oras", listingDays: "{n} araw", listingDay: "1 araw",
  },
  ru: {
    earnWays: {
      phoneTitle: "Вычисления на телефоне", phoneBody: "Вычисления на Android.", phoneAction: "Настроить", phoneReadOnly: "Статус телефона",
      stakingBody: "Сроки и правила досрочного выхода.",
      gpuTitle: "Общий доступ к GPU", gpuBody: "Свободный GPU · 1 слот", gpuAction: "Как подключить",
    },
    phoneTitle: "Вычисления на телефоне", phoneBody: "Подключите и откалибруйте телефон в приложении для Android, чтобы выполнять вычислительные задачи.",
    phoneAction: "Настроить телефон", phoneReadOnly: "Статус телефона", downloadApp: "Скачать",
    stakingTitle: "Стейкинг", stakingAction: "К стейкингу",
    genesisSupply: "Всего мест: {n} · пока есть в наличии",
    listingMinutes: "{n} мин", listingMinute: "1 мин", listingHours: "{n} ч", listingHour: "1 ч", listingDays: "{n} дн.", listingDay: "1 дн.",
  },
  kk: {
    earnWays: {
      phoneTitle: "Телефон қуаты", phoneBody: "Android телефонын байланыстыру.", phoneAction: "Телефонды баптау", phoneReadOnly: "Телефон күйі",
      stakingBody: "Мерзімдер мен ерте шығу ережелері.",
      gpuTitle: "GPU қуатымен бөлісу", gpuBody: "Бос GPU · 1 орын", gpuAction: "Қалай қосылады",
    },
    phoneTitle: "Телефон есептеу қуаты", phoneBody: "Есептеу жұмыстарын орындау үшін Android қолданбасында телефонды байланыстырып, калибрлеңіз.",
    phoneAction: "Есептеу қуатын баптау", phoneReadOnly: "Телефон күйін қарау", downloadApp: "Жүктеп алу",
    stakingTitle: "Стейкинг", stakingAction: "Стейкингті қарау",
    genesisSupply: "Барлығы {n} орын · таусылғанша",
    listingMinutes: "{n} минут", listingMinute: "1 минут", listingHours: "{n} сағат", listingHour: "1 сағат", listingDays: "{n} күн", listingDay: "1 күн",
  },
  uz: {
    earnWays: {
      phoneTitle: "Telefon quvvati", phoneBody: "Android telefonni ulang.", phoneAction: "Telefon sozlash", phoneReadOnly: "Telefon holati",
      stakingBody: "Muddat va erta chiqish qoidalari.",
      gpuTitle: "GPU quvvatini ulashish", gpuBody: "Boʻsh GPU · 1 slot", gpuAction: "Qanday ulanadi",
    },
    phoneTitle: "Telefon quvvati", phoneBody: "Hisoblash ishlarini bajarish uchun telefoningizni Android ilovasida ulang va kalibrlang.",
    phoneAction: "Telefon quvvatini sozlash", phoneReadOnly: "Telefon holatini koʻrish", downloadApp: "Ilovani yuklab olish",
    stakingTitle: "Steyking", stakingAction: "Steyking",
    genesisSupply: "Jami {n} oʻrin · tugaguncha",
    listingMinutes: "{n} daqiqa", listingMinute: "1 daqiqa", listingHours: "{n} soat", listingHour: "1 soat", listingDays: "{n} kun", listingDay: "1 kun",
  },
};

export function useRemainderUiCopy() {
  const locale = useLocaleStore();
  return computed(() => remainderUiCopy[uiLocale(locale.code)]);
}
