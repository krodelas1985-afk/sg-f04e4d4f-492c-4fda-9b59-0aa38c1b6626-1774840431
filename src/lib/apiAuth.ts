import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared authentication + workspace-scoping for API routes.
 *
 * Two rules this file exists to enforce:
 *
 * 1. Use `getUser()`, never `getSession()`. A session read from cookies is not
 *    signature-verified — supabase-js explicitly says it "must not be trusted"
 *    on the server. `getUser()` validates the JWT against the Auth server, so a
 *    forged cookie can't mint an identity. Several routes here previously
 *    trusted `getSession()` and then looked the profile up with the SERVICE
 *    ROLE, which turned a forged cookie into full baymo_admin.
 *
 * 2. Authenticate before touching the service-role client. The service role
 *    bypasses RLS, so any route that reaches for it without first proving who
 *    the caller is has effectively published that table to the internet.
 */

export type AuthedCaller = {
  uid: string;
  role: string;
  clientId: string | null;
  /** Service-role client. Only valid after the caller has been authenticated. */
  admin: SupabaseClient;
};

/** Service-role client. Never call this before authenticating the caller. */
export function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Verifies the caller and loads their profile.
 *
 * Responds with 401/403 and returns null when the caller can't be established —
 * callers should `return` immediately on null.
 */
export async function requireUser(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AuthedCaller | null> {
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

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const admin = adminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("role, client_id, is_active")
    .eq("id", user.id)
    .single();

  if (!profile) {
    res.status(403).json({ error: "Profile not found" });
    return null;
  }

  // Deactivated users keep a valid JWT until it expires — the profile flag is
  // the only thing that revokes them, so it has to be checked on every request.
  if (profile.is_active === false) {
    res.status(403).json({ error: "Account is inactive" });
    return null;
  }

  return {
    uid: user.id,
    role: profile.role,
    clientId: profile.client_id,
    admin,
  };
}

/** As `requireUser`, but additionally requires the baymo_admin role. */
export async function requireBaymoAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AuthedCaller | null> {
  const caller = await requireUser(req, res);
  if (!caller) return null;

  if (caller.role !== "baymo_admin") {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }

  return caller;
}

/**
 * Confirms the lead exists and belongs to the caller's workspace.
 *
 * baymo_admin reaches every workspace; everyone else is confined to their own.
 * Returns null (after responding 404) when the lead is missing or out of scope —
 * 404 rather than 403 so the endpoint can't be used to probe which lead IDs exist.
 */
export async function requireLeadAccess(
  caller: AuthedCaller,
  leadId: string,
  res: NextApiResponse
): Promise<{ id: string; client_id: string; campaign_id: string | null } | null> {
  if (!leadId) {
    res.status(400).json({ error: "lead id is required" });
    return null;
  }

  const { data: lead } = await caller.admin
    .from("leads")
    .select("id, client_id, campaign_id")
    .eq("id", leadId)
    .single();

  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return null;
  }

  if (caller.role !== "baymo_admin" && lead.client_id !== caller.clientId) {
    res.status(404).json({ error: "Lead not found" });
    return null;
  }

  return lead;
}
