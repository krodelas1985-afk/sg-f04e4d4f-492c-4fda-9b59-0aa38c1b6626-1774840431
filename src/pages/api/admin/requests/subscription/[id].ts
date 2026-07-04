import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const STATUSES = ["open", "contacted", "closed"];

/**
 * PATCH /api/admin/requests/subscription/[id]
 * baymo_admin only. Generic status transition for subscription_requests
 * (fb_page_connection, ads_account_setup, ads_plan_upgrade, social_autopost).
 * account_deletion requests use the dedicated process-deletion endpoint
 * instead, since that action also revokes the requester's login.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name) => req.cookies[name], set: () => {}, remove: () => {} } }
    );
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: profile } = await adminClient.from("profiles").select("role").eq("id", session.user.id).single();
    if (profile?.role !== "baymo_admin") return res.status(403).json({ error: "Forbidden" });

    if (req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });

    const { status } = req.body as { status?: string };
    if (!status || !STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(", ")}` });
    }

    const { data: existing } = await adminClient
      .from("subscription_requests")
      .select("product")
      .eq("id", id)
      .single();
    if (!existing) return res.status(404).json({ error: "Request not found" });
    if (existing.product === "account_deletion") {
      return res.status(400).json({ error: "Use /process-deletion for account_deletion requests" });
    }

    const { data: updated, error } = await adminClient
      .from("subscription_requests")
      .update({ status, processed_by: session.user.id, processed_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: "Failed to update request" });

    return res.status(200).json({ request: updated });
  } catch (error) {
    console.error("Error in subscription request API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
