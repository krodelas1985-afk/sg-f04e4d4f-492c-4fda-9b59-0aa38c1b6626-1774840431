import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * Records Won/Lost from the viewing confirm page's optional follow-up step.
 *
 * POST only, for the same reason as /api/viewing-outcome: email security scanners fetch
 * links but do not submit forms, and this writes a terminal status that stops automation.
 *
 * Authorisation is the outcome-email token the agent already used seconds earlier — no
 * login. All validation lives in record_disposition_from_token -> set_lead_disposition so
 * the rules cannot drift between callers.
 */

const DISPOSITIONS = ["Won", "Lost"] as const;

const LOST_REASONS = [
  "too_expensive",
  "cannot_finance",
  "bought_elsewhere",
  "too_far",
  "not_a_buyer",
  "wrong_inventory",
  "timing",
  "unreachable",
  "other",
] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const disposition =
    typeof req.body?.disposition === "string" ? req.body.disposition.trim() : "";
  const lostReasonRaw =
    typeof req.body?.lostReason === "string" ? req.body.lostReason.trim() : "";
  const lostReason = lostReasonRaw || null;

  if (!token || !(DISPOSITIONS as readonly string[]).includes(disposition)) {
    return res.status(400).json({ status: "invalid" });
  }
  if (disposition === "Lost" && !(LOST_REASONS as readonly string[]).includes(lostReason ?? "")) {
    return res.status(400).json({ status: "reason_required" });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("lead-disposition: Supabase env not configured");
    return res.status(500).json({ status: "error" });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("record_disposition_from_token", {
    p_token: token,
    p_disposition: disposition,
    p_lost_reason: disposition === "Lost" ? lostReason : null,
    p_ip: null,
  });

  if (error) {
    console.error("lead-disposition: rpc failed", error.message);
    return res.status(500).json({ status: "error" });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return res.status(200).json({
    status: row?.status ?? "invalid",
    leadName: row?.lead_name ?? null,
  });
}
