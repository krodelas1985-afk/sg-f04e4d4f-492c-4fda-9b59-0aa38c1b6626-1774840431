import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, TrendingUp, Flame, MessageSquare } from "lucide-react";

interface Client {
  id: string;
  name: string;
  company_name: string;
  is_active: boolean;
}

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  lead_temperature: string;
  source: string;
  created_at: string;
}

interface Conversation {
  id: string;
  lead_id: string;
  message_content: string;
  channel: string;
  direction: string;
  created_at: string;
  leads: { name: string } | null;
}

interface Stats {
  totalLeads: number;
  newToday: number;
  hotLeads: number;
}

export default function AdminClientWorkspacePage() {
  const router = useRouter();
  const clientId = router.query.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<Stats>({ totalLeads: 0, newToday: 0, hotLeads: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.push('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role, client_id')
          .eq('id', user.id)
          .single();

        if (!profile) {
          router.push('/login');
          return;
        }

        // Check if user is baymo_admin
        if (profile?.role !== 'baymo_admin') {
          router.push('/dashboard');
          return;
        }

        fetchWorkspaceData();
      } catch (error) {
        console.error('Error checking auth and fetching data:', error);
      }
    };

    checkAuthAndFetch();
  }, [router.isReady, clientId]);

  const fetchWorkspaceData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) return;

      // Fetch via API route using service role key
      const response = await fetch(`/api/admin/clients/${clientId}/workspace-data`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch workspace data');
      }

      const data = await response.json();
      
      setClient(data.client);
      setLeads(data.leads || []);
      setConversations(data.conversations || []);
      
      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      setStats({
        totalLeads: data.leads?.length || 0,
        newToday: data.leads?.filter((l: Lead) => l.created_at.startsWith(today)).length || 0,
        hotLeads: data.leads?.filter((l: Lead) => l.lead_temperature === 'Hot').length || 0,
      });
    } catch (error) {
      console.error('Error fetching workspace data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">Loading client workspace...</div>
      </DashboardLayout>
    );
  }

  if (!client) {
    return (
      <DashboardLayout>
        <div className="p-8">Client not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/admin/clients')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Clients
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-[#1B3A5C]">
                {client.company_name || client.name}
              </h1>
              <p className="text-gray-500 mt-1">{client.name}</p>
            </div>
          </div>
          <Badge className={client.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
            {client.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-6">
          <Card className="p-6 border shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Leads</p>
                <p className="text-2xl font-bold text-[#1B3A5C]">{stats.totalLeads}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 border shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">New Today</p>
                <p className="text-2xl font-bold text-[#1B3A5C]">{stats.newToday}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 border shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-50 rounded-lg">
                <Flame className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Hot Leads</p>
                <p className="text-2xl font-bold text-[#1B3A5C]">{stats.hotLeads}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Leads List */}
        <Card className="border shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-[#1B3A5C]">Leads</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Temperature
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      No leads found for this client
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{lead.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {lead.email || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {lead.phone || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className="bg-blue-100 text-blue-800">
                          {lead.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          className={
                            lead.lead_temperature === 'Hot'
                              ? 'bg-red-100 text-red-800'
                              : lead.lead_temperature === 'Warm'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-blue-100 text-blue-800'
                          }
                        >
                          {lead.lead_temperature}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {lead.source || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Recent Conversations */}
        <Card className="border shadow-sm">
          <div className="p-6 border-b">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#E87722]" />
              <h2 className="text-xl font-semibold text-[#1B3A5C]">Recent Conversations</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lead
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Channel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Direction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Message Preview
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {conversations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No conversations found for this client
                    </td>
                  </tr>
                ) : (
                  conversations.slice(0, 10).map((conv) => (
                    <tr key={conv.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {conv.leads?.name || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className="bg-purple-100 text-purple-800">
                          {conv.channel}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          className={
                            conv.direction === 'outbound'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }
                        >
                          {conv.direction}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 max-w-md truncate text-sm text-gray-500">
                        {conv.message_content.substring(0, 80)}
                        {conv.message_content.length > 80 ? '...' : ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(conv.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}