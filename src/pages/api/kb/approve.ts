import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerClient } from '@/lib/supabase/server'

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

  const { kb_id, proposed_content } = req.body
  if (!kb_id) return res.status(400).json({ error: 'kb_id is required' })
  if (!proposed_content?.trim()) return res.status(400).json({ error: 'proposed_content is required' })

  // Fetch the KB row to verify access
  const { data: kbRow } = await supabase
    .from('campaign_knowledge_base').select('id, client_id').eq('id', kb_id).single()
  if (!kbRow) return res.status(404).json({ error: 'KB entry not found' })
  if (profile.role !== 'baymo_admin' && kbRow.client_id !== profile.client_id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { data: kb, error } = await supabase
    .from('campaign_knowledge_base')
    .update({
      content: proposed_content.trim(),
      review_status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq('id', kb_id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ kb })
}
