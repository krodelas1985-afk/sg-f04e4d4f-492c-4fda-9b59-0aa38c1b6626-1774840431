import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Use service role client for all operations
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ─────────────────────────────────────────
  // STEP 1 — VALIDATE WEBHOOK SECRET
  // ─────────────────────────────────────────

  const webhookSecret = 
    req.headers["x-webhook-secret"] as string || 
    req.body.webhook_secret;

  if (!webhookSecret) {
    // Log failed attempt
    await supabase.from("webhook_logs").insert({
      client_id: null,
      source: req.body.source || "unknown",
      payload: req.body,
      status: "failed",
      error_message: "Missing webhook secret",
    });

    return res.status(401).json({ error: "Unauthorized" });
  }

  // Find client by webhook secret
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name")
    .eq("webhook_secret", webhookSecret)
    .single();

  if (clientError || !client) {
    console.error("❌ Invalid webhook secret:", webhookSecret);

    // Log failed attempt
    await supabase.from("webhook_logs").insert({
      client_id: null,
      source: req.body.source || "unknown",
      payload: req.body,
      status: "failed",
      error_message: "Invalid webhook secret",
    });

    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("✅ Webhook validated for client:", client.name);

  // ─────────────────────────────────────────
  // STEP 2 — CREATE LEAD
  // ─────────────────────────────────────────

  const payload = req.body;

  // Extract known fields
  const leadData: any = {
    client_id: client.id,
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    source: payload.source,
    budget_min: payload.budget_min,
    budget_max: payload.budget_max,
    preferred_location: payload.preferred_location,
    property_type: payload.property_type,
    bedrooms: payload.bedrooms,
    buyer_type: payload.buyer_type,
    company: payload.company,
    campaign_id: payload.campaign_id,
    status: "New",
  };

  // Store extra fields in metadata
  const knownFields = [
    "name", "email", "phone", "source", "budget_min", "budget_max",
    "preferred_location", "property_type", "bedrooms", "buyer_type",
    "company", "campaign_id", "webhook_secret"
  ];
  
  const metadata: any = {};
  Object.keys(payload).forEach((key) => {
    if (!knownFields.includes(key)) {
      metadata[key] = payload[key];
    }
  });

  if (payload.custom_fields) {
    metadata.custom_fields = payload.custom_fields;
  }

  if (Object.keys(metadata).length > 0) {
    leadData.metadata = metadata;
  }

  // Insert lead
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert(leadData)
    .select()
    .single();

  if (leadError || !lead) {
    console.error("❌ Error creating lead:", leadError);

    // Log failure
    await supabase.from("webhook_logs").insert({
      client_id: client.id,
      source: payload.source || "unknown",
      payload: req.body,
      status: "failed",
      error_message: leadError?.message || "Failed to create lead",
    });

    return res.status(500).json({ error: "Failed to create lead" });
  }

  console.log("✅ Lead created:", lead.id);

  // ─────────────────────────────────────────
  // STEP 3 — EMAIL TRIGGER
  // ─────────────────────────────────────────

  if (payload.campaign_id) {
    try {
      // Get campaign config
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("name, config, email_template_id")
        .eq("id", payload.campaign_id)
        .single();

      if (campaign?.config?.email_triggers?.on_lead_created?.enabled) {
        const trigger = campaign.config.email_triggers.on_lead_created;

        // Check if lead source matches trigger sources
        const shouldSendEmail = 
          !trigger.sources || 
          trigger.sources.length === 0 || 
          trigger.sources.includes(lead.source);

        if (shouldSendEmail && lead.email) {
          console.log("📧 Sending email trigger for lead:", lead.id);

          // Get email template
          const templateId = trigger.email_template_id || campaign.email_template_id;
          
          if (templateId) {
            const { data: template } = await supabase
              .from("email_templates")
              .select("subject, body")
              .eq("id", templateId)
              .single();

            if (template) {
              // Replace variables in body
              let emailBody = template.body;
              emailBody = emailBody.replace(/{{name}}/g, lead.name || "there");
              emailBody = emailBody.replace(/{{email}}/g, lead.email || "");
              emailBody = emailBody.replace(/{{campaign_name}}/g, campaign.name || "");
              emailBody = emailBody.replace(/{{source}}/g, lead.source || "");

              // Send email using Resend
              const resendApiKey = process.env.RESEND_API_KEY;
              
              if (resendApiKey) {
                try {
                  const emailResponse = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${resendApiKey}`,
                    },
                    body: JSON.stringify({
                      from: "BayMo <noreply@baymo.io>",
                      to: lead.email,
                      subject: template.subject || "Thank you for your inquiry",
                      html: emailBody,
                    }),
                  });

                  const emailResult = await emailResponse.json();

                  if (emailResponse.ok) {
                    console.log("✅ Email sent via Resend:", emailResult.id);

                    // Log in conversations
                    await supabase.from("conversations").insert({
                      lead_id: lead.id,
                      client_id: client.id,
                      channel: "email",
                      direction: "outbound",
                      sender: "system",
                      sent_via: "resend",
                      delivery_status: "sent",
                      message_content: emailBody,
                      external_msg_id: emailResult.id,
                    });
                  } else {
                    console.error("❌ Resend error:", emailResult);
                  }
                } catch (emailError) {
                  console.error("❌ Error sending email:", emailError);
                }
              } else {
                console.warn("⚠️ RESEND_API_KEY not configured");
              }
            }
          }
        }
      }
    } catch (triggerError) {
      console.error("❌ Error in email trigger:", triggerError);
      // Don't fail the webhook if email fails
    }
  }

  // ─────────────────────────────────────────
  // STEP 4 — LOG SUCCESS
  // ─────────────────────────────────────────

  await supabase.from("webhook_logs").insert({
    client_id: client.id,
    source: payload.source || "unknown",
    payload: req.body,
    status: "success",
    lead_id: lead.id,
  });

  console.log("✅ Webhook processed successfully");

  return res.status(200).json({
    success: true,
    lead_id: lead.id,
  });
}