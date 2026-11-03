import { computed } from "vue";
import { useLocaleStore } from "@/store/locale";
import { uiLocale } from "@/i18n";

const copy = {
  zh: {
    title: "手机任务", loading: "正在读取任务状态…", unavailable: "任务状态更新失败，保留上次记录。", restoring: "正在恢复任务状态…",
    running: "运行中", waiting: "暂无任务", missing: "未找到这部手机的任务状态。",
    web: "网页版仅查看任务状态，请在已绑定手机的 App 中联网恢复运行。",
    validUntil: "本次运行有效至", expired: "已暂停，请在已绑定手机中打开 App 并联网恢复。",
  },
  en: {
    title: "Phone tasks", loading: "Loading task status…", unavailable: "Unable to update task status. Showing the last record.", restoring: "Restoring task status…",
    running: "Running", waiting: "No current task", missing: "Task status for this phone was not found.",
    web: "The web app is read-only. Open the App online on the bound phone to resume.",
    validUntil: "Active until", expired: "Paused. Open the App online on the bound phone to resume.",
  },
  vi: {
    title: "Tác vụ điện thoại", loading: "Đang đọc trạng thái tác vụ…", unavailable: "Không thể cập nhật trạng thái. Đang giữ bản ghi gần nhất.", restoring: "Đang khôi phục trạng thái tác vụ…",
    running: "Đang chạy", waiting: "Chưa có tác vụ", missing: "Không tìm thấy trạng thái tác vụ của điện thoại này.",
    web: "Bản web chỉ xem trạng thái. Mở App có mạng trên điện thoại đã liên kết để tiếp tục.",
    validUntil: "Hoạt động đến", expired: "Đã tạm dừng. Mở App có mạng trên điện thoại đã liên kết để tiếp tục.",
  },
  id: {
    title: "Tugas ponsel", loading: "Memuat status tugas…", unavailable: "Status tugas gagal diperbarui. Menampilkan catatan terakhir.", restoring: "Memulihkan status tugas…",
    running: "Berjalan", waiting: "Belum ada tugas", missing: "Status tugas untuk ponsel ini tidak ditemukan.",
    web: "Versi web hanya untuk melihat status tugas. Untuk melanjutkan, buka aplikasi di ponsel tertaut dan sambungkan ke internet.",
    validUntil: "Aktif hingga", expired: "Dijeda. Untuk melanjutkan, buka aplikasi di ponsel tertaut dan sambungkan ke internet.",
  },
  ms: {
    title: "Tugasan telefon", loading: "Memuatkan status tugasan…", unavailable: "Status tugasan gagal dikemas kini. Memaparkan rekod terakhir.", restoring: "Memulihkan status tugasan…",
    running: "Berjalan", waiting: "Tiada tugasan", missing: "Status tugasan bagi telefon ini tidak ditemui.",
    web: "Versi web hanya memaparkan status tugasan. Untuk meneruskan, buka app pada telefon yang dipautkan dan sambung ke Internet.",
    validUntil: "Aktif sehingga", expired: "Dijeda. Buka app pada telefon yang dipautkan dan sambung ke Internet untuk meneruskan.",
  },
  fil: {
    title: "Task ng phone", loading: "Nilo-load ang status ng task…", unavailable: "Hindi ma-update ang status ng task. Ipinapakita ang huling record.", restoring: "Ibinabalik ang status ng task…",
    running: "Tumatakbo", waiting: "Walang task ngayon", missing: "Hindi nahanap ang status ng task para sa phone na ito.",
    web: "Status lang ang makikita sa web. Para ituloy, buksan ang App sa naka-link na phone at kumonekta sa internet.",
    validUntil: "Aktibo hanggang", expired: "Naka-pause. Para ituloy, buksan ang App sa naka-link na phone at kumonekta sa internet.",
  },
  ru: {
    title: "Задачи телефона", loading: "Загружаем статус задач…", unavailable: "Не удалось обновить статус задач. Показана последняя запись.", restoring: "Восстанавливаем статус задач…",
    running: "В работе", waiting: "Задач нет", missing: "Статус задач для этого телефона не найден.",
    web: "Веб-версия — только просмотр. Для продолжения откройте приложение на привязанном телефоне с доступом в интернет.",
    validUntil: "Активно до", expired: "На паузе. Для продолжения откройте приложение на привязанном телефоне с доступом в интернет.",
  },
  kk: {
    title: "Телефон тапсырмалары", loading: "Тапсырма күйі жүктелуде…", unavailable: "Тапсырма күйі жаңартылмады. Соңғы жазба көрсетілуде.", restoring: "Тапсырма күйі қалпына келтірілуде…",
    running: "Жұмыс істеуде", waiting: "Тапсырма жоқ", missing: "Бұл телефонның тапсырма күйі табылмады.",
    web: "Вебте тек тапсырма күйі көрінеді. Жалғастыру үшін байланыстырылған телефонды интернетке қосып, қолданбаны ашыңыз.",
    validUntil: "Белсенді мерзімі:", expired: "Кідіртілді. Жалғастыру үшін байланыстырылған телефонды интернетке қосып, қолданбаны ашыңыз.",
  },
  uz: {
    title: "Telefon vazifalari", loading: "Vazifa holati yuklanmoqda…", unavailable: "Vazifa holatini yangilab boʻlmadi. Oxirgi yozuv koʻrsatilmoqda.", restoring: "Vazifa holati tiklanmoqda…",
    running: "Ishlamoqda", waiting: "Joriy vazifa yoʻq", missing: "Bu telefon uchun vazifa holati topilmadi.",
    web: "Vebda faqat vazifa holati koʻrinadi. Davom etish uchun bogʻlangan telefonda internetni yoqib, ilovani oching.",
    validUntil: "Faol muddat:", expired: "Toʻxtatilgan. Davom etish uchun bogʻlangan telefonda internetni yoqib, ilovani oching.",
  },
};

export function usePhoneComputeCopy() {
  const locale = useLocaleStore();
  return computed(() => copy[uiLocale(locale.code)]);
}
