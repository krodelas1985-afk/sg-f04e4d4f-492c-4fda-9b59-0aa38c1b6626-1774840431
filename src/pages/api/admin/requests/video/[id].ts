import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const STATUSES = ["requested", "in_production", "delivered", "cancelled"];

/**
 * PATCH /api/admin/requests/video/[id]
 * baymo_admin only. Status transitions for video_requests, fulfilled via the
 * template pipeline outside this app. Marking "delivered" requires a URL.
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

    const { status, delivered_url } = req.body as { status?: string; delivered_url?: string };
    if (!status || !STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(", ")}` });
    }
    if (status === "delivered" && !delivered_url?.trim()) {
      return res.status(400).json({ error: "delivered_url is required to mark a video delivered" });
    }

    const updateData: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === "delivered") updateData.delivered_url = delivered_url!.trim();

    const { data: updated, error } = await adminClient
      .from("video_requests")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: "Failed to update request" });

    return res.status(200).json({ request: updated });
  } catch (error) {
    console.error("Error in video request API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
