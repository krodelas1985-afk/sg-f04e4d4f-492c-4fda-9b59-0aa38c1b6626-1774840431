import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Minimal shape needed to label who sent a conversation message. */
export type ConversationSenderFields = {
  sender?: string | null;
  direction?: string | null;
  sent_via?: string | null;
};

/**
 * Canonical display label for who sent a conversation message.
 * The BaMo AI responder writes sender='ai' and automated follow-ups write
 * sender='sequence' — both are the BaMo assistant, not the lead. Older UI only
 * checked sender==='system' (which is never written), so every AI message fell
 * through to "Lead".
 */
export function senderLabel(msg: ConversationSenderFields): "Lead" | "Agent" | "BaMo" {
  const sender = (msg.sender ?? "").toLowerCase();
  if (sender === "ai" || sender === "sequence" || sender === "system" || msg.sent_via === "baymo") {
    return "BaMo";
  }
  if (sender === "agent") return "Agent";
  if (sender === "lead") return "Lead";
  // Rows with no sender recorded: fall back to message direction.
  return msg.direction === "outbound" ? "Agent" : "Lead";
}

/** Emoji marker to pair with a sender label. */
export function senderIcon(label: "Lead" | "Agent" | "BaMo"): string {
  return label === "BaMo" ? "🤖" : "👤";
}
