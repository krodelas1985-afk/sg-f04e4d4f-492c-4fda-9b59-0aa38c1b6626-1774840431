import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

type ProfileResponse = {
  role: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProfileResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ role: "", error: "Method not allowed" });
  }

  try {
    // Create anon client to verify session
    const supabaseClient = createServerClient(
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

    // Verify user is authenticated
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    if (!session?.user) {
      return res.status(401).json({ role: "", error: "Unauthorized" });
    }

    // Use service role client to fetch profile (bypasses RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (error || !profile) {
      console.error("Profile fetch error:", error);
      return res.status(500).json({ role: "", error: "Failed to fetch profile" });
    }

    return res.status(200).json({ role: profile.role });
  } catch (error) {
    console.error("Profile API error:", error);
    return res.status(500).json({ role: "", error: "Internal server error" });
  }
}