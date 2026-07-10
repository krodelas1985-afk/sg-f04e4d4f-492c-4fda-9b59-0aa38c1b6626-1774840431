import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/admin/signups
 * baymo_admin only. Informational feed of self-serve signups from the RE
 * Assistant mobile app — one row per client_onboarding record (newest first),
 * with the auto-provisioned client (name + plan) and the signup's profile email.
 *
 * Read-only: public signup auto-provisions a free workspace with no approval
 * step (see provision_workspace_on_submit trigger), so this panel is for
 * visibility, not action.
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

    const {
      data: { session },
    } = await supabase.auth.getSession();
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

    const { data: rows } = await adminClient
      .from("client_onboarding")
      .select(
        "id, status, business_type, full_name, company_name, email, phone, source, created_at, submitted_at, client_id, clients(name, plan)"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    return res.status(200).json({ signups: rows ?? [] });
  } catch (error) {
    console.error("Error fetching signups:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
