import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/admin/requests/pending-count
 * baymo_admin only. Cheap head-only counts powering the "Client Requests"
 * sidebar badge, so an application sitting in the queue is visible from every
 * page instead of only on /admin/requests.
 */

// Statuses that mean "someone already dealt with this". Anything else is open.
// Kept in step with statusVariant() in src/pages/admin/requests.tsx.
const TERMINAL = ["closed", "delivered", "launched", "approved", "cancelled", "declined"];

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
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
      .eq("id", user.id)
      .single();

    if (profile?.role !== "baymo_admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const openFilter = `(${TERMINAL.join(",")})`;

    const [applications, subscriptions, videos, campaigns] = await Promise.all([
      adminClient
        .from("client_onboarding")
        .select("id", { count: "exact", head: true })
        .eq("source", "web")
        .not("status", "in", openFilter),
      adminClient
        .from("subscription_requests")
        .select("id", { count: "exact", head: true })
        .not("status", "in", openFilter),
      adminClient
        .from("video_requests")
        .select("id", { count: "exact", head: true })
        .not("status", "in", openFilter),
      adminClient
        .from("campaign_requests")
        .select("id", { count: "exact", head: true })
        .not("status", "in", openFilter),
    ]);

    const counts = {
      applications: applications.count ?? 0,
      subscriptions: subscriptions.count ?? 0,
      videos: videos.count ?? 0,
      campaigns: campaigns.count ?? 0,
    };

    return res.status(200).json({
      ...counts,
      total: counts.applications + counts.subscriptions + counts.videos + counts.campaigns,
    });
  } catch (error) {
    console.error("Error in admin requests pending-count API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
