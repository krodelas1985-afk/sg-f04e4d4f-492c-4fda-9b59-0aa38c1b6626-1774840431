import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { provisionUser } from "@/lib/provisionUser";

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Get user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "baymo_admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Extract clientId from URL parameter
  const { id } = req.query;
  const clientId = typeof id === "string" ? id : null;

  if (!clientId) {
    return res.status(400).json({ error: "Client ID is required" });
  }

  console.log("📋 clientId from route params:", clientId);

  // Service role client for admin operations
  const serviceRoleClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

    return res.status(200).json(data);
  }

  if (req.method === "POST") {
    const { email, role, full_name, password } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: "Email and role are required" });
    }

    const VALID_ROLES = ["client_admin", "manager", "agent", "viewer"];
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    if (password && String(password).length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.bahaymo.com";

    try {
      const result = await provisionUser(serviceRoleClient, {
        email,
        role,
        clientId,
        password,
        fullName: full_name,
        inviteRedirectTo: `${appUrl}/auth/set-password`,
      });

      // Return the resulting profile row (shape the UI's user list expects).
      const { data: profileRow } = await serviceRoleClient
        .from("profiles")
        .select("*")
        .eq("id", result.userId)
        .single();

      let message: string;
      if (result.invited) {
        message = `Invitation sent to ${email}. They will receive an email to set their password.`;
      } else if (!result.created) {
        message = result.passwordSet
          ? `Existing account for ${email} was re-linked and its password was updated. They can now log in.`
          : `User ${email} linked to this client successfully.`;
      } else {
        message = `Account created for ${email}. They can now log in.`;
      }

      return res.status(result.created ? 201 : 200).json({ ...profileRow, message });
    } catch (error: any) {
      console.error("Error provisioning user:", error);
      return res.status(500).json({ error: error?.message || "Failed to create user" });
    }
  }

  if (req.method === "DELETE") {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Soft delete by setting client_id to null
    const { error } = await serviceRoleClient
      .from("profiles")
      .update({ client_id: null })
      .eq("id", userId);

    if (error) {
      console.error("Error removing user:", error);
      return res.status(500).json({ error: "Failed to remove user" });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}