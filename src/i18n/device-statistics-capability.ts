import { computed } from "vue";
import { useLocaleStore } from "@/store/locale";
import { uiLocale } from "@/i18n";

export const deviceStatisticsCapabilityCopy = {
  zh: {
    currentStatus: "当前状态",
    scope: "可查看今日收益、累计收益和最近完成的作业。尚不提供按日收益曲线及历史在线率。",
  },
  en: {
    currentStatus: "Current status",
    scope: "Today's earnings, total earnings and recent completed jobs are available. Daily earnings charts and historical online rates are not offered yet.",
  },
  vi: {
    currentStatus: "Trạng thái hiện tại",
    scope: "Có thể xem thu nhập hôm nay, tổng thu nhập và các tác vụ hoàn thành gần đây. Chưa có biểu đồ thu nhập theo ngày và tỷ lệ trực tuyến trong quá khứ.",
  },
  id: {
    currentStatus: "Status saat ini",
    scope: "Pendapatan hari ini, total pendapatan, dan tugas yang baru selesai tersedia. Grafik pendapatan harian dan riwayat uptime belum tersedia.",
  },
  ms: {
    currentStatus: "Status semasa",
    scope: "Pendapatan hari ini, jumlah pendapatan dan kerja yang baru selesai tersedia. Carta pendapatan harian dan sejarah kadar dalam talian belum ditawarkan.",
  },
  fil: {
    currentStatus: "Kasalukuyang status",
    scope: "Available ang kita ngayon, kabuuang kita at mga kamakailang natapos na job. Wala pang chart ng kita kada araw at history ng online rate.",
  },
  ru: {
    currentStatus: "Текущий статус",
    scope: "Доступны доход за сегодня, доход за всё время и недавно выполненные задачи. Графики дохода по дням и история доступности пока не предусмотрены.",
  },
  kk: {
    currentStatus: "Ағымдағы күй",
    scope: "Бүгінгі табыс, жалпы табыс және соңғы аяқталған жұмыстар қолжетімді. Күндік табыс графигі мен онлайн көрсеткішінің тарихы әзірге жоқ.",
  },
  uz: {
    currentStatus: "Joriy holat",
    scope: "Bugungi daromad, jami daromad va soʻnggi bajarilgan ishlarni koʻrish mumkin. Kunlik daromad grafiklari va onlayn vaqt ulushi tarixi hali mavjud emas.",
  },
};

export function useDeviceStatisticsCapabilityCopy() {
  const locale = useLocaleStore();
  return computed(() => deviceStatisticsCapabilityCopy[uiLocale(locale.code)]);
}
