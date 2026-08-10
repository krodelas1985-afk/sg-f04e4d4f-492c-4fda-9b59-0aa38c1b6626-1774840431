import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * Records a viewing outcome from the agent's one-click email.
 *
 * POST only, deliberately. Email security scanners (Outlook Safe Links, corporate
 * gateways, antivirus) fetch every URL in a message to inspect it. If a GET recorded the
 * outcome, a scanner opening all four buttons would file four contradictory
 * agent_confirmed rows without the agent touching anything — fabricating exactly the data
 * this feature exists to make trustworthy. Scanners do not submit forms, so the confirm
 * page's POST is what makes the record real.
 *
 * All validation lives in redeem_viewing_outcome_token() so this route cannot get it
 * subtly wrong or drift from the confirm page's peek.
 */

const POLARITIES = ["happened", "not_happened", "rescheduled", "ambiguous"] as const;
type Polarity = (typeof POLARITIES)[number];

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
  const polarity = typeof req.body?.polarity === "string" ? req.body.polarity.trim() : "";

  if (!token || !POLARITIES.includes(polarity as Polarity)) {
    return res.status(400).json({ status: "invalid" });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("viewing-outcome: Supabase env not configured");
    return res.status(500).json({ status: "error" });
  }

  // Service role: the token IS the authorisation. Tokens are single-use, per-recipient,
  // and expire; redeem_viewing_outcome_token enforces all of that.
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("redeem_viewing_outcome_token", {
    p_token: token,
    p_polarity: polarity,
    p_ip: clientIp(req),
  });

  if (error) {
    console.error("viewing-outcome: redeem failed", error.message);
    return res.status(500).json({ status: "error" });
  }

  const row = Array.isArray(data) ? data[0] : data;
  const status = row?.status ?? "invalid";

  // "already" and "answered" are not failures — they are the correct response to a second
  // tap or a colleague having got there first. The page explains each one.
  return res.status(200).json({
    status,
    leadName: row?.lead_name ?? null,
    scheduledAt: row?.scheduled_at ?? null,
    recordedPolarity: row?.recorded_polarity ?? null,
  });
}
