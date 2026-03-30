import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@/lib/supabase/server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const supabase = createServerClient(req, res);

  // Verify authentication
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Get user profile with role and client_id
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, client_id")
    .eq("id", session.user.id)
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
        query = query.eq("client_id", profile.client_id);
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
    // Only baymo_admin can create campaigns
    if (profile.role !== "baymo_admin") {
      return res.status(403).json({ error: "Only admin can create campaigns" });
    }

    const { name, channel, client_id } = req.body;

    if (!name || !channel || !client_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        name,
        channel,
        client_id,
        status: "draft",
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

    if (error) {
      console.error("Create campaign error:", error);
      return res.status(500).json({ error: "Failed to create campaign" });
    }

    return res.status(201).json(data);
  }

  return res.status(405).json({ error: "Method not allowed" });
}