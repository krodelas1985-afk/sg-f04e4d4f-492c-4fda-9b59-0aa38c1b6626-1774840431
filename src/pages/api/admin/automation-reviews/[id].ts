import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * PATCH /api/admin/automation-reviews/:id
 * baymo_admin only. Body: { action: "activate" | "request_changes", note?: string }
 * - activate: status -> active (+ is_active). Uses the service-role client, which
 *   the self-serve guard trigger deliberately allows.
 * - request_changes: status -> draft and the creator is notified with the note.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => req.cookies[name],
          set: () => {},
          remove: () => {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "baymo_admin") return res.status(403).json({ error: "Forbidden" });

    if (req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });

    const id = req.query.id as string;
    const { action, note } = req.body as { action: string; note?: string };

    const { data: campaign } = await adminClient
      .from("campaigns")
      .select("id, name, client_id, created_by, status")
      .eq("id", id)
      .single();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    if (campaign.status !== "pending_review")
      return res.status(409).json({ error: "Campaign is not pending review" });

    if (action === "activate") {
      const { error } = await adminClient
        .from("campaigns")
        .update({ status: "active", is_active: true })
        .eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
    } else if (action === "request_changes") {
      const { error } = await adminClient
        .from("campaigns")
        .update({ status: "draft" })
        .eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
    } else {
      return res.status(400).json({ error: "Unknown action" });
    }

    // Tell the creator what happened (in-app notification).
    if (campaign.created_by) {
      await adminClient.from("notifications").insert({
        user_id: campaign.created_by,
        client_id: campaign.client_id,
        type: action === "activate" ? "automation_activated" : "automation_changes_requested",
        title:
          action === "activate"
            ? `${campaign.name} is live — BayMo is answering your leads 🎉`
            : `${campaign.name} needs a few changes`,
        body: note?.trim() || (action === "activate" ? "" : "Open BayMo Automations to update your setup."),
        data: { campaign_id: campaign.id },
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
