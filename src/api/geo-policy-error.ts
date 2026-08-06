export type GeoPolicyErrorKind = "blocked" | "limited" | "endpoint" | "unavailable";

export interface GeoPolicyCopy {
  blocked: string;
  limited: string;
  endpoint: string;
  unavailable: string;
}

const GEO_POLICY_KIND: Readonly<Record<string, GeoPolicyErrorKind>> = Object.freeze({
  GEO_BLOCKED: "blocked",
  GEO_LIMITED: "limited",
  GEO_ENDPOINT_BLOCKED: "endpoint",
  GEO_COUNTRY_UNRESOLVED: "unavailable",
  GEO_COUNTRY_INVALID: "unavailable",
  GEO_EDGE_TRUST_REQUIRED: "unavailable",
  GEO_EDGE_SOURCE_INVALID: "unavailable",
});

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

export function geoPolicyErrorKind(error: unknown): GeoPolicyErrorKind | null {
  const message = errorMessage(error);
  const token = message.match(/\bGEO_[A-Z_]+\b/)?.[0];
  return token ? GEO_POLICY_KIND[token] ?? null : null;
}

export function geoPolicyUserMessage(error: unknown, copy: GeoPolicyCopy): string | null {
  const kind = geoPolicyErrorKind(error);
  return kind ? copy[kind] : null;
}
