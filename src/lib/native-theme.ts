import type { ResolvedTheme } from "@/store/theme";
// #ifdef APP-PLUS
import { getNavigationButtonsInset, setNavigationBarTheme } from "@/uni_modules/uvel-system-bars";
// #endif

type AppPage = { $getAppWebview?: () => { evalJS: (script: string) => void } };

// Uni's App service layer has no document. Each Vue page owns a WebView, so
// apply the saved preference in its view layer when the page is ready and when
// the user changes the picker. The stylesheet itself defaults to dark before
// this bridge runs, avoiding a light first frame on a fresh installation.
export function syncNativeTheme(theme: ResolvedTheme): void {
  // #ifdef APP-PLUS
  // 5+ style names describe the icon color, not the selected page theme.
  try {
    if (typeof plus !== "undefined")
      plus.navigator?.setStatusBarStyle?.(theme === "dark" ? "light" : "dark");
  } catch {
    // Status-bar support must not prevent page CSS synchronization.
  }
  // Android draws the page under a transparent navigation bar. Three-button navigation reports
  // its height so the bottom chrome clears it (--nx-nav-buttons in tokens.css); 0 under the gesture handle.
  let navButtons = 0;
  try {
    if (typeof plus !== "undefined" && plus.os.name === "Android") {
      setNavigationBarTheme(theme === "dark");
      navButtons = getNavigationButtonsInset();
    }
  } catch {
    // Native bases built before this plugin keep the system default bar above the page.
  }
  if (typeof getCurrentPages !== "function") return;
  // Keep browser color adjustment aligned with the app theme when a page resumes.
  const script = `document.documentElement.setAttribute("data-theme", "${theme}");document.documentElement.style.colorScheme = "only ${theme}";document.documentElement.style.setProperty("--nx-nav-buttons", "${navButtons}px")`;
  for (const page of getCurrentPages() as AppPage[]) {
    try {
      page.$getAppWebview?.().evalJS(script);
    } catch {
      // A page can be closing while the theme is changed.
    }
  }
  // #endif
}
