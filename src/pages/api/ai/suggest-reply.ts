import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser, requireLeadAccess } from "@/lib/apiAuth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const caller = await requireUser(req, res);
  if (!caller) return;

  try {
    const { lead_id } = req.body;

    if (!lead_id) {
      return res.status(400).json({ error: "lead_id is required" });
    }

    // Scope check before any lead data is read — this endpoint returns the
    // lead's profile and conversation history and spends AI credits, so it
    // must not be usable to enumerate other workspaces' lead IDs.
    if (!(await requireLeadAccess(caller, lead_id, res))) return;

    const supabase = caller.admin;

    // Get lead profile
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(`
        *,
        campaign:campaigns(
          id,
          name,
          target_action,
          tone,
          additional_instructions,
          config
        )
      `)
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Get lead qualification data
    const { data: leadQual } = await supabase
      .from("lead_qualifications")
      .select("budget_min, budget_max, preferred_location")
      .eq("lead_id", lead_id)
      .maybeSingle();

    // Get last 20 conversations
    const { data: conversations } = await supabase
      .from("conversations")
      .select("*")
      .eq("lead_id", lead_id)
      .order("created_at", { ascending: true })
      .limit(20);

    // Format conversation history
    const conversationHistory = (conversations || [])
      .map((msg) => {
        const sender = msg.direction === "inbound" ? "Lead" : "Agent";
        return `${sender}: ${msg.message_content}`;
      })
      .join("\n");

    // Build system prompt
    let systemPrompt = `You are an expert sales assistant helping convert leads in the Philippines.

Leads may write in: English, Filipino (Tagalog), or Taglish (mix of English and Filipino)

CRITICAL LANGUAGE RULE:
- Detect the language used by the lead in the most recent messages
- Match that language naturally
- If the lead uses Taglish, respond in Taglish
- Never force pure English if the lead is speaking Filipino or Taglish

`;

    let warningNote = null;

    if (lead.campaign) {
      const campaign = Array.isArray(lead.campaign) ? lead.campaign[0] : lead.campaign;
      const config = campaign.config || {};

      systemPrompt += `Campaign Goal: ${campaign.target_action || "Convert lead"}
Target Audience: ${config.target_audience || "General"}
Tone and Persona: ${campaign.tone || "Professional and friendly"}
Qualification Questions (ask only unanswered ones naturally): ${
        config.qualification_questions
          ? JSON.stringify(config.qualification_questions)
          : "None specified"
      }
Additional Instructions: ${campaign.additional_instructions || "None"}
`;
    } else {
      systemPrompt += `No campaign is currently assigned to this lead. Focus on general discovery — be warm and conversational. Ask one open-ended question to understand the lead's property need (budget, location, property type, timeline, or purpose of purchase). Keep it natural and human.

`;
      warningNote = "⚠️ No campaign assigned to this lead. Consider assigning a campaign for better AI suggestions.";
    }

    systemPrompt += `
Lead Profile:
- Name: ${lead.name || "N/A"}
- Budget: ${leadQual?.budget_min || "N/A"} to ${leadQual?.budget_max || "N/A"}
- Location: ${leadQual?.preferred_location?.[0] || "N/A"}
- Status: ${lead.status || "New"}
- Stage: ${lead.lead_temperature || "Cold"}

Conversation History:
${conversationHistory || "No previous messages"}

Task: Generate the single best next reply.

Rules:
- If lead does not meet target audience criteria for this campaign:
  * Do NOT suggest an exit
  * Add a soft note at the top of the suggested reply visible only to the agent (not sent to the lead): "⚠️ This lead may not qualify for this campaign because [reason]. Consider checking other campaigns or properties that may be a better fit."
  * Then still generate a warm, helpful reply that keeps the lead engaged and the conversation open
  * Never dismiss or disengage a lead — every lead has potential
  * Ask one pre-qualifying question to dig deeper into the lead's actual need — uncover what they are truly looking for (budget, location, property type, timeline, purpose of purchase)
- If partially qualified: ask one clarifying question
- If qualified: move toward target action
- 1 to 3 sentences only
- Natural, human, and conversational — not robotic
- Match tone and persona
- DO NOT auto-send

Return ONLY the message text.`;

    let suggestion = "";

    // Try OpenAI first
    try {
      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Generate the next reply for this conversation." },
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
      });

      if (openaiResponse.ok) {
        const openaiData = await openaiResponse.json();
        suggestion = openaiData.choices[0]?.message?.content?.trim() || "";
        console.log("✅ OpenAI suggestion generated");
      } else {
        throw new Error("OpenAI failed, trying Claude");
      }
    } catch (openaiError) {
      console.error("OpenAI error, falling back to Claude:", openaiError);

      // Fallback to Claude
      try {
        const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY || "",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-sonnet-20240229",
            max_tokens: 200,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: "Generate the next reply for this conversation.",
              },
            ],
          }),
        });

        if (claudeResponse.ok) {
          const claudeData = await claudeResponse.json();
          suggestion = claudeData.content[0]?.text?.trim() || "";
          console.log("✅ Claude suggestion generated (fallback)");
        } else {
          throw new Error("Claude also failed");
        }
      } catch (claudeError) {
        console.error("Both OpenAI and Claude failed:", claudeError);
        return res.status(500).json({ error: "AI suggestion failed. Please try again." });
      }
    }

    if (!suggestion) {
      return res.status(500).json({ error: "Failed to generate suggestion" });
    }

    return res.status(200).json({
      suggestion,
      warning: warningNote,
    });
  } catch (error) {
    console.error("Error generating AI reply:", error);
    return res.status(500).json({ error: "Failed to generate suggestion" });
  }
}