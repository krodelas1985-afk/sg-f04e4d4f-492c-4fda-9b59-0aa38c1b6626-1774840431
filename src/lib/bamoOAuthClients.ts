/**
 * The BaMo products allowed to use "Sign in with BaMo".
 *
 * Supabase's OAuth server already refuses clients it has no registration for.
 * This list is the second gate, on the consent page: an approval only ever goes
 * to a redirect URI that belongs to a BaMo product we name here. A client added
 * in the dashboard by mistake still cannot receive a BaMo sign-in until it is
 * added to this file too - a code change, reviewed like any other.
 *
 * Keyed by the exact redirect URI registered for the client.
 */
export const BAMO_OAUTH_PRODUCTS: Record<string, { name: string }> = {
  "https://cbnvuergvdnfzeixbiwt.supabase.co/auth/v1/callback": { name: "BaMo Marketplace" },
  // BaMo Network is added here when its client is registered (plan Phase 6).
};

export function bamoProductFor(redirectUri: string | null | undefined) {
  if (!redirectUri) return null;
  return BAMO_OAUTH_PRODUCTS[redirectUri] ?? null;
}
