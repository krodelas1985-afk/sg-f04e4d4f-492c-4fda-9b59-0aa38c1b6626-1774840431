import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerClient } from '@/lib/supabase/server'
import { getMarketplaceClient } from '@/lib/kb/marketplace'

// Add a bahaymo.com marketplace listing as a KB source. The listing data is
// structured, so the fact sheet is composed deterministically — no AI
// extraction and no review step; the row is saved approved immediately.

function peso(n: number | string | null): string | null {
  if (n === null || n === undefined || n === '') return null
  const num = typeof n === 'string' ? Number(n) : n
  if (!Number.isFinite(num)) return String(n)
  return `₱${num.toLocaleString('en-PH')}`
}

type ListingRow = {
  id: string
  title: string | null
  price: number | string | null
  property_type: string | null
  city: string | null
  location: string | null
  bedrooms: number | null
  bathrooms: number | null
  floor_area: number | string | null
  lot_area: number | string | null
  description: string | null
  agent_name: string | null
  agent_prc: string | null
  agent_email: string | null
  agent_phone: string | null
}

function composeListingContent(l: ListingRow, listingUrl: string): string {
  const lines: string[] = []
  const title = l.title ?? 'Untitled listing'
  lines.push(`[SOURCE: bahaymo.com listing "${title}"]`)

  const offering = [title, l.property_type].filter(Boolean).join(' — ')
  lines.push(`PROJECT / OFFERING:\n${offering}`)

  const loc = [l.location, l.city].filter(Boolean).join(', ')
  if (loc) lines.push(`LOCATION:\n${loc}`)

  const priceStr = peso(l.price)
  const specs: string[] = []
  if (priceStr) specs.push(`Price: ${priceStr}`)
  if (l.bedrooms != null) specs.push(`Bedrooms: ${l.bedrooms}`)
  if (l.bathrooms != null) specs.push(`Bathrooms: ${l.bathrooms}`)
  if (l.floor_area != null && l.floor_area !== '') specs.push(`Floor area: ${l.floor_area} sqm`)
  if (l.lot_area != null && l.lot_area !== '') specs.push(`Lot area: ${l.lot_area} sqm`)
  if (specs.length) lines.push(`PRICING & UNITS:\n${specs.join('\n')}`)

  if (l.description?.trim()) lines.push(`DESCRIPTION:\n${l.description.trim()}`)

  const contact: string[] = []
  if (l.agent_name) contact.push(`Listing agent: ${l.agent_name}${l.agent_prc ? ` (PRC ${l.agent_prc})` : ''}`)
  if (l.agent_phone) contact.push(`Phone: ${l.agent_phone}`)
  if (l.agent_email) contact.push(`Email: ${l.agent_email}`)
  if (contact.length) lines.push(`CONTACT:\n${contact.join('\n')}`)

  lines.push(`LISTING LINK:\n${listingUrl}`)
  return lines.join('\n\n')
}

async function getAuthUser(req: NextApiRequest, supabase: ReturnType<typeof createServerClient>) {
  const authHeader = req.headers.authorization
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createServerClient()
  const user = await getAuthUser(req, supabase)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: profile } = await supabase
    .from('profiles').select('role, client_id').eq('id', user.id).single()
  if (!profile) return res.status(403).json({ error: 'Forbidden' })

  const { campaign_id, listing_id, scope, replace_kb_id } = req.body
  if (!campaign_id) return res.status(400).json({ error: 'campaign_id is required' })
  if (!listing_id) return res.status(400).json({ error: 'listing_id is required' })
  const kbScope = scope === 'client' ? 'client' : 'campaign'

  const { data: campaign } = await supabase
    .from('campaigns').select('id, client_id, name').eq('id', campaign_id).single()
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
  if (profile.role !== 'baymo_admin' && campaign.client_id !== profile.client_id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const marketplace = getMarketplaceClient()
  if (!marketplace) {
    return res.status(501).json({ error: 'Marketplace connection is not configured on this server.' })
  }

  const { data: listing, error: listingError } = await marketplace
    .from('listings')
    .select('id, title, price, property_type, city, location, bedrooms, bathrooms, floor_area, lot_area, description, agent_name, agent_prc, agent_email, agent_phone')
    .eq('id', listing_id)
    .single()
  if (listingError || !listing) return res.status(404).json({ error: 'Listing not found on the marketplace' })

  const listingUrl = `https://bahaymo.com/listing/${listing.id}`
  const content = composeListingContent(listing as ListingRow, listingUrl)
  const sourceLabel = `Listing: ${listing.title ?? listing.id}`

  // Re-adding the same listing (or explicit replace) retires the old row —
  // the new row is approved instantly, so this is safe to do up front.
  const retireIds: string[] = []
  if (replace_kb_id) retireIds.push(replace_kb_id)
  const { data: existing } = await supabase
    .from('campaign_knowledge_base')
    .select('id')
    .eq('campaign_id', campaign_id)
    .eq('source_type', 'listing')
    .eq('source_url', listingUrl)
    .eq('is_active', true)
  for (const row of existing ?? []) {
    if (!retireIds.includes(row.id)) retireIds.push(row.id)
  }
  if (retireIds.length > 0) {
    await supabase
      .from('campaign_knowledge_base')
      .update({ is_active: false })
      .in('id', retireIds)
  }

  const { data: kb, error: insertError } = await supabase
    .from('campaign_knowledge_base')
    .insert({
      campaign_id,
      client_id: campaign.client_id,
      title: `${campaign.name} — ${sourceLabel}`,
      content,
      is_active: true,
      type: 'knowledge',
      campaign_name: campaign.name,
      source_type: 'listing',
      source_label: sourceLabel,
      scope: kbScope,
      review_status: 'approved',
      source_url: listingUrl,
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .select()
    .single()

  if (insertError) return res.status(500).json({ error: insertError.message })
  return res.status(200).json({ kb })
}
