import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerClient } from '@/lib/supabase/server'

type KbFields = {
  project_name?: string
  location?: string
  pricing?: string
  financing?: string
  promos?: string
  amenities?: string
  turnover?: string
  reservation?: string
  viewing?: string
  contact?: string
  other?: string
  custom?: Array<{ label: string; value: string }>
}

function composeKbContent(f: KbFields): string {
  const fixed: [string, string | undefined][] = [
    ['PROJECT / OFFERING', f.project_name],
    ['LOCATION', f.location],
    ['PRICING & UNITS', f.pricing],
    ['FINANCING', f.financing],
    ['PROMOS / DISCOUNTS', f.promos],
    ['AMENITIES', f.amenities],
    ['TURNOVER', f.turnover],
    ['RESERVATION', f.reservation],
    ['VIEWING', f.viewing],
    ['CONTACT', f.contact],
    ['OTHER', f.other],
  ]
  const lines: string[] = []
  for (const [label, val] of fixed) {
    if (val?.trim()) lines.push(`${label}:\n${val.trim()}`)
  }
  for (const c of f.custom ?? []) {
    if (c.label?.trim() && c.value?.trim()) {
      lines.push(`${c.label.trim().toUpperCase()}:\n${c.value.trim()}`)
    }
  }
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
  const supabase = createServerClient()
  const user = await getAuthUser(req, supabase)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: profile } = await supabase
    .from('profiles').select('role, client_id').eq('id', user.id).single()
  if (!profile) return res.status(403).json({ error: 'Forbidden' })

  const campaignId = req.query.campaign_id as string
  if (!campaignId) return res.status(400).json({ error: 'campaign_id is required' })

  // ── GET — fetch active KB row ──────────────────────────────────────────────
  if (req.method === 'GET') {
    let query = supabase
      .from('campaign_knowledge_base')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)

    if (profile.role !== 'baymo_admin') {
      query = query.eq('client_id', profile.client_id!)
    }

    const { data, error } = await query.maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ kb: data })
  }

  // ── POST — field-entry save ────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { fields, availability_status, promo_valid_until } = req.body

    const { data: campaign } = await supabase
      .from('campaigns').select('id, client_id, name').eq('id', campaignId).single()
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
    if (profile.role !== 'baymo_admin' && campaign.client_id !== profile.client_id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const kbFields = fields as KbFields
    const content = composeKbContent(kbFields)

    await supabase
      .from('campaign_knowledge_base')
      .update({ is_active: false })
      .eq('campaign_id', campaignId)
      .eq('is_active', true)

    const { data, error } = await supabase
      .from('campaign_knowledge_base')
      .insert({
        campaign_id: campaignId,
        client_id: campaign.client_id,
        title: campaign.name,
        content,
        is_active: true,
        type: 'knowledge',
        campaign_name: campaign.name,
        source_type: 'field',
        review_status: 'approved',
        fields: kbFields,
        availability_status: availability_status || null,
        promo_valid_until: promo_valid_until || null,
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ kb: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
