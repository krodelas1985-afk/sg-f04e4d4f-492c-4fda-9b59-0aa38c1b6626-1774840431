import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GOALS = ['invite_viewing','invite_open_house','send_info','ask_qualifying_question','other'];
const LANGS = ['english','taglish','filipino'];
const CHANNELS = ['email','messenger','sms'];

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return j({ error: 'POST only' }, 405);

  let payload: any;
  try { payload = await req.json(); } catch { return j({ error: 'Invalid JSON body' }, 400); }

  const { client_id, channel = 'messenger', goal, topic, agent_notes, language = 'english', use_kb = false } = payload ?? {};

  if (!client_id) return j({ error: 'client_id is required' }, 400);
  if (!CHANNELS.includes(channel)) return j({ error: `channel must be one of ${CHANNELS.join(', ')}` }, 400);
  if (!GOALS.includes(goal)) return j({ error: `goal must be one of ${GOALS.join(', ')}` }, 400);
  if (goal === 'send_info' && !topic) return j({ error: 'topic is required when goal is send_info' }, 400);
  if (!LANGS.includes(language)) return j({ error: `language must be one of ${LANGS.join(', ')}` }, 400);
  if (!agent_notes && goal === 'other') return j({ error: 'agent_notes is required when goal is other' }, 400);

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) return j({ error: 'OPENAI_API_KEY secret is not set on this function' }, 500);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Sender name only — never company_name (dirty data, deliberately excluded)
  const { data: client, error: cErr } = await supabase
    .from('clients').select('name').eq('id', client_id).single();
  if (cErr) return j({ error: `client lookup failed: ${cErr.message}` }, 400);
  const agent_name = client?.name ?? '';

  // KB is OPTIONAL. Only read when the agent opts in.
  let kb_content = '';
  let kb_present = false;
  if (use_kb) {
    const { data: kb } = await supabase
      .from('campaign_knowledge_base')
      .select('content')
      .eq('client_id', client_id)
      .eq('is_active', true)
      .eq('review_status', 'approved')
      .not('content', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (kb && kb.length && (kb[0].content ?? '').trim() !== '') {
      kb_content = kb[0].content;
      kb_present = true;
    }
  }

  const system = `You draft ONE real-estate follow-up message for a BaMo agent in the Philippines.
You never invent facts. You return JSON only — no markdown, no preamble.

INPUTS GIVEN TO YOU
- channel: ${channel}
- sending agent name: ${agent_name || '(unknown)'}
- goal: ${goal}
- topic: ${topic ?? '(none)'}
- agent_notes (facts the AGENT typed for THIS message): ${agent_notes ?? '(none)'}
- language: ${language}
- KB fact sheet provided: ${kb_present ? 'YES' : 'NO'}

FACT RULES — the core constraint
1. AGENT-TYPED facts (from agent_notes) are written as LITERAL text, verbatim. They are event/campaign-specific (e.g. "open house June 27-28", "limited slots"). The agent owns them.
2. KB facts (from the fact sheet below, if provided) may be used as LITERAL values in this version. Use the KB's exact wording for project name, prices, dates, and certification language. For solar/EDGE, never upgrade wording (e.g. do not turn "solar-ready" into "installed"; keep "EDGE-guided" as written).
3. If you need a fact that is NOT in agent_notes and NOT in the KB fact sheet, you do NOT state it. Do not approximate, guess, or recall a number from memory. Omit it, and list it in "missing".
4. The ONLY placeholder token you may emit is {lead_name} — the lead's first name, which the sender substitutes at send time. Use single braces exactly: {lead_name}. Do NOT use double braces, and do NOT invent any other {token}.
5. The sending agent's name is "${agent_name}". When the message needs a sign-off or a self-reference (e.g. an email), write this name as LITERAL text — never as a token. If the agent name is empty/unknown, omit the sign-off name rather than inventing one.
6. Never output a company/business entity name. Refer to the property by its PROJECT name from the KB fact sheet only.

CHANNEL FORMAT — shape the message for the delivery channel "${channel}"
- messenger: short and conversational, 1–3 sentences. Friendly tone; a single light emoji is acceptable. No subject line, no formal sign-off.
- email: more structured. Open with a short greeting line, then 1–2 concise paragraphs, then a courteous sign-off using the agent's name written literally. Professional but warm. Do NOT output a "Subject:" line — return the email body only.
- sms: very short, under 320 characters, plain text. One clear call to action. No emoji, no greeting block, no markdown, and no links unless present in agent_notes.

GOAL SHAPES THE MESSAGE
- invite_viewing: warm opener, one concrete reason to view (from KB if present), clear ask for a slot.
- invite_open_house: lead with the agent's event details (agent_notes), then one hook, then an RSVP ask.
- send_info: answer ONLY the topic "${topic}" using available facts; no upsell padding.
- ask_qualifying_question: brief context then EXACTLY ONE qualifying question. Never stack two.
- other: follow agent_notes intent; all fact rules still apply.

LANGUAGE
- english: clear professional English.
- taglish: natural Filipino-English mix (conversational, not formal Tagalog).
- filipino: natural Tagalog.

OUTPUT JSON SHAPE (return exactly this, no extra keys):
{
  "title": "<short internal label for this template, <=60 chars>",
  "body": "<the message, with {lead_name} where appropriate>",
  "placeholders_used": ["{lead_name}"],
  "used_kb": ${kb_present},
  "missing": ["<essential fact you needed but was not available>"]
}`;

  const userMsg = kb_present
    ? `KB FACT SHEET (authoritative, use verbatim):\n\n${kb_content}`
    : `No KB fact sheet was provided. Build the message from agent_notes and the goal only. Do not state any price, date, availability, or project fact that is not in agent_notes; list any essential gap in "missing".`;

  let aiJson: any;
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [ { role: 'system', content: system }, { role: 'user', content: userMsg } ],
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      return j({ error: `OpenAI error ${resp.status}`, detail: t.slice(0, 500) }, 502);
    }
    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? '{}';
    aiJson = JSON.parse(raw);
  } catch (e) {
    return j({ error: `generation failed: ${String(e)}` }, 502);
  }

  // Normalize + enforce server-side truth for the flags the resolver will trust
  const out = {
    title: typeof aiJson.title === 'string' ? aiJson.title.slice(0, 60) : `${goal} template`,
    body: typeof aiJson.body === 'string' ? aiJson.body : '',
    category: goal,
    channel,
    topic: topic ?? null,
    language,
    placeholders_used: Array.isArray(aiJson.placeholders_used) ? aiJson.placeholders_used : [],
    used_kb: kb_present,
    missing: Array.isArray(aiJson.missing) ? aiJson.missing : [],
  };

  return j(out);
});
