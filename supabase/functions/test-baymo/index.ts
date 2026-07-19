// test-baymo: in-app BayMo simulator (self-serve automations Phase 5).
// Mirrors W2's buyer message prompt (Build Message Payload node) so what the
// client sees in the simulator matches what real leads get. No lead rows, no
// conversations, no Messenger — pure simulation, state lives in the app.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
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

    // KB: campaign-attached + client-shared active sources, full-content injection.
    const { data: kbRows } = await admin
      .from("campaign_knowledge_base")
      .select("title, content, campaign_id, scope, client_id")
      .eq("is_active", true)
      .eq("type", "knowledge")
      .or(`campaign_id.eq.${camp.id},and(scope.eq.client,client_id.eq.${camp.client_id})`);
    const kbText = (kbRows ?? [])
      .map((k) => (k.title ? `## ${k.title}\n` : "") + (k.content ?? ""))
      .join("\n\n")
      .slice(0, 24000);

    // Next qualification question: first enabled field not yet asked this session.
    const cfg = (camp.config ?? {}) as Record<string, unknown>;
    const fields = (cfg.qualification_fields ?? []) as { field: string; label: string; enabled: boolean; question?: string }[];
    const enabled = fields.filter((f) => f.enabled);
    const next = enabled.find((f) => !asked_fields.includes(f.field)) ?? null;
    const profileComplete = next == null;
    const rules = (camp.campaign_rules ?? {}) as Record<string, unknown>;
    const isFirstContact = (history as unknown[]).length === 0;

    let taskInstruction: string;
    if (profileComplete) {
      taskInstruction =
        "Profile complete. Ask the lead when they are available to schedule a property viewing. Do NOT ask any other questions.";
    } else if (next?.question) {
      taskInstruction = 'Ask the lead this EXACT question verbatim — do not rephrase or translate: "' + next.question + '"';
    } else {
      taskInstruction = 'Ask the lead ONE short natural question in Taglish using "po" about their ' + (next?.label ?? "") + ". Ask NOTHING else.";
    }

    const kbSection = kbText.trim().length > 0
      ? "=== KNOWLEDGE BASE ===\n" + kbText + "\n=== END KNOWLEDGE BASE ==="
      : "[No KB content matched this message]";

    // W2 buyer message prompt, verbatim structure (Build Message Payload node).
    const systemPrompt =
      "You are a real estate assistant named BayMo for a Philippine brokerage. Message the lead via Facebook Messenger like a real person — you are BayMo, the AI assistant of " + clientName + ". Be honest that you are an AI assistant when asked, and offer to connect the lead with the human agent.\n\n" +
      "Language: " + ((rules.language as string) || "Taglish") + "\n" +
      "Tone: " + (camp.tone || "conversational and friendly") + "\n" +
      "Campaign Goal: " + (camp.target_action || "none") +
      (camp.ai_instruction ? "\n\n=== AI INSTRUCTIONS (follow these precisely) ===\n" + camp.ai_instruction + "\n=== END AI INSTRUCTIONS ===" : "") +
      "\n\nAdditional Instructions: " + (camp.additional_instructions || "none") +
      "\n\n" + kbSection +
      "\n\nLead Profile:\n- Name: Test Lead\n- Lead Temperature: warm -> keep rapport warm, move naturally toward next step" +
      "\n\nQualification tracking:\n- Fields already answered by lead (do not ask again): none\n- Fields already asked by BayMo (do not ask again, even if unanswered): " + ((asked_fields as string[]).join(", ") || "none") +
      "\n\nYOUR TASK FOR THIS REPLY — follow these steps in order:\n" +
      "1. Read the lead message carefully. If they asked a question (about price, units, availability, etc.), answer it first — use the Knowledge Base if it has the answer, or give a brief honest response (e.g. \"I'll get you the exact details po\") if you don't have it. Never ignore a lead's question.\n" +
      "2. Then, in the same message: " + taskInstruction +
      "\n\nCRITICAL RULES:\n- 2-3 sentences max total\n- No formal greetings\n- Sound human, warm, natural\n- Use Taglish with \"po\" and \"opo\"\n- Respond ONLY with the message text — nothing else\n- Ask ONLY ONE question per message — EXACTLY the one in step 2 above. You MUST end your reply with that specific qualification question. NEVER substitute a generic closing like \"anything else?\" — those give the lead a natural exit and kill the qualification flow\n- NEVER invent your own questions about features, preferences, or anything not in step 2\n- NEVER state a number, price, monthly amortization, floor/lot area, date, fee, or spec that is not written in the Knowledge Base above or given by the lead themselves. If the lead asks for a detail that is not in the Knowledge Base, say you will confirm it with the team — do NOT guess, estimate, or invent numbers." +
      (isFirstContact
        ? '\n- FIRST REPLY: start your message by introducing yourself, e.g. "Hi po! Ako si BayMo, AI assistant ni ' + clientName + '." - then answer and continue.'
        : "\n- Do NOT introduce yourself again. If the lead asks whether they are talking to a bot or AI, confirm you are BayMo, the AI assistant of " + clientName + ", and offer to connect them with the agent.");

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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
