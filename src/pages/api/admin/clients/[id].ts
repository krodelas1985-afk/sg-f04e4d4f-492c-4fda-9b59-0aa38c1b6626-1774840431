import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get session and check role
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, client_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Use service role key for baymo_admin, regular client for others
    const dbClient = profile.role === "baymo_admin" ? adminClient : supabase;

    // For non-admin users, verify they own this client
    if (profile.role !== "baymo_admin" && profile.client_id !== id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (req.method === "GET") {
      const { data: client, error } = await dbClient
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !client) {
        return res.status(404).json({ error: "Client not found" });
      }

      return res.status(200).json({ client });
    }

    if (req.method === "PUT") {
      const { name, company_name, email, phone, is_active, bamo_api_key, fb_page_token, fb_page_id } = req.body;

      const updatePayload: Record<string, unknown> = {};
      if (name !== undefined) updatePayload.name = name;
      if (company_name !== undefined) updatePayload.company_name = company_name;
      if (email !== undefined) updatePayload.email = email;
      if (phone !== undefined) updatePayload.phone = phone;
      if (is_active !== undefined) updatePayload.is_active = is_active;
      if (bamo_api_key !== undefined) updatePayload.bamo_api_key = bamo_api_key;
      if (fb_page_token !== undefined) updatePayload.fb_page_token = fb_page_token;
      if (fb_page_id !== undefined) updatePayload.fb_page_id = fb_page_id;

      const { data: client, error } = await dbClient
        .from("clients")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating client:", error);
        return res.status(500).json({ error: "Failed to update client" });
      }

      return res.status(200).json({ client });
    }

    if (req.method === "DELETE") {
      const { error } = await dbClient
        .from("clients")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting client:", error);
        return res.status(500).json({ error: "Failed to delete client" });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in client API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}