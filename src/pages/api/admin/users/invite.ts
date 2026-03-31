import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: "Email and role are required" });
    }

    // Get current user's session
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get current user's profile to check role and client_id
    const { data: currentProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, client_id")
      .eq("id", user.id)
      .single();

    if (profileError || !currentProfile) {
      return res.status(403).json({ error: "Profile not found" });
    }

    // Only client_admin can invite users
    if (currentProfile.role !== "client_admin") {
      return res.status(403).json({ error: "Only client admins can invite users" });
    }

    // Create user with Supabase Auth
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        role: role,
        client_id: currentProfile.client_id,
      },
    });

    if (createError) {
      throw createError;
    }

    // Create or update profile
    if (authData.user) {
      await supabaseAdmin.from("profiles").upsert({
        id: authData.user.id,
        email: email,
        role: role,
        client_id: currentProfile.client_id,
        is_active: true,
        created_at: new Date().toISOString(),
      });
    }

    return res.status(200).json({ success: true, user: authData.user });
  } catch (error: any) {
    console.error("Error inviting user:", error);
    return res.status(500).json({ error: error.message || "Failed to invite user" });
  }
}