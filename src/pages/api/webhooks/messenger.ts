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
                  lead_type: "Buyer",
                  client_id: bamoClientId,
                  created_at: new Date().toISOString(),
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