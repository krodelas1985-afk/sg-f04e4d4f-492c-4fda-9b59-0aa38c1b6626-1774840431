import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;

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
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile?.role !== "baymo_admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (req.method === "GET") {
      const { data: users, error } = await adminClient
        .from("profiles")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching users:", error);
        return res.status(500).json({ error: "Failed to fetch users" });
      }

      return res.status(200).json({ users: users || [] });
    }

    if (req.method === "POST") {
      const { email, full_name, role, phone } = req.body;

      if (!email || !role) {
        return res.status(400).json({ error: "Email and role are required" });
      }

      // Check if user already exists
      const { data: existingUser } = await adminClient
        .from("profiles")
        .select("*")
        .eq("email", email)
        .single();

      if (existingUser) {
        // User exists, link to this client
        const { data: updatedUser, error } = await adminClient
          .from("profiles")
          .update({ client_id: id, role })
          .eq("id", existingUser.id)
          .select()
          .single();

        if (error) {
          console.error("Error linking user:", error);
          return res.status(500).json({ error: "Failed to link user" });
        }

        return res.status(200).json({ user: updatedUser, linked: true });
      }

      // Create new auth user
      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      if (authError || !authUser.user) {
        console.error("Error creating auth user:", authError);
        return res.status(500).json({ error: "Failed to create user" });
      }

      // Update profile with client_id and role
      const { data: newUser, error: profileError } = await adminClient
        .from("profiles")
        .update({
          client_id: id,
          role,
          full_name,
          phone,
        })
        .eq("id", authUser.user.id)
        .select()
        .single();

      if (profileError) {
        console.error("Error updating profile:", profileError);
        return res.status(500).json({ error: "Failed to update profile" });
      }

      return res.status(201).json({ user: newUser, created: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in users API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}