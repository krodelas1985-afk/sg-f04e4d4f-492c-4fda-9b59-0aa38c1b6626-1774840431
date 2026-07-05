import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fs from 'fs'
import { createServerClient } from '@/lib/supabase/server'
import { extractDocumentText, detectFileType } from '@/lib/kb/extract-document'

export const config = { api: { bodyParser: false } }

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
])

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

  // Parse multipart form
  const form = formidable({ maxFileSize: 52_428_800 })
  let fields: formidable.Fields
  let files: formidable.Files
  try {
    ;[fields, files] = await form.parse(req)
  } catch {
    return res.status(400).json({ error: 'Failed to parse upload' })
  }

  const campaignId = Array.isArray(fields.campaign_id) ? fields.campaign_id[0] : fields.campaign_id
  if (!campaignId) return res.status(400).json({ error: 'campaign_id is required' })
  const rawScope = Array.isArray(fields.scope) ? fields.scope[0] : fields.scope
  const kbScope = rawScope === 'client' ? 'client' : 'campaign'

  const fileArr = files.file
  const uploadedFile = Array.isArray(fileArr) ? fileArr[0] : fileArr
  if (!uploadedFile) return res.status(400).json({ error: 'file is required' })

  const mimeType = uploadedFile.mimetype ?? ''
  if (!ALLOWED_TYPES.has(mimeType)) {
    return res.status(400).json({ error: 'Only PDF, DOCX, and TXT files are allowed' })
  }

  const { data: campaign } = await supabase
    .from('campaigns').select('id, client_id, name').eq('id', campaignId).single()
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
  if (profile.role !== 'baymo_admin' && campaign.client_id !== profile.client_id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const buffer = fs.readFileSync(uploadedFile.filepath)
  const origName = uploadedFile.originalFilename ?? 'upload.bin'
  const fileType = detectFileType(mimeType, origName) ?? 'txt'

  let source_text = ''
  try {
    source_text = await extractDocumentText(buffer, fileType)
  } catch (err: any) {
    console.error('KB extraction error:', err)
    return res.status(422).json({ error: `Failed to extract text: ${err?.message || 'unknown error'}` })
  }

  const ext = origName.split('.').pop()?.toLowerCase() ?? fileType
  const storagePath = `${campaignId}/${Date.now()}.${ext}`
  const raw_document_path = `kb-docs/${storagePath}`

  const { error: uploadError } = await supabase.storage
    .from('kb-docs')
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false })

  if (uploadError) return res.status(500).json({ error: uploadError.message })

  // Deactivate existing active KB rows
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

  const { data: kb, error: insertError } = await supabase
    .from('campaign_knowledge_base')
    .insert({
      campaign_id: campaignId,
      client_id: campaign.client_id,
      title: campaign.name,
      content: '',
      is_active: true,
      type: 'knowledge',
      campaign_name: campaign.name,
      source_type: 'document',
      scope: kbScope,
      review_status: 'pending',
      raw_document_path,
      source_text,
    })
    .select()
    .single()

  if (insertError) return res.status(500).json({ error: insertError.message })
  return res.status(200).json({ kb })
}
