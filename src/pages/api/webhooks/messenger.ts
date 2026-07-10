import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET — Facebook webhook verification
  if (req.method === "GET") {
    try {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];
      if (mode === "subscribe" && token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
        return res.status(200).send(challenge);
      }
      return res.status(403).send("Forbidden");
    } catch {
      return res.status(403).send("Forbidden");
    }
  }

  // POST — Inbound messages
  if (req.method === "POST") {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const body = req.body;
      if (body.object !== "page") return res.status(200).json({ status: "ok" });
      if (!body.entry || !Array.isArray(body.entry)) return res.status(200).json({ status: "ok" });

      for (const entry of body.entry) {
        if (!entry.messaging || !Array.isArray(entry.messaging)) continue;

        // ── ROUTE BY PAGE ID ─────────────────────────────────────────
        // entry.id is the Facebook Page ID that received the message.
        // Look up which client owns this page.
        const pageId = entry.id as string;

        const { data: clientRecord } = await supabase
          .from("clients")
          .select("id, fb_page_token")
          .eq("fb_page_id", pageId)
          .eq("is_active", true)
          .single();

        // Fall back to env var for backward compatibility during migration
        const clientId: string | undefined =
          clientRecord?.id ?? process.env.BAMO_CLIENT_ID;
        const fbToken: string | undefined =
          clientRecord?.fb_page_token ?? process.env.FB_PAGE_ACCESS_TOKEN;

        if (!clientId) continue;

        for (const event of entry.messaging) {
          // ── ECHO HANDLING — must be the very first check in this loop ──
          if (event.message?.is_echo) {
            console.log('ECHO_DEBUG', JSON.stringify(event.message));
            const msg = event.message;

            // Skip ONLY our own app's Send-API echoes (the AI's replies, already logged)
            if (msg.app_id && String(msg.app_id) === process.env.FB_APP_ID) continue;

            // Human agent replied via the Page inbox — log it, but DO NOT create leads
            try {
              const leadPsid = event.recipient?.id as string | undefined;
              if (leadPsid) {
                const { data: echoLead } = await supabase
                  .from("leads")
                  .select("id, client_id")
                  .eq("messenger_id", leadPsid)
                  .maybeSingle();

                if (echoLead) {
                  const attachments = msg.attachments as any[] | undefined;
                  const messageContent: string = msg.text
                    ? (msg.text as string)
                    : attachments?.length
                    ? `[${attachments[0].type}]`
                    : "[attachment]";

                  const { error: echoInsertError } = await supabase
                    .from("conversations")
                    .insert({
                      lead_id: echoLead.id,
                      client_id: echoLead.client_id,
                      sender: "agent",
                      direction: "outbound",
                      channel: "messenger",
                      sent_via: "facebook_inbox",
                      message_content: messageContent,
                      external_msg_id: msg.mid as string,
                      delivery_status: "sent",
                      ...(attachments?.length && {
                        attachment_url: attachments[0].payload?.url ?? null,
                        attachment_type: attachments[0].type ?? null,
                      }),
                    });

                  // Unique index on external_msg_id — silently ignore FB redelivery duplicates
                  if (echoInsertError && !echoInsertError.message?.includes("unique")) {
                    console.error("Echo insert error:", echoInsertError);
                  }

                  // Track outbound activity from agent inbox replies. Use current
                  // time — the FB echo timestamp isn't reliable for echo events.
                  if (!echoInsertError) {
                    await supabase
                      .from("leads")
                      .update({ last_outbound_at: new Date().toISOString() })
                      .eq("id", echoLead.id);
                  }
                }
              }
            } catch (echoErr) {
              console.error("Error processing echo event:", echoErr);
            }
            continue; // CRITICAL: echoes never reach lead-creation or AI-responder code below
          }
          // ── END ECHO HANDLING ─────────────────────────────────────────

          // ── AD REFERRAL CAPTURE (Click-to-Messenger ads) ──────────────
          // Meta delivers ad attribution as a referral object in three shapes:
          // a standalone messaging_referrals event (existing conversation),
          // postback.referral (Get Started tap on a new conversation), or
          // attached to the first message itself. Referral-only events carry
          // no message text, so they must be captured HERE — the text-message
          // guard below would otherwise drop them. Stored rows are looked up
          // by PSID when the first message arrives (possibly a separate,
          // later webhook call).
          const referral =
            event.referral ?? event.postback?.referral ?? event.message?.referral;
          const referralAdId: string | null =
            referral?.ad_id != null ? String(referral.ad_id) : null;
          if (referral) {
            console.log(
              "MESSENGER_REFERRAL",
              JSON.stringify({ psid: event.sender?.id, referral })
            );
            try {
              const refPsid = event.sender?.id as string | undefined;
              if (refPsid) {
                await supabase.from("messenger_referrals").insert({
                  client_id: clientId,
                  psid: refPsid,
                  ad_id: referralAdId,
                  ref: referral.ref ?? null,
                  source: referral.source ?? null,
                  raw: referral,
                });
                if (referralAdId) {
                  // Existing-conversation ad click: stamp the lead directly.
                  await supabase
                    .from("leads")
                    .update({ fb_ad_id: referralAdId })
                    .eq("messenger_id", refPsid)
                    .eq("client_id", clientId);
                }
              }
            } catch (refErr) {
              console.error("Referral capture error:", refErr);
            }
          }

          if (!event.message || !event.message.text) continue;

          try {
            const psid = event.sender.id as string;
            const messageText = event.message.text as string;
            const externalMsgId = event.message.mid as string;
            const timestamp = event.timestamp as number;

            // ── 1. LEAD LOOKUP / CREATE ──────────────────────────────
            const { data: existingLead } = await supabase
              .from("leads")
              .select("id, automation_enabled, conversation_summary, fb_ad_id")
              .eq("messenger_id", psid)
              .eq("client_id", clientId)
              .single();

            // Ad attribution for enrollment: referral on this event, else the
            // value already stamped on the lead, else a referral stored for
            // this PSID in the last 7 days (referral/postback events arrive
            // before the first message creates the lead).
            let fbAdId: string | null = referralAdId ?? existingLead?.fb_ad_id ?? null;
            if (!fbAdId) {
              const { data: recentRef } = await supabase
                .from("messenger_referrals")
                .select("ad_id")
                .eq("psid", psid)
                .eq("client_id", clientId)
                .not("ad_id", "is", null)
                .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              fbAdId = recentRef?.ad_id ?? null;
            }

            let leadId: string;
            let isNewLead = false;
            let automationEnabled = false;
            let conversationSummary = "";

            if (!existingLead) {
              // Resolve lead's real name from Facebook Graph API before insert
              let leadName = "Messenger Lead";
              const nameLookupAt = new Date().toISOString();
              let nameLookupMeta: Record<string, unknown>;

              if (fbToken) {
                try {
                  const profileRes = await fetch(
                    `https://graph.facebook.com/v21.0/${psid}?fields=first_name,last_name&access_token=${fbToken}`
                  );
                  const profileData = await profileRes.json();
                  if (profileData.first_name) {
                    leadName = `${profileData.first_name} ${profileData.last_name ?? ""}`.trim();
                    nameLookupMeta = { ok: true, at: nameLookupAt };
                  } else {
                    const fbError = profileData.error ?? "empty_response";
                    console.warn(`FB Graph API name fetch failed for PSID ${psid}:`, fbError);
                    nameLookupMeta = { ok: false, at: nameLookupAt, error: fbError };
                  }
                } catch (e) {
                  console.warn(`FB Graph API name fetch exception for PSID ${psid}:`, e);
                  nameLookupMeta = { ok: false, at: nameLookupAt, error: String(e) };
                }
              } else {
                console.warn(`No FB page token for client ${clientId} — cannot fetch Messenger lead name`);
                nameLookupMeta = { ok: false, at: nameLookupAt, error: "no_token" };
              }

              const { data: newLead, error: createError } = await supabase
                .from("leads")
                .insert({
                  name: leadName,
                  messenger_id: psid,
                  source: "FB Messenger",
                  status: "New",
                  lead_temperature: "Cold",
                  client_id: clientId,
                  automation_enabled: false,
                  fb_ad_id: fbAdId,
                  metadata: { name_lookup: nameLookupMeta! },
                })
                .select("id")
                .single();

              if (createError || !newLead) {
                if (createError?.message?.includes("lead_limit_reached")) {
                  // Free-plan lead cap reached. Expected, not a failure: skip this
                  // new contact cleanly — no lead row, no auto-response. Logged as
                  // info so it never trips error monitoring. (Upgrade nudge TBD.)
                  console.log(
                    `Lead cap reached for client ${clientId}; skipping new Messenger lead (PSID ${psid}).`
                  );
                } else {
                  console.error(
                    `Lead insert failed (PSID ${psid}, client ${clientId}):`,
                    createError
                  );
                }
                continue;
              }
              leadId = newLead.id;
              isNewLead = true;

              await supabase.from("lead_qualifications").insert({
                lead_id: leadId,
                client_id: clientId,
              });
            } else {
              leadId = existingLead.id;
              automationEnabled = existingLead.automation_enabled ?? true;
              conversationSummary = existingLead.conversation_summary ?? "";
              // Backfill ad attribution recovered from a stored referral.
              if (fbAdId && !existingLead.fb_ad_id) {
                await supabase
                  .from("leads")
                  .update({ fb_ad_id: fbAdId })
                  .eq("id", leadId);
              }
            }

            // ── 2. SAVE INBOUND MESSAGE ──────────────────────────────
            // Quick reply taps include an intent payload alongside the title text;
            // null for normal text messages.
            const quickReplyPayload = event.message.quick_reply?.payload ?? null;
            await supabase.from("conversations").insert({
              lead_id: leadId,
              client_id: clientId,
              sender: "lead",
              direction: "inbound",
              channel: "messenger",
              message_content: messageText,
              intent_tag: quickReplyPayload,
              external_msg_id: externalMsgId,
              delivery_status: "received",
              sent_via: "facebook",
              created_at: new Date(timestamp).toISOString(),
            });

            await supabase
              .from("leads")
              .update({
                last_message_at: new Date(timestamp).toISOString(),
                last_inbound_at: new Date(timestamp).toISOString(),
              })
              .eq("id", leadId);

            // ── QUICK REPLY PAYLOAD AUTOMATION ───────────────────────
            if (quickReplyPayload === "STOP") {
              await supabase
                .from("leads")
                .update({ automation_enabled: false })
                .eq("id", leadId);
            } else if (quickReplyPayload === "SCHEDULE_VIEWING") {
              await supabase
                .from("leads")
                .update({ status: "Viewing" })
                .eq("id", leadId);
            }
            // ─────────────────────────────────────────────────────────
            // ── TRIGGER LEAD PROFILE UPDATE (fire-and-forget) ────────
            fetch("https://n8n-bahaymo.onrender.com/webhook/update-lead-profile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lead_id: leadId, message: messageText, client_id: clientId }),
            }).catch((err) => console.error("update-lead-profile n8n error:", err));

            // ── 3. CAMPAIGN ENROLLMENT (single authority) ────────────
            // enroll_lead() owns all enrollment_rules logic (source, new vs
            // existing, temperature, returning-window, skip-if-active) and
            // atomically sets campaign_id + lead_campaign_states. Safe to call
            // on every inbound — its guards skip opted-out / already-active
            // leads, so existing leads are picked up only when a campaign's
            // rules allow it (e.g. an existing-leads campaign).
            await supabase.rpc("enroll_lead", {
              p_lead_id: leadId,
              p_is_new: isNewLead,
              p_source: "messenger",
              p_attribution: { fb_ad_id: fbAdId },
            });

            // Load the lead's active campaign (if any) for the n8n payload, and
            // refresh automation_enabled since enroll_lead may have toggled it.
            const { data: campaignState } = await supabase
              .from("lead_campaign_states")
              .select(`
                id, campaign_id,
                campaign:campaigns (
                  id, name, target_action, campaign_rules, tone, conversational_ai_enabled
                )
              `)
              .eq("lead_id", leadId)
              .eq("client_id", clientId)
              .eq("state", "active")
              .maybeSingle();

            const { data: refreshedLead } = await supabase
              .from("leads")
              .select("automation_enabled")
              .eq("id", leadId)
              .single();
            automationEnabled = refreshedLead?.automation_enabled ?? automationEnabled;

            // Enforce automation opt-out: inbound logging, last_inbound_at, and the
            // update-lead-profile (W1) call above MUST still run, but stop here so the
            // AI responder does not auto-reply when automation is off for this lead.
            if (!automationEnabled) continue;

            // ── 4. FETCH SUPPORTING DATA FOR n8n ────────────────────
            const campaign = campaignState?.campaign as any;

            if (campaign?.conversational_ai_enabled === false) continue;

            const { data: recentMessages } = await supabase
              .from("conversations")
              .select("sender, direction, message_content, created_at")
              .eq("lead_id", leadId)
              .eq("client_id", clientId)
              .neq("channel", "system")
              .order("created_at", { ascending: false })
              .limit(5);

            const last5 = (recentMessages || []).reverse().map((c: any) => ({
              role: c.direction === "inbound" ? "lead" : "agent",
              message: c.message_content,
            }));

            // ── TRIGGER AI CAMPAIGN RESPONDER ────────────────────────
            // MUST be awaited. This fetch is the last thing the handler does
            // before returning its 200; on Vercel the serverless function can
            // be frozen/terminated the instant the response is sent, killing an
            // un-awaited (fire-and-forget) request before it ever reaches n8n.
            // That is exactly how W2 was silently dropped for some leads while
            // W1 (fired earlier, with awaited DB work after it) survived. W2's
            // webhook responds immediately ("Workflow got started"), so awaiting
            // adds negligible latency but guarantees the request is delivered.
            // .catch keeps a transient n8n error from throwing — we still 200 FB.
            await fetch("https://n8n-bahaymo.onrender.com/webhook/baymo-ai-campaign-responder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                lead_id: leadId,
                message: messageText,
                client_id: clientId,
                automation_enabled: automationEnabled,
                last_5_messages: last5,
                conversation_summary: conversationSummary,
              }),
            }).catch((err) => console.error("baymo-ai-campaign-responder n8n error:", err));

            // The AI reply is handled entirely by the fire-and-forget W2
            // responder above (it sends via FB Messenger and logs the reply
            // itself). The previous awaited N8N_INBOUND_WEBHOOK_URL call here
            // was a dead/duplicate path (stale webhook → 404) and a latent
            // double-reply risk, so it has been removed.
          } catch (msgError) {
            console.error("Error processing message:", msgError);
          }
        }
      }

      return res.status(200).json({ status: "ok" });
    } catch (error) {
      console.error("Webhook error:", error);
      return res.status(200).json({ status: "ok" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
