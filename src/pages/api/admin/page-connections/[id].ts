import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * PATCH /api/admin/page-connections/:id
 * baymo_admin only. Body: { status: "in_progress" | "connected" | "rejected", note?, fbPageId? }
 * Marking connected can also stamp clients.fb_page_id so the mobile app's
 * Messenger deep links and wizard checks light up. The DB trigger notifies the
 * requester on connected/rejected.
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
    const { status, note, fbPageId } = req.body as {
      status: string;
      note?: string;
      fbPageId?: string;
    };
    if (!["in_progress", "connected", "rejected"].includes(status))
      return res.status(400).json({ error: "Invalid status" });

    const { data: request } = await adminClient
      .from("page_connection_requests")
      .select("id, client_id")
      .eq("id", id)
      .single();
    if (!request) return res.status(404).json({ error: "Request not found" });

    const { error } = await adminClient
      .from("page_connection_requests")
      .update({ status, admin_notes: note?.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return res.status(500).json({ error: error.message });

    if (status === "connected" && fbPageId?.trim()) {
      const { error: clientErr } = await adminClient
        .from("clients")
        .update({ fb_page_id: fbPageId.trim() })
        .eq("id", request.client_id);
      if (clientErr) return res.status(500).json({ error: clientErr.message });
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
