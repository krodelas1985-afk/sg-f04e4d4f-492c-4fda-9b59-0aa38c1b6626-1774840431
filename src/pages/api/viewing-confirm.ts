import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * Records whether a viewing is going ahead, from the agent's day-before reminder.
 *
 * POST only, for the same reason as /api/viewing-outcome: email security scanners fetch
 * every URL in a message to inspect it. If a GET recorded the answer, a scanner opening
 * all three buttons would file three contradictory agent_confirmed rows without the agent
 * touching anything.
 *
 * That matters more here than it does for the outcome email. Since 2026-08-31 a
 * confirmed_upcoming row is what releases the outcome email at all, so a scanner-forged
 * confirmation would resurrect precisely the behaviour this feature exists to stop:
 * asking an agent how a viewing went when nobody ever agreed to one.
 *
 * All validation lives in redeem_viewing_prep_token() so this route cannot drift from the
 * confirm page's peek.
 */

const ANSWERS = ["going_ahead", "not_happening", "rescheduled"] as const;
type Answer = (typeof ANSWERS)[number];

function clientIp(req: NextApiRequest): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim() || null;
  if (Array.isArray(fwd)) return fwd[0] ?? null;
  return req.socket?.remoteAddress ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const answer = typeof req.body?.answer === "string" ? req.body.answer.trim() : "";

  if (!token || !ANSWERS.includes(answer as Answer)) {
    return res.status(400).json({ status: "invalid" });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("viewing-confirm: Supabase env not configured");
    return res.status(500).json({ status: "error" });
  }

  // Service role: the token IS the authorisation. Tokens are single-use, per-recipient and
  // expire, and redeem_viewing_prep_token enforces all of that. The RPC is service_role
  // only — an authenticated caller cannot reach it directly.
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("redeem_viewing_prep_token", {
    p_token: token,
    p_answer: answer,
    p_ip: clientIp(req),
  });

  if (error) {
    console.error("viewing-confirm: redeem failed", error.message);
    return res.status(500).json({ status: "error" });
  }

  const row = Array.isArray(data) ? data[0] : data;
  const status = row?.status ?? "invalid";

  // "already" and "answered" are not failures — they are the right response to a second
  // tap, or to a colleague having got there first. The page explains each one.
  return res.status(200).json({
    status,
    leadName: row?.lead_name ?? null,
    scheduledAt: row?.scheduled_at ?? null,
    recordedAnswer: row?.recorded_answer ?? null,
  });
}
