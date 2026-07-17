import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerClient } from '@/lib/supabase/server'
import { getMarketplaceClient } from '@/lib/kb/marketplace'

// Search bahaymo.com marketplace listings (separate Supabase project) so an
// agent can pick one as a KB source. Same access pattern as the Ads Manager's
// marketplace-listings route.

async function getAuthUser(req: NextApiRequest, supabase: ReturnType<typeof createServerClient>) {
  const authHeader = req.headers.authorization
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createServerClient()
  const user = await getAuthUser(req, supabase)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const marketplace = getMarketplaceClient()
  if (!marketplace) {
    return res.status(501).json({ error: 'Marketplace connection is not configured on this server.' })
  }

  const search = (req.query.search as string) ?? ''
  const limit = Math.min(parseInt((req.query.limit as string) ?? '20', 10) || 20, 50)

  let query = marketplace
    .from('listings')
    .select('id, title, price, property_type, city, location, bedrooms, bathrooms, floor_area, lot_area, status')
    .eq('status', 'active')
    .limit(limit)

  if (search.trim()) {
    const s = search.trim().replace(/[%,]/g, ' ')
    query = query.or(`title.ilike.%${s}%,city.ilike.%${s}%,location.ilike.%${s}%`)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })

  const listings = (data ?? []).map(l => ({
    id: l.id,
    title: l.title ?? 'Untitled listing',
    price: l.price ?? null,
    property_type: l.property_type ?? null,
    city: l.city ?? null,
    location: l.location ?? null,
    bedrooms: l.bedrooms ?? null,
    bathrooms: l.bathrooms ?? null,
    floor_area: l.floor_area ?? null,
    lot_area: l.lot_area ?? null,
    listing_url: `https://bahaymo.com/listing/${l.id}`,
  }))

  return res.status(200).json({ listings })
}
