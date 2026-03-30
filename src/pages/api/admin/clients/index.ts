import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

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
      const { data: clients, error } = await adminClient
        .from("clients")
        .select(`
          *,
          leads(count)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching clients:", error);
        return res.status(500).json({ error: "Failed to fetch clients" });
      }

      const clientsWithCount = clients?.map(client => ({
        ...client,
        leads_count: client.leads?.[0]?.count || 0,
      })) || [];

      return res.status(200).json({ clients: clientsWithCount });
    }

    if (req.method === "POST") {
      const { name, company_name, email, phone } = req.body;

      if (!name || !email) {
        return res.status(400).json({ error: "Name and email are required" });
      }

      const webhook_secret = randomUUID();

      const { data: client, error } = await adminClient
        .from("clients")
        .insert({
          name,
          company_name,
          email,
          phone,
          webhook_secret,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating client:", error);
        return res.status(500).json({ error: "Failed to create client" });
      }

      return res.status(201).json({ client });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in clients API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}