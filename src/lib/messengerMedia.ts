import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Messenger attachment plumbing for the endpoints that back the sequence and
 * AI-follow-up editors.
 *
 * The Send API fact that drives this file: `attachment.payload.url` makes Meta
 * re-download the file on every single send — 200 leads on one photo is 200
 * fetches. Uploading once via `POST /{page-id}/message_attachments` with
 * `is_reusable: true` returns an `attachment_id` that sends instantly
 * thereafter. That id is PAGE-scoped — the same file used by three clients
 * needs three ids — which is why the cache is keyed by (client_id, media_url)
 * and not by url alone.
 *
 * We pre-upload when the user attaches the file in the CRM, not on first send.
 * That keeps n8n (W4 / W6) down to "read a ready attachment_id and send it",
 * instead of a cache-check-then-maybe-upload branch in two workflows that are
 * awkward to patch. `payload.url` remains the fallback when the id is missing.
 */

const GRAPH_VERSION = "v21.0";

export type MediaType = "image" | "video" | "file";

export const MEDIA_TYPES: readonly MediaType[] = ["image", "video", "file"];

export function isMediaType(value: unknown): value is MediaType {
  return typeof value === "string" && MEDIA_TYPES.includes(value as MediaType);
}

type PageCredentials = { fb_page_id: string; fb_page_token: string };

/**
 * Loads the client's own Page credentials.
 *
 * Sending one client's media from another client's Page is a privacy incident,
 * so this mirrors the per-client lookup the inbound webhook and the manual send
 * route already do — there is deliberately no global fallback token.
 */
async function getPageCredentials(
  admin: SupabaseClient,
  clientId: string
): Promise<PageCredentials | null> {
  const { data } = await admin
    .from("clients")
    .select("fb_page_id, fb_page_token")
    .eq("id", clientId)
    .eq("is_active", true)
    .single();

  if (!data?.fb_page_id || !data?.fb_page_token) return null;
  return { fb_page_id: data.fb_page_id, fb_page_token: data.fb_page_token };
}

/**
 * Returns a reusable Meta attachment_id for this (client, media) pair,
 * uploading it if we have not already.
 *
 * Returns null rather than throwing when the upload fails: a missing id is a
 * performance regression (the sender falls back to `payload.url`), not a reason
 * to fail the user's save.
 */
export async function ensureReusableAttachmentId(
  admin: SupabaseClient,
  clientId: string,
  mediaUrl: string,
  mediaType: MediaType
): Promise<{ attachmentId: string | null; error?: string }> {
  const { data: cached } = await admin
    .from("messenger_media_attachments")
    .select("fb_attachment_id")
    .eq("client_id", clientId)
    .eq("media_url", mediaUrl)
    .maybeSingle();

  if (cached?.fb_attachment_id) {
    return { attachmentId: cached.fb_attachment_id };
  }

  const creds = await getPageCredentials(admin, clientId);
  if (!creds) {
    return { attachmentId: null, error: "No Facebook Page connected for this client" };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${creds.fb_page_id}/message_attachments?access_token=${creds.fb_page_token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            attachment: {
              type: mediaType,
              payload: { url: mediaUrl, is_reusable: true },
            },
          },
        }),
      }
    );

    const body = await response.json();
    const attachmentId: string | undefined = body?.attachment_id;

    if (!response.ok || !attachmentId) {
      return {
        attachmentId: null,
        error: body?.error?.message ?? "Meta rejected the media upload",
      };
    }

    // Upsert rather than insert: two editors attaching the same file to two
    // steps at once would otherwise collide on the unique key.
    await admin.from("messenger_media_attachments").upsert(
      {
        client_id: clientId,
        media_url: mediaUrl,
        media_type: mediaType,
        fb_attachment_id: attachmentId,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: "client_id,media_url" }
    );

    return { attachmentId };
  } catch (error) {
    return {
      attachmentId: null,
      error: error instanceof Error ? error.message : "Media upload failed",
    };
  }
}
