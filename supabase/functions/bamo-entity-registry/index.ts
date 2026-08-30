// bamo-entity-registry — the CRM's canonical entity registry, over HTTP.
//
// Identity Standard §53.1: Network and Marketplace cannot query the CRM
// database directly (§27, §32), so the CRM exposes the registry as a trusted
// server-side interface. This is that interface. It fronts exactly three
// in-database functions — search_bamo_entities, resolve_bamo_entity,
// request_bamo_entity — and adds nothing to them.
//
// AUTHENTICATION (§52, all three controls) lives in Postgres, in
// verify_bamo_registry_request(): per-caller token held in Vault, caller
// allowlist, and HMAC-SHA256 over `{ts}.{nonce}.{body}` inside a 300s window
// backed by a single-use nonce ledger. This function holds no secret of its own
// and makes no authorisation decision of its own; it forwards what the caller
// presented and obeys the answer. That is deliberate — a production
// service_role JWT already sat public on GitHub once (2026-06-12), so the
// credential material stays on the database side of the wire.
//
// Deployed with verify_jwt=false: callers authenticate with their own token,
// not with a Supabase key. It is NOT anon-reachable in any useful sense — a
// Supabase anon key gets exactly the same 401 as no key at all.
//
// No CORS headers, on purpose. This is a server-to-server endpoint; a browser
// must not be able to call it, and a browser could not hold the token safely
// anyway.
//
// Degraded mode (§53.2) is the CONSUMER's obligation, not this function's: if
// this endpoint is unreachable, the caller creates its local organization with
// bamo_entity_id = NULL and correlates later. A NULL is a valid, expected
// state and must never be surfaced to an end user as an error. See
// bamo-ops/docs/architecture/BAMO_ENTITY_REGISTRY_INTERFACE.md.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const MAX_BODY_BYTES = 16_384;          // must match c_max_body_bytes in the verifier
const CALLER_RE = /^[a-z][a-z0-9_]{1,31}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPERATIONS = new Set(['ping', 'search', 'resolve', 'request']);

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// One generic answer for every authentication failure. The specific reason is
// recorded in public.bamo_registry_auth_log; telling the caller which control
// it tripped would help an attacker walk the controls one at a time.
const UNAUTHORIZED = () => json(401, { error: 'unauthorized' });

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const caller = (req.headers.get('x-bamo-caller') ?? '').trim().toLowerCase();
  const timestamp = (req.headers.get('x-bamo-timestamp') ?? '').trim();
  const nonce = (req.headers.get('x-bamo-nonce') ?? '').trim();
  const signature = (req.headers.get('x-bamo-signature') ?? '').trim();

  // Nothing presented at all: refuse without touching the database. There is no
  // caller identity to log, and this is the shape all internet background noise
  // takes.
  if (!caller || !timestamp || !nonce || !signature) {
    console.warn('[registry] rejected: missing auth headers');
    return UNAUTHORIZED();
  }

  // §52: unknown callers are rejected before any body parsing. The body below
  // is read but held as opaque text — it is not parsed until the verifier says
  // the signature over it is genuine.
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (_e) {
    console.warn(`[registry] rejected: unreadable body (caller=${caller.slice(0, 32)})`);
    return UNAUTHORIZED();
  }
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    console.warn(`[registry] rejected: body over ${MAX_BODY_BYTES} bytes (caller=${caller.slice(0, 32)})`);
    return json(413, { error: 'payload_too_large' });
  }

  // The operation name is read from the body only to label the audit row. It
  // carries no authority: the switch below re-reads it from the *parsed* body
  // after authentication.
  const declaredOperation = (() => {
    const m = rawBody.match(/"operation"\s*:\s*"([a-z_]{1,32})"/);
    return m ? m[1] : null;
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
    // Fail closed. An unavailable verifier is not a reason to serve the
    // registry; the caller's §53.2 degraded mode covers this case.
    console.error(`[registry] verifier failed: ${verifyError.message}`);
    return json(503, { error: 'registry_unavailable' });
  }

  const verdict = Array.isArray(verdicts) ? verdicts[0] : verdicts;
  if (!verdict?.authorized) {
    console.warn(`[registry] rejected: caller=${caller.slice(0, 32)} reason=${verdict?.reason ?? 'unknown'}`);
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

  // A credential check the caller can run without touching registry data.
  if (operation === 'ping') {
    return json(200, { ok: true, service: 'bamo-entity-registry', caller });
  }

  try {
    if (operation === 'search') {
      const query = typeof body.query === 'string' ? body.query.trim() : '';
      if (!query) return json(400, { error: 'query_required' });
      const limit = Number.isInteger(body.limit) ? (body.limit as number) : 20;

      const { data, error } = await supabase.rpc('search_bamo_entities', {
        p_query: query,
        p_entity_type: typeof body.entity_type === 'string' ? body.entity_type : null,
        p_limit: limit,
      });
      if (error) return registryError(error, operation);
      return json(200, { results: data ?? [] });
    }

    if (operation === 'resolve') {
      const id = typeof body.bamo_entity_id === 'string' ? body.bamo_entity_id : '';
      if (!UUID_RE.test(id)) return json(400, { error: 'bamo_entity_id_required' });

      const { data, error } = await supabase.rpc('resolve_bamo_entity', { p_entity_id: id });
      if (error) return registryError(error, operation);

      const row = Array.isArray(data) ? data[0] : data;
      // An id that is not in the registry is a 404, not an empty 200: the
      // caller is asking whether a specific identifier resolves.
      if (!row) return json(404, { error: 'not_found' });
      return json(200, { entity: row });
    }

    // operation === 'request'
    const canonicalName = typeof body.canonical_name === 'string' ? body.canonical_name.trim() : '';
    const entityType = typeof body.entity_type === 'string' ? body.entity_type : '';
    if (!canonicalName) return json(400, { error: 'canonical_name_required' });
    if (!entityType) return json(400, { error: 'entity_type_required' });

    const { data, error } = await supabase.rpc('request_bamo_entity', {
      p_entity_type: entityType,
      p_canonical_name: canonicalName,
      p_registration_number:
        typeof body.registration_number === 'string' && body.registration_number.trim()
          ? body.registration_number.trim()
          : null,
      p_country_code: typeof body.country_code === 'string' && body.country_code.trim()
        ? body.country_code.trim().toUpperCase()
        : 'PH',
      // Always NULL. created_by_profile_id references public.profiles — a CRM
      // operator. An external caller has no CRM profile, and must never be able
      // to attribute a registry row to one.
      p_created_by_profile_id: null,
      p_notes: typeof body.notes === 'string' ? body.notes.slice(0, 2000) : null,
    });
    if (error) return registryError(error, operation);

    const row = Array.isArray(data) ? data[0] : data;
    return json(row?.created ? 201 : 200, {
      bamo_entity_id: row?.bamo_entity_id ?? null,
      created: row?.created ?? false,
    });
  } catch (e) {
    console.error(`[registry] unhandled: ${e instanceof Error ? e.message : String(e)}`);
    return json(500, { error: 'internal_error' });
  }
});

// Map the registry's own error codes onto HTTP without leaking internals.
function registryError(error: { code?: string; message?: string }, operation: string): Response {
  console.error(`[registry] ${operation} failed: code=${error.code ?? 'none'} message=${error.message ?? 'none'}`);
  switch (error.code) {
    case '22023': // raised by request_bamo_entity for a blank canonical_name
      return json(400, { error: 'invalid_request' });
    case '23514': // CHECK violation: unknown entity_type / status
      return json(400, { error: 'invalid_value' });
    case '55000': // resolve_bamo_entity: supersession chain exceeded 16 hops
      return json(409, { error: 'registry_inconsistent' });
    default:
      return json(502, { error: 'registry_error' });
  }
}
