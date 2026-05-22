import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET - Webhook Verification
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

  // POST - Inbound Messages
  if (req.method === "POST") {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const body = req.body;
      if (body.object !== "page") return res.status(200).json({ status: "ok" });
      if (!body.entry || !Array.isArray(body.entry)) return res.status(200).json({ status: "ok" });

      const bamoClientId = process.env.BAMO_CLIENT_ID;
      if (!bamoClientId) return res.status(200).json({ status: "ok" });

      for (const entry of body.entry) {
        if (!entry.messaging || !Array.isArray(entry.messaging)) continue;

        for (const event of entry.messaging) {
          if (!event.message || !event.message.text) continue;

          try {
            const psid = event.sender.id;
            const messageText = event.message.text;
            const externalMsgId = event.message.mid;
            const timestamp = event.timestamp;

            // ── 1. LEAD LOOKUP / CREATE ──────────────────────────────
            const { data: existingLead } = await supabase
              .from("leads")
              .select("id, automation_enabled, conversation_summary, budget_min, budget_max, preferred_location, property_type, property_sub_type, purpose, timeframe, motivation, bedrooms, payment_scheme, preferred_financing, decision_maker, move_in_date, hesitation")
              .eq("messenger_id", psid)
              .eq("client_id", bamoClientId)
              .single();

            let leadId: string;
            let isNewLead = false;
            let automationEnabled = false;
            let conversationSummary = "";

            if (!existingLead) {
              const { data: newLead, error: createError } = await supabase
                .from("leads")
                .insert({
                  name: `FB Lead ${psid}`,
                  messenger_id: psid,
                  source: "FB Messenger",
                  status: "New",
                  lead_temperature: "cold",
                  client_id: bamoClientId,
                  automation_enabled: false,
                })
                .select("id")
                .single();

              if (createError || !newLead) continue;
              leadId = newLead.id;
              isNewLead = true;
            } else {
              leadId = existingLead.id;
              automationEnabled = existingLead.automation_enabled ?? false;
              conversationSummary = existingLead.conversation_summary ?? "";
            }

            // ── 2. SAVE INBOUND MESSAGE ──────────────────────────────
            await supabase.from("conversations").insert({
              lead_id: leadId,
              client_id: bamoClientId,
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
              .update({ last_message_at: new Date(timestamp).toISOString() })
              .eq("id", leadId);

            // ── TRIGGER LEAD PROFILE UPDATE (fire-and-forget) ────────
fetch("https://n8n-bahaymo.onrender.com/webhook/update-lead-profile", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    lead_id: leadId,
    message: messageText,
    client_id: bamoClientId,
  }),
}).catch((err) => console.error("update-lead-profile n8n error:", err));

            // ── 3. CAMPAIGN MATCHING (new leads only) ────────────────
            let campaignState: any = null;

            if (isNewLead) {
              const { data: matchedCampaign } = await supabase
                .from("campaigns")
                .select("id, name, target_action, campaign_rules, tone, conversational_ai_enabled")
                .eq("client_id", bamoClientId)
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
                  client_id: bamoClientId,
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
                .eq("client_id", bamoClientId)
                .eq("state", "active")
                .maybeSingle();

              campaignState = existingState;
            }

            // ── 4. FETCH SUPPORTING DATA FOR n8n ────────────────────
            const campaign = campaignState?.campaign as any;

            // Skip only if campaign explicitly disabled conversational AI
            if (campaign?.conversational_ai_enabled === false) continue;

            // Last 5 messages
            const { data: recentMessages } = await supabase
              .from("conversations")
              .select("sender, direction, message_content, created_at")
              .eq("lead_id", leadId)
              .eq("client_id", bamoClientId)
              .neq("channel", "system")
              .order("created_at", { ascending: false })
              .limit(5);

            const last5 = (recentMessages || []).reverse().map((c: any) => ({
              role: c.direction === "inbound" ? "lead" : "agent",
              message: c.message_content,
            }));

            // ── TRIGGER AI CAMPAIGN RESPONDER (fire-and-forget) ──────
            fetch('https://n8n-bahaymo.onrender.com/webhook/baymo-ai-campaign-responder', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lead_id: leadId,
                message: messageText,
                client_id: bamoClientId,
                automation_enabled: automationEnabled,
                last_5_messages: last5,
                conversation_summary: conversationSummary,
              }),
            });

            // Knowledge base
            const { data: knowledgeBase } = await supabase
              .from("campaign_knowledge_base")
              .select("title, content")
              .eq("campaign_id", campaign?.id ?? "")
              .eq("client_id", bamoClientId)
              .eq("is_active", true);

            // Client info
            const { data: clientData } = await supabase
              .from("clients")
              .select("company_name, business_industry, business_type")
              .eq("id", bamoClientId)
              .single();

            // ── 5. CALL n8n ──────────────────────────────────────────
            const n8nWebhookUrl = process.env.N8N_INBOUND_WEBHOOK_URL;
            if (!n8nWebhookUrl) continue;

            const n8nPayload = {
              lead_id: leadId,
              client_id: bamoClientId,
              messenger_id: psid,
              automation_enabled: automationEnabled,
              is_new_lead: isNewLead,
              message: messageText,
              last_5_messages: last5,
              conversation_summary: conversationSummary,
              campaign: campaign ? {
                id: campaign.id,
                name: campaign.name,
                target_action: campaign.target_action,
                campaign_rules: campaign.campaign_rules,
                tone: campaign.tone,
              } : null,
              client: {
                company_name: clientData?.company_name ?? "",
                business_industry: clientData?.business_industry ?? "",
                business_type: clientData?.business_type ?? "",
              },
              knowledge_base: knowledgeBase ?? [],
              lead_profile: {
                budget_min: existingLead?.budget_min ?? null,
                budget_max: existingLead?.budget_max ?? null,
                preferred_location: existingLead?.preferred_location ?? null,
                property_type: existingLead?.property_type ?? null,
                property_sub_type: existingLead?.property_sub_type ?? null,
                purpose: existingLead?.purpose ?? null,
                timeframe: existingLead?.timeframe ?? null,
                motivation: existingLead?.motivation ?? null,
                bedrooms: existingLead?.bedrooms ?? null,
                payment_scheme: existingLead?.payment_scheme ?? null,
                preferred_financing: existingLead?.preferred_financing ?? null,
                decision_maker: existingLead?.decision_maker ?? null,
                move_in_date: existingLead?.move_in_date ?? null,
                hesitation: existingLead?.hesitation ?? null,
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
              const fbToken = process.env.FB_PAGE_ACCESS_TOKEN;
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
                  client_id: bamoClientId,
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

                console.log(`✅ n8n reply sent to PSID: ${psid}`);
              }
            } else if (n8nResult.action === "suggestion" && n8nResult.message) {
              await supabase.from("conversations").insert({
                lead_id: leadId,
                client_id: bamoClientId,
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
