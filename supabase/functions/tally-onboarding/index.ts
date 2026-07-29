// BaMo — Tally Onboarding receiver.
//
// Tally posts a form submission here; we map it into `client_onboarding`
// (source='tally', status='submitted'). The DB trigger
// `trg_auto_provision_client` then auto-creates the client workspace, links +
// approves the row, and notifies every baymo_admin. This function only ingests.
//
// Auth: shared token. Tally must call this URL with `?token=<secret>` (or send
// header `x-webhook-token`). Deployed with verify_jwt=false so Tally can reach it.
//
// Idempotent: Tally retries reuse the same submissionId, which we de-dupe on.

import { createClient } from "jsr:@supabase/supabase-js@2";

// Shared webhook token. The LIVE deploy has the real value baked in as the
// fallback below (redacted here); prefer setting a TALLY_WEBHOOK_SECRET env
// secret and rotating it there. Tally must send it as ?token=<secret>.
const SECRET = Deno.env.get("TALLY_WEBHOOK_SECRET") ??
  "REDACTED_SEE_DEPLOYED_FUNCTION";

type TallyField = {
  key?: string;
  label?: string;
  type?: string;
  value?: unknown;
  options?: { id: string; text: string }[];
};

/** Resolve a Tally field value to plain text / string[] (choice ids -> labels, files -> urls). */
function resolve(f: TallyField): unknown {
  const v = f.value;
  if (v === null || v === undefined || v === "") return null;
  if (Array.isArray(v)) {
    if (v.length && typeof v[0] === "object" && v[0] !== null) {
      // File upload: array of {url,name,...}
      return v.map((o: any) => o?.url ?? o?.name ?? o);
    }
    const opts = f.options ?? [];
    return v.map((id: any) => opts.find((o) => o.id === id)?.text ?? id);
  }
  return v;
}

const asText = (v: unknown): string | null =>
  v === null || v === undefined ? null : Array.isArray(v) ? v.join(", ") : String(v);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- auth ---
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("x-webhook-token");
  if (!token || token !== SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const d = body?.data ?? body ?? {};
  const rawFields: TallyField[] = Array.isArray(d.fields) ? d.fields : [];

  const flat = rawFields.map((f) => ({
    label: f.label ?? "",
    type: f.type ?? "",
    value: resolve(f),
  }));

  const find = (subs: string[]) =>
    flat.find((x) => {
      const l = (x.label ?? "").toLowerCase();
      return subs.some((s) => l.includes(s));
    });
  const val = (subs: string[]) => {
    const f = find(subs);
    return f ? asText(f.value) : null;
  };

  // --- top-level columns ---
  const full_name = val(["first name", "pangalan"]);
  const email = val(["email"]);
  const phone = val(["mobile", "telepono", "phone number", "numero"]);
  const company_name = val(["brokerage", "agency"]);

  // --- properties (Tally emits fields in form order; a new "property name" starts a block) ---
  const properties: Record<string, unknown>[] = [];
  let cur: Record<string, unknown> | null = null;
  for (const x of flat) {
    const l = (x.label ?? "").toLowerCase();
    if (l.includes("property name") || l.includes("project name")) {
      if (cur) properties.push(cur);
      cur = { name: asText(x.value) };
    } else if (cur) {
      if (l.includes("location")) cur.location = asText(x.value);
      else if (l.includes("property type")) cur.property_type = asText(x.value);
      else if (l.includes("status")) cur.status = asText(x.value);
      else if (l.includes("price")) cur.price = asText(x.value);
      else if (l.includes("selling")) cur.selling_points = asText(x.value);
    }
  }
  if (cur) properties.push(cur);
  const cleanProps = properties.filter(
    (p) => p.name || p.location || p.price || p.selling_points,
  );

  const brandVoice = find(["pick 3", "describe your style", "brand voice", "style"]);

  const answers = {
    prc_license: val(["prc"]),
    brokerage: company_name,
    short_bio: val(["short bio", "ilalarawan", "describe yourself"]),
    properties: cleanProps,
    brand_voice_words: brandVoice ? brandVoice.value : null,
    content_language: val(["content language", "wika", "language"]),
    dont_say: val(["don't want", "dont want", "ayaw"]),
    fb_page_url: val(["facebook page url", "page url", "facebook page"]),
    fb_page_access_method: val(["page access", "give us page", "how would you like"]),
    headshot: (find(["headshot", "profile photo"]) ?? {}).value ?? null,
    logo: (find(["logo"]) ?? {}).value ?? null,
    additional_notes: val(["additional notes", "anything else", "questions"]),
    _tally: {
      form_id: d.formId ?? null,
      form_name: d.formName ?? null,
      response_id: d.responseId ?? null,
      submission_id: d.submissionId ?? null,
      submitted_at: d.createdAt ?? null,
    },
    _raw: flat,
  };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"],
  );

  // --- idempotency: skip if this Tally submission was already ingested ---
  const submissionId = d.submissionId ?? d.responseId ?? null;
  if (submissionId) {
    const { data: existing } = await supabase
      .from("client_onboarding")
      .select("id, client_id, status")
      .eq("answers->_tally->>submission_id", submissionId)
      .maybeSingle();
    if (existing) {
      return new Response(
        JSON.stringify({ ok: true, deduped: true, onboarding: existing }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  const { data: inserted, error } = await supabase
    .from("client_onboarding")
    .insert({
      source: "tally",
      status: "submitted",
      current_step: 6,
      full_name,
      company_name,
      email,
      phone,
      answers,
      submitted_at: d.createdAt ?? new Date().toISOString(),
    })
    .select("id, client_id, status, full_name, email")
    .single();

  if (error) {
    console.error("insert failed", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // client_id / status='approved' are set by the trigger during INSERT.
  return new Response(JSON.stringify({ ok: true, onboarding: inserted }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
