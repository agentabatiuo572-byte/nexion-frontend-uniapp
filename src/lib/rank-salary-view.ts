// 我的等级 · 月薪卡与领取的界面状态（team-rank DESIGN 2.1、2.6、第 6 节，画板 C、D 组）。
// 只做显示映射：服务端 salary（6.1）＋领取过程的阶段 → 卡片、底部和确认框要显示什么。
import { fmt } from "@/i18n/format";
import { uiLocale } from "@/i18n";
import { formatHowNumber } from "@/lib/rank-how-content";
import type { RankSalary, RankSalaryAttempt, RankSalaryMonth } from "@/api/v-rank-api";
import { businessDayKey } from "@/lib/business-calendar";

export type { RankSalary, RankSalaryMonth } from "@/api/v-rank-api";
/** 领取过程（6.3、6.4）：claiming 请求中（D5）；confirming 结果未知、PROCESSING 或回执读不到（D6）；resend 回执 NOT_FOUND（D6，给重新提交入口）。 */
export type SalaryClaimPhase = "idle" | "claiming" | "confirming" | "resend";

type Copy = Record<string, string>;
export type SalaryTag = { label: string; tone: "brand" | "warning" | "neutral"; busy?: boolean };
export type SalaryTip = { tone: "neutral" | "warning"; lines: string[] };
export type SalaryCardView = {
  tag: SalaryTag | null;
  caption: string; // 「11 月 · V3」；读取失败时为空
  amount: string; // 「50」「—」「••••」
  tip: SalaryTip | null;
  note: string; // 底注；空则不画
  resend: boolean; // 底注位换成警示色原因「上次领取未送达」
  statusKey: string; // 状态变化时卡片主体交叉淡入（10.1 领取）
};
export type SalaryDock =
  | { kind: "claim"; label: string; month: string; amountUsdt: string }
  | { kind: "tray"; copy: string; button: string }
  | { kind: "busy"; label: string }
  | { kind: "status"; label: string }
  | { kind: "resend"; label: string };
export type SalaryDialog = { title: string; body: string; primary: string; secondary: string };

const DAY = 86400000;
const toUtc = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10) || 1), 12);
const shiftDate = (date: string, days: number) => new Date(toUtc(date) + days * DAY).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / DAY);
export const salaryDay = (instant: string) => businessDayKey("GROWTH_TEAM", Date.parse(instant));

/** The API accepts up to 12 whole and 6 fractional digits. Compare those digits directly. */
export function compareSalaryAmounts(left: string, right: string): number {
  const fixed = (amount: string) => {
    const [whole, fraction = ""] = amount.split(".");
    return whole.padStart(12, "0") + fraction.padEnd(6, "0");
  };
  const a = fixed(left), b = fixed(right);
  return a === b ? 0 : a > b ? 1 : -1;
}
const LOWER = new Set(["vi", "ru", "kk", "uz"]);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Own month names: WebView ICU data has no kk or uz (it prints "M11") and native UniApp can omit Intl. Wording follows the
// approved board (DESIGN 11.1 #11): lowercase in vi, ru, kk, uz, capitalised when a sentence starts.
const MONTH_NAMES: Record<string, readonly string[]> = {
  vi: ["tháng 1", "tháng 2", "tháng 3", "tháng 4", "tháng 5", "tháng 6", "tháng 7", "tháng 8", "tháng 9", "tháng 10", "tháng 11", "tháng 12"],
  ru: ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"],
  kk: ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"],
  uz: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"],
  id: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
  ms: ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"],
  fil: ["Enero", "Pebrero", "Marso", "Abril", "Mayo", "Hunyo", "Hulyo", "Agosto", "Setyembre", "Oktubre", "Nobyembre", "Disyembre"],
};
// Russian dates take the genitive («30 ноября»); the others use the name above.
const RU_GENITIVE = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

/** 月份和日期的写法同画板（DESIGN 11.1 第 11 条）：vi、ru、kk、uz 小写传入，整句渲染后再把首字母大写。 */
export function salaryDates(localeCode: string) {
  const lang = uiLocale(localeCode);
  const m = (date: string) => Number(date.slice(5, 7));
  const d = (date: string) => Number(date.slice(8, 10));
  const name = (date: string) => MONTH_NAMES[lang]?.[m(date) - 1] ?? MON[m(date) - 1];
  // A no-break space keeps the number and its month on one line when a tray or a note wraps.
  const day = (date: string) => lang === "ru" ? `${d(date)}\u00A0${RU_GENITIVE[m(date) - 1]}` : lang === "uz" ? `${d(date)}-${name(date)}`
    : lang === "fil" ? `${name(date)}\u00A0${d(date)}` : `${d(date)}\u00A0${name(date)}`;
  return {
    /** 「11 月」「Nov」「ноябрь」 */
    month: (date: string) => lang === "zh" ? `${m(date)}\u00A0月` : lang === "en" ? MON[m(date) - 1] : name(date),
    /** 「11 月 30 日」「Nov 30」「30 ноября」「30-noyabr」 */
    day: (date: string) => lang === "zh" ? `${m(date)}\u00A0月\u00A0${d(date)}\u00A0日` : lang === "en" ? `${MON[m(date) - 1]}\u00A0${d(date)}` : day(date),
    /** carryNote 的「November’s」，其他语言同 month */
    monthWord: (date: string) => lang === "zh" ? `${m(date)}\u00A0月` : lang === "en" ? `${MONL[m(date) - 1]}’s` : name(date),
    sentence: (text: string) => LOWER.has(lang) ? text.charAt(0).toUpperCase() + text.slice(1) : text,
  };
}

/** 窗口结束（不含）的前一天，即最后可领的那天。 */
export const lastClaimDay = (expiresAt: string) => shiftDate(salaryDay(expiresAt), -1);

/** The month's window can outlast the amount currently open for that month. A lower next amount ends the current one early;
 *  a higher one (晋升当天, D4) keeps the month's window, except that at month end (D4c) the deadline is the last day of that month. */
export function salaryAmountExpiresAt(salary: RankSalary, item: RankSalaryMonth): string {
  const next = salary.upcoming;
  if (item.status !== "CLAIMABLE" || next?.month !== item.month || Date.parse(next.claimableFrom) >= Date.parse(item.expiresAt)) return item.expiresAt;
  const change = compareSalaryAmounts(next.amountUsdt, item.amountUsdt);
  return change < 0 || (change > 0 && salaryDay(next.claimableFrom).slice(0, 7) !== item.month) ? next.claimableFrom : item.expiresAt;
}

const STATUS_ORDER = { CLAIMABLE: 0, PENDING: 1, CLAIMED: 2 };
export function displayedSalaryMonth(salary: RankSalary | null | undefined) {
  if (!salary) return undefined;
  return salary.months.reduce<RankSalaryMonth | undefined>((first, month) => {
    if (salary.businessDate >= salaryDay(month.expiresAt)
      || (month.status === "CLAIMABLE" && salary.businessDate < salaryDay(month.claimableFrom))) return first;
    if (!first) return month;
    const order = STATUS_ORDER[month.status] - STATUS_ORDER[first.status]
      || Date.parse(month.expiresAt) - Date.parse(first.expiresAt)
      || month.month.localeCompare(first.month);
    return order < 0 ? month : first;
  }, undefined);
}

/** 卡片优先显示未领且最先到期的月份；另一项只给 D4e 的底注用。 */
export function salaryView(input: {
  salary: RankSalary | null | undefined; // null：读取失败（D9）
  qualificationUnavailable?: boolean;
  pending?: RankSalaryAttempt | null;
  phase: SalaryClaimPhase;
  hidden: boolean;
  locale: string;
  copy: Copy;
  mask: (value: string) => string;
}): { card: SalaryCardView | null; dock: SalaryDock | null; promo: { end: boolean; month: string; date: string; now: string; next: string; rank: string } | null } {
  const { pending, phase, hidden, copy } = input;
  // Keep D5/D6 tied to the requested month during readback, even across a new business day.
  const salary = pending ? { businessDate: pending.businessDate, months: [pending.item], upcoming: null, nextClaimableFrom: null } : input.salary;
  const d = salaryDates(input.locale);
  const num = (value: string) => formatHowNumber(value, input.locale);
  const usdt = (value: string) => hidden ? "••••" : `${num(value)}\u00A0USDT`;
  const say = (template: string, params: Record<string, string | number>) => d.sentence(fmt(template, params));
  const item = displayedSalaryMonth(salary);
  const staleQualification = phase === "idle" && input.qualificationUnavailable && item && item.status !== "CLAIMED";
  if (salary === null || staleQualification) return { card: { tag: null, caption: "", amount: hidden ? "••••" : "—", tip: null, note: "", resend: false, statusKey: "unknown" }, dock: null, promo: null };
  if (!salary || !item) return { card: null, dock: null, promo: null };
  const other = salary.months.find(month => month.month !== item.month && month.status !== "CLAIMED");
  const caption = hidden ? input.mask("") : say(copy.monthRank, { m: d.month(item.month), r: item.rankCode });
  const expiresAt = pending?.amountExpiresAt ?? salaryAmountExpiresAt(salary, item);
  const lastDay = lastClaimDay(expiresAt);
  const expiresOn = salaryDay(expiresAt);
  const next = salary.upcoming?.month === item.month ? salary.upcoming : null;
  // 金额会降或变 0 时才提示今天截止；晋升当天金额会升，提示由托盘和气泡讲（DESIGN D4、D4c）。
  const amountEndsToday = item.status === "CLAIMABLE" && !!next && compareSalaryAmounts(next.amountUsdt, item.amountUsdt) < 0 && lastDay === salary.businessDate;
  // 下一档更低但还有金额：今天只是这笔金额的最后一天，不是整月作废。
  const dropsTo = amountEndsToday && Number(next!.amountUsdt) > 0 ? next!.amountUsdt : null;
  const claimBy = say(copy.claimBy, { d: d.day(lastDay) });
  const amount = hidden ? "••••" : num(item.amountUsdt);
  const businessMonth = salary.businessDate.slice(0, 7);
  const card: SalaryCardView = { tag: null, caption, amount, tip: null, note: "", resend: false, statusKey: item.status };
  let dock: SalaryDock | null = null;
  let promo: ReturnType<typeof salaryView>["promo"] = null;

  if (item.status === "PENDING") {
    const opensOn = salaryDay(item.claimableFrom);
    const end = opensOn.slice(0, 7) !== item.month; // 当月最后一天首次到达：只有下月 1 日可领（D1b）
    card.tag = end ? { label: say(copy.pendingEndTag, { d: d.day(opensOn) }), tone: "warning" } : { label: copy.pendingTag, tone: "warning" };
    card.tip = end
      ? { tone: "warning", lines: splitSentences(say(copy.pendingEndNote, { d: d.day(opensOn), m: d.month(item.month), a: usdt(item.amountUsdt) })) }
      : { tone: "neutral", lines: [say(copy.pendingNote, { a: usdt(item.amountUsdt) })] };
  } else if (item.status === "CLAIMED") {
    card.tag = { label: copy.claimedTag, tone: "neutral" };
    if (salary.nextClaimableFrom) {
      const opensOn = salaryDay(salary.nextClaimableFrom);
      card.note = say(copy.claimedNext, { d: d.day(opensOn), m: d.month(opensOn) });
    }
  } else {
    const carry = item.month < businessMonth; // 上月延期项，今天截止（D4e）
    const up = salary.upcoming?.month === item.month && compareSalaryAmounts(salary.upcoming.amountUsdt, item.amountUsdt) > 0 ? salary.upcoming : null;
    const daysLeft = daysBetween(salary.businessDate, expiresOn);
    card.note = claimBy;
    if (carry) {
      card.tag = { label: copy.todayTag, tone: "warning" };
      card.tip = { tone: "warning", lines: splitSentences(say(copy.carryNote, { m: d.monthWord(item.month) })) };
      if (other) card.note = say(copy.nextMonthNote, { pm: d.month(item.month), m: d.month(other.month), a: usdt(other.amountUsdt), d: d.day(lastClaimDay(salaryAmountExpiresAt(salary, other))) });
      dock = { kind: "claim", label: hidden ? copy.claimSalary : say(copy.claimMonthBtn, { m: d.month(item.month), a: usdt(item.amountUsdt) }), month: item.month, amountUsdt: item.amountUsdt };
    } else if (up) {
      const opensOn = salaryDay(up.claimableFrom);
      const end = opensOn.slice(0, 7) !== item.month; // 月末最后一天晋升：下月 1 日（D4c）
      card.tag = { label: copy.claimable, tone: "brand" };
      card.tip = { tone: "warning", lines: splitSentences(end
        ? say(copy.promoEndNote, { d: d.day(opensOn), r: input.mask(up.rankCode), m: d.month(item.month), a: usdt(up.amountUsdt), b: usdt(item.amountUsdt) })
        : say(copy.promoNote, { a: usdt(up.amountUsdt), b: usdt(item.amountUsdt) })) };
      dock = { kind: "tray", copy: end ? say(copy.trayWaitEnd, { m: d.month(item.month), a: usdt(up.amountUsdt), d: d.day(opensOn) }) : say(copy.trayWait, { a: usdt(up.amountUsdt) }), button: say(copy.trayNow, { b: usdt(item.amountUsdt) }) };
      promo = { end, month: d.month(item.month), date: d.day(opensOn), now: usdt(item.amountUsdt), next: usdt(up.amountUsdt), rank: up.rankCode };
    } else if (daysLeft <= 3) {
      card.tag = { label: say(copy.expiringTag, { n: daysLeft }), tone: "warning" };
      card.tip = { tone: "warning", lines: [say(copy.expiringNote, { d: d.day(expiresOn) })] };
    } else {
      card.tag = { label: copy.claimable, tone: "brand" };
      card.tip = { tone: "neutral", lines: splitSentences(copy.claimRules) };
    }
    if (amountEndsToday) card.tag = { label: copy.todayTag, tone: "warning" };
    if (dropsTo) {
      const nextDay = salaryDay(next!.claimableFrom); // 月末：只限下月 1 日当天（同 D4c）
      card.tip = { tone: "warning", lines: splitSentences(say(nextDay.slice(0, 7) === item.month ? copy.dropNote : copy.dropEndNote, { a: usdt(item.amountUsdt), b: usdt(dropsTo), d: d.day(nextDay) })) };
    }
    if (!dock) dock = { kind: "claim", label: hidden ? copy.claimSalary : say(copy.claimBtn, { a: usdt(item.amountUsdt) }), month: item.month, amountUsdt: item.amountUsdt };
  }

  // 领取过程覆盖卡片标签、底注和底部（2.1、D5、D6）。
  if (phase === "claiming") {
    card.tag = { label: copy.claimingTag, tone: "warning", busy: true };
    card.tip = { tone: "neutral", lines: splitSentences(copy.claimRules) };
    card.statusKey = "claiming";
    dock = { kind: "busy", label: copy.claimingBtn };
  } else if (phase === "confirming") {
    card.tag = { label: copy.confirmingTag, tone: "warning", busy: true };
    card.tip = null;
    card.note = copy.confirmingNote;
    card.statusKey = "confirming";
    dock = { kind: "status", label: copy.confirmingCap };
  } else if (phase === "resend") {
    // 回执 NOT_FOUND：服务端没收到。卡片底注位只写原因；重新提交放在发出这次领取的底部主按钮（03 §3.5.2 就地入口、04.0），
    // 沿用同一幂等键、同一月份和金额。
    card.tip = null;
    card.note = "";
    card.resend = true;
    card.statusKey = "resend";
    dock = { kind: "resend", label: copy.resendBtn };
  }
  if (hidden) card.tip = null; // 隐藏统计时不出提示（画板 Ch）
  return { card, dock, promo };
}

/** 气泡每句一段（03 §3.5.1）：按句末标点切开，中文按「。」。 */
export function splitSentences(text: string): string[] {
  // Older iOS WebViews cannot parse regex lookbehind.
  return text.replace(/([。！？])|([.!?])\s+/g, "$1$2\n").split("\n").map(line => line.trim()).filter(Boolean);
}
