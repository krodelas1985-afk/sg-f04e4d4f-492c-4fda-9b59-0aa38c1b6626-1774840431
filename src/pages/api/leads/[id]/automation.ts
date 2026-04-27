import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const leadId = req.query.id as string;
  const { automation_enabled } = req.body;

  if (typeof automation_enabled !== 'boolean') {
    return res.status(400).json({ error: 'automation_enabled must be a boolean' });
  }

  // STEP 1 — Update leads.automation_enabled
  const { error: leadError } = await supabase
    .from('leads')
    .update({ automation_enabled })
    .eq('id', leadId);

  if (leadError) {
    return res.status(500).json({ error: leadError.message });
  }

  // STEP 2 — Update lead_campaign_states
  // OFF → pause the active state for this lead only (never pauses the campaign)
  // ON  → reactivate the paused state, keep current_step and next_step_at intact
  const newState = automation_enabled ? 'active' : 'paused';

  const { error: stateError } = await supabase
    .from('lead_campaign_states')
    .update({ state: newState })
    .eq('lead_id', leadId)
    .in('state', automation_enabled ? ['paused'] : ['active']);

  if (stateError) {
    console.error('Error updating lead_campaign_states:', stateError);
  }

  return res.status(200).json({ success: true });
}