import { platformDisplayText } from "./brand-copy";
import type { RankHowPolicy } from "@/api/rank-how-policy-api";
import type { CanonicalVRankRow, CommissionCapabilities } from "@/api/v-rank-api";
import type { RankHowConditionLabels } from "./v-rank-how-policy";
import { formatAmount } from "./amount-display";
import { formatComputePoints } from "../i18n/compute-points";
import { uiLocale } from "@/i18n";

// Interface/status copy only. Published business explanations come from the policy API.
const COPY = {
  zh: {
    headline: "看懂晋升条件，了解每阶权益。", unavailable: "等级说明暂不可用，请稍后重试。", loading: "正在加载等级说明…",
    example: "完整范例 · 按当前规则演示", noThreshold: "本阶未设置此门槛", noReferralMinimum: "不要求自购算力点", noExample: "当前没有可演示的相邻等级门槛。", emptyLadder: "暂无可展示的等级", retry: "重新加载",
    protected: "达到的等级会保留，不会因团队变化而降级。",
    unprotected: "条件不再满足时，等级可能调整为当前符合的等级。",
    leadershipReady: "团队激励池奖励以实际发放为准。",
    leadershipHold: "团队激励池暂未开放发放，票数不代表奖励已到账。",
    peerUnavailable: "同级奖励暂未开放。",
  },
  en: {
    headline: "Understand each step and its benefits.", unavailable: "The rank guide is temporarily unavailable. Please try again later.", loading: "Loading the rank guide…",
    example: "Worked example · current rules", noThreshold: "No threshold set for this rank", noReferralMinimum: "No self compute-point minimum", noExample: "No adjacent rank thresholds are currently available for an example.", emptyLadder: "No visible ranks", retry: "Reload",
    protected: "Once reached, your rank is kept even if your team changes.",
    unprotected: "If you no longer meet the requirements, your rank may be adjusted to the one you currently qualify for.",
    leadershipReady: "Team incentive pool rewards are subject to actual payout.",
    leadershipHold: "Team incentive pool payouts aren’t open yet. Votes do not mean rewards have been received.",
    peerUnavailable: "Same-rank rewards aren’t open yet.",
  },
  vi: {
    headline: "Hiểu điều kiện và quyền lợi từng bậc.", unavailable: "Hướng dẫn về hạng hiện chưa khả dụng. Vui lòng thử lại sau.", loading: "Đang tải hướng dẫn về hạng…",
    example: "Ví dụ · theo quy tắc hiện tại", noThreshold: "Bậc này không đặt ngưỡng", noReferralMinimum: "Không yêu cầu điểm tính toán tự mua", noExample: "Hiện chưa có ngưỡng của hai bậc liền nhau để minh họa.", emptyLadder: "Chưa có hạng được hiển thị", retry: "Tải lại",
    protected: "Hạng đã đạt sẽ được giữ nguyên, kể cả khi nhóm thay đổi.",
    unprotected: "Nếu không còn đáp ứng điều kiện, hạng có thể được điều chỉnh về mức bạn đang đạt.",
    leadershipReady: "Thưởng từ quỹ thưởng nhóm theo kết quả chi trả thực tế.",
    leadershipHold: "Quỹ thưởng nhóm chưa mở chi trả. Phiếu bầu không đồng nghĩa với phần thưởng đã nhận.",
    peerUnavailable: "Thưởng đồng cấp chưa mở.",
  },
  id: {
    headline: "Pahami syarat kenaikan dan manfaat tiap peringkat.", unavailable: "Panduan peringkat sementara tidak tersedia. Coba lagi nanti.", loading: "Memuat panduan peringkat…",
    example: "Contoh lengkap · aturan saat ini", noThreshold: "Tidak ada minimum untuk syarat ini", noReferralMinimum: "Tidak ada minimum poin komputasi sendiri", noExample: "Saat ini belum ada batas peringkat berdekatan untuk dijadikan contoh.", emptyLadder: "Belum ada peringkat", retry: "Muat ulang",
    protected: "Peringkat yang sudah dicapai tetap dipertahankan meskipun tim Anda berubah.",
    unprotected: "Jika Anda tidak lagi memenuhi syarat, peringkat Anda bisa disesuaikan ke peringkat yang sesuai dengan syarat yang Anda penuhi.",
    leadershipReady: "Hadiah pool insentif tim mengikuti pembayaran aktual.",
    leadershipHold: "Pembayaran pool insentif tim belum dibuka. Suara tidak berarti hadiah sudah diterima.",
    peerUnavailable: "Hadiah peringkat sama belum dibuka.",
  },
  ms: {
    headline: "Fahami syarat dan manfaat setiap pangkat.", unavailable: "Panduan pangkat tidak tersedia buat sementara. Sila cuba lagi nanti.", loading: "Memuatkan panduan pangkat…",
    example: "Contoh lengkap · peraturan semasa", noThreshold: "Ambang ini tiada bagi pangkat ini", noReferralMinimum: "Tiada minimum mata pengkomputeran sendiri", noExample: "Tiada ambang pangkat bersebelahan tersedia untuk contoh buat masa ini.", emptyLadder: "Tiada pangkat dipaparkan", retry: "Muat semula",
    protected: "Mengikut peraturan semasa, pangkat yang dicapai dikekalkan walaupun pasukan anda berubah.",
    unprotected: "Jika anda tidak lagi memenuhi syarat, pangkat anda mungkin diselaraskan kepada pangkat yang anda layak sekarang.",
    leadershipReady: "Ganjaran dana insentif pasukan tertakluk kepada pembayaran sebenar.",
    leadershipHold: "Bayaran dana insentif pasukan belum dibuka. Undi tidak bermakna ganjaran telah diterima.",
    peerUnavailable: "Ganjaran pangkat sama belum dibuka.",
  },
  fil: {
    headline: "Unawain ang bawat hakbang at ang benepisyo nito.", unavailable: "Pansamantalang hindi available ang gabay sa rank. Subukan ulit mamaya.", loading: "Nilo-load ang gabay sa rank…",
    example: "Halimbawa · kasalukuyang patakaran", noThreshold: "Walang threshold para sa rank na ito", noReferralMinimum: "Walang minimum na sariling compute point", noExample: "Walang available na threshold ng magkasunod na rank para sa halimbawa.", emptyLadder: "Walang rank na maipapakita", retry: "I-reload",
    protected: "Sa kasalukuyang patakaran, mananatili ang rank mo kahit magbago ang team mo.",
    unprotected: "Kapag hindi mo na natutugunan ang requirement, puwedeng ma-adjust ang rank mo sa kung saan ka kasalukuyang kwalipikado.",
    leadershipReady: "Ang reward sa incentive pool ng team ay batay sa aktuwal na payout.",
    leadershipHold: "Hindi pa bukas ang payout ng incentive pool ng team. Hindi ibig sabihin ng boto na natanggap na ang reward.",
    peerUnavailable: "Hindi pa bukas ang reward sa parehong rank.",
  },
  ru: {
    headline: "Узнайте условия повышения ранга и его привилегии.", unavailable: "Описание рангов временно недоступно. Повторите попытку позже.", loading: "Загружаем описание рангов…",
    example: "Пример · по текущим правилам", noThreshold: "Для этого ранга порога нет", noReferralMinimum: "Очки мощности за свои покупки не требуются", noExample: "Сейчас нет порогов соседних рангов для примера.", emptyLadder: "Нет рангов для показа", retry: "Обновить",
    protected: "Полученный ранг сохраняется, даже если команда изменится.",
    unprotected: "Если вы перестанете выполнять условия, ранг может измениться на тот, которому вы соответствуете.",
    leadershipReady: "Награды пула команды — по фактической выплате.",
    leadershipHold: "Выплаты из пула наград команды пока не открыты. Голоса не означают, что награды получены.",
    peerUnavailable: "Награды за равный ранг пока не открыты.",
  },
  kk: {
    headline: "Әр сатыны және оның артықшылықтарын біліңіз.", unavailable: "Дәреже нұсқаулығы уақытша қолжетімсіз. Кейінірек қайталап көріңіз.", loading: "Дәреже нұсқаулығы жүктелуде…",
    example: "Мысал · ағымдағы ережелер бойынша", noThreshold: "Бұл дәрежеде мұндай шек жоқ", noReferralMinimum: "Жеке сатып алу ұпайы шарт емес", noExample: "Мысал үшін көрші дәрежелер шегі қазір жоқ.", emptyLadder: "Көрсететін дәреже жоқ", retry: "Жаңарту",
    protected: "Жеткен дәрежеңіз командаңыз өзгерсе де сақталады.",
    unprotected: "Талаптарға сай болмай қалсаңыз, дәрежеңіз қазір сай келетін дәрежеге өзгертілуі мүмкін.",
    leadershipReady: "Ынталандыру қоры сыйақылары бойынша нақты төленген сома негізге алынады.",
    leadershipHold: "Ынталандыру қорынан төлем әлі ашылмаған. Дауыстар сыйақы түскенін білдірмейді.",
    peerUnavailable: "Тең дәреже сыйақылары әлі ашылмаған.",
  },
  uz: {
    headline: "Har daraja shartlari va imtiyozlari bilan tanishing.", unavailable: "Darajalar qoʻllanmasi vaqtincha mavjud emas. Keyinroq qayta urinib koʻring.", loading: "Darajalar qoʻllanmasi yuklanmoqda…",
    example: "Misol · amaldagi qoidalar", noThreshold: "Bu daraja uchun chegara belgilanmagan", noReferralMinimum: "Shaxsiy quvvat balli talab qilinmaydi", noExample: "Hozircha misol uchun qoʻshni daraja chegaralari yoʻq.", emptyLadder: "Koʻrsatiladigan daraja yoʻq", retry: "Yangilash",
    protected: "Erishilgan daraja jamoangiz oʻzgarsa ham saqlanadi.",
    unprotected: "Shartlarga endi mos kelmasangiz, darajangiz hozir mos boʻlgan darajaga oʻzgartirilishi mumkin.",
    leadershipReady: "Jamoa ragʻbat fondi mukofotlari haqiqiy toʻlov boʻyicha.",
    leadershipHold: "Jamoa ragʻbat fondi toʻlovlari hali ochilmagan. Ovozlar mukofot tushgani degani emas.",
    peerUnavailable: "Teng daraja mukofotlari hali ochilmagan.",
  },
};

export function rankHowCopy(locale: string) {
  return COPY[uiLocale(locale.split("-")[0])];
}

// Native UniApp can omit Intl; round decimal digits without binary toFixed ties.
export function formatHowNumber(value: number | string, locale: string) {
  const negative = typeof value === "string" ? value.startsWith("-") : value < 0;
  const [mantissa, exponent = "0"] = (typeof value === "string" ? value.replace(/^-/, "").replace(/^0+(?=\d)/, "") : Math.abs(value).toString()).split("e");
  const [integer, fraction = ""] = mantissa.split(".");
  const digits = integer + fraction;
  const point = integer.length + Number(exponent);
  const whole = point > 0 ? digits.slice(0, point).padEnd(point, "0") : "0";
  const tail = (point < 0 ? "0".repeat(-point) : "") + digits.slice(Math.max(point, 0));
  const rounded = [...whole, ...tail.slice(0, 6).padEnd(6, "0")];
  if (tail[6] >= "5") {
    let carry = true;
    for (let i = rounded.length - 1; i >= 0 && carry; i--) {
      if (rounded[i] === "9") rounded[i] = "0";
      else { rounded[i] = String(Number(rounded[i]) + 1); carry = false; }
    }
    if (carry) rounded.unshift("1");
  }
  const fixed = rounded.join("");
  const vietnamese = locale.split("-")[0] === "vi";
  const decimals = fixed.slice(-6).replace(/0+$/, "");
  return (negative ? "-" : "") + fixed.slice(0, -6).replace(/\B(?=(\d{3})+(?!\d))/g, vietnamese ? "." : ",")
    + (decimals ? `${vietnamese ? "," : "."}${decimals}` : "");
}

export function buildRankHowContent(policy: RankHowPolicy | null, ranks: CanonicalVRankRow[], capabilities: CommissionCapabilities, locale: string, labels: RankHowConditionLabels) {
  const copy = rankHowCopy(locale);
  const ladder = ranks.filter(rank => rank.visible).sort((a, b) => a.v - b.v);
  const hasGate = (rank: CanonicalVRankRow) => [rank.selfComputePoints, rank.teamComputePoints, rank.directRefs].some(value => (value ?? 0) > 0)
    || ((rank.requiredDownlineRank ?? 0) > 0 && (rank.requiredDownlineCount ?? 0) > 0);
  const pairs = ladder.filter(rank => rank.v > 0 && hasGate(rank) && ladder.some(previous => previous.v === rank.v - 1));
  // Prefer an example containing both team and qualified-leg conditions; never invent thresholds.
  const target = pairs.find(rank => (rank.teamComputePoints ?? 0) > 0 && (rank.requiredDownlineCount ?? 0) > 0) ?? pairs[0];
  const example = target ? { from: ladder.find(rank => rank.v === target.v - 1)!, to: target } : null;
  const number = (value: number) => formatHowNumber(value, locale);
  const tokens: Record<string, string | undefined> = {
    firstRank: ladder.length ? `V${ladder[0].v}` : undefined,
    lastRank: ladder.length ? `V${ladder[ladder.length - 1].v}` : undefined,
    rankCount: ladder.length ? number(ladder.length) : undefined,
  };
  if (example) {
    Object.assign(tokens, {
      fromRank: `V${example.from.v}`, toRank: `V${example.to.v}`,
      selfComputePoints: target.selfComputePoints === undefined ? undefined : formatComputePoints(target.selfComputePoints, locale),
      teamComputePoints: target.teamComputePoints === undefined ? undefined : formatComputePoints(target.teamComputePoints, locale),
      directRefs: (target.directRefs ?? 0) > 0 ? number(target.directRefs!) : copy.noThreshold,
      rankLegs: (target.requiredDownlineRank ?? 0) > 0 && (target.requiredDownlineCount ?? 0) > 0
        ? labels.vDownlines.replace("{n}", number(target.requiredDownlineCount!)).replace("{v}", String(target.requiredDownlineRank)) : copy.noThreshold,
      directRate: `${number(target.directBonus * 100)}%`,
      peerRate: capabilities.peer ? `${number(target.peerBonus * 100)}%` : copy.peerUnavailable,
      votes: number(target.leadershipVotes), cultivation: `${formatAmount(target.cultivationBonus)} UVT`,
    });
  }
  if (policy?.rules) {
    tokens.protection = policy.rules.permanentProtection ? copy.protected : copy.unprotected;
    tokens.leadershipStatus = policy.rules.leadershipConfigured ? copy.leadershipReady : copy.leadershipHold;
    if (policy.rules.qualifiedReferralSelfComputePoints !== null) tokens.referralThreshold = policy.rules.qualifiedReferralSelfComputePoints === 0
      ? copy.noReferralMinimum : formatComputePoints(policy.rules.qualifiedReferralSelfComputePoints, locale);
  }
  const sections = new Map(policy?.sections.map(section => [section.id, section]));
  function section(id: string, fallbackTitle = copy.unavailable) {
    const published = sections.get(id);
    let available = Boolean(published);
    const interpolate = (text: string) => text.replace(/\{([^{}]+)\}/g, (_, key: string) => {
      if (tokens[key] === undefined) { available = false; return ""; }
      return tokens[key]!;
    });
    const title = published ? interpolate(published.title) : fallbackTitle;
    // 平级奖励未派发时,规则页不得把配置比例写成已开放权益 —— 与等级页同一事实(#79)。
    if (published && !capabilities.peer && (id === "unlock-peer" || id === "result-peer")) {
      return { id, available, title: platformDisplayText(available ? title : fallbackTitle), body: available ? copy.peerUnavailable : copy.unavailable };
    }
    const body = published ? interpolate(published.body) : copy.unavailable;
    return { id, available, title: platformDisplayText(available ? title : fallbackTitle), body: platformDisplayText(available ? body : copy.unavailable) };
  }
  return { ladder, example, section, copy };
}

export interface RankHowResourceState { loading: boolean; error: boolean; policy: RankHowPolicy | null; ranks: CanonicalVRankRow[]; capabilities: CommissionCapabilities }
export function createRankHowResource(deps: {
  published(locale: string): Promise<RankHowPolicy>;
  ladder(): Promise<{ ranks: CanonicalVRankRow[]; capabilities: CommissionCapabilities }>;
  apply(state: RankHowResourceState): void;
}) {
  let epoch = 0;
  let disposed = false;
  let pending: { locale: string; promise: Promise<void> } | undefined;
  function load(locale: string): Promise<void> {
    if (disposed) return Promise.resolve();
    if (pending?.locale === locale) return pending.promise;
    const request = ++epoch;
    deps.apply({ loading: true, error: false, policy: null, ranks: [], capabilities: { peer: false, genesis: false } });
    const promise = Promise.all([deps.published(locale), deps.ladder()])
      .then(([policy, ladder]) => { if (!disposed && epoch === request) deps.apply({ loading: false, error: false, policy, ranks: ladder.ranks, capabilities: ladder.capabilities }); })
      .catch(() => { if (!disposed && epoch === request) deps.apply({ loading: false, error: true, policy: null, ranks: [], capabilities: { peer: false, genesis: false } }); })
      .finally(() => { if (epoch === request) pending = undefined; });
    pending = { locale, promise };
    return promise;
  }
  return { load, dispose() { disposed = true; epoch++; pending = undefined; } };
}
