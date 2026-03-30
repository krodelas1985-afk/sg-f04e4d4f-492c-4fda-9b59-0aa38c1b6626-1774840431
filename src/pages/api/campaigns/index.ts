import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies[name];
        },
        set(name: string, value: string, options: any) {},
        remove(name: string, options: any) {},
      },
    }
  );

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_id")
    .eq("id", authData.user.id)
    .single();

  if (!profile || !profile.client_id) {
    return res.status(403).json({ error: "Forbidden: No client associated" });
  }

  if (req.method === "GET") {
    // Get campaigns with lead counts
    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("*, leads(count)")
      .eq("client_id", profile.client_id)
      .order("created_at", { ascending: false });

    if (campaignsError) {
      return res.status(500).json({ error: campaignsError.message });
    }

    // Format leads count
    const formattedCampaigns = campaigns.map((c: any) => ({
      ...c,
      leads_count: c.leads?.[0]?.count || 0
    }));

    return res.status(200).json(formattedCampaigns);
  } else if (req.method === "POST") {
    if (profile.role !== "baymo_admin") {
      return res.status(403).json({ error: "Forbidden: Only baymo_admin can create campaigns" });
    }

    const { name, channel } = req.body;

    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        client_id: profile.client_id,
        name,
        channel,
        status: "draft",
        created_by: authData.user.id,
        config: {
          target_audience: {
            budget_min: 0,
            budget_max: 0,
            locations: [],
            property_types: [],
            buyer_type: "",
            custom_fields: []
          },
          qualification_questions: [],
          tone_persona: "",
          additional_instructions: "",
          email_triggers: {
            enabled: false,
            allowed_sources: [],
            template_id: null
          }
        }
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json(data);
  }

  return res.status(405).json({ error: "Method not allowed" });
}