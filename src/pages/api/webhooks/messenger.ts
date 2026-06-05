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

          if (!event.message || !event.message.text) continue;

          try {
            const psid = event.sender.id as string;
            const messageText = event.message.text as string;
            const externalMsgId = event.message.mid as string;
            const timestamp = event.timestamp as number;

            // ── 1. LEAD LOOKUP / CREATE ──────────────────────────────
            const { data: existingLead } = await supabase
              .from("leads")
              .select("id, automation_enabled, conversation_summary")
              .eq("messenger_id", psid)
              .eq("client_id", clientId)
              .single();

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
                  lead_temperature: "cold",
                  client_id: clientId,
                  automation_enabled: false,
                  metadata: { name_lookup: nameLookupMeta! },
                })
                .select("id")
                .single();

              if (createError || !newLead) continue;
              leadId = newLead.id;
              isNewLead = true;

              await supabase.from("lead_qualifications").insert({
                lead_id: leadId,
                client_id: clientId,
              });
            } else {
              leadId = existingLead.id;
              automationEnabled = existingLead.automation_enabled ?? false;
              conversationSummary = existingLead.conversation_summary ?? "";
            }

            // ── 1b. FETCH LEAD QUALIFICATIONS ────────────────────────
            const { data: leadQualification } = await supabase
              .from("lead_qualifications")
              .select(
                "budget_min, budget_max, preferred_location, property_type, property_sub_type, purpose, timeframe, motivation, bedrooms, payment_scheme, preferred_financing, decision_maker, move_in_date, hesitation"
              )
              .eq("lead_id", leadId)
              .maybeSingle();

            // ── 2. SAVE INBOUND MESSAGE ──────────────────────────────
            await supabase.from("conversations").insert({
              lead_id: leadId,
              client_id: clientId,
              sender: "lead",
              direction: "inbound",
              channel: "messenger",
              message_content: messageText,
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

            // ── TRIGGER LEAD PROFILE UPDATE (fire-and-forget) ────────
            fetch("https://n8n-bahaymo.onrender.com/webhook/update-lead-profile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lead_id: leadId, message: messageText, client_id: clientId }),
            }).catch((err) => console.error("update-lead-profile n8n error:", err));

            // ── 3. CAMPAIGN MATCHING (new leads only) ────────────────
            let campaignState: any = null;

            if (isNewLead) {
              const { data: matchedCampaign } = await supabase
                .from("campaigns")
                .select("id, name, target_action, campaign_rules, tone, conversational_ai_enabled")
                .eq("client_id", clientId)
                .eq("status", "active")
                .eq("is_active", true)
                .filter("enrollment_rules->sources", "cs", '["messenger"]')
                .order("priority", { ascending: true })
                .limit(1)
                .maybeSingle();

              if (matchedCampaign) {
                await supabase.from("lead_campaign_states").insert({
                  lead_id: leadId,
                  campaign_id: matchedCampaign.id,
                  client_id: clientId,
                  state: "active",
                  current_step: 1,
                  enrolled_at: new Date().toISOString(),
                });

                await supabase
                  .from("leads")
                  .update({ automation_enabled: true, campaign_id: matchedCampaign.id })
                  .eq("id", leadId);

                automationEnabled = true;
                campaignState = { campaign: matchedCampaign };
              }
            } else {
              const { data: existingState } = await supabase
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

              campaignState = existingState;
            }

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

            // ── TRIGGER AI CAMPAIGN RESPONDER (fire-and-forget) ──────
            fetch("https://n8n-bahaymo.onrender.com/webhook/baymo-ai-campaign-responder", {
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
            });

            const { data: knowledgeBase } = await supabase
              .from("campaign_knowledge_base")
              .select("title, content")
              .eq("campaign_id", campaign?.id ?? "")
              .eq("client_id", clientId)
              .eq("is_active", true);

            const { data: clientData } = await supabase
              .from("clients")
              .select("company_name, business_industry, business_type")
              .eq("id", clientId)
              .single();

            // ── 5. CALL n8n ──────────────────────────────────────────
            const n8nWebhookUrl = process.env.N8N_INBOUND_WEBHOOK_URL;
            if (!n8nWebhookUrl) continue;

            const n8nPayload = {
              lead_id: leadId,
              client_id: clientId,
              messenger_id: psid,
              automation_enabled: automationEnabled,
              is_new_lead: isNewLead,
              message: messageText,
              last_5_messages: last5,
              conversation_summary: conversationSummary,
              campaign: campaign
                ? {
                    id: campaign.id,
                    name: campaign.name,
                    target_action: campaign.target_action,
                    campaign_rules: campaign.campaign_rules,
                    tone: campaign.tone,
                  }
                : null,
              client: {
                company_name: clientData?.company_name ?? "",
                business_industry: (clientData as any)?.business_industry ?? "",
                business_type: (clientData as any)?.business_type ?? "",
              },
              knowledge_base: knowledgeBase ?? [],
              lead_profile: {
                budget_min: leadQualification?.budget_min ?? null,
                budget_max: leadQualification?.budget_max ?? null,
                preferred_location: leadQualification?.preferred_location ?? null,
                property_type: leadQualification?.property_type ?? null,
                property_sub_type: leadQualification?.property_sub_type ?? null,
                purpose: leadQualification?.purpose ?? null,
                timeframe: leadQualification?.timeframe ?? null,
                motivation: leadQualification?.motivation ?? null,
                bedrooms: leadQualification?.bedrooms ?? null,
                payment_scheme: leadQualification?.payment_scheme ?? null,
                preferred_financing: leadQualification?.preferred_financing ?? null,
                decision_maker: leadQualification?.decision_maker ?? null,
                move_in_date: leadQualification?.move_in_date ?? null,
                hesitation: leadQualification?.hesitation ?? null,
              },
            };

            const n8nResponse = await fetch(n8nWebhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(n8nPayload),
            });

            if (!n8nResponse.ok) {
              console.error("n8n call failed:", await n8nResponse.text());
              continue;
            }

            const n8nResult = await n8nResponse.json();

            // ── 6. HANDLE n8n RESPONSE ───────────────────────────────
            if (n8nResult.action === "send" && n8nResult.message) {
              if (fbToken) {
                await fetch(
                  `https://graph.facebook.com/v19.0/me/messages?access_token=${fbToken}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      recipient: { id: psid },
                      message: { text: n8nResult.message },
                      messaging_type: "RESPONSE",
                    }),
                  }
                );

                await supabase.from("conversations").insert({
                  lead_id: leadId,
                  client_id: clientId,
                  sender: "baymo",
                  direction: "outbound",
                  channel: "messenger",
                  message_content: n8nResult.message,
                  sent_via: "facebook_api",
                  delivery_status: "sent",
                });

                if (n8nResult.temperature) {
                  await supabase
                    .from("leads")
                    .update({ lead_temperature: n8nResult.temperature })
                    .eq("id", leadId);
                }

                console.log(`✅ n8n reply sent to PSID: ${psid} (client: ${clientId})`);
              }
            } else if (n8nResult.action === "suggestion" && n8nResult.message) {
              await supabase.from("conversations").insert({
                lead_id: leadId,
                client_id: clientId,
                sender: "baymo",
                direction: "outbound",
                channel: "messenger",
                message_content: n8nResult.message,
                sent_via: "suggestion",
                delivery_status: "pending",
              });

              console.log(`💡 AI suggestion stored for lead: ${leadId}`);
            }
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
