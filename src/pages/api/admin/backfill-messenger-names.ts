import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const PLACEHOLDER_NAMES = ["Messenger Lead"];
const PLACEHOLDER_PREFIXES = ["FB Lead", "FB User"];

function isPlaceholder(name: string | null): boolean {
  if (!name) return false;
  if (PLACEHOLDER_NAMES.includes(name)) return true;
  return PLACEHOLDER_PREFIXES.some((p) => name.startsWith(p));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth: require valid session
  const anonClient = createServerClient(
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

  const { data: { session } } = await anonClient.auth.getSession();
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Require baymo_admin role
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "baymo_admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Fetch all messenger leads with placeholder names, joined to their client token
  const { data: leads, error: fetchError } = await adminClient
    .from("leads")
    .select("id, name, messenger_id, client_id, clients(fb_page_token)")
    .not("messenger_id", "is", null)
    .or("name.eq.Messenger Lead,name.ilike.FB Lead%,name.ilike.FB User%");

  if (fetchError) {
    return res.status(500).json({ error: fetchError.message });
  }

  const results = {
    processed: 0,
    resolved: 0,
    failed: 0,
    sample_errors: [] as unknown[],
  };

  for (const lead of leads ?? []) {
    if (!isPlaceholder(lead.name)) continue;

    results.processed++;
    const psid = lead.messenger_id as string;
    const fbToken = (lead.clients as any)?.fb_page_token as string | undefined;
    const at = new Date().toISOString();

    if (!fbToken) {
      results.failed++;
      const err = { lead_id: lead.id, error: "no_token" };
      if (results.sample_errors.length < 3) results.sample_errors.push(err);
      await adminClient
        .from("leads")
        .update({ metadata: { name_lookup: { ok: false, at, error: "no_token" } } })
        .eq("id", lead.id);
      await delay(200);
      continue;
    }

    try {
      const profileRes = await fetch(
        `https://graph.facebook.com/v21.0/${psid}?fields=first_name,last_name&access_token=${fbToken}`
      );
      const profileData = await profileRes.json();

      if (profileData.first_name) {
        const resolvedName = `${profileData.first_name} ${profileData.last_name ?? ""}`.trim();
        await adminClient
          .from("leads")
          .update({
            name: resolvedName,
            metadata: { name_lookup: { ok: true, at } },
          })
          .eq("id", lead.id);
        results.resolved++;
      } else {
        const fbError = profileData.error ?? "empty_response";
        if (results.sample_errors.length < 3) {
          results.sample_errors.push({ lead_id: lead.id, error: fbError });
        }
        await adminClient
          .from("leads")
          .update({ metadata: { name_lookup: { ok: false, at, error: fbError } } })
          .eq("id", lead.id);
        results.failed++;
      }
    } catch (e) {
      const errStr = String(e);
      if (results.sample_errors.length < 3) {
        results.sample_errors.push({ lead_id: lead.id, error: errStr });
      }
      await adminClient
        .from("leads")
        .update({ metadata: { name_lookup: { ok: false, at, error: errStr } } })
        .eq("id", lead.id);
      results.failed++;
    }

    await delay(200);
  }

  return res.status(200).json(results);
}
