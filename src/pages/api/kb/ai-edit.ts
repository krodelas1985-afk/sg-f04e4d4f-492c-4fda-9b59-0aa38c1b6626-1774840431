import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a real estate knowledge base editor for Philippine property campaigns.
You will receive a fact sheet and a change request. Apply the requested change and return the updated fact sheet.

Rules:
- Preserve all existing sections not affected by the change
- Keep the same heading format (SECTION NAME:\\n content)
- Do not add commentary or explanations — just the updated fact sheet
- If asked to remove something, remove only that item
- If asked to add something, add it in the appropriate section

After the fact sheet, output exactly:
===REVIEW_NOTES===
Then list any MISSING:, CONFLICTS:, or UNSURE: flags in the updated content.
If none, write: All facts appear complete and consistent.`

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

  const { kb_id, proposed_content, change_request } = req.body
  if (!kb_id) return res.status(400).json({ error: 'kb_id is required' })
  if (!change_request?.trim()) return res.status(400).json({ error: 'change_request is required' })

  // Verify access
  const { data: kbRow } = await supabase
    .from('campaign_knowledge_base').select('id, client_id').eq('id', kb_id).single()
  if (!kbRow) return res.status(404).json({ error: 'KB entry not found' })
  if (profile.role !== 'baymo_admin' && kbRow.client_id !== profile.client_id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const userMessage = `CURRENT FACT SHEET:\n"""\n${proposed_content ?? ''}\n"""\n\nCHANGE REQUEST: ${change_request.trim()}\n\nApply the change and return the updated fact sheet.`

  let responseText = ''
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })
    const block = message.content[0]
    responseText = block.type === 'text' ? block.text : ''
  } catch (err) {
    console.error('Anthropic error:', err)
    return res.status(500).json({ error: 'AI edit failed' })
  }

  const marker = '===REVIEW_NOTES==='
  const idx = responseText.indexOf(marker)
  const newProposedContent = idx >= 0 ? responseText.slice(0, idx).trim() : responseText.trim()
  const newReviewNotes = idx >= 0 ? responseText.slice(idx + marker.length).trim() : ''

  const { error: updateError } = await supabase
    .from('campaign_knowledge_base')
    .update({ proposed_content: newProposedContent, review_notes: newReviewNotes })
    .eq('id', kb_id)

  if (updateError) return res.status(500).json({ error: updateError.message })
  return res.status(200).json({ proposed_content: newProposedContent, review_notes: newReviewNotes })
}
