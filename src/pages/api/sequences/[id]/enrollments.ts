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

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
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

  // Read-only: join enrollments to leads for the monitor tab
  const { data, error } = await db
    .from("sequence_enrollments")
    .select(
      `
      *,
      lead:leads(name)
    `
    )
    .eq("sequence_id", id)
    .order("next_step_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Fetch enrollments error:", error);
    return res.status(500).json({ error: "Failed to fetch enrollments" });
  }

  return res.status(200).json(data || []);
}
