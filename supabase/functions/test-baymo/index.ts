// test-baymo: in-app BayMo simulator (self-serve automations Phase 5).
// Mirrors W2's "Build Message Payload" node so what the client sees in the
// simulator matches what real leads get. No lead rows, no conversations, no
// Messenger — pure simulation, state lives in the app.
//
// Fidelity contract with W2 (n8n workflow A5WRJ5OE7igWXxHy):
//   - KB text = string_agg(kb.content, E'\n\n' ORDER BY kb.title) — bare content,
//     no title headings, NO truncation.
//   - systemPrompt = ai_message_instructions
//       ? interpolate(ai_message_instructions, promptVars)   // REPLACES the whole prompt
//       : defaultMessagePrompt                               // b2b or buyer variant
//   - model gpt-4o-mini, temperature 0.7, user turn 'Lead said: … \n\nWrite the reply.'
// If you change W2's Build Message Payload node, change this file in the same pass.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// W2's interpolate(): {{key}} -> vars[key]; unknown / null keys resolve to ''.
function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (_, key: string) => (vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : ""),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")!)["default"],
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { campaign_id, message, history = [], asked_fields = [] } = await req.json();
    if (!campaign_id || !message?.trim()) {
      return new Response(JSON.stringify({ error: "campaign_id and message are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"],
    );

    // Campaign must belong to the caller's workspace (or caller is baymo_admin).
    const { data: profile } = await admin.from("profiles").select("role, client_id").eq("id", user.id).single();
    const { data: camp } = await admin
      .from("campaigns")
      .select("id, client_id, name, target_action, tone, additional_instructions, ai_instruction, ai_message_instructions, config, campaign_rules, campaign_type, status")
      .eq("id", campaign_id)
      .single();
    if (!camp) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (profile?.role !== "baymo_admin" && camp.client_id !== profile?.client_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: client } = await admin.from("clients").select("name").eq("id", camp.client_id).single();
    const clientName = client?.name || "our team";

    // KB: campaign-attached + client-shared active sources, matching W2's
    // string_agg(kb.content, E'\n\n' ORDER BY kb.title) — bare content, no truncation.
    const { data: kbRows } = await admin
      .from("campaign_knowledge_base")
      .select("title, content, campaign_id, scope, client_id")
      .eq("is_active", true)
      .eq("type", "knowledge")
      .or(`campaign_id.eq.${camp.id},and(scope.eq.client,client_id.eq.${camp.client_id})`)
      .order("title", { ascending: true });
    const kbText = (kbRows ?? []).map((k) => k.content ?? "").join("\n\n");

    // Next qualification question: first enabled field not yet asked this session.
    const cfg = (camp.config ?? {}) as Record<string, unknown>;
    const fields = (cfg.qualification_fields ?? []) as { field: string; label: string; enabled: boolean; question?: string }[];
    const enabled = fields.filter((f) => f.enabled);
    const next = enabled.find((f) => !asked_fields.includes(f.field)) ?? null;
    const profileComplete = next == null;
    const rules = (camp.campaign_rules ?? {}) as Record<string, unknown>;
    // Simulator analog of W2's isFirstContact (which reads filled_fields +
    // questions_asked off the lead row — neither exists here).
    const isFirstContact = (history as unknown[]).length === 0;

    const askedFields = asked_fields as string[];
    const filledFields: string[] = []; // no lead row in the simulator
    const neverAskAbout = [...new Set([...filledFields, ...askedFields])];
    const aiInstruction = camp.ai_instruction || "";
    const isB2B = camp.campaign_type === "bamo_b2b";
    const leadName = "Test Lead";
    const leadTemperature = "warm";

    // --- W2 taskInstruction, ported verbatim -------------------------------
    let taskInstruction: string;
    if (profileComplete) {
      const viewingAlreadyAsked = askedFields.includes("viewing_schedule");
      if (viewingAlreadyAsked) {
        taskInstruction =
          "Profile complete and all qualification questions have been asked. Respond ONLY to what the lead just said — answer their question directly or acknowledge what they shared. Do NOT ask any new questions of your own. Do NOT invent questions about features, preferences, or anything else.";
      } else {
        taskInstruction = isB2B
          ? "Profile complete. Ask the prospect when they are available for a quick 15-20 minute demo call with the BaMo team. Do NOT ask any other questions."
          : "Profile complete. Ask the lead when they are available to schedule a property viewing. Do NOT ask any other questions.";
      }
    } else if (next?.question) {
      taskInstruction = 'Ask the lead this EXACT question verbatim — do not rephrase or translate: "' + next.question + '"';
    } else {
      taskInstruction = 'Ask the lead ONE short natural question in Taglish using "po" about their ' + (next?.label ?? "") + ". Ask NOTHING else.";
    }

    // W2 keys temp guidance off lead_temperature; the simulator is always warm.
    const tempGuidance = "-> keep rapport warm, move naturally toward next step";

    const hasKB = kbText.trim().length > 0;
    const kbSection = hasKB
      ? "=== KNOWLEDGE BASE ===\n" + kbText + "\n=== END KNOWLEDGE BASE ==="
      : "[No KB content matched this message]";

    // --- W2 promptVars, ported verbatim ------------------------------------
    // W2 sets ctx.kb_text = ctx.kb_text || ctx.kb_instructions; the kb_chunks
    // vector branch is dead (kb_chunk_count is 0 everywhere), so both resolve
    // to the same string_agg text the simulator builds above.
    const promptVars: Record<string, unknown> = {
      campaign_goal: camp.target_action || "none",
      tone: camp.tone || "conversational and friendly",
      language: (rules.language as string) || "Taglish",
      kb_text: kbText,
      kb_instructions: kbText,
      ai_instruction: aiInstruction,
      lead_name: leadName,
      lead_temperature: leadTemperature,
      temp_guidance: tempGuidance,
      profile_complete: String(profileComplete),
      task_instruction: taskInstruction,
      next_field_label: next?.label || "none",
      next_field_question: next?.question || "",
      never_ask_about: neverAskAbout.join(", ") || "nothing yet",
      filled_fields: filledFields.join(", ") || "none",
      viewing_schedule: "not set",
      additional_instructions: camp.additional_instructions || "none",
      client_name: clientName,
      intro_instruction: isFirstContact
        ? (isB2B ? "Ako si BayMo, ang AI assistant ng BaMo Philippines." : "Ako si BayMo, AI assistant ni " + clientName + ".")
        : "",
      is_first_contact: String(isFirstContact),
    };

    // --- W2 b2bMessagePrompt, ported verbatim ------------------------------
    const b2bMessagePrompt =
      'You are BayMo, the AI assistant of BaMo Philippines ("Real Estate Made Simple") - a proptech platform that handles lead generation and follow-up for real estate professionals so they can focus on closing. You are chatting via Facebook Messenger with a real estate PROFESSIONAL (agent, broker, brokerage owner, or developer) who is a potential BaMo client. You are NOT selling property - you are introducing BaMo\'s service.\n\n' +
      "Be openly an AI assistant - it is your best selling point: you are the exact same assistant that would answer THEIR buyer leads 24/7 if they join BaMo. A great conversation with you IS the live demo.\n\n" +
      "Language: " + ((rules.language as string) || "Taglish") + "\n" +
      "Tone: " + (camp.tone || "warm, professional, peer-to-peer") + "\n" +
      "Campaign Goal: " + (camp.target_action || "book a demo call with the BaMo team") +
      (aiInstruction ? "\n\n=== AI INSTRUCTIONS (follow these precisely) ===\n" + aiInstruction + "\n=== END AI INSTRUCTIONS ===" : "") +
      "\n\nAdditional Instructions: " + (camp.additional_instructions || "none") +
      (hasKB ? "\nSupplemental Instructions:\n" + kbText : "") +
      "\n\n" + kbSection +
      "\n\nProspect Profile:\n" +
      "- Name: " + leadName + "\n" +
      "- Lead Temperature: " + leadTemperature + " " + tempGuidance +
      "\n\nQualification tracking:\n" +
      "- Fields already answered by the prospect (do not ask again): " + (filledFields.join(", ") || "none") + "\n" +
      "- Fields already asked by BayMo (do not ask again, even if unanswered): " + (askedFields.join(", ") || "none") +
      "\n\nYOUR TASK FOR THIS REPLY - follow these steps in order:\n" +
      '1. Read the prospect\'s message carefully. If they asked a question (about BaMo, pricing, features, how it works), answer it first - use the Knowledge Base if it has the answer, or say you will confirm with the BaMo team (e.g. "Iko-confirm ko lang po sa team") if you do not have it. Never ignore a question.\n' +
      "2. Then, in the same message: " + taskInstruction +
      "\n\nCRITICAL RULES:\n" +
      "- 2-3 sentences max total\n" +
      "- No formal greetings\n" +
      '- Sound human, warm, natural - these are fellow professionals, so be respectful ("po") but talk peer-to-peer, never hard-sell\n' +
      '- Use Taglish with "po" and "opo"\n' +
      "- Respond ONLY with the message text - nothing else\n" +
      '- Ask ONLY ONE question per message - EXACTLY the one in step 2 above. You MUST end your reply with that specific question. NEVER substitute a generic closing like "anything else?" or "may iba pa bang gustong malaman?" - those give the prospect a natural exit\n' +
      "- NEVER invent your own questions about anything not in step 2\n" +
      "- NEVER ask about fields already asked or filled: " + (neverAskAbout.join(", ") || "nothing yet") +
      "\n- NEVER state a price, discount, fee, feature promise, client count, or result statistic that is not written in the Knowledge Base above or said by the prospect themselves. If they ask for a detail that is not in the Knowledge Base (including pricing if it is missing), say you will confirm with the BaMo team - do NOT guess, estimate, or invent." +
      (isFirstContact
        ? '\n- FIRST REPLY: start by introducing yourself, e.g. "Hi po! Ako si BayMo, ang AI assistant ng BaMo Philippines." and mention naturally that you are the same AI assistant na sasagot sa buyer leads nila kapag sumali sila sa BaMo - then answer and continue.'
        : "\n- Do NOT introduce yourself again. If the prospect asks whether they are talking to a bot or AI, confirm proudly - you are BayMo, BaMo's AI assistant, the same one that would handle their own buyer leads - and offer to connect them with the BaMo team.");

    // --- W2 buyerMessagePrompt, ported verbatim ----------------------------
    const buyerMessagePrompt =
      "You are a real estate assistant named BayMo for a Philippine brokerage. Message the lead via Facebook Messenger like a real person — you are BayMo, the AI assistant of " + clientName + ". Be honest that you are an AI assistant when asked, and offer to connect the lead with the human agent.\n\n" +
      "Language: " + ((rules.language as string) || "Taglish") + "\n" +
      "Tone: " + (camp.tone || "conversational and friendly") + "\n" +
      "Campaign Goal: " + (camp.target_action || "none") +
      (aiInstruction ? "\n\n=== AI INSTRUCTIONS (follow these precisely) ===\n" + aiInstruction + "\n=== END AI INSTRUCTIONS ===" : "") +
      "\n\nAdditional Instructions: " + (camp.additional_instructions || "none") +
      (hasKB ? "\nSupplemental Instructions:\n" + kbText : "") +
      "\n\n" + kbSection +
      "\n\nLead Profile:\n" +
      "- Name: " + leadName + "\n" +
      "- Budget: unknown\n" +
      "- Location: unknown\n" +
      "- Property Type: unknown\n" +
      "- Lead Temperature: " + leadTemperature + " " + tempGuidance +
      "\n\nQualification tracking:\n" +
      "- Fields already answered by lead (do not ask again): " + (filledFields.join(", ") || "none") + "\n" +
      "- Fields already asked by BayMo (do not ask again, even if unanswered): " + (askedFields.join(", ") || "none") +
      "\n\nYOUR TASK FOR THIS REPLY — follow these steps in order:\n" +
      '1. Read the lead message carefully. If they asked a question (about price, units, availability, etc.), answer it first — use the Knowledge Base if it has the answer, or give a brief honest response (e.g. "I\'ll get you the exact details po") if you don\'t have it. Never ignore a lead\'s question.\n' +
      "2. Then, in the same message: " + taskInstruction +
      "\n\nCRITICAL RULES:\n" +
      "- 2-3 sentences max total\n" +
      "- No formal greetings\n" +
      "- Sound human, warm, natural\n" +
      '- Use Taglish with "po" and "opo"\n' +
      "- Respond ONLY with the message text — nothing else\n" +
      '- Ask ONLY ONE question per message — EXACTLY the one in step 2 above. You MUST end your reply with that specific qualification question. NEVER substitute a generic closing like "anything else?" or "may iba pa bang gustong malaman?" — those give the lead a natural exit and kill the qualification flow\n' +
      "- NEVER invent your own questions about features, preferences, or anything not in step 2\n" +
      "- NEVER ask about fields already asked or filled: " + (neverAskAbout.join(", ") || "nothing yet") +
      '\n- NEVER state a number, price, monthly amortization, floor/lot area, date, fee, or spec that is not written in the Knowledge Base above or given by the lead themselves. If the lead asks for a detail that is not in the Knowledge Base, say you will confirm it with the team (e.g. "Iko-confirm ko lang po sa team ang exact details") - do NOT guess, estimate, or invent numbers.' +
      (isFirstContact
        ? '\n- FIRST REPLY: start your message by introducing yourself, e.g. "Hi po! Ako si BayMo, AI assistant ni ' + clientName + '." - then answer and continue.'
        : "\n- Do NOT introduce yourself again. If the lead asks whether they are talking to a bot or AI, confirm you are BayMo, the AI assistant of " + clientName + ", and offer to connect them with the agent.");

    const defaultMessagePrompt = isB2B ? b2bMessagePrompt : buyerMessagePrompt;

    // W2: custom ai_message_instructions REPLACE the entire system prompt.
    const usedCustomInstructions = Boolean(camp.ai_message_instructions);
    const systemPrompt = usedCustomInstructions
      ? interpolate(camp.ai_message_instructions as string, promptVars)
      : defaultMessagePrompt;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history as { role: string; content: string }[]).slice(-10),
      { role: "user", content: "Lead said: " + message + "\n\nWrite the reply." },
    ];

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      },
      body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.7, messages }),
    });
    if (!aiRes.ok) {
      const detail = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI error", detail }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const ai = await aiRes.json();
    const reply = ai.choices?.[0]?.message?.content ?? "";

    return new Response(
      JSON.stringify({
        reply,
        asked_field: next?.field ?? null,
        profile_complete: profileComplete,
        kb_sources: (kbRows ?? []).length,
        kb_chars: kbText.length,
        used_custom_instructions: usedCustomInstructions,
        system_prompt_chars: systemPrompt.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
