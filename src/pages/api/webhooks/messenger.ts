import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * Facebook Messenger Webhook Endpoint
 * 
 * Handles two types of requests:
 * 1. GET - Webhook verification (one-time during setup)
 * 2. POST - Inbound messages from Facebook Messenger
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET request - Webhook Verification
  if (req.method === "GET") {
    try {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      // Verify the webhook
      if (mode === "subscribe" && token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
        console.log("Webhook verified successfully");
        return res.status(200).send(challenge);
      } else {
        console.error("Webhook verification failed");
        return res.status(403).send("Forbidden");
      }
    } catch (error) {
      console.error("Webhook verification error:", error);
      return res.status(403).send("Forbidden");
    }
  }

  // POST request - Receive Inbound Messages
  if (req.method === "POST") {
    try {
      // Initialize Supabase with SERVICE ROLE key to bypass RLS
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Missing Supabase credentials");
        return res.status(200).json({ status: "ok" }); // Still return 200 to Facebook
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const body = req.body;

      // Verify this is a page messaging event
      if (body.object !== "page") {
        console.log("Not a page event, ignoring");
        return res.status(200).json({ status: "ok" });
      }

      if (!body.entry || !Array.isArray(body.entry)) {
        console.log("No entries found, ignoring");
        return res.status(200).json({ status: "ok" });
      }

      // Get BaMo client ID from environment
      const bamoClientId = process.env.BAMO_CLIENT_ID;

      if (!bamoClientId) {
        console.error("BAMO_CLIENT_ID not configured");
        return res.status(200).json({ status: "ok" }); // Still return 200 to Facebook
      }

      // Process each entry
      for (const entry of body.entry) {
        if (!entry.messaging || !Array.isArray(entry.messaging)) {
          continue;
        }

        // Process each messaging event
        for (const event of entry.messaging) {
          // Only process events with message text
          if (!event.message || !event.message.text) {
            continue;
          }

          try {
            // Extract message data
            const psid = event.sender.id;
            const messageText = event.message.text;
            const externalMsgId = event.message.mid;
            const timestamp = event.timestamp;

            // Look up lead by messenger_id and client_id
            const { data: existingLead, error: leadLookupError } = await supabase
              .from("leads")
              .select("id")
              .eq("messenger_id", psid)
              .eq("client_id", bamoClientId)
              .single();

            let leadId;

            if (leadLookupError || !existingLead) {
              // Lead not found - create new lead
              console.log(`Creating new lead for PSID: ${psid}`);

              // Create new lead
              const { data: newLead, error: createError } = await supabase
                .from("leads")
                .insert({
                  name: `FB Lead ${psid}`,
                  messenger_id: psid,
                  source: "FB Messenger",
                  status: "New",
                  lead_temperature: "New",
                  client_id: bamoClientId,
                })
                .select("id")
                .single();

              if (createError) {
                console.error("Error creating lead:", createError);
                continue; // Skip this message but continue processing others
              }

              leadId = newLead.id;
              console.log(`Created new lead with ID: ${leadId}`);
            } else {
              leadId = existingLead.id;
              console.log(`Found existing lead with ID: ${leadId}`);
            }

            // Insert conversation
            const { error: conversationError } = await supabase
              .from("conversations")
              .insert({
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

            if (conversationError) {
              console.error("Error inserting conversation:", conversationError);
              continue; // Skip this message but continue processing others
            }

            // Update lead's last_message_at timestamp
            await supabase
              .from("leads")
              .update({ 
                last_message_at: new Date(timestamp).toISOString(),
                unread_count: supabase.rpc("increment", { x: 1 }) // Increment unread count
              })
              .eq("id", leadId);

            console.log(`Successfully processed message from PSID: ${psid}`);

            // ─────────────────────────────────────────
            // CONVERSATIONAL AI — Auto-reply if enabled
            // ─────────────────────────────────────────

            try {
              // Check if lead has an active campaign with conversational AI enabled
              const { data: leadCampaignState } = await supabase
                .from('lead_campaign_states')
                .select(`
                  id,
                  campaign_id,
                  conversational_ai,
                  campaign:campaigns (
                    id,
                    name,
                    target_action,
                    additional_instructions,
                    campaign_rules,
                    conversational_ai_enabled,
                    tone,
                    status
                  ),
                  client:clients (
                    id,
                    company_name,
                    business_industry,
                    business_type
                  )
                `)
                .eq('lead_id', leadId)
                .eq('client_id', bamoClientId)
                .eq('state', 'active')
                .maybeSingle();

              const campaign = leadCampaignState?.campaign as any;
              const clientData = leadCampaignState?.client as any;

              const shouldReply =
                leadCampaignState &&
                leadCampaignState.conversational_ai === true &&
                campaign?.conversational_ai_enabled === true &&
                campaign?.status === 'active';

              if (shouldReply) {
                // Fetch knowledge base for this campaign
                const { data: knowledgeBaseEntries } = await supabase
                  .from('campaign_knowledge_base')
                  .select('title, content')
                  .eq('campaign_id', leadCampaignState.campaign_id)
                  .eq('client_id', bamoClientId)
                  .eq('is_active', true);

                // Fetch recent conversation history
                const { data: recentConversations } = await supabase
                  .from('conversations')
                  .select('sender, message_content, direction, created_at')
                  .eq('lead_id', leadId)
                  .eq('client_id', bamoClientId)
                  .neq('channel', 'system')
                  .order('created_at', { ascending: false })
                  .limit(10);

                const conversationHistory = (recentConversations || [])
                  .reverse()
                  .map((c: any) =>
                    `[${c.direction === 'inbound' ? 'LEAD' : 'BAYMO/AGENT'}]: ${c.message_content}`
                  )
                  .join('\n');

                const kbSection = knowledgeBaseEntries && knowledgeBaseEntries.length > 0
                  ? knowledgeBaseEntries.map((kb: any) => `[${kb.title}]\n${kb.content}`).join('\n\n')
                  : '(No knowledge base configured)';

                const rules = campaign?.campaign_rules || {};
                const language = rules.language || campaign?.tone || 'Follow the lead\'s language';
                const tone = rules.tone || 'warm and friendly';
                const dos = rules.dos?.map((d: string) => `✓ ${d}`).join('\n') || '';
                const donts = rules.donts?.map((d: string) => `✗ ${d}`).join('\n') || '';
                const additional = rules.additional || campaign?.additional_instructions || '';

                const businessName = clientData?.company_name || 'this business';
                const businessContext = [clientData?.business_industry, clientData?.business_type]
                  .filter(Boolean).join(' — ');

                const prompt = `You are BayMo, an AI assistant for ${businessName}${businessContext ? `, a ${businessContext}` : ''}.

=== KNOWLEDGE BASE ===
${kbSection}

=== CAMPAIGN RULES ===
Language: ${language}
Tone: ${tone}
${dos ? `\nDO:\n${dos}` : ''}
${donts ? `\nDO NOT:\n${donts}` : ''}
${additional ? `\nAdditional rules: ${additional}` : ''}

=== CAMPAIGN GOAL ===
${campaign?.target_action || 'Assist the lead and guide them toward the next step.'}

=== RECENT CONVERSATION ===
${conversationHistory || '(No previous conversation)'}

=== LEAD JUST SENT ===
${messageText}

=== YOUR TASK ===
The lead just sent a message. Read the knowledge base and reply helpfully following all campaign rules.
If the lead is asking to stop or shows anger, reply politely and say a human agent will follow up.
If the lead shows a strong buying signal or requests a viewing, acknowledge warmly and say an agent will reach out shortly.

Reply with ONLY the message to send — no labels, no preamble, just the message text.`;

                const openAIKey = process.env.OPENAI_API_KEY;
                if (openAIKey) {
                  const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${openAIKey}`,
                    },
                    body: JSON.stringify({
                      model: 'gpt-4o',
                      messages: [{ role: 'user', content: prompt }],
                      max_tokens: 300,
                      temperature: 0.4,
                    }),
                  });

                  const aiData = await aiResponse.json();
                  const replyText = aiData.choices?.[0]?.message?.content?.trim();

                  if (replyText) {
                    // Send reply via FB Messenger
                    const fbToken = process.env.FB_PAGE_ACCESS_TOKEN;
                    if (fbToken) {
                      await fetch(
                        `https://graph.facebook.com/v19.0/me/messages?access_token=${fbToken}`,
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            recipient: { id: psid },
                            message: { text: replyText },
                            messaging_type: 'RESPONSE',
                          }),
                        }
                      );

                      // Log the AI reply to conversations
                      await supabase.from('conversations').insert({
                        lead_id: leadId,
                        client_id: bamoClientId,
                        sender: 'baymo',
                        direction: 'outbound',
                        channel: 'messenger',
                        message_content: replyText,
                        sent_via: 'facebook_api',
                        delivery_status: 'sent',
                      });

                      console.log(`✅ Conversational AI replied to PSID: ${psid}`);
                    }
                  }
                }
              }
            } catch (aiError) {
              console.error('❌ Conversational AI error:', aiError);
              // Never fail the webhook due to AI errors
            }

          } catch (messageError) {
            console.error("Error processing individual message:", messageError);
            // Continue processing other messages
          }
        }
      }

      // Always return 200 to Facebook
      return res.status(200).json({ status: "ok" });
    } catch (error) {
      console.error("Webhook processing error:", error);
      // Always return 200 to Facebook even on errors
      return res.status(200).json({ status: "ok" });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: "Method not allowed" });
}