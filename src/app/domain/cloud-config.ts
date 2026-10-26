// PKCE confirmation links must return to the origin that owns the verifier.
export function canonicalCloudUrl(configuredOrigin: string, currentHref: string): string | null {
  if (!configuredOrigin) return null;
  const origin = new URL(configuredOrigin).origin;
  const current = new URL(currentHref);
  return current.origin === origin ? null : origin + current.pathname + current.search + current.hash;
}
