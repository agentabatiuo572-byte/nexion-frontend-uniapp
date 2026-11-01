import { computed } from "vue";
import { useLocaleStore } from "@/store/locale";

export const computeV2Copy = {
  zh: {
    title: "算力结算", pending: "待结算收益", pendingHint: "已确认待入账，暂不可提现或消费。", unknown: "—",
    frozenReward: "冻结奖励", estimated: "预计时长", actual: "实际运行时长", seconds: "秒", batch: "结算批次", tasks: "任务", details: "任务详情", close: "关闭", retry: "重试", more: "加载更多", empty: "暂无结算批次", loading: "正在读取…", unavailable: "结算数据读取失败，请重试", configVersion: "配置版本", receipt: "计算凭证", window: "完成窗口", postedAt: "入账时间",
    statuses: { CLAIMED: "已领取", QUEUED: "排队中", RUNNING: "计算中", VERIFYING: "校验中", RECOVERING: "恢复中", PAUSED: "已暂停", COMPLETED: "已完成", FAILED: "执行失败", CANCELLED: "已取消", NONE: "无待结算收益", PENDING: "待结算", POSTED: "已入账", BLOCKED: "结算挂起" },
  },
  en: {
    title: "Compute settlement", pending: "Pending earnings", pendingHint: "Confirmed and awaiting posting. Unavailable for spending or withdrawal.", unknown: "—",
    frozenReward: "Frozen reward", estimated: "Estimated duration", actual: "Actual runtime", seconds: "sec", batch: "Settlement batch", tasks: "tasks", details: "Task details", close: "Close", retry: "Retry", more: "Load more", empty: "No settlement batches yet", loading: "Loading…", unavailable: "Unable to read settlements. Please retry.", configVersion: "Configuration version", receipt: "Compute receipt", window: "Completion window", postedAt: "Posted at",
    statuses: { CLAIMED: "Claimed", QUEUED: "Queued", RUNNING: "Running", VERIFYING: "Verifying", RECOVERING: "Recovering", PAUSED: "Paused", COMPLETED: "Completed", FAILED: "Failed", CANCELLED: "Cancelled", NONE: "No pending earnings", PENDING: "Pending settlement", POSTED: "Posted", BLOCKED: "Settlement blocked" },
  },
  vi: {
    title: "Quyết toán tính toán", pending: "Thu nhập chờ quyết toán", pendingHint: "Đã xác nhận, đang chờ ghi có. Chưa thể rút hoặc chi tiêu.", unknown: "—",
    frozenReward: "Phần thưởng đã chốt", estimated: "Thời lượng dự kiến", actual: "Thời gian chạy thực tế", seconds: "giây", batch: "Lô quyết toán", tasks: "tác vụ", details: "Chi tiết tác vụ", close: "Đóng", retry: "Thử lại", more: "Tải thêm", empty: "Chưa có lô quyết toán", loading: "Đang tải…", unavailable: "Không thể đọc quyết toán. Vui lòng thử lại.", configVersion: "Phiên bản cấu hình", receipt: "Biên nhận tính toán", window: "Khoảng hoàn thành", postedAt: "Thời điểm ghi có",
    statuses: { CLAIMED: "Đã nhận", QUEUED: "Đang chờ", RUNNING: "Đang chạy", VERIFYING: "Đang xác minh", RECOVERING: "Đang khôi phục", PAUSED: "Tạm dừng", COMPLETED: "Hoàn thành", FAILED: "Thất bại", CANCELLED: "Đã hủy", NONE: "Không có thu nhập chờ quyết toán", PENDING: "Chờ quyết toán", POSTED: "Đã ghi có", BLOCKED: "Tạm giữ quyết toán" },
  },
};

export function useComputeV2Copy() {
  const locale = useLocaleStore();
  return computed(() => computeV2Copy[locale.code === "zh" || locale.code === "vi" ? locale.code : "en"]);
}
