import { createClient } from '@supabase/supabase-js'

// The bahaymo.com marketplace lives in a SEPARATE Supabase project from the
// CRM. Access it read-only via its anon key. Returns null when the env vars
// aren't configured so callers can degrade gracefully (501).
export function getMarketplaceClient() {
  const url = process.env.MARKETPLACE_SUPABASE_URL
  const key = process.env.MARKETPLACE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}
