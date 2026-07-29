// BaMo render-worker API — claim/sign_upload/complete for bamo_listing creative jobs.
// Auth: x-worker-secret header (local render worker only). verify_jwt is disabled
// because the caller is a headless worker, not a user session.
//
// WORKER_SECRET must be set as an edge-function secret before deploying. It used
// to be a string literal in this file; the local render worker has to send the
// same value in x-worker-secret.
import { createClient } from "jsr:@supabase/supabase-js@2";

const WORKER_SECRET = Deno.env.get("WORKER_SECRET")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"],
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (req.headers.get("x-worker-secret") !== WORKER_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  switch (body.action) {
    case "claim": {
      const { data: rows, error } = await supabase
        .from("creative_jobs")
        .select("*")
        .eq("job_type", "bamo_listing")
        .eq("status", "pending")
        .order("created_at")
        .limit(1);
      if (error) return json({ error: error.message }, 500);
      if (!rows?.length) return json({ job: null });
      // conditional update = race-safe claim. NB: creative_jobs_status_check
      // allows pending/processing/completed/failed/cancelled only.
      const { data: claimed, error: updErr } = await supabase
        .from("creative_jobs")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", rows[0].id)
        .eq("status", "pending")
        .select()
        .maybeSingle();
      if (updErr) return json({ error: updErr.message }, 500);
      return json({ job: claimed ?? null });
    }

    case "sign_upload": {
      const { job_id, files } = body;
      if (!job_id || !Array.isArray(files)) return json({ error: "job_id and files required" }, 400);
      const uploads: unknown[] = [];
      for (const name of files) {
        const path = `${job_id}/${name}`;
        const { data, error } = await supabase.storage
          .from("creative-outputs")
          .createSignedUploadUrl(path, { upsert: true });
        if (error) return json({ error: `${name}: ${error.message}` }, 500);
        uploads.push({ name, path, url: data.signedUrl, token: data.token });
      }
      return json({ uploads });
    }

    case "complete": {
      const { job_id, status, error_message, report, outputs } = body;
      if (!job_id || !status) return json({ error: "job_id and status required" }, 400);

      const { data: job, error: jobErr } = await supabase
        .from("creative_jobs")
        .select("id, client_id")
        .eq("id", job_id)
        .single();
      if (jobErr || !job) return json({ error: "job not found" }, 404);

      const base = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/creative-outputs`;
      let flagshipCreativeId: string | null = null;
      let flagshipUrl: string | null = null;

      if (status === "completed" && Array.isArray(outputs)) {
        for (const out of outputs) {
          const assetUrl = `${base}/${out.path}`;
          const { data: creative, error: cErr } = await supabase
            .from("creatives")
            .insert({
              client_id: job.client_id,
              creative_type: out.type === "video" ? "video" : "image",
              generation_method: "bamo",
              asset_url: assetUrl,
              dimensions: out.ratio ?? null,
              file_size_bytes: out.bytes ?? null,
              duration_seconds: out.duration_seconds ?? null,
              job_id: job_id,
              job_status: "completed",
              metadata: { variant: out.name, source: "bamo-render-worker" },
            })
            .select("id")
            .single();
          if (cErr) return json({ error: `creative insert: ${cErr.message}` }, 500);
          if (!flagshipCreativeId && out.type === "video") {
            flagshipCreativeId = creative.id;
            flagshipUrl = assetUrl;
          }
          if (!flagshipUrl && out.type !== "video") flagshipUrl = assetUrl;
        }
      }

      const { error: updErr } = await supabase
        .from("creative_jobs")
        .update({
          status,
          error_message: error_message ?? null,
          response_payload: report ?? null,
          result_url: flagshipUrl,
          creative_id: flagshipCreativeId,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job_id);
      if (updErr) return json({ error: updErr.message }, 500);
      return json({ ok: true, result_url: flagshipUrl });
    }

    default:
      return json({ error: `unknown action: ${body.action}` }, 400);
  }
});
