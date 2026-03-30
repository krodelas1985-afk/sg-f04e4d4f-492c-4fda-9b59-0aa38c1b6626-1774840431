import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return req.cookies[name]; },
        set() {},
        remove() {},
      },
    }
  );

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_id")
    .eq("id", authData.user.id)
    .single();

  if (!profile || !profile.client_id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("email_templates")
      .select("id, name, subject")
      .eq("client_id", profile.client_id)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  return res.status(405).json({ error: "Method not allowed" });
}