import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Create anon client for auth check
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => {
            const cookie = req.cookies[name];
            return cookie;
          },
          set: () => {},
          remove: () => {},
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Service role client for data access
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

    // Verify user is baymo_admin
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile?.role !== "baymo_admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Fetch stats
    const { data: clients, count: clientsCount } = await adminClient
      .from("clients")
      .select("*", { count: "exact", head: true });

    const { count: leadsCount } = await adminClient
      .from("leads")
      .select("*", { count: "exact", head: true });

    const { count: campaignsCount } = await adminClient
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    return res.status(200).json({
      totalClients: clientsCount || 0,
      totalLeads: leadsCount || 0,
      activeCampaigns: campaignsCount || 0,
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}