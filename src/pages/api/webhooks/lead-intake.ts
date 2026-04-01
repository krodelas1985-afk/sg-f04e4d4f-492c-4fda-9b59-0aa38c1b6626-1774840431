import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers on all responses
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse request body
    const {
      webhook_secret,
      name,
      phone,
      email,
      source,
      property_type,
      budget_min,
      budget_max,
      preferred_location,
      notes,
    } = req.body;

    // Validate required fields
    if (!webhook_secret || !webhook_secret.trim()) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // At least one of phone or email must be provided
    if ((!phone || !phone.trim()) && (!email || !email.trim())) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Initialize Supabase with SERVICE ROLE key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration");
      return res.status(500).json({ error: "Internal server error" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate webhook_secret and get client_id
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("webhook_secret", webhook_secret.trim())
      .eq("is_active", true)
      .single();

    if (clientError || !client) {
      return res.status(401).json({ error: "Invalid webhook secret" });
    }

    // Normalize inputs
    const normalizedName = name.trim();
    const normalizedPhone = phone ? phone.replace(/\s+/g, "") : null;
    const normalizedEmail = email ? email.toLowerCase().trim() : null;
    const normalizedSource = source ? source.trim() : "webform";

    // Parse budget values as numbers or null
    let parsedBudgetMin = null;
    let parsedBudgetMax = null;

    if (budget_min !== undefined && budget_min !== null) {
      const parsed = Number(budget_min);
      if (!isNaN(parsed)) {
        parsedBudgetMin = parsed;
      }
    }

    if (budget_max !== undefined && budget_max !== null) {
      const parsed = Number(budget_max);
      if (!isNaN(parsed)) {
        parsedBudgetMax = parsed;
      }
    }

    // Check for duplicates within 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    let duplicateQuery = supabase
      .from("leads")
      .select("id")
      .eq("client_id", client.id)
      .gte("created_at", twentyFourHoursAgo.toISOString());

    if (normalizedEmail) {
      duplicateQuery = duplicateQuery.eq("email", normalizedEmail);
    } else if (normalizedPhone) {
      duplicateQuery = duplicateQuery.eq("phone", normalizedPhone);
    }

    const { data: duplicateLead } = await duplicateQuery.single();

    if (duplicateLead) {
      return res.status(200).json({ success: true, duplicate: true });
    }

    // Prepare metadata
    const metadata = notes ? { notes: notes.trim() } : null;

    // Insert lead
    const { data: newLead, error: insertError } = await supabase
      .from("leads")
      .insert({
        client_id: client.id,
        name: normalizedName,
        phone: normalizedPhone,
        email: normalizedEmail,
        source: normalizedSource,
        status: "new",
        lead_temperature: "new",
        property_type: property_type ? property_type.trim() : null,
        budget_min: parsedBudgetMin,
        budget_max: parsedBudgetMax,
        preferred_location: preferred_location ? preferred_location.trim() : null,
        primary_channel: normalizedSource,
        metadata: metadata,
        assigned_user_id: null,
        campaign_id: null,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error inserting lead:", insertError);
      return res.status(500).json({ error: "Internal server error" });
    }

    return res.status(200).json({ success: true, lead_id: newLead.id });
  } catch (error) {
    console.error("Lead intake error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}