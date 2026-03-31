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
    const { lead_id } = req.body;

    if (!lead_id) {
      return res.status(400).json({ error: "lead_id is required" });
    }

    const supabase = createServerClient();

    // Get conversation history
    const { data: conversations } = await supabase
      .from("conversations")
      .select("*")
      .eq("lead_id", lead_id)
      .order("created_at", { ascending: true });

    // TODO: In production, call OpenAI API here with conversation history
    // For now, return a mock suggestion
    const mockSuggestions = [
      "Thank you for your inquiry! I'd be happy to help you find the perfect property. Could you share more details about your preferred location and budget range?",
      "Hi there! Thanks for reaching out. Based on our conversation, I have a few properties that might interest you. Would you like to schedule a viewing?",
      "Great to hear from you! I wanted to follow up on our previous discussion. Are you still looking for properties in the [location] area?",
      "Hello! I hope this message finds you well. I have some new listings that match your criteria. Would you like me to send you the details?",
    ];

    const suggestion = mockSuggestions[Math.floor(Math.random() * mockSuggestions.length)];

    return res.status(200).json({ suggestion });
  } catch (error) {
    console.error("Error in AI suggest reply:", error);
    return res.status(500).json({ error: "Failed to generate suggestion" });
  }
}