import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { messengerInboxUrl } from "@/lib/messengerWindow";

/**
 * Resolve the Business Suite deep link for a lead's Messenger thread.
 *
 * The Page ID lives on the lead's OWN client, which is why this can't just use
 * the `get_my_fb_page_id()` RPC: that is scoped to the caller's workspace and
 * would hand a baymo_admin the wrong Page when they open another client's lead.
 * Here the lead decides the Page, and the caller is checked against the lead.
 */
async function getAuthUser(
  req: NextApiRequest,
  supabase: ReturnType<typeof createServerClient>
) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabase = createServerClient();
  const user = await getAuthUser(req, supabase);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_id, is_active")
    .eq("id", user.id)
    .single();
  if (!profile || profile.is_active === false) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const leadId = req.query.id;
  if (typeof leadId !== "string") {
    return res.status(400).json({ error: "Invalid lead id" });
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, messenger_id")
    .eq("id", leadId)
    .single();
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  if (profile.role !== "baymo_admin" && lead.client_id !== profile.client_id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!lead.messenger_id) {
    return res.status(200).json({ url: null, reason: "not_messenger" });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("fb_page_id")
    .eq("id", lead.client_id)
    .single();

  const url = messengerInboxUrl(client?.fb_page_id, lead.messenger_id);
  if (!url) {
    return res.status(200).json({ url: null, reason: "no_page_id" });
  }

  return res.status(200).json({ url });
}
