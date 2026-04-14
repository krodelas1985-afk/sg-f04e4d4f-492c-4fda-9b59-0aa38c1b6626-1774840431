import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Building2, 
  Mail, 
  Phone, 
  Key, 
  Users,
  CheckCircle2,
  XCircle,
  Copy,
  Eye,
  EyeOff,
  RefreshCw
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Client {
  id: string;
  name: string;
  company_name: string;
  email: string;
  phone: string | null;
  webhook_secret: string;
  is_active: boolean;
  bamo_connected: boolean;
  bamo_api_key: string | null;
  bamo_webhook_url: string | null;
  created_at: string;
}

interface ClientUser {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminClientDetailPage() {
  const router = useRouter();
  const { id: clientId } = router.query;

  const [client, setClient] = useState<Client | null>(null);
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [showBamoKey, setShowBamoKey] = useState(false);

  const fetchClient = async () => {
    if (!clientId) return;

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (data) {
      setClient(data);
    }
  };

  const fetchUsers = async () => {
    if (!clientId) return;

    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, is_active, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (data) {
      setUsers(data);
    }
  };

  useEffect(() => {
    if (router.isReady) {
      fetchClient();
      fetchUsers();
      setLoading(false);
    }
  }, [router.isReady, clientId]);

  const handleToggleActive = async () => {
    if (!client) return;

    const { error } = await supabase
      .from("clients")
      .update({ is_active: !client.is_active })
      .eq("id", client.id);

    if (!error) {
      setClient({ ...client, is_active: !client.is_active });
    }
  };

  const handleCopyWebhookSecret = () => {
    if (client?.webhook_secret) {
      navigator.clipboard.writeText(client.webhook_secret);
    }
  };

  const handleRegenerateSecret = async () => {
    if (!client) return;
    if (!confirm("This will invalidate the current webhook secret. Continue?")) return;

    try {
      const response = await fetch(`/api/admin/clients/${client.id}/regenerate-secret`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setClient({ ...client, webhook_secret: data.webhook_secret });
      }
    } catch (err) {
      console.error("Error regenerating secret:", err);
    }
  };

  if (loading || !client) {
    return (
      <DashboardLayout>
        <div className="p-8">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/admin/clients")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Clients
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#1B3A5C]">{client.company_name}</h1>
              <p className="text-gray-500 mt-1">{client.name}</p>
            </div>

            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => router.push(`/admin/clients/${clientId}/workspace`)}
              >
                Enter Workspace
              </Button>
              
              <div className="flex items-center gap-2">
                <Label htmlFor="active-toggle">Active</Label>
                <Switch
                  id="active-toggle"
                  checked={client.is_active}
                  onCheckedChange={handleToggleActive}
                />
              </div>

              {client.is_active ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800">
                  <XCircle className="w-3 h-3 mr-1" />
                  Inactive
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="details" className="space-y-6">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details">
            <Card className="p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4" />
                      Company Name
                    </Label>
                    <Input value={client.company_name} readOnly />
                  </div>

                  <div>
                    <Label className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4" />
                      Contact Name
                    </Label>
                    <Input value={client.name} readOnly />
                  </div>

                  <div>
                    <Label className="flex items-center gap-2 mb-2">
                      <Mail className="w-4 h-4" />
                      Email
                    </Label>
                    <Input value={client.email} readOnly />
                  </div>

                  <div>
                    <Label className="flex items-center gap-2 mb-2">
                      <Phone className="w-4 h-4" />
                      Phone
                    </Label>
                    <Input value={client.phone || "—"} readOnly />
                  </div>
                </div>

                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <Key className="w-4 h-4" />
                    Webhook Secret
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showWebhookSecret ? "text" : "password"}
                        value={client.webhook_secret}
                        readOnly
                      />
                      <button
                        onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        {showWebhookSecret ? (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                    <Button variant="outline" onClick={handleCopyWebhookSecret}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" onClick={handleRegenerateSecret}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="p-6">
              <div className="space-y-4">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-[#1B3A5C]">
                        {user.full_name || user.email}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{user.role}</Badge>
                      {user.is_active ? (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations">
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-[#1B3A5C]">BayMo Integration</h3>
                    {client.bamo_connected ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-800">
                        <XCircle className="w-3 h-3 mr-1" />
                        Not Connected
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="mb-2">BayMo API Key</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={showBamoKey ? "text" : "password"}
                            value={client.bamo_api_key || "—"}
                            readOnly
                          />
                          {client.bamo_api_key && (
                            <button
                              onClick={() => setShowBamoKey(!showBamoKey)}
                              className="absolute right-3 top-1/2 -translate-y-1/2"
                            >
                              {showBamoKey ? (
                                <EyeOff className="w-4 h-4 text-gray-400" />
                              ) : (
                                <Eye className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2">BayMo Webhook URL</Label>
                      <Input value={client.bamo_webhook_url || "—"} readOnly />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}