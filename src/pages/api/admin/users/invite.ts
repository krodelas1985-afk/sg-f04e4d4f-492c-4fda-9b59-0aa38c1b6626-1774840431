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
    const supabase = createServerClient();
    
    // Get current user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get current user profile with role and client_id
    const { data: currentProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, client_id")
      .eq("id", session.user.id)
      .single();

    if (profileError || !currentProfile) {
      return res.status(403).json({ error: "Profile not found" });
    }

    // CRITICAL: Only baymo_admin and client_admin can invite users
    if (currentProfile.role !== "baymo_admin" && currentProfile.role !== "client_admin") {
      return res.status(403).json({ error: "You do not have permission to invite users" });
    }

    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: "Email and role are required" });
    }

    // CRITICAL: client_admin can only create users in their own organization
    const targetClientId = currentProfile.role === "baymo_admin" 
      ? req.body.client_id || currentProfile.client_id  // baymo_admin can specify client_id
      : currentProfile.client_id;  // client_admin always uses their own client_id

    // Use service role for admin operations
    const supabaseAdmin = createServerClient();

    // Send Supabase Auth invitation
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          role: role,
          client_id: targetClientId,
        },
      }
    );

    if (authError) {
      console.error("Auth invite error:", authError);
      return res.status(400).json({ error: authError.message });
    }

    // Create or update profile record with correct client_id
    const { error: profileInsertError } = await supabaseAdmin.from("profiles").upsert({
      id: authData.user.id,
      email: email,
      role: role,
      client_id: targetClientId,
      is_active: true,
      created_at: new Date().toISOString(),
    });

    if (profileInsertError) {
      console.error("Profile insert error:", profileInsertError);
      return res.status(500).json({ error: "Failed to create profile" });
    }

    return res.status(200).json({ 
      success: true, 
      message: "User invited successfully",
      user: authData.user 
    });
  } catch (error: any) {
    console.error("Invite user error:", error);
    return res.status(500).json({ error: error.message || "Failed to invite user" });
  }
}