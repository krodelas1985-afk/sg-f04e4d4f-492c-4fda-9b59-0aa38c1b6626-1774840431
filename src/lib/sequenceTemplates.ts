// Prebuilt BaMo follow-up playbooks (Phase 3B).
//
// These are ready-to-use starter sequences an agent can instantiate from the
// "New Sequence" dialog. They are designed around the Messenger 24-hour
// standard-messaging window: the in-window playbooks compress their cadence so
// every step lands while the window is open, and quick replies give the lead a
// one-tap way to answer (which reopens the 24h clock).
//
// Conventions (must match the rest of the app):
//  - Message copy uses single-brace {lead_name}; W4 substitutes it at send time.
//  - Quick reply payloads come from the fixed set used in the step editor.
//  - Quick reply titles are <= 20 chars (FB Messenger limit).
//  - Cumulative delay of consecutive messenger steps stays <= 24h so they send
//    inside one window (steps that exceed it will PARK until the lead re-engages).
//
// Instantiation sets the sequence's send window / cooldown / max passes and
// creates the steps. Rules are created DISABLED so the agent can review the
// sequence before it starts auto-enrolling leads.

export type TemplateStepType = "messenger" | "email" | "call";

export interface TemplateQuickReply {
  title: string;
  payload: string;
}

export interface TemplateStep {
  title: string;
  step_type: TemplateStepType;
  message_content: string;
  delay_hours: number;
  quick_replies?: TemplateQuickReply[] | null;
}

export interface TemplateRule {
  rule_name: string;
  source_filter?: string[] | null;
  temperature_filter?: string[] | null;
  quality_filter?: string[] | null;
  pipeline_stage_filter?: string[] | null;
  conversation_stage_filter?: string[] | null;
  inactivity_days?: number | null;
  last_inbound_max_hours?: number | null;
  last_contacted_min_hours?: number | null;
  ai_outbound_min_hours?: number | null;
}

export interface SequenceTemplate {
  key: string;
  name: string;
  description: string;
  send_window_start: string;
  send_window_end: string;
  reenroll_cooldown_days: number;
  max_passes: number;
  steps: TemplateStep[];
  rules: TemplateRule[];
}

export const SEQUENCE_TEMPLATES: SequenceTemplate[] = [
  {
    key: "new_lead_no_reply",
    name: "New Lead — No Reply (in-window blitz)",
    description:
      "A lead messaged once then went quiet. Three light touches inside the first 24-hour Messenger window to restart the conversation before it closes.",
    send_window_start: "08:00",
    send_window_end: "20:00",
    reenroll_cooldown_days: 14,
    max_passes: 2,
    steps: [
      {
        title: "1h — value nudge",
        step_type: "messenger",
        message_content:
          "Hi {lead_name}! 👋 Just following up on your inquiry. I'd love to help you find the right property — are you looking to buy soon, or still exploring your options?",
        delay_hours: 1,
        quick_replies: [
          { title: "Buying soon", payload: "READY_NOW" },
          { title: "Just exploring", payload: "JUST_LOOKING" },
          { title: "Send me details", payload: "NEED_MORE_INFO" },
        ],
      },
      {
        title: "5h — listing highlight",
        step_type: "messenger",
        message_content:
          "{lead_name}, we have some great options that might fit what you're after. Want me to send over a few listings with prices and payment terms?",
        delay_hours: 5,
        quick_replies: [
          { title: "Yes, send listings", payload: "SEND_PRICE_LIST" },
          { title: "What's the price?", payload: "SEND_PRICE_LIST" },
          { title: "Maybe later", payload: "FOLLOW_UP_LATER" },
        ],
      },
      {
        title: "20h — last check-in",
        step_type: "messenger",
        message_content:
          "Hi {lead_name}, I don't want to keep bothering you 😊 Just let me know how I can help — I'm here whenever you're ready to take the next step.",
        delay_hours: 14,
        quick_replies: [
          { title: "Book a viewing", payload: "SCHEDULE_VIEWING" },
          { title: "Follow up later", payload: "FOLLOW_UP_LATER" },
          { title: "Not interested", payload: "STOP" },
        ],
      },
    ],
    rules: [
      {
        rule_name: "New/cold Messenger leads, no recent reply",
        source_filter: ["FB Messenger", "Facebook Ads"],
        temperature_filter: ["New", "Cold"],
        last_inbound_max_hours: 24,
        last_contacted_min_hours: 2,
      },
    ],
  },
  {
    key: "went_silent_midconvo",
    name: "Went Silent Mid-Conversation",
    description:
      "The lead was actively chatting then stalled. Two touches inside the window: a gentle nudge, then a recap with a clear next step.",
    send_window_start: "08:00",
    send_window_end: "20:00",
    reenroll_cooldown_days: 10,
    max_passes: 2,
    steps: [
      {
        title: "2h — gentle nudge",
        step_type: "messenger",
        message_content:
          "Hi {lead_name}, still thinking it over? Happy to answer any questions — financing, location, monthly amortization, whatever's on your mind. 🙂",
        delay_hours: 2,
        quick_replies: [
          { title: "Financing options", payload: "PAG_IBIG" },
          { title: "Send location", payload: "SEND_LOCATION" },
          { title: "I have questions", payload: "NEED_MORE_INFO" },
        ],
      },
      {
        title: "20h — recap + CTA",
        step_type: "messenger",
        message_content:
          "{lead_name}, whenever you're ready I can set up a quick viewing or a short call so we can match you to the best unit. Which works better for you?",
        delay_hours: 18,
        quick_replies: [
          { title: "Schedule viewing", payload: "SCHEDULE_VIEWING" },
          { title: "Schedule a call", payload: "SCHEDULE_CALL" },
          { title: "Follow up later", payload: "FOLLOW_UP_LATER" },
        ],
      },
    ],
    rules: [
      {
        rule_name: "Warm/interested leads that stalled",
        temperature_filter: ["Warm"],
        quality_filter: ["Interested", "Motivated"],
        last_inbound_max_hours: 24,
        last_contacted_min_hours: 2,
      },
    ],
  },
  {
    key: "long_term_nurture",
    name: "Long-Term Nurture (re-engagement)",
    description:
      "Spaced touches for cold/idle leads. NOTE: steps beyond the first fall outside the 24h Messenger window, so they PARK until the lead messages again (or, later, until recurring-notification opt-in is enabled). Best paired with the fallback task for unreachable leads.",
    send_window_start: "09:00",
    send_window_end: "19:00",
    reenroll_cooldown_days: 30,
    max_passes: 3,
    steps: [
      {
        title: "Re-open — friendly check-in",
        step_type: "messenger",
        message_content:
          "Hi {lead_name}! 👋 It's been a while. The market's moved and there are new listings in your range — want me to send a quick update?",
        delay_hours: 1,
        quick_replies: [
          { title: "Yes please", payload: "NEED_MORE_INFO" },
          { title: "Send new listings", payload: "SEND_PRICE_LIST" },
          { title: "Not right now", payload: "FOLLOW_UP_LATER" },
        ],
      },
      {
        title: "Day 3 — market update",
        step_type: "messenger",
        message_content:
          "{lead_name}, prices and promos change fast. If you tell me your budget and preferred area, I'll keep an eye out and message you the moment something great comes up.",
        delay_hours: 72,
        quick_replies: [
          { title: "My budget is…", payload: "NEED_MORE_INFO" },
          { title: "Book a call", payload: "SCHEDULE_CALL" },
          { title: "Stop updates", payload: "STOP" },
        ],
      },
      {
        title: "Day 7 — call fallback",
        step_type: "call",
        message_content:
          "No Messenger reply after re-engagement. Call {lead_name} to check interest and offer new listings.",
        delay_hours: 96,
      },
    ],
    rules: [
      {
        rule_name: "Cold/idle leads, 3+ days silent",
        temperature_filter: ["Cold"],
        inactivity_days: 3,
        last_contacted_min_hours: 24,
      },
    ],
  },
];

export function getSequenceTemplate(key: string): SequenceTemplate | null {
  return SEQUENCE_TEMPLATES.find((t) => t.key === key) || null;
}

// Lightweight catalog for pickers (no message bodies).
export function sequenceTemplateCatalog() {
  return SEQUENCE_TEMPLATES.map((t) => ({
    key: t.key,
    name: t.name,
    description: t.description,
    step_count: t.steps.length,
  }));
}
