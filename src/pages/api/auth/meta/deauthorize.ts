import type { NextApiRequest, NextApiResponse } from "next";

import { createServerClient } from "@/lib/supabase/server";
import {
  metaAppSecret,
  readSignedRequest,
  verifyMetaSignedRequest,
} from "@/lib/meta/signed-request";

/**
 * POST /api/auth/meta/deauthorize — Meta's app-level Deauthorize callback.
 *
 * Fires when a Facebook user removes BaMo from their Business Integrations.
 * Registered on the Meta app as the single Deauthorize URL. Meta POSTs a
 * urlencoded `signed_request`; there is no session and no bearer token, so the
 * HMAC signature IS the authentication.
 *
 * Revokes rather than deletes: the connection row survives with status='revoked'
 * so the workspace keeps its audit trail. Data Deletion is the destructive one.
 *
 * Fails closed — an unverifiable signature is a 401 and touches nothing.
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
    const now = new Date().toISOString();

    const { data: connections, error } = await admin
      .from("meta_connections")
      .select("id, client_id")
      .eq("fb_user_id", payload.user_id);
    if (error) throw error;

    for (const connection of connections ?? []) {
      const [{ error: connectionError }, { error: pageError }, { error: clientError }] =
        await Promise.all([
          admin
            .from("meta_connections")
            .update({
              status: "revoked",
              user_access_token_encrypted: null,
              revoked_at: now,
              updated_at: now,
            })
            .eq("id", connection.id),
          admin
            .from("meta_pages")
            .update({
              page_access_token_encrypted: null,
              subscription_status: "revoked",
              updated_at: now,
            })
            .eq("connection_id", connection.id),
          // Legacy plaintext bridge still read by n8n / the Messenger webhook.
          admin.from("clients").update({ fb_page_token: null }).eq("id", connection.client_id),
        ]);
      if (connectionError || pageError || clientError) throw new Error("deauthorize_update_failed");

      await admin
        .from("ad_social_accounts")
        .update({ access_token: null, is_active: false })
        .eq("client_id", connection.client_id)
        .eq("source", "client_oauth");

      await admin.from("meta_oauth_sessions").delete().eq("client_id", connection.client_id);

      await admin.from("integration_events").insert({
        client_id: connection.client_id,
        connection_id: connection.id,
        event_type: "meta_deauthorized",
        status: "warning",
        message: "The Facebook user removed BaMo from Business Integrations",
        metadata: {},
      });
    }

    return res.status(200).end();
  } catch (error) {
    const invalid = error instanceof Error && error.message === "invalid_signed_request";
    return res
      .status(invalid ? 401 : 500)
      .json({ error: invalid ? "invalid_signed_request" : "deauthorization_failed" });
  }
}
