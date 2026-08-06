import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerClient } from '@/lib/supabase/server'
import { getCampaignKbReadiness, kbBlockReason } from '@/lib/kb/readiness'

/**
 * Whether this campaign's conversational AI has anything to answer from.
 * Powers the campaign-page banner so an operator sees "KB is empty / still
 * pending review" before they flip the campaign live, not after the bot has
 * spent four days inventing prices (incident 2026-08-06).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const campaignId = req.query.id
  if (typeof campaignId !== 'string') {
    return res.status(400).json({ error: 'Campaign ID required' })
  }

  const supabase = createServerClient()

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error: authError } =
    await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: profile } = await supabase
    .from('profiles').select('role, client_id').eq('id', user.id).single()
  if (!profile) return res.status(403).json({ error: 'Forbidden' })

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, client_id, status, conversational_ai_enabled')
    .eq('id', campaignId)
    .single()
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  if (profile.role !== 'baymo_admin' && campaign.client_id !== profile.client_id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const readiness = await getCampaignKbReadiness(campaign.id, campaign.client_id)
    const liveWithAi =
      campaign.status === 'active' && !!campaign.conversational_ai_enabled

    return res.status(200).json({
      ...readiness,
      // Already live and answering leads from nothing — this is the incident
      // state, not a warning about a future one.
      serving_empty: liveWithAi && !readiness.ready,
      reason: kbBlockReason(readiness),
    })
  } catch (err) {
    console.error('KB readiness check failed:', err)
    return res.status(500).json({ error: 'Could not verify the campaign knowledge base' })
  }
}
