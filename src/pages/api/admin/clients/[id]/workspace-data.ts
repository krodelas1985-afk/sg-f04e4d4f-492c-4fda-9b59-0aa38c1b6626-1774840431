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
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const clientId = req.query.id as string;

  // Verify baymo_admin
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
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

  try {
    // Use service role key for baymo_admin to bypass RLS
    // Fetch client info
    const { data: client, error: clientError } = await adminClient
      .from('clients')
      .select('id, name, company_name, is_active')
      .eq('id', clientId)
      .single();

    if (clientError) {
      console.error('Error fetching client:', clientError);
      return res.status(404).json({ error: 'Client not found' });
    }

    // Fetch leads for this client
    const { data: leads, error: leadsError } = await adminClient
      .from('leads')
      .select('id, name, email, phone, status, lead_temperature, source, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
    }

    // Fetch conversations for this client
    const { data: conversations, error: conversationsError } = await adminClient
      .from('conversations')
      .select('id, lead_id, message_content, channel, direction, created_at, leads(name)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (conversationsError) {
      console.error('Error fetching conversations:', conversationsError);
    }

    return res.status(200).json({
      client,
      leads: leads || [],
      conversations: conversations || [],
    });
  } catch (error) {
    console.error('Error in workspace-data API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}