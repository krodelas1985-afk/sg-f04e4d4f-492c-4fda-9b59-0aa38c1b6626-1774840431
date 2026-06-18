import DOMMatrixPolyfill from '@thednp/dommatrix'

// pdf-parse → pdfjs-dist needs a `DOMMatrix` global in Node. By default pdf-parse
// pulls one from the native `@napi-rs/canvas` module, which fails to load in the
// Vercel serverless runtime → "DOMMatrix is not defined". pdf-parse uses
// `globalThis.DOMMatrix` if it is already set, so we provide a pure-JS one here
// (set at module load, before pdf-parse is dynamically imported). Text extraction
// only constructs/multiplies matrices; the canvas-only methods (invertSelf, Path2D)
// are never reached on the getText() path.
if (typeof (globalThis as { DOMMatrix?: unknown }).DOMMatrix === 'undefined') {
  ;(globalThis as { DOMMatrix?: unknown }).DOMMatrix = DOMMatrixPolyfill
}

export type ExtractFileType = 'pdf' | 'docx' | 'txt' | 'md'

const MIME_TO_TYPE: Record<string, ExtractFileType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'text/markdown': 'md',
}

export function detectFileType(mime: string, filename: string): ExtractFileType | null {
  if (MIME_TO_TYPE[mime]) return MIME_TO_TYPE[mime]
  const lower = filename.toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.docx')) return 'docx'
  if (lower.endsWith('.md')) return 'md'
  if (lower.endsWith('.txt')) return 'txt'
  return null
}

export async function extractDocumentText(buffer: Buffer, type: ExtractFileType): Promise<string> {
  if (type === 'pdf') {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()
    return result.text ?? ''
  }
  if (type === 'docx') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value ?? ''
  }
  return buffer.toString('utf-8')
}

export const EXTRACTED_TEXT_CAP = 16000
