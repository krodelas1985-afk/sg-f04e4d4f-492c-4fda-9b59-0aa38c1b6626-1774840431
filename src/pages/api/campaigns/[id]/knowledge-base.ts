import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const campaignId = id as string;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // ─────────────────────────────────────────
  // GET — Fetch knowledge base entries
  // ─────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, client_id")
        .eq("id", user.id)
        .single();

      if (!profile) {
        return res.status(401).json({ error: "Profile not found" });
      }

      let query = supabase
        .from("campaign_knowledge_base")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      // Filter by client_id if not baymo_admin
      if (profile.role !== "baymo_admin") {
        query = query.eq("client_id", profile.client_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching knowledge base:", error);
        return res.status(500).json({ error: "Failed to fetch knowledge base" });
      }

      return res.status(200).json(data || []);
    } catch (error) {
      console.error("GET knowledge base error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // ─────────────────────────────────────────
  // POST — Create new knowledge base entry
  // ─────────────────────────────────────────
  if (req.method === "POST") {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, client_id")
        .eq("id", user.id)
        .single();

      if (!profile) {
        return res.status(401).json({ error: "Profile not found" });
      }

      // Only allow specific roles
      const allowedRoles = ["baymo_admin", "client_admin", "manager"];
      if (!allowedRoles.includes(profile.role)) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const { title, content } = req.body;

      // Validate required fields
      if (!title || !title.trim()) {
        return res.status(400).json({ error: "Title is required" });
      }
      if (!content || !content.trim()) {
        return res.status(400).json({ error: "Content is required" });
      }

      // Determine client_id
      let clientId = profile.client_id;
      if (profile.role === "baymo_admin") {
        const { data: campaign } = await supabase
          .from("campaigns")
          .select("client_id")
          .eq("id", campaignId)
          .single();

        if (!campaign) {
          return res.status(404).json({ error: "Campaign not found" });
        }
        clientId = campaign.client_id;
      }

      // Insert new entry
      const { data: newEntry, error: insertError } = await supabase
        .from("campaign_knowledge_base")
        .insert({
          campaign_id: campaignId,
          client_id: clientId,
          title: title.trim(),
          content: content.trim(),
          is_active: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting knowledge base entry:", insertError);
        return res.status(500).json({ error: "Failed to create entry" });
      }

      return res.status(201).json(newEntry);
    } catch (error) {
      console.error("POST knowledge base error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // ─────────────────────────────────────────
  // DELETE — Soft delete knowledge base entry
  // ─────────────────────────────────────────
  if (req.method === "DELETE") {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, client_id")
        .eq("id", user.id)
        .single();

      if (!profile) {
        return res.status(401).json({ error: "Profile not found" });
      }

      // Only allow specific roles
      const allowedRoles = ["baymo_admin", "client_admin", "manager"];
      if (!allowedRoles.includes(profile.role)) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const { entry_id } = req.query;
      if (!entry_id) {
        return res.status(400).json({ error: "entry_id is required" });
      }

      // Soft delete: set is_active = false
      const { error: updateError } = await supabase
        .from("campaign_knowledge_base")
        .update({ is_active: false })
        .eq("id", entry_id as string);

      if (updateError) {
        console.error("Error deleting knowledge base entry:", updateError);
        return res.status(500).json({ error: "Failed to delete entry" });
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("DELETE knowledge base error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // ─────────────────────────────────────────
  // Method not allowed
  // ─────────────────────────────────────────
  return res.status(405).json({ error: "Method not allowed" });
}