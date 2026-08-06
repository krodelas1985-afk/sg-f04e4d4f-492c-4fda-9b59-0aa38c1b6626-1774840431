import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { getCampaignKbReadiness, kbBlockReason } from "@/lib/kb/readiness";

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
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Campaign ID required" });
  }

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
    const {
      name,
      channel,
      status,
      target_action,
      config,
      is_locked,
      currency,
      start_date,
      end_date,
      success_metric,
      source_detail,
      target_industries,
      job_titles,
      campaign_rules,
      enrollment_rules,
      priority,
      scheduled_steps_enabled,
      conversational_ai_enabled,
      ai_decision_instructions,
      ai_message_instructions,
      ai_instruction
    } = req.body;

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

    // Access control
    if (campaign.is_locked && profile.role !== "baymo_admin") {
      return res.status(403).json({ error: "Campaign is locked. Only BayMo admin can edit." });
    }

    const canEdit = profile.role === "baymo_admin" || 
                    profile.role === "client_admin" || 
                    profile.role === "manager";
    
    if (!canEdit) {
      return res.status(403).json({ error: "You do not have permission to edit this campaign" });
    }

    // Build update object
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (channel !== undefined) updateData.channel = channel;
    if (status !== undefined) updateData.status = status;
    if (target_action !== undefined) updateData.target_action = target_action;
    if (config !== undefined) updateData.config = config;
    if (currency !== undefined) updateData.currency = currency || "PHP";
    if (start_date !== undefined) updateData.start_date = start_date;
    if (end_date !== undefined) updateData.end_date = end_date;
    if (success_metric !== undefined) updateData.success_metric = success_metric;
    if (source_detail !== undefined) updateData.source_detail = source_detail;
    if (target_industries !== undefined) updateData.target_industries = Array.isArray(target_industries) ? target_industries : [];
    if (job_titles !== undefined) updateData.job_titles = Array.isArray(job_titles) ? job_titles : [];
    if (campaign_rules !== undefined) updateData.campaign_rules = campaign_rules;
    if (enrollment_rules !== undefined) updateData.enrollment_rules = enrollment_rules;
    if (priority !== undefined) updateData.priority = priority;
    if (scheduled_steps_enabled !== undefined) updateData.scheduled_steps_enabled = scheduled_steps_enabled;
    if (conversational_ai_enabled !== undefined) updateData.conversational_ai_enabled = conversational_ai_enabled;
    if (ai_decision_instructions !== undefined) updateData.ai_decision_instructions = ai_decision_instructions || null;
    if (ai_message_instructions !== undefined) updateData.ai_message_instructions = ai_message_instructions || null;
    if (ai_instruction !== undefined) updateData.ai_instruction = ai_instruction;

    // Only baymo_admin can update is_locked
    if (is_locked !== undefined && profile.role === "baymo_admin") {
      updateData.is_locked = is_locked;
    }

    updateData.updated_at = new Date().toISOString();

    // Never let conversational AI go live against an empty knowledge base — it
    // answers from prompt instructions alone and invents the rest (incident
    // 2026-08-06). trg_assert_campaign_kb_ready is the real enforcement; this
    // runs first only so the operator gets a reason instead of a raw PG error.
    // Same transition-only rule as the trigger: a campaign already in the bad
    // state stays editable, otherwise the save that fixes it would be rejected.
    const nextStatus = updateData.status ?? campaign.status;
    const nextAi = updateData.conversational_ai_enabled ?? campaign.conversational_ai_enabled;
    const wasLiveWithAi = campaign.status === "active" && !!campaign.conversational_ai_enabled;

    if (nextStatus === "active" && !!nextAi && !wasLiveWithAi) {
      try {
        const readiness = await getCampaignKbReadiness(id, campaign.client_id);
        if (!readiness.ready) {
          return res.status(409).json({
            error: kbBlockReason(readiness),
            code: "campaign_kb_empty",
            readiness,
          });
        }
      } catch (err) {
        console.error("KB readiness check failed:", err);
        return res.status(500).json({ error: "Could not verify the campaign knowledge base" });
      }
    }

    const { data, error } = await supabase
      .from("campaigns")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      // The DB trigger backstops every write path, including ones that skip
      // this handler. Surface its message rather than a generic 500.
      if ((error as { hint?: string }).hint === "campaign_kb_empty") {
        return res.status(409).json({ error: error.message, code: "campaign_kb_empty" });
      }
      console.error("Update campaign error:", error);
      return res.status(500).json({ error: "Failed to update campaign" });
    }

    return res.status(200).json(data);
  }

  return res.status(405).json({ error: "Method not allowed" });
}