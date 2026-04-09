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
  // STEP 3 — CIE CAMPAIGN ENROLLMENT
  // ─────────────────────────────────────────

  if (lead.campaign_id) {
    try {
      // Find step 1 of this campaign
      const { data: firstStep } = await supabase
        .from('campaign_steps')
        .select('id, delay_hours')
        .eq('campaign_id', lead.campaign_id)
        .eq('step_order', 1)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (firstStep) {
        const nextStepAt = new Date();
        nextStepAt.setHours(
          nextStepAt.getHours() + (firstStep.delay_hours || 0)
        );

        await supabase.from('lead_campaign_states').insert({
          lead_id: lead.id,
          campaign_id: lead.campaign_id,
          client_id: client.id,
          state: 'active',
          current_step: 1,
          enrolled_at: new Date().toISOString(),
          next_step_at: nextStepAt.toISOString(),
          metadata: {},
        });

        console.log('✅ Lead enrolled in campaign:', lead.campaign_id);
      }
    } catch (enrollError) {
      console.error('❌ Error enrolling lead in campaign:', enrollError);
      // Do not fail the webhook if enrollment fails
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