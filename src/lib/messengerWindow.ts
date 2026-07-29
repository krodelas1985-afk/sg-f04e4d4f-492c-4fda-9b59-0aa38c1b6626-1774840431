/**
 * Facebook's 24-hour standard messaging window.
 *
 * Meta only delivers a Page->user message inside 24 hours of the user's OWN
 * last message. Our Send API call carries no `messaging_type`/`tag`, so Meta
 * treats it as `RESPONSE` and rejects anything later with error #10
 * ("This message is sent outside of allowed window") — it makes no difference
 * that a human agent typed it. Escaping that would need the HUMAN_AGENT tag,
 * which requires a Meta permission we don't hold yet.
 *
 * The clock is read from `leads.last_inbound_at`, which the
 * `conversations_update_lead_last_message` trigger maintains with GREATEST()
 * on every inbound insert. That column — not a scan of the loaded thread — is
 * the source of truth: it covers the lead's very first message, it re-opens
 * when a lead replies to a sequence, and it stays correct even when the UI has
 * only fetched part of the conversation.
 */

export const MESSENGER_WINDOW_HOURS = 24;

const MS_PER_HOUR = 60 * 60 * 1000;

export type MessengerWindowState =
  /** Not a Messenger thread — no window applies, send normally. */
  | "not_messenger"
  /** The lead has never messaged us, so a window was never opened. */
  | "never_opened"
  /** Inside 24h of the lead's last message — we can send. */
  | "open"
  /** Past 24h — Facebook will refuse to deliver. */
  | "expired";

export interface MessengerWindow {
  state: MessengerWindowState;
  /** True only when a Messenger message can actually be delivered right now. */
  canSend: boolean;
  lastInboundAt: Date | null;
  /** Whole hours left before the window shuts; 0 unless state is "open". */
  hoursLeft: number;
  /** Whole hours since the window shut; 0 unless state is "expired". */
  hoursExpired: number;
}

interface WindowLead {
  messenger_id?: string | null;
  last_inbound_at?: string | null;
}

export function getMessengerWindow(
  lead: WindowLead | null | undefined,
  now: Date = new Date()
): MessengerWindow {
  const base: MessengerWindow = {
    state: "not_messenger",
    canSend: true,
    lastInboundAt: null,
    hoursLeft: 0,
    hoursExpired: 0,
  };

  if (!lead?.messenger_id) return base;

  if (!lead.last_inbound_at) {
    // A Messenger lead that has never written to us. Meta has no window to
    // measure from, so a send would fail the same way an expired one does.
    return { ...base, state: "never_opened", canSend: false };
  }

  const lastInboundAt = new Date(lead.last_inbound_at);
  if (Number.isNaN(lastInboundAt.getTime())) return base;

  const elapsedHours = (now.getTime() - lastInboundAt.getTime()) / MS_PER_HOUR;

  if (elapsedHours >= MESSENGER_WINDOW_HOURS) {
    return {
      ...base,
      state: "expired",
      canSend: false,
      lastInboundAt,
      hoursExpired: Math.floor(elapsedHours - MESSENGER_WINDOW_HOURS),
    };
  }

  return {
    ...base,
    state: "open",
    canSend: true,
    lastInboundAt,
    // Round down so we never over-promise the time an agent has left.
    hoursLeft: Math.floor(MESSENGER_WINDOW_HOURS - elapsedHours),
  };
}

/** Short countdown for the composer, e.g. "18h left to reply". */
export function windowCountdownLabel(w: MessengerWindow): string | null {
  if (w.state !== "open") return null;
  if (w.hoursLeft < 1) return "Less than 1h left to reply";
  if (w.hoursLeft === 1) return "1h left to reply";
  return `${w.hoursLeft}h left to reply`;
}

/**
 * The lead's Messenger thread inside the client's Facebook Page inbox (Meta
 * Business Suite). A bare m.me/<PSID> link does NOT work — PSIDs aren't
 * personal profiles — so we route through the Page inbox. Mirrors
 * `messengerInboxUrl` in the mobile app so both surfaces open the same place.
 * The signed-in agent needs a "Messages" role on that Page for it to load.
 */
export function messengerInboxUrl(
  fbPageId: string | null | undefined,
  messengerId: string | null | undefined
): string | null {
  if (!fbPageId || !messengerId) return null;
  return (
    `https://business.facebook.com/latest/inbox/all/?asset_id=${fbPageId}` +
    `&selected_item_id=${messengerId}&thread_type=FB_MESSAGE`
  );
}
