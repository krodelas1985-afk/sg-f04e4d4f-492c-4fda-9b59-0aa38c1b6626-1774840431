// bamo-kb-catalog — read-only access to campaign knowledge bases, for the
// Marketplace curator app.
//
// WHY THIS EXISTS. Assisted intake should be able to build a listing from what
// an agent's Campaign Engine knowledge base already says, rather than making a
// curator retype it. The Marketplace is a separate Supabase project and cannot
// query this database directly (Identity Standard §27/§32), so the CRM exposes
// exactly what it is willing to share.
//
// It fronts three in-database functions — kb_catalog_clients, kb_catalog_list,
// kb_catalog_get — and adds nothing to them. The *shape* of what can be read is
// fixed in a migration, not in this file, so it cannot be widened by editing
// TypeScript.
//
// AUTHENTICATION is the same §52 mechanism as bamo-entity-registry, and the
// same verifier: verify_bamo_registry_request() checks a per-caller token held
// in Vault, the caller allowlist, and an HMAC-SHA256 over `{ts}.{nonce}.{body}`
// inside a 300s window backed by a single-use nonce ledger. This function holds
// no secret of its own and makes no authorisation decision of its own. The
// credential material stays on the database side of the wire — a production
// service_role JWT already sat public on GitHub once (2026-06-12).
//
// Deployed with verify_jwt=false: callers authenticate with their own token,
// not a Supabase key. A Supabase anon key gets exactly the same 401 as no key.
//
// No CORS headers, deliberately. This is server-to-server. The Marketplace
// calls it from a Next.js route handler, never from a browser — a browser
// cannot hold this token safely, and the knowledge bases are not public.
//
// READ-ONLY. There is no operation here that writes to the CRM. If the
// Marketplace ever needs to write back a resolved conflict, that is a separate
// interface with its own review, not an extra branch in this switch.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const MAX_BODY_BYTES = 16_384;          // must match c_max_body_bytes in the verifier
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPERATIONS = new Set(['ping', 'list_clients', 'list_kbs', 'get_kb']);

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// One generic answer for every authentication failure. The specific reason goes
// to public.bamo_registry_auth_log; telling the caller which control it tripped
// would help an attacker walk them one at a time.
const UNAUTHORIZED = () => json(401, { error: 'unauthorized' });

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const caller = (req.headers.get('x-bamo-caller') ?? '').trim().toLowerCase();
  const timestamp = (req.headers.get('x-bamo-timestamp') ?? '').trim();
  const nonce = (req.headers.get('x-bamo-nonce') ?? '').trim();
  const signature = (req.headers.get('x-bamo-signature') ?? '').trim();

  if (!caller || !timestamp || !nonce || !signature) {
    console.warn('[kb-catalog] rejected: missing auth headers');
    return UNAUTHORIZED();
  }

  // Held as opaque text until the verifier says the signature over it is
  // genuine. It is not parsed before that.
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (_e) {
    console.warn(`[kb-catalog] rejected: unreadable body (caller=${caller.slice(0, 32)})`);
    return UNAUTHORIZED();
  }
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return json(413, { error: 'payload_too_large' });
  }

  // Read from the raw body only to label the audit row; it carries no
  // authority. The switch below re-reads it from the parsed body. Prefixed so
  // the shared auth log distinguishes this service from the entity registry.
  const declaredOperation = (() => {
    const m = rawBody.match(/"operation"\s*:\s*"([a-z_]{1,24})"/);
    return m ? `kb:${m[1]}` : 'kb:(none)';
  })();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default'],
  );

  const { data: verdicts, error: verifyError } = await supabase.rpc('verify_bamo_registry_request', {
    p_caller: caller,
    p_timestamp: timestamp,
    p_nonce: nonce,
    p_body: rawBody,
    p_signature: signature,
    p_operation: declaredOperation,
  });

  if (verifyError) {
    // Fail closed. An unavailable verifier is not a reason to serve knowledge
    // bases; the caller falls back to typing the listing manually.
    console.error(`[kb-catalog] verifier failed: ${verifyError.message}`);
    return json(503, { error: 'catalog_unavailable' });
  }

  const verdict = Array.isArray(verdicts) ? verdicts[0] : verdicts;
  if (!verdict?.authorized) {
    console.warn(`[kb-catalog] rejected: caller=${caller.slice(0, 32)} reason=${verdict?.reason ?? 'unknown'}`);
    return UNAUTHORIZED();
  }

  // ---- authenticated from here ------------------------------------------
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
  } catch (_e) {
    return json(400, { error: 'invalid_json' });
  }

  const operation = String(body.operation ?? '');
  if (!OPERATIONS.has(operation)) {
    return json(400, { error: 'unknown_operation', operations: [...OPERATIONS] });
  }

  if (operation === 'ping') {
    return json(200, { ok: true, service: 'bamo-kb-catalog', caller });
  }

  try {
    if (operation === 'list_clients') {
      const { data, error } = await supabase.rpc('kb_catalog_clients');
      if (error) return catalogError(error, operation);
      return json(200, { clients: data ?? [] });
    }

    if (operation === 'list_kbs') {
      const campaignId = typeof body.campaign_id === 'string' ? body.campaign_id : '';
      if (!UUID_RE.test(campaignId)) return json(400, { error: 'campaign_id_required' });

      const { data, error } = await supabase.rpc('kb_catalog_list', { p_campaign_id: campaignId });
      if (error) return catalogError(error, operation);
      return json(200, { knowledge_bases: data ?? [] });
    }

    // operation === 'get_kb'
    const kbId = typeof body.kb_id === 'string' ? body.kb_id : '';
    if (!UUID_RE.test(kbId)) return json(400, { error: 'kb_id_required' });

    const { data, error } = await supabase.rpc('kb_catalog_get', { p_kb_id: kbId });
    if (error) return catalogError(error, operation);

    const row = Array.isArray(data) ? data[0] : data;
    // A knowledge base that is inactive, empty or absent is a 404 rather than
    // an empty 200: the caller asked for a specific one, and "there is nothing
    // here" is the answer it must not mistake for "here is nothing".
    if (!row) return json(404, { error: 'not_found' });
    return json(200, { knowledge_base: row });
  } catch (e) {
    console.error(`[kb-catalog] unhandled: ${e instanceof Error ? e.message : String(e)}`);
    return json(500, { error: 'internal_error' });
  }
});

function catalogError(error: { code?: string; message?: string }, operation: string): Response {
  console.error(`[kb-catalog] ${operation} failed: code=${error.code ?? 'none'} message=${error.message ?? 'none'}`);
  switch (error.code) {
    case '42501':
      // service_role lost EXECUTE on the catalog functions. A configuration
      // fault on this side, not a bad request from the caller.
      return json(503, { error: 'catalog_unavailable' });
    case '22P02': // malformed uuid that slipped the regex
      return json(400, { error: 'invalid_value' });
    default:
      return json(502, { error: 'catalog_error' });
  }
}
