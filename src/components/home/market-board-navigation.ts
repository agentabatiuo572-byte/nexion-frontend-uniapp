export const COMPUTE_MARKET_ROUTE = "/pages/market/market";

type Navigate = (href: string) => Promise<boolean>;
type KeyboardActivation = Pick<KeyboardEvent, "repeat">;

export function createMarketBoardNavigation(navigate: Navigate) {
  let inFlight = false;

  function openMarket(): boolean {
    if (inFlight) return false;
    inFlight = true;
    void Promise.resolve()
      .then(() => navigate(COMPUTE_MARKET_ROUTE))
      .catch(() => false)
      .finally(() => { inFlight = false; });
    return true;
  }

  function openMarketFromKeyboard(event: KeyboardActivation): boolean {
    if (event.repeat) return false;
    return openMarket();
  }

  return {
    openMarket,
    openMarketFromKeyboard,
    isInFlight: () => inFlight,
  };
}
