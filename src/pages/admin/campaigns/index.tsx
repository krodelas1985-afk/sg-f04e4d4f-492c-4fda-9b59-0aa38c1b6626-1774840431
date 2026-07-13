import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Lock, Unlock, Eye, EyeOff, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Campaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  is_active: boolean;
  is_locked: boolean;
  leads_count: number;
  created_at: string;
  client_id: string | null;
  clients: { id: string; name: string; company_name: string } | null;
}

interface Client {
  id: string;
  name: string;
  company_name: string;
}

export default function AdminCampaignsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newChannel, setNewChannel] = useState("facebook");
  const [newClientId, setNewClientId] = useState("unallocated");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filters
  const [filterClient, setFilterClient] = useState("all");
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterActive, setFilterActive] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [campRes, clientRes] = await Promise.all([
        fetch("/api/admin/campaigns"),
        fetch("/api/admin/clients"),
      ]);
      if (campRes.ok) {
        const data = await campRes.json();
        setCampaigns(data.campaigns || []);
      }
      if (clientRes.ok) {
        const data = await clientRes.json();
        setClients(data.clients || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      setCreating(true);
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          channel: newChannel,
          client_id: newClientId === "unallocated" ? null : newClientId,
        }),
      });
      if (!res.ok) throw new Error("Failed to create campaign");
      const data = await res.json();
      setShowCreateModal(false);
      setNewName("");
      setNewChannel("facebook");
      setNewClientId("unallocated");
      toast({ title: "Campaign created" });
      router.push(`/admin/campaigns/${data.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (campaign: Campaign, field: "is_active" | "is_locked") => {
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !campaign[field] }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setCampaigns(prev =>
        prev.map(c => c.id === campaign.id ? { ...c, [field]: !campaign[field] } : c)
      );
      toast({ title: `Campaign ${field === "is_active" ? (!campaign.is_active ? "activated" : "deactivated") : (!campaign.is_locked ? "locked" : "unlocked")}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
    try {
      setDeletingId(id);
      const res = await fetch(`/api/admin/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setCampaigns(prev => prev.filter(c => c.id !== id));
      toast({ title: "Campaign deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-brand-orange/10 text-brand-orange";
      case "paused": return "bg-amber-100 text-amber-800";
      case "completed": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const filteredCampaigns = campaigns.filter(c => {
    if (filterClient === "__unallocated__" && c.client_id !== null) return false;
    if (filterClient !== "all" && filterClient !== "__unallocated__" && c.client_id !== filterClient) return false;
    if (filterChannel !== "all" && c.channel !== filterChannel) return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (filterActive === "yes" && !c.is_active) return false;
    if (filterActive === "no" && c.is_active) return false;
    return true;
  });

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Campaign
          </Button>
        </div>

        {/* Filter toolbar */}
        <div className="flex flex-wrap gap-3 mb-4">
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              <SelectItem value="__unallocated__">Unallocated</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterChannel} onValueChange={setFilterChannel}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="webform">Webform</SelectItem>
              <SelectItem value="bamo">Bamo</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterActive} onValueChange={setFilterActive}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Active?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="yes">Active</SelectItem>
              <SelectItem value="no">Inactive</SelectItem>
            </SelectContent>
          </Select>

          {(filterClient !== "all" || filterChannel !== "all" || filterStatus !== "all" || filterActive !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFilterClient("all"); setFilterChannel("all"); setFilterStatus("all"); setFilterActive("all"); }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            {campaigns.length === 0 ? "No campaigns yet." : "No campaigns match the selected filters."}
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium">Client</th>
                    <th className="px-6 py-4 font-medium">Channel</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Leads</th>
                    <th className="px-6 py-4 font-medium">Active</th>
                    <th className="px-6 py-4 font-medium">Locked</th>
                    <th className="px-6 py-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-slate-50">
                      <td
                        className="px-6 py-4 font-medium text-slate-900 cursor-pointer hover:text-brand-orange"
                        onClick={() => router.push(`/admin/campaigns/${c.id}`)}
                      >
                        {c.name}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {c.clients ? c.clients.name : <span className="italic text-slate-400">Unallocated</span>}
                      </td>
                      <td className="px-6 py-4 capitalize">{c.channel}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(c.status)}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">{c.leads_count || 0}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggle(c, "is_active")}
                          className="p-1 rounded hover:bg-slate-100"
                          title={c.is_active ? "Deactivate" : "Activate"}
                        >
                          {c.is_active
                            ? <Eye className="w-4 h-4 text-green-600" />
                            : <EyeOff className="w-4 h-4 text-slate-400" />}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggle(c, "is_locked")}
                          className="p-1 rounded hover:bg-slate-100"
                          title={c.is_locked ? "Unlock" : "Lock"}
                        >
                          {c.is_locked
                            ? <Lock className="w-4 h-4 text-red-500" />
                            : <Unlock className="w-4 h-4 text-slate-400" />}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={deletingId === c.id}
                          className="p-1 rounded hover:bg-slate-100"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Summer Promo"
              />
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={newChannel} onValueChange={setNewChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="webform">Webform</SelectItem>
                  <SelectItem value="bamo">Bamo</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Allocate to Client (optional)</Label>
              <Select value={newClientId} onValueChange={setNewClientId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unallocated">— Unallocated —</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name} ({client.company_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
