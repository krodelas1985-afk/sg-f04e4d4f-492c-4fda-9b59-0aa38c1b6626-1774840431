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
  const { campaign_id } = req.body;

  try {
    // STEP 1 — Get lead's client_id
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, client_id, campaign_id')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // A campaign was chosen — enroll via the single authority (manual always
    // wins: rules + opt-out guard are bypassed, AI is enabled, automation_source
    // is marked 'manual'). It also stops any other active/paused states.
    if (campaign_id) {
      const { data: result, error: rpcError } = await supabase.rpc('enroll_lead', {
        p_lead_id: leadId,
        p_is_new: false,
        p_campaign_id: campaign_id,
        p_force: true,
      });

      if (rpcError) {
        console.error('enroll_lead (manual) failed:', rpcError);
        return res.status(500).json({ error: 'Failed to enroll lead' });
      }

      return res.status(200).json({ success: true, result });
    }

    // No campaign selected — unenroll. Turning automation off fires
    // trg_leads_automation_off_unenroll (stops all states, clears campaign_id);
    // we also clear explicitly in case automation was already off.
    await supabase
      .from('leads')
      .update({ automation_enabled: false, automation_source: 'manual', campaign_id: null })
      .eq('id', leadId);

    await supabase
      .from('lead_campaign_states')
      .update({
        state: 'stopped',
        paused_reason: 'Manual unenroll by agent',
        updated_at: new Date().toISOString(),
      })
      .eq('lead_id', leadId)
      .in('state', ['active', 'paused']);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error updating campaign:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}