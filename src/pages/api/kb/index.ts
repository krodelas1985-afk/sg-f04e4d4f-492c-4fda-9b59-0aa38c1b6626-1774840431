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

  // ── PUT — edit an approved KB entry (creates a new approved version) ───────
  if (req.method === 'PUT') {
    const { kb_id, content } = req.body
    if (!kb_id) return res.status(400).json({ error: 'kb_id is required' })
    if (!content?.trim()) return res.status(400).json({ error: 'content is required' })

    const { data: kbRow } = await supabase
      .from('campaign_knowledge_base').select('*').eq('id', kb_id).single()
    if (!kbRow) return res.status(404).json({ error: 'KB entry not found' })
    if (profile.role !== 'baymo_admin' && kbRow.client_id !== profile.client_id) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (kbRow.review_status !== 'approved') {
      return res.status(400).json({ error: 'Only approved KB entries can be edited' })
    }

    await supabase
      .from('campaign_knowledge_base')
      .update({ is_active: false })
      .eq('id', kb_id)

    const { data, error } = await supabase
      .from('campaign_knowledge_base')
      .insert({
        campaign_id: kbRow.campaign_id,
        client_id: kbRow.client_id,
        title: kbRow.title,
        content: content.trim(),
        is_active: true,
        type: kbRow.type,
        campaign_name: kbRow.campaign_name,
        source_type: kbRow.source_type,
        scope: kbRow.scope,
        fields: kbRow.fields,
        availability_status: kbRow.availability_status,
        promo_valid_until: kbRow.promo_valid_until,
        raw_document_path: kbRow.raw_document_path,
        raw_document_paths: kbRow.raw_document_paths,
        source_url: kbRow.source_url,
        source_label: kbRow.source_label,
        source_text: kbRow.source_text,
        review_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ kb: data })
  }

  const campaignId = req.query.campaign_id as string
  if (!campaignId) return res.status(400).json({ error: 'campaign_id is required' })

  // ── GET — fetch active KB row (campaign-specific, else client-shared) ──────
  if (req.method === 'GET') {
    const { data: campaign } = await supabase
      .from('campaigns').select('id, client_id').eq('id', campaignId).single()
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
    if (profile.role !== 'baymo_admin' && campaign.client_id !== profile.client_id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { data: rows, error } = await supabase
      .from('campaign_knowledge_base')
      .select('*')
      .or(`campaign_id.eq.${campaignId},and(scope.eq.client,client_id.eq.${campaign.client_id})`)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    // Prefer this campaign's own KB; fall back to a client-shared KB from another campaign
    const kb = rows?.find(r => r.campaign_id === campaignId) ?? rows?.[0] ?? null
    return res.status(200).json({ kb })
  }

  // ── POST — field-entry save ────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { fields, availability_status, promo_valid_until, scope } = req.body
    const kbScope = scope === 'client' ? 'client' : 'campaign'

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

    // A client-shared KB replaces any previous client-shared KB (from any campaign)
    if (kbScope === 'client') {
      await supabase
        .from('campaign_knowledge_base')
        .update({ is_active: false })
        .eq('client_id', campaign.client_id)
        .eq('scope', 'client')
        .eq('is_active', true)
    }

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
        scope: kbScope,
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
