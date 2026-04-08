import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messenger_id, message, lead_id, client_id } = req.body;

    if (!messenger_id || !message || !lead_id || !client_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    if (!pageAccessToken) {
      return res.status(500).json({ error: "Facebook page access token not configured" });
    }

    // Call Facebook Send API
    const facebookResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: { id: messenger_id },
          message: { text: message },
        }),
      }
    );

    const facebookData = await facebookResponse.json();

    // If Facebook API call was successful, update conversation delivery status
    if (facebookResponse.ok && facebookData.message_id) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Update the most recent outbound conversation for this lead to "sent"
      await supabase
        .from("conversations")
        .update({ delivery_status: "sent" })
        .eq("lead_id", lead_id)
        .eq("client_id", client_id)
        .eq("direction", "outbound")
        .eq("message_content", message)
        .order("created_at", { ascending: false })
        .limit(1);
    }

    // Return the full Facebook API response (including errors)
    return res.status(facebookResponse.status).json(facebookData);
  } catch (error) {
    console.error("Error sending messenger message:", error);
    return res.status(500).json({ 
      error: "Failed to send message",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}