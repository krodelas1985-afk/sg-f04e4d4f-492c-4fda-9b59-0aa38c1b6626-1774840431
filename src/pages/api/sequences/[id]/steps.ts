import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";

const VALID_STEP_TYPES = ["messenger", "email", "call"];

// Validate/normalize the optional quick_replies field (FB Messenger quick reply
// buttons). Accepts null/undefined (cleared), otherwise an array of
// { title, payload } with non-empty strings, max 13 entries.
type QuickReply = { title: string; payload: string };
function validateQuickReplies(
  qr: unknown
): { error?: string; value: QuickReply[] | null } {
  if (qr === null || qr === undefined) return { value: null };
  if (!Array.isArray(qr)) {
    return { error: "quick_replies must be an array", value: null };
  }
  if (qr.length > 13) {
    return { error: "quick_replies cannot exceed 13 entries", value: null };
  }
  const cleaned: QuickReply[] = [];
  for (const item of qr) {
    if (!item || typeof item !== "object") {
      return {
        error: "Each quick reply must have a title and a payload",
        value: null,
      };
    }
    const title = (item as Record<string, unknown>).title;
    const payload = (item as Record<string, unknown>).payload;
    if (typeof title !== "string" || title.trim() === "") {
      return {
        error: "Each quick reply requires a non-empty title",
        value: null,
      };
    }
    if (title.trim().length > 20) {
      return {
        error: `Quick reply title must be 20 characters or fewer (FB Messenger limit). Got ${title.trim().length} chars: '${title.trim()}'`,
        value: null,
      };
    }
    if (typeof payload !== "string" || payload.trim() === "") {
      return {
        error: "Each quick reply requires a non-empty payload",
        value: null,
      };
    }
    cleaned.push({ title: title.trim(), payload: payload.trim() });
  }
  return { value: cleaned.length > 0 ? cleaned : null };
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
      quick_replies,
    } = req.body;

    if (!title || !step_type) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!VALID_STEP_TYPES.includes(step_type)) {
      return res.status(400).json({ error: "Invalid step_type" });
    }
    const qr = validateQuickReplies(quick_replies);
    if (qr.error) {
      return res.status(400).json({ error: qr.error });
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
        quick_replies: qr.value,
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
      quick_replies,
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
    if (quick_replies !== undefined) {
      const qr = validateQuickReplies(quick_replies);
      if (qr.error) {
        return res.status(400).json({ error: qr.error });
      }
      updateData.quick_replies = qr.value;
    }
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
