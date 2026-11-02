export interface OAuthBrowserReceipt { flowId: string; receipt: string }

export function validOAuthBrowserReceipt(value: unknown): value is OAuthBrowserReceipt {
  const receipt = value as OAuthBrowserReceipt;
  return !!receipt && /^OIDC-[a-f0-9]{32}$/.test(receipt.flowId)
    && /^[A-Za-z0-9_-]{43}$/.test(receipt.receipt);
}
