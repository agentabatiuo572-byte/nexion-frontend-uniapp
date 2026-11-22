/** Manual recovery only. Keep the current URL and existing session storage intact. */
export function createPageReload(reload: () => void): () => boolean {
  let requested = false;
  return () => {
    if (requested) return false;
    requested = true;
    try {
      reload();
      return true;
    } catch {
      requested = false;
      return false;
    }
  };
}
