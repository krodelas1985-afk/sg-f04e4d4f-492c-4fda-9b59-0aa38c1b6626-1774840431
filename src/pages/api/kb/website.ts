import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerClient } from '@/lib/supabase/server'
import { fetchUrlContent, FETCH_URL_ERRORS } from '@/lib/kb/fetch-url'

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

  const { campaign_id, source_url } = req.body
  if (!campaign_id) return res.status(400).json({ error: 'campaign_id is required' })
  if (!source_url?.trim()) return res.status(400).json({ error: 'source_url is required' })

  const { data: campaign } = await supabase
    .from('ad_campaigns').select('id, client_id, name').eq('id', campaign_id).single()
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
  if (profile.role !== 'baymo_admin' && campaign.client_id !== profile.client_id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const result = await fetchUrlContent(source_url.trim())
  if (result.ok === false) {
    return res.status(422).json({ error: FETCH_URL_ERRORS[result.reason] ?? 'Failed to fetch website.' })
  }

  // Deactivate existing active KB rows
  await supabase
    .from('campaign_knowledge_base')
    .update({ is_active: false })
    .eq('campaign_id', campaign_id)
    .eq('is_active', true)

  const { data: kb, error: insertError } = await supabase
    .from('campaign_knowledge_base')
    .insert({
      campaign_id,
      client_id: campaign.client_id,
      title: campaign.name,
      content: '',
      is_active: true,
      type: 'knowledge',
      campaign_name: campaign.name,
      source_type: 'website',
      review_status: 'pending',
      source_url: source_url.trim(),
      source_text: result.text,
    })
    .select()
    .single()

  if (insertError) return res.status(500).json({ error: insertError.message })
  return res.status(200).json({ kb })
}
