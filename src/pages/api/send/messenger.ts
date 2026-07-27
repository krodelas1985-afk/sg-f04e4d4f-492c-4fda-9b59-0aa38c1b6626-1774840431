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
    const { message, lead_id } = req.body;

    if (!message || !lead_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // messenger_id and client_id used to be taken from the request body, which
    // let any caller pick the recipient. Both are now derived from the lead,
    // and the lead itself is scoped to the caller's workspace.
    const lead = await requireLeadAccess(caller, lead_id, res);
    if (!lead) return;

    const { data: leadRow } = await caller.admin
      .from("leads")
      .select("messenger_id")
      .eq("id", lead_id)
      .single();

    const messengerId = leadRow?.messenger_id;
    if (!messengerId) {
      return res.status(400).json({ error: "Lead has no Messenger thread" });
    }

    // Send from the client's OWN Page, not a single global token — sending one
    // client's message from another client's Page is a privacy incident. This
    // mirrors the lookup the inbound webhook already does.
    const { data: client } = await caller.admin
      .from("clients")
      .select("fb_page_token")
      .eq("id", lead.client_id)
      .eq("is_active", true)
      .single();

    const pageAccessToken = client?.fb_page_token;
    if (!pageAccessToken) {
      return res
        .status(400)
        .json({ error: "No Facebook Page connected for this client" });
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
          recipient: { id: messengerId },
          message: { text: message },
        }),
      }
    );

    const facebookData = await facebookResponse.json();

    // If Facebook API call was successful, update conversation delivery status
    if (facebookResponse.ok && facebookData.message_id) {
      // Update the most recent outbound conversation for this lead to "sent"
      await caller.admin
        .from("conversations")
        .update({ delivery_status: "sent" })
        .eq("lead_id", lead_id)
        .eq("client_id", lead.client_id)
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
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
