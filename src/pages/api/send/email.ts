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
    const { lead_id, message, subject, attachment } = req.body;

    if (!lead_id || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const supabase = createServerClient();

    // Get current user from session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const currentUserId = session.user.id;

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("email, name, client_id")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    if (!lead.email) {
      return res.status(400).json({ error: "Lead has no email address" });
    }

    // Get client info
    const { data: client } = await supabase
      .from("clients")
      .select("name")
      .eq("id", lead.client_id)
      .single();

    // Prepare email data
    const emailData: any = {
      from: `${client?.name || "BayMo"} <noreply@baymo.io>`,
      to: lead.email,
      subject: subject || `Message from ${client?.name || "BayMo"}`,
      html: message.replace(/\n/g, "<br>"),
    };

    // Add attachment if present
    if (attachment?.url) {
      emailData.attachments = [
        {
          filename: attachment.url.split("/").pop(),
          path: attachment.url,
        },
      ];
    }

    // Send via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailData),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend API error:", errorText);
      throw new Error("Failed to send email via Resend");
    }

    const emailResult = await emailResponse.json();

    // Save to conversations
    await supabase.from("conversations").insert({
      lead_id,
      client_id: lead.client_id,
      message_content: message,
      channel: "email",
      direction: "outbound",
      sent_via: "resend",
      delivery_status: "sent",
      sender_id: currentUserId,
      external_msg_id: emailResult.id,
      attachment_url: attachment?.url,
      attachment_type: attachment?.type,
    });

    // Update lead's last_message_at
    await supabase
      .from("leads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", lead_id);

    return res.status(200).json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (error: any) {
    console.error("Error sending email:", error);
    return res.status(500).json({ error: error.message || "Failed to send email" });
  }
}