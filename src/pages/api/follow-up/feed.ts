import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";

// Read-only Follow-Up AI feed: live ai_adaptive enrollment counts + the decision
// log (the transparency surface — agents see WHY the AI acted, not just messages).
// Cookie auth + RLS: follow_up_decisions / sequence_enrollments are client-scoped,
// so baymo_admin sees all and client_admin/manager/agent see their own workspace.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

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

  // getUser() revalidates the JWT against the Auth server; getSession() only
  // decodes the cookie. Authorization here rests on RLS (anon key, so PostgREST
  // verifies the signature anyway), but house style since the api-auth-hardening
  // sweep is getUser() everywhere — no route should model the weaker pattern.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  const db = supabase as any;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    // Decision feed (latest 50) with the lead's name via FK embed. RLS-scoped.
    const feedFrom = db
      .from("follow_up_decisions")
      .select("id, created_at, decision, reason, message_sent, goal_status, window_open, leads(name)")
      .order("created_at", { ascending: false })
      .limit(50);

    // Live ai_adaptive enrollments (state counts). !inner filters to adaptive sequences.
    const enrollFrom = db
      .from("sequence_enrollments")
      .select("state, sequences!inner(mode)")
      .eq("sequences.mode", "ai_adaptive");

    // Decisions in the last 7 days, for the mix + sends count.
    const recentFrom = db
      .from("follow_up_decisions")
      .select("decision, created_at")
      .gte("created_at", sevenDaysAgo);

    const [feedRes, enrollRes, recentRes] = await Promise.all([feedFrom, enrollFrom, recentFrom]);
    if (feedRes.error) throw feedRes.error;
    if (enrollRes.error) throw enrollRes.error;
    if (recentRes.error) throw recentRes.error;

    const enrollmentsByState: Record<string, number> = {};
    for (const r of enrollRes.data || []) {
      enrollmentsByState[r.state] = (enrollmentsByState[r.state] || 0) + 1;
    }

    const decisionsByType: Record<string, number> = {};
    for (const r of recentRes.data || []) {
      decisionsByType[r.decision] = (decisionsByType[r.decision] || 0) + 1;
    }

    const feed = (feedRes.data || []).map((d: any) => ({
      id: d.id,
      created_at: d.created_at,
      decision: d.decision,
      reason: d.reason,
      message_sent: d.message_sent,
      goal_status: d.goal_status,
      window_open: d.window_open,
      lead_name: d.leads?.name ?? "Unknown lead",
    }));

    return res.status(200).json({
      summary: {
        enrollments_by_state: enrollmentsByState,
        live_enrollments:
          (enrollmentsByState["active"] || 0) +
          (enrollmentsByState["waiting_window"] || 0) +
          (enrollmentsByState["paused"] || 0),
        decisions_7d: decisionsByType,
        sends_7d: decisionsByType["send"] || 0,
        escalations_7d: decisionsByType["escalate"] || 0,
      },
      feed,
    });
  } catch (e: any) {
    console.error("follow-up feed error:", e);
    return res.status(500).json({ error: "Failed to load follow-up feed" });
  }
}
