import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { getSequenceTemplate } from "@/lib/sequenceTemplates";

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

  if (req.method === "GET") {
    try {
      let query = db
        .from("sequences")
        .select("*")
        .order("created_at", { ascending: false });

      // If NOT baymo_admin, filter by client_id
      if (profile.role !== "baymo_admin") {
        if (!profile.client_id) {
          return res.status(403).json({ error: "No client assigned" });
        }
        query = query.eq("client_id", profile.client_id);
      }
      // If baymo_admin, fetch ALL sequences (no client_id filter)

      const { data, error } = await query;

      if (error) throw error;

      // Get steps + enrollment counts for each sequence
      const sequencesWithCounts = await Promise.all(
        (data || []).map(async (sequence: any) => {
          const [{ count: stepsCount }, { count: enrollmentCount }] =
            await Promise.all([
              db
                .from("sequence_steps")
                .select("*", { count: "exact", head: true })
                .eq("sequence_id", sequence.id),
              db
                .from("sequence_enrollments")
                .select("*", { count: "exact", head: true })
                .eq("sequence_id", sequence.id),
            ]);

          return {
            ...sequence,
            steps_count: stepsCount || 0,
            enrollment_count: enrollmentCount || 0,
          };
        })
      );

      return res.status(200).json(sequencesWithCounts);
    } catch (error) {
      console.error("Fetch sequences error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method === "POST") {
    const { name, description, client_id, template_key } = req.body;

    const template = template_key ? getSequenceTemplate(template_key) : null;
    if (template_key && !template) {
      return res.status(400).json({ error: "Unknown template_key" });
    }

    // Name may come from the request or, for a template, fall back to its name
    const sequenceName = (name ?? template?.name)?.toString().trim();
    if (!sequenceName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Determine client_id
    let sequenceClientId = client_id;

    if (profile.role !== "baymo_admin") {
      if (!profile.client_id) {
        return res
          .status(400)
          .json({ error: "User has no client association" });
      }
      sequenceClientId = profile.client_id;
    } else {
      if (!client_id) {
        return res
          .status(400)
          .json({ error: "Client ID required for admin users" });
      }
    }

    const insertPayload: any = {
      name: sequenceName,
      description: description ?? template?.description ?? null,
      client_id: sequenceClientId,
      is_active: true,
      scheduled_steps_enabled: true,
    };
    if (template) {
      insertPayload.send_window_start = template.send_window_start;
      insertPayload.send_window_end = template.send_window_end;
      insertPayload.reenroll_cooldown_days = template.reenroll_cooldown_days;
      insertPayload.max_passes = template.max_passes;
    }

    const { data, error } = await db
      .from("sequences")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error("Create sequence error:", error);
      return res.status(500).json({ error: "Failed to create sequence" });
    }

    // Expand the template's steps + rules. Rules are created DISABLED so the
    // agent reviews the sequence before it starts auto-enrolling leads.
    if (template) {
      const stepRows = template.steps.map((s, i) => ({
        sequence_id: data.id,
        title: s.title,
        step_type: s.step_type,
        message_content: s.message_content ?? null,
        delay_hours: s.delay_hours ?? 24,
        step_order: i + 1,
        quick_replies:
          s.step_type === "messenger" && s.quick_replies && s.quick_replies.length
            ? s.quick_replies
            : null,
        is_active: true,
      }));
      const ruleRows = template.rules.map((r) => ({
        sequence_id: data.id,
        rule_name: r.rule_name,
        source_filter: r.source_filter ?? null,
        temperature_filter: r.temperature_filter ?? null,
        quality_filter: r.quality_filter ?? null,
        pipeline_stage_filter: r.pipeline_stage_filter ?? null,
        conversation_stage_filter: r.conversation_stage_filter ?? null,
        inactivity_days: r.inactivity_days ?? null,
        last_inbound_max_hours: r.last_inbound_max_hours ?? null,
        last_contacted_min_hours: r.last_contacted_min_hours ?? null,
        ai_outbound_min_hours: r.ai_outbound_min_hours ?? null,
        enabled: false,
      }));

      const [stepRes, ruleRes] = await Promise.all([
        db.from("sequence_steps").insert(stepRows),
        db.from("enrollment_rules").insert(ruleRows),
      ]);
      if (stepRes.error || ruleRes.error) {
        console.error(
          "Template expansion error:",
          stepRes.error || ruleRes.error
        );
        // Roll back the bare sequence so we don't leave a half-built one behind
        await db.from("sequences").delete().eq("id", data.id);
        return res
          .status(500)
          .json({ error: "Failed to build sequence from template" });
      }
    }

    return res.status(201).json(data);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
