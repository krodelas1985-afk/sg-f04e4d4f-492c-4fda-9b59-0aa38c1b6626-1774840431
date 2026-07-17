import Anthropic from '@anthropic-ai/sdk'

// Vision-based KB extraction: brochure/price-list images, or scanned PDFs whose
// text layer is empty (pdf-parse gets nothing to read). Runs in-app — the DB
// trigger skips n8n extraction when proposed_content is preset.

export type VisionImageType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'

export const VISION_IMAGE_TYPES = new Set<string>([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
])

// Claude API per-image limit
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_IMAGES_PER_SOURCE = 8

// Below this many characters of extracted text, a PDF is treated as scanned
// (image-based) and routed through vision instead.
export const SCANNED_PDF_TEXT_THRESHOLD = 200

const SYSTEM_PROMPT = `You extract a real-estate campaign fact sheet from the attached marketing material (brochure photos, price lists, or a scanned PDF) for a Philippine property campaign. The fact sheet feeds an AI assistant that answers property leads, so accuracy matters more than completeness.

Rules:
- Extract ONLY facts visible in the material. NEVER invent, estimate, or round numbers.
- Keep prices, floor/lot areas, fees, and dates EXACTLY as printed.
- Organize into sections with this exact heading format, omitting sections with no facts:
PROJECT / OFFERING:
LOCATION:
PRICING & UNITS:
FINANCING:
PROMOS / DISCOUNTS:
AMENITIES:
TURNOVER:
RESERVATION:
VIEWING:
CONTACT:
OTHER:
- If text is unreadable, cut off, or ambiguous, flag it in the review notes — do not guess.

After the fact sheet, output exactly:
===REVIEW_NOTES===
Then list any MISSING: (expected info not present), CONFLICTS: (contradictions within the material), or UNSURE: (unreadable/ambiguous items) flags.
If none, write: All facts appear complete and consistent.`

const REVIEW_MARKER = '===REVIEW_NOTES==='

export interface VisionExtractionResult {
  proposed_content: string
  review_notes: string
}

function splitResponse(responseText: string): VisionExtractionResult {
  const idx = responseText.indexOf(REVIEW_MARKER)
  return {
    proposed_content: idx >= 0 ? responseText.slice(0, idx).trim() : responseText.trim(),
    review_notes: idx >= 0 ? responseText.slice(idx + REVIEW_MARKER.length).trim() : '',
  }
}

async function runExtraction(
  content: Anthropic.Messages.ContentBlockParam[]
): Promise<VisionExtractionResult> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  })
  const block = message.content[0]
  const text = block?.type === 'text' ? block.text : ''
  if (!text.trim()) throw new Error('Vision extraction returned no text')
  return splitResponse(text)
}

export async function extractFromImages(
  images: { buffer: Buffer; mimeType: string }[]
): Promise<VisionExtractionResult> {
  const content: Anthropic.Messages.ContentBlockParam[] = images.map(img => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: img.mimeType as VisionImageType,
      data: img.buffer.toString('base64'),
    },
  }))
  content.push({
    type: 'text' as const,
    text: 'Extract the campaign fact sheet from these images.',
  })
  return runExtraction(content)
}

export async function extractFromScannedPdf(buffer: Buffer): Promise<VisionExtractionResult> {
  return runExtraction([
    {
      type: 'document' as const,
      source: {
        type: 'base64' as const,
        media_type: 'application/pdf' as const,
        data: buffer.toString('base64'),
      },
    },
    {
      type: 'text' as const,
      text: 'This PDF has no machine-readable text layer (scanned). Extract the campaign fact sheet from its pages.',
    },
  ])
}
