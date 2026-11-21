import { uiLocale } from "@/i18n";
/** Copy for the bounded TI-F04/05/06/09/10 fixes. */
const COPY = {
  zh: {
    discardDraft: '放弃草稿', unknownConditions: '{n} 项条件待确认', unknownProgress: '当前进度待确认',
    posterYieldCap: '今日收益', eventAt: '发生时间', settledAt: '结算时间', expectedUnlockAt: '预计可用时间', dateUnavailable: '未提供',
  },
  en: {
    discardDraft: 'Discard draft', unknownConditions: '{n} requirements awaiting confirmation', unknownProgress: 'Current progress awaiting confirmation',
    posterYieldCap: "TODAY'S EARNINGS", eventAt: 'Occurred at', settledAt: 'Settled at', expectedUnlockAt: 'Expected availability', dateUnavailable: 'Not provided',
  },
  vi: {
    discardDraft: 'Bỏ bản nháp', unknownConditions: '{n} điều kiện chờ xác nhận', unknownProgress: 'Tiến độ hiện tại chờ xác nhận',
    posterYieldCap: 'THU NHẬP HÔM NAY', eventAt: 'Thời gian phát sinh', settledAt: 'Thời gian ghi nhận', expectedUnlockAt: 'Dự kiến khả dụng', dateUnavailable: 'Chưa cung cấp',
  },
  id: {
    discardDraft: 'Buang draf', unknownConditions: '{n} syarat menunggu konfirmasi', unknownProgress: 'Progres saat ini menunggu konfirmasi',
    posterYieldCap: "PENDAPATAN HARI INI", eventAt: 'Waktu kejadian', settledAt: 'Dibayarkan pada', expectedUnlockAt: 'Est. waktu tersedia', dateUnavailable: 'Tidak tersedia',
  },
  ms: {
    discardDraft: 'Buang draf', unknownConditions: '{n} syarat menunggu pengesahan', unknownProgress: 'Kemajuan semasa menunggu pengesahan',
    posterYieldCap: "PENDAPATAN HARI INI", eventAt: 'Berlaku pada', settledAt: 'Dibayar pada', expectedUnlockAt: 'Dijangka tersedia', dateUnavailable: 'Tidak diberikan',
  },
  fil: {
    discardDraft: 'Itapon ang draft', unknownConditions: '{n} requirement ang hinihintay makumpirma', unknownProgress: 'Hinihintay makumpirma ang progreso',
    posterYieldCap: "KITA NGAYON", eventAt: 'Nangyari noong', settledAt: 'Naibigay noong', expectedUnlockAt: 'Inaasahang availability', dateUnavailable: 'Walang petsa',
  },
  ru: {
    discardDraft: 'Удалить черновик', unknownConditions: 'Условий без подтверждения: {n}', unknownProgress: 'Прогресс ждёт подтверждения',
    posterYieldCap: "ДОХОД ЗА СЕГОДНЯ", eventAt: 'Время события', settledAt: 'Выплачено', expectedUnlockAt: 'Ориентировочно доступно', dateUnavailable: 'Нет данных',
  },
  kk: {
    discardDraft: 'Нобайды жою', unknownConditions: 'Расталуды күтетін талаптар: {n}', unknownProgress: 'Ағымдағы барыс расталуда',
    posterYieldCap: "БҮГІНГІ ТАБЫС", eventAt: 'Болған уақыты', settledAt: 'Төленген уақыты', expectedUnlockAt: 'Болжамды қолжетімді уақыты', dateUnavailable: 'Көрсетілмеген',
  },
  uz: {
    discardDraft: 'Qoralamani oʻchirish', unknownConditions: '{n} ta shart hali tasdiqlanmagan', unknownProgress: 'Bajarilish holati hali tasdiqlanmagan',
    posterYieldCap: "BUGUNGI DAROMAD", eventAt: 'Sodir boʻlgan vaqt', settledAt: 'Toʻlangan vaqt', expectedUnlockAt: 'Taxminiy ochilish vaqti', dateUnavailable: 'Koʻrsatilmagan',
  },
};
export function teamLogicCopy(locale: string) {
  return COPY[uiLocale(locale.split('-')[0])];
}
