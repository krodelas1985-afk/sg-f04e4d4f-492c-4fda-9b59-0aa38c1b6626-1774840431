// agent-website-lead — public lead-form endpoint for BaMo agent landing pages.
// Replaces the planned n8n Workflow A (n8n API keys lapsed; edge fn is always-on).
// Auth model: public webhook (verify_jwt=false) with honeypot + validation +
// per-client existence check; writes go through the secret key.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const clip = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'POST only' })

  let payload: Record<string, unknown>
  try {
    const ct = req.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      payload = await req.json()
    } else {
      // Plain HTML <form> posts arrive as form-encoded
      const form = await req.formData()
      payload = Object.fromEntries(form.entries())
    }
  } catch {
    return json(400, { error: 'Invalid body' })
  }

  // Honeypot: hidden "website" field — bots fill it, humans don't.
  if (clip(payload.website, 10)) return json(200, { ok: true })

  const clientId = clip(payload.client_id, 40)
  const name = clip(payload.lead_name ?? payload.name, 120)
  const email = clip(payload.lead_email ?? payload.email, 160)
  const phone = clip(payload.lead_phone ?? payload.phone, 40)
  const message = clip(payload.message, 2000)
  const propertyInterest = clip(payload.property_interest, 300)

  if (!UUID_RE.test(clientId)) return json(400, { error: 'client_id must be a valid id' })
  if (!name) return json(400, { error: 'lead_name is required' })
  if (!email && !phone) return json(400, { error: 'Provide at least an email or phone' })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default'],
  )

  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', clientId)
    .maybeSingle()
  if (!client) return json(400, { error: 'Unknown client' })

  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .insert({
      client_id: clientId,
      name,
      email: email || null,
      phone: phone || null,
      source: 'agent_website',
      source_override: true,
      primary_channel: 'website',
      // status/lead_temperature use table defaults ('New' / 'Cold' — capitalized)
      metadata: { message, property_interest: propertyInterest, via: 'agent_website_form' },
    })
    .select('id')
    .single()
  if (leadErr) {
    console.error('lead insert failed', leadErr.message)
    return json(500, { error: 'Could not save inquiry' })
  }

  // Notify the workspace's client_admins + all active baymo_admins. Best-effort.
  try {
    const { data: recipients } = await supabase
      .from('profiles')
      .select('id, role, client_id')
      .or(`and(role.eq.client_admin,client_id.eq.${clientId}),role.eq.baymo_admin`)
    const rows = (recipients ?? []).map((r) => ({
      user_id: r.id,
      client_id: clientId,
      type: 'agent_website_lead',
      title: 'New website lead',
      body: `${name}${propertyInterest ? ` — ${propertyInterest}` : ''}`,
      data: { lead_id: lead.id, source: 'agent_website' },
    }))
    if (rows.length) await supabase.from('notifications').insert(rows)
  } catch (e) {
    console.error('notification insert failed', e)
  }

  return json(200, { ok: true, lead_id: lead.id })
})
