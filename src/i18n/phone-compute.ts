import { computed } from "vue";
import { useLocaleStore } from "@/store/locale";

const copy = {
  zh: {
    title: "手机本机计算", loading: "正在核对派单条件…", unavailable: "派单条件读取失败，请重试。", retry: "重试",
    ready: "可以接收适配的本机任务。", missing: "未找到这部手机的派单条件。", web: "网页版仅查看状态，不能在本机执行手机任务。",
    engine: "本机计算状态", retryEngine: "重试准备", engineFailure: "本机计算暂不可用，请重试。",
    states: { unsupported: "此平台暂不支持本机计算", paused: "已暂停", loading: "正在准备本机模型…", ready: "本机模型已就绪", waiting: "任务服务暂不可用，等待重连", running: "正在本机计算", verifying: "计算结束，等待服务端校验", recovering: "正在恢复任务状态", error: "本机计算暂不可用" },
    blockers: {
      PHONE_DEVICE_INACTIVE: "手机尚未激活，或已停止接单。", PHONE_BINDING_REQUIRED: "尚未绑定手机安装实例。",
      PHONE_CALIBRATION_REQUIRED: "需要完成手机校准并激活。", PHONE_EXECUTION_SESSION_REQUIRED: "请在已绑定手机的 App 中登录并保持前台运行。",
      PHONE_TELEMETRY_STALE: "未收到有效运行心跳，请在已绑定手机中打开 App。", PHONE_OFFLINE: "手机联网状态未满足接单条件。",
      PHONE_LOW_BATTERY: "手机电量需达到 20%，且能够读取。", PHONE_DEVICE_PAUSED: "手机接单已暂停。",
      PHONE_EXECUTOR_UNAVAILABLE: "本机计算引擎尚未就绪。请在已绑定的 Android 手机中打开 App 并保持前台；首次准备模型需要一些时间。",
    },
  },
  en: {
    title: "On-phone compute", loading: "Checking task eligibility…", unavailable: "Unable to read task eligibility. Please retry.", retry: "Retry",
    ready: "Ready for compatible on-phone tasks.", missing: "Task eligibility for this phone was not found.", web: "The web app can display status but cannot execute on-phone tasks.",
    engine: "Local compute status", retryEngine: "Retry setup", engineFailure: "Local compute is unavailable. Please retry.",
    states: { unsupported: "Local compute is not supported on this platform", paused: "Paused", loading: "Preparing the local model…", ready: "Local model ready", waiting: "Task service unavailable; reconnecting", running: "Computing on this phone", verifying: "Computed; awaiting server verification", recovering: "Recovering task state", error: "Local compute unavailable" },
    blockers: {
      PHONE_DEVICE_INACTIVE: "The phone is not active or has stopped accepting tasks.", PHONE_BINDING_REQUIRED: "A phone installation must be bound first.",
      PHONE_CALIBRATION_REQUIRED: "Complete phone calibration and activation.", PHONE_EXECUTION_SESSION_REQUIRED: "Sign in to the App on the bound phone and keep it in the foreground.",
      PHONE_TELEMETRY_STALE: "No valid runtime heartbeat. Open the App on the bound phone.", PHONE_OFFLINE: "The phone's network status does not qualify for tasks.",
      PHONE_LOW_BATTERY: "Battery must be readable and at least 20%.", PHONE_DEVICE_PAUSED: "Task pickup is paused for this phone.",
      PHONE_EXECUTOR_UNAVAILABLE: "The local engine is not ready. Open the App on the bound Android phone and keep it in the foreground. Initial model setup can take a little time.",
    },
  },
  vi: {
    title: "Tính toán trên điện thoại", loading: "Đang kiểm tra điều kiện nhận việc…", unavailable: "Không thể đọc điều kiện nhận việc. Hãy thử lại.", retry: "Thử lại",
    ready: "Sẵn sàng nhận tác vụ phù hợp trên điện thoại.", missing: "Không tìm thấy điều kiện nhận việc của điện thoại này.", web: "Bản web chỉ hiển thị trạng thái, không thể chạy tác vụ trên điện thoại.",
    engine: "Trạng thái tính toán cục bộ", retryEngine: "Chuẩn bị lại", engineFailure: "Chưa thể tính toán cục bộ. Hãy thử lại.",
    states: { unsupported: "Nền tảng này chưa hỗ trợ tính toán cục bộ", paused: "Tạm dừng", loading: "Đang chuẩn bị mô hình cục bộ…", ready: "Mô hình cục bộ đã sẵn sàng", waiting: "Dịch vụ tác vụ chưa khả dụng; đang kết nối lại", running: "Đang tính toán trên điện thoại này", verifying: "Đã tính xong; chờ máy chủ xác minh", recovering: "Đang khôi phục trạng thái tác vụ", error: "Chưa thể tính toán cục bộ" },
    blockers: {
      PHONE_DEVICE_INACTIVE: "Điện thoại chưa kích hoạt hoặc đã ngừng nhận việc.", PHONE_BINDING_REQUIRED: "Cần liên kết bản cài đặt trên điện thoại.",
      PHONE_CALIBRATION_REQUIRED: "Hoàn tất hiệu chuẩn và kích hoạt điện thoại.", PHONE_EXECUTION_SESSION_REQUIRED: "Đăng nhập App trên điện thoại đã liên kết và giữ App ở phía trước.",
      PHONE_TELEMETRY_STALE: "Chưa có tín hiệu hoạt động hợp lệ. Mở App trên điện thoại đã liên kết.", PHONE_OFFLINE: "Trạng thái mạng của điện thoại chưa đủ điều kiện nhận việc.",
      PHONE_LOW_BATTERY: "Cần đọc được mức pin và pin phải đạt ít nhất 20%.", PHONE_DEVICE_PAUSED: "Điện thoại đang tạm dừng nhận việc.",
      PHONE_EXECUTOR_UNAVAILABLE: "Bộ máy cục bộ chưa sẵn sàng. Mở App trên điện thoại Android đã liên kết và giữ App ở phía trước. Lần đầu chuẩn bị mô hình có thể cần thêm thời gian.",
    },
  },
};

export function usePhoneComputeCopy() {
  const locale = useLocaleStore();
  return computed(() => copy[locale.code === "zh" || locale.code === "vi" ? locale.code : "en"]);
}
