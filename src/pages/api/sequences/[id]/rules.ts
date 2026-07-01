import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";

// Normalize a value into a string[] or null (for nullable array filters)
function toArrayOrNull(value: any): string[] | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) {
    return value.length > 0 ? value : null;
  }
  return null;
}

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
    return res.status(400).json({ error: "Sequence ID required" });
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

  // sequence tables are not in the generated Database types yet — cast narrowly
  const db = supabase as any;

  // Verify the parent sequence belongs to this user's client (tenant isolation)
  let seqQuery = db.from("sequences").select("id, client_id").eq("id", id);
  if (profile.role !== "baymo_admin") {
    if (!profile.client_id) {
      return res.status(403).json({ error: "No client assigned" });
    }
    seqQuery = seqQuery.eq("client_id", profile.client_id);
  }
  const { data: sequence, error: seqError } = await seqQuery.single();
  if (seqError || !sequence) {
    return res.status(404).json({ error: "Sequence not found" });
  }

  if (req.method === "GET") {
    const { data, error } = await db
      .from("enrollment_rules")
      .select("*")
      .eq("sequence_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Fetch rules error:", error);
      return res.status(500).json({ error: "Failed to fetch rules" });
    }
    return res.status(200).json(data || []);
  }

  if (req.method === "POST") {
    const {
      rule_name,
      source_filter,
      inactivity_days,
      last_inbound_max_hours,
      last_contacted_min_hours,
      ai_outbound_min_hours,
      temperature_filter,
      conversation_stage_filter,
      quality_filter,
      pipeline_stage_filter,
      enabled,
    } = req.body;

    if (!rule_name) {
      return res.status(400).json({ error: "rule_name required" });
    }

    const { data, error } = await db
      .from("enrollment_rules")
      .insert({
        sequence_id: id,
        rule_name,
        source_filter: toArrayOrNull(source_filter),
        inactivity_days:
          inactivity_days === undefined || inactivity_days === null
            ? null
            : inactivity_days,
        last_inbound_max_hours:
          last_inbound_max_hours === undefined ||
          last_inbound_max_hours === null
            ? null
            : last_inbound_max_hours,
        last_contacted_min_hours:
          last_contacted_min_hours === undefined ||
          last_contacted_min_hours === null
            ? null
            : last_contacted_min_hours,
        ai_outbound_min_hours:
          ai_outbound_min_hours === undefined || ai_outbound_min_hours === null
            ? null
            : ai_outbound_min_hours,
        temperature_filter: toArrayOrNull(temperature_filter),
        conversation_stage_filter: toArrayOrNull(conversation_stage_filter),
        quality_filter: toArrayOrNull(quality_filter),
        pipeline_stage_filter: toArrayOrNull(pipeline_stage_filter),
        enabled: enabled ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error("Create rule error:", error);
      return res.status(500).json({ error: "Failed to create rule" });
    }
    return res.status(201).json(data);
  }

  if (req.method === "PATCH") {
    const {
      id: ruleId,
      rule_name,
      source_filter,
      inactivity_days,
      last_inbound_max_hours,
      last_contacted_min_hours,
      ai_outbound_min_hours,
      temperature_filter,
      conversation_stage_filter,
      quality_filter,
      pipeline_stage_filter,
      enabled,
    } = req.body;

    if (!ruleId) {
      return res.status(400).json({ error: "Rule id required" });
    }

    const updateData: any = {};
    if (rule_name !== undefined) updateData.rule_name = rule_name;
    if (source_filter !== undefined)
      updateData.source_filter = toArrayOrNull(source_filter);
    if (inactivity_days !== undefined)
      updateData.inactivity_days = inactivity_days;
    if (last_inbound_max_hours !== undefined)
      updateData.last_inbound_max_hours = last_inbound_max_hours;
    if (last_contacted_min_hours !== undefined)
      updateData.last_contacted_min_hours = last_contacted_min_hours;
    if (ai_outbound_min_hours !== undefined)
      updateData.ai_outbound_min_hours = ai_outbound_min_hours;
    if (temperature_filter !== undefined)
      updateData.temperature_filter = toArrayOrNull(temperature_filter);
    if (conversation_stage_filter !== undefined)
      updateData.conversation_stage_filter = toArrayOrNull(
        conversation_stage_filter
      );
    if (quality_filter !== undefined)
      updateData.quality_filter = toArrayOrNull(quality_filter);
    if (pipeline_stage_filter !== undefined)
      updateData.pipeline_stage_filter = toArrayOrNull(pipeline_stage_filter);
    if (enabled !== undefined) updateData.enabled = enabled;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await db
      .from("enrollment_rules")
      .update(updateData)
      .eq("id", ruleId)
      .eq("sequence_id", id)
      .select()
      .single();

    if (error) {
      console.error("Update rule error:", error);
      return res.status(500).json({ error: "Failed to update rule" });
    }
    return res.status(200).json(data);
  }

  if (req.method === "DELETE") {
    const { rule_id } = req.query;
    if (!rule_id || typeof rule_id !== "string") {
      return res.status(400).json({ error: "rule_id required" });
    }

    const { error } = await db
      .from("enrollment_rules")
      .delete()
      .eq("id", rule_id)
      .eq("sequence_id", id);

    if (error) {
      console.error("Delete rule error:", error);
      return res.status(500).json({ error: "Failed to delete rule" });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
