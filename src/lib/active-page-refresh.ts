export type ActivePageRefresh = () => Promise<unknown> | unknown;

let activeRefresh: { refresh: ActivePageRefresh; route?: string } | null = null;

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
