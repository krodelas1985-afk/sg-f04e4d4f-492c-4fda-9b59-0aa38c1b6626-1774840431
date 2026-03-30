import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Copy, RefreshCw, ExternalLink, UserPlus, ShieldAlert } from "lucide-react";

interface Client {
  id: string;
  name: string;
  company_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  webhook_secret: string;
  integrations: any;
  created_at: string;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function ClientDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [client, setClient] = useState<Client | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    company_name: "",
    email: "",
    phone: "",
    is_active: true,
  });
  
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("agent");
  const [isAddingUser, setIsAddingUser] = useState(false);

  useEffect(() => {
    if (id) {
      fetchClientData();
    }
  }, [id]);

  const fetchClientData = async () => {
    try {
      const [clientRes, usersRes] = await Promise.all([
        fetch(`/api/admin/clients/${id}`),
        fetch(`/api/admin/clients/${id}/users`)
      ]);

      if (clientRes.ok) {
        const data = await clientRes.json();
        setClient(data.client);
        setFormData({
          name: data.client.name || "",
          company_name: data.client.company_name || "",
          email: data.client.email || "",
          phone: data.client.phone || "",
          is_active: data.client.is_active,
        });
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users);
      }
    } catch (err) {
      console.error("Failed to fetch client data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        alert("Client updated successfully");
      }
    } catch (err) {
      alert("Failed to update client");
    } finally {
      setSaving(false);
    }
  };

  const regenerateSecret = async () => {
    if (!confirm("Are you sure? Any external services using the current secret will break until updated.")) return;
    
    try {
      const res = await fetch(`/api/admin/clients/${id}/regenerate-secret`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setClient(prev => prev ? { ...prev, webhook_secret: data.webhook_secret } : null);
        alert("Webhook secret regenerated");
      }
    } catch (err) {
      alert("Failed to regenerate secret");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard");
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingUser(true);
    try {
      const res = await fetch(`/api/admin/clients/${id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newUserEmail, role: newUserRole }),
      });
      if (res.ok) {
        setNewUserEmail("");
        fetchClientData();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (err) {
      alert("Failed to add user");
    } finally {
      setIsAddingUser(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentStatus }),
      });
      if (res.ok) fetchClientData();
    } catch (err) {
      alert("Failed to update user status");
    }
  };

  if (loading) {
    return <DashboardLayout><div className="p-8">Loading client details...</div></DashboardLayout>;
  }

  if (!client) {
    return <DashboardLayout><div className="p-8">Client not found</div></DashboardLayout>;
  }

  // Define webhook URL (fallback to window.location.origin if env var missing)
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.baymo.ai';
  const webhookUrl = `${appUrl}/api/webhooks/lead`;

  return (
    <DashboardLayout>
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-foreground">{client.name}</h1>
            <p className="text-muted-foreground">{client.company_name || "No company name"}</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={() => router.push(`/dashboard?client_id=${client.id}`)}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Enter Workspace
            </Button>
          </div>
        </div>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl mb-8">
            <TabsTrigger value="details">Client Details</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks & API</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Client Information</CardTitle>
                <CardDescription>Update the core details for this client.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateClient} className="space-y-6 max-w-xl">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Client Name</Label>
                      <Input 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Company Name</Label>
                      <Input 
                        value={formData.company_name} 
                        onChange={e => setFormData({...formData, company_name: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contact Email</Label>
                      <Input 
                        type="email"
                        value={formData.email} 
                        onChange={e => setFormData({...formData, email: e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input 
                        value={formData.phone} 
                        onChange={e => setFormData({...formData, phone: e.target.value})} 
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 pt-4 border-t">
                    <Switch 
                      checked={formData.is_active} 
                      onCheckedChange={checked => setFormData({...formData, is_active: checked})}
                      id="active-status"
                    />
                    <Label htmlFor="active-status">Active Account Status</Label>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Inbound Webhooks</CardTitle>
                <CardDescription>Use these credentials to send data into BayMo from external sources.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Webhook Endpoint URL (POST)</Label>
                  <div className="flex space-x-2">
                    <Input readOnly value={webhookUrl} className="bg-muted font-mono text-sm" />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookUrl)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Webhook Secret</Label>
                  <div className="flex space-x-2">
                    <Input 
                      type="password" 
                      readOnly 
                      value={client.webhook_secret} 
                      className="bg-muted font-mono text-sm" 
                    />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(client.webhook_secret)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Include this secret in the Authorization header as a Bearer token.
                  </p>
                </div>

                <div className="pt-6 border-t">
                  <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={regenerateSecret}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate Secret
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Connected Integrations</CardTitle>
                <CardDescription>View status of external connected services.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6 max-w-xl">
                  {['Webform', 'Bamo AI', 'Facebook Lead Ads', 'LinkedIn'].map((integration) => (
                    <div key={integration} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="font-medium">{integration}</div>
                      <Switch disabled checked={false} />
                    </div>
                  ))}
                  <p className="text-sm text-muted-foreground">Integrations are managed by the client in their workspace.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Client Users</CardTitle>
                <CardDescription>Manage users who have access to this client's workspace.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddUser} className="flex items-end space-x-4 mb-8 bg-muted/50 p-4 rounded-lg border">
                  <div className="flex-1 space-y-2">
                    <Label>Email Address</Label>
                    <Input 
                      type="email" 
                      placeholder="user@example.com" 
                      value={newUserEmail}
                      onChange={e => setNewUserEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="w-48 space-y-2">
                    <Label>Role</Label>
                    <select 
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={newUserRole}
                      onChange={e => setNewUserRole(e.target.value)}
                    >
                      <option value="client_admin">Client Admin</option>
                      <option value="manager">Manager</option>
                      <option value="agent">Agent</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <Button type="submit" disabled={isAddingUser}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </form>

                <div className="border rounded-md">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground border-b">
                      <tr>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {users.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No users found for this client.</td></tr>
                      ) : (
                        users.map(user => (
                          <tr key={user.id}>
                            <td className="px-4 py-3 font-medium">{user.full_name || "-"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                            <td className="px-4 py-3 capitalize">{user.role.replace('_', ' ')}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {user.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => toggleUserStatus(user.id, user.is_active)}
                              >
                                {user.is_active ? "Deactivate" : "Activate"}
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}