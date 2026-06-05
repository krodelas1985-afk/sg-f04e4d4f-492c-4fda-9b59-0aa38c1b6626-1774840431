import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";

const VALID_STEP_TYPES = ["messenger", "email", "call"];

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
      .from("sequence_steps")
      .select("*")
      .eq("sequence_id", id)
      .order("step_order", { ascending: true });

    if (error) {
      console.error("Fetch steps error:", error);
      return res.status(500).json({ error: "Failed to fetch steps" });
    }
    return res.status(200).json(data || []);
  }

  if (req.method === "POST") {
    const {
      title,
      step_type,
      message_content,
      delay_hours,
      step_order,
    } = req.body;

    if (!title || !step_type) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!VALID_STEP_TYPES.includes(step_type)) {
      return res.status(400).json({ error: "Invalid step_type" });
    }

    // Auto-assign step_order = max + 1 when omitted
    let order = step_order;
    if (order === undefined || order === null) {
      const { data: maxRow } = await db
        .from("sequence_steps")
        .select("step_order")
        .eq("sequence_id", id)
        .order("step_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      order = maxRow ? maxRow.step_order + 1 : 1;
    }

    const { data, error } = await db
      .from("sequence_steps")
      .insert({
        sequence_id: id,
        title,
        step_type,
        message_content: message_content ?? null,
        delay_hours: delay_hours ?? 24,
        step_order: order,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Create step error:", error);
      return res.status(500).json({ error: "Failed to create step" });
    }
    return res.status(201).json(data);
  }

  if (req.method === "PATCH") {
    const {
      id: stepId,
      title,
      step_type,
      message_content,
      delay_hours,
      step_order,
      is_active,
    } = req.body;

    if (!stepId) {
      return res.status(400).json({ error: "Step id required" });
    }
    if (step_type !== undefined && !VALID_STEP_TYPES.includes(step_type)) {
      return res.status(400).json({ error: "Invalid step_type" });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (step_type !== undefined) updateData.step_type = step_type;
    if (message_content !== undefined)
      updateData.message_content = message_content;
    if (delay_hours !== undefined) updateData.delay_hours = delay_hours;
    if (step_order !== undefined) updateData.step_order = step_order;
    if (is_active !== undefined) updateData.is_active = is_active;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await db
      .from("sequence_steps")
      .update(updateData)
      .eq("id", stepId)
      .eq("sequence_id", id)
      .select()
      .single();

    if (error) {
      console.error("Update step error:", error);
      return res.status(500).json({ error: "Failed to update step" });
    }
    return res.status(200).json(data);
  }

  if (req.method === "DELETE") {
    const { step_id } = req.query;
    if (!step_id || typeof step_id !== "string") {
      return res.status(400).json({ error: "step_id required" });
    }

    const { error } = await db
      .from("sequence_steps")
      .delete()
      .eq("id", step_id)
      .eq("sequence_id", id);

    if (error) {
      console.error("Delete step error:", error);
      return res.status(500).json({ error: "Failed to delete step" });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
