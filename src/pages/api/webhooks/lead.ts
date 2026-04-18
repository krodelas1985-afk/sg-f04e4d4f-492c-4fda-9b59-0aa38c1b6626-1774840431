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

  console.log("✅ Lead created successfully:", lead.id);

  // ─────────────────────────────────────────
  // STEP 3 — CIE CAMPAIGN ENROLLMENT
  // Smart matching: if payload has campaign_id use it directly.
  // If not, find best matching active campaign via enrollment_rules.
  // ─────────────────────────────────────────

  try {
    const { data: existingState } = await supabase
      .from('lead_campaign_states')
      .select('id, state')
      .eq('lead_id', lead.id)
      .in('state', ['active', 'paused'])
      .limit(1)
      .maybeSingle();

    if (existingState) {
      console.log('⏭️ Lead already has active campaign — skipping auto-enroll');
    } else {
      let campaignIdToEnroll: string | null = lead.campaign_id || null;

      if (!campaignIdToEnroll) {
        const { data: activeCampaigns } = await supabase
          .from('campaigns')
          .select('id, name, enrollment_rules, priority')
          .eq('client_id', client.id)
          .eq('status', 'active')
          .order('priority', { ascending: true });

        if (activeCampaigns && activeCampaigns.length > 0) {
          const incomingSource = (payload.source || '').toLowerCase();
          const incomingFbAdId = payload.fb_ad_id || payload.ad_id || null;
          const incomingWebformId = payload.webform_id || payload.form_id || null;
          const incomingSmsNumber = payload.sms_number || payload.to_number || null;

          for (const campaign of activeCampaigns) {
            const rules = campaign.enrollment_rules;
            if (!rules) continue;

            const allowedSources: string[] = rules.sources || [];
            if (allowedSources.length > 0) {
              const sourceMatches = allowedSources.some(
                (s: string) => s.toLowerCase() === incomingSource
              );
              if (!sourceMatches) continue;
            }

            if (rules.fb_ad_id && incomingFbAdId) {
              if (rules.fb_ad_id !== incomingFbAdId) continue;
            }

            if (rules.webform_id && incomingWebformId) {
              if (rules.webform_id !== incomingWebformId) continue;
            }

            if (rules.sms_number && incomingSmsNumber) {
              if (rules.sms_number !== incomingSmsNumber) continue;
            }

            campaignIdToEnroll = campaign.id;
            console.log('✅ Smart match found campaign:', campaign.name);
            break;
          }
        }
      }

      if (campaignIdToEnroll) {
        const { data: firstStep } = await supabase
          .from('campaign_steps')
          .select('id, delay_hours')
          .eq('campaign_id', campaignIdToEnroll)
          .eq('step_order', 1)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (firstStep) {
          const nextStepAt = new Date();
          nextStepAt.setHours(
            nextStepAt.getHours() + (firstStep.delay_hours || 0)
          );

          await supabase.from('lead_campaign_states').insert({
            lead_id: lead.id,
            campaign_id: campaignIdToEnroll,
            client_id: client.id,
            state: 'active',
            current_step: 1,
            enrolled_at: new Date().toISOString(),
            next_step_at: nextStepAt.toISOString(),
            conversational_ai: true,
          });

          await supabase
            .from('leads')
            .update({ campaign_id: campaignIdToEnroll })
            .eq('id', lead.id);

          console.log('✅ Lead enrolled in campaign:', campaignIdToEnroll);
        } else {
          console.log('⚠️ Campaign found but no active Step 1 — skipping enrollment');
        }
      } else {
        console.log('ℹ️ No matching campaign found — lead created without campaign');
      }
    }
  } catch (enrollError) {
    console.error('❌ Error in campaign enrollment:', enrollError);
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