import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { client_id, limit = "20" } = req.query;

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

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile?.role !== "baymo_admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    let query = adminClient
      .from("webhook_logs")
      .select(`
        *,
        clients!webhook_logs_client_id_fkey(name)
      `)
      .order("received_at", { ascending: false })
      .limit(parseInt(limit as string));

    if (client_id) {
      query = query.eq("client_id", client_id);
    }

    const { data: logs, error } = await query;

    if (error) {
      console.error("Error fetching webhook logs:", error);
      return res.status(500).json({ error: "Failed to fetch logs" });
    }

    return res.status(200).json({ logs: logs || [] });
  } catch (error) {
    console.error("Error in webhook-logs API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}