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

type FollowUpSettings = {
  goal: (typeof GOALS)[number];
  language: (typeof LANGUAGES)[number];
  tone: (typeof TONES)[number];
  max_touches_per_pass: number;
  first_follow_up_after_hours: number;
  escalate_after_touches: number;
  custom_instructions: string;
};

const DEFAULT_SETTINGS: FollowUpSettings = {
  goal: "book_viewing",
  language: "auto",
  tone: "friendly",
  max_touches_per_pass: 3,
  first_follow_up_after_hours: 4,
  escalate_after_touches: 3,
  custom_instructions: "",
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

// Whitelist + clamp everything the client sends — never store arbitrary JSONB.
function sanitizeSettings(input: any): FollowUpSettings {
  const s = input ?? {};
  const max_touches = clampInt(s.max_touches_per_pass, 1, 5, DEFAULT_SETTINGS.max_touches_per_pass);
  return {
    goal: oneOf(s.goal, GOALS, DEFAULT_SETTINGS.goal),
    language: oneOf(s.language, LANGUAGES, DEFAULT_SETTINGS.language),
    tone: oneOf(s.tone, TONES, DEFAULT_SETTINGS.tone),
    max_touches_per_pass: max_touches,
    first_follow_up_after_hours: clampInt(s.first_follow_up_after_hours, 1, 48, DEFAULT_SETTINGS.first_follow_up_after_hours),
    // Escalate cap can't exceed the touch cap.
    escalate_after_touches: clampInt(s.escalate_after_touches, 1, max_touches, max_touches),
    custom_instructions: typeof s.custom_instructions === "string" ? s.custom_instructions.trim().slice(0, 2000) : "",
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
    send_window_start: isHHMM(body?.send_window_start) ? body.send_window_start : "08:00",
    send_window_end: isHHMM(body?.send_window_end) ? body.send_window_end : "20:00",
    reenroll_cooldown_days: clampInt(body?.reenroll_cooldown_days, 1, 90, 14),
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
          send_window_start: "08:00",
          send_window_end: "20:00",
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
