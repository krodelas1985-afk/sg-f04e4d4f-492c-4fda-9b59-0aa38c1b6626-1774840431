import type { NextApiRequest, NextApiResponse } from "next";

import { createServerClient } from "@/lib/supabase/server";
import { deletionStatusHtml } from "@/lib/meta/signed-request";

/**
 * GET /api/auth/meta/data-deletion/status?code=… — the human-readable status page
 * whose URL the Data Deletion callback returns to Meta.
 *
 * Public by design: Meta and the user must be able to open it without signing in.
 * The confirmation code is the only lookup key, and it reveals nothing beyond
 * whether that deletion completed. Never render the fb_user_id or its hash here.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const raw = req.query.code;
  const code = typeof raw === "string" ? raw : "";

  const { data } = code
    ? await createServerClient()
        .from("meta_data_deletion_requests")
        .select("id")
        .eq("confirmation_code", code)
        .eq("status", "completed")
        .maybeSingle()
    : { data: null };

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
  );
  return res.status(data ? 200 : 404).send(deletionStatusHtml(code, Boolean(data)));
}
