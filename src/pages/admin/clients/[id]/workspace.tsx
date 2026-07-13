import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createBrowserClient } from "@supabase/ssr";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Users, MessageSquare, Zap, TrendingUp,
  Copy, RefreshCw, Eye, EyeOff, UserPlus, Trash2,
  PowerOff, Power,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────── */

interface WorkspaceData {
  client: { id: string; name: string; company_name: string };
  stats: { totalLeads: number; hotLeads: number; activeCampaigns: number; totalConversations: number };
  leads: Array<{
    id: string; name: string; status: string; lead_temperature: string | null;
    source: string | null; created_at: string; campaigns: { name: string } | null;
  }>;
  campaigns: Array<{
    id: string; name: string; status: string; channel: string;
    target_action: string | null; is_active: boolean | null; created_at: string;
  }>;
  conversations: Array<{
    id: string; lead_id: string; channel: string; direction: string;
    message_content: string; sender: string; created_at: string;
    leads: { name: string; lead_temperature: string | null } | null;
  }>;
}

interface ClientDetails {
  id: string; name: string; company_name: string; email: string | null;
  phone: string | null; is_active: boolean | null; webhook_secret: string | null;
  bamo_api_key: string | null; fb_page_token: string | null; fb_page_id: string | null;
  settings: Record<string, string> | null;
}

interface AssignedUser {
  id: string; email: string | null; full_name: string | null;
  role: string | null; is_active: boolean | null;
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function AdminClientWorkspacePage() {
  const router = useRouter();
  const clientId = router.query.id as string;
  const { toast } = useToast();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [data, setData] = useState<WorkspaceData | null>(null);
  const [clientDetails, setClientDetails] = useState<ClientDetails | null>(null);
  const [users, setUsers] = useState<AssignedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string>("");

  // Settings tab state
  const [fbToken, setFbToken] = useState("");
  const [fbPageId, setFbPageId] = useState("");
  const [bamoKey, setBamoKey] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Create login form
  const [newEmail, setNewEmail] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Activate/deactivate
  const [isTogglingActive, setIsTogglingActive] = useState(false);

  // Sub-tab filters
  const [campFilterStatus, setCampFilterStatus] = useState("all");
  const [campFilterChannel, setCampFilterChannel] = useState("all");
  const [campFilterActive, setCampFilterActive] = useState("all");

  const [leadFilterStatus, setLeadFilterStatus] = useState("all");
  const [leadFilterStage, setLeadFilterStage] = useState("all");
  const [leadFilterSource, setLeadFilterSource] = useState("all");
  const [leadFilterCampaign, setLeadFilterCampaign] = useState("all");

  const [inboxFilterChannel, setInboxFilterChannel] = useState("all");
  const [inboxFilterDirection, setInboxFilterDirection] = useState("all");
  const [inboxFilterTemp, setInboxFilterTemp] = useState("all");

  /* ─── Fetch ────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!router.isReady || !clientId) return;
    loadAll();
  }, [router.isReady, clientId]);

  const loadAll = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      setToken(session.access_token);

      const [wsRes, clientRes, usersRes] = await Promise.all([
        fetch(`/api/admin/clients/${clientId}/workspace`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`/api/admin/clients/${clientId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`/api/admin/clients/${clientId}/users`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);

      if (wsRes.ok) setData(await wsRes.json());
      else { router.push("/admin/clients"); return; }

      if (clientRes.ok) {
        const cd: ClientDetails = (await clientRes.json()).client;
        setClientDetails(cd);
        setFbToken(cd.fb_page_token || "");
        setFbPageId(cd.fb_page_id || "");
        setBamoKey(cd.bamo_api_key || "");
      }

      if (usersRes.ok) setUsers(await usersRes.json());
    } catch (err) {
      console.error("Error loading workspace:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ─── Actions ──────────────────────────────────────────────────── */

  const handleToggleActive = async () => {
    if (!clientDetails) return;
    const next = !clientDetails.is_active;
    if (!confirm(`${next ? "Activate" : "Deactivate"} this client?`)) return;
    try {
      setIsTogglingActive(true);
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: next }),
      });
      if (!res.ok) throw new Error();
      setClientDetails(prev => prev ? { ...prev, is_active: next } : prev);
      toast({ title: `Client ${next ? "activated" : "deactivated"}` });
    } catch {
      toast({ title: "Error", description: "Could not update client status", variant: "destructive" });
    } finally {
      setIsTogglingActive(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsSavingSettings(true);
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          bamo_api_key: bamoKey || null,
          fb_page_token: fbToken || null,
          fb_page_id: fbPageId || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Error", description: "Could not save settings", variant: "destructive" });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleRegenerateSecret = async () => {
    if (!confirm("Regenerate webhook secret? The old key will stop working immediately.")) return;
    try {
      setIsRegenerating(true);
      const res = await fetch(`/api/admin/clients/${clientId}/regenerate-secret`, { method: "POST" });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setClientDetails(prev => prev ? { ...prev, webhook_secret: d.webhook_secret } : prev);
      setShowSecret(true);
      toast({ title: "Webhook secret regenerated" });
    } catch {
      toast({ title: "Error", description: "Could not regenerate secret", variant: "destructive" });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newEmail.trim()) return;
    try {
      setIsCreatingUser(true);
      const res = await fetch(`/api/admin/clients/${clientId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          full_name: newFullName.trim() || undefined,
          password: newPassword.trim() || undefined,
          role: "client_admin",
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast({ title: "User created", description: d.message });
      setNewEmail(""); setNewFullName(""); setNewPassword("");
      // Refresh users list
      const usersRes = await fetch(`/api/admin/clients/${clientId}/users`);
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm("Remove this user from the client?")) return;
    const res = await fetch(`/api/admin/clients/${clientId}/users`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast({ title: "User removed" });
    } else {
      toast({ title: "Error", description: "Could not remove user", variant: "destructive" });
    }
  };

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast({ title: `${label} copied` });
  };

  const maskSecret = (s: string) => s.slice(0, 8) + "••••••••••••••••••••••••" + s.slice(-4);

  /* ─── Derived / filtered data ──────────────────────────────────── */

  const filteredCampaigns = (data?.campaigns || []).filter(c => {
    if (campFilterStatus !== "all" && c.status !== campFilterStatus) return false;
    if (campFilterChannel !== "all" && c.channel !== campFilterChannel) return false;
    if (campFilterActive === "yes" && !c.is_active) return false;
    if (campFilterActive === "no" && c.is_active) return false;
    return true;
  });

  const uniqueSources = [...new Set((data?.leads || []).map(l => l.source).filter(Boolean))] as string[];
  const uniqueCampaigns = [...new Set((data?.leads || []).map(l => l.campaigns?.name).filter(Boolean))] as string[];

  const filteredLeads = (data?.leads || []).filter(l => {
    if (leadFilterStatus !== "all" && l.status !== leadFilterStatus) return false;
    if (leadFilterStage !== "all" && l.lead_temperature !== leadFilterStage) return false;
    if (leadFilterSource !== "all" && l.source !== leadFilterSource) return false;
    if (leadFilterCampaign !== "all" && l.campaigns?.name !== leadFilterCampaign) return false;
    return true;
  });

  const filteredConversations = (data?.conversations || []).filter(c => {
    if (inboxFilterChannel !== "all" && c.channel !== inboxFilterChannel) return false;
    if (inboxFilterDirection !== "all" && c.direction !== inboxFilterDirection) return false;
    if (inboxFilterTemp !== "all" && c.leads?.lead_temperature !== inboxFilterTemp) return false;
    return true;
  });

  const tempBadgeClass = (t: string | null | undefined) => {
    if (t === "Hot") return "bg-red-100 text-red-800";
    if (t === "Warm") return "bg-orange-100 text-orange-800";
    if (t === "Cold") return "bg-blue-100 text-blue-800";
    return "bg-gray-100 text-gray-600";
  };

  /* ─── Render ────────────────────────────────────────────────────── */

  if (loading || !data) {
    return <DashboardLayout><div className="p-8">Loading workspace...</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => router.push("/admin/clients")} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Clients
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary">
                {data.client.company_name} — Workspace
              </h1>
              <p className="text-gray-500 mt-1">{data.client.name}</p>
            </div>

            <div className="flex items-center gap-3">
              {clientDetails && (
                <Badge className={clientDetails.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                  {clientDetails.is_active ? "Active" : "Inactive"}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleActive}
                disabled={isTogglingActive}
                className="gap-2"
              >
                {clientDetails?.is_active
                  ? <><PowerOff className="w-4 h-4" /> Deactivate</>
                  : <><Power className="w-4 h-4" /> Activate</>}
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="leads">
              Leads {data.leads.length > 0 && `(${data.leads.length})`}
            </TabsTrigger>
            <TabsTrigger value="campaigns">
              Campaigns {data.campaigns.length > 0 && `(${data.campaigns.length})`}
            </TabsTrigger>
            <TabsTrigger value="inbox">Inbox</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* ── Dashboard ── */}
          <TabsContent value="dashboard">
            <div className="grid grid-cols-4 gap-6">
              {[
                { label: "Total Leads", value: data.stats.totalLeads, icon: <Users className="w-6 h-6 text-blue-600" />, bg: "bg-blue-50" },
                { label: "Hot Leads", value: data.stats.hotLeads, icon: <TrendingUp className="w-6 h-6 text-red-600" />, bg: "bg-red-50" },
                { label: "Active Campaigns", value: data.stats.activeCampaigns, icon: <Zap className="w-6 h-6 text-green-600" />, bg: "bg-green-50" },
                { label: "Total Conversations", value: data.stats.totalConversations, icon: <MessageSquare className="w-6 h-6 text-purple-600" />, bg: "bg-purple-50" },
              ].map(stat => (
                <Card key={stat.label} className="p-6 border shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 ${stat.bg} rounded-lg`}>{stat.icon}</div>
                    <div>
                      <p className="text-sm text-gray-500">{stat.label}</p>
                      <p className="text-2xl font-bold text-primary">{stat.value}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ── Leads ── */}
          <TabsContent value="leads">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
              <Select value={leadFilterStatus} onValueChange={setLeadFilterStatus}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {["New", "Active", "In Contact", "Inactive", "Closed"].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={leadFilterStage} onValueChange={setLeadFilterStage}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Stage" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {["Hot", "Warm", "Cold"].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {uniqueSources.length > 0 && (
                <Select value={leadFilterSource} onValueChange={setLeadFilterSource}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Source" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {uniqueSources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              {uniqueCampaigns.length > 0 && (
                <Select value={leadFilterCampaign} onValueChange={setLeadFilterCampaign}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Campaign" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Campaigns</SelectItem>
                    {uniqueCampaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              {(leadFilterStatus !== "all" || leadFilterStage !== "all" || leadFilterSource !== "all" || leadFilterCampaign !== "all") && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setLeadFilterStatus("all"); setLeadFilterStage("all");
                  setLeadFilterSource("all"); setLeadFilterCampaign("all");
                }}>
                  Clear
                </Button>
              )}
            </div>

            <Card className="border shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["Name", "Status", "Stage", "Source", "Campaign", "Created Date"].map(h => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredLeads.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">No leads match the selected filters.</td></tr>
                    ) : filteredLeads.map(lead => (
                      <tr key={lead.id} className="cursor-pointer hover:bg-gray-50"
                        onClick={() => window.open(`/leads/${lead.id}`, "_blank")}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lead.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm"><Badge variant="outline">{lead.status}</Badge></td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {lead.lead_temperature
                            ? <Badge className={tempBadgeClass(lead.lead_temperature)}>{lead.lead_temperature}</Badge>
                            : "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.source || "—"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.campaigns?.name || "—"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(lead.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* ── Campaigns ── */}
          <TabsContent value="campaigns">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
              <Select value={campFilterStatus} onValueChange={setCampFilterStatus}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {["active", "paused", "completed"].map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={campFilterChannel} onValueChange={setCampFilterChannel}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Channel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  {["webform", "bamo", "facebook", "linkedin", "manual"].map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={campFilterActive} onValueChange={setCampFilterActive}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Active?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Active</SelectItem>
                  <SelectItem value="no">Inactive</SelectItem>
                </SelectContent>
              </Select>

              {(campFilterStatus !== "all" || campFilterChannel !== "all" || campFilterActive !== "all") && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setCampFilterStatus("all"); setCampFilterChannel("all"); setCampFilterActive("all");
                }}>
                  Clear
                </Button>
              )}
            </div>

            <Card className="border shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["Name", "Status", "Channel", "Active", "Target Action", "Created Date"].map(h => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCampaigns.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">No campaigns match the selected filters.</td></tr>
                    ) : filteredCampaigns.map(campaign => (
                      <tr key={campaign.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{campaign.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Badge className={
                            campaign.status === "active" ? "bg-green-100 text-green-800"
                            : campaign.status === "paused" ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-gray-800"
                          }>
                            {campaign.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{campaign.channel}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Badge className={campaign.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                            {campaign.is_active ? "Yes" : "No"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{campaign.target_action || "—"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(campaign.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* ── Inbox ── */}
          <TabsContent value="inbox">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
              <Select value={inboxFilterChannel} onValueChange={setInboxFilterChannel}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Channel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  {["facebook", "messenger", "email", "sms", "manual"].map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={inboxFilterDirection} onValueChange={setInboxFilterDirection}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Direction" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Directions</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>

              <Select value={inboxFilterTemp} onValueChange={setInboxFilterTemp}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Temperature" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Temps</SelectItem>
                  <SelectItem value="Hot">Hot</SelectItem>
                  <SelectItem value="Warm">Warm</SelectItem>
                  <SelectItem value="Cold">Cold</SelectItem>
                </SelectContent>
              </Select>

              {(inboxFilterChannel !== "all" || inboxFilterDirection !== "all" || inboxFilterTemp !== "all") && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setInboxFilterChannel("all"); setInboxFilterDirection("all"); setInboxFilterTemp("all");
                }}>
                  Clear
                </Button>
              )}
            </div>

            <Card className="border shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["Lead Name", "Temperature", "Channel", "Direction", "Message Preview", "Date"].map(h => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredConversations.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">No messages match the selected filters.</td></tr>
                    ) : filteredConversations.map(conv => (
                      <tr key={conv.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {conv.leads?.name || "Unknown"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {conv.leads?.lead_temperature
                            ? <Badge className={tempBadgeClass(conv.leads.lead_temperature)}>{conv.leads.lead_temperature}</Badge>
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Badge variant="outline">{conv.channel}</Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Badge className={conv.direction === "outbound" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}>
                            {conv.direction}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {conv.message_content.substring(0, 80)}{conv.message_content.length > 80 ? "..." : ""}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(conv.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* ── Settings ── */}
          <TabsContent value="settings">
            <div className="space-y-6 max-w-2xl">

              {/* Integration Tokens */}
              <Card className="p-6 border shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-primary">Integration Tokens</h3>
                  <p className="text-sm text-gray-500">API keys and tokens for this client's integrations.</p>
                </div>

                <div className="space-y-2">
                  <Label>Facebook Page ID</Label>
                  <Input
                    value={fbPageId}
                    onChange={e => setFbPageId(e.target.value)}
                    placeholder="e.g. 123456789012345"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    The numeric ID of the client's Facebook Page. Found in the Page's About section or Meta Business Suite.
                    Used to route incoming Messenger messages to this client.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Facebook Page Token</Label>
                  <Input
                    value={fbToken}
                    onChange={e => setFbToken(e.target.value)}
                    placeholder="EAA..."
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Long-lived Page Access Token from Meta Developer Console.
                    Used to send and receive Messenger messages on behalf of this client's page.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Bamo API Key</Label>
                  <Input
                    value={bamoKey}
                    onChange={e => setBamoKey(e.target.value)}
                    placeholder="bamo_..."
                    className="font-mono text-sm"
                  />
                </div>

                <Button onClick={handleSaveSettings} disabled={isSavingSettings}>
                  {isSavingSettings ? "Saving..." : "Save Integration Settings"}
                </Button>
              </Card>

              {/* Webhook Secret */}
              <Card className="p-6 border shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-primary">Webhook Secret</h3>
                  <p className="text-sm text-gray-500">Used to authenticate incoming lead webhooks for this client.</p>
                </div>

                <div className="space-y-2">
                  <Label>Current Secret</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={
                        clientDetails?.webhook_secret
                          ? showSecret
                            ? clientDetails.webhook_secret
                            : maskSecret(clientDetails.webhook_secret)
                          : "Not generated yet"
                      }
                      className="font-mono text-sm"
                    />
                    {clientDetails?.webhook_secret && (
                      <>
                        <Button variant="outline" size="icon" onClick={() => setShowSecret(v => !v)}>
                          {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button variant="outline" size="icon"
                          onClick={() => copyToClipboard(clientDetails.webhook_secret!, "Webhook secret")}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <Button variant="outline" onClick={handleRegenerateSecret} disabled={isRegenerating} className="gap-2">
                  <RefreshCw className={`w-4 h-4 ${isRegenerating ? "animate-spin" : ""}`} />
                  {isRegenerating ? "Regenerating..." : clientDetails?.webhook_secret ? "Regenerate Secret" : "Generate Secret"}
                </Button>
              </Card>

              {/* Users */}
              <Card className="p-6 border shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-primary">Users</h3>
                  <p className="text-sm text-gray-500">Team members assigned to this client. New users are given the client_admin role.</p>
                </div>

                {/* Existing users */}
                {users.length > 0 && (
                  <div className="border rounded-md divide-y">
                    {users.map(u => (
                      <div key={u.id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">{u.full_name || u.email}</p>
                          <p className="text-xs text-gray-500">{u.email} · {u.role}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveUser(u.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Create / invite user */}
                <div className="border rounded-md p-4 space-y-3 bg-gray-50">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <UserPlus className="w-4 h-4" /> Create Client Login
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Email *</Label>
                      <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@example.com" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Full Name</Label>
                      <Input value={newFullName} onChange={e => setNewFullName(e.target.value)} placeholder="Jane Smith" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Password (leave blank to send invite email instead)</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Set a password or leave blank to invite"
                    />
                  </div>
                  <Button onClick={handleCreateUser} disabled={isCreatingUser || !newEmail.trim()} className="gap-2">
                    <UserPlus className="w-4 h-4" />
                    {isCreatingUser ? "Creating..." : newPassword ? "Create Account" : "Send Invite"}
                  </Button>
                </div>
              </Card>

            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
