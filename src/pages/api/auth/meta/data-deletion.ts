import type { NextApiRequest, NextApiResponse } from "next";

import { createServerClient } from "@/lib/supabase/server";
import {
  metaAppSecret,
  randomSecret,
  readSignedRequest,
  sha256,
  verifyMetaSignedRequest,
} from "@/lib/meta/signed-request";

/**
 * POST /api/auth/meta/data-deletion — Meta's app-level Data Deletion callback.
 *
 * Mandatory for App Review. Registered on the Meta app as the single Data
 * Deletion URL. Like Deauthorize, the HMAC on `signed_request` is the only
 * authentication; there is no session.
 *
 * This one is destructive: it deletes the Meta connection rows outright rather
 * than marking them revoked, then records a confirmation code Meta (and the user)
 * can check at /api/auth/meta/data-deletion/status?code=…
 *
 * The fb_user_id is stored only as a SHA-256 hash — after this runs, BaMo must
 * not retain a way to re-identify the Facebook user.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const appSecret = metaAppSecret();
  if (!appSecret) return res.status(503).json({ error: "Unavailable" });

  try {
    const payload = verifyMetaSignedRequest(readSignedRequest(req.body), appSecret);
    const admin = createServerClient();
    const confirmationCode = randomSecret(24);

    const { data: connections, error } = await admin
      .from("meta_connections")
      .select("id, client_id")
      .eq("fb_user_id", payload.user_id);
    if (error) throw error;

    for (const connection of connections ?? []) {
      const results = await Promise.all([
        admin
          .from("clients")
          .update({ fb_page_id: null, fb_page_token: null })
          .eq("id", connection.client_id),
        admin
          .from("ad_social_accounts")
          .update({ access_token: null, is_active: false })
          .eq("client_id", connection.client_id)
          .eq("source", "client_oauth"),
        admin.from("integration_events").insert({
          client_id: connection.client_id,
          // The connection row is deleted below, so do not reference it.
          connection_id: null,
          event_type: "meta_data_deleted",
          status: "success",
          message: "Meta connection and stored tokens deleted by verified callback",
          metadata: {},
        }),
      ]);
      if (results.some((result) => result.error)) throw new Error("data_deletion_failed");
    }

    const clientIds = (connections ?? []).map((connection) => connection.client_id);
    if (clientIds.length > 0) {
      const { error: sessionDeleteError } = await admin
        .from("meta_oauth_sessions")
        .delete()
        .in("client_id", clientIds);
      if (sessionDeleteError) throw sessionDeleteError;
    }

    const { error: connectionDeleteError } = await admin
      .from("meta_connections")
      .delete()
      .eq("fb_user_id", payload.user_id);
    if (connectionDeleteError) throw connectionDeleteError;

    const { error: confirmationError } = await admin
      .from("meta_data_deletion_requests")
      .insert({
        confirmation_code: confirmationCode,
        fb_user_id_hash: sha256(payload.user_id),
        status: "completed",
        completed_at: new Date().toISOString(),
      });
    if (confirmationError) throw confirmationError;

    const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.bahaymo.com").replace(/\/$/, "");
    return res.status(200).json({
      url: `${base}/api/auth/meta/data-deletion/status?code=${encodeURIComponent(confirmationCode)}`,
      confirmation_code: confirmationCode,
    });
  } catch (error) {
    const invalid = error instanceof Error && error.message === "invalid_signed_request";
    return res
      .status(invalid ? 401 : 500)
      .json({ error: invalid ? "invalid_signed_request" : "data_deletion_failed" });
  }
}
