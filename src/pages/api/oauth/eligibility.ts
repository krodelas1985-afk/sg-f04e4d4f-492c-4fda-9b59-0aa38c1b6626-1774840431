import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@/lib/supabase/server";

/**
 * May the signed-in person use "Sign in with BaMo" right now?
 *
 * The consent page asks before it approves anything (plan R1). The answer comes
 * from the database, not the browser: an active profile and a mailbox proof for
 * the account's CURRENT email. The Marketplace re-checks the same fact on its
 * own server after sign-in, so this is the friendly gate, not the only one.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const admin = createServerClient();
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: "Unauthorized" });

  const { data, error } = await admin.rpc("bamo_signin_eligibility", { p_user_id: user.id });
  if (error) {
    console.error("[oauth/eligibility]", error.message);
    return res.status(503).json({ error: "eligibility_unavailable" });
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { has_profile: boolean; is_active: boolean; mailbox_proven: boolean; email: string | null }
    | undefined;

  const reason = !row?.has_profile
    ? "no_profile"
    : !row.is_active
      ? "inactive"
      : !row.mailbox_proven
        ? "mailbox_not_proven"
        : null;

  return res.status(200).json({ eligible: reason === null, reason, email: row?.email ?? user.email ?? null });
}
