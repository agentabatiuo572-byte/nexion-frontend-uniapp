// Normalize saved coordinates, never the live scroller: iOS elastic scrolling
// can report positions outside the physical content range.
export function normalizedScrollTop(top: number, max: number): number {
  return Math.max(0, Math.min(top, Math.max(0, max)));
}

// H5 recreates Tab shells; their view-layer memory survives those mounts.
const positions = new Map<string, number>();
export function saveScrollPos(key: string, top: number, max: number): void {
  positions.set(key, normalizedScrollTop(top, max));
}
export function getScrollPos(key: string): number | undefined {
  return positions.get(key);
}
