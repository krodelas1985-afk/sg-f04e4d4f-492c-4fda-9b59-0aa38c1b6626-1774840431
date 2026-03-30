import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

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
      const { data: client, error } = await adminClient
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !client) {
        return res.status(404).json({ error: "Client not found" });
      }

      return res.status(200).json({ client });
    }

    if (req.method === "PUT") {
      const { name, company_name, email, phone, is_active } = req.body;

      const { data: client, error } = await adminClient
        .from("clients")
        .update({
          name,
          company_name,
          email,
          phone,
          is_active,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating client:", error);
        return res.status(500).json({ error: "Failed to update client" });
      }

      return res.status(200).json({ client });
    }

    if (req.method === "DELETE") {
      const { error } = await adminClient
        .from("clients")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting client:", error);
        return res.status(500).json({ error: "Failed to delete client" });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in client API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}