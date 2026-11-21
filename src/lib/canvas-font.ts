/**
 * Canvas text does not inherit CSS. Posters set the App font stack themselves and wait for the faces their text
 * needs, so Vietnamese marks are drawn by Inter instead of being split off by the canvas default sans-serif (BUG-551).
 */
const FALLBACK_STACK = '"UVEL Figures", "Inter", sans-serif';
const FONT_WAIT_MS = 1500;

/** The App font stack (tokens.css --font-display), read from the page so canvas and DOM use the same string. */
export function canvasFontStack(): string {
  if (typeof document === "undefined") return FALLBACK_STACK;
  return getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || FALLBACK_STACK;
}

/**
 * Resolves once the regular-weight faces that `text` needs have loaded, after FONT_WAIT_MS, or at once where the
 * Font Loading API is missing. It never rejects: the poster is drawn in every case, at worst with a fallback font.
 */
export function canvasFontsReady(text: string): Promise<void> {
  const fonts = typeof document === "undefined" ? undefined : document.fonts;
  if (!fonts?.load) return Promise.resolve();
  const loaded = fonts.load(`400 16px ${canvasFontStack()}`, text).then(() => undefined, () => undefined);
  return Promise.race([loaded, new Promise<void>((resolve) => { setTimeout(resolve, FONT_WAIT_MS); })]);
}
