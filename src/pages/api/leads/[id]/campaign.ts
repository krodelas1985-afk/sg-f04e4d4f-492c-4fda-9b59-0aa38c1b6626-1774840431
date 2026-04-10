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

    // STEP 2 — Stop any existing active or paused 
    // campaign state for this lead.
    // Manual override always wins.
    await supabase
      .from('lead_campaign_states')
      .update({
        state: 'stopped',
        paused_reason: 'Manual campaign override by agent',
        updated_at: new Date().toISOString(),
      })
      .eq('lead_id', leadId)
      .in('state', ['active', 'paused']);

    // STEP 3 — Update leads.campaign_id
    await supabase
      .from('leads')
      .update({ campaign_id: campaign_id })
      .eq('id', leadId);

    // STEP 4 — If new campaign selected, enroll in it
    if (campaign_id) {
      const { data: firstStep } = await supabase
        .from('campaign_steps')
        .select('id, delay_hours')
        .eq('campaign_id', campaign_id)
        .eq('step_order', 1)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (firstStep) {
        const nextStepAt = new Date();
        nextStepAt.setHours(
          nextStepAt.getHours() + (firstStep.delay_hours || 0)
        );

        await supabase.from('lead_campaign_states').insert({
          lead_id: leadId,
          campaign_id: campaign_id,
          client_id: lead.client_id,
          state: 'active',
          current_step: 1,
          enrolled_at: new Date().toISOString(),
          next_step_at: nextStepAt.toISOString(),
          metadata: {},
        });
      }
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error updating campaign:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}