import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fs from 'fs'
import { createServerClient } from '@/lib/supabase/server'
import { extractDocumentText, detectFileType } from '@/lib/kb/extract-document'
import {
  VISION_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES_PER_SOURCE,
  SCANNED_PDF_TEXT_THRESHOLD, extractFromImages, extractFromScannedPdf,
} from '@/lib/kb/vision-extract'

// Vision extraction (images / scanned PDFs) can take a while
export const config = { api: { bodyParser: false }, maxDuration: 60 }

const DOC_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
])

// Claude API limit for PDFs sent as document blocks
const MAX_VISION_PDF_BYTES = 32 * 1024 * 1024

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
  const form = formidable({ maxFileSize: 52_428_800, maxFiles: MAX_IMAGES_PER_SOURCE })
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
  const replaceKbId = Array.isArray(fields.replace_kb_id) ? fields.replace_kb_id[0] : fields.replace_kb_id

  const fileArr = files.file
  const uploaded = (Array.isArray(fileArr) ? fileArr : fileArr ? [fileArr] : []).filter(Boolean)
  if (uploaded.length === 0) return res.status(400).json({ error: 'file is required' })

  const isImage = (f: formidable.File) => VISION_IMAGE_TYPES.has(f.mimetype ?? '')
  const images = uploaded.filter(isImage)
  const docs = uploaded.filter(f => !isImage(f))

  if (images.length > 0 && docs.length > 0) {
    return res.status(400).json({ error: 'Upload images and documents as separate sources.' })
  }
  if (docs.length > 1) {
    return res.status(400).json({ error: 'Upload one document at a time.' })
  }
  if (images.length > MAX_IMAGES_PER_SOURCE) {
    return res.status(400).json({ error: `Maximum ${MAX_IMAGES_PER_SOURCE} images per source.` })
  }
  for (const img of images) {
    if ((img.size ?? 0) > MAX_IMAGE_BYTES) {
      return res.status(400).json({ error: `Each image must be under 5 MB (${img.originalFilename ?? 'image'} is too large).` })
    }
  }
  if (docs.length === 1 && !DOC_TYPES.has(docs[0].mimetype ?? '')) {
    return res.status(400).json({ error: 'Only PDF, DOCX, TXT, or PNG/JPG/WebP images are allowed' })
  }

  const { data: campaign } = await supabase
    .from('campaigns').select('id, client_id, name').eq('id', campaignId).single()
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
  if (profile.role !== 'baymo_admin' && campaign.client_id !== profile.client_id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  async function storeFile(file: formidable.File, buffer: Buffer, index: number) {
    const origName = file.originalFilename ?? 'upload.bin'
    const ext = origName.split('.').pop()?.toLowerCase() ?? 'bin'
    const storagePath = `${campaignId}/${Date.now()}-${index}.${ext}`
    const { error } = await supabase.storage
      .from('kb-docs')
      .upload(storagePath, buffer, { contentType: file.mimetype ?? 'application/octet-stream', upsert: false })
    if (error) throw new Error(error.message)
    return `kb-docs/${storagePath}`
  }

  // ── Image source: in-app vision extraction ─────────────────────────────────
  if (images.length > 0) {
    const buffers = images.map(f => ({ buffer: fs.readFileSync(f.filepath), mimeType: f.mimetype! }))

    let extraction
    try {
      extraction = await extractFromImages(buffers)
    } catch (err) {
      console.error('KB image extraction error:', err)
      return res.status(422).json({ error: 'AI could not read the images. Try clearer photos or fewer images.' })
    }

    let paths: string[]
    try {
      paths = await Promise.all(images.map((f, i) => storeFile(f, buffers[i].buffer, i)))
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Storage upload failed' })
    }

    const firstName = images[0].originalFilename ?? 'image'
    const sourceLabel = images.length === 1 ? firstName : `${firstName} +${images.length - 1} more`

    const { data: kb, error: insertError } = await supabase
      .from('campaign_knowledge_base')
      .insert({
        campaign_id: campaignId,
        client_id: campaign.client_id,
        title: `${campaign.name} — ${sourceLabel}`,
        content: '',
        is_active: true,
        type: 'knowledge',
        campaign_name: campaign.name,
        source_type: 'image',
        source_label: sourceLabel,
        scope: kbScope,
        review_status: 'pending',
        raw_document_path: paths[0],
        raw_document_paths: paths,
        proposed_content: extraction.proposed_content,
        review_notes: extraction.review_notes,
        replaces_kb_id: replaceKbId ?? null,
      })
      .select()
      .single()

    if (insertError) return res.status(500).json({ error: insertError.message })
    return res.status(200).json({ kb })
  }

  // ── Document source (PDF / DOCX / TXT) ─────────────────────────────────────
  const uploadedFile = docs[0]
  const mimeType = uploadedFile.mimetype ?? ''
  const buffer = fs.readFileSync(uploadedFile.filepath)
  const origName = uploadedFile.originalFilename ?? 'upload.bin'
  const fileType = detectFileType(mimeType, origName) ?? 'txt'

  let source_text = ''
  try {
    source_text = await extractDocumentText(buffer, fileType)
  } catch (err) {
    console.error('KB extraction error:', err)
    return res.status(422).json({ error: `Failed to extract text: ${err instanceof Error ? err.message : 'unknown error'}` })
  }

  // Scanned PDF (no text layer) → vision fallback; proposed_content is preset
  // so the DB trigger skips the n8n text-extraction webhook.
  let visionExtraction: { proposed_content: string; review_notes: string } | null = null
  if (fileType === 'pdf' && source_text.trim().length < SCANNED_PDF_TEXT_THRESHOLD) {
    if (buffer.length > MAX_VISION_PDF_BYTES) {
      return res.status(422).json({ error: 'This PDF has no readable text and is too large for image extraction (max 32 MB). Try exporting it smaller or uploading page photos instead.' })
    }
    try {
      visionExtraction = await extractFromScannedPdf(buffer)
    } catch (err) {
      console.error('KB scanned-PDF extraction error:', err)
      return res.status(422).json({ error: 'This PDF has no readable text and AI could not read the scan. Try a clearer copy or upload page photos instead.' })
    }
  }

  let raw_document_path: string
  try {
    raw_document_path = await storeFile(uploadedFile, buffer, 0)
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Storage upload failed' })
  }

  // Additive: other sources stay active. If replace_kb_id is set, the old row
  // stays live until this extraction is approved (approve.ts retires it).
  const { data: kb, error: insertError } = await supabase
    .from('campaign_knowledge_base')
    .insert({
      campaign_id: campaignId,
      client_id: campaign.client_id,
      title: `${campaign.name} — ${origName}`,
      content: '',
      is_active: true,
      type: 'knowledge',
      campaign_name: campaign.name,
      source_type: 'document',
      source_label: origName,
      scope: kbScope,
      review_status: 'pending',
      raw_document_path,
      source_text,
      proposed_content: visionExtraction?.proposed_content ?? null,
      review_notes: visionExtraction?.review_notes ?? null,
      replaces_kb_id: replaceKbId ?? null,
    })
    .select()
    .single()

  if (insertError) return res.status(500).json({ error: insertError.message })
  return res.status(200).json({ kb })
}
