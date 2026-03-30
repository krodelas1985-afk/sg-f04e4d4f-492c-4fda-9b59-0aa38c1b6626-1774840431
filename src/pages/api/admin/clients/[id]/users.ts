import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

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

  const serviceRoleClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { clientId } = req.query;

  // Verify authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Verify admin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "baymo_admin") {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }

  if (req.method === "GET") {
    const { data, error } = await serviceRoleClient
      .from("profiles")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ error: "Failed to fetch users" });
    }

    return res.status(200).json(data || []);
  }

  if (req.method === "POST") {
    const { email, role, full_name } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: "Email and role are required" });
    }

    // Check if user already exists
    const { data: existingUser } = await serviceRoleClient
      .from("profiles")
      .select("id, email, client_id")
      .eq("email", email)
      .single();

    if (existingUser) {
      // User exists, link to this client
      const { error: updateError } = await serviceRoleClient
        .from("profiles")
        .update({ 
          client_id: clientId,
          role: role 
        })
        .eq("id", existingUser.id);

      if (updateError) {
        console.error("Error linking user:", updateError);
        return res.status(500).json({ error: "Failed to link user to client" });
      }

      // Fetch updated user
      const { data: updatedUser } = await serviceRoleClient
        .from("profiles")
        .select("*")
        .eq("id", existingUser.id)
        .single();

      return res.status(200).json({ 
        ...updatedUser,
        message: `User ${email} linked to this client successfully`
      });
    }

    // User doesn't exist, invite new user
    try {
      // Step 1: Send invitation email
      const { data: inviteData, error: inviteError } = await serviceRoleClient.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: full_name || email.split('@')[0],
          role: role,
          client_id: clientId
        },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/set-password`
      });

      if (inviteError) {
        console.error("Error inviting user:", inviteError);
        return res.status(500).json({ error: "Failed to send invitation email" });
      }

      // Step 2: Immediately upsert profile with client_id and role
      // This ensures the profile has the correct client_id even if the trigger doesn't set it
      const { error: upsertError } = await serviceRoleClient
        .from("profiles")
        .upsert({
          id: inviteData.user.id,
          email: email,
          full_name: full_name || email.split('@')[0],
          role: role,
          client_id: clientId,
          is_active: true
        }, {
          onConflict: 'id'
        });

      if (upsertError) {
        console.error("Error updating profile after invite:", upsertError);
        return res.status(500).json({ 
          error: "User invited but failed to set client association. Please contact support." 
        });
      }

      // Fetch the complete profile to return
      const { data: profile } = await serviceRoleClient
        .from("profiles")
        .select("*")
        .eq("id", inviteData.user.id)
        .single();

      return res.status(201).json({
        ...profile,
        message: `Invitation sent to ${email}. They will receive an email to set their password.`
      });
    } catch (error) {
      console.error("Error in user invitation flow:", error);
      return res.status(500).json({ error: "Failed to invite user" });
    }
  }

  if (req.method === "DELETE") {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }

    const { error } = await serviceRoleClient
      .from("profiles")
      .update({ is_active: false })
      .eq("id", userId);

    if (error) {
      console.error("Error deactivating user:", error);
      return res.status(500).json({ error: "Failed to deactivate user" });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}