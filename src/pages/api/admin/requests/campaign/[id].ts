import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const STATUSES = ["requested", "reviewing", "launched", "declined"];

/**
 * PATCH /api/admin/requests/campaign/[id]
 * baymo_admin only. Status transitions for campaign_requests. Marking
 * "launched" can optionally link the real ad_campaigns row created in the
 * web Ads Manager's campaign builder.
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

    const { status, ad_campaign_id } = req.body as { status?: string; ad_campaign_id?: string | null };
    if (!status || !STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(", ")}` });
    }

    const updateData: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (ad_campaign_id !== undefined) updateData.ad_campaign_id = ad_campaign_id || null;

    const { data: updated, error } = await adminClient
      .from("campaign_requests")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: "Failed to update request" });

    return res.status(200).json({ request: updated });
  } catch (error) {
    console.error("Error in campaign request API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
