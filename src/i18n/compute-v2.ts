import { computed } from "vue";
import { useLocaleStore } from "@/store/locale";
import { uiLocale } from "@/i18n";

export const computeV2Copy = {
  zh: {
    accountBatchHint: "包含账号所有设备的收益。",
    stopNow: "立即停止（未完成任务不发收益）", stopDescription: "{name} 有进行中的任务，请选择停用方式。", stopping: "正在停止，任务收益确认后将完成停用。",
    taskReceipt: "任务凭证", emptyReceipts: "暂无任务凭证", receiptsHint: "任务完成并入账后，可在这里查看凭证。", confirming: "收益确认中", running: "运行中", duration: "任务时长", reward: "本次收益",
    title: "算力结算", pending: "待发放收益", pendingHint: "已确认待入账，暂不可提现或消费。", unknown: "—",
    frozenReward: "冻结奖励", estimated: "预计时长", actual: "实际运行时长", seconds: "秒", batch: "发放批次", tasks: "任务", details: "任务详情", close: "关闭", retry: "重试", more: "加载更多", empty: "暂无发放批次", loading: "正在读取…", unavailable: "发放记录读取失败，请重试。", configVersion: "配置版本", receipt: "计算凭证", window: "完成窗口", postedAt: "入账时间",
    statuses: { CLAIMED: "已领取", QUEUED: "排队中", RUNNING: "计算中", VERIFYING: "校验中", RECOVERING: "恢复中", PAUSED: "已暂停", COMPLETED: "已完成", FAILED: "执行失败", CANCELLED: "已取消", NONE: "无待发放收益", PENDING: "待发放", POSTED: "已入账", BLOCKED: "发放暂停" },
  },
  en: {
    accountBatchHint: "Includes earnings from all account devices.",
    stopNow: "Stop now (no reward for the unfinished task)", stopDescription: "{name} has a task in progress. Choose when to deactivate.", stopping: "Stopping. Deactivation follows confirmation of completed earnings.",
    taskReceipt: "Task receipt", emptyReceipts: "No task receipts yet", receiptsHint: "Receipts appear after tasks complete and earnings are posted.", confirming: "Confirming earnings", running: "Running", duration: "Task duration", reward: "Task reward",
    title: "Compute settlement", pending: "Pending earnings", pendingHint: "Confirmed and awaiting posting. Unavailable for spending or withdrawal.", unknown: "—",
    frozenReward: "Frozen reward", estimated: "Estimated duration", actual: "Actual runtime", seconds: "sec", batch: "Payout batch", tasks: "tasks", details: "Task details", close: "Close", retry: "Retry", more: "Load more", empty: "No payout batches yet", loading: "Loading…", unavailable: "Unable to load payout records. Please retry.", configVersion: "Configuration version", receipt: "Compute receipt", window: "Completion window", postedAt: "Posted at",
    statuses: { CLAIMED: "Claimed", QUEUED: "Queued", RUNNING: "Running", VERIFYING: "Verifying", RECOVERING: "Recovering", PAUSED: "Paused", COMPLETED: "Completed", FAILED: "Failed", CANCELLED: "Cancelled", NONE: "No pending earnings", PENDING: "Pending payout", POSTED: "Posted", BLOCKED: "Payout on hold" },
  },
  vi: {
    accountBatchHint: "Bao gồm thu nhập từ mọi thiết bị trong tài khoản.",
    stopNow: "Dừng ngay (tác vụ chưa xong không nhận thưởng)", stopDescription: "{name} đang có tác vụ. Chọn thời điểm ngừng kích hoạt.", stopping: "Đang dừng. Thiết bị sẽ ngừng kích hoạt sau khi xác nhận thu nhập đã hoàn thành.",
    taskReceipt: "Biên nhận tác vụ", emptyReceipts: "Chưa có biên nhận tác vụ", receiptsHint: "Biên nhận xuất hiện sau khi tác vụ hoàn thành và thu nhập được ghi có.", confirming: "Đang xác nhận thu nhập", running: "Đang chạy", duration: "Thời lượng tác vụ", reward: "Thu nhập tác vụ",
    title: "Chi trả tác vụ", pending: "Thu nhập chờ chi trả", pendingHint: "Đã xác nhận, đang chờ ghi có. Chưa thể rút hoặc chi tiêu.", unknown: "—",
    frozenReward: "Phần thưởng đã chốt", estimated: "Thời lượng dự kiến", actual: "Thời gian chạy thực tế", seconds: "giây", batch: "Đợt chi trả", tasks: "tác vụ", details: "Chi tiết tác vụ", close: "Đóng", retry: "Thử lại", more: "Tải thêm", empty: "Chưa có đợt chi trả", loading: "Đang tải…", unavailable: "Không thể tải lịch sử chi trả. Vui lòng thử lại.", configVersion: "Phiên bản cấu hình", receipt: "Biên nhận tính toán", window: "Khoảng hoàn thành", postedAt: "Thời điểm ghi có",
    statuses: { CLAIMED: "Đã nhận", QUEUED: "Đang chờ", RUNNING: "Đang chạy", VERIFYING: "Đang xác minh", RECOVERING: "Đang khôi phục", PAUSED: "Tạm dừng", COMPLETED: "Hoàn thành", FAILED: "Thất bại", CANCELLED: "Đã hủy", NONE: "Không có thu nhập chờ chi trả", PENDING: "Chờ chi trả", POSTED: "Đã ghi có", BLOCKED: "Tạm dừng chi trả" },
  },
  id: {
    accountBatchHint: "Termasuk pendapatan dari semua perangkat di akun.",
    stopNow: "Hentikan sekarang (tugas yang belum selesai tidak mendapat hadiah)", stopDescription: "{name} sedang menjalankan tugas. Pilih kapan menonaktifkan.", stopping: "Sedang menghentikan. Penonaktifan selesai setelah pendapatan tugas dikonfirmasi.",
    taskReceipt: "Kuitansi tugas", emptyReceipts: "Belum ada kuitansi tugas", receiptsHint: "Kuitansi muncul setelah tugas selesai dan pendapatan masuk.", confirming: "Mengonfirmasi pendapatan", running: "Berjalan", duration: "Durasi tugas", reward: "Hadiah tugas",
    title: "Pembayaran komputasi", pending: "Pendapatan tertunda", pendingHint: "Sudah dikonfirmasi dan menunggu masuk. Belum bisa dipakai atau ditarik.", unknown: "—",
    frozenReward: "Hadiah dibekukan", estimated: "Est. durasi", actual: "Durasi aktual", seconds: "dtk", batch: "Batch pembayaran", tasks: "tugas", details: "Detail tugas", close: "Tutup", retry: "Coba lagi", more: "Muat lagi", empty: "Belum ada batch pembayaran", loading: "Memuat…", unavailable: "Data pembayaran gagal dimuat. Coba lagi.", configVersion: "Versi konfigurasi", receipt: "Kuitansi komputasi", window: "Rentang penyelesaian", postedAt: "Masuk pada",
    statuses: { CLAIMED: "Diklaim", QUEUED: "Dalam antrean", RUNNING: "Berjalan", VERIFYING: "Memverifikasi", RECOVERING: "Memulihkan", PAUSED: "Dijeda", COMPLETED: "Selesai", FAILED: "Gagal", CANCELLED: "Dibatalkan", NONE: "Tidak ada pendapatan tertunda", PENDING: "Menunggu pembayaran", POSTED: "Masuk", BLOCKED: "Pembayaran tertahan" },
  },
  ms: {
    accountBatchHint: "Termasuk pendapatan daripada semua peranti dalam akaun.",
    stopNow: "Henti sekarang (tiada ganjaran untuk tugasan belum selesai)", stopDescription: "{name} ada tugasan sedang berjalan. Pilih bila hendak menyahaktifkan.", stopping: "Sedang dihentikan. Penyahaktifan akan selesai selepas pendapatan tugasan disahkan.",
    taskReceipt: "Resit tugasan", emptyReceipts: "Belum ada resit tugasan", receiptsHint: "Resit dipaparkan selepas tugasan selesai dan pendapatan dikreditkan.", confirming: "Mengesahkan pendapatan", running: "Berjalan", duration: "Tempoh tugasan", reward: "Ganjaran tugasan",
    title: "Bayaran pengkomputeran", pending: "Pendapatan menunggu", pendingHint: "Disahkan dan menunggu dikreditkan. Belum boleh dibelanjakan atau dikeluarkan.", unknown: "—",
    frozenReward: "Ganjaran dibekukan", estimated: "Anggaran tempoh", actual: "Tempoh pelaksanaan sebenar", seconds: "s", batch: "Kelompok bayaran", tasks: "tugasan", details: "Butiran tugasan", close: "Tutup", retry: "Cuba lagi", more: "Muat lagi", empty: "Belum ada kelompok bayaran", loading: "Memuatkan…", unavailable: "Maklumat bayaran gagal dimuatkan. Sila cuba lagi.", configVersion: "Versi konfigurasi", receipt: "Resit pengkomputeran", window: "Tempoh siap", postedAt: "Dikreditkan pada",
    statuses: { CLAIMED: "Dituntut", QUEUED: "Beratur", RUNNING: "Berjalan", VERIFYING: "Mengesahkan", RECOVERING: "Memulihkan", PAUSED: "Dijeda", COMPLETED: "Selesai", FAILED: "Gagal", CANCELLED: "Dibatalkan", NONE: "Tiada pendapatan menunggu", PENDING: "Menunggu bayaran", POSTED: "Dikreditkan", BLOCKED: "Bayaran disekat" },
  },
  fil: {
    accountBatchHint: "Kasama ang kita ng lahat ng device sa account.",
    stopNow: "Ihinto na (walang reward ang hindi tapos na task)", stopDescription: "May tumatakbong task ang {name}. Piliin kung kailan ide-deactivate.", stopping: "Inihihinto. Made-deactivate pagkakumpirma ng kita sa natapos na task.",
    taskReceipt: "Resibo ng task", emptyReceipts: "Wala pang resibo ng task", receiptsHint: "Lalabas ang resibo kapag natapos na ang task at naitala na ang kita.", confirming: "Kinukumpirma ang kita", running: "Tumatakbo", duration: "Tagal ng task", reward: "Reward sa task",
    title: "Payout sa compute", pending: "Pending na kita", pendingHint: "Kumpirmado at hinihintay maitala. Hindi pa magagastos o mawi-withdraw.", unknown: "—",
    frozenReward: "Naka-freeze na reward", estimated: "Tinatayang tagal", actual: "Aktuwal na runtime", seconds: "seg", batch: "Batch ng payout", tasks: "task", details: "Detalye ng task", close: "Isara", retry: "Subukan ulit", more: "Mag-load pa", empty: "Wala pang batch ng payout", loading: "Naglo-load…", unavailable: "Hindi ma-load ang detalye ng payout. Subukan ulit.", configVersion: "Bersyon ng configuration", receipt: "Resibo ng compute", window: "Window ng pagtatapos", postedAt: "Naitala noong",
    statuses: { CLAIMED: "Na-claim", QUEUED: "Nakapila", RUNNING: "Tumatakbo", VERIFYING: "Bine-verify", RECOVERING: "Nire-recover", PAUSED: "Naka-pause", COMPLETED: "Natapos", FAILED: "Nabigo", CANCELLED: "Kinansela", NONE: "Walang pending na kita", PENDING: "Hinihintay ang payout", POSTED: "Naitala", BLOCKED: "Naka-hold ang payout" },
  },
  ru: {
    accountBatchHint: "Включает доход всех устройств аккаунта.",
    stopNow: "Остановить сейчас (без награды за незавершённую задачу)", stopDescription: "{name}: идёт задача. Выберите, когда отключить.", stopping: "Останавливаем. Отключение завершится после подтверждения дохода.",
    taskReceipt: "Квитанция о задаче", emptyReceipts: "Квитанций о задачах пока нет", receiptsHint: "Квитанции появятся после завершения задач и зачисления дохода.", confirming: "Доход подтверждается", running: "В работе", duration: "Длительность", reward: "Награда за задачу",
    title: "Выплаты за вычисления", pending: "Ожидает зачисления", pendingHint: "Подтверждено и ждёт зачисления. Пока нельзя потратить или вывести.", unknown: "—",
    frozenReward: "Замороженная награда", estimated: "Расчётное время", actual: "Фактическое время", seconds: "с", batch: "Пакет выплат", tasks: "зад.", details: "Детали задачи", close: "Закрыть", retry: "Повторить", more: "Ещё", empty: "Пакетов выплат пока нет", loading: "Загрузка…", unavailable: "Не удалось загрузить выплаты. Повторите попытку.", configVersion: "Версия настроек", receipt: "Квитанция за вычисления", window: "Окно выполнения", postedAt: "Зачислено",
    statuses: { CLAIMED: "Получено", QUEUED: "В очереди", RUNNING: "В работе", VERIFYING: "Проверка", RECOVERING: "Восстановление", PAUSED: "На паузе", COMPLETED: "Выполнено", FAILED: "Ошибка", CANCELLED: "Отменено", NONE: "Нет дохода к зачислению", PENDING: "Ждёт выплаты", POSTED: "Зачислено", BLOCKED: "Выплата приостановлена" },
  },
  kk: {
    accountBatchHint: "Аккаунттағы барлық құрылғының табысы кіреді.",
    stopNow: "Қазір тоқтату (аяқталмаған тапсырмаға сыйақы жоқ)", stopDescription: "{name} құрылғысында тапсырма орындалуда. Тоқтату әдісін таңдаңыз.", stopping: "Тоқтатылуда. Тапсырма сыйақысы расталғаннан кейін құрылғының белсенділігі тоқтатылады.",
    taskReceipt: "Тапсырма түбіртегі", emptyReceipts: "Әзірге тапсырма түбіртегі жоқ", receiptsHint: "Тапсырмалар аяқталып, табыс түскеннен кейін түбіртектер осында шығады.", confirming: "Табыс расталуда", running: "Жұмыс істеуде", duration: "Тапсырма ұзақтығы", reward: "Тапсырма сыйақысы",
    title: "Есептеу төлемі", pending: "Күтудегі табыс", pendingHint: "Расталды, түсуін күтуде. Жұмсауға не шығаруға болмайды.", unknown: "—",
    frozenReward: "Бұғатталған сыйақы", estimated: "Болжамды ұзақтық", actual: "Нақты жұмыс уақыты", seconds: "сек", batch: "Төлем топтамасы", tasks: "тапсырма", details: "Тапсырма мәліметі", close: "Жабу", retry: "Қайталау", more: "Тағы жүктеу", empty: "Әзірге төлем топтамасы жоқ", loading: "Жүктелуде…", unavailable: "Төлемдерді оқу мүмкін болмады. Қайталап көріңіз.", configVersion: "Баптау нұсқасы", receipt: "Есептеу түбіртегі", window: "Аяқталу аралығы", postedAt: "Түскен уақыты",
    statuses: { CLAIMED: "Алынды", QUEUED: "Кезекте", RUNNING: "Орындалуда", VERIFYING: "Тексерілуде", RECOVERING: "Қалпына келуде", PAUSED: "Кідіртілді", COMPLETED: "Аяқталды", FAILED: "Сәтсіз", CANCELLED: "Бас тартылды", NONE: "Күтудегі табыс жоқ", PENDING: "Төлем күтілуде", POSTED: "Түсті", BLOCKED: "Төлем тоқтатылды" },
  },
  uz: {
    accountBatchHint: "Akkauntdagi barcha qurilmalar daromadini oʻz ichiga oladi.",
    stopNow: "Hozir toʻxtatish (tugallanmagan vazifa uchun mukofot yoʻq)", stopDescription: "{name} vazifa bajarmoqda. Qachon oʻchirishni tanlang.", stopping: "Toʻxtatilmoqda. Bajarilgan ish daromadi tasdiqlangach oʻchiriladi.",
    taskReceipt: "Vazifa cheki", emptyReceipts: "Hali vazifa cheklari yoʻq", receiptsHint: "Vazifalar bajarilib, daromad hisobga tushgach, cheklar shu yerda koʻrinadi.", confirming: "Daromad tasdiqlanmoqda", running: "Ishlamoqda", duration: "Vazifa davomiyligi", reward: "Vazifa mukofoti",
    title: "Quvvat toʻlovlari", pending: "Kutilayotgan daromad", pendingHint: "Tasdiqlangan, hisobga tushishi kutilmoqda. Sarflab yoki yechib boʻlmaydi.", unknown: "—",
    frozenReward: "Muzlatilgan mukofot", estimated: "Taxminiy davomiylik", actual: "Haqiqiy ishlash vaqti", seconds: "son.", batch: "Toʻlov partiyasi", tasks: "ta vazifa", details: "Vazifa tafsilotlari", close: "Yopish", retry: "Takrorlash", more: "Yana yuklash", empty: "Hali toʻlov partiyalari yoʻq", loading: "Yuklanmoqda…", unavailable: "Toʻlovlarni yuklab boʻlmadi. Qayta urining.", configVersion: "Sozlama versiyasi", receipt: "Hisoblash cheki", window: "Bajarish oraligʻi", postedAt: "Hisobga tushgan vaqt",
    statuses: { CLAIMED: "Olingan", QUEUED: "Navbatda", RUNNING: "Ishlamoqda", VERIFYING: "Tekshirilmoqda", RECOVERING: "Tiklanmoqda", PAUSED: "Toʻxtatilgan", COMPLETED: "Bajarildi", FAILED: "Bajarilmadi", CANCELLED: "Bekor qilindi", NONE: "Kutilayotgan daromad yoʻq", PENDING: "Toʻlov kutilmoqda", POSTED: "Hisobga tushdi", BLOCKED: "Toʻlov toʻxtatilgan" },
  },
};

export function useComputeV2Copy() {
  const locale = useLocaleStore();
  return computed(() => computeV2Copy[uiLocale(locale.code)]);
}
