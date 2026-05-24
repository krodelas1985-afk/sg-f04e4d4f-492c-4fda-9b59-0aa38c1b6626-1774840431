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

    // Check if user already exists
    const { data: existingUser } = await serviceRoleClient
      .from("profiles")
      .select("id, email, client_id")
      .eq("email", email)
      .single();

    if (existingUser) {
      const { data: updateData, error: updateError } = await serviceRoleClient
        .from("profiles")
        .update({ client_id: clientId, role: role })
        .eq("id", existingUser.id)
        .select()
        .single();

      if (updateError) {
        return res.status(500).json({ error: "Failed to link user to client" });
      }

      return res.status(200).json({
        ...updateData,
        message: `User ${email} linked to this client successfully`,
      });
    }

    try {
      let authUserId: string;

      if (password) {
        // Create user directly with a password (no invite email)
        const { data: createData, error: createError } =
          await serviceRoleClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              full_name: full_name || email.split("@")[0],
              role,
              client_id: clientId,
            },
          });

        if (createError || !createData.user) {
          return res.status(500).json({ error: "Failed to create user account" });
        }

        authUserId = createData.user.id;
      } else {
        // Send invitation email
        const { data: inviteData, error: inviteError } =
          await serviceRoleClient.auth.admin.inviteUserByEmail(email, {
            data: {
              full_name: full_name || email.split("@")[0],
              role,
              client_id: clientId,
            },
            redirectTo:
              "https://3000-f04e4d4f-492c-4fda-9b59-0aa38c1b6626.softgen.dev/auth/set-password",
          });

        if (inviteError || !inviteData?.user?.id) {
          return res.status(500).json({ error: "Failed to send invitation email" });
        }

        authUserId = inviteData.user.id;
      }

      // Update or create profile row
      const { data: updateData, error: updateError } = await serviceRoleClient
        .from("profiles")
        .upsert({
          id: authUserId,
          client_id: clientId,
          role,
          full_name: full_name || email.split("@")[0],
          email,
        })
        .select()
        .single();

      if (updateError) {
        return res.status(500).json({ error: "User created but failed to set client association." });
      }

      return res.status(201).json({
        ...updateData,
        message: password
          ? `Account created for ${email}. They can now log in.`
          : `Invitation sent to ${email}. They will receive an email to set their password.`,
      });
    } catch (error) {
      return res.status(500).json({ error: "Failed to create user" });
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