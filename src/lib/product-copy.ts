// Localized per-SKU marketing copy.
//
// src/mock/products.ts owns the backend-replaceable data shape and the English
// source strings; the display layer resolves the active locale here so store
// cards / detail / search never render raw mock English. Product `name`
// (NexGridBox S1, Cloud Share …) is a brand mark and is deliberately NOT
// translated — only prose fields are.
//
// Falls back to the products.ts English when a SKU has no catalog entry, so a
// newly added product degrades to English instead of crashing. verify.sh
// asserts id parity so that fallback stays unreachable in practice.

import { en, type Messages } from "@/i18n/messages/en";
import { vi } from "@/i18n/messages/vi";
import { zh } from "@/i18n/messages/zh";
import { ru } from "@/i18n/messages/ru";
import { kk } from "@/i18n/messages/kk";
import { uz } from "@/i18n/messages/uz";
import { id as idMessages } from "@/i18n/messages/id";
import { ms } from "@/i18n/messages/ms";
import { fil } from "@/i18n/messages/fil";
import { uiLocale, type LocaleCode } from "@/i18n";
import type { Product, ProductTaskLevel } from "@/mock/products";
import { SPEC_UNAVAILABLE } from "@/api/product-catalog-contract";
import { fmt } from "@/i18n/format";

/** Marketing badge types the App knows; `custom` is operator free text shown as written. */
export type ProductBadgeKind = "recommended" | "bestSeller" | "trending" | "upgradePick" | "flagship" | "lowBarrier" | "custom";

type KnownBadgeKind = Exclude<ProductBadgeKind, "custom">;

export interface ProductCopy {
  tagline: string;
  badge: string;
  badgeKind: ProductBadgeKind;
  taskLevels: string;
}

type CatalogEntry = { tagline: string; badge: string };
type CatalogId = keyof typeof en.store.catalog;

const CATALOG_BADGE_KIND: Record<CatalogId, KnownBadgeKind> = {
  "stellarbox-s1": "bestSeller",
  "stellarbox-pro": "trending",
  "stellarbox-pro-v2": "upgradePick",
  "stellarrack-p1": "flagship",
  "stellarrack-p2": "flagship",
  "cloud-share": "lowBarrier",
};

function badgeText(t: Messages, kind: KnownBadgeKind): string {
  if (kind === "recommended") return t.store.badgeRecommended;
  if (kind === "bestSeller") return t.store.bestSeller;
  if (kind === "trending") return t.store.catalog["stellarbox-pro"].badge;
  if (kind === "upgradePick") return t.store.catalog["stellarbox-pro-v2"].badge;
  if (kind === "flagship") return t.store.catalog["stellarrack-p1"].badge;
  return t.store.catalog["cloud-share"].badge;
}

// The server badge is operator free text (PC 营销角标). Known labels in any App language are matched by
// meaning, ignoring case and spacing ("Best seller" = "Best Seller" = "热销"); anything else is shown as written.
const badgeKey = (value: string) => value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
const KNOWN_BADGES = new Map<string, KnownBadgeKind>();
for (const store of [en.store, zh.store, vi.store, ru.store, kk.store, uz.store, idMessages.store, ms.store, fil.store]) {
  const add = (label: string, kind: KnownBadgeKind) => { if (!KNOWN_BADGES.has(badgeKey(label))) KNOWN_BADGES.set(badgeKey(label), kind); };
  add(store.badgeRecommended, "recommended");
  add(store.bestSeller, "bestSeller");
  add(store.trending, "trending");
  for (const id of Object.keys(CATALOG_BADGE_KIND) as CatalogId[]) add(store.catalog[id].badge, CATALOG_BADGE_KIND[id]);
}
// Labels earlier App versions offered, which saved products can still carry: they keep their kind and show today's label.
const LEGACY_BADGES: [string, KnownBadgeKind][] = [
  ["Upgrade Pick", "upgradePick"], ["Low Barrier", "lowBarrier"], ["升级首选", "upgradePick"], ["正热", "trending"], ["上升", "trending"],
  ["Bán chạy nhất", "bestSeller"], ["Bán chạy", "bestSeller"], ["Xu hướng", "trending"], ["Đang hot", "trending"], ["Lựa chọn nâng cấp", "upgradePick"],
  ["Hàng đầu", "flagship"], ["Rào cản thấp", "lowBarrier"], ["Жақсартуға ұсынылады", "upgradePick"],
];
for (const [label, kind] of LEGACY_BADGES) if (!KNOWN_BADGES.has(badgeKey(label))) KNOWN_BADGES.set(badgeKey(label), kind);

function serverBadge(t: Messages, badge: string | undefined): Pick<ProductCopy, "badge" | "badgeKind"> {
  const text = badge?.trim() ?? "";
  const kind = text ? KNOWN_BADGES.get(badgeKey(text)) : undefined;
  return kind ? { badge: badgeText(t, kind), badgeKind: kind } : { badge: text, badgeKind: "custom" };
}

function normalizedPublishedTagline(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s*[·・]\s*/gu, "·");
}

const PRO_PUBLISHED_TAGLINE = "全托管设备";
const VIRGINIA_DATACENTER = "美国·弗吉尼亚";
// zh keeps the published value itself; the zh slots only show translators the source.
const VIRGINIA_DATACENTER_LABEL = { zh: "美国·弗吉尼亚", en: "United States · Virginia", vi: "Hoa Kỳ · Virginia", id: "Amerika Serikat · Virginia", ms: "Amerika Syarikat · Virginia", fil: "United States · Virginia", ru: "США · Вирджиния", kk: "АҚШ · Вирджиния", uz: "AQSh · Virjiniya" };
const PRO_TAGLINE_LABEL = {"zh":"全托管设备","en":"Fully managed device","vi":"Thiết bị được quản lý toàn diện","ru":"Устройство с полным обслуживанием","kk":"Толық қызмет көрсетілетін құрылғы","uz":"Toʻliq xizmat koʻrsatiladigan qurilma","id":"Perangkat yang dikelola penuh","ms":"Peranti diurus sepenuhnya","fil":"Device na ganap na pinamamahalaan"};

/** Translate only this published place label; a SKU's actual datacenter remains server-owned. */
export function localizedDatacenterValue(value: string | null | undefined, locale: LocaleCode): string | null | undefined {
  if (!value || normalizedPublishedTagline(value) !== VIRGINIA_DATACENTER || locale === "zh") return value;
  return VIRGINIA_DATACENTER_LABEL[uiLocale(locale)];
}

function serverTagline(t: Messages, p: Product, locale?: LocaleCode): string {
  if (p.id === "cloud-share" && normalizedPublishedTagline(p.tagline) === zh.store.cloudShareLowBarrierTagline) {
    return t.store.cloudShareLowBarrierTagline;
  }
  if (p.id === "stellarbox-pro" && normalizedPublishedTagline(p.tagline) === PRO_PUBLISHED_TAGLINE && locale && locale !== "zh") {
    return PRO_TAGLINE_LABEL[uiLocale(locale)];
  }
  return p.tagline;
}

export function productTaskLevelsText(t: Messages, levels: readonly ProductTaskLevel[]): string {
  return levels.length ? fmt(t.store.taskLevelsLine, {
    levels: levels.map((level) => t.store.taskLevelLabels[level]).join(" / "),
  }) : "";
}

export function productCopy(t: Messages, p: Product, serverCatalog = false, locale?: LocaleCode): ProductCopy {
  if (serverCatalog) return {
    tagline: serverTagline(t, p, locale),
    ...serverBadge(t, p.badge),
    taskLevels: productTaskLevelsText(t, p.taskLevels),
  };
  const entry = (t.store.catalog as Record<string, CatalogEntry | undefined>)[p.id];
  return {
    tagline: entry?.tagline ?? p.tagline,
    badge: entry?.badge ?? p.badge ?? "",
    badgeKind: entry ? CATALOG_BADGE_KIND[p.id as CatalogId] : "custom",
    taskLevels: productTaskLevelsText(t, p.taskLevels),
  };
}

/**
 * Display gate for the server-owned spec strings (every `displayString` field in
 * product-catalog-contract). SPEC_UNAVAILABLE is the server's own "no certified
 * value" sentinel, and a mock SKU may not carry the field at all — both degrade
 * to one locale string so the raw token never reaches the screen.
 *
 * Every render of those fields goes through here; `spec-sentinel-render-gate.mjs`
 * fails the build on any unwrapped read in the store render face.
 */
export function specText(
  t: Messages,
  value: string | null | undefined,
  fallback = t.store.specValueUnavailable,
  field?: "vram" | "power",
): string {
  if (value === "not_applicable") {
    if (field === "vram") return t.store.specShareVramNotApplicable;
    if (field === "power") return t.store.specSharePowerNotApplicable;
    return fallback;
  }
  if (value === "不适用（虚拟算力份额）") return t.store.specShareVramNotApplicable;
  if (value === "不适用（非独立设备）") return t.store.specSharePowerNotApplicable;
  const target = value?.match(/^目标\s*(\d+(?:\.\d+)?%)$/);
  if (target) return fmt(t.store.specTarget, { n: target[1] });
  return !value || value === SPEC_UNAVAILABLE ? fallback : value;
}

export interface SpecRow { k: string; v: string }

/**
 * A spec-table row, or null when there is nothing to say. An empty row carries no
 * information, and printing a placeholder into a spec sheet reads as "we haven't
 * told you yet" — worse than simply not listing the line. Callers filter out nulls.
 *
 * Absence is judged on the SOURCE value, never on the rendered string: comparing
 * against the localized placeholder would silently break the moment that copy or
 * the active language changes.
 *
 * Single-value displays (a card's "GPU · VRAM" line) can't drop a row and keep
 * using specText's placeholder instead.
 */
export function specRow(label: string, raw: string | undefined): SpecRow | null {
  return !raw || raw === SPEC_UNAVAILABLE ? null : { k: label, v: raw };
}

/**
 * Warranty term. The server owns a month count; the unit word is ours, so the row
 * is three-language by construction instead of arriving as untranslatable prose
 * ("24 months" rendered inside a Chinese spec sheet).
 *
 * Whole terms of three years or more read as years, matching how those SKUs
 * advertise themselves ("5-year extended warranty"); shorter terms stay in months,
 * matching the established box copy. Absent → the same placeholder as any other
 * missing spec.
 */
export function warrantyText(t: Messages, months: number | undefined): string {
  if (!months || months <= 0) return t.store.specValueUnavailable;
  return months >= 36 && months % 12 === 0
    ? fmt(t.store.specWarrantyYears, { n: months / 12 })
    : fmt(t.store.specWarrantyMonths, { n: months });
}
