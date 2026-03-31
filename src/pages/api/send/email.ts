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
    const { email, message, lead_id } = req.body;

    if (!email || !message || !lead_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const supabase = createServerClient();

    // Get lead details
    const { data: lead } = await supabase
      .from("leads")
      .select("client_id")
      .eq("id", lead_id)
      .single();

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Send email via Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "BayMo <noreply@baymo.io>",
        to: email,
        subject: "Message from your BayMo agent",
        html: `<p>${message.replace(/\n/g, "<br>")}</p>`,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(resendData.message || "Failed to send email");
    }

    // Save to conversations
    await supabase.from("conversations").insert({
      lead_id,
      client_id: lead.client_id,
      channel: "email",
      direction: "outbound",
      sender: "agent",
      sent_via: "resend",
      delivery_status: "sent",
      message_content: message,
      external_msg_id: resendData.id,
    });

    // Update lead last_contacted_at
    await supabase
      .from("leads")
      .update({ last_contacted_at: new Date().toISOString() })
      .eq("id", lead_id);

    return res.status(200).json({ success: true, message_id: resendData.id });
  } catch (error: any) {
    console.error("Error sending email:", error);
    return res.status(500).json({ error: error.message || "Failed to send email" });
  }
}