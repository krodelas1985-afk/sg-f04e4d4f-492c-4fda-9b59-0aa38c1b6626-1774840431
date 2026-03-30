import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@/lib/supabase/server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const supabase = createServerClient(req, res);
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Campaign ID required" });
  }

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
        .select("*")
        .eq("id", id);

      // If NOT baymo_admin, filter by client_id
      if (profile.role !== "baymo_admin") {
        if (!profile.client_id) {
          return res.status(403).json({ error: "No client assigned" });
        }
        query = query.eq("client_id", profile.client_id);
      }
      // If baymo_admin, no client_id filter (can access any campaign)

      const { data, error } = await query.single();

      if (error) throw error;
      if (!data) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      return res.status(200).json(data);
    } catch (error) {
      console.error("Fetch campaign error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method === "PUT") {
    const updates = req.body;

    // Fetch the campaign first to check permissions
    let query = supabase
      .from("campaigns")
      .select("*")
      .eq("id", id);

    // If NOT baymo_admin, filter by client_id
    if (profile.role !== "baymo_admin") {
      if (!profile.client_id) {
        return res.status(403).json({ error: "No client assigned" });
      }
      query = query.eq("client_id", profile.client_id);
    }

    const { data: campaign, error: fetchError } = await query.single();

    if (fetchError || !campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Check if campaign is locked and user is not admin
    if (campaign.is_locked && profile.role !== "baymo_admin") {
      return res
        .status(403)
        .json({ error: "Campaign is locked. Contact admin to edit." });
    }

    // Check permissions: viewer and agent cannot edit
    if (profile.role === "viewer" || profile.role === "agent") {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    // Update campaign
    const { data, error } = await supabase
      .from("campaigns")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update campaign error:", error);
      return res.status(500).json({ error: "Failed to update campaign" });
    }

    return res.status(200).json(data);
  }

  return res.status(405).json({ error: "Method not allowed" });
}