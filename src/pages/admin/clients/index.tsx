import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import Link from "next/link";

interface Client {
  id: string;
  name: string;
  company_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  leads_count: number;
  created_at: string;
}

function ClientForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      company_name: formData.get("company_name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
    };

    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to create client");
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card w-full max-w-md rounded-lg shadow-lg overflow-hidden border">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Create New Client</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-800 rounded-md text-sm">{error}</div>}
          <div className="space-y-2">
            <Label htmlFor="name">Client Name</Label>
            <Input id="name" name="name" required placeholder="e.g. John Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name</Label>
            <Input id="company_name" name="company_name" placeholder="e.g. Acme Corp" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Primary Email</Label>
            <Input id="email" name="email" type="email" required placeholder="john@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" name="phone" placeholder="+1 (555) 000-0000" />
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Client"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminClients() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/admin/clients");
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients);
      }
    } catch (err) {
      console.error("Failed to fetch clients", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  return (
    <DashboardLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-foreground">Clients</h1>
            <p className="text-muted-foreground">Manage BayMo clients and their workspaces.</p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Client
          </Button>
        </div>

        <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Company</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Leads</th>
                  <th className="px-6 py-3 font-medium">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                      Loading clients...
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                      No clients found. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  clients.map((client) => (
                    <tr
                      key={client.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/admin/clients/${client.id}`)}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{client.name}</div>
                        <div className="text-sm text-gray-500">{client.email}</div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{client.company_name || "-"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{client.email}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            client.is_active
                              ? "bg-green-100 text-green-800 border-green-200 border"
                              : "bg-gray-100 text-gray-800 border-gray-200 border"
                          }`}
                        >
                          {client.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{client.leads_count}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(client.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && (
        <ClientForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            fetchClients();
          }}
        />
      )}
    </DashboardLayout>
  );
}