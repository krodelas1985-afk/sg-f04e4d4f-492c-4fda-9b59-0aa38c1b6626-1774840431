import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// AI Follow-Up provisioning for a campaign.
// Reads/creates-updates the single system-owned `ai_adaptive` sequence bound to
// the campaign (sequences.mode='ai_adaptive', sequences.campaign_id). The client
// never manages this as a "sequence" — they see it as the campaign's follow-up
// settings. See bamo-ops/BaMo_AI_FollowUp_Engine_Plan.md (Phase 0).
//
// Auth mirrors /api/campaigns/[id]/knowledge-base.ts: Bearer token validated with
// a service-role client, then manual client scoping (service role bypasses RLS).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const GOALS = ["book_viewing", "book_call", "qualify_only", "nurture"] as const;
const LANGUAGES = ["auto", "taglish", "english", "filipino"] as const;
const TONES = ["friendly", "professional", "luxury"] as const;

// The touch ladder is the source of truth for timing. Each entry is the gap in
// hours from the previous touch, and every step is measured cumulatively from
// the lead's LAST INBOUND — which is also when Facebook's 24h window opens, so
// the cumulative total must stay comfortably under 24. The AI decides whether
// to send, wait or escalate; it does NOT choose when. (It used to, and set
// appointments outside the window that could never be delivered.)
const MAX_LADDER_STEPS = 6;
const MAX_CUMULATIVE_HOURS = 22; // leave headroom before the 24h window shuts

type FollowUpSettings = {
  goal: (typeof GOALS)[number];
  language: (typeof LANGUAGES)[number];
  tone: (typeof TONES)[number];
  max_touches_per_pass: number;
  first_follow_up_after_hours: number;
  escalate_after_touches: number;
  custom_instructions: string;
  followup_ladder_hours: number[];
  min_inbound_for_followup: number;
  max_inbound_for_followup: number;
  min_gap_hours: number;
};

const DEFAULT_LADDER = [2, 3, 5, 10]; // touches at +2h, +5h, +10h, +20h

const DEFAULT_SETTINGS: FollowUpSettings = {
  goal: "book_viewing",
  language: "auto",
  tone: "friendly",
  max_touches_per_pass: DEFAULT_LADDER.length,
  first_follow_up_after_hours: DEFAULT_LADDER[0],
  escalate_after_touches: DEFAULT_LADDER.length,
  custom_instructions: "",
  followup_ladder_hours: DEFAULT_LADDER,
  // A lead who sent 1-2 words is a tyre-kicker; the engaged ones are worth
  // chasing. min/max must never cross or the eligibility set is silently empty.
  min_inbound_for_followup: 3,
  max_inbound_for_followup: 50,
  min_gap_hours: 1,
};

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const isHHMM = (v: unknown): v is string =>
  typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

const oneOf = <T extends readonly string[]>(
  v: unknown,
  allowed: T,
  fallback: T[number]
): T[number] => (allowed.includes(v as string) ? (v as T[number]) : fallback);

// Steps are whole hours, each 1..24, and the running total is capped so the last
// touch still lands inside Facebook's 24h window. Steps that would overflow are
// dropped rather than silently scheduling an undeliverable touch.
function sanitizeLadder(input: unknown): number[] {
  const raw = Array.isArray(input) ? input : DEFAULT_SETTINGS.followup_ladder_hours;
  const out: number[] = [];
  let cumulative = 0;
  for (const step of raw.slice(0, MAX_LADDER_STEPS)) {
    // Check the raw value first: Number(null) is 0, which would otherwise clamp
    // *up* to a 1-hour step rather than being discarded.
    const n = Number(step);
    if (!Number.isFinite(n) || n < 1) continue;
    const h = clampInt(n, 1, 24, 0);
    if (!h) continue;
    if (cumulative + h > MAX_CUMULATIVE_HOURS) break;
    cumulative += h;
    out.push(h);
  }
  return out.length ? out : DEFAULT_SETTINGS.followup_ladder_hours;
}

// Whitelist + clamp everything the client sends — never store arbitrary JSONB.
function sanitizeSettings(input: any): FollowUpSettings {
  const s = input ?? {};
  const ladder = sanitizeLadder(s.followup_ladder_hours);
  // The ladder defines how many touches there are; a separate cap would only
  // let the two drift apart.
  const max_touches = ladder.length;
  const min_inbound = clampInt(s.min_inbound_for_followup, 0, 20, DEFAULT_SETTINGS.min_inbound_for_followup);
  // max must stay strictly above min, or the eligibility window is empty and
  // nothing enrols — with no error anywhere to explain why.
  const max_inbound = Math.max(
    min_inbound + 1,
    clampInt(s.max_inbound_for_followup, 1, 999, DEFAULT_SETTINGS.max_inbound_for_followup)
  );
  return {
    goal: oneOf(s.goal, GOALS, DEFAULT_SETTINGS.goal),
    language: oneOf(s.language, LANGUAGES, DEFAULT_SETTINGS.language),
    tone: oneOf(s.tone, TONES, DEFAULT_SETTINGS.tone),
    max_touches_per_pass: max_touches,
    // Kept in sync with the ladder's first step so the two can never disagree.
    first_follow_up_after_hours: ladder[0],
    // Escalate cap can't exceed the touch cap.
    escalate_after_touches: clampInt(s.escalate_after_touches, 1, max_touches, max_touches),
    custom_instructions: typeof s.custom_instructions === "string" ? s.custom_instructions.trim().slice(0, 2000) : "",
    followup_ladder_hours: ladder,
    min_inbound_for_followup: min_inbound,
    max_inbound_for_followup: max_inbound,
    min_gap_hours: clampInt(s.min_gap_hours, 1, 12, DEFAULT_SETTINGS.min_gap_hours),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const campaignId = req.query.id as string;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Auth ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_id")
    .eq("id", user.id)
    .single();
  if (!profile) return res.status(401).json({ error: "Profile not found" });

  const isBaymoAdmin = profile.role === "baymo_admin";
  const canManage = isBaymoAdmin || profile.role === "client_admin" || profile.role === "manager";

  // ── Scope: the campaign must belong to the caller's client (unless baymo_admin) ──
  const { data: campaign, error: campErr } = await supabase
    .from("campaigns")
    .select("id, name, client_id")
    .eq("id", campaignId)
    .single();
  if (campErr || !campaign) return res.status(404).json({ error: "Campaign not found" });
  if (!isBaymoAdmin && campaign.client_id !== profile.client_id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const db = supabase as any;

  // Window / lifecycle knobs live on sequence columns; goal/tone/etc. live in ai_settings.
  const readWindow = (body: any) => ({
    send_window_start: isHHMM(body?.send_window_start) ? body.send_window_start : "07:00",
    send_window_end: isHHMM(body?.send_window_end) ? body.send_window_end : "21:00",
    // 0 is legitimate — it means "no cooldown, may re-enrol on the next reply",
    // which is what a pilot wants. Clamping the floor to 1 silently rewrote it.
    reenroll_cooldown_days: clampInt(body?.reenroll_cooldown_days, 0, 90, 14),
    max_passes: clampInt(body?.max_passes, 1, 10, 3),
  });

  const shape = (seq: any) =>
    seq
      ? {
          sequence_id: seq.id,
          enabled: !!seq.is_active,
          settings: { ...DEFAULT_SETTINGS, ...(seq.ai_settings ?? {}) },
          send_window_start: seq.send_window_start,
          send_window_end: seq.send_window_end,
          reenroll_cooldown_days: seq.reenroll_cooldown_days,
          max_passes: seq.max_passes,
        }
      : {
          sequence_id: null,
          enabled: false,
          settings: DEFAULT_SETTINGS,
          send_window_start: "07:00",
          send_window_end: "21:00",
          reenroll_cooldown_days: 14,
          max_passes: 3,
        };

  // ── GET — current config (or defaults if never provisioned) ────────────
  if (req.method === "GET") {
    const { data: seq, error } = await db
      .from("sequences")
      .select("id, is_active, ai_settings, send_window_start, send_window_end, reenroll_cooldown_days, max_passes")
      .eq("campaign_id", campaignId)
      .eq("mode", "ai_adaptive")
      .maybeSingle();
    if (error) {
      console.error("follow-up GET error:", error);
      return res.status(500).json({ error: "Failed to load follow-up settings" });
    }
    return res.status(200).json(shape(seq));
  }

  // ── POST — upsert the ai_adaptive sequence + settings ──────────────────
  if (req.method === "POST") {
    if (!canManage) return res.status(403).json({ error: "Forbidden" });

    const enabled = !!req.body?.enabled;
    const settings = sanitizeSettings(req.body?.settings);
    const win = readWindow(req.body);

    const { data: existing, error: findErr } = await db
      .from("sequences")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("mode", "ai_adaptive")
      .maybeSingle();
    if (findErr) {
      console.error("follow-up find error:", findErr);
      return res.status(500).json({ error: "Failed to load follow-up settings" });
    }

    if (existing) {
      const { data: updated, error: updErr } = await db
        .from("sequences")
        .update({
          is_active: enabled,
          ai_settings: settings,
          ...win,
          scheduled_steps_enabled: false, // W6 owns adaptive scheduling, not W4
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id, is_active, ai_settings, send_window_start, send_window_end, reenroll_cooldown_days, max_passes")
        .single();
      if (updErr) {
        console.error("follow-up update error:", updErr);
        return res.status(500).json({ error: "Failed to save follow-up settings" });
      }
      return res.status(200).json(shape(updated));
    }

    // Create the bound adaptive sequence. client_id follows the campaign's owner.
    const { data: created, error: createErr } = await db
      .from("sequences")
      .insert({
        name: `AI Follow-Up — ${campaign.name}`,
        description: "Adaptive AI follow-up for this campaign's stalled Messenger leads.",
        client_id: campaign.client_id,
        campaign_id: campaignId,
        mode: "ai_adaptive",
        is_active: enabled,
        scheduled_steps_enabled: false,
        ai_settings: settings,
        ...win,
      })
      .select("id, is_active, ai_settings, send_window_start, send_window_end, reenroll_cooldown_days, max_passes")
      .single();
    if (createErr) {
      console.error("follow-up create error:", createErr);
      return res.status(500).json({ error: "Failed to create follow-up settings" });
    }
    return res.status(201).json(shape(created));
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
