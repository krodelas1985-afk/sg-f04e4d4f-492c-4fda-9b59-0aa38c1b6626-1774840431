import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser, requireLeadAccess } from '@/lib/apiAuth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const caller = await requireUser(req, res);
  if (!caller) return;

  const leadId = req.query.id as string;
  const { automation_enabled } = req.body;

  if (typeof automation_enabled !== 'boolean') {
    return res.status(400).json({ error: 'automation_enabled must be a boolean' });
  }

  const lead = await requireLeadAccess(caller, leadId, res);
  if (!lead) return;

  // Agent takeover. Mark the source 'manual' so auto-enrollment respects this
  // explicit choice (enroll_lead skips leads that are manual + automation off).
  // Turning automation OFF fires trg_leads_automation_off_unenroll, which stops
  // ALL of the lead's active/paused campaign states and clears campaign_id —
  // i.e. the lead is kicked out of every campaign. Re-enabling does NOT auto
  // re-enroll; the lead must re-qualify via a new inbound or be assigned manually.
  const { error: leadError } = await caller.admin
    .from('leads')
    .update({ automation_enabled, automation_source: 'manual' })
    .eq('id', leadId);

  if (leadError) {
    return res.status(500).json({ error: leadError.message });
  }

  return res.status(200).json({ success: true });
}
