import { formatDateParts, formatDayMonth, formatDisplayDateTime } from "./display-date";

const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
// CLDR 48 month and weekday names (Intl in Node 24), stored because native Android can
// ignore Intl. Both start a label here, so they are capitalised.
const CLDR_NAMES: Record<string, { monthYear: string; months: string[]; weekdays: string[] }> = {
  id: { monthYear: "{month} {year}", months: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"], weekdays: ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] },
  ms: { monthYear: "{month} {year}", months: ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"], weekdays: ["Ahd", "Isn", "Sel", "Rab", "Kha", "Jum", "Sab"] },
  fil: { monthYear: "{month} {year}", months: ["Enero", "Pebrero", "Marso", "Abril", "Mayo", "Hunyo", "Hulyo", "Agosto", "Setyembre", "Oktubre", "Nobyembre", "Disyembre"], weekdays: ["Lin", "Lun", "Mar", "Miy", "Huw", "Biy", "Sab"] },
  ru: { monthYear: "{month} {year} г.", months: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"], weekdays: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] },
  kk: { monthYear: "{year} ж. {month}", months: ["Қаңтар", "Ақпан", "Наурыз", "Сәуір", "Мамыр", "Маусым", "Шілде", "Тамыз", "Қыркүйек", "Қазан", "Қараша", "Желтоқсан"], weekdays: ["Жс", "Дс", "Сс", "Ср", "Бс", "Жм", "Сб"] },
  uz: { monthYear: "{month}, {year}", months: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"], weekdays: ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"] },
};
const cldrNames = (locale: string) => CLDR_NAMES[locale.split("-")[0]];

// Native Android can ignore toLocaleString's locale and options, returning Date.toString().
// Use local calendar fields so the group and row remain consistent with the device time zone.
export function walletBillMonthKey(ts: number): string {
  if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0) return "invalid";
  const date = new Date(ts);
  return Number.isNaN(date.getTime()) ? "invalid" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function walletBillMonthLabel(ts: number, locale: string): string {
  if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0) return "—";
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "—";
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (locale.startsWith("vi")) return `tháng ${month} năm ${year}`;
  if (locale.startsWith("zh")) return `${year}/${String(month).padStart(2, "0")}`;
  const names = cldrNames(locale);
  if (names) return names.monthYear.replace("{month}", names.months[month - 1]).replace("{year}", String(year));
  return `${EN_MONTHS[month - 1]} ${year}`;
}

export function walletBillTimeLabel(ts: number, locale: string): string {
  return typeof ts === "number" ? formatDisplayDateTime(ts, locale) : "—";
}

// Day groups use the same local calendar fields as the month key.
export function walletBillDayKey(ts: number): string {
  if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0) return "invalid";
  const date = new Date(ts);
  return Number.isNaN(date.getTime()) ? "invalid"
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const EN_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ZH_WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const VI_WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const EN_SHORT_MONTHS = EN_MONTHS.map(month => month.slice(0, 3));

/** "今天 · 10月30日", "Yesterday · Oct 29", "Thứ Hai · 27/10"; another year adds the year. */
export function walletBillDayLabel(ts: number, locale: string, now: number, words: { today: string; yesterday: string }): string {
  if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0) return "—";
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "—";
  const key = walletBillDayKey(ts);
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const relative = key === walletBillDayKey(now) ? words.today : key === walletBillDayKey(yesterday.getTime()) ? words.yesterday : "";
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  const month = date.getMonth() + 1, day = date.getDate(), names = cldrNames(locale);
  if (names) {
    const dayText = sameYear ? formatDayMonth(month, day, locale, true) : formatDateParts(date.getFullYear(), month, day, locale);
    return `${relative || names.weekdays[date.getDay()]} · ${dayText}`;
  }
  const dayText = locale.startsWith("zh") ? `${sameYear ? "" : `${date.getFullYear()}年`}${month}月${day}日`
    : locale.startsWith("vi") ? `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}${sameYear ? "" : `/${date.getFullYear()}`}`
      : `${EN_SHORT_MONTHS[month - 1]} ${day}${sameYear ? "" : `, ${date.getFullYear()}`}`;
  const weekday = (locale.startsWith("zh") ? ZH_WEEKDAYS : locale.startsWith("vi") ? VI_WEEKDAYS : EN_WEEKDAYS)[date.getDay()];
  return relative ? `${relative} · ${dayText}` : locale.startsWith("zh") ? `${dayText} · ${weekday}` : `${weekday} · ${dayText}`;
}

/** Local 24-hour clock for rows inside a day group. */
export function walletBillClockLabel(ts: number): string {
  if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0) return "—";
  const date = new Date(ts);
  return Number.isNaN(date.getTime()) ? "—" : `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Short row time: today "08:15", yesterday's word, otherwise "10/30 08:15" (vi "30/10 08:15"). */
export function walletBillShortTime(ts: number, locale: string, now: number, yesterday: string): string {
  const clock = walletBillClockLabel(ts);
  if (clock === "—") return clock;
  const key = walletBillDayKey(ts), previous = new Date(now); previous.setDate(previous.getDate() - 1);
  if (key === walletBillDayKey(now)) return clock;
  if (key === walletBillDayKey(previous.getTime())) return yesterday;
  const date = new Date(ts), day = date.getDate(), month = date.getMonth() + 1;
  return `${formatDayMonth(month, day, locale)} ${clock}`;
}
