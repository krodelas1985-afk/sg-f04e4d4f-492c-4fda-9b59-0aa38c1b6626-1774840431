import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { ensureReusableAttachmentId, isMediaType } from "@/lib/messengerMedia";

// Attachments for the AI follow-up playbook, steps 1-4.
//
// The engine's playbook step is `touch_count + 1` — fully deterministic, decided
// before the model is called (see W6's "Build Decision Request" node). Pinning
// media to the step number is what makes attachments safe here: the model never
// picks a file, it only writes the wording that goes with the file a human
// already chose for that rung of the ladder.
//
// `media_description` exists because the model cannot see the image. Without a
// human line saying what it shows, the copy can confidently describe the wrong
// thing — a floor plan caption on a pool photo. That, not file selection, is
// where hallucination would actually enter this feature.
//
// Auth mirrors /api/campaigns/[id]/follow-up.ts: Bearer token validated with a
// service-role client, then manual client scoping (service role bypasses RLS).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const MAX_DESCRIPTION_CHARS = 300;

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
  const canManage =
    isBaymoAdmin || profile.role === "client_admin" || profile.role === "manager";

  // ── Scope: campaign must belong to the caller's client ─────────────────
  const { data: campaign, error: campErr } = await supabase
    .from("campaigns")
    .select("id, client_id")
    .eq("id", campaignId)
    .single();
  if (campErr || !campaign) return res.status(404).json({ error: "Campaign not found" });
  if (!isBaymoAdmin && campaign.client_id !== profile.client_id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const db = supabase as any;

  // The adaptive sequence is provisioned by /follow-up. Media hangs off it, so
  // there is nothing to attach to until follow-up has been configured once.
  const { data: seq } = await db
    .from("sequences")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("mode", "ai_adaptive")
    .maybeSingle();

  if (!seq) {
    if (req.method === "GET") return res.status(200).json({ sequence_id: null, media: [] });
    return res
      .status(409)
      .json({ error: "Configure AI follow-up for this campaign before adding media" });
  }

  // ── GET — every pinned attachment for this campaign's playbook ─────────
  if (req.method === "GET") {
    const { data, error } = await db
      .from("ai_followup_step_media")
      .select("id, playbook_step, media_url, media_type, media_description, updated_at")
      .eq("sequence_id", seq.id)
      .order("playbook_step", { ascending: true });

    if (error) {
      console.error("follow-up media GET error:", error);
      return res.status(500).json({ error: "Failed to load follow-up media" });
    }
    return res.status(200).json({ sequence_id: seq.id, media: data ?? [] });
  }

  if (!canManage) return res.status(403).json({ error: "Forbidden" });

  // ── PUT — pin (or replace) the attachment on one playbook step ─────────
  if (req.method === "PUT") {
    const { playbook_step, media_url, media_type, media_description } = req.body ?? {};

    const step = Number(playbook_step);
    if (!Number.isInteger(step) || step < 1 || step > 4) {
      return res.status(400).json({ error: "playbook_step must be 1, 2, 3, or 4" });
    }
    if (typeof media_url !== "string" || media_url.trim() === "") {
      return res.status(400).json({ error: "media_url is required" });
    }
    if (!isMediaType(media_type)) {
      return res.status(400).json({ error: "media_type must be image, video, or file" });
    }
    if (
      media_description !== undefined &&
      media_description !== null &&
      typeof media_description !== "string"
    ) {
      return res.status(400).json({ error: "media_description must be text" });
    }

    const description =
      typeof media_description === "string"
        ? media_description.trim().slice(0, MAX_DESCRIPTION_CHARS) || null
        : null;

    const { data, error } = await db
      .from("ai_followup_step_media")
      .upsert(
        {
          sequence_id: seq.id,
          playbook_step: step,
          media_url: media_url.trim(),
          media_type,
          media_description: description,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "sequence_id,playbook_step" }
      )
      .select("id, playbook_step, media_url, media_type, media_description")
      .single();

    if (error) {
      console.error("follow-up media PUT error:", error);
      return res.status(500).json({ error: "Failed to save follow-up media" });
    }

    // Register with Meta now so the send path has a reusable attachment_id.
    // Non-fatal — the row is saved either way and the sender falls back to the
    // public URL — but the caller gets told so it can warn instead of shipping
    // the slow path silently.
    const { error: uploadError } = await ensureReusableAttachmentId(
      supabase,
      campaign.client_id,
      media_url.trim(),
      media_type
    );

    return res.status(200).json({ ...data, media_warning: uploadError ?? null });
  }

  // ── DELETE — unpin one step's attachment ───────────────────────────────
  if (req.method === "DELETE") {
    const step = Number(req.query.playbook_step);
    if (!Number.isInteger(step) || step < 1 || step > 4) {
      return res.status(400).json({ error: "playbook_step must be 1, 2, 3, or 4" });
    }

    const { error } = await db
      .from("ai_followup_step_media")
      .delete()
      .eq("sequence_id", seq.id)
      .eq("playbook_step", step);

    if (error) {
      console.error("follow-up media DELETE error:", error);
      return res.status(500).json({ error: "Failed to remove follow-up media" });
    }
    return res.status(200).json({ success: true });
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
