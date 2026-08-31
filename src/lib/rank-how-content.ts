import type { RankHowPolicy } from "@/api/rank-how-policy-api";
import type { CanonicalVRankRow } from "@/api/v-rank-api";
import type { RankHowConditionLabels } from "./v-rank-how-policy";

// Interface/status copy only. Published business explanations come from the policy API.
const COPY = {
  zh: {
    headline: "看懂晋升条件，了解每阶权益。", unavailable: "说明或配置暂不可用，请稍后重试。", loading: "正在读取最新说明和等级配置…",
    example: "完整范例 · 按当前规则演示", noThreshold: "本阶未设置此门槛", noReferralMinimum: "0 USDT（不要求正数自购）", noExample: "当前没有可演示的相邻等级门槛。", emptyLadder: "暂无可展示的等级", retry: "重新加载",
    protected: "已开启保级；业绩回落时保留当前等级。已结算奖励的退款和撤销仍按结算规则处理。",
    unprotected: "未开启保级；业绩或合格条件变化后，服务端可能按实际可达等级降级。",
    leadershipReady: "领导池配置已具备结算条件；实际参与资格、限额和到账以结算结果为准。",
    leadershipHold: "领导池配置尚不完整，暂不可结算；票数不代表已获得分红。",
  },
  en: {
    headline: "Understand each step and its benefits.", unavailable: "Explanation or configuration unavailable. Please retry later.", loading: "Loading the latest explanation and rank configuration…",
    example: "Worked example · current rules", noThreshold: "No threshold set for this rank", noReferralMinimum: "0 USDT (no positive self-purchase minimum)", noExample: "No adjacent rank thresholds are currently available for an example.", emptyLadder: "No visible ranks", retry: "Reload",
    protected: "Rank protection is enabled: falling performance retains the current rank. Refunds and reversals still follow settlement rules.",
    unprotected: "Rank protection is disabled: changes in performance or qualification may lower the rank to the level currently reached.",
    leadershipReady: "Leadership pool configuration is complete. Eligibility, limits and payment remain subject to settlement.",
    leadershipHold: "Leadership pool configuration is incomplete; settlement is unavailable. Votes are not a paid dividend.",
  },
  vi: {
    headline: "Hiểu điều kiện và quyền lợi từng bậc.", unavailable: "Chưa có nội dung hoặc cấu hình. Vui lòng thử lại sau.", loading: "Đang tải hướng dẫn và cấu hình hạng mới nhất…",
    example: "Ví dụ · theo quy tắc hiện tại", noThreshold: "Bậc này không đặt ngưỡng", noReferralMinimum: "0 USDT (không yêu cầu mức tự mua dương)", noExample: "Hiện chưa có ngưỡng của hai bậc liền nhau để minh họa.", emptyLadder: "Chưa có hạng được hiển thị", retry: "Tải lại",
    protected: "Đã bật bảo vệ hạng: giữ hạng khi doanh số giảm. Hoàn tiền và thu hồi thưởng vẫn theo quy tắc quyết toán.",
    unprotected: "Chưa bật bảo vệ hạng: thay đổi doanh số hoặc điều kiện có thể làm giảm hạng về mức thực tế đạt được.",
    leadershipReady: "Cấu hình quỹ lãnh đạo đã đầy đủ. Điều kiện tham gia, hạn mức và thanh toán theo kết quả quyết toán.",
    leadershipHold: "Cấu hình quỹ lãnh đạo chưa đầy đủ nên chưa thể quyết toán. Phiếu bầu không đồng nghĩa với cổ tức đã nhận.",
  },
};

export function rankHowCopy(locale: string) {
  return COPY[locale.split("-")[0] as keyof typeof COPY] ?? COPY.en;
}

export function buildRankHowContent(policy: RankHowPolicy | null, ranks: CanonicalVRankRow[], locale: string, labels: RankHowConditionLabels) {
  const copy = rankHowCopy(locale);
  const ladder = ranks.filter(rank => rank.visible).sort((a, b) => a.v - b.v);
  const hasGate = (rank: CanonicalVRankRow) => [rank.selfBuyUSD, rank.directRefs, rank.teamVolumeUSD].some(value => (value ?? 0) > 0)
    || ((rank.requiredDownlineRank ?? 0) > 0 && (rank.requiredDownlineCount ?? 0) > 0);
  const pairs = ladder.filter(rank => rank.v > 0 && hasGate(rank) && ladder.some(previous => previous.v === rank.v - 1));
  // Prefer an example containing both team and qualified-leg conditions; never invent thresholds.
  const target = pairs.find(rank => (rank.teamVolumeUSD ?? 0) > 0 && (rank.requiredDownlineCount ?? 0) > 0) ?? pairs[0];
  const example = target ? { from: ladder.find(rank => rank.v === target.v - 1)!, to: target } : null;
  const number = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(value);
  const money = (value: number | undefined) => value !== undefined && value > 0 ? `${number(value)} USDT` : copy.noThreshold;
  const tokens: Record<string, string | undefined> = {
    firstRank: ladder.length ? `V${ladder[0].v}` : undefined,
    lastRank: ladder.length ? `V${ladder[ladder.length - 1].v}` : undefined,
    rankCount: ladder.length ? number(ladder.length) : undefined,
  };
  if (example) {
    Object.assign(tokens, {
      fromRank: `V${example.from.v}`, toRank: `V${example.to.v}`,
      selfBuy: money(target.selfBuyUSD), directRefs: (target.directRefs ?? 0) > 0 ? number(target.directRefs!) : copy.noThreshold,
      teamVolume: money(target.teamVolumeUSD),
      rankLegs: (target.requiredDownlineRank ?? 0) > 0 && (target.requiredDownlineCount ?? 0) > 0
        ? labels.vDownlines.replace("{n}", number(target.requiredDownlineCount!)).replace("{v}", String(target.requiredDownlineRank)) : copy.noThreshold,
      directRate: `${number(target.directBonus * 100)}%`, peerRate: `${number(target.peerBonus * 100)}%`,
      votes: number(target.leadershipVotes), cultivation: `${number(target.cultivationBonus)} NEX`,
    });
  }
  if (policy?.rules) {
    tokens.protection = policy.rules.permanentProtection ? copy.protected : copy.unprotected;
    tokens.leadershipStatus = policy.rules.leadershipConfigured ? copy.leadershipReady : copy.leadershipHold;
    if (policy.rules.qualifiedReferralSelfBuyUSD !== null) tokens.referralThreshold = policy.rules.qualifiedReferralSelfBuyUSD === 0
      ? copy.noReferralMinimum : `${number(policy.rules.qualifiedReferralSelfBuyUSD)} USDT`;
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
    const body = published ? interpolate(published.body) : copy.unavailable;
    return { id, available, title: available ? title : fallbackTitle, body: available ? body : copy.unavailable };
  }
  return { ladder, example, section, copy };
}

export interface RankHowResourceState { loading: boolean; error: boolean; policy: RankHowPolicy | null; ranks: CanonicalVRankRow[] }
export function createRankHowResource(deps: {
  published(locale: string): Promise<RankHowPolicy>;
  ladder(): Promise<{ ranks: CanonicalVRankRow[] }>;
  apply(state: RankHowResourceState): void;
}) {
  let epoch = 0;
  let disposed = false;
  let pending: { locale: string; promise: Promise<void> } | undefined;
  function load(locale: string): Promise<void> {
    if (disposed) return Promise.resolve();
    if (pending?.locale === locale) return pending.promise;
    const request = ++epoch;
    deps.apply({ loading: true, error: false, policy: null, ranks: [] });
    const promise = Promise.all([deps.published(locale), deps.ladder()])
      .then(([policy, ladder]) => { if (!disposed && epoch === request) deps.apply({ loading: false, error: false, policy, ranks: ladder.ranks }); })
      .catch(() => { if (!disposed && epoch === request) deps.apply({ loading: false, error: true, policy: null, ranks: [] }); })
      .finally(() => { if (epoch === request) pending = undefined; });
    pending = { locale, promise };
    return promise;
  }
  return { load, dispose() { disposed = true; epoch++; pending = undefined; } };
}
