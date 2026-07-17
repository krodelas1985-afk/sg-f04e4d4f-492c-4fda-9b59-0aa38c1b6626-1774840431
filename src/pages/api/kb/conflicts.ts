import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You compare a NEW fact sheet against the EXISTING knowledge-base sources of the same Philippine real-estate campaign.

List only direct factual CONTRADICTIONS — the same item stated with different values (price/TCP, floor or lot area, fees, dates, turnover, contact details, promo terms). Information that appears in one source but not the other is NOT a conflict. Ignore wording differences.

Return ONLY JSON: {"conflicts": ["<one short sentence per conflict, naming both values and their sources>"]}
If there are none: {"conflicts": []}`

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

  const { kb_id, content } = req.body
  if (!kb_id) return res.status(400).json({ error: 'kb_id is required' })
  if (!content?.trim()) return res.status(400).json({ error: 'content is required' })

  const { data: kbRow } = await supabase
    .from('campaign_knowledge_base')
    .select('id, client_id, campaign_id, replaces_kb_id, source_label, source_type')
    .eq('id', kb_id).single()
  if (!kbRow) return res.status(404).json({ error: 'KB entry not found' })
  if (profile.role !== 'baymo_admin' && kbRow.client_id !== profile.client_id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  // Other approved active sources this content will be combined with
  const { data: others } = await supabase
    .from('campaign_knowledge_base')
    .select('id, content, source_label, source_type')
    .or(`campaign_id.eq.${kbRow.campaign_id},and(scope.eq.client,client_id.eq.${kbRow.client_id})`)
    .eq('is_active', true)
    .eq('review_status', 'approved')
    .neq('id', kb_id)

  const existing = (others ?? []).filter(
    o => o.id !== kbRow.replaces_kb_id && o.content?.trim()
  )
  if (existing.length === 0) return res.status(200).json({ conflicts: [] })

  const existingBlock = existing
    .map(o => `--- SOURCE: ${o.source_label ?? o.source_type ?? 'unknown'} ---\n${o.content}`)
    .join('\n\n')
  const newLabel = kbRow.source_label ?? kbRow.source_type ?? 'new source'

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `EXISTING SOURCES:\n${existingBlock}\n\nNEW FACT SHEET (source: ${newLabel}):\n"""\n${content.trim()}\n"""\n\nReturn the JSON.`,
      }],
    })
    const block = message.content[0]
    let text = block.type === 'text' ? block.text.trim() : ''
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const parsed = JSON.parse(text)
    const conflicts = Array.isArray(parsed.conflicts)
      ? parsed.conflicts.filter((c: unknown) => typeof c === 'string')
      : []
    return res.status(200).json({ conflicts })
  } catch (err) {
    console.error('KB conflict check error:', err)
    // Fail-open: a broken checker must never block a save/approve
    return res.status(200).json({ conflicts: [], check_failed: true })
  }
}
