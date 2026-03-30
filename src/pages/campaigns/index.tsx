import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createBrowserClient } from "@supabase/ssr";

interface Campaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  leads_count: number;
  created_at: string;
  is_locked: boolean;
}

interface Client {
  id: string;
  name: string;
  company_name: string;
}

export default function CampaignsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignChannel, setNewCampaignChannel] = useState("webform");
  const [creating, setCreating] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    fetchProfileAndCampaigns();
  }, []);

  const fetchProfileAndCampaigns = async () => {
    try {
      setLoading(true);
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: p } = await supabase.from("profiles").select("role, client_id").eq("id", authData.user.id).single();
        setProfile(p);
      }

      const res = await fetch("/api/campaigns");
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      const data = await res.json();
      setCampaigns(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      setCreating(true);
      const payload: any = {
        name: newCampaignName,
        channel: newCampaignChannel,
      };

      // Add client_id for baymo_admin
      if (profile?.role === "baymo_admin") {
        payload.client_id = selectedClientId;
      }

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create campaign");
      }
      setShowCreateModal(false);
      fetchProfileAndCampaigns();
      toast({ title: "Campaign created" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-[#E8702A]/10 text-[#E8702A]";
      case "paused": return "bg-amber-100 text-amber-800";
      case "completed": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800"; // draft
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Campaigns</h1>
          {profile?.role === "baymo_admin" && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          )}
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No campaigns yet. {profile?.role === "baymo_admin" && "Create one to get started."}
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium">Channel</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Leads</th>
                    <th className="px-6 py-4 font-medium">Created Date</th>
                    <th className="px-6 py-4 font-medium">Locked</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr 
                      key={c.id} 
                      className="border-b hover:bg-slate-50 cursor-pointer"
                      onClick={() => router.push(`/campaigns/${c.id}`)}
                    >
                      <td className="px-6 py-4 font-medium text-slate-900">{c.name}</td>
                      <td className="px-6 py-4 capitalize">{c.channel}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(c.status)}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">{c.leads_count || 0}</td>
                      <td className="px-6 py-4">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        {c.is_locked && <Lock className="w-4 h-4 text-slate-400" />}
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
            {profile?.role === "baymo_admin" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Client</label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} ({client.company_name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Name</Label>
              <Input 
                value={newCampaignName} 
                onChange={(e) => setNewCampaignName(e.target.value)} 
                placeholder="e.g. Summer Promo"
              />
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={newCampaignChannel} onValueChange={setNewCampaignChannel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newCampaignName}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}