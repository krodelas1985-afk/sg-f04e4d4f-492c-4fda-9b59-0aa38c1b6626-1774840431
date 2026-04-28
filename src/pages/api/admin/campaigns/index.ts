import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

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

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile?.role !== "baymo_admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (req.method === "GET") {
      const { data: campaigns, error } = await adminClient
        .from("campaigns")
        .select(`
          *,
          clients(id, name, company_name)
        `)
        .order("created_at", { ascending: false });

      if (error) return res.status(500).json({ error: "Failed to fetch campaigns" });

      const campaignsWithCounts = await Promise.all(
        (campaigns || []).map(async (campaign) => {
          const { count } = await adminClient
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaign.id);
          return { ...campaign, leads_count: count || 0 };
        })
      );

      return res.status(200).json({ campaigns: campaignsWithCounts });
    }

    if (req.method === "POST") {
      const { name, channel, client_id } = req.body;

      if (!name || !channel) {
        return res.status(400).json({ error: "Name and channel are required" });
      }

      const { data, error } = await adminClient
        .from("campaigns")
        .insert({
          name,
          channel,
          client_id: client_id || null,
          status: "draft",
          is_active: false,
          is_locked: false,
          created_by: session.user.id,
          config: {
            target_audience: {},
            qualification_questions: [],
            tone_persona: "",
            additional_instructions: "",
            email_triggers: {
              enabled: false,
              allowed_sources: [],
              template_id: null,
            },
          },
        })
        .select()
        .single();

      if (error) return res.status(500).json({ error: "Failed to create campaign" });

      return res.status(201).json(data);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Admin campaigns API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
