import * as cheerio from 'cheerio'

export type FetchUrlResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'invalid_url' | 'timeout' | 'fetch_failed' | 'too_small' | 'blocked' }

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const TIMEOUT_MS = 8000

export async function fetchUrlContent(url: string): Promise<FetchUrlResult> {
  // Validate — https only
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, reason: 'invalid_url' }
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'invalid_url' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'BaMo-CRM/1.0 (+https://bahaymo.com)' },
    })
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, reason: 'timeout' }
    }
    return { ok: false, reason: 'fetch_failed' }
  }
  clearTimeout(timer)

  if (!response.ok) {
    if (response.status === 401 || response.status === 403 || response.status === 429) {
      return { ok: false, reason: 'blocked' }
    }
    return { ok: false, reason: 'fetch_failed' }
  }

  const reader = response.body?.getReader()
  if (!reader) return { ok: false, reason: 'fetch_failed' }

  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      chunks.push(value)
      totalBytes += value.byteLength
      if (totalBytes > MAX_BYTES) {
        reader.cancel()
        break
      }
    }
  } catch {
    return { ok: false, reason: 'fetch_failed' }
  }

  const buffer = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    buffer.set(chunk, offset)
    offset += chunk.byteLength
  }
  const html = new TextDecoder().decode(buffer)

  const $ = cheerio.load(html)
  $('script, style, nav, footer, header, noscript, iframe, svg').remove()
  const bodyText = ($('body').text() || $.text()).replace(/\s+/g, ' ').trim()

  if (bodyText.length < 200) {
    return { ok: false, reason: 'too_small' }
  }

  const text = bodyText.length > 8000 ? bodyText.slice(0, 8000) + '...' : bodyText
  return { ok: true, text }
}

export const FETCH_URL_ERRORS: Record<string, string> = {
  invalid_url: 'Invalid URL — must be a valid https:// address.',
  timeout: 'The website timed out. Try again or use a different source.',
  fetch_failed: 'Could not fetch the website. Check the URL and try again.',
  too_small: 'The page has too little text to extract. Try a more detailed page.',
  blocked: 'The website blocked access. Try uploading a document instead.',
}
