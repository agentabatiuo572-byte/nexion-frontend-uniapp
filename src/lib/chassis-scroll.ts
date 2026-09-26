export function scrollCurrentTabToTop(target: { scrollTop: number; scrollTo?: (options: ScrollToOptions) => void }, reduceMotion: boolean): void {
  try {
    if (typeof target.scrollTo === "function") {
      target.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      return;
    }
  } catch { /* Android HTML5+ view may not support DOM scrolling methods. */ }
  target.scrollTop = 0;
}
