import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// Statuses a baymo_admin can set on a website application from the queue.
// 'approved' fires trg_provision_client_web, which creates the client workspace
// (idempotent on email) and notifies every baymo_admin.
const STATUSES = ["submitted", "reviewed", "approved"];

/**
 * PATCH /api/admin/requests/application/[id]
 * baymo_admin only. Status transitions for website (source='web') client
 * applications in client_onboarding. Approving auto-creates the client
 * workspace via the DB trigger.
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

    // Only ever touch website applications — never mobile/tally onboarding rows.
    const { data: updated, error } = await adminClient
      .from("client_onboarding")
      .update({ status })
      .eq("id", id)
      .eq("source", "web")
      .select("*")
      .single();

    if (error) return res.status(500).json({ error: "Failed to update application" });
    if (!updated) return res.status(404).json({ error: "Application not found" });

    return res.status(200).json({ application: updated });
  } catch (error) {
    console.error("Error in application request API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
