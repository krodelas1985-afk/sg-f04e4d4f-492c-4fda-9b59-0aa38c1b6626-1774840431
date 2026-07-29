import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";

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

  // Helper: fetch the sequence enforcing tenant isolation
  const fetchScoped = async () => {
    let query = db.from("sequences").select("*").eq("id", id);
    if (profile.role !== "baymo_admin") {
      if (!profile.client_id) return { error: "No client assigned" };
      query = query.eq("client_id", profile.client_id);
    }
    const { data, error } = await query.single();
    return { data, error };
  };

  if (req.method === "GET") {
    try {
      const { data, error } = await fetchScoped();
      if (error) throw error;
      if (!data) {
        return res.status(404).json({ error: "Sequence not found" });
      }
      return res.status(200).json(data);
    } catch (error) {
      console.error("Fetch sequence error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method === "PATCH") {
    const {
      name,
      description,
      is_active,
      scheduled_steps_enabled,
      send_window_start,
      send_window_end,
      reenroll_cooldown_days,
      max_passes,
    } = req.body;

    // Verify the sequence exists and is accessible to this user
    const { data: sequence, error: fetchError } = await fetchScoped();
    if (fetchError || !sequence) {
      return res.status(404).json({ error: "Sequence not found" });
    }

    const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (scheduled_steps_enabled !== undefined)
      updateData.scheduled_steps_enabled = scheduled_steps_enabled;
    if (send_window_start !== undefined) {
      if (send_window_start !== null && !HHMM.test(send_window_start)) {
        return res.status(400).json({ error: "send_window_start must be HH:MM" });
      }
      updateData.send_window_start = send_window_start;
    }
    if (send_window_end !== undefined) {
      if (send_window_end !== null && !HHMM.test(send_window_end)) {
        return res.status(400).json({ error: "send_window_end must be HH:MM" });
      }
      updateData.send_window_end = send_window_end;
    }
    if (reenroll_cooldown_days !== undefined) {
      const n = Number(reenroll_cooldown_days);
      if (!Number.isInteger(n) || n < 0) {
        return res
          .status(400)
          .json({ error: "reenroll_cooldown_days must be a non-negative integer" });
      }
      updateData.reenroll_cooldown_days = n;
    }
    if (max_passes !== undefined) {
      const n = Number(max_passes);
      if (!Number.isInteger(n) || n < 1) {
        return res
          .status(400)
          .json({ error: "max_passes must be a positive integer" });
      }
      updateData.max_passes = n;
    }
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await db
      .from("sequences")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update sequence error:", error);
      return res.status(500).json({ error: "Failed to update sequence" });
    }

    return res.status(200).json(data);
  }

  if (req.method === "DELETE") {
    // Verify the sequence exists and is accessible to this user
    const { data: sequence, error: fetchError } = await fetchScoped();
    if (fetchError || !sequence) {
      return res.status(404).json({ error: "Sequence not found" });
    }

    // Cascades to steps/rules/enrollments via FK
    const { error } = await db.from("sequences").delete().eq("id", id);

    if (error) {
      console.error("Delete sequence error:", error);
      return res.status(500).json({ error: "Failed to delete sequence" });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
