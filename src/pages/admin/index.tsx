import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Users as LeadsIcon, Megaphone } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Stats {
  totalClients: number;
  activeClients: number;
  totalLeads: number;
  totalCampaigns: number;
  activeCampaigns?: number;
}

interface WebhookLog {
  id: string;
  source: string;
  status: string;
  received_at: string;
  error_message?: string;
  client_id?: string;
  clients?: {
    name: string;
  };
}

interface Client {
  id: string;
  name: string;
  company_name: string;
  is_active: boolean;
}

interface Campaign {
  id: string;
  name: string;
  client_id: string;
  channel: string;
  status: string;
  target_action: string;
  created_at: string;
  clients?: {
    name: string;
  };
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    activeClients: 0,
    totalLeads: 0,
    totalCampaigns: 0,
  });
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [formData, setFormData] = useState({
    client_id: "",
    name: "",
    channel: "messenger",
    status: "draft",
    target_action: "",
    tone: "",
    additional_instructions: "",
  });

  useEffect(() => {
    fetchStats();
    fetchWebhookLogs();
    fetchClients();
    fetchCampaigns();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWebhookLogs = async () => {
    try {
      const res = await fetch("/api/admin/webhook-logs");
      if (res.ok) {
        const data = await res.json();
        setWebhookLogs(data);
      }
    } catch (error) {
      console.error("Error fetching webhook logs:", error);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/admin/clients");
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await fetch("/api/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setCampaignsLoading(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError("");

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setFormData({
          client_id: "",
          name: "",
          channel: "messenger",
          status: "draft",
          target_action: "",
          tone: "",
          additional_instructions: "",
        });
        fetchCampaigns();
      } else {
        const error = await res.json();
        setCreateError(error.error || "Failed to create campaign");
      }
    } catch (error) {
      setCreateError("Failed to create campaign");
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-foreground">Admin Overview</h1>
          <p className="text-muted-foreground">Monitor system-wide activity and client usage.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Clients</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : stats?.totalClients || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
              <LeadsIcon className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : stats?.totalLeads || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Campaigns</CardTitle>
              <Megaphone className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : stats?.activeCampaigns || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Webhook Logs Table */}
        <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Recent Webhook Activity</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Received At</th>
                  <th className="px-6 py-3 font-medium">Client</th>
                  <th className="px-6 py-3 font-medium">Source</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Error Message</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : webhookLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                      No recent webhook logs
                    </td>
                  </tr>
                ) : (
                  webhookLogs.map((log) => (
                    <tr key={log.id} className="bg-card hover:bg-muted/50">
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                        {new Date(log.received_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/admin/clients/${log.client_id}`} className="font-medium hover:underline text-primary">
                          {log.clients?.name || "Unknown"}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border">
                          {log.source}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            log.status === "success"
                              ? "bg-green-100 text-green-800 border-green-200"
                              : "bg-red-100 text-red-800 border-red-200"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs truncate max-w-xs">
                        {log.error_message || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Campaigns</CardTitle>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-[#E87722] text-white rounded-md hover:bg-[#d66a1a] transition-colors text-sm font-medium"
              >
                + Create Campaign
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {campaignsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading campaigns...</div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No campaigns yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Action</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {campaigns.map((campaign) => (
                      <tr key={campaign.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {campaign.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {campaign.clients?.name || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {campaign.channel}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge
                            variant={
                              campaign.status === "active"
                                ? "default"
                                : campaign.status === "paused"
                                ? "secondary"
                                : "outline"
                            }
                            className={
                              campaign.status === "active"
                                ? "bg-green-100 text-green-800 hover:bg-green-100"
                                : campaign.status === "paused"
                                ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                                : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                            }
                          >
                            {campaign.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {campaign.target_action || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(campaign.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <h2 className="text-2xl font-bold text-[#1B3A5C]">Create Campaign</h2>
              </div>
              
              <form onSubmit={handleCreateCampaign} className="p-6 space-y-6">
                {createError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
                    {createError}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Client <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  >
                    <option value="">Select a client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Campaign Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    placeholder="Enter campaign name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Channel</label>
                    <select
                      value={formData.channel}
                      onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    >
                      <option value="messenger">messenger</option>
                      <option value="email">email</option>
                      <option value="sms">sms</option>
                      <option value="all">all</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    >
                      <option value="draft">draft</option>
                      <option value="active">active</option>
                      <option value="paused">paused</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Target Action</label>
                  <textarea
                    value={formData.target_action}
                    onChange={(e) => setFormData({ ...formData, target_action: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    placeholder="What should the lead do? e.g. Schedule a property viewing"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Tone</label>
                  <input
                    type="text"
                    value={formData.tone}
                    onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    placeholder="e.g. Friendly, Professional"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Additional Instructions</label>
                  <textarea
                    value={formData.additional_instructions}
                    onChange={(e) => setFormData({ ...formData, additional_instructions: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    placeholder="Rules, things to avoid, special scenarios"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setCreateError("");
                      setFormData({
                        client_id: "",
                        name: "",
                        channel: "messenger",
                        status: "draft",
                        target_action: "",
                        tone: "",
                        additional_instructions: "",
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !formData.name || !formData.client_id}
                    className="px-4 py-2 bg-[#E87722] text-white rounded-md hover:bg-[#d66a1a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating ? "Creating..." : "Create Campaign"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}