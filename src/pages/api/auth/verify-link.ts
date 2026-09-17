import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Verifies an emailed link ON THE SERVER, and records mailbox proof.
 *
 * /auth/confirm used to call verifyOtp in the browser. That still works for
 * signing the person in, but a browser can then tell a server anything, so
 * "this person clicked the link" could not be trusted from it. Here the server
 * itself redeems the one-time token: if verifyOtp succeeds, the link was genuine
 * and the person who opened it controls the mailbox (Identity Standard
 * §56.4(1)). Only then is the proof recorded, for the email the token belonged
 * to. The session tokens are handed back so the page can sign the person in
 * exactly as before.
 */

const ALLOWED_TYPES = new Set(["signup", "invite", "recovery", "magiclink", "email", "email_change"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const tokenHash = typeof req.body?.token_hash === "string" ? req.body.token_hash : "";
  const type = typeof req.body?.type === "string" ? req.body.type : "";
  if (!tokenHash || !ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ error: "This link is missing required information." });
  }

  // A plain anon client: the token itself is the credential.
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await anon.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as "signup" | "invite" | "recovery" | "magiclink" | "email" | "email_change",
  });

  if (error || !data.session || !data.user) {
    return res.status(400).json({ error: error?.message ?? "This link is invalid or has expired." });
  }

  // Proof is best-effort for the sign-in itself: a failure to record it must not
  // lock the person out of the CRM, but it is logged, and until it is recorded
  // "Sign in with BaMo" simply stays unavailable to them.
  try {
    const admin = createServerClient();
    const { error: proofError } = await admin.rpc("record_mailbox_proof", {
      p_user_id: data.user.id,
      p_email: data.user.email ?? "",
    });
    if (proofError) console.error("[verify-link] record_mailbox_proof:", proofError.message);
  } catch (e) {
    console.error("[verify-link] proof not recorded:", e);
  }

  return res.status(200).json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    type,
  });
}
