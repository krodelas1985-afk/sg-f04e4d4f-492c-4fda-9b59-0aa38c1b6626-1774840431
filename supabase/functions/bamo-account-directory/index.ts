// bamo-account-directory — who BaMo's professionals are, for Marketplace setup.
//
// Identity Standard v1.4 §17.4. When a Marketplace curator sets up a BaMo client,
// the person's email, name and bamo_account_id must come from the CRM through a
// §52-authenticated lookup rather than from anybody's typing. This is that
// lookup. It fronts exactly two in-database functions — account_directory_list
// and account_directory_get — and adds nothing to them, so what is shared is
// fixed in a migration and cannot be widened by editing this file.
//
// AUTHENTICATION is the same §52 mechanism, and the same verifier, as
// bamo-entity-registry and bamo-kb-catalog: verify_bamo_registry_request()
// checks the per-caller token in Vault, the caller allowlist, and an HMAC-SHA256
// over `{ts}.{nonce}.{body}` inside a 300s window with a single-use nonce. This
// function holds no secret and makes no authorisation decision of its own.
// Operations are logged under an `acct:` prefix so the shared auth log tells
// this service apart from the other two.
//
// Deployed with verify_jwt=false: callers authenticate with their own token, and
// a Supabase key gets the same 401 as no key. No CORS headers — the Marketplace
// calls this from a Next.js route handler, never from a browser.
//
// READ-ONLY.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const MAX_BODY_BYTES = 16_384; // must match c_max_body_bytes in the verifier
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPERATIONS = new Set(['ping', 'list_professionals', 'get_professional', 'get_by_subject']);

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// One generic answer for every authentication failure; the reason goes to
// public.bamo_registry_auth_log.
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
    console.warn('[account-directory] rejected: missing auth headers');
    return UNAUTHORIZED();
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (_e) {
    console.warn(`[account-directory] rejected: unreadable body (caller=${caller.slice(0, 32)})`);
    return UNAUTHORIZED();
  }
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return json(413, { error: 'payload_too_large' });
  }

  const declaredOperation = (() => {
    const m = rawBody.match(/"operation"\s*:\s*"([a-z_]{1,24})"/);
    return m ? `acct:${m[1]}` : 'acct:(none)';
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
    console.error(`[account-directory] verifier failed: ${verifyError.message}`);
    return json(503, { error: 'directory_unavailable' });
  }

  const verdict = Array.isArray(verdicts) ? verdicts[0] : verdicts;
  if (!verdict?.authorized) {
    console.warn(`[account-directory] rejected: caller=${caller.slice(0, 32)} reason=${verdict?.reason ?? 'unknown'}`);
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
    return json(200, { ok: true, service: 'bamo-account-directory', caller });
  }

  try {
    if (operation === 'list_professionals') {
      const { data, error } = await supabase.rpc('account_directory_list');
      if (error) {
        console.error(`[account-directory] list failed: ${error.message}`);
        return json(502, { error: 'directory_error' });
      }
      return json(200, { professionals: data ?? [] });
    }

    if (operation === 'get_by_subject') {
      // "Sign in with BaMo" (Identity Standard §56.5, plan R4): the Marketplace
      // holds the CRM user id as the OIDC subject and needs the bamo_account_id,
      // plus whether this person's mailbox is proven (plan R1, re-checked on the
      // Marketplace's own server).
      const subject = typeof body.subject === 'string' ? body.subject : '';
      if (!UUID_RE.test(subject)) return json(400, { error: 'subject_required' });

      const { data, error } = await supabase.rpc('account_directory_get_by_subject', { p_crm_user_id: subject });
      if (error) {
        console.error(`[account-directory] get_by_subject failed: ${error.message}`);
        return json(502, { error: 'directory_error' });
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return json(404, { error: 'not_found' });
      return json(200, { account: row });
    }

    // operation === 'get_professional'
    const id = typeof body.bamo_account_id === 'string' ? body.bamo_account_id : '';
    if (!UUID_RE.test(id)) return json(400, { error: 'bamo_account_id_required' });

    const { data, error } = await supabase.rpc('account_directory_get', { p_bamo_account_id: id });
    if (error) {
      console.error(`[account-directory] get failed: ${error.message}`);
      return json(502, { error: 'directory_error' });
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return json(404, { error: 'not_found' });
    return json(200, { professional: row });
  } catch (e) {
    console.error(`[account-directory] unhandled: ${e instanceof Error ? e.message : String(e)}`);
    return json(500, { error: 'internal_error' });
  }
});
