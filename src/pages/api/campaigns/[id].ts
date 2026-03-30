import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
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
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .eq("client_id", profile.client_id)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Not found" });

    return res.status(200).json(data);
  } else if (req.method === "PUT") {
    const isUpdatingLock = req.body.hasOwnProperty("is_locked");
    
    const { data: currentCampaign } = await supabase
      .from("campaigns")
      .select("is_locked")
      .eq("id", id)
      .eq("client_id", profile.client_id)
      .single();

    if (!currentCampaign) return res.status(404).json({ error: "Not found" });

    if (currentCampaign.is_locked && profile.role !== "baymo_admin") {
      return res.status(403).json({ error: "Campaign is locked" });
    }
    
    if (isUpdatingLock && profile.role !== "baymo_admin") {
      return res.status(403).json({ error: "Only baymo_admin can lock/unlock campaigns" });
    }

    if (profile.role === "viewer" || profile.role === "agent") {
      return res.status(403).json({ error: "Viewers and agents cannot edit campaigns" });
    }

    const { data, error } = await supabase
      .from("campaigns")
      .update(req.body)
      .eq("id", id)
      .eq("client_id", profile.client_id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  return res.status(405).json({ error: "Method not allowed" });
}