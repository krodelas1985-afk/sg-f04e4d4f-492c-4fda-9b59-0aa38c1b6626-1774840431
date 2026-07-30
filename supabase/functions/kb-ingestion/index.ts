import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getDocumentProxy, extractText } from "npm:unpdf"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
// SUPABASE_SECRET_KEYS is a JSON object keyed by key name, unlike the legacy
// SUPABASE_SERVICE_ROLE_KEY string it replaces.
const SECRET_KEY = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")["default"] ?? ""
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? ""

const CHUNK_SIZE = 375
const OVERLAP = 37
const BATCH_SIZE = 20

Deno.serve(async (req: Request) => {
  const supabase = createClient(SUPABASE_URL, SECRET_KEY)
  let document_id: string | undefined

  try {
    const body = await req.json()
    document_id = body.document_id
    const { file_url, client_id, file_type, campaign_id } = body

    if (!document_id) throw new Error("Missing document_id")
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY secret not set — add it in Supabase Dashboard > Project Settings > Edge Functions > Secrets")

    // Delete any existing chunks (supports re-ingestion)
    await supabase.from("kb_chunks").delete().eq("document_id", document_id)

    // Resolve path within the knowledge-base storage bucket
    let storagePath = String(file_url ?? "")
    if (storagePath.startsWith("http")) {
      const m = storagePath.match(/knowledge-base\/(.+)/)
      storagePath = m ? m[1] : storagePath
    }

    // Download directly — the secret key has full storage access, no signed URL needed
    const { data: fileBlob, error: dlErr } = await supabase.storage
      .from("knowledge-base")
      .download(storagePath)
    if (dlErr) throw new Error(`Storage download failed: ${dlErr.message}`)

    // Extract text
    let fullText = ""
    const ftype = String(file_type ?? "").toLowerCase()

    if (ftype.includes("pdf")) {
      const buf = await fileBlob.arrayBuffer()
      const pdf = await getDocumentProxy(new Uint8Array(buf))
      const { text } = await extractText(pdf, { mergePages: true })
      fullText = Array.isArray(text) ? text.join(" ") : text
    } else {
      // TXT or plain text fallback
      fullText = await fileBlob.text()
    }

    fullText = fullText.trim()
    if (!fullText) throw new Error("No text extracted from document")

    // Chunk
    const words = fullText.split(/\s+/).filter((w) => w.length > 0)
    const chunks: Array<{ chunk_index: number; content: string; token_count: number }> = []
    for (let i = 0, ci = 0; i < words.length; i += CHUNK_SIZE - OVERLAP, ci++) {
      const content = words.slice(i, i + CHUNK_SIZE).join(" ")
      chunks.push({ chunk_index: ci, content, token_count: Math.ceil(content.length / 4) })
    }
    if (chunks.length === 0) throw new Error("Chunking produced 0 chunks")

    // Embed + insert in batches of 20
    for (let b = 0; b < chunks.length; b += BATCH_SIZE) {
      const batch = chunks.slice(b, b + BATCH_SIZE)

      const embedResp = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: batch.map((c) => c.content),
        }),
      })
      const embedData = await embedResp.json()
      if (!embedData.data) throw new Error(`OpenAI embedding failed: ${JSON.stringify(embedData)}`)

      const { error: insErr } = await supabase.from("kb_chunks").insert(
        batch.map((c, idx) => ({
          document_id,
          client_id,
          campaign_id,
          chunk_index: c.chunk_index,
          content: c.content,
          token_count: c.token_count,
          embedding: JSON.stringify(embedData.data[idx].embedding),
        }))
      )
      if (insErr) throw new Error(`kb_chunks insert failed: ${insErr.message}`)
    }

    // Mark document ready
    await supabase
      .from("kb_documents")
      .update({ status: "ready" })
      .eq("id", document_id)

    console.log(`[kb-ingestion] OK: document=${document_id} chunks=${chunks.length}`)
    return new Response(
      JSON.stringify({ ok: true, chunks_inserted: chunks.length }),
      { headers: { "Content-Type": "application/json" } }
    )

  } catch (err) {
    console.error("[kb-ingestion] ERROR:", err)
    if (document_id) {
      await supabase
        .from("kb_documents")
        .update({ status: "failed" })
        .eq("id", document_id)
        .catch(() => {})
    }
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
