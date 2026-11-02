import { computed } from "vue";
import { useLocaleStore } from "@/store/locale";

export const computeV2Copy = {
  zh: {
    accountBatchHint: "批次总额按账号统计，Lite 不显示手机任务。",
    historyHint: "最近 {n} 笔，点击查看任务与结算详情。",
    ruleCycle: "按规则结算，未执行模型",
    stopNow: "立即停止（未完成任务不发收益）", stopDescription: "{name} 有进行中的任务，请选择停用方式。", stopping: "正在停止，任务收益确认后将完成停用。",
    taskReceipt: "任务凭证", emptyReceipts: "暂无任务凭证", receiptsHint: "任务完成并入账后，可在这里查看凭证。", confirming: "收益确认中", running: "运行中", duration: "任务时长", reward: "本次收益",
    title: "算力结算", pending: "待结算收益", pendingHint: "已确认待入账，暂不可提现或消费。", unknown: "—",
    frozenReward: "冻结奖励", estimated: "预计时长", actual: "实际运行时长", seconds: "秒", batch: "结算批次", tasks: "任务", details: "任务详情", close: "关闭", retry: "重试", more: "加载更多", empty: "暂无结算批次", loading: "正在读取…", unavailable: "结算数据读取失败，请重试", configVersion: "配置版本", receipt: "计算凭证", window: "完成窗口", postedAt: "入账时间",
    statuses: { CLAIMED: "已领取", QUEUED: "排队中", RUNNING: "计算中", VERIFYING: "校验中", RECOVERING: "恢复中", PAUSED: "已暂停", COMPLETED: "已完成", FAILED: "执行失败", CANCELLED: "已取消", NONE: "无待结算收益", PENDING: "待结算", POSTED: "已入账", BLOCKED: "结算挂起" },
  },
  en: {
    accountBatchHint: "Batch totals cover the account. Lite hides phone tasks.",
    historyHint: "Latest {n} tasks. Select one for task and settlement details.",
    ruleCycle: "Rule-based settlement; no model execution",
    stopNow: "Stop now (no reward for the unfinished task)", stopDescription: "{name} has a task in progress. Choose when to deactivate.", stopping: "Stopping. Deactivation follows confirmation of completed earnings.",
    taskReceipt: "Task receipt", emptyReceipts: "No task receipts yet", receiptsHint: "Receipts appear after tasks complete and earnings are posted.", confirming: "Confirming earnings", running: "Running", duration: "Task duration", reward: "Task reward",
    title: "Compute settlement", pending: "Pending earnings", pendingHint: "Confirmed and awaiting posting. Unavailable for spending or withdrawal.", unknown: "—",
    frozenReward: "Frozen reward", estimated: "Estimated duration", actual: "Actual runtime", seconds: "sec", batch: "Settlement batch", tasks: "tasks", details: "Task details", close: "Close", retry: "Retry", more: "Load more", empty: "No settlement batches yet", loading: "Loading…", unavailable: "Unable to read settlements. Please retry.", configVersion: "Configuration version", receipt: "Compute receipt", window: "Completion window", postedAt: "Posted at",
    statuses: { CLAIMED: "Claimed", QUEUED: "Queued", RUNNING: "Running", VERIFYING: "Verifying", RECOVERING: "Recovering", PAUSED: "Paused", COMPLETED: "Completed", FAILED: "Failed", CANCELLED: "Cancelled", NONE: "No pending earnings", PENDING: "Pending settlement", POSTED: "Posted", BLOCKED: "Settlement blocked" },
  },
  vi: {
    accountBatchHint: "Tổng lô tính cho cả tài khoản. Lite ẩn tác vụ điện thoại.",
    historyHint: "{n} tác vụ gần nhất. Chọn để xem chi tiết và quyết toán.",
    ruleCycle: "Quyết toán theo quy tắc, không chạy mô hình",
    stopNow: "Dừng ngay (tác vụ chưa xong không nhận thưởng)", stopDescription: "{name} đang có tác vụ. Chọn thời điểm ngừng kích hoạt.", stopping: "Đang dừng. Thiết bị sẽ ngừng kích hoạt sau khi xác nhận thu nhập đã hoàn thành.",
    taskReceipt: "Biên nhận tác vụ", emptyReceipts: "Chưa có biên nhận tác vụ", receiptsHint: "Biên nhận xuất hiện sau khi tác vụ hoàn thành và thu nhập được ghi có.", confirming: "Đang xác nhận thu nhập", running: "Đang chạy", duration: "Thời lượng tác vụ", reward: "Thu nhập tác vụ",
    title: "Quyết toán tính toán", pending: "Thu nhập chờ quyết toán", pendingHint: "Đã xác nhận, đang chờ ghi có. Chưa thể rút hoặc chi tiêu.", unknown: "—",
    frozenReward: "Phần thưởng đã chốt", estimated: "Thời lượng dự kiến", actual: "Thời gian chạy thực tế", seconds: "giây", batch: "Lô quyết toán", tasks: "tác vụ", details: "Chi tiết tác vụ", close: "Đóng", retry: "Thử lại", more: "Tải thêm", empty: "Chưa có lô quyết toán", loading: "Đang tải…", unavailable: "Không thể đọc quyết toán. Vui lòng thử lại.", configVersion: "Phiên bản cấu hình", receipt: "Biên nhận tính toán", window: "Khoảng hoàn thành", postedAt: "Thời điểm ghi có",
    statuses: { CLAIMED: "Đã nhận", QUEUED: "Đang chờ", RUNNING: "Đang chạy", VERIFYING: "Đang xác minh", RECOVERING: "Đang khôi phục", PAUSED: "Tạm dừng", COMPLETED: "Hoàn thành", FAILED: "Thất bại", CANCELLED: "Đã hủy", NONE: "Không có thu nhập chờ quyết toán", PENDING: "Chờ quyết toán", POSTED: "Đã ghi có", BLOCKED: "Tạm giữ quyết toán" },
  },
};

export function useComputeV2Copy() {
  const locale = useLocaleStore();
  return computed(() => computeV2Copy[locale.code === "zh" || locale.code === "vi" ? locale.code : "en"]);
}
