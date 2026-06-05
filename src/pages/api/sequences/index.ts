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
    const { name, description, client_id } = req.body;

    if (!name) {
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

    const { data, error } = await db
      .from("sequences")
      .insert({
        name,
        description: description ?? null,
        client_id: sequenceClientId,
        is_active: true,
        scheduled_steps_enabled: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Create sequence error:", error);
      return res.status(500).json({ error: "Failed to create sequence" });
    }

    return res.status(201).json(data);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
