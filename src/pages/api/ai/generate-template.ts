import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@/lib/supabase/server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      campaign_id,
      template_goal,
      channel,
      tone,
      language,
      additional_instructions,
    } = req.body;

    if (!template_goal || !channel || !tone || !language) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const supabase = createServerClient();

    // Build system prompt
    let systemPrompt = `You are an expert real estate sales copywriter in the Philippines. You create high-converting message templates for property agents.

Language Rules:
- If language = Auto-detect → default to Taglish (natural mix of English and Filipino)
- If Filipino → write in conversational Filipino
- If English → write in clear, natural English
- If Taglish → mix naturally (do NOT force translation)

`;

    // Add campaign context if provided
    if (campaign_id) {
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("name, target_action, config")
        .eq("id", campaign_id)
        .single();

      if (campaign) {
        const config = campaign.config || {};
        systemPrompt += `Campaign Context:
- Campaign Name: ${campaign.name}
- Campaign Goal: ${campaign.target_action || "Convert lead"}
- Target Audience: ${config.target_audience || "General"}

`;
      }
    }

    systemPrompt += `Template Goal: ${template_goal}
Channel: ${channel}
Tone: ${tone}
Additional Instructions: ${additional_instructions || "None"}

Task: Generate a reusable message template.

Requirements:
- Include placeholders: {lead_name} {lead_property_type} {company_name}
- Keep it concise and natural
- Match the tone exactly
- Make it feel human and conversational
- Optimized for conversion (reply or action)

Channel Rules:
- Email → slightly more structured
- Messenger → casual and conversational
- SMS → very short and direct

Variable fallback rules:
- If {lead_name} is missing → use "there"
- If {lead_property_type} is missing → use "property"
- If {company_name} is missing → use "our company"

Output: Return ONLY valid JSON — no preamble, no markdown backticks, no extra text:
{ "title": "short template title", "body": "template message with variables" }`;

    let generatedTemplate = null;

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
            { role: "user", content: "Generate the template now." },
          ],
          temperature: 0.8,
          max_tokens: 300,
        }),
      });

      if (openaiResponse.ok) {
        const openaiData = await openaiResponse.json();
        const content = openaiData.choices[0]?.message?.content?.trim() || "";
        
        // Try to parse JSON
        try {
          generatedTemplate = JSON.parse(content);
          console.log("✅ OpenAI template generated");
        } catch (parseError) {
          console.error("Failed to parse OpenAI JSON:", content);
          throw new Error("Invalid JSON from OpenAI");
        }
      } else {
        throw new Error("OpenAI failed");
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
            max_tokens: 300,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: "Generate the template now.",
              },
            ],
          }),
        });

        if (claudeResponse.ok) {
          const claudeData = await claudeResponse.json();
          const content = claudeData.content[0]?.text?.trim() || "";
          
          // Try to parse JSON
          try {
            generatedTemplate = JSON.parse(content);
            console.log("✅ Claude template generated (fallback)");
          } catch (parseError) {
            console.error("Failed to parse Claude JSON:", content);
            throw new Error("Invalid JSON from Claude");
          }
        } else {
          throw new Error("Claude also failed");
        }
      } catch (claudeError) {
        console.error("Both OpenAI and Claude failed:", claudeError);
        return res.status(500).json({ error: "AI template generation failed. Please try again." });
      }
    }

    if (!generatedTemplate || !generatedTemplate.title || !generatedTemplate.body) {
      return res.status(500).json({ error: "Failed to generate valid template" });
    }

    return res.status(200).json(generatedTemplate);
  } catch (error) {
    console.error("Error generating template:", error);
    return res.status(500).json({ error: "Failed to generate template" });
  }
}