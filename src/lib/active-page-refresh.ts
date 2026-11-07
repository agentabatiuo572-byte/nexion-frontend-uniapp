export type ActivePageRefresh = () => Promise<unknown> | unknown;

let activeRefresh: { refresh: ActivePageRefresh; route?: string } | null = null;

type PageRecovery = {
  failed: () => boolean;
  pending: () => boolean;
  retry: () => Promise<boolean>;
  // A pending result keeps polling after a good read, so a pull must not report it as failed.
  quiet: boolean;
};
const pageRecoveries = new Set<PageRecovery>();

/** Only shown page sections register; retained, hidden pages release their entries. */
export function registerPageRecovery(section: PageRecovery): () => void {
  pageRecoveries.add(section);
  return () => { pageRecoveries.delete(section); };
}

export function hasFailedPageSections(): boolean {
  return [...pageRecoveries].some(section => !section.quiet && section.failed());
}

/** Await each failed section, including a read already in flight, without a request burst. */
export async function refreshFailedPageSections(isCurrent: () => boolean): Promise<boolean> {
  const sections = [...pageRecoveries].filter(section => section.failed() || section.pending());
  for (const section of sections) {
    if (!isCurrent()) return false;
    if (!pageRecoveries.has(section)) continue;
    await section.retry();
  }
  return isCurrent() && sections.some(section => !section.quiet && pageRecoveries.has(section) && section.failed());
}

/**
 * Registers the refresh operation for the page that is currently visible.
 * The disposer is identity-safe so a hidden older page cannot unregister a
 * newer page that has already become active.
 */
export function registerActivePageRefresh(refresh: ActivePageRefresh, route?: string): () => void {
  const registration = { refresh, route };
  activeRefresh = registration;
  return () => {
    if (activeRefresh === registration) activeRefresh = null;
  };
}

export async function refreshActivePage(expectedRoute?: string): Promise<void> {
  const registration = activeRefresh;
  if (registration && (expectedRoute === undefined || registration.route === expectedRoute)) await registration.refresh();
}

export function resetActivePageRefreshForTest(): void {
  activeRefresh = null;
}
