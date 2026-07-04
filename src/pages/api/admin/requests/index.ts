import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/admin/requests
 * baymo_admin only. Lists open client-initiated requests from the BaMo RE
 * Assistant mobile app — the three request tables (subscription_requests,
 * video_requests, campaign_requests) had zero admin-facing UI before this.
 */
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
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

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

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // created_by references auth.users, not public.profiles, so there is no
    // FK PostgREST can embed directly — fetch profiles separately and merge.
    const [subs, videos, campaigns] = await Promise.all([
      adminClient.from("subscription_requests").select("*, clients(name)").order("created_at", { ascending: false }).limit(100),
      adminClient.from("video_requests").select("*, clients(name)").order("created_at", { ascending: false }).limit(100),
      adminClient.from("campaign_requests").select("*, clients(name)").order("created_at", { ascending: false }).limit(100),
    ]);

    const allRows = [...(subs.data ?? []), ...(videos.data ?? []), ...(campaigns.data ?? [])];
    const creatorIds = Array.from(new Set(allRows.map((r) => r.created_by).filter(Boolean)));
    const { data: creators } = creatorIds.length
      ? await adminClient.from("profiles").select("id, full_name, email").in("id", creatorIds)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
    const creatorMap = new Map((creators ?? []).map((c) => [c.id, c]));
    const withCreator = <T extends { created_by: string | null }>(rows: T[]) =>
      rows.map((r) => ({ ...r, created_by_profile: r.created_by ? creatorMap.get(r.created_by) ?? null : null }));

    return res.status(200).json({
      subscriptions: withCreator(subs.data ?? []),
      videos: withCreator(videos.data ?? []),
      campaigns: withCreator(campaigns.data ?? []),
    });
  } catch (error) {
    console.error("Error in admin requests API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
