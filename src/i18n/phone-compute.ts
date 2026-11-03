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
    title: "Phone tasks", loading: "Loading task status…", unavailable: "Unable to update task status. Showing the last record.", restoring: "Restoring task status…",
    running: "Running", waiting: "No current task", missing: "Task status for this phone was not found.",
    web: "The web app is read-only. Open the App online on the bound phone to resume.",
    validUntil: "Active until", expired: "Paused. Open the App online on the bound phone to resume.",
  },
  ms: {
    title: "Phone tasks", loading: "Loading task status…", unavailable: "Unable to update task status. Showing the last record.", restoring: "Restoring task status…",
    running: "Running", waiting: "No current task", missing: "Task status for this phone was not found.",
    web: "The web app is read-only. Open the App online on the bound phone to resume.",
    validUntil: "Active until", expired: "Paused. Open the App online on the bound phone to resume.",
  },
  fil: {
    title: "Phone tasks", loading: "Loading task status…", unavailable: "Unable to update task status. Showing the last record.", restoring: "Restoring task status…",
    running: "Running", waiting: "No current task", missing: "Task status for this phone was not found.",
    web: "The web app is read-only. Open the App online on the bound phone to resume.",
    validUntil: "Active until", expired: "Paused. Open the App online on the bound phone to resume.",
  },
  ru: {
    title: "Phone tasks", loading: "Loading task status…", unavailable: "Unable to update task status. Showing the last record.", restoring: "Restoring task status…",
    running: "Running", waiting: "No current task", missing: "Task status for this phone was not found.",
    web: "The web app is read-only. Open the App online on the bound phone to resume.",
    validUntil: "Active until", expired: "Paused. Open the App online on the bound phone to resume.",
  },
  kk: {
    title: "Phone tasks", loading: "Loading task status…", unavailable: "Unable to update task status. Showing the last record.", restoring: "Restoring task status…",
    running: "Running", waiting: "No current task", missing: "Task status for this phone was not found.",
    web: "The web app is read-only. Open the App online on the bound phone to resume.",
    validUntil: "Active until", expired: "Paused. Open the App online on the bound phone to resume.",
  },
  uz: {
    title: "Phone tasks", loading: "Loading task status…", unavailable: "Unable to update task status. Showing the last record.", restoring: "Restoring task status…",
    running: "Running", waiting: "No current task", missing: "Task status for this phone was not found.",
    web: "The web app is read-only. Open the App online on the bound phone to resume.",
    validUntil: "Active until", expired: "Paused. Open the App online on the bound phone to resume.",
  },
};

export function usePhoneComputeCopy() {
  const locale = useLocaleStore();
  return computed(() => copy[uiLocale(locale.code)]);
}
