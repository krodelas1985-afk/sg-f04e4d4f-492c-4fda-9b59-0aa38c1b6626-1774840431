import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid campaign ID" });
  }

  if (req.method === "GET") {
    try {
      const { data, error } = await supabase
        .from("campaign_steps")
        .select("*")
        .eq("campaign_id", id)
        .eq("is_active", true)
        .order("step_order", { ascending: true });

      if (error) throw error;
      return res.status(200).json(data || []);
    } catch (error: any) {
      console.error("Error fetching campaign steps:", error);
      return res.status(500).json({ error: error.message || "Failed to fetch steps" });
    }
  }

  if (req.method === "POST") {
    try {
      // Verify session
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const token = authHeader.split(" ")[1];
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (userError || !user) {
        return res.status(401).json({ error: "Invalid session" });
      }

      // Get profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, client_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        return res.status(403).json({ error: "Profile not found" });
      }

      // Check role
      const allowedRoles = ["baymo_admin", "client_admin", "manager"];
      if (!allowedRoles.includes(profile.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const {
        step_type,
        delay_hours,
        channel,
        message_template,
        ai_screen_before_send,
        notification_message,
      } = req.body;

      if (!step_type) {
        return res.status(400).json({ error: "step_type is required" });
      }

      // Determine client_id
      let clientId = profile.client_id;
      if (profile.role === "baymo_admin") {
        const { data: campaign, error: campaignError } = await supabase
          .from("campaigns")
          .select("client_id")
          .eq("id", id)
          .single();

        if (campaignError || !campaign) {
          return res.status(404).json({ error: "Campaign not found" });
        }
        clientId = campaign.client_id;
      }

      // Get max step_order for this campaign
      const { data: maxStepData } = await supabase
        .from("campaign_steps")
        .select("step_order")
        .eq("campaign_id", id)
        .order("step_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const maxStepOrder = maxStepData?.step_order || 0;

      // Insert new step
      const { data: newStep, error: insertError } = await supabase
        .from("campaign_steps")
        .insert({
          campaign_id: id,
          client_id: clientId,
          step_order: maxStepOrder + 1,
          step_type,
          delay_hours: delay_hours || 0,
          channel: channel || "messenger",
          message_template: message_template || "",
          ai_screen_before_send: ai_screen_before_send || false,
          notification_message: notification_message || "",
          is_active: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return res.status(201).json(newStep);
    } catch (error: any) {
      console.error("Error creating campaign step:", error);
      return res.status(500).json({ error: error.message || "Failed to create step" });
    }
  }

  if (req.method === "DELETE") {
    try {
      // Verify session
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const token = authHeader.split(" ")[1];
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (userError || !user) {
        return res.status(401).json({ error: "Invalid session" });
      }

      // Get profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        return res.status(403).json({ error: "Profile not found" });
      }

      // Check role
      const allowedRoles = ["baymo_admin", "client_admin", "manager"];
      if (!allowedRoles.includes(profile.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const { step_id } = req.query;

      if (!step_id || typeof step_id !== "string") {
        return res.status(400).json({ error: "step_id is required" });
      }

      // Soft delete
      const { error: deleteError } = await supabase
        .from("campaign_steps")
        .update({ is_active: false })
        .eq("id", step_id);

      if (deleteError) throw deleteError;

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("Error deleting campaign step:", error);
      return res.status(500).json({ error: error.message || "Failed to delete step" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}