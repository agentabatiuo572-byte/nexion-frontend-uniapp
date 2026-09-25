import type { ResolvedTheme } from "@/store/theme";

type AppPage = { $getAppWebview?: () => { evalJS: (script: string) => void } };

// Uni's App service layer has no document. Each Vue page owns a WebView, so
// apply the saved preference in its view layer when the page is ready and when
// the user changes the picker. The stylesheet itself defaults to dark before
// this bridge runs, avoiding a light first frame on a fresh installation.
export function syncNativeTheme(theme: ResolvedTheme): void {
  // #ifdef APP-PLUS
  if (typeof getCurrentPages !== "function") return;
  const script = `document.documentElement.setAttribute("data-theme", "${theme}")`;
  for (const page of getCurrentPages() as AppPage[]) {
    try {
      page.$getAppWebview?.().evalJS(script);
    } catch {
      // A page can be closing while the theme is changed.
    }
  }
  // #endif
}
