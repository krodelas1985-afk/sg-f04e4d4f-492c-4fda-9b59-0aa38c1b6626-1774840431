import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies[name];
        },
        set() {},
        remove() {},
      },
    }
  );

  // Verify authentication
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Get user profile with role and client_id
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, client_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return res.status(403).json({ error: "Profile not found" });
  }

  if (req.method === "GET") {
    try {
      let query = supabase
        .from("campaigns")
        .select(
          `
          *,
          created_by_profile:profiles!campaigns_created_by_fkey(full_name)
        `
        )
        .order("created_at", { ascending: false });

      // If NOT baymo_admin, filter by client_id
      if (profile.role !== "baymo_admin") {
        if (!profile.client_id) {
          return res.status(403).json({ error: "No client assigned" });
        }
        query = query.eq("client_id", profile.client_id).eq("is_active", true);
      }
      // If baymo_admin, fetch ALL campaigns (no client_id filter)

      const { data, error } = await query;

      if (error) throw error;

      // Get leads count for each campaign
      const campaignsWithCounts = await Promise.all(
        (data || []).map(async (campaign) => {
          const { count } = await supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaign.id);

          return {
            ...campaign,
            leads_count: count || 0,
          };
        })
      );

      return res.status(200).json(campaignsWithCounts);
    } catch (error) {
      console.error("Fetch campaigns error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method === "POST") {
    const { name, channel, client_id } = req.body;

    if (!name || !channel) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Determine client_id
    let campaignClientId = client_id;

    // If not baymo_admin, use profile's client_id
    if (profile.role !== "baymo_admin") {
      if (!profile.client_id) {
        return res.status(400).json({ error: "User has no client association" });
      }
      campaignClientId = profile.client_id;
    } else {
      // baymo_admin must provide client_id
      if (!client_id) {
        return res.status(400).json({ error: "Client ID required for admin users" });
      }
    }

    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        name,
        channel,
        client_id: campaignClientId,
        status: "draft",
        created_by: user.id,
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

    if (error) {
      console.error("Create campaign error:", error);
      return res.status(500).json({ error: "Failed to create campaign" });
    }

    return res.status(201).json(data);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
