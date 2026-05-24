import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const clientId = req.query.id as string;

  // Verify baymo_admin
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'baymo_admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Fetch client
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, company_name')
    .eq('id', clientId)
    .single();

  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }

  // Fetch leads
  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, status, lead_temperature, source, created_at, campaigns(name)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(50);

  // Fetch campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, channel, target_action, is_active, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  // Fetch conversations
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, lead_id, channel, direction, message_content, sender, created_at, leads(name, lead_temperature)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(50);

  return res.status(200).json({
    client,
    stats: {
      totalLeads: leads?.length || 0,
      hotLeads: leads?.filter(l => l.lead_temperature === 'Hot').length || 0,
      activeCampaigns: campaigns?.filter(c => c.status === 'active').length || 0,
      totalConversations: conversations?.length || 0,
    },
    leads: leads || [],
    campaigns: campaigns || [],
    conversations: conversations || [],
  });
}