import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// Supabase's ban API takes a duration, not a literal "forever" — this is the
// common convention for an effectively-permanent ban. Reversible later via
// auth.admin.updateUserById(id, { ban_duration: "none" }) if a deletion was
// requested by mistake.
const PERMANENT_BAN_DURATION = "876000h";

/**
 * POST /api/admin/requests/subscription/[id]/process-deletion
 * baymo_admin only. Soft-deletes the requester's account: deactivates their
 * profile and revokes login, but leaves their leads/listings/appointments/
 * documents in place (other rows reference them via created_by/
 * assigned_user_id, and the data has audit/records value). This does NOT
 * touch auth.users or profiles rows themselves — reversible if requested in
 * error, unlike a hard delete.
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

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { data: reqRow } = await adminClient
      .from("subscription_requests")
      .select("id, product, status, created_by")
      .eq("id", id)
      .single();
    if (!reqRow) return res.status(404).json({ error: "Request not found" });
    if (reqRow.product !== "account_deletion") {
      return res.status(400).json({ error: "This endpoint only processes account_deletion requests" });
    }
    if (reqRow.status === "closed") {
      return res.status(400).json({ error: "This request has already been processed" });
    }
    if (!reqRow.created_by) {
      return res.status(400).json({ error: "Request has no associated user" });
    }

    const { error: banError } = await adminClient.auth.admin.updateUserById(reqRow.created_by, {
      ban_duration: PERMANENT_BAN_DURATION,
    });
    if (banError) {
      console.error("Error banning user:", banError);
      return res.status(500).json({ error: "Failed to revoke login — no changes made" });
    }

    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ is_active: false })
      .eq("id", reqRow.created_by);
    if (profileError) {
      console.error("Error deactivating profile:", profileError);
      return res.status(500).json({ error: "Login revoked, but failed to deactivate profile — check manually" });
    }

    const { data: updated, error: closeError } = await adminClient
      .from("subscription_requests")
      .update({ status: "closed", processed_by: session.user.id, processed_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (closeError) {
      console.error("Error closing request:", closeError);
      return res.status(500).json({ error: "Account deactivated, but failed to close the request record" });
    }

    return res.status(200).json({ request: updated });
  } catch (error) {
    console.error("Error in process-deletion API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
