import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Sends a BaMo "confirm your email" message to one CRM account.
 *
 * Clicking the link opens /auth/confirm, whose server-side verification records
 * mailbox proof (see /api/auth/verify-link). That proof is what lets the person
 * use "Sign in with BaMo" on the Marketplace (plan R1/R2).
 *
 * baymo_admin only. Kathy's decision (2026-09-17): the confirmation email is
 * BaMo's to send and will become AUTOMATIC; when and on what trigger is decided
 * later. This route is the sender that automation will call; nothing calls it
 * automatically yet.
 *
 * The link is a magic link: it also signs the person in to the CRM, the same as
 * the invitation email they already know.
 */

const SENDING_DOMAIN = "send.bahaymo.com";
const REPLY_TO = "admin@bahaymo.com";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
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

  const { data: caller } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (caller?.role !== "baymo_admin") {
    return res.status(403).json({ error: "Only BaMo admins can send confirmation emails" });
  }

  const userId = typeof req.body?.user_id === "string" ? req.body.user_id : "";
  if (!userId) return res.status(400).json({ error: "user_id is required" });

  const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
  if (targetError || !target.user?.email) {
    return res.status(404).json({ error: "That account has no email address" });
  }
  const email = target.user.email;

  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", userId).single();

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !link?.properties?.hashed_token) {
    console.error("[send-mailbox-confirmation] generateLink:", linkError?.message);
    return res.status(502).json({ error: "Could not create the confirmation link" });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.host}`;
  const url = `${origin}/auth/confirm?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=magiclink`;
  const name = escapeHtml((profile?.full_name || "").split(/\s+/)[0] || "there");

  const html = `
  <div style="font-family:Poppins,Arial,sans-serif;background:#FFF7ED;padding:32px">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
      <p style="color:#E67E22;font-weight:600;font-size:13px;letter-spacing:1px;margin:0 0 12px">BaMo</p>
      <h1 style="color:#1F3C88;font-size:24px;line-height:32px;margin:0">Confirm your email</h1>
      <p style="color:#5B5B5B;font-size:16px;line-height:24px">Hi ${name},</p>
      <p style="color:#5B5B5B;font-size:16px;line-height:24px">
        Please confirm that this email address is yours. Once it is, you can use your BaMo account to sign in to the
        BaMo Marketplace website as well as the BaMo app.
      </p>
      <p style="margin:28px 0">
        <a href="${url}" style="background:#1F3C88;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;display:inline-block">Confirm my email</a>
      </p>
      <p style="color:#9CA3AF;font-size:12px;line-height:16px">
        This link works once and expires soon. If you didn't expect this email, you can ignore it.
      </p>
    </div>
  </div>`;

  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `BaMo <notifications@${SENDING_DOMAIN}>`,
      to: [email],
      reply_to: REPLY_TO,
      subject: "Confirm your email for BaMo",
      html,
    }),
  });

  if (!sent.ok) {
    console.error("[send-mailbox-confirmation] Resend:", await sent.text());
    return res.status(502).json({ error: "The email could not be sent" });
  }

  return res.status(200).json({ sent: true, email });
}
