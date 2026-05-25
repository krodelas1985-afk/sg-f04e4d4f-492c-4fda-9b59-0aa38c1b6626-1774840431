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

    const { id } = req.query;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Campaign ID required" });
    }

    if (req.method === "GET") {
      const { data, error } = await adminClient
        .from("campaigns")
        .select(`*, clients(id, name, company_name), client_campaigns(client_id)`)
        .eq("id", id)
        .single();

      if (error || !data) return res.status(404).json({ error: "Campaign not found" });
      return res.status(200).json(data);
    }

    if (req.method === "PUT") {
      const {
        name, channel, status, target_action, config,
        is_locked, is_active, client_id, currency,
        start_date, end_date, success_metric, source_detail,
        target_industries, job_titles, campaign_rules,
        enrollment_rules, priority, scheduled_steps_enabled,
        conversational_ai_enabled, ai_decision_instructions,
        ai_message_instructions, assigned_client_ids
      } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (channel !== undefined) updateData.channel = channel;
      if (status !== undefined) updateData.status = status;
      if (target_action !== undefined) updateData.target_action = target_action;
      if (config !== undefined) updateData.config = config;
      if (is_locked !== undefined) updateData.is_locked = is_locked;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (client_id !== undefined) updateData.client_id = client_id;
      if (currency !== undefined) updateData.currency = currency || "PHP";
      if (start_date !== undefined) updateData.start_date = start_date;
      if (end_date !== undefined) updateData.end_date = end_date;
      if (success_metric !== undefined) updateData.success_metric = success_metric;
      if (source_detail !== undefined) updateData.source_detail = source_detail;
      if (target_industries !== undefined) updateData.target_industries = target_industries;
      if (job_titles !== undefined) updateData.job_titles = job_titles;
      if (campaign_rules !== undefined) updateData.campaign_rules = campaign_rules;
      if (enrollment_rules !== undefined) updateData.enrollment_rules = enrollment_rules;
      if (priority !== undefined) updateData.priority = priority;
      if (scheduled_steps_enabled !== undefined) updateData.scheduled_steps_enabled = scheduled_steps_enabled;
      if (conversational_ai_enabled !== undefined) updateData.conversational_ai_enabled = conversational_ai_enabled;
      if (ai_decision_instructions !== undefined) updateData.ai_decision_instructions = ai_decision_instructions || null;
      if (ai_message_instructions !== undefined) updateData.ai_message_instructions = ai_message_instructions || null;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await adminClient
        .from("campaigns")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: "Failed to update campaign" });

      // Sync client_campaigns if assigned_client_ids was provided
      if (Array.isArray(assigned_client_ids)) {
        // Remove all existing assignments for this campaign
        await adminClient.from("client_campaigns").delete().eq("campaign_id", id);
        // Re-insert all selected client IDs (deduped)
        const uniqueIds = [...new Set(assigned_client_ids.filter(Boolean))] as string[];
        if (uniqueIds.length > 0) {
          await adminClient.from("client_campaigns").insert(
            uniqueIds.map((cid: string) => ({ campaign_id: id, client_id: cid }))
          );
        }
      }

      return res.status(200).json(data);
    }

    if (req.method === "DELETE") {
      const { error } = await adminClient
        .from("campaigns")
        .delete()
        .eq("id", id);

      if (error) return res.status(500).json({ error: "Failed to delete campaign" });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Admin campaign [id] API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
