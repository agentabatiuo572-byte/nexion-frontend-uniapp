// 我的等级九级身份风格（team-rank DESIGN 7.1–7.5、8.2、9、10.3）的唯一取值表。
// 焦点卡、全部等级横条、等级详情卡、「升到 Vn 后」、团队页等级卡、我的网络卡都从这里取，各处不写死色值、尺寸或动效档。
// 规范：uvel-docs design-system 04 §4.3「我的等级页的身份区按等级递进」（只用于我的等级页、团队页等级卡、个人中心网络卡）。

export type RankTheme = "dark" | "light";
type ThemePair = { dark: string; light: string };

/** 段：每进一段换一种材质（钢 → 晶 → 铜金 → 星河 → 黑金）。 */
export type RankSegment = "steel" | "crystal" | "metal" | "galaxy" | "blackgold";
/** 身份区纹样：刻环（V3–V4）、蜂巢纹（V5）、蜂巢纹＋星点（V6）、星河舞台（V7）、黑金卡面（V8）。 */
export type RankPattern = "rings" | "lattice" | "lattice-sparkles" | "galaxy" | "blackgold" | null;

export interface RankTierStyle {
  v: number;
  segment: RankSegment;
  /** 焦点卡徽章画布（390 宽，px）；V8 是黑金卡内的徽章，360 宽用 canvas360。 */
  canvas: number;
  canvas360: number;
  /** 身份区高度（px），7.1；V7 为舞台、V8 为卡。 */
  identityHeight: number;
  /** 徽章上方留白（纹样半径），7.5；不含卡片内边距 20。 */
  identityTop: number;
  /** 焦点卡整体底色色相（.nx-tint 的 --nx-tint）；V7、V8 不用底色卡（舞台／黑金卡）。 */
  hue: ThemePair | null;
  /** 光晕色相占比（%），直径为徽章画布的 1.6 倍；null 为无光晕或由舞台／卡面自带。 */
  halo: { dark: number; light: number } | null;
  pattern: RankPattern;
  /** 等级数字 26/34 的填充：一项为纯色，多项为上→下渐变的色标（带位置，取值同画板 tiers.css、v8.css）。 */
  numberFill: { dark: string[]; light: string[] };
  /** 点缀色：「升到 Vn 后」旧值→新值箭头、横条点选的光圈、星点和掠光。V0 不会是目标等级。 */
  accent: ThemePair | null;
  /** 横条点选该级的一次性动画（10.3），整组 ≤320ms。 */
  select: { peak: number; settle: number; ms: number; ring: boolean; sheen: boolean; burst: "plat" | "gold" | null };
  /** 身份区的持续循环（10.2），只有 V7、V8，各 2 层。 */
  loops: readonly ("satellite" | "twinkle" | "sheen" | "crown")[];
}

const BRAND = "var(--v5-brand)";
const INK = "var(--v5-ink)";
const brandPair: ThemePair = { dark: BRAND, light: BRAND };
const steelSelect = { peak: 1.08, settle: 1.06, ms: 240, ring: false, sheen: false, burst: null } as const;
const crystalSelect = { peak: 1.12, settle: 1.06, ms: 280, ring: true, sheen: false, burst: null } as const;
const metalSelect = { peak: 1.14, settle: 1.06, ms: 300, ring: true, sheen: true, burst: null } as const;

export const RANK_TIER_STYLES: readonly RankTierStyle[] = [
  { v: 0, segment: "steel", canvas: 128, canvas360: 128, identityHeight: 214, identityTop: 24, hue: { dark: INK, light: INK }, halo: null, pattern: null,
    numberFill: { dark: [INK], light: [INK] }, accent: null, select: steelSelect, loops: [] },
  { v: 1, segment: "steel", canvas: 128, canvas360: 128, identityHeight: 214, identityTop: 24, hue: brandPair, halo: null, pattern: null,
    numberFill: { dark: [BRAND], light: [BRAND] }, accent: brandPair, select: steelSelect, loops: [] },
  { v: 2, segment: "steel", canvas: 128, canvas360: 128, identityHeight: 214, identityTop: 24, hue: brandPair, halo: { dark: 18, light: 12 }, pattern: null,
    numberFill: { dark: [BRAND], light: [BRAND] }, accent: brandPair, select: steelSelect, loops: [] },
  { v: 3, segment: "crystal", canvas: 136, canvas360: 136, identityHeight: 238, identityTop: 40, hue: { dark: "#2DD4BF", light: "#0CC4D6" }, halo: { dark: 22, light: 14 }, pattern: "rings",
    numberFill: { dark: ["#C9FFF6 10%", "#2DD4BF 100%"], light: ["#0B8A95 10%", "#06616A 100%"] }, accent: { dark: "#2DD4BF", light: "#0B7F8A" }, select: crystalSelect, loops: [] },
  { v: 4, segment: "crystal", canvas: 136, canvas360: 136, identityHeight: 238, identityTop: 40, hue: { dark: "#4FA8FF", light: "#1E7BE8" }, halo: { dark: 24, light: 15 }, pattern: "rings",
    numberFill: { dark: ["#DCEEFF 10%", "#4FA8FF 100%"], light: ["#1E6FD0 10%", "#0E3F80 100%"] }, accent: { dark: "#4FA8FF", light: "#175FB5" }, select: crystalSelect, loops: [] },
  { v: 5, segment: "metal", canvas: 144, canvas360: 144, identityHeight: 250, identityTop: 44, hue: { dark: "#FF7A3D", light: "#FF5A1F" }, halo: { dark: 26, light: 16 }, pattern: "lattice",
    numberFill: { dark: ["#FFD9C4 10%", "#FF7A3D 100%"], light: ["#C2410C 10%", "#7A2000 100%"] }, accent: { dark: "#FF7A3D", light: "#B42F00" }, select: metalSelect, loops: [] },
  { v: 6, segment: "metal", canvas: 144, canvas360: 144, identityHeight: 250, identityTop: 44, hue: { dark: "#F2A27E", light: "#C9714B" }, halo: { dark: 30, light: 18 }, pattern: "lattice-sparkles",
    numberFill: { dark: ["#FFE6DA 10%", "#E8A07E 100%"], light: ["#A5573A 10%", "#6E3320 100%"] }, accent: { dark: "#F2A27E", light: "#9A4A2E" }, select: metalSelect, loops: [] },
  { v: 7, segment: "galaxy", canvas: 144, canvas360: 144, identityHeight: 318, identityTop: 22, hue: null, halo: null, pattern: "galaxy",
    numberFill: { dark: ["#FFFFFF 10%", "#DCE6F5 50%", "#93A3BF 100%"], light: ["#2B3446 10%", "#4A5873 55%", "#1D2433 100%"] }, accent: { dark: "#C9D6EA", light: "#43506B" },
    select: { peak: 1.16, settle: 1.06, ms: 320, ring: true, sheen: true, burst: "plat" }, loops: ["satellite", "twinkle"] },
  // V8 黑金卡面两种主题同一卡面（8.1 第 1 条），等级数字和点缀色以外的卡面取值只在卡组件里定义。
  { v: 8, segment: "blackgold", canvas: 112, canvas360: 100, identityHeight: 208, identityTop: 0, hue: null, halo: null, pattern: "blackgold",
    numberFill: { dark: ["#FFF3CF 8%", "#EBCB7A 52%", "#B8913F 100%"], light: ["#FFF3CF 8%", "#EBCB7A 52%", "#B8913F 100%"] }, accent: { dark: "#E2BC62", light: "#765816" },
    select: { peak: 1.16, settle: 1.06, ms: 320, ring: true, sheen: true, burst: "gold" }, loops: ["sheen", "crown"] },
];

/** 隐私遮罩（隐藏统计）时：徽章换成「••••」圆，底色中性，箭头不用等级点缀色、回到默认的禁用色（12.1 第 3 步；画板 .gc__arr）。 */
export const RANK_TIER_HIDDEN = { hue: { dark: INK, light: INK } as ThemePair, numberFill: [INK], accent: "var(--v5-ink-4)" } as const;

/** V8 名称（横条、详情卡标题、专享权益标题格里的「V8」两个字符）用金色（8.1 第 5 条）。 */
export const RANK_V8_NAME_INK: ThemePair = { dark: "#E2BC62", light: "#765816" };

export function rankTierStyle(v: number): RankTierStyle {
  return RANK_TIER_STYLES[Math.min(8, Math.max(0, Math.trunc(v)))];
}

/**
 * 身份区和点缀用的 CSS 变量，按当前主题解析（主题取 useTheme().resolved）：
 * --tier-hue／--nx-tint（.nx-tint 整体底色色相）、--halo（光晕占比）、--tier-ink（点缀色）、
 * --tier-num-color 与 --tier-num-fill（等级数字：渐变时 color 为 transparent、fill 为 background-image，配 background-clip:text）。
 * hidden 为隐私遮罩时的中性取值。
 */
export function rankTierVars(v: number, theme: RankTheme, hidden = false): Record<string, string> {
  if (hidden) {
    return { "--tier-hue": RANK_TIER_HIDDEN.hue[theme], "--nx-tint": RANK_TIER_HIDDEN.hue[theme], "--halo": "0%",
      "--tier-ink": RANK_TIER_HIDDEN.accent, "--tier-num-color": RANK_TIER_HIDDEN.numberFill[0], "--tier-num-fill": "none" };
  }
  const style = rankTierStyle(v);
  const hue = style.hue?.[theme] ?? INK;
  const stops = style.numberFill[theme];
  const gradient = stops.length > 1;
  return {
    "--tier-hue": hue,
    "--nx-tint": hue,
    "--halo": `${style.halo?.[theme] ?? 0}%`,
    "--tier-ink": style.accent?.[theme] ?? BRAND,
    "--tier-num-color": gradient ? "transparent" : stops[0],
    "--tier-num-fill": gradient ? `linear-gradient(180deg,${stops.join(",")})` : "none",
  };
}

/** 徽章成品位图（9 节）：显示尺寸 40px 及以下用 120 版，其余用 432 版；整张画布按显示尺寸放。 */
export function rankBadgeSrc(v: number, displaySize: number): string {
  return `/static/rank/badges/badge-v${Math.min(8, Math.max(0, Math.trunc(v)))}-${displaySize <= 40 ? 120 : 432}.png`;
}

const themed = (base: string, ext: string): ThemePair => ({ dark: `${base}-dark${ext}`, light: `${base}-light${ext}` });
export type RankPerk = "promo" | "trip" | "support" | "transfer" | "market";

/**
 * 第 9 节「直接用」的资源。深浅两版的按主题取（rankAsset(RANK_ASSETS.patternRings, theme)）；
 * 带渐变 id 的 SVG 一律用 <image> 引用，不内联（内联会撞 id）。光效层上线用 2 倍 webp。
 */
export const RANK_ASSETS = {
  /** V3、V4 刻环，显示徽章画布的 1.7 倍。 */
  patternRings: themed("/static/rank/tiers/pattern-rings", ".svg"),
  /** V5、V6 蜂巢纹，显示徽章画布的 1.7 倍。 */
  patternLattice: themed("/static/rank/tiers/pattern-lattice", ".svg"),
  /** V6 星点，显示 245。 */
  sparkles: themed("/static/rank/tiers/sparkles", ".svg"),
  /** V7 横条点选的星点层（6 颗，整层缩放淡出），显示 80。 */
  burstPlat: themed("/static/rank/tiers/burst-plat", ".svg"),
  /** V8 横条点选的星点层，双主题共用。 */
  burstGold: { dark: "/static/rank/tiers/burst-gold.svg", light: "/static/rank/tiers/burst-gold.svg" } as ThemePair,
  /** V7 星河与静态星点（全宽 390×360 的 2 倍）。 */
  v7Galaxy: themed("/static/rank/v7/v8b-galaxy", "@2x.webp"),
  /** V7 亮星 8 颗（整层闪烁的循环层）。 */
  v7Stars: themed("/static/rank/v7/v8b-stars", "@2x.webp"),
  /** V7 星环，显示 300。 */
  v7Orbit: themed("/static/rank/v7/v8b-orbit", ".svg"),
  /** V8 卡面扭索纹、金粉（静态），冠光（呼吸循环层）；卡面不随主题。 */
  v8Guilloche: "/static/rank/v8/v8a-guilloche@2x.webp",
  v8Dust: "/static/rank/v8/v8a-dust@2x.webp",
  v8Rays: "/static/rank/v8/v8a-rays@2x.webp",
  /** V8 五项专享权益的金色徽章，显示 72（H0）／48（H6、E2）。 */
  v8Perks: {
    promo: themed("/static/rank/v8/perk-promo-gold", ".svg"),
    trip: themed("/static/rank/v8/perk-trip-gold", ".svg"),
    support: themed("/static/rank/v8/perk-support-gold", ".svg"),
    transfer: themed("/static/rank/v8/perk-transfer-gold", ".svg"),
    market: themed("/static/rank/v8/perk-market-gold", ".svg"),
  } satisfies Record<RankPerk, ThemePair>,
} as const;

export function rankAsset(asset: ThemePair | string, theme: RankTheme): string {
  return typeof asset === "string" ? asset : asset[theme];
}
